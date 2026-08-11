/* ============================================================================
   mining-workbench.js — Client-Teil der Mining-Werkbank (zweite Fassung).

   Zustand: Auswahl, angeheftete Signaturen, Rig (Laser/Module/Gadget/
   Felsmasse/Station). Gast -> localStorage; Kontobindung ist ein eigener
   Schuldenposten (.planning/todos/pending/signatur-liste-kontogebunden.md).

   DIE BRECH-RECHNUNG IST NICHT NEU ERFUNDEN. Zeichengleich mit
   src/components/FracturingCalc.astro:200-219:
       Reff         = max(0,R) * (1 + resMod/100)
       chargeFactor = max(0.05, 1 - Reff)
       effDps       = laserDps * dpsMult * chargeFactor
       decay        = decayPerMass * Felsmasse
       ratio        = effDps / decay      <=1 unmoeglich | <1.3 grenzwertig
   Wer sie hier aendert, muss sie dort mitaendern.
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

  var S = {
    sel: D.minerals[0].name, pins: [], laser: 0, mods: [-1, -1, -1],
    gadget: -1, mass: D.defaultMass, ref: 0, q: '', sys: null, onlyBreak: false
  };
  try {
    var saved = JSON.parse(localStorage.getItem(LS) || 'null');
    if (saved && typeof saved === 'object') {
      if (byName[saved.sel]) S.sel = saved.sel;
      if (Array.isArray(saved.pins)) S.pins = saved.pins.filter(function (n) { return !!byName[n]; });
      if (typeof saved.laser === 'number' && D.lasers[saved.laser]) S.laser = saved.laser;
      if (Array.isArray(saved.mods) && saved.mods.length === 3) S.mods = saved.mods;
      if (typeof saved.gadget === 'number') S.gadget = saved.gadget;
      if (typeof saved.mass === 'number') S.mass = saved.mass;
      if (typeof saved.ref === 'number' && D.refineries[saved.ref]) S.ref = saved.ref;
    }
  } catch (e) { /* kaputter Speicher ist kein Grund, das Werkzeug zu verweigern */ }
  function save() {
    try {
      localStorage.setItem(LS, JSON.stringify({
        sel: S.sel, pins: S.pins, laser: S.laser, mods: S.mods,
        gadget: S.gadget, mass: S.mass, ref: S.ref
      }));
    } catch (e) { /* privater Modus */ }
  }

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  var NF = new Intl.NumberFormat(D.lang === 'de' ? 'de-DE' : 'en-GB');
  function n0(v) { return NF.format(Math.round(v)); }
  function n2(v) { return D.lang === 'de' ? v.toFixed(2).replace('.', ',') : v.toFixed(2); }

  function loadout() {
    var L = D.lasers[S.laser] || D.lasers[0];
    var resMod = (L.mods && L.mods.resistance) || 0;
    var dpsMult = 1;
    for (var i = 0; i < 3; i++) {
      if (i >= (L.slots || 0)) continue;
      var m = D.modules[S.mods[i]];
      if (!m) continue;
      dpsMult *= (m.mult || 1);
      resMod += (m.mods && m.mods.resistance) || 0;
    }
    var g = D.gadgets[S.gadget];
    if (g) resMod += (g.mods && g.mods.resistance) || 0;
    return { L: L, dps: L.dps, dpsMult: dpsMult, resMod: resMod };
  }
  function verdict(res) {
    if (res === null || res === undefined) return { cls: 'na', ratio: null };
    var lo = loadout();
    var R = Math.max(0, res);
    var Reff = R * (1 + lo.resMod / 100);
    var chargeFactor = Math.max(0.05, 1 - Reff);
    var effDps = lo.dps * lo.dpsMult * chargeFactor;
    var decay = (D.params.decayPerMass || 0.2) * S.mass;
    var ratio = decay > 0 ? effDps / decay : 99;
    return {
      cls: ratio <= 1 ? 'bad' : ratio < 1.3 ? 'warn' : 'ok',
      ratio: ratio, avail: effDps, req: decay, Reff: Reff
    };
  }
  function vLabel(c) { return c === 'ok' ? T.breakable : c === 'warn' ? T.marginal : c === 'bad' ? T.impossible : T.noPhys; }

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
      var v = verdict(m.res);
      var dot = el.querySelector('.wb__dot');
      dot.className = 'wb__dot is-' + v.cls;
      el.title = m.name + ' · ' + vLabel(v.cls) + (v.ratio !== null ? ' ×' + n2(v.ratio) : '');
      var hit = !q || m.name.toLowerCase().indexOf(q) >= 0 ||
        m.locs.some(function (l) { return (l.p || '').toLowerCase().indexOf(q) >= 0; });
      if (hit && S.sys) hit = m.systems.indexOf(S.sys) >= 0;
      if (hit && S.onlyBreak) hit = v.cls === 'ok';
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

  /* Messgeraet: Skala 0…2,0 mit Teilung, markiertem Grenz- und Gutbereich
     und Zeiger. Anleihe ist das Ladefenster beim Fracturing im Spiel. */
  function renderGauge(v) {
    var g = $('wb-gauge');
    g.className = 'wb__gauge is-' + v.cls;
    $('wb-vddot').className = 'wb__dot is-' + v.cls;
    $('wb-vdlbl').textContent = vLabel(v.cls);
    $('wb-vdsub').textContent = v.ratio === null ? ''
      : n0(v.avail) + ' ' + T.avail + ' · ' + n0(v.req) + ' ' + T.needed;
    $('wb-vdratio').textContent = v.ratio === null ? T.none : '×' + n2(v.ratio);
    var MAX = 2, pct = function (r) { return Math.min(100, Math.max(0, r / MAX * 100)); };
    var h = '<i class="zone w" style="left:' + pct(1) + '%;width:' + (pct(1.3) - pct(1)) + '%"></i>' +
      '<i class="zone g" style="left:' + pct(1.3) + '%;right:0"></i>';
    for (var k = 0; k <= 20; k++) h += '<i class="tick' + (k % 5 === 0 ? ' maj' : '') + '" style="left:' + (k / 20 * 100) + '%"></i>';
    if (v.ratio !== null) {
      h += '<i class="fill" style="width:' + pct(v.ratio) + '%"></i>' +
        '<i class="mark" style="left:calc(' + pct(v.ratio) + '% - 1px)"></i>';
    }
    $('wb-scale').innerHTML = h;
  }

  function stat(label, val, cls) {
    return '<div class="wb__stat ' + (cls || '') + '"><span class="wb__lbl">' + esc(label) +
      '</span><b class="num">' + esc(val) + '</b></div>';
  }
  function row2(main, sub, barPct, right, amber) {
    return '<div class="wb__row2"><span><span class="p">' + esc(main) + '</span>' +
      (sub ? '<span class="s">' + esc(sub) + '</span>' : '') + '</span>' +
      '<span class="r">' + (barPct === null ? '' :
        '<span class="wb__bar' + (amber ? ' amber' : '') + '"><i style="width:' + barPct + '%"></i></span>') +
      '<em>' + esc(right) + '</em></span></div>';
  }

  function renderDetail() {
    var m = byName[S.sel];
    if (!m) return;
    var v = verdict(m.res);

    $('wb-name').textContent = m.name;
    $('wb-sig').textContent = m.sig ? NF.format(m.sig) : T.none;
    $('wb-tags').innerHTML =
      '<span class="wb__tag is-rar">' + esc(D.rar[m.rarity] || (D.lang === 'de' ? 'ohne Stufe' : 'no tier')) + '</span>' +
      '<span class="wb__tag">' + esc(m.kind) + '</span>' +
      '<span class="wb__tag">' + esc(m.method === 'ship' ? T.ship : T.hand) + '</span>' +
      (m.refine ? '<span class="wb__tag">' + esc(T.refinable) + '</span>' : '');

    renderGauge(v);

    var st = '';
    if (m.res !== null) { st += stat(T.resistance, n2(m.res)); st += stat(T.effective, n2(v.Reff), 'is-hot'); }
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

    /* Stations-Rangliste fuer dieses Erz. */
    var ranked = rankRefineries(m.name);
    if (!ranked.length) {
      $('wb-refs').innerHTML = '<p class="wb__empty">' + esc(T.none) + '</p>';
    } else {
      var best = ranked.slice(0, 4), worst = ranked[ranked.length - 1];
      var maxAbs = Math.max(Math.abs(ranked[0].y), Math.abs(worst.y), 1);
      var html = best.map(function (r) {
        return row2(r.n, r.s + ' · ' + T.yieldMod, Math.abs(r.y) / maxAbs * 100,
          (r.y > 0 ? '+' : '') + r.y + ' %', r.y >= 0);
      }).join('');
      if (ranked.length > 4) {
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
    (D.ships || []).slice(0, 3).forEach(function (s) {
      links += '<a class="wb__link" href="' + esc(s.h) + '">' + esc(s.n) +
        (s.ore ? ' <b>' + esc(s.ore) + '</b>' : '') + '</a>';
    });
    $('wb-links').innerHTML = links;
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
        '<span class="wb__dot is-' + verdict(m.res).cls + '"></span>' +
        '<span class="nm">' + esc(m.name) + '</span>' +
        '<button type="button" data-pin="' + esc(m.name) + '" aria-label="' + esc(T.unpin + ': ' + m.name) + '">×</button>' +
        '</div><div class="wb__mult">' + mult + '</div></div>';
    }).join('');
  }

  function renderRig() {
    var lo = loadout(), L = lo.L, html = '';
    for (var i = 0; i < 3; i++) {
      var usable = i < (L.slots || 0), m = D.modules[S.mods[i]];
      html += '<button type="button" class="wb__slot' + (usable && m ? ' is-full' : '') + '" data-slot="' + i + '"' +
        (usable ? '' : ' disabled') + ' title="' +
        esc(usable ? (m ? m.n : T.modules) : (D.lang === 'de'
          ? 'Dieser Laser hat nur ' + (L.slots || 0) + ' Modulplätze'
          : 'This laser has only ' + (L.slots || 0) + ' module slots')) + '">' +
        (usable ? (m ? 'M' + (i + 1) : '+') : '—') + '</button>';
    }
    $('wb-slots').innerHTML = html;
    $('wb-avail').textContent = n0(lo.dps * lo.dpsMult);
    $('wb-resmod').textContent = (lo.resMod > 0 ? '+' : '') + lo.resMod + ' %';
    var chips = document.querySelectorAll('#wb-mass .wb__chip');
    for (var j = 0; j < chips.length; j++) {
      chips[j].classList.toggle('is-on', +chips[j].getAttribute('data-mass') === S.mass);
    }
  }

  function renderAll() { renderList(); renderDetail(); renderPins(); renderRig(); save(); }

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
    var slot = t.closest('[data-slot]');
    if (slot && !slot.disabled) {
      var si = +slot.getAttribute('data-slot');
      S.mods[si] = S.mods[si] + 1 >= D.modules.length ? -1 : S.mods[si] + 1;
      renderAll(); return;
    }
    var mass = t.closest('[data-mass]');
    if (mass) { S.mass = +mass.getAttribute('data-mass'); renderAll(); return; }
    var sys = t.closest('[data-sys]');
    if (sys) {
      var sv = sys.getAttribute('data-sys');
      S.sys = S.sys === sv ? null : sv;
      var all = document.querySelectorAll('[data-sys]');
      for (var i2 = 0; i2 < all.length; i2++) all[i2].classList.toggle('is-on', all[i2].getAttribute('data-sys') === S.sys);
      renderList(); return;
    }
    var only = t.closest('[data-only]');
    if (only) { S.onlyBreak = !S.onlyBreak; only.classList.toggle('is-on', S.onlyBreak); renderList(); return; }
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
    var t = e.target;
    if (t.id === 'wb-laser') {
      S.laser = +t.value;
      var slots = (D.lasers[S.laser] || {}).slots || 0;
      for (var i = slots; i < 3; i++) S.mods[i] = -1;
      renderAll();
    } else if (t.id === 'wb-gadget') { S.gadget = +t.value; renderAll(); }
    else if (t.id === 'wb-ref') { S.ref = +t.value; renderDetail(); save(); }
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

  if ($('wb-laser')) $('wb-laser').value = String(S.laser);
  if ($('wb-gadget')) $('wb-gadget').value = String(S.gadget);
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
