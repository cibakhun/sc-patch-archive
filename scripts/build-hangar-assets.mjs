// Baut aus rohen, TEXTURIERTEN StarBreaker-Exporten die Web-Modelle der
// Hangar-Seite (assets/hangar-viewer.js): Schiffe mit echtem Lack, die Halle,
// die Hangar-Crew.
//
// Eingabe (gitignored, von scripts/extract-hangar-sources.mjs):
//   .cache/hangar-src/ships/<slug>.glb       entity export --materials textures
//   .cache/hangar-src/hall/<key>.glb         socpak export (Texturen NUR als Pfad)
//   .cache/hangar-src/tex/<p4k-pfad>.png     dazu dekodierte Hallen-Texturen
//   .cache/hangar-src/npc/<key>.glb          entity export eines NPC-Archetyps
// Ausgabe:
//   public/hangar/{ships,hall,npc}/<name>.glb   dezimiert, Draco, WebP-Texturen
//   src/data/hangar-assets.json                 Manifest (url, v, tris, bytes)
//
// Rohe Spieldateien werden NIE eingecheckt — nur diese Ausgabe.
//
// Usage:  node scripts/build-hangar-assets.mjs [--only <name>] [--force]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression, EXTTextureWebP } from '@gltf-transform/extensions';
import { dedup, prune, weld, flatten, join, simplify, draco, textureCompress, transformMesh } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3d';
import sharp from 'sharp';
import { readdirSync, existsSync, mkdirSync, statSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const SRC = new URL('../.cache/hangar-src/', import.meta.url);
const OUT = new URL('../public/hangar/', import.meta.url);
const MANIFEST = new URL('../src/data/hangar-assets.json', import.meta.url);
// Hallentexturen in mip 1 (halbe Kantenlänge), dekodiert vom Extraktor
const TEX_DIR = new URL('tex-m1/', SRC);

const argv = process.argv.slice(2);
const ONLY = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
const FORCE = argv.includes('--force');

// Budget je Art: Dreiecke nach der Dezimierung, Kantenlänge der Texturen.
const BUDGET = {
  ships: { tris: 200000, tex: 1024, ntex: 512 },
  hall: { tris: 320000, tex: 1024, ntex: 512 },
  npc: { tris: 30000, tex: 512, ntex: 512 },
};

// Innenraum je Halle (Meter, glTF-Raum Y oben): Bodenmitte, halbe Breite (x),
// halbe Länge (z), lichte Höhe. Abgelesen an den Bodenplatten und der
// Deckenunterkante des Exports; der Viewer stellt das Schiff auf die Mitte.
const HALL_ROOM = {
  'revelyork-single': { center: [36, 0, -68], halfW: 36, halfL: 68, height: 44 },
};

// Nie sichtbar oder nur im Spiel sinnvoll: Schadensmodelle, Kollisions-/
// Schild-Hüllen, Stellvertreter, Effekt-Helfer.
const DROP = /damage|_dmg|proxy|collision|shield_?helper|nodraw|_lod[1-9]\b|debris|\bvfx\b|_fx_|helper/i;

await MeshoptSimplifier.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });

function countTris(root) {
  let t = 0;
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
    const idx = p.getIndices();
    t += (idx ? idx.getCount() : p.getAttribute('POSITION').getCount()) / 3;
  }
  return Math.round(t);
}

