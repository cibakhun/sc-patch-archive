/* ============================================================================
   mining-workbench.js — Client-Teil der Mining-Werkbank.

   Zustand: Auswahl, angeheftete Signaturen, Station. Gast -> localStorage;
   Kontobindung ist ein eigener Schuldenposten
   (.planning/todos/pending/signatur-liste-kontogebunden.md).

   ⚠ HIER WIRD NICHTS MEHR GEBROCHEN. Am 12.08.2026 sind Laser, Module,
   Gadget, Felsmasse, das Messgeraet und jede Brechbarkeit hier ausgezogen —
   in assets/fracturing-calc.js auf /fracturing.html. Diese Werkbank
   beantwortet „welches Erz, wo, was ist es wert?", nicht „krieg ich es
   auf?". Die Brech-Formel steht seither an genau EINER Stelle, und das ist
   nicht diese Datei. Wer hier wieder ein Urteil einbaut, macht den Umzug
   rueckgaengig — er war ausdruecklich so gewollt.
   ========================================================================== */
(function () {
  'use strict';

  var node = document.getElementById('wb-data');
  if (!node) return;
  var D;
  try { D = JSON.parse(node.textContent || '{}'); } catch (e) { return; }
  if (!D || !D.minerals || !D.minerals.length) return;

  var T = D.t || {};
  var LS = 'vb-mining-wb';
  var byName = {};
  for (var i = 0; i < D.minerals.length; i++) byName[D.minerals[i].name] = D.minerals[i];

  var S = { sel: D.minerals[0].name, pins: [], ref: 0, q: '', sys: null };
  /* Ein alter Speicherstand traegt noch laser/mods/gadget/mass. Die Felder
     werden schlicht nicht mehr gelesen und beim naechsten Schreiben fallen
     sie weg — kein Grund, gespeicherte Auswahl und Signaturen wegzuwerfen. */
  try {
    var saved = JSON.parse(localStorage.getItem(LS) || 'null');
    if (saved && typeof saved === 'object') {
      if (byName[saved.sel]) S.sel = saved.sel;
      if (Array.isArray(saved.pins)) S.pins = saved.pins.filter(function (n) { return !!byName[n]; });
      if (typeof saved.ref === 'number' && D.refineries[saved.ref]) S.ref = saved.ref;
    }
  } catch (e) { /* kaputter Speicher ist kein Grund, das Werkzeug zu verweigern */ }
  function save() {
    try {
      localStorage.setItem(LS, JSON.stringify({ sel: S.sel, pins: S.pins, ref: S.ref }));
    } catch (e) { /* privater Modus */ }
  }

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  var NF = new Intl.NumberFormat(D.lang === 'de' ? 'de-DE' : 'en-GB');
  function n2(v) { return D.lang === 'de' ? v.toFixed(2).replace('.', ',') : v.toFixed(2); }

  /* Die Daten kennen VIER Abbaumethoden (ship 26, roc 4, fps 4, hand 3). Die
     zweite Fassung warf alles ausser `ship` in denselben Topf „Hand" — die
     vier ROC-Erze standen damit falsch da. `fps` und `hand` bleiben bewusst
     zusammengefasst: beides ist Handabbau, und eine belastbare Unterscheidung
     geben die Daten nicht her. */
  function methodLabel(meth) {
    if (meth === 'ship') return T.ship;
    if (meth === 'roc') return T.roc;
    return T.hand;
  }

  /* Ertragsprofile sind nach Materialnamen MIT Suffix gekeyt
     ("Taranite (Raw)"), der Katalog fuehrt den sauberen Namen. */
  function yieldFor(profId, name) {
    var prof = D.profiles[profId];
    if (!prof) return null;
    var keys = [name, name + ' (Ore)', name + ' (Raw)', name + ' (Pure)'];
    for (var i = 0; i < keys.length; i++) if (typeof prof[keys[i]] === 'number') return prof[keys[i]];
    return null;
  }
  /* Alle 20 Stationen fuer DIESES Erz durchrechnen und sortieren — die
     Antwort auf „wo bringe ich das hin?", die es vorher nirgends gab. */
  function rankRefineries(name) {
    var out = [];
    for (var i = 0; i < D.refineries.length; i++) {
      var y = yieldFor(D.refineries[i].p, name);
      if (y === null) continue;
      out.push({ i: i, n: D.refineries[i].n, s: D.refineries[i].s, y: y });
    }
    out.sort(function (a, b) { return b.y - a.y; });
    return out;
  }

  var MAXCLUSTER = { common: 6, uncommon: 5, rare: 4, epic: 3, legendary: 2 };
  var listEl = $('wb-list');

  function renderList() {
    var q = S.q.trim().toLowerCase(), shown = 0;
    var tiles = listEl.querySelectorAll('.wb__tile');
    for (var i = 0; i < tiles.length; i++) {
      var el = tiles[i], m = byName[el.getAttribute('data-min')];
      if (!m) continue;
      var hit = !q || m.name.toLowerCase().indexOf(q) >= 0 ||
        m.locs.some(function (l) { return (l.p || '').toLowerCase().indexOf(q) >= 0; });
      if (hit && S.sys) hit = m.systems.indexOf(S.sys) >= 0;
      el.style.display = hit ? '' : 'none';
      el.classList.toggle('is-sel', m.name === S.sel);
      var pin = el.querySelector('.wb__pin'), on = S.pins.indexOf(m.name) >= 0;
      pin.classList.toggle('is-on', on);
      pin.textContent = on ? '★' : '☆';
      pin.setAttribute('aria-label', (on ? T.unpin : T.pin) + ': ' + m.name);
      if (hit) shown++;
    }
    $('wb-count').textContent = shown === D.minerals.length ? String(shown) : shown + '/' + D.minerals.length;
  }

  function stat(label, val, cls) {
    return '<div class="wb__stat ' + (cls || '') + '"><span class="wb__lbl">' + esc(label) +
      '</span><b class="num">' + esc(val) + '</b></div>';
  }
  function row2(main, sub, barPct, right, amber, mark) {
    return '<div class="wb__row2' + (mark ? ' is-pick' : '') + '"><span><span class="p">' + esc(main) + '</span>' +
      (sub ? '<span class="s">' + esc(sub) + '</span>' : '') + '</span>' +
      '<span class="r">' + (barPct === null ? '' :
        '<span class="wb__bar' + (amber ? ' amber' : '') + '"><i style="width:' + barPct + '%"></i></span>') +
      '<em>' + esc(right) + '</em></span></div>';
  }

  function renderDetail() {
    var m = byName[S.sel];
    if (!m) return;

    $('wb-name').textContent = m.name;
    $('wb-sig').textContent = m.sig ? NF.format(m.sig) : T.none;

    /* Der grosse Anheft-Knopf am gewaehlten Erz. `data-pin` wird hier gesetzt,
       damit ihn der delegierte Klick-Handler ohne Sonderfall erkennt — er
       behandelt jedes [data-pin] gleich. */
    var big = $('wb-pinsel');
    if (big) {
      var isPinned = S.pins.indexOf(m.name) >= 0;
      big.setAttribute('data-pin', m.name);
      big.classList.toggle('is-on', isPinned);
      big.setAttribute('aria-pressed', String(isPinned));
      $('wb-pinsel-ico').textContent = isPinned ? '★' : '☆';
      $('wb-pinsel-txt').textContent = isPinned ? T.unpin : T.pin;
    }
    $('wb-tags').innerHTML =
      '<span class="wb__tag is-rar">' + esc(D.rar[m.rarity] || (D.lang === 'de' ? 'ohne Stufe' : 'no tier')) + '</span>' +
      '<span class="wb__tag">' + esc(m.kind) + '</span>' +
      '<span class="wb__tag">' + esc(methodLabel(m.method)) + '</span>' +
      (m.refine ? '<span class="wb__tag">' + esc(T.refinable) + '</span>' : '');

    /* ⚠ Hier stand bis 12.08.2026 zusaetzlich „effektiv" — der Widerstand
       NACH dem Res-Mod der Ausruestung. Der Wert gehoert zum Rechnen, nicht
       zum Nachschlagen, und steht jetzt im Fracturing-Rechner. Was bleibt,
       sind die Zahlen des Erzes selbst. */
    var st = '';
    if (m.res !== null) st += stat(T.resistance, n2(m.res));
    if (m.inst !== null) st += stat(T.instability, NF.format(m.inst));
    if (m.dens !== null) st += stat(T.density, n2(m.dens));
    if (m.win !== null) st += stat(T.window, n2(m.win));
    if (m.scu) st += stat('SCU', n2(m.scu));
    $('wb-stats').innerHTML = st || '<p class="wb__empty">' + esc(T.noPhys) + '</p>';

    var bands = m.bands || [];
    $('wb-bands').innerHTML = bands.length
      ? bands.map(function (b, i) {
          var h = 22 + (i / Math.max(1, bands.length - 1)) * 78;
          return '<i class="' + (i > bands.length / 2 ? 'is-hi' : '') + '" style="height:' + h.toFixed(0) +
            '%" title="' + (i + 1) + ': ' + NF.format(b) + '"></i>';
        }).join('')
      : '<p class="wb__empty">' + esc(T.none) + '</p>';

    /* Welche Steine fuehren dieses Erz — aus den 211 Kompositionen. */
    $('wb-rockh').textContent = T.rocks + (m.rockCount ? ' · ' + m.rocks.length + ' ' + T.ofRocks + ' ' + m.rockCount : '');
    $('wb-rocks').innerHTML = m.rocks.length
      ? m.rocks.map(function (r) {
          return row2(r.rock, r.prob + ' % ' + T.chance, r.max, r.min + '–' + r.max + ' %', true);
        }).join('')
      : '<p class="wb__empty">' + esc(T.none) + '</p>';

    var locs = m.locs.slice().sort(function (a, b) { return (b.ch || 0) - (a.ch || 0); });
    $('wb-loch').textContent = T.locations + (locs.length ? ' · ' + locs.length : '');
    $('wb-locs').innerHTML = locs.length
      ? locs.map(function (l) { return row2(l.p, l.s, l.ab || 0, (l.ch != null ? n2(l.ch) + ' %' : '—'), false); }).join('')
      : '<p class="wb__empty">' + esc(T.noLocs) + '</p>';

    /* Stations-Rangliste fuer dieses Erz — und die GEWAEHLTE Station darin.
       ⚠ Die Stationswahl der Rig-Leiste war wirkungslos: S.ref wurde
       gespeichert und beim Aendern wurde neu gezeichnet, aber gelesen hat es
       niemand. Sie ist jetzt markiert, und faellt sie aus den besten vier,
       bekommt sie eine eigene Zeile. Kennt das Ertragsprofil das Erz gar
       nicht, sagt die Zeile das ausdruecklich statt zu verschwinden. */
    var ranked = rankRefineries(m.name);
    var chosen = D.refineries[S.ref];
    if (!ranked.length) {
      $('wb-refs').innerHTML = '<p class="wb__empty">' + esc(T.none) + '</p>';
    } else {
      var best = ranked.slice(0, 4), worst = ranked[ranked.length - 1];
      var maxAbs = Math.max(Math.abs(ranked[0].y), Math.abs(worst.y), 1);
      var picked = null;
      for (var pi = 0; pi < ranked.length; pi++) if (ranked[pi].i === S.ref) picked = ranked[pi];
      var html = best.map(function (r) {
        var mine = r.i === S.ref;
        return row2(r.n, r.s + ' · ' + (mine ? T.yourPick : T.yieldMod),
          Math.abs(r.y) / maxAbs * 100, (r.y > 0 ? '+' : '') + r.y + ' %', r.y >= 0, mine);
      }).join('');
      if (picked && best.indexOf(picked) < 0) {
        html += row2(picked.n, picked.s + ' · ' + T.yourPick, Math.abs(picked.y) / maxAbs * 100,
          (picked.y > 0 ? '+' : '') + picked.y + ' %', picked.y >= 0, true);
      } else if (!picked && chosen) {
        html += row2(chosen.n, chosen.s + ' · ' + T.yourPick, null, T.none, false, true);
      }
      if (ranked.length > 4 && worst.i !== S.ref) {
        html += row2(worst.n, worst.s + ' · ' + T.worst, Math.abs(worst.y) / maxAbs * 100,
          (worst.y > 0 ? '+' : '') + worst.y + ' %', false);
      }
      $('wb-refs').innerHTML = html;
    }

    /* Bezuege nach draussen: Crafting und Schiffe — in der ersten Fassung
       ersatzlos weggefallen, hier wieder angebunden. */
    var links = '';
    if (m.bp) {
      links += '<a class="wb__link" href="' + esc(D.craftingPath) + '">' + esc(T.usedIn) +
        ' <b>' + m.bp + '</b></a>';
    }
    /* ⚠ Frueher `D.ships.slice(0,3)` — dieselben drei Schiffe unter JEDEM Erz,
       auch unter den elf, die sich gar nicht per Schiff abbauen lassen. Jetzt
       nur die Fahrzeuge, die die Methode dieses Erzes auch bedienen; Hand-Erze
       bekommen keinen Verweis. */
    ((D.shipsByMethod || {})[m.method] || []).forEach(function (s) {
      links += '<a class="wb__link" href="' + esc(s.h) + '">' + esc(s.n) +
        (s.ore ? ' <b>' + esc(s.ore) + '</b>' : '') + '</a>';
    });
    $('wb-links').innerHTML = links;

    /* Der Weg zum Fracturing-Rechner nimmt das gewaehlte Erz mit — sonst
       landet man dort auf einem anderen und muss es zweimal suchen. */
    var frac = $('wb-frac');
    if (frac) {
      frac.href = D.fracturingPath + '?mineral=' + encodeURIComponent(m.name) + '#calc';
      $('wb-frac-ore').textContent = m.name;
    }
  }

  function renderPins() {
    var scan = parseInt(($('wb-scan').value || '').replace(/[^0-9]/g, ''), 10);
    if (!S.pins.length) {
      $('wb-pins').innerHTML = '<p class="wb__empty">' + esc(T.pinHint) + '</p>';
      return;
    }
    $('wb-pins').innerHTML = S.pins.map(function (name) {
      var m = byName[name];
      if (!m || !m.sig) return '';
      var max = MAXCLUSTER[m.rarity] || 4, mult = '';
      for (var k = 1; k <= max; k++) {
        var val = k * m.sig, hit = scan && Math.abs(val - scan) / scan <= 0.10;
        mult += '<i class="' + (hit ? 'is-hit' : '') + '" title="×' + k + '">' + NF.format(val) + '</i>';
      }
      return '<div class="wb__pin-item"><div class="wb__pin-top">' +
        '<span class="nm">' + esc(m.name) + '</span>' +
        '<button type="button" data-pin="' + esc(m.name) + '" aria-label="' + esc(T.unpin + ': ' + m.name) + '">×</button>' +
        '</div><div class="wb__mult">' + mult + '</div></div>';
    }).join('');
  }

  function renderAll() { renderList(); renderDetail(); renderPins(); save(); }

  var grid = document.querySelector('.wb__grid');
  function mountSeg() {
    if (!grid || document.querySelector('.wb__seg')) return;
    var seg = document.createElement('div');
    seg.className = 'wb__seg';
    seg.setAttribute('role', 'tablist');
    var keys = [['list', T.minerals], ['view', T.view], ['sig', T.signatures]];
    seg.innerHTML = keys.map(function (k, i) {
      return '<button type="button" class="wb__chip' + (i === 0 ? ' is-on' : '') +
        '" data-seg="' + k[0] + '" role="tab" aria-selected="' + (i === 0) + '">' + esc(k[1]) + '</button>';
    }).join('');
    grid.parentNode.insertBefore(seg, grid);
    grid.classList.add('has-seg', 'seg-list');
  }
  mountSeg();

  /* Die Handler haengen am document und sehen JEDEN Klick der Seite — auch
     die im Refinery-Finder darunter. Ohne diesen Riegel koennte `closest`
     dort werfen oder ein gleichnamiges data-Attribut treffen. */
  function inWb(t) { return t && typeof t.closest === 'function' && !!t.closest('.wb'); }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!inWb(t)) return;
    var pin = t.closest('[data-pin]');
    if (pin) {
      var pn = pin.getAttribute('data-pin'), at = S.pins.indexOf(pn);
      if (at >= 0) S.pins.splice(at, 1); else S.pins.push(pn);
      renderAll(); return;
    }
    var tile = t.closest('.wb__tile');
    if (tile) { S.sel = tile.getAttribute('data-min'); renderAll(); return; }
    var sys = t.closest('[data-sys]');
    if (sys) {
      var sv = sys.getAttribute('data-sys');
      S.sys = S.sys === sv ? null : sv;
      var all = document.querySelectorAll('[data-sys]');
      for (var i2 = 0; i2 < all.length; i2++) all[i2].classList.toggle('is-on', all[i2].getAttribute('data-sys') === S.sys);
      renderList(); return;
    }
    var seg = t.closest('[data-seg]');
    if (seg && grid) {
      var k = seg.getAttribute('data-seg');
      grid.classList.remove('seg-list', 'seg-view', 'seg-sig');
      grid.classList.add('seg-' + k);
      var tabs = document.querySelectorAll('[data-seg]');
      for (var i3 = 0; i3 < tabs.length; i3++) {
        var on = tabs[i3] === seg;
        tabs[i3].classList.toggle('is-on', on);
        tabs[i3].setAttribute('aria-selected', String(on));
      }
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (!inWb(e.target)) return;
    var tile = e.target.closest('.wb__tile');
    if (!tile) return;
    e.preventDefault();
    S.sel = tile.getAttribute('data-min');
    renderAll();
  });

  document.addEventListener('change', function (e) {
    if (e.target.id === 'wb-ref') { S.ref = +e.target.value; renderDetail(); save(); }
  });

  document.addEventListener('input', function (e) {
    if (e.target.id === 'wb-q') { S.q = e.target.value; renderList(); }
    else if (e.target.id === 'wb-scan') { renderPins(); }
  });

  /* Tieflink ?mineral=<Name> aus der Crafting-Datenbank (miningLinks.ts:129,
     ueber 8000 Verweise). VORRANG vor dem gespeicherten Zustand: wer von dort
     kommt, will DIESES Erz sehen. */
  var deepLinked = false;
  (function fromQuery() {
    var want;
    try { want = new URLSearchParams(location.search).get('mineral'); } catch (e) { return; }
    if (!want) return;
    var key = want.trim().toLowerCase();
    for (var n in byName) if (n.toLowerCase() === key) { S.sel = n; deepLinked = true; return; }
  })();

  if ($('wb-ref')) $('wb-ref').value = String(S.ref);
  renderAll();

  /* Angesprungene Kachel ins Bild holen. Zwei Fallen: nicht ueber offsetTop
     rechnen (misst gegen das naechste positionierte Elternelement), und EIN
     rAF reicht nicht — die Rasterhoehe kommt aus clamp(…100vh…), im ersten
     Bild ist scrollHeight == clientHeight und die Zuweisung wird auf 0
     geklemmt. Deshalb warten, bis der Kasten scrollbar ist. */
  if (deepLinked) {
    var tries = 0;
    (function center() {
      var tile = listEl.querySelector('.wb__tile.is-sel');
      var box = tile && tile.closest('.wb__scroll');
      if (box && box.scrollHeight > box.clientHeight + 4) {
        var r = tile.getBoundingClientRect(), b = box.getBoundingClientRect();
        box.scrollTop += (r.top - b.top) - (b.height / 2 - r.height / 2);
        return;
      }
      if (tries++ < 20) requestAnimationFrame(center);
    })();
  }
})();
