/* ============================================================
   measure-hangar-inseln.mjs — Lose Teile am Rumpf

   Anlass: Krisz, 30.10.2026: „jedes schiff soll komplett angeschaut
   werden, innen und aussen“. Beim Ansehen aller Rümpfe fielen Teile auf,
   die frei in der Luft hängen: die Flügelwaffen der Hornets gut einen
   Meter neben der Flügelspitze, ein Feuerlöscherschrank über dem
   Avenger, kleine Teile unter 300i/315p/325a/350r und eines 32 m neben
   der 325a. Notiz: .planning/notes/hangar-inseln.md.

   Rechnung: Alle Dreiecke werden gerastert (Voxel 0,5 m, bei großen
   Schiffen gröber). Zellen, die höchstens GAP (1 m) auseinanderliegen,
   gehören zusammen. Der größte Verbund ist der Rumpf; jeder andere ist
   eine Insel. Gemeldet wird eine Insel, wenn sie außerhalb des
   Hüllquaders des Rumpfs liegt. Inseln im Rumpf (Kraftwerke, Kühler,
   Relais in ihren Schächten) sind gewollt und zählen nur mit
   --alle-inseln.

   Werkzeug (gate-registry: rail null):

     node scripts/measure-hangar-inseln.mjs [slug ...|all] [--json datei] [--alle-inseln]
       Web-Fassung: public/hangar/ships/<slug>.glb (all = alle Schiffe im Manifest)
     node scripts/measure-hangar-inseln.mjs --roh <rohexport.glb> [--mit-ausgeblendet] [--json datei]
       Rohexport (PC): Rumpf = alles außer den Containern interior_* (ohne
       Schild, Proxy, Kollision, Schaden); --mit-ausgeblendet nimmt diese
       dazu, um zu sehen, ob der Bau ein verbindendes Teil weglässt. Je
       Insel die Knoten mit ihrem Pfad unter der Schiffswurzel.
   ============================================================ */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readGeometry, sceneNodes, islands } from './lib/hangar-lage.mjs';
import { hiddenMaterial } from '../assets/hangar-viewer.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const take = (k) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : null; };
const jsonFile = take('--json');
const rohFile = take('--roh');
const ALLE = args.includes('--alle-inseln');
const MIT_AUS = args.includes('--mit-ausgeblendet');
const slugsArg = args.filter((a) => !a.startsWith('--'));
if (!rohFile && !slugsArg.length) { console.error('node scripts/measure-hangar-inseln.mjs [slug ...|all] [--json datei] [--alle-inseln] | --roh <rohexport.glb> [--mit-ausgeblendet]'); process.exit(2); }

// Rechnung: scripts/lib/hangar-lage.mjs (dieselbe wie im Tor verify:hangar-lage).
// Web-Fassung wie der Viewer: nur Knoten der Szene, ohne was er verbirgt (hiddenMaterial).
const verborgen = (name) => !!hiddenMaterial(name);

const fmt = (c) => `${String(c.tris).padStart(6)} Dr.  ${String(c.aussenM).padStart(5)} m außen  ${c.min.join('/')} .. ${c.max.join('/')}  ${c.innenraum === 'nein' ? '' : `Innenraum ${c.innenraum}  `}${c.materialien[0]}`;
const result = {};
const t0 = Date.now();
if (rohFile) {
  const doc = await readGeometry(rohFile);
  const JUNK = /shield|proxy|collision|damage|nodraw|_lod[1-9]/i;
  const parent = new Map();
  const hull = [];
  for (const scene of doc.getRoot().listScenes()) for (const top of scene.listChildren()) for (const c of top.listChildren()) {
    if (/^interior_/i.test(c.getName())) continue;
    c.traverse((n) => {
      for (const ch of n.listChildren()) parent.set(ch, n);
      const m = n.getMesh();
      if (m && (MIT_AUS || !JUNK.test(`${n.getName()} ${m.listPrimitives()[0]?.getMaterial()?.getName() ?? ''}`))) hull.push(n);
    });
  }
  const pathOf = (n) => { const p = []; for (let x = n; x; x = parent.get(x)) p.unshift(x.getName()); return p.join('/'); };
  const r = islands(hull, { pathOf, alle: ALLE });
  if (!r) { console.error('kein Rumpf im Rohexport'); process.exit(1); }
  result[rohFile] = r;
  console.log(`${rohFile}: ${r.tris} Dr., Voxel ${r.voxel} m, ${r.inseln.length} ${ALLE ? 'Inseln' : 'Inseln außerhalb'}${MIT_AUS ? ' (mit ausgeblendeten Teilen)' : ''}`);
  for (const c of r.inseln) { console.log(`  ${fmt(c)}`); for (const k of c.knoten) console.log(`      ${k}`); }
} else {
  const man = JSON.parse(readFileSync(`${ROOT}src/data/hangar-assets.json`, 'utf8'));
  const slugs = slugsArg[0] === 'all' ? Object.keys(man.ships).sort() : slugsArg;
  for (const slug of slugs) {
    const f = `${ROOT}public/hangar/ships/${slug}.glb`;
    if (!existsSync(f)) { console.log(`${slug}: Rumpf fehlt`); continue; }
    const r = islands(sceneNodes(await readGeometry(f)), { alle: ALLE, verborgen });
    if (!r) { console.log(`${slug}: leer`); continue; }
    result[slug] = r;
    if (!r.inseln.length) continue;
    console.log(`${slug}  (${r.tris} Dr.)`);
    for (const c of r.inseln) console.log(`  ${fmt(c)}`);
  }
  const all = Object.values(result);
  console.log(`\n${all.length} Rümpfe geprüft in ${Math.round((Date.now() - t0) / 1000)} s; mit ${ALLE ? 'Inseln' : 'losen Teilen außerhalb des Rumpfs'}: ${all.filter((r) => r.inseln.length).length}`);
}
if (jsonFile) writeFileSync(jsonFile, JSON.stringify(result, null, 1));
