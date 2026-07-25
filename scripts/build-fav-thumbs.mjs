// Erzeugt ein schlankes Slug->Bild-Manifest für die Konto-Favoriten
// (public/assets/ship-thumbs.json). account-dashboard.ts lädt es, um
// Schiff-Favoriten als Poster-Karten mit echtem Schiffbild zu rendern.
// Bildwahl = dieselbe Logik wie die Schiffseite (pickHero): verifizierter
// lokaler Render zuerst, sonst das Wiki-API-Hero-Bild (1280px webp).
// Läuft NACH _sync-assets in der Pipeline und schreibt direkt nach
// public/assets (gitignored, pro Build regeneriert).
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const ROOT = process.cwd();

// aus src/lib/shipRenders.ts gespiegelt (verifizierte lokale Renders)
const RENDERS = {
  polaris: 'img-polaris.jpg', railen: 'img-railen.jpg', tyilui: 'img-tyilui.jpg',
  syulen: 'img-syulen.jpg', guardian: 'img-guardian.jpg', meteor: 'img-meteor.jpg',
  ironclad: 'img-ironclad.jpg', hammerhead: 'img-hammerhead.jpg', perseus: 'img-perseus.jpg',
  hermes: 'img-hermes.jpg', 'idris-m': 'img-idris.jpg', 'apollo triage': 'img-apollo.jpg',
  'apollo medivac': 'img-apollo2.jpg', 'l-21 wolf': 'img-kruger.jpg', paladin: 'img-paladin.jpg',
  prowler: 'img-prowler.jpg', 'aurora mk ii': 'img-aurora.jpg', atls: 'img-atls.jpg',
  mole: 'img-mole.jpg', 'cutlass black': 'img-cutlass.jpg', basher: 'img-basher.jpg',
};
const MAKERS = ['rsi', 'drake', 'aegis', 'anvil', 'mirai', 'gatac', 'argo', 'misc', 'origin', 'crusader', 'esperia', 'kruger', 'banu', 'aopoa', 'vanduul'];
function stripName(name) {
  let n = String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
  for (const m of MAKERS) if (n.startsWith(m + ' ')) n = n.slice(m.length + 1);
  return n;
}

const raw = JSON.parse(await readFile(`${ROOT}/src/data/vehicles.json`, 'utf8'));
const vehicles = Array.isArray(raw) ? raw : raw.vehicles || [];

const map = {};
for (const v of vehicles) {
  if (!v || !v.id) continue;
  const local = RENDERS[stripName(v.name)];
  const url = local ? `/assets/${local}` : (v.image && (v.image.hero || v.image.thumb)) || null;
  if (url) map[v.id] = url;
}

await mkdir(`${ROOT}/public/assets`, { recursive: true });
await writeFile(`${ROOT}/public/assets/ship-thumbs.json`, JSON.stringify(map), 'utf8');
console.log(`build-fav-thumbs: ${Object.keys(map).length} Schiffbilder -> public/assets/ship-thumbs.json`);
