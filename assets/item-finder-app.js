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
  var SETS = {};   // setId -> Set-Datensatz (aus universal-items.json)
  var META = null;

  var filteredItems = [];
  var currentPage = 1;
  var itemsPerPage = 60;
  var activeCategory = null;
  var activeKind = 'all'; // all | buy | loot | catalog
  var activeSize = null;  // Größenfilter (0–12) oder null
  var activeWeight = null; // Panzerungsklasse (Light/Medium/Heavy/…) oder null
  var activeRarity = null; // Seltenheit (Common…Legendary) oder null
  var activeSet = null;    // Set-Id: zeigt nur die Teile EINES Sets
  var viewMode = 'items';  // 'items' | 'sets'
  var filteredSets = [];
  var searchTerm = '';
  var sortCriteria = 'name_asc';

  // Seltenheit ist eine ORDINALE Skala — die Reihenfolge kommt aus den Spieldaten,
  // nicht aus dem Alphabet (sonst stünde „Common" vor „Legendary" vor „Rare").
  var RARITY_ORDER = { Common: 1, Uncommon: 2, Rare: 3, Epic: 4, Legendary: 5 };
  var WEIGHT_ORDER = { Undersuit: 1, Light: 2, Medium: 3, Heavy: 4, SuperHeavy: 5, Flightsuit: 6 };

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
  // Hat das Item eine eigene Detailseite? Muss mit isIndexable() in
  // src/lib/items.ts uebereinstimmen — dort entscheidet dieselbe Regel, welche
  // /items/<id>.html gebaut wird. Weicht sie ab, verlinken Karten ins Leere.
  function hasPage(item) {
    if (item.obtain.length > 0) return true;
    if (item.guide) return true;
    var g = item.game;
    if (!g || !g.stats) return false;
    for (var k in g.stats) if (Object.prototype.hasOwnProperty.call(g.stats, k)) return true;
    return false;
  }
  function itemUrl(item) {
    return (CFG.itemBase || '/items/') + encodeURIComponent(item.id) + '.html';
  }

  function hasKind(item, kind) {
    if (kind === 'all') return true;
    if (kind === 'catalog') return item.obtain.length === 0;
    for (var i = 0; i < item.obtain.length; i++) {
      var k = item.obtain[i].kind;
      if (kind === 'buy' && (k === 'shop' || k === 'vehicle')) return true;
      if (kind === 'loot' && k === 'loot') return true;
      if (kind === 'exclusive' && k === 'exclusive') return true;
    }
    return false;
  }

  // ---- Tag-Facetten: Anzeige-Labels ----
  // Die Werte kommen englisch aus den Spieldaten; die UI uebersetzt sie ueber
  // einen Schluessel. Fehlt einer, wird der Rohwert gezeigt statt zu raten.
  function weightLabel(w) { return w ? tr('w' + w.replace(/[^A-Za-z]/g, ''), w.replace(/\./g, ' ')) : ''; }
  function rarityLabel(r) { return r ? tr('r' + r, r) : ''; }
  function exclusiveLabel(reason) {
    if (!reason) return tr('notLootable', 'Nicht als Loot erhältlich');
    return tr('ex' + reason.replace(/[^A-Za-z]/g, ''), reason);
  }
  function setOf(item) { return item.game && item.game.setId ? SETS[item.game.setId] || null : null; }

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
      if (activeWeight && !(item.game && item.game.weight === activeWeight)) return false;
      if (activeRarity && !(item.game && item.game.rarity === activeRarity)) return false;
      if (activeSet && !(item.game && item.game.setId === activeSet)) return false;
      if (!term) return true;
      if (item.name.toLowerCase().indexOf(term) !== -1) return true;
      if (item.category && item.category.toLowerCase().indexOf(term) !== -1) return true;
      if (item.game) {
        var g = item.game;
        if (g.manufacturer && g.manufacturer.toLowerCase().indexOf(term) !== -1) return true;
        if (g.class && g.class.toLowerCase().indexOf(term) !== -1) return true;
        if (g.subType && g.subType.toLowerCase().indexOf(term) !== -1) return true;
        if (g.nameDe && g.nameDe.toLowerCase().indexOf(term) !== -1) return true;
        // Set-Name mitsuchen: „venture" soll alle Venture-Teile finden, auch die,
        // deren Anzeigename das Wort nicht traegt.
        var st = setOf(item);
        if (st && st.name.toLowerCase().indexOf(term) !== -1) return true;
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

    // Sets leiten sich AUS den gefilterten Items ab, statt eigene Filter zu
    // fuehren: „Schwer" + Suche „venture" liefert damit automatisch genau die
    // Sets, zu denen die sichtbaren Teile gehoeren — ohne doppelte Filterlogik.
    var seen = {};
    filteredSets = [];
    for (var i = 0; i < filteredItems.length; i++) {
      var sid = filteredItems[i].game && filteredItems[i].game.setId;
      if (!sid || seen[sid] || !SETS[sid]) continue;
      seen[sid] = 1;
      filteredSets.push(SETS[sid]);
    }
    filteredSets.sort(function (a, b) {
      if (sortCriteria === 'name_desc') return b.name.localeCompare(a.name);
      if (sortCriteria === 'name_asc') return a.name.localeCompare(b.name);
      return b.parts - a.parts || a.name.localeCompare(b.name);
    });
    // Ohne Sets im Ergebnis ist die Set-Ansicht sinnlos -> zurueck auf Einzelteile
    if (viewMode === 'sets' && !filteredSets.length) viewMode = 'items';

    render();
  }

  function render() {
    renderViewToggle();
    if (viewMode === 'sets') renderSetsGrid(); else renderItemsGrid();
    renderStatsHeader();
    renderPagination();
  }

  // ---- Umschalter Einzelteile <-> Sets ----
  function renderViewToggle() {
    var wrap = document.getElementById('uif-view-toggle');
    if (!wrap) return;
    // Kein Set im Ergebnis (z. B. Kategorie „Waffen") -> Schalter waere tot
    if (!filteredSets.length && viewMode !== 'sets') { wrap.innerHTML = ''; return; }
    var modes = [['items', tr('viewPieces', 'Einzelteile')], ['sets', tr('viewSets', 'Sets')]];
    wrap.innerHTML = modes.map(function (m) {
      return '<button class="uif-viewbtn' + (viewMode === m[0] ? ' active' : '') + '" data-view="' + m[0] + '"' +
        ' aria-pressed="' + (viewMode === m[0]) + '">' + esc(m[1]) +
        (m[0] === 'sets' ? ' <span class="uif-chip-n">' + fmtNum(filteredSets.length) + '</span>' : '') +
        '</button>';
    }).join('');
    wrap.querySelectorAll('.uif-viewbtn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        viewMode = btn.getAttribute('data-view');
        // Set-Filter und Set-Ansicht schliessen sich aus: in der Set-Liste will
        // man alle Sets sehen, nicht die Teile eines einzelnen.
        if (viewMode === 'sets') activeSet = null;
        currentPage = 1;
        applyFiltersAndSort();
      });
    });
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
      ['exclusive', tr('kindExclusive', 'Exklusiv')],
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

  // ---- Panzerungsklasse (Armor.FPS.Type) + Seltenheit (LootRarity) ----
  // Beide Chip-Leisten folgen demselben Muster wie die Groessen-Chips: Werte aus
  // dem Bestand ableiten (keine feste Liste — sonst zeigt die UI Klassen an, die
  // es im Patch gar nicht gibt) und in der spiel-eigenen Reihenfolge sortieren.
  function renderFacetChips(elId, field, order, labelFn, getActive, setActive) {
    var wrap = document.getElementById(elId);
    if (!wrap) return;
    var seen = {};
    ALL_ITEMS.forEach(function (item) {
      var v = item.game && item.game[field];
      if (v) seen[v] = (seen[v] || 0) + 1;
    });
    var list = Object.keys(seen).sort(function (a, b) {
      var oa = order[a] || 99, ob = order[b] || 99;
      return oa - ob || a.localeCompare(b);
    });
    if (!list.length) { wrap.innerHTML = ''; return; }
    var active = getActive();
    var html = '<button class="uif-chip' + (active == null ? ' active' : '') + '" data-v="all">' + esc(tr('kindAll', 'Alle')) + '</button>';
    html += list.map(function (v) {
      return '<button class="uif-chip' + (active === v ? ' active' : '') + '" data-v="' + esc(v) + '">' +
        esc(labelFn(v)) + ' <span class="uif-chip-n">' + fmtNum(seen[v]) + '</span></button>';
    }).join('');
    wrap.innerHTML = html;
    wrap.querySelectorAll('.uif-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var v = btn.getAttribute('data-v');
        setActive(v === 'all' ? null : v);
        currentPage = 1;
        applyFiltersAndSort();
        renderWeightChips();
        renderRarityChips();
      });
    });
  }
  function renderWeightChips() {
    renderFacetChips('uif-weight-chips', 'weight', WEIGHT_ORDER, weightLabel,
      function () { return activeWeight; }, function (v) { activeWeight = v; });
  }
  function renderRarityChips() {
    renderFacetChips('uif-rarity-chips', 'rarity', RARITY_ORDER, rarityLabel,
      function () { return activeRarity; }, function (v) { activeRarity = v; });
  }

  // ---- Set-Grid: eine Karte = ein Set ----
  function renderSetsGrid() {
    var grid = document.getElementById('uif-results-grid');
    if (!grid) return;
    if (!filteredSets.length) {
      grid.innerHTML = '<div class="uif-empty">' + esc(tr('setNoResults', 'Keine passenden Sets gefunden.')) + '</div>';
      return;
    }
    var start = (currentPage - 1) * itemsPerPage;
    var page = filteredSets.slice(start, Math.min(start + itemsPerPage, filteredSets.length));

    grid.innerHTML = page.map(function (s) {
      var slots = Object.keys(s.slots).map(function (k) { return tr('slot' + k, k); }).join(' · ');
      var complete = s.coreSlots === 4;
      var badge = '<span class="uif-setbadge' + (complete ? ' is-ok' : '') + '">' +
        esc(complete ? tr('setsComplete', 'komplett') : tr('setsPartial', '{n}/4 Kernslots').replace('{n}', s.coreSlots)) + '</span>';
      // Hersteller und Panzerungsklasse in GETRENNTE Spans. Zusammen in einem
      // Span kuerzt `text-overflow: ellipsis` von rechts — und weil die Klasse
      // hinten steht, verschwindet als Erstes genau die Information, wegen der
      // die Zeile da ist („CLARK DEFENSE SYSTEMS · HEA…", bei Roussimoff
      // Rehabilitation Systems fiel sie ganz weg). Jetzt kuerzt nur der
      // Herstellername; die Klasse schrumpft nie (CSS: flex 0 0 auto).
      var mfrHtml = s.manufacturer
        ? '<span class="uif-setcard-mfr" title="' + esc(s.manufacturer) + '">' + esc(s.manufacturer) + '</span>'
        : '';
      var weightHtml = s.weight
        ? '<span class="uif-setcard-weight">' + esc(weightLabel(s.weight)) + '</span>'
        : '';
      return '<div class="uif-card uif-setcard" data-set="' + esc(s.id) + '" tabindex="0" role="button">' +
        '<div class="uif-card-header">' +
          '<div class="uif-card-cat-wrapper">' + categoryIcon('Armour') + mfrHtml + weightHtml + '</div>' +
          badge +
        '</div>' +
        '<h4 class="uif-card-title">' + esc(s.name) + '</h4>' +
        '<div class="uif-card-spec">' + esc(slots) + '</div>' +
        '<div class="uif-card-footer">' +
          '<div class="uif-card-price">' + fmtNum(s.parts) + ' ' +
            esc(s.parts === 1 ? tr('setPiece', 'Teil') : tr('setPieces', 'Teile')) + '</div>' +
          '<div class="uif-card-location">' + esc(tr('setOpen', 'Teile anzeigen')) + ' →</div>' +
        '</div>' +
      '</div>';
    }).join('');

    grid.querySelectorAll('.uif-setcard').forEach(function (card) {
      function open() {
        activeSet = card.getAttribute('data-set');
        viewMode = 'items';
        currentPage = 1;
        applyFiltersAndSort();
        var top = document.getElementById('uif-app');
        if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      card.addEventListener('click', open);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
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
        // Ein Item, das laut Spieldaten gar nicht droppen kann, ist nicht „nur
        // Loot" — es ist exklusiv. Sonst widerspraeche die Karte ihrer eigenen
        // Quellenzeile („Promo-Gegenstand").
        var onlyExcl = item.obtain.every(function (o) { return o.kind === 'exclusive'; });
        priceHtml = esc(onlyExcl ? tr('kindExclusive', 'Exklusiv') : tr('lootOnly', 'Nur Loot'));
      } else {
        priceHtml = esc(tr('noTradeData', 'Keine Handelsdaten'));
      }
      var locHtml;
      if (item.obtain.length) {
        var extra = item.obtain.length - 1, o0 = item.obtain[0];
        // Der Fundort-Name steht in einem EIGENEN span, nicht als blosser
        // Textknoten. Grund: `.uif-card-location` kuerzt mit
        // white-space:nowrap + text-overflow:ellipsis. Das kuerzt die ganze
        // Box — und damit zuerst das, was hinten steht. Gemessen bei 375 px
        // lag `+11` bei x=409, also komplett ausserhalb des Bildes: dass es
        // weitere Fundorte gibt, war auf dem Telefon nicht zu sehen. Mit
        // eigenem span kuerzt nur der Name, das `+N` bleibt als nicht
        // schrumpfender Nachbar stehen.
        locHtml = '<span class="uif-loc-name">' +
          esc(o0.kind === 'exclusive' ? exclusiveLabel(o0.reason) : o0.loc) + '</span>' +
          (extra > 0 ? '<span class="uif-loc-more">+' + extra + '</span>' : '');
      } else {
        locHtml = '<span class="uif-loc-none">' + esc(tr('noSourceData', 'Kein Fundort bekannt')) + '</span>';
      }

      var specLine = '';
      if (item.game) {
        var g = item.game, bits = [];
        if (g.manufacturer) bits.push(g.manufacturer);
        if (g.weight) bits.push(weightLabel(g.weight));
        if (hasGradeSemantics(item)) {
          if (g.size != null) bits.push('S' + g.size);
          if (g.grade) bits.push(g.grade);
        }
        if (bits.length) specLine = '<div class="uif-card-spec">' + esc(bits.join(' · ')) + '</div>';
      }
      var ps = primaryStat(item);
      var statBadge = ps ? '<span class="uif-card-stat" title="' + esc(ps.l) + '">' + esc(ps.v) + '</span>' : '';
      // Seltenheit als farbiger Punkt-Badge — nur wo die Spieldaten sie fuehren
      var rar = item.game && item.game.rarity;
      var rarBadge = rar
        ? '<span class="uif-rarity uif-rarity--' + esc(rar.toLowerCase()) + '" title="' + esc(tr('facetRarity', 'Seltenheit')) + '">' + esc(rarityLabel(rar)) + '</span>'
        : '';
      // Set-Chip: macht die Set-Zugehoerigkeit im Vorbeigehen sichtbar und
      // filtert per Klick — man muss nicht wissen, dass es Sets gibt.
      var st0 = setOf(item);
      var setChip = st0 && st0.id !== activeSet
        ? '<button type="button" class="uif-setchip" data-set="' + esc(st0.id) + '" title="' + esc(tr('facetSet', 'Set')) + '">' + esc(st0.name) + '</button>'
        : '';

      // Karten mit Detailseite sind echte Links (Crawler + Strg-Klick + „in
      // neuem Tab öffnen"); Katalog-Reste ohne Seite bleiben Buttons.
      //
      // Die Karte ist bewusst KEIN <a> mehr, sondern ein <div> mit einem
      // „stretched link" auf dem Titel (::after deckt die Karte ab). Grund: der
      // Set-Chip ist ein <button> — ein Button INNERHALB eines Links ist
      // ungültiges HTML und für Tastatur/Screenreader eine Falle. So bleibt die
      // ganze Karte klickbar und crawlbar, der Chip liegt sauber darüber.
      var linked = hasPage(item);
      var titleHtml = linked
        ? '<a class="uif-card-link" href="' + esc(itemUrl(item)) + '">' + esc(item.name) + '</a>'
        : esc(item.name);

      return '<div class="uif-card' + (linked ? ' is-linked' : '') + '" data-id="' + esc(item.id) + '" data-category="' + esc(parent) + '"' +
        (linked ? '' : ' tabindex="0" role="button"') + '>' +
        '<div class="uif-card-header">' +
          '<div class="uif-card-cat-wrapper">' + categoryIcon(parent) + ' <span>' + esc(item.category) + '</span></div>' +
          statBadge +
        '</div>' +
        '<h4 class="uif-card-title">' + titleHtml + '</h4>' +
        (rarBadge || setChip ? '<div class="uif-card-tags">' + rarBadge + setChip + '</div>' : '') +
        specLine +
        '<div class="uif-card-footer">' +
          '<div class="uif-card-price">' + priceHtml + '</div>' +
          '<div class="uif-card-location" title="' + esc(item.obtain.length ? item.obtain[0].loc : '') + '">' + locHtml + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    // Set-Chip zuerst verdrahten und die Klicks dort stoppen — sonst oeffnet
    // der Karten-Handler darunter zusaetzlich das Modal.
    grid.querySelectorAll('.uif-setchip').forEach(function (chip) {
      chip.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        activeSet = chip.getAttribute('data-set');
        viewMode = 'items';
        currentPage = 1;
        applyFiltersAndSort();
      });
    });

    grid.querySelectorAll('.uif-card').forEach(function (card) {
      function find() {
        var id = card.getAttribute('data-id');
        for (var i = 0; i < ALL_ITEMS.length; i++) if (ALL_ITEMS[i].id === id) return ALL_ITEMS[i];
        return null;
      }
      card.addEventListener('click', function (e) {
        // Modifier-Klick und Mittelklick gehoeren dem Browser (neuer Tab).
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        var item = find();
        if (!item) return;
        e.preventDefault();
        openModal(item);
      });
      card.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        // Liegt der Fokus auf dem Titel-Link oder dem Set-Chip, gehoert die
        // Taste denen — sonst navigiert der Browser UND das Modal geht auf.
        if (e.target !== card) return;
        var item = find();
        if (!item) return;
        e.preventDefault();
        openModal(item);
      });
    });
  }

  // ---- Statuszeile ----
  function renderStatsHeader() {
    var count = document.getElementById('uif-stats-count');
    if (!count) return;
    var sets = viewMode === 'sets';
    var total = sets ? filteredSets.length : filteredItems.length;
    if (total === 0) {
      count.textContent = sets ? tr('setsShowingNone', '0 Sets') : tr('showingNone', '0 Einträge');
      return;
    }
    var start = (currentPage - 1) * itemsPerPage + 1;
    var end = Math.min(currentPage * itemsPerPage, total);
    var txt = (sets ? tr('setsShowing', '{start}–{end} von {total} Sets') : tr('showing', '{start}–{end} von {total} Einträgen'))
      .replace('{start}', fmtNum(start))
      .replace('{end}', fmtNum(end))
      .replace('{total}', fmtNum(total));
    // Aktiver Set-Filter: ohne sichtbaren Hinweis wirkt der Katalog kaputt
    // („warum sehe ich nur noch 6 Items?") — deshalb Name + Ausstieg anzeigen.
    var st = activeSet ? SETS[activeSet] : null;
    if (st) {
      count.innerHTML = esc(txt) +
        ' <span class="uif-activeset">' + esc(st.name) +
        ' <button type="button" id="uif-clear-set" title="' + esc(tr('setFilterClear', 'Set-Filter aufheben')) + '">×</button></span>';
      var btn = document.getElementById('uif-clear-set');
      if (btn) btn.addEventListener('click', function () {
        activeSet = null;
        currentPage = 1;
        applyFiltersAndSort();
      });
    } else {
      count.textContent = txt;
    }
  }

  // ---- Pagination ----
  function renderPagination() {
    var container = document.getElementById('uif-pagination-container');
    if (!container) return;

    var listLen = viewMode === 'sets' ? filteredSets.length : filteredItems.length;
    var totalPages = Math.ceil(listLen / itemsPerPage);
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
      if (viewMode === 'sets') renderSetsGrid(); else renderItemsGrid();
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
        loot: tr('kindLoot', 'Loot'),
        exclusive: tr('kindExclusive', 'Exklusiv')
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
    if (g.weight) chips.push([tr('facetWeight', 'Panzerungsklasse'), weightLabel(g.weight)]);
    if (g.rarity) chips.push([tr('facetRarity', 'Seltenheit'), rarityLabel(g.rarity)]);
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
      // Weg zur teilbaren, verlinkbaren Fassung derselben Daten.
      (hasPage(item)
        ? '<a class="uif-xlink uif-xlink--page" href="' + esc(itemUrl(item)) + '">' +
            esc(tr('openPage', 'Detailseite öffnen')) + ' →</a>'
        : '') +
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

    // Set-Zugehörigkeit — Teile desselben Sets sind direkt anklickbar
    var st = setOf(item);
    if (st) {
      var slotNames = Object.keys(st.slots).map(function (s) { return tr('slot' + s, s); });
      var siblings = [];
      for (var si = 0; si < ALL_ITEMS.length; si++) {
        var o2 = ALL_ITEMS[si];
        if (o2.id !== item.id && o2.game && o2.game.setId === st.id) siblings.push(o2);
      }
      siblings.sort(function (a, b) { return a.name.localeCompare(b.name); });
      html += '<div class="uif-modal-section uif-setbox">' +
        '<h4>' + esc(tr('setPartOf', 'Teil des Sets')) + ' · <a href="' + esc((CFG.setBase || '/armor-sets.html') + '#' + st.id) + '">' + esc(st.name) + '</a></h4>' +
        '<p class="uif-set-meta">' +
          (st.manufacturer ? esc(st.manufacturer) + ' · ' : '') +
          (st.weight ? esc(weightLabel(st.weight)) + ' · ' : '') +
          esc(st.parts + ' ' + tr('setPieces', 'Teile')) + ' · ' + esc(slotNames.join(' / ')) +
        '</p>' +
        (siblings.length
          ? '<div class="uif-set-links">' + siblings.slice(0, 24).map(function (s2) {
              return hasPage(s2)
                ? '<a class="uif-set-link" href="' + esc(itemUrl(s2)) + '">' + esc(s2.name) + '</a>'
                : '<span class="uif-set-link">' + esc(s2.name) + '</span>';
            }).join('') +
            (siblings.length > 24 ? '<span class="uif-set-link">+' + (siblings.length - 24) + '</span>' : '') +
            '</div>'
          : '') +
      '</div>';
    }

    // Bezugsquellen — oder ehrlicher Katalog-Hinweis
    if (item.obtain.length) {
      var rows = item.obtain.map(function (o) {
        // Exklusiv-Zeilen tragen keinen ORT, sondern eine Bezugsart — die wird
        // uebersetzt. Alle anderen `loc` sind Eigennamen und bleiben, wie sie sind.
        var locText = o.kind === 'exclusive' ? exclusiveLabel(o.reason) : o.loc;
        return '<tr class="uif-obtain-row">' +
          '<td>' + esc(locText) + '</td>' +
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
        // Zwei Ziele: die statische Blueprint-Seite (verlinkbar, indexiert) und
        // der interaktive Planer. DE liegt unter /de/, EN im Root.
        (bp.__slug
          ? '<a class="uif-xlink" href="' + (CFG.craftBase || '/crafting/') + esc(bp.__slug) + '.html">' + (XLINK_ICONS.bp || '') + esc(bp.name) + ' →</a> '
          : '') +
        '<a class="uif-xlink" href="' + (CFG.lang === 'de' ? '/de' : '') + '/topics/crafting.html?bp=' + encodeURIComponent(item.name) + '">' + esc(tr('openInCrafting', 'Im Crafting-Planer öffnen')) + ' →</a>' +
      '</div>';
    }

    content.innerHTML = html;
    // Die Bezugsquellen-Tabelle entsteht erst hier — Ziehen und die weiche
    // Kante muessen nachtraeglich angehaengt werden. assets/scroll-affordance.js.
    if (window.VBScrollAffordance) window.VBScrollAffordance();
    // Doppeltes Sperren verhindern: openModal kann aus einem offenen Modal
    // heraus erneut laufen (Verweis auf ein anderes Item).
    var wasOpen = modal.style.display === 'flex';
    modal.style.display = 'flex';
    // Geteilte Sperre statt body{overflow:hidden} — die Variante, die iOS
    // Safari am zuverlaessigsten uebergeht. Siehe assets/scroll-lock.js.
    if (!wasOpen && window.VBScrollLock) window.VBScrollLock.lock();
  }

  function closeModal() {
    var modal = document.getElementById('uif-item-modal');
    if (modal && modal.style.display !== 'none') {
      modal.style.display = 'none';
      if (window.VBScrollLock) window.VBScrollLock.unlock();
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
      SETS = {};
      (db.sets || []).forEach(function (s) { SETS[s.id] = s; });

      var craft = results[1];
      if (craft && craft.blueprints) {
        // Slugs exakt wie in src/lib/crafting.ts vergeben (gleiche Reihenfolge,
        // gleiches "-2"-Suffix bei Namensdubletten) — sonst zeigt der Link aus
        // dem Modal auf eine URL, die es nicht gibt.
        var usedSlug = {};
        craft.blueprints.forEach(function (bp) {
          if (!bp.name) return;
          var base = String(bp.name).toLowerCase()
            .replace(/['’"]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'blueprint';
          var n = (usedSlug[base] || 0) + 1;
          usedSlug[base] = n;
          bp.__slug = n > 1 ? base + '-' + n : base;
          CRAFTING_MAP[bp.name.toLowerCase()] = bp;
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
      renderWeightChips();
      renderRarityChips();
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
