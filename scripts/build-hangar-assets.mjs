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
import { ALL_EXTENSIONS, KHRDracoMeshCompression, EXTTextureWebP, KHRTextureTransform } from '@gltf-transform/extensions';
import { dedup, prune, weld, flatten, join, simplify, draco, textureCompress, transformMesh } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3d';
import { creaseNormals } from './lib/crease-normals.mjs';
import { normalizeUvIslands, degenerateUvShare, texcoordBits } from './lib/uv-islands.mjs';
import { hallRaycaster, orientHallLights } from './lib/hall-lights.mjs';
import { hullLeaks, floorLevel } from './lib/hall-hull.mjs';
import sharp from 'sharp';
import { readdirSync, existsSync, mkdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
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
  // Halle wird nie dezimiert (siehe buildOne); die Zahl ist nur die
  // Warnschwelle. Die gelockerte Schwelle (bis 4 % der Hallengröße ≈ 7 m)
  // riss Kanten auf, und als die volle Stufe (1,24 Mio. Rohdreiecke) über
  // dem alten Budget von 700k lag, riss sie die Längswände auf (7748b0a).
  hall: { tris: 1600000, tex: 1024, ntex: 512 },
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
          diffuse_tex: sub.d, normal_tex: sub.n, spec_tex: sub.s, tile_d: sub.td, tile_n: sub.tn, blend: sub.blend, is_glass: /glass/i.test(sub.shader || ''),
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
  // Specular-Maps und Kachelung (TexMod) auch für die schon aufgelösten
  // Materialien nachtragen — die nennt der Export nicht
  for (const m of mats) {
    const [base, rest] = m.getName().split('_mtl_');
    const sub = rest && fix.mtls[base]?.find((s, i) => s.name && rest.startsWith(s.name + '_') && Number(rest.slice(s.name.length + 1)) === i);
    if (sub) m.setExtras({ ...m.getExtras(), spec_tex: sub.s, tile_d: sub.td, tile_n: sub.tn, blend: sub.blend });
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

// Zweite Blendschicht (CryEngine Illum %BLENDLAYER) in eine Farbkarte backen,
// in der Auflösung der Grundkarte (max. 1024, ohne Grundkarte 1024):
//   f   = saturate(pow(maske * (1 + BlendFactor), BlendFalloff))
//   out = mix(grund * Diffuse, schicht2 * BlendLayer2DiffuseColor, f)
// Im Spiel geht noch das Vertex-Alpha in f ein; die Vertexfarben verwerfen
// wir (COLOR_0, siehe stripAttributes), hier gilt es als 1. Schicht und
// Maske kacheln relativ zur Grundkarte (BlendLayer2Tiling, BlendMaskTiling,
// jeweils mal ihrem TexMod, geteilt durch das TexMod der Grundkarte).
// Metall-Grund (metal = { glossFile, roughBase, roughL2 }): die zweite
// Schicht ist Lack, also nicht metallisch. Dazu entsteht eine eigene
// metallicRoughness-Karte im selben UV-Raum: B (Metall) = 1 − f,
// G (Rauheit) = mix(Grund-Rauheit aus der Glätte, 1 − BlendLayer2Glossiness, f).
async function bakeBlend(baseFile, x, factor, metal = null) {
  const b = x.blend;
  const load = async (f, size) => {
    let img = sharp(f).removeAlpha();
    if (size) img = img.resize(size, size, { fit: 'fill' });
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    return { data, w: info.width, h: info.height, c: info.channels };
  };
  let base = null, W = 1024, H = 1024;
  if (baseFile) {
    const meta = await sharp(baseFile).metadata();
    const scale = Math.min(1, 1024 / Math.max(meta.width, meta.height));
    W = Math.max(4, Math.round(meta.width * scale)); H = Math.max(4, Math.round(meta.height * scale));
    base = await load(baseFile); if (base.w !== W) base = await load(baseFile, W);
  }
  const l2 = await load(texFile(b.d));
  const mk = await load(texFile(b.mask));
  const col = String(b.color || '1,1,1').split(',').map(Number);
  const black = /black/i.test(x.diffuse_tex || '');
  const bt = x.tile_d?.[0] || 1;
  const t2 = (b.tiling || 1) * (b.td?.[0] || 1) / bt, tm = (b.maskTiling || 1) * (b.tm?.[0] || 1) / bt;
  const sample = (img, u, v, ch) => {
    const xx = Math.floor((((u % 1) + 1) % 1) * img.w), yy = Math.floor((((v % 1) + 1) % 1) * img.h);
    return img.data[(yy * img.w + xx) * img.c + Math.min(ch, img.c - 1)];
  };
  const gl = metal?.glossFile ? await load(metal.glossFile) : null;
  const tg = (x.tile_n?.[0] || 1) / bt;   // Glätte kachelt mit dem TexMod der Normalen
  const out = Buffer.alloc(W * H * 3);
  const mr = metal ? Buffer.alloc(W * H * 3) : null;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const u = (i + 0.5) / W, v = (j + 0.5) / H;
    const m = sample(mk, u * tm, v * tm, 0) / 255;
    const f = Math.min(1, Math.max(0, Math.pow(m * (1 + b.factor), b.falloff || 1)));
    const p = (j * W + i) * 3;
    for (let ch = 0; ch < 3; ch++) {
      const g = black ? 0 : (base ? base.data[(j * W + i) * base.c + ch] : 255) * factor[ch];
      const s2 = sample(l2, u * t2, v * t2, ch) * col[ch];
      out[p + ch] = Math.round(g * (1 - f) + s2 * f);
    }
    if (mr) {
      const rb = gl ? 1 - sample(gl, u * tg, v * tg, 0) / 255 : metal.roughBase;
      mr[p] = 255;
      mr[p + 1] = Math.round((rb * (1 - f) + metal.roughL2 * f) * 255);
      mr[p + 2] = Math.round((1 - f) * 255);
    }
  }
  const png = (buf) => sharp(buf, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
  return { color: await png(out), mr: mr ? await png(mr) : null };
}

// Die Halle kommt ohne eingebettete Bilder: Texturen aus dem Cache anhängen.
// - CryEngine-Metall (Diffuse „conductor“, fast schwarz) bekommt statt
//   dessen seine Specular-Map: bei Metall ist das die Farbe.
// - Normalen: viele _ddna der Halle sind im Spiel selbst flach (jeder
//   BC5-Block kodiert 0/0/1). Die bringen nichts und fallen weg.
// - Rauheit: aus der Glätte im Alpha der _ddna (Extraktor: .gloss.png),
//   roughness = 1 − gloss, als metallicRoughness-Karte (G-Kanal; B voll,
//   der Metallfaktor des Materials bleibt maßgeblich).
// - Kachelung: TexMod TileU/TileV der .mtl über KHR_texture_transform.
async function attachHallTextures(doc) {
  const root = doc.getRoot();
  const cache = new Map();
  const tex = (file, name, image) => {
    if (!cache.has(file)) {
      cache.set(file, doc.createTexture(name).setImage(image ?? readFileSync(file)).setMimeType('image/png').setURI(name + '.png'));
    }
    return cache.get(file);
  };
  const flatCache = new Map();
  const isFlat = async (f) => {
    if (!flatCache.has(f)) {
      const [r, g] = (await sharp(f).stats()).channels;
      flatCache.set(f, r.max - r.min <= 3 && g.max - g.min <= 3);
    }
    return flatCache.get(f);
  };
  const roughImg = async (gloss) => {
    const { data, info } = await sharp(gloss).greyscale().raw().toBuffer({ resolveWithObject: true });
    const px = Buffer.alloc(info.width * info.height * 3);
    for (let i = 0; i < info.width * info.height; i++) { px[i * 3] = 255; px[i * 3 + 1] = 255 - data[i * info.channels]; px[i * 3 + 2] = 255; }
    return sharp(px, { raw: { width: info.width, height: info.height, channels: 3 } }).png().toBuffer();
  };
  const tt = doc.createExtension(KHRTextureTransform);
  const tile = (ti, t) => { if (ti && t) ti.setExtension('KHR_texture_transform', tt.createTransform().setScale(t)); };
  const s = { attached: 0, color: 0, normal: 0, flatNormals: 0, rough: 0, tiled: 0, blended: 0, blendMetal: 0, blendSkipped: 0 };
  // nur benutzte Materialien zählen (unbenutzte fallen später bei prune weg)
  const used = new Set(root.listMeshes().flatMap((me) => me.listPrimitives().map((p) => p.getMaterial())));
  for (const m of [...used].filter(Boolean)) {
    const x = m.getExtras() || {};
    const metal = /conductor/i.test(x.diffuse_tex || '');
    const d = texFile(metal ? x.spec_tex : x.diffuse_tex);
    // zweite Blendschicht einbacken. Auf Metall bekommt sie eine eigene
    // Metall/Rauheit-Karte, sonst würde der Lack darüber metallisch.
    const b2 = x.blend && texFile(x.blend.d) && texFile(x.blend.mask);
    if (b2 && !m.getBaseColorTexture()) {
      const key = `blend:${m.getName()}`;
      let factor = m.getBaseColorFactor(), metalOpt = null;
      if (metal) {
        // dieselbe Metallfarbe wie in cleanMaterials: Specular, ohne Specular-Map gedämpft
        const a = Object.fromEntries((x.semantic?.authored_attributes || []).map((t) => [t.name, t.value]));
        const spec = String(a.Specular || '0.7,0.7,0.7').split(',').map(Number);
        factor = spec.map((v) => Math.min(1, d ? v : v * 0.72));
        const nmf = texFile(x.normal_tex), glossFile = nmf && nmf.replace(/\.png$/, '.gloss.png');
        metalOpt = {
          glossFile: glossFile && existsSync(glossFile) ? glossFile : null,
          roughBase: Math.max(0.35, 1 - Number(a.Shininess || 150) / 255),
          roughL2: Math.max(0.15, 1 - (x.blend.gloss ?? 255) / 255),
        };
      }
      if (!cache.has(key)) {
        const r = await bakeBlend(d, x, factor, metalOpt);
        tex(key, 'b' + cache.size, r.color);
        if (r.mr) tex(`${key}:mr`, 'bm' + cache.size, r.mr);
      }
      // die Grundfarbe (Diffuse-Faktor) steckt jetzt in der Karte — sonst
      // färbte sie auch die zweite Schicht
      const alpha = m.getBaseColorFactor()[3];
      m.setBaseColorTexture(cache.get(key)).setBaseColorFactor([1, 1, 1, alpha]); s.attached++; s.blended++;
      if (metal) {
        m.setMetallicRoughnessTexture(cache.get(`${key}:mr`)).setMetallicFactor(1).setRoughnessFactor(1);
        m.setExtras({ ...m.getExtras(), blend_baked: true });
        s.blendMetal++;
      }
    } else if (x.blend) s.blendSkipped++;
    if (d && !m.getBaseColorTexture()) { m.setBaseColorTexture(tex(d, 'd' + cache.size)); s.attached++; if (metal) m.setExtras({ ...x, spec_used: true }); }
    const nm = texFile(x.normal_tex);
    if (nm && !m.getNormalTexture()) {
      if (await isFlat(nm)) s.flatNormals++;
      else { m.setNormalTexture(tex(nm, 'n' + cache.size)); s.attached++; }
    }
    const gloss = nm && nm.replace(/\.png$/, '.gloss.png');
    const glass = x.is_glass || /glass|canopy|window/i.test(m.getName());
    if (gloss && existsSync(gloss) && !glass && !m.getMetallicRoughnessTexture()) {
      if (!cache.has(gloss)) tex(gloss, 'r' + cache.size, await roughImg(gloss));
      m.setMetallicRoughnessTexture(cache.get(gloss)).setRoughnessFactor(1);
      s.rough++;
    }
    const td = x.tile_d, tn = x.tile_n;   // Normalen/Glätte haben ihr eigenes TexMod
    tile(m.getBaseColorTextureInfo(), td);
    tile(m.getNormalTextureInfo(), tn);
    // gebackene Metall/Rauheit-Karte liegt im UV-Raum der Farbkarte
    tile(m.getMetallicRoughnessTextureInfo(), m.getExtras()?.blend_baked ? td : tn);
    if (td || x.tile_n) s.tiled++;
    if (m.getBaseColorTexture()) s.color++;
    if (m.getNormalTexture()) s.normal++;
  }
  return s;
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
      if (x.blend_baked) { /* Farbe, Metall und Rauheit stecken in den gebackenen Karten */ }
      else if (x.spec_used) m.setBaseColorFactor([...spec.map((v) => Math.min(1, v)), 1]);
      else m.setBaseColorTexture(null).setBaseColorFactor([...spec.map((v) => Math.min(1, v * 0.72)), 1]);
      if (!x.blend_baked) m.setMetallicFactor(1);
      if (!m.getMetallicRoughnessTexture()) m.setRoughnessFactor(Math.max(0.35, 1 - shin / 255));
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

// Spiellampen der Halle -> public/hangar/hall/<halle>.lights.json (liest der
// Viewer neben dem GLB). Position und Richtung aus den KHR_lights_punctual-
// Knoten des Exports (Weltmatrix, glTF-Raum der Halle, Licht strahlt in −Z),
// Spieltyp, Spiel-Intensität und Radius aus <halle>.lights-src.txt (das
// Protokoll des Exports, siehe scripts/extract-hangar-sources.mjs), über den
// Namen verbunden. angle = voller Kegelwinkel in Grad. Schatten nennt der
// Export nicht: shadow bleibt false. Danach richtet orientHallLights die
// Richtungen aus (Spots aus dem Z-oben-Raum nach glTF, Flächenlichter von
// ihrer Fläche weg, siehe scripts/lib/hall-lights.mjs); v: 2 kennzeichnet das.
const LIGHT_TYPE = { Planar: 'area', Projector: 'spot', Omni: 'point', Ambient: 'ambient' };
function hallLights(doc, name) {
  const srcFile = fileURLToPath(new URL(`hall/${name}.lights-src.txt`, SRC));
  // Ohne Exportprotokoll kennt der Build weder Spieltyp noch Spielstärke: Die
  // Werte der Lichtknoten allein ergäben eine falsche Beleuchtung. Dann bleibt
  // die bisherige Lampenliste stehen, und der Hinweis sagt, was zu tun ist.
  if (!existsSync(srcFile)) return { missing: `hall/${name}.lights-src.txt` };
  const src = new Map();
  for (const line of readFileSync(srcFile, 'utf8').split('\n')) {
    const m = line.match(/^Light '(.+)' type=(\w+).*?intensity=([\d.e+-]+) radius=([\d.e+-]+)/);
    if (!m) continue;
    if (!src.has(m[1])) src.set(m[1], []);
    src.get(m[1]).push({ type: m[2], intensity: Number(m[3]), radius: Number(m[4]) });
  }
  const lights = [];
  for (const node of doc.getRoot().listNodes()) {
    const l = node.getExtension('KHR_lights_punctual');
    if (!l) continue;
    const w = node.getWorldMatrix();
    const len = Math.hypot(w[8], w[9], w[10]) || 1;
    const s = src.get(node.getName())?.shift();
    const type = s ? (LIGHT_TYPE[s.type] || 'point') : l.getType();
    const r3 = (v) => Math.round(v * 1000) / 1000;
    lights.push({
      type,
      pos: [w[12], w[13], w[14]].map(r3),
      dir: [-w[8] / len, -w[9] / len, -w[10] / len].map(r3),
      color: l.getColor().map(r3),
      intensity: s ? s.intensity : l.getIntensity(),
      radius: s ? s.radius : l.getRange() ?? 0,
      angle: l.getType() === 'spot' ? r3((l.getOuterConeAngle() * 2 * 180) / Math.PI) : null,
      shadow: false,
      name: node.getName(),
    });
  }
  const orient = orientHallLights(lights, hallRaycaster(doc));
  const outFile = fileURLToPath(new URL(`hall/${name}.lights.json`, OUT));
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify({ v: 2, lights }) + '\n');
  const byType = {};
  for (const l of lights) byType[l.type] = (byType[l.type] || 0) + 1;
  return { total: lights.length, byType, matched: lights.length - [...src.values()].reduce((n, a) => n + a.length, 0), orient };
}

// Halle: Einrichtung bleibt drin (Spielobjekte gehören in die Halle). Nur
// gezählt für die Selbstauskunft.
const FURNITURE = /props_|flower_|footlocker|shrub_|plant|crate|couch|chair|table|locker/i;

// Einrichtung bleibt eigener Knoten mit Bezugspunkt: Für große Schiffe wächst
// die Halle mit (Faktor bis ≈ 3), und eingeschmolzen in die Hülle wüchsen
// Kisten und Spinde mit. So hält der Viewer jedes Möbel an seinem Platz in
// Originalgröße (extras.anchor = Weltposition seiner Wurzel). Alles andere
// verliert seinen Namen, damit join({ keepNamed: true }) es weiter
// zusammenlegt. Vor flatten() aufrufen: danach fehlt die Hierarchie.
function markFurniture(doc) {
  const root = doc.getRoot();
  const isF = (n) => FURNITURE.test(`${n.getName()} ${n.getMesh()?.getName() || ''}`);
  const parentOf = new Map();
  for (const n of root.listNodes()) for (const c of n.listChildren()) parentOf.set(c, n);
  const rootOf = (n) => { let r = null; for (let q = n; q; q = parentOf.get(q)) if (isF(q)) r = q; return r; };
  const ids = new Map();
  let nodes = 0;
  const named = new Set();
  for (const n of root.listNodes()) {
    const r = rootOf(n);
    if (!r) { n.setName(''); continue; }
    if (!n.getMesh()) continue;
    if (!ids.has(r)) ids.set(r, ids.size);
    const id = ids.get(r);
    n.setExtras({ ...n.getExtras(), furniture: id, anchor: r.getWorldTranslation().map((v) => Math.round(v * 1000) / 1000) });
    n.setName(`furniture_${id}_${nodes}`);
    named.add(n.getMesh());
    nodes++;
  }
  for (const m of root.listMeshes()) if (!named.has(m)) m.setName('');
  return { roots: ids.size, nodes };
}
const drawCalls = (root) => root.listNodes().reduce((n, x) => n + (x.getMesh()?.listPrimitives().length || 0), 0);
// Materialien, die ohne die Spiel-Laufzeit falsch aussehen: Lichtkegel- und
// Blendenkarten (schweben als Splitter neben dem Rumpf), zur Laufzeit
// gerenderte Schriftzüge und Schablonen (ohne Bild: weiße Flächen).
const DROP_MAT = /headlight_glow|_flare|lens_?flare|light_?(beam|cone|shaft)|RTT_|stencil/i;

function dropJunk(doc) {
  const root = doc.getRoot();
  let dropped = 0;
  for (const node of root.listNodes()) {
    if (DROP.test(node.getName() || '') || (node.getMesh() && DROP.test(node.getMesh().getName() || ''))) {
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
  // Halle: Einrichtung zählen und Spiellampen herausschreiben, bevor
  // flatten/join die Knotennamen und cleanMaterials die Lichter verwirft
  const furniture = kind === 'hall' ? root.listNodes().filter((n) => n.getMesh() && FURNITURE.test(`${n.getName()} ${n.getMesh().getName()}`)).length : null;
  const lights = kind === 'hall' ? hallLights(doc, name) : null;
  dropJunk(doc);
  let matfix = null, cover = null;
  if (kind === 'hall') {
    const fixFile = fileURLToPath(new URL(`hall/${name}.matfix.json`, SRC));
    cover = { before: coverage(doc) };
    if (existsSync(fixFile)) matfix = applyMatFix(doc, JSON.parse(readFileSync(fixFile, 'utf8')));
  }
  const attached = kind === 'hall' ? await attachHallTextures(doc) : 0;
  if (cover) cover.after = coverage(doc);
  cleanMaterials(doc);
  stripAttributes(doc);
  const furnitureNodes = kind === 'hall' ? markFurniture(doc) : null;
  await doc.transform(prune(), flatten(), dedup(), join({ keepNamed: kind === 'hall' }), weld());
  if (furnitureNodes) furnitureNodes.drawCalls = drawCalls(root);

  // Dezimieren auf das Budget: Ratio aus der aktuellen Zahl, Fehler-
  // schwelle klein, damit Silhouette und UV-Nähte halten.
  // Reicht die kleine Schwelle nicht (Halle: viele flache Kitbash-Teile),
  // wird sie stufenweise gelockert.
  // Schiffe: Ränder bleiben fest und die Schwelle steigt nur bis 1 % —
  // stärker gelockert zersplitterte der C2-Rumpf (Löcher, abstehende Platten).
  // Ein großes Schiff behält dann eben mehr Dreiecke.
  // Die Halle nie: Ihre Bausatzteile sind große ebene Flächen mit Öffnungen;
  // in der Ebene kostet ein Kantenkollaps keinen Fehler, und der Vereinfacher
  // zieht Ränder über Öffnungen und reißt Wände auf (scripts/lib/hall-hull.mjs).
  const b = BUDGET[kind];
  const ladder = kind === 'ships' ? [0.002, 0.005, 0.01] : kind === 'hall' ? [] : [0.004, 0.01, 0.02, 0.04];
  for (const error of ladder) {
    const now = countTris(root);
    if (now <= b.tris * 1.1) break;
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: b.tris / now, error, lockBorder: kind === 'ships' }));
  }
  // Halle: Normalen mit Kantenwinkel neu, sonst helle Keile an jeder Fuge
  // (siehe scripts/lib/crease-normals.mjs).
  let crease = null;
  if (kind === 'hall') {
    crease = { corners: 0, changed: 0 };
    for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
      const r = creaseNormals(p);
      if (r) { crease.corners += r.corners; crease.changed += r.changed; }
    }
  }
  // UV-Inseln an den Ursprung holen, sonst zerquantisiert Draco die
  // gekachelten Spiel-UVs (siehe scripts/lib/uv-islands.mjs).
  const uvRange = { before: 0, after: 0 };
  for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
    for (const sem of ['TEXCOORD_0', 'TEXCOORD_1']) {
      const r = normalizeUvIslands(p, sem);
      if (r) { uvRange.before = Math.max(uvRange.before, r.before); uvRange.after = Math.max(uvRange.after, r.after); }
    }
  }
  const uvBits = Math.max(texcoordBits(root, 'TEXCOORD_0'), texcoordBits(root, 'TEXCOORD_1'));
  // Farbe/Leuchten bis b.tex, alles übrige (Normalen, Masken) bis b.ntex
  await doc.transform(
    prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^(baseColor|emissive)/, resize: [b.tex, b.tex], quality: 82 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^(?!baseColor|emissive)/, resize: [b.ntex, b.ntex], quality: 80 }),
    draco({ method: 'edgebreaker', quantizePosition: kind === 'hall' ? 16 : 14, quantizeNormal: 10, quantizeTexcoord: uvBits }),
  );
  // Nur noch das Nötige ankündigen
  doc.createExtension(KHRDracoMeshCompression).setRequired(true);
  doc.createExtension(EXTTextureWebP).setRequired(true);

  mkdirSync(new URL(`${kind}/`, OUT), { recursive: true });
  const outPath = fileURLToPath(new URL(`${kind}/${name}.glb`, OUT));
  await io.write(outPath, doc);
  // Selbstauskunft gegen das geschriebene Artefakt, nicht gegen den Zwischenstand
  const written = await io.read(outPath);
  const uvDeg = degenerateUvShare(written.getRoot());
  // Halle: Dichtheit der Hülle und Bodenhöhe (der Viewer lotet sie sonst
  // beim Laden selbst nach), beides gegen das geschriebene GLB
  const room = kind === 'hall' ? HALL_ROOM[name] : null;
  const rc = room ? hallRaycaster(written) : null;
  const hull = room ? hullLeaks(written, room, { rc }) : null;
  const floor = room ? floorLevel(written, room, { rc }) : null;
  // Version deckt die Lampenliste mit ab: der Viewer lädt sie mit demselben ?v=
  const hash = createHash('sha1').update(readFileSync(outPath));
  const lightsPath = outPath.replace(/\.glb$/, '.lights.json');
  if (lights && existsSync(lightsPath)) hash.update(readFileSync(lightsPath));
  const v = hash.digest('hex').slice(0, 8);
  return {
    url: `/hangar/${kind}/${name}.glb`, v,
    tris: countTris(root), trisRaw: tris0,
    textures: root.listTextures().length, attached, ...(matfix ? { matfix, cover } : {}),
    ...(lights ? { lights, furniture } : {}),
    ...(furnitureNodes ? { furnitureNodes } : {}),
    ...(crease ? { crease: { corners: crease.corners, changedPct: Math.round(crease.changed / Math.max(1, crease.corners) * 1000) / 10 } } : {}),
    uv: { rangeBefore: Math.round(uvRange.before), rangeAfter: Math.round(uvRange.after * 100) / 100, bits: uvBits, degenerate: Math.round(uvDeg.share * 1000) / 10 },
    ...(hull ? { hull } : {}),
    ...(floor != null ? { floor } : {}),
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
    // Wiederverwenden nur, wenn das Ergebnis jünger ist als alle Eingaben:
    // bei der Halle zählen Lampenprotokoll und Materialnachtrag mit, und ihre
    // Lampenliste muss schon da sein.
    const side = kind === 'hall' ? ['lights-src.txt', 'matfix.json'].map((x) => fileURLToPath(new URL(`${name}.${x}`, dir))).filter((x) => existsSync(x)) : [];
    const lightsOut = fileURLToPath(new URL(`${kind}/${name}.lights.json`, OUT));
    const fresh = existsSync(outPath) && [inPath, ...side].every((x) => statSync(outPath).mtimeMs > statSync(x).mtimeMs)
      && (kind !== 'hall' || !side.some((x) => x.endsWith('.lights-src.txt')) || (existsSync(lightsOut) && side.every((x) => statSync(lightsOut).mtimeMs > statSync(x).mtimeMs)));
    if (!FORCE && prev[kind]?.[name] && fresh) {
      manifest[kind][name] = prev[kind][name]; reused++; continue;
    }
    try {
      const r = await buildOne(kind, name, inPath);
      if (kind === 'hall') r.room = HALL_ROOM[name] ?? null;
      manifest[kind][name] = r; built++;
      console.log(`  ${kind}/${name.padEnd(28)} ${r.trisRaw.toLocaleString().padStart(8)} -> ${r.tris.toLocaleString().padStart(8)} Dreiecke  ${String(r.textures).padStart(3)} Texturen  ${(r.bytes / 1048576).toFixed(2)} MB`);
      if (r.crease) console.log(`    Normalen: ${r.crease.changedPct} % der Ecken über Kanten geglättet, neu berechnet`);
      if (r.furnitureNodes) console.log(`    Einrichtung: ${r.furnitureNodes.roots} Möbel in ${r.furnitureNodes.nodes} eigenen Knoten (Originalgröße im Viewer), Halle ${r.furnitureNodes.drawCalls} Draw-Calls`);
      if (r.hull) {
        // heile Halle: 0,04 %; aufgerissene Längswände: 1,1 bis 2,3 %
        const where = Object.entries(r.hull.walls).filter(([, n]) => n).sort((p, q) => q[1] - p[1]).map(([k, n]) => `${k} ${n}`).join(', ');
        console.log(`    Hülle: ${r.hull.pct} % von ${r.hull.rays.toLocaleString()} Blickstrahlen aus dem Raum treffen nichts${r.hull.pct > 0.5 ? ` — WARNUNG: Löcher in der Hülle (${where}; x = Längswände, z = Stirnwände, y = Decke/Boden)` : ''}`);
      }
      if (kind === 'hall' && r.tris > BUDGET.hall.tris) console.log(`    WARNUNG Halle: ${r.tris.toLocaleString()} Dreiecke über der Warnschwelle von ${BUDGET.hall.tris.toLocaleString()} (nicht dezimiert)`);
      console.log(`    UV: Bereich ${r.uv.rangeBefore} -> ${r.uv.rangeAfter}, ${r.uv.bits} Bit, ${r.uv.degenerate} % Dreiecke ohne UV-Fläche`);
      if (r.attached?.color !== undefined) {
        const a = r.attached;
        console.log(`    Selbstauskunft: ${r.cover.after.materials} Materialien, ${a.color} mit Farbe, ${a.normal} mit Normalen, ${a.rough} mit Rauheit, ${a.tiled} gekachelt; ${a.flatNormals} flache Normalen verworfen; ${a.blended} mit eingebackener Blendschicht (davon ${a.blendMetal} auf Metall, ${a.blendSkipped} ausgelassen); ${r.cover.after.trisOhneMaterial} Dreiecke ohne Material`);
      }
      if (r.lights?.missing) {
        console.log(`    WARNUNG Lampen: Exportprotokoll fehlt (${r.lights.missing}). Lampenliste nicht erneuert; Halle mit dem Extraktor neu exportieren (--force).`);
      } else if (r.lights) {
        const t = Object.entries(r.lights.byType).map(([k, n]) => `${n} ${k}`).join(', ');
        console.log(`    Halle: ${r.tris.toLocaleString()} Dreiecke, ${r.furniture} Einrichtungsobjekte, ${r.lights.total} Lichter (${t}; ${r.lights.matched} mit Spieltyp), ${(r.bytes / 1048576).toFixed(2)} MB`);
        const o = r.lights.orient;
        if (o) console.log(`    Lampen: ${o.spots} Spots umgerechnet (${o.spotsAway} von ${o.spotsMounted} montierten zeigen von ihrer Fläche weg), ${o.areaMounted} von ${o.area} Flächenlichtern an ihrer Fläche ausgerichtet`);
      }
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
