// datamine-ship-components.mjs — Steckplatz-GROESSE je Bauteilart aus dem
// Data.p4k, node-nativ ueber scripts/lib/p4k.mjs + scripts/lib/datacore.mjs +
// scripts/lib/cryxml.mjs. Ausgabe: src/data/ship-components.json
// { ships: { <id>: {w,t,m,s,c,p,q,r} }, missing: [...] }.
//
// WARUM NICHT src/data/ship-loadouts.json (Stock-Loadout)? D-01: gefragt ist,
// was ein Steckplatz AUFNEHMEN KANN (ItemPort.maxSize aus der Implementierungs-
// XML), nicht was ab Werk drinsteckt. "Kann ich da eine S5 dranbauen" ist eine
// andere Frage als "was ist eingebaut" — ship-loadouts.json beantwortet nur
// Letzteres und ist damit fuer diesen Filter die falsche Quelle (D-01, D-02).
//
// D-03: der Join Schiff -> XML laeuft ueber den Dateiverweis, den der
// DataCore-Schiffsrecord selbst fuehrt (erster String im Record, der auf
// .../Implementations/Xml/*.xml passt) — NICHT ueber zusammengesetzte
// Dateinamen. "RSI_Constellation_Andromeda.xml" existiert z.B. gar nicht unter
// diesem Namen; Namensraten scheitert nachweislich (siehe RESEARCH.md).
//
// WICHTIG: der p4k-Griff bleibt hier bewusst OFFEN, bis ALLE Implementierungs-
// XMLs entpackt sind (anders als datamine-ship-loadouts.mjs, das ihn direkt
// nach dem dcb schliesst) — wir brauchen p4k.extract() fuer jedes Schiff
// einzeln erst NACH der DataCore-Auswertung, weil sich der XML-Dateiverweis
// je Schiff erst aus dem gelesenen Record ergibt.
//
// Aufruf: node scripts/datamine-ship-components.mjs [--p4k <Data.p4k>] [--audit] [--ship <id>]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { openP4k, DEFAULT_P4K } from './lib/p4k.mjs';
import { openDataCore } from './lib/datacore.mjs';
import { parseCryXml } from './lib/cryxml.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'src', 'data', 'ship-components.json');
const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const AUDIT = argv.includes('--audit');
const ONLY = argOf('--ship');

