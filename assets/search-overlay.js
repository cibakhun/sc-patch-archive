// search-overlay.js — die Suche (Strg+K) ueber das ganze Archiv.
//
// EINE Quelle fuer zwei Auslieferungen:
//  - Seiten mit voller Navigation (SiteNav) tragen das Overlay-Markup aus
//    src/components/SearchOverlay.astro, und dieses Skript steht dort INLINE
//    (per ?raw eingebunden) an derselben Stelle wie vor dem 06.11.2026. Die
//    Reihenfolge der Tasten-Lauscher bleibt damit gleich (der Hangar nimmt
//    sich "/" fuer seine Schiffsauswahl, bevor dieses Skript es sieht).
//  - Die schlanken Datenseiten (DataShell, ~14.000 Item- und Blueprint-
//    Seiten) tragen kein Inline-Skript. Dort baut assets/data-search.js beim
//    ersten Antippen das Markup und laedt diese Datei nach.
//
// Index in zwei Teilen, beide erst beim Oeffnen geladen und dann im Speicher:
//  data-index       Patches, Themen, Werkzeuge, Schiffe, Missionen (~55 KB gzip)
//  data-index-more  Items und Blueprints (~120 KB gzip) — kommt parallel; die
//                   Trefferliste zeigt den ersten Teil sofort und rechnet neu,
//                   sobald der zweite da ist.
// Keine Abhaengigkeiten, kein Netz ausser den beiden Index-Dateien.
(function () {
  if (window.__scsInit) return;
  var root = document.getElementById('scs');
  var input = document.getElementById('scs-in');
  var list = document.getElementById('scs-list');
  if (!root || !input || !list) return;
  window.__scsInit = true;
  var index = null;
  var more = null;
  var results = [];
  var sel = 0;
  var lastFocus = null;
  var norm = function (s) {
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  };
  var prep = function (j) {
    return (Array.isArray(j) ? j : []).map(function (e) {
      return Object.assign({}, e, { nt: norm(e.t), ns: norm(e.s), nx: norm(e.x) });
    });
  };
  var fetchJson = function (url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('index ' + r.status);
      return r.json();
    });
  };
  var loading = null;
  var moreLoading = false;
  // Beide Teile werden erneut versucht, wenn ein Abruf fehlschlug: ein
  // kurzer Netzaussetzer soll die Suche nicht bis zum Neuladen der Seite
  // stilllegen. Ein Fehlschlag des ersten Teils gibt `loading` frei, einer
  // des zweiten laesst `more` leer, damit das naechste Oeffnen neu holt.
  function load() {
    var moreUrl = root.getAttribute('data-index-more');
    if (moreUrl && !more && !moreLoading) {
      // Der zweite Teil darf fehlen oder spaeter kommen: die Suche laeuft mit
      // dem ersten weiter, statt leer zu bleiben.
      moreLoading = true;
      fetchJson(moreUrl)
        .then(function (j) {
          more = prep(j);
        }, function () {})
        .then(function () {
          moreLoading = false;
          if (!root.hidden) render(input.value);
        });
    }
    if (loading) return loading;
    loading = fetchJson(root.getAttribute('data-index') || '/search-index.json').then(
      function (j) {
        index = prep(j);
        return index;
      },
      function (err) {
        loading = null;
        throw err;
      },
    );
    return loading;
  }
  function score(e, terms, whole) {
    var total = 0;
    for (var i = 0; i < terms.length; i++) {
      var q = terms[i];
      var pts = 0;
      if (e.nt.indexOf(q) === 0) pts = 40;
      else if (e.nt.indexOf(q) >= 0) pts = 25;
      else if (e.nx.indexOf(q) >= 0) pts = 15;
      else if (e.ns.indexOf(q) >= 0) pts = 8;
      if (!pts) return 0; // AND semantics
      total += pts;
    }
    // Wer den Namen ganz tippt, meint genau diesen Eintrag: "Arrow" soll das
    // Schiff vor "Arrow Missile Rack" zeigen, "CF-337 Panther Repeater" die
    // Waffe vor allem, was sie im Namen fuehrt.
    if (e.nt === whole) total += 30;
    // Werkzeuge vor gleich gut passenden Daten: wer auf einer Item-Seite
    // "bruch" oder "raffinerie" tippt, sucht den Rechner, nicht jedes Teil mit
    // "(Bruch)" im Namen. Es sind nur elf Eintraege.
    if (e.k === 'werkzeug') total += 20;
    return total;
  }
  function render(q) {
    var whole = norm(q).trim();
    var terms = whole.split(/\s+/).filter(Boolean);
    list.innerHTML = '';
    sel = 0;
    if (!terms.length || !index) { results = []; return; }
    var pool = more ? index.concat(more) : index;
    results = pool
      .map(function (e, i) { return { e: e, sc: score(e, terms, whole), i: i }; })
      .filter(function (r) { return r.sc > 0; })
      .sort(function (a, b) { return b.sc - a.sc || a.i - b.i; })
      .slice(0, 20)
      .map(function (r) { return r.e; });
    if (!results.length) {
      // Solange der zweite Teil noch laedt, ist "nichts gefunden" verfrueht.
      if (moreLoading) return;
      var li = document.createElement('li');
      li.className = 'scs__empty';
      var h = document.createElement('b');
      h.textContent = root.dataset.emptyTitle || 'Kein Eintrag im Register';
      var p = document.createElement('span');
      var qpre = (root.dataset.emptyQuery || 'Anfrage »%q%« ').replace('%q%', q);
      p.textContent = qpre + (root.dataset.emptyHint || 'ergab keine Treffer.');
      li.appendChild(h);
      li.appendChild(p);
      list.appendChild(li);
      return;
    }
    results.forEach(function (e, i) {
      var li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.className = 'scs__hit scs__hit--' + e.k;
      li.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      if (i === 0) li.classList.add('sel');
      var badge = document.createElement('span');
      badge.className = 'scs__badge';
      // localized type label (Schiff/Patch/Thema/…), falling back to the raw kind
      badge.textContent = root.dataset['k' + e.k.charAt(0).toUpperCase() + e.k.slice(1)] || e.k;
      var t = document.createElement('span');
      t.className = 'scs__t';
      t.textContent = e.t;
      var s = document.createElement('span');
      s.className = 'scs__s';
      s.textContent = e.s || '';
      var meta = document.createElement('span');
      meta.className = 'scs__meta';
      if (e.b) {
        var ver = document.createElement('span');
        ver.className = 'scs__meta-ver';
        ver.textContent = e.b;
        meta.appendChild(ver);
      }
      var go_ = document.createElement('span');
      go_.className = 'scs__go';
      go_.setAttribute('aria-hidden', 'true');
      go_.textContent = '→';
      meta.appendChild(go_);
      li.appendChild(badge);
      li.appendChild(t);
      li.appendChild(s);
      li.appendChild(meta);
      li.addEventListener('click', function () { go(i); });
      list.appendChild(li);
    });
  }
  function move(d) {
    if (!results.length) return;
    var items = list.querySelectorAll('li[role="option"]');
    if (items[sel]) { items[sel].classList.remove('sel'); items[sel].setAttribute('aria-selected', 'false'); }
    sel = (sel + d + results.length) % results.length;
    items[sel].classList.add('sel');
    items[sel].setAttribute('aria-selected', 'true');
    items[sel].scrollIntoView({ block: 'nearest' });
  }
  function go(i) {
    var e = results[i == null ? sel : i];
    if (e) location.href = e.u;
  }
  function open() {
    // Der Zaehler in scroll-lock.js darf nicht doppelt hochlaufen: ein
    // zweites Ctrl+K bei offener Suche wuerde sonst zweimal sperren, das
    // eine Schliessen aber nur einmal entsperren — die Seite bliebe
    // festgenagelt.
    if (!root.hidden) { input.focus(); input.select(); return; }
    lastFocus = document.activeElement;
    root.hidden = false;
    // Geteilte Sperre statt overflow am Wurzelelement: iOS Safari
    // uebergeht overflow:hidden dort und scrollt den Hintergrund weiter.
    // Siehe assets/scroll-lock.js.
    if (window.VBScrollLock) window.VBScrollLock.lock();
    load().then(function () { render(input.value); }, function () {});
    requestAnimationFrame(function () { input.focus(); input.select(); });
  }
  function close() {
    if (root.hidden) return;
    root.hidden = true;
    if (window.VBScrollLock) window.VBScrollLock.unlock();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  window.__scsOpen = open;
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      root.hidden ? open() : close();
      return;
    }
    if (root.hidden) {
      // Eine Seite mit eigener Suche darf / fuer sich nehmen (der Hangar fuer
      // seine Schiffsauswahl): sie verhindert die Vorgabe, bevor dies laeuft.
      if (e.key === '/' && !e.defaultPrevented && !/^(input|textarea|select)$/i.test((e.target && e.target.tagName) || '')) {
        e.preventDefault();
        open();
      }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); go(); }
  });
  input.addEventListener('input', function () { render(input.value); });
  root.querySelectorAll('[data-scs-close]').forEach(function (el) {
    el.addEventListener('click', close);
  });
  // Delegation statt Direktbindung: Trigger dürfen auch NACH diesem Script
  // im DOM stehen (z. B. das Hero-Suchfeld der Startseite unter der Nav).
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-scs-open]')) open();
  });
})();
