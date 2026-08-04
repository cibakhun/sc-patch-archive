// Feld-für-Feld-Vergleich: Spieldaten-Katalog gegen den Wiki-Katalog.
//
// Der Katalog wird NICHT blind getauscht. Dieses Skript sagt je Feld, wie viele
// Fahrzeuge identisch sind, wo Werte fehlen und wo sie abweichen — Abweichungen
// mit Beispielen, damit jede einzelne beurteilt werden kann, bevor die Wiki
// abgeschaltet wird.
//
// Aufruf: node scripts/verify-vehicles.mjs [--field <name>] [--all]
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rd = (p) => JSON.parse(readFileSync(resolve(__dirname, '..', 'src', 'data', p), 'utf8'));
const argv = process.argv.slice(2);
const FIELD = argv.includes('--field') ? argv[argv.indexOf('--field') + 1] : null;
const ALL = argv.includes('--all');

const wiki = new Map(rd('vehicles.json').vehicles.map((v) => [v.id, v]));
const game = rd('vehicles-gamefiles.json').vehicles;

// Direkt vergleichbare Skalare. Links = Feld im Spiel-Katalog, rechts im Wiki-Katalog.
const SCALARS = [
  ['name', 'name'], ['manufacturer', 'manufacturer'], ['makerCode', 'makerCode'],
  ['sizeDe', 'sizeDe'], ['crew', 'crewMax'], ['cargoSCU', 'cargoSCU'],
  ['scmSpeed', 'scmSpeed'], ['maxSpeed', 'maxSpeed'], ['boostForward', 'boostForward'],
  ['pitch', 'pitch'], ['yaw', 'yaw'], ['roll', 'roll'],
  ['hullHp', 'hullHp'], ['shieldHp', 'shieldHp'], ['qtSpeedMs', 'qtSpeedMs'],
  ['insClaimMin', 'insClaimMin'], ['insExpediteMin', 'insExpediteMin'], ['insExpediteCost', 'insExpediteCost'],
  ['cmLaunchers', 'cmLaunchers'],
];

const near = (a, b) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= Math.max(0.05, Math.abs(b) * 0.005);
const rows = [];
for (const [gk, wk] of SCALARS) {
  if (FIELD && gk !== FIELD) continue;
  let same = 0, diff = [], missingGame = 0, missingWiki = 0;
  for (const g of game) {
    const w = wiki.get(g.id);
    if (!w) continue;
    const a = g[gk], b = w[wk];
    if (a == null && b == null) continue;
    if (a == null) { missingGame++; continue; }
    if (b == null) { missingWiki++; continue; }
    if (a === b || near(a, b)) same++;
    else diff.push(`${w.name}: Spiel ${JSON.stringify(a)} vs Wiki ${JSON.stringify(b)}`);
  }
  rows.push({ field: gk, same, diff, missingGame, missingWiki });
}

console.log(`Fahrzeuge: Spiel ${game.length} · Wiki ${wiki.size}\n`);
console.log('Feld                identisch  abweichend  fehlt(Spiel)  fehlt(Wiki)');
console.log('-'.repeat(72));
for (const r of rows)
  console.log(`${r.field.padEnd(20)}${String(r.same).padStart(9)}${String(r.diff.length).padStart(12)}${String(r.missingGame).padStart(14)}${String(r.missingWiki).padStart(13)}`);

for (const r of rows) {
  if (!r.diff.length) continue;
  console.log(`\n=== ${r.field}: ${r.diff.length} Abweichungen ===`);
  for (const d of (ALL || FIELD ? r.diff : r.diff.slice(0, 8))) console.log('  ' + d);
  if (!ALL && !FIELD && r.diff.length > 8) console.log(`  … ${r.diff.length - 8} weitere (--all)`);
}

// Bewaffnung: Waffenzahl je Schiff
let armSame = 0; const armDiff = [];
for (const g of game) {
  const w = wiki.get(g.id);
  if (!w) continue;
  const gn = g.fixedWeapons.reduce((n, x) => n + x.count, 0);
  const wn = (w.fixedWeapons ?? []).reduce((n, x) => n + x.count, 0);
  if (gn === wn) armSame++; else armDiff.push(`${w.name}: Spiel ${gn} vs Wiki ${wn} Pilotwaffen`);
}
console.log(`\n=== Pilotwaffen-Anzahl: ${armSame} identisch, ${armDiff.length} abweichend ===`);
for (const d of (ALL ? armDiff : armDiff.slice(0, 10))) console.log('  ' + d);
