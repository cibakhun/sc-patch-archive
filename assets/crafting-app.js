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
  var resSearch = $('#cdb-res-search');

  // ---- Data (async; UI works without it, enriched once loaded) ----
  var DB = null;
  var MISSIONS = null; // id -> {id,name,pool:[{i,dc}]}
  var pendingBpName = null; // vorgemerkter Blueprint, falls DB beim Sprung noch lädt
  fetch(CFG.dbUrl).then(function (r) { return r.json(); }).then(function (j) {
    DB = j;
    buildMissionIndex();
    renderPlanner();
    // Deep-Link aus dem Item Finder: ?bp=<Blueprint-Name> öffnet direkt das Modal.
    try {
      var wantBp = new URLSearchParams(location.search).get('bp');
      if (wantBp) openModalByName(wantBp);
    } catch (e) {}
    if (pendingBpName) { openModalByName(pendingBpName); pendingBpName = null; }
  }).catch(function () {});

  // Blueprint per Name öffnen — Deep-Link + Sprung aus dem Zerlegungs-Rechner.
  function openModalByName(name) {
    if (!DB || !DB.blueprints) { pendingBpName = name; return; }
    var tgt = String(name).trim().toLowerCase();
    for (var bi = 0; bi < DB.blueprints.length; bi++) {
      if ((DB.blueprints[bi].name || '').toLowerCase() === tgt) { openModal(bi); return; }
    }
  }

  // Umkehrung Blueprint -> Mission: pro Mission der Pool aller Blueprints.
  function buildMissionIndex() {
    MISSIONS = {};
    DB.blueprints.forEach(function (b, i) {
      (b.missions || []).forEach(function (m) {
        var key = m.id != null ? 'id' + m.id : 'nm' + m.name;
        var e = MISSIONS[key] || (MISSIONS[key] = { id: m.id, name: m.name, pool: [] });
        e.pool.push({ i: i, dc: m.drop_chance });
      });
    });
    // Pools nach Drop-Chance ↓ dann Name ↑ sortieren.
    Object.keys(MISSIONS).forEach(function (k) {
      MISSIONS[k].pool.sort(function (a, b) {
        var d = (b.dc || 0) - (a.dc || 0);
        return d !== 0 ? d : (DB.blueprints[a.i].name < DB.blueprints[b.i].name ? -1 : 1);
      });
    });
  }
  function missionKey(m) { return m.id != null ? 'id' + m.id : 'nm' + m.name; }

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
    q: '', cats: {}, subs: {}, res: {}, missionOnly: false, ownedOnly: false,
    sort: 'name', view: load('craft.view.v1', 'grid')
  };

  function matches(card) {
    var d = card.dataset;
    if (state.q) {
      var q = state.q;
      if (d.name.indexOf(q) < 0 && d.res.indexOf(q) < 0 && (d.leaf || '').indexOf(q) < 0 &&
        (d.sub || '').toLowerCase().indexOf(q) < 0 && (d.cat || '').toLowerCase().indexOf(q) < 0) return false;
    }
    var catKeys = Object.keys(state.cats).filter(function (k) { return state.cats[k]; });
    if (catKeys.length && !state.cats[d.cat]) return false;
    var subKeys = Object.keys(state.subs).filter(function (k) { return state.subs[k]; });
    if (subKeys.length && !state.subs[d.cat + '||' + d.sub]) return false;
    var resKeys = Object.keys(state.res).filter(function (k) { return state.res[k]; });
    if (resKeys.length) {
      var cardRes = d.res.split('|');
      var hasAll = resKeys.every(function (r) {
        return cardRes.indexOf(r) >= 0;
      });
      if (!hasAll) return false;
    }
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

  function sortResourcesList() {
    var resList = $('.cdb-res-list');
    if (!resList) return;
    var items = $$('.cdb-check', resList);
    items.sort(function (a, b) {
      var cbA = a.querySelector('input');
      var cbB = b.querySelector('input');
      if (cbA.checked && !cbB.checked) return -1;
      if (!cbA.checked && cbB.checked) return 1;
      var textA = a.querySelector('span').textContent.toLowerCase();
      var textB = b.querySelector('span').textContent.toLowerCase();
      return textA < textB ? -1 : textA > textB ? 1 : 0;
    });
    var frag = document.createDocumentFragment();
    items.forEach(function (item) { frag.appendChild(item); });
    resList.appendChild(frag);
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

  $$('.cdb-res-cb').forEach(function (cb) {
    cb.addEventListener('change', function () {
      state.res[cb.value] = cb.checked;
      sortResourcesList();
      apply();
    });
  });
  if (resSearch) {
    resSearch.addEventListener('input', function () {
      var q = this.value.trim().toLowerCase();
      $$('.cdb-res-cb').forEach(function (cb) {
        var label = cb.closest('.cdb-check');
        if (!label) return;
        var name = label.querySelector('span').textContent.toLowerCase();
        if (q && name.indexOf(q) < 0) {
          label.style.display = 'none';
        } else {
          label.style.display = '';
        }
      });
    });
  }
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
    state.q = ''; state.cats = {}; state.subs = {}; state.res = {}; state.missionOnly = false; state.ownedOnly = false;
    if (search) search.value = '';
    if (resSearch) {
      resSearch.value = '';
      $$('.cdb-res-cb').forEach(function (cb) {
        var label = cb.closest('.cdb-check');
        if (label) label.style.display = '';
      });
    }
    if (misTog) misTog.checked = false;
    if (ownTog) ownTog.checked = false;
    $$('.cdb-cat,.cdb-sub,.cdb-res-cb').forEach(function (c) { c.checked = false; });
    sortResourcesList();
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
  //  DETAIL MODAL + QUALITY SIMULATOR + MISSION-POOL (State-Machine)
  // =========================================================
  var modal = $('#cdb-modal');
  var modalBody = $('#cdb-modal-body');
  var modalStack = [];      // history of entries (for back navigation)
  var currentEntry = null;  // {t:'bp',i} | {t:'pool',key}
  function closeModal() { if (modal) { modal.hidden = true; document.body.style.overflow = ''; modalStack = []; currentEntry = null; } }
  function showModal() { modal.hidden = false; document.body.style.overflow = 'hidden'; if (modalBody) modalBody.scrollTop = 0; }
  if (modal) {
    $$('[data-close]', modal).forEach(function (b) { b.addEventListener('click', closeModal); });
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) closeModal(); });
  }

  // Navigation
  function renderEntry(entry) {
    if (entry.t === 'bp') renderBlueprint(entry.i);
    else renderPool(entry.key);
    showModal();
    injectBack();
  }
  function go(entry) { if (currentEntry) modalStack.push(currentEntry); currentEntry = entry; renderEntry(entry); }
  function back() { var prev = modalStack.pop(); if (prev) { currentEntry = prev; renderEntry(prev); } }
  function injectBack() {
    if (modalStack.length && modalBody.firstChild) {
      var btn = document.createElement('button');
      btn.className = 'cbm__back'; btn.type = 'button';
      btn.innerHTML = '← ' + tr('back', 'Zurück');
      btn.addEventListener('click', back);
      modalBody.insertBefore(btn, modalBody.firstChild);
    }
  }
  // Entry point from the grid — fresh navigation.
  function openModal(i) { if (!DB || !DB.blueprints || !DB.blueprints[i]) return; modalStack = []; currentEntry = null; go({ t: 'bp', i: i }); }

  // -- Basiswert-Auflösung: manche Stats haben einen echten Basiswert in
  //    item_stats, die meisten nicht (dann Index-Basis 100 = Standard-Item). --
  function resolveBase(stat, st) {
    if (!st) return null;
    if (stat === 'Min Temp') return st.temperature_resistance ? st.temperature_resistance.min : null;
    if (stat === 'Max Temp') return st.temperature_resistance ? st.temperature_resistance.max : null;
    if (stat === 'Fire Rate') return st.fire_modes && st.fire_modes[0] ? st.fire_modes[0].fire_rate : null;
    return null;
  }
  function roundSmart(v) {
    var a = Math.abs(v);
    if (a >= 100) return Math.round(v);
    if (a >= 10) return Math.round(v * 10) / 10;
    return Math.round(v * 100) / 100;
  }

  function renderBlueprint(i) {
    var b = DB.blueprints[i];
    var html = '';
    html += '<div class="cbm__cat">' + esc(b.category || '') + '</div>';
    html += '<h2 class="cbm__name">' + esc(b.name) + '</h2>';
    html += '<div class="cbm__meta">';
    html += '<span>' + tr('craftTime', 'Craft-Zeit') + ': <b>' + fmtTime(b.craft_time_seconds) + '</b></span>';
    if (b.tiers != null) html += '<span>' + tr('tier', 'Tier') + ': <b>' + b.tiers + '</b></span>';
    html += '<button class="cbm__plan" data-plan="' + i + '">＋ ' + tr('addPlan', 'Zum Planer') + '</button>';
    html += '<a class="cbm__xlink" href="' + (CFG.lang === 'en' ? '/en' : '') + '/item-finder.html?item=' + encodeURIComponent(b.name) + '">' + tr('openInFinder', 'Im Item Finder öffnen') + ' →</a>';
    // Sprung zum Zerlegungs-Rechner — nur wenn ein gleichnamiges Item existiert.
    if (DISMANTLE_NAMES && DISMANTLE_NAMES[(b.name || '').toLowerCase()] != null) {
      html += '<button type="button" class="cbm__xlink" data-goto-dismantle="' + esc(b.name) + '">' + tr('openInDismantle', 'Im Zerlegungs-Rechner öffnen') + ' →</button>';
    }
    html += '</div>';

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
      html += '<h3 class="cbm__h">' + tr('simOut', 'Simulierte Ausgabe-Werte') + '</h3>';
      html += '<div class="cbm__out" id="cbm-out"></div>';
      html += '<p class="cbm__note" id="cbm-out-note"></p>';
    }

    if (b.item_stats && Object.keys(b.item_stats).length) {
      html += '<h3 class="cbm__h">' + tr('itemStats', 'Item-Werte') + '</h3>';
      html += '<div class="cbm__stats">' + renderStats(b.item_stats) + '</div>';
    }

    if (b.missions && b.missions.length) {
      html += '<h3 class="cbm__h">' + tr('missions', 'Missionen (Bezugsquelle)') + ' <span class="cbm__c">' + b.missions.length + '</span></h3>';
      html += '<p class="cbm__note cbm__hint">' + tr('missionHint', 'Mission anklicken → alle Blueprints, die sie droppen kann.') + '</p>';
      html += '<ul class="cbm__mis">';
      b.missions.forEach(function (m) {
        var dc = m.drop_chance != null ? Math.round(m.drop_chance * 100) + '%' : '';
        html += '<li><button type="button" class="cbm__mlink" data-mkey="' + esc(missionKey(m)) + '"><span>' + esc(m.name) + '</span></button>' + (dc ? '<b>' + dc + '</b>' : '') + '</li>';
      });
      html += '</ul>';
    } else {
      html += '<p class="cbm__note">' + tr('noMission', 'Keine Missions-Quelle in den Daten — evtl. über andere Wege (Shop/Reputation) erhältlich.') + '</p>';
    }

    modalBody.innerHTML = html;

    // Quality simulator — absolute values.
    var sliders = $$('.cbm__slider', modalBody);
    function recompute() {
      var perStat = {};
      sliders.forEach(function (sl) {
        var gi = +sl.dataset.ing, q = +sl.value;
        var out = $('[data-out="' + gi + '"]', modalBody); if (out) out.textContent = q;
        var ing = b.ingredients[gi];
        (ing.quality_effects || []).forEach(function (qe) {
          var span = (qe.quality_max - qe.quality_min) || 1;
          var t = clamp((q - qe.quality_min) / span, 0, 1);
          var mod = qe.modifier_at_min + (qe.modifier_at_max - qe.modifier_at_min) * t;
          var e = perStat[qe.stat];
          if (!e) { e = perStat[qe.stat] = { mul: 1, add: 0, hasMul: false, hasAdd: false, base: resolveBase(qe.stat, b.item_stats) }; }
          // Gleichartige %-Boni additiv stapeln (Bonus-Anteile summieren), nicht
          // kompoundieren: zwei 5% -> +10%, nicht +10,25%. e.mul bleibt der
          // kombinierte Faktor (1 + Summe der Anteile).
          if (qe.multiplicative) { e.mul += (mod - 1); e.hasMul = true; } else { e.add += mod; e.hasAdd = true; }
        });
      });
      var keys = Object.keys(perStat);
      var oc = $('#cbm-out', modalBody);
      var noteEl = $('#cbm-out-note', modalBody);
      if (!oc) return;
      if (!keys.length) { oc.innerHTML = '<span class="cbm__muted">—</span>'; return; }
      var anyIndexed = false;
      oc.innerHTML = keys.map(function (k) {
        var e = perStat[k];
        if (e.hasMul) {
          var indexed = e.base == null;
          var base = indexed ? 100 : e.base;
          if (indexed) anyIndexed = true;
          var result = base * e.mul;
          var pct = Math.round((e.mul - 1) * 1000) / 10;
          return '<div class="cbm__ostat"><span>' + esc(k) + (indexed ? '<i class="cbm__idx">†</i>' : '') + '</span>' +
            '<b><span class="cbm__b0">' + roundSmart(base) + '</span> → <span class="cbm__b1">' + roundSmart(result) + '</span> ' +
            '<em>(' + (pct >= 0 ? '+' : '') + pct + '%)</em></b></div>';
        }
        // additive (base unbekannt) → Delta
        var d = roundSmart(e.add);
        return '<div class="cbm__ostat"><span>' + esc(k) + '</span><b><span class="cbm__b1">' + (d >= 0 ? '+' : '') + d + '</span></b></div>';
      }).join('');
      if (noteEl) {
        noteEl.innerHTML = tr('simNote', 'Absolute Werte live aus den quality_effects (Qualität 0–1000): multiplikativ = Basis × Faktor, additiv = Basis + Wert.') +
          (anyIndexed ? ' <b>†</b> ' + tr('simIdxNote', 'kein absoluter Basiswert in den Daten — 100 = Standard-Item (Faktor 1,0).') : '');
      }
    }
    sliders.forEach(function (sl) { sl.addEventListener('input', recompute); });
    recompute();

    var pb = $('[data-plan]', modalBody);
    if (pb) pb.addEventListener('click', function () { plan[i] = (plan[i] || 0) + 1; save('craft.plan.v1', plan); syncCards(); renderPlanner(); flashPlan(); pb.textContent = '✓ ' + tr('added', 'hinzugefügt'); });

    var gd = $('[data-goto-dismantle]', modalBody);
    if (gd) gd.addEventListener('click', function () { gotoDismantle(gd.getAttribute('data-goto-dismantle')); });

    $$('.cbm__mlink', modalBody).forEach(function (btn) {
      btn.addEventListener('click', function () { go({ t: 'pool', key: btn.dataset.mkey }); });
    });
  }

  function renderPool(key) {
    var e = MISSIONS && MISSIONS[key];
    if (!e) { modalBody.innerHTML = '<p class="cbm__note">—</p>'; return; }
    var html = '';
    html += '<div class="cbm__cat">' + tr('missionPoolLabel', 'Missions-Pool') + '</div>';
    html += '<h2 class="cbm__name">' + esc(e.name) + '</h2>';
    html += '<p class="cbm__note cbm__hint">' + tr('poolIntro', 'Alle Blueprints, die diese Mission droppen kann — Blueprint anklicken für Details.') + ' <span class="cbm__c">' + e.pool.length + '</span></p>';
    html += '<ul class="cbm__pool">';
    e.pool.forEach(function (p) {
      var b = DB.blueprints[p.i];
      var dc = p.dc != null ? Math.round(p.dc * 100) + '%' : '';
      var cat = (b.category || '').split(' / ').slice(0, 2).join(' / ');
      html += '<li><button type="button" class="cbm__blink" data-bp="' + p.i + '">' +
        '<span class="pn">' + esc(b.name) + '</span><span class="pc">' + esc(cat) + '</span></button>' +
        (dc ? '<b>' + dc + '</b>' : '') + '</li>';
    });
    html += '</ul>';
    modalBody.innerHTML = html;
    $$('.cbm__blink', modalBody).forEach(function (btn) {
      btn.addEventListener('click', function () { go({ t: 'bp', i: +btn.dataset.bp }); });
    });
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
  function closeDrawer() { drawer.classList.remove('is-open'); drawer.setAttribute('aria-hidden', 'true'); }
  if (plannerBtn && drawer) {
    plannerBtn.addEventListener('click', function () { drawer.classList.add('is-open'); drawer.setAttribute('aria-hidden', 'false'); });
    $$('[data-planner-close]', drawer).forEach(function (b) { b.addEventListener('click', closeDrawer); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer(); });
    // Klick außerhalb des offenen Planers schließt ihn (nicht der Öffnen-Button selbst)
    document.addEventListener('click', function (e) {
      if (drawer.classList.contains('is-open') && !drawer.contains(e.target) && !plannerBtn.contains(e.target)) closeDrawer();
    });
  }
  // Slide-Transitions (Planer-Drawer / Mobil-Sidebar) erst nach dem ersten
  // gerenderten Frame scharfschalten — sonst animiert der Browser beim Laden
  // das initiale Wegschieben und der Planer „schließt" kurz sichtbar.
  requestAnimationFrame(function () { requestAnimationFrame(function () {
    document.documentElement.classList.add('cdb-ready');
  }); });

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

  // =========================================================
  //  STAR CITIZEN DISMANTLING CALCULATOR
  // =========================================================
  var materialsMap = {
    "titanium": { "id": "titanium", "name": "Titanium", "isRare": false },
    "gold": { "id": "gold", "name": "Gold", "isRare": false },
    "laranite": { "id": "laranite", "name": "Laranite", "isRare": false },
    "iron": { "id": "iron", "name": "Iron", "isRare": false },
    "copper": { "id": "copper", "name": "Copper", "isRare": false },
    "tungsten": { "id": "tungsten", "name": "Tungsten", "isRare": false },
    "silicon": { "id": "silicon", "name": "Silicon", "isRare": false },
    "agricium": { "id": "agricium", "name": "Agricium", "isRare": false },
    "torite": { "id": "torite", "name": "Torite", "isRare": false },
    "borase": { "id": "borase", "name": "Borase", "isRare": false },
    "riccite": { "id": "riccite", "name": "Riccite", "isRare": true },
    "savrilium": { "id": "savrilium", "name": "Savrilium", "isRare": true },
    "glacosite": { "id": "glacosite", "name": "Glacosite", "isRare": true },
    "beradom": { "id": "beradom", "name": "Beradom", "isRare": true },
    "aslarite": { "id": "aslarite", "name": "Aslarite", "isRare": true }
  };

  var ITEMS = [];
  var DISMANTLE_NAMES = null; // Item-Name (lowercase) -> Index in ITEMS

  var calcState = {
    res: {},
    q: '',
    targetQty: 1.0,
    yieldRate: 50
  };

  function sortCalcMatsList() {
    var list = $('.calc-mat-list');
    if (!list) return;
    var items = $$('.calc-check', list);
    items.sort(function (a, b) {
      var cbA = a.querySelector('input');
      var cbB = b.querySelector('input');
      if (cbA.checked && !cbB.checked) return -1;
      if (!cbA.checked && cbB.checked) return 1;
      var textA = a.querySelector('span').textContent.toLowerCase();
      var textB = b.querySelector('span').textContent.toLowerCase();
      return textA < textB ? -1 : textA > textB ? 1 : 0;
    });
    var frag = document.createDocumentFragment();
    items.forEach(function (item) { frag.appendChild(item); });
    list.appendChild(frag);
  }

  function calcApply() {
    var resultsEl = $('#calc-results');
    var countEl = $('#calc-results-count');
    if (!resultsEl) return;

    var q = calcState.q;
    var selectedMats = Object.keys(calcState.res).filter(function (k) { return calcState.res[k]; });
    if (selectedMats.length === 0 && !q) {
      resultsEl.innerHTML = '<div style="background:var(--bg,#16161a);border:1px dashed var(--line,rgba(255,94,26,.3));padding:2rem;text-align:center;color:var(--muted,#9ba2ae);border-radius:8px;">' + tr('calcSelectPrompt', 'Bitte wähle mindestens ein Material aus oder suche oben nach einem Item-Namen.') + '</div>';
      if (countEl) countEl.textContent = tr('calcFound', '{count} kompatible Items gefunden').replace('{count}', '0');
      return;
    }

    var targetQty_cSCU = calcState.targetQty * 100;
    var rate = calcState.yieldRate / 100;
    var list = [];

    // Kompatibel = Item liefert JEDES gewählte Material beim Zerlegen.
    // Seltene Materialien liefern nichts — ein gewähltes seltenes Material
    // macht daher jedes Item inkompatibel (Auswahl ist als „(selten)" markiert).
    // Reine Namenssuche (keine Materialien gewählt): Item mit Ausbeute für
    // 1 Exemplar anzeigen.
    ITEMS.forEach(function (item) {
      if (q && item.name.toLowerCase().indexOf(q) < 0) return;
      var maxQty = 0;
      var isComp = true;

      selectedMats.forEach(function (mid) {
        var matDef = materialsMap[mid] || { id: mid, name: mid, isRare: false };
        var recipeItem = item.recipe.find(function (r) { return r.materialId.toLowerCase() === mid; });

        if (!recipeItem || matDef.isRare) {
          isComp = false;
          return;
        }

        var yieldPerItem = recipeItem.quantity_cSCU * rate;
        if (yieldPerItem <= 0) {
          isComp = false;
          return;
        }

        var needed = Math.ceil(targetQty_cSCU / yieldPerItem);
        if (needed > maxQty) {
          maxQty = needed;
        }
      });

      if (!isComp) return;
      if (selectedMats.length === 0) maxQty = 1;

      // Beifang-Hinweis: seltene Materialien im REZEPT gehen beim Zerlegen verloren.
      var warnings = [];
      item.recipe.forEach(function (r) {
        var matDef = materialsMap[r.materialId.toLowerCase()];
        if (matDef && matDef.isRare) {
          warnings.push(tr('calcWarningRareBycatch', 'Dieses Item enthält {name}, dieser kann jedoch nicht durch Zerlegen gewonnen werden.').replace('{name}', matDef.name));
        }
      });

      list.push({
        item: item,
        qty: maxQty,
        cost: maxQty * item.purchasePrice_aUEC,
        warnings: warnings
      });
    });

    list.sort(function (a, b) { return a.cost - b.cost; });

    if (!list.length) {
      resultsEl.innerHTML = '<div style="background:var(--bg,#16161a);border:1px dashed var(--line,rgba(255,94,26,.3));padding:2rem;text-align:center;color:var(--muted,#9ba2ae);border-radius:8px;">' + tr('calcNoResults', 'Keine Items für diese Auswahl gefunden.') + '</div>';
      if (countEl) countEl.textContent = tr('calcFound', '{count} kompatible Items gefunden').replace('{count}', '0');
      return;
    }

    resultsEl.innerHTML = list.map(function (res) {
      var item = res.item;

      var yieldHtml = item.recipe.map(function (r) {
        var mid = r.materialId.toLowerCase();
        var matDef = materialsMap[mid] || { id: mid, name: r.materialId, isRare: false };
        var isTarget = calcState.res[mid];
        var itemYield = matDef.isRare ? 0 : r.quantity_cSCU * rate;
        var totalYield = (res.qty * itemYield) / 100;

        return '<span class="calc-card__yield-tag' + (isTarget ? ' target' : '') + '">' +
          esc(matDef.name) + ': ' + fmtNum(totalYield) + ' SCU' +
          '</span>';
      }).join(' ');

      var warningsHtml = res.warnings.map(function (w) {
        return '<div class="calc-card__warning">' + esc(w) + '</div>';
      }).join('');

      return '<div class="calc-card" data-name="' + esc(item.name.toLowerCase()) + '">' +
        '<div class="calc-card__left">' +
          '<h3 class="calc-card__title">' + esc(item.name) + '</h3>' +
          '<div class="calc-card__meta">' + tr('category', 'Kategorie') + ': <strong>' + esc(item.category) + '</strong> &nbsp;·&nbsp; ' + tr('calcLocation', 'Kaufort') + ': <strong>' + esc(item.purchaseLocation) + '</strong></div>' +
          '<div class="calc-card__yields">' + yieldHtml + '</div>' +
          warningsHtml +
        '</div>' +
        '<div class="calc-card__right">' +
          '<div class="calc-card__cost">' + fmtNum(res.cost) + ' aUEC</div>' +
          '<div class="calc-card__cost-unit">' + tr('calcCostUnit', 'Gesamtkosten') + '</div>' +
          '<div class="calc-card__qty">' + tr('calcQtyBuy', '{qty}x kaufen').replace('{qty}', res.qty) + '</div>' +
          '<button type="button" class="calc-card__bp" data-bp-name="' + esc(item.name) + '">' + tr('openBlueprint', 'Blueprint öffnen') + ' →</button>' +
        '</div>' +
      '</div>';
    }).join('');

    if (countEl) {
      countEl.textContent = tr('calcFound', '{count} kompatible Items gefunden').replace('{count}', list.length);
    }
  }

  function initCalc() {
    var dismantleUrl = (window.__CRAFT && window.__CRAFT.dismantleUrl) || '/assets/dismantling-items.json';
    fetch(dismantleUrl)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        ITEMS = data;
        setupCalc();
      })
      .catch(function (err) {
        console.error('Failed to load dismantling items:', err);
      });
  }

  function setupCalc() {
    DISMANTLE_NAMES = {};
    ITEMS.forEach(function (it, i) { DISMANTLE_NAMES[(it.name || '').toLowerCase()] = i; });

    var mats = {};
    ITEMS.forEach(function (item) {
      item.recipe.forEach(function (r) {
        var mid = r.materialId.toLowerCase();
        if (!mats[mid]) {
          var details = materialsMap[mid] || { id: mid, name: r.materialId, isRare: false };
          mats[mid] = details;
        }
      });
    });
    
    var sortedMats = Object.keys(mats).map(function (k) { return mats[k]; });
    sortedMats.sort(function (a, b) {
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });

    var calcList = $('.calc-mat-list');
    if (calcList) {
      calcList.innerHTML = sortedMats.map(function (m) {
        return '<label class="cdb-check calc-check">' +
          '<input type="checkbox" class="calc-mat-cb" value="' + esc(m.id) + '" />' +
          '<span>' + esc(m.name) + (m.isRare ? ' <em style="color:#ff5b5b; font-size:0.75rem; font-style:normal;">' + tr('calcRareLabel', '(selten)') + '</em>' : '') + '</span>' +
          '</label>';
      }).join('');
    }
    
    var matSearch = $('#calc-mat-search');
    if (matSearch) {
      matSearch.addEventListener('input', function () {
        var query = this.value.trim().toLowerCase();
        $$('.calc-mat-cb').forEach(function (cb) {
          var label = cb.closest('.calc-check');
          if (!label) return;
          var name = label.querySelector('span').textContent.toLowerCase();
          if (query && name.indexOf(query) < 0) {
            label.style.display = 'none';
          } else {
            label.style.display = '';
          }
        });
      });
    }

    $$('.calc-mat-cb').forEach(function (cb) {
      cb.addEventListener('change', function () {
        calcState.res[cb.value] = cb.checked;
        sortCalcMatsList();
        calcApply();
      });
    });

    // Item-Namenssuche über den Ergebnissen.
    var itemSearch = $('#calc-item-search');
    if (itemSearch) {
      itemSearch.addEventListener('input', function () {
        calcState.q = this.value.trim().toLowerCase();
        calcApply();
      });
    }

    // Sprung Zerlegungs-Karte -> Blueprint-Modal (delegiert; Karten werden
    // bei jedem calcApply neu gerendert).
    var resultsHost = $('#calc-results');
    if (resultsHost) {
      resultsHost.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-bp-name]');
        if (!btn) return;
        switchTab('db');
        openModalByName(btn.getAttribute('data-bp-name'));
      });
    }

    var targetInput = $('#calc-target-qty');
    if (targetInput) {
      targetInput.addEventListener('input', function () {
        calcState.targetQty = Math.max(0.01, parseFloat(this.value) || 0.01);
        calcApply();
      });
    }

    var yieldSlider = $('#calc-yield-rate');
    var yieldVal = $('#calc-yield-val');
    if (yieldSlider && yieldVal) {
      yieldSlider.addEventListener('input', function () {
        calcState.yieldRate = parseInt(this.value) || 50;
        yieldVal.textContent = calcState.yieldRate + '%';
        calcApply();
      });
    }

    var calcReset = $('#calc-reset');
    if (calcReset) {
      calcReset.addEventListener('click', function () {
        calcState.res = {};
        calcState.q = '';
        calcState.targetQty = 1.0;
        calcState.yieldRate = 50;
        if (matSearch) matSearch.value = '';
        if (itemSearch) itemSearch.value = '';
        if (targetInput) targetInput.value = '1.0';
        if (yieldSlider) yieldSlider.value = '50';
        if (yieldVal) yieldVal.textContent = '50%';
        $$('.calc-mat-cb').forEach(function (cb) {
          cb.checked = false;
          var label = cb.closest('.calc-check');
          if (label) label.style.display = '';
        });
        sortCalcMatsList();
        calcApply();
      });
    }

    calcApply();
  }

  // Tab switching logic — auch programmatisch nutzbar (Cross-Links).
  function switchTab(tab) {
    $$('.cdb-tab-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === tab); });
    var dbContent = $('#cdb-tab-db-content');
    var dismantleContent = $('#cdb-tab-dismantle-content');
    if (tab === 'db') {
      if (dbContent) dbContent.removeAttribute('hidden');
      if (dismantleContent) dismantleContent.setAttribute('hidden', '');
    } else {
      if (dbContent) dbContent.setAttribute('hidden', '');
      if (dismantleContent) dismantleContent.removeAttribute('hidden');
    }
  }
  $$('.cdb-tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { switchTab(btn.dataset.tab); });
  });

  // Sprung Blueprint-Modal -> Zerlegungs-Rechner: Tab wechseln, Item-Name in
  // die Suche setzen und die passende Karte hervorheben. Kollidiert die
  // Material-Auswahl mit dem Item, wird sie geleert — das Item hat Vorrang.
  function gotoDismantle(name) {
    closeModal();
    switchTab('dismantle');
    var lowName = String(name).trim().toLowerCase();
    var input = $('#calc-item-search');
    if (input) input.value = name;
    calcState.q = lowName;
    calcApply();
    var target = findCalcCard(lowName);
    if (!target && Object.keys(calcState.res).some(function (k) { return calcState.res[k]; })) {
      calcState.res = {};
      $$('.calc-mat-cb').forEach(function (cb) { cb.checked = false; });
      sortCalcMatsList();
      calcApply();
      target = findCalcCard(lowName);
    }
    if (target) {
      target.classList.add('is-jump');
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(function () { target.classList.remove('is-jump'); }, 1800);
    }
  }
  function findCalcCard(lowName) {
    var all = $$('#calc-results .calc-card');
    for (var ci = 0; ci < all.length; ci++) if (all[ci].dataset.name === lowName) return all[ci];
    return all[0] || null;
  }

  initCalc();

  // initial paint
  apply();
})();
