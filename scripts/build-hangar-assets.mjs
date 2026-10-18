// Baut aus rohen, TEXTURIERTEN StarBreaker-Exporten die Web-Modelle der
// Hangar-Seite (assets/hangar-viewer.js): Schiffe mit echtem Lack, die Halle,
// die Hangar-Crew.
//
// Eingabe (gitignored, von scripts/extract-hangar-sources.mjs):
//   .cache/hangar-src/ships/<slug>.glb       entity export --materials textures
//   .cache/hangar-src/hall/<key>.glb         socpak export (Texturen NUR als Pfad)
//   .cache/hangar-src/tex/<p4k-pfad>.png     dazu dekodierte Hallen-Texturen
//   .cache/hangar-src/npc/<key>.glb          entity export eines NPC-Archetyps
//   .cache/hangar-src/weapons/<datei>.glb    entity export einer Bordwaffe (+ .json)
// Ausgabe:
//   public/hangar/{ships,weapons,hall,npc}/<name>.glb   dezimiert, Draco, WebP-Texturen
//   src/data/hangar-assets.json                 Manifest (url, v, tris, bytes)
//
// Rohe Spieldateien werden NIE eingecheckt — nur diese Ausgabe.
//
// Usage:  node scripts/build-hangar-assets.mjs [--only <name>] [--force]
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression, EXTTextureWebP, KHRTextureTransform } from '@gltf-transform/extensions';
import { dedup, prune, weld, flatten, join, simplify, draco, textureCompress, transformMesh, transformPrimitive, getBounds, mergeDocuments, unpartition } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3d';
import { creaseNormals } from './lib/crease-normals.mjs';
import { sample as sampleCaf } from './lib/ivo-caf.mjs';
import { normalizeUvIslands, degenerateUvShare, texcoordBits } from './lib/uv-islands.mjs';
import { sealSeams, seamStats } from './lib/hall-seams.mjs';
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
  // Bordwaffen für den Tausch in der Layout-Werkstatt: klein am Schiff,
  // aus der Nähe aber angesehen (NDB-30 roh: 12.763 Dreiecke, 56 Texturen)
  weapons: { tris: 12000, tex: 256, ntex: 128 },
  // Aufzugsschacht: Bausatzteile, nie dezimiert; Grenze = Warnschwelle
  lift: { tris: 60000, tex: 1024, ntex: 512 },
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
          diffuse_tex: sub.d, normal_tex: sub.n, spec_tex: sub.s, tile_d: sub.td, tile_n: sub.tn, blend: sub.blend, vc: sub.vc, is_glass: /glass/i.test(sub.shader || ''),
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
      // Markierung für die Selbstauskunft der Vertexfarben (stripAttributes)
      else if (m) { p.setMaterial(m).setExtras({ ...p.getExtras(), matfix: true }); fixed++; }
    });
  }
  // Specular-Maps und Kachelung (TexMod) auch für die schon aufgelösten
  // Materialien nachtragen — die nennt der Export nicht
  for (const m of mats) {
    const [base, rest] = m.getName().split('_mtl_');
    const sub = rest && fix.mtls[base]?.find((s, i) => s.name && rest.startsWith(s.name + '_') && Number(rest.slice(s.name.length + 1)) === i);
    if (sub) m.setExtras({ ...m.getExtras(), spec_tex: sub.s, tile_d: sub.td, tile_n: sub.tn, blend: sub.blend, vc: sub.vc });
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
// Schiffe behalten palette_tint (Lackkanal A/B/C), aber nur an eigenen
// Materialien: der Rohexport markiert auch Gimbals, Feuerlöscher, Sitze usw.
// mit deren eigener Palette, und ein Schiffslack darf sie nicht umfärben.
// Ohne Quellangabe zählt das Material zum Schiff (Rumpf der 300i).
function cleanMaterials(doc, { paletteOwner } = {}) {
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
    const source = x.semantic?.palette?.source_name;
    const ownTint = paletteOwner && [1, 2, 3].includes(x.palette_tint) && (source == null || source === paletteOwner);
    m.setExtras(ownTint ? { palette_tint: x.palette_tint } : {});
  }
  for (const e of root.listExtensionsUsed()) {
    if (/lights_punctual|materials_(ior|transmission|volume)/.test(e.extensionName)) e.dispose();
  }
  for (const n of root.listNodes()) { n.setExtras({}); }
}

// Attribute, die three falsch deutet oder nicht braucht: COLOR_0 sind im
// Spiel Abnutzungs-Masken, three würde sie als Farbe multiplizieren.
// Ausnahme Halle: Materialien mit %VERTCOLORS (Extras vc, aus der .mtl)
// dunkelt das Spiel mit COLOR_0 ab (R = G = B, Paneel-Variation). Dort bleibt
// es, als normalisiertes UNORM8 VEC3 (Alpha weg; der Viewer liest Rot).
// Muss vor cleanMaterials laufen, das die Extras leert.
function stripAttributes(doc, kind) {
  const root = doc.getRoot();
  const usesUv1 = root.listTextureInfos?.().some((ti) => ti.getTexCoord() === 1);
  const buffer = root.listBuffers()[0];
  const vc = new Map();   // Material|eigen/matfix -> { tris, n, sumR, low }
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
    const c = p.getAttribute('COLOR_0');
    const mat = p.getMaterial();
    // Schacht (kind lift): VEC4 — im Alpha liegt die Mischmaske der Wear-Schicht
    // (HardSurface %WEAR_LAYER), siehe .planning/notes/hangar-schacht-tiefe.md
    const ch = kind === 'lift' ? 4 : 3;
    if ((kind === 'hall' || kind === 'lift') && c && mat?.getExtras()?.vc) {
      const n = c.getCount(), out = new Uint8Array(n * ch), v = [0, 0, 0, 1];
      const key = `${mat.getName()}|${p.getExtras()?.matfix ? 'matfix' : 'eigen'}`;
      const e = vc.get(key) || { tris: 0, n: 0, sumR: 0, low: 0 };
      for (let i = 0; i < n; i++) {
        c.getElement(i, v);
        for (let k = 0; k < ch; k++) out[i * ch + k] = Math.round(Math.min(1, Math.max(0, v[k] ?? 1)) * 255);
        e.sumR += v[0]; if (v[0] < 0.98) e.low++;
      }
      e.n += n; e.tris += (p.getIndices()?.getCount() ?? 0) / 3;
      vc.set(key, e);
      p.setAttribute('COLOR_0', doc.createAccessor().setType(ch === 4 ? 'VEC4' : 'VEC3').setArray(out).setNormalized(true).setBuffer(buffer));
    } else {
      p.setAttribute('COLOR_0', null);
    }
    p.setAttribute('TANGENT', null);
    if (!usesUv1) p.setAttribute('TEXCOORD_1', null);
  }
  return [...vc].map(([key, e]) => {
    const [material, origin] = key.split('|');
    return { material, origin, tris: Math.round(e.tris), meanR: Math.round((e.sumR / e.n) * 1000) / 1000, below098: Math.round((1000 * e.low) / e.n) / 10 };
  }).sort((a, b) => b.tris - a.tris);
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

// Tauschbare Bordwaffen bleiben eigene Knoten (Layout-Werkstatt): Der
// Viewer blendet die Serienwaffe eines Ports aus und setzt die gewählte an
// ihre Stelle. Im Rohexport hängt jede Waffe als Teilbaum unter ihrem Port
// (hardpoint_gun_nose -> Mount_Gimbal_S3 -> … -> GATS_BallisticGatling_S3);
// gefunden wird sie über die Klasse des Serienteils (ship-loadouts.json),
// außen zuerst, je Exemplar eines (Turm mit count 2: zwei). Jeder Mesh-Knoten
// darin trägt extras { swap: Port, item: Index im Port, inst, anchor: Welt-
// matrix der Waffenwurzel } und einen Namen, damit join() ihn nicht in den
// Rumpf schmilzt. Alles andere verliert seinen Namen und wird wie bisher
// zusammengelegt. Vor flatten() aufrufen: danach fehlt die Hierarchie.
const LOADOUTS = JSON.parse(readFileSync(new URL('../src/data/ship-loadouts.json', import.meta.url), 'utf8')).ships;
const round5 = (m) => Array.from(m, (v) => Math.round(v * 1e5) / 1e5);
function markSwapParts(doc, slug) {
  const root = doc.getRoot();
  const stock = new Map(Object.entries(LOADOUTS[slug] ?? {}).map(([k, v]) => [k.toLowerCase(), [k, v]]));
  const named = new Set();
  const ports = {};
  let nodes = 0;
  for (const hp of root.listNodes()) {
    const hit = stock.get(hp.getName().toLowerCase());
    if (!hit) continue;
    const [port, items] = hit;
    items.forEach((it, i) => {
      if (it.cat !== 'weapon' || !it.cls) return;
      const want = it.cls.toLowerCase();
      const roots = [];
      const walk = (n) => { for (const c of n.listChildren()) { if (c.getName().toLowerCase() === want) roots.push(c); else walk(c); } };
      walk(hp);
      roots.forEach((r, inst) => {
        const anchor = round5(r.getWorldMatrix());
        r.traverse((n) => {
          if (!n.getMesh()) return;
          n.setExtras({ ...n.getExtras(), swap: port, item: i, inst, anchor });
          n.setName(`swap_${nodes++}`);
          named.add(n);
          n.getMesh().setName(n.getName());
        });
      });
      if (roots.length) ports[items.length > 1 ? `${port}.${i}` : port] = roots.length;
    });
  }
  for (const n of root.listNodes()) if (!named.has(n)) n.setName('');
  const keep = new Set([...named].map((n) => n.getMesh()));
  for (const m of root.listMeshes()) if (!keep.has(m)) m.setName('');
  return { ports, nodes };
}

// Bordwaffe: auf den Rahmen ihrer Wurzel umrechnen (Knoten mit dem Entity-
// Namen aus <datei>.json, sonst das einzige Kind der Szenenwurzel). Der
// Viewer setzt sie dann mit der anchor-Matrix des Ports ins Schiff, und
// Achsdrehung wie Halterung kürzen sich heraus.
function prepareWeapon(doc, name) {
  const root = doc.getRoot();
  const scene = root.listScenes()[0];
  const metaFile = fileURLToPath(new URL(`weapons/${name}.json`, SRC));
  const meta = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, 'utf8')) : {};
  const stem = (meta.stem || '').toLowerCase();
  let base = stem ? root.listNodes().find((n) => n.getName().toLowerCase() === stem) : null;
  let by = base ? 'name' : null;
  if (!base) {
    const top = scene.listChildren();
    if (top.length === 1 && top[0].listChildren().length === 1) { base = top[0].listChildren()[0]; by = 'kind'; }
  }
  if (base) {
    const inv = invert4(base.getWorldMatrix());
    const wrap = doc.createNode('weapon_base').setMatrix(inv);
    for (const c of scene.listChildren()) { scene.removeChild(c); wrap.addChild(c); }
    scene.addChild(wrap);
  }
  return { key: meta.key || name, by: by || 'wurzel' };
}

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

// ─── Aufzugsschacht (.planning/notes/hangar-schacht.md) ─────────────────
// Der Schacht des Spiels ist ein Bausatz: Wandstücke 40 m breit (oben 20 m,
// unten 12 m hoch), Rippen über den Fugen, Ecken, Randleisten an der
// Bodenkante, Warnlampen. Aus dem socpak-Export des Hangars wird je Rolle
// EIN Exemplar genommen (alle an der Westwand x = −28 bzw. ihrer Nordecke),
// in sein eigenes Bezugssystem gelegt und als eigener Knoten geschrieben.
//
// Bezugssystem eines Wandteils: Ursprung an der unteren linken Ecke seiner
// Innenfläche (von der Schachtmitte aus gesehen), x nach rechts entlang der
// Wand, y nach oben, z zur Schachtmitte; die Wand selbst liegt bei z ≤ 0.
// Ecken: Ursprung in der inneren Schachtecke, das Schachtinnere liegt im
// Quadranten x > 0, z > 0 (die Wand rechts davon entlang +x, die
// Querwand entlang +z). Lampen: Ursprung im Mittelpunkt ihrer Montagefläche.
// Exportraum: glTF des socpak (x, z, −y), Hallenboden y −50, Schacht innen
// x ±28, z ±44, Wandunterkante y −86.
const LIFT_SHAFT = { inner: [56, 88], floorY: -50, bottomY: -86 };
// Westwand-Rahmen: Welt -> Teil, zL = z der linken Kante, yb = Unterkante
const wallFrame = (zL, yb, x0 = -28) => [
  0, 0, 1, 0,
  0, 1, 0, 0,
  -1, 0, 0, 0,
  zL, -yb, -x0, 1,
];
// gltf-transform: Spalten-Matrizen; wallFrame bildet (x, y, z) auf
// (zL − z, y − yb, x − x0) ab
const LIFT_PARTS = [
  { role: 'wall', size: [40, 32], frame: wallFrame(0, -86), take: [['hangar_ship_elevator_wall_40x20_top_a', [-30, 0, -20]], ['hangar_ship_elevator_wall_40x12_bot_a', [-29.5, 0, -20]]] },
  { role: 'wall_upper', size: [40, 20], frame: wallFrame(0, -74), take: [['hangar_ship_elevator_wall_40x20_top_a', [-30, 0, -20]]] },
  { role: 'rib', size: [8, 32], frame: wallFrame(4, -86), take: [['hangar_ship_elevator_rib_top_a', [-30.5, 0, 0]], ['hangar_ship_elevator_rib_bot_b', [-30.5, 0, 0]]] },
  { role: 'corner', size: [10, 10, 32], frame: wallFrame(44, -86), take: [['hangar_ship_elevator_corner_top_a', [-29, 0, 45]], ['hangar_ship_elevator_corner_bot_c', [-29, 0, 45]]] },
  { role: 'rim', size: [16, 3.88], frame: wallFrame(-4, -54), take: [['hangar_ship_elevator_trim_04x016_b', [-30.5, 0, -12]]] },
  { role: 'rim_8', size: [8, 3.88], frame: wallFrame(-36, -54), take: [['hangar_ship_elevator_trim_04x08_b', [-30.5, 0, -40]]] },
  { role: 'rim_corner', size: [5, 5, 3.88], frame: wallFrame(44, -54), take: [['hangar_ship_elevator_trim_corner_b', [-30.5, 0, 46.5]]] },
  // Warnlampe an der Wand (6× im Schacht, 9,4 m unter dem Boden) und an
  // den Schachtecken auf Bodenhöhe (4×)
  { role: 'light_0', game: 'light_hazard_2_d', frame: wallFrame(-0.045, -59.385), take: [['light_hazard_2_d', [-29, 0, 0]]] },
  { role: 'light_1', game: 'light_hazard_2_b', frame: wallFrame(44, -50), take: [['light_hazard_2_b', [-28.5, 0, 44.5]]] },
];

