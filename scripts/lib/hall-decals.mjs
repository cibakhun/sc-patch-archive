// Aufkleber-Teilnetze einer Halle, die der socpak-Export auslässt.
//
// Der Export schreibt je Spieldatei (.cgf/.cga) ein Netz und je Teilnetz ein
// Primitiv, lässt aber jedes Teilnetz weg, dessen Untermaterial im
// StringGenMask %DECAL trägt: Bodenmarkierungen, aufgemalte Schrift und
// Symbole, Fugen, Schrauben und Lüftungsschlitze (in util-lrgtop 110.009
// Dreiecke in 186 von 425 Netzen). Die Lage der Knoten bleibt, und die
// Geometrie steht in der Spieldatei im selben Raum wie die Primitive des
// Exports: bei .cgf deckungsgleich, bei .cga um die Ruhelage des Netz-Knotens
// verschoben. Diese Verschiebung wird hier nicht aus dem Knotenbaum gelesen,
// sondern an einem behaltenen Teilnetz desselben Knotens gemessen (Kasten des
// Primitivs gegen Kasten des Teilnetzes) — so prüft jede Zuordnung zugleich,
// dass Datei und Export wirklich dasselbe Netz meinen.
//
// hallDecalDoc baut daraus ein eigenes glTF-Dokument: je betroffenem Netz ein
// Mesh mit dem Namen aus dem Export und je ausgelassenem Aufkleber-Teilnetz
// ein Primitiv (Lage, Normale, UV, Eckfarbe RGBA wie im Spiel). Der Build
// hängt die Primitive an die gleichnamigen Netze der Halle (addHallDecals in
// scripts/build-hangar-assets.mjs); die Eckfarbe ist bei diesen Materialien
// Farbe und Deckkraft des Aufdrucks.
import { readSkinMesh, readSkinMaterial } from './ivo-skin.mjs';

export const meshBase = (name) => String(name).replace(/\\/g, '/').split('/').pop().replace(/\.(cga|cgf)$/i, '').toLowerCase();
const trisOf = (p) => (p.getIndices()?.getCount() ?? 0) / 3;
const matNo = (p) => Number((p.getMaterial()?.getName().match(/_(\d+)$/) || [])[1] ?? NaN);

// Primitive des Exports (in ihrer Reihenfolge) gegen die Teilnetze der Datei:
// ein Primitiv ist das nächste Teilnetz mit seiner Dreieckszahl und, wo der
// Materialname eine Nummer trägt, seiner Materialnummer. Was dazwischen
// liegt, hat der Export ausgelassen. null: die Datei ist nicht dieses Netz.
export function fitSubsets(prims, subs) {
  const kept = [], dropped = [];
  let s = 0;
  for (const p of prims) {
    while (s < subs.length && !(subs[s].numIndices / 3 === p.tris && (Number.isNaN(p.mat) || subs[s].mat === p.mat))) dropped.push(s++);
    if (s >= subs.length) return null;
    kept.push(s++);
  }
  for (; s < subs.length; s++) dropped.push(s);
  return { kept, dropped };
}

function boxOfIndexed(get, ids) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], v = [0, 0, 0];
  for (const i of ids) { get(i, v); for (let k = 0; k < 3; k++) { if (v[k] < lo[k]) lo[k] = v[k]; if (v[k] > hi[k]) hi[k] = v[k]; } }
  return { lo, hi };
}
// Flächennormale des ersten nicht entarteten Dreiecks (für die Umlaufrichtung)
function firstNormal(get, tri) {
  const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0];
  for (let t = 0; t < tri.length; t += 3) {
    get(tri[t], a); get(tri[t + 1], b); get(tri[t + 2], c);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    if (Math.hypot(...n) > 1e-8) return n;
  }
  return null;
}

