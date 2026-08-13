// build-universal-db.mjs — baut assets/universal-items.json für den Universal Item Finder.
//
// Grundsatz: KEINE erfundenen Werte. Jeder Preis und jeder Fundort stammt aus einer
// benannten Quelle; Items ohne bekannte Bezugsquelle werden ehrlich als Katalog-
// Eintrag (obtain: []) ausgewiesen statt mit Fantasie-Shops/-Preisen befüllt.
// (Ersetzt den alten Python-Vorgaenger build_universal_db.py aus dem separaten
// Datamining-Werkzeug, das Preise/Orte per MD5-Hash fabrizierte — Shop-Preise
// sind seit ~3.20 serverseitig und NICHT in Data.p4k.)
//
// Quellen:
//   1) src/data/item-prices.json       — UEX-Kaufpreise + Kauforte (fetch-uex-item-
//      prices.mjs); dieselben Daten, die starcitizen.tools auf Item-Seiten zeigt.
//      Hat für ein Item Vorrang vor dem älteren Shop-Snapshot (2).
//   2) assets/dismantling-items.json   — kuratierter Shop-Snapshot (Name, Kategorie,
//      Kaufpreis, Kaufort, Zerlege-Rezept); Fallback, wenn UEX ein Item nicht führt.
//   3) src/data/loot-items.json        — eigene Loot-Recherche (Fundorte + Guide-Text).
//   4) src/data/vehicles.json + src/data/vehicle-prices.json — Schiffe/Fahrzeuge,
//      Kaufpreise von UEX Corp (uexcorp.space).
//   5) global.ini (aus der lokalen Data.p4k oder --global-ini, Pflicht) — echte
//      Anzeigenamen aller item_Name*-Klassen als Katalog-Einträge ohne Handelsdaten.
//
// Aufruf:
//   node scripts/build-universal-db.mjs [--global-ini <pfad>] [--allow-shrink]
//   Vorgabequelle fuer die global.ini ist die lokale Data.p4k (SC_P4K, wie
//   datamine-items.mjs/datamine-crafting.mjs); --global-ini bleibt als
//   ausdruecklicher Vorrang bestehen. Fehlt die Data.p4k, ist ein angegebener
//   --global-ini-Pfad nicht vorhanden oder AELTER als assets/items-gamefiles.json,
//   oder fehlt items-gamefiles.json selbst: lauter Abbruch (Exit 2), OHNE
//   assets/universal-items.json anzufassen. Ein stilles "Katalog-Teil
//   uebersprungen" gibt es nicht mehr — genau diese Warnung wurde in der
//   Vergangenheit ueberlesen und hat den Katalog um belegte 834 Items
//   verkleinert, 319 davon ohne Bezugsquellen (D-13, D-14). Ein zweiter
//   Riegel bricht zusaetzlich ab, wenn der neue Katalog gegenueber dem
//   vorhandenen um mehr als 5 % schrumpft; --allow-shrink erzwingt den Lauf
//   trotzdem (etwa falls CIG wirklich Items entfernt hat).
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openP4k, DEFAULT_P4K } from './lib/p4k.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'assets', 'universal-items.json');

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// Hausform des lauten Abbruchs (vgl. audit-site.mjs): console.error +
// process.exit(2), ohne vorherigen Schreibvorgang.
function abort(msg) {
  console.error(msg);
  process.exit(2);
}

const argIx = process.argv.indexOf('--global-ini');
const explicitIni = argIx >= 0 ? resolve(process.argv[argIx + 1]) : null;
const ALLOW_SHRINK = process.argv.includes('--allow-shrink');

// items-gamefiles.json ist Pflicht: ohne sie fehlen Kategorie/Size/Grade/
// Hersteller/Stats fuer den gesamten Katalog systematisch. Die Datei ist
// gitignored und entsteht bei 'npm run datamine:items' (braucht die lokale
// Data.p4k). Der fruehere stille Zweig "ÜBERSPRUNGEN (items-gamefiles.json
// nicht gefunden)" entfaellt damit (D-14).
const gameDbPath = resolve(ROOT, 'assets', 'items-gamefiles.json');
if (!existsSync(gameDbPath)) {
  abort(`ABBRUCH: ${gameDbPath} fehlt. Diese Datei entsteht bei 'npm run datamine:items' (braucht die lokale Data.p4k, SC_P4K) und ist gitignored. Ohne sie waere der Katalog systematisch unvollstaendig — kein stilles Weiterlaufen mehr.`);
}

