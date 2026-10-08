/* ============================================================
   verify-hangar-hall.mjs — Tor fuer die Ausnahmen der echten Halle
   (Schiene A).

   WARUM ES DEN GIBT: Die Halle kommt nach Material zusammengelegt, ein
   Knoten je Material. Ein einzelnes Spielteil, das in der Halle nicht
   stehen soll (am 08.10.2026 ein Ausgangs-Wandstueck frei vor der
   Stirnwand), laesst sich darum nicht ausblenden, nur beim Laden aus den
   Dreiecken schneiden: HALL_DROP in assets/hangar-viewer.js, je Teil ein
   Quader im Modellraum der Halle. Baut der PC die Halle neu (volle Stufe,
   anderer Ursprung), trifft der Quader still nichts mehr, und das Teil
   steht wieder da. Oder er trifft zu viel. Beides sieht man erst, wenn
   jemand hinschaut.

   Dieses Tor liest das ARTEFAKT: den Block HALL_DROP aus dem
   ausgelieferten Viewer, die Halle aus der StageConfig der Hangarseite
   und jede Hallenstufe, die die Seite laedt (url, lite.url), aus dist/.
   Darauf rechnet es dieselbe Regel wie der Viewer (dropHallParts):
   zusammenhaengende Teile (gemeinsame Ecken auf 5 mm), ganz in `reach`,
   mit mindestens einer Ecke in `seen`. Kein git, kein Netz, keine
   Data.p4k, kein Kindprozess.

   VIER ZUSICHERUNGEN, jede mit Soll-/Ist-Zeile:
     1  Jeder Schluessel in HALL_DROP ist die Halle der Seite (sonst ist
        der Eintrag ein Zombie: die Halle gibt es nicht mehr).
     2  Jeder Eintrag traegt why, reach, seen und min, und seen liegt in
        reach. Die Halle der Seite traegt mindestens so viele Eintraege wie
        ihre Klinke (KLINKE_EINTRAEGE): ein geloeschter Eintrag liesse das
        Teil sonst still zurueckkehren, und das Tor saehe nichts mehr.
     3  Jeder Eintrag trifft in jeder Hallenstufe mindestens `min` Dreiecke
        (Klinke je Eintrag; sie waechst nur, siehe Grundsatz 5).
     4  Kein Eintrag nimmt mehr als 2 % der Dreiecke einer Stufe: Gedacht
        ist die Regel fuer einzelne Teile, nicht fuer Waende.
   ============================================================ */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const PAGE = 'de/hangar.html';
const MAX_SHARE = 0.02;
// Klinke je Halle: so viele Ausnahmen traegt HALL_DROP fuer sie mindestens.
// Nach oben mit jedem neuen Eintrag, nach unten nur per Commit, dessen
// Botschaft die Ursache nennt (Grundsatz 5).
const KLINKE_EINTRAEGE = { 'revelyork-single': 1 };

