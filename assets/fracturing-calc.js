/* ============================================================================
   fracturing-calc.js — Client-Teil des Fracturing-Rechners (/fracturing.html).

   Am 12.08.2026 aus assets/mining-workbench.js herausgeloest: der Rechner
   war dort ein Teil der Werkbank, gehoerte aber nie dahin — die Mining-Seite
   beantwortet „welches Erz, wo, was wert?", der Rechner „krieg ich den
   Brocken mit MEINER Ausruestung auf?". Die Werkbank kennt seither weder
   Laser noch Module noch eine Brechbarkeit.

   DIE BRECH-RECHNUNG STEHT JETZT NUR NOCH HIER. Zeichengleich uebernommen:
       Reff         = max(0,R) * (1 + resMod/100)
       chargeFactor = max(0.05, 1 - Reff)
       effDps       = laserDps * dpsMult * chargeFactor
       decay        = decayPerMass * Felsmasse
       ratio        = effDps / decay      <=1 unmoeglich | <1.3 grenzwertig
   Es gibt keine zweite Fassung mehr, die man mitaendern muesste.

   Zustand: gewaehltes Erz + Ausruestung, Gast -> localStorage. EIGENER
   Schluessel: die Werkbank speichert unter `vb-mining-wb` weiter ihre
   Auswahl und ihre Signaturen, und die beiden Werkzeuge sollen sich nicht
   gegenseitig ueberschreiben. Geteilt wird nur ueber ?mineral=<Name>, also
   sichtbar in der Adresse — beide Seiten lesen und schreiben den Parameter.
   ========================================================================== */