// global.ini: Vorgabequelle ist die lokale Data.p4k; --global-ini bleibt ein
// ausdruecklicher Vorrang. Beide Faelle brechen bei Problemen laut ab statt
// mit einer Warnung weiterzulaufen.
let GLOBAL_INI_TEXT;
let catalogSourceLabel;
if (explicitIni) {
  if (!existsSync(explicitIni)) {
    abort(`ABBRUCH: --global-ini zeigt auf eine nicht vorhandene Datei: ${explicitIni}`);
  }
  const iniAge = statSync(explicitIni).mtimeMs;
  const gameAge = statSync(gameDbPath).mtimeMs;
  if (iniAge < gameAge) {
    abort(
      `ABBRUCH: --global-ini ist aelter als ${gameDbPath} — vermutlich ein veralteter Datenstand.\n` +
      `  global.ini:            ${new Date(iniAge).toISOString()}\n` +
      `  items-gamefiles.json:  ${new Date(gameAge).toISOString()}\n` +
      `Frische Extraktion liefern oder --global-ini weglassen (dann liest das Skript direkt aus der lokalen Data.p4k).`
    );
  }
  GLOBAL_INI_TEXT = readFileSync(explicitIni, 'utf8');
  // Nur die ART der Quelle, NIE ihr Pfad: das Feld wird in
  // assets/universal-items.json (7 MB, oeffentlich) ausgeliefert, und ein
  // absoluter Pfad verraet das Verzeichnislayout des Entwicklungsrechners.
  // Der Pfad steht weiterhin im Lauf-Protokoll auf der Konsole.
  catalogSourceLabel = 'uebergebener global.ini-Auszug (--global-ini)';
} else {
  let p4k;
  try {
    p4k = openP4k(DEFAULT_P4K);
  } catch (err) {
    abort(`ABBRUCH: lokale Data.p4k nicht erreichbar (erwarteter Pfad: ${DEFAULT_P4K}). SC_P4K setzen oder --global-ini <pfad> angeben.\n${err.message}`);
  }
  GLOBAL_INI_TEXT = p4k.read(/Localization[\\/]english[\\/]global\.ini$/i).toString('utf8');
  p4k.close();
  catalogSourceLabel = 'der lokalen Data.p4k';  // ohne Pfad — siehe Kommentar oben
}

// --- Platzhalter-Filter: Wortgrenzen, damit „Testudo“/„Contest“ NICHT rausfliegen;
//     „(PH) …“ / „PH - …“ ist die CIG-Konvention für unfertige Einträge ---
const PLACEHOLDER = /placeholder|<=|=>|\btbd\b|\bunknown\b|\bmissing\b|\btest\b|\bdebug\b|\btemp\b|^\(?ph\)?\s*[-–]?\s/i;
const isPlaceholder = (name) => !name || PLACEHOLDER.test(name) || name.startsWith('@');

// --- Kategorie-Ableitung (nur fürs Einsortieren; konservativ, sonst „Other“) ---
const CAT_RULES = [
  [/\b(helmet|undersuit|armor|armour|backpack|torso|visor|balaclava|mask)\b/i, 'Armour'],
  [/\b(jacket|pants|shirt|t-shirt|shoes|sneakers?|boots?|hat|cap|beanie|glasses|sunglasses|vest|slacks|skirt|dress|sweater|hoodie|jumpsuit|flightsuit|gloves?)\b/i, 'Clothing'],
  [/\b(rifle|pistol|shotgun|smg|lmg|sniper|launcher|railgun|knife|dagger|blade|sword|grenade|crossbow)\b/i, 'Weapons'],
  [/\b(magazine|scope|sight|suppressor|compensator|barrel|underbarrel|foregrip)\b/i, 'Attachment'],
  [/\b(ammo|ammunition)\b/i, 'Ammo'],
  [/\b(cooler|power ?plant|quantum (drive|enforcement)|shield generator|radar|mining (laser|head|module)|tractor beam|salvage|thruster|missile|torpedo|turret|gimbal|fuel (tank|intake|pod)|nozzle|scanner module)\b/i, 'Vehiclegear'],
  [/\b(medpen|med-?gun|multi-?tool|gadget|cutter|beacon|flare|batter(y|ies)|oxypen|cruz|burrito|sandwich|coffee|water|whiskey|vodka|beer|snack|food|drink|bottle|flask)\b/i, 'Utility'],
];
function inferCategory(name) {
  for (const [re, cat] of CAT_RULES) if (re.test(name)) return cat;
  return 'Other';
}