const findings = [];
const say = (s) => console.log(s);
const fail = (s) => findings.push(s);
const sollIst = (soll, ist) => say(`    Soll: ${soll}\n    Ist:  ${ist}`);
const fromUrl = (u) => join(DIST, decodeURI(String(u).split('?')[0]).replace(/^\//, ''));

say(`verify-hangar-hall: prueft ${join('dist', PAGE)} und die Dateien, die sie laedt`);
if (!existsSync(join(DIST, PAGE))) {
  console.error(`\nverify-hangar-hall: ${join('dist', PAGE)} fehlt — erst bauen (npm run build)\n`);
  process.exit(1);
}
const html = readFileSync(join(DIST, PAGE), 'utf8');
const sm = /<script type="application\/json" id="hg-stage">([\s\S]*?)<\/script>/.exec(html);
const stage = sm ? JSON.parse(sm[1]) : null;
if (!stage) fail(`${PAGE}: keine StageConfig (#hg-stage)`);
const hall = stage?.opts?.hall ?? null;
const viewerFile = stage?.viewer ? fromUrl(stage.viewer) : null;
const viewer = viewerFile && existsSync(viewerFile) ? readFileSync(viewerFile, 'utf8') : '';
if (!viewer) fail(`${PAGE}: der Viewer der StageConfig (${stage?.viewer}) liegt nicht in dist/`);

// Der Block steht im Viewer zwischen /* hall-drop */ und /* /hall-drop */ und ist JSON
const bm = /\/\* hall-drop \*\/([\s\S]*?)\/\* \/hall-drop \*\//.exec(viewer);
let drop = null;
try { drop = bm ? JSON.parse(bm[1]) : null; } catch (e) { fail(`HALL_DROP im Viewer ist kein JSON mehr (${e.message})`); }
if (viewer && !bm) fail('der Viewer traegt keinen Block /* hall-drop */ … /* /hall-drop */ mehr — umbenannt oder entfernt? Dann dieses Tor mitnehmen');
drop ??= {};

say('\n[1] Jeder Schluessel in HALL_DROP ist die Halle der Seite');
const keys = Object.keys(drop);
const orphan = keys.filter((k) => k !== hall?.id);
say(`    Halle der Seite: ${hall?.id ?? '(keine)'}   Schluessel: ${keys.join(', ') || '(keine)'}`);
sollIst('0 Schluessel ohne Halle', orphan.length);
for (const k of orphan) fail(`[1] HALL_DROP["${k}"]: die Seite laedt diese Halle nicht${hall && !hall.id ? ' (opts.hall traegt keine id — HangarApp.astro)' : ''}; Eintrag entfernen oder die Halle zurueck`);

say('\n[2] Jeder Eintrag traegt why, reach, seen, min; seen liegt in reach');
const entries = (hall?.id && drop[hall.id]) || [];
const box = (b) => Array.isArray(b) && b.length === 2 && b.every((p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite)) && b[0].every((v, i) => v < b[1][i]);
const malformed = [];
for (const [i, d] of entries.entries()) {
  const why = typeof d.why === 'string' && d.why.length > 10;
  const inside = box(d.reach) && box(d.seen) && d.seen[0].every((v, a) => v >= d.reach[0][a]) && d.seen[1].every((v, a) => v <= d.reach[1][a]);
  if (!why || !inside || !(Number.isInteger(d.min) && d.min > 0)) malformed.push(`Eintrag ${i}${why ? '' : ' ohne Anlass'}${inside ? '' : ' mit kaputtem reach/seen'}${Number.isInteger(d.min) && d.min > 0 ? '' : ' ohne Klinke min'}`);
}
const klinke = hall?.id ? KLINKE_EINTRAEGE[hall.id] ?? 0 : 0;
const staleKlinke = Object.keys(KLINKE_EINTRAEGE).filter((k) => k !== hall?.id);
say(`    Eintraege: ${entries.length}   Klinke: ${klinke}`);
sollIst(`0 unvollstaendige Eintraege, mindestens ${klinke}`, `${malformed.length} unvollstaendig, ${entries.length} Eintraege`);
for (const m of malformed) fail(`[2] ${m}`);
if (entries.length < klinke) fail(`[2] HALL_DROP["${hall.id}"] traegt ${entries.length} Eintraege, die Klinke verlangt ${klinke}: ein Eintrag ist verschwunden, und sein Teil steht wieder in der Halle. Zurueckholen, oder KLINKE_EINTRAEGE in diesem Tor per Commit mit Ursache senken`);
for (const k of staleKlinke) fail(`[2] KLINKE_EINTRAEGE["${k}"]: die Seite laedt diese Halle nicht; den Eintrag hier per Commit mit Ursache entfernen`);

// Die Regel des Viewers (dropHallParts) gegen eine Hallenstufe
async function measure(file, list) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
  const doc = await io.read(file);
  // Dieselben Geometrien wie dropHallParts: Ein Mesh, das mehrere Knoten
  // stellen, teilt im Viewer seine Geometrie (GLTFLoader klont den Knoten,
  // nicht die Geometrie) und bleibt dort unberuehrt, ebenso Primitive ohne
  // Index. Geometriegruppen legt GLTFLoader nicht an.
  const refs = new Map();
  for (const node of doc.getRoot().listNodes()) if (node.getMesh()) refs.set(node.getMesh(), (refs.get(node.getMesh()) || 0) + 1);
  const tris = [];
  let skipped = 0;
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const w = node.getWorldMatrix();
    for (const p of mesh.listPrimitives()) {
      const P = p.getAttribute('POSITION')?.getArray(), I = p.getIndices()?.getArray();
      if (!P) continue;
      if (!I || refs.get(mesh) > 1) { skipped++; continue; }
      const pos = new Float64Array(P.length);
      for (let i = 0; i < P.length; i += 3) {
        const x = P[i], y = P[i + 1], z = P[i + 2];
        pos[i] = w[0] * x + w[4] * y + w[8] * z + w[12];
        pos[i + 1] = w[1] * x + w[5] * y + w[9] * z + w[13];
        pos[i + 2] = w[2] * x + w[6] * y + w[10] * z + w[14];
      }
      tris.push({ pos, I });
    }
  }
  const total = tris.reduce((s, t) => s + t.I.length / 3, 0);
  if (skipped) say(`    (${skipped} Primitive ohne Index oder mehrfach gestellt: der Viewer schneidet dort nicht, hier ebenso)`);
  const out = [];
  for (const d of list) {
    const [r0, r1] = d.reach, [s0, s1] = d.seen;
    const inR = (p, i) => p[i] >= r0[0] && p[i] <= r1[0] && p[i + 1] >= r0[1] && p[i + 1] <= r1[1] && p[i + 2] >= r0[2] && p[i + 2] <= r1[2];
    const inS = (p, i) => p[i] >= s0[0] && p[i] <= s1[0] && p[i + 1] >= s0[1] && p[i + 1] <= s1[1] && p[i + 2] >= s0[2] && p[i + 2] <= s1[2];
    const ids = new Map(), par = [], seen = [];
    const find = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
    const kids = tris.map(({ pos }) => {
      const kid = new Int32Array(pos.length / 3).fill(-1);
      for (let v = 0; v < kid.length; v++) {
        if (!inR(pos, v * 3)) continue;
        const k = (Math.round(pos[v * 3] * 200) + 65536) * 17179869184 + (Math.round(pos[v * 3 + 1] * 200) + 65536) * 131072 + (Math.round(pos[v * 3 + 2] * 200) + 65536);
        let id = ids.get(k);
        if (id === undefined) { id = par.length; par.push(id); seen.push(0); ids.set(k, id); }
        if (inS(pos, v * 3)) seen[id] = 1;
        kid[v] = id;
      }
      return kid;
    });
    const anchors = [];
    tris.forEach(({ I }, m) => {
      const kid = kids[m];
      for (let t = 0; t + 2 < I.length; t += 3) {
        const a = kid[I[t]], b = kid[I[t + 1]], c = kid[I[t + 2]];
        if (a >= 0 && b >= 0 && c >= 0) { const r = find(a); par[find(b)] = r; par[find(c)] = r; }
        else { if (a >= 0) anchors.push(a); if (b >= 0) anchors.push(b); if (c >= 0) anchors.push(c); }
      }
    });
    const held = new Set(anchors.map(find)), shown = new Set();
    for (let i = 0; i < seen.length; i++) if (seen[i]) shown.add(find(i));
    const gone = new Set();
    let n = 0;
    tris.forEach(({ I }, m) => {
      const kid = kids[m];
      for (let t = 0; t + 2 < I.length; t += 3) {
        const a = kid[I[t]];
        if (a < 0 || kid[I[t + 1]] < 0 || kid[I[t + 2]] < 0) continue;
        const r = find(a);
        if (!held.has(r) && shown.has(r)) { gone.add(r); n++; }
      }
    });
    out.push({ tris: n, parts: gone.size });
  }
  return { total, out };
}