// doc: Rohexport der Halle. files: Map Dateiname (klein, mit Endung) -> Pfade
// der Fundstellen. read(pfad) -> Buffer. subMaterials(mtlPfad) -> Liste der
// Untermaterialien ({ name, decal, d, n, s, … } wie parseSubMaterials des
// Extraktors) oder null. lod: Stufe der Halle (bevorzugte Datei).
// Liefert { doc, report }; doc ist null, wenn kein Aufkleber gefunden wurde.
export function hallDecalDoc({ doc, files, read, subMaterials, lod = 1, Document }) {
  const uses = new Map();
  for (const n of doc.getRoot().listNodes()) { const m = n.getMesh(); if (m) uses.set(m, (uses.get(m) || 0) + 1); }
  // nr: das wievielte Netz dieses Namens im Export (der Build findet es so wieder)
  const nrOf = new Map(), count = new Map();
  for (const m of doc.getRoot().listMeshes()) { const k = count.get(m.getName()) || 0; nrOf.set(m, k); count.set(m.getName(), k + 1); }
  const out = new Document();
  const buffer = out.createBuffer(), scene = out.createScene('aufkleber');
  const mats = new Map();
  const report = {
    netze: uses.size, zugeordnet: 0, ohneDatei: [], unklar: [], ohneLage: [], gedreht: 0,
    aufkleber: { netze: 0, teilnetze: 0, tris: 0, trisMitExemplaren: 0 }, andere: { teilnetze: 0, tris: 0 }, materialien: {},
  };
  const stufen = lod ? [`_lod${lod}`, ''] : ['', '_lod1'];
  for (const [mesh, inst] of uses) {
    const base = meshBase(mesh.getName());
    const cands = [];
    for (const e of ['cga', 'cgf']) for (const st of stufen) cands.push(...(files.get(`${base}${st}.${e}m`) ?? []));
    if (!cands.length) { report.ohneDatei.push(base); continue; }
    const prims = mesh.listPrimitives();
    const sig = prims.map((p) => ({ tris: trisOf(p), mat: matNo(p) }));
    let g = null, fit = null, file = null;
    for (const c of cands) {
      let gg;
      try { gg = readSkinMesh(read(c)); } catch { continue; }
      const f = fitSubsets(sig, gg.subs);
      if (f) { g = gg; fit = f; file = c; break; }
    }
    if (!fit) { report.unklar.push(base); continue; }
    report.zugeordnet++;
    if (!fit.dropped.length) continue;
    // Material der Datei: im Kopf (.cgf/.cga) neben der Netzdatei (.cgfm/.cgam)
    const head = file.replace(/(_lod\d)?\.(cga|cgf)m$/i, '.$2');
    let mtl = null;
    try { mtl = readSkinMaterial(read(head)); } catch { /* ohne Kopf kein Material */ }
    const subMats = mtl ? subMaterials(mtl) : null;
    const want = fit.dropped.filter((k) => subMats?.[g.subs[k].mat]?.decal);
    for (const k of fit.dropped) if (!want.includes(k)) { report.andere.teilnetze++; report.andere.tris += (g.subs[k].numIndices / 3) * inst; }
    if (!want.length) continue;

    // Verschiebung je Netz-Knoten und Umlaufrichtung, gemessen an den behaltenen Teilnetzen
    const filePos = (i, v) => { v[0] = g.pos[i * 3]; v[1] = g.pos[i * 3 + 1]; v[2] = g.pos[i * 3 + 2]; };
    const subIdx = (sub) => g.idx.subarray(sub.firstIndex, sub.firstIndex + sub.numIndices);
    const shift = new Map();
    let flips = 0, same = 0;
    prims.forEach((p, i) => {
      const sub = g.subs[fit.kept[i]], a = p.getAttribute('POSITION'), ix = p.getIndices()?.getArray();
      if (!a || !ix) return;
      const getA = (j, v) => a.getElement(j, v);
      const A = boxOfIndexed(getA, ix), B = boxOfIndexed(filePos, subIdx(sub));
      const size = Math.max(...[0, 1, 2].map((q) => Math.abs((A.hi[q] - A.lo[q]) - (B.hi[q] - B.lo[q]))));
      const t = [0, 1, 2].map((q) => A.lo[q] - B.lo[q]);
      const old = shift.get(sub.node);
      if (size > 2e-3 || (old && old !== 'unklar' && Math.hypot(old[0] - t[0], old[1] - t[1], old[2] - t[2]) > 2e-3)) shift.set(sub.node, 'unklar');
      else if (!old) shift.set(sub.node, t);
      const nA = firstNormal(getA, ix), nB = firstNormal(filePos, subIdx(sub));
      if (nA && nB) { if (nA[0] * nB[0] + nA[1] * nB[1] + nA[2] * nB[2] < 0) flips++; else same++; }
    });
    const flip = flips > same;
    if (flip) report.gedreht++;
    // ohne behaltenes Teilnetz am selben Knoten: nur wenn das ganze Netz unverschoben ist (jede .cgf)
    const still = [...shift.values()].every((t) => t !== 'unklar' && Math.hypot(...t) < 2e-3);
    const made = [];
    for (const k of want) {
      const sub = g.subs[k], sm = subMats[sub.mat];
      let t = shift.get(sub.node);
      if (t === undefined && still && (/\.cgfm$/i.test(file) || shift.size)) t = [0, 0, 0];
      if (!t || t === 'unklar') { report.ohneLage.push(`${base} #${sub.mat} Knoten ${sub.node}`); continue; }
      const ix = subIdx(sub), neu = new Map(), alt = [];
      const idx = new Uint32Array(ix.length);
      for (let i = 0; i < ix.length; i++) { let v = neu.get(ix[i]); if (v === undefined) { v = alt.length; neu.set(ix[i], v); alt.push(ix[i]); } idx[i] = v; }
      if (flip) for (let i = 0; i < idx.length; i += 3) { const q = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = q; }
      const n = alt.length, pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Uint8Array(n * 4), nor = g.nor ? new Float32Array(n * 3) : null;
      for (let i = 0; i < n; i++) {
        const s = alt[i];
        for (let q = 0; q < 3; q++) pos[i * 3 + q] = g.pos[s * 3 + q] + t[q];
        uv[i * 2] = g.uv[s * 2]; uv[i * 2 + 1] = g.uv[s * 2 + 1];
        col.set(g.col.subarray(s * 4, s * 4 + 4), i * 4);
        if (nor) for (let q = 0; q < 3; q++) nor[i * 3 + q] = g.nor[s * 3 + q];
      }
      const mtlBase = mtl.replace(/\\/g, '/').split('/').pop().replace(/\.mtl$/i, '');
      const name = `${mtlBase}_mtl_${sm.name}_0${sub.mat}`;
      if (!mats.has(name)) {
        mats.set(name, out.createMaterial(name).setExtras({
          hall_decal: { mtl: mtl.replace(/\\/g, '/'), id: sub.mat, shader: sm.shader, genMask: sm.genMask, opacity: sm.opacity, alphaTest: sm.alphaTest, diffuse: sm.diffuse, shininess: sm.shininess, glow: sm.glow, params: sm.params, d: sm.d, n: sm.n, td: sm.td, tn: sm.tn },
        }));
        report.materialien[name] = { tris: 0, netze: 0, exemplare: 0, d: sm.d ?? null, n: sm.n ?? null, shader: sm.shader, genMask: sm.genMask, farben: new Map() };
      }
      const p = out.createPrimitive().setMaterial(mats.get(name)).setExtras({ sub: { mat: sub.mat, node: sub.node } })
        .setAttribute('POSITION', out.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer))
        .setAttribute('TEXCOORD_0', out.createAccessor().setType('VEC2').setArray(uv).setBuffer(buffer))
        .setAttribute('COLOR_0', out.createAccessor().setType('VEC4').setArray(col).setNormalized(true).setBuffer(buffer))
        .setIndices(out.createAccessor().setType('SCALAR').setArray(n > 65535 ? idx : new Uint16Array(idx)).setBuffer(buffer));
      if (nor) p.setAttribute('NORMAL', out.createAccessor().setType('VEC3').setArray(nor).setBuffer(buffer));
      made.push(p);
      const r = report.materialien[name], tris = idx.length / 3;
      r.tris += tris * inst; r.netze++; r.exemplare += inst;
      for (let i = 0; i < n; i++) { const key = `${col[i * 4]},${col[i * 4 + 1]},${col[i * 4 + 2]},${col[i * 4 + 3]}`; r.farben.set(key, (r.farben.get(key) || 0) + 1); }
      report.aufkleber.teilnetze++; report.aufkleber.tris += tris; report.aufkleber.trisMitExemplaren += tris * inst;
    }
    if (!made.length) continue;
    const m = out.createMesh(mesh.getName()).setExtras({ nr: nrOf.get(mesh), tris: sig.map((s) => s.tris), datei: file.replace(/\\/g, '/').split('/').pop(), exemplare: inst });
    for (const p of made) m.addPrimitive(p);
    scene.addChild(out.createNode(mesh.getName()).setMesh(m));
    report.aufkleber.netze++;
  }
  // Eckfarben je Material: wie viele verschiedene, die häufigsten fünf
  for (const r of Object.values(report.materialien)) {
    const all = [...r.farben].sort((a, b) => b[1] - a[1]);
    r.farbenZahl = all.length;
    r.farben = all.slice(0, 5).map(([k, c]) => `${k} ×${c}`);
  }
  return { doc: report.aufkleber.netze ? out : null, report };
}

