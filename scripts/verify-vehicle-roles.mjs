// verify-vehicle-roles.mjs — Integritäts-/Konsistenz-Check der committeten
// Fahrzeug-Rollen-Momentaufnahme (src/data/vehicle-roles.json). Liest
// AUSSCHLIESSLICH committete Dateien — src/data/vehicle-roles.json und
// src/data/vehicles.json — und öffnet NIEMALS das Spielarchiv, damit der
// Prüfschritt ohne die 158-GB-Data.p4k läuft (wie verify-mining.mjs).
//
// Prüft die Join-Rate (ROLE-10): schlägt fehl, sobald die Zahl der gejointen
// Sätze unter den am 02.08.2026 erhobenen Stand (223 von 227) sinkt.
//
//   node scripts/verify-vehicle-roles.mjs
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const D = (n) => JSON.parse(readFileSync(resolve(__dirname, '..', 'src', 'data', n), 'utf8'));
const roles = D('vehicle-roles.json');
const veh = D('vehicles.json');

const fail = [];
const need = (cond, msg) => { if (!cond) fail.push(msg); };

// Untergrenze der Join-Rate: haelt den am 02.08.2026 gegen das echte Archiv
// erhobenen Stand fest (RESEARCH.md/05-CONTEXT.md, D-03). Darf nur nach OBEN
// wandern, sobald ein spaeterer Datamine-Lauf mehr Schiffe joint (ROLE-10) —
// NIE nach unten, ohne die Ursache zu klaeren.
const MIN_MATCHED = 223;

console.log(`\n=== A) Join-Rate gegen src/data/vehicles.json ===`);
const vehIds = new Set(veh.vehicles.map((v) => v.id));
const roleIds = Object.keys(roles.vehicles);
console.log(`Katalog (vehicles.json):        ${veh.vehicles.length}`);
console.log(`Gejointe Fahrzeuge (roles):      ${roleIds.length}`);
console.log(`unmatched (roles.json):         ${roles.unmatched.length}`);
need(roleIds.length >= MIN_MATCHED, `Join-Rate ${roleIds.length} liegt unter der Untergrenze ${MIN_MATCHED} (Stand 02.08.2026) — Ursache klären, nicht die Untergrenze senken`);
need(roles.count === roleIds.length, `count (${roles.count}) stimmt nicht mit der Anzahl gejointer Sätze (${roleIds.length}) überein`);
need(roleIds.length + roles.unmatched.length === veh.vehicles.length, `Sätze (${roleIds.length}) + unmatched (${roles.unmatched.length}) ergibt nicht die Katalogzahl (${veh.vehicles.length})`);

console.log(`\n=== B) Jede gejointe id existiert im Katalog ===`);
const missingFromCatalog = roleIds.filter((id) => !vehIds.has(id));
console.log(`Sätze ohne Katalog-Eintrag: ${missingFromCatalog.length}`);
if (missingFromCatalog.length) console.log(`  ${missingFromCatalog.join(', ')}`);
need(missingFromCatalog.length === 0, `${missingFromCatalog.length} Sätze in vehicle-roles.json haben keine passende id in vehicles.json: ${missingFromCatalog.join(', ')}`);

console.log(`\n=== C) unmatched ist benannt, nicht leer, und jede id existiert im Katalog (D-03/ROLE-01) ===`);
console.log(`unmatched: ${roles.unmatched.join(', ') || '(keine)'}`);
need(Array.isArray(roles.unmatched) && roles.unmatched.length > 0, `unmatched ist leer oder fehlt — die Fehlstellen müssen benannt sein, nicht stillschweigend leer bleiben`);
const unmatchedMissing = (roles.unmatched || []).filter((id) => !vehIds.has(id));
need(unmatchedMissing.length === 0, `unmatched nennt ids, die es im Katalog gar nicht gibt: ${unmatchedMissing.join(', ')}`);

