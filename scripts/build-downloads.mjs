// Build-Schritt für den Download-Bereich.
// -----------------------------------------------------------------------------
// Erzeugt aus den mehrteiligen Onepager-Guides (public/onepager/<slug>/) je EINE
// selbst-enthaltene HTML-Datei unter public/downloads/onepager-<slug>.html:
// alle lokalen Bild-Assets (assets/…) werden als Base64-Data-URIs eingebettet,
// sodass die Datei per Doppelklick offline öffnet — ohne Entpacken, ohne
// Nebendateien. Absolute /assets/-Verweise (z. B. fonts.css) werden auf die
// Produktions-URL umgeschrieben, damit die Webfonts online noch laden und
// offline sauber auf System-Schriften zurückfallen.
//
// Läuft VOR `astro dev`/`astro build` (siehe package.json), nach _sync-assets.
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ONEPAGER_DIR = path.join(ROOT, 'public', 'onepager');
const OUT_DIR = path.join(ROOT, 'public', 'downloads');
// Produktions-Basis für absolute /assets/-Verweise (Webfonts). Bei Domain-
// wechsel hier + in src/consts.ts / astro.config.mjs anpassen.
const PROD_BASE = 'https://versebase.space';

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

async function toDataUri(absPath) {
  const ext = path.extname(absPath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  const buf = await readFile(absPath);
  return `data:${mime};base64,${buf.toString('base64')}`;
}

// Ein relativer Onepager-HTML-String -> selbst-enthaltener String.
async function inlineOnepager(slug, html, dir) {
  // relative "assets/<file>"-Verweise (src=, href=, url()) — NICHT "/assets/…"
  // (absolut, negativer Lookbehind auf / und Wortzeichen).
  const rel = /(?<![\/\w])assets\/([A-Za-z0-9._-]+)/g;
  const seen = new Map(); // relPath -> dataURI (einmal pro Datei lesen)
  const targets = new Set();
  let m;
  while ((m = rel.exec(html))) targets.add(m[1]);

  for (const file of targets) {
    const abs = path.join(dir, 'assets', file);
    if (!existsSync(abs)) {
      console.warn(`  ! ${slug}: referenziertes Asset fehlt: assets/${file}`);
      continue;
    }
    seen.set(file, await toDataUri(abs));
  }

  let out = html.replace(rel, (whole, file) => seen.get(file) ?? whole);
  // absolute /assets/… (Fonts) -> Produktions-URL (online laden, offline Fallback)
  out = out.replaceAll('/assets/', `${PROD_BASE}/assets/`);
  return out;
}

async function main() {
  if (!existsSync(ONEPAGER_DIR)) {
    console.log('build-downloads: kein public/onepager — übersprungen');
    return;
  }
  await mkdir(OUT_DIR, { recursive: true });

  const entries = await readdir(ONEPAGER_DIR, { withFileTypes: true });
  const slugs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  let built = 0;
  for (const slug of slugs) {
    const dir = path.join(ONEPAGER_DIR, slug);
    const indexPath = path.join(dir, 'index.html');
    if (!existsSync(indexPath)) continue;
    const html = await readFile(indexPath, 'utf8');
    const inlined = await inlineOnepager(slug, html, dir);
    const outPath = path.join(OUT_DIR, `onepager-${slug}.html`);
    await writeFile(outPath, inlined, 'utf8');
    const { size } = await stat(outPath);
    console.log(`  ✓ onepager-${slug}.html (${(size / 1024).toFixed(0)} KB)`);
    built++;
  }
  console.log(`build-downloads: ${built} Onepager eingebettet -> public/downloads/`);
}

main().catch((err) => {
  console.error('build-downloads fehlgeschlagen:', err);
  process.exit(1);
});