// ─── Build ────────────────────────────────────────────────────────────────
// Welche Aufkleber-Materialien die Halle bekommt. Jedes kostet einen
// Zeichenaufruf, seine Dreiecke und, wenn es als erstes seine Farbkarte
// braucht, ein Bild von bis zu 1024 x 1024 Punkten im Grafikspeicher. Der Wert
// eines Aufklebers ist die Fläche, die er bemalt, nicht seine Dreieckszahl
// (in util-lrgtop: Bodenmarkierungen 2540 m² in 11.458 Dreiecken, die
// Tastenbeschriftung der Leitstand-Pulte 0,5 m² in 2368):
//   - nur Relief: Das Spiel legt dort allein Normale und Tiefe über die
//     Fläche darunter, zu erkennen an DecalDiffuseOpacity um 0 oder, bei
//     Relief-Aufklebern (%PARALLAX_OCCLUSION_MAPPING), an einer weißen
//     Farbkarte, die nur die Kanten schattiert (universal_pom_1_a: Schrauben,
//     Schlitze, Rippen). Ein Standardmaterial kann das nicht, es malte die
//     helle Karte als Fleck (eine Kabeltrommel bekam weiße Rippen). Bleibt weg.
//   - ab minFlaeche m² (mit allen Exemplaren): kommt mit seiner Farbkarte.
//   - darunter nur, wenn seine Farbkarte durch ein größeres schon da ist und
//     es wenigstens mitKarte m² bemalt.
// Je Kartendatei gibt es ein Bild: Den Verstärker (DecalAlphaMult, er wird
// ins Alpha gerechnet) bestimmt das größte Material, kleinere mit anderem
// Wert nehmen dieses Bild mit (statt je Wert eine weitere Kopie der Karte).
export const HALL_DECAL_RULE = { minFlaeche: 10, mitKarte: 1, ohneFarbe: 0.05, nurSchatten: 0.8 };
const texKey = (p) => String(p || '').replace(/\\/g, '/').replace(/^data\//i, '').toLowerCase();
function areaOf(p) {
  const P = p.getAttribute('POSITION').getArray(), I = p.getIndices().getArray();
  let a = 0;
  for (let t = 0; t < I.length; t += 3) {
    const A = I[t] * 3, B = I[t + 1] * 3, C = I[t + 2] * 3;
    const ux = P[B] - P[A], uy = P[B + 1] - P[A + 1], uz = P[B + 2] - P[A + 2], vx = P[C] - P[A], vy = P[C + 1] - P[A + 1], vz = P[C + 2] - P[A + 2];
    a += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
  }
  return a;
}
// Mittlere Helligkeit der Farbkarten (0..1, nach Deckkraft gewichtet) je
// Kartendatei: Daran erkennt pickHallDecals die Karten, die nur schattieren.
export async function hallDecalMaps(decalDoc, { texFile, sharp }) {
  const out = new Map();
  for (const m of decalDoc.getRoot().listMaterials()) {
    const d = m.getExtras()?.hall_decal?.d, k = texKey(d), f = d ? texFile(d) : null;
    if (!f || out.has(k)) continue;
    const { data, info } = await sharp(f).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.channels !== 4) continue;
    let s = 0, w = 0;
    for (let i = 0; i < data.length; i += 4) { const a = data[i + 3]; s += (data[i] + data[i + 1] + data[i + 2]) * a; w += a; }
    out.set(k, { hell: w ? s / (765 * w) : 0 });
  }
  return out;
}
// karten: Ergebnis von hallDecalMaps (ohne sie zählt keine Karte als weiß).
// Liefert { keep: Set der Materialien, mult: Map Kartendatei -> Verstärker, tris, flaeche, weg }.
export function pickHallDecals(decalDoc, { rule = HALL_DECAL_RULE, karten = null } = {}) {
  const tris = new Map(), flaeche = new Map();
  for (const m of decalDoc.getRoot().listMeshes()) {
    const ex = m.getExtras()?.exemplare || 1;
    for (const p of m.listPrimitives()) { const k = p.getMaterial(); tris.set(k, (tris.get(k) || 0) + trisOf(p) * ex); flaeche.set(k, (flaeche.get(k) || 0) + areaOf(p) * ex); }
  }
  const keep = new Set(), mult = new Map(), out = { relief: { materialien: 0, tris: 0 }, klein: { materialien: 0, tris: 0 }, ohneKarte: [] };
  for (const [m, a] of [...flaeche].sort((x, y) => y[1] - x[1])) {
    const x = m.getExtras()?.hall_decal ?? {}, t = tris.get(m), k = texKey(x.d);
    if (!x.d) { out.ohneKarte.push(m.getName()); continue; }
    const weiss = /PARALLAX_OCCLUSION_MAPPING/i.test(x.genMask || '') && (karten?.get(k)?.hell ?? 0) >= rule.nurSchatten;
    if (Number(x.params?.DecalDiffuseOpacity ?? 1) <= rule.ohneFarbe || weiss) { out.relief.materialien++; out.relief.tris += t; continue; }
    if (a >= rule.minFlaeche || (mult.has(k) && a >= rule.mitKarte)) { keep.add(m); if (!mult.has(k)) mult.set(k, Number(x.params?.DecalAlphaMult) || 1); }
    else { out.klein.materialien++; out.klein.tris += t; }
  }
  return { keep, mult, tris, flaeche, weg: out };
}

