/* ============================================================
   measure-hangar-innenlage.mjs — Sitzt der Innenraum im Rumpf?

   Anlass: Krisz, 30.10.2026: „am ende sollen innenräüme auch dabei sein,
   und jedes schiff soll komplett angeschaut werden, innen und aussen“.
   Röntgenbilder der begehbaren Innenräume (#263) zeigten bei Cutlass,
   Hammerhead, Carrack, Vanguard und anderen Innenräume, die oben oder
   hinten aus dem Rumpf ragen. Der Hüllquader-Test des Baus (inHull) sieht
   das nicht. Notiz: .planning/notes/hangar-innenlage.md.

   Rechnung: Der Rumpf wird gerastert (Voxel 0,2 m, bei großen Schiffen
   gröber, Fläche um ein Voxel verdickt). Auf jeder Geraden längs X, Y
   und Z zählt die Spanne vom ersten bis zum letzten Rumpf-Voxel. Ein
   Dreieck des Innenraums liegt außen, wenn sein Mittelpunkt auf mindestens
   zwei Achsen mindestens 0,4 m jenseits der Spanne liegt. Eine offene Tür
   kostet so nur eine Achse; was oben, seitlich oder hinten aus dem Rumpf
   ragt, kostet zwei oder drei. Was in einer Mulde außen am Rumpf liegt,
   sieht die Rechnung nicht: die Röntgenbilder bleiben nötig.

   Werkzeug (gate-registry: rail null):

     node scripts/measure-hangar-innenlage.mjs [slug ...|all] [--json datei] [--versatz]
       Web-Fassung: public/hangar/ships/<slug>.glb gegen
       public/hangar/interior/<slug>.glb (all = alle Innenräume im Manifest)
     node scripts/measure-hangar-innenlage.mjs --roh <rohexport.glb> [--json datei] [--versatz]
       Rohexport (PC): Rumpf = alles außer den Containern interior_* (ohne
       Schild, Proxy, Kollision, Schaden), Bericht je Container

   --versatz sucht je Innenraum (Web) oder je Container (roh) den
   Versatz bis 4 m, mit dem am wenigsten außen liegt.

   Pilotensitz (Web: spots aus dem Manifest, roh: hardpoint_*seat*, Pilot
   zuerst): ✓, wenn mindestens 20 Dreiecksmitten des Innenraums bis 1,5 m
   um ihn liegen. Ein Container, der 8 m neben dem Cockpit noch im Rumpf
   liegt, besteht die Spannen und reißt hier. Dazu, was der Blick aus 0,8 m
   Kopfhöhe senkrecht nach oben bis 4 m trifft (Glas, Rumpf oder frei; frei
   ist bei offenen Fahrzeugen richtig, sonst ansehen).
   ============================================================ */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readGeometry, sceneNodes, hullSpans, judge, seatCheck, seatLine, pickSeat, r2, OBEN_M } from './lib/hangar-lage.mjs';
import { isDamageMesh } from '../assets/hangar-viewer.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const take = (k) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : null; };
const jsonFile = take('--json');
const rohFile = take('--roh');
const VERSATZ = args.includes('--versatz');
const slugsArg = args.filter((a) => !a.startsWith('--'));
if (!rohFile && !slugsArg.length) { console.error('node scripts/measure-hangar-innenlage.mjs [slug ...|all] [--json datei] [--versatz] | --roh <rohexport.glb>'); process.exit(2); }

// Rechnung: scripts/lib/hangar-lage.mjs (dieselbe wie im Tor verify:hangar-lage).
// Web-Fassung wie der Viewer: nur Knoten der Szene, ohne Schadensnetze.
const verborgen = isDamageMesh;