(function () {
  'use strict';

  var node = document.getElementById('fc-data');
  if (!node) return;
  var D;
  try { D = JSON.parse(node.textContent || '{}'); } catch (e) { return; }
  if (!D || !D.minerals || !D.minerals.length) return;

  var T = D.t || {};
  var LS = 'vb-fracturing';
  var byName = {};
  for (var i = 0; i < D.minerals.length; i++) byName[D.minerals[i].name] = D.minerals[i];

  var S = {
    sel: D.minerals[0].name, laser: 0, mods: [-1, -1, -1],
    gadget: -1, mass: D.defaultMass, q: '', sys: null, onlyBreak: false
  };
  try {
    var saved = JSON.parse(localStorage.getItem(LS) || 'null');
    if (saved && typeof saved === 'object') {
      if (byName[saved.sel]) S.sel = saved.sel;
      if (typeof saved.laser === 'number' && D.lasers[saved.laser]) S.laser = saved.laser;
      if (Array.isArray(saved.mods) && saved.mods.length === 3) S.mods = saved.mods;
      if (typeof saved.gadget === 'number') S.gadget = saved.gadget;
      if (typeof saved.mass === 'number') S.mass = saved.mass;
    }
  } catch (e) { /* kaputter Speicher ist kein Grund, das Werkzeug zu verweigern */ }
  function save() {
    try {
      localStorage.setItem(LS, JSON.stringify({
        sel: S.sel, laser: S.laser, mods: S.mods, gadget: S.gadget, mass: S.mass
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
  /* Der Res-Mod ist meistens glatt (-30 %), durch Module aber auch krumm
     (-24,5 %). Feste zwei Nachkommastellen haetten aus jedem glatten Wert
     ein „-30,00 %" gemacht — laut vorgelesene Genauigkeit, die es nicht gibt. */
  function nPct(v) {
    var s = Math.round(v * 10) / 10;
    var out = s % 1 === 0 ? String(s) : s.toFixed(1);
    return (D.lang === 'de' ? out.replace('.', ',') : out) + ' %';
  }

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
      ratio: ratio, avail: effDps, req: decay, Reff: Reff, charge: chargeFactor
    };
  }
  function vLabel(c) { return c === 'ok' ? T.breakable : c === 'warn' ? T.marginal : c === 'bad' ? T.impossible : T.noPhys; }

  var listEl = $('fc-list');

  function renderList() {
    var q = S.q.trim().toLowerCase(), shown = 0;
    var tiles = listEl.querySelectorAll('.fc__tile');
    for (var i = 0; i < tiles.length; i++) {
      var el = tiles[i], m = byName[el.getAttribute('data-min')];
      if (!m) continue;
      var v = verdict(m.res);
      el.querySelector('.fc__dot').className = 'fc__dot is-' + v.cls;
      el.querySelector('.fc__tr').textContent = v.ratio === null ? '—' : '×' + n2(v.ratio);
      el.title = m.name + ' · ' + vLabel(v.cls) + (v.ratio !== null ? ' ×' + n2(v.ratio) : '');
      var hit = !q || m.name.toLowerCase().indexOf(q) >= 0;
      if (hit && S.sys) hit = m.systems.indexOf(S.sys) >= 0;
      if (hit && S.onlyBreak) hit = v.cls === 'ok';
      el.style.display = hit ? '' : 'none';
      el.classList.toggle('is-sel', m.name === S.sel);
      if (hit) shown++;
    }
    $('fc-count').textContent = shown === D.minerals.length ? String(shown) : shown + '/' + D.minerals.length;
  }

  /* Messgeraet: Skala 0…2,0 mit Teilung, markiertem Grenz- und Gutbereich
     und Zeiger. Anleihe ist das Ladefenster beim Fracturing im Spiel. Hier
     darf es wieder gross sein — auf dieser Seite ist es die Hauptsache und
     nicht mehr ein Gast in einer Bedienleiste. */
  function renderGauge(v) {
    $('fc-gauge').className = 'fc__gauge is-' + v.cls;
    $('fc-vddot').className = 'fc__dot is-' + v.cls;
    $('fc-vdlbl').textContent = vLabel(v.cls);
    $('fc-vdratio').textContent = v.ratio === null ? T.none : '×' + n2(v.ratio);
    var MAX = 2, pct = function (r) { return Math.min(100, Math.max(0, r / MAX * 100)); };
    var h = '<i class="zone w" style="left:' + pct(1) + '%;width:' + (pct(1.3) - pct(1)) + '%"></i>' +
      '<i class="zone g" style="left:' + pct(1.3) + '%;right:0"></i>';
    for (var k = 0; k <= 20; k++) h += '<i class="tick' + (k % 5 === 0 ? ' maj' : '') + '" style="left:' + (k / 20 * 100) + '%"></i>';
    if (v.ratio !== null) {
      h += '<i class="fill" style="width:' + pct(v.ratio) + '%"></i>' +
        '<i class="mark" style="left:calc(' + pct(v.ratio) + '% - 1px)"></i>';
    }
    $('fc-scale').innerHTML = h;
  }

  function stat(label, val, cls) {
    return '<div class="fc__stat ' + (cls || '') + '"><span class="fc__lbl">' + esc(label) +
      '</span><b class="num">' + esc(val) + '</b></div>';
  }

  /* Der Rechenweg ausgeschrieben. Ein Urteil ohne Herleitung ist auf einer
     Rechnerseite zu wenig: wer „nicht brechbar" liest, will wissen, an
     welchem der vier Faktoren es haengt und welcher sich aendern laesst. */
  function renderMath(m, v) {
    var lo = loadout();
    if (v.ratio === null) {
      $('fc-math').innerHTML = '<p class="fc__empty">' + esc(T.noPhys) + '</p>';
      return;
    }
    var rows = [
      [T.mLaser, n0(lo.dps) + (lo.dpsMult !== 1 ? ' × ' + n2(lo.dpsMult) : ''), n0(lo.dps * lo.dpsMult)],
      [T.mResist, n2(m.res) + (lo.resMod ? ' · ' + (lo.resMod > 0 ? '+' : '') + nPct(lo.resMod) : ''), n2(v.Reff)],
      [T.mCharge, n0(lo.dps * lo.dpsMult) + ' × ' + n2(v.charge), n0(v.avail)],
      [T.mMass, n0(S.mass) + ' × ' + n2(D.params.decayPerMass || 0.2), n0(v.req)]
    ];
    $('fc-math').innerHTML = rows.map(function (r) {
      return '<div class="fc__mrow"><span class="p">' + esc(r[0]) + '</span>' +
        '<span class="s num">' + esc(r[1]) + '</span>' +
        '<b class="num">' + esc(r[2]) + '</b></div>';
    }).join('') +
      '<div class="fc__mrow is-sum"><span class="p">' + esc(T.mRatio) + '</span>' +
      '<span class="s num">' + esc(n0(v.avail) + ' ÷ ' + n0(v.req)) + '</span>' +
      '<b class="num">×' + esc(n2(v.ratio)) + '</b></div>';
  }

  function renderDetail() {
    var m = byName[S.sel];
    if (!m) return;
    var v = verdict(m.res);

    $('fc-name').textContent = m.name;
    $('fc-tags').innerHTML =
      '<span class="fc__tag is-rar">' + esc(D.rar[m.rarity] || (D.lang === 'de' ? 'ohne Stufe' : 'no tier')) + '</span>' +
      '<span class="fc__tag">' + esc(m.kind) + '</span>';

    renderGauge(v);
    renderMath(m, v);

    var st = '';
    if (m.res !== null) { st += stat(T.resistance, n2(m.res)); st += stat(T.effective, n2(v.Reff), 'is-hot'); }
    if (m.inst !== null) st += stat(T.instability, NF.format(m.inst));
    if (m.win !== null) st += stat(T.window, n2(m.win));
    $('fc-stats').innerHTML = st || '<p class="fc__empty">' + esc(T.noPhys) + '</p>';

    /* Zurueck ins Mining mit demselben Erz — die Fundorte, der Ertrag und
       die Steine stehen dort und wurden bewusst NICHT mit hierher kopiert. */
    var back = $('fc-back');
    back.href = D.miningPath + '?mineral=' + encodeURIComponent(m.name) + '#db';
    $('fc-back-ore').textContent = m.name;
  }

  /* Je Steckplatz eine Auswahl statt eines Weiterschalt-Knopfes: bei 26
     Modulen waeren es sonst bis zu 26 Klicks fuer den letzten. */
  function renderRig() {
    var lo = loadout(), L = lo.L, html = '';
    for (var i = 0; i < 3; i++) {
      var usable = i < (L.slots || 0), m = D.modules[S.mods[i]];
      var opts = '<option value="-1">' + esc(T.none) + '</option>';
      for (var k = 0; k < D.modules.length; k++) {
        opts += '<option value="' + k + '"' + (S.mods[i] === k ? ' selected' : '') + '>' +
          esc(D.modules[k].n.replace(/\s+Module$/, '')) + '</option>';
      }
      html += '<select class="fc__slot' + (usable && m ? ' is-full' : '') + '" data-slot="' + i + '"' +
        (usable ? '' : ' disabled') +
        ' aria-label="' + esc(T.modules + ' ' + (i + 1)) + '" title="' +
        esc(usable ? T.modules + ' ' + (i + 1) : (D.lang === 'de'
          ? 'Dieser Laser hat nur ' + (L.slots || 0) + ' Modulplätze'
          : 'This laser has only ' + (L.slots || 0) + ' module slots')) + '">' +
        opts + '</select>';
    }
    $('fc-slots').innerHTML = html;
    $('fc-dps').textContent = n0(lo.dps * lo.dpsMult);
    $('fc-resmod').textContent = (lo.resMod > 0 ? '+' : '') + nPct(lo.resMod);
    $('fc-slotcount').textContent = String(L.slots || 0);
    var chips = document.querySelectorAll('#fc-mass .fc__chip');
    for (var j = 0; j < chips.length; j++) {
      chips[j].classList.toggle('is-on', +chips[j].getAttribute('data-mass') === S.mass);
    }
  }

  function renderAll() { renderList(); renderDetail(); renderRig(); save(); }

  /* Die Handler haengen am document; der Riegel haelt sie in diesem Werkzeug,
     falls die Seite spaeter ein zweites bekommt. */
  function inFc(t) { return t && typeof t.closest === 'function' && !!t.closest('.fc'); }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!inFc(t)) return;
    var tile = t.closest('.fc__tile');
    if (tile) { S.sel = tile.getAttribute('data-min'); renderAll(); return; }
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
    if (only) { S.onlyBreak = !S.onlyBreak; only.classList.toggle('is-on', S.onlyBreak); renderList(); }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (!inFc(e.target)) return;
    var tile = e.target.closest('.fc__tile');
    if (!tile) return;
    e.preventDefault();
    S.sel = tile.getAttribute('data-min');
    renderAll();
  });

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'fc-laser') {
      S.laser = +t.value;
      var slots = (D.lasers[S.laser] || {}).slots || 0;
      for (var i = slots; i < 3; i++) S.mods[i] = -1;
      renderAll();
    } else if (t.id === 'fc-gadget') { S.gadget = +t.value; renderAll(); }
    else if (t.classList && t.classList.contains('fc__slot')) {
      S.mods[+t.getAttribute('data-slot')] = +t.value;
      renderAll();
    }
  });

  document.addEventListener('input', function (e) {
    if (e.target.id === 'fc-q') { S.q = e.target.value; renderList(); }
  });

  /* ?mineral=<Name> — dieselbe Sprache wie die Mining-Werkbank, damit der
     Weg in beide Richtungen funktioniert. VORRANG vor dem gespeicherten
     Zustand: wer mit einem Erz in der Adresse kommt, will DIESES sehen. */
  var deepLinked = false;
  (function fromQuery() {
    var want;
    try { want = new URLSearchParams(location.search).get('mineral'); } catch (e) { return; }
    if (!want) return;
    var key = want.trim().toLowerCase();
    for (var n in byName) if (n.toLowerCase() === key) { S.sel = n; deepLinked = true; return; }
  })();

  if ($('fc-laser')) $('fc-laser').value = String(S.laser);
  if ($('fc-gadget')) $('fc-gadget').value = String(S.gadget);
  renderAll();

  /* Angesprungene Kachel ins Bild holen. Zwei Fallen (in der Werkbank
     bezahlt): nicht ueber offsetTop rechnen, und EIN rAF reicht nicht —
     die Rasterhoehe kommt aus clamp(…100vh…), im ersten Bild ist
     scrollHeight == clientHeight und die Zuweisung wird auf 0 geklemmt. */
  if (deepLinked) {
    var tries = 0;
    (function center() {
      var tile = listEl.querySelector('.fc__tile.is-sel');
      var box = tile && tile.closest('.fc__scroll');
      if (box && box.scrollHeight > box.clientHeight + 4) {
        var r = tile.getBoundingClientRect(), b = box.getBoundingClientRect();
        box.scrollTop += (r.top - b.top) - (b.height / 2 - r.height / 2);
        return;
      }
      if (tries++ < 20) requestAnimationFrame(center);
    })();
  }
})();