// Aufkleber aus <halle>.decals.glb (decalDoc) an die gleichnamigen Netze der
// Halle (doc) hängen. Muss laufen, solange die Netze die Primitive des Exports
// tragen (Probe an deren Dreieckszahlen): Die neuen Primitive kommen hinten
// an, was der Materialnachtrag nach Reihenfolge zuordnet, bleibt richtig.
// lift: so weit rückt jede Ecke längs ihrer Normale von der Fläche ab (m). Im
// Spiel liegen die Aufkleber deckungsgleich auf ihr, und Draco rastert die
// Halle auf rund 3 mm: ohne Abstand läge ein Aufdruck stellenweise darunter.
// COLOR_0 ist Farbe und Deckkraft des Aufdrucks, wo das Material %VERTCOLORS
// trägt; sonst steht dort anderes, und die Ecken werden weiß und deckend.
// keep, mult: Auswahl und Verstärker je Kartendatei aus pickHallDecals.
// Liefert { added: Map Netz -> neue Primitive, bericht }.
export function addHallDecals(doc, decalDoc, { keep = null, mult = null, lift = 0.005 } = {}) {
  const root = doc.getRoot(), buffer = root.listBuffers()[0];
  const byName = new Map();
  for (const m of root.listMeshes()) { const l = byName.get(m.getName()); if (l) l.push(m); else byName.set(m.getName(), [m]); }
  const mats = new Map(), added = new Map();
  const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const bericht = { netze: 0, primitive: 0, tris: 0, trisMitExemplaren: 0, materialien: 0, fremd: [] };
  for (const dm of decalDoc.getRoot().listMeshes()) {
    const x = dm.getExtras() ?? {}, target = byName.get(dm.getName())?.[x.nr ?? 0];
    if (!target || JSON.stringify(target.listPrimitives().map(trisOf)) !== JSON.stringify(x.tris)) { bericht.fremd.push(dm.getName()); continue; }
    const neu = [];
    for (const sp of dm.listPrimitives()) {
      const sm = sp.getMaterial();
      if (keep && !keep.has(sm)) continue;
      const P = Float32Array.from(sp.getAttribute('POSITION').getArray()), I = sp.getIndices().getArray().slice(), n = P.length / 3;
      let N = sp.getAttribute('NORMAL')?.getArray();
      if (N) N = Float32Array.from(N);
      else {
        // ohne Normalen der Datei: flächengewichtete aus den Dreiecken
        N = new Float32Array(n * 3);
        for (let t = 0; t < I.length; t += 3) {
          const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
          const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
          const f = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
          for (const v of [a, b, c]) for (let k = 0; k < 3; k++) N[v + k] += f[k];
        }
      }
      for (let i = 0; i < n; i++) {
        const l = Math.hypot(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]) || 1;
        for (let k = 0; k < 3; k++) { N[i * 3 + k] /= l; P[i * 3 + k] += N[i * 3 + k] * lift; }
      }
      const vc = /%VERTCOLORS/i.test(sm.getExtras()?.hall_decal?.genMask || '');
      const C = vc ? Uint8Array.from(sp.getAttribute('COLOR_0').getArray()) : new Uint8Array(n * 4).fill(255);
      if (!mats.has(sm)) {
        // verstaerker: der Wert der Kartendatei aus pickHallDecals (ein Bild je Datei)
        const x = sm.getExtras(), v = mult?.get(texKey(x.hall_decal?.d));
        mats.set(sm, doc.createMaterial(sm.getName()).setExtras(v === undefined ? x : { ...x, hall_decal: { ...x.hall_decal, verstaerker: v } }).setAlphaMode('BLEND').setMetallicFactor(0));
      }
      const p = doc.createPrimitive().setMaterial(mats.get(sm)).setExtras({ ...sp.getExtras(), hall_decal: true })
        .setAttribute('POSITION', acc('VEC3', P)).setAttribute('NORMAL', acc('VEC3', N))
        .setAttribute('TEXCOORD_0', acc('VEC2', Float32Array.from(sp.getAttribute('TEXCOORD_0').getArray())))
        .setAttribute('COLOR_0', acc('VEC4', C).setNormalized(true)).setIndices(acc('SCALAR', I));
      target.addPrimitive(p);
      neu.push(p);
      bericht.primitive++; bericht.tris += I.length / 3; bericht.trisMitExemplaren += (I.length / 3) * (x.exemplare || 1);
    }
    if (neu.length) { added.set(target, neu); bericht.netze++; }
  }
  bericht.materialien = mats.size;
  return { added, bericht };
}