console.log(`\n=== D) Jeder Satz trägt roleKey, roleEn und careerKey ===`);
const incomplete = roleIds.filter((id) => {
  const v = roles.vehicles[id];
  return !v.roleKey || !v.roleEn || !v.careerKey;
});
console.log(`Unvollständige Sätze: ${incomplete.length}`);
if (incomplete.length) console.log(`  ${incomplete.slice(0, 20).join(', ')}`);
need(incomplete.length === 0, `${incomplete.length} Sätze haben leeres roleKey/roleEn/careerKey: ${incomplete.slice(0, 20).join(', ')}`);

console.log(`\n=== E) Kein Satz enthält einen lokalen Dateipfad ===`);
const asString = JSON.stringify(roles);
const hasPath = /[A-Za-z]:[\\/]/.test(asString) || /Star ?Citizen[\\/]/i.test(asString);
need(!hasPath, `vehicle-roles.json enthält einen lokalen Dateipfad oder eine Laufwerksangabe`);
need(typeof roles.source === 'string' && roles.source.length > 0, `source-Feld fehlt oder ist leer`);
console.log(hasPath ? 'GEFUNDEN' : 'keine Pfadangaben gefunden');

console.log(`\n=== F) 18 Rollenfamilien tragen genau den erhobenen Stand (D-05, Erhebung 02.08.2026) ===`);
// Untergrenze/Sollwert je Familie. Bei Abweichung: hier nachziehen und im
// SUMMARY dokumentieren (05-02-PLAN.md "Wenn eine nachgerechnete Zahl von der
// Tabelle abweicht") — eine Familie darf dabei NIE stillschweigend wegfallen.
const FAMILY_WANT = {
  jaeger: 63, frachttransport: 35, erkundung: 27, passagiere: 17, rennen: 17,
  einsteiger: 12, bodenkampf: 11, kanonenschiff: 9, medizin: 7, bomber: 6,
  truppentransport: 6, bergung: 6, abriegelung: 5, bergbau: 5, grosskampfschiff: 5,
  'daten-wissenschaft': 3, betankung: 3, mehrzweck: 2,
};
const familyCount = {};
for (const v of Object.values(roles.vehicles)) for (const f of v.families || []) familyCount[f] = (familyCount[f] || 0) + 1;
for (const [f, want] of Object.entries(FAMILY_WANT)) {
  const got = familyCount[f] || 0;
  console.log(`  ${String(got).padStart(4)}  ${f}${got !== want ? ` (Soll ${want})` : ''}`);
  need(got === want, `Familie ${f}: ${got} statt ${want}`);
}
const unknownFamilies = Object.keys(familyCount).filter((f) => !(f in FAMILY_WANT));
need(unknownFamilies.length === 0, `Familien-Slugs außerhalb der Tabelle: ${unknownFamilies.join(', ')}`);

console.log(`\n=== G) Jedes Fahrzeug traegt mindestens eine Familie und einen Beruf ===`);
const withoutFamily = roleIds.filter((id) => !(roles.vehicles[id].families || []).length);
const withoutCareer = roleIds.filter((id) => !roles.vehicles[id].careerKey);
console.log(`ohne Familie: ${withoutFamily.length}, ohne Beruf: ${withoutCareer.length}`);
need(withoutFamily.length === 0, `${withoutFamily.length} Fahrzeuge ohne Familie: ${withoutFamily.join(', ')}`);
need(withoutCareer.length === 0, `${withoutCareer.length} Fahrzeuge ohne Beruf: ${withoutCareer.join(', ')}`);