// Schachtlampen und Plattformlampen -> lights[] (Schachtrahmen: Ursprung
// Schachtmitte auf Hallenboden, Achsen wie der Export; die Spielwerte
// stehen wörtlich daneben). Rolle aus dem Lampennamen.
function liftLights(info) {
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const role = (n) => (n.match(/_ht_(?:pit|pad)_([a-z_]+?)(?:-\d+)?$/) || [])[1] || n;
  const one = (l, attach, pos) => ({
    name: l.name, role: role(l.name), attach, type: l.type,
    pos: pos.map(r3), ...(l.dir ? { dir: l.dir } : {}),
    color: l.emergency?.color, useTemperature: l.useTemperature, temperature: l.emergency?.temperature,
    intensity: l.emergency?.intensity, radius: l.radius, ...(l.fov && l.type === 'Projector' ? { angle: l.fov } : {}),
    states: { default: l.default, emergency: l.emergency, auxiliary: l.auxiliary },
    anim: { kind: 'lightStyle', style: l.emergency?.lightStyle ?? 0, speed: l.style?.animationSpeed ?? 1, lightanimation: l.style?.lightanimation || null },
  });
  const pit = (info.shaftLights || []).map((l) => {
    const n = one(l, 'shaft', [l.pos[0], l.pos[1] - LIFT_SHAFT.floorY, l.pos[2]]);
    if (/pit_omni/.test(l.name)) n.node = 'light_0';
    return n;
  });
  // Plattformlampen hängen am Plattform-Bone; Lage relativ zur Plattform-
  // oberkante (Spiel: Z oben -> glTF (x, z, −y))
  const pad = (info.padLights || []).map((l) => one(l, 'pad', [l.translation[0], l.translation[2], -l.translation[1]]));
  return [...pit, ...pad];
}

// public/hangar/lift/<name>.json neben dem GLB: Teile, Lampen, Fahrablauf.
// Alles aus <name>.entities.json (Extraktor); Abgeleitetes steht als solches da.
function writeLiftJson(name, parts, { extras = null, uv = null, proj = null } = {}) {
  const infoFile = fileURLToPath(new URL(`lift/${name}.entities.json`, SRC));
  if (!existsSync(infoFile)) throw new Error(`Aufzug ${name}: ${infoFile} fehlt (Extraktor mit "lift" laufen lassen)`);
  const info = JSON.parse(readFileSync(infoFile, 'utf8'));
  const lights = liftLights(info);
  // Projektormuster je Lampe (Pfad aus projectorParams, Bild klein daneben)
  const byName = new Map([...(info.shaftLights || []), ...(info.padLights || [])].map((l) => [l.name, l.projector]));
  for (const l of lights) { const pth = byName.get(l.name); if (pth) l.projector = { path: pth, url: proj?.get(pth.toLowerCase().replace(/\.(tif|dds)$/, ''))?.url ?? null }; }
  const plat = Object.values(info.anims || {})[0];
  const open = plat?.animations?.find((a) => a.name === 'door_open');
  const speed = plat?.doorAnimationSpeed || 1;
  const travel = LIFT_SHAFT.floorY - LIFT_SHAFT.bottomY;
  const runS = open?.seconds ? Math.round((open.seconds / speed) * 100) / 100 : null;
  const modules = Object.fromEntries(parts.map((p) => [p.role, { size: p.size ?? null, tris: p.tris, materials: p.materials, from: p.from }]));
  const out = {
    v: 1,
    source: {
      socpak: info.socpak, platform: info.platform?.geometry, gate: info.gate?.geometry,
      landingArea: info.landingArea?.dimensions,
      note: 'Spielbausatz des mittleren Hangars (hangar_medtop_001); Teile je ein Exemplar der Westwand bzw. ihrer Nordecke',
    },
    shaft: {
      inner: LIFT_SHAFT.inner, depth: travel, floorY: 0,
      frames: 'Wandteile: Ursprung untere linke Ecke der Innenfläche (von der Schachtmitte gesehen), x entlang der Wand nach rechts, y oben, z zur Schachtmitte, Wand bei z <= 0. Ecken (corner, rim_corner, light_1): Ursprung in der inneren Schachtecke, Schachtinneres bei x > 0, z > 0. light_0: Ursprung Mitte der Montagefläche. lights[].pos: Schachtmitte auf Hallenboden (y 0), x quer (56 m), z längs (88 m); attach "pad": relativ zur Plattformoberkante.',
      layout: 'Spiel: Längswand = Wand (40) + Rippe über der Fuge + Wand (40), Ecken 10 x 10 an den Enden; Querwand = Wand (40) mit Rippen an beiden Enden; Wand = oben 20 m + unten 12 m; Randleisten 16/8 m und Eckleiste über der Wandoberkante, Oberkante 0,12 m unter dem Hallenboden.',
    },
    modules: { ...modules, bottom: null },
    whole: null,
    lights,
    ...(extras ? { materials: extras.materials, deco: extras.deco, decals: extras.decals } : {}),
    ...(uv ? { uv } : {}),
    ...(proj ? { projectors: [...proj.values()] } : {}),
    motion: {
      travel: { m: travel, source: `Plattform-Entity Pos z ${LIFT_SHAFT.floorY} (Oberkante auf Hallenboden); Plattform im Ruhezustand des .cga mit Oberkante ${LIFT_SHAFT.bottomY}; Lichtgruppe der Plattform ParentOffsetPos z ${info.padLightGroup?.parentOffsetPos?.[2]?.toFixed(3)}` },
      animations: info.anims,
      duration: { s: runS, derived: true, source: `door_open/door_close je ${open?.frames} Bilder bei ${open?.fps} Bildern/s = ${open?.seconds} s, DoorAnimationSpeed ${speed} -> ${runS} s (Annahme: die Animation ist die ganze Fahrt)` },
      speed: { avg: runS ? Math.round((travel / runS) * 100) / 100 : null, derived: true, unit: 'm/s' },
      acceleration: { value: null, source: 'Kurve steckt in der .caf (Bone anim_pad001), nicht dekodiert; die Animationsereignisse sind leer' },
      pauses: { value: null, source: 'keine Pausen in den Daten; die Trackview-Sequenzen steuern nur Licht, Hologramm und Ton' },
      sequences: info.sequences,
      lightStates: {
        manager: info.manager,
        index: { 0: 'Off', 1: 'Default', 2: 'Auxiliary', 3: 'Emergency', 4: 'Cinematic' },
        indexSource: 'Reihenfolge der LightStateParams im Licht-Entity (off, default, auxiliary, emergency, cinematic); Zuordnung abgeleitet',
        preWarning: 'Herunterfahren (sq_…_doorclose_paddown): Lichtgruppen ab 0,83 s Emergency, ab 31,67 s Default. Hochfahren (sq_…_dooropen_padup): Emergency ab 0 s, ab 32,97 s Default.',
        pitLights: 'alle Schachtlampen sind im Default-Zustand aus (Intensität 0) und leuchten nur in Emergency, also während der Fahrt',
        lightStyle: 'Nummer wörtlich aus den Lampendaten; die Helligkeitskurve je Stil steht nicht in den Spieldateien (Engine)',
      },
    },
  };
  const file = fileURLToPath(new URL(`lift/${name}.json`, OUT));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(out) + '\n');
  return { file, lights: lights.length, deco: extras?.deco.length ?? 0, decoCount: extras?.deco.reduce((n, d) => n + d.count, 0) ?? 0, decals: extras?.decals.length ?? 0, decalCount: extras?.decals.reduce((n, d) => n + d.at.length, 0) ?? 0, wear: Object.values(extras?.materials ?? {}).filter((m) => m.wear).length, projectors: proj?.size ?? 0 };
}

// Schichtmaterialien (HardSurface/LayerBlend ohne eigene Karten): Karten der
// ersten Schicht aus <name>.layers.json (Extraktor) als Farbe/Normalen, die
// Tönung der Schicht als Grundfarbe, LayerTiling als Kachelung. attachHall-
// Textures hängt sie danach wie eigene Karten an.
function applyLayers(doc, name, dir = 'lift') {
  const f = fileURLToPath(new URL(`${dir}/${name}.layers.json`, SRC));
  if (!existsSync(f)) return { missing: true };
  const layers = JSON.parse(readFileSync(f, 'utf8'));
  const s = { materials: 0, textured: 0, glow: 0 };
  for (const m of doc.getRoot().listMaterials()) {
    const x = m.getExtras() || {};
    // Leuchtglas der Warnlampen (Illum, „glow“): leuchtet als Fläche, der Viewer schaltet es mit dem Lampenzustand
    if (x.shader === 'Illum' && /glow/i.test(m.getName())) { m.setExtras({ ...x, glow: true }); s.glow++; continue; }
    const l0 = x.layers?.[0];
    const L = !x.diffuse_tex && l0?.path && layers[l0.path.replace(/\\/g, '/')];
    if (!L || L.missing) continue;
    s.materials++;
    const t = L.tiling && L.tiling !== 1 ? [L.tiling, L.tiling] : undefined;
    m.setExtras({ ...x, diffuse_tex: L.d, normal_tex: L.n, tile_d: t, tile_n: t, layer: true });
    if (L.d) s.textured++;
    if (l0.tint_color) m.setBaseColorFactor([...l0.tint_color.slice(0, 3), m.getBaseColorFactor()[3]]);
    // Metallschicht ohne Farbkarte (z. B. steel_base_a): die Farbe ist ihr Specular
    const spec = String(L.specular || '0').split(',').map(Number);
    if (!L.d && spec[0] > 0.3) {
      const tint = l0.tint_color || [1, 1, 1];
      m.setBaseColorFactor([...spec.map((v, i) => Math.min(1, v * tint[i])), 1]).setMetallicFactor(1).setRoughnessFactor(Math.max(0.2, 1 - (L.shininess || 200) / 255));
      s.metal = (s.metal || 0) + 1;
    }
  }
  return s;
}

function prepareLift(doc, name) {
  const root = doc.getRoot();
  const scene = root.listScenes()[0];
  const base = (n) => (n.getMesh()?.getName() || '').replace(/.*[\\/]/, '').replace(/\.(cgf|cga)$/i, '');
  const nodes = root.listNodes().filter((n) => n.getMesh());
  const center = (n) => { const b = getBounds(n); return [0, 1, 2].map((i) => (b.min[i] + b.max[i]) / 2); };
  const parts = [];
  for (const p of LIFT_PARTS) {
    const mesh = doc.createMesh(p.role);
    const from = [];
    for (const [meshName, near] of p.take) {
      // das Exemplar, dessen Mitte (ohne Höhe) am nächsten an near liegt
      const cand = nodes.filter((n) => base(n) === meshName);
      if (!cand.length) throw new Error(`Aufzug ${name}: ${meshName} fehlt im Export`);
      const d = (n) => { const c = center(n); return Math.hypot(c[0] - near[0], c[2] - near[2]); };
      const n = cand.sort((a, b) => d(a) - d(b))[0];
      from.push(meshName);
      // Weltmatrix, dann ins Bezugssystem des Teils (Spaltenmatrizen: frame · world)
      const w = n.getWorldMatrix(), f = p.frame, m = new Array(16).fill(0);
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) m[c * 4 + r] += f[k * 4 + r] * w[c * 4 + k];
      // eigene Kopien: Exemplare teilen sich Mesh und Accessoren
      for (const prim of n.getMesh().listPrimitives()) {
        const q = prim.clone();
        for (const sem of q.listSemantics()) q.setAttribute(sem, prim.getAttribute(sem).clone());
        if (prim.getIndices()) q.setIndices(prim.getIndices().clone());
        transformPrimitive(q, m);
        mesh.addPrimitive(q);
      }
    }
    parts.push({ p, mesh, from });
  }
  for (const n of root.listNodes()) n.dispose();
  for (const { p, mesh } of parts) scene.addChild(doc.createNode(p.role).setMesh(mesh));
  return parts.map(({ p, mesh, from }) => ({
    role: p.role, from, size: p.size,
    tris: Math.round(mesh.listPrimitives().reduce((t, q) => t + (q.getIndices()?.getCount() ?? 0) / 3, 0)),
    materials: [...new Set(mesh.listPrimitives().map((q) => q.getMaterial()?.getName()))].length,
  }));
}
// ─── Schacht-Tiefe (.planning/notes/hangar-schacht-tiefe.md) ────────────
// Zusätze zum Bausatz, alle als eigene benannte Knoten:
// - deco_<rolle>_<n>: Beiwerk mit Decal-Material (Leitlinien, Chevrons,
//   Pfeile, Lichtrahmen). Geometrie aus skin export (Modellraum Z oben ->
//   glTF), Material = Untermaterial der überschriebenen .mtl. Ursprung am
//   Montagepunkt des Spielmodells, Achsen glTF; die Exemplare stehen in der
//   JSON (deco[].at, Schachtraum wie lights[].pos, dazu die volle Drehung).
// - decal_<rolle>_<n>: Decal-Objekte am Schachtrand (Einheitsquadrat 1 × 1 m
//   in XZ wie in der Werkstatt), Exemplare in decals[].at.
// - wear_<n>: je Schachtmaterial mit zweiter Schicht ein 1 × 1-m-Quadrat mit
//   deren Karten (Material „<name>_wear“); gemischt wird im Spiel über
//   COLOR_0.a (HardSurface %WEAR_LAYER), das der Bausatz jetzt mitträgt.
// Projektormuster der Lampen: public/hangar/lift/<name>-proj-<n>.webp.
const ROOT_INV = [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1];   // (x, y, z) -> (x, −z, y): hebt die Z-oben-Drehung des Exports auf
const ROOT_ZUP = [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1];   // (x, y, z) -> (x, z, −y)
const decoRole = (cgf) => (/light_fluorescent/.test(cgf) ? 'leuchte' : /light_set/.test(cgf) ? 'lichtrahmen' : /chevron/.test(cgf) ? 'chevron' : /arrow/.test(cgf) ? 'pfeil' : /frame/.test(cgf) ? 'rahmen'
  : /corner/.test(cgf) ? 'ecke' : /line|decal_8m/.test(cgf) ? 'leitlinie' : 'beiwerk');