// Logo des Betreibers. Netze, deren Name mit tint_logo beginnt, sind Tafeln aus
// zwei Dreiecken, denen der Export kein Material gibt: Im Spiel malt sie die
// Farbpalette der Halle (decalTexture: eine Schablone, deren Kanäle R, G, B je
// eine Farbe der Palette decken; <halle>.info.json palette.decal). Der Bau
// kennt ein Primitive ohne Material nur als weiße Fläche, so stand über dem
// Kontrollraum der Large-Halle eine leere helle Tafel von 15 × 15 m. Hier
// bekommen sie ein Aufkleber-Material, dessen Karte attachHallDecalTextures
// aus der Schablone backt. Nennt die Palette kein Logo, fallen die Tafeln weg:
// keine Tafel ist besser als eine leere. Muss laufen, solange die Netze ihre
// Namen tragen. Liefert { tafeln, weg }.
export function addHallLogo(doc, { decal = null } = {}) {
  const s = { tafeln: 0, weg: 0 };
  const ganz = !!(decal?.tex && [decal.r, decal.g, decal.b].every((c) => Array.isArray(c) && c.length === 3));
  let mat = null;
  // ein Netz, viele Knoten: gezählt wird, wie oft die Tafel in der Halle hängt
  const mal = new Map();
  for (const n of doc.getRoot().listNodes()) { const m = n.getMesh(); if (m) mal.set(m, (mal.get(m) ?? 0) + 1); }
  for (const me of doc.getRoot().listMeshes()) {
    if (!/^tint_logo/.test(meshBase(me.getName()))) continue;
    for (const p of me.listPrimitives()) {
      // der Export gibt ihnen sein namenloses Ersatzmaterial (hellgrau, ohne Karte und ohne extras)
      const alt = p.getMaterial();
      if (alt && (alt.getName() || Object.keys(alt.getExtras() || {}).length)) continue;
      if (!ganz) { me.removePrimitive(p); p.dispose(); s.weg += mal.get(me) ?? 1; continue; }
      mat ??= doc.createMaterial('hall_logo').setExtras({ hall_decal: { logo: { tex: decal.tex, r: decal.r, g: decal.g, b: decal.b } } }).setAlphaMode('BLEND').setMetallicFactor(0);
      p.setMaterial(mat).setExtras({ ...p.getExtras(), hall_decal: true });
      s.tafeln += mal.get(me) ?? 1;
    }
  }
  return s;
}