// --- deterministische, lesbare IDs ---
const usedIds = new Set();
function slugId(name) {
  let base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
  let id = base, n = 2;
  while (usedIds.has(id)) id = `${base}-${n++}`;
  usedIds.add(id);
  return id;
}

// =========================================================
//  Quellen einlesen und per Name (case-insensitiv) mergen
// =========================================================
// Warum hier der Name und kein Schluessel (Stand 07.08.2026):
// dieser Merge fuehrt VERSCHIEDENE Quellen auf denselben Eintrag zusammen —
// Spieldaten, UEX-Preise, Loot-Listen, Fahrzeugdaten, global.ini-Katalog. Nur
// die Spieldaten haben eine Record-Id; UEX und die Loot-Quellen kennen
// ausschliesslich Anzeigenamen (serverseitig, nicht in der p4k). Ein
// guid-Join waere hier also gar nicht durchfuehrbar.
//
// ⚠ Wer nach dem Ort sucht, an dem gleichnamige Items zusammenfallen: der ist
// NICHT hier, sondern eine Stufe frueher in `scripts/datamine-items.mjs`
// (Dedupe ueber `byName` -> `best` + `variants`). Dort faellt je Name
// hoechstens ein Eintrag samt Record-Id weg; die Zahl steht seit dem
// 07.08.2026 als `counts.collapsedNames`/`collapsedEntries` in der Ausgabe.
// Diese Datei sieht nur noch das Ergebnis und kann es nicht rueckgaengig
// machen.
const byName = new Map(); // key: name.toLowerCase()
function entry(name) {
  const k = name.toLowerCase().trim();
  if (!byName.has(k)) {
    byName.set(k, {
      name: name.trim(), category: null, catSource: 99,
      obtain: [],      // loot- + vehicle-Zeilen
      shopUex: [],     // Shop-Zeilen aus UEX (Vorrang)
      shopSnap: [],    // Shop-Zeilen aus dem Dismantling-Snapshot (Fallback)
      guide: null,
    });
  }
  return byName.get(k);
}
// catSource: kleiner = vertrauenswürdiger (-1 DataCore/Spieldateien, 0 Shop-Snapshot,
// 1 UEX/Vehicle, 2 Inferenz)
function setCategory(e, cat, rank) {
  if (cat && rank < e.catSource) { e.category = cat; e.catSource = rank; }
}

// 0) DataCore-Items (Spieldateien, scripts/datamine-items.mjs) — Identitäts-Basis:
//    echte Kategorie (spiel-eigene Taxonomie statt Namens-Regex) + Size/Grade/Hersteller/
//    Volumen + typ-spezifische Stats. Höchste Kategorie-Priorität (rank -1). Preise/Orte
//    kommen weiter aus UEX (serverseitig, nicht in der p4k) und werden per Name gejoint.
//    Existenz von gameDbPath ist oben bereits Pflicht-geprueft (lauter Abbruch sonst).
let gameRows = 0, gameStats = 0, gameSets = [];
{
  const gameDb = readJson(gameDbPath);
  gameSets = gameDb.sets || [];
  for (const g of gameDb.items) {
    if (isPlaceholder(g.name)) continue;
    const e = entry(g.name);
    setCategory(e, g.category, -1);
    const gm = {};
    // Tag-Facetten (weight/rarity/part/color/setId/lootable) reisen im selben Block
    // wie die Stats — die UI liest alles unter `item.game`.
    // `sizes`/`variants` stehen nur an Namen, hinter denen mehrere Spiel-Items
    // stecken (z. B. "Revenant Gatling" als S3/S4/S6). Dort ist `size` leer.
    // `guidAliases` sind die Record-Ids gleichnamiger Geschwister, die der
    // Dedupe in datamine-items.mjs zusammengezogen hat — mitgefuehrt NUR, wo
    // sie in Groesse/Grade/Klasse uebereinstimmen. Wer ueber eine dieser Ids
    // sucht, meint dieses Item; ohne sie ginge er leer aus.
    for (const k of ['gameType', 'subType', 'size', 'sizes', 'variants', 'guidAliases', 'grade', 'class', 'manufacturer', 'manufacturerCode', 'volumeScu', 'stats', 'nameDe', 'desc', 'descDe',
      'weight', 'part', 'rarity', 'archetype', 'specialization', 'color', 'lootable', 'lootReason', 'setId']) {
      if (g[k] != null) gm[k] = g[k];
    }
    gm.guid = g.id;
    e.game = gm;
    gameRows++;
    if (g.stats) gameStats++;
  }
}

