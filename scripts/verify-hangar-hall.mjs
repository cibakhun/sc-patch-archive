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

   ACHT ZUSICHERUNGEN, jede mit Soll-/Ist-Zeile:
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
     5  Die Moebel kommen mit (seit 08.10.2026): Am Rechner laedt die Seite
        die leichtere Stufe und die Moebel als eigene Datei, die
        scripts/build-hall-furniture.mjs beim Build aus der vollen Stufe
        schneidet. Zusammen tragen Halle und Moebeldatei mindestens so viele
        Moebel wie die Klinke (KLINKE_MOEBEL), nie doppelt, und die
        Moebeldatei stammt aus genau der vollen Stufe, die in dist/ liegt
        (sha1). Sonst fehlen die Moebel still, oder sie zeigen einen alten
        Stand, nachdem der PC die Halle neu gebaut hat. Steht die volle
        Stufe trotz leichterer als Halle der Seite, fehlte die Moebeldatei
        beim Build: Die Seite zeigt dann alles, laedt aber das Vierfache an
        Waenden, und das Tor reisst.
     6  Die Naehte jeder Hallenstufe halten (seit 08.10.2026): Draco rundete
        die Lage jeder Primitive auf ihr eigenes Raster, Kanten zweier
        Teile klafften danach bis 5 mm, und durch den Spalt schien der helle
        Hintergrund (gepunktete Linien an den Paneelkanten). Gezaehlt werden
        Randecken, die hoechstens 5 mm neben der Randecke eines anderen
        Teils liegen, aber nicht genau darauf (seamStats in
        scripts/lib/hall-seams.mjs). Obergrenze je Halle
        (OBERGRENZE_KLAFFEND), sie sinkt mit jeder dichteren Halle; dazu
        eine Untergrenze dichter Randecken (KLINKE_DICHT), damit eine leere
        oder anders zerlegte Halle das Tor nicht still bestehen laesst.
     7  Was der leichteren Stufe fehlt, kommt aus der vollen (seit
        10.10.2026): Ihr fehlen zwei Drittel des Glases (Abdeckungen der
        Kabelrinnen und Bodenkanaele, Scheiben der Glassaeulen, Kabine an
        der Suedwand) und die Rohre in den Glassaeulen. Die Moebeldatei
        bringt diese Materialien ganz aus der vollen Stufe (Knoten mit dem
        Schluessel, den der Viewer hinter der Marke hall-detail nennt), der
        Viewer laesst dafuer die Teile der leichteren Stufe mit denselben
        Materialien fallen. Mindestens so viele Dreiecke wie die Klinke
        (KLINKE_ERGAENZUNG), keines davon ein Moebel, jedes Material der
        leichteren Stufe, das unter die Regel faellt, wird ersetzt (sonst
        laege dort Glas doppelt oder das alte duenne), und nichts davon im
        Bereich einer Ausnahme aus HALL_DROP (sonst kaeme ein entferntes
        Teil ueber die Ergaenzung zurueck). Jedes Material der Ergaenzung
        faellt unter die Regel: Der Viewer liesse fuer jedes andere alle
        Teile der leichteren Stufe mit diesem Material fallen. Und jede
        Primitive traegt einen Attributsatz (Semantik und Typ), den die
        leichtere Stufe mit demselben Material auch traegt: Der Viewer
        gibt ihr das Material nach Name und Eckfarben, ein anderer Satz
        braeuchte ein eigenes Shaderprogramm, und fehlten
        Texturkoordinaten, laege die Textur verschmiert.
     8  Was die leichtere Stufe an einer Stelle ganz weglaesst, setzt die
        Moebeldatei dazu (seit 10.10.2026, FILL in
        scripts/build-hall-furniture.mjs, Knoten mit dem Schluessel hinter
        der Marke hall-fill), auf den Kasten des Eintrags zugeschnitten:
        je Bereich mindestens seine Klinke (KLINKE_FUELLUNG), kein Bereich
        ohne Klinke oder ohne Dreiecke, gerechnet gegen genau die
        leichtere Stufe in dist/ (sha1). Kein Dreieck liegt ganz oder
        teilweise auf einer gleich ausgerichteten Flaeche der leichteren
        Stufe (Schwerpunkt und drei innere Probepunkte, unter FILL_TOL;
        beide flimmerten gegeneinander), keines im Bereich einer Ausnahme
        aus HALL_DROP. Material und Attributsatz traegt die leichtere
        Stufe genauso (die Moebeldatei bringt Ergaenzung und Fuellung ohne
        Texturen, der Viewer gibt ihnen das gleichnamige Material der
        leichteren Stufe; dasselbe gilt in [7] fuer die Ergaenzung).
   ============================================================ */
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';
import { seamStats } from './lib/hall-seams.mjs';
import { FILL_TOL, touches, samples, normalOf, withNormals, onLite, worldTris } from './lib/hall-fill.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const PAGE = 'de/hangar.html';
const MAX_SHARE = 0.02;
// Klinke je Halle: so viele Ausnahmen traegt HALL_DROP fuer sie mindestens.
// Nach oben mit jedem neuen Eintrag, nach unten nur per Commit, dessen
// Botschaft die Ursache nennt (Grundsatz 5).
const KLINKE_EINTRAEGE = { 'revelyork-single': 1 };
// Klinke je Halle: so viele Moebel (Knoten mit extras.furniture und
// extras.anchor) laedt die Seite am Rechner mindestens. Stand 08.10.2026:
// 137 in der vollen Stufe. Gleiche Regel wie oben.
const KLINKE_MOEBEL = { 'revelyork-single': 137 };
// Naehte je Halle (seamStats, Randecken bis 5 mm neben einem anderen Teil).
// OBERGRENZE_KLAFFEND sinkt nur; steigen nur per Commit, dessen Botschaft
// die Ursache nennt. KLINKE_DICHT steigt nur. Stand 10.10.2026, 1a878120
// (PC-Lauf „Hallen-Naehte“: bis 0,1 mm verschweisst, ein Raster fuer alle
// Teile): 1 753 klaffend, 121 915 dicht; vorher, je Primitive gerundet,
// 123 373 klaffend, 0 dicht. Die uebrigen klaffen schon in der
// ungerundeten Quelle (2 718 Ecken zwischen 0,1 und 5 mm); was durch sie
// scheint, ist seit dem dunklen Hintergrund der Halle dunkel wie die
// Fugen. Sie zu schliessen hiesse Spielgeometrie verschieben.
const OBERGRENZE_KLAFFEND = { 'revelyork-single': 1753 };
const KLINKE_DICHT = { 'revelyork-single': 121915 };
// Klinke je Halle: so viele Dreiecke Ergaenzung (Glas, Rohre der
// Glassaeulen) bringt die Moebeldatei aus der vollen Stufe mindestens.
// Stand 10.10.2026, volle Stufe fbd0e9c9: 15 482 (Glas 15 398 in vier
// Materialien, Rohre 84). Gleiche Regel wie oben.
const KLINKE_ERGAENZUNG = { 'revelyork-single': 15482 };
// Klinke je Halle und Bereich der Fuellung: so viele Dreiecke setzt die
// Moebeldatei dort mindestens dazu, auf den Kasten zugeschnitten. Stand
// 10.10.2026, volle Stufe fbd0e9c9 gegen die leichtere 1a878120:
// Holzblende auf dem Deckenkasten 14 (vorher 6 ganze Dreiecke, die bis
// unter die Leiste der leichteren Stufe reichten), Rohrstueck mitten an
// der Decke 142, Rueckwand der Schlitze unten im Nordtor 4 (24 weitere im
// Kasten deckungsgleich mit der leichteren Stufe, ausgelassen). Gleiche
// Regel wie oben.
const KLINKE_FUELLUNG = { 'revelyork-single': { 'Holzblende auf dem Deckenkasten': 14, 'Rohrstueck mitten an der Decke': 142, 'Rueckwand der Schlitze unten im Nordtor': 4 } };

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
  // Dieselben Geometrien wie dropHallParts: Eine Geometrie, die mehrere
  // Meshes tragen, bleibt im Viewer unberuehrt, ebenso Primitive ohne Index.
  // GLTFLoader teilt sie, wenn mehrere Knoten dasselbe Mesh stellen (er
  // klont den Knoten, nicht die Geometrie) und wenn Primitive dieselben
  // Accessoren nennen; gezaehlt wird darum je Knoten das Paar aus Index und
  // POSITION. Geometriegruppen legt GLTFLoader nicht an.
  const acc = new Map(), refs = new Map();
  const geo = (p) => [p.getIndices(), p.getAttribute('POSITION')].map((a) => (a ? acc.get(a) ?? acc.set(a, acc.size).get(a) : -1)).join(':');
  for (const node of doc.getRoot().listNodes()) for (const p of node.getMesh()?.listPrimitives() ?? []) refs.set(geo(p), (refs.get(geo(p)) || 0) + 1);
  const tris = [];
  let skipped = 0;
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const w = node.getWorldMatrix();
    for (const p of mesh.listPrimitives()) {
      const P = p.getAttribute('POSITION')?.getArray(), I = p.getIndices()?.getArray();
      if (!P) continue;
      if (!I || refs.get(geo(p)) > 1) { skipped++; continue; }
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
  // Naehte gegen dieselbe Stufe; die T-Stoesse kosten das Doppelte und
  // bleiben der Selbstauskunft des PC-Builds
  return { total, out, seams: seamStats(doc, { tJunctions: false }), doc };
}