// Karten und Werte der Aufkleber-Materialien (nach attachHallTextures, das
// sie nicht kennt). Die Farbkarte trägt die Deckkraft im Alpha; DecalAlphaMult
// wird hineingerechnet (das Spiel verstärkt damit schwache Ränder; je Datei
// ein Wert, siehe pickHallDecals),
// DecalDiffuseOpacity und Opacity gehen in den Farbfaktor. Normalenkarte nur,
// wo der Aufkleber Relief ist (%PARALLAX_OCCLUSION_MAPPING) und sie nicht
// flach ist; Rauheit aus Shininess, ohne eigene Karte.
// texFile(pfad) -> PNG im Cache oder null; sharp: das Bildwerkzeug des Builds.
export async function attachHallDecalTextures(doc, { texFile, sharp }) {
  const root = doc.getRoot();
  const used = new Map();
  for (const me of root.listMeshes()) for (const p of me.listPrimitives()) { const m = p.getMaterial(); if (m?.getExtras()?.hall_decal) (used.get(m) ?? used.set(m, []).get(m)).push([me, p]); }
  const cache = new Map();
  const s = { materialien: 0, farbkarten: 0, normalen: 0, verstaerkt: 0, ohneKarte: [] };
  const num = (v, d) => (Number.isFinite(Number(v)) && v !== undefined && v !== null && v !== '' ? Number(v) : d);
  for (const [m, prims] of used) {
    const x = m.getExtras().hall_decal, dFile = texFile(x.logo ? x.logo.tex : x.d);
    if (!dFile) { s.ohneKarte.push(m.getName()); for (const [me, p] of prims) { me.removePrimitive(p); p.dispose(); } continue; }
    if (x.logo) {
      // Schablone des Betreibers (addHallLogo): je Kanal eine Farbe der Palette (sRGB 0–255), Deckkraft
      // ist der stärkste Kanal. Wo nichts deckt, steht die dunkelste der drei: kein heller Saum am Rand.
      const { data, info } = await sharp(dFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const F = [x.logo.r, x.logo.g, x.logo.b], leer = F.reduce((u, c) => (c[0] + c[1] + c[2] < u[0] + u[1] + u[2] ? c : u));
      let deckt = 0;
      for (let i = 0; i < data.length; i += 4) {
        const w0 = data[i], w1 = data[i + 1], w2 = data[i + 2], sum = w0 + w1 + w2;
        for (let k = 0; k < 3; k++) data[i + k] = sum ? Math.round((w0 * F[0][k] + w1 * F[1][k] + w2 * F[2][k]) / sum) : leer[k];
        data[i + 3] = Math.max(w0, w1, w2);
        if (data[i + 3] > 127) deckt++;
      }
      const name = `a${cache.size}`;
      cache.set(`${dFile}|logo`, doc.createTexture(name).setImage(await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer()).setMimeType('image/png').setURI(`${name}.png`));
      m.setBaseColorTexture(cache.get(`${dFile}|logo`)).setBaseColorFactor([1, 1, 1, 1]).setAlphaMode('BLEND').setMetallicFactor(0).setRoughnessFactor(0.6);
      s.farbkarten++; s.materialien++;
      s.logo = { karte: `${info.width}x${info.height}`, deckt: Math.round((deckt / (info.width * info.height)) * 1000) / 1000 };
      continue;
    }
    const mult = num(x.verstaerker ?? x.params?.DecalAlphaMult, 1), dKey = `${dFile}|${mult}`;
    if (!cache.has(dKey)) {
      let image = null;
      if (Math.abs(mult - 1) > 0.01) {
        const { data, info } = await sharp(dFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        for (let i = 3; i < data.length; i += 4) data[i] = Math.min(255, Math.round(data[i] * mult));
        image = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
        s.verstaerkt++;
      }
      const name = `a${cache.size}`;
      cache.set(dKey, doc.createTexture(name).setImage(image ?? (await sharp(dFile).png().toBuffer())).setMimeType('image/png').setURI(`${name}.png`));
      s.farbkarten++;
    }
    const dif = String(x.diffuse || '1,1,1').split(',').map(Number);
    const alpha = Math.min(1, num(x.opacity, 1) * num(x.params?.DecalDiffuseOpacity, 1));
    m.setBaseColorTexture(cache.get(dKey)).setBaseColorFactor([dif[0] ?? 1, dif[1] ?? 1, dif[2] ?? 1, alpha])
      .setAlphaMode('BLEND').setMetallicFactor(0).setRoughnessFactor(Math.max(0.2, 1 - num(x.shininess, 128) / 255));
    const nFile = /PARALLAX_OCCLUSION_MAPPING/i.test(x.genMask || '') ? texFile(x.n) : null;
    if (nFile) {
      if (!cache.has(nFile)) {
        const [r, g] = (await sharp(nFile).stats()).channels;
        const flat = r.max - r.min <= 3 && g.max - g.min <= 3, name = `an${cache.size}`;
        cache.set(nFile, flat ? null : doc.createTexture(name).setImage(await sharp(nFile).removeAlpha().png().toBuffer()).setMimeType('image/png').setURI(`${name}.png`));
        if (!flat) s.normalen++;
      }
      if (cache.get(nFile)) m.setNormalTexture(cache.get(nFile));
    }
    s.materialien++;
  }
  return s;
}
