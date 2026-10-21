#!/usr/bin/env node
// Gerätesatz für den Wartungsplatz am Schiff (18.10.2026).
//
// Der Viewer stellt je Schiff Arbeitsplätze, Leitungen und Ölspuren um den
// Rumpf (Block /* work-dienst */ in assets/hangar-viewer.js). Die Requisiten
// stammen aus dem Gerätekatalog des Spiels (public/hangar/props/, PC-Auftrag
// .planning/notes/hangar-katalog.md): 13 Dateien, zusammen 23,6 MB. Der
// Viewer braucht davon etwa zwanzig Stücke; dieses Skript packt genau die
// Knoten, die der Block nennt, in eine Datei public/hangar/props/dienst.glb.
// Läuft ohne Netz, ohne git und ohne Spieldaten, nur aus dem Repo:
//
//   node scripts/build-hangar-dienst.mjs
//
// Zeichenbudget. Jedes Material ist im Viewer ein Zeichenbefehl (je Material
// ein BatchedMesh). Die Spielrequisiten tragen bis zu 16 Untermaterialien,
// die meisten davon nur eine Tönung mit fein gekachelter Detailkarte (Lack,
// Gummi, Metall). Diese „flachen“ Untermaterialien legt das Skript zu einem
// Material zusammen (dienst_flach): Farbe, Rauheit und Metall wandern als
// Eckenwerte mit (_TINT, _RM), die Tönung mal der mittleren Farbe der
// Detailkarte; die Kachelkarten selbst fallen hier weg (die mit Muster
// bringen die Schichten unten zurück). Was eigene Bilder trägt
// (Beschriftung, Leisten, Leuchten, Bildschirme), bleibt eigenes Material,
// gleichnamige aus allen Dateien als eines. POM-Decals fallen weg wie auf den Schiffen: Im Spiel sind sie
// Reliefschichten, deren Farbbild nie zu sehen ist.
//
// Schichten (21.10.2026, Katalog v2). Die flachen Teile tragen dazu je Ecke
// ihre Zeile in der Schichttafel (_SLOT), Texturkoordinaten und die
// Vertexfarbe des Spiels (COLOR_0). Die Zeile hält die vier Grund- und vier
// Abnutzungsschichten des LayerBlend-Materials (Farbe wie die Grundschicht
// heute: Schichtfarbe mal mittlere Farbe ihrer Karte, Metall) und welche
// Blend- und Abnutzungskarte es mischt, dazu Detail- und Normalenkarte der
// ersten Grundschicht, wenn sie ein Muster tragen (Rost, Riffelblech,
// Gewebe; die meisten Lackkarten sind glatt und bleiben weg). Die Karten
// selbst liegen als ein Raster in public/hangar/props/dienst-schichten.webp
// (je 256 px, 8 nebeneinander, im Viewer eine Texturliste); die Tafel steht
// in asset.extras.dienst.schichten.
// Zeile 0 heißt: keine Schichten, Farbe wie bisher aus _TINT. Kein
// zusätzlicher Zeichenbefehl: alles bleibt im Material dienst_flach.
//
// Selbstauskunft: Requisiten, Dreiecke, Materialien (flach und eigene), Bytes.
// Die Datei trägt in asset.extras.dienst den Fingerabdruck des Blocks und
// ihrer Quellen; verify:hangar-hall [14] reißt, wenn sie nicht dazu passt.