say('\n[3] Jeder Eintrag trifft in jeder Hallenstufe mindestens seine Klinke');
say('[4] Kein Eintrag nimmt mehr als 2 % einer Stufe');
const files = hall ? [hall.url, hall.lite?.url].filter(Boolean) : [];
let measured = 0;
const seamRuns = [];
const stageDocs = new Map();
for (const u of files) {
  const f = fromUrl(u);
  if (!existsSync(f)) { fail(`[3] Hallenstufe ${u} liegt nicht in dist/`); continue; }
  const { total, out, seams, doc } = await measure(f, entries);
  stageDocs.set(u.split('?')[0], doc);
  measured++;
  seamRuns.push({ u: u.split('?')[0], ...seams });
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

say('\n[5] Die Moebel kommen mit, einmal, aus der ausgelieferten vollen Stufe');
// Nur der JSON-Block eines GLB (Knoten und extras), ohne zu dekodieren
const glbJson = (file) => {
  const b = readFileSync(file);
  return b.readUInt32LE(0) === 0x46546c67 ? JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')) : null;
};
// Attributsatz einer Primitive (Semantik:Typ, sortiert) und je
// Materialname die Saetze, die eine Datei traegt
const attrSig = (json, p) => Object.keys(p.attributes ?? {}).sort().map((s) => `${s}:${json.accessors?.[p.attributes[s]]?.type ?? '?'}`).join(',');
const sigsByMat = (json) => {
  const m = new Map();
  for (const mesh of json?.meshes ?? []) for (const p of mesh.primitives) {
    const n = json.materials?.[p.material]?.name ?? '?';
    if (!m.has(n)) m.set(n, new Set());
    m.get(n).add(attrSig(json, p));
  }
  return m;
};
const furnNodes = (json) => (json?.nodes ?? []).filter((n) => n.extras?.furniture != null && Array.isArray(n.extras?.anchor) && n.extras.anchor.length === 3 && n.extras.anchor.every(Number.isFinite)).length;
const klinkeMoebel = hall?.id ? KLINKE_MOEBEL[hall.id] ?? 0 : 0;
let inHall = 0, inFile = 0, furnSrc = '';
if (hall?.url && existsSync(fromUrl(hall.url))) inHall = furnNodes(glbJson(fromUrl(hall.url)));
if (hall?.furniture?.url) {
  const ff = fromUrl(hall.furniture.url);
  if (!existsSync(ff)) fail(`[5] die Moebeldatei ${hall.furniture.url} liegt nicht in dist/`);
  else {
    const json = glbJson(ff);
    const of = json?.extras?.furnitureOf;
    inFile = furnNodes(json);
    const src = of?.file ? join(DIST, 'hangar/hall', of.file) : null;
    const now = src && existsSync(src) ? createHash('sha1').update(readFileSync(src)).digest('hex') : null;
    furnSrc = of?.file ? `${of.file} sha1 ${String(of.sha1).slice(0, 8)}` : '(ohne Herkunft)';
    if (!of?.file || !of?.sha1) fail(`[5] ${hall.furniture.url.split('?')[0]} nennt keine Quelle (extras.furnitureOf): nicht von scripts/build-hall-furniture.mjs gebaut?`);
    else if (!now) fail(`[5] die Quelle der Moebel (${of.file}) liegt nicht in dist/hangar/hall/`);
    else if (now !== of.sha1) fail(`[5] die Moebel stammen aus einer aelteren ${of.file} (sha1 ${of.sha1.slice(0, 8)}, ausgeliefert ${now.slice(0, 8)}): npm run build neu laufen lassen (scripts/build-hall-furniture.mjs schneidet sie neu)`);
    if (of?.nodes != null && of.nodes !== inFile) fail(`[5] die Moebeldatei traegt ${inFile} Moebel, ihre Herkunft nennt ${of.nodes}`);
  }
}
say(`    in der Halle ${inHall}, in der Moebeldatei ${inFile}${furnSrc ? ` (aus ${furnSrc})` : ''}   Klinke: ${klinkeMoebel}`);
sollIst(`mindestens ${klinkeMoebel} Moebel, nur an einer Stelle`, `${inHall + inFile}${inHall && inFile ? ' (doppelt)' : ''}`);
if (inHall && !inFile && hall?.lite?.url) fail(`[5] die Seite laedt am Rechner die volle Stufe ${hall.url.split('?')[0]} (${inHall} Moebel darin), obwohl es ${hall.lite.url.split('?')[0]} gibt: die Moebeldatei fehlte beim Build (scripts/build-hall-furniture.mjs vor astro build?)`);
if (inHall && inFile) fail(`[5] Moebel doppelt: die Halle der Seite (${hall.url.split('?')[0]}) stellt ${inHall} selbst, und die Moebeldatei kommt dazu — HangarApp.astro gibt die Moebeldatei nur zur leichteren Stufe`);
if (inHall + inFile < klinkeMoebel) fail(`[5] die Seite laedt ${inHall + inFile} Moebel, die Klinke verlangt ${klinkeMoebel}: Moebeldatei fehlt (scripts/build-hall-furniture.mjs im Build?) oder die volle Stufe kam mit weniger Moebeln; KLINKE_MOEBEL nur per Commit mit Ursache senken`);
for (const k of Object.keys(KLINKE_MOEBEL).filter((k) => k !== hall?.id)) fail(`[5] KLINKE_MOEBEL["${k}"]: die Seite laedt diese Halle nicht; den Eintrag hier per Commit mit Ursache entfernen`);

say('\n[6] Die Naehte jeder Hallenstufe halten');
const grenze = hall?.id ? OBERGRENZE_KLAFFEND[hall.id] : undefined, dicht = hall?.id ? KLINKE_DICHT[hall.id] : undefined;
for (const r of seamRuns) {
  const mm = Object.entries(r.crackMm).map(([k, n]) => `bis ${k} mm ${n}`).join(', ');
  say(`    ${r.u}: ${r.boundaryVerts} Randecken, ${r.sealed} dicht, ${r.crack} klaffend${mm ? ` (${mm})` : ''}, ${r.lone} ohne Gegenstueck`);
  if (grenze !== undefined && r.crack > grenze) fail(`[6] ${r.u}: ${r.crack} klaffende Randecken, die Obergrenze ist ${grenze}: Die Halle kam wieder je Primitive gerundet (Spalte an den Paneelkanten, gepunktete Linien). Im PC-Build (scripts/build-hangar-assets.mjs) vor dem Packen sealSeams, dann draco mit quantizationVolume 'scene' (.planning/notes/hallen-naehte.md); OBERGRENZE_KLAFFEND nur per Commit mit Ursache anheben`);
  if (dicht !== undefined && r.sealed < dicht) fail(`[6] ${r.u}: ${r.sealed} dichte Randecken, die Klinke verlangt ${dicht}: Halle anders zerlegt oder ohne gemeinsames Raster gepackt? KLINKE_DICHT nur per Commit mit Ursache senken`);
}
if (hall?.id && measured && (grenze === undefined || dicht === undefined)) fail(`[6] die Halle ${hall.id} hat keine OBERGRENZE_KLAFFEND oder KLINKE_DICHT in diesem Tor: gemessene Werte eintragen`);
for (const k of new Set([...Object.keys(OBERGRENZE_KLAFFEND), ...Object.keys(KLINKE_DICHT)].filter((k) => k !== hall?.id))) fail(`[6] OBERGRENZE_KLAFFEND/KLINKE_DICHT["${k}"]: die Seite laedt diese Halle nicht; den Eintrag hier per Commit mit Ursache entfernen`);
sollIst(`hoechstens ${grenze ?? '?'} klaffend, mindestens ${dicht ?? '?'} dicht, je Stufe`, seamRuns.map((r) => `${r.crack} klaffend, ${r.sealed} dicht`).join('; ') || '(keine Stufe gemessen)');

say('\n[7] Was der leichteren Stufe fehlt, bringt die Moebeldatei ganz aus der vollen');
// Der Schluessel steht im Viewer: const HALL_DETAIL = /* hall-detail */ '…'
const km = /\/\* hall-detail \*\/\s*'([^']+)'/.exec(viewer);
const detailKey = km?.[1] ?? null;
const klinkeErg = hall?.id ? KLINKE_ERGAENZUNG[hall.id] ?? 0 : 0;
let ergTris = 0, ergMats = new Set(), liteRule = [], inDrop = 0, ergSigBad = 0;
if (viewer && !km) fail('[7] der Viewer traegt keinen Schluessel /* hall-detail */ \'…\' mehr: Die Ergaenzung aus der Moebeldatei kaeme dann zum duennen Glas der leichteren Stufe dazu, statt es zu ersetzen. Marke zurueck (assets/hangar-viewer.js, HALL_DETAIL), oder dieses Tor mitnehmen');
if (hall?.furniture?.url && existsSync(fromUrl(hall.furniture.url)) && detailKey) {
  const ff = fromUrl(hall.furniture.url), json = glbJson(ff), of = json?.extras?.furnitureOf;
  const rule = of?.detail?.rule;
  const det = (json?.nodes ?? []).filter((n) => n.extras?.[detailKey] === true && n.mesh != null);
  for (const n of det) {
    if (n.extras?.furniture != null || n.extras?.anchor) fail(`[7] Knoten ${n.name ?? '?'} ist Ergaenzung und Moebel zugleich: scripts/build-hall-furniture.mjs trennt beides`);
    for (const p of json.meshes[n.mesh].primitives) {
      ergTris += (json.accessors[p.indices ?? p.attributes?.POSITION]?.count ?? 0) / 3;
      ergMats.add(json.materials?.[p.material]?.name ?? '?');
    }
  }
  // Was die leichtere Stufe unter derselben Regel traegt, muss die Ergaenzung ersetzen
  const lite = existsSync(fromUrl(hall.url)) ? glbJson(fromUrl(hall.url)) : null;
  if (!rule) fail(`[7] ${hall.furniture.url.split('?')[0]} nennt keine Regel der Ergaenzung (extras.furnitureOf.detail.rule): nicht vom aktuellen scripts/build-hall-furniture.mjs gebaut?`);
  else if (lite) {
    const re = new RegExp(rule, 'i'), used = new Set();
    for (const m of lite.meshes ?? []) for (const p of m.primitives) used.add(lite.materials?.[p.material]?.name ?? '?');
    liteRule = [...used].filter((n) => re.test(n));
    for (const n of [...ergMats].filter((n) => !used.has(n))) fail(`[7] die Ergaenzung traegt „${n}“, die leichtere Stufe nicht: Die Moebeldatei bringt nur Namen und Faktoren mit, ohne das gleichnamige Material der leichteren Stufe bliebe das Teil ohne Texturen. Regel DETAIL in scripts/build-hall-furniture.mjs pruefen`);
    for (const n of [...ergMats].filter((n) => !re.test(n))) fail(`[7] die Ergaenzung traegt „${n}“, das nicht unter ihre Regel ${rule} faellt: Der Viewer liesse dafuer alle Teile der leichteren Stufe mit diesem Material fallen. Knoten mit extras.${detailKey} nur fuer die Regel (scripts/build-hall-furniture.mjs)`);
    for (const n of liteRule.filter((n) => !ergMats.has(n))) fail(`[7] die leichtere Stufe traegt „${n}“ (Regel ${rule}), die Ergaenzung nicht: Dort bliebe das duenne Glas, und kam das Material in der vollen Stufe umbenannt, laege es doppelt. Regel DETAIL in scripts/build-hall-furniture.mjs pruefen`);
  }
  // Dieselben Attribute wie die leichtere Stufe mit diesem Material
  const liteSigs = sigsByMat(lite);
  for (const n of det) for (const p of json.meshes[n.mesh].primitives) {
    const mn = json.materials?.[p.material]?.name ?? '?', s = attrSig(json, p);
    if (!liteSigs.has(mn) || liteSigs.get(mn).has(s)) continue;
    ergSigBad++;
    fail(`[7] die Ergaenzung traegt „${mn}“ mit ${s}, die leichtere Stufe nur mit ${[...liteSigs.get(mn)].join(' / ')}: Der Viewer gibt ihr das Material nach Name und Eckfarben (ohne Gegenstueck bliebe sie ohne Texturen), ein anderer Satz braucht ein eigenes Shaderprogramm, und fehlen Texturkoordinaten, liegt die Textur verschmiert. Moebeldatei neu bauen; bleibt es, in scripts/build-hall-furniture.mjs die Attribute der Ergaenzung (prune vor dem Tausch der Materialien) auf die der leichteren Stufe bringen`);
  }
  // Nichts davon im Bereich einer Ausnahme (Ecken in reach)
  if (det.length && entries.length) {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
    const doc = await io.read(ff);
    for (const node of doc.getRoot().listNodes()) {
      if (node.getExtras()?.[detailKey] !== true) continue;
      const w = node.getWorldMatrix();
      for (const p of node.getMesh()?.listPrimitives() ?? []) {
        // ohne Indizes je drei Ecken ein Dreieck, wie Build und Viewer zaehlen
        const P = p.getAttribute('POSITION').getArray(), I = p.getIndices()?.getArray() ?? null;
        const m = I ? I.length : P.length / 3;
        for (let t = 0; t + 2 < m; t += 3) {
          const hit = (I ? [I[t], I[t + 1], I[t + 2]] : [t, t + 1, t + 2]).some((i) => {
            const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
            const q = [w[0] * x + w[4] * y + w[8] * z + w[12], w[1] * x + w[5] * y + w[9] * z + w[13], w[2] * x + w[6] * y + w[10] * z + w[14]];
            return entries.some((d) => q.every((v, a) => v >= d.reach[0][a] && v <= d.reach[1][a]));
          });
          if (hit) inDrop++;
        }
      }
    }
    if (inDrop) fail(`[7] die Ergaenzung bringt ${inDrop} Dreiecke in den Bereich einer Ausnahme aus HALL_DROP zurueck: Das entfernte Teil stuende dort wieder (mit Glas oder Rohren). Regel DETAIL enger fassen oder die Ausnahme auch auf die Ergaenzung anwenden`);
  }
  if (ergTris < klinkeErg) fail(`[7] die Moebeldatei bringt ${ergTris} Dreiecke Ergaenzung, die Klinke verlangt ${klinkeErg}: Dann fehlt der Seite wieder das Glas auf Kabelrinnen, Bodenkanaelen und Glassaeulen (scripts/build-hall-furniture.mjs, DETAIL; Schluessel im Viewer „${detailKey}“). KLINKE_ERGAENZUNG nur per Commit mit Ursache senken`);
} else if (hall?.furniture?.url) {
  // ohne Schluessel ist oben schon ein Befund; fehlt die Datei, meldet es [5]
} else say('    (die Seite laedt keine Moebeldatei: Telefon-Stufe oder volle Stufe, nichts zu ergaenzen)');
for (const k of Object.keys(KLINKE_ERGAENZUNG).filter((k) => k !== hall?.id)) fail(`[7] KLINKE_ERGAENZUNG["${k}"]: die Seite laedt diese Halle nicht; den Eintrag hier per Commit mit Ursache entfernen`);
say(`    Schluessel im Viewer: ${detailKey ?? '(keiner)'}   Materialien: ${[...ergMats].map((n) => n.replace(/^.*_mtl_/, '')).join(', ') || '(keine)'}`);
say(`    leichtere Stufe unter der Regel: ${liteRule.map((n) => n.replace(/^.*_mtl_/, '')).join(', ') || '(keine)'}`);
sollIst(`mindestens ${klinkeErg} Dreiecke, jedes Material der leichteren Stufe ersetzt, 0 im Bereich einer Ausnahme, Attribute wie die leichtere Stufe`, `${ergTris} Dreiecke in ${ergMats.size} Materialien, ${liteRule.filter((n) => !ergMats.has(n)).length} nicht ersetzt, ${inDrop} im Bereich einer Ausnahme, ${ergSigBad} Primitiven mit anderen Attributen`);