say('\n[3] Jeder Eintrag trifft in jeder Hallenstufe mindestens seine Klinke');
say('[4] Kein Eintrag nimmt mehr als 2 % einer Stufe');
const files = hall ? [hall.url, hall.lite?.url].filter(Boolean) : [];
let measured = 0;
for (const u of files) {
  const f = fromUrl(u);
  if (!existsSync(f)) { fail(`[3] Hallenstufe ${u} liegt nicht in dist/`); continue; }
  const { total, out } = await measure(f, entries);
  measured++;
  say(`    ${u.split('?')[0]}: ${total} Dreiecke`);
  out.forEach((r, i) => {
    const d = entries[i], name = d.why.split(' (')[0], share = total ? r.tris / total : 0;
    say(`      „${name}“: ${r.tris} Dreiecke in ${r.parts} Teilen (Klinke ${d.min}, Anteil ${(share * 100).toFixed(2)} %)`);
    if (r.tris < d.min) fail(`[3] „${name}“ trifft in ${u.split('?')[0]} nur ${r.tris} Dreiecke statt mindestens ${d.min}: Halle neu gebaut oder verschoben? reach/seen in HALL_DROP (assets/hangar-viewer.js) nachmessen, oder den Eintrag entfernen, wenn das Teil nicht mehr in der Halle steht`);
    if (share > MAX_SHARE) fail(`[4] „${name}“ nimmt ${(share * 100).toFixed(2)} % von ${u.split('?')[0]}: zu weit gefasst, die Regel ist fuer einzelne Teile`);
  });
}
sollIst(`${files.length} Hallenstufen gemessen, jeder Eintrag ueber seiner Klinke, unter 2 %`, `${measured} gemessen, ${findings.filter((f) => /^\[[34]\]/.test(f)).length} Befunde`);
if (entries.length && !measured) fail('[3] Eintraege, aber keine Hallenstufe gemessen — die Seite laedt keine Halle?');

say('\n[Selbstauskunft]');
say(`    Halle: ${hall?.id ?? '(keine)'}   Eintraege: ${entries.length}   Hallenstufen gemessen: ${measured}`);

if (findings.length) {
  console.error(`\nverify-hangar-hall: ${findings.length} FEHLER\n`);
  for (const f of findings) console.error(`  · ${f}`);
  console.error('');
  process.exit(1);
}
say('\nverify-hangar-hall: ALLE ZUSICHERUNGEN ERFUELLT ✓\n');