// PITFALL 1 (RESEARCH.md): p4k-Eintragsnamen tragen Backslash UND ein
// "Data\"-Praefix ("Data\Scripts\Entities\..."), waehrend record.fileName aus
// dem DataCore bereits Forward-Slash OHNE "Data/"-Praefix liefert. Ein naiver
// Vergleich zwischen beiden Seiten liefert 0 Treffer, OHNE einen Fehler zu
// werfen — sieht aus wie "keine Daten im Spiel", ist aber ein Normalisierungs-
// fehler. Beide Seiten MUESSEN vor dem Vergleich normalisiert werden: Backslash
// zu Schraegstrich, "Data/"-Praefix weg, kleinschreiben. Gemessene Folge dieser
// Korrektur: Abdeckung sprang von 0 von 227 auf 223 von 227.
const norm = (s) => (s || '').replace(/\\/g, '/');
const stripDataPrefix = (s) => norm(s).replace(/^data\//i, '');

const p4k = openP4k(argOf('--p4k') ?? DEFAULT_P4K);
const dcb = p4k.read(/^Data[\\/]Game2\.dcb$/i);
const db = openDataCore(dcb);

// Implementierungs-XML-Index EINMAL aufbauen (Backslash-Muster, siehe Pitfall 1
// -- ein Forward-Slash-Muster gegen p4k.entries() liefert 0 Treffer).
const implEntries = p4k.entries(/Implementations\\Xml\\.+\.xml$/i);
const implByLowerName = new Map();
for (const e of implEntries) implByLowerName.set(stripDataPrefix(e.name).toLowerCase(), e);

// Ersten String im gelesenen Record finden, der auf einen Pfad unterhalb von
// Implementations/Xml mit Endung .xml passt (D-03: Dateiverweis, kein
// zusammengesetzter Name).
const XML_REF_RX = /Implementations\/Xml\/[^/]+\.xml$/i;
function findXmlRef(o) {
  let found;
  (function walk(x) {
    if (found !== undefined || !x) return;
    if (typeof x === 'string') { if (XML_REF_RX.test(x)) found = x; return; }
    if (typeof x !== 'object') return;
    for (const [k, v] of Object.entries(x)) {
      if (found !== undefined) return;
      if (k === '__type' || k === '__ref' || k === '__weak' || k === '__cycle') continue;
      if (v && (typeof v === 'object' || typeof v === 'string')) walk(v);
    }
  })(o);
  return found;
}

// Ports mit Groesse + Types aus dem geparsten CryXmlB-Knotenfeld einsammeln.
// PATTERN 1 (RESEARCH.md): der Portname sitzt auf dem ELTERN-Knoten <Part>,
// NICHT auf <ItemPort> selbst -- <ItemPort> traegt nur Groesse/Types/Flags.
function extractPorts(nodes) {
  const ports = [];
  for (const part of nodes) {
    if (part.tag !== 'Part') continue;
    const ip = part.children.find((c) => c.tag === 'ItemPort');
    if (!ip || ip.attrs.maxsize == null || ip.attrs.maxsize === '') continue;
    const typesNode = ip.children.find((c) => c.tag === 'Types');
    const types = typesNode
      ? typesNode.children.filter((c) => c.tag === 'Type').map((c) => c.attrs.type).filter(Boolean)
      : [];
    ports.push({ name: part.attrs.name || '', max: Number(ip.attrs.maxsize), types });
  }
  return ports;
}

// TURM-REGEL (D-06a -- NACHTRAEGLICH VOM NUTZER VERSCHAERFT, ersetzt die
// urspruengliche D-06-Regel aus RESEARCH.md/dem ersten Checkpoint dieses
// Plans). Der rohe Type-Wert `Turret` bedeutet NICHT "Turmposition" -- er
// markiert nur, dass ein Waffenport gimbal-/turmartig ausgerichtet werden
// KANN, und das trifft genauso auf feste Fluegelkanonen zu
// (hardpoint_gun_left_wing beim Gladius traegt dieselbe Turret-Markierung
// wie ein bemannter Hammerhead-Turm). Ein echter Turm braucht STATTDESSEN
// TurretBase -- den Mount-Sockel selbst, ein direkt aus den Spieldaten
// gelesener Type-Wert wie `Shield` oder `Cooler`.
//
// ENTFERNT: der urspruengliche zweite Regelteil ("Turret ohne WeaponGun UND
// Portname passt auf /remote/i UND NICHT auf /tractor/i") ist ERSATZLOS
// GESTRICHEN. Er war eine GERATENE Namenserkennung, keine direkte Ablesung
// aus den Spieldaten -- der Nutzer hat entschieden, dass geratene
// Zuordnungen nicht im Auslieferungsstand stehen sollen, auch wenn sie in
// der Stichprobe zutrafen. AUSDRUECKLICH IN KAUF GENOMMENER PREIS: Carrack,
// Redeemer und Polaris verlieren dadurch ihre ferngesteuerten Tuerme in
// dieser Kategorie, weil diese Ports im Spiel NUR `Turret` tragen, NIE
// `TurretBase`. Das ist gewollt -- KEIN Ersatz, KEINE zweite Namensregel,
// KEIN Sonderfall fuer diese drei Schiffe.
//
// Alle Vergleiche von Types-Werten laufen ohne Ruecksicht auf
// Gross-/Kleinschreibung, weil die Rohdaten darin uneinheitlich sind (siehe
// RESEARCH.md Types-Vokabular: z.B. Misc/MISC, Usable/Useable).
function isTurret(port) {
  const typesLower = port.types.map((t) => String(t).toLowerCase());
  const has = (t) => typesLower.indexOf(t.toLowerCase()) >= 0;

  // CONTAINER-AUSSCHLUSS (bleibt unveraendert): Bodenfahrzeug-
  // Modulanbaupunkte (z.B. tmbl-cyclone "hardpoint_module_attach") tragen
  // TurretBase ZUSAMMEN MIT Container -- generische Anbauslots, keine
  // Waffentuerme. Ohne diesen Ausschluss haetten alle vier Cyclone-Varianten
  // faelschlich einen Turm bekommen; vehicles.json (die unabhaengige
  // Drittquelle des Nachweismodus --audit) fuehrt fuer sie 0 Tuerme.
  return has('TurretBase') && !has('Container');
}
// BEKANNTER BLINDER FLECK -- Kapitalschiff-PDC-Batterien: die
// Punktverteidigungs-Stationen (PDC) von Polaris, Idris, Javelin und
// Reclaimer haben in der Implementierungs-XML UEBERHAUPT KEINEN eigenen
// ItemPort -- keine Regel kann sie erfinden, deshalb wird hier bewusst KEIN
// Ersatzweg gebaut (D-08-Philosophie: lieber ehrlich zu wenig zaehlen als
// raten). Diese Luecke gilt UNVERAENDERT weiter, unabhaengig von D-06a oben.
// Seit D-06a kommt bei denselben Schiffen ein ZWEITER, bewusst in Kauf
// genommener Abschlag hinzu: FERNGESTEUERTE Tuerme (Carrack, Redeemer,
// Polaris) tragen im Spiel nur `Turret`, nie `TurretBase`, und zaehlen nach
// dem Wegfall der Namensregel gar nicht mehr als Turm. Die betroffenen
// Schiffe behalten nur noch ihre BEMANNTEN (TurretBase-getaggten) Tuerme;
// bei Schiffen, deren Tuerme ausschliesslich ferngesteuert sind, faellt die
// Kategorie Turm komplett weg (siehe RESEARCH.md: Polaris Drittquelle=14
// Stationen, Regel zaehlt nur noch die bemannten davon).

// Types-Liste eines Ports -> Kategorie-Buchstabe (CAT_ORDER: wtmscpqr).
// Die Auswertungsreihenfolge ist bindend: ein Port faellt in GENAU eine
// Kategorie. Turm (t) laeuft als ERSTE Stufe, VOR Rakete und Waffe (D-06a) --
// eine feste Waffe mit zusaetzlichem Turret-Tag faellt NICHT hierher, weil
// isTurret() ausschliesslich TurretBase (ohne Container) verlangt; sie
// faellt stattdessen regulaer weiter unten bei "w" durch.
//
// m VOR w: MissileLauncher (21 Ports) und BombLauncher (8 Ports) kommen bei
// manchen Schiffen ZUSAETZLICH mit WeaponGun getaggt vor (Kombi-Halterungen,
// siehe RESEARCH.md "Multi-Type-Kombinationen") -- das sind Raketenhalterungen,
// keine Waffen. Wuerde w zuerst greifen, landeten 29 solcher Ports faelschlich
// bei den Waffen statt bei den Raketen.
//
// BombLauncher zaehlt bewusst zu Rakete (m), nicht als eigene Kategorie --
// Praezedenzfall itemCat() in datamine-ship-loadouts.mjs fasst Bomben/Torpedos
// bereits mit Raketen zusammen (D-05 sieht keine neunte Kategorie vor).
//
// AUSDRUECKLICH NICHT zugeordnet (verworfen, siehe RESEARCH.md
// Types-Vokabular): die Controller-Types (ShieldController, CoolerController,
// MissileController, EnergyController, WeaponController, ...) sind
// Logik-Knoten, nicht der Bauteil-Slot selbst; die Tank-Types (FuelTank,
// QuantumFuelTank) sind Treibstoff, nicht der Antrieb/das Kraftwerk selbst;
// Battery, Ping, Scanner, Avionics, Armor, UtilityTurret sind eigene,
// hier nicht angefragte Slot-Arten. WeaponDefensive (Gegenmassnahmen,
// Chaff/Flare) fehlt bewusst -- D-05 schliesst Gegenmassnahmen ausdruecklich
// als Kategorie aus. Der Einzelfall "Powerplant - Power" bei drak-mule
// (1 Port, hardpoint_batteries) zaehlt bewusst NICHT als Kraftwerk -- er sieht
// wie ein Batterie-Datenartefakt aus, kein echtes Kraftwerk (RESEARCH.md
// Assumption A1); waere er als Alias behandelt worden, saehe es aus, als sei
// der Fall "vergessen" worden.
function catOf(port) {
  const has = (t) => port.types.indexOf(t) >= 0;
  if (isTurret(port)) return 't';
  if (has('MissileLauncher') || has('BombLauncher')) return 'm';
  if (has('WeaponGun')) return 'w';
  if (has('Shield')) return 's';
  if (has('Cooler')) return 'c';
  if (has('PowerPlant')) return 'p';
  if (has('QuantumDrive')) return 'q';
  if (has('Radar')) return 'r';
  return null;
}

// ---- Schiff-Records + ID-Join (woertlich aus datamine-ship-loadouts.mjs uebernommen) ----
const isVariantJunk = (f) => /_ai_|_pu_|_test|_template|_dummy|_unmanned|_hijacked|_turretless|_debug|_showdown_scramble|_swarm|_simpod|_modifiers/i.test(f);
const shipRecs = db.records.filter((r) =>
  db.structs[r.structIndex]?.name === 'EntityClassDefinition' &&
  /\/(spaceships|groundvehicles)\/[^/]+\.xml$/i.test(norm(r.fileName)) && !isVariantJunk(norm(r.fileName)));

const recId = (r) => (r.name || '').replace(/^EntityClassDefinition\./, '').toLowerCase().replace(/_/g, '-');
const byId = new Map();
for (const r of shipRecs) { const id = recId(r); if (!byId.has(id)) byId.set(id, r); }

// Katalog-Idliste: 227 Schiffe aus src/data/ship-hardpoints.json (recId(DataCore)
// == Katalog-id == id der vehicles-Collection, Deckungsgleichheit siehe PLAN).
const hp = JSON.parse(readFileSync(resolve(__dirname, '..', 'src', 'data', 'ship-hardpoints.json'), 'utf8')).ships;
const ourIds = Object.keys(hp);

// ---- Lauf ----
// Die vier ATLS-Exoskelett-Varianten (Mining-Powerarmor) sind DataCore-seitig
// eine Actor-Klasse unter libs/foundry/records/actor/actors/*.xml, nicht unter
// .../spaceships/ oder .../groundvehicles/ -- der Ship-Record-Filter erkennt
// sie deshalb bauartbedingt nicht. Bewusst KEINE Sonderbehandlung (RESEARCH.md
// Q1): sie landen unter `missing`, D-08 deckt genau diesen Fall ab.
const idsToDo = ONLY ? [ONLY] : ourIds;
const ships = {};
const missing = [];
const resolved = [];
// Zaehlung der Turm-PORTS (nicht nur die gespeicherte Max-Groesse) je Schiff
// -- nur fuer den Nachweismodus --audit gebraucht: das JSON speichert je
// Kategorie nur das Maximum und kann die ANZAHL nicht mehr hergeben, aber der
// Nachweis gegen vehicles.json (turrets[].stations) braucht die Anzahl.
const turretCounts = {};
for (const id of idsToDo) {
  const rec = byId.get(id);
  if (!rec) { missing.push(id); continue; }
  const o = db.readRecord(rec, { maxDepth: 40, typed: true });
  const xmlRef = findXmlRef(o);
  if (!xmlRef) { missing.push(id); continue; }
  const entry = implByLowerName.get(stripDataPrefix(xmlRef).toLowerCase());
  if (!entry) { missing.push(id); continue; }
  const buf = p4k.extract(entry);
  const nodes = parseCryXml(buf);
  const ports = extractPorts(nodes);
  // je Kategorie das Maximum ueber alle Ports -- D-04 ("einer reicht") braucht
  // nur diesen Wert, nicht die volle Portliste (siehe RESEARCH.md Q5).
  const agg = {};
  let turretPorts = 0;
  for (const port of ports) {
    const cat = catOf(port);
    if (!cat) continue;
    if (cat === 't') turretPorts++;
    if (agg[cat] == null || port.max > agg[cat]) agg[cat] = port.max;
  }
  ships[id] = agg; // Eintrag fuer JEDES aufgeloeste Schiff, auch leer (D-08:
                    // Anwesenheit in `ships` == "hat Steckplatz-Daten")
  turretCounts[id] = turretPorts;
  resolved.push(id);
}
p4k.close();

// ---- Zusammenfassung (Hausregel: kompakt, Zahlen zuerst, Haekchen am Ende) ----
console.log(`\n=== KOMPONENTEN-DATAMINE ===`);
console.log(`aufgeloest: ${resolved.length} / ${idsToDo.length}`);
console.log(`fehlend:    ${missing.length}${missing.length ? '  ' + missing.join(', ') : ''}`);
console.log(`\nSchiffe je Kategorie:`);
const catsSeen = new Set();
for (const id of resolved) for (const k of Object.keys(ships[id])) catsSeen.add(k);
for (const cat of [...catsSeen].sort()) {
  const n = resolved.filter((id) => ships[id][cat] != null).length;
  console.log(`  ${cat}: ${n}`);
}

// ---- TURM-NACHWEIS (D-06, nur --audit): die von der Regel gezaehlten
// Tuerme je Schiff gegen die unabhaengige Drittquelle vehicles.json stellen
// (turrets[].stations, ein Wiki-API-Schnappschuss, siehe scripts/sync-
// vehicles.mjs) -- DIENT NUR DEM VERGLEICH, fliesst nicht in
// ship-components.json ein (T-05-04). Reihenfolge und Auswahl der 15
// Stichprobenschiffe folgt exakt RESEARCH.md "Validierung gegen
// vehicles.json".
if (AUDIT) {
  const vehData = JSON.parse(readFileSync(resolve(__dirname, '..', 'src', 'data', 'vehicles.json'), 'utf8'));
  const vehTurrets = new Map();
  for (const v of vehData.vehicles) {
    vehTurrets.set(v.id, (v.turrets || []).reduce((sum, t) => sum + (t.stations || 0), 0));
  }
  const sampleIds = [
    'orig-100i', 'aegs-gladius', 'aegs-hammerhead', 'rsi-constellation-andromeda',
    'drak-corsair', 'misc-freelancer', 'anvl-carrack', 'rsi-polaris', 'aegs-redeemer',
    'drak-caterpillar', 'cnou-mustang-alpha', 'aegs-avenger-titan', 'misc-prospector',
    'argo-mole', 'banu-defender',
  ];
  console.log(`\n=== TURM-NACHWEIS (D-06) — Regel vs. vehicles.json turrets[].stations ===`);
  for (const id of sampleIds) {
    const thirdParty = vehTurrets.get(id) ?? 0;
    const rule = turretCounts[id] ?? 0;
    const mark = thirdParty === rule ? '✅' : '❌';
    console.log(`  ${id}: Drittquelle=${thirdParty} Regel=${rule} ${mark}`);
  }
  let exact = 0, binary = 0, withTurret = 0;
  for (const id of resolved) {
    const thirdParty = vehTurrets.get(id) ?? 0;
    const rule = turretCounts[id] ?? 0;
    if (thirdParty === rule) exact++;
    if ((thirdParty > 0) === (rule > 0)) binary++;
    if (rule > 0) withTurret++;
  }
  console.log(`\n  exakte Turmzahl:      ${exact}/${resolved.length}`);
  console.log(`  binaer (hat Turm?):   ${binary}/${resolved.length}`);
  console.log(`  Schiffe mit >=1 Turm: ${withTurret}`);
}

if (!AUDIT && !ONLY) {
  writeFileSync(OUT, JSON.stringify({
    generatedAt: new Date().toISOString().slice(0, 10),
    source: 'Data.p4k Scripts/Entities/Vehicles/Implementations/Xml (CryXmlB ItemPort.maxSize)',
    count: resolved.length,
    ships,
    missing,
  }, null, 0));
  console.log(`\n-> ${OUT} geschrieben (${resolved.length} Schiffe)`);
  console.log(`\nKOMPONENTEN-DATAMINE ✓`);
} else {
  console.log(`\n(Audit-Modus: keine Datei geschrieben)`);
}
