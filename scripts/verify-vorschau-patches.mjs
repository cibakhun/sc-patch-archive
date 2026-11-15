/* ============================================================
   verify-vorschau-patches.mjs — stehen Patch-Seiten vor der Abnahme genau
   im Vorschau-Bau? (Regel: scripts/lib/vorschau-patches.mjs)

     Live-Bau (dist/build.json staging:false)
       [1] keine dieser Seiten in dist/
       [2] keine Seite verlinkt eine, keine Daten-Datei (Suchregister,
           Sitemap) nennt ihren Pfad
     Vorschau-Bau (staging:true)
       [3] die Seiten in beiden Sprachen sind da

   Selbstauskunft: wie viele Seiten und Daten-Dateien gelesen wurden, mit
   Klinke. Kein git, kein Netz, kein Kindprozess — liest nur dist/.

     node scripts/verify-vorschau-patches.mjs [--dist <Ordner>] [--klinke-seiten <n>]
   ============================================================ */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VORSCHAU_PATCHES, VORSCHAU_PATCH_DIST_FILES, VORSCHAU_PATCH_PFAD } from './lib/vorschau-patches.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const DIST = arg('--dist') ? resolve(arg('--dist')) : resolve(ROOT, 'dist');
const MIN_SEITEN = Number(arg('--klinke-seiten') ?? 15000);

const fehler = [];
const stempel = resolve(DIST, 'build.json');
if (!existsSync(stempel)) {
  console.error('verify-vorschau-patches: dist/build.json fehlt — erst bauen (npm run build).');
  process.exit(1);
}
const vorschau = JSON.parse(readFileSync(stempel, 'utf8')).staging === true;
console.log(`verify-vorschau-patches: ${vorschau ? 'Vorschau-Bau' : 'Live-Bau'}, Patches vor der Abnahme: ${VORSCHAU_PATCHES.join(', ') || '(keine)'}`);

function alle(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) alle(p, out);
    else out.push(relative(DIST, p).split('\\').join('/'));
  }
  return out;
}
const dateien = alle(DIST);
const html = dateien.filter((f) => f.endsWith('.html'));
const daten = dateien.filter((f) => f.endsWith('.json') || f.endsWith('.xml'));

if (!vorschau) {
  const da = VORSCHAU_PATCH_DIST_FILES.filter((f) => existsSync(resolve(DIST, f)));
  for (const f of da) fehler.push(`[1] dist/${f} gehoert nicht in den Live-Bau`);
  console.log(`  [1] ${VORSCHAU_PATCH_DIST_FILES.length} Seiten gesucht, ${da.length} gefunden`);
  let treffer = 0;
  for (const f of [...html, ...daten]) {
    const m = VORSCHAU_PATCH_PFAD.exec(readFileSync(resolve(DIST, f), 'utf8'));
    if (m && ++treffer <= 10) fehler.push(`[2] dist/${f}: ${m[0]}`);
  }
  if (treffer > 10) fehler.push(`[2] … und ${treffer - 10} weitere Dateien mit Verweis`);
  console.log(`  [2] ${html.length} Seiten und ${daten.length} Daten-Dateien gelesen: ${treffer} mit Verweis`);
} else {
  const fehlt = VORSCHAU_PATCH_DIST_FILES.filter((f) => !existsSync(resolve(DIST, f)));
  for (const f of fehlt) fehler.push(`[3] dist/${f} fehlt im Vorschau-Bau`);
  console.log(`  [3] ${VORSCHAU_PATCH_DIST_FILES.length - fehlt.length} von ${VORSCHAU_PATCH_DIST_FILES.length} Seiten da`);
}

if (html.length < MIN_SEITEN) fehler.push(`gelesen: ${html.length} Seiten, Klinke ${MIN_SEITEN} — unvollstaendiger Bau?`);
console.log(`  Selbstauskunft: ${html.length} Seiten (Klinke ${MIN_SEITEN})`);

if (fehler.length) {
  console.error(`\nFEHLER: ${fehler.length}`);
  for (const m of fehler) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('verify-vorschau-patches: ALLE ZUSICHERUNGEN ERFUELLT ✓');
