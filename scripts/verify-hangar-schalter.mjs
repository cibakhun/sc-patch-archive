/* ============================================================
   verify-hangar-schalter.mjs — steht der Hangar genau dort, wo er hingehoert?

   Live bekommt alles von staging ausser dem Hangar (Krisz 31.10.2026;
   Begruendung und Schalter: scripts/lib/hangar-switch.mjs). Dieses Tor
   prueft das am gebauten Artefakt, in beide Richtungen:

     Live-Bau (dist/build.json staging:false)
       [1] keine Hangar-Seiten, -Ordner und -Skripte in dist/
       [2] keine Seite verlinkt eine Hangar-Seite oder laedt etwas aus
           /hangar/ oder /assets/hangar-*.js
     Vorschau-Bau (staging:true)
       [3] die Hangar-Seiten in beiden Sprachen, die Buchtdokumente und
           die Modelle sind da, und das Menue fuehrt zum Hangar

   Dieselbe Regel fuer die Prototypen (scripts/lib/vorschau-seiten.mjs,
   seit 09.11.2026 die Crafting-Werkbank):
       [4] Live-Bau: keine Prototyp-Seite, keine Seite verlinkt eine,
           und keine Daten-Datei (Suchregister) nennt ihren Pfad
       [5] Vorschau-Bau: die Prototyp-Seiten in beiden Sprachen sind da,
           und die bisherige Crafting-Seite fuehrt in beiden Sprachen hin

   Erst [1] und [2] machen es zulaessig, dass run-gate die Hangar-Strecken
   (nurMitHangar) gegen den Live-Bau weglaesst: was nicht da ist, muss
   nicht geprueft werden — aber dass es nicht da ist, wird geprueft.

   Selbstauskunft: wie viele Seiten gelesen wurden, mit Klinke.
   Kein git, kein Netz, kein Kindprozess — liest nur dist/.

     node scripts/verify-hangar-schalter.mjs
   ============================================================ */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HANGAR_DIST_DIRS, HANGAR_DIST_FILES, HANGAR_HREF } from './lib/hangar-switch.mjs';
import { VORSCHAU_DIST_FILES, VORSCHAU_HREF, VORSCHAU_PFAD } from './lib/vorschau-seiten.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// --dist <Ordner> und --klinke-seiten <n>: nur fuer
// tests/e2e/hangar-switch.test.js (kleine Probe-Artefakte).
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const DIST = arg('--dist') ? resolve(arg('--dist')) : resolve(ROOT, 'dist');

// Klinken (nur nach oben; nach unten nur per Commit mit Ursache).
const MIN_SEITEN = Number(arg('--klinke-seiten') ?? 15000); // gelesene HTML-Seiten (31.10.2026: gut 17 600 live)
const MIN_BUCHTEN = 200; // Buchtdokumente je Sprache im Vorschau-Bau (31.10.2026: 227)
const MIN_MODELLE = 500; // Dateien unter dist/hangar/ im Vorschau-Bau

const fehler = [];
const fail = (m) => fehler.push(m);

const stempelPfad = resolve(DIST, 'build.json');
if (!existsSync(stempelPfad)) {
  console.error('verify-hangar-schalter: dist/build.json fehlt — erst bauen (npm run build).');
  process.exit(1);
}
const vorschau = JSON.parse(readFileSync(stempelPfad, 'utf8')).staging === true;
console.log(`verify-hangar-schalter: ${vorschau ? 'Vorschau-Bau — Hangar muss da sein' : 'Live-Bau — Hangar darf nicht da sein'}`);

/** Alle Dateien unter dist/, relativ, mit / getrennt. */
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

