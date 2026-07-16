// build-og.mjs — erzeugt das site-weite Social-Preview-Fallback (og-default.jpg).
//
// Seiten ohne eigenes ogImage (Startseite, Utility-Seiten, Missions-Details)
// bekommen dieses Bild über den Layout-Fallback (SITE.ogDefault). 1200×630 ist
// das Standardformat für og:image / twitter:card "summary_large_image".
//
// Quelle ist das Hero-Standbild der Startseite — die visuelle Identität der
// Site. Das Ergebnis wird EINGECHECKT (kein Build-Schritt): es ändert sich nur,
// wenn jemand bewusst dieses Skript mit neuer Quelle laufen lässt.
//
// Aufruf: node scripts/build-og.mjs
import sharp from 'sharp';
import { statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(root, 'assets/t-polaris-5.jpg');
const OUT = resolve(root, 'assets/og-default.jpg');

await sharp(SRC)
  .resize(1200, 630, { fit: 'cover', position: 'attention' })
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(OUT);

const meta = await sharp(OUT).metadata();
console.log(`assets/og-default.jpg: ${meta.width}x${meta.height}, ${(statSync(OUT).size / 1024).toFixed(0)} KB`);
