// Thumbnail-Build für den Download-Bereich.
// -----------------------------------------------------------------------------
// Erzeugt kleine WebP-Vorschauen aller Top-Level-Bilder in public/assets nach
// public/assets/thumb/<name>.webp. Die Download-Galerie lädt diese Thumbs statt
// der Vollbilder (167 Vollbilder = zweistellige MB, die die Seite zum Hängen
// bringen). Der Download-Link selbst zeigt weiter aufs Original.
//
// Läuft nach _sync-assets, vor build-downloads/astro (siehe package.json).
// Cache: Freshness wird gegen die KANONISCHE Quelle (assets/<name>) geprüft,
// nicht gegen public/assets — letzteres bekommt bei jedem `cp` eine neue mtime
// (kein preserveTimestamps), was den Cache sonst wertlos machen würde.
import sharp from 'sharp';
import { readdir, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'public', 'assets');
const CANON = path.join(ROOT, 'assets');
const OUT = path.join(SRC, 'thumb');

// SVG ist Vektor (winzig) -> kein Thumbnail nötig, Original wird direkt genutzt.
const RASTER = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const WIDTH = 480; // reicht für 180-px-Kacheln @2x, klein genug für schnelle Ladung

async function freshMtime(name) {
  // Stabile Quelle bevorzugen (assets/), sonst public/assets.
  const canon = path.join(CANON, name);
  const src = existsSync(canon) ? canon : path.join(SRC, name);
  return (await stat(src)).mtimeMs;
}

async function main() {
  if (!existsSync(SRC)) {
    console.log('build-thumbs: kein public/assets — übersprungen');
    return;
  }
  await mkdir(OUT, { recursive: true });

  const files = (await readdir(SRC, { withFileTypes: true }))
    .filter((e) => e.isFile() && RASTER.has(path.extname(e.name).toLowerCase()))
    .map((e) => e.name);

  let made = 0;
  let skipped = 0;
  for (const f of files) {
    const src = path.join(SRC, f);
    const out = path.join(OUT, f.replace(/\.[^.]+$/, '') + '.webp');
    try {
      if (existsSync(out)) {
        const [srcM, outM] = await Promise.all([freshMtime(f), stat(out)]);
        if (outM.mtimeMs >= srcM) {
          skipped++;
          continue;
        }
      }
      await sharp(src)
        .resize({ width: WIDTH, withoutEnlargement: true })
        .webp({ quality: 72 })
        .toFile(out);
      made++;
    } catch (err) {
      console.warn(`  ! Thumbnail fehlgeschlagen: ${f} — ${err.message}`);
    }
  }
  console.log(`build-thumbs: ${made} erzeugt, ${skipped} aktuell -> public/assets/thumb/`);
}

main().catch((err) => {
  console.error('build-thumbs fehlgeschlagen:', err);
  process.exit(1);
});