console.log(`\n=== H) Verbundrollen (D-06) tauchen mit mindestens zwei Familien auf ===`);
const ROLE_COMPOUND_KEYS = [
  'starterlightfreight', 'starterpathfinder', 'starterlightfighter', 'startermining',
  'startersalvage', 'heavyfighterbomber', 'lightfreight_mediumfighter', 'mediumfreightgunshio',
];
for (const rk of ROLE_COMPOUND_KEYS) {
  const bearers = roleIds.filter((id) => roles.vehicles[id].roleKey === rk);
  const ok = bearers.length > 0 && bearers.every((id) => (roles.vehicles[id].families || []).length >= 2);
  console.log(`  ${rk}: ${bearers.length} Fahrzeug(e)${ok ? '' : ' — FEHLT/unzureichend zerlegt'}`);
  need(bearers.length > 0, `Verbundrolle ${rk} kommt in der Momentaufnahme nicht vor`);
  need(ok, `Verbundrolle ${rk} ist bei mindestens einem Fahrzeug nicht in >=2 Familien zerlegt`);
}

console.log(`\n=== I) Signatur (D-07): genau 16 Fahrzeuge, 11 davon unter 0,80 ===`);
const withSig = roleIds.filter((id) => roles.vehicles[id].sig);
const lowSig = withSig.filter((id) => {
  const s = roles.vehicles[id].sig;
  return Math.min(s.ir ?? 1, s.em ?? 1) < 0.8;
});
console.log(`  sig-Objekt: ${withSig.length}, davon unter 0,80: ${lowSig.length}`);
need(withSig.length === 16, `Fahrzeuge mit sig-Objekt: ${withSig.length} statt 16`);
need(lowSig.length === 11, `Fahrzeuge mit sig unter 0,80: ${lowSig.length} statt 11`);
const zeroAsNumber = roleIds.filter((id) => {
  const s = roles.vehicles[id].sig;
  return s && [s.ir, s.em, s.cs].includes(0);
});
need(zeroAsNumber.length === 0, `${zeroAsNumber.length} Fahrzeuge tragen 0 statt null in sig (0 bedeutet "nicht angegeben"): ${zeroAsNumber.join(', ')}`);

console.log(`\n=== J) Prowler Utility (Frachter mit abgesenkter Signatur) und Eclipse (Tarnkappenbomber) ===`);
const prowlerUtility = roles.vehicles['espr-prowler-utility'];
need(!!prowlerUtility, `espr-prowler-utility fehlt in der Momentaufnahme`);
if (prowlerUtility) {
  need(prowlerUtility.sig?.ir === 0.76, `espr-prowler-utility: sig.ir ist ${prowlerUtility.sig?.ir} statt 0.76`);
  need((prowlerUtility.families || []).includes('frachttransport'), `espr-prowler-utility traegt nicht die Familie frachttransport`);
}
const eclipse = roles.vehicles['aegs-eclipse'];
need(!!eclipse, `aegs-eclipse fehlt in der Momentaufnahme`);
if (eclipse) need((eclipse.families || []).includes('bomber'), `aegs-eclipse traegt nicht die Familie bomber`);

// 4.10-Datenlauf 27.08.2026: cargo 102 -> 103. Neu dabei ist die Aegis
// Hammerhead "Showdown" (aegs-hammerhead-showdown) — sie fuehrt in 4.10 einen
// InventoryContainer, den sie vorher nicht hatte. Nachgesehen, nicht vermutet:
// der Vorher-nachher-Vergleich der beiden vehicle-roles.json nennt genau ein
// hinzugekommenes und kein weggefallenes Fahrzeug. `ground` bleibt bei 37.
console.log(`\n=== K) Merkmalsleiste (D-09): genau cargo (103) und ground (37), keine weitere Kennung ===`);
const cargoIds = roleIds.filter((id) => (roles.vehicles[id].feat || []).includes('cargo'));
const groundIds = roleIds.filter((id) => (roles.vehicles[id].feat || []).includes('ground'));
console.log(`  cargo: ${cargoIds.length}, ground: ${groundIds.length}`);
need(cargoIds.length === 103, `feat=cargo: ${cargoIds.length} statt 103`);
need(groundIds.length === 37, `feat=ground: ${groundIds.length} statt 37`);
const badFeat = roleIds.filter((id) => (roles.vehicles[id].feat || []).some((f) => f !== 'cargo' && f !== 'ground'));
need(badFeat.length === 0, `Fahrzeuge mit unerwarteter Merkmalskennung: ${badFeat.join(', ')}`);