import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression, EXTTextureWebP } from '@gltf-transform/extensions';
import { mergeDocuments, prune, dedup, draco, unpartition } from '@gltf-transform/functions';
import draco3d from 'draco3d';
import sharp from 'sharp';
import { readFileSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeUvIslands, texcoordBits } from './lib/uv-islands.mjs';
import { sha8 as sha } from './lib/eol-sha.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const VIEWER = `${ROOT}assets/hangar-viewer.js`;
const KATALOG = `${ROOT}public/hangar/props/katalog.json`;
const BODEN = `${ROOT}public/hangar/hall/werkstatt-boden.glb`;
const OUT = `${ROOT}public/hangar/props/dienst.glb`;
const FLAT = 'dienst_flach';
const SCHICHTEN = `${ROOT}public/hangar/props/schichten/`;
const KARTEN = `${ROOT}public/hangar/props/dienst-schichten.webp`;
export const KARTE_PX = 256;
export const KARTEN_SPALTEN = 8;
// Texel je Zeile der Schichttafel: 0..3 Grundschicht 1..4 (rgb linear, a Metall),
// 4..7 Abnutzungsschicht 1..4, 8 (Blend-Karte, ihre Kachelung, Abnutzungskarte,
// Verschattung), 9 (Detailkarte, Normalenkarte, Kachelung der ersten
// Grundschicht, 0), 10 (mittlere lineare Farbe der Detailkarte, 0); Karte -1 = keine
export const TAFEL_TEXEL = 11;
// Muster: Standardabweichung eines Farbkanals (Detailkarte) oder eines der
// Kanäle r, g (Normalenkarte) über 4 von 255
export const MUSTER = 4;

/** Block /* work-dienst *\/ aus dem Viewer, als Text (Fingerabdruck) und JSON. */
export function readDienst(viewerText) {
  const m = /\/\* work-dienst \*\/([\s\S]*?)\/\* \/work-dienst \*\//.exec(viewerText);
  if (!m) return null;
  return { text: m[1].trim(), block: JSON.parse(m[1]) };
}

/** Knoten, die der Block nennt: Requisiten (prop_*) und Spuren (decal_*). */
export function dienstNodes(block) {
  const props = new Set(), decals = new Set();
  for (const s of block.stationen ?? []) for (const [n] of s.glieder ?? []) props.add(n);
  for (const l of block.leitungen ?? []) props.add(l.node);
  for (const [n] of block.spuren ?? []) decals.add(n);
  return { props: [...props], decals: [...decals] };
}

/** Fingerabdruck: Block, Katalog und jede Quelldatei (Text auf LF, lib/eol-sha.mjs). */
export function dienstStamp(text, files) {
  return { block: sha(text), quellen: Object.fromEntries(files.map((f) => [f.replace(ROOT, ''), sha(readFileSync(f))])) };
}

// sRGB-Mittel eines Bildes in lineare Farbe
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
async function meanColour(tex) {
  if (!tex) return [1, 1, 1];
  const { channels } = await sharp(Buffer.from(tex.getImage())).stats();
  return channels.slice(0, 3).map((c) => lin(c.mean / 255));
}
async function meanChannel(tex, k) {
  if (!tex) return 1;
  const { channels } = await sharp(Buffer.from(tex.getImage())).stats();
  return (channels[k] ?? channels[0]).mean / 255;
}

// Schichten eines LayerBlend-Materials (Katalog v2): Farbe wie die flache
// Grundschicht (Schicht mal mittlere Farbe ihrer Karte), Metall, wenn die
// Farbe der Schicht im Specular steht (PC-Befund Teil 2)
const karte = (name) => (name && existsSync(SCHICHTEN + name) ? SCHICHTEN + name : null);
async function layerRow(km, kat, base, H) {
  const num = (re) => km.layers.filter((l) => re.test(l.name)).sort((a, b) => a.name.localeCompare(b.name));
  const B = num(/^BaseLayer\d/), Wl = num(/^WearLayer\d/);
  if (!B.length) return null;
  const colour = async (l) => {
    const sc = kat.schichten?.[l.path] ?? {}, spec = sc.specular ?? [0.04, 0.04, 0.04];
    const metal = Math.max(...spec) > 0.2;
    const raw = metal ? spec : [0, 1, 2].map((k) => l.tint[k] * (sc.diffuse?.[k] ?? 1));
    const mean = karte(l.maps?.d) ? await H.mean(karte(l.maps.d)) : [1, 1, 1];
    return [...[0, 1, 2].map((k) => Math.min(1, raw[k] * mean[k])), metal ? 1 : 0];
  };
  const pad = (a) => { while (a.length < 4) a.push(a[a.length - 1]); return a.slice(0, 4); };
  const bc = pad(await Promise.all(B.map(colour)));
  bc[0] = [...base.col, base.metal];   // Grundschicht 1 genau wie bisher
  const wc = Wl.length ? pad(await Promise.all(Wl.map(colour))) : bc.map((c) => [...c]);
  const wearMap = km.textures?.TexSlot11?.split('/').pop().replace(/\.(tif|dds|png)$/i, '.webp');
  const L1 = B[0], muster = async (f, ch) => (karte(f) && (await H.stats(karte(f))).slice(0, ch).some((c) => c.stdev > MUSTER) ? f : null);
  const detail = await muster(L1.maps?.d, 3), normal = await muster(L1.maps?.n, 2);
  return {
    bc, wc, detail, normal,
    layerTiling: Number(L1.uvTiling) || 1,
    dMean: detail ? await H.linMean(karte(detail)) : [1, 1, 1],
    blend: km.blendMap && karte(km.blendMap) ? km.blendMap : null,
    tiling: Number(km.params?.BlendMapTiling ?? 1) || 1,
    wear: km.mask?.includes('WEAR_DIRT_AO_VERTEX') && karte(wearMap) ? wearMap : null,
    ao: km.mask?.includes('WEAR_DIRT_AO_VERTEX') ? 1 : 0,
  };
}