// 1) UEX-Kaufpreise (wie auf starcitizen.tools angezeigt)
const uexDb = readJson(resolve(ROOT, 'src', 'data', 'item-prices.json'));
let uexRows = 0;
for (const info of Object.values(uexDb.items)) {
  if (isPlaceholder(info.name)) continue;
  const e = entry(info.name);
  setCategory(e, info.category, 1);
  for (const r of info.rows) {
    e.shopUex.push({ kind: 'shop', loc: r.loc, price: r.price });
    uexRows++;
  }
}

// 2) Shop-Snapshot (dismantling-items) — Fallback für Items ohne UEX-Preis
const shopItems = readJson(resolve(ROOT, 'assets', 'dismantling-items.json'));
let snapRows = 0;
for (const it of shopItems) {
  if (isPlaceholder(it.name)) continue;
  const e = entry(it.name);
  setCategory(e, it.category, 0);
  if (it.purchaseLocation && Number(it.purchasePrice_aUEC) > 0) {
    e.shopSnap.push({ kind: 'shop', loc: it.purchaseLocation, price: Number(it.purchasePrice_aUEC) });
    snapRows++;
  }
}

// 3) Loot-Recherche
const lootDb = readJson(resolve(ROOT, 'src', 'data', 'loot-items.json'));
let lootRows = 0;
for (const [name, info] of Object.entries(lootDb)) {
  if (isPlaceholder(name)) continue;
  const e = entry(name);
  setCategory(e, inferCategory(name), 2);
  for (const loc of info.locations || []) { e.obtain.push({ kind: 'loot', loc }); lootRows++; }
  if (info.guide && !e.guide) e.guide = info.guide;
}

// 4) Fahrzeuge (Namen) + UEX-Kaufpreise
const vehicles = readJson(resolve(ROOT, 'src', 'data', 'vehicles.json')).vehicles || [];
const vehPrices = readJson(resolve(ROOT, 'src', 'data', 'vehicle-prices.json')).prices || {};
let vehicleRows = 0;
for (const v of vehicles) {
  if (!v.name || isPlaceholder(v.name)) continue;
  const e = entry(v.name);
  setCategory(e, 'Vehicle', 1);
  for (const p of vehPrices[v.id]?.buy || []) {
    if (Number(p.price) > 0) { e.obtain.push({ kind: 'vehicle', loc: `${p.shop} - ${p.where}`, price: Number(p.price) }); vehicleRows++; }
  }
}