// p4k-Pfad (…/x_diff.tif) -> dekodierte PNG im Cache, falls vorhanden.
function texFile(p) {
  if (!p) return null;
  const rel = p.replace(/\\/g, '/').replace(/^data\//i, '').replace(/\.(tif|dds)$/i, '.png').toLowerCase();
  const f = fileURLToPath(new URL(rel, TEX_DIR));
  return existsSync(f) ? f : null;
}

// Hallen-Materialien, die der socpak-Export nicht auflöst (Material als
// „Data/…“-Pfad in der .cgf): Zuordnung aus <halle>.matfix.json, geschrieben
// von scripts/extract-hangar-sources.mjs — je Mesh die .mtl und die
// Untermaterial-ID jedes Submeshes, je .mtl die Untermaterialien samt
// Texturen. Bestehende Materialien desselben Untermaterials werden
// wiederverwendet (Name „<mtl>_mtl_<name>_<index>“), sonst neu angelegt.
function applyMatFix(doc, fix) {
  const root = doc.getRoot();
  const mats = root.listMaterials();
  const made = new Map();
  const matFor = (base, id) => {
    const sub = fix.mtls[base]?.[id];
    if (!sub?.name) return null;
    if (/nodraw/i.test(sub.shader || '')) return 'drop';
    const key = `${base}_mtl_${sub.name}_`;
    const hit = mats.find((m) => m.getName().startsWith(key) && Number(m.getName().slice(key.length)) === id);
    if (hit) return hit;
    if (!made.has(key)) {
      const dif = String(sub.diffuse || '1,1,1').split(',').map(Number);
      made.set(key, doc.createMaterial(`${key}${String(id).padStart(2, '0')}`)
        .setBaseColorFactor([...dif.slice(0, 3), 1]).setRoughnessFactor(Math.max(0.2, 1 - Number(sub.shininess || 128) / 255))
        .setExtras({
          diffuse_tex: sub.d, normal_tex: sub.n, spec_tex: sub.s, is_glass: /glass/i.test(sub.shader || ''),
          semantic: { authored_attributes: [{ name: 'Shader', value: sub.shader }, { name: 'Specular', value: sub.specular }, { name: 'Shininess', value: sub.shininess }] },
        }));
    }
    return made.get(key);
  };
  let fixed = 0, dropped = 0;
  for (const mesh of root.listMeshes()) {
    const f = fix.meshes[mesh.getName().replace(/.*[\\/]/, '').replace(/\.(cgf|cga)$/i, '')];
    if (!f) continue;
    mesh.listPrimitives().forEach((p, i) => {
      if (p.getMaterial()?.getName()) return;
      const m = matFor(f.mtl, f.ids[i]);
      if (m === 'drop') { mesh.removePrimitive(p); p.dispose(); dropped++; }
      else if (m) { p.setMaterial(m); fixed++; }
    });
  }
  // Specular-Maps auch für die schon aufgelösten Materialien nachtragen
  for (const m of mats) {
    const [base, rest] = m.getName().split('_mtl_');
    const sub = rest && fix.mtls[base]?.find((s, i) => s.name && rest.startsWith(s.name + '_') && Number(rest.slice(s.name.length + 1)) === i);
    if (sub?.s) m.setExtras({ ...m.getExtras(), spec_tex: sub.s });
  }
  return { fixed, dropped, created: made.size };
}

// Abdeckung für den Bericht: benutzte Materialien gesamt / mit Farb- bzw.
// Normal-Quelle (Textur oder Pfad dazu) und der Dreiecksanteil ohne Material.
function coverage(doc) {
  const used = new Map();
  let tris = 0, bare = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
    const t = (p.getIndices()?.getCount() ?? 0) / 3;
    tris += t;
    const mat = p.getMaterial();
    if (!mat?.getName()) { bare += t; continue; }
    used.set(mat, true);
  }
  let d = 0, n = 0;
  for (const m of used.keys()) {
    const x = m.getExtras() || {};
    if (m.getBaseColorTexture() || x.diffuse_tex || x.spec_tex) d++;
    if (m.getNormalTexture() || x.normal_tex) n++;
  }
  return { materials: used.size, diffuse: d, normal: n, trisOhneMaterial: Math.round(bare), tris: Math.round(tris) };
}

// Die Halle kommt ohne eingebettete Bilder: Texturen aus dem Cache anhängen.
// CryEngine-Metall (Diffuse „conductor“, fast schwarz) bekommt statt dessen
// seine Specular-Map: bei Metall ist das die Farbe.
function attachHallTextures(doc) {
  const root = doc.getRoot();
  const cache = new Map();
  const tex = (file, name) => {
    if (!cache.has(file)) {
      cache.set(file, doc.createTexture(name).setImage(readFileSync(file)).setMimeType('image/png').setURI(name + '.png'));
    }
    return cache.get(file);
  };
  let n = 0;
  for (const m of root.listMaterials()) {
    const x = m.getExtras() || {};
    const metal = /conductor/i.test(x.diffuse_tex || '');
    const d = texFile(metal ? x.spec_tex : x.diffuse_tex);
    if (d && !m.getBaseColorTexture()) { m.setBaseColorTexture(tex(d, 'd' + cache.size)); n++; if (metal) m.setExtras({ ...x, spec_used: true }); }
    const nm = texFile(x.normal_tex);
    if (nm && !m.getNormalTexture()) { m.setNormalTexture(tex(nm, 'n' + cache.size)); n++; }
  }
  return n;
}

