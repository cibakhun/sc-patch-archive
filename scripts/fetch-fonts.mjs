// fetch-fonts.mjs — holt die Webfonts einmalig von Google Fonts und legt sie
// lokal ab (assets/fonts/*.woff2 + assets/fonts.css). Die Site lädt danach
// KEINE Ressourcen mehr von fonts.googleapis.com/fonts.gstatic.com
// (DSGVO: keine IP-Übertragung an Google; LG München I, 3 O 17493/20).
//
// Nur latin + latin-ext Subsets (Site ist DE/EN). Deterministische Dateinamen.
// Aufruf: node scripts/fetch-fonts.mjs   (einmalig bzw. bei Font-Änderungen)
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'assets', 'fonts');
const OUT_CSS = resolve(__dirname, '..', 'assets', 'fonts.css');
mkdirSync(OUT_DIR, { recursive: true });

// Familien der Hauptseite (Layout.astro) + der Onepager (Share Tech Mono, Teko).
const CSS2 = 'https://fonts.googleapis.com/css2?' + [
  'family=Orbitron:wght@500;700;900',
  'family=Rajdhani:wght@500;600;700',
  'family=Barlow:wght@400;500;600',
  'family=Share+Tech+Mono',
  'family=Teko:wght@400;600',
].join('&') + '&display=swap';

// Moderner UA -> Google liefert woff2 mit unicode-range-Blöcken
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const css = await fetch(CSS2, { headers: { 'User-Agent': UA } }).then((r) => {
  if (!r.ok) throw new Error(`css2 HTTP ${r.status}`);
  return r.text();
});

// Blöcke parsen: /* subset */ @font-face { ... url(...) ... }
const blocks = [...css.matchAll(/\/\*\s*([a-z-]+)\s*\*\/\s*(@font-face\s*\{[\s\S]*?\})/g)];
const KEEP = new Set(['latin', 'latin-ext']);
let out = `/* Selbst gehostete Webfonts (generiert via scripts/fetch-fonts.mjs).\n   Quelle: Google Fonts (OFL/Apache-lizenziert) — lokal ausgeliefert, kein CDN. */\n`;
let files = 0;
const seen = new Set();
for (const [, subset, block] of blocks) {
  if (!KEEP.has(subset)) continue;
  const family = /font-family:\s*'([^']+)'/.exec(block)?.[1];
  const weight = /font-weight:\s*(\d+)/.exec(block)?.[1] ?? '400';
  const url = /url\((https:[^)]+\.woff2)\)/.exec(block)?.[1];
  if (!family || !url) continue;
  const slug = family.toLowerCase().replace(/\s+/g, '-');
  const fname = `${slug}-${weight}-${subset}.woff2`;
  if (!seen.has(fname)) {
    seen.add(fname);
    const buf = Buffer.from(await fetch(url, { headers: { 'User-Agent': UA } }).then((r) => r.arrayBuffer()));
    writeFileSync(resolve(OUT_DIR, fname), buf);
    files++;
  }
  out += '\n/* ' + family + ' ' + weight + ' ' + subset + ' */\n' +
    block.replace(/url\(https:[^)]+\.woff2\)/, `url(/assets/fonts/${fname})`) + '\n';
}

writeFileSync(OUT_CSS, out);
console.log(`OK: ${files} woff2 -> assets/fonts/, CSS -> assets/fonts.css`);