const m4 = (a, b) => { const m = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) m[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return m; };
function quatOf(m) {
  // Drehung aus einer (uniform) skalierten 3×3-Matrix, Spaltenmatrix
  const sx = Math.hypot(m[0], m[1], m[2]), sy = Math.hypot(m[4], m[5], m[6]), sz = Math.hypot(m[8], m[9], m[10]);
  const r = [m[0] / sx, m[1] / sx, m[2] / sx, m[4] / sy, m[5] / sy, m[6] / sy, m[8] / sz, m[9] / sz, m[10] / sz];
  const tr = r[0] + r[4] + r[8];
  let q;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(r[5] - r[7]) / s, (r[6] - r[2]) / s, (r[1] - r[3]) / s, 0.25 * s]; }
  else if (r[0] > r[4] && r[0] > r[8]) { const s = Math.sqrt(1 + r[0] - r[4] - r[8]) * 2; q = [0.25 * s, (r[3] + r[1]) / s, (r[6] + r[2]) / s, (r[5] - r[7]) / s]; }
  else if (r[4] > r[8]) { const s = Math.sqrt(1 + r[4] - r[0] - r[8]) * 2; q = [(r[3] + r[1]) / s, 0.25 * s, (r[7] + r[5]) / s, (r[6] - r[2]) / s]; }
  else { const s = Math.sqrt(1 + r[8] - r[0] - r[4]) * 2; q = [(r[6] + r[2]) / s, (r[7] + r[5]) / s, 0.25 * s, (r[1] - r[3]) / s]; }
  return { q, scale: [sx, sy, sz] };
}
async function addLiftExtras(doc, name) {
  const root = doc.getRoot(), scene = root.listScenes()[0], buf = root.listBuffers()[0];
  const decoFile = fileURLToPath(new URL(`lift/${name}.deco.json`, SRC));
  const layersFile = fileURLToPath(new URL(`lift/${name}.layers.json`, SRC));
  const info = existsSync(decoFile) ? JSON.parse(readFileSync(decoFile, 'utf8')) : { deco: [], decals: [], decalMaterials: {} };
  const layerInfo = existsSync(layersFile) ? JSON.parse(readFileSync(layersFile, 'utf8')) : {};
  const lk = (p) => layerInfo[Object.keys(layerInfo).find((k) => k.toLowerCase() === String(p).toLowerCase().replace(/\\/g, '/'))] || null;
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const png = (file, label) => doc.createTexture(label).setImage(readFileSync(file)).setMimeType('image/png');
  const rgb = (s) => (s ? String(s).split(',').map(Number) : [1, 1, 1]);
  const quad = (sx, sz) => doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array([-sx / 2, 0, -sz / 2, sx / 2, 0, -sz / 2, sx / 2, 0, sz / 2, -sx / 2, 0, sz / 2])).setBuffer(buf))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0])).setBuffer(buf))
    .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array([0, 2, 1, 0, 3, 2])).setBuffer(buf));
  const out = { materials: {}, deco: [], decals: [] };

  // 1) Schichten aller Schachtmaterialien, Wear-Karten als eigenes Material
  let wi = 0;
  for (const m of root.listMaterials()) {
    const x = m.getExtras() || {};
    const man = x.semantic?.layer_manifest;
    if (!man?.length) continue;
    const layers = man.map((l) => { const L = lk(l.path) || {}; return { name: l.name, path: l.path, tint: l.tint_color, wearTint: l.wear_tint, glossMult: l.gloss_mult, wearGloss: l.wear_gloss, uvTiling: l.uv_tiling, snapshot: l.layer_snapshot, maps: { d: L.d ?? null, n: L.n ?? null, detail: L.detail ?? null }, layerTiling: L.tiling ?? null }; });
    const entry = { shader: x.shader, tokens: x.semantic?.decoded_string_gen_mask?.tokens, params: Object.fromEntries((x.semantic?.authored_public_params || []).map((p) => [p.name, p.value])), layers, blend: null };
    const W = layers[1];
    const wd = W && texFile(W.maps.d), wn = W && texFile(W.maps.n);
    if (W) entry.blend = /WEAR_LAYER/.test((entry.tokens || []).join(' ')) ? 'COLOR_0.a (Vertex-Alpha, HardSurface %WEAR_LAYER), WearBlendBase/WearDirtBlendFalloff in params' : 'nicht über die Vertexfarbe (kein %WEAR_LAYER)';
    if (wd) {
      const wname = `${m.getName()}_wear`, node = `wear_${wi++}`;
      const wm = doc.createMaterial(wname).setMetallicFactor(0).setBaseColorTexture(png(wd, `${node}_d`))
        .setBaseColorFactor([...(W.snapshot?.diffuse || [1, 1, 1]).map((v, i) => Math.min(1, v * (W.tint || [1, 1, 1])[i])), 1])
        .setRoughnessFactor(r3(1 - (W.snapshot?.shininess ?? 128) / 255 * (W.glossMult ?? 1)));
      if (wn) wm.setNormalTexture(png(wn, `${node}_n`));
      scene.addChild(doc.createNode(node).setMesh(doc.createMesh(node).addPrimitive(quad(1, 1).setMaterial(wm))));
      entry.wear = { material: wname, node };
    }
    out.materials[m.getName()] = entry;
  }

  // 2) Beiwerk mit Decal-Material
  const roleN = new Map();
  for (const d of info.deco || []) {
    if (d.missing || !d.glb) continue;
    const src = await io.read(fileURLToPath(new URL(d.glb, SRC)));
    const role = decoRole(d.cgf), n = roleN.get(role) || 0; roleN.set(role, n + 1);
    const node = `deco_${role}_${n}`;
    const mesh = doc.createMesh(node);
    const prims = src.getRoot().listMeshes().flatMap((me) => me.listPrimitives());
    prims.forEach((sp, i) => {
      const sub = d.subs?.[i] || d.subs?.[0];
      const p = doc.createPrimitive();
      for (const sem of ['POSITION', 'NORMAL', 'TEXCOORD_0']) {
        const a = sp.getAttribute(sem); if (!a) continue;
        p.setAttribute(sem, doc.createAccessor().setType(a.getType()).setArray(a.getArray().slice()).setBuffer(buf));
      }
      const idx = sp.getIndices();
      if (idx) p.setIndices(doc.createAccessor().setType('SCALAR').setArray(idx.getArray().slice()).setBuffer(buf));
      transformPrimitive(p, ROOT_ZUP);   // Modellraum Z oben -> glTF
      const mname = `${node}_${sub?.name || i}`;
      // Decal-Shader blenden; Leuchtengehäuse sind deckend, ihr Glas leuchtet
      const isDecal = /decal/i.test(sub?.shader || '') || /brand|decal/i.test(d.mtl || '');
      const mat = doc.createMaterial(mname).setAlphaMode(isDecal ? 'BLEND' : 'OPAQUE').setMetallicFactor(0)
        .setBaseColorFactor([...rgb(sub?.diffuse), Math.min(1, Number(sub?.opacity ?? 1))])
        .setRoughnessFactor(r3(Math.max(0.05, 1 - Number(sub?.shininess ?? 128) / 255)));
      const df = texFile(sub?.d);
      if (df) mat.setBaseColorTexture(png(df, `${mname}_d`));
      if (df && /glow/i.test(sub?.name || '')) mat.setEmissiveTexture(mat.getBaseColorTexture()).setEmissiveFactor([1, 1, 1]);
      // MeshDecal-Atlas der Lichtrahmen: TexSlot2 ist dort eine Specular-Karte, keine Normale
      const nf = texFile(sub?.n);
      if (nf && /_ddna\.png$/i.test(nf)) mat.setNormalTexture(png(nf, `${mname}_n`));
      mesh.addPrimitive(p.setMaterial(mat));
    });
    scene.addChild(doc.createNode(node).setMesh(mesh));
    const at = d.instances.map((w) => {
      const M = m4(w, ROOT_INV);
      const { q, scale } = quatOf(M);
      const yaw = Math.abs(q[0]) < 1e-3 && Math.abs(q[2]) < 1e-3 ? (2 * Math.atan2(q[1], q[3]) * 180) / Math.PI : null;
      return { at: [r3(M[12]), r3(M[13] - LIFT_SHAFT.floorY), r3(M[14]), yaw === null ? null : r3(yaw)], q: q.map((v) => Math.round(v * 1e4) / 1e4), scale: r3(scale[0]) };
    });
    out.deco.push({ node, kind: d.cgf, rolle: role, mtl: d.mtl, sub: (d.subs || []).map((s) => s.name), tris: prims.reduce((t, p) => t + (p.getIndices()?.getCount() ?? 0) / 3, 0), count: at.length, at });
  }

  // 3) Decal-Objekte am Schachtrand
  const dnodes = new Map(), dN = new Map();
  for (const mtl of [...new Set((info.decals || []).map((d) => d.material).filter(Boolean))]) {
    const m = info.decalMaterials?.[mtl]; if (!m || m.missing || !m.d) continue;
    const dFile = texFile(m.d); if (!dFile) continue;
    const role = decalRole(mtl), n = dN.get(role) || 0; dN.set(role, n + 1);
    const node = `decal_${role}_${n}`;
    const cbf = Number(m.params?.ColorBlendFactor ?? 1);
    const mat = doc.createMaterial(node).setBaseColorTexture(png(dFile, `${node}_d`))
      .setBaseColorFactor([...rgb(m.diffuse), r3(Math.min(1, Number(m.opacity ?? 1) * Math.min(1, cbf)))]).setAlphaMode('BLEND').setMetallicFactor(0)
      .setRoughnessFactor(r3(Math.max(0.05, 1 - Number(m.shininess ?? 128) / 255)));
    const nf = texFile(m.n); if (nf) mat.setNormalTexture(png(nf, `${node}_n`));
    scene.addChild(doc.createNode(node).setMesh(doc.createMesh(node).addPrimitive(quad(1, 1).setMaterial(mat))));
    dnodes.set(mtl, node);
    out.decals.push({ node, rolle: role, path: mtl, game: m, at: [] });
  }
  for (const d of info.decals || []) {
    const node = dnodes.get(d.material); if (!node) continue;
    const p = [d.pos[0], d.pos[2], -d.pos[1]];
    const floor = Math.abs(d.q[0]) < 0.02 && Math.abs(d.q[1]) < 0.02;
    out.decals.find((x) => x.node === node).at.push({ at: [r3(p[0]), r3(p[1] - LIFT_SHAFT.floorY), r3(p[2]), floor ? r3((2 * Math.atan2(d.q[2], d.q[3]) * 180) / Math.PI) : null], size: r3(2 * d.half), qGame: d.q });
  }
  return out;
}

// Projektormuster: ≤ 256 px WebP neben dem GLB, Pfad -> Datei
async function liftProjectors(name) {
  const ent = JSON.parse(readFileSync(fileURLToPath(new URL(`lift/${name}.entities.json`, SRC)), 'utf8'));
  const paths = [...new Set([...ent.shaftLights, ...ent.padLights].map((l) => l.projector).filter(Boolean))];
  const map = new Map();
  let i = 0;
  for (const p of paths) {
    const f = texFile(p); if (!f) continue;
    const key = p.toLowerCase().replace(/\.(tif|dds)$/, '');
    if ([...map.keys()].some((k) => k === key)) continue;
    const file = `${name}-proj-${i++}.webp`;
    const outPath = fileURLToPath(new URL(`lift/${file}`, OUT));
    await sharp(f).resize(256, 256, { fit: 'inside' }).webp({ quality: 85 }).toFile(outPath);
    map.set(key, { path: p, url: `/hangar/lift/${file}`, bytes: statSync(outPath).size });
  }
  return map;
}

// UV-Auskunft je Knoten und Material (vor dem Packen, also Spiel-UVs)
function uvReport(doc) {
  const rep = [];
  for (const n of doc.getRoot().listNodes()) {
    const me = n.getMesh(); if (!me) continue;
    for (const p of me.listPrimitives()) {
      const sets = p.listSemantics().filter((s) => /^TEXCOORD_/.test(s));
      const uv = p.getAttribute('TEXCOORD_0');
      let lo = [Infinity, Infinity], hi = [-Infinity, -Infinity], deg = 0, tris = 0;
      if (uv) {
        const t = [0, 0];
        for (let i = 0; i < uv.getCount(); i++) { uv.getElement(i, t); lo = [Math.min(lo[0], t[0]), Math.min(lo[1], t[1])]; hi = [Math.max(hi[0], t[0]), Math.max(hi[1], t[1])]; }
        const idx = p.getIndices();
        if (idx) for (let k = 0; k < idx.getCount(); k += 3) {
          const [a, b, c] = [idx.getScalar(k), idx.getScalar(k + 1), idx.getScalar(k + 2)].map((j) => uv.getElement(j, [0, 0]));
          tris++; if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) < 1e-10) deg++;
        }
      }
      rep.push({ node: n.getName(), material: p.getMaterial()?.getName() ?? null, sets, range: uv ? [lo, hi].map((v) => v.map((x) => Math.round(x * 100) / 100)) : null, noArea: tris ? Math.round((1000 * deg) / tris) / 10 : null });
    }
  }
  return rep;
}

