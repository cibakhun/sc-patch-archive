// Sonde: Laesst sich eine Waffe im 3D-Hangar wirklich tauschen?
//
// Die Web-Modelle (public/hangar/ships/*.glb) tragen die Serienwaffen im
// Rumpf: build-hangar-assets.mjs legt mit flatten()+join() alles zu wenigen
// Teilen zusammen. Fuer einen echten Tausch braucht es zweierlei, und genau
// das prueft diese Sonde, bevor jemand eine Pipeline darauf baut:
//
//   A  Haelt der ROHE Schiffsexport (.cache/hangar-src/ships/<slug>.glb) die
//      Hardpoints als Knoten, unter denen die Serienwaffe als eigener
//      Teilbaum haengt? Dann kann der Build sie getrennt lassen und der
//      Viewer sie ausblenden.
//   B  Laesst sich eine einzelne Waffe per `entity export` als eigenes Modell
//      holen, und wo liegt ihr Befestigungspunkt (Ursprung, Bounding Box)?
//
// Nur lokal (wie extract-hangar-sources.mjs): braucht StarBreaker + Data.p4k
// fuer B und den Rohexport aus `node scripts/extract-hangar-sources.mjs ships`
// fuer A. Schreibt nur in den gitignorierten Cache, nie in den Arbeitsbaum.
//
//   node scripts/probes/hangar-waffentausch.mjs [--ship aegs-gladius] [--gun ndb-30-repeater]
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import draco3d from 'draco3d';
import { openP4k, DEFAULT_P4K } from '../lib/p4k.mjs';
import { openDataCore } from '../lib/datacore.mjs';

const argv = process.argv.slice(2);
const flag = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const SHIP = flag('--ship', 'aegs-gladius');
const GUN = flag('--gun', 'ndb-30-repeater');
const STARBREAKER = process.env.SC_STARBREAKER ?? 'G:/Projects/games/Star Citizen/tools/starbreaker-cli/starbreaker.exe';
const P4K = DEFAULT_P4K;
const SRC = fileURLToPath(new URL('../../.cache/hangar-src/', import.meta.url));
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
});
const tris = (node) => {
  let t = 0;
  node.traverse((n) => {
    for (const p of n.getMesh()?.listPrimitives() ?? []) {
      const idx = p.getIndices();
      t += (idx ? idx.getCount() : p.getAttribute('POSITION').getCount()) / 3;
    }
  });
  return t;
};
const r3 = (v) => v.map((x) => Math.round(x * 1000) / 1000);

/* ---- A: Hardpoints im rohen Schiffsexport ---- */
console.log(`\n== A  Rohexport ${SHIP} ==`);
const raw = `${SRC}ships/${SHIP}.glb`;
if (!existsSync(raw)) {
  console.log(`  fehlt: ${raw}\n  erst: node scripts/extract-hangar-sources.mjs ships --ships ${SHIP}`);
} else {
  const doc = await io.read(raw);
  const nodes = doc.getRoot().listNodes();
  const total = doc.getRoot().listScenes().reduce((s, sc) => s + sc.listChildren().reduce((a, n) => a + tris(n), 0), 0);
  const hps = nodes.filter((n) => /^hardpoint_/i.test(n.getName()));
  console.log(`  Knoten ${nodes.length}, Dreiecke ${total}, Hardpoint-Knoten ${hps.length}`);
  const loadouts = JSON.parse(readFileSync(`${ROOT}src/data/ship-loadouts.json`, 'utf8'));
  const stock = (loadouts.ships ?? loadouts)[SHIP] ?? {};
  for (const hp of hps) {
    const kids = [];
    hp.traverse((n) => { if (n !== hp && n.getName()) kids.push(n.getName()); });
    const t = tris(hp);
    const want = stock[hp.getName()]?.map((x) => x.cls).join(', ') ?? '';
    console.log(`  ${hp.getName().padEnd(40)} ${String(t).padStart(7)} Dreiecke  ${String(kids.length).padStart(3)} Unterknoten  ${want ? `Serie: ${want}` : ''}`);
    if (t && kids.length) console.log(`      ${kids.slice(0, 6).join(' | ')}${kids.length > 6 ? ' …' : ''}`);
  }
  if (!hps.length) console.log('  kein Knoten heisst hardpoint_* — die Namen der obersten Ebene:\n  ' + doc.getRoot().listScenes()[0].listChildren().slice(0, 30).map((n) => n.getName()).join(' | '));
}

/* ---- B: eine Waffe als eigenes Modell ---- */
console.log(`\n== B  Einzelexport ${GUN} ==`);
const items = JSON.parse(readFileSync(`${ROOT}assets/universal-items.json`, 'utf8'));
const list = Array.isArray(items) ? items : items.items ?? Object.values(items);
const item = list.find((x) => x.id === GUN);
if (!item?.game?.guid) { console.log(`  ${GUN}: kein Item mit guid in universal-items.json`); process.exit(0); }
if (!existsSync(STARBREAKER) || !existsSync(P4K)) { console.log('  StarBreaker oder Data.p4k fehlt (SC_STARBREAKER / SC_P4K setzen)'); process.exit(0); }
const p4k = openP4k(P4K);
const db = openDataCore(p4k.read(/^Data[\\/]Game2\.dcb$/i));
p4k.close();
const rec = db.recordById.get(item.game.guid);
const stem = rec?.name?.replace(/^EntityClassDefinition\./, '');
console.log(`  ${item.name}  guid ${item.game.guid}  ->  ${stem ?? 'kein Record'}`);
if (!stem) process.exit(0);
const out = `${SRC}weapons/${GUN}.glb`;
mkdirSync(`${SRC}weapons`, { recursive: true });
const t0 = Date.now();
const r = spawnSync(STARBREAKER, ['entity', 'export', stem, out, '--materials', 'textures', '--mip', '1', '--lod', '1', '--p4k', P4K], { encoding: 'utf8', maxBuffer: 256 << 20 });
if (r.status !== 0) { console.log(`  Export scheitert: ${(r.stderr || r.stdout).trim().split('\n').slice(-3).join(' | ')}`); process.exit(0); }
const wd = await io.read(out);
const scene = wd.getRoot().listScenes()[0];
const wt = scene.listChildren().reduce((a, n) => a + tris(n), 0);
const b = getBounds(scene);
console.log(`  ok in ${((Date.now() - t0) / 1000).toFixed(0)} s: ${wd.getRoot().listNodes().length} Knoten, ${wt} Dreiecke, ${wd.getRoot().listTextures().length} Texturen`);
console.log(`  Bounding Box min ${r3(b.min)}  max ${r3(b.max)}  (Ursprung = Befestigungspunkt?)`);
console.log(`  oberste Knoten: ${scene.listChildren().map((n) => `${n.getName()} @${r3(n.getTranslation())}`).join(' | ')}`);
