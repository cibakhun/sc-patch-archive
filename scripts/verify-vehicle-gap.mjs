// verify-vehicle-gap.mjs — meldet flugfähige Fahrzeuge im DataCore, die nicht
// im Katalog stehen.
//
// WARUM: Der Fahrzeug-Katalog ist zirkulär geschlossen. extract-hardpoints.mjs
// iteriert src/data/vehicles.json, datamine-vehicles/-ship-loadouts/
// -ship-components iterieren src/data/ship-hardpoints.json. Ein neues Schiff
// kommt so nie von selbst hinein — die Sabre Raven EX (4.10.1) und die S-65
// Stingray (4.10.0) standen flugfähig im DataCore und fehlten still bis zum
// 07.10.2026. Aufnahme: node scripts/extract-hardpoints.mjs --add <id>, danach
// die übliche Kette (datamine:loadouts, datamine:vehicles, datamine:components,
// datamine:vehicle-roles, StarBreaker-Export + build-holo-meshes --only <id>).
//
// URTEIL (docs/maschinelle-validierung.md § 4, Grundsatz 3):
//   WARNUNG  ein flugfähiger Record ohne Katalog-Eintrag und ohne benannte
//            Ausnahme — ob er hineingehört, entscheidet ein Mensch.
//   FEHLER   nur, wo die Handlungsanweisung immer richtig ist: der Leser liefert
//            unter der Klinke (Archiv/Parser kaputt), der Filter des Erzeugers
//            ist nicht auffindbar, oder eine Ausnahme hat ihren Anlass verloren
//            (Zombie — Ausnahme löschen).
//
// Der Variantenfilter wird aus scripts/datamine-vehicles.mjs GELESEN, nicht
// kopiert: geprüft wird gegen den echten Erzeuger.
//
// Aufruf: node scripts/verify-vehicle-gap.mjs [--p4k <Data.p4k>] [--katalog <vehicles.json>]
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openP4k, DEFAULT_P4K } from './lib/p4k.mjs';
import { openDataCore } from './lib/datacore.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const P4K = argOf('--p4k') ?? DEFAULT_P4K;
const KATALOG = resolve(ROOT, argOf('--katalog') ?? 'src/data/vehicles.json');

// Untergrenze der Fahrzeug-Records nach Filter. Messlauf 07.10.2026 gegen
// CL 12660092: 363. Darunter ist der Leser kaputt, nicht der Bestand.
const MIN_RECORDS = 340;

/* ---------- benannte Ausnahmen ---------- */
// Regeln greifen auf den englischen Anzeigenamen des Records. Jede Regel muss
// in jedem Lauf mindestens einmal greifen (Zombie-Wächter).
const RULES = [
  { id: 'gleicher-name', why: 'trägt denselben Anzeigenamen wie ein Katalogeintrag — Lackierung, Missions-, Event- oder Loadout-Kopie (bis2950, fleetweek, tier-1 …)', test: (n, ctx) => ctx.catalogNames.has(n) },
  { id: 'wikelo', why: 'Wikelo-Sammlerbelohnung — eigene Themenseite, kein eigener Katalogeintrag', test: (n) => /\bWikelo\b/i.test(n) },
  { id: 'pyam-exec', why: 'PYAM-Exec-Ausführung einer Katalog-Basis', test: (n) => /\bPYAM Exec\b/i.test(n) },
  { id: 'teach', why: "Teach's-Special-Ausführung einer Katalog-Basis", test: (n) => /Teach's Special/i.test(n) },
  { id: 'alliance', why: 'Alliance-Ausführung (BTALA) einer Katalog-Basis', test: (n) => /\bAlliance$/i.test(n) },
  { id: 'best-in-show', why: 'Best-in-Show-Lackierung', test: (n) => /Best In Show Edition/i.test(n) },
  { id: 'missionsobjekt', why: 'Wrack oder Missionsobjekt, kein Spielerfahrzeug', test: (n, ctx) => n === 'Wreckage' || /^(eaobjectivedestructable|probe-comms|orbital-sentry)-/.test(ctx.id) },
];
// Einzelne Ids mit Anlass. `offen: true` = Einordnung nicht belegt, nur
// zurückgestellt — wird bei jedem Lauf als Schuldenposten gedruckt.
const NAMED = {
  'aegs-gladius-dunlevy': { why: 'benannte Sonderedition der Gladius (Gladius Dunlevy)' },
  'anvl-valkyrie-citizencon': { why: 'Sonderedition der Valkyrie (Valkyrie Liberator)' },
  'drak-dragonfly-pink': { why: 'Sonderedition der Dragonfly (Star Kitten)' },
  'orig-600i-executive-edition': { why: 'Sonderedition der 600i (Executive Edition)' },
  'drak-command-module': { why: 'Drake Command Module — kein Katalog-Pendant, Einordnung nicht belegt', offen: true },
  'drak-command-module-boarded': { why: 'Entern-Variante des Drake Command Module', offen: true },
  'vncl-mauler': { why: 'Vanduul Mauler Destroyer — als Spielerschiff nicht belegt', offen: true },
  'vncl-mauler-ai': { why: 'KI-Variante des Vanduul Mauler', offen: true },
};

/* ---------- Filter des Erzeugers lesen ---------- */
const errors = [];
const warnings = [];
const producer = readFileSync(resolve(ROOT, 'scripts/datamine-vehicles.mjs'), 'utf8');
const m = producer.match(/const isVariantJunk = \(f\) => \/(.+)\/i\.test\(f\);/);
if (!m) {
  console.error('FEHLER: isVariantJunk in scripts/datamine-vehicles.mjs nicht gefunden — der Wächter prüft sonst gegen einen erfundenen Filter.');
  process.exit(1);
}
const JUNK = new RegExp(m[1], 'i');

if (!existsSync(P4K)) {
  console.error(`FEHLER: Data.p4k nicht gefunden: ${P4K} (Schiene B — nur auf dem Betreiber-Rechner).`);
  process.exit(1);
}

/* ---------- DataCore lesen ---------- */
const norm = (s) => (s || '').replace(/\\/g, '/');
const p4k = openP4k(P4K);
const db = openDataCore(p4k.read(/^Data[\\/]Game2\.dcb$/i));
const ini = p4k.read(/Localization[\\/]english[\\/]global\.ini$/i).toString('utf8');
p4k.close();
const EN = new Map();
for (const line of ini.split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0) EN.set(line.slice(0, i).replace(/^﻿/, '').toLowerCase().replace(/,p$/, ''), line.slice(i + 1).trim());
}
const loc = (k) => (typeof k === 'string' && k.startsWith('@') ? EN.get(k.slice(1).toLowerCase()) ?? null : null);
const findType = (o, name, d = 0) => {
  if (!o || typeof o !== 'object' || d > 10) return null;
  if (Array.isArray(o)) { for (const x of o) { const r = findType(x, name, d); if (r) return r; } return null; }
  if (o.__type === name) return o;
  for (const [k, v] of Object.entries(o)) { if (k === '__type') continue; if (v && typeof v === 'object') { const r = findType(v, name, d + 1); if (r) return r; } }
  return null;
};
const recId = (r) => (r.name || '').replace(/^EntityClassDefinition\./, '').toLowerCase().replace(/_/g, '-');