async function buildOne(kind, name, inPath) {
  const doc = await io.read(inPath);
  const root = doc.getRoot();
  const tris0 = countTris(root);
  if (kind === 'npc') prepareCrew(doc);
  const weapon = kind === 'weapons' ? prepareWeapon(doc, name) : null;
  const liftParts = kind === 'lift' ? prepareLift(doc, name) : null;
  // keepAttributes: die Texturen hängen erst danach; ohne das wirft prune
  // TEXCOORD_0 als unbenutzt weg (Schacht-Tiefe: Wände ohne UVs)
  if (liftParts) await doc.transform(prune({ keepAttributes: true }));
  const liftExtras = liftParts ? await addLiftExtras(doc, name) : null;
  // Halle: Einrichtung zählen und Spiellampen herausschreiben, bevor
  // flatten/join die Knotennamen und cleanMaterials die Lichter verwirft
  const furniture = kind === 'hall' ? root.listNodes().filter((n) => n.getMesh() && FURNITURE.test(`${n.getName()} ${n.getMesh().getName()}`)).length : null;
  // leichte Stufe (<halle>-lod1, für Telefone): ohne Einrichtung und ohne
  // eigene Lampenliste — die Seite gibt ihr die der vollen Stufe
  const lite = isLite(kind, name);
  const lights = kind === 'hall' && !lite ? hallLights(doc, name) : null;
  if (lite) for (const n of root.listNodes()) if (n.getMesh() && FURNITURE.test(`${n.getName()} ${n.getMesh().getName()}`)) n.setMesh(null);
  dropJunk(doc);
  let matfix = null, cover = null;
  if (kind === 'hall' || kind === 'lift') {
    const fixFile = fileURLToPath(new URL(`${kind}/${name}.matfix.json`, SRC));
    cover = { before: coverage(doc) };
    if (existsSync(fixFile)) matfix = applyMatFix(doc, JSON.parse(readFileSync(fixFile, 'utf8')));
  }
  const layered = kind === 'lift' ? applyLayers(doc, name) : null;
  const attached = kind === 'hall' || kind === 'lift' ? await attachHallTextures(doc) : 0;
  if (cover) cover.after = coverage(doc);
  const vertexColors = stripAttributes(doc, kind);
  const liftUv = liftParts ? uvReport(doc) : null;
  cleanMaterials(doc, kind === 'ships' ? { paletteOwner: name.replace(/-/g, '_') } : {});
  const furnitureNodes = kind === 'hall' ? markFurniture(doc) : null;
  const swap = kind === 'ships' ? markSwapParts(doc, name) : null;
  await doc.transform(prune(), flatten(), dedup(), join({ keepNamed: kind === 'hall' || kind === 'lift' || kind === 'ships' }), weld());
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
  const ladder = kind === 'ships' ? [0.002, 0.005, 0.01] : kind === 'hall' || kind === 'lift' ? [] : [0.004, 0.01, 0.02, 0.04];
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
  // Dichte Hallenkopie: Nähte verschweißen und mit einem Raster für alle
  // Teile packen, sonst klaffen Paneelkanten (siehe scripts/lib/hall-seams.mjs).
  // Die Quelle zählt bis 0,1 mm als dicht, ihre Knoten tragen Rundungsrauschen.
  let seams = null;
  if (lite) {
    seams = { source: seamStats(doc, { eps: 1e-4 }) };
    seams.seal = sealSeams(doc, { tol: 1e-4 });
  }
  // Farbe/Leuchten bis b.tex, alles übrige (Normalen, Masken) bis b.ntex
  await doc.transform(
    prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^(baseColor|emissive)/, resize: [b.tex, b.tex], quality: 82 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^(?!baseColor|emissive)/, resize: [b.ntex, b.ntex], quality: 80 }),
    draco({
      method: 'edgebreaker', quantizeNormal: 10, quantizeTexcoord: uvBits,
      // dichte Kopie: ein Raster für die ganze Halle, 18 Bit (≈ 0,7 mm)
      ...(lite ? { quantizePosition: 18, quantizationVolume: 'scene' } : { quantizePosition: kind === 'hall' ? 16 : 14 }),
    }),
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
  const palette = kind === 'ships' ? { 1: 0, 2: 0, 3: 0 } : null;
  if (palette) for (const m of written.getRoot().listMaterials()) { const t = m.getExtras()?.palette_tint; if (t in palette) palette[t]++; }
  if (seams) seams.written = seamStats(written);
  // Halle: Dichtheit der Hülle und Bodenhöhe (der Viewer lotet sie sonst
  // beim Laden selbst nach), beides gegen das geschriebene GLB
  const room = kind === 'hall' ? HALL_ROOM[name.replace(/-lod1$/, '')] : null;
  const rc = room ? hallRaycaster(written) : null;
  const hull = room ? hullLeaks(written, room, { rc }) : null;
  const floor = room ? floorLevel(written, room, { rc }) : null;
  // Version deckt die Lampenliste mit ab: der Viewer lädt sie mit demselben ?v=
  const hash = createHash('sha1').update(readFileSync(outPath));
  const lightsPath = outPath.replace(/\.glb$/, '.lights.json');
  if (lights && existsSync(lightsPath)) hash.update(readFileSync(lightsPath));
  const liftProj = liftParts ? await liftProjectors(name) : null;
  const liftJson = liftParts ? writeLiftJson(name, liftParts, { extras: liftExtras, uv: liftUv, proj: liftProj }) : null;
  if (liftJson) hash.update(readFileSync(liftJson.file));
  for (const pj of liftProj?.values() ?? []) hash.update(readFileSync(fileURLToPath(new URL(pj.url.replace(/^\/hangar\//, ''), OUT))));
  const v = hash.digest('hex').slice(0, 8);
  return {
    url: `/hangar/${kind}/${name}.glb`, v,
    ...(liftJson ? { json: `/hangar/lift/${name}.json`, parts: liftParts, lightCount: liftJson.lights, layered, deco: liftJson.deco, decals: liftJson.decals, projectors: liftJson.projectors } : {}),
    tris: countTris(root), trisRaw: tris0,
    textures: root.listTextures().length, attached, ...(matfix ? { matfix, cover } : {}),
    ...(lights ? { lights, furniture } : {}),
    ...(vertexColors.length ? { vertexColors } : {}),
    ...(seams ? { seams } : {}),
    ...(furnitureNodes ? { furnitureNodes } : {}),
    ...(swap ? { swap: swap.ports, swapNodes: swap.nodes } : {}),
    ...(palette ? { palette } : {}),
    ...(weapon ? { key: weapon.key, anchorBy: weapon.by } : {}),
    ...(crease ? { crease: { corners: crease.corners, changedPct: Math.round(crease.changed / Math.max(1, crease.corners) * 1000) / 10 } } : {}),
    uv: { rangeBefore: Math.round(uvRange.before), rangeAfter: Math.round(uvRange.after * 100) / 100, bits: uvBits, degenerate: Math.round(uvDeg.share * 1000) / 10 },
    ...(hull ? { hull } : {}),
    ...(floor != null ? { floor } : {}),
    bytes: statSync(outPath).size,
  };
}

// ─── Werkstatt (.planning/notes/hangar-werkstatt.md) ────────────────────
// Arbeitsgerät, Boden-Decals und Bodenmaterialien aus dem Industrie-Hangar
// util_a/hangar_medtop_002 (Extraktor-Teil „werkstatt“), dazu ihre Anordnung
// um das Landefeld. Zwei GLBs: werkstatt.glb (Requisiten) und
// werkstatt-boden.glb (Decals und Bodenmuster), eine gemeinsame JSON.
//
// Requisit: je Art ein Exemplar, Gierung herausgedreht, Ursprung unten
// mittig, +Y oben, Meter. Die Vorderseite des Spiels (lokale +Y des Modells)
// liegt dann bei −Z. Die Anordnung nennt jedes Exemplar im Spiel mit Lage
// relativ zur Feldmitte (glTF-Achsen, Y oben), Gierung um Y in Grad und
// Maßstab.
const WERK = { key: 'util-medtop002', lite: 'util-medtop002-lod1' };
// Rolle, Mesh, Stufe (0 = volle; 1, wenn die volle über dem Budget liegt)
const WERK_PROPS = [
  ['diagnose', 'console_diagnostic_2_a', 1], ['diagnose', 'console_diagnostic_1_a', 1],
  ['generator', 'generator_mobile_1_b', 0, 'gross'], ['generator', 'generator_mobile_1_pirate_a', 1],
  ['schlauch', 'lt_airduct_hose_straight_8m_a', 0], ['schlauch', 'lt_airduct_hose_torn_a', 0], ['schlauch', 'fire_hose_1_a', 0],
  ['kabeltrommel', 'cable_reel_6_a', 0], ['kabeltrommel', 'cable_reel_2_a', 0], ['kabeltrommel', 'cable_reel_11_a', 0],
  ['kabel', 'cable_straight_3_cable_2m_a', 0], ['kabel', 'cable_straight_08x01x02_e', 0], ['kabel', 'cable_bend_2_a', 0],
  ['gasflasche', 'tank_gas_2_025x0125x0125_a', 1], ['gasflasche', 'tank_gas_1_0125x0125x0125_a', 0], ['treibstoff', 'cell_fuel_1_a', 0],
  ['fass', 'drum_dry_1_a', 0], ['heizer', 'heater_freestanding_1_a', 1],
  ['werkzeug', 'tool_welder_a', 0], ['werkzeug', 'tool_power_1_drill_a', 0], ['werkzeug', 'tool_manual_1_ratchet_a', 0],
  ['wagen', 'trolley_cargo_4_a', 1], ['kiste', 'crate_weapon_4_015x0075x0075_a', 0], ['kiste', 'crate_metal_2_01x005x0025_a', 0],
  ['stapler', 'machine_forklift_1_extension_tank_a', 0],
];
const WERK_BUDGET = { prop: 8000, gross: 20000, all: 150000 };
// Anordnung: Exemplare bis 40 m um das Feld, Unterkante bis 4 m über dem Boden
const WERK_REACH = 40;
const WERK_FLOORS = [
  { name: 'asphalt', material: 'util_a_default_mtl_asphalt_bare_025' },
  { name: 'paneel', material: 'util_a_default_mtl_secondary_tint_panel_floor_b_048' },
];
// Decal-Rolle aus dem Materialpfad (Materials/Decals/<ordner>/<name>)
const decalRole = (p) => {
  const [dir, n] = p.toLowerCase().split('/').slice(-2);
  if (dir === 'oil') return 'oel';
  if (dir === 'weathered') return /oil/.test(n) ? 'oel' : 'abnutzung';
  if (dir === 'rubber_dmg') return 'abrieb';
  if (dir === 'scratches') return 'kratzer';
  if (dir === 'puddles') return 'pfuetze';
  if (dir === 'streaks') return /tire/.test(n) ? 'reifenspur' : 'schmutz';
  if (dir === 'manmade_marking') return 'markierung';
  if (dir === 'dirty_rust') return 'rost';
  if (dir === 'dust') return 'staub';
  if (dir === 'leakings') return 'laufspur';
  if (dir === 'water') return 'pfuetze';
  if (dir === 'cracks' || (dir === 'concrete' && /crack/.test(n))) return 'riss';
  if (dir === 'concrete') return 'betonschutt';
  return dir;
};
// Nicht in eine Werkstatt: Blutspritzer (stehen im Spiel auch auf Böden),
// Frost und Eis (Wetter am Tor, keine Arbeitsspur)
const DECAL_SKIP = /blood|frost|_ice_/i;
// Boden-Decals nur am Feld (Rand wie die Requisiten wäre bis an die Wände)
const DECAL_REACH = 14;

const r3 = (v) => Math.round(v * 1000) / 1000;
const yawOf = (w) => Math.atan2(-w[2], w[0]);   // Drehung um Y, die lokale X auf (cos, 0, −sin) bringt
const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; };
const mul = (a, b) => { const m = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) m[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return m; };
const apply = (m, v) => [0, 1, 2].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r]);
const meshKey = (n) => (n.getMesh()?.getName() || '').replace(/.*[\\/]/, '').replace(/\.(cgf|cga)$/i, '');

// Ein Dokument auf die Requisiten einer Stufe zuschneiden: je Mesh das erste
// Exemplar, gebacken (Gierung heraus, Ursprung unten mittig). Gibt je Mesh
// den Bezugspunkt im Modellraum zurück, damit die Anordnung jedes Exemplar
// auf denselben Ursprung bezieht.
function cutProps(doc, want) {
  const root = doc.getRoot(), scene = root.listScenes()[0];
  const first = new Map();
  for (const n of root.listNodes()) { const k = meshKey(n); if (want.has(k) && !first.has(k)) first.set(k, n); }
  const made = new Map();
  for (const [k, n] of first) {
    const w = n.getWorldMatrix(), yaw = yawOf(w);
    const t = mul(rotY(-yaw), w);
    const mesh = doc.createMesh(want.get(k));
    for (const prim of n.getMesh().listPrimitives()) {
      const q = prim.clone();
      for (const sem of q.listSemantics()) q.setAttribute(sem, prim.getAttribute(sem).clone());
      if (prim.getIndices()) q.setIndices(prim.getIndices().clone());
      transformPrimitive(q, t);
      mesh.addPrimitive(q);
    }
    const node = doc.createNode(want.get(k)).setMesh(mesh);
    const b = getBounds(node);
    const bc = [(b.min[0] + b.max[0]) / 2, b.min[1], (b.min[2] + b.max[2]) / 2];
    for (const q of mesh.listPrimitives()) transformPrimitive(q, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -bc[0], -bc[1], -bc[2], 1]);
    // Ursprung im Modellraum des Exemplars: W⁻¹ · R(yaw) · bc
    const world = apply(rotY(yaw), bc);
    made.set(k, { node, size: [0, 1, 2].map((i) => r3(b.max[i] - b.min[i])), originWorld: world, w0: w });
  }
  for (const n of root.listNodes()) if (![...made.values()].some((m) => m.node === n)) n.dispose();
  for (const { node } of made.values()) scene.addChild(node);
  return made;
}

// Lage eines beliebigen Exemplars: Bezugspunkt des ersten Exemplars über
// dessen Modellraum auf das andere übertragen
function instanceAt(w, ref) {
  const inv = invert4(ref.w0);
  const local = apply(inv, ref.originWorld);
  const p = apply(w, local);
  const s = Math.hypot(w[0], w[1], w[2]) / Math.hypot(ref.w0[0], ref.w0[1], ref.w0[2]);
  return { p, yaw: yawOf(w), scale: s };
}
function invert4(m) {
  // affine Inverse (3×3 + Verschiebung)
  const [a, b, c, , d, e, f, , g, h, i] = m;
  const det = a * (e * i - f * h) - d * (b * i - c * h) + g * (b * f - c * e);
  const inv3 = [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det, (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det, (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det];
  const t = [m[12], m[13], m[14]];
  const r = [0, 1, 2].map((k) => -(inv3[k] * t[0] + inv3[3 + k] * t[1] + inv3[6 + k] * t[2]));
  return [inv3[0], inv3[1], inv3[2], 0, inv3[3], inv3[4], inv3[5], 0, inv3[6], inv3[7], inv3[8], 0, r[0], r[1], r[2], 1];
}

async function packDoc(doc, outPath, b) {
  await doc.transform(prune(), unpartition());
  // UV-Inseln an den Ursprung, sonst zerquantisiert Draco gekachelte UVs
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) normalizeUvIslands(p, 'TEXCOORD_0');
  const uvBits = texcoordBits(doc.getRoot(), 'TEXCOORD_0');
  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^(baseColor|emissive)/, resize: [b.tex, b.tex], quality: b.q ?? 82 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^(?!baseColor|emissive)/, resize: [b.ntex, b.ntex], quality: b.q ?? 80 }),
    draco({ method: 'edgebreaker', quantizeNormal: 10, quantizeTexcoord: uvBits, quantizePosition: 14 }),
  );
  doc.createExtension(KHRDracoMeshCompression).setRequired(true);
  doc.createExtension(EXTTextureWebP).setRequired(true);
  mkdirSync(dirname(outPath), { recursive: true });
  await io.write(outPath, doc);
  return statSync(outPath).size;
}

