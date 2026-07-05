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
  var state = { q: '', sys: [], meth: [], kind: '', refine: false, gem: false, sort: 'price-desc' };

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
      var pa = +a.getAttribute('data-price'), pb = +b.getAttribute('data-price');
      return s === 'price-asc' ? pa - pb : pb - pa;
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

  function pips(n, cls) {
    var out = '<span class="pips ' + (cls || '') + '">';
    for (var i = 1; i <= 3; i++) out += '<i class="' + (i <= n ? 'on' : '') + '"></i>';
    return out + '</span>';
  }
  var YIELD_FACTOR = { high: 1.0, mid: 0.9, low: 0.8 };

  function methodByCode() {
    var map = {};
    (DB.methods || []).forEach(function (m) { map[m.code] = m; });
    return map;
  }

  function openMineral(idx) {
    loadDB().then(function () {
      var m = DB.minerals[idx];
      if (!m) return;
      var methLabel = m.method === 'hand' ? T.methHand : T.methShip;
      var kindCls = m.method === 'hand' ? 'hand' : '';
      var html = '';
      html += '<div class="mm__kind ' + kindCls + '">' + esc(m.kind || '') + ' · ' + esc(methLabel) + '</div>';
      html += '<h2 class="mm__name">' + esc(m.name) + '</h2>';
      html += '<div class="mm__meta">';
      if (m.weight_scu) html += '<span>' + esc(T.scu) + ': <b>' + m.weight_scu + '</b></span>';
      html += '<span>' + (m.needs_refine ? '⚗ ' + esc(T.needsRefine) : '◆ ' + esc(T.noRefine)) + '</span>';
      if (m.systems && m.systems.length) html += '<span>' + esc(T.systems) + ': <b>' + esc(m.systems.join(', ')) + '</b></span>';
      html += '</div>';

      // Fundorte
      html += '<div class="mm__h">' + esc(T.locations) + '</div>';
      var locKeys = Object.keys(m.locations || {});
      if (locKeys.length) {
        html += '<div class="mm__loc">';
        locKeys.forEach(function (sn) {
          html += '<div class="mm__locsys"><span class="sn">' + esc(sn) + '</span>';
          m.locations[sn].forEach(function (b) { html += '<span class="bd">' + esc(b) + '</span>'; });
          html += '</div>';
        });
        html += '</div>';
        html += '<p class="mm__note">' + esc(CFG.lang === 'de' ? 'Vorkommen laut Spieldaten (UEX) — keine Spawn-Wahrscheinlichkeit.' : 'Occurrence per game data (UEX) — not spawn probability.') + '</p>';
      } else {
        html += '<p class="mm__note">' + esc(T.noLoc) + '</p>';
      }

      // Verkauf
      if (m.sell) {
        html += '<div class="mm__h">' + esc(T.sellHead) + '</div>';
        html += '<div class="mm__sellsum">';
        html += '<span>' + esc(T.best) + ': <b>' + NF.format(m.sell.best.price) + '</b> aUEC/SCU ' + esc(T.at) + ' ' + esc(m.sell.best.terminal) + ' (' + esc(m.sell.best.system) + ')</span>';
        html += '<span>' + esc(T.range) + ': <b>' + NF.format(m.sell.min) + '–' + NF.format(m.sell.max) + '</b></span>';
        html += '<span>' + esc(T.avg) + ': <b>' + NF.format(m.sell.avg) + '</b></span>';
        html += '</div>';
        html += '<ul class="mm__terms">';
        m.sell.terminals.forEach(function (t) {
          html += '<li><span class="tn">' + esc(t.terminal) + ' <span class="ts">' + esc(t.system) + (t.location ? ' · ' + esc(t.location) : '') + '</span></span><b>' + NF.format(t.price) + '</b></li>';
        });
        html += '</ul>';

        // Wert-Rechner — Refinery-Yield nur bei raffinierbaren Erzen anwenden;
        // Hand-Edelsteine werden ganz verkauft (kein Refining).
        var refinable = !!m.needs_refine;
        html += '<div class="mm__h">' + esc(T.calc) + '</div>';
        html += '<div class="mm__calc">';
        html += '<div class="mm__crow">';
        html += '<div class="mm__cfield"><label>' + esc(T.calcAmount) + '</label><input type="number" id="mm-amt" min="0" step="1" value="32"></div>';
        if (refinable) {
          html += '<div class="mm__cfield"><label>' + esc(T.calcMethod) + '</label><select id="mm-meth">';
          (DB.methods || []).forEach(function (mm) {
            html += '<option value="' + esc(mm.code) + '">' + esc(mm.name) + ' (' + esc(T.yield) + ' ' + esc(T[mm.yield_label] || mm.yield_label) + ')</option>';
          });
          html += '</select></div>';
        }
        html += '</div>';
        html += '<div class="mm__cout">';
        html += '<div class="mm__cbox"><span>' + esc(T.calcRaw) + '</span><b id="mm-raw">—</b></div>';
        if (refinable) html += '<div class="mm__cbox refined"><span>' + esc(T.calcRefined) + '</span><b id="mm-ref">—</b></div>';
        html += '</div>';
        html += '<p class="mm__note">' + esc(refinable ? T.calcNote : T.calcNoteGem) + '</p>';
        html += '</div>';
      }

      if (m.wiki) html += '<a class="mm__wiki" href="' + esc(m.wiki) + '" target="_blank" rel="noopener">' + esc(T.wikiLink) + ' ↗</a>';

      modalBody.innerHTML = html;
      modal.hidden = false;
      modalBody.scrollTop = 0;

      // Rechner verkabeln
      var amt = $('#mm-amt'), meth = $('#mm-meth'), rawEl = $('#mm-raw'), refEl = $('#mm-ref');
      if (amt && m.sell) {
        var mByCode = methodByCode();
        var saved = null;
        try { saved = JSON.parse(localStorage.getItem('mine.calc') || 'null'); } catch (e) {}
        if (saved) { if (saved.amt != null) amt.value = saved.amt; if (meth && saved.meth && mByCode[saved.meth]) meth.value = saved.meth; }
        var recalc = function () {
          var a = Math.max(0, +amt.value || 0);
          var raw = a * m.sell.best.price;
          rawEl.textContent = NF.format(Math.round(raw)) + ' aUEC';
          if (refEl && meth) {
            var mm = mByCode[meth.value];
            var f = mm ? (YIELD_FACTOR[mm.yield_label] || 0.9) : 1;
            refEl.textContent = NF.format(Math.round(raw * f)) + ' aUEC';
          }
          try { localStorage.setItem('mine.calc', JSON.stringify({ amt: amt.value, meth: meth ? meth.value : null })); } catch (e) {}
        };
        amt.addEventListener('input', recalc);
        if (meth) meth.addEventListener('change', recalc);
        recalc();
      }
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
    Object.keys(bySys).sort().forEach(function (sn) {
      html += '<div class="rl__sys" data-sys="' + esc(sn) + '">' + esc(sn) + '</div>';
      bySys[sn].forEach(function (b) {
        html += '<div class="rl__body" data-body="' + esc((b.body + ' ' + b.minerals.join(' ')).toLowerCase()) + '">';
        html += '<div class="rl__bn">' + esc(b.body) + '</div>';
        html += '<div class="rl__mins">';
        b.minerals.forEach(function (mn) { html += '<span class="rl__min" data-min="' + esc(mn) + '">' + esc(mn) + '</span>'; });
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
