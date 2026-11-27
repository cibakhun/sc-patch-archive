// Stellt fertige Schiffs-GLBs auf die gemeinsame Texturablage um, ohne sie neu
// zu bauen (der Bau macht das seit 25.10.2026 selbst, scripts/build-hangar-assets.mjs).
// Verlustfrei: Bildbytes, Geometrie und Knoten bleiben gleich, nur die Bilder
// wandern nach public/hangar/tex/<inhalt>.<endung>. Danach trägt das Manifest
// je Schiff die neue Version (?v=, sha1 über das GLB wie im Bau), die Bytes
// des GLB und den Anteil an der Ablage; Bilder ohne Schiff fliegen raus.
// Seit 27.11.2026 ebenso die Hallen fester Größe (HALL_ABLAGE in
// scripts/lib/glb-texpool.mjs): ihre Version wie im Bau über GLB, Lampen und
// Bahnen des Aufzugs.
//
// Usage: node scripts/pool-hangar-textures.mjs [--dry]
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { poolGlb, prunePool, HALL_ABLAGE } from './lib/glb-texpool.mjs';

const DRY = process.argv.includes('--dry');
const ROOT = fileURLToPath(new URL('../public/hangar/', import.meta.url));
const SHIPS = join(ROOT, 'ships'), HALLS = join(ROOT, 'hall'), POOL = join(ROOT, 'tex');
const MANIFEST = fileURLToPath(new URL('../src/data/hangar-assets.json', import.meta.url));
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const mb = (n) => (n / 1048576).toFixed(2);
const share = (r) => ({ images: r.images.length, bytes: r.images.reduce((a, i) => a + i.bytes, 0), fresh: r.images.filter((i) => i.fresh).reduce((a, i) => a + i.bytes, 0) });

let before = 0, after = 0, moved = 0, changed = 0;
// file: GLB; entry: Eintrag im Manifest; version(glb): ?v= wie im Bau
function umstellen(label, file, entry, version) {
  const buf = readFileSync(file);
  const r = poolGlb(buf, { poolDir: DRY ? join(ROOT, '.tex-dry') : POOL, uriPrefix: '../tex/' });
  before += r.before; after += r.after; moved += r.images.length;
  const s = share(r);
  if (r.glb !== buf) {
    changed++;
    if (!DRY) writeFileSync(file, r.glb);
    entry.v = version(r.glb);
    entry.bytes = r.glb.length;
    entry.pool = s;
  }
  console.log(`  ${label.padEnd(30)} ${mb(r.before).padStart(6)} -> ${mb(r.after).padStart(6)} MB, ${String(r.images.length).padStart(3)} Bilder ausgelagert, neu in der Ablage ${mb(s.fresh)} MB`);
}

for (const f of readdirSync(SHIPS).filter((x) => x.endsWith('.glb')).sort()) {
  const slug = f.slice(0, -4), entry = manifest.ships?.[slug];
  if (!entry) { console.log(`  ${slug}: WARNUNG nicht im Manifest, übersprungen`); continue; }
  umstellen(slug, join(SHIPS, f), entry, (glb) => createHash('sha1').update(glb).digest('hex').slice(0, 8));
}
for (const key of [...HALL_ABLAGE].sort()) {
  const file = join(HALLS, `${key}.glb`), entry = manifest.hall?.[key];
  if (!existsSync(file) || !entry) { console.log(`  ${key}: WARNUNG ${entry ? 'GLB fehlt' : 'nicht im Manifest'}, übersprungen`); continue; }
  // Reihenfolge wie scripts/build-hangar-assets.mjs: GLB, Lampen, Bahnen des Aufzugs
  const lights = join(HALLS, `${key}.lights.json`), aufzug = entry.aufzug?.json ? join(ROOT, entry.aufzug.json.replace(/^\/hangar\//, '')) : null;
  umstellen(`Halle ${key}`, file, entry, (glb) => {
    const h = createHash('sha1').update(glb);
    if (existsSync(lights)) h.update(readFileSync(lights));
    if (aufzug && existsSync(aufzug)) h.update(readFileSync(aufzug));
    return h.digest('hex').slice(0, 8);
  });
}
if (DRY) { console.log(`\n  (--dry: nichts geschrieben)`); process.exit(0); }
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
// Was noch auf die Ablage zeigt: Schiffe, Innenräume, Komponenten und Hallen
// (wie der Bau). Bis 27.11.2026 nur die Schiffe: Ein Lauf hätte die Bilder
// entfernt, die nur ein Innenraum oder eine Komponente nennt.
const pr = prunePool(POOL, ['ships', 'interior', 'components', 'hall'].map((d) => join(ROOT, d)), '../tex/');
const poolBytes = existsSync(POOL) ? readdirSync(POOL).reduce((a, x) => a + statSync(join(POOL, x)).size, 0) : 0;
console.log(`\n  ${changed} Dateien umgestellt, ${moved} Bildverweise; GLB ${mb(before)} -> ${mb(after)} MB, Ablage ${pr.used} Bilder ${mb(poolBytes)} MB (${pr.removed.length} verwaiste entfernt); zusammen ${mb(after + poolBytes)} MB`);