async function buildWerkstatt() {
  const dir = 'werkstatt';
  const info = JSON.parse(readFileSync(fileURLToPath(new URL(`${dir}/${WERK.lite}.info.json`, SRC)), 'utf8'));
  const la = info.landingArea;
  // Feldmitte im glTF-Raum (Container Z oben -> glTF (x, z, −y))
  const c = [la.pos[0], la.pos[2], -la.pos[1]];
  const stages = [WERK.key, WERK.lite];
  const docs = [], made = [];
  for (const [i, key] of stages.entries()) {
    const want = new Map(WERK_PROPS.filter((p) => p[2] === i).map((p) => [p[1], `prop_${p[0]}_${WERK_PROPS.filter((q) => q[0] === p[0]).indexOf(p)}`]));
    const doc = await io.read(fileURLToPath(new URL(`${dir}/${key}.glb`, SRC)));
    made.push(cutProps(doc, want));
    await doc.transform(prune({ keepAttributes: true }));
    const fix = fileURLToPath(new URL(`${dir}/${key}.matfix.json`, SRC));
    if (existsSync(fix)) applyMatFix(doc, JSON.parse(readFileSync(fix, 'utf8')));
    applyLayers(doc, key, dir);
    docs.push(doc);
  }
  // Anordnung aus der vollen Stufe (beide Stufen stehen gleich)
  const full = await io.read(fileURLToPath(new URL(`${dir}/${WERK.key}.glb`, SRC)));
  const refs = new Map([...made[0], ...made[1]]);
  const items = [];
  const counts = new Map();
  for (const n of full.getRoot().listNodes()) {
    const k = meshKey(n); const ref = refs.get(k); if (!ref) continue;
    const at = instanceAt(n.getWorldMatrix(), ref);
    const dx = at.p[0] - c[0], dz = at.p[2] - c[2], dy = at.p[1] - c[1];
    if (Math.abs(dx) > la.dimensions[0] / 2 + WERK_REACH || Math.abs(dz) > la.dimensions[1] / 2 + WERK_REACH || dy < -1 || dy > 4) continue;
    items.push({ node: ref.node.getName(), at: [r3(dx), r3(dz), r3((at.yaw * 180) / Math.PI), r3(at.scale)], y: r3(dy) });
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  // beide Stufen zusammenlegen, dann Texturen wie die Halle
  const doc = docs[0];
  mergeDocuments(doc, docs[1]);
  const scene = doc.getRoot().listScenes()[0];
  for (const s of doc.getRoot().listScenes().slice(1)) { for (const ch of s.listChildren()) scene.addChild(ch); s.dispose(); }
  const attached = await attachHallTextures(doc);
  stripAttributes(doc, 'hall');
  cleanMaterials(doc);
  await doc.transform(dedup(), join({ keepNamed: true }), weld());
  const props = [];
  for (const n of scene.listChildren()) {
    const k = [...refs].find(([, r]) => r.node.getName() === n.getName())?.[0];
    const p = WERK_PROPS.find((q) => q[1] === k);
    const tris = Math.round(n.getMesh().listPrimitives().reduce((t, q) => t + (q.getIndices()?.getCount() ?? 0) / 3, 0));
    props.push({ node: n.getName(), rolle: p[0], path: k, lod: p[2], tris, size: refs.get(k).size, front: '-z', from: [info.socpak], count: counts.get(k) || 0, materials: n.getMesh().listPrimitives().length });
  }
  const propTris = props.reduce((s, p) => s + p.tris, 0);
  const propsOut = fileURLToPath(new URL('hall/werkstatt.glb', OUT));
  const propBytes = await packDoc(doc, propsOut, { tex: 1024, ntex: 512 });

  // Boden: Decals (Einheitsquadrat 1 × 1 m in XZ, u entlang +X, v = 0 an
  // −Z = lokale +Y des Spiels) und Bodenmuster
  const bd = new Document();
  bd.createBuffer();
  const bscene = bd.createScene('werkstatt-boden');
  const quad = (name, sx, sz, uvx, uvz) => {
    const pos = new Float32Array([-sx / 2, 0, -sz / 2, sx / 2, 0, -sz / 2, sx / 2, 0, sz / 2, -sx / 2, 0, sz / 2]);
    const uv = new Float32Array([0, 0, uvx, 0, uvx, uvz, 0, uvz]);
    const nor = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
    const buf = bd.getRoot().listBuffers()[0];
    return bd.createPrimitive()
      .setAttribute('POSITION', bd.createAccessor().setType('VEC3').setArray(pos).setBuffer(buf))
      .setAttribute('NORMAL', bd.createAccessor().setType('VEC3').setArray(nor).setBuffer(buf))
      .setAttribute('TEXCOORD_0', bd.createAccessor().setType('VEC2').setArray(uv).setBuffer(buf))
      .setIndices(bd.createAccessor().setType('SCALAR').setArray(new Uint16Array([0, 2, 1, 0, 3, 2])).setBuffer(buf));
  };
  const png = (file) => bd.createTexture(file.split(/[\\/]/).pop()).setImage(readFileSync(file)).setMimeType('image/png');
  const rgb = (s, d = [1, 1, 1]) => (s ? String(s).split(',').map(Number) : d);
  // Boden-Decals am Feld
  const floorDecals = info.decals.filter((d) => d.floor && d.material && !DECAL_SKIP.test(d.material)
    && Math.abs(d.pos[0] - la.pos[0]) < la.dimensions[0] / 2 + DECAL_REACH && Math.abs(d.pos[1] - la.pos[1]) < la.dimensions[1] / 2 + DECAL_REACH && Math.abs(d.pos[2] - la.pos[2]) < 1.5);
  const decalNodes = new Map();
  const decals = [];
  // dazu Öl und Risse aus anderen Hallen (Extraktor: WERK_EXTRA_DECALS), ohne Anordnung
  const extra = new Map((info.extraDecals || []).map((e) => [e.material, e]));
  for (const mtl of [...new Set([...floorDecals.map((d) => d.material), ...extra.keys()])]) {
    const m = info.decalMaterials[mtl]; if (!m || m.missing || !m.d) continue;
    const ex = floorDecals.some((d) => d.material === mtl) ? null : extra.get(mtl);
    const role = decalRole(mtl);
    const nth = [...decalNodes.values()].filter((x) => x.role === role).length;
    const node = `decal_${role}_${nth}`;
    const dFile = texFile(m.d);
    if (!dFile) continue;
    // Farbe mit Alpha: das RGBA-PNG trägt die Deckkraft. Bei %OPACITY_MAP
    // kommt sie aus der Maske (TexSlot12, ungekachelt), die Farbe wird mit
    // ihrem TexMod (TileU/V) über die Maske gekachelt.
    let image = readFileSync(dFile);
    const maskFile = /OPACITY_MAP/.test(m.genMask || '') ? texFile(m.maskTex) : null;
    if (maskFile) {
      const mm = await sharp(maskFile).metadata();
      const tile = m.tileD || [1, 1];
      const cell = await sharp(dFile).removeAlpha().resize(Math.round(mm.width / tile[0]), Math.round(mm.height / tile[1])).png().toBuffer();
      const color = await sharp({ create: { width: mm.width, height: mm.height, channels: 3, background: '#000' } }).composite([{ input: cell, tile: true }]).raw().toBuffer();
      const { data: a } = await sharp(maskFile).greyscale().raw().toBuffer({ resolveWithObject: true });
      image = await sharp(color, { raw: { width: mm.width, height: mm.height, channels: 3 } }).joinChannel(a, { raw: { width: mm.width, height: mm.height, channels: 1 } }).png().toBuffer();
    }
    // Deckkraft: Opacity × ColorBlendFactor (bis 1); der Rohwert steht in der JSON
    const cbf = Number(m.params?.ColorBlendFactor ?? 1);
    const mat = bd.createMaterial(node).setBaseColorTexture(bd.createTexture(`${node}_d`).setImage(image).setMimeType('image/png'))
      .setBaseColorFactor([...rgb(m.diffuse), r3(Math.min(1, Number(m.opacity ?? 1) * Math.min(1, cbf)))]).setAlphaMode('BLEND')
      .setMetallicFactor(0).setRoughnessFactor(r3(Math.max(0.05, 1 - Number(m.shininess ?? 128) / 255)));
    const nFile = texFile(m.n);
    if (nFile) mat.setNormalTexture(png(nFile));
    const mesh = bd.createMesh(node).addPrimitive(quad(node, 1, 1, 1, 1).setMaterial(mat));
    bscene.addChild(bd.createNode(node).setMesh(mesh));
    const meta = await sharp(dFile).metadata();
    decalNodes.set(mtl, { role, node });
    decals.push({ node, rolle: role, path: mtl, size: ex ? [ex.edge, ex.edge] : [1, 1], alpha: true, opacityMap: !!maskFile, pom: false, from: ex ? ex.from : [info.socpak], inLayout: !ex, texture: [meta.width, meta.height], game: m });
  }
  for (const d of floorDecals) {
    const dn = decalNodes.get(d.material); if (!dn) continue;
    // Drehung nur um Z (Spiel) = um Y (glTF), Winkel gleich
    const yaw = 2 * Math.atan2(d.q[2], d.q[3]);
    const p = [d.pos[0], d.pos[2], -d.pos[1]];
    items.push({ node: dn.node, at: [r3(p[0] - c[0]), r3(p[2] - c[2]), r3((yaw * 180) / Math.PI), r3(2 * d.half)], y: r3(p[1] - c[1]) });
  }
  // Bodenmuster: 4 × 4 m, UV in Metern geteilt durch die Kachelung
  const floors = [];
  const layerFile = fileURLToPath(new URL(`${dir}/${WERK.key}.layers.json`, SRC));
  const layerInfo = existsSync(layerFile) ? JSON.parse(readFileSync(layerFile, 'utf8')) : {};
  const lk = (p) => layerInfo[Object.keys(layerInfo).find((k) => k.toLowerCase() === String(p).toLowerCase().replace(/\\/g, '/'))] || null;
  const fullMats = new Map(full.getRoot().listMaterials().map((m) => [m.getName(), m]));
  for (const f of WERK_FLOORS) {
    const src = fullMats.get(f.material); if (!src) continue;
    const x = src.getExtras() || {};
    const man = x.semantic?.layer_manifest || [];
    const layers = man.map((l) => {
      const a = Object.fromEntries((l.authored_attributes || []).map((t) => [t.name, t.value]));
      const L = lk(l.path) || {};
      return { name: l.name, path: l.path, tint: l.tint_color, wearTint: l.wear_tint, glossMult: l.gloss_mult, wearGloss: l.wear_gloss, uvTiling: l.uv_tiling, paletteTint: a.PaletteTint, snapshot: l.layer_snapshot, maps: { d: L.d ?? null, n: L.n ?? null, detail: L.detail ?? null }, layerTiling: L.tiling ?? null };
    });
    const tiling = f.tiling ?? werkTiling(full, f.material);
    const L0 = layers[0] || {};
    const node = `floor_${f.name}`;
    const mat = bd.createMaterial(node).setMetallicFactor(0).setRoughnessFactor(r3(1 - (L0.snapshot?.shininess ?? 128) / 255 * (L0.glossMult ?? 1)));
    const d = texFile(L0.maps?.d), n = texFile(L0.maps?.n);
    const diff = L0.snapshot?.diffuse || [1, 1, 1], tint = L0.tint || [1, 1, 1];
    mat.setBaseColorFactor([...diff.map((v, i) => Math.min(1, v * (d ? 1 : 1) * tint[i])), 1]);
    if (d) mat.setBaseColorTexture(png(d));
    if (n) mat.setNormalTexture(png(n));
    const g = n && n.replace(/\.png$/, '.gloss.png');
    const size = 4;
    const mesh = bd.createMesh(node).addPrimitive(quad(node, size, size, size / tiling[0], size / tiling[1]).setMaterial(mat));
    bscene.addChild(bd.createNode(node).setMesh(mesh).setTranslation([0, 0, 0]));
    // zweite Schicht (Wear) als eigenes Muster daneben: das Spiel mischt sie
    // über die Vertexfarbe des Hallenmeshs, die Cloud über eine eigene Maske
    const L1 = layers[1];
    const wd = L1 && texFile(L1.maps?.d), wn = L1 && texFile(L1.maps?.n);
    let wearNode = null;
    if (wd) {
      wearNode = `${node}_wear`;
      const wm = bd.createMaterial(wearNode).setMetallicFactor(0).setBaseColorTexture(png(wd))
        .setBaseColorFactor([...(L1.snapshot?.diffuse || [1, 1, 1]).map((v, i) => Math.min(1, v * (L1.tint || [1, 1, 1])[i])), 1])
        .setRoughnessFactor(r3(1 - (L1.snapshot?.shininess ?? 128) / 255 * (L1.glossMult ?? 1)));
      if (wn) wm.setNormalTexture(png(wn));
      bscene.addChild(bd.createNode(wearNode).setMesh(bd.createMesh(wearNode).addPrimitive(quad(wearNode, size, size, size / tiling[0], size / tiling[1]).setMaterial(wm))).setTranslation([size + 1, 0, 0]));
    }
    floors.push({ node, wearNode, name: f.name, path: f.material, tiling: tiling.map(r3), layers, blend: 'Schicht 2 (Wear) über die Vertexfarbe des Hallenmeshs (%VERTCOLORS/WEAR_LAYER); das Muster trägt keine Vertexfarbe und zeigt nur Schicht 1', gloss: g && existsSync(g) ? 'Glätte im Alpha der Normalenkarte (nicht im Muster)' : null });
  }
  const bodenOut = fileURLToPath(new URL('hall/werkstatt-boden.glb', OUT));
  // Telefone und Stufe niedrig laden nur dieses GLB (≤ 2 MB): Farbe 512 px
  const bodenBytes = await packDoc(bd, bodenOut, { tex: 512, ntex: 256, q: 74 });

  // Materialien der Requisiten mit allen Schichten (Rohwerte)
  const materials = {};
  for (const m of full.getRoot().listMaterials()) {
    if (!doc.getRoot().listMaterials().some((q) => q.getName() === m.getName())) continue;
    const x = m.getExtras() || {};
    const man = x.semantic?.layer_manifest;
    if (!man?.length) continue;
    materials[m.getName()] = { shader: x.shader, mask: x.semantic?.decoded_string_gen_mask?.tokens, layers: man.map((l) => ({ name: l.name, path: l.path, tint: l.tint_color, wearTint: l.wear_tint, glossMult: l.gloss_mult, uvTiling: l.uv_tiling, maps: (() => { const L = lk(l.path) || {}; return { d: L.d ?? null, n: L.n ?? null }; })() })) };
  }
  const json = {
    v: 1,
    source: { socpak: info.socpak, note: 'Industrie-Hangar util_a, mittlere Größe; Requisiten und Decals stehen im Spiel so' },
    props, decals, floors, materials,
    layout: {
      source: info.socpak,
      pad: { size: [la.dimensions[0], la.dimensions[1]], dir: 'Längsachse entlang z (Spiel-Y); at = [x, z] relativ zur Feldmitte auf dem Boden, Y oben, Drehung in Grad um Y, Maßstab (Decals: Kantenlänge in m); y = Höhe des Ursprungs über dem Feld' },
      items,
    },
  };
  const jsonOut = fileURLToPath(new URL('hall/werkstatt.json', OUT));
  writeFileSync(jsonOut, JSON.stringify(json) + '\n');
  const v = (f) => createHash('sha1').update(readFileSync(f)).digest('hex').slice(0, 8);
  return {
    url: '/hangar/hall/werkstatt.glb', v: v(propsOut), json: '/hangar/hall/werkstatt.json', jsonV: v(jsonOut), bytes: propBytes, tris: propTris,
    boden: { url: '/hangar/hall/werkstatt-boden.glb', v: v(bodenOut), bytes: bodenBytes },
    props: props.length, decals: decals.length, floors: floors.length, items: items.length, attached,
    report: { props: props.map((p) => [p.node, p.path, p.tris]), decals: decals.map((d) => [d.node, d.path]), floors: floors.map((f) => [f.node, f.path, f.tiling]), jsonBytes: statSync(jsonOut).size },
  };
}

// Kachelung eines Hallenmaterials in Metern: mittlere Meter je UV-Einheit
// über seine Dreiecke im Export
function werkTiling(doc, matName) {
  let m2 = 0, uv2 = 0;
  for (const n of doc.getRoot().listNodes()) {
    const mesh = n.getMesh(); if (!mesh) continue;
    const w = n.getWorldMatrix();
    for (const p of mesh.listPrimitives()) {
      if (p.getMaterial()?.getName() !== matName) continue;
      const pos = p.getAttribute('POSITION'), uv = p.getAttribute('TEXCOORD_0'), idx = p.getIndices();
      if (!pos || !uv || !idx) continue;
      const P = (i) => apply(w, pos.getElement(i, [0, 0, 0])), U = (i) => uv.getElement(i, [0, 0]);
      for (let t = 0; t < Math.min(idx.getCount(), 3000); t += 3) {
        const [a, b, cc] = [idx.getScalar(t), idx.getScalar(t + 1), idx.getScalar(t + 2)];
        const [pa, pb, pc] = [P(a), P(b), P(cc)], [ua, ub, uc] = [U(a), U(b), U(cc)];
        const e1 = pb.map((v, i) => v - pa[i]), e2 = pc.map((v, i) => v - pa[i]);
        const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        m2 += Math.hypot(...cr) / 2;
        uv2 += Math.abs((ub[0] - ua[0]) * (uc[1] - ua[1]) - (uc[0] - ua[0]) * (ub[1] - ua[1])) / 2;
      }
    }
  }
  const s = uv2 > 0 ? Math.sqrt(m2 / uv2) : 1;
  return [s, s];
}

// ─── Gerätekatalog (.planning/notes/hangar-katalog.md) ──────────────────
// Quelle: scripts/extract-hangar-katalog.mjs (.cache/hangar-src/katalog/).
// Je Kategorie eine Datei public/hangar/props/<kategorie>.glb, je Requisit
// ein Knoten prop_<kategorie>_<name>: Ursprung unten mittig, +Y oben,
// Meter, Vorderseite des Spiels (lokale +Y) bei −Z. Materialien heißen
// <mtl>_<untermaterial> in allen Dateien gleich. Dazu katalog.json mit
// Bedeutung, Aufstellung, Nachbarn, Arbeitsplätzen, Leitungen, Schiffsseite.
const KAT_DIR = 'katalog';
// Zweck und Benutzung, abgeleitet aus Name, Kategorie und Aufstellung im
// Spiel (quelle.zweck = "abgeleitet"); erster Treffer gewinnt
const ZWECK = [
  [/generator_oxygen/, 'Sauerstoffgenerator, erzeugt Atemluft für Arbeiten in Räumen ohne Lebenserhaltung', 'steht frei auf dem Boden; wird über Schläuche angeschlossen'],
  [/generator/, 'mobiler Stromgenerator, versorgt Werkstattgerät am Schiff mit Strom', 'steht am Feldrand oder an der Wand; Kabel laufen zur Kabeltrommel und zum Gerät'],
  [/cable_reel|hose_reel/, 'Trommel, auf der Kabel oder Schlauch aufgewickelt ist', 'wird neben Generator, Tank oder Arbeitsplatz abgestellt und zum Schiff abgerollt'],
  [/cable_floor|cable_straight|cable_bend|cable_corner|cable_split|cable_small|maintenance_cable|cables_a/, 'Kabelstück (Strom/Daten), lose auf dem Boden oder an der Wand verlegt', 'wird zu Leitungen zwischen Gerät, Trommel und Schiff gereiht'],
  [/cable_terminal|junctionbox|cable_box/, 'Anschluss- oder Verteilerdose für Kabel', 'sitzt an Wand oder Boden am Ende einer Kabelleitung'],
  [/hose_floor_1_socket|securepoint_connector/, 'Bodenanschluss für einen Schlauch', 'Schlauchende im Boden; von hier läuft der Schlauch zum Schiff'],
  [/hose_floor|maintenance_hose/, 'Schlauchstück, lose auf dem Boden verlegt (Treibstoff, Luft oder Kühlmittel)', 'wird zu Leitungen zwischen Anschluss, Tank und Schiff gereiht'],
  [/airduct_fan/, 'Lüfter am Ende eines Luftschlauchs', 'bläst Luft durch angeschlossene Luftschläuche'],
  [/airduct_hose/, 'flexibler Luftschlauch (Lüftung, Heizung)', 'läuft vom Heizer oder Lüfter am Boden oder hängend durch die Halle'],
  [/heater/, 'Heizgerät für die Halle', 'steht frei auf dem Boden, oft mit Luftschlauch'],
  [/tank_gas|gas_tank/, 'Gasflasche (Druckgas) für Schweiß- und Wartungsarbeiten', 'steht in Gruppen an der Wand oder neben Schweißgerät und Feuerlöscher'],
  [/cell_fuel|fuel/, 'Treibstoffzelle, Behälter für Treibstoff', 'steht in Gruppen auf dem Boden oder im Regal'],
  [/canister/, 'Kanister', 'steht am Boden oder im Regal'],
  [/extinguisher_cabinet/, 'Feuerlöscherschrank', 'hängt an der Wand'],
  [/extinguisher/, 'Feuerlöscher', 'steht am Boden neben Gerät oder hängt an der Wand'],
  [/fire_hose|fire-hose/, 'Feuerlöschschlauch auf Wandhalter', 'hängt in Gruppen an der Wand'],
  [/cone_/, 'Leitkegel zum Absperren', 'steht auf dem Boden um Arbeitsbereiche'],
  [/barrier|bollard/, 'Absperrung', 'steht auf dem Boden am Rand von Arbeitsbereichen'],
  [/sign_warning/, 'freistehendes Warnschild', 'steht am Rand eines Arbeitsbereichs'],
  [/console_diagnostic|tool_tester|panel_engineering/, 'Diagnosegerät, liest Schiffssysteme aus', 'steht neben dem Schiff oder am Arbeitsplatz, über Kabel angeschlossen'],
  [/computer|server_rack|monitor/, 'Rechner oder Bildschirm für Planung und Diagnose', 'steht auf Tisch oder Konsole, Server in Racks an der Wand'],
  [/welder|welding/, 'Schweißgerät', 'steht neben Gasflaschen und Feuerlöscher am Arbeitsplatz'],
  [/workbench/, 'Werkbank', 'steht an der Wand oder frei; Werkzeug liegt darauf'],
  [/cabinet_tool|tool_drawer|toolbox|bag_toolbox|tool_chest|storage_toolbox/, 'Werkzeugschrank oder -kiste', 'steht am Arbeitsplatz oder an der Wand'],
  [/tool_jack/, 'Wagenheber', 'steht am Boden unter oder neben dem Schiff'],
  [/ladder/, 'Leiter oder fahrbare Treppe', 'steht am Schiff, um an Rumpf und Cockpit zu kommen'],
  [/crane/, 'Kran oder Kranarm', 'steht am Arbeitsplatz für schwere Teile'],
  [/tool_|drill|ratchet|wrench|socket_set|circularsaw|multi/, 'Handwerkzeug', 'liegt auf Tisch, Werkbank oder Boden am Arbeitsplatz'],
  [/creeper/, 'Rollbrett für Arbeiten unter dem Schiff', 'liegt am Boden unter oder neben dem Schiff'],
  [/forklift/, 'Gabelstapler oder Staplerteil', 'fährt Lasten zwischen Lager und Schiff'],
  [/trolley|cart|dolly|pallet/, 'Transportwagen oder Palette', 'steht zwischen Lager und Schiff'],
  [/work-light|tripod|light_stand|light_portable/, 'Arbeitsleuchte auf Stativ', 'steht neben dem Schiff und leuchtet den Arbeitsbereich aus'],
  [/(^|_)mop|bucket/, 'Wischmop oder Eimer', 'steht an der Wand oder am Rand'],
  [/trash/, 'Müll, Müllsäcke', 'liegt in Ecken und an Wänden'],
  [/drum/, 'Fass', 'steht in Gruppen auf dem Boden'],
  [/crate|box_|container|storage|shelf/, 'Lagerkiste oder Regal', 'steht gestapelt an Wänden und in Ecken'],
];
const zweckOf = (key) => { const z = ZWECK.find(([re]) => re.test(key)); return z ? { zweck: z[1], nutzung: z[2] } : { zweck: null, nutzung: null }; };
const kTexFile = (p) => (p && !/^\$/.test(p) ? texFile(p) : null);

async function buildKatalog() {
  const qf = JSON.parse(readFileSync(fileURLToPath(new URL(`${KAT_DIR}/quellen.json`, SRC)), 'utf8'));
  const inv = JSON.parse(readFileSync(fileURLToPath(new URL(`${KAT_DIR}/inventar.json`, SRC)), 'utf8'));
  const entries = new Map(inv.entries.map((e) => [e.key, e]));
  const layerInfo = qf.layers || {};
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const rgb = (s, d = [1, 1, 1]) => (s ? String(s).split(',').map(Number).slice(0, 3) : d);
  const clean = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const kats = new Map();
  for (const q of qf.quellen.filter((x) => !x.missing)) { if (!kats.has(q.kat)) kats.set(q.kat, []); kats.get(q.kat).push(q); }
  const out = { kategorien: {}, props: [] };
  const report = [];
  for (const [kat, list] of [...kats].sort()) {
    const doc = new Document();
    const buf = doc.createBuffer();
    const scene = doc.createScene(kat);
    const tt = doc.createExtension(KHRTextureTransform);
    const texCache = new Map(), matCache = new Map();
    const tex = (file) => { if (!texCache.has(file)) texCache.set(file, doc.createTexture(file.split(/[\\/]/).pop()).setImage(readFileSync(file)).setMimeType('image/png')); return texCache.get(file); };
    const material = (mtl, sub) => {
      const name = `${clean(String(mtl || 'mtl').split('/').pop())}_${clean(sub?.name || 'default')}`;
      if (matCache.has(name)) return matCache.get(name);
      const m = doc.createMaterial(name).setMetallicFactor(0);
      const L0 = sub?.layers?.[0], LI = L0 ? layerInfo[L0.path] : null;
      const d = kTexFile(sub?.d) || (LI && kTexFile(LI.d));
      const n = kTexFile(sub?.n) || (LI && kTexFile(LI.n));
      let factor = rgb(sub?.diffuse);
      if (!kTexFile(sub?.d) && L0) factor = rgb(L0.tint).map((v, i) => v * rgb(LI?.diffuse)[i]);
      if (d) {
        const ti = m.setBaseColorTexture(tex(d)).getBaseColorTextureInfo();
        const tile = !kTexFile(sub?.d) && L0 ? (L0.uvTiling || 1) * (LI?.tiling || 1) : 1;
        if (tile !== 1) ti.setExtension('KHR_texture_transform', tt.createTransform().setScale([tile, tile]));
      }
      if (n && /_ddna?\.png$|_ddn\.png$/i.test(n)) {
        const ti = m.setNormalTexture(tex(n)).getNormalTextureInfo();
        const tile = !kTexFile(sub?.n) && L0 ? (L0.uvTiling || 1) * (LI?.tiling || 1) : 1;
        if (tile !== 1) ti.setExtension('KHR_texture_transform', tt.createTransform().setScale([tile, tile]));
      }
      const spec = rgb(L0 ? LI?.specular : sub?.specular, [0.04, 0.04, 0.04]);
      if (spec[0] > 0.3 && !d) { m.setMetallicFactor(1); factor = spec.map((v, i) => Math.min(1, v * rgb(L0?.tint)[i])); }
      const shin = Number((L0 ? LI?.shininess : sub?.shininess) ?? 128);
      m.setRoughnessFactor(r3(Math.min(1, Math.max(0.05, 1 - (shin / 255) * (L0?.glossMult ?? 1)))));
      m.setBaseColorFactor([...factor.map((v) => Math.min(1, v)), 1]);
      if (/glass/i.test(sub?.shader || '')) m.setAlphaMode('BLEND').setBaseColorFactor([0.2, 0.22, 0.25, 0.3]).setRoughnessFactor(0.05);
      else if (/DECAL/.test(sub?.genMask || '') || /MeshDecal/i.test(sub?.shader || '')) m.setAlphaMode('BLEND');
      else if (Number(sub?.alphaTest) > 0) m.setAlphaMode('MASK').setAlphaCutoff(Number(sub.alphaTest));
      if (/glow/i.test(sub?.name || '') && d) m.setEmissiveTexture(m.getBaseColorTexture()).setEmissiveFactor([1, 1, 1]);
      matCache.set(name, m);
      return m;
    };
    const nodes = [];
    for (const q of list) {
      const src = await io.read(fileURLToPath(new URL(q.glb, SRC)));
      const node = `prop_${kat}_${clean(q.key)}`;
      const mesh = doc.createMesh(node);
      const prims = src.getRoot().listMeshes().flatMap((me) => me.listPrimitives());
      prims.forEach((sp, i) => {
        const sub = q.subs?.[q.ids?.[i] ?? i];
        if (/NoDraw/i.test(sub?.shader || '') || /proxy/i.test(sub?.name || '')) return;
        // Decal-Flächen ohne eigene Karte (Branding aus $TintPaletteDecal zur Laufzeit,
        // Glow-Decals ohne Bild) wären weiße Platten: weglassen
        const decalish = /DECAL/.test(sub?.genMask || '') || /MeshDecal/i.test(sub?.shader || '') || /decal/i.test(sub?.name || '');
        if (decalish && !kTexFile(sub?.d)) return;
        const p = doc.createPrimitive();
        for (const sem of ['POSITION', 'NORMAL', 'TEXCOORD_0']) { const a = sp.getAttribute(sem); if (a) p.setAttribute(sem, doc.createAccessor().setType(a.getType()).setArray(a.getArray().slice()).setBuffer(buf)); }
        const idx = sp.getIndices(); if (idx) p.setIndices(doc.createAccessor().setType('SCALAR').setArray(idx.getArray().slice()).setBuffer(buf));
        transformPrimitive(p, ROOT_ZUP);
        mesh.addPrimitive(p.setMaterial(material(q.mtl, sub)));
      });
      if (!mesh.listPrimitives().length) { mesh.dispose(); continue; }
      const n = doc.createNode(node).setMesh(mesh);
      const b = getBounds(n);
      const bc = [(b.min[0] + b.max[0]) / 2, b.min[1], (b.min[2] + b.max[2]) / 2];
      for (const p of mesh.listPrimitives()) transformPrimitive(p, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -bc[0], -bc[1], -bc[2], 1]);
      scene.addChild(n);
      const size = [0, 1, 2].map((i) => r3(b.max[i] - b.min[i]));
      const tris = Math.round(mesh.listPrimitives().reduce((t, p) => t + (p.getIndices()?.getCount() ?? 0) / 3, 0));
      nodes.push(node);
      const e = entries.get(q.key) || null;
      const z = zweckOf(q.key);
      out.props.push({
        node, kategorie: kat, file: `/hangar/props/${kat}.glb`, path: q.p4k.replace(/\\/g, '/').replace(/^Data\//i, ''),
        klasse: e?.klasse ?? null, name: e?.name ?? null, beschreibung: e?.beschreibung ?? null,
        typ: e?.typ ?? null, tags: e?.tags ?? [], benutzung: [], tragbar: null,
        zweck: z.zweck, nutzung: z.nutzung,
        quelle: { geometrie: q.quelle, name: e?.name?.en ? 'spiel' : null, zweck: z.zweck ? 'abgeleitet' : null, aufstellung: e ? 'spiel' : null },
        size, footprint: [size[0], size[2]], front: '-z', tris, lod: q.lod, materials: mesh.listPrimitives().length,
        anschluesse: [],
        aufstellung: e?.aufstellung ?? null, nachbarn: e?.nachbarn ?? [],
        from: e?.from ?? [], count: e?.count ?? 0, hallen: e?.hallen ?? 0,
      });
    }
    if (!nodes.length) continue;
    const outPath = fileURLToPath(new URL(`props/${kat}.glb`, OUT));
    let bytes = await packDoc(doc, outPath, { tex: 1024, ntex: 512 });
    // je Datei ≤ 3 MB: sonst mit halber Kantenlänge neu packen
    if (bytes > 3 * 1048576) { const d2 = await io.read(outPath); bytes = await packDoc(d2, outPath, { tex: 512, ntex: 256, q: 76 }); }
    out.kategorien[kat] = { file: `/hangar/props/${kat}.glb`, bytes, props: nodes, v: createHash('sha1').update(readFileSync(outPath)).digest('hex').slice(0, 8) };
    report.push([kat, nodes.length, out.props.filter((p) => p.kategorie === kat).reduce((s, p) => s + p.tris, 0), bytes]);
  }
  const nodeOf = new Map(out.props.map((p) => [p.path.split('/').pop().replace(/\.(cgf|cga)$/i, '').toLowerCase(), p.node]));
  const ref = (key) => nodeOf.get(key) ?? key;
  // Arbeitsplätze: häufige Zusammensetzungen mit einem Vertreter aus dem Spiel
  const arbeitsplaetze = inv.zusammensetzungen.filter((z) => z.n >= 3).map((z) => ({
    name: z.sig, n: z.n, hallen: z.hallen, halle: z.vertreter.hall,
    mitglieder: z.vertreter.mitglieder.map((m) => ({ node: ref(m.key), kategorie: m.kat, at: [m.at[0], m.at[2], m.drehungY], y: m.y })),
    abstandFeld: z.vertreter.abstandFeld, abstandWand: z.vertreter.abstandWand,
    ort: z.vertreter.abstandWand != null && z.vertreter.abstandWand < 1.5 ? 'wand' : 'frei',
  }));
  const leitungen = inv.leitungen.map((l) => ({ stuecke: l.stuecke.map((s) => ({ node: ref(s.key), at: s.at })), laenge: l.laenge, von: l.von ? ref(l.von) : null, nach: l.nach ? ref(l.nach) : null, halle: l.halle }));
  // Schiffsseite: Knoten der Schiffsexporte mit Tank-, Daten- und Andockpunkten
  const SHIP_PORTS = /fuel_?port|fuelport|IP_Panel_Fuel|umbilical|dataport|docking_collar|docking_port|refuel/i;
  const schiffe = [];
  for (const [slug, ent] of [['aegs-gladius', 'AEGS_Gladius'], ['drak-cutlass-black', 'DRAK_Cutlass_Black'], ['rsi-constellation-andromeda', 'RSI_Constellation_Andromeda']]) {
    const f = fileURLToPath(new URL(`ships/${slug}.glb`, SRC));
    const ports = [];
    if (existsSync(f)) {
      const d = await io.read(f);
      for (const n of d.getRoot().listNodes()) if (SHIP_PORTS.test(n.getName()) && !/^\$/.test(n.getName())) {
        const art = /fuel/i.test(n.getName()) ? 'treibstoff' : /data/i.test(n.getName()) ? 'daten' : 'andocken';
        ports.push({ name: n.getName(), at: n.getWorldTranslation().map(r3), art });
      }
    }
    const lo = inv.schiffe.find((s) => s.schiff === ent);
    schiffe.push({ schiff: slug, anschluesse: ports, loadout: (lo?.anschluesse || []).filter((l) => /fuel_port|refuel|umbilical/i.test(l)), raum: 'Raum des Schiffsmodells: Y oben, Meter, Schiffsursprung' });
  }
  const json = { v: 1, kategorien: out.kategorien, props: out.props, arbeitsplaetze, leitungen, schiffe,
    hinweise: {
      anschluesse: 'Die Requisiten-Modelle tragen keine Helfer, Sockets oder Knochen mit Namen; Anschlusspunkte gibt das Spiel nicht her.',
      namen: 'Spielname und Beschreibung gibt es nur, wo eine Entity mit Lokalisierung die Geometrie trägt; Deko-Requisiten nennen @LOC_PLACEHOLDER.',
      leitungen: 'Am Boden legt das Spiel kaum Leitungen: kurze Ketten aus 2 bis 3 Stücken, kein Kabel vom Generator zum Schiff. Die meisten Kabelstücke sind Wand- und Deckenzüge.',
      aufstellung: 'Höhe = Bezugspunkt über dem Feldboden; Abstand zum Feldrand achsparallel (innen negativ); Wandabstand zu Brushes mit „wall“ im Namen; Richtung = Vorderseite (lokale +Y) zur Feldmitte.',
    } };
  mkdirSync(fileURLToPath(new URL('props/', OUT)), { recursive: true });
  const jsonOut = fileURLToPath(new URL('props/katalog.json', OUT));
  writeFileSync(jsonOut, JSON.stringify(json) + '\n');
  return {
    url: '/hangar/props/katalog.json', v: createHash('sha1').update(readFileSync(jsonOut)).digest('hex').slice(0, 8), bytes: statSync(jsonOut).size,
    props: out.props.length, kategorien: Object.fromEntries(Object.entries(out.kategorien).map(([k, x]) => [k, { file: x.file, v: x.v, bytes: x.bytes, props: x.props.length }])),
    report: { kats: report, name: out.props.filter((p) => p.name?.en).length, desc: out.props.filter((p) => p.beschreibung?.en).length, zweck: out.props.filter((p) => p.zweck).length, auf: out.props.filter((p) => p.aufstellung).length, ap: arbeitsplaetze.length, lt: leitungen.length, ports: schiffe.map((s) => `${s.schiff} ${s.anschluesse.length}`).join(', ') },
  };
}

// ─── Schachttor (.planning/notes/hangar-schachttor.md) ──────────────────
// Quelle: scripts/extract-hangar-tor.mjs (.cache/hangar-src/tor/). Je
// Knochen der .cga ein Knoten gate_<n> (Teilnetze über ihren Netz-Knoten
// zugeordnet), in geschlossener Stellung (= Ruhelage des Modells; door_open
// beginnt dort). Raum wie lights[].pos des Schachts: Schachtmitte auf dem
// Hallenboden = 0, x quer (56 m), z längs (88 m), y oben. Knoten-Ursprung =
// Lage des Knochens; closed/open und die Spuren nennen diese Lage.
async function buildTor() {
  const T = JSON.parse(readFileSync(fileURLToPath(new URL('tor/tor.json', SRC)), 'utf8'));
  const doc = await io.read(fileURLToPath(new URL(T.glb, SRC)));
  const root = doc.getRoot(), scene = root.listScenes()[0];
  const gateNode = root.listNodes().find((n) => /ht_hangar_ship_elev_door_med_a/.test(n.getMesh()?.getName() || ''));
  if (!gateNode) throw new Error('Tor-Mesh fehlt im Export');
  const prims = gateNode.getMesh().listPrimitives();
  if (prims.length !== T.subsets.length) throw new Error(`Primitive ${prims.length} ≠ Teilnetze ${T.subsets.length}`);
  const byIndex = new Map(T.nodes.map((n) => [n.index, n]));
  const r3 = (v) => Math.round(v * 1000) / 1000;
  // Lage eines Knochens im Container-Raum der .cga: Kette der lokalen Lagen
  // (Spur zum Bild f, sonst Ruhelage aus dem Knotenbaum; die Tor-Knochen
  // drehen nicht, nur die Zylinder — deren Drehung ist nicht dekodiert)
  const chanOf = (caf, name) => caf.bones.find((b) => b.name === name)?.pos || null;
  const localAt = (bone, caf, f) => { const ch = caf && chanOf(caf, bone.name); return ch ? sampleCaf(ch, f) : bone.t; };
  const worldAt = (bone, caf, f) => { let p = [0, 0, 0]; for (let b = bone; b; b = b.parent != null ? byIndex.get(b.parent) : null) { const l = localAt(b, caf, f); p = p.map((v, i) => v + l[i]); } return p; };
  const toShaft = (c) => [c[0], c[2], -c[1]];   // Container (Z oben) -> glTF; Tor steht mit seinem Ursprung auf der Schachtmitte am Boden
  const cafOpen = T.cafs['ht_hangar_ship_elev_door_med_a_door_open.caf'], cafClose = T.cafs['ht_hangar_ship_elev_door_med_door_close.caf'];
  const W = gateNode.getWorldMatrix();
  // Primitive je Knochen sammeln
  const groups = new Map();
  T.subsets.forEach((s, i) => {
    const meshNode = byIndex.get(s.node);
    const bone = meshNode?.parent != null ? byIndex.get(meshNode.parent) : null;
    const key = bone && /^anim_/.test(bone.name) ? bone.name : 'frame';
    if (!groups.has(key)) groups.set(key, { bone: key === 'frame' ? null : bone, prims: [] });
    groups.get(key).prims.push(prims[i]);
  });
  const parts = [];
  let gi = 0;
  const order = [...groups.keys()].sort();
  for (const key of order) {
    const g = groups.get(key);
    const node = key === 'frame' ? 'gate_frame_0' : `gate_${gi++}`;
    const pivot = g.bone ? toShaft(worldAt(g.bone, cafOpen, 0)) : [0, 0, 0];
    const mesh = doc.createMesh(node);
    // Weltmatrix einbacken, auf Schachtraum (Boden y 0) und Knochen-Ursprung schieben
    const shift = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -pivot[0], -pivot[1] - LIFT_SHAFT.floorY, -pivot[2], 1];
    for (const p of g.prims) {
      const q = p.clone();
      for (const sem of q.listSemantics()) q.setAttribute(sem, p.getAttribute(sem).clone());
      if (p.getIndices()) q.setIndices(p.getIndices().clone());
      transformPrimitive(q, W);
      transformPrimitive(q, shift);
      mesh.addPrimitive(q);
    }
    const n = doc.createNode(node).setMesh(mesh).setTranslation(pivot.map(r3));
    const b = getBounds(n);
    const track = (caf) => [...Array(31)].map((_, k) => { const f = (k / 30) * (caf?.frames || 450); const p = g.bone ? toShaft(worldAt(g.bone, caf, f)) : [0, 0, 0]; return [r3(f / (caf?.fps || 30) / (T.speed || 1)), ...p.map(r3)]; });
    parts.push({
      node, bone: g.bone?.name ?? null, n,
      size: [0, 1, 2].map((i) => r3(b.max[i] - b.min[i])),
      tris: g.prims.reduce((t, p) => t + (p.getIndices()?.getCount() ?? 0) / 3, 0),
      closed: { pos: pivot.map(r3), quat: [0, 0, 0, 1] },
      open: { pos: (g.bone ? toShaft(worldAt(g.bone, cafOpen, cafOpen.frames)) : [0, 0, 0]).map(r3), quat: [0, 0, 0, 1] },
      rotation: g.bone && [cafOpen, cafClose].some((c) => c.bones.find((x) => x.name === g.bone.name)?.rot) ? 'Drehspur vorhanden (48-Bit-Quaternion), nicht dekodiert' : null,
      keys: { close: track(cafClose), open: track(cafOpen) },
    });
  }
  for (const n of root.listNodes()) if (!parts.some((p) => p.n === n)) n.dispose();
  for (const p of parts) scene.addChild(p.n);
  await doc.transform(prune({ keepAttributes: true }));
  applyLayers(doc, 'medtop', 'lift');
  const attached = await attachHallTextures(doc);
  stripAttributes(doc, 'lift');
  cleanMaterials(doc);
  await doc.transform(dedup(), join({ keepNamed: true }), weld());
  const outPath = fileURLToPath(new URL('lift/medtop-tor.glb', OUT));
  const bytes = await packDoc(doc, outPath, { tex: 1024, ntex: 512 });
  // Plattform: Knochen anim_pad001, Höhe der Oberkante relativ zum Hallenboden
  const padTrack = (name) => { const c = T.cafs[name]; const ch = c?.bones.find((x) => x.name === 'anim_pad001')?.pos; return ch ? { s: r3(c.frames / c.fps / (T.speed || 1)), keys: [...Array(31)].map((_, k) => { const f = (k / 30) * c.frames; return [r3(f / c.fps / (T.speed || 1)), r3(sampleCaf(ch, f)[2])]; }) } : null; };
  const g0 = T.gates[0];
  const json = {
    v: 1,
    source: { geometry: 'ht_hangar_ship_elev_door_med_a.cga', lod: T.lod, stages: T.stages, entity: g0?.cls, note: 'Tor des mittleren Hangars (hangar_medtop_001); bewegt nur durch Verschieben, die Zylinder drehen zusätzlich' },
    place: T.gates.map((g) => ({ pos: toShaft([g.pos[0], g.pos[1], g.pos[2] - LIFT_SHAFT.floorY]).map(r3), rot: g.rot })),
    parts: parts.map(({ n, ...p }) => p),
    anim: {
      close: { s: r3(cafClose.frames / cafClose.fps / (T.speed || 1)), frames: cafClose.frames, fps: cafClose.fps, speed: T.speed, keys: 'je Teil in parts[].keys.close: [t s, x, y, z] (31 Stützstellen, linear zwischen den Spielschlüsseln)' },
      open: { s: r3(cafOpen.frames / cafOpen.fps / (T.speed || 1)), frames: cafOpen.frames, fps: cafOpen.fps, speed: T.speed, keys: 'parts[].keys.open' },
      pad: { down: padTrack('ht_hangar_ship_elev_med_door_close.caf'), up: padTrack('ht_hangar_ship_elev_med_door_open.caf'), note: 'Plattformoberkante relativ zur Ruhelage oben (0) in m; door_close fährt hinab, door_open hinauf' },
    },
    order: {
      sequences: 'sq_hngr_medtop_doorclose_paddown (31,67 s) und sq_hngr_medtop_dooropen_padup (33 s) steuern nur Licht, Hologramm und Ton; wann Tor und Plattform losgehen, steht nicht in den Sequenzen',
      animations: 'Tor und Plattform tragen gleich benannte Animationen gleicher Länge (door_close: Tor schließt, Plattform fährt hinab; door_open: Tor öffnet, Plattform fährt hinauf), je 450 Bilder bei 30 Bildern/s, DoorAnimationSpeed 1,2 an der Plattform-Entity — abgeleitet: beide laufen gleichzeitig',
      events: T.events,
      eventsNote: 'Zeit 0..1 der Animation. Tor: Ton Door_M_Close/Open und Alarm bei 0, Alarm aus bei 0,999. Plattform: Fahrton bei 0, aus bei 0,932 (Fahrt endet vor dem Animationsende)',
    },
  };
  const jsonOut = fileURLToPath(new URL('lift/medtop-tor.json', OUT));
  writeFileSync(jsonOut, JSON.stringify(json) + '\n');
  const v = createHash('sha1').update(readFileSync(outPath)).update(readFileSync(jsonOut)).digest('hex').slice(0, 8);
  return { url: '/hangar/lift/medtop-tor.glb', json: '/hangar/lift/medtop-tor.json', bytes, v, report: { parts: json.parts.map((p) => [p.node, p.bone, p.tris, p.closed.pos, p.open.pos]), attached, jsonBytes: statSync(jsonOut).size, materials: doc.getRoot().listMaterials().length } };
}