say('\n[8] Was die leichtere Stufe an einer Stelle ganz weglaesst, setzt die Moebeldatei dazu');
// Der Schluessel steht im Viewer: const HALL_FILL = /* hall-fill */ '…'
const fk = /\/\* hall-fill \*\/\s*'([^']+)'/.exec(viewer);
const fillKey = fk?.[1] ?? null;
const klinkeFill = hall?.id ? KLINKE_FUELLUNG[hall.id] ?? {} : {};
const fillBy = {};
let fillTris = 0, fillNear = 0, fillCoinc = 0, fillPartial = 0, fillInDrop = 0, fillSigBad = 0, fillRegions = [];
if (viewer && !fk) fail('[8] der Viewer traegt keinen Schluessel /* hall-fill */ \'…\' mehr: Die Fuellung aus der Moebeldatei kaeme dann mit dem Material der vollen Stufe (eigenes Shaderprogramm, eigene Texturen). Marke zurueck (assets/hangar-viewer.js, HALL_FILL), oder dieses Tor mitnehmen');
if (hall?.furniture?.url && existsSync(fromUrl(hall.furniture.url)) && fillKey) {
  const ff = fromUrl(hall.furniture.url), json = glbJson(ff), fill = json?.extras?.furnitureOf?.fill;
  const liteUrl = hall.url.split('?')[0], liteDoc = stageDocs.get(liteUrl);
  if (!fill || !Array.isArray(fill.regions)) fail(`[8] ${hall.furniture.url.split('?')[0]} nennt keine Fuellung (extras.furnitureOf.fill): nicht vom aktuellen scripts/build-hall-furniture.mjs gebaut?`);
  else {
    fillRegions = fill.regions;
    // gerechnet gegen die leichtere Stufe, die die Seite laedt
    const liteSha = existsSync(fromUrl(hall.url)) ? createHash('sha1').update(readFileSync(fromUrl(hall.url))).digest('hex') : null;
    if (fill.sha1 !== liteSha) fail(`[8] die Fuellung ist gegen ${fill.file ?? '(keine)'} sha1 ${String(fill.sha1).slice(0, 8)} gerechnet, die Seite laedt ${liteUrl} sha1 ${String(liteSha).slice(0, 8)}: Moebeldatei neu bauen (scripts/build-hall-furniture.mjs)`);
    for (const r of fill.regions) if (!r.tris) fail(`[8] der Bereich „${r.name}“ (FILL) fuellt nichts mehr: Traegt die leichtere Stufe die Stelle inzwischen selbst, den Eintrag aus FILL in scripts/build-hall-furniture.mjs und aus KLINKE_FUELLUNG nehmen, sonst den Kasten nachmessen`);
  }
  const nodes = (json?.nodes ?? []).filter((n) => n.extras?.[fillKey] != null && n.mesh != null);
  for (const n of nodes) {
    if (n.extras?.furniture != null || n.extras?.anchor || (detailKey && n.extras?.[detailKey])) fail(`[8] Knoten ${n.name ?? '?'} ist Fuellung und zugleich Moebel oder Ergaenzung: scripts/build-hall-furniture.mjs trennt das`);
    const name = String(n.extras[fillKey]);
    for (const p of json.meshes[n.mesh].primitives) fillBy[name] = (fillBy[name] ?? 0) + (json.accessors[p.indices ?? p.attributes?.POSITION]?.count ?? 0) / 3;
  }
  fillTris = Object.values(fillBy).reduce((a, b) => a + b, 0);
  // Die Fuellung bringt nur Namen und Faktoren mit; das Material samt
  // Texturen gibt ihr der Viewer aus der leichteren Stufe
  // Texturen gibt ihr der Viewer aus der leichteren Stufe, nach Name und
  // Eckfarben; dafuer traegt sie deren Attributsatz
  const liteSigs = sigsByMat(existsSync(fromUrl(hall.url)) ? glbJson(fromUrl(hall.url)) : null);
  for (const n of nodes) for (const p of json.meshes[n.mesh].primitives) {
    const mn = json.materials?.[p.material]?.name ?? '?', s = attrSig(json, p);
    if (!liteSigs.has(mn)) fail(`[8] die Fuellung „${n.extras[fillKey]}“ traegt „${mn}“, die leichtere Stufe nicht: Ohne das gleichnamige Material bliebe sie ohne Texturen. Material in FILL (scripts/build-hall-furniture.mjs) pruefen`);
    else if (!liteSigs.get(mn).has(s)) {
      fillSigBad++;
      fail(`[8] die Fuellung „${n.extras[fillKey]}“ traegt „${mn}“ mit ${s}, die leichtere Stufe nur mit ${[...liteSigs.get(mn)].join(' / ')}: Der Viewer gibt ihr das Material nach Name und Eckfarben (ohne Gegenstueck bliebe sie ohne Texturen), ein anderer Satz braucht ein eigenes Shaderprogramm, und fehlen Texturkoordinaten, liegt die Textur verschmiert. Moebeldatei neu bauen; bleibt es, clipInto in scripts/build-hall-furniture.mjs pruefen (je Attributsatz der leichteren Stufe eine Primitive)`);
    }
  }
  for (const [name, k] of Object.entries(klinkeFill)) if ((fillBy[name] ?? 0) < k) fail(`[8] „${name}“: ${fillBy[name] ?? 0} Dreiecke Fuellung, die Klinke verlangt ${k}: Dort sieht man wieder durch die leichtere Stufe ins Dunkle (FILL in scripts/build-hall-furniture.mjs). KLINKE_FUELLUNG nur per Commit mit Ursache senken`);
  for (const name of Object.keys(fillBy).filter((n) => !(n in klinkeFill))) fail(`[8] „${name}“ fuellt ${fillBy[name]} Dreiecke ohne Klinke: in KLINKE_FUELLUNG dieses Tors eintragen`);
  // Liegt sie auf der leichteren Stufe, oder im Bereich einer Ausnahme?
  // Je Bereich gegen die Dreiecke der leichteren Stufe an seinem Rand,
  // mit denselben Probepunkten wie der Build
  if (nodes.length) {
    if (!liteDoc) fail(`[8] die leichtere Stufe ${liteUrl} ist nicht gemessen ([3]): ohne sie kein Abgleich der Fuellung`);
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
    const doc = await io.read(ff);
    const regs = new Map();
    for (const node of doc.getRoot().listNodes()) {
      const name = node.getExtras()?.[fillKey];
      if (name == null) continue;
      const r = regs.get(String(name)) ?? { tris: [], near: [], coinc: 0, partial: 0 };
      for (const p of node.getMesh()?.listPrimitives() ?? []) r.tris.push(...worldTris(node, p));
      regs.set(String(name), r);
    }
    for (const r of regs.values()) {
      r.box = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
      for (const q of r.tris.flat()) for (let a = 0; a < 3; a++) { r.box[0][a] = Math.min(r.box[0][a], q[a]); r.box[1][a] = Math.max(r.box[1][a], q[a]); }
    }
    for (const node of liteDoc?.getRoot().listNodes() ?? []) for (const p of node.getMesh()?.listPrimitives() ?? []) for (const t of worldTris(node, p)) for (const r of regs.values()) if (touches(r.box, t, 0.05)) r.near.push(t);
    for (const [name, r] of regs) {
      fillNear += r.near.length;
      const near = withNormals(r.near);
      for (const t of r.tris) {
        const n = normalOf(t), on = samples(t).filter((q) => onLite(q, n, near)).length;
        if (on === 4) r.coinc++;
        else if (on) r.partial++;
        if (t.some((q) => entries.some((d) => q.every((v, a) => v >= d.reach[0][a] && v <= d.reach[1][a])))) fillInDrop++;
      }
      fillCoinc += r.coinc;
      fillPartial += r.partial;
      if (r.coinc) fail(`[8] „${name}“: ${r.coinc} Dreiecke der Fuellung liegen ganz auf einer gleich ausgerichteten Flaeche der leichteren Stufe (unter ${FILL_TOL * 1000} mm): Dort flimmern beide gegeneinander, der Build laesst solche aus. Moebeldatei neu bauen (scripts/build-hall-furniture.mjs)`);
      if (r.partial) fail(`[8] „${name}“: ${r.partial} Dreiecke der Fuellung liegen teilweise auf einer gleich ausgerichteten Flaeche der leichteren Stufe (unter ${FILL_TOL * 1000} mm): Dort flimmern beide gegeneinander. Kasten in FILL (scripts/build-hall-furniture.mjs) so enger fassen oder teilen, dass er die Flaeche nicht mehr schneidet`);
    }
    if (fillInDrop) fail(`[8] die Fuellung bringt ${fillInDrop} Dreiecke in den Bereich einer Ausnahme aus HALL_DROP zurueck: Das entfernte Teil stuende dort wieder. Kasten in FILL enger fassen`);
  }
} else if (!hall?.furniture?.url) say('    (die Seite laedt keine Moebeldatei: nichts zu fuellen)');
for (const k of Object.keys(KLINKE_FUELLUNG).filter((k) => k !== hall?.id)) fail(`[8] KLINKE_FUELLUNG["${k}"]: die Seite laedt diese Halle nicht; den Eintrag hier per Commit mit Ursache entfernen`);
say(`    Schluessel im Viewer: ${fillKey ?? '(keiner)'}   Bereiche: ${fillRegions.map((r) => `${r.name} ${fillBy[r.name] ?? 0} (Klinke ${klinkeFill[r.name] ?? '?'}, ${r.skipped ?? '?'} deckungsgleich ausgelassen)`).join('; ') || '(keine)'}   leichtere Stufe daneben: ${fillNear} Dreiecke`);
sollIst(`je Bereich mindestens seine Klinke, 0 ganz oder teilweise aufliegend, 0 im Bereich einer Ausnahme, Attribute wie die leichtere Stufe`, `${fillTris} Dreiecke in ${Object.keys(fillBy).length} Bereichen, ${fillCoinc} ganz und ${fillPartial} teilweise aufliegend, ${fillInDrop} im Bereich einer Ausnahme, ${fillSigBad} Primitiven mit anderen Attributen`);

say('\n[Selbstauskunft]');
say(`    Halle: ${hall?.id ?? '(keine)'}   Eintraege: ${entries.length}   Hallenstufen gemessen: ${measured}   Moebel: ${inHall + inFile}   Ergaenzung: ${ergTris} Dreiecke   Fuellung: ${fillTris} Dreiecke   Randecken: ${seamRuns.map((r) => r.boundaryVerts).join(', ') || 0}`);

if (findings.length) {
  console.error(`\nverify-hangar-hall: ${findings.length} FEHLER\n`);
  for (const f of findings) console.error(`  · ${f}`);
  console.error('');
  process.exit(1);
}
say('\nverify-hangar-hall: ALLE ZUSICHERUNGEN ERFUELLT ✓\n');
