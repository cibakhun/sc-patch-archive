// verify-fahrzeugwerte.mjs — harte Regeln fuer die Werte im Fahrzeug-Katalog.
//
// WARUM ES DEN GIBT: Am 29.10.2026 stand die Gladius Valiant still auf 0 kg
// (ein Steuerzeichen im Zahlwert). Gefangen hat es die Deckungs-Klinke in
// verify:vehicles — auf Schiene B, also nur, wenn nach dem Datenlauf jemand
// `npm run gate:data` faehrt. Auf Schiene A, die ueber die Auslieferung
// entscheidet, prueft bis heute kein Tor, ob ein Wert ueberhaupt moeglich ist.
//
// WAS ES BEWUSST NICHT IST: kein statistischer Ausreisser-Test. Gemessen am
// 04.11.2026: die echten Fehler der letzten Datenlaeufe sahen normal aus. Die
// Andromeda mit der alten Huelle 180.644 HP laege in ihrer Groessenklasse bei
// z = 1,3, die X1 Force mit doppelt gezaehlter Kanone bei z = -0,5 (Schwelle
// ueblich 3 bis 6). Umgekehrt meldet ein solcher Test zwei Dutzend Schiffe,
// die einfach anders sind (Rover, Reliant, Apollo, Javelin). Er waere
// Fehlalarm ohne Treffer (Grundsatz 3). Was jene Fehler gefunden hat, war der
// Abgleich mit einer zweiten Quelle (FleetYards, scmdb) im Datenlauf — der
// gehoert auf Schiene B, weil er Netz braucht.
//
// Geprueft wird deshalb nur, was IMMER falsch ist:
//   1  Bestand und Selbstauskunft, Klinke auf die Zahl der Fahrzeuge.
//   2  Keine Zahl ist NaN, unendlich oder negativ.
//   3  Pflichtwerte: Huelle > 0 HP und Masse > 0 kg, ausser benannten
//      Ausnahmen mit Anlass und Zombie-Waechter.
//   4  Summen: Piloten- und Turm-DPS sind die Summe ihrer Waffen, die
//      Raketenzahl die Summe der Werfer, SCM nicht ueber der Hoechstgeschw.
//   5  WARNUNG (nie FEHLER): eine 0, wo Bauteile einen Wert erwarten lassen
//      (Turm-DPS 0 bei verbauten Turmwaffen, Abmessung 0 aus der Fremdquelle).
//
// Schiene A: liest nur src/data/vehicles.json — kein git, kein Netz, keine
// Data.p4k.
//
//   node scripts/verify-fahrzeugwerte.mjs [--katalog <vehicles.json>]
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const kIdx = argv.indexOf('--katalog');
const KATALOG = kIdx >= 0 && argv[kIdx + 1] ? resolve(argv[kIdx + 1]) : resolve(ROOT, 'src/data/vehicles.json');

const fail = [];
const warn = [];

// Klinke (Grundsatz 5): 231 Fahrzeuge seit dem 4.10.2-Lauf. Nur nach oben;
// nach unten nur per Commit, dessen Botschaft die Ursache nennt.
const MIN_FAHRZEUGE = 231;

const ZAHLFELDER = [
  'crewMin', 'crewMax', 'scmSpeed', 'maxSpeed', 'boostForward', 'pitch', 'yaw', 'roll',
  'hullHp', 'massKg', 'shieldHp', 'qtSpeedMs', 'qtSpoolS', 'qtRangeM', 'qtFuel', 'h2Fuel',
  'oreSCU', 'cargoSCU', 'insClaimMin', 'insExpediteMin', 'insExpediteCost', 'pilotDps',
  'turretDps', 'missileCount', 'cmLaunchers', 'lengthM', 'widthM', 'heightM', 'msrpUSD',
  'sizeClass',
];

// Benannte Ausnahmen von den Pflichtwerten (Grundsatz 6). Schluessel =
// Fahrzeug-id, Wert = Anlass als voller Satz.
const ATLS = 'Die ATLS-Varianten haben im DataCore keinen Fahrzeug-Record (sie sind ein Power Suit) und kommen seit D-13 als eingefrorener Wiki-Satz, der weder Hülle noch Masse führt.';
const PFLICHT_AUSNAHMEN = Object.fromEntries(
  ['argo-atls', 'argo-atls-geo', 'argo-atls-geo-collector-grad01', 'argo-atls-geo-collector-grad03'].map((id) => [id, ATLS]),
);

const rund = (n) => Math.round(n * 10) / 10;
const summe = (liste, feld) => (liste ?? []).reduce((n, x) => n + (x[feld] ?? 0) * (x.count ?? 1), 0);

console.log('\n=== verify:fahrzeugwerte — harte Regeln fuer die Fahrzeugwerte ===');
console.log(`Artefakt: ${KATALOG.startsWith(ROOT) ? KATALOG.slice(ROOT.length + 1) : KATALOG}`);

let vehicles = [];
try { vehicles = JSON.parse(readFileSync(KATALOG, 'utf8')).vehicles ?? []; } catch (e) { fail.push(`Katalog nicht lesbar — ${e.message}`); }

console.log('\n[1] Bestand');
console.log(`    Fahrzeuge — Klinke ${MIN_FAHRZEUGE}   Ist: ${vehicles.length}`);
if (vehicles.length < MIN_FAHRZEUGE) fail.push(`nur ${vehicles.length} Fahrzeuge, Klinke ${MIN_FAHRZEUGE} — das Tor liefe teilweise leer; Ursache klaeren, nicht die Klinke senken`);