// Materialien webtauglich machen: Glas ohne Transmission (teuer, im Viewer
// ohnehin falsch), keine Lichter, Extras weg (hunderte KB Spiel-Metadaten).
function cleanMaterials(doc) {
  const root = doc.getRoot();
  for (const m of root.listMaterials()) {
    const x = m.getExtras() || {};
    const glass = x.is_glass || /glass|canopy|window/i.test(m.getName());
    for (const e of m.listExtensions()) m.setExtension(e.extensionName, null);
    if (glass) {
      const c = m.getBaseColorFactor();
      m.setBaseColorFactor([c[0] * 0.25, c[1] * 0.3, c[2] * 0.35, 0.28]).setAlphaMode('BLEND')
        .setMetallicFactor(0.1).setRoughnessFactor(0.05).setDoubleSided(false);
    }
    // CryEngine-Metall: die Diffuse-Textur „conductor“ ist fast schwarz, die
    // Farbe steckt in der Specular-Farbe. In glTF: Metall mit dieser Grundfarbe.
    if (/conductor/i.test(x.diffuse_tex || '')) {
      const a = Object.fromEntries((x.semantic?.authored_attributes || []).map((t) => [t.name, t.value]));
      const spec = String(a.Specular || '0.7,0.7,0.7').split(',').map(Number);
      const shin = Number(a.Shininess || 150);
      if (x.spec_used) m.setBaseColorFactor([...spec.map((v) => Math.min(1, v)), 1]);
      else m.setBaseColorTexture(null).setBaseColorFactor([...spec.map((v) => Math.min(1, v * 0.72)), 1]);
      m.setMetallicFactor(1).setRoughnessFactor(Math.max(0.35, 1 - shin / 255));
    }
    // Spiel-Emissive als leichtes Glimmen statt Weißblech
    if (x.glow && !m.getEmissiveTexture() && m.getBaseColorTexture()) {
      m.setEmissiveTexture(m.getBaseColorTexture()).setEmissiveFactor([1, 1, 1]);
    }
    m.setExtras({});
  }
  for (const e of root.listExtensionsUsed()) {
    if (/lights_punctual|materials_(ior|transmission|volume)/.test(e.extensionName)) e.dispose();
  }
  for (const n of root.listNodes()) { n.setExtras({}); }
}

// Attribute, die three falsch deutet oder nicht braucht: COLOR_0 sind im
// Spiel Abnutzungs-Masken, three würde sie als Farbe multiplizieren.
function stripAttributes(doc) {
  const usesUv1 = doc.getRoot().listTextureInfos?.().some((ti) => ti.getTexCoord() === 1);
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
    p.setAttribute('COLOR_0', null);
    p.setAttribute('TANGENT', null);
    if (!usesUv1) p.setAttribute('TEXCOORD_1', null);
  }
}

// Halle: Einrichtung der Galerien (aus der Schiffsperspektive kaum zu sehen,
// zusammen aber ein Viertel der Dreiecke) und die Planenkisten am Boden
// (stehen genau im Blickfeld der Startansicht).
const DROP_HALL = /props_(plant|couch|chair|occasional_table|crate_tarp)|flower_|footlocker/i;
// Materialien, die ohne die Spiel-Laufzeit falsch aussehen: Lichtkegel- und
// Blendenkarten (schweben als Splitter neben dem Rumpf), zur Laufzeit
// gerenderte Schriftzüge und Schablonen (ohne Bild: weiße Flächen).
const DROP_MAT = /headlight_glow|_flare|lens_?flare|light_?(beam|cone|shaft)|RTT_|stencil/i;

function dropJunk(doc, kind) {
  const root = doc.getRoot();
  const re = kind === 'hall' ? new RegExp(`${DROP.source}|${DROP_HALL.source}`, 'i') : DROP;
  let dropped = 0;
  for (const node of root.listNodes()) {
    if (re.test(node.getName() || '') || (node.getMesh() && re.test(node.getMesh().getName() || ''))) {
      node.setMesh(null); dropped++;
    }
  }
  for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
    if (DROP_MAT.test(p.getMaterial()?.getName() || '')) { mesh.removePrimitive(p); p.dispose(); dropped++; }
  }
  return dropped;
}