const recs = db.records.filter((r) =>
  db.structs[r.structIndex]?.name === 'EntityClassDefinition'
  && /\/(spaceships|groundvehicles)\/[^/]+\.xml$/i.test(norm(r.fileName))
  && !JUNK.test(norm(r.fileName)));
const byId = new Map();
for (const r of recs) {
  const id = recId(r);
  if (byId.has(id)) continue;
  const o = db.readRecord(r, { maxDepth: 6, typed: true });
  const veh = findType(o, 'VehicleComponentParams');
  const att = findType(o, 'SAttachableComponentParams')?.AttachDef ?? {};
  byId.set(id, {
    id,
    name: (loc(veh?.vehicleName) ?? loc(att.Localization?.Name) ?? id).replace(/\\n/g, '').trim(),
    // flugfähig = der Record nennt eine Fahrzeug-Implementierung
    flyable: !!veh?.vehicleDefinition,
  });
}

const catalog = new Set(JSON.parse(readFileSync(KATALOG, 'utf8')).vehicles.map((v) => v.id));
const flyable = [...byId.values()].filter((r) => r.flyable);
const catalogNames = new Set(flyable.filter((r) => catalog.has(r.id)).map((r) => r.name));
const gap = flyable.filter((r) => !catalog.has(r.id));

/* ---------- urteilen ---------- */
const ruleHits = new Map(RULES.map((r) => [r.id, 0]));
const namedHits = new Set();
const unexplained = [];
for (const r of gap) {
  if (NAMED[r.id]) { namedHits.add(r.id); continue; }
  const rule = RULES.find((x) => x.test(r.name, { id: r.id, catalogNames }));
  if (rule) { ruleHits.set(rule.id, ruleHits.get(rule.id) + 1); continue; }
  unexplained.push(r);
}

if (byId.size < MIN_RECORDS) errors.push(`nur ${byId.size} Fahrzeug-Records nach Filter, Klinke ${MIN_RECORDS} — DataCore-Leser oder Archiv kaputt`);
for (const [id, n] of ruleHits) if (!n) errors.push(`Regel "${id}" greift nicht mehr (Zombie) — Regel löschen`);
for (const id of Object.keys(NAMED)) {
  if (namedHits.has(id)) continue;
  const why = !byId.has(id) ? 'steht nicht mehr im DataCore' : catalog.has(id) ? 'steht inzwischen im Katalog' : 'ist nicht flugfähig';
  errors.push(`Ausnahme "${id}" ${why} (Zombie) — Ausnahme löschen`);
}
for (const r of unexplained) warnings.push(`${r.id} ("${r.name}") ist flugfähig im DataCore, fehlt im Katalog — aufnehmen: node scripts/extract-hardpoints.mjs --add ${r.id}`);

/* ---------- Selbstauskunft ---------- */
console.log('\n=== verify:vehicle-gap — DataCore-Fahrzeuge gegen den Katalog ===');
console.log(`Artefakt: ${P4K} + ${norm(KATALOG.slice(ROOT.length + 1))}`);
console.log(`Records nach Variantenfilter: ${byId.size} (Klinke ${MIN_RECORDS}), davon flugfähig: ${flyable.length}`);
console.log(`Katalog: ${catalog.size}, flugfähig ohne Katalog-Eintrag: ${gap.length}`);
for (const r of RULES) console.log(`  Regel ${r.id.padEnd(15)} ${String(ruleHits.get(r.id)).padStart(3)}  ${r.why}`);
console.log(`  benannte Ids    ${String(namedHits.size).padStart(3)}`);
console.log(`  ohne Erklärung  ${String(unexplained.length).padStart(3)}`);
const offen = Object.entries(NAMED).filter(([, v]) => v.offen);
if (offen.length) {
  console.log(`\nSchulden (${offen.length} zurückgestellte Einordnungen):`);
  for (const [id, v] of offen) console.log(`  · ${id}: ${v.why}`);
}
for (const w of warnings) console.log(`WARNUNG: ${w}`);
for (const e of errors) console.error(`FEHLER: ${e}`);
console.log(`\nFEHLER: ${errors.length} | WARNUNGEN: ${warnings.length}`);
process.exit(errors.length ? 1 : 0);
