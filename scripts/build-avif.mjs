// AVIF-Fassungen der Bilder aus scripts/lib/avif.mjs nach public/assets/avif/.
// -----------------------------------------------------------------------------
// Läuft nach _sync-assets, vor astro (siehe package.json). Gleiche Auflösung
// wie das Original, nur das Format wechselt. Cache wie build-thumbs.mjs: die
// Frische gilt gegen die KANONISCHE Quelle assets/<name>, nicht gegen
// public/assets (bekommt bei jedem Sync eine neue mtime). Und gegen
// scripts/lib/avif.mjs: Ohne das blieben neue Werte für AVIF_QUALITAET oder
// AVIF_AUFWAND wirkungslos, bis jemand public/assets/avif von Hand löscht.
//
// Fehlt eine Quelle, bricht der Build: Die Liste nennt sie ausdrücklich, ein
// stiller Ausfall wäre eine Seite, die wieder das große JPG lädt.
import sharp from 'sharp';
import { mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { AVIF_BILDER, AVIF_QUALITAET, AVIF_AUFWAND, avifHref } from './lib/avif.mjs';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'public', 'assets', 'avif');
await mkdir(OUT, { recursive: true });

const t0 = Date.now();
const einstellungen = (await stat(new URL('./lib/avif.mjs', import.meta.url))).mtimeMs;
let made = 0, skipped = 0, vorher = 0, nachher = 0;
await Promise.all(AVIF_BILDER.map(async (name) => {
  const src = path.join(ROOT, 'assets', name);
  if (!existsSync(src)) throw new Error(`build-avif: Quelle fehlt: assets/${name} (Liste in scripts/lib/avif.mjs)`);
  const out = path.join(ROOT, 'public', avifHref(`/assets/${name}`));
  const s = await stat(src);
  if (existsSync(out) && (await stat(out)).mtimeMs >= Math.max(s.mtimeMs, einstellungen)) {
    skipped++;
  } else {
    await sharp(src).avif({ quality: AVIF_QUALITAET, effort: AVIF_AUFWAND }).toFile(out);
    made++;
  }
  const n = (await stat(out)).size; // erst lesen, dann addieren: += über ein await verliert Summanden
  vorher += s.size;
  nachher += n;
}));
console.log(`build-avif: ${AVIF_BILDER.length} Bilder (${made} neu, ${skipped} aktuell), ${(vorher / 1024).toFixed(0)} KB → ${(nachher / 1024).toFixed(0)} KB, ${Date.now() - t0} ms`);