const result = {};
const t0 = Date.now();
if (rohFile) {
  const doc = await readGeometry(rohFile);
  const containers = [];
  const hull = [];
  const JUNK = /shield|proxy|collision|damage|nodraw|_lod[1-9]/i;
  for (const scene of doc.getRoot().listScenes()) for (const top of scene.listChildren()) for (const c of top.listChildren()) {
    if (/^interior_/i.test(c.getName())) { containers.push(c); continue; }
    c.traverse((n) => { const m = n.getMesh(); if (m && !JUNK.test(`${n.getName()} ${m.listPrimitives()[0]?.getMaterial()?.getName() ?? ''}`)) hull.push(n); });
  }
  const spans = hullSpans(hull);
  if (!spans) { console.error('kein Rumpf im Rohexport'); process.exit(1); }
  console.log(`${rohFile}: Rumpf ${spans.size.map(r2).join(' x ')} m, Voxel ${r2(spans.vox)} m, ${containers.length} Container`);
  for (const c of containers) {
    const nodes = []; c.traverse((n) => n.getMesh() && nodes.push(n));
    const r = { ...judge(spans, nodes, { versatz: VERSATZ }), t: c.getTranslation().map(r2), r: c.getRotation().map((v) => Math.round(v * 1e4) / 1e4), s: c.getScale().map(r2) };
    result[c.getName()] = r;
    console.log(`  ${c.getName().padEnd(48)} ${String(r.tris).padStart(8)} Dr.  außen ${String(r.aussenPct).padStart(6)} % (bis ${r.maxM} m)  t ${r.t.join(' ')}  r ${r.r.join(' ')}${r.versatz ? `  Versatz ${r.versatz.join(' ')} -> ${r.mitVersatzPct} %` : ''}`);
  }
  const seats = doc.getRoot().listNodes().filter((n) => /^hardpoint_.*?seat/i.test(n.getName()) && !/access/i.test(n.getName()))
    .map((n) => { const m = n.getWorldMatrix(); return { name: n.getName(), p: [m[12], m[13], m[14]] }; });
  const seat = pickSeat(seats);
  const inner = []; for (const c of containers) c.traverse((n) => n.getMesh() && inner.push(n));
  const box = (n) => { for (let p = n; p; p = p.getParentNode()) if (containers.includes(p)) return p.getName(); return null; };
  if (seat) result._sitz = seatCheck(seat, inner, hull, { label: box });
  console.log(`  ${seatLine(result._sitz)}`);
} else {
  const man = JSON.parse(readFileSync(`${ROOT}src/data/hangar-assets.json`, 'utf8'));
  const slugs = slugsArg[0] === 'all' ? Object.keys(man.interior ?? {}).sort() : slugsArg;
  for (const slug of slugs) {
    const hullF = `${ROOT}public/hangar/ships/${slug}.glb`, inF = `${ROOT}public/hangar/interior/${slug}.glb`;
    if (!existsSync(hullF) || !existsSync(inF)) { console.log(`${slug}: Rumpf oder Innenraum fehlt`); continue; }
    const hull = await readGeometry(hullF), inner = await readGeometry(inF);
    // den groben Innenraum im Rumpf (extras.interior) nicht als Rumpf zählen
    const hullNodes = sceneNodes(hull).filter((n) => !n.getExtras()?.interior), innerNodes = sceneNodes(inner);
    const spans = hullSpans(hullNodes, verborgen);
    if (!spans) { console.log(`${slug}: Rumpf ohne Dreiecke`); continue; }
    const r = judge(spans, innerNodes, { versatz: VERSATZ, verborgen });
    const seat = pickSeat((man.interior[slug]?.spots ?? []).filter((s) => s.kind === 'seat'));
    result[slug] = { ...r, voxel: r2(spans.vox), ...(seat ? { sitz: seatCheck(seat, innerNodes, hullNodes, { verborgen }) } : {}) };
    console.log(`${slug.padEnd(36)} ${String(r.tris).padStart(8)} Dr.  außen ${String(r.aussenPct).padStart(6)} % (bis ${r.maxM} m)${r.versatz ? `  Versatz ${r.versatz.join(' ')} -> ${r.mitVersatzPct} %` : ''}  ${seatLine(result[slug].sitz)}`);
  }
  const all = Object.values(result);
  const over = (p) => all.filter((r) => r.aussenPct >= p).length;
  console.log(`\n${all.length} Innenräume gemessen in ${Math.round((Date.now() - t0) / 1000)} s; mindestens 1 % außen: ${over(1)}, mindestens 5 %: ${over(5)}, mindestens 20 %: ${over(20)}`);
  const withSeat = Object.entries(result).filter(([, r]) => r.sitz);
  const bad = withSeat.filter(([, r]) => !r.sitz.ok);
  const open = withSeat.filter(([, r]) => r.sitz.oben === 'frei').map(([s]) => s);
  console.log(`Pilotensitz: ${withSeat.length} mit Sitz, ${withSeat.length - bad.length} ✓ (Innenraum am Sitz), ${bad.length} ✗${bad.length ? ` (${bad.map(([s, r]) => `${s}: ${r.sitz.nah} Dr., nächstes ${r.sitz.abstand} m`).join('; ')})` : ''}; ohne Sitzangabe: ${all.length - withSeat.length}`);
  console.log(`Über dem Sitz bis ${OBEN_M} m: Glas ${withSeat.filter(([, r]) => r.sitz.oben === 'Glas').length}, Rumpf ${withSeat.filter(([, r]) => r.sitz.oben === 'Rumpf').length}, frei ${open.length}${open.length ? ` (${open.join(', ')})` : ''}`);
}
if (jsonFile) writeFileSync(jsonFile, JSON.stringify(result, null, 1));
