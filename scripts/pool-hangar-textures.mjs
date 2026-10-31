// Stellt fertige Schiffs-GLBs auf die gemeinsame Texturablage um, ohne sie neu
// zu bauen (der Bau macht das seit 25.10.2026 selbst, scripts/build-hangar-assets.mjs).
// Verlustfrei: Bildbytes, Geometrie und Knoten bleiben gleich, nur die Bilder
// wandern nach public/hangar/tex/<inhalt>.<endung>. Danach trägt das Manifest
// je Schiff die neue Version (?v=, sha1 über das GLB wie im Bau), die Bytes
// des GLB und den Anteil an der Ablage; Bilder ohne Schiff fliegen raus.
//
// Usage: node scripts/pool-hangar-textures.mjs [--dry]
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { poolGlb, prunePool } from './lib/glb-texpool.mjs';

const DRY = process.argv.includes('--dry');
const ROOT = fileURLToPath(new URL('../public/hangar/', import.meta.url));
const SHIPS = join(ROOT, 'ships'), POOL = join(ROOT, 'tex');
const MANIFEST = fileURLToPath(new URL('../src/data/hangar-assets.json', import.meta.url));
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const mb = (n) => (n / 1048576).toFixed(2);

let before = 0, after = 0, moved = 0, changed = 0;
for (const f of readdirSync(SHIPS).filter((x) => x.endsWith('.glb')).sort()) {
  const slug = f.slice(0, -4), file = join(SHIPS, f);
  const buf = readFileSync(file);
  const r = poolGlb(buf, { poolDir: DRY ? join(ROOT, '.tex-dry') : POOL, uriPrefix: '../tex/' });
  before += r.before; after += r.after; moved += r.images.length;
  const entry = manifest.ships?.[slug];
  if (!entry) { console.log(`  ${slug}: WARNUNG nicht im Manifest, übersprungen`); continue; }
  const share = { images: r.images.length, bytes: r.images.reduce((a, i) => a + i.bytes, 0), fresh: r.images.filter((i) => i.fresh).reduce((a, i) => a + i.bytes, 0) };
  if (r.glb !== buf) {
    changed++;
    if (!DRY) writeFileSync(file, r.glb);
    entry.v = createHash('sha1').update(r.glb).digest('hex').slice(0, 8);
    entry.bytes = r.glb.length;
    entry.pool = share;
  }
  console.log(`  ${slug.padEnd(30)} ${mb(r.before).padStart(6)} -> ${mb(r.after).padStart(6)} MB, ${String(r.images.length).padStart(3)} Bilder ausgelagert, neu in der Ablage ${mb(share.fresh)} MB`);
}
if (DRY) { console.log(`\n  (--dry: nichts geschrieben)`); process.exit(0); }
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
const pr = prunePool(POOL, [SHIPS], '../tex/');
const poolBytes = existsSync(POOL) ? readdirSync(POOL).reduce((a, x) => a + statSync(join(POOL, x)).size, 0) : 0;
console.log(`\n  ${changed} Schiffe umgestellt, ${moved} Bildverweise; GLB ${mb(before)} -> ${mb(after)} MB, Ablage ${pr.used} Bilder ${mb(poolBytes)} MB (${pr.removed.length} verwaiste entfernt); zusammen ${mb(after + poolBytes)} MB`);
