/* crafting-app.js — funktionale Blueprint-DB (vanilla, kein Framework).
   Liest die SSR-Karten (#cdb-grid .cbp) für Filter/Sortierung und lädt
   crafting-db.json für Detail-Panel, Quality-Simulator und Fabricator-Planer.
   i18n-Strings + DB-URL kommen aus window.__CRAFT (pro Seite gesetzt). */
(function () {
  'use strict';
  var CFG = window.__CRAFT || {};
  var T = CFG.t || {};
  var LOC = CFG.lang === 'en' ? 'en-US' : 'de-DE';
  function tr(k, d) { return T[k] != null ? T[k] : d; }

  // ---- DOM ----
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var grid = $('#cdb-grid');
  if (!grid) return;
  var cards = $$('.cbp', grid);
  var countEl = $('#cdb-count');
  var emptyEl = $('#cdb-empty');

  // ---- Data (async; UI works without it, enriched once loaded) ----
  var DB = null;
  fetch(CFG.dbUrl).then(function (r) { return r.json(); }).then(function (j) {
    DB = j;
    renderPlanner();
  }).catch(function () {});

  // ---- Persistence ----
  function load(key, def) { try { return JSON.parse(localStorage.getItem(key)) || def; } catch (e) { return def; } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  var owned = load('craft.owned.v1', {});      // {index:true}
  var plan = load('craft.plan.v1', {});         // {index:qty}

  // ---- Helpers ----
  function fmtTime(sec) {
    sec = Number(sec) || 0;
    if (!sec) return '—';
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60);
    if (h) return h + 'h ' + (m ? m + 'm' : '');
    if (m) return m + 'm' + (s ? ' ' + s + 's' : '');
    return s + 's';
  }
  function fmtNum(n) { return (Math.round(Number(n) * 1000) / 1000).toLocaleString(LOC); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // =========================================================
  //  FILTER + SORT
  // =========================================================
  var state = {
    q: '', cats: {}, subs: {}, res: '', missionOnly: false, ownedOnly: false,
    sort: 'name', view: load('craft.view.v1', 'grid')
  };

  function matches(card) {
    var d = card.dataset;
    if (state.q) {
      var q = state.q;
      if (d.name.indexOf(q) < 0 && d.res.indexOf(q) < 0 && (d.leaf || '').indexOf(q) < 0) return false;
    }
    var catKeys = Object.keys(state.cats).filter(function (k) { return state.cats[k]; });
    if (catKeys.length && !state.cats[d.cat]) return false;
    var subKeys = Object.keys(state.subs).filter(function (k) { return state.subs[k]; });
    if (subKeys.length && !state.subs[d.cat + '||' + d.sub]) return false;
    if (state.res && d.res.indexOf(state.res) < 0) return false;
    if (state.missionOnly && d.mis !== '1') return false;
    if (state.ownedOnly && !owned[d.i]) return false;
    return true;
  }

  function apply() {
    var shown = 0;
    for (var i = 0; i < cards.length; i++) {
      var vis = matches(cards[i]);
      cards[i].hidden = !vis;
      if (vis) shown++;
    }
    if (countEl) countEl.textContent = shown.toLocaleString(LOC);
    if (emptyEl) emptyEl.hidden = shown !== 0;
  }

  function sortCards() {
    var key = state.sort;
    var arr = cards.slice();
    arr.sort(function (a, b) {
      var da = a.dataset, db = b.dataset;
      switch (key) {
        case 'time-desc': return (+db.time) - (+da.time);
        case 'time-asc': return (+da.time) - (+db.time);
        case 'ings-desc': return (+db.ings) - (+da.ings);
        case 'name-desc': return db.name < da.name ? -1 : db.name > da.name ? 1 : 0;
        default: return da.name < db.name ? -1 : da.name > db.name ? 1 : 0;
      }
    });
    var frag = document.createDocumentFragment();
    arr.forEach(function (c) { frag.appendChild(c); });
    grid.appendChild(frag);
  }

  // =========================================================
  //  CONTROLS WIRING
  // =========================================================
  var search = $('#cdb-search');
  if (search) search.addEventListener('input', function () { state.q = this.value.trim().toLowerCase(); apply(); });

  $$('.cdb-cat').forEach(function (cb) {
    cb.addEventListener('change', function () {
      state.cats[cb.value] = cb.checked;
      // Toggling a top category (un)checks its subs visually + logically.
      $$('.cdb-sub[data-top="' + cb.value + '"]').forEach(function (s) {
        s.checked = false; state.subs[s.value] = false;
      });
      apply();
    });
  });
  $$('.cdb-sub').forEach(function (cb) {
    cb.addEventListener('change', function () { state.subs[cb.value] = cb.checked; apply(); });
  });

  var resSel = $('#cdb-res');
  if (resSel) resSel.addEventListener('change', function () { state.res = this.value.toLowerCase(); apply(); });
  var misTog = $('#cdb-mission');
  if (misTog) misTog.addEventListener('change', function () { state.missionOnly = this.checked; apply(); });
  var ownTog = $('#cdb-owned');
  if (ownTog) ownTog.addEventListener('change', function () { state.ownedOnly = this.checked; apply(); });

  var sortSel = $('#cdb-sort');
  if (sortSel) sortSel.addEventListener('change', function () { state.sort = this.value; sortCards(); });

  function setView(v) {
    state.view = v; save('craft.view.v1', v);
    grid.classList.toggle('is-list', v === 'list');
    $$('.cdb-view').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.view === v ? 'true' : 'false'); });
  }
  $$('.cdb-view').forEach(function (b) { b.addEventListener('click', function () { setView(b.dataset.view); }); });
  setView(state.view);

  var resetBtn = $('#cdb-reset');
  if (resetBtn) resetBtn.addEventListener('click', function () {
    state.q = ''; state.cats = {}; state.subs = {}; state.res = ''; state.missionOnly = false; state.ownedOnly = false;
    if (search) search.value = '';
    if (resSel) resSel.value = '';
    if (misTog) misTog.checked = false;
    if (ownTog) ownTog.checked = false;
    $$('.cdb-cat,.cdb-sub').forEach(function (c) { c.checked = false; });
    apply();
  });

  // Mobile off-canvas filter panel
  var sidebar = $('#cdb-sidebar');
  var filtToggle = $('#cdb-filter-toggle');
  if (filtToggle && sidebar) {
    filtToggle.addEventListener('click', function () {
      var open = sidebar.classList.toggle('is-open');
      filtToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    var closeF = $('#cdb-filter-close');
    if (closeF) closeF.addEventListener('click', function () { sidebar.classList.remove('is-open'); filtToggle.setAttribute('aria-expanded', 'false'); });
  }

  // =========================================================
  //  OWNED + ADD-TO-PLAN (delegated on grid)
  // =========================================================
  function refreshCardState(card) {
    var i = card.dataset.i;
    card.classList.toggle('is-owned', !!owned[i]);
    var ob = $('.cbp__own', card); if (ob) ob.setAttribute('aria-pressed', owned[i] ? 'true' : 'false');
    var pb = $('.cbp__add', card); if (pb) pb.classList.toggle('in-plan', !!plan[i]);
  }
  grid.addEventListener('click', function (e) {
    var ownBtn = e.target.closest('.cbp__own');
    var addBtn = e.target.closest('.cbp__add');
    var card = e.target.closest('.cbp');
    if (!card) return;
    var i = card.dataset.i;
    if (ownBtn) { e.stopPropagation(); if (owned[i]) delete owned[i]; else owned[i] = true; save('craft.owned.v1', owned); refreshCardState(card); if (state.ownedOnly) apply(); return; }
    if (addBtn) { e.stopPropagation(); plan[i] = (plan[i] || 0) + 1; save('craft.plan.v1', plan); refreshCardState(card); renderPlanner(); flashPlan(); return; }
    openModal(+i);
  });
  cards.forEach(refreshCardState);

  // =========================================================
  //  DETAIL MODAL + QUALITY SIMULATOR
  // =========================================================
  var modal = $('#cdb-modal');
  var modalBody = $('#cdb-modal-body');
  function closeModal() { if (modal) { modal.hidden = true; document.body.style.overflow = ''; } }
  if (modal) {
    $$('[data-close]', modal).forEach(function (b) { b.addEventListener('click', closeModal); });
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
  }

  function statLabelize(s) { return s; }

  function openModal(i) {
    if (!DB || !DB.blueprints || !DB.blueprints[i]) { return; }
    var b = DB.blueprints[i];
    var parts = (b.category || '').split(' / ');
    var html = '';
    html += '<div class="cbm__cat">' + esc(b.category || '') + '</div>';
    html += '<h2 class="cbm__name">' + esc(b.name) + '</h2>';
    html += '<div class="cbm__meta">';
    html += '<span>' + tr('craftTime', 'Craft-Zeit') + ': <b>' + fmtTime(b.craft_time_seconds) + '</b></span>';
    if (b.tiers != null) html += '<span>' + tr('tier', 'Tier') + ': <b>' + b.tiers + '</b></span>';
    html += '<button class="cbm__plan" data-plan="' + i + '">＋ ' + tr('addPlan', 'Zum Planer') + '</button>';
    html += '</div>';

    // Ingredients + quality sliders
    if (b.ingredients && b.ingredients.length) {
      html += '<h3 class="cbm__h">' + tr('ingredients', 'Zutaten') + '</h3>';
      html += '<div class="cbm__ings">';
      b.ingredients.forEach(function (ing, gi) {
        html += '<div class="cbm__ing">';
        html += '<div class="cbm__slot">' + esc(ing.slot || '') + '</div>';
        (ing.options || []).forEach(function (o) {
          html += '<div class="cbm__opt"><span class="on">' + esc(o.name) + '</span>' +
            '<span class="oq">' + fmtNum((o.quantity_scu || 0) * 100) + ' cSCU</span>' +
            (o.min_quality != null ? '<span class="omq">' + tr('minQ', 'min. Q') + ' ' + o.min_quality + '</span>' : '') +
            '</div>';
        });
        if (ing.quality_effects && ing.quality_effects.length) {
          html += '<div class="cbm__sim">' +
            '<label>' + tr('quality', 'Qualität') + ' <output data-out="' + gi + '">500</output></label>' +
            '<input type="range" class="cbm__slider" data-ing="' + gi + '" min="0" max="1000" step="10" value="500">' +
            '</div>';
        }
        html += '</div>';
      });
      html += '</div>';
      // Simulated output stats
      html += '<h3 class="cbm__h">' + tr('simOut', 'Simulierte Ausgabe-Werte') + '</h3>';
      html += '<div class="cbm__out" id="cbm-out"></div>';
      html += '<p class="cbm__note">' + tr('simNote', 'Modifikatoren live aus den quality_effects der Zutaten (Qualität 0–1000). × = multiplikativ.') + '</p>';
    }

    // item_stats
    if (b.item_stats && Object.keys(b.item_stats).length) {
      html += '<h3 class="cbm__h">' + tr('itemStats', 'Item-Werte') + '</h3>';
      html += '<div class="cbm__stats">' + renderStats(b.item_stats) + '</div>';
    }

    // missions
    if (b.missions && b.missions.length) {
      html += '<h3 class="cbm__h">' + tr('missions', 'Missionen (Bezugsquelle)') + ' <span class="cbm__c">' + b.missions.length + '</span></h3>';
      html += '<ul class="cbm__mis">';
      b.missions.forEach(function (m) {
        var dc = m.drop_chance != null ? Math.round(m.drop_chance * 100) + '%' : '';
        html += '<li><span>' + esc(m.name) + '</span>' + (dc ? '<b>' + dc + '</b>' : '') + '</li>';
      });
      html += '</ul>';
    } else {
      html += '<p class="cbm__note">' + tr('noMission', 'Keine Missions-Quelle in den Daten — evtl. über andere Wege (Shop/Reputation) erhältlich.') + '</p>';
    }

    modalBody.innerHTML = html;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';

    // wire sliders
    var sliders = $$('.cbm__slider', modalBody);
    function recompute() {
      var perStat = {}; // stat -> {mul, add}
      sliders.forEach(function (sl) {
        var gi = +sl.dataset.ing, q = +sl.value;
        var out = $('[data-out="' + gi + '"]', modalBody); if (out) out.textContent = q;
        var ing = b.ingredients[gi];
        (ing.quality_effects || []).forEach(function (qe) {
          var span = (qe.quality_max - qe.quality_min) || 1;
          var t = clamp((q - qe.quality_min) / span, 0, 1);
          var mod = qe.modifier_at_min + (qe.modifier_at_max - qe.modifier_at_min) * t;
          var e = perStat[qe.stat] || (perStat[qe.stat] = { mul: 1, add: 0, hasMul: false, hasAdd: false });
          if (qe.multiplicative) { e.mul *= mod; e.hasMul = true; } else { e.add += mod; e.hasAdd = true; }
        });
      });
      var keys = Object.keys(perStat);
      var oc = $('#cbm-out', modalBody);
      if (!oc) return;
      if (!keys.length) { oc.innerHTML = '<span class="cbm__muted">—</span>'; return; }
      oc.innerHTML = keys.map(function (k) {
        var e = perStat[k], val = '';
        if (e.hasMul) { var pct = Math.round((e.mul - 1) * 1000) / 10; val += '×' + (Math.round(e.mul * 1000) / 1000) + ' <em>(' + (pct >= 0 ? '+' : '') + pct + '%)</em>'; }
        if (e.hasAdd) { val += (val ? ' ' : '') + (e.add >= 0 ? '+' : '') + (Math.round(e.add * 1000) / 1000); }
        return '<div class="cbm__ostat"><span>' + esc(statLabelize(k)) + '</span><b>' + val + '</b></div>';
      }).join('');
    }
    sliders.forEach(function (sl) { sl.addEventListener('input', recompute); });
    recompute();

    var pb = $('[data-plan]', modalBody);
    if (pb) pb.addEventListener('click', function () { plan[i] = (plan[i] || 0) + 1; save('craft.plan.v1', plan); renderPlanner(); flashPlan(); pb.textContent = '✓ ' + tr('added', 'hinzugefügt'); });
  }

  function renderStats(st) {
    var out = [];
    Object.keys(st).forEach(function (k) {
      var v = st[k];
      if (v == null) return;
      if (Array.isArray(v)) {
        if (k === 'fire_modes') {
          v.forEach(function (fm) {
            out.push(row(tr('fireMode', 'Feuermodus'), fm.name + (fm.fire_rate ? ' · ' + fm.fire_rate + ' rpm' : '')));
          });
        }
        return;
      }
      if (typeof v === 'object') return;
      out.push(row(k, typeof v === 'number' ? fmtNum(v) : String(v)));
    });
    return out.join('');
    function row(k, v) { return '<div class="cbm__st"><span>' + esc(prettyKey(k)) + '</span><b>' + esc(v) + '</b></div>'; }
  }
  function prettyKey(k) { return String(k).replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }

  // =========================================================
  //  FABRICATOR PLANNER
  // =========================================================
  var drawer = $('#cdb-planner');
  var plannerBtn = $('#cdb-planner-open');
  var plannerBadge = $('#cdb-planner-badge');
  if (plannerBtn && drawer) {
    plannerBtn.addEventListener('click', function () { drawer.classList.add('is-open'); drawer.setAttribute('aria-hidden', 'false'); });
    $$('[data-planner-close]', drawer).forEach(function (b) { b.addEventListener('click', function () { drawer.classList.remove('is-open'); drawer.setAttribute('aria-hidden', 'true'); }); });
  }
  function flashPlan() { if (plannerBtn) { plannerBtn.classList.remove('flash'); void plannerBtn.offsetWidth; plannerBtn.classList.add('flash'); } }

  function renderPlanner() {
    var idxs = Object.keys(plan).filter(function (k) { return plan[k] > 0; });
    var totalItems = idxs.reduce(function (a, k) { return a + plan[k]; }, 0);
    if (plannerBadge) { plannerBadge.textContent = totalItems; plannerBadge.hidden = totalItems === 0; }
    var listEl = $('#cdb-plan-list');
    var shopEl = $('#cdb-plan-shop');
    var timeEl = $('#cdb-plan-time');
    if (!listEl) return;
    if (!DB || !idxs.length) {
      listEl.innerHTML = '<li class="cdb-plan-empty">' + tr('planEmpty', 'Noch keine Blueprints im Planer. „＋" auf einer Karte fügt hinzu.') + '</li>';
      if (shopEl) shopEl.innerHTML = '';
      if (timeEl) timeEl.textContent = '—';
      return;
    }
    var totalTime = 0;
    var shop = {}; // resource -> total cSCU
    listEl.innerHTML = idxs.map(function (k) {
      var b = DB.blueprints[k]; if (!b) return '';
      var qty = plan[k];
      totalTime += (b.craft_time_seconds || 0) * qty;
      (b.ingredients || []).forEach(function (ing) {
        var o = (ing.options || [])[0];
        if (o) shop[o.name] = (shop[o.name] || 0) + (o.quantity_scu || 0) * qty;
      });
      return '<li class="cdb-plan-item"><div class="pi__n">' + esc(b.name) + '</div>' +
        '<div class="pi__ctrl"><button data-dec="' + k + '">–</button><span>' + qty + '</span><button data-inc="' + k + '">+</button>' +
        '<button data-rm="' + k + '" class="pi__rm" aria-label="remove">✕</button></div></li>';
    }).join('');
    if (shopEl) {
      var names = Object.keys(shop).sort();
      shopEl.innerHTML = names.length ? names.map(function (n) {
        return '<div class="ps__row"><span>' + esc(n) + '</span><b>' + fmtNum(shop[n] * 100) + ' cSCU</b></div>';
      }).join('') : '';
    }
    if (timeEl) timeEl.textContent = fmtTime(totalTime);
    // wire qty buttons
    $$('[data-inc]', listEl).forEach(function (btn) { btn.addEventListener('click', function () { var k = btn.dataset.inc; plan[k]++; save('craft.plan.v1', plan); renderPlanner(); syncCards(); }); });
    $$('[data-dec]', listEl).forEach(function (btn) { btn.addEventListener('click', function () { var k = btn.dataset.dec; plan[k]--; if (plan[k] <= 0) delete plan[k]; save('craft.plan.v1', plan); renderPlanner(); syncCards(); }); });
    $$('[data-rm]', listEl).forEach(function (btn) { btn.addEventListener('click', function () { delete plan[btn.dataset.rm]; save('craft.plan.v1', plan); renderPlanner(); syncCards(); }); });
  }
  function syncCards() { cards.forEach(refreshCardState); }
  var clearBtn = $('#cdb-plan-clear');
  if (clearBtn) clearBtn.addEventListener('click', function () { plan = {}; save('craft.plan.v1', plan); renderPlanner(); syncCards(); });

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // initial paint
  apply();
})();
