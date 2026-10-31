/* ============================================================
   _hangar-switch.mjs — Bauschritt nach `astro build`.

   Im Live-Bau (STAGING leer) entfernt er aus dist/, was nur der Hangar
   braucht: die Modelle und Bilder (public/hangar wandert sonst
   ungefiltert mit, Astro kopiert public/ immer ganz) und die
   Hangar-Skripte unter assets/. Die Hangar-Seiten selbst entstehen im
   Live-Bau gar nicht erst (astro.config.mjs haengt die Routen nur im
   Vorschau-Bau ein). Begruendung: scripts/lib/hangar-switch.mjs.

   Im Vorschau-Bau tut er nichts und sagt das.

     node scripts/_hangar-switch.mjs [--dist <Ordner>]
   ============================================================ */
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hangarImBau, HANGAR_DIST_DIRS, HANGAR_DIST_FILES } from './lib/hangar-switch.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// --dist <Ordner>: nur fuer tests/e2e/hangar-switch.test.js.
const iDist = process.argv.indexOf('--dist');
const DIST = iDist > 0 ? resolve(process.argv[iDist + 1]) : resolve(ROOT, 'dist');

if (hangarImBau()) {
  console.log('hangar-switch: Vorschau-Bau (STAGING=1) — Hangar bleibt drin.');
  process.exit(0);
}
if (!existsSync(DIST)) {
  console.error('hangar-switch: kein dist/ — erst bauen.');
  process.exit(1);
}

let ordner = 0;
let dateien = 0;
for (const d of HANGAR_DIST_DIRS) {
  const p = resolve(DIST, d);
  if (!existsSync(p)) continue;
  dateien += zaehle(p);
  rmSync(p, { recursive: true, force: true });
  ordner++;
}
for (const sub of ['', 'de', 'assets']) {
  const dir = resolve(DIST, sub);
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir)) {
    const rel = relative(DIST, join(dir, name)).split('\\').join('/');
    if (!HANGAR_DIST_FILES.test(rel)) continue;
    rmSync(join(dir, name), { force: true });
    dateien++;
  }
}
console.log(`hangar-switch: Live-Bau — Hangar entfernt (${ordner} Ordner, ${dateien} Dateien).`);

function zaehle(p) {
  if (!statSync(p).isDirectory()) return 1;
  let n = 0;
  for (const e of readdirSync(p)) n += zaehle(join(p, e));
  return n;
}