console.log('\n[2] Zahlen sind endlich und nicht negativ');
let zahlen = 0;
for (const v of vehicles) {
  for (const f of ZAHLFELDER) {
    const x = v[f];
    if (x == null) continue;
    zahlen++;
    if (typeof x !== 'number' || !Number.isFinite(x)) fail.push(`${v.id}.${f} = ${JSON.stringify(x)} — keine endliche Zahl; Erzeuger pruefen (Steuerzeichen im Zahlwert?)`);
    else if (x < 0) fail.push(`${v.id}.${f} = ${x} — negativ; physikalisch unmoeglich`);
  }
}
console.log(`    geprueft: ${zahlen} Zahlwerte in ${ZAHLFELDER.length} Feldern`);

console.log('\n[3] Pflichtwerte: Huelle und Masse groesser 0');
const ausnahmeGetroffen = new Set();
let pflicht = 0;
for (const v of vehicles) {
  const huelleOk = typeof v.hullHp === 'number' && v.hullHp > 0;
  const masseOk = typeof v.massKg === 'number' && v.massKg > 0;
  pflicht++;
  if (huelleOk && masseOk) continue;
  if (PFLICHT_AUSNAHMEN[v.id]) { ausnahmeGetroffen.add(v.id); continue; }
  if (!huelleOk) fail.push(`${v.id}: Huelle ${JSON.stringify(v.hullHp)} HP — ein Fahrzeug ohne Huelle gibt es nicht; Datensatz neu erzeugen`);
  if (!masseOk) fail.push(`${v.id}: Masse ${JSON.stringify(v.massKg)} kg — ein Fahrzeug ohne Masse gibt es nicht; Datensatz neu erzeugen (so stand am 29.10.2026 die Gladius Valiant auf 0 kg)`);
}
console.log(`    geprueft: ${pflicht}   benannte Ausnahmen getroffen: ${ausnahmeGetroffen.size} von ${Object.keys(PFLICHT_AUSNAHMEN).length}`);
const ids = new Set(vehicles.map((v) => v.id));
for (const id of Object.keys(PFLICHT_AUSNAHMEN)) {
  if (!ids.has(id)) fail.push(`Ausnahme "${id}": kein Fahrzeug mit dieser id — Ausnahme zeigt ins Leere, entfernen`);
  else if (!ausnahmeGetroffen.has(id)) fail.push(`Ausnahme "${id}": Huelle und Masse sind jetzt gesetzt — Anlass erledigt, Ausnahme entfernen`);
}

console.log('\n[4] Summen und Reihenfolgen');
let summen = 0;
for (const v of vehicles) {
  const pilot = v.fixedWeapons ?? [];
  if (v.pilotDps != null && pilot.length && pilot.every((w) => w.dps != null)) {
    summen++;
    const s = rund(summe(pilot, 'dps'));
    if (Math.abs(s - v.pilotDps) > 0.5) fail.push(`${v.id}: pilotDps ${v.pilotDps}, Summe der Pilotwaffen ${s} — Zaehlung im Erzeuger pruefen`);
  }
  const turm = v.turretWeapons ?? [];
  if (v.turretDps != null && turm.length && turm.every((w) => w.dps != null)) {
    summen++;
    const s = rund(summe(turm, 'dps'));
    if (Math.abs(s - v.turretDps) > 0.5) fail.push(`${v.id}: turretDps ${v.turretDps}, Summe der Turmwaffen ${s} — Zaehlung im Erzeuger pruefen`);
  }
  if (v.missileCount != null && (v.missileRacks ?? []).length) {
    summen++;
    const n = v.missileRacks.reduce((a, r) => a + (r.count ?? 0), 0);
    if (n !== v.missileCount) fail.push(`${v.id}: missileCount ${v.missileCount}, Summe der Raketen ${n} — Zaehlung im Erzeuger pruefen`);
  }
  if (v.scmSpeed != null && v.maxSpeed != null) {
    summen++;
    if (v.scmSpeed > v.maxSpeed) fail.push(`${v.id}: SCM ${v.scmSpeed} m/s liegt ueber der Hoechstgeschwindigkeit ${v.maxSpeed} m/s`);
  }
}
console.log(`    geprueft: ${summen} Summen und Reihenfolgen`);

console.log('\n[5] Nullen, die Bauteile nicht erklaeren (WARNUNG)');
for (const v of vehicles) {
  if (v.turretDps === 0 && (v.turretWeapons ?? []).length)
    warn.push(`${v.id}: Turm-DPS 0 bei ${(v.turretWeapons ?? []).map((w) => w.name).join(', ')} — Schadensart ohne DPS (z. B. Verzerrung)? Auf der Seite steht dann eine 0 statt "keine Angabe"`);
  for (const f of ['lengthM', 'widthM', 'heightM']) {
    if (v[f] === 0) warn.push(`${v.id}: ${f} = 0 aus der Fremdquelle (vehicle-external.json) — Abmessung fehlt dort`);
  }
}
console.log(`    Hinweise: ${warn.length}`);

for (const w of warn) console.log(`WARNUNG: ${w}`);
if (fail.length) {
  console.error(`\nFAIL (${fail.length}):\n` + fail.map((f) => `  · ${f}`).join('\n') + '\n');
  process.exit(1);
}
console.log(`\nOK — ${vehicles.length} Fahrzeuge, ${zahlen} Zahlwerte, ${summen} Summen geprueft · ${Object.keys(PFLICHT_AUSNAHMEN).length} Ausnahmen · ${warn.length} Warnungen\n`);
