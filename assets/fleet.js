// VerseBase Flotte — der EINE Besitzer der Schiffsflotte im Browser.
//
// Die Flotte sind die Favoriten-Zeilen mit kind='ship' (slug = Fahrzeug-id);
// dieselben Zeilen zeigt das Pilotenprofil unter „Fleet". Datenblatt-Stern und
// Hangar schreiben sie nur hierüber. Vorher hatte jeder Knopf seinen eigenen
// Zustand (account-lite.js initFavs, ein GET pro Knopf, ohne Gast-Weg) — zwei
// Schreiber mit je eigenem Zustand laufen auseinander.
//
// API (für Hangar und Datenblatt festgelegt, .audit/arena/SYNTHESIS.md):
//   VBFleet.ids() / has(id) / toggle(id, label) / subscribe(fn) / retry()
//   snapshot = { ids, mode: 'guest'|'account', sync: 'local'|'syncing'|'synced'|'error',
//                error: null|'offline'|'auth'|'write'|'read', merged }
//   <button data-fleet-ship="<id>" data-fleet-label="<Name>">: aria-pressed setzt
//   dieses Skript. Optional data-fleet-on/-off mit .js-fleet-txt (Beschriftung)
//   und [data-fleet-retry] (nur bei sync 'error' sichtbar, Klick = retry()).
//
// Ablage:
//   Gast    'vb.fleet.v1'        {ships:[{id,label}]}   — zugleich die Warteschlange
//                                                        der Übernahme beim Anmelden
//   Konto   'vb.fleet.v1.<uid>'  {ships:[…], pending:{id:{op,t}}}  (Spiegel, überlebt
//                                                        einen geschlossenen Tab)
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
  // Ein hängender fetch hielte sonst die Sperre aller Tabs fest.
  var TIMEOUT_MS = 20000;

  var VB = null;
  var started = false;
  var uid = null;
  var ships = [];
  var sync = 'local';
  var error = null;
  var merged = 0;
  var created = 0;
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

  // ---- Ablage: was aus dem Speicher kommt, wird hier geprüft, nirgends sonst ----
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
    return { ships: cleanShips(m.ships), pending: pending };
  }
  function writeMirror(id, m) { writeJson(mirrorKey(id), { ships: m.ships, pending: m.pending }); }
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

  // ---- Sicht und Benachrichtigung ----
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
      merged: merged,
    };
  }
  function notify() {
    var key = JSON.stringify(snapshot());
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

  // ---- Modus ----
  function syncMode() {
    var id = peekId();
    if (!id) leave();
    else if (id !== uid) enter(id);
  }
  function enter(id) {
    dropMirrors(mirrorKey(id));
    uid = id;
    merged = 0;
    created = 0;
    lastPull = 0;
    ships = computeView();
    setSync('syncing', null);
  }
  function leave() {
    dropMirrors(null);
    uid = null;
    merged = 0;
    created = 0;
    ships = readGuest();
    setSync('local', null);
    var mine = waiters;
    waiters = [];
    mine.forEach(function (w) { w.resolve(has(w.id)); });
  }

  // ---- Deklarative Knöpfe ----
  function paint() {
    var btns = document.querySelectorAll('[data-fleet-ship]');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      var on = has(b.getAttribute('data-fleet-ship'));
      var pressed = on ? 'true' : 'false';
      // Nur bei Abweichung schreiben: der MutationObserver meldet jede Änderung
      // zurück, und erst ein Durchlauf ohne Abweichung beendet die Runde.
      if (b.getAttribute('aria-pressed') !== pressed) b.setAttribute('aria-pressed', pressed);
      var lbl = b.getAttribute(on ? 'data-fleet-on' : 'data-fleet-off');
      var txt = b.querySelector('.js-fleet-txt');
      if (txt && lbl && txt.textContent !== lbl) txt.textContent = lbl;
    }
    var off = sync !== 'error';
    var rs = document.querySelectorAll('[data-fleet-retry]');
    for (var j = 0; j < rs.length; j++) if (rs[j].hidden !== off) rs[j].hidden = off;
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

  // ---- Schreiben ----
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

  // ---- Abgleich: ein Lauf nach dem anderen, auch über Tabs hinweg ----
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
  // zu verlieren. Nur eine wirklich fehlende Sitzung ist Abmelden.
  function resolveMode() {
    syncMode();
    if (!uid) return Promise.resolve(null);
    var me = uid;
    return Promise.resolve(VB.session()).then(function (sess) {
      var id = sess && sess.user && sess.user.id;
      if (id === me) return sess;
      syncMode();
      if (uid && uid !== me) request(true);
      else if (uid === me) setSync('error', 'auth');
      return null;
    }, function () {
      setSync('error', 'offline');
      return null;
    });
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

  function call(sess, method, path, body) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error('timeout')); }, TIMEOUT_MS);
      var p;
      try { p = VB.rest(sess, method, path, body); } catch (e) { clearTimeout(timer); reject(e); return; }
      Promise.resolve(p).then(
        function (r) { clearTimeout(timer); resolve(r); },
        function (e) { clearTimeout(timer); reject(e); });
    });
  }
  function send(run, id, op, label) {
    var req = op === 'add'
      ? call(run.sess, 'POST', 'favorites', { kind: 'ship', slug: id, label: label })
      : call(run.sess, 'DELETE', 'favorites?kind=eq.ship&slug=eq.' + encodeURIComponent(id) +
          '&user_id=eq.' + encodeURIComponent(run.me));
    return req.then(function (r) {
      if (op === 'add' && r.status === 409) {
        // 409 meldet PostgREST auch für Fremdschlüssel; erledigt ist nur 23505 (die Zeile gibt es schon).
        return Promise.resolve(r.json()).then(function (b) {
          return b && b.code === '23505' ? 'kept' : 'write';
        }, function () { return 'write'; });
      }
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
        return Promise.resolve(r.json()).then(function (rows) {
          return cleanShips((Array.isArray(rows) ? rows : []).map(function (row) {
            return { id: row && row.slug, label: row && row.label };
          }));
        }, function () { return 'read'; });
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
      if (uid === run.me && queue.length && !readGuest().length && created && !merged) merged = created;
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

  // ---- Start ----
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
  function start() {
    if (started) return;
    started = true;
    VB = window.VBAccount || null;
    if (VB) syncMode();
    refresh();
    document.addEventListener('click', onClick);
    if (typeof MutationObserver === 'function' && document.documentElement) {
      new MutationObserver(paintSoon).observe(document.documentElement, {
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
  };
  try { window.dispatchEvent(new Event('vb-fleet-ready')); } catch (e) { /* noop */ }

  // account-lite.js läuft davor (beide defer). Fehlt es, bleibt die Flotte im Gast-Modus.
  if (window.VBAccount) start();
  else {
    window.addEventListener('vb-account-ready', start);
    document.addEventListener('DOMContentLoaded', start);
  }
})();
