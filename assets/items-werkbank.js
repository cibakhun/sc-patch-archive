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
    // Flugblaetter: Seite nur mit Bezugsweg oder Fundort (wie isIndexable).
    if (g && g.gameType === 'FlightController') return false;
    // Mehrdeutige Namen tragen ihre Werte je Ausfuehrung in variants (wie
    // isIndexable): auch sie haben ein Datenblatt.
    if (g && g.variants && g.variants.length) return true;
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
    // Ortsart ohne bestaetigten Ort: eigener Text, in der Sprache der Seite.
    if (o.kind === 'loot' && C.lootOrte && Object.prototype.hasOwnProperty.call(C.lootOrte, o.loc)) return C.lootOrte[o.loc];
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

  // Hersteller der Sets wie auf der Set-Seite (setHersteller() in
  // scripts/lib/armor-sets.mjs): Kurzform des Set-Tags -> Anzeigename,
  // „Unknown" -> kein Hersteller.
  function setHersteller(m) {
    m = typeof m === 'string' ? m.trim() : '';
    if (!m || /^unknown$/i.test(m)) return null;
    var A = C.setHersteller || {};
    return Object.prototype.hasOwnProperty.call(A, m) ? A[m] : m;
  }
  function vorbereiten(db) {
    ITEMS = db.items || [];
    FUNDORTE = db.fundorte || null;
    SETS = karte();
    SETLISTE = db.sets || [];
    SETLISTE.forEach(function (s) { s.manufacturer = setHersteller(s.manufacturer); SETS[s.id] = s; });
    ITEMS.forEach(function (it, pos) {
      // Position im Katalog: /items-wege.json zaehlt Items so (WEGE.i).
      it._i = pos;
      if (FUNDORTE) lootZeilen(it);
      var g = it.game || null;
      it._root = rootOf(it.category);
      it._gr = G_ROOT[it._root] || null;
      it._b = B_CAT[it.category] || null;
      it._kc = farbe(it._root);
      it._g = zeichen(it);
      // Name wie im Spiel, auf beiden Sprachen; der deutsche Name steht als
      // Zweitname darunter (Sprachregel, wie altName() und displayName() in
      // src/lib/items.ts).
      var nde = g && g.nameDe ? String(g.nameDe).trim() : '';
      it._n = it.name;
      it._alt = nde && nde !== it.name ? nde : null;
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
  // Wie gut trifft der Name (oder der Zweitname) die Suche? 0 genau, 1 beginnt damit, 2 alle
  // Woerter am Wortanfang, 3 alle Woerter irgendwo, 4 nur Hersteller, Ort usw.
  function suchRang(it) {
    var r = nameRang(it._n);
    return it._alt ? Math.min(r, nameRang(it._alt)) : r;
  }
  function nameRang(name) {
    var n = name.toLowerCase(), q = QW.join(' ');
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
    var h = '<h3 class="wzb-h" id="wzb-quellen" tabindex="-1">' + esc(w('hQuellen')) + (it.obtain.length ? '<em>' + fmt(it.obtain.length) + '</em>' : '') + '</h3>';
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
    // Fuer den System-Filter (wegeEinsetzen): Zeile i des Blatts ist zeilen[i].
    it._zeilen = zeilen;
    var GRENZE = 8;
    // Durchschnitt und Spanne wie ueber der Tabelle des Datenblatts.
    var lo = preise.length ? preise[0].price : null, hi = preise.length ? preise[preise.length - 1].price : null;
    var avg = avgPrice(it);
    var pz = [];
    if (avg != null) pz.push(esc(w('kSchnitt')) + ' <b>' + esc(auec(avg)) + '</b>');
    if (lo != null && hi != null && hi !== lo) pz.push(esc(tr('priceRange', 'Preisspanne')) + ' <b data-spanne>' + esc(fmt(lo) + '–' + fmt(hi)) + '</b>');
    if (pz.length) h += '<p class="wzb-preise">' + pz.join(' · ') + '</p>';
    // „Kaufen nach System“: die Knoepfe setzt wegeEinsetzen(), es kennt die Systeme.
    h += '<div class="wzb-sys" role="group" data-sysfilter hidden></div>';
    var li = zeilen.map(function (o, i) {
      var st = '';
      if (o.kind === 'loot') {
        st = o.ort
          ? '<span class="wzb-st is-ok" title="' + esc(tr('lootConfirmedTitle', '')) + '">' + esc(tr('lootConfirmed', 'bestätigt')) + '</span>'
          : '<span class="wzb-st" title="' + esc(tr('lootUnconfirmedTitle', '')) + '">' + esc(tr('lootUnconfirmed', 'unbestätigt')) + '</span>';
      }
      var unter = [kindLabel(o.kind)];
      if (o.wo) unter.push(woText(o.wo));
      return '<li data-art="' + esc(o.kind) + '" data-z="' + i + '"' + (i >= GRENZE ? ' hidden' : '') + '>' +
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
    // Stand der Kaufpreise, wo ein Preis nicht aus dem eigenen Schnappschuss kommt (wie das Blatt).
    if (C.preisStand && it.obtain.some(function (o) { return o.price != null && o.src !== 'schnappschuss'; })) notiz += ' ' + tr('pricesAsOf', 'Stand der Preise') + ' ' + C.preisStand + '.';
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
      (it._alt ? '<p class="wzb-alt" lang="de">' + esc(it._alt) + '</p>' : '') +
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
    // Kein Knopf aufs Datenblatt und keiner auf die Kategorieliste (Krisz
    // 27.11.2026: „wofür sollte ein User den Datenblatt öffnen?“; Regel „nur
    // Werkbänke für Menschen“ vom 26.11.2026): was das Blatt beantwortet,
    // steht in diesem Blatt, die Kategorie filtert der Pfad oben an Ort und
    // Stelle. Erze fuehren auf die Mining-Werkbank, die ihre Fundorte kennt.
    if (erzA) {
      h += '<a class="wzb-haupt" href="' + esc(erzA.url) + '"><span class="wi wi--mining" aria-hidden="true"></span>' + esc(tr('oreLink', 'Fundorte auf der Mining-Seite')) + '</a>';
    }
    var st = setOf(it);
    if (st) h += '<button type="button" class="wzb-neben" data-satz="' + esc(st.id) + '"><span class="wi wi--layers" aria-hidden="true"></span><span>' + esc(w('setAnsehen')) + '</span><span class="wi wi--arrow" aria-hidden="true"></span></button>';
    h += '</div>';
    // „So bekommst du es“ und gleichnamige Items: fuellt wegeEinsetzen(),
    // sobald /items-wege.json da ist.
    h += '<div id="wzb-wege" class="wzb-wege"></div>';
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
    // Fahrzeug, ab Werk, Werkzeuge, Aehnliches, Melden: wegeEinsetzen().
    h += '<div id="wzb-mehr"></div>';
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
      h += setPreisHtml(st.id);
      h += '<div class="wzb-akt" style="margin-top:.5rem"><button type="button" class="wzb-neben" data-setfilter="' + esc(st.id) + '"><span>' + esc(w('setTeile')) + '</span><span class="wi wi--arrow" aria-hidden="true"></span></button></div>';
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
      '<button type="button" class="wzb-haupt" data-setfilter="' + esc(st.id) + '"><span class="wi wi--grid4" aria-hidden="true"></span>' + esc(w('setTeile')) + '</button></div>';
    h += setPreisHtml(st.id);
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
          // Die Stelle in der Rezeptdatei: die Crafting-Werkbank oeffnet das
          // Rezept damit (?bpi=) auch bei gleichnamigen Bauplaenen.
          db.blueprints.forEach(function (bp, stelle) {
            if (!bp.name) return;
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
  // Die Crafting-Werkbank mit genau diesem Rezept (?bp= Name, ?bpi= Stelle).
  function craftHref(bp) {
    return (C.craftPage || '/topics/crafting.html') + '?bp=' + encodeURIComponent(bp.name) + '&bpi=' + bp.__stelle;
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
        '<a class="wzb-neben" href="' + esc(craftHref(bp)) + '"><span class="wi wi--fab" aria-hidden="true"></span><span>' + esc(w('craftOeffnen')) + '</span><span class="wi wi--arrow" aria-hidden="true"></span></a>');
    }
  }

  /* ---------- Was das Datenblatt beantwortet ---------- */
  // Krisz 27.11.2026: „Da steht wieder ganz fett Datenblatt öffnen. Aber
  // wofür sollte ein User den Datenblatt öffnen?“ Seither beantwortet das
  // Blatt der Werkbank alles, was das Datenblatt beantwortet (Bericht
  // „Datenblätter und Werkbänke“, Item-Teil): alle Wege („So bekommst du
  // es“), die Missionen zum Bauplan, Wikelo, ab Werk, das Fahrzeug, die
  // Werkzeuge, Aehnliches, Gleichnamiges, den Set-Preis, Kaufen nach System
  // und Melden. Gerechnet hat der Bau, mit denselben Funktionen wie das Blatt
  // (src/lib/itemsWerkbankWege.ts -> C.wegeUrl); hier wird nur gesetzt.
  // verify:werkbank-items haelt jede Antwort gegen das gebaute Blatt. Links
  // fuehren nur in Werkbaenke und Werkzeuge, nie auf ein Datenblatt.
  var WEGE = null, wegeLaeuft = null;
  function ladeWege() {
    if (WEGE || !C.wegeUrl) return Promise.resolve();
    if (wegeLaeuft) return wegeLaeuft;
    wegeLaeuft = fetch(C.wegeUrl)
      .then(function (r) {
        if (!r.ok) throw new Error('items-wege http ' + r.status);
        return r.json();
      })
      .then(function (d) {
        // Positionen gelten nur fuer genau diesen Katalog.
        if (!d || !d.i || d.i.length !== ITEMS.length) throw new Error('items-wege passt nicht zum Katalog');
        WEGE = d;
      })
      .catch(function () { wegeLaeuft = null; });
    return wegeLaeuft;
  }
  function bw(k) { var s = C.bw && C.bw[k]; return s == null ? k : s; }
  function fuell(s, v) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; }); }
  function schiffHref(name) { return (C.schiffe || '/schiffe.html') + '?q=' + encodeURIComponent(name); }
  function wikeloHref(it) { return (C.wikelo || '/topics/wikelo-emporium.html') + '?item=' + encodeURIComponent(it.name); }
  function pfeil() { return '<span class="wi wi--arrow" aria-hidden="true"></span>'; }

  var SYSTEME = ['Stanton', 'Pyro', 'Nyx'];
  // Zwilling von zeilenSysteme() in src/lib/bezugswege.ts.
  function zeilenSysteme(o) {
    if (o.kind === 'exclusive') return [];
    if (o.wo) {
      var keys = Object.keys(o.wo).map(function (k) { return k.toLowerCase(); });
      return SYSTEME.filter(function (s) { return keys.indexOf(s.toLowerCase()) >= 0; });
    }
    var s = WEGE && WEGE.sys[o.loc];
    return s ? [s] : [];
  }
  // Zwilling von kaufGruppen() in src/lib/bezugswege.ts.
  function kaufGruppen(it) {
    var by = karte();
    it.obtain.forEach(function (o) {
      if ((o.kind !== 'shop' && o.kind !== 'vehicle') || o.price == null || !(o.price > 0)) return;
      var sys = (WEGE && WEGE.sys[o.loc]) || '';
      var g = by[sys];
      if (g) { g.stellen++; if (o.price < g.ab) g.ab = o.price; }
      else by[sys] = { system: sys || null, stellen: 1, ab: o.price };
    });
    return SYSTEME.concat(['']).map(function (s) { return by[s]; }).filter(Boolean);
  }

  // Preiszeile eines Sets, derselbe Text wie auf dem Datenblatt
  // (setPreisText() in src/lib/setPreisText.ts). Ohne geladene Wege ein
  // Platzhalter, den setPreisNachtragen() fuellt.
  function setPreisHtml(id) {
    if (!WEGE) return '<p class="wzb-setpreis" data-setpreis-platz="' + esc(id) + '"></p>';
    var z = WEGE.sets[id];
    if (!z) return '';
    return '<p class="wzb-setpreis' + (z[3] ? ' is-leer' : '') + '" data-set-preis' + (z[4] ? ' title="' + esc(z[4]) + '"' : '') + '><b>' + esc(z[0]) + '</b>' +
      (z[1] ? '<span> · ' + esc(z[1]) + '</span>' : '') + (z[2] ? '<span class="wzb-setpreis__ort"> · ' + esc(z[2]) + '</span>' : '') + '</p>';
  }
  function setPreisNachtragen(root) {
    if (!WEGE || !root) return;
    Array.prototype.forEach.call(root.querySelectorAll('[data-setpreis-platz]'), function (p) {
      var h = setPreisHtml(p.getAttribute('data-setpreis-platz'));
      if (h) p.insertAdjacentHTML('beforebegin', h);
      p.remove();
    });
  }

  // „So bekommst du es“: Zwilling von src/components/Bezugswege.astro, je
  // Weg eine Karte mit ihrem naechsten Schritt.
  var MISSIONEN_OFFEN = 3, STOCK_NAMEN = 2, SCHIFFE_OFFEN = 4, ORTE_OFFEN = 3, STOCK_OFFEN = 12;
  function wegKarte(art, titel, inhalt) {
    return '<li class="wzb-weg' + (art === 'herstellen' ? ' wzb-weg--craft' : '') + '" data-weg="' + art + '"><span class="wzb-weg__art">' + esc(titel) + '</span>' + inhalt + '</li>';
  }
  function sprung(ziel, text) {
    return '<button type="button" class="wzb-weg__l" data-sprung="' + ziel + '">' + esc(text) + ' ↓</button>';
  }
  function wegeHtml(it, e) {
    var karten = [];
    var gruppen = kaufGruppen(it);
    if (gruppen.length && it._p != null) {
      var stellen = gruppen.reduce(function (n, g) { return n + g.stellen; }, 0);
      var h = '<strong class="wzb-weg__h">' + esc(fuell(bw('buyFrom'), { p: auec(it._p) })) + '</strong>';
      if (gruppen.length === 1 && gruppen[0].system) {
        h += '<span class="wzb-weg__n" data-system="' + esc(gruppen[0].system) + '">' + esc(fuell(bw(stellen === 1 ? 'buyStelleIn' : 'buyStellenIn'), { n: fmt(stellen), sys: gruppen[0].system })) + '</span>';
      } else {
        h += '<span class="wzb-weg__n">' + esc(stellen === 1 ? bw('buyStelle') : fuell(bw('buyStellen'), { n: fmt(stellen) })) + '</span>';
        h += '<ul class="wzb-weg__z">' + gruppen.map(function (g) {
          return '<li data-system="' + esc(g.system || 'ohne') + '">' + esc(fuell(bw(g.stellen === 1 ? 'buyGroupOne' : 'buyGroup'), { sys: g.system || bw('buyNoSystem'), n: fmt(g.stellen), p: auec(g.ab) })) + '</li>';
        }).join('') + '</ul>';
      }
      karten.push(wegKarte('kaufen', bw('buy'), h + sprung('wzb-quellen', bw('buyAll'))));
    }
    var loot = it.obtain.filter(function (o) { return o.kind === 'loot'; });
    var best = loot.filter(function (o) { return o.ort; });
    // Unbestaetigte Orte in der Reihenfolge des Blatts (sortedObtain: nach Name).
    var rech = loot.filter(function (o) { return !o.ort; }).sort(function (a, b) { return a.loc.localeCompare(b.loc, 'en'); });
    var unbekannt = !!(it.game && it.game.lootable === true && it.obtain.length === 0);
    if (loot.length || unbekannt) {
      var fh = '';
      if (best.length) fh += '<strong class="wzb-weg__h">' + esc(best.length === 1 ? bw('findConfirmedOne') : fuell(bw('findConfirmed'), { n: fmt(best.length) })) + '</strong>';
      else if (rech.length) fh += '<strong class="wzb-weg__h">' + esc(rech.length === 1 ? bw('findResearchOne') : fuell(bw('findResearch'), { n: fmt(rech.length) })) + '</strong>';
      var nq = best.length ? best : rech;
      if (nq.length) fh += '<span class="wzb-weg__n">' + esc(nq.slice(0, ORTE_OFFEN).map(obtainText).join(', ') + (nq.length > ORTE_OFFEN ? ' …' : '')) + '</span>';
      if (best.length && rech.length) fh += '<span class="wzb-weg__n" data-fund="recherche">' + esc(rech.length === 1 ? bw('findResearchOne') : fuell(bw('findResearch'), { n: fmt(rech.length) })) + '</span>';
      if (unbekannt) fh += '<span class="wzb-weg__n">' + esc(bw('findUnknown')) + '</span>';
      if (loot.length) fh += sprung('wzb-quellen', bw('findAll'));
      karten.push(wegKarte('finden', bw('find'), fh));
    }
    if (e.h) {
      var bp = CRAFT && CRAFT[it.id];
      var m = e.m || [0];
      var ch = '';
      if (m[0] > 0) {
        ch += '<span class="wzb-weg__n">' + esc(m[0] === 1 ? bw('craftMissionsOne') : bw('craftMissions')) + '</span>';
        ch += '<ul class="wzb-weg__z" data-missionen="' + m[0] + '">' + m.slice(1).map(function (x) {
          return '<li><span lang="en">' + esc(x[0]) + '</span>' + (x[1] ? esc(' (' + x[1] + ')') : '') + '</li>';
        }).join('') + '</ul>';
        if (m[0] > MISSIONEN_OFFEN && bp) ch += '<a class="wzb-weg__l" href="' + esc(craftHref(bp)) + '">' + esc(fuell(w('craftMehr'), { n: fmt(m[0] - MISSIONEN_OFFEN) })) + ' →</a>';
      } else if (!e.hw) {
        ch += '<span class="wzb-weg__n" data-quelle="unbekannt">' + esc(bw('craftUnknown')) + '</span>';
      }
      if (e.hw) ch += '<span class="wzb-weg__n">' + esc(bw('craftWikelo')) + '</span>';
      if (bp) ch += '<a class="wzb-weg__l" href="' + esc(craftHref(bp)) + '">' + esc(w('craftOeffnen')) + ' →</a>';
      karten.push(wegKarte('herstellen', bw('craft'), ch));
    }
    if (e.w) {
      karten.push(wegKarte('wikelo', bw('wikelo'), '<span class="wzb-weg__n">' + esc(e.w === 1 ? bw('wikeloOne') : fuell(bw('wikeloMany'), { n: fmt(e.w) })) + '</span>' +
        '<a class="wzb-weg__l" href="' + esc(wikeloHref(it)) + '">' + esc(bw('wikeloOpen')) + ' →</a>'));
    }
    if (e.s && e.s.length) {
      var st = e.s.length === 1 ? fuell(bw('stockOne'), { name: e.s[0][0] })
        : fuell(bw('stockMany'), { n: fmt(e.s.length), names: e.s.slice(0, STOCK_NAMEN).map(function (x) { return x[0]; }).join(', ') });
      karten.push(wegKarte('ab-werk', bw('stock'), '<span class="wzb-weg__n">' + esc(st) + '</span>' + sprung('wzb-serie', bw('stockAll'))));
    }
    if (e.sp && e.sp.length) {
      var sh = '<span class="wzb-weg__n">' + esc(e.sp.length === 1 ? bw('shipPartOne') : fuell(bw('shipPartMany'), { n: fmt(e.sp.length) })) + '</span><ul class="wzb-weg__z">' +
        e.sp.slice(0, SCHIFFE_OFFEN).map(function (n) { return '<li><a href="' + esc(schiffHref(n)) + '">' + esc(n) + '</a></li>'; }).join('');
      if (e.sp.length > SCHIFFE_OFFEN) sh += '<li>' + esc(fuell(bw('shipPartMore'), { n: fmt(e.sp.length - SCHIFFE_OFFEN), names: e.sp.slice(SCHIFFE_OFFEN).join(', ') })) + '</li>';
      karten.push(wegKarte('schiffsteil', bw('shipPart'), sh + '</ul>'));
    }
    var sonder = [];
    it.obtain.forEach(function (o) { if (o.kind === 'exclusive') { var l = obtainText(o); if (sonder.indexOf(l) < 0) sonder.push(l); } });
    if (sonder.length) karten.push(wegKarte('sonderweg', bw('special'), '<span class="wzb-weg__n">' + esc(sonder.join(' · ')) + '</span>'));

    var h2 = '<h3 class="wzb-h">' + esc(bw('title')) + '</h3>';
    if (!karten.length) {
      return h2 + '<p class="wzb-note" data-wege="0">' + esc(bw('none') + ' ' + bw('tip')) + ' <a href="' + esc(meldenHref(it)) + '" rel="nofollow">' + esc(bw('report')) + '</a></p>';
    }
    return h2 + '<ul class="wzb-wl" data-wege="' + karten.length + '">' + karten.join('') + '</ul>';
  }
  // Gleichnamige Items (D7): welches dieses ist und wo die anderen stehen.
  function zwillingHtml(e) {
    if (!e.z || !e.z.length) return '';
    var h = '<p class="wzb-note wzb-zw" data-zwilling="' + esc(e.zs || '') + '">';
    if (e.zs) h += esc(bw('twinThis')) + ' <b>' + esc(e.zs) + '</b>. ';
    h += esc(bw(e.z.length === 1 ? 'twinItem' : 'twinItems')) + ' ';
    h += e.z.map(function (z) {
      var x = ITEMS[z[0]];
      return x ? '<button type="button" class="wzb-link" data-oeffne="' + esc(x.id) + '">' + esc(z[1]) + '</button>' : '';
    }).filter(Boolean).join(', ');
    return h + '</p>';
  }
  function meldenHref(it) {
    // Kennung im Formular: der Pfad des Items, wie das Datenblatt ihn
    // schickte (Muster SEITE_OK in FeedbackForm.astro). Ein Pfad im Wert,
    // kein Link dorthin.
    return (C.feedback || '/feedback.html') + '?wert=' + (C.itemBase || '/items/') + encodeURIComponent(it.id) + '.html';
  }
  // Unter dem Rezept: Fahrzeug, ab Werk, Werkzeuge, Aehnliches, Melden.
  function mehrHtml(it, e) {
    var h = '';
    if (e.v) {
      h += '<p class="wzb-note" data-fahrzeug>' + esc(w('fahrzeugWerte')) + '</p>' +
        '<div class="wzb-akt" style="margin-top:.5rem"><a class="wzb-neben" href="' + esc(schiffHref(it.name)) + '"><span class="wi wi--ship" aria-hidden="true"></span><span>' + esc(w('schiffZeigen')) + '</span>' + pfeil() + '</a></div>';
    }
    if (e.s && e.s.length) {
      var alle = e.s.every(function (x) { return x[1]; }), keins = e.s.every(function (x) { return !x[1]; });
      var lead = e.s.length === 1
        ? tr(e.s[0][1] ? 'stockOneShip' : 'stockOneVehicle', '')
        : fuell(tr(alle ? 'stockShips' : keins ? 'stockVehicles' : 'stockMixed', ''), { n: fmt(e.s.length) });
      var chip = function (x) { return '<li><a class="wz-tag" href="' + esc(schiffHref(x[0])) + '">' + esc(x[0]) + '</a></li>'; };
      h += '<h3 class="wzb-h" id="wzb-serie" tabindex="-1">' + esc(w('hSerie')) + '<em>' + fmt(e.s.length) + '</em></h3>' +
        '<p class="wzb-note" style="margin:0 0 .6rem">' + esc(lead) + '</p>' +
        '<ul class="wzb-chips wzb-serie" data-serie="' + e.s.length + '">' + e.s.slice(0, STOCK_OFFEN).map(chip).join('') + '</ul>';
      if (e.s.length > STOCK_OFFEN) {
        h += '<details class="wzb-mehr"><summary>' + esc(fuell(tr('stockMore', '{n}'), { n: fmt(e.s.length - STOCK_OFFEN) })) + '</summary>' +
          '<ul class="wzb-chips wzb-serie">' + e.s.slice(STOCK_OFFEN).map(chip).join('') + '</ul></details>';
      }
    }
    var wz = [];
    if (e.f) wz.push('<a class="wzb-neben" data-werkzeug="bruch" href="' + esc(C.bruch || '/fracturing.html') + '"><span>' + esc(tr('toolFracturing', '')) + '</span>' + pfeil() + '</a>');
    if (e.wm) wz.push('<a class="wzb-neben" data-werkzeug="wikelo-material" href="' + esc(wikeloHref(it)) + '"><span>' + esc(e.wm === 1 ? tr('toolWikeloMaterialOne', '') : fuell(tr('toolWikeloMaterial', ''), { n: fmt(e.wm) })) + '</span>' + pfeil() + '</a>');
    if (e.w) wz.push('<a class="wzb-neben" data-werkzeug="wikelo-belohnung" href="' + esc(wikeloHref(it)) + '"><span>' + esc(e.w === 1 ? tr('toolWikeloRewardOne', '') : fuell(tr('toolWikeloReward', ''), { n: fmt(e.w) })) + '</span>' + pfeil() + '</a>');
    if (wz.length) h += '<h3 class="wzb-h">' + esc(w('hWerkzeuge')) + '</h3><div class="wzb-akt">' + wz.join('') + '</div>';
    if (e.r && e.r.length) {
      var nb = e.r.map(function (n) { return ITEMS[n]; }).filter(Boolean);
      h += '<h3 class="wzb-h">' + esc(w('hAehnlich')) + '<em>' + fmt(nb.length) + '</em></h3><ul class="wzb-zeilen" data-aehnlich>' + nb.map(function (x) {
        // Wie die Karte auf dem Datenblatt: Preis ab, sonst wohin es gehoert.
        var unter = x._p != null ? tr('thFrom', 'ab') + ' ' + auec(x._p)
          : (x._gr ? x._gr.n : x._root) + (x._b && x.category.indexOf('/') > 0 ? ' · ' + x._b.n : '');
        return '<li data-item="' + esc(x.id) + '"><button type="button" class="wzb-zeile" data-oeffne="' + esc(x.id) + '" style="--kc:' + x._kc + '">' +
          '<span class="wz-z" data-g="' + x._g + '" aria-hidden="true"></span><span>' + esc(x._n) + '<small>' + esc(unter) + '</small></span>' + pfeil() + '</button></li>';
      }).join('') + '</ul>';
    }
    h += '<p class="wzb-melden"><a href="' + esc(meldenHref(it)) + '" rel="nofollow" data-melden>' + esc(w('melden')) + '</a></p>';
    return h;
  }

  // Kaufen nach System: Knoepfe ueber der Liste, wie die Bezugsquellen-Tabelle
  // des Datenblatts; die Wahl teilt sich der Schluessel mit dem Blatt.
  var SYS_SCHLUESSEL = 'vb-system';
  function sysFilterEinsetzen(it, root) {
    var leiste = root.querySelector('[data-sysfilter]');
    var zeilen = it._zeilen;
    if (!leiste || !zeilen) return;
    var hat = karte(), ohne = false;
    Array.prototype.forEach.call(root.querySelectorAll('.wzb-q li[data-z]'), function (li) {
      var o = zeilen[+li.getAttribute('data-z')];
      var ss = o ? zeilenSysteme(o) : [];
      li.setAttribute('data-sys', ss.length ? ss.join(' ').toLowerCase() : 'ohne');
      if (!ss.length) ohne = true;
      ss.forEach(function (s) { hat[s] = 1; });
    });
    var knoepfe = SYSTEME.filter(function (s) { return hat[s]; }).map(function (s) { return [s.toLowerCase(), s]; });
    if (ohne) knoepfe.push(['ohne', bw('buyNoSystem')]);
    if (knoepfe.length < 2) return;
    leiste.setAttribute('aria-label', bw('sysFilter'));
    leiste.innerHTML = '<button type="button" class="wzb-sysb" aria-pressed="true" data-sys="">' + esc(bw('sysAll')) + '</button>' +
      knoepfe.map(function (k) { return '<button type="button" class="wzb-sysb" aria-pressed="false" data-sys="' + k[0] + '">' + esc(k[1]) + '</button>'; }).join('');
    leiste.hidden = false;
    var gemerkt = '';
    try { gemerkt = localStorage.getItem(SYS_SCHLUESSEL) || ''; } catch (e) { /* privat */ }
    if (gemerkt && knoepfe.some(function (k) { return k[0] === gemerkt; })) zeigeSystem(root, gemerkt);
  }
  function zeigeSystem(root, sys) {
    // Mit einem System stehen alle seine Zeilen da: „Alle zeigen“ entfaellt.
    var alle = root.querySelector('[data-alle-quellen]');
    if (alle && sys) alle.remove();
    Array.prototype.forEach.call(root.querySelectorAll('[data-sysfilter] button[data-sys]'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-sys') === sys));
    });
    Array.prototype.forEach.call(root.querySelectorAll('.wzb-q li[data-z]'), function (li) {
      if (!sys) { if (!alle || +li.getAttribute('data-z') < 8) li.hidden = false; return; }
      li.hidden = (li.getAttribute('data-sys') || '').split(' ').indexOf(sys) < 0;
    });
  }

  function wegeEinsetzen(it, oben, unten) {
    if (!WEGE) {
      // Ohne die Datei fehlen nur die Wege; „Falschen Wert melden“ bleibt.
      if (oben) oben.remove();
      if (unten && unten.isConnected) unten.innerHTML = mehrHtml(it, {});
      return;
    }
    var e = WEGE.i[it._i] || {};
    if (oben && oben.isConnected) {
      oben.innerHTML = zwillingHtml(e) + wegeHtml(it, e);
      var root = oben.parentNode;
      if (root) { sysFilterEinsetzen(it, root); setPreisNachtragen(root); }
    }
    if (unten && unten.isConnected) unten.innerHTML = mehrHtml(it, e);
  }

  // „In 3D ansehen“ (nur Vorschau-Bau, src/lib/item3d.ts): der Dialog steht
  // einmal in der Seite (Item3dDialog.astro) und zeigt nacheinander das
  // jeweils gewaehlte Item; der Betrachter (assets/hangar-item3d.js) laedt
  // erst beim ersten Oeffnen. Welche Items ein Modell haben, sagt die Liste
  // (C.i3dListe); sie laedt mit dem ersten geoeffneten Item, und der Knopf
  // erscheint im Blatt, sobald sie da ist. Scheitert der Abruf, versucht es
  // das naechste Item neu.
  var I3D_DLG = C.i3dListe ? document.querySelector('dialog[data-i3d]') : null;
  var I3D = null, i3dLaeuft = null, i3dBetrachter = null;
  function ladeI3d() {
    if (!I3D_DLG) return null;
    if (i3dLaeuft) return i3dLaeuft;
    i3dLaeuft = fetch(C.i3dListe)
      .then(function (r) {
        if (!r.ok) throw new Error('3d list http ' + r.status);
        return r.json();
      })
      .then(function (l) {
        var basis = String((l && l.base) || '');
        if (basis.slice(-1) !== '/') basis += '/';
        var m = karte(), items = (l && l.items) || {};
        Object.keys(items).forEach(function (id) {
          var e = items[id];
          if (Array.isArray(e) && typeof e[0] === 'string' && e[0]) m[id] = { url: basis + e[0], kb: Number(e[1]) || 0 };
        });
        I3D = m;
      })
      .catch(function () { i3dLaeuft = null; });
    return i3dLaeuft;
  }
  // Knopf ins Blatt des Items, wenn es ein Modell hat: hinter dem Hauptknopf
  // (bei Erzen die Mining-Seite), sonst an den Anfang der Handlungen. Nur in genau
  // das Blatt, fuer das er bestellt wurde (der Rueckruf kommt spaeter).
  function i3dEinsetzen(it, akt) {
    if (!I3D || !I3D[it.id] || !akt || !akt.isConnected || akt.querySelector('[data-i3d-zeige]')) return;
    var h = '<button type="button" class="wzb-neben" data-i3d-zeige="' + esc(it.id) + '" aria-haspopup="dialog">' +
      '<span class="wi wi--cube" aria-hidden="true"></span><span>' + esc(I3D_DLG.dataset.open) + '</span><span class="wi wi--arrow" aria-hidden="true"></span></button>';
    var haupt = akt.querySelector('.wzb-haupt');
    if (haupt) haupt.insertAdjacentHTML('afterend', h);
    else akt.insertAdjacentHTML('afterbegin', h);
  }
  function zeigeI3d(id) {
    var m = I3D && I3D[id], it = BYID[id], d = I3D_DLG;
    if (!m || !it || !d) return;
    // Titel, Groesse und Modell wie auf der Item-Seite (Item3dDialog.astro).
    d.dataset.i3dModel = m.url;
    d.setAttribute('aria-label', d.dataset.title.replace('{name}', it._n));
    d.querySelector('[data-i3d-name]').textContent = it._n;
    d.querySelector('[data-i3d-size]').textContent = m.kb
      ? d.dataset.size.replace('{mb}', (m.kb / 1024).toLocaleString(DE ? 'de-DE' : 'en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }))
      : '';
    if (!d.open) d.showModal();
    i3dBetrachter = i3dBetrachter || import(d.dataset.src);
    i3dBetrachter.then(function (mod) { if (d.open) mod.zeige(d); }).catch(function () {
      i3dBetrachter = null;
      var s = d.querySelector('[data-i3d-status]');
      s.textContent = d.dataset.fail;
      s.hidden = false;
    });
  }
  if (I3D_DLG) {
    I3D_DLG.querySelector('[data-i3d-zu]').addEventListener('click', function () { I3D_DLG.close(); });
    I3D_DLG.addEventListener('click', function (e) { if (e.target === I3D_DLG) I3D_DLG.close(); });
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
    var oben = document.getElementById('wzb-wege'), unten = document.getElementById('wzb-mehr');
    // Jeder Abschnitt kommt, sobald seine Datei da ist; „Falschen Wert
    // melden“ steht sofort und wartet auf keine.
    if (unten) unten.innerHTML = mehrHtml(it, {});
    if (CRAFT) craftEinsetzen(it, platz);
    else ladeCraft().then(function () { craftEinsetzen(it, platz); });
    if (WEGE) wegeEinsetzen(it, oben, unten);
    else ladeWege().then(function () { wegeEinsetzen(it, oben, unten); });
    var akt = document.getElementById('wzb-akt');
    if (I3D) i3dEinsetzen(it, akt);
    else if (I3D_DLG) { var l3 = ladeI3d(); if (l3) l3.then(function () { i3dEinsetzen(it, akt); }); }
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
    // Die Preiszeile des Sets kommt mit /items-wege.json.
    if (WEGE) setPreisNachtragen(el.inh);
    else ladeWege().then(function () { setPreisNachtragen(el.inh); });
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
  // zurueckVerfallen: wann der Ersatz-Timer aufgegeben hat (siehe telefonZu).
  var eigenesZurueck = false, zurueckTimer = 0, zurueckVerfallen = 0;
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
        // Der 3D-Dialog liegt neben dem Werkzeug und oeffnet ueber dem Blatt.
        if (x === n || x.inert || /^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(x.tagName) || x === I3D_DLG) return;
        x.inert = true;
        traege.push(x);
      });
    }
  }
  function telefonAuf(ausHistorie) {
    if (!TELEFON.matches || el.blatt.classList.contains('is-offen')) return;
    el.blatt.classList.add('is-offen');
    zurueckVerfallen = 0;
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
    else {
      // Wartet noch ein Schreibvorgang (Enter in der Suche wendet sie an und
      // oeffnet im selben Zug den ersten Treffer), gehoert er dem Eintrag der
      // Liste: dorthin, bevor der Blatteintrag darueber entsteht, mit der
      // Auswahl, die dort stand. Sonst traefe er den Blatteintrag, und
      // Zurueck zeigte die Liste ohne die Suche.
      if (urlTimer && !eigenesZurueck) {
        clearTimeout(urlTimer); urlTimer = 0;
        try { history.replaceState(history.state, '', adresse(true)); } catch (e) {}
      }
      try { history.pushState({ wzBlatt: 1 }, '', adresse()); blattGeschoben = true; } catch (e) {}
    }
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
      // Kommt nach einer Sekunde noch kein popstate, gibt der Ersatz-Timer
      // das Warten auf, damit Schreibvorgaenge nicht dauerhaft ruhen. In den
      // Blatteintrag schreibt er nicht: ein spaetes Zurueck landet noch auf
      // dem Listeneintrag und schreibt dort (popstate, zurueckVerfallen).
      clearTimeout(zurueckTimer);
      if (eigenesZurueck) zurueckTimer = setTimeout(function () {
        if (!eigenesZurueck) return;
        eigenesZurueck = false;
        zurueckVerfallen = Date.now();
        if (!(history.state && history.state.wzBlatt)) schreibeUrl();
      }, 1000);
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
    // Zurueck bei offenem 3D-Dialog (Wischgeste ohne Zurueck-Taste, die ihn
    // selbst schliesst): er geht mit zu, sonst bliebe er ueber der Liste.
    if (I3D_DLG && I3D_DLG.open) I3D_DLG.close();
    var eigenes = eigenesZurueck;
    // Ein eigenes Zurueck, das erst nach dem Ersatz-Timer ankommt (langsame
    // Traversierung), bleibt ein eigenes: es landet binnen zehn Sekunden auf
    // einem Eintrag ohne Blatt.
    if (!eigenes && zurueckVerfallen && Date.now() - zurueckVerfallen < 10000 && !(e.state && e.state.wzBlatt)) eigenes = true;
    zurueckVerfallen = 0;
    eigenesZurueck = false;
    clearTimeout(zurueckTimer);
    // Eigenes Zurueck: jetzt erst steht der Eintrag der Liste an, und dorthin
    // gehoert der Stand, den der Aufrufer gesetzt hat (schreibeUrl wartet
    // bis hierher, siehe dort). Sonst verfaellt ein wartender Schreibvorgang.
    // Ebenso die noch nicht angewendete Eingabe: das Feld zeigt jetzt die
    // Suche des Eintrags, und der Tipp-Timer schriebe sie (getrimmt) zurueck.
    if (eigenes) schreibeUrl();
    else { clearTimeout(urlTimer); urlTimer = 0; clearTimeout(tippTimer); }
    // Noch vor dem Katalog: was er nach dem Laden oeffnet, kommt jetzt aus
    // dem Eintrag, auf dem man steht, nicht mehr aus dem beim Start; die
    // Filter ebenso. Ohne Navigation bleibt es beim Tieflink und bei dem,
    // was man waehrend des Ladens getippt hat.
    if (!bereit) {
      var pw = new URLSearchParams(location.search);
      wunsch = { item: pw.get('item'), satz: pw.get('satz') };
      if (!eigenes) filterAusAdresse();
      return;
    }
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
    if (t.hasAttribute('data-i3d-zeige')) {
      zeigeI3d(t.getAttribute('data-i3d-zeige'));
    } else if (t.hasAttribute('data-oeffne')) {
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
      // Zeigt genau die Teile des Sets: Filter, die nur fuer Items gelten
      // (Art, Groesse, Klasse, Seltenheit), und die Suche, die den Set-Namen
      // traf und nicht jedes Teil, fallen weg.
      S.set = t.getAttribute('data-setfilter');
      setzeTab('items', true);
      S.gruppe = null; S.blatt = null;
      S.art = 'all'; S.gr = null; S.pk = null; S.sel = null;
      clearTimeout(tippTimer); S.q = ''; el.q.value = ''; el.suche.classList.remove('hat-text');
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
    } else if (t.hasAttribute('data-sys') && t.closest('[data-sysfilter]')) {
      var sys = t.getAttribute('data-sys') || '';
      zeigeSystem(el.inh, sys);
      try { if (sys) localStorage.setItem(SYS_SCHLUESSEL, sys); else localStorage.removeItem(SYS_SCHLUESSEL); } catch (e3) { /* privat: nur ohne Merken */ }
    } else if (t.hasAttribute('data-sprung')) {
      // „Alle Verkaufsstellen ↓“ & Co.: im Blatt zum Abschnitt, Fokus dorthin.
      var ziel = document.getElementById(t.getAttribute('data-sprung'));
      if (ziel && el.inh.contains(ziel)) {
        if (ziel.id === 'wzb-quellen') {
          // „Alle“ heisst alle: auch die Zeilen hinter „Alle zeigen“ und die
          // anderer Systeme. Die gemerkte Systemwahl bleibt fuers naechste Item.
          var mehrQ = el.inh.querySelector('[data-alle-quellen]');
          if (mehrQ) mehrQ.remove();
          zeigeSystem(el.inh, '');
        }
        try { ziel.scrollIntoView({ block: 'start', behavior: STILL.matches ? 'auto' : 'smooth' }); } catch (e4) { ziel.scrollIntoView(); }
        try { ziel.focus({ preventScroll: true }); } catch (e5) {}
      }
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
    // Der Chip verschwindet beim Neuzeichnen; hatte er den Fokus, geht der
    // an den Chip, der jetzt an seiner Stelle steht, sonst an den Filterknopf.
    var fokus = c.contains(document.activeElement);
    var pos = Array.prototype.indexOf.call(el.aktiv.querySelectorAll('[data-weg]'), c);
    var k = c.getAttribute('data-weg');
    if (k === 'kat') { S.gruppe = null; S.blatt = null; }
    else if (k === 'set') S.set = null;
    else if (k === 'art') S.art = 'all';
    else if (k === 'gr') S.gr = null;
    else if (k === 'pk') S.pk = null;
    else if (k === 'sel') S.sel = null;
    anwenden();
    if (fokus) {
      var rest = el.aktiv.querySelectorAll('[data-weg]');
      var ziel = rest[Math.min(pos, rest.length - 1)] || (el.fk.offsetParent ? el.fk : el.q);
      try { ziel.focus({ preventScroll: true }); } catch (e2) {}
    }
  });
  function allesZurueck() {
    S.gruppe = null; S.blatt = null; S.set = null; S.art = 'all'; S.gr = null; S.pk = null; S.sel = null;
    S.q = ''; el.q.value = ''; el.suche.classList.remove('hat-text');
    anwenden();
  }
  // Die Gruppen-Kacheln des Ueberblicks (statisch im Blatt) sind
  // button[data-gruppe]; die waehlt der Klick-Handler am Blatt oben.

  // „/“ gehoert hier der eigenen Suche. Die Seitensuche (search-overlay.js)
  // lauscht am document und laesst die Taste, wenn sie schon vergeben ist
  // (defaultPrevented); deshalb in der Einfangphase am window, vor ihr.
  window.addEventListener('keydown', function (e) {
    var t = e.target;
    var tipp = t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (e.key !== '/' || tipp || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    // Offener 3D-Dialog: „/“ tut nichts. Die Taste trotzdem vergeben, sonst
    // oeffnete die Seitensuche unsichtbar hinter dem Dialog und naehme ihm
    // das naechste Esc.
    if (I3D_DLG && I3D_DLG.open) { e.preventDefault(); return; }
    var ueber = document.getElementById('scs');
    if (ueber && !ueber.hidden) return;
    e.preventDefault(); el.q.focus(); el.q.select();
  }, true);
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    // Der offene 3D-Dialog behaelt seine Tasten (Esc schliesst nur ihn).
    if (I3D_DLG && I3D_DLG.open) return;
    if (e.key === 'Escape') {
      var hilfe = wz.querySelector('.wz-hilfe[open]');
      if (hilfe) { hilfe.removeAttribute('open'); return; }
      if (el.sch.classList.contains('is-open')) { schublade(false); return; }
      if (telefonZu(false)) return;
      if (t === el.q && el.q.value) { el.q.value = ''; S.q = ''; el.suche.classList.remove('hat-text'); anwenden(); }
      return;
    }
    // Pfeile blaettern durch die Treffer, wenn der Fokus in der Suche, in der
    // Trefferliste oder nirgends steht. Auf jedem anderen Element (Kopfleiste,
    // Leiste, Blatt) behalten sie ihre eigene Aufgabe, ebenso ohne Treffer
    // und im offenen Blatt am Telefon (dort rollen sie).
    var ort = !t || t === document.body || t === document.documentElement || t === el.q || el.gitter.contains(t);
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && ort && !e.altKey && !e.ctrlKey && !e.metaKey) {
      if (el.sch.classList.contains('is-open') || el.blatt.classList.contains('is-offen')) return;
      if (!TREFFER.length) return;
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
  function adresse(alteAuswahl) {
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
    // alteAuswahl: die Auswahl, die in der Adresse steht, statt der neuen
    // (fuer den Listeneintrag unter einem Blatt, siehe telefonAuf).
    var a = alteAuswahl ? new URLSearchParams(location.search) : null;
    var item = a ? a.get('item') : S.item, satz = a ? a.get('satz') : S.satz;
    if (item) p.set('item', item);
    if (satz) p.set('satz', satz);
    var qs = p.toString();
    return location.pathname + (qs ? '?' + qs : '') + location.hash;
  }
  function schreibeUrl() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(function () {
      urlTimer = 0;
      // Waehrend des eigenen Zurueck steht noch der Blatteintrag an; der
      // popstate stoesst das Schreiben fuer den Listeneintrag neu an.
      if (eigenesZurueck) return;
      // Ebenso, wenn dieses Zurueck spaeter als der Ersatz-Timer ankommt
      // (zurueckVerfallen) und noch der Blatteintrag ansteht: der bleibt, wie
      // er war, damit Vorwaerts ihn so wiederherstellt; was bis dahin
      // geaendert wird, schreibt der popstate in den Listeneintrag.
      if (zurueckVerfallen && Date.now() - zurueckVerfallen < 10000 && history.state && history.state.wzBlatt) return;
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