// Flach: undurchsichtig, ohne Leuchtkarte, Farbkarte und Normalenkarte
// höchstens als Kachel (KHR_texture_transform mit Maßstab über 1)
function tiled(ti) {
  const tr = ti?.getExtension('KHR_texture_transform');
  return !!tr && Math.max(...tr.getScale()) > 1.5;
}
function isFlat(m) {
  if (!m || m.getAlphaMode() !== 'OPAQUE' || m.getEmissiveTexture()) return false;
  if (m.getBaseColorTexture() && !tiled(m.getBaseColorTextureInfo())) return false;
  if (m.getNormalTexture() && !tiled(m.getNormalTextureInfo())) return false;
  if (m.getMetallicRoughnessTexture() && !tiled(m.getMetallicRoughnessTextureInfo())) return false;
  return true;
}
const isPom = (m) => m?.getAlphaMode() === 'BLEND' && /(^|_)pom(_|$)|decals?_pom/i.test(m.getName());

async function main() {
  const viewer = readFileSync(VIEWER, 'utf8');
  const D = readDienst(viewer);
  if (!D) throw new Error('assets/hangar-viewer.js trägt keinen Block /* work-dienst */');
  const want = dienstNodes(D.block);
  const kat = JSON.parse(readFileSync(KATALOG, 'utf8'));
  const byNode = new Map(kat.props.map((p) => [p.node, p]));
  const files = new Set([BODEN]);
  for (const n of want.props) {
    const p = byNode.get(n);
    if (!p) throw new Error(`${n} steht nicht im Katalog (public/hangar/props/katalog.json)`);
    files.add(`${ROOT}public${p.file}`);
  }

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });
  const doc = new Document();
  for (const f of [...files].sort()) mergeDocuments(doc, await io.read(f));
  const root = doc.getRoot();
  const scene = doc.createScene('dienst');
  root.setDefaultScene(scene);
  const wanted = new Set([...want.props, ...want.decals]), kept = new Map();
  for (const s of root.listScenes()) {
    if (s === scene) continue;
    for (const n of s.listChildren()) if (wanted.has(n.getName()) && !kept.has(n.getName())) kept.set(n.getName(), n);
    s.dispose();
  }
  const missing = [...wanted].filter((n) => !kept.has(n));
  if (missing.length) throw new Error(`Knoten fehlen in den Quellen: ${missing.join(', ')}`);

  const buf = root.listBuffers()[0];
  const flat = doc.createMaterial(FLAT).setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(1).setMetallicFactor(1);
  const meanCache = new Map();
  const cached = (key, fn) => { if (!meanCache.has(key)) meanCache.set(key, fn()); return meanCache.get(key); };
  const report = [];
  let flatMats = new Set(), ownMats = new Set(), dropped = 0;
  // Schichttafel: Zeile 0 = keine Schichten; je Material eine Zeile
  const H = {
    mean: (f) => cached(f, async () => meanColour({ getImage: () => readFileSync(f) })),
    stats: (f) => cached(`${f}|stats`, async () => (await sharp(f).stats()).channels),
    // so, wie der Viewer die Karte liest (256 px, Farbe hoch 2,2)
    linMean: (f) => cached(`${f}|lin`, async () => {
      const { data } = await sharp(f).resize(KARTE_PX, KARTE_PX, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const m = [0, 0, 0];
      for (let i = 0; i < data.length; i += 3) for (let k = 0; k < 3; k++) m[k] += (data[i + k] / 255) ** 2.2;
      return m.map((v) => +(v / (data.length / 3)).toFixed(5));
    }),
  };
  const rows = [null], rowOf = new Map(), maps = [], mapIdx = (n) => { if (!n) return -1; if (!maps.includes(n)) maps.push(n); return maps.indexOf(n); };
  const rowFor = async (m, base) => {
    const name = m.getName();
    if (rowOf.has(name)) return rowOf.get(name);
    const km = kat.materials?.[name];
    const r = km?.shader === 'LayerBlend_V2' && km.layers?.length ? await layerRow(km, kat, base, H) : null;
    const use = r && (r.blend || r.wear || r.ao || r.detail || r.normal) ? rows.push({ name, ...r }) - 1 : 0;
    rowOf.set(name, use);
    return use;
  };
  for (const name of [...kept.keys()].sort()) {
    const node = kept.get(name);
    scene.addChild(node);
    const mesh = node.getMesh();
    if (!mesh) throw new Error(`${name} hat kein Mesh`);
    if (node.listChildren().length) throw new Error(`${name} hat Kindknoten; der Satz erwartet ein Mesh je Requisit`);
    // Ursprung unten mittig, ohne eigene Lage (der Viewer setzt sie je Platz)
    const S = node.getScale(), T0 = node.getTranslation(), R0 = node.getRotation();
    if (T0.some((v) => Math.abs(v) > 1e-6) || R0.slice(0, 3).some((v) => Math.abs(v) > 1e-6) || S.some((v) => Math.abs(v - 1) > 1e-6)) throw new Error(`${name} trägt eine eigene Lage (T ${T0}, R ${R0}, S ${S}); der Satz erwartet sie im Mesh`);
    const pos = [], nor = [], tint = [], rm = [], idx = [], uvs = [], slot = [], vc = [];
    let tris = 0;
    for (const p of mesh.listPrimitives()) {
      const m = p.getMaterial();
      if (isPom(m)) { mesh.removePrimitive(p); p.dispose(); dropped++; continue; }
      // COLOR_0 bleibt bis zum Lesen (flach: Vertexfarbe der Schichten; die
      // übrigen verlieren sie unten)
      for (const sem of p.listSemantics()) if (!/^(POSITION|NORMAL|TEXCOORD_0|COLOR_0)$/.test(sem)) p.setAttribute(sem, null);
      const P = p.getAttribute('POSITION'), N = p.getAttribute('NORMAL'), I = p.getIndices();
      if (!N) throw new Error(`${name}: Teil mit ${m?.getName()} ohne Normalen`);
      const cnt = I ? I.getCount() : P.getCount();
      tris += cnt / 3;
      const textured = name.startsWith('decal_') || !isFlat(m);
      if (textured && !p.getAttribute('TEXCOORD_0') && m?.getBaseColorTexture()) throw new Error(`${name}: ${m.getName()} hat ein Bild, der Teil keine Texturkoordinaten`);
      if (textured) {
        // je Material dieselben Attribute (ein BatchedMesh): ohne Bild auch ohne Koordinaten? Dann null
        if (!p.getAttribute('TEXCOORD_0')) p.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(P.getCount() * 2)).setBuffer(root.listBuffers()[0]));
        ownMats.add(m.getName());
        continue;
      }
      // flach: Farbe × mittlere Farbe der Detailkarte, Rauheit und Metall
      const bc = m.getBaseColorFactor(), tex = m.getBaseColorTexture(), mr = m.getMetallicRoughnessTexture();
      const mean = tex ? await cached(tex, () => meanColour(tex)) : [1, 1, 1];
      const col = [0, 1, 2].map((k) => Math.min(1, bc[k] * mean[k]));
      const rough = Math.min(1, Math.max(0.04, m.getRoughnessFactor() * (mr ? await cached(`${mr.getName()}|g`, () => meanChannel(mr, 1)) : 1)));
      const metal = Math.min(1, Math.max(0, m.getMetallicFactor() * (mr ? await cached(`${mr.getName()}|b`, () => meanChannel(mr, 2)) : 1)));
      flatMats.add(m.getName());
      const row = await rowFor(m, { col, metal });
      const UV = p.getAttribute('TEXCOORD_0'), VC = p.getAttribute('COLOR_0');
      const base = pos.length / 3, a = [0, 0, 0, 0];
      for (let i = 0; i < P.getCount(); i++) {
        P.getElement(i, a); pos.push(a[0], a[1], a[2]);
        N.getElement(i, a); nor.push(a[0], a[1], a[2]);
        tint.push(col[0], col[1], col[2]);
        rm.push(rough, metal);
        if (UV) { UV.getElement(i, a); uvs.push(a[0], a[1]); } else uvs.push(0, 0);
        slot.push(row);
        if (VC && row) { a[3] = 1; VC.getElement(i, a); vc.push(...[0, 1, 2, 3].map((k) => Math.round(Math.min(1, Math.max(0, a[k] ?? 1)) * 255))); } else vc.push(255, 255, 255, 255);
      }
      for (let i = 0; i < cnt; i++) idx.push(base + (I ? I.getScalar(i) : i));
      mesh.removePrimitive(p);
      p.dispose();
    }
    if (pos.length) {
      const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buf);
      const q = doc.createPrimitive()
        .setAttribute('POSITION', acc('VEC3', new Float32Array(pos)))
        .setAttribute('NORMAL', acc('VEC3', new Float32Array(nor)))
        .setAttribute('_TINT', acc('VEC3', new Float32Array(tint)))
        .setAttribute('_RM', acc('VEC2', new Float32Array(rm)))
        .setAttribute('TEXCOORD_0', acc('VEC2', new Float32Array(uvs)))
        .setAttribute('_SLOT', acc('SCALAR', new Float32Array(slot)))
        .setAttribute('COLOR_0', acc('VEC4', new Uint8Array(vc)).setNormalized(true))
        .setIndices(acc('SCALAR', pos.length / 3 > 65535 ? new Uint32Array(idx) : new Uint16Array(idx)))
        .setMaterial(flat);
      mesh.addPrimitive(q);
    }
    report.push([name, tris, mesh.listPrimitives().length]);
  }
  // Flache Teile ohne Texturkoordinaten, eigene mit: je Material dieselben Attribute
  for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
    if (p.getMaterial() !== flat) { p.setAttribute('_TINT', null); p.setAttribute('_RM', null); p.setAttribute('_SLOT', null); p.setAttribute('COLOR_0', null); }
  }
  // gleichnamige Materialien zu einem (der Katalog benennt sie über alle Dateien gleich)
  const firstOf = new Map();
  for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
    const m = p.getMaterial(), key = m.getName();
    if (!firstOf.has(key)) firstOf.set(key, m);
    else if (firstOf.get(key) !== m) p.setMaterial(firstOf.get(key));
  }
  // keepAttributes: Glas ohne Bild (Gabelstapler, Frachtwagen) behält seine
  // Null-Koordinaten, sonst hätte sein Material einen anderen Attributsatz
  await doc.transform(prune({ keepAttributes: true }), dedup(), unpartition());
  for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) normalizeUvIslands(p, 'TEXCOORD_0');
  const uvBits = texcoordBits(root, 'TEXCOORD_0');
  await doc.transform(draco({ method: 'edgebreaker', quantizeNormal: 10, quantizeTexcoord: uvBits, quantizePosition: 14, quantizeGeneric: 10 }));
  doc.createExtension(KHRDracoMeshCompression).setRequired(true);
  doc.createExtension(EXTTextureWebP).setRequired(true);
  // Kartenraster: je Karte 256 × 256, KARTEN_SPALTEN nebeneinander, ohne
  // Alpha (die Glätte im Alpha der Normalenkarten bleibt weg). Verlustbehaftetes
  // WebP halbiert die Farbauflösung immer (4:2:0); smartSubsample hält die
  // Kanäle der Blend-Karten getrennter (Fehler im 99. Perzentil 27 -> 11 von
  // 255, +4 % Bytes; verlustfrei wöge das Raster 2,5 MB statt 0,6)
  const tafel = [];
  for (const r of rows.slice(1)) {
    const bi = mapIdx(r.blend), wi = mapIdx(r.wear), di = mapIdx(r.detail), ni = mapIdx(r.normal);
    for (const c of [...r.bc, ...r.wc]) tafel.push(...c.map((v) => +v.toFixed(5)));
    tafel.push(bi, r.tiling, wi, r.ao, di, ni, r.layerTiling, 0, ...r.dMean, 0);
  }
  const cols = Math.min(KARTEN_SPALTEN, maps.length), gridH = Math.ceil(maps.length / KARTEN_SPALTEN);
  const strip = maps.length ? await sharp({ create: { width: KARTE_PX * cols, height: KARTE_PX * gridH, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .composite(await Promise.all(maps.map(async (n, i) => ({ input: await sharp(SCHICHTEN + n).resize(KARTE_PX, KARTE_PX, { fit: 'fill' }).removeAlpha().png().toBuffer(), top: Math.floor(i / KARTEN_SPALTEN) * KARTE_PX, left: (i % KARTEN_SPALTEN) * KARTE_PX }))))
    .webp({ quality: 92, effort: 6, smartSubsample: true }).toBuffer() : null;
  if (strip) writeFileSync(KARTEN, strip);
  const stamp = dienstStamp(D.text, [KATALOG, ...[...files].sort(), ...maps.map((n) => SCHICHTEN + n)]);
  if (strip) stamp.schichten = { karten: KARTEN.split('/').pop(), sha: sha(strip), px: KARTE_PX, spalten: cols, namen: maps, texel: TAFEL_TEXEL, materialien: rows.slice(1).map((r) => r.name), tafel };
  root.getAsset().extras = { dienst: stamp };
  await io.write(OUT, doc);

  const bytes = statSync(OUT).size, mats = root.listMaterials().length;
  const T = report.reduce((s, r) => s + r[1], 0);
  console.log(`Gerätesatz ${OUT.replace(ROOT, '')}: ${want.props.length} Requisiten, ${want.decals.length} Spuren, ${Math.round(T)} Dreiecke, ${mats} Materialien (${FLAT} aus ${flatMats.size} flachen, ${mats - 1} eigene), ${dropped} POM-Teile weg, ${(bytes / 1048576).toFixed(2)} MB`);
  for (const [n, t, k] of report) console.log(`  ${n.padEnd(52)} ${String(Math.round(t)).padStart(6)} Dreiecke  ${k} Teile`);
  console.log(`  eigene Materialien: ${root.listMaterials().map((m) => m.getName()).filter((n) => n !== FLAT).join(', ')}`);
  console.log(`  Fingerabdruck: Block ${stamp.block}, ${Object.keys(stamp.quellen).length} Quellen`);
  const R1 = rows.slice(1);
  console.log(`  Schichten: ${R1.length} flache Materialien mit Schichtzeile (${R1.filter((r) => r.blend).length} mit Blend-Karte, ${R1.filter((r) => r.wear).length} mit Abnutzungskarte, ${R1.filter((r) => r.ao).length} mit Verschattung aus der Vertexfarbe, ${R1.filter((r) => r.detail).length} mit Detailkarte, ${R1.filter((r) => r.normal).length} mit Normalenkarte); ${maps.length} Karten in ${KARTEN.replace(ROOT, '')}${strip ? ` (${(strip.length / 1024).toFixed(0)} KB)` : ''}: ${maps.join(', ')}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