// Hangar-Crew: die Teile kommen ohne Skin-Gewichte in T-Pose und ohne
// Farben (Layer-Blend-Materialien des Spiels lassen sich nicht 1:1 nach
// glTF tragen). Darum: Knoten-Transformationen einbacken (Y oben, Meter),
// Arme an der Schulter nach unten drehen, Farben je Teil aus den dunklen
// Tönen der Deckcrew-Montur.
const CREW_PAINT = {
  undersuit: { c: 0x4a4f57, r: 0.85, m: 0 },
  core: { c: 0x6b727c, r: 0.5, m: 0.3 },
  arms: { c: 0x5f666f, r: 0.55, m: 0.25 },
  legs: { c: 0x555b63, r: 0.65, m: 0.15 },
  helmet: { c: 0x3a3f46, r: 0.3, m: 0.4 },
};
const hex = (c) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255].map((v) => v ** 2.2);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function prepareCrew(doc) {
  const root = doc.getRoot();
  const baked = root.listNodes().filter((n) => n.getMesh()).map((n) => [n, n.getWorldMatrix()]);
  for (const [n, mtx] of baked) transformMesh(n.getMesh(), mtx);
  for (const n of root.listNodes()) n.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);

  // Arme: Schultergelenk bei |x| 0,19 m, Höhe 1,50 m. Weich ab |x| 0,2 m,
  // voll ab 0,28 m, 72° nach unten — die Hände landen auf Hüfthöhe.
  const SH = [0.19, 1.5], ANG = (72 * Math.PI) / 180;
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
    const pos = p.getAttribute('POSITION'), nor = p.getAttribute('NORMAL');
    const v = [0, 0, 0], nv = [0, 0, 0];
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, v);
      if (v[1] < 1.02) continue;
      const s = Math.sign(v[0]), ax = Math.abs(v[0]);
      const w = smooth(0.2, 0.28, ax);
      if (!w) continue;
      const a = -s * ANG * w, ca = Math.cos(a), sa = Math.sin(a);
      const dx = v[0] - s * SH[0], dy = v[1] - SH[1];
      pos.setElement(i, [s * SH[0] + dx * ca - dy * sa, SH[1] + dx * sa + dy * ca, v[2]]);
      if (nor) { nor.getElement(i, nv); nor.setElement(i, [nv[0] * ca - nv[1] * sa, nv[0] * sa + nv[1] * ca, nv[2]]); }
    }
  }

  // Farben: Teil = Materialname (vom Extraktor gesetzt). Kleine Primitive
  // sind Leuchten (Helm, Stiefel, Brust) — Deckcrew-Cyan.
  const cache = new Map();
  const mat = (key, f) => {
    if (!cache.has(key)) cache.set(key, f(doc.createMaterial(key)));
    return cache.get(key);
  };
  for (const m of root.listMeshes()) {
    const prims = m.listPrimitives();
    const part = prims[0]?.getMaterial()?.getName() || 'core';
    const big = prims.map((p) => (p.getIndices()?.getCount() ?? 0) / 3);
    prims.forEach((p, i) => {
      if (big[i] < 300) {
        p.setMaterial(mat('light', (x) => x.setBaseColorFactor([0.1, 0.6, 0.7, 1]).setEmissiveFactor([0.15, 0.85, 1])));
      } else if (part === 'helmet' && i === 2) {
        p.setMaterial(mat('visor', (x) => x.setBaseColorFactor([0.02, 0.05, 0.07, 1]).setMetallicFactor(0.6).setRoughnessFactor(0.08)));
      } else {
        const k = CREW_PAINT[part] || CREW_PAINT.core;
        p.setMaterial(mat(part, (x) => x.setBaseColorFactor([...hex(k.c), 1]).setRoughnessFactor(k.r).setMetallicFactor(k.m)));
      }
    });
  }
}