if (!vorschau) {
  // [1]
  const ordner = HANGAR_DIST_DIRS.filter((d) => existsSync(resolve(DIST, d)));
  for (const d of ordner) fail(`[1] dist/${d} gehoert nicht in den Live-Bau`);
  const reste = dateien.filter((f) => HANGAR_DIST_FILES.test(f));
  for (const f of reste.slice(0, 10)) fail(`[1] dist/${f} gehoert nicht in den Live-Bau`);
  if (reste.length > 10) fail(`[1] … und ${reste.length - 10} weitere Hangar-Dateien`);
  console.log(`  [1] ${HANGAR_DIST_DIRS.length} Ordner und ${dateien.length} Dateien durchgesehen: ${ordner.length + reste.length} Hangar-Reste`);

  // [2] und [4] in einem Durchgang: jede Seite wird einmal gelesen.
  const LAEDT = /(?:src|href|data-src|content)=["'](?:https:\/\/verse-base\.com)?\/(?:hangar\/|assets\/hangar-[\w-]+\.js)/;
  let treffer = 0;
  let protoLinks = 0;
  const protoLink = (f, m) => {
    protoLinks++;
    if (protoLinks <= 10) fail(`[4] dist/${f}: ${m[0]}`);
  };
  for (const f of html) {
    const t = readFileSync(resolve(DIST, f), 'utf8');
    const m = HANGAR_HREF.exec(t) || LAEDT.exec(t);
    if (m) {
      treffer++;
      if (treffer <= 10) fail(`[2] dist/${f}: ${m[0]}`);
    }
    const p = VORSCHAU_HREF.exec(t);
    if (p) protoLink(f, p);
  }
  if (treffer > 10) fail(`[2] … und ${treffer - 10} weitere Seiten mit Hangar-Verweis`);
  console.log(`  [2] ${html.length} Seiten gelesen: ${treffer} mit Verweis auf den Hangar`);

  // [4] Prototypen: Seiten, Links (oben) und Daten-Dateien (Suchregister).
  const proto = VORSCHAU_DIST_FILES.filter((f) => existsSync(resolve(DIST, f)));
  for (const f of proto) fail(`[4] dist/${f} gehoert nicht in den Live-Bau (Prototyp)`);
  const daten = dateien.filter((f) => f.endsWith('.json'));
  for (const f of daten) {
    const p = VORSCHAU_PFAD.exec(readFileSync(resolve(DIST, f), 'utf8'));
    if (p) protoLink(f, p);
  }
  if (protoLinks > 10) fail(`[4] … und ${protoLinks - 10} weitere Dateien mit Verweis auf einen Prototyp`);
  console.log(`  [4] ${VORSCHAU_DIST_FILES.length} Prototyp-Seiten gesucht, ${proto.length} gefunden; ${html.length} Seiten und ${daten.length} Daten-Dateien gelesen: ${protoLinks} mit Verweis`);
} else {
  // [3]
  for (const f of ['hangar.html', 'de/hangar.html', 'hangar-loadout.html', 'de/hangar-loadout.html', 'hangar-layouts.json']) {
    if (!existsSync(resolve(DIST, f))) fail(`[3] dist/${f} fehlt im Vorschau-Bau`);
  }
  const buchten = (sub) => dateien.filter((f) => f.startsWith(sub) && f.endsWith('.html')).length;
  const en = buchten('hangar-bay/');
  const de = buchten('de/hangar-bay/');
  if (en < MIN_BUCHTEN || de < MIN_BUCHTEN) fail(`[3] Buchtdokumente EN ${en} / DE ${de}, Klinke ${MIN_BUCHTEN} je Sprache`);
  const modelle = dateien.filter((f) => f.startsWith('hangar/')).length;
  if (modelle < MIN_MODELLE) fail(`[3] dist/hangar/ hat ${modelle} Dateien, Klinke ${MIN_MODELLE}`);
  const nav = existsSync(resolve(DIST, 'schiffe.html')) && /href="\/hangar\.html"/.test(readFileSync(resolve(DIST, 'schiffe.html'), 'utf8'));
  if (!nav) fail('[3] dist/schiffe.html fuehrt nicht zum Hangar (Menue oder Schiffsliste)');
  console.log(`  [3] Seiten in beiden Sprachen, ${en} + ${de} Buchtdokumente, ${modelle} Dateien unter dist/hangar/, Menue ${nav ? 'mit' : 'OHNE'} Hangar`);

  // [5]
  const fehlt = VORSCHAU_DIST_FILES.filter((f) => !existsSync(resolve(DIST, f)));
  for (const f of fehlt) fail(`[5] dist/${f} fehlt im Vorschau-Bau (Prototyp)`);
  let wege = 0;
  for (const f of ['topics/crafting.html', 'de/topics/crafting.html']) {
    const alt = resolve(DIST, f);
    if (existsSync(alt) && VORSCHAU_HREF.test(readFileSync(alt, 'utf8'))) wege++;
    else fail(`[5] dist/${f} fuehrt nicht zur Werkbank (Prototyp-Zeile)`);
  }
  console.log(`  [5] ${VORSCHAU_DIST_FILES.length - fehlt.length} von ${VORSCHAU_DIST_FILES.length} Prototyp-Seiten da, ${wege} von 2 Crafting-Seiten mit Weg dorthin`);
}

if (html.length < MIN_SEITEN) fail(`gelesen: ${html.length} Seiten, Klinke ${MIN_SEITEN} — unvollstaendiger Bau?`);
console.log(`  Selbstauskunft: ${html.length} Seiten (Klinke ${MIN_SEITEN})`);

if (fehler.length) {
  console.error(`\nFEHLER: ${fehler.length}`);
  for (const m of fehler) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('verify-hangar-schalter: ALLE ZUSICHERUNGEN ERFUELLT ✓');
