/* mining-app.js — funktionale Mineral-DB. Filtert die SSR-Karten per data-*,
   baut Detail-Modal + Fundort-Reverse-Lookup + Wert-Rechner aus dem JSON-Snapshot.
   Kein Framework; liest window.__MINE = { lang, dbUrl, t }. */
(function () {
  'use strict';
  var CFG = window.__MINE || {};
  var T = CFG.t || {};
  var LANG = CFG.lang || 'en';
  var NF = new Intl.NumberFormat(LANG === 'de' ? 'de-DE' : 'en-US');
  var DB = null; // lazy-geladen für Detail/Reverse-Lookup

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var grid = $('#mdb-grid');
  if (!grid) return;
  var cards = $$('.mcd', grid);
  var countEl = $('#mdb-count');
  var emptyEl = $('#mdb-empty');
  var searchEl = $('#mdb-search');

  // ---- Filterzustand ----
  var state = { q: '', sys: [], meth: [], kind: '', refine: false, gem: false, sort: 'rarity' };

  function apply() {
    var q = state.q.trim().toLowerCase();
    var shown = 0;
    cards.forEach(function (c) {
      var ok = true;
      if (q && c.getAttribute('data-search').indexOf(q) < 0) ok = false;
      if (ok && state.sys.length) {
        var sysAttr = c.getAttribute('data-systems');
        ok = state.sys.some(function (s) { return sysAttr.split('|').indexOf(s) >= 0; });
      }
      if (ok && state.meth.length) ok = state.meth.indexOf(c.getAttribute('data-method')) >= 0;
      if (ok && state.kind) ok = c.getAttribute('data-kind') === state.kind;
      if (ok && state.refine) ok = c.getAttribute('data-refine') === '1';
      if (ok && state.gem) ok = c.getAttribute('data-method') === 'hand';
      c.hidden = !ok;
      if (ok) shown++;
    });
    if (countEl) countEl.textContent = shown;
    if (emptyEl) emptyEl.hidden = shown !== 0;
    sortCards();
  }

  function sortCards() {
    var vis = cards.filter(function (c) { return !c.hidden; });
    var s = state.sort;
    vis.sort(function (a, b) {
      if (s === 'name') return a.getAttribute('data-name').localeCompare(b.getAttribute('data-name'));
      if (s === 'name-desc') return b.getAttribute('data-name').localeCompare(a.getAttribute('data-name'));
      if (s === 'locs') {
        var la = +a.getAttribute('data-locs'), lb = +b.getAttribute('data-locs');
        return (lb - la) || a.getAttribute('data-name').localeCompare(b.getAttribute('data-name'));
      }
      // rarity: legendary(0) → common(4) → hand/roc(6); tie → name
      var ra = +a.getAttribute('data-rank'), rb = +b.getAttribute('data-rank');
      return (ra - rb) || a.getAttribute('data-name').localeCompare(b.getAttribute('data-name'));
    });
    vis.forEach(function (c) { grid.appendChild(c); });
  }

  // ---- Toolbar-Bindings ----
  if (searchEl) searchEl.addEventListener('input', function () { state.q = searchEl.value; apply(); });
  var sortSel = $('#mdb-sort');
  if (sortSel) sortSel.addEventListener('change', function () { state.sort = sortSel.value; apply(); });

  $$('.mdb-view').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('.mdb-view').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      grid.classList.toggle('is-list', b.getAttribute('data-view') === 'list');
    });
  });

  $$('.mdb-sys').forEach(function (cb) {
    cb.addEventListener('change', function () {
      state.sys = $$('.mdb-sys').filter(function (x) { return x.checked; }).map(function (x) { return x.value; });
      apply();
    });
  });
  $$('.mdb-meth').forEach(function (cb) {
    cb.addEventListener('change', function () {
      state.meth = $$('.mdb-meth').filter(function (x) { return x.checked; }).map(function (x) { return x.value; });
      apply();
    });
  });
  var kindSel = $('#mdb-kind');
  if (kindSel) kindSel.addEventListener('change', function () { state.kind = kindSel.value; apply(); });
  var refineCb = $('#mdb-refine');
  if (refineCb) refineCb.addEventListener('change', function () { state.refine = refineCb.checked; apply(); });
  var gemCb = $('#mdb-gem');
  if (gemCb) gemCb.addEventListener('change', function () { state.gem = gemCb.checked; apply(); });

  var resetBtn = $('#mdb-reset');
  if (resetBtn) resetBtn.addEventListener('click', function () {
    state = { q: '', sys: [], meth: [], kind: '', refine: false, gem: false, sort: state.sort };
    if (searchEl) searchEl.value = '';
    $$('.mdb-sys, .mdb-meth').forEach(function (x) { x.checked = false; });
    if (kindSel) kindSel.value = '';
    if (refineCb) refineCb.checked = false;
    if (gemCb) gemCb.checked = false;
    apply();
  });

  // Sidebar (mobil)
  var sidebar = $('#mdb-sidebar');
  var ftog = $('#mdb-filter-toggle');
  if (ftog) ftog.addEventListener('click', function () { sidebar.classList.add('is-open'); ftog.setAttribute('aria-expanded', 'true'); });
  var fclose = $('#mdb-filter-close');
  if (fclose) fclose.addEventListener('click', function () { sidebar.classList.remove('is-open'); if (ftog) ftog.setAttribute('aria-expanded', 'false'); });

  // ---- DB lazy laden ----
  function loadDB() {
    if (DB) return Promise.resolve(DB);
    return fetch(CFG.dbUrl).then(function (r) { return r.json(); }).then(function (j) { DB = j; return j; });
  }

  // ---- Detail-Modal ----
  var modal = $('#mdb-modal');
  var modalBody = $('#mdb-modal-body');
  function closeModal() { modal.hidden = true; }
  if (modal) {
    modal.addEventListener('click', function (e) { if (e.target === modal || e.target.hasAttribute('data-close')) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeModal(); closeLoc(); } });
  }

  // Fundort-/Methoden-Labels (system-neutrale Spieldaten → lokalisierte Chips).
  var TYPE_LBL = LANG === 'de'
    ? { moon: 'Mond', planet: 'Planet', belt: 'Gürtel', lagrange: 'Lagrange', cluster: 'Cluster', cave: 'Höhle', station: 'Station', event: 'Event', special: 'Spezial' }
    : { moon: 'moon', planet: 'planet', belt: 'belt', lagrange: 'Lagrange', cluster: 'cluster', cave: 'cave', station: 'station', event: 'event', special: 'special' };
  var MIN_LBL = LANG === 'de'
    ? { ship: 'Schiff', hand: 'Hand', roc: 'ROC', harvest: 'Ernte' }
    : { ship: 'ship', hand: 'hand', roc: 'ROC', harvest: 'harvest' };
  var SYS_ORD = ['Stanton', 'Pyro', 'Nyx'];

  var SPACE_TYPES = { belt: 1, cluster: 1, lagrange: 1 };
  function typeIcon(t) {
    if (SPACE_TYPES[t]) return '✦';
    return t === 'planet' ? '●' : t === 'moon' ? '◐' : t === 'cave' ? '▲' : t === 'event' ? '◆' : '•';
  }
  // Erz-Anteil-Farbe: reich (teal) → mittel (gold) → mager (grau).
  function abColor(a) {
    return a >= 50 ? 'var(--accent,#2FBFA4)' : a >= 25 ? 'var(--accent-2,#E0A526)' : 'var(--muted,#8fa3a0)';
  }
  // Fund-Chance-Farbe: seltener Fund (niedrige Chance) hervorgehoben (rot/gold),
  // häufig (hohe Chance) gedämpft.
  function chColor(c) {
    return c <= 5 ? '#e0564b' : c <= 15 ? 'var(--accent-2,#E0A526)' : c <= 40 ? 'var(--accent,#2FBFA4)' : 'var(--muted,#8fa3a0)';
  }

  // Fundorte eines Minerals: nach System gruppiert, INNERHALB nach Erz-Anteil
  // absteigend (reichste Spots oben), je Fundort eine Zeile mit Balken + %.
  function renderLoc(m) {
    var locs = m.locations || [];
    if (!locs.length) return '';
    var bySys = {};
    locs.forEach(function (l) { (bySys[l.system] = bySys[l.system] || []).push(l); });
    var names = Object.keys(bySys).sort(function (a, b) {
      var ia = SYS_ORD.indexOf(a); if (ia < 0) ia = 99;
      var ib = SYS_ORD.indexOf(b); if (ib < 0) ib = 99;
      return ia - ib || a.localeCompare(b);
    });
    var html = '<div class="mm__loc">';
    names.forEach(function (sn) {
      var arr = bySys[sn].slice().sort(function (a, b) {
        return (b.chance || 0) - (a.chance || 0) || (b.abundance || 0) - (a.abundance || 0) || String(a.location).localeCompare(String(b.location));
      });
      html += '<div class="mm__locsys"><div class="mm__locsys-hd"><span>' + esc(sn) + '</span>'
        + '<span class="mm__locn">' + arr.length + ' ' + esc(T.locations || '') + '</span></div>';
      arr.forEach(function (l) {
        var ch = l.chance != null ? l.chance : 0;
        var ab = l.abundance != null ? l.abundance : 0;
        var space = !!SPACE_TYPES[l.type];
        var meta = TYPE_LBL[l.type] || l.type || '';
        if (l.mining) meta += ' · ' + (MIN_LBL[l.mining] || l.mining);
        if (l.points && l.points.length) meta += ' · 📍 ' + l.points.join(', ');
        // Hauptkennzahl = Fund-Chance (Balken + %), Nebenkennzahl = Erz-Anteil (Badge).
        html += '<div class="mm__locrow">'
          + '<span class="mm__lt' + (space ? ' mm__lt--space' : '') + '">' + typeIcon(l.type) + '</span>'
          + '<span class="mm__ln">' + esc(l.location) + '<em>' + esc(meta) + '</em></span>'
          + '<span class="mm__bar"><i style="width:' + ch + '%;background:' + chColor(ch) + '"></i></span>'
          + '<b class="mm__pct" style="color:' + chColor(ch) + '" title="' + esc(T.chanceHint) + '">' + ch + '%</b>'
          + (l.abundance != null ? '<span class="mm__ch" title="' + esc(T.abundHint) + '">' + esc(T.abundance) + ' ' + ab + '%</span>' : '')
          + '</div>';
      });
      html += '</div>';
    });
    return html + '</div>';
  }

  function openMineral(idx) {
    loadDB().then(function () {
      var m = DB.minerals[idx];
      if (!m) return;
      var methLabel = T[m.method === 'hand' ? 'methHand' : m.method === 'roc' ? 'methRoc' : m.method === 'harvest' ? 'methHarvest' : 'methShip'];
      var kindCls = (m.method === 'hand' || m.method === 'roc') ? 'hand' : '';
      var html = '';
      html += '<div class="mm__kind ' + kindCls + '">' + esc(m.kind || '') + ' · ' + esc(methLabel) + '</div>';
      html += '<h2 class="mm__name">' + esc(m.name) + '</h2>';
      html += '<div class="mm__meta">';
      if (m.rarity) html += '<span class="mm__rar mm__rar--' + esc(m.rarity) + '">' + esc(T['r' + m.rarity.charAt(0).toUpperCase() + m.rarity.slice(1)] || m.rarity) + '</span>';
      var topAb = (m.locations || []).reduce(function (x, l) { return Math.max(x, l.abundance || 0); }, 0);
      if (topAb) html += '<span>' + esc(T.abundance) + ' <b>' + topAb + '%</b> ' + esc(T.ofRock) + '</span>';
      if (m.weight_scu) html += '<span>' + esc(T.scu) + ': <b>' + m.weight_scu + '</b></span>';
      html += '<span>' + (m.needs_refine ? '⚗ ' + esc(T.needsRefine) : '◆ ' + esc(T.noRefine)) + '</span>';
      if (m.systems && m.systems.length) html += '<span>' + esc(T.systems) + ': <b>' + esc(m.systems.join(', ')) + '</b></span>';
      html += '</div>';

      // Fundorte: nach System gruppiert, je Fundort ein Chip mit Typ · Methode · Abundance.
      html += '<div class="mm__h">' + esc(T.locations) + '</div>';
      var locHtml = renderLoc(m);
      if (locHtml) {
        html += locHtml;
        html += '<p class="mm__note">' + esc(T.locNote) + '</p>';
      } else {
        html += '<p class="mm__note">' + esc(T.noLoc) + '</p>';
      }

      modalBody.innerHTML = html;
      modal.hidden = false;
      modalBody.scrollTop = 0;
    });
  }

  cards.forEach(function (c) {
    c.addEventListener('click', function () { openMineral(+c.getAttribute('data-i')); });
  });

  // ---- Reverse-Lookup Drawer ----
  var locDrawer = $('#mdb-loc');
  var locBody = $('#mdb-loc-body');
  var locTitle = $('#mdb-loc-title');
  function closeLoc() { if (locDrawer) { locDrawer.classList.remove('is-open'); locDrawer.setAttribute('aria-hidden', 'true'); } }
  var locOpen = $('#mdb-loc-open');
  if (locOpen) locOpen.addEventListener('click', function () {
    loadDB().then(function () {
      if (locTitle) locTitle.textContent = T.reverseTitle;
      buildReverse();
      locDrawer.classList.add('is-open');
      locDrawer.setAttribute('aria-hidden', 'false');
    });
  });
  $$('[data-loc-close]').forEach(function (b) { b.addEventListener('click', closeLoc); });

  function buildReverse() {
    var bodies = DB.bodies || [];
    var html = '<p class="rl__intro">' + esc(T.reverseIntro) + '</p>';
    html += '<input type="search" class="rl__search" id="rl-search" placeholder="' + esc(T.reverseSearch) + '" autocomplete="off">';
    var bySys = {};
    bodies.forEach(function (b) { (bySys[b.system] = bySys[b.system] || []).push(b); });
    Object.keys(bySys).sort(function (a, b) {
      var ia = SYS_ORD.indexOf(a); if (ia < 0) ia = 99; var ib = SYS_ORD.indexOf(b); if (ib < 0) ib = 99; return ia - ib || a.localeCompare(b);
    }).forEach(function (sn) {
      html += '<div class="rl__sys" data-sys="' + esc(sn) + '">' + esc(sn) + '</div>';
      bySys[sn].forEach(function (b) {
        var mins = b.minerals || [];
        var searchStr = (b.body + ' ' + mins.map(function (x) { return x.name; }).join(' ')).toLowerCase();
        html += '<div class="rl__body" data-body="' + esc(searchStr) + '">';
        html += '<div class="rl__bn">' + (b.space ? '✦ ' : '') + esc(b.body);
        if (b.best) html += '<span class="rl__best rl__best--' + esc(b.best.rarity || 'none') + '" title="' + esc(T.bestMatch) + '">★ ' + esc(b.best.name) + ' ~' + b.best.chance + '%</span>';
        html += '</div>';
        if (b.points && b.points.length) html += '<div class="rl__pts" title="' + esc(T.pointsHint) + '">📍 ' + b.points.map(function (p) { return esc(p); }).join(', ') + '</div>';
        html += '<div class="rl__mins">';
        // nach Fund-Chance absteigend (bereits so in den Daten sortiert)
        mins.forEach(function (m) {
          html += '<span class="rl__min rl__min--' + esc(m.rarity || 'none') + '" data-min="' + esc(m.name) + '" title="' + esc(T.chanceHint) + '">'
            + esc(m.name) + ' <em>' + m.chance + '%</em></span>';
        });
        html += '</div></div>';
      });
    });
    locBody.innerHTML = html;
    var rs = $('#rl-search');
    if (rs) rs.addEventListener('input', function () {
      var q = rs.value.trim().toLowerCase();
      $$('.rl__body', locBody).forEach(function (el) {
        el.hidden = q && el.getAttribute('data-body').indexOf(q) < 0;
      });
    });
    // Mineral-Klick im Drawer öffnet dessen Detail
    $$('.rl__min', locBody).forEach(function (el) {
      el.addEventListener('click', function () {
        var name = el.getAttribute('data-min');
        var idx = DB.minerals.findIndex(function (x) { return x.name === name; });
        if (idx >= 0) { closeLoc(); openMineral(idx); }
      });
    });
  }

  // Initial
  apply();
})();