console.log(`\n=== L) Belegpflicht: sources nennt alle sieben Achsen ===`);
const sourceKeys = ['career', 'role', 'signature', 'feat.cargo', 'feat.ground', 'size', 'subType'];
const missingSources = sourceKeys.filter((k) => !roles.sources || !roles.sources[k]);
console.log(`  fehlend: ${missingSources.join(', ') || '(keine)'}`);
need(missingSources.length === 0, `sources-Kopffeld fehlt fuer: ${missingSources.join(', ')}`);

console.log(`\n=== M) Größenklasse (AttachDef.Size, Quick-Task 260802-ose): sechs Klassen tragen den erhobenen Stand ===`);
// Erhebungsstand 02.08.2026 (PLAN.md der Quick-Task, gegen das echte Archiv
// gemessen). Darf sich nur aendern, wenn ein spaeterer Datamine-Lauf die
// Ursache klaert — nicht stillschweigend nachziehen.
const SIZE_WANT = { 1: 48, 2: 82, 3: 38, 4: 22, 5: 26, 6: 7 };
const sizeCount = {};
for (const v of Object.values(roles.vehicles)) if (v.size != null) sizeCount[v.size] = (sizeCount[v.size] || 0) + 1;
for (const [n, want] of Object.entries(SIZE_WANT)) {
  const got = sizeCount[n] || 0;
  console.log(`  ${String(got).padStart(4)}  Größe ${n}${got !== want ? ` (Soll ${want})` : ''}`);
  need(got === want, `Größenklasse ${n}: ${got} statt ${want}`);
}
const withoutSize = roleIds.filter((id) => roles.vehicles[id].size == null);
need(withoutSize.length === 0, `${withoutSize.length} Fahrzeuge ohne Größenklasse: ${withoutSize.join(', ')}`);

console.log(`\n=== N) SubType (AttachDef.SubType, informativ, Quick-Task 260802-ose): Katalogstand 196/27 ===`);
// SubType ist NICHT das Bodenfahrzeug-Merkmal (siehe feat.ground in Abschnitt
// K) — geprueft und bewusst nicht umgestellt, siehe SUMMARY der Quick-Task
// (Nox/Dragonfly/Pulse/X1/Hoverquad laufen bei CIG als Vehicle_Spaceship).
const subTypeCount = {};
for (const v of Object.values(roles.vehicles)) if (v.subType) subTypeCount[v.subType] = (subTypeCount[v.subType] || 0) + 1;
console.log(`  Vehicle_Spaceship: ${subTypeCount.Vehicle_Spaceship || 0}, Vehicle_GroundVehicle: ${subTypeCount.Vehicle_GroundVehicle || 0}`);
need((subTypeCount.Vehicle_Spaceship || 0) === 196, `SubType Vehicle_Spaceship: ${subTypeCount.Vehicle_Spaceship || 0} statt 196`);
need((subTypeCount.Vehicle_GroundVehicle || 0) === 27, `SubType Vehicle_GroundVehicle: ${subTypeCount.Vehicle_GroundVehicle || 0} statt 27`);

console.log(`\n--- Zusammenfassung: ${roleIds.length}/${veh.vehicles.length} gejointe Fahrzeuge geprüft, ${roles.unmatched.length} benannte Fehlstellen, ${fail.length} Fehlschläge ---`);
if (fail.length) {
  console.log(`\nFEHLGESCHLAGEN:`);
  for (const f of fail) console.log(`  - ${f}`);
  process.exitCode = 1;
} else {
  console.log(`\nOK — Join-Rate ${roleIds.length}/${veh.vehicles.length} liegt bei/über der Untergrenze ${MIN_MATCHED}.`);
}