async function buildOne(kind, name, inPath) {
  const doc = await io.read(inPath);
  const root = doc.getRoot();
  const tris0 = countTris(root);
  if (kind === 'npc') prepareCrew(doc);
  dropJunk(doc, kind);
  let matfix = null, cover = null;
  if (kind === 'hall') {
    const fixFile = fileURLToPath(new URL(`hall/${name}.matfix.json`, SRC));
    cover = { before: coverage(doc) };
    if (existsSync(fixFile)) matfix = applyMatFix(doc, JSON.parse(readFileSync(fixFile, 'utf8')));
  }
  const attached = kind === 'hall' ? attachHallTextures(doc) : 0;
  if (cover) cover.after = coverage(doc);
  cleanMaterials(doc);
  stripAttributes(doc);
  await doc.transform(prune(), flatten(), dedup(), join({ keepNamed: false }), weld());

  // Dezimieren auf das Budget: Ratio aus der aktuellen Zahl, Fehler-
  // schwelle klein, damit Silhouette und UV-Nähte halten.
  // Reicht die kleine Schwelle nicht (Halle: viele flache Kitbash-Teile),
  // wird sie stufenweise gelockert.
  // Schiffe: Ränder bleiben fest und die Schwelle steigt nur bis 1 % —
  // stärker gelockert zersplitterte der C2-Rumpf (Löcher, abstehende Platten).
  // Ein großes Schiff behält dann eben mehr Dreiecke.
  const b = BUDGET[kind];
  const ladder = kind === 'ships' ? [0.002, 0.005, 0.01] : [0.004, 0.01, 0.02, 0.04];
  for (const error of ladder) {
    const now = countTris(root);
    if (now <= b.tris * 1.1) break;
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: b.tris / now, error, lockBorder: kind === 'ships' }));
  }
  // Farbe/Leuchten bis b.tex, alles übrige (Normalen, Masken) bis b.ntex
  await doc.transform(
    prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^(baseColor|emissive)/, resize: [b.tex, b.tex], quality: 82 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^(?!baseColor|emissive)/, resize: [b.ntex, b.ntex], quality: 80 }),
    draco({ method: 'edgebreaker', quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }),
  );
  // Nur noch das Nötige ankündigen
  doc.createExtension(KHRDracoMeshCompression).setRequired(true);
  doc.createExtension(EXTTextureWebP).setRequired(true);

  mkdirSync(new URL(`${kind}/`, OUT), { recursive: true });
  const outPath = fileURLToPath(new URL(`${kind}/${name}.glb`, OUT));
  await io.write(outPath, doc);
  const v = createHash('sha1').update(readFileSync(outPath)).digest('hex').slice(0, 8);
  return {
    url: `/hangar/${kind}/${name}.glb`, v,
    tris: countTris(root), trisRaw: tris0,
    textures: root.listTextures().length, attached, ...(matfix ? { matfix, cover } : {}),
    bytes: statSync(outPath).size,
  };
}

let prev = {};
try { prev = JSON.parse(readFileSync(MANIFEST, 'utf8')); } catch { /* erster Lauf */ }
const manifest = { ships: {}, hall: {}, npc: {} };
let built = 0, reused = 0;
for (const kind of Object.keys(BUDGET)) {
  const dir = new URL(`${kind}/`, SRC);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((x) => x.toLowerCase().endsWith('.glb'))) {
    const name = f.replace(/\.glb$/i, '');
    if (ONLY && name !== ONLY) { if (prev[kind]?.[name]) manifest[kind][name] = prev[kind][name]; continue; }
    const inPath = fileURLToPath(new URL(f, dir));
    const outPath = fileURLToPath(new URL(`${kind}/${name}.glb`, OUT));
    if (!FORCE && prev[kind]?.[name] && existsSync(outPath) && statSync(outPath).mtimeMs > statSync(inPath).mtimeMs) {
      manifest[kind][name] = prev[kind][name]; reused++; continue;
    }
    try {
      const r = await buildOne(kind, name, inPath);
      if (kind === 'hall') r.room = HALL_ROOM[name] ?? null;
      manifest[kind][name] = r; built++;
      console.log(`  ${kind}/${name.padEnd(28)} ${r.trisRaw.toLocaleString().padStart(8)} -> ${r.tris.toLocaleString().padStart(8)} Dreiecke  ${String(r.textures).padStart(3)} Texturen  ${(r.bytes / 1048576).toFixed(2)} MB`);
    } catch (err) {
      console.error(`  ${kind}/${name}: FEHLER ${err.stack || err.message}`);
    }
  }
}
await writeFile(MANIFEST, JSON.stringify({
  source: 'StarBreaker entity/socpak export -> gltf-transform (Draco, WebP)',
  ...manifest,
}, null, 2) + '\n', 'utf8');
console.log(`${built} gebaut, ${reused} unveraendert -> src/data/hangar-assets.json`);
