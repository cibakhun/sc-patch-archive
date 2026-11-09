// search-overlay.js — die Suche ueber das ganze Archiv.
//
// EIN Suchkern fuer zwei Oberflaechen (Skizze 016, freigegeben 09.11.2026):
//  - der Dialog (Strg+K, Suchknopf der Kopfleiste) auf jeder Seite, Markup
//    aus src/components/SearchOverlay.astro (#scs);
//  - das grosse Feld der Startseite (src/components/HomeSearch.astro, #hs):
//    es sucht selbst, die Treffer klappen in der Seite darunter auf. Kein
//    zweites Fenster, kein Schleier, kein zweites Eingabefeld.
// Beide teilen Register, Wertung, Gruppen und Zeilenbau; nur der Rahmen ist
// verschieden. Dieselbe Eingabe ergibt in beiden dieselbe Trefferliste —
// das prueft tests/e2e/suche-status.test.js und der Browser-Rauchtest.
//
// EINE Quelle fuer zwei Auslieferungen:
//  - Seiten mit voller Navigation (SiteNav) tragen das Overlay-Markup, und
//    dieses Skript steht dort INLINE (per ?raw eingebunden) an derselben
//    Stelle wie vor dem 06.11.2026. Die Reihenfolge der Tasten-Lauscher
//    bleibt damit gleich (der Hangar nimmt sich "/" fuer seine
//    Schiffsauswahl, bevor dieses Skript es sieht).
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
//
// Laden und Scheitern sind SICHTBAR (07.11.2026): Bis dahin blieb die Liste
// leer, solange ein Teil unterwegs war, und ebenso leer, wenn der erste Teil
// gar nicht ankam — auf dem Telefon sah das aus wie "die Suche findet nichts"
// (Krisz, staging, "Panther": der Treffer steht nur im zweiten Teil). Jetzt
// steht dort eine Statuszeile: "wird geladen" oder "nicht erreichbar" mit
// einem Knopf zum erneuten Versuch; ein gescheiterter Teil wird beim naechsten
// Tippen auch von selbst neu geholt.
//
// Gruppiert (09.11.2026): Werkzeuge als Kacheln, dann Schiffe, Items,
// Blueprints, Missionen, Patches & Themen — die Gruppe mit dem besten Treffer
// zuerst, je drei Zeilen und "+ N weitere". Ein Item mit Rezept ist EIN
// Treffer mit "Herstellen" daneben (Register-Feld c, src/lib/searchIndex.ts).
(function () {
  if (window.__scsInit) return;
  var root = document.getElementById('scs');
  var input = document.getElementById('scs-in');
  var list = document.getElementById('scs-list');
  if (!root || !input || !list) return;
  window.__scsInit = true;
  var D = root.dataset;
  var index = null;
  var more = null;
  var lastFocus = null;
  var SVG = 'http://www.w3.org/2000/svg';
  // Je Gruppe sichtbar, bevor "+ N weitere" kommt; ein Klick darauf zeigt
  // STEP mehr. Werkzeuge sind elf Eintraege und stehen als Kacheln in einer
  // Reihe — die duerfen alle stehen.
  var SHOWN = 3;
  var TOOLS_SHOWN = 11;
  var STEP = 25;
  var GROUP = {
    werkzeug: 'tools', schiff: 'ships', item: 'items', bauplan: 'recipes', mission: 'missions',
    patch: 'patches', thema: 'patches', feature: 'patches', event: 'patches',
  };
  var GROUP_LABEL = {
    tools: D.gTools, ships: D.gShips, items: D.gItems, recipes: D.gRecipes, missions: D.gMissions, patches: D.gPatches,
  };
  // Striche wie die Symbole im Menue der Seite (24er-Raster).
  var ICON = {
    werkzeug: ['M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z'],
    schiff: ['M12 2L2 22h9l1-6 1 6h9L12 2z'],
    item: ['M21 16V8l-9-5-9 5v8l9 5 9-5z', 'M3.3 7 12 12l8.7-5M12 22V12'],
    bauplan: ['M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z', 'M14 3v6h6M8 13h8M8 17h5'],
    mission: ['M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z', 'M12 8a4 4 0 1 0 0 8 4 4 0 1 0 0-8z'],
    patch: ['M21 8v13H3V8M1 3h22v5H1zM10 12h4'],
  };
  ICON.thema = ICON.feature = ICON.event = ICON.patch;
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
  var fill = function (s, n) { return String(s || '').replace('%n%', n); };
  var fetchJson = function (url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('index ' + r.status);
      // Eine Umleitung auf eine HTML-Seite (auf staging das Testpilot-Tor,
      // wenn der Ausweis gerade ablief) antwortet mit 200 — r.json() wirft
      // dann, und das zaehlt wie jeder andere Fehlschlag.
      return r.json();
    });
  };

  /* ---------- Register (geteilt) ---------- */
  var loading = null;
  var moreLoading = false;
  // Fehlschlag je Teil merken: render() zeigt ihn an, statt die Liste leer zu
  // lassen, und das naechste Tippen holt neu (nicht oefter als RETRY_MS).
  var failed = false;
  var moreFailed = false;
  var lastTry = 0;
  var RETRY_MS = 2500;
  // Beide Teile werden erneut versucht, wenn ein Abruf fehlschlug: ein
  // kurzer Netzaussetzer soll die Suche nicht bis zum Neuladen der Seite
  // stilllegen. Ein Fehlschlag des ersten Teils gibt `loading` frei, einer
  // des zweiten laesst `more` leer, damit der naechste Versuch neu holt.
  function load() {
    lastTry = Date.now();
    var moreUrl = root.getAttribute('data-index-more');
    if (moreUrl && !more && !moreLoading) {
      // Der zweite Teil darf fehlen oder spaeter kommen: die Suche laeuft mit
      // dem ersten weiter, statt leer zu bleiben.
      moreLoading = true;
      moreFailed = false;
      fetchJson(moreUrl)
        .then(function (j) {
          more = prep(j);
        }, function () {
          moreFailed = true;
        })
        .then(function () {
          moreLoading = false;
          renderOpen();
        });
    }
    if (loading) return loading;
    failed = false;
    loading = fetchJson(root.getAttribute('data-index') || '/search-index.json').then(
      function (j) {
        index = prep(j);
        return index;
      },
      function (err) {
        loading = null;
        failed = true;
        throw err;
      },
    );
    return loading;
  }

  /* ---------- Oberflaechen ---------- */
  // Eine Oberflaeche: Eingabe, Liste und ihr eigener Zustand (Zeilen,
  // Auswahl, aufgeklappte Gruppen). Gerechnet und gebaut wird fuer alle mit
  // denselben Funktionen.
  function surface(id, inp, ul, isOpen, hints) {
    // Ein Klick in die Liste nimmt der Eingabe nicht den Fokus: nach
    // "+ N weitere" laeuft die Tastatur weiter, ohne neu ins Feld zu tippen.
    ul.addEventListener('mousedown', function (e) { e.preventDefault(); });
    return { id: id, input: inp, list: ul, isOpen: isOpen, hints: hints, rows: [], sel: -1, expand: {}, after: null };
  }
  var dlg = surface('scs', input, list, function () { return !root.hidden; }, false);
  var surfaces = [dlg];
  var inl = null; // das Startseiten-Feld, wenn es eines gibt
  function renderOpen() {
    surfaces.forEach(function (S) { if (S.isOpen()) render(S); });
  }
  // Holt, was fehlt (beim Oeffnen beide Teile, danach nur einen
  // gescheiterten), zeigt sofort den Stand ("wird geladen" oder die Treffer
  // aus dem Speicher) und rechnet neu, sobald der erste Teil da ist ODER
  // scheiterte — vorher blieb die Liste bei einem Fehlschlag einfach leer.
  function refresh(S) {
    load().then(renderOpen, renderOpen);
    render(S);
  }

  /* ---------- Zeilenbau ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function icon(k) {
    var s = document.createElementNS(SVG, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    (ICON[k] || ICON.patch).forEach(function (d) {
      var p = document.createElementNS(SVG, 'path');
      p.setAttribute('d', d);
      s.appendChild(p);
    });
    return s;
  }
  // Titel mit dem ersten getroffenen Suchwort hervorgehoben. Nur wo die
  // Normalisierung die Laenge nicht aendert (Akzente fallen dort weg) —
  // sonst stimmen die Stellen nicht, und der Titel bleibt schlicht.
  function title(e, terms) {
    var t = el('span', 'scs__t');
    var at = -1;
    var len = 0;
    if (e.nt.length === e.t.length) {
      for (var i = 0; i < terms.length; i++) {
        var p = e.nt.indexOf(terms[i]);
        if (p >= 0 && (at < 0 || p < at)) { at = p; len = terms[i].length; }
      }
    }
    if (at < 0) { t.textContent = e.t; return t; }
    if (at > 0) t.appendChild(document.createTextNode(e.t.slice(0, at)));
    t.appendChild(el('mark', null, e.t.slice(at, at + len)));
    if (at + len < e.t.length) t.appendChild(document.createTextNode(e.t.slice(at + len)));
    return t;
  }
  // Unterzeile: der Text des Registers, dazu die Kurzangabe b, wo sie etwas
  // sagt — vorn bei Patches und Missionen (Version, Missionstyp), hinten bei
  // Items und Blueprints (Kategorie); bei Schiffen steht der Hersteller schon
  // im Text.
  function snippet(e) {
    var s = e.s || '';
    var b = e.b || '';
    if (!b || s.indexOf(b) >= 0) return s;
    if (e.k === 'item' || e.k === 'bauplan') return s ? s + ' · ' + b : b;
    return s ? b + ' · ' + s : b;
  }
  function option(S, cls, row) {
    var n = S.rows.length;
    var li = el('li', cls);
    li.setAttribute('role', 'option');
    li.setAttribute('id', S.id + '-o' + n);
    li.setAttribute('aria-selected', 'false');
    row.el = li;
    S.rows.push(row);
    li.addEventListener('click', function () { go(S, n); });
    S.list.appendChild(li);
    return li;
  }
  function hitRow(S, e, terms, chip, hit) {
    var n = S.rows.length;
    var li = option(S, 'scs__hit scs__hit--' + e.k + (chip ? ' scs__chip' : ''), { e: e, hit: hit });
    var ic = el('span', 'scs__ic');
    ic.appendChild(icon(e.k));
    li.appendChild(ic);
    var tx = el('span', 'scs__tx');
    tx.appendChild(title(e, terms));
    var sn = chip && !terms.length ? '' : snippet(e);
    if (sn) tx.appendChild(el('span', 'scs__s', sn));
    li.appendChild(tx);
    if (chip) return;
    var act = el('span', 'scs__act');
    if (e.c) {
      // "Herstellen": derselbe Treffer, aber direkt ins Crafting-Werkzeug mit
      // diesem Rezept. Mit der Tastatur: Pfeil nach rechts.
      var cb = el('button', 'scs__craft');
      cb.setAttribute('type', 'button');
      cb.setAttribute('tabindex', '-1');
      cb.appendChild(icon('werkzeug'));
      cb.appendChild(el('span', null, D.craft || 'Herstellen'));
      cb.addEventListener('click', function (ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        craft(S, n);
      });
      act.appendChild(cb);
    }
    var go_ = el('span', 'scs__go', '→');
    go_.setAttribute('aria-hidden', 'true');
    act.appendChild(go_);
    li.appendChild(act);
  }
  function plain(S, cls) {
    var li = el('li', cls);
    li.setAttribute('role', 'presentation');
    S.list.appendChild(li);
    return li;
  }
  // Eine Statuszeile in der Liste: Laden, Scheitern (mit Knopf) oder der
  // Hinweis unter den Treffern, dass Items und Blueprints noch kommen.
  function status(S, kind, head, hint, withRetry) {
    var li = el('li', 'scs__empty scs__status scs__status--' + kind);
    if (head) li.appendChild(el('b', null, head));
    if (hint) li.appendChild(el('span', null, hint));
    if (withRetry) {
      var btn = el('button', 'scs__retry', D.retry || 'Erneut versuchen');
      btn.setAttribute('type', 'button');
      btn.addEventListener('click', function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        refresh(S);
        S.input.focus();
      });
      li.appendChild(btn);
    }
    S.list.appendChild(li);
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
  // Leeres Feld: die Werkzeuge als Kacheln, darunter ein Satz, was die
  // Suche alles kennt. Nichts ist vorgewaehlt — Enter tut hier nichts.
  function start(S) {
    var tools = index.filter(function (e) { return e.k === 'werkzeug'; });
    if (!tools.length) return;
    plain(S, 'scs__grp').appendChild(el('b', null, D.jump || ''));
    tools.forEach(function (e, i) { hitRow(S, e, [], true, i); });
    if (D.startHint) plain(S, 'scs__hint').textContent = D.startHint;
  }
  function render(S) {
    var q = S.input.value || '';
    var whole = norm(q).trim();
    var terms = whole.split(/\s+/).filter(Boolean);
    var after = S.after;
    S.after = null;
    S.list.innerHTML = '';
    S.rows = [];
    S.sel = -1;
    S.input.removeAttribute('aria-activedescendant');
    if (!index) {
      // Erster Teil fehlt: kam er nicht an (das zeigt die Suche gleich beim
      // Oeffnen), oder laedt er noch (das erst, wenn schon getippt wurde)?
      if (failed) status(S, 'fehler', D.failedTitle || 'Register nicht erreichbar', D.failedHint || '', true);
      else if (terms.length) status(S, 'laedt', '', D.loading || 'Register wird geladen …', false);
      return;
    }
    if (!terms.length) { start(S); return; }
    var pool = more ? index.concat(more) : index;
    var all = pool
      .map(function (e, i) { return { e: e, sc: score(e, terms, whole), i: i }; })
      .filter(function (r) { return r.sc > 0; })
      .sort(function (a, b) { return b.sc - a.sc || a.i - b.i; })
      .map(function (r) { return r.e; });
    if (!all.length) {
      // Solange der zweite Teil noch laedt, ist "nichts gefunden" verfrueht —
      // aber eine leere Liste ist es auch: sie sah aus wie "kein Treffer".
      if (moreLoading) { status(S, 'laedt', '', D.loadingMore || 'Items und Blueprints werden geladen …', false); return; }
      var qpre = (D.emptyQuery || 'Anfrage »%q%« ').replace('%q%', q);
      // Kam der zweite Teil nicht an, ist "kein Treffer" nur die halbe
      // Wahrheit: Items und Blueprints wurden gar nicht durchsucht.
      if (moreFailed) status(S, 'fehler', D.emptyTitle || 'Kein Eintrag im Register', D.failedMore || '', true);
      else status(S, 'leer', D.emptyTitle || 'Kein Eintrag im Register', qpre + (D.emptyHint || 'ergab keine Treffer.'), false);
      return;
    }
    // Gruppen in der Reihenfolge ihres besten Treffers.
    var groups = [];
    var byKey = {};
    all.forEach(function (e) {
      var g = GROUP[e.k] || 'patches';
      if (!byKey[g]) { byKey[g] = { key: g, hits: [] }; groups.push(byKey[g]); }
      byKey[g].hits.push(e);
    });
    var head = plain(S, 'scs__head');
    head.appendChild(el('span', 'scs__count', fill(D.count || '%n%', all.length)));
    if (S.hints) {
      var kl = el('span', 'scs__keys');
      [['↑↓', D.hintPick], ['↵', D.hintOpen], ['→', D.hintCraft]].forEach(function (k) {
        var s = el('span');
        s.appendChild(el('kbd', null, k[0]));
        s.appendChild(el('span', null, k[1] || ''));
        kl.appendChild(s);
      });
      head.appendChild(kl);
    }
    var hit = 0;
    var want = 0;
    groups.forEach(function (G) {
      var h = plain(S, 'scs__grp scs__grp--' + G.key);
      h.appendChild(el('b', null, GROUP_LABEL[G.key] || G.key));
      h.appendChild(el('span', null, String(G.hits.length)));
      var lim = S.expand[G.key] || (G.key === 'tools' ? TOOLS_SHOWN : SHOWN);
      G.hits.slice(0, lim).forEach(function (e, j) {
        if (after && after.key === G.key && j === after.at) want = S.rows.length;
        hitRow(S, e, terms, G.key === 'tools', hit++);
      });
      if (G.hits.length > lim) {
        var li = option(S, 'scs__more', { more: G.key, lim: lim });
        li.textContent = fill(D.more || '+ %n%', G.hits.length - lim) + ' ' + (GROUP_LABEL[G.key] || '');
      }
    });
    // Treffer aus dem ersten Teil stehen schon da; dass Items und Blueprints
    // noch fehlen (oder nicht ankamen), sagt eine Zeile darunter.
    if (moreLoading) status(S, 'laedt', '', D.loadingMore || 'Items und Blueprints werden geladen …', false);
    else if (moreFailed) status(S, 'fehler', '', D.failedMore || '', true);
    select(S, want, !!after);
  }

  /* ---------- Bedienen ---------- */
  function select(S, n, scroll) {
    var old = S.rows[S.sel];
    if (old && old.el) { old.el.classList.remove('sel'); old.el.setAttribute('aria-selected', 'false'); }
    S.sel = n;
    var r = S.rows[n];
    if (!r || !r.el) return;
    r.el.classList.add('sel');
    r.el.setAttribute('aria-selected', 'true');
    S.input.setAttribute('aria-activedescendant', S.id + '-o' + n);
    if (scroll && r.el.scrollIntoView) r.el.scrollIntoView({ block: 'nearest' });
  }
  function move(S, d) {
    var n = S.rows.length;
    if (!n) return;
    select(S, S.sel < 0 ? (d > 0 ? 0 : n - 1) : (S.sel + d + n) % n, true);
  }
  function platz(n) { return n < 3 ? '1-3' : n < 10 ? '4-10' : '11+'; }
  function go(S, i) {
    var r = S.rows[i == null ? S.sel : i];
    if (!r) return;
    if (r.more) {
      // "+ N weitere": die Gruppe waechst um STEP, die Auswahl springt auf
      // die erste neue Zeile.
      S.expand[r.more] = r.lim + STEP;
      S.after = { key: r.more, at: r.lim };
      render(S);
      return;
    }
    // Messereignis (assets/ereignisse.js): nur Art und Platzgruppe des
    // Treffers, nie Suchbegriff oder Ziel.
    if (window.vbEreignis) window.vbEreignis('suche-treffer', { art: r.e.k, platz: platz(r.hit) });
    location.href = r.e.u;
  }
  function craft(S, i) {
    var r = S.rows[i == null ? S.sel : i];
    if (!r || !r.e || !r.e.c) return;
    // Wer "Herstellen" waehlt, waehlt das Rezept: Art "bauplan".
    if (window.vbEreignis) window.vbEreignis('suche-treffer', { art: 'bauplan', platz: platz(r.hit) });
    location.href = r.e.c;
  }
  // Pfeile, Enter und "→ Herstellen" — fuer beide Oberflaechen gleich.
  function keys(S, e) {
    if (e.isComposing) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); move(S, 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(S, -1); }
    else if (e.key === 'Enter') { e.preventDefault(); go(S); }
    else if (e.key === 'ArrowRight') {
      var r = S.rows[S.sel];
      var inp = S.input;
      // Nur am Ende der Eingabe: mitten im Wort bewegt der Pfeil die Marke.
      var amEnde = inp.selectionStart == null || (inp.selectionStart === inp.value.length && inp.selectionEnd === inp.value.length);
      if (r && r.e && r.e.c && amEnde) { e.preventDefault(); craft(S); }
    }
  }
  function typed(S) {
    S.expand = {};
    // Ein gescheiterter Teil wird beim Tippen von selbst neu geholt, aber
    // nicht bei jedem Buchstaben (RETRY_MS) — offline waere das sonst eine
    // Anfrage je Tastendruck.
    if ((failed || moreFailed) && Date.now() - lastTry > RETRY_MS) refresh(S);
    else render(S);
  }

  /* ---------- Dialog ---------- */
  function open() {
    // Der Zaehler in scroll-lock.js darf nicht doppelt hochlaufen: ein
    // zweites Ctrl+K bei offener Suche wuerde sonst zweimal sperren, das
    // eine Schliessen aber nur einmal entsperren — die Seite bliebe
    // festgenagelt.
    if (!root.hidden) { input.focus(); input.select(); return; }
    lastFocus = document.activeElement;
    root.hidden = false;
    if (window.vbEreignis) window.vbEreignis('suche-offen');
    // Geteilte Sperre statt overflow am Wurzelelement: iOS Safari
    // uebergeht overflow:hidden dort und scrollt den Hintergrund weiter.
    // Siehe assets/scroll-lock.js.
    if (window.VBScrollLock) window.VBScrollLock.lock();
    refresh(dlg);
    requestAnimationFrame(function () { input.focus(); input.select(); });
  }
  function close() {
    if (root.hidden) return;
    root.hidden = true;
    if (window.VBScrollLock) window.VBScrollLock.unlock();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  window.__scsOpen = open;
  input.addEventListener('input', function () { typed(dlg); });
  root.querySelectorAll('[data-scs-close]').forEach(function (b) {
    b.addEventListener('click', close);
  });

  /* ---------- Startseiten-Feld ---------- */
  // Das grosse Feld IST die Suche: beim Antippen rueckt es unter die
  // Kopfleiste (die Seite scrollt, die Wortmarke wandert dabei wie immer in
  // die Leiste), und die Treffer klappen direkt darunter auf. Auf dem
  // Telefon weicht die Kopfleiste, solange gesucht wird; die Liste reicht
  // bis an die Tastatur.
  function attachInline() {
    var hr = document.getElementById('hs');
    var hi = document.getElementById('hs-in');
    var hl = document.getElementById('hs-list');
    var hf = document.getElementById('hs-field');
    if (!hr || !hi || !hl || !hf || inl) return;
    var S = surface('hs', hi, hl, function () { return S.open; }, true);
    S.open = false;
    S.field = hf;
    inl = S;
    surfaces.push(S);
    var mm = function (q) { return window.matchMedia ? window.matchMedia(q) : { matches: false }; };
    var phone = mm('(max-width: 760px)');
    var still = mm('(prefers-reduced-motion: reduce)');
    function dockTop() {
      if (phone.matches) return 8;
      var nav = document.getElementById('topbar');
      return (nav ? Math.max(0, nav.getBoundingClientRect().bottom) : 0) + 14;
    }
    function size() {
      var vv = window.visualViewport;
      var vh = vv ? vv.height : window.innerHeight;
      var max = vh - (dockTop() + hf.offsetHeight) - 12;
      hr.style.setProperty('--hs-max', Math.max(180, Math.round(max)) + 'px');
    }
    function dock() {
      var dy = hf.getBoundingClientRect().top - dockTop();
      if (Math.abs(dy) > 2) window.scrollTo({ top: Math.max(0, window.scrollY + dy), behavior: still.matches ? 'auto' : 'smooth' });
      size();
    }
    S.show = function () {
      if (S.open) return;
      S.open = true;
      hr.classList.add('is-open');
      hi.setAttribute('aria-expanded', 'true');
      document.documentElement.classList.add('hs-open');
      if (window.vbEreignis) window.vbEreignis('suche-offen');
      dock();
      refresh(S);
    };
    S.hide = function () {
      if (!S.open) return;
      S.open = false;
      hr.classList.remove('is-open');
      hi.setAttribute('aria-expanded', 'false');
      hi.removeAttribute('aria-activedescendant');
      document.documentElement.classList.remove('hs-open');
      // Auf dem Telefon kommt die Kopfleiste zurueck — und laege dann ueber
      // dem Feld, das eben noch ganz oben stand.
      var nav = document.getElementById('topbar');
      var nb = nav ? nav.getBoundingClientRect().bottom : 0;
      var ft = hf.getBoundingClientRect().top;
      if (ft < nb + 8 && ft > -hf.offsetHeight) window.scrollTo({ top: Math.max(0, window.scrollY - (nb + 8 - ft)) });
    };
    S.focus = function () {
      hi.focus();
      if (hi.select) hi.select();
      S.show();
    };
    hi.addEventListener('focus', function () { S.show(); });
    hi.addEventListener('input', function () {
      if (!S.open) S.show();
      typed(S);
    });
    hi.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (S.open) { e.preventDefault(); S.hide(); }
        return;
      }
      if (!S.open) {
        if (e.key === 'ArrowDown') { e.preventDefault(); S.show(); }
        return;
      }
      keys(S, e);
    });
    hr.querySelectorAll('[data-hs-close]').forEach(function (b) {
      b.addEventListener('click', function () { S.hide(); });
    });
    // Mit der Tabulatortaste hinaus schliesst; ein Antippen daneben auch.
    // Das blosse Wegklappen der Bildschirmtastatur (Blur ohne neues Ziel)
    // laesst die Treffer stehen — man will sie dann ja durchsehen.
    hr.addEventListener('focusout', function (e) {
      if (e.relatedTarget && !hr.contains(e.relatedTarget)) S.hide();
    });
    document.addEventListener('click', function (e) {
      var t = e.target;
      // Ein Klick auf "+ N weitere" oder "Erneut versuchen" baut die Liste
      // neu; die geklickte Zeile haengt danach nicht mehr im Dokument und
      // laege scheinbar "daneben".
      if (!S.open || !t || t.isConnected === false || hr.contains(t)) return;
      if (t.closest && t.closest('[data-scs-open]')) return;
      S.hide();
    });
    window.addEventListener('resize', function () { if (S.open) size(); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', function () { if (S.open) size(); });
  }
  // Benutzbar ist das Feld, solange es im Bild steht. Weiter unten auf der
  // Startseite oeffnen Strg+K und der Knopf der Kopfleiste den Dialog.
  function inlineHere() {
    if (!inl) return false;
    var r = inl.field.getBoundingClientRect();
    return r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
  }
  function openBest() {
    if (inlineHere()) inl.focus();
    else open();
  }
  // Dieses Skript steht im Dokument VOR dem Seiteninhalt — das Feld der
  // Startseite gibt es hier noch nicht.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attachInline);
  else attachInline();

  /* ---------- Tasten und Ausloeser ---------- */
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (!root.hidden) close();
      else openBest();
      return;
    }
    if (root.hidden) {
      // Eine Seite mit eigener Suche darf / fuer sich nehmen (der Hangar fuer
      // seine Schiffsauswahl): sie verhindert die Vorgabe, bevor dies laeuft.
      if (e.key === '/' && !e.defaultPrevented && !/^(input|textarea|select)$/i.test((e.target && e.target.tagName) || '')) {
        e.preventDefault();
        openBest();
      }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    keys(dlg, e);
  });
  // Delegation statt Direktbindung: Ausloeser duerfen auch NACH diesem
  // Script im DOM stehen.
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-scs-open]')) openBest();
  });
})();