// 5) Katalog aus global.ini: echte Namen, bewusst OHNE Preis/Ort.
//    item_Name* = Ausrüstungs-Klassen; items_commodities_* = Handelswaren
//    (Erze, Ernte-/Jagd-Güter wie Valakkar Fang, Kopion Horn, Carinite —
//    u. a. die Wikelo-Materialien). Desc-Schlüssel (…desc/…_des) sind Prosa
//    und werden übersprungen, zur Sicherheit zusätzlich per Wert-Länge.
//    GLOBAL_INI_TEXT ist oben bereits Pflicht-geladen (lauter Abbruch sonst).
let catalogAdded = 0, catalogSkipped = 0;
{
  const seen = new Set();
  for (const line of GLOBAL_INI_TEXT.split(/\r?\n/)) {
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    let key = line.slice(0, eq).trim();
    const comma = key.indexOf(',');
    if (comma >= 0) key = key.slice(0, comma);
    // ACHTUNG `…_short`: Diese Schluessel tragen die Kurzform fuer enge
    // UI-Stellen —
    //     item_NameMXOX_NeutronRepeater_S1       = NDB-26 Repeater   <- das Item
    //     item_NameMXOX_NeutronRepeater_S1_short = NDB-26            <- das Etikett
    // — und erzeugen hier leere Doppel-Eintraege („NDB-26" neben „NDB-26
    // Repeater", ohne Kategorie, Fundort oder Preis).
    //
    // Sie hier pauschal zu ueberspringen waere FALSCH und wurde geprueft:
    // 363 der 695 Kurzform-Werte sind vollwertige Item-Namen (u. a. „A03
    // Sniper Rifle" mit 11 Bezugsquellen, „Arclight BY Pistol", diverse
    // Turrets). Ein Filter am Schluessel wirft die mit weg.
    //
    // Die Unterscheidung gelingt erst am fertigen Katalog, wo Kategorie und
    // Bezugsquellen bekannt sind — das erledigt scripts/prune-short-name-stubs.mjs
    // im Anschluss (haengt in `npm run sync:items` dahinter).
    const isItemName = /^item_name/i.test(key);
    const isCommodity = /^items_commodities_/i.test(key) && !/desc$|_des$/i.test(key);
    if (!isItemName && !isCommodity) continue;
    const val = line.slice(eq + 1).trim();
    if (isPlaceholder(val)) { catalogSkipped++; continue; }
    if (isCommodity && (val.length > 60 || val.includes('\\n'))) { catalogSkipped++; continue; }
    const k = val.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    if (byName.has(k)) continue; // echte Quelle gewinnt
    const e = entry(val);
    setCategory(e, isCommodity ? 'Commodity' : inferCategory(val), 2);
    catalogAdded++;
  }
}

// =========================================================
//  Dedupe je Item (identische obtain-Zeilen), sortieren, schreiben
// =========================================================
// --- Widerlegte Fundorte entfernen ---------------------------------------
// Die Spieldaten markieren per Tag, ob ein Item ueberhaupt als Loot entstehen
// kann. Ist das ausgeschlossen (`LootGeneration.CannotGenerateAsLoot.*`), sind
// Loot-Zeilen aus der kuratierten Recherche NACHWEISLICH falsch — sie schicken
// Spieler auf Farm-Jagden nach Items, die dort nie fallen (gemessen: 289 Zeilen,
// u. a. „ADP-mk4 Helmet Exec" = Concierge-Belohnung, „Dust Devil … Epoque" = Promo).
// Statt der Falschangabe kommt die echte Bezugsart rein.
const EXCLUSIVE_LABEL = {
  PromotionalItem: 'Promotional item — not obtainable in-game',
  Concierge: 'Concierge reward',
  SubscriberFlair: 'Subscriber flair',
  TwitchDrop: 'Twitch drop',
  ReferralProgram: 'Referral program reward',
  'InGameReward.Wikelo': "Wikelo's Emporium reward",
  'InGameReward.GoblinGathering': 'Goblin Gathering event reward',
  'InGameReward.Luminalia': 'Luminalia event reward',
  'InGameReward.CleanAir': 'Clean Air event reward',
  InGameReward: 'In-game event reward',
};
let purgedLootRows = 0, purgedGuides = 0, exclusiveRows = 0;
for (const e of byName.values()) {
  if (e.game?.lootable !== false) continue;
  const before = e.obtain.length;
  e.obtain = e.obtain.filter((o) => o.kind !== 'loot');
  purgedLootRows += before - e.obtain.length;
  if (e.guide) { e.guide = null; purgedGuides++; }
  const reason = e.game.lootReason || null;
  e.obtain.push({
    kind: 'exclusive',
    loc: (reason && EXCLUSIVE_LABEL[reason]) || 'Not obtainable as loot',
    ...(reason ? { reason } : {}),
  });
  exclusiveRows++;
}

