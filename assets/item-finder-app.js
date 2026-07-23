// item-finder-app.js — Universal Item Finder (kanonische Quelle: /assets).
// Liest assets/universal-items.json (build-universal-db.mjs) und zeigt NUR echte
// Daten: Items ohne bekannte Bezugsquelle sind ehrlich als Katalog markiert,
// nichts wird erfunden. i18n über window.__UIF (Muster wie window.__CRAFT).
(function () {
  var CFG = window.__UIF || {};
  var T = CFG.t || {};
  // Cross-Link-Icons aus src/lib/icons.ts — NICHT "ICONS" nennen: die
  // Kategorie-Icon-Map weiter unten heißt schon so.
  var XLINK_ICONS = CFG.icons || {};
  function tr(key, fallback) { return T[key] != null ? T[key] : fallback; }

  var ALL_ITEMS = [];
  var CRAFTING_MAP = {};
  var META = null;

  var filteredItems = [];
  var currentPage = 1;
  var itemsPerPage = 60;
  var activeCategory = null;
  var activeKind = 'all'; // all | buy | loot | catalog
  var activeSize = null;  // Größenfilter (0–12) oder null
  var searchTerm = '';
  var sortCriteria = 'name_asc';

  // ---- Helfer ----
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmtNum(n) { return Number(n).toLocaleString(CFG.lang === 'de' ? 'de-DE' : 'en-US'); }
  function parentCategory(cat) { return cat ? cat.split('/')[0].trim() : 'Other'; }
  function minPrice(item) {
    var p = Infinity;
    for (var i = 0; i < item.obtain.length; i++) {
      var o = item.obtain[i];
      if (o.price != null && o.price > 0 && o.price < p) p = o.price;
    }
    return p === Infinity ? null : p;
  }
  function hasKind(item, kind) {
    if (kind === 'all') return true;
    if (kind === 'catalog') return item.obtain.length === 0;
    for (var i = 0; i < item.obtain.length; i++) {
      var k = item.obtain[i].kind;
      if (kind === 'buy' && (k === 'shop' || k === 'vehicle')) return true;
      if (kind === 'loot' && k === 'loot') return true;
    }
    return false;
  }

  // Schlüssel-Stat je Item (Badge auf der Karte + Wert-Sortierung). n = Zahl zum Sortieren.
  function primaryStat(item) {
    var g = item.game, s = g && g.stats;
    if (!s) return null;
    if (s.dps) return { l: tr('statDps', 'DPS'), v: fmtNum(s.dps) + ' DPS', n: s.dps };
    if (s.shieldHp) return { l: tr('statShieldHp', 'Schild-HP'), v: fmtNum(s.shieldHp) + ' HP', n: s.shieldHp };
    if (s.driveSpeed) return { l: tr('statQtSpeed', 'QT'), v: fmtNum(Math.round(s.driveSpeed / 1e6)) + ' Mm/s', n: s.driveSpeed };
    if (s.coolingRate) return { l: tr('statCooling', 'Kühlleistung'), v: fmtNum(s.coolingRate), n: s.coolingRate };
    if (s.powerOutput) return { l: tr('statPower', 'Leistung'), v: fmtNum(s.powerOutput), n: s.powerOutput };
    if (s.jammerRange) return { l: tr('statJammer', 'Jammer'), v: fmtNum(s.jammerRange) + ' m', n: s.jammerRange };
    if (s.empRadius) return { l: tr('statEmpRadius', 'EMP'), v: fmtNum(s.empRadius) + ' m', n: s.empRadius };
    if (s.fuelCapacity) return { l: tr('statFuel', 'Treibstoff'), v: fmtNum(s.fuelCapacity), n: s.fuelCapacity };
    if (s.damage) { var tot = 0; for (var k in s.damage) tot += s.damage[k]; return { l: tr('statDamage', 'Schaden'), v: fmtNum(tot), n: tot }; }
    if (s.resist && s.resist.physical != null) { var red = Math.round((1 - s.resist.physical) * 100); return { l: tr('statResist', 'Reduktion'), v: red + '%', n: red }; }
    if (s.ndr) return { l: tr('statNdr', 'NDR'), v: fmtNum(s.ndr) + ' NDR', n: s.ndr };
    if (s.sensitivity) return { l: tr('statSensitivity', 'Empfindlichkeit'), v: fmtNum(s.sensitivity), n: s.sensitivity };
    if (s.storageScu) return { l: tr('statStorage', 'Stauraum'), v: s.storageScu + ' SCU', n: s.storageScu };
    if (s.health) return { l: tr('statHealth', 'HP'), v: fmtNum(s.health) + ' HP', n: s.health };
    return null;
  }

  // Kategorie-Icons (Feather-Style, wie Bestand)
  var ICONS = {
    'Armour': '<svg class="uif-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
    'Clothing': '<svg class="uif-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"></path></svg>',
    'Weapons': '<svg class="uif-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line></svg>',
    'Vehicle': '<svg class="uif-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 22h9l1-6 1 6h9L12 2z"></path></svg>',
    'Vehiclegear': '<svg class="uif-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
    'Utility': '<svg class="uif-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>',
    'Ammo': '<svg class="uif-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M6 10V21h12V10c0-3-3-6-6-8-3 2-6 5-6 8z"></path><line x1="6" y1="17" x2="18" y2="17"></line><line x1="6" y1="13" x2="18" y2="13"></line></svg>',
    'Attachment': '<svg class="uif-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="6" x2="12" y2="18"></line><line x1="6" y1="12" x2="18" y2="12"></line></svg>'
  };
  var ICON_OTHER = '<svg class="uif-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
  function categoryIcon(parent) { return ICONS[parent] || ICON_OTHER; }

  // Anzeige-Labels der Kategorie-Wurzeln (Daten bleiben englisch, UI übersetzt)
  function categoryLabel(parent) {
    var key = 'cat' + parent.replace(/[^A-Za-z]/g, '');
    return tr(key, parent);
  }

  // ---- Filter + Sortierung ----
  function applyFiltersAndSort() {
    var term = searchTerm.toLowerCase().trim();

    filteredItems = ALL_ITEMS.filter(function (item) {
      if (activeCategory && parentCategory(item.category) !== activeCategory) return false;
      if (!hasKind(item, activeKind)) return false;
      if (activeSize != null && !(item.game && item.game.size === activeSize)) return false;
      if (!term) return true;
      if (item.name.toLowerCase().indexOf(term) !== -1) return true;
      if (item.category && item.category.toLowerCase().indexOf(term) !== -1) return true;
      if (item.game) {
        var g = item.game;
        if (g.manufacturer && g.manufacturer.toLowerCase().indexOf(term) !== -1) return true;
        if (g.class && g.class.toLowerCase().indexOf(term) !== -1) return true;
        if (g.subType && g.subType.toLowerCase().indexOf(term) !== -1) return true;
        if (g.nameDe && g.nameDe.toLowerCase().indexOf(term) !== -1) return true;
      }
      for (var i = 0; i < item.obtain.length; i++) {
        if (item.obtain[i].loc.toLowerCase().indexOf(term) !== -1) return true;
      }
      return false;
    });

    filteredItems.sort(function (a, b) {
      if (sortCriteria === 'name_asc') return a.name.localeCompare(b.name);
      if (sortCriteria === 'name_desc') return b.name.localeCompare(a.name);
      if (sortCriteria === 'stat_desc') {
        // Nach Schlüssel-Stat (hoch→niedrig); Items ohne Stat ans Ende
        var sa = primaryStat(a), sb = primaryStat(b);
        var na = sa ? sa.n : null, nb = sb ? sb.n : null;
        if (na == null && nb == null) return a.name.localeCompare(b.name);
        if (na == null) return 1;
        if (nb == null) return -1;
        return nb - na || a.name.localeCompare(b.name);
      }
      // Preis-Sortierung: Items ohne Preis immer ans Ende
      var pa = minPrice(a), pb = minPrice(b);
      if (pa == null && pb == null) return a.name.localeCompare(b.name);
      if (pa == null) return 1;
      if (pb == null) return -1;
      var d = sortCriteria === 'price_asc' ? pa - pb : pb - pa;
      return d !== 0 ? d : a.name.localeCompare(b.name);
    });

    render();
  }

  function render() {
    renderItemsGrid();
    renderStatsHeader();
    renderPagination();
  }

  // ---- Sidebar: Kategorien ----
  function renderCategories() {
    var catList = document.getElementById('uif-category-list');
    if (!catList) return;

    var counts = {};
    ALL_ITEMS.forEach(function (item) {
      var p = parentCategory(item.category);
      counts[p] = (counts[p] || 0) + 1;
    });

    var categories = Object.keys(counts).sort(function (a, b) {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      return categoryLabel(a).localeCompare(categoryLabel(b));
    });

    catList.innerHTML = categories.map(function (cat) {
      var isActive = activeCategory === cat;
      return '<button class="uif-category-btn' + (isActive ? ' active' : '') + '" data-category="' + esc(cat) + '">' +
        '<span class="uif-category-btn-label">' + categoryIcon(cat) + ' ' + esc(categoryLabel(cat)) + '</span>' +
        '<span class="uif-category-count">(' + fmtNum(counts[cat]) + ')</span>' +
        '</button>';
    }).join('');

    catList.querySelectorAll('.uif-category-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cat = btn.getAttribute('data-category');
        activeCategory = activeCategory === cat ? null : cat;
        currentPage = 1;
        applyFiltersAndSort();
        renderCategories();
      });
    });
  }

  // ---- Fundart-Chips (Alle / Kaufbar / Loot / Katalog) ----
  function renderKindChips() {
    var wrap = document.getElementById('uif-kind-chips');
    if (!wrap) return;
    var kinds = [
      ['all', tr('kindAll', 'Alle')],
      ['buy', tr('kindBuy', 'Kaufbar')],
      ['loot', tr('kindLoot', 'Loot')],
      ['catalog', tr('kindCatalog', 'Nur Katalog')]
    ];
    wrap.innerHTML = kinds.map(function (k) {
      return '<button class="uif-chip' + (activeKind === k[0] ? ' active' : '') + '" data-kind="' + k[0] + '">' + esc(k[1]) + '</button>';
    }).join('');
    wrap.querySelectorAll('.uif-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeKind = btn.getAttribute('data-kind');
        currentPage = 1;
        applyFiltersAndSort();
        renderKindChips();
      });
    });
  }

  // ---- Größen-Filter (nur Ausrüstung mit echter Size) ----
  function renderSizeChips() {
    var wrap = document.getElementById('uif-size-chips');
    if (!wrap) return;
    var sizes = {};
    ALL_ITEMS.forEach(function (item) {
      if (item.game && item.game.size != null && hasGradeSemantics(item)) sizes[item.game.size] = true;
    });
    var list = Object.keys(sizes).map(Number).sort(function (a, b) { return a - b; });
    if (!list.length) { wrap.innerHTML = ''; return; }
    var html = '<button class="uif-chip' + (activeSize == null ? ' active' : '') + '" data-size="all">' + esc(tr('kindAll', 'Alle')) + '</button>';
    html += list.map(function (sz) {
      return '<button class="uif-chip' + (activeSize === sz ? ' active' : '') + '" data-size="' + sz + '">S' + sz + '</button>';
    }).join('');
    wrap.innerHTML = html;
    wrap.querySelectorAll('.uif-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var v = btn.getAttribute('data-size');
        activeSize = v === 'all' ? null : Number(v);
        currentPage = 1;
        applyFiltersAndSort();
        renderSizeChips();
      });
    });
  }

  // ---- Ergebnis-Grid ----
  function renderItemsGrid() {
    var grid = document.getElementById('uif-results-grid');
    if (!grid) return;

    if (filteredItems.length === 0) {
      grid.innerHTML = '<div class="uif-empty">' + esc(tr('noResults', 'Keine passenden Items gefunden.')) + '</div>';
      return;
    }

    var start = (currentPage - 1) * itemsPerPage;
    var pageItems = filteredItems.slice(start, Math.min(start + itemsPerPage, filteredItems.length));

    grid.innerHTML = pageItems.map(function (item) {
      var parent = parentCategory(item.category);
      var p = minPrice(item);
      var priceHtml;
      if (p != null) {
        priceHtml = (item.obtain.length > 1 ? esc(tr('priceFrom', 'ab')) + ' ' : '') + fmtNum(p) + ' aUEC';
      } else if (item.obtain.length) {
        priceHtml = esc(tr('lootOnly', 'Nur Loot'));
      } else {
        priceHtml = esc(tr('noTradeData', 'Keine Handelsdaten'));
      }
      var locHtml;
      if (item.obtain.length) {
        var extra = item.obtain.length - 1;
        locHtml = esc(item.obtain[0].loc) + (extra > 0 ? ' <span class="uif-loc-more">+' + extra + '</span>' : '');
      } else {
        locHtml = '<span class="uif-loc-none">' + esc(tr('noSourceData', 'Kein Fundort bekannt')) + '</span>';
      }

      var specLine = '';
      if (item.game) {
        var g = item.game, bits = [];
        if (g.manufacturer) bits.push(g.manufacturer);
        if (hasGradeSemantics(item)) {
          if (g.size != null) bits.push('S' + g.size);
          if (g.grade) bits.push(g.grade);
        }
        if (bits.length) specLine = '<div class="uif-card-spec">' + esc(bits.join(' · ')) + '</div>';
      }
      var ps = primaryStat(item);
      var statBadge = ps ? '<span class="uif-card-stat" title="' + esc(ps.l) + '">' + esc(ps.v) + '</span>' : '';

      return '<div class="uif-card" data-id="' + esc(item.id) + '" data-category="' + esc(parent) + '" tabindex="0" role="button">' +
        '<div class="uif-card-header">' +
          '<div class="uif-card-cat-wrapper">' + categoryIcon(parent) + ' <span>' + esc(item.category) + '</span></div>' +
          statBadge +
        '</div>' +
        '<h4 class="uif-card-title">' + esc(item.name) + '</h4>' +
        specLine +
        '<div class="uif-card-footer">' +
          '<div class="uif-card-price">' + priceHtml + '</div>' +
          '<div class="uif-card-location" title="' + esc(item.obtain.length ? item.obtain[0].loc : '') + '">' + locHtml + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    grid.querySelectorAll('.uif-card').forEach(function (card) {
      function open() {
        var id = card.getAttribute('data-id');
        var item = null;
        for (var i = 0; i < ALL_ITEMS.length; i++) if (ALL_ITEMS[i].id === id) { item = ALL_ITEMS[i]; break; }
        if (item) openModal(item);
      }
      card.addEventListener('click', open);
      card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
  }

  // ---- Statuszeile ----
  function renderStatsHeader() {
    var count = document.getElementById('uif-stats-count');
    if (!count) return;
    if (filteredItems.length === 0) {
      count.textContent = tr('showingNone', '0 Einträge');
      return;
    }
    var start = (currentPage - 1) * itemsPerPage + 1;
    var end = Math.min(currentPage * itemsPerPage, filteredItems.length);
    count.textContent = tr('showing', '{start}–{end} von {total} Einträgen')
      .replace('{start}', fmtNum(start))
      .replace('{end}', fmtNum(end))
      .replace('{total}', fmtNum(filteredItems.length));
  }

  // ---- Pagination ----
  function renderPagination() {
    var container = document.getElementById('uif-pagination-container');
    if (!container) return;

    var totalPages = Math.ceil(filteredItems.length / itemsPerPage);
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    var offFirst = currentPage === 1 ? ' disabled="disabled"' : '';
    var offLast = currentPage === totalPages ? ' disabled="disabled"' : '';
    container.innerHTML =
      '<button class="uif-page-btn" id="uif-page-first"' + offFirst + '>&laquo; ' + esc(tr('pageFirst', 'Anfang')) + '</button>' +
      '<button class="uif-page-btn" id="uif-prev-btn"' + offFirst + '>&lsaquo; ' + esc(tr('pagePrev', 'Zurück')) + '</button>' +
      '<span class="uif-page-info" id="uif-page-info">' + esc(tr('pageOf', 'Seite {p} von {t}').replace('{p}', currentPage).replace('{t}', totalPages)) + '</span>' +
      '<button class="uif-page-btn" id="uif-next-btn"' + offLast + '>' + esc(tr('pageNext', 'Weiter')) + ' &rsaquo;</button>' +
      '<button class="uif-page-btn" id="uif-page-last"' + offLast + '>' + esc(tr('pageLast', 'Ende')) + ' &raquo;</button>';

    var go = function (page) {
      currentPage = page;
      renderItemsGrid();
      renderStatsHeader();
      renderPagination();
      var app = document.getElementById('uif-app');
      if (app && app.scrollIntoView) app.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    var totalP = totalPages;
    var first = container.querySelector('#uif-page-first');
    var prev = container.querySelector('#uif-prev-btn');
    var next = container.querySelector('#uif-next-btn');
    var last = container.querySelector('#uif-page-last');
    if (first) first.addEventListener('click', function () { go(1); });
    if (prev) prev.addEventListener('click', function () { go(currentPage - 1); });
    if (next) next.addEventListener('click', function () { go(currentPage + 1); });
    if (last) last.addEventListener('click', function () { go(totalP); });
  }

  // ---- Modal ----
  var KIND_LABEL = null;
  function kindLabel(kind) {
    if (!KIND_LABEL) {
      KIND_LABEL = {
        shop: tr('kindShop', 'Shop'),
        vehicle: tr('kindVehicleShop', 'Schiffshändler'),
        loot: tr('kindLoot', 'Loot')
      };
    }
    return KIND_LABEL[kind] || kind;
  }

  // ---- Technische Daten (Spieldaten aus dem DataCore) ----
  var DMG_LABEL = null;
  function dmgLabels() {
    if (!DMG_LABEL) DMG_LABEL = {
      physical: tr('dmgPhysical', 'Physisch'), energy: tr('dmgEnergy', 'Energie'),
      distortion: tr('dmgDistortion', 'Distortion'), thermal: tr('dmgThermal', 'Thermal'),
      biochemical: tr('dmgBio', 'Biochem'), stun: tr('dmgStun', 'Betäubung')
    };
    return DMG_LABEL;
  }
  function fmtDamage(dmg) {
    var L = dmgLabels(), parts = [];
    ['physical', 'energy', 'distortion', 'thermal', 'biochemical', 'stun'].forEach(function (k) {
      if (dmg[k] && dmg[k] > 0) parts.push(fmtNum(dmg[k]) + ' ' + L[k]);
    });
    return parts.join(' · ');
  }
  function fmtResist(res) {
    // Schadensmultiplikator -> Schadensreduktion in % (1 - Multiplikator)
    var L = dmgLabels(), keys = ['physical', 'energy', 'distortion', 'thermal', 'biochemical'];
    var vals = keys.filter(function (k) { return res[k] != null; });
    if (!vals.length) return null;
    var uniform = vals.every(function (k) { return res[k] === res[vals[0]]; });
    var pct = function (k) { return Math.round((1 - res[k]) * 100) + '%'; };
    if (uniform) return tr('resistAll', 'Alle') + ' ' + pct(vals[0]);
    return vals.map(function (k) { return L[k] + ' ' + pct(k); }).join(' · ');
  }
  // Anzeigbare Stats als [label, value] — nur sinnvolle, ehrliche Werte (leere weggelassen)
  function statEntries(item) {
    var g = item.game, s = g && g.stats; if (!s) return [];
    var out = [];
    if (s.damage) { var d = fmtDamage(s.damage); if (d) out.push([tr('statDamage', 'Schaden'), d]); }
    if (s.blastRadius) out.push([tr('statBlast', 'Explosionsradius'), fmtNum(s.blastRadius) + ' m']);
    if (s.fireRate) out.push([tr('statFireRate', 'Feuerrate'), fmtNum(s.fireRate) + ' ' + tr('unitRpm', 'Schuss/min')]);
    if (s.dps) out.push([tr('statDps', 'DPS'), fmtNum(s.dps)]);
    if (s.magazine) out.push([tr('statMagazine', 'Magazin'), fmtNum(s.magazine)]);
    if (s.shieldHp) out.push([tr('statShieldHp', 'Schild-HP'), fmtNum(s.shieldHp)]);
    if (s.regen) out.push([tr('statRegen', 'Schild-Regen'), fmtNum(s.regen) + '/s']);
    if (s.driveSpeed) out.push([tr('statQtSpeed', 'QT-Geschwindigkeit'), fmtNum(Math.round(s.driveSpeed / 1e6)) + ' Mm/s']);
    if (s.cooldown) out.push([tr('statCooldown', 'Abklingzeit'), fmtNum(s.cooldown) + ' s']);
    if (s.coolingRate) out.push([tr('statCooling', 'Kühlleistung'), fmtNum(s.coolingRate)]);
    if (s.powerOutput) out.push([tr('statPower', 'Leistung'), fmtNum(s.powerOutput)]);
    if (s.fuelCapacity) out.push([tr('statFuel', 'Treibstoff-Kapazität'), fmtNum(s.fuelCapacity)]);
    if (s.sensitivity) out.push([tr('statSensitivity', 'Signatur-Empfindlichkeit'), fmtNum(s.sensitivity)]);
    if (s.jammerRange) out.push([tr('statJammer', 'QT-Jammer-Reichweite'), fmtNum(s.jammerRange) + ' m']);
    if (s.empRadius) out.push([tr('statEmpRadius', 'EMP-Radius'), fmtNum(s.empRadius) + ' m']);
    if (s.distortionDamage) out.push([tr('statDistortion', 'Distortion-Schaden'), fmtNum(s.distortionDamage)]);
    if (s.chargeTime) out.push([tr('statCharge', 'Ladezeit'), fmtNum(s.chargeTime) + ' s']);
    if (s.resist) { var r = fmtResist(s.resist); if (r) out.push([tr('statResist', 'Schadensreduktion'), r]); }
    if (s.tempMin != null && s.tempMax != null) out.push([tr('statTemp', 'Temp.-Rating'), s.tempMin + ' / ' + s.tempMax + ' °C']);
    if (s.radiation) out.push([tr('statRadiation', 'Strahlungsschutz'), fmtNum(s.radiation) + ' REM']);
    if (s.ndr) out.push([tr('statNdr', 'Nährwert (NDR)'), fmtNum(s.ndr)]);
    if (s.effects && s.effects.length) out.push([tr('statEffects', 'Effekte'), s.effects.join(', ')]);
    if (s.storageScu) out.push([tr('statStorage', 'Stauraum'), s.storageScu + ' SCU']);
    if (s.lifetime) out.push([tr('statLifetime', 'Flugzeit'), fmtNum(s.lifetime) + ' s']);
    if (s.health) out.push([tr('statHealth', 'Bauteil-HP'), fmtNum(s.health)]);
    return out;
  }
  // Größe/Grade nur bei Ausrüstung anzeigen (bei Kleidung/Nahrung ist Grade immer „A")
  function hasGradeSemantics(item) { return /Vehiclegear|Weapons|Armour|Attachment/.test(parentCategory(item.category)); }
  // Kopf-Chips: Hersteller / Größe / Grade / Klasse / Volumen
  function specChips(item) {
    var g = item.game; if (!g) return [];
    var eq = hasGradeSemantics(item), chips = [];
    if (g.manufacturer) chips.push([tr('specMfr', 'Hersteller'), g.manufacturer]);
    if (eq && g.size != null) chips.push([tr('specSize', 'Größe'), 'S' + g.size]);
    if (eq && g.grade) chips.push([tr('specGrade', 'Grade'), g.grade]);
    if (g.class) chips.push([tr('specClass', 'Klasse'), g.class]);
    if (g.volumeScu) chips.push([tr('specVolume', 'Volumen'), g.volumeScu + ' SCU']);
    return chips;
  }

  function openModal(item) {
    var modal = document.getElementById('uif-item-modal');
    var content = document.getElementById('uif-modal-body-content');
    if (!modal || !content) return;

    var parent = parentCategory(item.category);
    var html = '<div class="uif-modal-header">' +
      '<div class="uif-modal-meta">' +
        '<span class="uif-modal-meta-item">' + categoryIcon(parent) + ' ' + esc(item.category) + '</span>' +
      '</div>' +
      '<h2 class="uif-modal-title">' + esc(item.name) + '</h2>' +
    '</div>';

    // Technische Daten (Spieldaten) — zuerst: was IST das Item, was kann es
    var chips = specChips(item), stats = statEntries(item);
    var descText = item.game ? (CFG.lang === 'de' && item.game.descDe ? item.game.descDe : item.game.desc) : null;
    if (chips.length || stats.length || descText) {
      html += '<div class="uif-modal-section uif-specs">' +
        '<h4>' + esc(tr('sectionSpecs', 'Technische Daten')) + '</h4>' +
        (chips.length ? '<div class="uif-spec-chips">' + chips.map(function (c) {
          return '<span class="uif-spec-chip"><b>' + esc(c[0]) + '</b> ' + esc(c[1]) + '</span>';
        }).join('') + '</div>' : '') +
        (stats.length ? '<div class="uif-stat-grid">' + stats.map(function (st) {
          return '<div class="uif-stat"><span class="uif-stat-l">' + esc(st[0]) + '</span><span class="uif-stat-v">' + esc(st[1]) + '</span></div>';
        }).join('') + '</div>' : '') +
        (descText ? '<p class="uif-item-desc">' + esc(descText) + '</p>' : '') +
      '</div>';
    }

    // Bezugsquellen — oder ehrlicher Katalog-Hinweis
    if (item.obtain.length) {
      var rows = item.obtain.map(function (o) {
        return '<tr class="uif-obtain-row">' +
          '<td>' + esc(o.loc) + '</td>' +
          '<td class="uif-td-kind">' + esc(kindLabel(o.kind)) + '</td>' +
          '<td class="uif-td-price">' + (o.price != null ? fmtNum(o.price) + ' aUEC' : '&mdash;') + '</td>' +
        '</tr>';
      }).join('');
      html += '<div class="uif-modal-section">' +
        '<h4>' + esc(tr('sectionObtain', 'Bezugsquellen')) + '</h4>' +
        '<div class="uif-table-wrapper"><table class="uif-locations-table">' +
        '<thead><tr><th>' + esc(tr('thLocation', 'Ort')) + '</th><th>' + esc(tr('thKind', 'Art')) + '</th><th>' + esc(tr('thPrice', 'Preis')) + '</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>' +
        '<p class="uif-volatile-note">' + esc(tr('volatileNote', 'Preise und Fundorte sind Patch-volatil — ingame prüfen.')) + '</p>' +
      '</div>';
    } else {
      html += '<div class="uif-modal-section">' +
        '<h4>' + esc(tr('sectionObtain', 'Bezugsquellen')) + '</h4>' +
        '<p class="uif-catalog-note">' + esc(tr('catalogNote', 'Katalog-Eintrag aus den Spieldateien: Für dieses Item liegen keine verifizierten Shop- oder Loot-Daten vor.')) + '</p>' +
      '</div>';
    }

    // Loot-Guide (eigene Recherche)
    if (item.guide) {
      html += '<div class="uif-modal-section">' +
        '<h4>' + esc(tr('sectionGuide', 'Fundort-Guide')) + '</h4>' +
        '<p class="uif-guide-text">' + esc(item.guide) + '</p>' +
      '</div>';
    }

    // Crafting-Rezept (aus crafting-db.json, sc-craft.tools-Snapshot)
    var bp = CRAFTING_MAP[item.name.toLowerCase()];
    if (bp) {
      var timeSec = bp.craft_time_seconds || 0;
      var timeText = timeSec + 's';
      if (timeSec >= 60) {
        var min = Math.floor(timeSec / 60), sec = timeSec % 60;
        timeText = min + 'm' + (sec > 0 ? ' ' + sec + 's' : '');
      }
      var ingredients = '';
      if (bp.ingredients && bp.ingredients.length) {
        ingredients = '<ul>' + bp.ingredients.map(function (ing) {
          var options = (ing.options || []).map(function (opt) {
            var qty = opt.quantity_scu !== undefined ? opt.quantity_scu + ' SCU' : (opt.quantity !== undefined ? String(opt.quantity) : '');
            return esc(opt.name) + (qty ? ' (' + esc(qty) + ')' : '');
          }).join(' / ');
          return '<li><strong>' + esc(ing.slot || 'Material') + ':</strong> ' + options + '</li>';
        }).join('') + '</ul>';
      }
      html += '<div class="uif-modal-section">' +
        '<h4>' + esc(tr('sectionCrafting', 'Crafting-Rezept')) + '</h4>' +
        '<div class="uif-crafting-header">' +
          '<div><strong>' + esc(tr('craftTime', 'Dauer')) + ':</strong> ' + esc(timeText) + '</div>' +
          (bp.tiers ? '<div><strong>' + esc(tr('craftTiers', 'Stufen')) + ':</strong> ' + esc(String(bp.tiers)) + '</div>' : '') +
        '</div>' +
        (ingredients ? '<div class="uif-crafting-ingredients"><h5>' + esc(tr('craftMaterials', 'Materialien')) + '</h5>' + ingredients + '</div>' : '') +
        // DE liegt unter /de/, EN im Root (ein /en/-Prefix existiert nicht).
        '<a class="uif-xlink" href="' + (CFG.lang === 'de' ? '/de' : '') + '/topics/crafting.html?bp=' + encodeURIComponent(item.name) + '">' + (XLINK_ICONS.bp || '') + esc(tr('openInCrafting', 'Im Crafting-Planer öffnen')) + ' →</a>' +
      '</div>';
    }

    content.innerHTML = html;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    var modal = document.getElementById('uif-item-modal');
    if (modal && modal.style.display !== 'none') {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  // ---- Events ----
  function initEvents() {
    var searchInput = document.getElementById('uif-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function (e) {
        searchTerm = e.target.value;
        currentPage = 1;
        applyFiltersAndSort();
      });
    }
    var sortSelect = document.getElementById('uif-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', function (e) {
        sortCriteria = e.target.value;
        currentPage = 1;
        applyFiltersAndSort();
      });
    }
    var closeBtn = document.getElementById('uif-modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    var overlay = document.getElementById('uif-item-modal');
    if (overlay) {
      overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
  }

  // ---- Init: DB + Crafting-DB laden ----
  function init() {
    initEvents();

    var dbUrl = CFG.dbUrl || '/assets/universal-items.json';
    var craftUrl = CFG.craftUrl || '/assets/crafting-db.json';

    Promise.all([
      fetch(dbUrl).then(function (r) {
        if (!r.ok) throw new Error('items db http ' + r.status);
        return r.json();
      }),
      fetch(craftUrl).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
    ]).then(function (results) {
      var db = results[0] || {};
      META = db.counts || null;
      ALL_ITEMS = db.items || [];

      var craft = results[1];
      if (craft && craft.blueprints) {
        craft.blueprints.forEach(function (bp) {
          if (bp.name) CRAFTING_MAP[bp.name.toLowerCase()] = bp;
        });
      }

      var sub = document.getElementById('uif-subline');
      if (sub && META) {
        sub.textContent = tr('subline', '{total} Items aus den Spieldateien, {sourced} mit verifizierten Bezugsquellen')
          .replace('{total}', fmtNum(META.items))
          .replace('{sourced}', fmtNum(META.withObtain));
      }

      currentPage = 1;
      applyFiltersAndSort();
      renderCategories();
      renderKindChips();
      renderSizeChips();
      // Deep-Link aus dem Crafting-Planer: ?item=<Item-Name oder -id> öffnet die Card.
      try {
        var wantItem = new URLSearchParams(location.search).get('item');
        if (wantItem) {
          var tgt = wantItem.trim().toLowerCase();
          for (var ii = 0; ii < ALL_ITEMS.length; ii++) {
            if ((ALL_ITEMS[ii].name || '').toLowerCase() === tgt || ALL_ITEMS[ii].id === wantItem) { openModal(ALL_ITEMS[ii]); break; }
          }
        }
      } catch (e) {}
    }).catch(function (err) {
      console.warn('Item-Finder: Datenbank konnte nicht geladen werden.', err);
      var grid = document.getElementById('uif-results-grid');
      if (grid) grid.innerHTML = '<div class="uif-empty">' + esc(tr('loadError', 'Die Item-Datenbank konnte nicht geladen werden. Bitte später erneut versuchen.')) + '</div>';
      var count = document.getElementById('uif-stats-count');
      if (count) count.textContent = tr('showingNone', '0 Einträge');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
