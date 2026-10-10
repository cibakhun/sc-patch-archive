// VerseBase Flotte — der EINE Besitzer der Schiffsflotte im Browser.
//
// Die Flotte sind die Favoriten-Zeilen mit kind='ship' (slug = Fahrzeug-id);
// dieselben Zeilen zeigt das Pilotenprofil unter „Fleet". Datenblatt-Stern und
// Hangar schreiben sie nur hierüber: zwei Schreiber mit je eigenem Zustand
// laufen auseinander.
//
// API (Hangar und Datenblatt verlassen sich darauf):
//   VBFleet.ids() / has(id) / toggle(id, label) / subscribe(fn) / retry() / dismissMerged()
//   snapshot = { ids, mode: 'guest'|'account', sync: 'local'|'syncing'|'synced'|'error',
//                error: null|'offline'|'auth'|'write'|'read', merged }
//   <button data-fleet-ship="<id>" data-fleet-label="<Name>">: aria-pressed setzt
//   dieses Skript. Optional data-fleet-on/-off mit .js-fleet-txt (Beschriftung)
//   und [data-fleet-retry] (nur bei sync 'error' sichtbar, Klick = retry()). Sein
//   Text kommt aus data-fleet-unsaved, solange ein Klick oder ein Gast-Schiff das
//   Konto nicht erreicht hat, sonst aus data-fleet-unsynced.
//   merged zählt die Gast-Schiffe der letzten Übernahme. Es steht im Spiegel des
//   Kontos, bis dismissMerged() es quittiert: wer sich auf einem Datenblatt
//   anmeldet, liest den Hinweis erst im Hangar.
//
// Ablage:
//   Gast    'vb.fleet.v1'        {ships:[{id,label}]}   — zugleich die Warteschlange
//                                                        der Übernahme beim Anmelden
//   Konto   'vb.fleet.v1.<uid>'  {ships:[…], pending:{id:{op,t}}, merged?}  (Spiegel,
//                                                        überlebt einen geschlossenen Tab)
//   Server  favorites über VBAccount.rest; POST 409 (23505) und DELETE ohne Treffer
//           gelten als erledigt, deshalb darf jeder Schritt beliebig oft laufen.
//
// Der Modus (Gast oder Konto) folgt der gespeicherten Sitzung sofort bei jedem
// Ereignis, nicht erst im nächsten Netzlauf. Hinge ein Lauf und wartete der
// Moduswechsel auf ihn, ginge der Klick des nächsten Besuchers mit dem alten
// Schlüssel ins alte Konto.
(function () {
  'use strict';
  // Doppelt eingebunden hiessen zwei Klick-Handler: jeder Klick schaltete hin und gleich zurück.
  if (window.VBFleet) return;

  var GUEST_KEY = 'vb.fleet.v1';
  var MIRROR_PREFIX = GUEST_KEY + '.';
  var LOCK_NAME = 'vb.fleet.sync';
  var ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
  var FLUSH_MS = 300;
  var STALE_MS = 60000;
  // Jeder Schritt eines Laufs (Sitzung, Anfrage samt Antwortkörper) endet
  // spätestens hier: ein hängender Refresh oder fetch hielte sonst die Sperre
  // aller Tabs fest.
  var TIMEOUT_MS = 20000;
  // Gehört die gespeicherte Sitzung noch diesem Konto, ist aber gerade nicht
  // nutzbar (Refresh in einem anderen Tab, kein Netz), versucht es der Abgleich
  // wieder: nach 2 s, dann doppelt so lange, höchstens einmal je Minute.
  var BACKOFF_MS = 2000;
  var BACKOFF_MAX_MS = 60000;

  var VB = null;
  var started = false;
  var uid = null;
  var ships = [];
  var sync = 'local';
  var error = null;
  var created = 0;
  var backoff = 0;
  var backoffTimer = null;
  var lastPull = 0;
  var storageBroken = false;
  var subs = [];
  var waiters = [];
  var lastKey = '';
  var flushTimer = null;
  var chain = Promise.resolve();
  var queued = null;
  var wantPull = false;
  var paintQueued = false;

  // Was aus dem Speicher kommt, wird hier geprüft, nirgends sonst.
  function readJson(key) {
    var raw;
    try { raw = localStorage.getItem(key); } catch (e) { storageBroken = true; return null; }
    try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { storageBroken = true; }
  }
  function drop(key) {
    try { localStorage.removeItem(key); } catch (e) { storageBroken = true; }
  }
  function find(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return i;
    return -1;
  }
  function cleanLabel(label, id) {
    return typeof label === 'string' && label.trim() ? label.trim().slice(0, 120) : id;
  }
  function cleanShips(list) {
    var out = [];
    if (!Array.isArray(list)) return out;
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (s && typeof s.id === 'string' && ID_RE.test(s.id) && find(out, s.id) === -1) {
        out.push({ id: s.id, label: cleanLabel(s.label, s.id) });
      }
    }
    return out;
  }
  function labelOf(list, id) {
    var at = find(list, id);
    return at === -1 ? id : list[at].label;
  }
  function readGuest() {
    var g = readJson(GUEST_KEY);
    return cleanShips(g && g.ships);
  }
  function writeGuest(list) {
    if (list.length) writeJson(GUEST_KEY, { ships: list });
    else drop(GUEST_KEY);
  }
  function mirrorKey(id) { return MIRROR_PREFIX + id; }
  function readMirror(id) {
    var m = readJson(mirrorKey(id)) || {};
    var raw = m.pending && typeof m.pending === 'object' ? m.pending : {};
    var pending = {};
    Object.keys(raw).forEach(function (k) {
      var it = raw[k];
      if (ID_RE.test(k) && it && (it.op === 'add' || it.op === 'del') && typeof it.t === 'string') {
        pending[k] = { op: it.op, t: it.t };
      }
    });
    var n = typeof m.merged === 'number' && isFinite(m.merged) ? Math.floor(m.merged) : 0;
    return { ships: cleanShips(m.ships), pending: pending, merged: n > 0 ? n : 0 };
  }
  function writeMirror(id, m) {
    var out = { ships: m.ships, pending: m.pending };
    if (m.merged > 0) out.merged = m.merged;
    writeJson(mirrorKey(id), out);
  }
  function hasPending(id) { return Object.keys(readMirror(id).pending).length > 0; }
  // Geteilter Rechner: ohne Sitzung bleibt kein Konto-Spiegel im Browser liegen,
  // und ein anderes Konto sieht den Spiegel seines Vorgängers nie.
  function dropMirrors(keep) {
    var doomed = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(MIRROR_PREFIX) === 0 && k !== keep) doomed.push(k);
      }
    } catch (e) { storageBroken = true; }
    doomed.forEach(drop);
  }
  function token() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function peekId() {
    var kept = VB && typeof VB.peek === 'function' ? VB.peek() : null;
    var id = kept && kept.user && kept.user.id;
    return typeof id === 'string' && id ? id : null;
  }

  // Im Kontomodus stehen Gast-Schiffe, deren Übernahme noch läuft, schon mit in
  // der Flotte — sonst verschwänden sie nach dem Anmelden bis zur Server-Antwort.
  function computeView() {
    if (!uid) return readGuest();
    var m = readMirror(uid);
    var out = m.ships.slice();
    readGuest().forEach(function (g) {
      if (!m.pending[g.id] && find(out, g.id) === -1) out.push(g);
    });
    return out;
  }
  function has(id) { return find(ships, id) !== -1; }
  function snapshot() {
    return {
      ids: ships.map(function (s) { return s.id; }),
      mode: uid ? 'account' : 'guest',
      sync: sync,
      error: error,
      merged: uid ? readMirror(uid).merged : 0,
    };
  }
  // Ein Klick oder ein Gast-Schiff hat das Konto noch nicht erreicht.
  function unsaved() {
    return !!uid && (hasPending(uid) || readGuest().length > 0);
  }
  function notify() {
    // Der Text des Wiederholen-Knopfs hängt an unsaved(), das nicht im Schnappschuss steht.
    var key = JSON.stringify(snapshot()) + (sync === 'error' && unsaved() ? '|unsaved' : '');
    if (key === lastKey) return;
    lastKey = key;
    paint();
    subs.slice().forEach(function (fn) {
      try { fn(snapshot()); } catch (e) { /* ein fehlerhafter Abonnent bremst die anderen nicht */ }
    });
  }
  function refresh() {
    ships = computeView();
    notify();
  }
  function setSync(state, code) {
    sync = state;
    error = state === 'error' ? code : null;
    notify();
  }

  function syncMode() {
    var id = peekId();
    if (!id) leave();
    else if (id !== uid) enter(id);
  }
  function enter(id) {
    dropMirrors(mirrorKey(id));
    uid = id;
    created = 0;
    lastPull = 0;
    calm();
    ships = computeView();
    setSync('syncing', null);
  }
  function leave() {
    dropMirrors(null);
    uid = null;
    created = 0;
    calm();
    ships = readGuest();
    setSync('local', null);
    var mine = waiters;
    waiters = [];
    mine.forEach(function (w) { w.resolve(has(w.id)); });
  }

  function paint() {
    var btns = document.querySelectorAll('[data-fleet-ship]');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      var on = has(b.getAttribute('data-fleet-ship'));
      var pressed = on ? 'true' : 'false';
      // Nur bei Abweichung schreiben: auch ein Schreiben ohne Änderung meldet
      // jeder MutationObserver der Seite.
      if (b.getAttribute('aria-pressed') !== pressed) b.setAttribute('aria-pressed', pressed);
      var lbl = b.getAttribute(on ? 'data-fleet-on' : 'data-fleet-off');
      var txt = b.querySelector('.js-fleet-txt');
      if (txt && lbl && txt.textContent !== lbl) txt.textContent = lbl;
    }
    var off = sync !== 'error';
    // "Nicht gespeichert" nur, solange ein Klick fehlt; ein gescheitertes Lesen
    // oder eine gerade unbrauchbare Sitzung lassen nur die Anzeige veralten.
    var label = off ? null : unsaved() ? 'data-fleet-unsaved' : 'data-fleet-unsynced';
    var rs = document.querySelectorAll('[data-fleet-retry]');
    for (var j = 0; j < rs.length; j++) {
      if (rs[j].hidden !== off) rs[j].hidden = off;
      var t = label && rs[j].getAttribute(label);
      if (t && rs[j].textContent !== t) rs[j].textContent = t;
    }
  }
  function paintSoon() {
    if (paintQueued) return;
    paintQueued = true;
    var run = function () { paintQueued = false; paint(); };
    if (window.requestAnimationFrame) window.requestAnimationFrame(run);
    else setTimeout(run, 16);
  }
  function onClick(e) {
    var el = e.target;
    if (!el || typeof el.closest !== 'function') return;
    var btn = el.closest('[data-fleet-ship]');
    if (btn) {
      // Ship und Name zum Klickzeitpunkt lesen: der Hangar tauscht sie am selben Knopf.
      toggle(btn.getAttribute('data-fleet-ship'), btn.getAttribute('data-fleet-label'));
      return;
    }
    if (el.closest('[data-fleet-retry]')) request(true);
  }

  function toggle(id, label) {
    if (typeof id !== 'string' || !ID_RE.test(id)) return Promise.resolve(false);
    label = cleanLabel(label, id);
    if (!uid) {
      // Ohne nutzbaren Speicher hält die Seite die Flotte nur im Arbeitsspeicher.
      var g = storageBroken ? ships.slice() : readGuest();
      var at = find(g, id);
      if (at === -1) g.push({ id: id, label: label });
      else g.splice(at, 1);
      writeGuest(g);
      ships = g;
      notify();
      return Promise.resolve(at === -1);
    }
    var on = find(computeView(), id) === -1;
    var m = readMirror(uid);
    var i = find(m.ships, id);
    if (on && i === -1) m.ships.push({ id: id, label: label });
    if (!on && i !== -1) m.ships.splice(i, 1);
    m.pending[id] = { op: on ? 'add' : 'del', t: token() };
    writeMirror(uid, m);
    // Ein Klick im Konto ist die neueste Absicht für dieses Schiff: die
    // Gast-Kopie darf ihn bei der Übernahme nicht mehr überstimmen.
    var rest = readGuest();
    var gi = find(rest, id);
    if (gi !== -1) { rest.splice(gi, 1); writeGuest(rest); }
    ships = computeView();
    setSync('syncing', null);
    clearTimeout(flushTimer);
    flushTimer = setTimeout(function () { flushTimer = null; request(false); }, FLUSH_MS);
    return new Promise(function (resolve) { waiters.push({ id: id, resolve: resolve }); });
  }

  // Web Locks reihen die Läufe aller Tabs: ein zweiter Tab liest offene
  // Absichten erst, wenn der erste sie bestätigt hat, und schickt sie nicht
  // ein zweites Mal. Ohne Web Locks (ältere Browser) bleibt der Server-Stand
  // richtig, aber doppelte Zeilen sind möglich, und ein älterer GET eines
  // anderen Tabs kann einen eben bestätigten Klick bis zum nächsten Abgleich
  // aus der Anzeige nehmen.
  function locked(fn) {
    var locks = typeof navigator !== 'undefined' && navigator.locks;
    if (!locks || typeof locks.request !== 'function') return Promise.resolve().then(fn);
    var ran = false;
    var p;
    try {
      p = locks.request(LOCK_NAME, function () { ran = true; return fn(); });
    } catch (e) {
      return Promise.resolve().then(fn);
    }
    // In einem undurchsichtigen Ursprung lehnt request() ab, ohne fn je zu rufen.
    return p.then(null, function (e) { if (ran) throw e; return fn(); });
  }
  function request(pull) {
    if (pull) wantPull = true;
    if (!queued) queued = chain = chain.then(runCycle, runCycle);
    return queued;
  }
  function runCycle() {
    var pull = wantPull;
    var mine = waiters;
    wantPull = false;
    queued = null;
    waiters = [];
    return locked(function () { return cycle(pull); })
      .then(null, function () { setSync('error', 'offline'); })
      .then(function () {
        mine.forEach(function (w) { w.resolve(has(w.id)); });
      });
  }
  function cycle(pull) {
    if (!VB) return Promise.resolve();
    return resolveMode().then(function (sess) {
      if (!sess) return;
      var run = { me: uid, sess: sess, stop: null, failed: null };
      return flush(run).then(function (go) {
        if (!go) return;
        if (pull || Date.now() - lastPull > STALE_MS || readGuest().length) return pullFrom(run);
      }).then(function () { finish(run); });
    });
  }
  // Prüft die Sitzung fürs Netz. Liegt sie noch im Speicher, ist aber gerade
  // nicht nutzbar (offline, abgelaufen, Refresh-Sperre eines anderen Tabs),
  // bleibt der Spiegel mit seinen offenen Klicks stehen: Wegwerfen hiesse, sie
  // zu verlieren. Nur eine wirklich fehlende Sitzung ist Abmelden. Und es ist
  // kein Fehler des Besuchers: ein Refresh landet ohne Ereignis, wenn er im
  // selben Tab lief, deshalb fragt der Abgleich später selbst wieder.
  function resolveMode() {
    syncMode();
    if (!uid) return Promise.resolve(null);
    var me = uid;
    return deadline(function () { return VB.session(); }).then(function (sess) {
      var id = sess && sess.user && sess.user.id;
      if (id === me) { calm(); return sess; }
      syncMode();
      if (uid && uid !== me) request(true);
      else if (uid === me) later();
      return null;
    }, function () {
      setSync('error', 'offline');
      return null;
    });
  }
  function later() {
    setSync('syncing', null);
    clearTimeout(backoffTimer);
    var wait = Math.min(BACKOFF_MAX_MS, BACKOFF_MS * Math.pow(2, backoff++));
    backoffTimer = setTimeout(function () { backoffTimer = null; request(true); }, wait);
  }
  function calm() {
    clearTimeout(backoffTimer);
    backoffTimer = null;
    backoff = 0;
  }
  function finish(run) {
    if (uid !== run.me) return;
    ships = computeView();
    if (run.stop || run.failed) { setSync('error', run.stop || run.failed); return; }
    // Offen ist, was während des Laufs dazukam — auch aus einem anderen Tab.
    if (hasPending(run.me)) { setSync('syncing', null); request(false); return; }
    setSync('synced', null);
  }
  // Nacheinander; hört auf, wenn ein Schritt false liefert oder der Modus wechselte.
  function each(run, list, step) {
    var i = 0;
    function next(go) {
      if (go === false || uid !== run.me) return false;
      if (i >= list.length) return true;
      return Promise.resolve(step(list[i++])).then(next);
    }
    return Promise.resolve(next(true));
  }
  // Eine abgelehnte Schreibung hält die übrigen nicht auf; offline oder ohne
  // gültige Sitzung ist jeder weitere Versuch in diesem Lauf vergebens.
  function note(run, res) {
    if (res === 'write') { run.failed = 'write'; return true; }
    run.stop = res;
    return false;
  }

  // Nach der Frist wird die Anfrage abgebrochen (`start` bekommt das Signal),
  // bevor der Lauf die Sperre freigibt: liefe sie weiter, käme sie womöglich
  // nach dem nächsten Lauf an, und ein spätes Hinzufügen holte ein eben
  // entferntes Schiff zurück.
  function deadline(start) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        if (ctl) ctl.abort();
        reject(new Error('timeout'));
      }, TIMEOUT_MS);
      Promise.resolve(ctl && ctl.signal).then(start).then(
        function (v) { clearTimeout(timer); resolve(v); },
        function (e) { clearTimeout(timer); reject(e); });
    });
  }
  // Der Körper gehört zum Schritt: erst mit ihm ist die Antwort da. Gelesen
  // wird er nur, wo er zählt (GET, 409); body bleibt sonst undefined, ebenso,
  // wenn er kein JSON ist.
  function call(sess, method, path, body) {
    return deadline(function (signal) {
      return Promise.resolve(VB.rest(sess, method, path, body, undefined, signal)).then(function (r) {
        var res = { ok: r.ok, status: r.status, body: undefined };
        if (!(method === 'GET' && r.ok) && r.status !== 409) return res;
        return Promise.resolve(r.json()).then(function (b) { res.body = b; return res; }, function () { return res; });
      });
    });
  }
  function send(run, id, op, label) {
    var req = op === 'add'
      ? call(run.sess, 'POST', 'favorites', { kind: 'ship', slug: id, label: label })
      : call(run.sess, 'DELETE', 'favorites?kind=eq.ship&slug=eq.' + encodeURIComponent(id) +
          '&user_id=eq.' + encodeURIComponent(run.me));
    return req.then(function (r) {
      // 409 meldet PostgREST auch für Fremdschlüssel; erledigt ist nur 23505 (die Zeile gibt es schon).
      if (op === 'add' && r.status === 409) return r.body && r.body.code === '23505' ? 'kept' : 'write';
      if (r.ok) return op === 'add' ? 'created' : 'kept';
      return r.status === 401 || r.status === 403 ? 'auth' : 'write';
    }, function () { return 'offline'; });
  }
  function landed(res) { return res === 'created' || res === 'kept'; }

  function flush(run) {
    var ids = Object.keys(readMirror(run.me).pending);
    if (ids.length) setSync('syncing', null);
    return each(run, ids, function (id) {
      // Die Absicht erst jetzt lesen: ein Klick während des Laufs ersetzt die
      // ältere, und die ältere geht gar nicht erst hinaus.
      var m = readMirror(run.me);
      var it = m.pending[id];
      if (!it) return true;
      return send(run, id, it.op, labelOf(m.ships, id)).then(function (res) {
        if (!landed(res)) return note(run, res);
        confirm(run.me, id, it.t);
        return true;
      });
    });
  }
  // Nur wenn die Absicht noch dieselbe ist (Token): eine späte Antwort darf
  // einen neueren Klick nicht löschen — der geht im nächsten Lauf hinaus.
  function confirm(me, id, t) {
    if (uid !== me) return;
    var m = readMirror(me);
    if (m.pending[id] && m.pending[id].t === t) {
      delete m.pending[id];
      writeMirror(me, m);
    }
  }

  function pullFrom(run) {
    setSync('syncing', null);
    return call(run.sess, 'GET', 'favorites?select=slug,label&kind=eq.ship&user_id=eq.' +
        encodeURIComponent(run.me) + '&order=created_at.asc')
      .then(function (r) {
        if (!r.ok) return r.status === 401 || r.status === 403 ? 'auth' : 'read';
        if (r.body === undefined) return 'read';
        return cleanShips((Array.isArray(r.body) ? r.body : []).map(function (row) {
          return { id: row && row.slug, label: row && row.label };
        }));
      }, function () { return 'offline'; })
      .then(function (server) {
        if (uid !== run.me) return;
        if (typeof server === 'string') { run.stop = server; return; }
        lastPull = Date.now();
        // Erst nach der Antwort gelesen: Klicks, die während des GET fielen,
        // liegen jetzt im Spiegel und überleben den älteren Server-Stand.
        var m = readMirror(run.me);
        var next = server.slice();
        Object.keys(m.pending).forEach(function (id) {
          var at = find(next, id);
          if (m.pending[id].op === 'add' && at === -1) next.push({ id: id, label: labelOf(m.ships, id) });
          if (m.pending[id].op === 'del' && at !== -1) next.splice(at, 1);
        });
        m.ships = next;
        writeMirror(run.me, m);
        ships = computeView();
        notify();
        return adopt(run, server);
      });
  }

  // Übernahme der Gast-Flotte ins Konto (Muster crafting-app.js). Ein
  // Gast-Schiff verlässt die Gast-Kopie erst, NACHDEM sein Konto-Eintrag
  // bestätigt ist. Bricht der Lauf an irgendeiner Stelle ab, bleibt der Rest
  // liegen, und der nächste Lauf macht dort weiter — ohne doppelte Zeilen, weil
  // der GET davor die schon gelandeten kennt.
  function adopt(run, server) {
    // Nur ein sichtbarer Tab übernimmt: dort ist der Besucher gerade, dort soll
    // der einmalige Hinweis erscheinen. Ein Tab im Hintergrund holt es nach,
    // sobald er sichtbar wird (onVisible).
    if (document.visibilityState === 'hidden') return;
    var queue = readGuest();
    return each(run, queue, function (g) {
      // Inzwischen aus der Gast-Kopie entfernt (ein anderer Tab): nicht mehr senden.
      if (find(readGuest(), g.id) === -1) return true;
      // Liegt im Konto schon eine Absicht für dieses Schiff, ist sie neuer als die Gast-Kopie.
      if (readMirror(run.me).pending[g.id] || find(server, g.id) !== -1) {
        handOver(run.me, g, false);
        return true;
      }
      // Gast-Schiffe gehen nur mit der Sitzung hinaus, die jetzt gespeichert ist.
      if (peekId() !== run.me) { syncMode(); return false; }
      return send(run, g.id, 'add', g.label).then(function (res) {
        if (!landed(res)) return note(run, res);
        handOver(run.me, g, res === 'created');
        return true;
      });
    }).then(function () {
      // Der Hinweis zählt erst, wenn die ganze Gast-Kopie im Konto steht.
      if (uid !== run.me || !queue.length || readGuest().length || !created) return;
      var m = readMirror(run.me);
      m.merged += created;
      created = 0;
      writeMirror(run.me, m);
    });
  }
  function handOver(me, g, rowCreated) {
    if (uid !== me) return;
    var m = readMirror(me);
    if (!m.pending[g.id] && find(m.ships, g.id) === -1) {
      m.ships.push(g);
      writeMirror(me, m);
    }
    var rest = readGuest();
    var at = find(rest, g.id);
    if (at !== -1) { rest.splice(at, 1); writeGuest(rest); }
    if (rowCreated) created++;
  }

  function onStorage(e) {
    var k = e ? e.key : null;
    if (k === null || k === GUEST_KEY || (uid && k === mirrorKey(uid))) refresh();
  }
  function onVisible() {
    if (document.visibilityState !== 'visible') return;
    var before = uid;
    syncMode();
    if (uid !== before) { request(true); return; }
    if (!uid) return;
    var stale = Date.now() - lastPull > STALE_MS;
    if (stale || hasPending(uid) || readGuest().length) request(stale);
  }
  // Ein Datenblatt baut sein Hologramm in Tausenden DOM-Änderungen auf. Neu
  // gezeichnet wird nur, wenn ein Flotten-Knopf dazukommt oder sein Schiff wechselt.
  var FLEET_NODES = '[data-fleet-ship],[data-fleet-retry]';
  function touchesFleet(records) {
    for (var i = 0; i < records.length; i++) {
      if (records[i].type === 'attributes') return true;
      var added = records[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var n = added[j];
        if (n.nodeType === 1 && (n.matches(FLEET_NODES) || n.querySelector(FLEET_NODES))) return true;
      }
    }
    return false;
  }
  function start() {
    if (started) return;
    started = true;
    VB = window.VBAccount || null;
    if (VB) syncMode();
    refresh();
    document.addEventListener('click', onClick);
    if (typeof MutationObserver === 'function' && document.documentElement) {
      new MutationObserver(function (records) { if (touchesFleet(records)) paintSoon(); }).observe(document.documentElement, {
        subtree: true, childList: true, attributes: true, attributeFilter: ['data-fleet-ship'],
      });
    }
    window.addEventListener('storage', onStorage);
    if (VB) {
      window.addEventListener('vb-account-session', function () { syncMode(); request(true); });
      // Aus dem bfcache zurück: Ereignisse während des Einfrierens kamen nie an.
      window.addEventListener('pageshow', function (e) { if (e && e.persisted) { syncMode(); request(true); } });
      document.addEventListener('visibilitychange', onVisible);
      request(true);
    }
  }

  window.VBFleet = {
    ids: function () { return ships.map(function (s) { return s.id; }); },
    has: has,
    toggle: toggle,
    subscribe: function (fn) {
      if (typeof fn !== 'function') return function () {};
      subs.push(fn);
      try { fn(snapshot()); } catch (e) { /* noop */ }
      return function () {
        var at = subs.indexOf(fn);
        if (at !== -1) subs.splice(at, 1);
      };
    },
    retry: function () { return request(true); },
    dismissMerged: function () {
      if (!uid) return;
      var m = readMirror(uid);
      if (!m.merged) return;
      m.merged = 0;
      writeMirror(uid, m);
      notify();
    },
  };
  try { window.dispatchEvent(new Event('vb-fleet-ready')); } catch (e) { /* noop */ }

  // account-lite.js läuft davor (beide defer). Fehlt es, bleibt die Flotte im Gast-Modus.
  if (window.VBAccount) start();
  else {
    window.addEventListener('vb-account-ready', start);
    document.addEventListener('DOMContentLoaded', start);
  }
})();
