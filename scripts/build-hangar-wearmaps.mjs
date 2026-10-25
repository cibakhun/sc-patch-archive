// Abnutzungskarten (TexSlot11) aller Materialien des Gerätekatalogs als
// public/hangar/props/schichten/<Dateiname>.webp, ≤ 256 px
// (.planning/notes/hangar-schichten.md, S1). Name wie die Karten der Schichten:
// Dateiname der Spielkarte, klein, Endung .webp. Vorhandene bleiben.
//
// Usage: node scripts/build-hangar-wearmaps.mjs
import { readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const STARBREAKER = process.env.SC_STARBREAKER ?? 'G:/Projects/games/Star Citizen/tools/starbreaker-cli/starbreaker.exe';
const P4K = process.env.SC_P4K ?? 'F:/Games/Star Citizen/StarCitizen/LIVE/Data.p4k';
const KAT = fileURLToPath(new URL('../public/hangar/props/katalog.json', import.meta.url));
const OUT = fileURLToPath(new URL('../public/hangar/props/schichten/', import.meta.url));
const TMP = fileURLToPath(new URL('../.cache/hangar-src/wear-tmp/', import.meta.url));
mkdirSync(TMP, { recursive: true });

const kat = JSON.parse(readFileSync(KAT, 'utf8'));
const maps = new Map();
for (const [name, m] of Object.entries(kat.materials || {})) {
  const p = m.textures?.TexSlot11;
  if (!p || /^\$/.test(p)) continue;
  const stem = p.replace(/\\/g, '/').split('/').pop().replace(/\.(tif|dds|png)$/i, '').toLowerCase();
  if (!maps.has(stem)) maps.set(stem, { path: p, users: [] });
  maps.get(stem).users.push(name);
}
let made = 0, had = 0, failed = [];
for (const [stem, { path }] of maps) {
  const out = `${OUT}${stem}.webp`;
  if (existsSync(out)) { had++; continue; }
  const png = `${TMP}${stem}.png`;
  const r = spawnSync(STARBREAKER, ['dds', 'decode', `Data/${path.replace(/^data[\\/]/i, '').replace(/\.(tif|png)$/i, '.dds')}`, png, '--mip', '1', '--p4k', P4K], { encoding: 'utf8' });
  if (r.status !== 0 || !existsSync(png)) { failed.push(`${stem}: ${r.error?.message ?? (r.stderr || r.stdout || '').trim().split('\n').pop()}`); continue; }
  try { await sharp(readFileSync(png)).resize(256, 256, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82, alphaQuality: 90 }).toFile(out); } catch (e) { failed.push(`${stem}: ${e.message}`); continue; }
  made++;
}
rmSync(TMP, { recursive: true, force: true });
console.log(`Abnutzungskarten: ${maps.size} genannt, ${had} lagen schon, ${made} neu, ${failed.length} fehlen`);
for (const f of failed) console.log(`  fehlt: ${f}`);
