// items-werkbank.js: Items-Werkbank (kanonische Quelle: /assets).
// Verzeichnis und Item Finder als EIN Werkzeug: Gruppen links, Treffer in der
// Mitte, das gewaehlte Item im Blatt. Liest assets/universal-items.json wie der
// Finder und zeigt nur, was im Katalog steht; Items ohne bekannte
// Bezugsquelle sagen das, statt einen Ort zu raten.
// Gestalt: src/lib/werkzeugStandard.ts. Texte und Baum: window.__WZI
// (src/components/items/ItemsWerkbank.astro).
(function () {
  'use strict';
  var C = window.__WZI || {};
  var T = C.t || {};
  var W = C.w || {};
  var DE = C.lang === 'de';
  var wz = document.getElementById('wz');
  if (!wz || wz.__wzi) return;
  wz.__wzi = true;

  function tr(k, f) { return T[k] != null ? T[k] : f; }
  function w(k) { return W[k] != null ? W[k] : k; }
  function $(id) { return document.getElementById(id); }
  var el = {
    gitter: $('wz-gitter'), n: $('wz-n'), nL: $('wz-n-l'), aktiv: $('wz-aktiv'), zahl: $('wz-zahl'),
    rail: $('wz-rail'), chips: $('wz-chips'), blatt: $('wz-blatt'), box: $('wz-blatt-box'),
    inh: $('wz-blatt-inh'), x: $('wz-blatt-x'), zur: $('wz-blatt-zur'), q: $('wz-q'), suche: $('wz-suche'),
    leeren: $('wz-leeren'), sort: $('wz-sort'), fk: $('wz-filterknopf'), sch: $('wz-schublade'),
    schX: $('wz-schublade-x'), fReset: $('wz-f-reset'), fZeigen: $('wz-f-zeigen'),
    fArt: $('wz-f-art'), fGr: $('wz-f-gr'), fPk: $('wz-f-pk'), fSel: $('wz-f-sel'), bereich: $('wz-bereich')
  };
  var UEBERBLICK = el.inh.innerHTML;
  var NF = DE ? 'de-DE' : 'en-US';
  var COLL = new Intl.Collator(DE ? 'de' : 'en', { sensitivity: 'base', ignorePunctuation: true, numeric: true });
  var TELEFON = window.matchMedia('(max-width:820px)');
  var SCHMAL = window.matchMedia('(max-width:480px)');
  var STILL = window.matchMedia('(prefers-reduced-motion:reduce)');
  var RING = '<svg viewBox="0 0 120 120" fill="none" aria-hidden="true"><circle class="wzb-ring__a" cx="60" cy="60" r="56"/>' +
    '<circle class="wzb-ring__b" cx="60" cy="60" r="44"/><path class="wzb-ring__c" d="M60 0v10M60 110v10M0 60h10M110 60h10"/></svg>';
  var SCHRITT = 60;

  // Tempo wie in der Crafting-Werkbank: --zt Auftritte, --zo Wiederholtes.
  var cs = getComputedStyle(wz);
  var ZT = parseFloat(cs.getPropertyValue('--zt')) || 1.5;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n, maxFrac) { return Number(n).toLocaleString(NF, maxFrac == null ? undefined : { maximumFractionDigits: maxFrac }); }
  function auec(n) { return fmt(n) + ' aUEC'; }

  /* ---------- Baum ---------- */
  var GRUPPEN = C.baum || [];
  // Ohne Prototyp: Schluessel kommen auch aus der Adresse (?gruppe=constructor).
  function karte() { return Object.create(null); }
  var G_ROOT = karte(), G_SLUG = karte(), B_SLUG = karte(), B_CAT = karte();
  GRUPPEN.forEach(function (g) {
    G_ROOT[g.r] = g; G_SLUG[g.s] = g;
    g.b.forEach(function (b) { b.gr = g; B_SLUG[b.s] = b; B_CAT[b.k] = b; });
  });
  function rootOf(cat) { return (cat || 'Other').split('/')[0].trim() || 'Other'; }
  function farbe(root) { return (C.farben && (C.farben[root] || C.farben.Other)) || '#A78BFA'; }

  /* ---------- Daten ---------- */
  var ITEMS = [], BYID = karte(), SETS = karte(), SETLISTE = [], FUNDORTE = null;
  var bereit = false;
  var ladeFehler = false;

  // Zwilling von isIndexable() in src/lib/items.ts (wie im Finder).
  function hasPage(it) {
    if (it.obtain.length > 0) return true;
    if (it.guide) return true;
    var g = it.game;
    if (!g || !g.stats) return false;
    for (var k in g.stats) if (Object.prototype.hasOwnProperty.call(g.stats, k)) return true;
    return false;
  }
  function itemUrl(it) { return (C.itemBase || '/items/') + encodeURIComponent(it.id) + '.html'; }
  function minPrice(it) {
    var p = Infinity;
    for (var i = 0; i < it.obtain.length; i++) { var o = it.obtain[i]; if (o.price != null && o.price > 0 && o.price < p) p = o.price; }
    return p === Infinity ? null : p;
  }
  // Zwilling von avgPrice() in src/lib/items.ts.
  function avgPrice(it) {
    var s = 0, n = 0;
    for (var i = 0; i < it.obtain.length; i++) { var o = it.obtain[i]; if (o.price != null && o.price > 0) { s += o.price; n++; } }
    return n === 0 ? null : Math.round(s / n);
  }
  function hasKind(it, kind) {
    if (kind === 'all') return true;
    if (kind === 'catalog') return it.obtain.length === 0;
    for (var i = 0; i < it.obtain.length; i++) {
      var k = it.obtain[i].kind;
      if (kind === 'buy' && (k === 'shop' || k === 'vehicle')) return true;
      if (kind === 'loot' && k === 'loot') return true;
      if (kind === 'exclusive' && k === 'exclusive') return true;
    }
    return false;
  }
  function weightLabel(v) { return v ? tr('w' + v.replace(/[^A-Za-z]/g, ''), v.replace(/\./g, ' ')) : ''; }
  function rarityLabel(r) { return r ? tr('r' + r, r) : ''; }
  function exclusiveLabel(reason) {
    if (!reason) return tr('notLootable', 'Nicht als Loot erhältlich');
    return tr('ex' + reason.replace(/[^A-Za-z]/g, ''), reason);
  }
  // Zwilling von obtainLabel() in src/i18n/itemText.ts.
  function obtainText(o) {
    if (o.kind === 'exclusive') return exclusiveLabel(o.reason);
    if (o.ort) return DE ? (o.locDe || o.loc) : o.loc;
    return o.loc;
  }
  // Zwilling von woText() in src/lib/items.ts.
  function woText(wo) {
    if (!wo) return '';
    var sys = (FUNDORTE && FUNDORTE.systeme) || {};
    return Object.keys(wo).map(function (k) {
      return (sys[k] || k) + ': ' + wo[k].map(function (n) { return n === '*' ? tr('inSpace', w('imAll')) : n; }).join(', ');
    }).join(' · ');
  }
  // Zwilling von lootZeilen() in src/lib/items.ts: bestaetigte Fundorte hinter
  // die Kaufzeilen, vor die uebrigen.
  function lootZeilen(it) {
    var p = FUNDORTE && it.fund != null ? FUNDORTE.profile[it.fund] : null;
    if (!p) return;
    var neu = [];
    for (var i = 0; i < p.length; i++) {
      var art = FUNDORTE.arten[p[i][0]];
      if (!art) continue;
      neu.push({ kind: 'loot', loc: art.en, locDe: art.de, ort: p[i][0], wo: p[i][1] });
    }
    if (!neu.length) return;
    var preis = it.obtain.filter(function (o) { return o.price != null; });
    var rest = it.obtain.filter(function (o) { return o.price == null; });
    it.obtain = preis.concat(neu, rest);
  }
  function setOf(it) { return it.game && it.game.setId ? SETS[it.game.setId] || null : null; }
  function hasGradeSemantics(it) { return /Vehiclegear|Weapons|Armour|Attachment/.test(it._root || rootOf(it.category)); }
  var GRADE_BEARING = null;
  // Spiegel von GRADE_BEARING_TYPES in src/lib/items.ts (wie im Finder).
  function gradeBearingTypes() {
    if (GRADE_BEARING) return GRADE_BEARING;
    var byType = {};
    ITEMS.forEach(function (it) {
      var g = it.game; if (!g || !g.gameType || !g.grade) return;
      var m = byType[g.gameType] || (byType[g.gameType] = {});
      m[g.grade] = (m[g.grade] || 0) + 1;
    });
    GRADE_BEARING = {};
    Object.keys(byType).forEach(function (t) {
      var counts = Object.keys(byType[t]).map(function (k) { return byType[t][k]; });
      if (counts.length < 2) return;
      var total = counts.reduce(function (a, b) { return a + b; }, 0);
      if (Math.min.apply(null, counts) / total >= 0.1) GRADE_BEARING[t] = true;
    });
    return GRADE_BEARING;
  }
  function hasMeaningfulGrade(it) {
    var t = it.game && it.game.gameType;
    return !!t && hasGradeSemantics(it) && !!gradeBearingTypes()[t];
  }
  function itemSizes(it) {
    var g = it.game; if (!g) return [];
    if (g.sizes && g.sizes.length) return g.sizes;
    return g.size != null ? [g.size] : [];
  }
  function sizeLabel(it) {
    var s = itemSizes(it);
    return s.length ? s.map(function (n) { return 'S' + n; }).join(' / ') : null;
  }
  // Hersteller nur mit Anzeigenamen (Regel wie im Finder und in itemStats.ts).
  function mfrName(m) { return m && !/^[A-Z][A-Za-z0-9]*(?:_[A-Za-z0-9]+){2,}$/.test(m) ? m : null; }

  // Schluessel-Wert je Item: Marke auf der Kachel, Sortierung „Wert".
  function primaryStat(it) {
    var g = it.game, s = g && g.stats;
    if (!s) return null;
    if (s.dps) return { l: tr('statDps', 'DPS'), v: fmt(s.dps) + ' DPS', n: s.dps };
    if (s.shieldHp) return { l: tr('statShieldHp', 'Schild-HP'), v: fmt(s.shieldHp) + ' HP', n: s.shieldHp };
    if (s.driveSpeed) return { l: tr('statQtSpeed', 'QT'), v: fmt(Math.round(s.driveSpeed / 1e6)) + ' Mm/s', n: s.driveSpeed };
    if (s.coolingRate) return { l: tr('statCooling', 'Kühlleistung'), v: fmt(s.coolingRate), n: s.coolingRate };
    if (s.powerOutput) return { l: tr('statPower', 'Leistung'), v: fmt(s.powerOutput), n: s.powerOutput };
    if (s.jammerRange) return { l: tr('statJammer', 'Jammer'), v: fmt(s.jammerRange) + ' m', n: s.jammerRange };
    if (s.empRadius) return { l: tr('statEmpRadius', 'EMP'), v: fmt(s.empRadius) + ' m', n: s.empRadius };
    if (s.fuelCapacity) return { l: tr('statFuel', 'Treibstoff'), v: fmt(s.fuelCapacity), n: s.fuelCapacity };
    if (s.damage) { var tot = 0; for (var k in s.damage) tot += s.damage[k]; return { l: tr('statDamage', 'Schaden'), v: fmt(tot), n: tot }; }
    if (s.resist && typeof s.resist.physical === 'number') { var red = Math.round((1 - s.resist.physical) * 100); return { l: tr('statResist', 'Reduktion'), v: red + '%', n: red }; }
    if (s.ndr) return { l: tr('statNdr', 'NDR'), v: fmt(s.ndr) + ' NDR', n: s.ndr };
    if (s.sensitivity) return { l: tr('statSensitivity', 'Empfindlichkeit'), v: fmt(s.sensitivity), n: s.sensitivity };
    if (s.storageScu) return { l: tr('statStorage', 'Stauraum'), v: fmt(s.storageScu) + ' SCU', n: s.storageScu };
    if (s.health) return { l: tr('statHealth', 'HP'), v: fmt(s.health) + ' HP', n: s.health };
    return null;
  }
  var DMG = null;
  function dmgLabels() {
    if (!DMG) DMG = {
      physical: tr('dmgPhysical', 'Physisch'), energy: tr('dmgEnergy', 'Energie'),
      distortion: tr('dmgDistortion', 'Distortion'), thermal: tr('dmgThermal', 'Thermal'),
      biochemical: tr('dmgBio', 'Biochem'), stun: tr('dmgStun', 'Betäubung')
    };
    return DMG;
  }
  function fmtDamage(d) {
    var L = dmgLabels(), out = [];
    ['physical', 'energy', 'distortion', 'thermal', 'biochemical', 'stun'].forEach(function (k) {
      if (d[k] && d[k] > 0) out.push(fmt(d[k]) + ' ' + L[k]);
    });
    return out.join(' · ');
  }
  function fmtResist(res) {
    // Ruestung: Multiplikator -> Reduktion in %; Schild: Spanne [min, max]
    // schon als Widerstandsanteil (wie src/lib/itemStats.ts und der Finder).
    var L = dmgLabels(), keys = ['physical', 'energy', 'distortion', 'thermal', 'biochemical'];
    var vals = keys.filter(function (k) { return res[k] != null; });
    if (!vals.length) return null;
    var pct = function (k) {
      var v = res[k];
      if (!Array.isArray(v)) return Math.round((1 - v) * 100) + '%';
      var lo = Math.round(v[0] * 100), hi = Math.round(v[1] * 100);
      return lo === hi ? lo + '%' : lo + '–' + hi + '%';
    };
    var gleich = vals.every(function (k) { return pct(k) === pct(vals[0]); });
    if (gleich) return tr('resistAll', 'Alle') + ' ' + pct(vals[0]);
    return vals.map(function (k) { return L[k] + ' ' + pct(k); }).join(' · ');
  }
  function statEntries(it) {
    var g = it.game, s = g && g.stats; if (!s) return [];
    var out = [];
    if (s.damage) { var d = fmtDamage(s.damage); if (d) out.push([tr('statDamage', 'Schaden'), d]); }
    if (s.blastRadius) out.push([tr('statBlast', 'Explosionsradius'), fmt(s.blastRadius) + ' m']);
    if (s.fireRate) out.push([tr('statFireRate', 'Feuerrate'), fmt(s.fireRate) + ' ' + tr('unitRpm', 'Schuss/min')]);
    if (s.dps) out.push([tr('statDps', 'DPS'), fmt(s.dps)]);
    if (s.magazine) out.push([tr('statMagazine', 'Magazin'), fmt(s.magazine)]);
    if (s.shieldHp) out.push([tr('statShieldHp', 'Schild-HP'), fmt(s.shieldHp)]);
    if (s.regen) out.push([tr('statRegen', 'Schild-Regen'), fmt(s.regen) + '/s']);
    if (s.driveSpeed) out.push([tr('statQtSpeed', 'QT-Geschwindigkeit'), fmt(Math.round(s.driveSpeed / 1e6)) + ' Mm/s']);
    if (s.cooldown) out.push([tr('statCooldown', 'Abklingzeit'), fmt(s.cooldown) + ' s']);
    if (s.coolingRate) out.push([tr('statCooling', 'Kühlleistung'), fmt(s.coolingRate)]);
    if (s.powerOutput) out.push([tr('statPower', 'Leistung'), fmt(s.powerOutput)]);
    if (s.fuelCapacity) out.push([tr('statFuel', 'Treibstoff-Kapazität'), fmt(s.fuelCapacity)]);
    if (s.sensitivity) out.push([tr('statSensitivity', 'Signatur-Empfindlichkeit'), fmt(s.sensitivity)]);
    if (s.jammerRange) out.push([tr('statJammer', 'QT-Jammer-Reichweite'), fmt(s.jammerRange) + ' m']);
    if (s.empRadius) out.push([tr('statEmpRadius', 'EMP-Radius'), fmt(s.empRadius) + ' m']);
    if (s.distortionDamage) out.push([tr('statDistortion', 'Distortion-Schaden'), fmt(s.distortionDamage)]);
    if (s.chargeTime) out.push([tr('statCharge', 'Ladezeit'), fmt(s.chargeTime) + ' s']);
    if (s.resist) { var r = fmtResist(s.resist); if (r) out.push([tr('statResist', 'Schadensreduktion'), r]); }
    if (s.tempMin != null && s.tempMax != null) out.push([tr('statTemp', 'Temp.-Rating'), s.tempMin + ' / ' + s.tempMax + ' °C']);
    if (s.radiation) out.push([tr('statRadiation', 'Strahlungsschutz'), fmt(s.radiation) + ' REM']);
    if (s.ndr) out.push([tr('statNdr', 'Nährwert (NDR)'), fmt(s.ndr)]);
    if (s.effects && s.effects.length) out.push([tr('statEffects', 'Effekte'), s.effects.join(', ')]);
    if (s.storageScu) out.push([tr('statStorage', 'Stauraum'), fmt(s.storageScu) + ' SCU']);
    if (s.lifetime) out.push([tr('statLifetime', 'Flugzeit'), fmt(s.lifetime) + ' s']);
    if (s.health) out.push([tr('statHealth', 'Bauteil-HP'), fmt(s.health)]);
    return out;
  }
  // Kennwerte oben im Blatt: kurze Bezeichnung, Zahl, Einheit klein.
  function kennStats(it) {
    var s = it.game && it.game.stats; if (!s) return [];
    var k = [];
    function add(l, v, u) { k.push({ l: l, v: v, u: u || '' }); }
    if (s.dps) add(tr('statDps', 'DPS'), fmt(s.dps));
    if (s.damage) { var t = 0; for (var x in s.damage) t += s.damage[x]; if (t > 0) add(tr('statDamage', 'Schaden'), fmt(t)); }
    if (s.fireRate) add(tr('statFireRate', 'Feuerrate'), fmt(s.fireRate), tr('unitRpm', 'Schuss/min'));
    if (s.magazine) add(tr('statMagazine', 'Magazin'), fmt(s.magazine));
    if (s.shieldHp) add(tr('statShieldHp', 'Schild-HP'), fmt(s.shieldHp));
    if (s.regen) add(tr('statRegen', 'Schild-Regen'), fmt(s.regen), '/s');
    if (s.driveSpeed) add(tr('statQtSpeed', 'QT'), fmt(Math.round(s.driveSpeed / 1e6)), 'Mm/s');
    if (s.coolingRate) add(tr('statCooling', 'Kühlleistung'), fmt(s.coolingRate));
    if (s.powerOutput) add(tr('statPower', 'Leistung'), fmt(s.powerOutput));
    if (s.resist && typeof s.resist.physical === 'number') add(tr('statResist', 'Reduktion'), Math.round((1 - s.resist.physical) * 100), '%');
    if (s.tempMin != null && s.tempMax != null) add(tr('statTemp', 'Temp.'), s.tempMin + ' / ' + s.tempMax, '°C');
    if (s.storageScu) add(tr('statStorage', 'Stauraum'), fmt(s.storageScu), 'SCU');
    if (s.radiation) add(tr('statRadiation', 'Strahlung'), fmt(s.radiation), 'REM');
    if (s.ndr) add('NDR', fmt(s.ndr));
    if (s.fuelCapacity) add(tr('statFuel', 'Treibstoff'), fmt(s.fuelCapacity));
    if (s.empRadius) add(tr('statEmpRadius', 'EMP'), fmt(s.empRadius), 'm');
    if (s.jammerRange) add(tr('statJammer', 'Jammer'), fmt(s.jammerRange), 'm');
    if (s.health) add(tr('statHealth', 'HP'), fmt(s.health));
    return k;
  }

  function zeichen(it) {
    var z = C.zb && C.zb[it.category];
    if (z) return z;
    var root = it._root;
    if (root === 'Weapons') {
      var st = it.game && it.game.subType;
      if (st === 'Small') return 'pistol';
      if (st === 'Large') return 'lmg';
    }
    if (root === 'Armour' && !(it.game && it.game.subType)) return 'plate';
    return (C.zg && C.zg[root]) || 'chip';
  }

  function vorbereiten(db) {
    ITEMS = db.items || [];
    FUNDORTE = db.fundorte || null;
    SETS = karte();
    SETLISTE = db.sets || [];
    SETLISTE.forEach(function (s) { SETS[s.id] = s; });
    ITEMS.forEach(function (it) {
      if (FUNDORTE) lootZeilen(it);
      var g = it.game || null;
      it._root = rootOf(it.category);
      it._gr = G_ROOT[it._root] || null;
      it._b = B_CAT[it.category] || null;
      it._kc = farbe(it._root);
      it._g = zeichen(it);
      var nde = g && g.nameDe ? String(g.nameDe).trim() : '';
      it._n = DE && nde ? nde : it.name;
      it._alt = nde && nde !== it.name ? (DE ? it.name : nde) : null;
      it._p = minPrice(it);
      it._ps = primaryStat(it);
      it._page = hasPage(it);
      // Grundrang fuer „Empfohlen“: erst Items, die man kaufen oder finden
      // kann, dann exklusive, dann reine Katalogeintraege; innerhalb davon
      // die mit Datenblatt zuerst. Namen, die mit Ziffer oder Zeichen
      // beginnen, nach hinten.
      it._r = (/^[a-z\u00c0-\u024f]/i.test(it._n) ? 0 : 6) +
        (hasKind(it, 'buy') || hasKind(it, 'loot') ? 0 : it.obtain.length ? 2 : 4) + (it._page ? 0 : 1);
      it._sz = itemSizes(it);
      var st = setOf(it);
      var heu = [it.name, nde, it.category, it._gr ? it._gr.n : '', it._b ? it._b.n : '',
        g && g.manufacturer, g && g.class, g && g.subType, st && st.name];
      for (var i = 0; i < it.obtain.length; i++) {
        var ob = it.obtain[i];
        heu.push(ob.loc, ob.locDe);
        // Bestaetigte Fundorte: System und Ortsnamen, wie sie im Blatt stehen.
        if (ob.wo) Object.keys(ob.wo).forEach(function (k) {
          heu.push((FUNDORTE.systeme || {})[k] || k);
          ob.wo[k].forEach(function (n) { if (n !== '*') heu.push(n); });
        });
      }
      it._h = heu.filter(Boolean).join('\n').toLowerCase();
      BYID[it.id] = it;
    });
    // Name A–Z, das Grundmodell vor seinen Varianten: Karna "Alpine Sunset"
    // Rifle steht hinter Karna Rifle, nicht davor. Eine Variante traegt
    // ihren Zusatz in Anfuehrungszeichen mitten im Namen.
    ITEMS.forEach(function (it) {
      var b = it._n.replace(/\s+["\u201c\u201e][^"\u201c\u201d\u201e]+["\u201c\u201d]\s*/g, ' ').trim();
      it._basis = b;
      it._var = b !== it._n.trim() ? 1 : 0;
    });
    var ord = ITEMS.slice().sort(function (a, b) {
      return COLL.compare(a._basis, b._basis) || a._var - b._var || COLL.compare(a._n, b._n) || (a.id < b.id ? -1 : 1);
    });
    ord.forEach(function (it, i) { it._o = i; });
    SETLISTE.forEach(function (s) { s._h = [s.name, s.manufacturer, s.weight].filter(Boolean).join('\n').toLowerCase(); });
    SETLISTE.sort(function (a, b) { return COLL.compare(a.name, b.name); });
  }

  /* ---------- Zustand ---------- */
  var S = {
    tab: 'items', gruppe: null, blatt: null, q: '', art: 'all', gr: null, pk: null, sel: null,
    set: null, sort: 'relevanz', ansicht: 'kacheln', item: null, satz: null
  };
  var QW = [];          // Suchwoerter
  var TREFFER = [];     // gefilterte, sortierte Items bzw. Sets
  var GEZEIGT = 0;      // gezeichnete Kacheln
  var STAPEL = [];      // Zurueck-Weg im Blatt
  var erstesBild = true;

  function trifft(h) {
    for (var i = 0; i < QW.length; i++) if (h.indexOf(QW[i]) < 0) return false;
    return true;
  }
  function passt(it, ohne) {
    if (S.blatt) { if (it.category !== S.blatt.k) return false; }
    else if (S.gruppe && it._root !== S.gruppe.r) return false;
    if (ohne !== 'art' && S.art !== 'all' && !hasKind(it, S.art)) return false;
    if (ohne !== 'gr' && S.gr != null && it._sz.indexOf(S.gr) < 0) return false;
    if (ohne !== 'pk' && S.pk && !(it.game && it.game.weight === S.pk)) return false;
    if (ohne !== 'sel' && S.sel && !(it.game && it.game.rarity === S.sel)) return false;
    if (S.set && !(it.game && it.game.setId === S.set)) return false;
    if (QW.length && !trifft(it._h)) return false;
    return true;
  }
  // Wie gut trifft der Name die Suche? 0 genau, 1 beginnt damit, 2 alle
  // Woerter am Wortanfang, 3 alle Woerter irgendwo, 4 nur Hersteller, Ort usw.
  function suchRang(it) {
    var n = it._n.toLowerCase(), q = QW.join(' ');
    if (n === q) return 0;
    if (n.indexOf(q) === 0) return 1;
    var anfang = true;
    for (var i = 0; i < QW.length; i++) {
      var k = n.indexOf(QW[i]);
      if (k < 0) return 4;
      if (k > 0 && /[0-9a-z\u00c0-\u024f]/i.test(n.charAt(k - 1))) anfang = false;
    }
    return anfang ? 2 : 3;
  }
  function sortiere(list) {
    var s = S.sort;
    if (s === 'relevanz') {
      if (QW.length) list.forEach(function (it) { it._sr = suchRang(it); });
      return list.sort(function (a, b) {
        return (QW.length ? a._sr - b._sr : 0) || a._r - b._r || a._o - b._o;
      });
    }
    if (s === 'name') return list.sort(function (a, b) { return a._o - b._o; });
    if (s === 'name-z') return list.sort(function (a, b) { return b._o - a._o; });
    if (s === 'wert') return list.sort(function (a, b) {
      var na = a._ps ? a._ps.n : null, nb = b._ps ? b._ps.n : null;
      if (na == null && nb == null) return a._o - b._o;
      if (na == null) return 1;
      if (nb == null) return -1;
      return nb - na || a._o - b._o;
    });
    var auf = s === 'preis';
    return list.sort(function (a, b) {
      if (a._p == null && b._p == null) return a._o - b._o;
      if (a._p == null) return 1;
      if (b._p == null) return -1;
      return (auf ? a._p - b._p : b._p - a._p) || a._o - b._o;
    });
  }
  function setPasst(s) {
    if (S.pk && s.weight !== S.pk) return false;
    if (QW.length && !trifft(s._h)) return false;
    return true;
  }

  /* ---------- Treffer ---------- */
  var io = null;
  function beobachter() {
    if (io) io.disconnect();
    if (!('IntersectionObserver' in window)) return;
    var oy = getComputedStyle(el.gitter).overflowY;
    io = new IntersectionObserver(function (es) {
      for (var i = 0; i < es.length; i++) if (es[i].isIntersecting) { mehr(); break; }
    }, { root: oy === 'auto' || oy === 'scroll' ? el.gitter : null, rootMargin: '0px 0px 600px 0px' });
    var m = el.gitter.querySelector('.wz-mehr');
    if (m) io.observe(m);
  }

  // Sets kennen keinen Wert und keinen Preis: dort stehen nur die
  // Sortierungen zur Wahl, die auch wirken. S.sort bleibt fuer den
  // Reiter Items stehen.
  var SORT_SETS = { relevanz: 1, name: 1, 'name-z': 1 };
  function sortWahl() {
    var sets = S.tab === 'sets';
    Array.prototype.forEach.call(el.sort.options, function (o) {
      var weg = sets && !SORT_SETS[o.value];
      o.hidden = weg; o.disabled = weg;
    });
    el.sort.value = sets && !SORT_SETS[S.sort] ? 'relevanz' : S.sort;
  }

  function anwenden(opt) {
    opt = opt || {};
    QW = S.q.toLowerCase().split(/\s+/).filter(Boolean);
    // Vor dem Katalog gibt es nichts zu durchsuchen: weder „Nichts gefunden“
    // noch eine geleerte Trefferliste, solange er laedt, und beim Ladefehler
    // bleibt der Fehler stehen. Der Stand S gilt, sobald der Katalog da ist.
    if (!bereit) { if (ladeFehler) zeigeLadefehler(); return; }
    sortWahl();
    if (S.tab === 'sets') {
      TREFFER = SETLISTE.filter(setPasst);
      if (S.sort === 'name-z') TREFFER.reverse();
    } else {
      TREFFER = sortiere(ITEMS.filter(function (it) { return passt(it); }));
    }
    zeichneTreffer(opt);
    zeichneZahl();
    zeichneFilter();
    zeichneLeiste();
    zeichneChips();
    if (!opt.ohneUrl) schreibeUrl();
  }

  function hl(text) {
    var t = String(text);
    if (!QW.length) return esc(t);
    var low = t.toLowerCase(), marks = [];
    QW.forEach(function (q) {
      var i = low.indexOf(q);
      if (i >= 0) marks.push([i, i + q.length]);
    });
    if (!marks.length) return esc(t);
    marks.sort(function (a, b) { return a[0] - b[0]; });
    var out = '', pos = 0;
    marks.forEach(function (m) {
      if (m[0] < pos) return;
      out += esc(t.slice(pos, m[0])) + '<mark>' + esc(t.slice(m[0], m[1])) + '</mark>';
      pos = m[1];
    });
    return out + esc(t.slice(pos));
  }

  function kachel(it) {
    var g = it.game;
    var pfad = '<span>' + esc(it._gr ? it._gr.n : it._root) + '</span>';
    if (it._b && it.category.indexOf('/') > 0) pfad += '<span>' + esc(it._b.n) + '</span>';
    var wert = it._ps ? '<span class="wz-k__wert" title="' + esc(it._ps.l) + '">' + esc(it._ps.v) + '</span>' : '';
    var name = it._page
      ? '<a href="' + esc(itemUrl(it)) + '">' + hl(it._n) + '</a>'
      : '<span>' + hl(it._n) + '</span>';
    var meta = [];
    if (g) {
      if (mfrName(g.manufacturer)) meta.push(mfrName(g.manufacturer));
      if (g.weight) meta.push(weightLabel(g.weight));
      if (hasGradeSemantics(it)) {
        var sl = sizeLabel(it); if (sl) meta.push(sl);
        if (g.grade && hasMeaningfulGrade(it)) meta.push('Grade ' + g.grade);
      }
    }
    var tags = '';
    if (g && g.rarity) tags += '<li class="wz-tag" data-sel="' + esc(g.rarity) + '">' + esc(rarityLabel(g.rarity)) + '</li>';
    var st = setOf(it);
    if (st && st.id !== S.set) tags += '<li><button type="button" class="wz-tag" data-set="' + esc(st.id) + '" title="' + esc(tr('facetSet', 'Set')) + '"><span class="wi wi--layers" aria-hidden="true"></span>' + esc(st.name) + '</button></li>';
    var preis, ort, erz;
    if (it._p != null) {
      preis = '<span class="wz-k__preis">' + (it.obtain.length > 1 ? esc(tr('priceFrom', 'ab')) + ' ' : '') + esc(auec(it._p)) + '</span>';
    } else if (it.obtain.length) {
      var nurEx = it.obtain.every(function (o) { return o.kind === 'exclusive'; });
      preis = '<span class="wz-k__preis is-still">' + esc(nurEx ? tr('kindExclusive', 'Exklusiv') : tr('lootOnly', 'Nur Loot')) + '</span>';
    } else {
      preis = '<span class="wz-k__preis is-still">' + esc(tr('noTradeData', 'Keine Handelsdaten')) + '</span>';
    }
    if (it.obtain.length) {
      var extra = it.obtain.length - 1;
      ort = '<span class="wz-k__ort" title="' + esc(obtainText(it.obtain[0])) + '"><span class="wi wi--pick" aria-hidden="true"></span><span>' + esc(obtainText(it.obtain[0])) + '</span>' + (extra > 0 ? '<i>+' + extra + '</i>' : '') + '</span>';
    } else if ((erz = erzVon(it))) {
      ort = '<span class="wz-k__ort"><span class="wi wi--mining" aria-hidden="true"></span><span>' + esc(erz.n ? tr('oreCard', 'Abbau · {n} Fundorte').replace('{n}', fmt(erz.n)) : tr('oreCardOhne', 'Abbau')) + '</span></span>';
    } else {
      ort = '<span class="wz-k__ort is-still"><span>' + esc(tr('noSourceData', 'Kein Fundort bekannt')) + '</span></span>';
    }
    var sel = S.item === it.id ? ' is-sel' : '';
    return '<article class="wz-k' + sel + '" data-id="' + esc(it.id) + '" style="--kc:' + it._kc + '"' + (it._page ? '' : ' tabindex="0" role="button"') + '>' +
      '<div class="wz-k__kopf"><span class="wz-z" data-g="' + it._g + '" aria-hidden="true"></span><span class="wz-k__pfad">' + pfad + '</span>' + wert + '</div>' +
      '<h3 class="wz-k__name">' + name + '</h3>' +
      (meta.length ? '<p class="wz-k__meta">' + esc(meta.join(' · ')) + '</p>' : '') +
      (tags ? '<ul class="wz-k__tags">' + tags + '</ul>' : '') +
      '<div class="wz-k__fuss">' + preis + ort + '</div>' +
    '</article>';
  }

  function setKachel(s) {
    var slots = Object.keys(s.slots || {}).map(function (k) { return tr('slot' + k, k); });
    var komplett = s.coreSlots === 4;
    var marke = '<span class="wz-k__wert">' + esc(komplett ? w('setKomplett') : w('setTeilweise').replace('{n}', s.coreSlots)) + '</span>';
    var sel = S.satz === s.id ? ' is-sel' : '';
    return '<article class="wz-k' + sel + '" data-satz="' + esc(s.id) + '" tabindex="0" role="button" style="--kc:' + farbe('Armour') + '">' +
      '<div class="wz-k__kopf"><span class="wz-z" data-g="core" aria-hidden="true"></span><span class="wz-k__pfad"><span>' + esc(s.manufacturer || w('tabSets')) + '</span>' +
        (s.weight ? '<span>' + esc(weightLabel(s.weight)) + '</span>' : '') + '</span>' + marke + '</div>' +
      '<h3 class="wz-k__name"><span>' + hl(s.name) + '</span></h3>' +
      '<p class="wz-k__meta">' + esc(slots.join(' · ')) + '</p>' +
      '<div class="wz-k__fuss"><span class="wz-k__preis">' + esc(fmt(s.parts) + ' ' + (s.parts === 1 ? tr('setPiece', 'Teil') : tr('setPieces', 'Teile'))) + '</span>' +
        '<span class="wz-k__ort"><span>' + esc(w('setAnsehen')) + '</span><span class="wi wi--arrow" aria-hidden="true"></span></span></div>' +
    '</article>';
  }

  // Der Katalog kam nicht: das sagt die Liste, mit einem neuen Abruf, und
  // keine Suche ersetzt es durch „Nichts gefunden“ (anwenden prueft bereit).
  var GITTER_ANFANG = el.gitter.innerHTML;
  function zeigeLadefehler() {
    el.gitter.removeAttribute('aria-busy');
    el.gitter.innerHTML = '<div class="wz-leer" role="alert"><b>' + esc(w('ladeT')) + '</b><p>' + esc(tr('loadError', 'Die Item-Datenbank konnte nicht geladen werden.')) + '</p>' +
      '<button class="wz-knopf" type="button" data-neu-laden>' + esc(w('ladeK')) + '</button></div>';
  }
  el.gitter.addEventListener('click', function (e) {
    if (!e.target.closest || !e.target.closest('[data-neu-laden]')) return;
    el.gitter.innerHTML = GITTER_ANFANG;
    ladeKatalog();
  });

  function zeichneTreffer(opt) {
    var g = el.gitter;
    g.removeAttribute('aria-busy');
    g.classList.toggle('is-liste', S.ansicht === 'liste');
    if (!TREFFER.length) {
      g.innerHTML = '<div class="wz-leer"><b>' + esc(w('leerT')) + '</b><p>' + esc(w('leerX')) + '</p>' +
        '<button class="wz-knopf" type="button" data-alles-weg>' + esc(w('leerK')) + '</button></div>';
      GEZEIGT = 0;
      beobachter();
      return;
    }
    GEZEIGT = Math.min(SCHRITT, TREFFER.length);
    // Steht die Auswahl (Item oder Set) weiter hinten, zeichne bis dorthin (tiefer Link).
    var ziel = opt.bisAuswahl ? (S.tab === 'sets' ? S.satz : S.item) : null;
    if (ziel) {
      for (var i = 0; i < TREFFER.length; i++) if (TREFFER[i].id === ziel) { GEZEIGT = Math.max(GEZEIGT, Math.min(TREFFER.length, i + 12)); break; }
    }
    var html = '';
    var bau = S.tab === 'sets' ? setKachel : kachel;
    for (var k = 0; k < GEZEIGT; k++) html += bau(TREFFER[k]);
    if (GEZEIGT < TREFFER.length) html += '<div class="wz-mehr" aria-hidden="true"></div>';
    g.innerHTML = html;
    if (!opt.halteRoll) g.scrollTop = 0;
    if (erstesBild) {
      erstesBild = false;
      if (!STILL.matches) {
        g.classList.add('wz-auf');
        setTimeout(function () { g.classList.remove('wz-auf'); }, Math.round(1400 * ZT));
      }
    } else if (!opt.still) {
      g.classList.remove('is-frisch');
      void g.offsetWidth;
      g.classList.add('is-frisch');
    }
    beobachter();
    if (window.VBScrollAffordance) window.VBScrollAffordance();
  }
  el.gitter.addEventListener('animationend', function (e) { if (e.target === el.gitter) el.gitter.classList.remove('is-frisch'); });

  function mehr() {
    if (GEZEIGT >= TREFFER.length) return;
    var bis = Math.min(TREFFER.length, GEZEIGT + SCHRITT);
    var bau = S.tab === 'sets' ? setKachel : kachel;
    var html = '';
    for (var k = GEZEIGT; k < bis; k++) html += bau(TREFFER[k]);
    GEZEIGT = bis;
    var m = el.gitter.querySelector('.wz-mehr');
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    var frag = document.createDocumentFragment();
    while (tmp.firstChild) {
      if (tmp.firstChild.classList && !STILL.matches) tmp.firstChild.classList.add('is-nach');
      frag.appendChild(tmp.firstChild);
    }
    el.gitter.insertBefore(frag, m);
    if (!m) return;
    if (GEZEIGT >= TREFFER.length) { m.remove(); return; }
    // Bleibt die Marke im Blick (hoher Schirm, kurze Kacheln), meldet der
    // Beobachter keinen Wechsel mehr: neu beobachten, dann misst er sofort.
    if (io) { io.unobserve(m); io.observe(m); }
  }
  el.gitter.addEventListener('animationend', function (e) {
    if (e.target.classList && e.target.classList.contains('is-nach')) e.target.classList.remove('is-nach');
  });

  var letzteZahl = null;
  function zeichneZahl() {
    var n = TREFFER.length;
    var txt = fmt(n);
    if (el.n.textContent !== txt) {
      el.n.textContent = txt;
      if (letzteZahl != null && !STILL.matches) {
        el.n.classList.remove('is-tick'); void el.n.offsetWidth; el.n.classList.add('is-tick');
      }
    }
    letzteZahl = n;
    el.nL.textContent = S.tab === 'sets' ? w('nSets') : w('nItems');
    // Gesetzte Eingrenzungen als Chips: ein Klick nimmt sie heraus.
    var c = [];
    function chip(key, text, kc) {
      c.push('<button type="button" class="wz-fchip" data-weg="' + key + '"' + (kc ? ' style="--kc:' + kc + '"' : '') + '>' + esc(text) + '<span class="wi wi--close" aria-hidden="true"></span></button>');
    }
    if (S.tab === 'items') {
      if (S.blatt) chip('kat', S.blatt.gr.n + ' / ' + S.blatt.n, S.blatt.gr.f);
      else if (S.gruppe) chip('kat', S.gruppe.n, S.gruppe.f);
      if (S.set && SETS[S.set]) chip('set', w('setFilter').replace('{name}', SETS[S.set].name));
      if (S.art !== 'all') chip('art', artLabel(S.art));
      if (S.gr != null) chip('gr', 'S' + S.gr);
      if (S.sel) chip('sel', rarityLabel(S.sel));
    }
    if (S.pk) chip('pk', weightLabel(S.pk));
    el.aktiv.innerHTML = c.join('');
    // Im Reiter Sets wirkt nur die Panzerungsklasse; nur sie zaehlt.
    var nF = S.tab === 'sets' ? (S.pk ? 1 : 0)
      : (S.art !== 'all' ? 1 : 0) + (S.gr != null ? 1 : 0) + (S.pk ? 1 : 0) + (S.sel ? 1 : 0);
    if (nF) el.fk.setAttribute('data-n', nF); else el.fk.removeAttribute('data-n');
    el.fZeigen.textContent = n ? w('zeigen').replace('{n}', fmt(n)) : w('keine');
    el.fZeigen.classList.toggle('is-leer', !n);
    messen();
  }

  /* ---------- Filter (Schublade) ---------- */
  var RAR = { Common: 1, Uncommon: 2, Rare: 3, Epic: 4, Legendary: 5 };
  var GEW = { Undersuit: 1, Light: 2, Medium: 3, Heavy: 4, SuperHeavy: 5, Flightsuit: 6 };
  function artLabel(a) {
    return { all: tr('kindAll', 'Alle'), buy: tr('kindBuy', 'Kaufbar'), loot: tr('kindLoot', 'Loot'), exclusive: tr('kindExclusive', 'Exklusiv'), catalog: tr('kindCatalog', 'Nur Katalog') }[a] || a;
  }
  function zaehle(ohne, wert) {
    var m = {};
    for (var i = 0; i < ITEMS.length; i++) {
      var it = ITEMS[i];
      if (!passt(it, ohne)) continue;
      wert(it, m);
    }
    return m;
  }
  function fchip(attr, v, label, n, an, extra) {
    return '<button type="button" class="wz-f' + (n === 0 && !an ? ' is-null' : '') + '" data-' + attr + '="' + esc(v) + '" aria-pressed="' + (an ? 'true' : 'false') + '"' + (extra || '') + '>' + esc(label) + (n != null ? ' <em>' + fmt(n) + '</em>' : '') + '</button>';
  }
  var F_ATTR = ['art', 'gr', 'pk', 'sel'];
  function zeichneFilter() {
    if (!bereit) return;
    // Die Knoepfe werden neu geschrieben; hatte einer den Fokus, bekommt
    // sein Nachfolger mit demselben Attribut und Wert ihn zurueck.
    var fa = document.activeElement, fokus = null;
    if (fa && fa.classList && fa.classList.contains('wz-f')) {
      F_ATTR.some(function (a) {
        if (fa.hasAttribute('data-' + a)) { fokus = [a, fa.getAttribute('data-' + a)]; return true; }
        return false;
      });
    }
    var sets = S.tab === 'sets';
    // Fundart
    var mA = sets ? {} : zaehle('art', function (it, m) {
      m.all = (m.all || 0) + 1;
      ['buy', 'loot', 'exclusive', 'catalog'].forEach(function (k) { if (hasKind(it, k)) m[k] = (m[k] || 0) + 1; });
    });
    el.fArt.innerHTML = ['all', 'buy', 'loot', 'exclusive', 'catalog'].map(function (k) {
      return fchip('art', k, artLabel(k), sets ? null : (mA[k] || 0), S.art === k);
    }).join('');
    // Groesse (nur Ausruestung mit echter Groesse)
    var mG = sets ? {} : zaehle('gr', function (it, m) {
      if (!hasGradeSemantics(it)) return;
      it._sz.forEach(function (s) { m[s] = (m[s] || 0) + 1; });
    });
    var gs = Object.keys(mG).map(Number).sort(function (a, b) { return a - b; });
    if (S.gr != null && gs.indexOf(S.gr) < 0) gs.push(S.gr);
    el.fGr.innerHTML = fchip('gr', 'alle', tr('kindAll', 'Alle'), null, S.gr == null) +
      gs.map(function (s) { return fchip('gr', s, 'S' + s, mG[s] || 0, S.gr === s); }).join('');
    // Panzerungsklasse
    var mP = {};
    if (sets) SETLISTE.forEach(function (s) { if (s.weight && (!QW.length || trifft(s._h))) mP[s.weight] = (mP[s.weight] || 0) + 1; });
    else mP = zaehle('pk', function (it, m) { var v = it.game && it.game.weight; if (v) m[v] = (m[v] || 0) + 1; });
    var ps = Object.keys(mP).sort(function (a, b) { return (GEW[a] || 99) - (GEW[b] || 99) || a.localeCompare(b); });
    if (S.pk && ps.indexOf(S.pk) < 0) ps.push(S.pk);
    el.fPk.innerHTML = fchip('pk', 'alle', tr('kindAll', 'Alle'), null, !S.pk) +
      ps.map(function (v) { return fchip('pk', v, weightLabel(v), mP[v] || 0, S.pk === v); }).join('');
    // Seltenheit
    var mS = sets ? {} : zaehle('sel', function (it, m) { var v = it.game && it.game.rarity; if (v) m[v] = (m[v] || 0) + 1; });
    var ss = Object.keys(mS).sort(function (a, b) { return (RAR[a] || 99) - (RAR[b] || 99); });
    if (S.sel && ss.indexOf(S.sel) < 0) ss.push(S.sel);
    el.fSel.innerHTML = fchip('sel', 'alle', tr('kindAll', 'Alle'), null, !S.sel) +
      ss.map(function (v) { return fchip('sel', v, rarityLabel(v), mS[v] || 0, S.sel === v, ' data-sel="' + esc(v) + '"'); }).join('');
    // Im Reiter Sets wirken nur Suche und Panzerungsklasse.
    // Eine Gruppe ohne Werte (nur „Alle“) faellt weg, solange sie nichts filtert.
    [el.fArt, el.fGr, el.fSel].forEach(function (x) { x.closest('.wz-fg').hidden = sets; });
    if (!sets && !gs.length) el.fGr.closest('.wz-fg').hidden = true;
    el.fPk.closest('.wz-fg').hidden = !ps.length;
    if (!sets && !ss.length) el.fSel.closest('.wz-fg').hidden = true;
    if (fokus) {
      var box = { art: el.fArt, gr: el.fGr, pk: el.fPk, sel: el.fSel }[fokus[0]];
      var neu = Array.prototype.find.call(box.children, function (b) { return b.getAttribute('data-' + fokus[0]) === fokus[1]; });
      if (neu) { try { neu.focus({ preventScroll: true }); } catch (e) {} }
    }
  }
  el.sch.addEventListener('click', function (e) {
    var b = e.target.closest('.wz-f');
    if (!b) return;
    if (b.hasAttribute('data-art')) S.art = b.getAttribute('data-art');
    else if (b.hasAttribute('data-gr')) { var v = b.getAttribute('data-gr'); S.gr = v === 'alle' ? null : Number(v); }
    else if (b.hasAttribute('data-pk')) { var p = b.getAttribute('data-pk'); S.pk = p === 'alle' ? null : p; }
    else if (b.hasAttribute('data-sel')) { var s = b.getAttribute('data-sel'); S.sel = s === 'alle' ? null : s; }
    anwenden();
  });
  function schublade(auf) {
    el.sch.classList.toggle('is-open', auf);
    el.fk.setAttribute('aria-expanded', auf ? 'true' : 'false');
  }
  el.fk.addEventListener('click', function () { schublade(!el.sch.classList.contains('is-open')); });
  el.schX.addEventListener('click', function () { schublade(false); el.fk.focus(); });
  el.fZeigen.addEventListener('click', function () { schublade(false); });
  el.fReset.addEventListener('click', function () { S.art = 'all'; S.gr = null; S.pk = null; S.sel = null; anwenden(); });

  /* ---------- Leiste und Chips ---------- */
  function zeichneLeiste() {
    var aktivG = S.blatt ? S.blatt.gr : S.gruppe;
    el.rail.querySelectorAll('[data-kat]').forEach(function (a) {
      var k = a.getAttribute('data-kat');
      var an = S.tab === 'items' && (k === '' ? !S.gruppe && !S.blatt : !!S.blatt && S.blatt.s === k && a.closest('.wz-gr').getAttribute('data-root') === S.blatt.gr.r);
      a.classList.toggle('is-an', an);
      if (an) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
    el.rail.querySelectorAll('.wz-gr').forEach(function (gr) {
      var kopf = gr.querySelector('.wz-gr__kopf');
      var g = G_ROOT[gr.getAttribute('data-root')];
      var istAktiv = S.tab === 'items' && aktivG === g;
      kopf.classList.toggle('is-an', istAktiv && !S.blatt);
      if (istAktiv && !gr.__zu) { gr.classList.add('is-offen'); kopf.setAttribute('aria-expanded', 'true'); }
    });
  }
  el.rail.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-kat]');
    if (a) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      var k = a.getAttribute('data-kat');
      if (!k) { waehleKat(null, null); return; }
      var g = G_ROOT[a.closest('.wz-gr').getAttribute('data-root')];
      var b = null;
      g.b.forEach(function (x) { if (x.s === k) b = x; });
      waehleKat(g, b);
      return;
    }
    var kopf = e.target.closest('.wz-gr__kopf');
    if (!kopf) return;
    var gr = kopf.closest('.wz-gr');
    var grp = G_SLUG[kopf.getAttribute('data-gruppe')];
    if (S.tab === 'items' && S.gruppe === grp && !S.blatt) {
      // Schon gewaehlt: nur auf- und zuklappen.
      var offen = !gr.classList.contains('is-offen');
      gr.classList.toggle('is-offen', offen);
      gr.__zu = !offen;
      kopf.setAttribute('aria-expanded', offen ? 'true' : 'false');
      return;
    }
    gr.__zu = false;
    waehleKat(grp, null);
  });

  function zeichneChips() {
    if (!el.chips) return;
    if (S.tab !== 'items') { el.chips.innerHTML = ''; return; }
    var aktivG = S.blatt ? S.blatt.gr : S.gruppe;
    var r1 = '<div class="wz-chips__reihe">' +
      '<button type="button" class="wz-chip' + (!aktivG ? ' is-an' : '') + '" data-chip="" style="--kc:var(--akz)"><span class="wz-z" data-g="grid4" aria-hidden="true"></span>' + esc(w('alle')) + '</button>' +
      GRUPPEN.map(function (g) {
        return '<button type="button" class="wz-chip' + (aktivG === g ? ' is-an' : '') + '" data-chip="' + esc(g.s) + '" style="--kc:' + g.f + '"><span class="wz-z" data-g="' + g.g + '" aria-hidden="true"></span>' + esc(g.n) + '<em>' + fmt(g.c) + '</em></button>';
      }).join('') + '</div>';
    var r2 = '';
    if (aktivG && aktivG.b.length > 1) {
      r2 = '<div class="wz-chips__reihe">' + aktivG.b.map(function (b) {
        return '<button type="button" class="wz-chip wz-chip--blatt' + (S.blatt === b ? ' is-an' : '') + '" data-chipblatt="' + esc(b.s) + '" style="--kc:' + aktivG.f + '">' + esc(b.n) + '<em>' + fmt(b.c) + '</em></button>';
      }).join('') + '</div>';
    }
    var alt = el.chips.querySelector('.wz-chips__reihe + .wz-chips__reihe');
    var x1 = el.chips.firstElementChild ? el.chips.firstElementChild.scrollLeft : 0;
    var x2 = alt ? alt.scrollLeft : 0;
    // Lag der Fokus auf einem Chip (Enter auf einer Gruppe), geht er an den
    // neuen Chip derselben Art und desselben Schluessels, sonst an die
    // gewaehlte Gruppe: das Neuzeichnen soll ihn nicht auf die Seite werfen.
    var fa = document.activeElement, fokusSel = null;
    if (fa && el.chips.contains(fa)) {
      fokusSel = fa.hasAttribute('data-chipblatt') ? '[data-chipblatt="' + cssEsc(fa.getAttribute('data-chipblatt')) + '"]'
        : '[data-chip="' + cssEsc(fa.getAttribute('data-chip') || '') + '"]';
    }
    el.chips.innerHTML = r1 + r2;
    var n1 = el.chips.firstElementChild;
    if (n1) n1.scrollLeft = x1;
    var n2 = el.chips.querySelector('.wz-chips__reihe + .wz-chips__reihe');
    if (n2) n2.scrollLeft = x2;
    // Die gewaehlte Gruppe ins Bild holen, wenn sie ausserhalb steht.
    var an = el.chips.querySelector('.wz-chip.is-an');
    if (an && n1 && (an.offsetLeft < n1.scrollLeft || an.offsetLeft + an.offsetWidth > n1.scrollLeft + n1.clientWidth)) {
      n1.scrollLeft = an.offsetLeft - 12;
    }
    if (fokusSel) {
      var nf = el.chips.querySelector(fokusSel) || an || el.chips.querySelector('[data-chip]');
      if (nf) { try { nf.focus({ preventScroll: true }); } catch (e) {} }
    }
  }
  el.chips.addEventListener('click', function (e) {
    var c = e.target.closest('[data-chip]');
    if (c) {
      var s = c.getAttribute('data-chip');
      var g = s ? G_SLUG[s] : null;
      if (g && (S.gruppe === g || (S.blatt && S.blatt.gr === g)) && !S.blatt) g = null;
      waehleKat(g, null);
      return;
    }
    var b = e.target.closest('[data-chipblatt]');
    if (!b) return;
    var aktivG = S.blatt ? S.blatt.gr : S.gruppe;
    var bl = null;
    aktivG.b.forEach(function (x) { if (x.s === b.getAttribute('data-chipblatt')) bl = x; });
    if (bl === S.blatt) waehleKat(aktivG, null); else waehleKat(aktivG, bl);
  });

  function waehleKat(g, b) {
    if (S.tab !== 'items') setzeTab('items', true);
    S.gruppe = b ? b.gr : g;
    S.blatt = b || null;
    S.set = null;
    anwenden();
  }

  /* ---------- Blatt ---------- */
  function pfadHtml(it) {
    var h = '';
    if (it._gr) h += '<span><button type="button" data-gruppe="' + esc(it._gr.s) + '">' + esc(it._gr.n) + '</button></span>';
    else h += '<span>' + esc(it._root) + '</span>';
    if (it._b && it.category.indexOf('/') > 0) h += '<span><button type="button" data-kat="' + esc(it._b.s) + '" data-root="' + esc(it._root) + '">' + esc(it._b.n) + '</button></span>';
    return h;
  }
  function kennHtml(list) {
    if (!list.length) return '';
    return '<div class="wzb-kenn">' + list.map(function (k) {
      return '<div><span title="' + esc(k.l) + '">' + esc(k.l) + '</span><b' + (k.wert ? ' class="is-wert"' : k.txt ? ' class="is-txt"' : '') + '>' + esc(k.v) + (k.u ? '<small>' + esc(k.u) + '</small>' : '') + '</b></div>';
    }).join('') + '</div>';
  }
  var KIND = null;
  function kindLabel(k) {
    if (!KIND) KIND = { shop: tr('kindShop', 'Shop'), vehicle: tr('kindVehicleShop', 'Schiffshändler'), loot: tr('kindLoot', 'Loot'), exclusive: tr('kindExclusive', 'Exklusiv') };
    return KIND[k] || k;
  }
  var KIND_ICON = { shop: 'shop', vehicle: 'ship', loot: 'loot', exclusive: 'gem' };
  // Kategorieliste, auf der ein Item ohne eigenes Datenblatt namentlich steht
  // (Zwilling von kategorieSeiteVon() in src/lib/items.ts).
  var KAT_LISTEN = null;
  function katSeite(it) {
    if (!it._b) return null;
    if (!KAT_LISTEN) {
      KAT_LISTEN = {};
      ITEMS.forEach(function (x) { (KAT_LISTEN[x.category] || (KAT_LISTEN[x.category] = [])).push(x); });
      Object.keys(KAT_LISTEN).forEach(function (k) { KAT_LISTEN[k].sort(function (a, b) { return a.name.localeCompare(b.name, 'en'); }); });
    }
    var liste = KAT_LISTEN[it.category] || [];
    var seite = Math.floor(liste.indexOf(it) / 100) + 1;
    return (C.katBase || '/items/category/') + it._b.s + (seite > 1 ? '-' + seite : '') + '.html';
  }

  // Erze stehen im Katalog ohne Bezugsquelle, ihre Fundorte fuehrt die
  // Mining-Seite (C.erze aus erzKatalog() in src/lib/miningLinks.ts). Roh- und
  // Raffinadename zeigen auf dasselbe Mineral: „(Ore)“/„(Raw)“ fallen weg.
  function erzVon(it) {
    var E = C.erze;
    if (!E || !E.m || it.category !== 'Commodity' || it.obtain.length) return null;
    var k = String(it.name || '').replace(/\s*\((?:ore|raw)\)\s*$/i, '').trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(E.m, k)) return null;
    var m = E.m[k];
    return { name: m[0], n: m[1], url: E.url + '?mineral=' + encodeURIComponent(m[0]) + '#db' };
  }

  function quellenHtml(it) {
    var h = '<h3 class="wzb-h">' + esc(w('hQuellen')) + (it.obtain.length ? '<em>' + fmt(it.obtain.length) + '</em>' : '') + '</h3>';
    var erz = erzVon(it);
    if (erz) {
      // Der Verweis selbst steht oben bei den Handlungen (blattItem).
      return h + '<p class="wzb-note">' + esc(erz.n ? tr('oreNote', 'Rohstoff aus dem Bergbau: Die Mining-Seite führt {n} Fundorte.').replace('{n}', fmt(erz.n)) : tr('oreNoteOhne', 'Rohstoff aus dem Bergbau. Was über Fundorte bekannt ist, steht auf der Mining-Seite.')) + '</p>';
    }
    if (!it.obtain.length) {
      return h + '<p class="wzb-note">' + esc(it.game && it.game.lootable === true
        ? tr('lootUnknown', 'Fundort unbekannt.')
        : tr('catalogNote', 'Katalog-Eintrag: Für dieses Item liegen keine verifizierten Shop- oder Loot-Daten vor.')) + '</p>';
    }
    var preise = it.obtain.filter(function (o) { return o.price != null; }).sort(function (a, b) { return a.price - b.price; });
    var rest = it.obtain.filter(function (o) { return o.price == null; });
    var zeilen = preise.concat(rest);
    var GRENZE = 8;
    var li = zeilen.map(function (o, i) {
      var st = '';
      if (o.kind === 'loot') {
        st = o.ort
          ? '<span class="wzb-st is-ok" title="' + esc(tr('lootConfirmedTitle', '')) + '">' + esc(tr('lootConfirmed', 'bestätigt')) + '</span>'
          : '<span class="wzb-st" title="' + esc(tr('lootUnconfirmedTitle', '')) + '">' + esc(tr('lootUnconfirmed', 'unbestätigt')) + '</span>';
      }
      var unter = [kindLabel(o.kind)];
      if (o.wo) unter.push(woText(o.wo));
      return '<li data-art="' + esc(o.kind) + '"' + (i >= GRENZE ? ' hidden' : '') + '>' +
        '<span class="wzb-q__z"><span class="wi wi--' + (KIND_ICON[o.kind] || 'pick') + '" aria-hidden="true"></span></span>' +
        '<span class="wzb-q__t"><b>' + esc(obtainText(o)) + '</b><small>' + esc(unter.join(' · ')) + '</small></span>' +
        '<span class="wzb-q__p">' + (o.price != null ? '<b>' + esc(auec(o.price)) + '</b>' : '') + st + '</span>' +
      '</li>';
    }).join('');
    h += '<ul class="wzb-q">' + li + '</ul>';
    if (zeilen.length > GRENZE) {
      h += '<button type="button" class="wzb-neben" data-alle-quellen style="margin-top:.45rem;width:100%"><span>' +
        esc((DE ? 'Alle ' : 'Show all ') + fmt(zeilen.length) + (DE ? ' zeigen' : '')) + '</span><span class="wi wi--chev" aria-hidden="true"></span></button>';
    }
    var notiz = tr('volatileNote', 'Preise und Fundorte sind Patch-volatil, ingame prüfen.');
    if (it.obtain.some(function (o) { return !!o.ort; })) notiz += ' ' + tr('lootStatusNote', '');
    h += '<p class="wzb-note wzb-note--wert">' + esc(notiz) + '</p>';
    return h;
  }

  function blattItem(it) {
    var g = it.game;
    var chips = [];
    if (g) {
      if (mfrName(g.manufacturer)) chips.push('<li class="wz-tag">' + esc(mfrName(g.manufacturer)) + '</li>');
      if (hasGradeSemantics(it) && sizeLabel(it)) chips.push('<li class="wz-tag">' + esc(tr('specSize', 'Größe') + ' ' + sizeLabel(it)) + '</li>');
      if (g.grade && !g.variants && hasMeaningfulGrade(it)) chips.push('<li class="wz-tag">Grade ' + esc(g.grade) + '</li>');
      if (g.class) chips.push('<li class="wz-tag">' + esc(g.class) + '</li>');
      if (g.weight) chips.push('<li class="wz-tag">' + esc(weightLabel(g.weight)) + '</li>');
      if (g.rarity) chips.push('<li class="wz-tag" data-sel="' + esc(g.rarity) + '">' + esc(rarityLabel(g.rarity)) + '</li>');
      if (g.volumeScu) chips.push('<li class="wz-tag">' + esc(fmt(g.volumeScu, 6)) + ' SCU</li>');
    }
    var h = '<article class="wzb" style="--kc:' + it._kc + '">';
    h += '<div class="wzb-kopf"><div class="wzb-emb">' + RING + '<span class="wg" data-g="' + it._g + '" aria-hidden="true"></span></div>' +
      '<div class="wzb-kopf__t"><p class="wzb-pfad">' + pfadHtml(it) + '</p>' +
      '<h2 class="wzb-name" id="wzb-name">' + esc(it._n) + '</h2>' +
      (it._alt ? '<p class="wzb-alt" lang="' + (DE ? 'en' : 'de') + '">' + esc(it._alt) + '</p>' : '') +
      (chips.length ? '<ul class="wzb-chips">' + chips.join('') + '</ul>' : '') +
      '</div></div>';
    // Kennwerte: Spielwerte, dann der Preis.
    var kenn = kennStats(it);
    var platz = it._p != null ? 3 : 4;
    kenn = kenn.slice(0, platz);
    if (it._p != null) kenn.push({ l: it.obtain.length > 1 ? tr('priceFrom', 'ab') + ' (aUEC)' : tr('thPrice', 'Preis') + ' (aUEC)', v: fmt(it._p), wert: true });
    if (kenn.length < 3) {
      var avg = avgPrice(it);
      if (avg != null && avg !== it._p) kenn.push({ l: w('kSchnitt') + ' (aUEC)', v: fmt(avg) });
    }
    if (kenn.length < 3 && it.obtain.length) kenn.push({ l: w('kQuellen'), v: fmt(it.obtain.length) });
    if (kenn.length < 3 && sizeLabel(it) && hasGradeSemantics(it)) kenn.push({ l: w('kGroesse'), v: sizeLabel(it) });
    h += kennHtml(kenn);
    h += '<div class="wzb-inh">';
    // Handlungen
    h += '<div class="wzb-akt" id="wzb-akt">';
    var erzA = erzVon(it);
    if (it._page) {
      h += '<a class="wzb-haupt" href="' + esc(itemUrl(it)) + '"><span class="wi wi--sheet" aria-hidden="true"></span>' + esc(w('datenblatt')) + '</a>';
    } else if (erzA) {
      h += '<a class="wzb-haupt" href="' + esc(erzA.url) + '"><span class="wi wi--mining" aria-hidden="true"></span>' + esc(tr('oreLink', 'Fundorte auf der Mining-Seite')) + '</a>';
    }
    if (!it._page) {
      var ks = katSeite(it);
      if (ks) h += '<a class="wzb-neben" href="' + esc(ks) + '"><span>' + esc(w('kategorieListe')) + '</span><span class="wi wi--arrow" aria-hidden="true"></span></a>';
    }
    var st = setOf(it);
    if (st) h += '<button type="button" class="wzb-neben" data-satz="' + esc(st.id) + '"><span class="wi wi--layers" aria-hidden="true"></span><span>' + esc(w('setAnsehen')) + '</span><span class="wi wi--arrow" aria-hidden="true"></span></button>';
    h += '</div>';
    h += quellenHtml(it);
    var werte = statEntries(it);
    if (werte.length) {
      h += '<h3 class="wzb-h">' + esc(w('hWerte')) + '<em>' + werte.length + '</em></h3><div class="wzb-werte">' + werte.map(function (s) {
        return '<div class="wzb-wert"><span>' + esc(s[0]) + '</span><b>' + esc(s[1]) + '</b></div>';
      }).join('') + '</div>';
    }
    var desc = g ? (DE && g.descDe ? g.descDe : g.desc) : null;
    if (desc) {
      var dl = DE && !g.descDe ? ' lang="en"' : '';
      h += '<h3 class="wzb-h">' + esc(w('hText')) + '</h3><p class="wzb-text"' + dl + '>' + esc(desc) + '</p>';
    }
    var vars = g && g.variants;
    if (vars && vars.length) {
      h += '<h3 class="wzb-h">' + esc(w('hVar')) + '<em>' + vars.length + '</em></h3><p class="wzb-note" style="margin:0 0 .6rem">' + esc(tr('variantsNote', '')) + '</p><div class="wzb-var">' +
        vars.map(function (v) {
          var vg = v.grade && hasMeaningfulGrade(it) ? v.grade : null;
          var kopf = ['S' + v.size, mfrName(v.manufacturer), vg ? 'Grade ' + vg : null].filter(Boolean).join(' · ');
          var rows = statEntries({ game: { stats: v.stats } });
          return '<div><h4>' + esc(kopf) + '</h4>' + (rows.length ? '<div class="wzb-werte">' + rows.map(function (s) {
            return '<div class="wzb-wert"><span>' + esc(s[0]) + '</span><b>' + esc(s[1]) + '</b></div>';
          }).join('') + '</div>' : '') + '</div>';
        }).join('') + '</div>';
    }
    if (st) h += setTeileHtml(st, it.id, true);
    if (it.guide) h += '<h3 class="wzb-h">' + esc(w('hGuide')) + '</h3><p class="wzb-guide" lang="en">' + esc(it.guide) + '</p>';
    h += '<div id="wzb-craft"></div>';
    h += '</div></article>';
    return h;
  }

  function setTeile(st) {
    return ITEMS.filter(function (x) { return x.game && x.game.setId === st.id; });
  }
  var SLOT_ORDER = ['Helmet', 'Torso', 'Arms', 'Legs', 'Backpack', 'Undersuit'];
  function setTeileHtml(st, hierId, kurz) {
    var teile = setTeile(st).sort(function (a, b) { return a._o - b._o; });
    var h = '<h3 class="wzb-h">' + esc(kurz ? w('hSet') + ': ' + st.name : w('hTeile')) + '<em>' + fmt(teile.length) + '</em></h3>';
    h += '<ul class="wzb-zeilen">' + teile.slice(0, 40).map(function (x) {
      return '<li><button type="button" class="wzb-zeile' + (x.id === hierId ? ' is-hier' : '') + '" data-oeffne="' + esc(x.id) + '" style="--kc:' + x._kc + '">' +
        '<span class="wz-z" data-g="' + x._g + '" aria-hidden="true"></span><span>' + esc(x._n) + '<small>' + esc(x._b ? x._b.n : x._root) + '</small></span>' +
        '<span class="wi wi--arrow" aria-hidden="true"></span></button></li>';
    }).join('') + '</ul>';
    if (kurz) {
      h += '<div class="wzb-akt" style="margin-top:.5rem"><button type="button" class="wzb-neben" data-setfilter="' + esc(st.id) + '"><span>' + esc(w('setTeile')) + '</span><span class="wi wi--arrow" aria-hidden="true"></span></button>' +
        '<a class="wzb-neben" href="' + esc((C.setBase || '/armor-sets.html') + '#' + st.id) + '"><span>' + esc(w('setSeite')) + '</span><span class="wi wi--arrow" aria-hidden="true"></span></a></div>';
    }
    return h;
  }

  function blattSatz(st) {
    var slots = Object.keys(st.slots || {}).sort(function (a, b) { return SLOT_ORDER.indexOf(a) - SLOT_ORDER.indexOf(b); });
    var h = '<article class="wzb" style="--kc:' + farbe('Armour') + '">';
    h += '<div class="wzb-kopf"><div class="wzb-emb">' + RING + '<span class="wg" data-g="core" aria-hidden="true"></span></div>' +
      '<div class="wzb-kopf__t"><p class="wzb-pfad"><span>' + esc(w('tabSets')) + '</span>' + (st.manufacturer ? '<span>' + esc(st.manufacturer) + '</span>' : '') + '</p>' +
      '<h2 class="wzb-name" id="wzb-name">' + esc(st.name) + '</h2>' +
      '<ul class="wzb-chips">' + (st.weight ? '<li class="wz-tag">' + esc(weightLabel(st.weight)) + '</li>' : '') +
      slots.map(function (s) { return '<li class="wz-tag">' + esc(tr('slot' + s, s)) + '</li>'; }).join('') + '</ul></div></div>';
    h += kennHtml([
      { l: w('kTeile'), v: fmt(st.parts) },
      { l: w('kKern'), v: st.coreSlots + ' / 4', wert: st.coreSlots === 4 },
      { l: w('kKlasse'), v: st.weight ? weightLabel(st.weight) : '—', txt: true }
    ]);
    h += '<div class="wzb-inh"><div class="wzb-akt">' +
      '<button type="button" class="wzb-haupt" data-setfilter="' + esc(st.id) + '"><span class="wi wi--grid4" aria-hidden="true"></span>' + esc(w('setTeile')) + '</button>' +
      '<a class="wzb-neben" href="' + esc((C.setBase || '/armor-sets.html') + '#' + st.id) + '"><span>' + esc(w('setSeite')) + '</span><span class="wi wi--arrow" aria-hidden="true"></span></a></div>';
    h += setTeileHtml(st, null, false);
    h += '</div></article>';
    return h;
  }

  // Rezept: crafting-db.json laedt erst mit dem ersten offenen Item.
  var CRAFT = null, craftLaeuft = null;
  function ladeCraft() {
    if (craftLaeuft) return craftLaeuft;
    // Nur ein geladener Index wird behalten. Scheitert der Abruf, bleibt
    // CRAFT ungesetzt, und das naechste geoeffnete Item versucht es neu.
    craftLaeuft = fetch(C.craftUrl || '/assets/crafting-db.json')
      .then(function (r) {
        if (!r.ok) throw new Error('crafting db http ' + r.status);
        return r.json();
      })
      .then(function (db) {
        // Rezept je Item wie recipeForItem() in src/lib/crafting.ts: der
        // Bauplan zeigt ueber seine guid auf das Item, das er herstellt, erst
        // danach zaehlt der Name. Gleichnamige Bauplaene (zweimal „BroadSpec“)
        // bauen verschiedene Items und ueberschreiben sich so nicht.
        var jeItem = karte();
        if (db && db.blueprints) {
          var perGuid = karte(), perName = karte();
          ITEMS.forEach(function (i) {
            var g = i.game;
            perName[i.name.toLowerCase()] = i;
            if (!g) return;
            if (g.guid && !perGuid[g.guid]) perGuid[g.guid] = i;
            (g.guidAliases || []).forEach(function (a) { if (!perGuid[a]) perGuid[a] = i; });
          });
          ITEMS.forEach(function (i) {
            ((i.game && i.game.variants) || []).forEach(function (v) { if (v.guid) perGuid[v.guid] = i; });
          });
          // Slugs exakt wie src/lib/crafting.ts (gleiche Reihenfolge, „-2" bei Dubletten).
          var used = karte();
          db.blueprints.forEach(function (bp, stelle) {
            if (!bp.name) return;
            var base = String(bp.name).toLowerCase().replace(/['’"]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'blueprint';
            var n = (used[base] || 0) + 1;
            used[base] = n;
            bp.__slug = n > 1 ? base + '-' + n : base;
            bp.__stelle = stelle;
            var baut = (bp.entity_guid && perGuid[bp.entity_guid]) || perName[bp.name.toLowerCase()] || null;
            if (baut && !jeItem[baut.id]) jeItem[baut.id] = bp;
          });
        }
        CRAFT = jeItem;
      })
      .catch(function () { craftLaeuft = null; });
    return craftLaeuft;
  }
  function craftEinsetzen(it, ziel) {
    if (!ziel || !ziel.isConnected) return;
    var bp = CRAFT && CRAFT[it.id];
    if (!bp) { ziel.remove(); return; }
    var sek = bp.craft_time_seconds || 0;
    var zeit = sek >= 60 ? Math.floor(sek / 60) + ' min' + (sek % 60 ? ' ' + (sek % 60) + ' s' : '') : sek + ' s';
    var h = '<h3 class="wzb-h">' + esc(w('hCraft')) + '</h3><div class="wzb-craft"><div class="wzb-craft__kopf">' +
      '<span class="wz-tag"><span class="wi wi--clock" aria-hidden="true"></span>' + esc(tr('craftTime', 'Dauer')) + ' ' + esc(zeit) + '</span>' +
      (bp.tiers ? '<span class="wz-tag"><span class="wi wi--tier" aria-hidden="true"></span>' + esc(tr('craftTiers', 'Stufen')) + ' ' + esc(String(bp.tiers)) + '</span>' : '') + '</div>';
    if (bp.ingredients && bp.ingredients.length) {
      h += '<ul>' + bp.ingredients.map(function (ing) {
        var opts = (ing.options || []).map(function (o) {
          var q = o.quantity_scu !== undefined ? fmt(o.quantity_scu) + ' SCU' : (o.quantity !== undefined ? fmt(o.quantity) + '×' : '');
          return esc(o.name) + (q ? ' <span style="color:var(--wert)">' + esc(q) + '</span>' : '');
        }).join(' / ');
        return '<li><b>' + esc(ing.slot || 'Material') + '</b><span>' + opts + '</span></li>';
      }).join('') + '</ul>';
    }
    h += '</div>';
    ziel.innerHTML = h;
    var akt = document.getElementById('wzb-akt');
    if (akt) {
      akt.insertAdjacentHTML('beforeend',
        '<a class="wzb-neben" href="' + esc((C.craftPage || '/topics/crafting.html') + '?bp=' + encodeURIComponent(bp.name) + '&bpi=' + bp.__stelle) + '"><span class="wi wi--fab" aria-hidden="true"></span><span>' + esc(w('craftOeffnen')) + '</span><span class="wi wi--arrow" aria-hidden="true"></span></a>' +
        (bp.__slug ? '<a class="wzb-neben" href="' + esc((C.craftBase || '/crafting/') + bp.__slug + '.html') + '"><span class="wg" data-g="bp" aria-hidden="true"></span><span>' + esc(w('rezeptSeite')) + '</span><span class="wi wi--arrow" aria-hidden="true"></span></a>' : ''));
    }
  }

  function zeigeBlatt(html, opt) {
    opt = opt || {};
    // Lag der Fokus im alten Inhalt (etwa „Set ansehen“ per Enter), faellt er
    // mit ihm weg; er geht dann an die neue Ueberschrift, nicht an die Seite.
    var fokusDrin = el.inh.contains(document.activeElement);
    el.inh.innerHTML = html;
    if (!STILL.matches) {
      el.inh.classList.remove('is-frisch'); void el.inh.offsetWidth; el.inh.classList.add('is-frisch');
    }
    el.box.scrollTop = 0;
    var oben = STAPEL.length ? STAPEL[STAPEL.length - 1] : null;
    if (oben) {
      el.zur.hidden = false;
      el.zur.lastElementChild.textContent = w('zurueck').replace('{name}', oben.name);
    } else el.zur.hidden = true;
    var titel = el.inh.querySelector('#wzb-name');
    el.blatt.setAttribute('aria-label', titel ? titel.textContent : w('ueTitel'));
    if (fokusDrin) {
      var f = titel || el.box;
      if (f === titel) titel.setAttribute('tabindex', '-1');
      try { f.focus({ preventScroll: true }); } catch (e) {}
    }
    if (window.VBScrollAffordance) window.VBScrollAffordance();
  }
  el.inh.addEventListener('animationend', function (e) { if (e.target === el.inh) el.inh.classList.remove('is-frisch'); });

  function oeffneItem(it, opt) {
    opt = opt || {};
    if (!opt.stapel) STAPEL = [];
    S.item = it.id;
    S.satz = null;
    zeigeBlatt(blattItem(it));
    markiere();
    // Der Rueckruf gehoert zu genau diesem Blatt: oeffnet man inzwischen ein
    // anderes und wieder dieses Item, ist der alte Platzhalter weg, und nur
    // der juengste Aufruf fuellt das Blatt.
    var platz = document.getElementById('wzb-craft');
    if (CRAFT) craftEinsetzen(it, platz);
    else ladeCraft().then(function () { craftEinsetzen(it, platz); });
    if (!opt.still) telefonAuf();
    if (!opt.ohneUrl) schreibeUrl();
  }
  function oeffneSatz(st, opt) {
    opt = opt || {};
    if (!opt.stapel) STAPEL = [];
    S.satz = st.id;
    S.item = null;
    zeigeBlatt(blattSatz(st));
    markiere();
    if (!opt.still) telefonAuf();
    if (!opt.ohneUrl) schreibeUrl();
  }
  function ueberblick(opt) {
    opt = opt || {};
    STAPEL = [];
    S.item = null; S.satz = null;
    zeigeBlatt(UEBERBLICK);
    markiere();
    if (!opt.ohneUrl) schreibeUrl();
  }
  function markiere() {
    el.gitter.querySelectorAll('.wz-k.is-sel').forEach(function (k) { k.classList.remove('is-sel'); });
    var sel = S.item ? '.wz-k[data-id="' + cssEsc(S.item) + '"]' : S.satz ? '.wz-k[data-satz="' + cssEsc(S.satz) + '"]' : null;
    var k = sel && el.gitter.querySelector(sel);
    if (k) k.classList.add('is-sel');
    return k;
  }
  function cssEsc(s) { return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'); }

  // Blatt am Telefon: von unten, Zurueck des Geraets schliesst es.
  var blattGeschoben = false;
  // Das Zurueck aus telefonZu() selbst (Schliessen-Knopf, Gruppe, „Set-Teile
  // zeigen“): sein popstate laesst einen wartenden Schreibvorgang stehen,
  // denn den hat der Aufrufer gerade fuer die Liste angestossen.
  var eigenesZurueck = false, zurueckTimer = 0;
  // Offen deckt das Blatt die Seite ganz zu. Alles daneben wird inert,
  // damit Tab und Vorleser im Blatt bleiben; beim Schliessen kommt genau
  // das zurueck, was hier gesetzt wurde.
  var traege = [];
  function aussenTraege(an) {
    if (!an) {
      traege.forEach(function (x) { x.inert = false; });
      traege = [];
      return;
    }
    for (var n = el.blatt; n && n.parentElement && n !== document.body; n = n.parentElement) {
      Array.prototype.forEach.call(n.parentElement.children, function (x) {
        if (x === n || x.inert || /^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(x.tagName)) return;
        x.inert = true;
        traege.push(x);
      });
    }
  }
  function telefonAuf(ausHistorie) {
    if (!TELEFON.matches || el.blatt.classList.contains('is-offen')) return;
    el.blatt.classList.add('is-offen');
    aussenTraege(true);
    if (window.VBScrollLock) window.VBScrollLock.lock();
    if (ausHistorie) blattGeschoben = true;
    // Der Blatteintrag traegt die Auswahl sofort, nicht erst mit dem
    // verzoegerten schreibeUrl(): geht man zurueck, bevor der schreibt, findet
    // Vorwaerts sonst einen Eintrag ohne Item und oeffnet das Blatt nicht.
    // Der Eintrag der Liste darunter bleibt, wie er ist.
    // Steht man schon auf einem Blatteintrag (das Fenster war zwischendurch
    // breit und hat nur das Overlay geschlossen), dient er weiter; sonst
    // laege ein zweiter darueber, und Schliessen oeffnete das Blatt gleich
    // wieder.
    else if (history.state && history.state.wzBlatt) { try { history.replaceState(history.state, '', adresse()); } catch (e) {} blattGeschoben = true; }
    else { try { history.pushState({ wzBlatt: 1 }, '', adresse()); blattGeschoben = true; } catch (e) {} }
    setTimeout(function () { try { el.box.focus({ preventScroll: true }); } catch (e) {} }, 30);
  }
  function telefonZu(ausHistorie) {
    if (!el.blatt.classList.contains('is-offen')) return false;
    el.blatt.classList.remove('is-offen');
    aussenTraege(false);
    if (window.VBScrollLock) window.VBScrollLock.unlock();
    if (!ausHistorie && blattGeschoben) {
      blattGeschoben = false;
      eigenesZurueck = true;
      try { history.back(); } catch (e) { eigenesZurueck = false; }
      // Kommt kein popstate (Verlauf blockiert), darf die Adresse nicht
      // dauerhaft stehen bleiben.
      clearTimeout(zurueckTimer);
      if (eigenesZurueck) zurueckTimer = setTimeout(function () { if (eigenesZurueck) { eigenesZurueck = false; schreibeUrl(); } }, 1000);
    }
    blattGeschoben = false;
    var k = markiere();
    if (k) { var f = k.querySelector('a') || k; try { f.focus({ preventScroll: true }); } catch (e) {} }
    return true;
  }
  // Zurueck schliesst das Blatt und uebernimmt die Auswahl aus der Adresse
  // des Eintrags, auf dem man landet: steht dort kein Item, ist auch keines
  // mehr gewaehlt. Sonst schriebe die naechste Aenderung das alte Item in
  // die Adresse der Liste, und ein Neuladen oeffnete das Blatt wieder.
  // Vorwaerts auf einen Eintrag, den das Blatt angelegt hat, oeffnet es
  // wieder, mit der Auswahl aus der Adresse und ohne neuen Eintrag.
  // Ein noch wartender Schreibvorgang gehoert zum Eintrag, von dem man kam,
  // und verfaellt beim Zurueck oder Vorwaerts des Nutzers: er schriebe sonst
  // den alten Stand in den Eintrag, auf dem man landet (etwa die Id statt des
  // Namens in einen geteilten Link). Wer hier oeffnet oder leert, stoesst
  // schreibeUrl() neu an, mit dem Stand nach der Uebernahme.
  // item= nimmt die Id, ersatzweise den Namen (geteilte Links von Hand).
  function itemAusWunsch(w) {
    if (!w) return null;
    if (BYID[w]) return BYID[w];
    var k = String(w).trim().toLowerCase();
    for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].name.toLowerCase() === k) return ITEMS[i];
    return null;
  }
  function auswahlAusAdresse(ohneUrl) {
    var p = new URLSearchParams(location.search), it = itemAusWunsch(p.get('item')), sid = p.get('satz');
    if (it) { if (S.item !== it.id) oeffneItem(it, { still: true, ohneUrl: ohneUrl }); return true; }
    if (sid && SETS[sid]) { if (S.satz !== sid) oeffneSatz(SETS[sid], { still: true, ohneUrl: ohneUrl }); return true; }
    return false;
  }
  // Filter, Suche und Sortierung aus der Adresse, ausgehend vom Grundstand
  // (leseUrl setzt nur, was in der Adresse steht). Liefert, ob sich die
  // Trefferliste dadurch aendert.
  function filterSchluessel() {
    return [S.tab, S.gruppe && S.gruppe.s, S.blatt && S.blatt.s, S.q, S.art, S.gr, S.pk, S.sel, S.set, S.sort].join('|');
  }
  function filterAusAdresse() {
    var vorher = filterSchluessel();
    setzeTab('items', true);
    S.gruppe = null; S.blatt = null; S.q = ''; S.art = 'all'; S.gr = null;
    S.pk = null; S.sel = null; S.set = null; S.sort = 'relevanz';
    el.q.value = ''; el.suche.classList.remove('hat-text');
    leseUrl();
    return filterSchluessel() !== vorher;
  }
  // Zurueck und Vorwaerts des Nutzers stellen den Eintrag her, auf dem man
  // landet: Filter und Auswahl aus seiner Adresse, ohne in sie zu schreiben.
  // Das eigene Zurueck aus telefonZu() ist keine solche Navigation: dort hat
  // der Aufrufer gerade Filter fuer die Liste gesetzt, und sein wartender
  // Schreibvorgang traegt sie in deren Eintrag.
  window.addEventListener('popstate', function (e) {
    var eigenes = eigenesZurueck;
    eigenesZurueck = false;
    clearTimeout(zurueckTimer);
    // Eigenes Zurueck: jetzt erst steht der Eintrag der Liste an, und dorthin
    // gehoert der Stand, den der Aufrufer gesetzt hat (schreibeUrl wartet
    // bis hierher, siehe dort). Sonst verfaellt ein wartender Schreibvorgang.
    if (eigenes) schreibeUrl();
    else clearTimeout(urlTimer);
    var offen = el.blatt.classList.contains('is-offen');
    if (!eigenes && bereit && filterAusAdresse()) anwenden({ ohneUrl: true });
    if (!(e.state && e.state.wzBlatt)) {
      if (offen) telefonZu(true);
      if (bereit && !auswahlAusAdresse(!eigenes) && (S.item || S.satz)) ueberblick({ ohneUrl: !eigenes });
      return;
    }
    // Auswahl aus der Adresse in jeder Breite; nur das Overlay ist Sache
    // des Telefons.
    if (!bereit) return;
    if (auswahlAusAdresse(true) && TELEFON.matches && !offen) telefonAuf(true);
  });
  el.x.addEventListener('click', function () { telefonZu(false); });
  el.blatt.addEventListener('click', function (e) { if (e.target === el.blatt) telefonZu(false); });
  TELEFON.addEventListener && TELEFON.addEventListener('change', function (m) {
    if (!m.matches && el.blatt.classList.contains('is-offen')) {
      el.blatt.classList.remove('is-offen');
      aussenTraege(false);
      if (window.VBScrollLock) window.VBScrollLock.unlock();
    }
  });

  el.zur.addEventListener('click', function () {
    var z = STAPEL.pop();
    if (!z) return;
    if (z.typ === 'item' && BYID[z.id]) oeffneItem(BYID[z.id], { stapel: true, still: true });
    else if (z.typ === 'satz' && SETS[z.id]) oeffneSatz(SETS[z.id], { stapel: true, still: true });
  });

  function aktuellerEintrag() {
    if (S.item && BYID[S.item]) return { typ: 'item', id: S.item, name: BYID[S.item]._n };
    if (S.satz && SETS[S.satz]) return { typ: 'satz', id: S.satz, name: SETS[S.satz].name };
    return null;
  }
  el.inh.addEventListener('click', function (e) {
    var t = e.target.closest('button,a');
    if (!t || !el.inh.contains(t)) return;
    if (t.hasAttribute('data-oeffne')) {
      var it = BYID[t.getAttribute('data-oeffne')];
      if (!it || it.id === S.item) return;
      var cur = aktuellerEintrag();
      if (cur) STAPEL.push(cur);
      oeffneItem(it, { stapel: true, still: true });
    } else if (t.hasAttribute('data-satz')) {
      var st = SETS[t.getAttribute('data-satz')];
      if (!st) return;
      var c2 = aktuellerEintrag();
      if (c2) STAPEL.push(c2);
      oeffneSatz(st, { stapel: true, still: true });
    } else if (t.hasAttribute('data-setfilter')) {
      S.set = t.getAttribute('data-setfilter');
      setzeTab('items', true);
      S.gruppe = null; S.blatt = null;
      telefonZu(false);
      anwenden();
    } else if (t.hasAttribute('data-gruppe') && t.tagName === 'BUTTON') {
      var g = G_SLUG[t.getAttribute('data-gruppe')];
      if (g) { telefonZu(false); waehleKat(g, null); }
    } else if (t.hasAttribute('data-kat') && t.tagName === 'BUTTON') {
      var gr = G_ROOT[t.getAttribute('data-root')];
      var b = null;
      if (gr) gr.b.forEach(function (x) { if (x.s === t.getAttribute('data-kat')) b = x; });
      if (b) { telefonZu(false); waehleKat(gr, b); }
    } else if (t.hasAttribute('data-alle-quellen')) {
      // Der Knopf verschwindet; der Fokus geht auf die erste neu gezeigte
      // Quelle, statt auf den Seitenanfang zu fallen.
      var neu = t.parentNode.querySelectorAll('.wzb-q li[hidden]');
      neu.forEach(function (li) { li.hidden = false; });
      if (neu[0]) { neu[0].setAttribute('tabindex', '-1'); try { neu[0].focus({ preventScroll: true }); } catch (e2) {} }
      t.remove();
    }
  });

  /* ---------- Treffer bedienen ---------- */
  el.gitter.addEventListener('click', function (e) {
    var weg = e.target.closest('[data-alles-weg]');
    if (weg) { allesZurueck(); return; }
    var tag = e.target.closest('.wz-tag[data-set]');
    if (tag) {
      e.preventDefault(); e.stopPropagation();
      S.set = tag.getAttribute('data-set');
      anwenden();
      return;
    }
    var k = e.target.closest('.wz-k');
    if (!k || k.classList.contains('wz-k--leer')) return;
    if (e.target.closest('a') && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)) return;
    e.preventDefault();
    waehleKachel(k);
  });
  el.gitter.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var k = e.target.closest('.wz-k');
    if (!k || e.target !== k) return;
    e.preventDefault();
    waehleKachel(k);
  });
  function waehleKachel(k) {
    if (k.hasAttribute('data-satz')) { var st = SETS[k.getAttribute('data-satz')]; if (st) oeffneSatz(st); }
    else { var it = BYID[k.getAttribute('data-id')]; if (it) oeffneItem(it); }
  }
  el.gitter.addEventListener('scroll', function () {
    el.gitter.classList.toggle('is-oben', el.gitter.scrollTop > 4);
  }, { passive: true });

  // Pfeiltasten: naechster oder voriger Treffer, wie in einer Liste.
  function schritt(d) {
    if (!TREFFER.length) return;
    var key = S.tab === 'sets' ? 'satz' : 'item';
    var cur = S[key], idx = -1;
    for (var i = 0; i < TREFFER.length; i++) if (TREFFER[i].id === cur) { idx = i; break; }
    var ni = idx < 0 ? 0 : Math.max(0, Math.min(TREFFER.length - 1, idx + d));
    if (ni === idx) return;
    while (ni >= GEZEIGT && GEZEIGT < TREFFER.length) mehr();
    var x = TREFFER[ni];
    pfeilWahl = x.id;
    if (key === 'satz') oeffneSatz(x, { still: true }); else oeffneItem(x, { still: true });
    var k = markiere();
    if (k) k.scrollIntoView({ block: 'nearest', behavior: STILL.matches ? 'auto' : 'smooth' });
  }

  /* ---------- Suche, Sortierung, Ansicht, Reiter ---------- */
  var tippTimer = 0;
  // Was die Pfeiltasten zuletzt gewaehlt haben: Enter oeffnet dann diesen
  // Treffer (am Telefon im Blatt), nicht den ersten. Tippen hebt das auf.
  var pfeilWahl = null;
  el.q.addEventListener('input', function () {
    pfeilWahl = null;
    el.suche.classList.toggle('hat-text', !!el.q.value);
    clearTimeout(tippTimer);
    tippTimer = setTimeout(function () { S.q = el.q.value.trim(); anwenden(); }, 110);
  });
  el.q.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault(); clearTimeout(tippTimer); S.q = el.q.value.trim(); anwenden();
      var ziel = null;
      if (pfeilWahl) for (var i = 0; i < TREFFER.length; i++) if (TREFFER[i].id === pfeilWahl) { ziel = TREFFER[i]; break; }
      ziel = ziel || TREFFER[0];
      if (ziel) { if (S.tab === 'sets') oeffneSatz(ziel); else oeffneItem(ziel); }
    }
  });
  el.leeren.addEventListener('click', function (e) {
    e.preventDefault();
    el.q.value = ''; S.q = ''; el.suche.classList.remove('hat-text');
    anwenden(); el.q.focus();
  });
  el.sort.addEventListener('change', function () { S.sort = el.sort.value; anwenden(); });
  wz.querySelectorAll('.wz-ansicht button').forEach(function (b) {
    b.addEventListener('click', function () {
      S.ansicht = b.getAttribute('data-ansicht');
      try { localStorage.setItem('wz-items-ansicht', S.ansicht); } catch (e) {}
      ansichtKnoepfe();
      el.gitter.classList.toggle('is-liste', S.ansicht === 'liste');
      if (!STILL.matches) { el.gitter.classList.remove('is-frisch'); void el.gitter.offsetWidth; el.gitter.classList.add('is-frisch'); }
      schreibeUrl();
    });
  });
  function ansichtKnoepfe() {
    wz.querySelectorAll('.wz-ansicht button').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-ansicht') === S.ansicht ? 'true' : 'false');
    });
  }
  function setzeTab(t, still) {
    S.tab = t;
    wz.querySelectorAll('.wz-reiter__b').forEach(function (b) {
      var an = b.getAttribute('data-tab') === t;
      b.setAttribute('aria-selected', an ? 'true' : 'false');
      b.tabIndex = an ? 0 : -1;
      if (an && el.bereich) el.bereich.setAttribute('aria-labelledby', b.id);
    });
    pfeilWahl = null;
    if (!still) anwenden();
  }
  wz.querySelectorAll('.wz-reiter__b').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = b.getAttribute('data-tab');
      if (t === S.tab) return;
      setzeTab(t, true);
      if (t === 'sets') { S.set = null; }
      anwenden();
    });
    // Reiterleiste nach APG: Pfeile, Pos1 und Ende wechseln und aktivieren.
    b.addEventListener('keydown', function (e) {
      var alle = Array.prototype.slice.call(wz.querySelectorAll('.wz-reiter__b'));
      var i = alle.indexOf(b), n = -1;
      if (e.key === 'ArrowRight') n = (i + 1) % alle.length;
      else if (e.key === 'ArrowLeft') n = (i - 1 + alle.length) % alle.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = alle.length - 1;
      if (n < 0) return;
      e.preventDefault();
      alle[n].focus();
      alle[n].click();
    });
  });
  el.aktiv.addEventListener('click', function (e) {
    var c = e.target.closest('[data-weg]');
    if (!c) return;
    var k = c.getAttribute('data-weg');
    if (k === 'kat') { S.gruppe = null; S.blatt = null; }
    else if (k === 'set') S.set = null;
    else if (k === 'art') S.art = 'all';
    else if (k === 'gr') S.gr = null;
    else if (k === 'pk') S.pk = null;
    else if (k === 'sel') S.sel = null;
    anwenden();
  });
  function allesZurueck() {
    S.gruppe = null; S.blatt = null; S.set = null; S.art = 'all'; S.gr = null; S.pk = null; S.sel = null;
    S.q = ''; el.q.value = ''; el.suche.classList.remove('hat-text');
    anwenden();
  }
  // Ueberblick: die Gruppen-Kacheln (statisch im Blatt).
  el.inh.addEventListener('click', function (e) {
    var g = e.target.closest('.wzu__g');
    if (!g) return;
    var grp = G_SLUG[g.getAttribute('data-gruppe')];
    if (grp) waehleKat(grp, null);
  });

  // „/“ gehoert hier der eigenen Suche. Die Seitensuche (search-overlay.js)
  // lauscht am document und laesst die Taste, wenn sie schon vergeben ist
  // (defaultPrevented); deshalb in der Einfangphase am window, vor ihr.
  window.addEventListener('keydown', function (e) {
    var t = e.target;
    var tipp = t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (e.key !== '/' || tipp || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    var ueber = document.getElementById('scs');
    if (ueber && !ueber.hidden) return;
    e.preventDefault(); el.q.focus(); el.q.select();
  }, true);
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    var tipp = t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (e.key === 'Escape') {
      var hilfe = wz.querySelector('.wz-hilfe[open]');
      if (hilfe) { hilfe.removeAttribute('open'); return; }
      if (el.sch.classList.contains('is-open')) { schublade(false); return; }
      if (telefonZu(false)) return;
      if (t === el.q && el.q.value) { el.q.value = ''; S.q = ''; el.suche.classList.remove('hat-text'); anwenden(); }
      return;
    }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && (!tipp || t === el.q) && !e.altKey && !e.ctrlKey && !e.metaKey) {
      if (el.sch.classList.contains('is-open') || el.blatt.classList.contains('is-offen')) return;
      if (t && t.closest && t.closest('.wz-blatt__box')) return;
      e.preventDefault();
      schritt(e.key === 'ArrowDown' ? 1 : -1);
    }
  });
  // Hilfe: Klick daneben schliesst sie.
  document.addEventListener('click', function (e) {
    var hilfe = wz.querySelector('.wz-hilfe[open]');
    if (hilfe && !hilfe.contains(e.target)) hilfe.removeAttribute('open');
  });

  /* ---------- Adresse ---------- */
  var urlTimer = 0;
  // Adresse des aktuellen Zustands (Filter, Suche, Auswahl).
  function adresse() {
    var p = new URLSearchParams();
    if (S.tab === 'sets') p.set('tab', 'sets');
    if (S.tab === 'items') {
      if (S.blatt) { p.set('gruppe', S.blatt.gr.s); p.set('kat', S.blatt.s); }
      else if (S.gruppe) p.set('gruppe', S.gruppe.s);
    }
    if (S.q) p.set('q', S.q);
    if (S.art !== 'all') p.set('art', S.art);
    if (S.gr != null) p.set('gr', String(S.gr));
    if (S.pk) p.set('pk', S.pk);
    if (S.sel) p.set('sel', S.sel);
    if (S.set) p.set('set', S.set);
    if (S.sort !== 'relevanz') p.set('sort', S.sort);
    if (S.item) p.set('item', S.item);
    if (S.satz) p.set('satz', S.satz);
    var qs = p.toString();
    return location.pathname + (qs ? '?' + qs : '') + location.hash;
  }
  function schreibeUrl() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(function () {
      // Waehrend des eigenen Zurueck steht noch der Blatteintrag an; der
      // popstate stoesst das Schreiben fuer den Listeneintrag neu an.
      if (eigenesZurueck) return;
      var neu = adresse();
      if (neu !== location.pathname + location.search + location.hash) {
        try { history.replaceState(history.state, '', neu); } catch (e) {}
      }
    }, 60);
  }
  function leseUrl() {
    var p = new URLSearchParams(location.search);
    if (p.get('tab') === 'sets') setzeTab('sets', true);
    var g = p.get('gruppe') && G_SLUG[p.get('gruppe')];
    if (g) {
      S.gruppe = g;
      var k = p.get('kat');
      if (k) g.b.forEach(function (b) { if (b.s === k) S.blatt = b; });
    } else if (p.get('kat') && B_SLUG[p.get('kat')]) {
      S.blatt = B_SLUG[p.get('kat')]; S.gruppe = S.blatt.gr;
    }
    if (p.get('q')) { S.q = p.get('q'); el.q.value = S.q; el.suche.classList.add('hat-text'); }
    if (/^(buy|loot|exclusive|catalog)$/.test(p.get('art') || '')) S.art = p.get('art');
    if (p.get('gr') != null && /^\d+$/.test(p.get('gr'))) S.gr = Number(p.get('gr'));
    if (p.get('pk')) S.pk = p.get('pk');
    if (p.get('sel')) S.sel = p.get('sel');
    if (p.get('set')) S.set = p.get('set');
    if (/^(relevanz|name|name-z|wert|preis|preis-z)$/.test(p.get('sort') || '')) S.sort = p.get('sort');
    sortWahl();
    try { var a = localStorage.getItem('wz-items-ansicht'); if (a === 'liste' || a === 'kacheln') S.ansicht = a; } catch (e) {}
    ansichtKnoepfe();
    return { item: p.get('item'), satz: p.get('satz') };
  }

  /* ---------- Masse ---------- */
  var messTimer = 0;
  function messen() {
    cancelAnimationFrame(messTimer);
    messTimer = requestAnimationFrame(function () {
      var liste = el.gitter.parentNode;
      var y = liste.getBoundingClientRect().top + window.scrollY;
      wz.style.setProperty('--wz-y', Math.round(y) + 'px');
      var z = el.zahl.getBoundingClientRect().height + parseFloat(getComputedStyle(el.zahl).marginBottom || 0);
      wz.style.setProperty('--wz-zahl', Math.round(z) + 'px');
    });
  }
  window.addEventListener('resize', function () { messen(); clearTimeout(beobTimer); beobTimer = setTimeout(beobachter, 200); }, { passive: true });
  var beobTimer = 0;
  if ('ResizeObserver' in window) {
    var ro = new ResizeObserver(messen);
    [wz.querySelector('.wz-kopf'), wz.querySelector('.wz-bar'), el.chips].forEach(function (x) { if (x) ro.observe(x); });
  }

  /* ---------- Start ---------- */
  // Am schmalen Telefon passt der lange Platzhalter nicht ins Feld; dort
  // steht die kurze Fassung (die Lupe sagt schon, dass es sucht).
  function platzhalter() {
    var p = SCHMAL.matches && W.sucheKurz ? W.sucheKurz : W.suche;
    if (p && el.q.placeholder !== p) el.q.placeholder = p;
  }
  platzhalter();
  if (SCHMAL.addEventListener) SCHMAL.addEventListener('change', platzhalter);
  var wunsch = leseUrl();
  messen();
  requestAnimationFrame(function () { document.documentElement.classList.add('wz-bereit'); });
  setTimeout(function () { wz.classList.remove('wz-auftakt'); }, Math.round(1500 * ZT));

  function ladeKatalog() {
    ladeFehler = false;
    el.gitter.setAttribute('aria-busy', 'true');
    fetch(C.dbUrl || '/assets/universal-items.json').then(function (r) {
      if (!r.ok) throw new Error('items db http ' + r.status);
      return r.json();
    }).then(function (db) {
      vorbereiten(db || {});
      bereit = true;
      var it = null, st = null;
      it = itemAusWunsch(wunsch.item);
      if (it) S.item = it.id;
      if (wunsch.satz && SETS[wunsch.satz]) { st = SETS[wunsch.satz]; S.satz = st.id; }
      anwenden({ bisAuswahl: true });
      if (it) oeffneItem(it, { still: !TELEFON.matches });
      else if (st) oeffneSatz(st, { still: !TELEFON.matches });
      var k = markiere();
      if (k && !TELEFON.matches) k.scrollIntoView({ block: 'nearest' });
    }).catch(function (err) {
      console.warn('Items-Werkbank: Katalog nicht geladen.', err);
      ladeFehler = true;
      zeigeLadefehler();
    });
  }
  ladeKatalog();
})();
