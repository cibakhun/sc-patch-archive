#!/usr/bin/env node
/* ============================================================
   build-hangar-ktx-klein — kleine Fassungen der komprimierten Zwillinge
   fürs Telefon (läuft in `npm run build` und `npm run dev`, vor Astro)
   ------------------------------------------------------------
   Schreibt zu jedem Zwilling public/hangar/ktx/<kennung>.ktx2 die Datei
   public/hangar/ktx-klein/<kennung>.ktx2: dieselbe Datei ohne die
   Mip-Stufen über KTX_KLEIN_MAX (Anlass, Zahlen und Bauweise:
   scripts/lib/hangar-ktx.mjs, ktxKlein). Nichts wird neu kodiert, der Lauf
   braucht weder basisu noch einen Browser und dauert wenige Sekunden.

   Der Ordner ist gitignored wie die Einrichtung der Halle
   (public/hangar/hall/*.furniture.glb): Er ist aus den Zwillingen
   abgeleitet, und was sich ableiten lässt, soll nicht doppelt im Repo
   liegen (163 MB). Astro kopiert public/ nach dist/, das Tor
   verify:hangar-ktx [8] prüft ihn dort gegen die Zwillinge.

   Läuft beliebig oft: geschrieben wird nur, was fehlt oder anders ist;
   Dateien ohne Zwilling gehen. Im Live-Bau (ohne Hangar,
   scripts/lib/hangar-switch.mjs) tut er nichts und sagt das.

     node scripts/build-hangar-ktx-klein.mjs
   ============================================================ */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KTX_KLEIN_MAX, KTX_KLEIN_ORDNER, KTX_NAME, KTX_ORDNER, ktxKlein } from './lib/hangar-ktx.mjs';
import { hangarImBau } from './lib/hangar-switch.mjs';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const QUELLE = join(ROOT, 'public', 'hangar', KTX_ORDNER), ZIEL = join(ROOT, 'public', 'hangar', KTX_KLEIN_ORDNER);
const mb = (n) => (n / 1048576).toFixed(1);

if (!hangarImBau()) {
  console.log('hangar-ktx-klein: Live-Bau (STAGING leer), der Hangar ist nicht im Bau: nichts zu tun.');
  process.exit(0);
}
if (!existsSync(QUELLE)) {
  console.error(`hangar-ktx-klein: ${QUELLE} fehlt: ohne Zwillinge gibt es keine kleinen Fassungen (scripts/build-hangar-ktx.mjs baut sie).`);
  process.exit(1);
}

const t0 = Date.now();
mkdirSync(ZIEL, { recursive: true });
const zwillinge = readdirSync(QUELLE).filter((n) => KTX_NAME.test(n)).sort();
const soll = new Set(zwillinge);
let gekuerzt = 0, kopiert = 0, geschrieben = 0, bytes = 0;
const fehler = [];
for (const name of zwillinge) {
  const gross = readFileSync(join(QUELLE, name));
  let klein;
  try { klein = ktxKlein(gross, KTX_KLEIN_MAX); } catch (e) { fehler.push(`${KTX_ORDNER}/${name}: ${e.message}`); continue; }
  if (klein === gross) kopiert++; else gekuerzt++;
  bytes += klein.length;
  const datei = join(ZIEL, name);
  let da = null;
  try { da = readFileSync(datei); } catch { /* fehlt: schreiben */ }
  if (da && da.equals(klein)) continue;
  writeFileSync(`${datei}.neu`, klein);
  renameSync(`${datei}.neu`, datei);
  geschrieben++;
}
let entfernt = 0;
for (const name of readdirSync(ZIEL)) {
  if (soll.has(name)) continue;
  unlinkSync(join(ZIEL, name));
  entfernt++;
}
if (fehler.length) {
  for (const f of fehler.slice(0, 12)) console.error(`FEHLER ${f}`);
  console.error(`\nhangar-ktx-klein: ${fehler.length} Zwilling${fehler.length === 1 ? '' : 'e'} nicht gekürzt. Das Telefon fände für diese Bilder keine kleine Fassung und lüde ihr WebP.\n`);
  process.exit(1);
}
console.log(`hangar-ktx-klein: ${zwillinge.length} kleine Fassungen bis ${KTX_KLEIN_MAX} px (${gekuerzt} gekürzt, ${kopiert} waren schon klein), ${mb(bytes)} MB; ${geschrieben} geschrieben, ${entfernt} entfernt, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