let prev = {};
try { prev = JSON.parse(readFileSync(MANIFEST, 'utf8')); } catch { /* erster Lauf */ }
// Die leichte Hallenstufe steht im Manifest unter hallLite: die Seite nimmt
// den ersten Eintrag unter hall als Halle.
const isLite = (kind, name) => kind === 'hall' && /-lod1$/.test(name);
const slotOf = (kind, name) => (isLite(kind, name) ? 'hallLite' : kind);
const manifest = { ships: {}, weapons: {}, hall: {}, hallLite: {}, npc: {}, lift: {}, props: {} };
let built = 0, reused = 0;
for (const kind of Object.keys(BUDGET)) {
  const dir = new URL(`${kind}/`, SRC);
  // ohne Quellordner auf diesem Rechner: bisherige Einträge unverändert übernehmen
  if (!existsSync(dir)) { for (const slot of kind === 'hall' ? ['hall', 'hallLite'] : [kind]) Object.assign(manifest[slot], prev[slot] || {}); continue; }
  for (const f of readdirSync(dir).filter((x) => x.toLowerCase().endsWith('.glb'))) {
    const name = f.replace(/\.glb$/i, '');
    const slot = slotOf(kind, name);
    if (ONLY && name !== ONLY) { if (prev[slot]?.[name]) manifest[slot][name] = prev[slot][name]; continue; }
    const inPath = fileURLToPath(new URL(f, dir));
    const outPath = fileURLToPath(new URL(`${kind}/${name}.glb`, OUT));
    // Wiederverwenden nur, wenn das Ergebnis jünger ist als alle Eingaben:
    // bei der Halle zählen Lampenprotokoll und Materialnachtrag mit, und ihre
    // Lampenliste muss schon da sein.
    const side = kind === 'hall' || kind === 'lift' ? ['lights-src.txt', 'matfix.json', 'entities.json', 'layers.json'].map((x) => fileURLToPath(new URL(`${name}.${x}`, dir))).filter((x) => existsSync(x)) : [];
    const lightsOut = fileURLToPath(new URL(`${kind}/${name}.lights.json`, OUT));
    // beim Aufzug ebenso seine Teile-/Lampenliste (writeLiftJson): fehlt sie, laesst die Seite den Schacht weg
    const liftOut = fileURLToPath(new URL(`lift/${name}.json`, OUT));
    const fresh = existsSync(outPath) && [inPath, ...side].every((x) => statSync(outPath).mtimeMs > statSync(x).mtimeMs)
      && (kind !== 'hall' || isLite(kind, name) || !side.some((x) => x.endsWith('.lights-src.txt')) || (existsSync(lightsOut) && side.every((x) => statSync(lightsOut).mtimeMs > statSync(x).mtimeMs)))
      && (kind !== 'lift' || (existsSync(liftOut) && [inPath, ...side].every((x) => statSync(liftOut).mtimeMs > statSync(x).mtimeMs)));
    // Schiffe ohne Tauschteile oder Lackkanäle (vor der Layout-Werkstatt gebaut) neu
    if (!FORCE && prev[slot]?.[name] && fresh && (kind !== 'ships' || (prev[slot][name].swap && prev[slot][name].palette))) {
      manifest[slot][name] = prev[slot][name]; reused++; continue;
    }
    try {
      const r = await buildOne(kind, name, inPath);
      if (kind === 'hall') r.room = HALL_ROOM[name.replace(/-lod1$/, '')] ?? null;
      manifest[slot][name] = r; built++;
      console.log(`  ${kind}/${name.padEnd(28)} ${r.trisRaw.toLocaleString().padStart(8)} -> ${r.tris.toLocaleString().padStart(8)} Dreiecke  ${String(r.textures).padStart(3)} Texturen  ${(r.bytes / 1048576).toFixed(2)} MB`);
      if (r.crease) console.log(`    Normalen: ${r.crease.changedPct} % der Ecken über Kanten geglättet, neu berechnet`);
      if (r.swap) console.log(`    Tauschteile: ${Object.keys(r.swap).length} Waffen-Ports (${Object.values(r.swap).reduce((a, b) => a + b, 0)} Exemplare, ${r.swapNodes} Knoten)${Object.keys(r.swap).length ? '' : ' — WARNUNG: keine Serienwaffe im Rohexport gefunden'}`);
      if (r.palette) console.log(`    Lackfarben: ${r.palette[1] + r.palette[2] + r.palette[3]} Materialien (A ${r.palette[1]}, B ${r.palette[2]}, C ${r.palette[3]})`);
      if (r.anchorBy) console.log(`    Befestigung über ${r.anchorBy === 'name' ? 'den Entity-Namen' : r.anchorBy === 'kind' ? 'das einzige Kind der Wurzel' : 'die Szenenwurzel — WARNUNG: Lage am Schiff ungeprüft'}`);
      if (r.furnitureNodes) console.log(`    Einrichtung: ${r.furnitureNodes.roots} Möbel in ${r.furnitureNodes.nodes} eigenen Knoten (Originalgröße im Viewer), Halle ${r.furnitureNodes.drawCalls} Draw-Calls`);
      if (r.hull) {
        // heile Halle: 0,04 %; aufgerissene Längswände: 1,1 bis 2,3 %
        const where = Object.entries(r.hull.walls).filter(([, n]) => n).sort((p, q) => q[1] - p[1]).map(([k, n]) => `${k} ${n}`).join(', ');
        console.log(`    Hülle: ${r.hull.pct} % von ${r.hull.rays.toLocaleString()} Blickstrahlen aus dem Raum treffen nichts${r.hull.pct > 0.5 ? ` — WARNUNG: Löcher in der Hülle (${where}; x = Längswände, z = Stirnwände, y = Decke/Boden)` : ''}`);
      }
      if (kind === 'hall' && r.tris > BUDGET.hall.tris) console.log(`    WARNUNG Halle: ${r.tris.toLocaleString()} Dreiecke über der Warnschwelle von ${BUDGET.hall.tris.toLocaleString()} (nicht dezimiert)`);
      for (const c of r.vertexColors ?? []) console.log(`    Vertexfarben: ${c.material} (${c.origin}) ${c.tris.toLocaleString()} Dreiecke, R im Mittel ${c.meanR}, ${c.below098} % der Ecken R < 0,98`);
      if (r.seams) for (const [k, s] of Object.entries({ Quelle: r.seams.source, Datei: r.seams.written })) console.log(`    Nähte (${k}): ${JSON.stringify(s)}`);
      if (r.seams) console.log(`    sealSeams: ${JSON.stringify(r.seams.seal)}`);
      console.log(`    UV: Bereich ${r.uv.rangeBefore} -> ${r.uv.rangeAfter}, ${r.uv.bits} Bit, ${r.uv.degenerate} % Dreiecke ohne UV-Fläche`);
      if (r.attached?.color !== undefined) {
        const a = r.attached;
        console.log(`    Selbstauskunft: ${r.cover.after.materials} Materialien, ${a.color} mit Farbe, ${a.normal} mit Normalen, ${a.rough} mit Rauheit, ${a.tiled} gekachelt; ${a.flatNormals} flache Normalen verworfen; ${a.blended} mit eingebackener Blendschicht (davon ${a.blendMetal} auf Metall, ${a.blendSkipped} ausgelassen); ${r.cover.after.trisOhneMaterial} Dreiecke ohne Material`);
      }
      if (r.parts) {
        for (const t of r.parts) console.log(`    Teil ${t.role.padEnd(11)} ${String(t.tris).padStart(6)} Dreiecke  ${t.materials} Materialien  aus ${t.from.join(' + ')}`);
        console.log(`    Aufzug: ${r.parts.length} Teile, ${r.tris.toLocaleString()} Dreiecke, ${r.lightCount} Lampen, ${r.deco} Beiwerk-Arten, ${r.decals} Decal-Arten, ${r.projectors} Projektormuster -> ${r.json}`);
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
// Werkstatt: eigene Quelle (zwei Stufen eines Hangars), nur bei Bedarf neu
if (!ONLY || ONLY === 'werkstatt') {
  const ins = ['util-medtop002.glb', 'util-medtop002-lod1.glb', 'util-medtop002-lod1.info.json'].map((f) => fileURLToPath(new URL(`werkstatt/${f}`, SRC)));
  const outs = ['werkstatt.glb', 'werkstatt-boden.glb', 'werkstatt.json'].map((f) => fileURLToPath(new URL(`hall/${f}`, OUT)));
  const fresh = outs.every((o) => existsSync(o)) && ins.every((i) => !existsSync(i) || outs.every((o) => statSync(o).mtimeMs > statSync(i).mtimeMs));
  if (!ins.every((i) => existsSync(i))) { if (prev.props?.werkstatt) manifest.props.werkstatt = prev.props.werkstatt; console.log('  werkstatt: Quelle fehlt (Extraktor-Teil "werkstatt"), Eintrag bleibt'); }
  else if (!FORCE && fresh && prev.props?.werkstatt) { manifest.props.werkstatt = prev.props.werkstatt; reused++; }
  else {
    try {
      const r = await buildWerkstatt();
      const { report, attached, ...entry } = r;
      manifest.props.werkstatt = entry; built++;
      console.log(`  props/werkstatt  ${r.props} Requisiten (${r.tris.toLocaleString()} Dreiecke, ${(r.bytes / 1048576).toFixed(2)} MB), ${r.decals} Decal-Arten, ${r.floors} Böden (Boden-GLB ${(r.boden.bytes / 1048576).toFixed(2)} MB), ${r.items} Einträge der Anordnung, JSON ${(r.report.jsonBytes / 1024).toFixed(0)} KB`);
      for (const [n, path, t] of r.report.props) console.log(`    ${n.padEnd(22)} ${String(t).padStart(6)} Dreiecke  ${path}`);
      for (const [n, path] of r.report.decals) console.log(`    ${n.padEnd(22)} ${path}`);
      for (const [n, path, t] of r.report.floors) console.log(`    ${n.padEnd(22)} ${path}  Kachel ${t.join(' x ')} m`);
    } catch (err) { console.error(`  props/werkstatt: FEHLER ${err.stack || err.message}`); if (prev.props?.werkstatt) manifest.props.werkstatt = prev.props.werkstatt; }
  }
} else if (prev.props?.werkstatt) manifest.props.werkstatt = prev.props.werkstatt;
// Schachttor: hängt am Schacht-Eintrag lift.medtop (eigene Quelle scripts/extract-hangar-tor.mjs)
if (manifest.lift.medtop) {
  const keep = prev.lift?.medtop?.gate;
  const tj = fileURLToPath(new URL('tor/tor.json', SRC));
  const outs = ['lift/medtop-tor.glb', 'lift/medtop-tor.json'].map((f) => fileURLToPath(new URL(f, OUT)));
  // neu bauen, sobald eine Quelle juenger ist: Auszug, Tor-Export, Lackschichten des Schachts (applyLayers in buildTor)
  let tglb = null;
  try { tglb = existsSync(tj) ? JSON.parse(readFileSync(tj, 'utf8')).glb : null; } catch { tglb = null; }
  const srcs = existsSync(tj) ? [tj, tglb && fileURLToPath(new URL(tglb, SRC)), fileURLToPath(new URL('lift/medtop.layers.json', SRC))].filter((x) => x && existsSync(x)) : [];
  const fresh = srcs.length > 0 && outs.every((o) => existsSync(o) && srcs.every((x) => statSync(o).mtimeMs > statSync(x).mtimeMs));
  if ((ONLY && ONLY !== 'tor') || !existsSync(tj) || (!FORCE && fresh && keep)) { if (keep) manifest.lift.medtop.gate = keep; }
  else {
    try {
      const r = await buildTor();
      const { report, ...gate } = r;
      manifest.lift.medtop.gate = gate; built++;
      console.log(`  lift/medtop-tor  ${report.parts.length} Knoten, ${report.parts.reduce((a, x) => a + x[2], 0).toLocaleString()} Dreiecke, ${report.materials} Materialien, ${(r.bytes / 1048576).toFixed(2)} MB, JSON ${(report.jsonBytes / 1024).toFixed(0)} KB`);
      for (const [n, b, t, c, o] of report.parts) console.log(`    ${n.padEnd(14)} ${String(b).padEnd(22)} ${String(t).padStart(6)} Dreiecke  zu ${c.join('/')}  auf ${o.join('/')}`);
    } catch (err) { console.error(`  lift/medtop-tor: FEHLER ${err.stack || err.message}`); if (keep) manifest.lift.medtop.gate = keep; }
  }
}
// Gerätekatalog: eigene Quelle (scripts/extract-hangar-katalog.mjs)
if (!ONLY || ONLY === 'katalog') {
  const q = fileURLToPath(new URL('katalog/quellen.json', SRC)), qi = fileURLToPath(new URL('katalog/inventar.json', SRC));
  // neu bauen, sobald eine der beiden Quellen juenger ist (inventar.json schreibt der Auszug zuerst)
  const newest = () => Math.max(statSync(q).mtimeMs, existsSync(qi) ? statSync(qi).mtimeMs : 0);
  if (!existsSync(q)) { if (prev.props?.katalog) manifest.props.katalog = prev.props.katalog; console.log('  katalog: Quelle fehlt (scripts/extract-hangar-katalog.mjs), Eintrag bleibt'); }
  else if (!FORCE && prev.props?.katalog && existsSync(fileURLToPath(new URL('props/katalog.json', OUT))) && statSync(fileURLToPath(new URL('props/katalog.json', OUT))).mtimeMs > newest()) { manifest.props.katalog = prev.props.katalog; reused++; }
  else {
    try {
      const r = await buildKatalog();
      const { report, ...entry } = r;
      manifest.props.katalog = entry; built++;
      console.log(`  props/katalog  ${r.props} Requisiten in ${Object.keys(r.kategorien).length} Kategorien, katalog.json ${(r.bytes / 1024).toFixed(0)} KB`);
      for (const [k, n, t, b] of report.kats) console.log(`    ${k.padEnd(12)} ${String(n).padStart(3)} Requisiten  ${String(t).padStart(7)} Dreiecke  ${(b / 1048576).toFixed(2)} MB`);
      console.log(`    mit Spielname ${report.name}, mit Beschreibung ${report.desc}, mit Zweck (abgeleitet) ${report.zweck}, mit Aufstellung aus dem Spiel ${report.auf}, mit Anschlusspunkten 0`);
      console.log(`    Arbeitsplätze ${report.ap}, Leitungen ${report.lt}; Schiffsanschlüsse: ${report.ports}`);
    } catch (err) { console.error(`  props/katalog: FEHLER ${err.stack || err.message}`); if (prev.props?.katalog) manifest.props.katalog = prev.props.katalog; }
  }
} else if (prev.props?.katalog) manifest.props.katalog = prev.props.katalog;
// Schlüssel, die andere Skripte pflegen (z. B. weapons), bleiben stehen;
// Reihenfolge wie bisher in der Datei
const merged = { source: 'StarBreaker entity/socpak export -> gltf-transform (Draco, WebP)' };
for (const k of Object.keys(prev)) if (k !== 'source') merged[k] = k in manifest ? manifest[k] : prev[k];
for (const k of Object.keys(manifest)) if (!(k in merged)) merged[k] = manifest[k];
await writeFile(MANIFEST, JSON.stringify(merged, null, 2) + '\n', 'utf8');
console.log(`${built} gebaut, ${reused} unveraendert -> src/data/hangar-assets.json`);