const items = [];
let snapFallbackRows = 0;
for (const e of byName.values()) {
  // Shop-Zeilen: UEX hat Vorrang, der ältere Snapshot greift nur ohne UEX-Treffer
  const shopRows = e.shopUex.length ? e.shopUex : e.shopSnap;
  if (!e.shopUex.length) snapFallbackRows += e.shopSnap.length;
  e.obtain = shopRows.concat(e.obtain);

  const seen = new Set();
  e.obtain = e.obtain.filter((o) => {
    const k = `${o.kind}|${o.loc}|${o.price ?? ''}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  // Kaufbares zuerst (billigster zuerst), dann Loot alphabetisch
  e.obtain.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) || a.loc.localeCompare(b.loc));
  items.push(e);
}
items.sort((a, b) => a.name.localeCompare(b.name, 'en'));
for (const e of items) e.id = slugId(e.name);

const counts = {
  items: items.length,
  withObtain: items.filter((i) => i.obtain.length).length,
  withGameData: items.filter((i) => i.game).length,
  withGameStats: items.filter((i) => i.game && i.game.stats).length,
  gameRows, gameStats,
  uexRows, snapFallbackRows, lootRows, vehicleRows,
  catalogOnly: items.filter((i) => !i.obtain.length).length,
  catalogSkippedPlaceholders: catalogSkipped,
  // Bereinigung: widerlegte Loot-Angaben (siehe EXCLUSIVE_LABEL oben)
  purgedLootRows, purgedGuides, exclusiveRows,
  armorSets: gameSets.length,
  inSet: items.filter((i) => i.game?.setId).length,
  withWeight: items.filter((i) => i.game?.weight).length,
  withRarity: items.filter((i) => i.game?.rarity).length,
};

const db = {
  generator: 'scripts/build-universal-db.mjs',
  generatedAt: new Date().toISOString().slice(0, 10),
  pricesAsOf: uexDb.fetchedAt,
  note: 'Keine fabrizierten Werte: Items ohne bekannte Quelle haben obtain:[] (Katalog). Preise/Orte Patch-volatil — ingame prüfen.',
  sources: {
    gamefiles: 'Eigene Aufbereitung (Kategorie, Size/Grade/Hersteller, Stats)',
    prices: `src/data/item-prices.json — UEX Corp, Stand ${uexDb.fetchedAt}; identisch mit den Kaufpreis-Tabellen auf starcitizen.tools`,
    shopsFallback: 'assets/dismantling-items.json — kuratierter Shop-Snapshot, greift nur ohne UEX-Treffer',
    loot: 'src/data/loot-items.json — eigene Loot-Recherche (Fundorte + Guides)',
    vehicles: 'src/data/vehicles.json + vehicle-prices.json — UEX Corp (uexcorp.space)',
    catalog: 'Katalog der Item-Namen aus den Spieldaten',
  },
  counts,
  // Ruestungs-Sets (Dreier-Kette aus scripts/lib/armor-sets.mjs) — Grundlage der
  // Set-Seite; der Finder verlinkt je Item ueber `game.setId` hierher.
  sets: gameSets,
  items: items.map((e) => {
    const o = { id: e.id, name: e.name, category: e.category || 'Other', obtain: e.obtain };
    if (e.guide) o.guide = e.guide;
    if (e.game) o.game = e.game; // Spieldaten: size/grade/manufacturer/volumeScu/subType/stats/… (nur belegte Felder)
    return o;
  }),
};

// Schrumpf-Riegel, unmittelbar vor dem Schreiben: eine veraltete global.ini
// von ausserhalb des Repos hat den Katalog frueher unbemerkt um 834 Items
// verkleinert, 319 davon verloren ihre Bezugsquellen (D-13). Mehr als 5 %
// Verlust gegenueber dem committeten Bestand bricht ab; --allow-shrink ist
// der einzige Weg daran vorbei (z. B. wenn CIG tatsaechlich Items entfernt hat).
if (existsSync(OUT) && !ALLOW_SHRINK) {
  const prevCount = readJson(OUT).items?.length ?? 0;
  const newCount = items.length;
  if (prevCount > 0 && (prevCount - newCount) / prevCount > 0.05) {
    const dropPct = (((prevCount - newCount) / prevCount) * 100).toFixed(1);
    abort(`ABBRUCH: neuer Katalog waere ${prevCount} -> ${newCount} Items geschrumpft (-${prevCount - newCount}, ${dropPct} %, mehr als 5 %). Vermutlich eine veraltete/unvollstaendige Quelle. Mit --allow-shrink erzwingen, falls CIG wirklich Items entfernt hat.`);
  }
}

// kompakt (kein Pretty-Print): ~20 % kleiner auf der Leitung; Diffs sind bei
// generierten Snapshots ohnehin nicht zeilenweise lesbar.
writeFileSync(OUT, JSON.stringify(db));
console.log(`OK: ${OUT}`);
console.log(counts);
