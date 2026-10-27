// Baut aus rohen, TEXTURIERTEN StarBreaker-Exporten die Web-Modelle der
// Hangar-Seite (assets/hangar-viewer.js): Schiffe mit echtem Lack, die Halle,
// die Hangar-Crew.
//
// Eingabe (gitignored, von scripts/extract-hangar-sources.mjs):
//   .cache/hangar-src/ships/<slug>.glb       entity export --materials all, mit Innenraum (+ .json)
//   .cache/hangar-src/hall/<key>.glb         socpak export (Texturen NUR als Pfad)
//   .cache/hangar-src/tex/<p4k-pfad>.png     dazu dekodierte Hallen-Texturen
//   .cache/hangar-src/npc/<key>.glb          entity export eines NPC-Archetyps
//   .cache/hangar-src/weapons/<datei>.glb    entity export einer Bordwaffe (+ .json)
// Ausgabe:
//   public/hangar/{ships,weapons,hall,npc}/<name>.glb   dezimiert, Draco, WebP-Texturen
//   public/hangar/tex/<inhalt>.webp             Bilder der Schiffe, schiffsübergreifend einmal
//                                               (scripts/lib/glb-texpool.mjs)
//   src/data/hangar-assets.json                 Manifest (url, v, tris, bytes)
//
// Rohe Spieldateien werden NIE eingecheckt — nur diese Ausgabe.
//
// Usage:  node scripts/build-hangar-assets.mjs [--only <name>] [--kind <art>] [--ships <slug,slug|all>] [--force]
//
// Schiffe bekommen eine Web-Fassung, wenn sie schon im Manifest stehen oder
// unter --ships genannt sind; der Rohbestand umfasst alle Hangar-Schiffe.
// --kind beschränkt den Lauf auf eine Art (ships, weapons, hall, …), die
// übrigen Einträge bleiben. Probelauf ohne Folgen für die Seite:
// HANGAR_OUT=<ordner> schreibt Modelle und Manifest dorthin.
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression, EXTTextureWebP, KHRTextureTransform } from '@gltf-transform/extensions';
import { dedup, prune, weld, flatten, join, joinPrimitives, simplify, draco, textureCompress, transformMesh, transformPrimitive, getBounds, mergeDocuments, unpartition } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3d';
import { creaseNormals } from './lib/crease-normals.mjs';
import { sample as sampleCaf, sampleRot as sampleCafRot } from './lib/ivo-caf.mjs';
import { normalizeUvIslands, degenerateUvShare, texcoordBits } from './lib/uv-islands.mjs';
import { sealSeams, seamStats } from './lib/hall-seams.mjs';
import { hallRaycaster, orientHallLights } from './lib/hall-lights.mjs';
import { hullLeaks, floorLevel } from './lib/hall-hull.mjs';
import { poolGlbFile, prunePool } from './lib/glb-texpool.mjs';
import { initGear, poseShip } from './lib/landing-gear.mjs';
import { gearPlane, GEAR_TILT_MAX } from '../assets/hangar-viewer.js';
import { openP4k, DEFAULT_P4K } from './lib/p4k.mjs';
import { openDataCore } from './lib/datacore.mjs';
import sharp from 'sharp';
import { readdirSync, existsSync, mkdirSync, statSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = new URL('../.cache/hangar-src/', import.meta.url);
const PROBE = process.env.HANGAR_OUT ? pathToFileURL(process.env.HANGAR_OUT.replace(/[\\/]?$/, '/')) : null;
const OUT = PROBE ?? new URL('../public/hangar/', import.meta.url);
const MANIFEST = PROBE ? new URL('hangar-assets.json', PROBE) : new URL('../src/data/hangar-assets.json', import.meta.url);
// Hallentexturen in mip 1 (halbe Kantenlänge), dekodiert vom Extraktor
const TEX_DIR = new URL('tex-m1/', SRC);

const argv = process.argv.slice(2);
const ONLY = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
const KIND = argv.includes('--kind') ? argv[argv.indexOf('--kind') + 1] : null;
const SHIPS_ARG = argv.includes('--ships') ? argv[argv.indexOf('--ships') + 1].split(',') : [];
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
  // Werkhalle für Bodenfahrzeuge (.planning/notes/hangar-werkhalle.md): wie
  // die Halle nie dezimiert; die Grenzen des Auftrags sind Warnschwellen
  werkhalle: { tris: 600000, tex: 1024, ntex: 512, materials: 80, bytes: 12 << 20 },
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
// wiederverwendet (Name „<mtl>_mtl_<name>_<index>“), sonst neu angelegt und
// mit extras.matfix markiert (nur an diese hängen Schiffe Karten).
// Schiffe (ship): Schlüssel ist der volle Mesh-Name, je Name ggf. mehrere
// Einträge, unterschieden an den Dreieckszahlen; neue Materialien heißen wie
// die des Exports (Index mit führender 0, dann trifft sie auch ein Lack),
// Decals blenden, Glow leuchtet, Schichten gehen an applyLayers; die schon
// aufgelösten Materialien des Schiffs bleiben unberührt.
function applyMatFix(doc, fix, { ship = false } = {}) {
  const root = doc.getRoot();
  const mats = root.listMaterials();
  const made = new Map();
  const matFor = (base, id) => {
    const sub = fix.mtls[base]?.[id];
    if (!sub?.name) return null;
    if (/nodraw/i.test(sub.shader || '')) return 'drop';
    const key = `${base}_mtl_${sub.name}_`;
    // Schiffe: der Export schreibt den .mtl-Namen teils klein (orig_300i_ext)
    const fold = (s) => (ship ? s.toLowerCase() : s);
    const hit = mats.find((m) => fold(m.getName()).startsWith(fold(key)) && Number(m.getName().slice(key.length)) === id);
    if (hit) return hit;
    if (!made.has(key)) {
      const dif = String(sub.diffuse || '1,1,1').split(',').map(Number);
      const m = doc.createMaterial(`${key}${ship ? `0${id}` : String(id).padStart(2, '0')}`)
        .setBaseColorFactor([...dif.slice(0, 3), 1]).setRoughnessFactor(Math.max(0.2, 1 - Number(sub.shininess || 128) / 255))
        .setExtras({
          diffuse_tex: sub.d, normal_tex: sub.n, spec_tex: sub.s, tile_d: sub.td, tile_n: sub.tn, blend: sub.blend, vc: sub.vc, is_glass: /glass/i.test(sub.shader || ''),
          semantic: { authored_attributes: [{ name: 'Shader', value: sub.shader }, { name: 'Specular', value: sub.specular }, { name: 'Shininess', value: sub.shininess }] },
          matfix: true,
          ...(ship ? { glow: sub.glow, layers: sub.layers } : {}),
        });
      if (ship && sub.decal) m.setAlphaMode('BLEND');
      made.set(key, m);
    }
    return made.get(key);
  };
  const entry = (mesh) => {
    if (!ship) return fix.meshes[mesh.getName().replace(/.*[\\/]/, '').replace(/\.(cgf|cga)$/i, '')];
    const tris = JSON.stringify(mesh.listPrimitives().map((p) => (p.getIndices()?.getCount() ?? 0) / 3));
    return fix.meshes[mesh.getName()]?.find((e) => JSON.stringify(e.tris) === tris);
  };
  let fixed = 0, dropped = 0, reused = 0;
  for (const mesh of root.listMeshes()) {
    const f = entry(mesh);
    if (!f) continue;
    mesh.listPrimitives().forEach((p, i) => {
      if (p.getMaterial()?.getName()) return;
      const m = matFor(f.mtl, f.ids[i]);
      if (m === 'drop') { mesh.removePrimitive(p); p.dispose(); dropped++; }
      // Markierung für die Selbstauskunft der Vertexfarben (stripAttributes)
      else if (m) { p.setMaterial(m).setExtras({ ...p.getExtras(), matfix: true }); fixed++; if (!m.getExtras()?.matfix) reused++; }
    });
  }
  // Specular-Maps und Kachelung (TexMod) auch für die schon aufgelösten
  // Materialien nachtragen — die nennt der Export nicht
  if (!ship) for (const m of mats) {
    const [base, rest] = m.getName().split('_mtl_');
    const sub = rest && fix.mtls[base]?.find((s, i) => s.name && rest.startsWith(s.name + '_') && Number(rest.slice(s.name.length + 1)) === i);
    if (sub) m.setExtras({ ...m.getExtras(), spec_tex: sub.s, tile_d: sub.td, tile_n: sub.tn, blend: sub.blend, vc: sub.vc });
  }
  return { fixed, dropped, created: made.size, ...(ship ? { reused } : {}) };
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
// only: nur diese Materialien (Schiffe: die nachgetragenen, die übrigen
// tragen ihre eingebetteten Karten)
async function attachHallTextures(doc, only = null) {
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
  for (const m of [...used].filter((u) => u && (!only || only(u)))) {
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
// paintTargets: Materialien, die ein Lack ändert (paintPlan), tragen
// extras.paint = ihr Name und bleiben so eigenständig.
function cleanMaterials(doc, { paletteOwner, paintTargets } = {}) {
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
    const ownTint = paletteOwner && [1, 2, 3].includes(x.palette_tint) && (source == null || source.toLowerCase() === paletteOwner);
    m.setExtras({ ...(ownTint ? { palette_tint: x.palette_tint } : {}), ...(paintTargets?.has(m.getName().toLowerCase()) ? { paint: m.getName() } : {}) });
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
// Werkhalle (fixtures): je Lampe der Leuchtkörper, in dessen um 0,6 m
// erweiterter Box sie liegt (der nächste, wenn mehrere), als fixture.
function hallLights(doc, name, { kind = 'hall', fixtures = null } = {}) {
  const srcFile = fileURLToPath(new URL(`${kind}/${name}.lights-src.txt`, SRC));
  // Ohne Exportprotokoll kennt der Build weder Spieltyp noch Spielstärke: Die
  // Werte der Lichtknoten allein ergäben eine falsche Beleuchtung. Dann bleibt
  // die bisherige Lampenliste stehen, und der Hinweis sagt, was zu tun ist.
  if (!existsSync(srcFile)) return { missing: `${kind}/${name}.lights-src.txt` };
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
  if (fixtures) for (const l of lights) {
    let best = null, bd = Infinity;
    for (const f of fixtures) {
      if (l.pos.some((v, i) => v < f.box[0][i] - 0.6 || v > f.box[1][i] + 0.6)) continue;
      const d = Math.hypot(...l.pos.map((v, i) => v - f.pos[i]));
      if (d < bd) { bd = d; best = f; }
    }
    if (best) { l.fixture = best.node; (best.lights ??= []).push(l.name); }
  }
  const outFile = fileURLToPath(new URL(`${kind}/${name}.lights.json`, OUT));
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify({ v: 2, lights }) + '\n');
  const byType = {};
  for (const l of lights) byType[l.type] = (byType[l.type] || 0) + 1;
  return { total: lights.length, byType, matched: lights.length - [...src.values()].reduce((n, a) => n + a.length, 0), orient, ...(fixtures ? { withFixture: lights.filter((l) => l.fixture).length } : {}) };
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

// Innenraum nur bei Jägern, deren Cockpit man durch die Haube sieht. Bei
// allen anderen sind Kabinen und Laderäume von außen unsichtbar, aber bis zu
// zwei Drittel der Dreiecke (Aurora Mk II: 2 von 3 Millionen). Der Rohexport
// trägt den Innenraum (extract-hangar-sources.mjs): jeder Container ist ein
// Knoten interior_* unter der Wurzel, die Außenhaut hängt daneben.
const KEEP_INTERIOR = new Set(['aegs-gladius', 'anvl-arrow', 'anvl-hornet-f7c-mk2', 'aegs-avenger-titan', 'orig-300i', 'aegs-sabre']);
// Hangar-Alle (.planning/notes/hangar-alle-schiffe.md): der Innenraum bleibt
// auch, wenn Rumpf und Innenraum roh höchstens das 1,5-fache des
// Dreiecksbudgets haben (dann kostet die Dezimierung den Rumpf kaum etwas);
// HANGAR_SHIP_NO_INTERIOR=1 nimmt ihn sonst immer (erste Stufe gegen die 16 MB).
// KEEP_INTERIOR geht vor: dort sähe man durch die Haube ein leeres Cockpit
function dropInterior(doc, slug, rawTris = Infinity, budgetTris = 0) {
  if (KEEP_INTERIOR.has(slug)) return 0;
  if (!process.env.HANGAR_SHIP_NO_INTERIOR && rawTris <= 1.5 * budgetTris) return 0;
  let dropped = 0;
  for (const scene of doc.getRoot().listScenes()) for (const top of scene.listChildren()) {
    for (const c of top.listChildren()) if (/^interior_/i.test(c.getName())) { c.traverse((n) => n.setMesh(null)); top.removeChild(c); dropped++; }
  }
  return dropped;
}

// Budget je Schiff: 200 000 Dreiecke, ab 60 m Länge 400 000; Farbe/Leuchten
// 1024 px, übrige Karten 512 px. HANGAR_SHIP_TEX / HANGAR_SHIP_Q verkleinern
// Farbkarten und WebP-Qualität (Stufen gegen die 16 MB je Schiff).
const SHIP_LEN = new Map(JSON.parse(readFileSync(new URL('../src/data/vehicles.json', import.meta.url), 'utf8')).vehicles.map((v) => [v.id, v.lengthM ?? 0]));
function shipBudget(slug) {
  const tex = Number(process.env.HANGAR_SHIP_TEX || BUDGET.ships.tex);
  return { ...BUDGET.ships, tris: (SHIP_LEN.get(slug) ?? 0) >= 60 ? 400000 : BUDGET.ships.tris, tex, ntex: Math.min(BUDGET.ships.ntex, tex), q: process.env.HANGAR_SHIP_Q ? Number(process.env.HANGAR_SHIP_Q) : null };
}

// Fahrwerk: dieselbe Pose wie die Geometrie-Fassung (scripts/lib/landing-gear.mjs),
// auf den Rohexport vor allem Weiteren
let gearReady = false;
function shipGear(doc, slug) {
  const rec = shipSource(slug).record;
  if (!rec) return null;
  if (!gearReady) { const p = openP4k(DEFAULT_P4K); initGear(p, openDataCore(p.read(/^Data[\\/]Game2\.dcb$/i))); gearReady = true; }
  return poseShip(doc, rec);
}
// Knoten, die die Szene nicht erreicht, weg: im Rohexport hängen manche im
// Kreis (M80, Salvation), dann läuft jede Weltmatrix endlos; gezeichnet
// würden sie ohnehin nicht
function dropUnreachable(doc) {
  const seen = new Set();
  const walk = (n) => { if (seen.has(n)) return; seen.add(n); n.listChildren().forEach(walk); };
  for (const s of doc.getRoot().listScenes()) s.listChildren().forEach(walk);
  const lost = doc.getRoot().listNodes().filter((n) => !seen.has(n));
  for (const n of lost) for (const c of n.listChildren()) n.removeChild(c);
  for (const n of lost) n.dispose();
  return lost.length;
}
// Prüfung an der geschriebenen Webdatei: je Aufstandspunkt die tiefste Ecke im
// Umkreis von 0,6 m (x/z); gear: true, wenn alle auf 2 cm stimmen
function gearCheck(written, gear) {
  if (!gear) return { ok: false, why: 'kein Fahrwerkseintrag' };
  if (gear.pose !== 'aus') return { ok: false, why: `Fahrwerk ${gear.pose}${gear.why ? `: ${gear.why.slice(0, 160)}` : ''}` };
  if (gear.contacts.length < 3) return { ok: false, why: `nur ${gear.contacts.length} Aufstandspunkte` };
  // Ebene durch die Aufstandspunkte: die des Viewers (gearPlane, auch seine
  // Grenzen), sonst misst der Bau gegen eine andere als das Tor.
  // Nichts darf senkrecht mehr als 20 cm darunter liegen (wie verify:hangar-gear [3]);
  // Apollo und Hermes behalten hier Teile, die die Geometrie-Fassung weglässt
  const pl = gearPlane(gear.contacts);
  if (!pl) return { ok: false, why: `keine Ebene durch die Aufstandspunkte (auf einer Linie oder steiler als ${GEAR_TILT_MAX} Grad)` };
  const low = gear.contacts.map(() => Infinity), e = [0, 0, 0], norm = 1 / Math.hypot(pl.a, 1, pl.b);
  let sink = 0;
  for (const n of written.getRoot().listNodes()) {
    const m = n.getMesh(); if (!m) continue;
    const W = n.getWorldMatrix();
    for (const p of m.listPrimitives()) {
      // nur Ecken, die ein Dreieck nutzt, wie in poseShip
      const a = p.getAttribute('POSITION'), idx = p.getIndices(); if (!a) continue; const used = idx ? new Set(idx.getArray()) : null;
      for (let i = 0; i < a.getCount(); i++) {
        if (used && !used.has(i)) continue;
        a.getElement(i, e);
        const x = W[0] * e[0] + W[4] * e[1] + W[8] * e[2] + W[12], y = W[1] * e[0] + W[5] * e[1] + W[9] * e[2] + W[13], z = W[2] * e[0] + W[6] * e[1] + W[10] * e[2] + W[14];
        gear.contacts.forEach((c, k) => { if (y < low[k] && Math.hypot(x - c[0], z - c[2]) <= 0.6) low[k] = y; });
        sink = Math.min(sink, (y - (pl.a * x + pl.b * z + pl.c)) * norm);
      }
    }
  }
  const dev = low.map((y, k) => Math.round((y - gear.contacts[k][1]) * 1000) / 1000);
  const worst = Math.max(...dev.map((d) => (Number.isFinite(d) ? Math.abs(d) : Infinity)));
  const deep = sink < -0.2;
  const why = worst > 0.02 ? `Aufstandspunkte weichen bis ${Number.isFinite(worst) ? worst.toFixed(3) : '∞'} m ab` : deep ? `ein Teil steckt ${Math.round(-sink * 100)} cm im Boden` : null;
  return { ok: !why, dev, sink: Math.round(sink * 1000) / 1000, ...(why ? { why } : {}) };
}

// Herkunft des Rohexports (Sidecar des Extraktors): welcher Record, welcher
// Spielstand. Ältere Rohexporte ohne Sidecar: keine Angabe.
function shipSource(slug, interiorDropped) {
  const f = fileURLToPath(new URL(`ships/${slug}.json`, SRC));
  if (!existsSync(f)) return { interiorDropped };
  const s = JSON.parse(readFileSync(f, 'utf8'));
  return { record: s.record, game: s.sig?.build?.change ?? null, interiorDropped };
}

// ─── Lackierungen: Bauplan je Lack (public/hangar/paints/<slug>.json) ─────
// Quelle: der zerlegte Export (.cache/hangar-src/ships-dec/, Extraktor-Teil
// ships). Je Lackvariante (SubGeometry-Tag, wie in ship-paints.json):
//   palette   Lackkanäle A/B/C und Glas als #rrggbb, Finish je Kanal (Glätte
//             0–255, Specular linear: hoch = Metall, Gold farbig) und das
//             Palettendecal (Logo-Schablone, Kanäle R/G/B je eine Farbe)
//   materials je GLB-Material, das der Lack gegenüber dem Serienmaterial
//             ändert: stencil (dreikanalige SDF-Maske aus TexSlot7 mit den
//             Stencil-Parametern der .mtl, roh) und layers (Schicht-.mtl,
//             Lackkanal, Tönung, Glanz, Karten), nur wo abweichend
// Karten als .webp unter paints/tex/ (Kante ≤ 512), von allen Schiffen geteilt.
// ids: Lackierungen aus src/data/ship-paints.json mit diesem Tag (Kennungen der
// Werkstatt, hangar-layouts.json); Varianten ohne Lack-Item tragen keine.
const PAINT_DEC = new URL('ships-dec/', SRC);
// Gemeinsame Ablage der Schiffsbilder (scripts/lib/glb-texpool.mjs); der
// Verweis im GLB ist relativ, ships/<slug>.glb -> ../tex/<inhalt>.webp
const SHIP_POOL = { poolDir: fileURLToPath(new URL('tex/', OUT)), uriPrefix: '../tex/' };
// Selbstauskunft je Schiff: Bilder, ihre Bytes (geteilte voll gezählt) und
// was dieses Schiff neu in die Ablage gebracht hat
const poolShare = (r) => ({ images: r.images.length, bytes: r.images.reduce((a, i) => a + i.bytes, 0), fresh: r.images.filter((i) => i.fresh).reduce((a, i) => a + i.bytes, 0) });
const PAINT_TEX = 512;
const SHIP_PAINTS = JSON.parse(readFileSync(new URL('../src/data/ship-paints.json', import.meta.url), 'utf8')).ships;
const linHex = (c) => '#' + c.slice(0, 3).map((v) => { const s = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055; return Math.round(Math.max(0, Math.min(1, s)) * 255).toString(16).padStart(2, '0'); }).join('');
const r4 = (v) => Math.round(v * 1e4) / 1e4;
async function paintTexture(rel, made) {
  if (!rel) return null;
  const src = fileURLToPath(new URL(rel, PAINT_DEC));
  if (!existsSync(src)) return null;
  // Name mit Inhaltskennung: gleich heißende Karten aus verschiedenen Ordnern
  // überschreiben sich in der geteilten Ablage nicht, gleiche bleiben geteilt
  const sum = createHash('sha1').update(readFileSync(src)).digest('hex').slice(0, 8);
  const name = `${rel.split('/').pop().replace(/_TEX\d+\.png$/i, '').toLowerCase()}-${sum}.webp`;
  if (!made.has(name)) {
    const out = fileURLToPath(new URL(`paints/tex/${name}`, OUT));
    mkdirSync(dirname(out), { recursive: true });
    await sharp(src).resize(PAINT_TEX, PAINT_TEX, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85, alphaQuality: 90 }).toFile(out);
    made.set(name, out);
  }
  return `/hangar/paints/tex/${name}`;
}
// Zwei Schritte: paintPlan() vor dem Bau (targets = GLB-Materialien, die ein
// Lack ändert; cleanMaterials markiert sie, damit dedup() sie nicht mit
// gleich aussehenden zusammenlegt und ihr Name bleibt), writePaints() danach
// gegen die Materialien des geschriebenen GLB.
// Fehlt einer Variante die Palette im eigenen Paket (600i BIS2951: Cold Forge,
// Sterling), dieselbe Lackierung (gleicher Tag) aus einem Schwesterpaket mit
// Palette, aus der eigenen Familie (gleiche zwei ersten Wörter: ORIG 600i) oder
// aus dem einzigen anderen Paket mit dem Tag; mehrere fremde sind mehrdeutig
let sisterIndex = null;
function sisterPalette(pkg, tag) {
  if (!tag) return null;
  if (!sisterIndex) {
    sisterIndex = new Map();
    const dir = new URL('Packages/', PAINT_DEC);
    for (const p of existsSync(dir) ? readdirSync(dir) : []) {
      const f = (n) => new URL(`Packages/${p}/${n}`, PAINT_DEC);
      if (!existsSync(f('paints.json')) || !existsSync(f('palettes.json'))) continue;
      const pals = new Map(JSON.parse(readFileSync(f('palettes.json'), 'utf8')).palettes.map((x) => [x.id, x]));
      for (const v of JSON.parse(readFileSync(f('paints.json'), 'utf8')).paint_variants ?? []) {
        const pal = pals.get(v.palette_id), k = v.subgeometry_tag?.toLowerCase();
        if (!pal || !k) continue;
        if (!sisterIndex.has(k)) sisterIndex.set(k, []);
        sisterIndex.get(k).push({ pkg: p, pal });
      }
    }
  }
  const fam = (p) => p.split(/[ _]/).slice(0, 2).join(' ').toLowerCase();
  const hits = sisterIndex.get(tag.toLowerCase())?.filter((h) => h.pkg !== pkg) ?? [];
  // Nur eindeutig: eigene Familie, sonst ein einziges Paket mit dem Tag
  const hit = hits.find((h) => fam(h.pkg) === fam(pkg)) ?? (hits.length === 1 ? hits[0] : null);
  if (hit) sisterUsed.push(`${pkg}: ${tag} aus ${hit.pkg}`);
  return hit?.pal ?? null;
}
const sisterUsed = [];
async function paintPlan(slug) {
  const index = existsSync(new URL('index.json', PAINT_DEC)) ? JSON.parse(readFileSync(new URL('index.json', PAINT_DEC), 'utf8')) : {};
  // Paketname wie StarBreaker ihn bildet: Record, Unterstriche als Leerzeichen
  const pkg = index[slug]?.package ?? (index[slug]?.record ? `${index[slug].record.replace(/_/g, ' ')}_LOD1_TEX1` : null);
  if (!pkg || !existsSync(new URL(`Packages/${pkg}/`, PAINT_DEC))) return null;
  const P = new URL(`Packages/${pkg}/`, PAINT_DEC);
  const read = (u) => JSON.parse(readFileSync(u, 'utf8'));
  const opt = (f, k) => (existsSync(new URL(f, P)) ? read(new URL(f, P))[k] : []);
  const variants = opt('paints.json', 'paint_variants');
  const liveries = opt('liveries.json', 'liveries');
  const palettes = new Map(opt('palettes.json', 'palettes').map((p) => [p.id, p]));
  if (!variants.length) return null;
  const own = liveries.find((l) => l.entity_names.some((n) => n.startsWith('EntityClassDefinition.')));
  const sidecar = (rel) => (rel && existsSync(new URL(rel, PAINT_DEC)) ? read(new URL(rel, PAINT_DEC)) : null);
  const bases = (own?.material_sidecars ?? []).map(sidecar).filter(Boolean);
  const made = new Map();
  // Name des GLB-Materials, klein geschrieben: der Pfad der .mtl kann anders
  // geschrieben sein als ihr Dateiname (anvl_arrow.mtl, im GLB ANVL_Arrow_mtl_…)
  const glbName = (stem, s) => `${stem}_mtl_${s.submaterial_name}_0${s.index}`.toLowerCase();
  const params = (s) => Object.fromEntries((s.authored_public_params ?? []).map((p) => [p.name, p.value]));
  const num = (v) => (v == null ? null : r4(Number(v)));
  const col = (v) => (v == null ? null : linHex(String(v).split(',').map(Number)));
  const slot7 = (s) => (s.texture_slots ?? []).find((t) => t.slot === 'TexSlot7' && !t.is_virtual);
  const layerSig = (l) => ({ mtl: l.source_material_path ?? null, palette: l.palette_channel?.index ?? null, tint: l.authored_attributes?.find((a) => a.name === 'TintColor')?.value ?? null, gloss: l.gloss_mult ?? null, tiling: l.authored_attributes?.find((a) => a.name === 'UVTiling')?.value ?? null });
  let stencils = 0, layerSwaps = 0;
  const targets = new Set();
  const paints = [];
  for (const v of variants) {
    const pal = palettes.get(v.palette_id) ?? sisterPalette(pkg, v.subgeometry_tag);
    const ids = (SHIP_PAINTS[slug]?.paints ?? []).filter((p) => p.tag?.toLowerCase() === v.subgeometry_tag?.toLowerCase()).map((p) => p.id);
    const look = { tag: v.subgeometry_tag, ids, name: v.display_name ?? null, palette: null, materials: {} };
    // Ohne Palette im zerlegten Export (Freelancer Storm Surge): die Lackkanäle
    // aus ship-paints.json (dieselbe Palette, aus dem Schiffs-Record gelesen)
    const listed = !pal && (SHIP_PAINTS[slug]?.paints ?? []).find((p) => p.tag?.toLowerCase() === v.subgeometry_tag?.toLowerCase());
    if (listed) {
      const none = { gloss: null, specular: null };
      look.palette = { a: listed.a, b: listed.b, c: listed.c, glass: null, finish: { a: none, b: none, c: none }, decal: null };
    }
    if (pal) {
      const fin = (k) => ({ gloss: pal.finish?.[k]?.glossiness ?? null, specular: pal.finish?.[k]?.specular ? linHex(pal.finish[k].specular) : null });
      look.palette = {
        a: linHex(pal.primary), b: linHex(pal.secondary), c: linHex(pal.tertiary), glass: pal.glass ? linHex(pal.glass) : null,
        finish: { a: fin('primary'), b: fin('secondary'), c: fin('tertiary') },
        decal: pal.decal?.export_path ? { map: await paintTexture(pal.decal.export_path, made), colors: [pal.decal.red, pal.decal.green, pal.decal.blue].map(linHex) } : null,
      };
    }
    const paint = sidecar(v.exterior_material_sidecar);
    if (paint) {
      // Serienmaterial: die .mtl des Schiffs mit den meisten gleichnamigen Untermaterialien
      const names = new Set(paint.submaterials.map((s) => s.submaterial_name));
      const base = bases.map((b) => [b, b.submaterials.filter((s) => names.has(s.submaterial_name)).length]).sort((x, y) => y[1] - x[1])[0]?.[0];
      const stem = base ? String(base.source_material_path).replace(/\\/g, '/').split('/').pop().replace(/\.mtl$/i, '') : null;
      for (const s of base ? paint.submaterials : []) {
        const b = base.submaterials.find((x) => x.index === s.index && x.submaterial_name === s.submaterial_name);
        if (!b) continue;
        const o = {};
        const t7 = slot7(s);
        if (t7 && (!slot7(b) || slot7(b).export_path !== t7.export_path || JSON.stringify(params(b)) !== JSON.stringify(params(s)))) {
          const p = params(s);
          o.stencil = {
            map: await paintTexture(t7.export_path, made), uv: Number(p.UseUV2ForStencil ?? 0), tiling: num(p.StencilTiling ?? 1),
            tint: num(p.StencilTintOverride), opacity: num(p.StencilOpacity ?? 1),
            colors: [p.StencilDiffuseColor, p.StencilDiffuseColor2, p.StencilDiffuseColor3].map(col),
            specular: [p.StencilSpecularColor, p.StencilSpecularColor2, p.StencilSpecularColor3].map(col),
            breakup: num(p.StencilDiffuseBreakup), breakupTiling: num(p.StencilBreakupTiling),
            sticker: /%STENCIL_AS_STICKER(?![A-Z_])/.test(s.authored_attributes?.find((a) => a.name === 'StringGenMask')?.value ?? ''),
          };
          stencils++;
        }
        const la = (s.layer_manifest ?? []).map(layerSig), lb = (b.layer_manifest ?? []).map(layerSig);
        if (JSON.stringify(la) !== JSON.stringify(lb)) {
          o.layers = [];
          for (const [i, l] of (s.layer_manifest ?? []).entries()) {
            const swapped = la[i].mtl !== lb[i]?.mtl;
            o.layers.push({ name: l.name, ...la[i], ...(swapped ? { diffuse: await paintTexture(l.diffuse_export_path, made), normal: await paintTexture(l.normal_export_path, made) } : {}) });
            if (swapped) layerSwaps++;
          }
        }
        if (!Object.keys(o).length) continue;
        const name = glbName(stem, s);
        targets.add(name);
        look.materials[name] = o;
      }
    }
    paints.push(look);
  }
  return { pkg, paints, targets, made, stencils, layerSwaps };
}
function writePaints(slug, plan, glbMaterials) {
  const actual = new Map([...glbMaterials].map((n) => [n.toLowerCase(), n]));
  const missing = [...plan.targets].filter((n) => !actual.has(n));
  const paints = plan.paints.map((p) => ({ ...p, materials: Object.fromEntries(Object.entries(p.materials).filter(([n]) => actual.has(n)).map(([n, o]) => [actual.get(n), o])) }));
  const out = fileURLToPath(new URL(`paints/${slug}.json`, OUT));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ v: 1, ship: slug, package: plan.pkg, paints }) + '\n');
  const hash = createHash('sha1').update(readFileSync(out));
  for (const f of [...plan.made.values()].sort()) hash.update(readFileSync(f));
  return { url: `/hangar/paints/${slug}.json`, v: hash.digest('hex').slice(0, 8), paints: paints.length, linked: paints.filter((p) => p.ids.length).length, patterned: paints.filter((p) => Object.keys(p.materials).length).length, stencils: plan.stencils, layerSwaps: plan.layerSwaps, textures: plan.made.size, missing: missing.length, missingNames: missing };
}

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
// Textures hängt sie danach wie eigene Karten an. only wie dort.
function applyLayers(doc, name, dir = 'lift', only = null) {
  const f = fileURLToPath(new URL(`${dir}/${name}.layers.json`, SRC));
  if (!existsSync(f)) return { missing: true };
  const layers = JSON.parse(readFileSync(f, 'utf8'));
  const s = { materials: 0, textured: 0, glow: 0 };
  for (const m of doc.getRoot().listMaterials().filter((x) => !only || only(x))) {
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

// ─── Werkhalle (.planning/notes/hangar-werkhalle.md) ────────────────────
// Leuchtkörper (Netzname mit „light“) heißen leuchte_<netz>_<nn> und bleiben
// eigene Knoten, damit der Viewer sie einzeln schaltet; Torblätter (tor_*)
// und Bühnen (buehne_*) tragen ihren Namen aus dem Extraktor. Alle übrigen
// Netzknoten verlieren ihren Namen, damit join sie zusammenlegt (Lichtknoten
// behalten ihn: hallLights verbindet über ihn das Exportprotokoll).
const WERK_FIXTURE = /light/i;
const WERK_KEEP = /^(tor|buehne)_/;
function markWerkhalle(doc) {
  const root = doc.getRoot();
  const base = (m) => m.getName().replace(/.*[\\/]/, '').replace(/\.(cgf|cga)$/i, '');
  const found = [];
  for (const n of root.listNodes()) {
    const m = n.getMesh();
    if (!m || WERK_KEEP.test(n.getName()) || !WERK_FIXTURE.test(base(m))) continue;
    const b = getBounds(n);
    found.push({ n, mesh: base(m), box: [b.min, b.max], c: [0, 1, 2].map((k) => (b.min[k] + b.max[k]) / 2) });
  }
  // je Leuchtkörper von vorn (Tor) nach hinten, dann von links nach rechts
  found.sort((a, b) => a.mesh.localeCompare(b.mesh) || a.c[2] - b.c[2] || a.c[0] - b.c[0]);
  const count = new Map();
  const fixtures = found.map((f) => {
    const i = count.get(f.mesh) ?? 0;
    count.set(f.mesh, i + 1);
    const node = `leuchte_${f.mesh}_${String(i).padStart(2, '0')}`;
    f.n.setName(node);
    // Decke ab 6,5 m (die Decke hängt 6,9 bis 8,4 m hoch), Boden unter 0,4 m
    const mount = f.c[1] > 6.5 ? 'decke' : f.c[1] < 0.4 ? 'boden' : 'wand';
    return { node, mesh: f.mesh, pos: f.c.map(r3), box: f.box.map((v) => v.map(r3)), mount };
  });
  const named = new Set();
  for (const n of root.listNodes()) {
    if (n.getName().startsWith('leuchte_') || WERK_KEEP.test(n.getName())) { if (n.getMesh()) named.add(n.getMesh()); continue; }
    if (n.getMesh()) n.setName('');
  }
  for (const m of root.listMeshes()) if (!named.has(m)) m.setName('');
  const nodes = root.listNodes().map((n) => n.getName());
  const mounts = Object.fromEntries(['decke', 'wand', 'boden'].map((m) => [m, fixtures.filter((f) => f.mount === m).length]));
  return { fixtures, counts: { fixtures: fixtures.length, ...mounts, tor: nodes.filter((n) => n.startsWith('tor_')).length, buehne: nodes.filter((n) => n.startsWith('buehne_')).length } };
}

// Maße der Werkhalle (W2) -> public/hangar/werkhalle/<name>.json, gemessen
// mit Strahlen gegen das geschriebene GLB (Glas zählt nicht als Fläche):
// Boden, Breite zwischen den Seiten und Länge bis zur Rückwand auf 1,5 m
// Höhe, Decke über dem Boden, das Tor aus den Blättern samt Bewegung aus
// <name>.tor.json, die Leuchtkörper mit ihren Lampen, das größte freie
// Rechteck in der Mitte (nichts zwischen Boden und 4,5 m) und die Bühnen.
async function writeWerkhalleJson(doc, name, werkNodes, lights) {
  const root = doc.getRoot();
  const rc = hallRaycaster(doc);
  const nodeBox = (re) => {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const n of root.listNodes()) if (re.test(n.getName()) && n.getMesh()) { const b = getBounds(n); for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], b.min[i]); hi[i] = Math.max(hi[i], b.max[i]); } }
    return [lo, hi];
  };
  const tor = nodeBox(/^tor_/);
  const torZ = (tor[0][2] + tor[1][2]) / 2;
  const back = rc.ray([0, 1.5, torZ + 18], [1e-6, 1e-6, 1], 80);
  const backZ = back ? torZ + 18 + back.t : null;
  const midZ = (torZ + (backZ ?? torZ + 36)) / 2;
  const floorY = floorLevel(doc, { center: [0, 0, midZ] }, { rc }) ?? 0;
  const ray = (o, d, far = 60) => { const n = Math.hypot(...d); const u = d.map((v) => (v || 1e-6) / n); const h = rc.ray(o, u, far); return h ? h.t : null; };
  const med = (a) => { const s = a.filter((v) => v != null).sort((p, q) => p - q); return s.length ? s[Math.floor(s.length / 2)] : null; };
  const zs = [0.15, 0.3, 0.5, 0.7, 0.85].map((f) => torZ + f * ((backZ ?? torZ + 36) - torZ));
  const left = med(zs.map((z) => ray([0, floorY + 1.5, z], [-1, 0, 0])));
  const right = med(zs.map((z) => ray([0, floorY + 1.5, z], [1, 0, 0])));
  // Decke: Strahlen nach oben über ein 2-m-Raster des Bodens
  const up = [];
  let escaped = 0;
  for (let x = -10; x <= 10; x += 2) for (const z of [...Array(17)].map((_, i) => torZ + 2 + i * 2)) {
    if (backZ != null && z > backZ - 1) continue;
    const t = ray([x, floorY + 0.5, z], [0, 1, 0], 40);
    if (t == null) escaped++; else up.push(floorY + 0.5 + t);
  }
  up.sort((a, b) => a - b);
  // freies Rechteck um x = 0: 0,5-m-Zellen; frei = der Strahl von 4,5 m nach
  // unten trifft erst Boden, der höchstens tol von floorY abweicht
  const step = 0.5, half = Math.floor((right ?? 12) / step) * step;
  const zEnd = backZ ?? torZ + 36;
  const cols = [];
  for (let x = -half + step / 2; x < half; x += step) cols.push(x);
  const hits = [];
  for (let z = torZ + step / 2; z < zEnd; z += step) hits.push({ z, y: new Map(cols.map((x) => { const t = ray([x, floorY + 4.5, z], [0, -1, 0], 6); return [x, t == null ? null : floorY + 4.5 - t]; })) });
  const freeRect = (tol) => {
    let out = null;
    for (let w = step; w <= half; w += step) {
      let run = 0, best = null;
      for (const r of hits) {
        const ok = cols.filter((x) => Math.abs(x) < w).every((x) => r.y.get(x) != null && Math.abs(r.y.get(x) - floorY) <= tol);
        run = ok ? run + 1 : 0;
        if (ok && (!best || run > best.run)) best = { run, z1: r.z + step / 2 };
      }
      if (best && (!out || 2 * w * best.run * step > out.w * out.l)) out = { w: 2 * w, l: best.run * step, z: [best.z1 - best.run * step, best.z1] };
    }
    return out && { center: [0, r3(floorY), r3((out.z[0] + out.z[1]) / 2)], size: [r3(out.w), r3(out.l)], x: [r3(-out.w / 2), r3(out.w / 2)], z: out.z.map(r3), tol };
  };
  // Tor: Bewegung je Blatt (Welt-y, Meter) aus den Spuren; das zweite Blatt hängt am ersten
  const tj = JSON.parse(readFileSync(fileURLToPath(new URL(`werkhalle/${name}.tor.json`, SRC)), 'utf8'));
  const boneOf = Object.fromEntries(Object.entries(tj.blattOf).map(([b, n]) => [n, b]));
  const chain = (bone) => { const out = []; for (let n = tj.nodes.find((x) => x.name === bone); n; n = tj.nodes.find((x) => x.index === n.parent)) out.push(n.name); return out; };
  const track = (caf, bone, f) => { const tr = tj.cafs[caf]?.tracks[bone]; if (!tr) return null; let a = tr[0]; for (const k of tr) { if (k[0] <= f) a = k; else { const w = (f - a[0]) / (k[0] - a[0] || 1); return [1, 2, 3].map((i) => a[i] + (k[i] - a[i]) * w); } } return tr[tr.length - 1].slice(1); };
  const motion = {};
  for (const caf of Object.keys(tj.cafs).filter((k) => tj.cafs[k].frames > 0)) {
    const { fps, frames } = tj.cafs[caf];
    const samples = [...Array(11)].map((_, i) => Math.round((i / 10) * frames));
    const leaves = {};
    for (const leaf of Object.keys(boneOf)) {
      const dy = samples.map((f) => r3(chain(boneOf[leaf]).reduce((s, b) => { const p = track(caf, b, f), p0 = track(caf, b, 0); return s + (p && p0 ? (p[2] - p0[2]) * tj.scale : 0); }, 0)));
      leaves[leaf] = dy;
    }
    motion[caf.replace(`${tj.cga}_`, '')] = { seconds: r3(frames / fps), frames, fps, t: samples.map((f) => r3(f / fps)), dy: leaves };
  }
  const opened = motion.open?.dy ?? {};
  const after = (leaf, k) => { const b = nodeBox(new RegExp(`^${leaf}$`)); return b[k][1] + (opened[leaf]?.at(-1) ?? 0); };
  const clear = opened.tor_unten_1 && opened.tor_oben_1 ? r3(Math.min(after('tor_oben_1', 0), after('tor_oben_2', 0)) - Math.max(after('tor_unten_1', 1), after('tor_unten_2', 1))) : null;
  // Bühnen aus der Rohdatei (je Knoten Oberkante y = 0, mittig)
  const bFile = fileURLToPath(new URL(`werkhalle/${name}-buehne.glb`, SRC));
  const buehnen = [];
  if (existsSync(bFile)) {
    const bd = await io.read(bFile);
    for (const n of bd.getRoot().listNodes()) if (n.getMesh()) { const b = getBounds(n); buehnen.push({ node: n.getName(), size: [0, 1, 2].map((i) => r3(b.max[i] - b.min[i])), top: r3(b.max[1]) }); }
  }
  const fixtures = werkNodes.fixtures.map((f) => ({ node: f.node, mesh: f.mesh, pos: f.pos, box: f.box, mount: f.mount, lights: f.lights ?? [] }));
  const json = {
    v: 1,
    axes: 'glTF, y oben, Meter; Tor vorn bei z ≈ 0, Raum nach +z',
    floorY: r3(floorY),
    interior: { x: [r3(-(left ?? 0)), r3(right ?? 0)], z: [r3(torZ), backZ != null ? r3(backZ) : null], height: up.length ? r3(up[0] - floorY) : null },
    ceiling: { min: up.length ? r3(up[0]) : null, median: up.length ? r3(med(up)) : null, max: up.length ? r3(up.at(-1)) : null, rays: up.length + escaped, open: escaped },
    gate: {
      center: [r3((tor[0][0] + tor[1][0]) / 2), r3((tor[0][1] + tor[1][1]) / 2), r3(torZ)], width: r3(tor[1][0] - tor[0][0]), height: r3(tor[1][1] - tor[0][1]),
      out: [0, 0, Math.sign(torZ - midZ) || -1], openClear: clear != null ? { width: r3(tor[1][0] - tor[0][0]), height: clear } : null,
      nodes: Object.keys(tj.blaetter), bones: boneOf, motion,
    },
    fixtures,
    lights: { total: lights?.total ?? 0, withFixture: lights?.withFixture ?? 0 },
    // stage: befahrbarer Boden (Stufen bis 15 cm); panel: das ebene Mittelfeld
    stage: freeRect(0.15),
    panel: freeRect(0.02),
    buehnen,
  };
  const file = fileURLToPath(new URL(`werkhalle/${name}.json`, OUT));
  writeFileSync(file, JSON.stringify(json) + '\n');
  return { file, json, summary: { floorY: json.floorY, interior: json.interior, ceiling: json.ceiling, gate: { width: json.gate.width, height: json.gate.height, openClear: json.gate.openClear }, stage: json.stage && json.stage.size, panel: json.panel && json.panel.size, fixtures: fixtures.length, ceilingFixtures: fixtures.filter((f) => f.mount === 'decke').length, buehnen: buehnen.map((b) => b.node) } };
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
  // Werkhalle: Leuchtkörper, Torblätter und Bühnen bleiben eigene, benannte Knoten
  const werk = kind === 'werkhalle', werkRoom = werk && !/-buehne$/.test(name);
  const werkNodes = werk ? markWerkhalle(doc) : null;
  // Halle: Einrichtung zählen und Spiellampen herausschreiben, bevor
  // flatten/join die Knotennamen und cleanMaterials die Lichter verwirft
  const furniture = kind === 'hall' ? root.listNodes().filter((n) => n.getMesh() && FURNITURE.test(`${n.getName()} ${n.getMesh().getName()}`)).length : null;
  // leichte Stufe (<halle>-lod1, für Telefone): ohne Einrichtung und ohne
  // eigene Lampenliste — die Seite gibt ihr die der vollen Stufe
  const lite = isLite(kind, name);
  const lights = kind === 'hall' && !lite ? hallLights(doc, name) : werkRoom ? hallLights(doc, name, { kind, fixtures: werkNodes.fixtures }) : null;
  if (lite) for (const n of root.listNodes()) if (n.getMesh() && FURNITURE.test(`${n.getName()} ${n.getMesh().getName()}`)) n.setMesh(null);
  // Schiffe: Fahrwerk ausfahren und einfedern, solange die Knoten noch einzeln sind
  const gearPose = kind === 'ships' ? shipGear(doc, name) : null;
  if (kind === 'ships') dropUnreachable(doc);
  const b = kind === 'ships' ? shipBudget(name) : BUDGET[kind];
  const interior = kind === 'ships' ? dropInterior(doc, name, tris0, b.tris) : 0;
  let matfix = null, cover = null;
  const fixFile = fileURLToPath(new URL(`${kind}/${name}.matfix.json`, SRC));
  // Schiffe (.planning/notes/hangar-innenraum.md): Nachtrag vor dropJunk,
  // damit DROP_MAT auch nachgetragene RTT- und Stencil-Materialien trifft
  const shipFix = kind === 'ships' && existsSync(fixFile);
  if (shipFix) {
    cover = { before: coverage(doc) };
    matfix = applyMatFix(doc, JSON.parse(readFileSync(fixFile, 'utf8')), { ship: true });
  }
  dropJunk(doc);
  if (kind === 'hall' || kind === 'lift' || werk) {
    cover = { before: coverage(doc) };
    if (existsSync(fixFile)) matfix = applyMatFix(doc, JSON.parse(readFileSync(fixFile, 'utf8')));
  }
  const fixedOnly = (m) => !!m.getExtras()?.matfix;
  const layered = kind === 'lift' || werk ? applyLayers(doc, name, kind) : shipFix ? applyLayers(doc, name, kind, fixedOnly) : null;
  const attached = kind === 'hall' || kind === 'lift' || werk ? await attachHallTextures(doc) : shipFix ? await attachHallTextures(doc, fixedOnly) : 0;
  if (cover) cover.after = coverage(doc);
  if (shipFix && !layered.missing) matfix.layered = layered.materials;
  const vertexColors = stripAttributes(doc, werk ? 'hall' : kind);
  const liftUv = liftParts ? uvReport(doc) : null;
  // Palette des Schiffs = Record des Rohexports (Constellation: …_andromeda_gs)
  const plan = kind === 'ships' ? await paintPlan(name) : null;
  cleanMaterials(doc, kind === 'ships' ? { paletteOwner: (shipSource(name).record ?? name.replace(/-/g, '_')).toLowerCase(), paintTargets: plan?.targets } : {});
  const furnitureNodes = kind === 'hall' ? markFurniture(doc) : null;
  const swap = kind === 'ships' ? markSwapParts(doc, name) : null;
  await doc.transform(prune(), flatten(), dedup(), join({ keepNamed: kind === 'hall' || kind === 'lift' || kind === 'ships' || werk }), weld());
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
  // HANGAR_SHIP_ERR=1: letzte Stufe gegen die 16 MB (Polaris: 1,7 Mio. Dreiecke
  // Rumpf schon ohne Innenraum), Schwelle bis 4 % und Ränder frei; das Ergebnis wird angesehen
  const ladder = kind === 'ships' ? [0.002, 0.005, 0.01, ...(process.env.HANGAR_SHIP_ERR ? [0.02, 0.04, 0.08] : [])] :kind === 'hall' || kind === 'lift' || werk ? [] : [0.004, 0.01, 0.02, 0.04];
  for (const error of ladder) {
    const now = countTris(root);
    if (now <= b.tris * 1.1) break;
    // ab 2 % auch die Ränder frei: mit festen Rändern blieb die Polaris bei 1,7 Mio.
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: b.tris / now, error, lockBorder: kind === 'ships' && error < 0.02 }));
  }
  // Halle: Normalen mit Kantenwinkel neu, sonst helle Keile an jeder Fuge
  // (siehe scripts/lib/crease-normals.mjs).
  let crease = null;
  if (kind === 'hall' || werk) {
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
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^(baseColor|emissive)/, resize: [b.tex, b.tex], quality: b.q ?? 82 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^(?!baseColor|emissive)/, resize: [b.ntex, b.ntex], quality: b.q ?? 80 }),
    draco({
      method: 'edgebreaker', quantizeNormal: 10, quantizeTexcoord: uvBits,
      // dichte Kopie: ein Raster für die ganze Halle, 18 Bit (≈ 0,7 mm)
      ...(lite ? { quantizePosition: 18, quantizationVolume: 'scene' } : { quantizePosition: kind === 'hall' || werk ? 16 : 14 }),
    }),
  );
  // Nur noch das Nötige ankündigen
  doc.createExtension(KHRDracoMeshCompression).setRequired(true);
  doc.createExtension(EXTTextureWebP).setRequired(true);

  mkdirSync(new URL(`${kind}/`, OUT), { recursive: true });
  const outPath = fileURLToPath(new URL(`${kind}/${name}.glb`, OUT));
  await io.write(outPath, doc);
  // Schiffe: Bilder in die gemeinsame Ablage, im GLB nur der Verweis
  const pooled = kind === 'ships' ? poolGlbFile(outPath, SHIP_POOL) : null;
  // Selbstauskunft gegen das geschriebene Artefakt, nicht gegen den Zwischenstand
  const written = await io.read(outPath);
  const uvDeg = degenerateUvShare(written.getRoot());
  const gearTest = kind === 'ships' ? gearCheck(written, gearPose) : null;
  const palette = kind === 'ships' ? { 1: 0, 2: 0, 3: 0 } : null;
  if (palette) for (const m of written.getRoot().listMaterials()) { const t = m.getExtras()?.palette_tint; if (t in palette) palette[t]++; }
  const paints = plan ? writePaints(name, plan, new Set(written.getRoot().listMaterials().map((m) => m.getName()))) : null;
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
  const werkJson = werkRoom ? await writeWerkhalleJson(written, name, werkNodes, lights) : null;
  if (werkJson) hash.update(readFileSync(werkJson.file));
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
    ...(kind === 'ships' ? shipSource(name, interior) : {}),
    ...(gearTest ? { ...(gearTest.ok ? { gear: true } : {}), gearCheck: gearTest, budget: { tris: b.tris, tex: b.tex, ...(b.q ? { q: b.q } : {}) } } : {}),
    ...(paints ? { paints: { url: paints.url, v: paints.v } } : {}),
    ...(paints ? { paintReport: paints } : {}),
    ...(crease ? { crease: { corners: crease.corners, changedPct: Math.round(crease.changed / Math.max(1, crease.corners) * 1000) / 10 } } : {}),
    uv: { rangeBefore: Math.round(uvRange.before), rangeAfter: Math.round(uvRange.after * 100) / 100, bits: uvBits, degenerate: Math.round(uvDeg.share * 1000) / 10 },
    ...(hull ? { hull } : {}),
    ...(floor != null ? { floor } : {}),
    ...(werk ? { materials: written.getRoot().listMaterials().length, nodes: werkNodes.counts } : {}),
    ...(werkJson ? { json: `/hangar/werkhalle/${name}.json`, lightsUrl: `/hangar/werkhalle/${name}.lights.json`, buehne: `/hangar/werkhalle/${name}-buehne.glb`, room: werkJson.summary } : {}),
    bytes: statSync(outPath).size,
    ...(pooled ? { pool: poolShare(pooled) } : {}),
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
  // keepAttributes: COLOR_0 nutzt kein glTF-Material, prune würfe es sonst weg
  await doc.transform(prune({ keepAttributes: !!b.keepAttributes }), unpartition());
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

// Bodenquadrat sx × sz in XZ (u entlang +X, v = 0 an −Z = lokale +Y des Spiels)
function quadPrim(doc, sx, sz, uvx, uvz) {
  const pos = new Float32Array([-sx / 2, 0, -sz / 2, sx / 2, 0, -sz / 2, sx / 2, 0, sz / 2, -sx / 2, 0, sz / 2]);
  const uv = new Float32Array([0, 0, uvx, 0, uvx, uvz, 0, uvz]);
  const nor = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
  const buf = doc.getRoot().listBuffers()[0];
  return doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buf))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(nor).setBuffer(buf))
    .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(uv).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array([0, 2, 1, 0, 3, 2])).setBuffer(buf));
}
const pngTexture = (doc, file) => doc.createTexture(file.split(/[\\/]/).pop()).setImage(readFileSync(file)).setMimeType('image/png');
// Material eines projizierten Decals (m: Werte der .mtl wie readDecalMaterials).
// Farbe mit Alpha: das RGBA-PNG trägt die Deckkraft. Bei %OPACITY_MAP kommt
// sie aus der Maske (TexSlot12, ungekachelt), die Farbe wird mit ihrem TexMod
// (TileU/V) über die Maske gekachelt. Deckkraft: Opacity × ColorBlendFactor
// (bis 1); der Rohwert steht in der JSON.
async function decalMaterial(doc, node, m) {
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const rgb = (s, d = [1, 1, 1]) => (s ? String(s).split(',').map(Number) : d);
  const dFile = texFile(m.d);
  if (!dFile) return null;
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
  const cbf = Number(m.params?.ColorBlendFactor ?? 1);
  const mat = doc.createMaterial(node).setBaseColorTexture(doc.createTexture(`${node}_d`).setImage(image).setMimeType('image/png'))
    .setBaseColorFactor([...rgb(m.diffuse), r3(Math.min(1, Number(m.opacity ?? 1) * Math.min(1, cbf)))]).setAlphaMode('BLEND')
    .setMetallicFactor(0).setRoughnessFactor(r3(Math.max(0.05, 1 - Number(m.shininess ?? 128) / 255)));
  const nFile = texFile(m.n);
  if (nFile) mat.setNormalTexture(pngTexture(doc, nFile));
  return { mat, dFile, maskFile };
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
  const quad = (name, sx, sz, uvx, uvz) => quadPrim(bd, sx, sz, uvx, uvz);
  const png = (file) => pngTexture(bd, file);
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
    const dm = await decalMaterial(bd, node, m);
    if (!dm) continue;
    const mesh = bd.createMesh(node).addPrimitive(quad(node, 1, 1, 1, 1).setMaterial(dm.mat));
    bscene.addChild(bd.createNode(node).setMesh(mesh));
    const meta = await sharp(dm.dFile).metadata();
    decalNodes.set(mtl, { role, node });
    decals.push({ node, rolle: role, path: mtl, size: ex ? [ex.edge, ex.edge] : [1, 1], alpha: true, opacityMap: !!dm.maskFile, pom: false, from: ex ? ex.from : [info.socpak], inLayout: !ex, texture: [meta.width, meta.height], game: m });
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
  [/missile_frame/, 'Raketengestell, hält Raketen einer Größe für das Bestücken bereit', 'steht am Boden neben dem Schiff oder im Waffenlager'],
  [/missilestack/, 'Stapel Raketen auf Gestell', 'steht im Waffenlager oder neben dem Schiff zum Bestücken'],
  [/rack_torpedo/, 'Torpedogestell', 'steht im Waffenlager oder neben dem Schiff zum Bestücken'],
  [/crate_torpedo/, 'Torpedokiste', 'steht gestapelt im Lager oder neben dem Schiff'],
  [/ammo-box|ammocrate/, 'Munitionskiste', 'steht gestapelt am Boden oder auf Palette neben dem Schiff'],
  [/crate_weapon/, 'Waffenkiste', 'steht gestapelt im Lager oder neben dem Schiff'],
  [/component_display/, 'Auslage für Schiffsbauteile', 'steht im Laden oder an der Wand der Werkstatt'],
  [/(^|_)mop|bucket/, 'Wischmop oder Eimer', 'steht an der Wand oder am Rand'],
  [/trash/, 'Müll, Müllsäcke', 'liegt in Ecken und an Wänden'],
  [/drum/, 'Fass', 'steht in Gruppen auf dem Boden'],
  [/crate|box_|container|storage|shelf/, 'Lagerkiste oder Regal', 'steht gestapelt an Wänden und in Ecken'],
];
// Zweck und Benutzung der Kategorien der Hallendeko (hangar-deko.md D2), vor ZWECK geprüft
const ZWECK_NEU = [
  [/^powr_/, 'Kraftwerk (Schiffsbauteil), liefert dem Schiff Strom', 'liegt als Ersatzteil im Lager, auf Palette oder Werkbank, bis es ins Schiff eingebaut wird'],
  [/^cool_/, 'Kühler (Schiffsbauteil), führt die Wärme der Schiffssysteme ab', 'liegt als Ersatzteil im Lager, auf Palette oder Werkbank, bis es ins Schiff eingebaut wird'],
  [/^shld_/, 'Schildgenerator (Schiffsbauteil), erzeugt den Schild des Schiffs', 'liegt als Ersatzteil im Lager, auf Palette oder Werkbank, bis es ins Schiff eingebaut wird'],
  [/^qdrv_/, 'Quantenantrieb (Schiffsbauteil), für Sprünge zwischen Orten', 'liegt als Ersatzteil im Lager, auf Palette oder Werkbank, bis es ins Schiff eingebaut wird'],
  [/lift_scissor/, 'Scherenhubbühne für Arbeiten in der Höhe', 'steht am Schiff oder an Regalen, fährt Arbeiter nach oben'],
  [/lift_platform/, 'Hubplattform', 'steht am Boden; hebt Lasten oder Arbeiter'],
  [/forklift_machine/, 'Gabelstapler', 'fährt Paletten und Kisten zwischen Lager und Schiff'],
  [/trolley_pallet_powered/, 'elektrischer Palettenhubwagen', 'fährt Paletten im Lager'],
  [/crane/, 'Kran mit Haken für schwere Lasten', 'steht am Arbeitsplatz oder über dem Lager'],
  [/scaffold/, 'Baugerüst (Fuß, Mittelteil, Kopf zum Stapeln)', 'steht an Schiff oder Wand für Arbeiten in der Höhe'],
  [/cargo_rack/, 'Frachtregal (Schwerlast) für SCU-Kisten, in Teilen zusammengesetzt', 'steht in Reihen im Frachtdeck; Kisten stehen in den Fächern'],
  [/shelf|rack/, 'Lagerregal', 'steht an der Wand oder in Reihen; trägt Kisten und Kartons'],
  [/pallet/, 'Frachtpalette', 'liegt am Boden unter Frachtkisten; wird mit Stapler oder Hubwagen bewegt'],
  [/cargo|crate|container|freight/, 'Frachtkiste in SCU-Größe', 'steht gestapelt und in Reihen im Lager, auf Paletten oder im Frachtregal'],
  [/locker/, 'Spind der Crew', 'steht in Reihen an der Wand des Aufenthaltsbereichs'],
  [/water_?cooler/, 'Wasserspender', 'steht an der Wand im Aufenthaltsbereich'],
  [/vending/, 'Getränke- oder Snackautomat', 'steht an der Wand im Aufenthaltsbereich'],
  [/waste|trash|(^|_)bin_/, 'Mülleimer', 'steht an Wand oder Sitzplatz'],
  [/stool/, 'Hocker', 'steht an Tisch oder Werkbank'],
  [/table/, 'Tisch', 'steht im Aufenthaltsbereich, mit Sitzen darum'],
  [/bench|seat|chair/, 'Sitz der Crew (Bank, Stuhl)', 'steht im Aufenthaltsbereich, an Tischen oder an der Wand'],
  [/console_desk/, 'Steuerpult mit Bildschirmen', 'steht im Leitstand oder an der Wand'],
  [/relay_electrical|fuse/, 'Schalt- oder Verteilerkasten', 'hängt an der Wand, Kabel laufen ab'],
  [/display_video_wall|screen/, 'Bildschirm oder Infotafel an der Wand', 'hängt an der Wand in Augenhöhe oder darüber'],
  [/nav_sign/, 'Hinweisschild (Wegweiser)', 'hängt an der Wand über Türen und Gängen'],
  [/panel_sign/, 'Warn- oder Hinweistafel', 'hängt an der Wand an Gefahrenstellen'],
  [/pipe/, 'Rohrleitung', 'läuft an der Wand entlang'],
  [/cable_terminal/, 'Kabelanschluss an der Wand', 'sitzt an der Wand am Ende einer Kabelleitung'],
  [/hvac/, 'Lüftungskanal', 'läuft unter der Decke'],
  [/light_hung/, 'Hängeleuchte der Werkstatt', 'hängt an Kabel oder Kette unter der Decke über dem Arbeitsbereich'],
  [/pulley/, 'Seilrolle eines Kettenzugs', 'hängt unter der Decke über dem Arbeitsplatz; das Seil läuft nach unten'],
  [/cable_sign_hanging/, 'hängendes Schild', 'hängt an Kabeln unter der Decke'],
  [/cable_hanging/, 'durchhängendes Kabel', 'hängt zwischen Decke und Wand'],
];
const NEU_KATS = new Set(['fracht', 'regal', 'crew', 'bauteile', 'maschine', 'wand', 'decke']);
// Fahrzeugwerkstatt (.planning/notes/hangar-fahrzeuge.md), vor ZWECK_NEU geprüft
const FZ_KATS = new Set(['fahrzeug', 'tor', 'reifen']);
const FZ_NUTZUNG = 'steht auf seinen Rädern in der Fahrzeugwerkstatt, Front zur Halle oder zum Tor; daneben Werkzeug, Reifen und Diagnose';
const ZWECK_FZ = [
  [/ursa_rover/, 'Bodenfahrzeug: gepanzerter Geländewagen mit Geschützturm und Heckrampe', FZ_NUTZUNG],
  [/cyclone/, 'Bodenfahrzeug: leichter Geländebuggy mit Ladefläche', FZ_NUTZUNG],
  [/grin_roc/, 'Bodenfahrzeug: Bergbaufahrzeug mit Abbaulaser am Arm', FZ_NUTZUNG],
  [/grin_ptv/, 'Bodenfahrzeug: offener Zweisitzer für kurze Wege', FZ_NUTZUNG],
  [/garage_door/, 'geschlossenes Garagentor mit Rahmen, Zufahrt der Fahrzeugwerkstatt', 'steht mit der Rückseite an der Wand, Unterkante auf dem Boden'],
  [/ptv_tire/, 'Ersatzreifen eines Kleinfahrzeugs', 'steht oder liegt als Ersatzteil an Wand, Regal oder Werkbank der Werkstatt'],
  [/racetrack_tyre/, 'großer Reifen', 'steht in Gruppen an Wand und Rand oder hängt als Deko'],
  [/landing_wheel/, 'Fahrwerksrad (Ersatzteil)', 'liegt als Ersatzteil auf Regal, Palette oder Boden'],
];
const zweckOf = (key, kat) => { const z = (FZ_KATS.has(kat) && ZWECK_FZ.find(([re]) => re.test(key))) || (NEU_KATS.has(kat) && ZWECK_NEU.find(([re]) => re.test(key))) || ZWECK.find(([re]) => re.test(key)); return z ? { zweck: z[1], nutzung: z[2] } : { zweck: null, nutzung: null }; };
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
  // Untermaterial je GLB-Materialname, für `materials` in katalog.json (nach dem Bau)
  const matInfo = new Map();
  // Metall = Farbe im Specular (Dielektrika liegen bei 0,02–0,06)
  const isMetal = (spec) => Math.max(...spec) > 0.2;
  // Werkstatt (hangar-fahrzeuge.md): so wenige Materialien wie möglich. Je Stück
  // behalten die drei Untermaterialien mit den meisten Dreiecken, die eine eigene,
  // nicht gekachelte Farb- oder Normalenkarte tragen, ihre Karten; wer gleich aussieht
  // (dieselben Karten, dieselbe Farbe), nimmt deren Material, die übrigen werden
  // einfarbig (Mittelwert der Farbkarte). Glas ist ein Material, Kleinteile unter 1 %
  // der Dreiecke nehmen das größte einfarbige, Bildschirme und Schadensnetze fallen weg.
  const tileOf = (sub, slot) => { const L0 = sub?.layers?.[0], LI = L0 ? layerInfo[L0.path] : null; return !kTexFile(sub?.[slot]) && L0 ? (L0.uvTiling || 1) * (LI?.tiling || 1) : 1; };
  const farbkarte = (sub) => { const L0 = sub?.layers?.[0], LI = L0 ? layerInfo[L0.path] : null; const d = (/conductor_diff/i.test(sub?.d || '') ? null : kTexFile(sub?.d)) || (LI && kTexFile(LI.d)); return d && tileOf(sub, 'd') <= 1.5 ? d : null; };
  const normalkarte = (sub) => { const L0 = sub?.layers?.[0], LI = L0 ? layerInfo[L0.path] : null; const n = kTexFile(sub?.n) || (LI && kTexFile(LI.n)); return n && /_ddna?\.png$|_ddn\.png$/i.test(n) && tileOf(sub, 'n') <= 1.5 ? n : null; };
  const mittel = new Map();
  const mittelOf = async (f) => { if (!mittel.has(f)) { const ch = (await sharp(f).stats()).channels; const lin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; mittel.set(f, ch.slice(0, 3).map((c) => r3(lin(c.mean)))); } return mittel.get(f); };
  async function werkstattPlan(q, n) {
    const tris = new Map();
    for (let i = 0; i < n.length; i++) { const s = q.ids?.[i] ?? i; tris.set(s, (tris.get(s) || 0) + n[i]); }
    const total = [...tris.values()].reduce((a, b) => a + b, 0);
    const plan = new Map(), byTris = [...tris.keys()].sort((a, b) => tris.get(b) - tris.get(a) || a - b);
    const sub = (s) => q.subs?.[s];
    for (const s of byTris) if (/NoDraw|DisplayScreen/i.test(sub(s)?.shader || '') || /internal|damage|_dmg|proxy/i.test(sub(s)?.name || '')) plan.set(s, { skip: true });
    const offen = byTris.filter((s) => !plan.has(s));
    const glas = offen.filter((s) => /glass/i.test(sub(s)?.shader || ''));
    for (const s of glas.slice(1)) plan.set(s, { use: glas[0] });
    // gleich aussehend: dieselben Karten und dieselbe Farbe (Palettenkanal, Tönung, Diffuse)
    const blick = (x) => JSON.stringify([farbkarte(x), normalkarte(x), x?.layers?.[0]?.paletteTint ?? null, x?.layers?.[0]?.tint ?? null, x?.diffuse ?? null, !!x?.fremd]);
    // Gitter, Netze, Lochbleche (Alpha-Test): einfarbig verlören sie ihre Löcher
    // (Cyclone-Gitter, Gitter im Garagentor). Sie behalten ihre Karten immer und
    // zählen nicht zu den drei.
    const ausschnitt = (x) => Number(x?.alphaTest) > 0 && !!farbkarte(x);
    const behalten = [];
    for (const s of offen.filter((x) => !glas.includes(x) && (farbkarte(sub(x)) || normalkarte(sub(x))))) {
      const d = farbkarte(sub(s)), gleich = d ? behalten.find((b) => blick(sub(b)) === blick(sub(s))) : undefined;
      if (gleich !== undefined) plan.set(s, { use: gleich });
      else if (ausschnitt(sub(s)) || behalten.filter((b) => !ausschnitt(sub(b))).length < 3) behalten.push(s);
      else plan.set(s, { flach: d ? await mittelOf(d) : [1, 1, 1] });
    }
    const einfarbig = offen.filter((s) => !glas.includes(s) && !behalten.includes(s) && plan.get(s)?.use == null);
    for (const s of einfarbig.slice(1)) if (tris.get(s) < total * 0.01) plan.set(s, { use: einfarbig[0] });
    return plan;
  }
  // wie build-hangar-dienst.mjs: undurchsichtig, ohne Leuchtkarte, Karten höchstens gekachelt
  const gekachelt = (ti) => { const tr = ti?.getExtension('KHR_texture_transform'); return !!tr && Math.max(...tr.getScale()) > 1.5; };
  const istFlach = (m) => m.getAlphaMode() === 'OPAQUE' && !m.getEmissiveTexture() && (!m.getBaseColorTexture() || gekachelt(m.getBaseColorTextureInfo())) && (!m.getNormalTexture() || gekachelt(m.getNormalTextureInfo()));
  // Dokument einer Datei: Materialien heißen <mtl>_<untermaterial>, gleich in allen Dateien
  const kit = (name) => {
    const doc = new Document();
    const buf = doc.createBuffer();
    const scene = doc.createScene(name);
    const tt = doc.createExtension(KHRTextureTransform);
    const texCache = new Map(), matCache = new Map();
    const tex = (file) => { if (!texCache.has(file)) texCache.set(file, doc.createTexture(file.split(/[\\/]/).pop()).setImage(readFileSync(file)).setMimeType('image/png')); return texCache.get(file); };
    const material = (mtl, sub, pal = null) => {
      const L0 = sub?.layers?.[0], LI = L0 ? layerInfo[L0.path] : null;
      // Grundschicht mit PaletteTint 1–3: Farbe aus der Palette der Entity (Eintrag A–C),
      // als eigenes Material „<name>_<palette>“, denn ohne Palette heißt es anders getönt gleich
      const pe = pal && [1, 2, 3].includes(Number(L0?.paletteTint)) ? pal['abc'[Number(L0.paletteTint) - 1]] : null;
      // flach (Werkstatt): ohne Karten, die Farbe trägt den Mittelwert der Farbkarte
      const flach = sub?.flach || null;
      const name = `${clean(String(mtl || 'mtl').split('/').pop())}_${clean(sub?.name || 'default')}${pe ? `_${clean(pal.name)}` : ''}${flach ? '_flach' : ''}`;
      if (matCache.has(name)) return matCache.get(name);
      const m = doc.createMaterial(name).setMetallicFactor(0);
      // conductor_diff: schwarze Platzhalter-Farbkarte alter Illum-Materialien für
      // Metall, die Farbe steht im Specular. Als Karte gebunden wäre alles schwarz.
      const conductor = /conductor_diff/i.test(sub?.d || '');
      const dOld = kTexFile(sub?.d) || (LI && kTexFile(LI.d));
      const d = flach ? null : (conductor ? null : kTexFile(sub?.d)) || (LI && kTexFile(LI.d));
      const n = flach ? null : kTexFile(sub?.n) || (LI && kTexFile(LI.n));
      let factor = rgb(sub?.diffuse);
      if (!kTexFile(sub?.d) && L0) factor = (pe ? pe.tint : rgb(L0.tint)).map((v, i) => v * rgb(LI?.diffuse)[i]);
      if (flach) factor = factor.map((v, i) => v * flach[i]);
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
      // vorher: Metall nur ohne Karte und mit Specular > 0,3, Farbe = Specular × Tönung
      const alt = spec[0] > 0.3 && !dOld ? { metallic: 1, base: spec.map((v, i) => Math.min(1, v * rgb(L0?.tint)[i])) } : { metallic: 0, base: factor.map((v) => Math.min(1, v)) };
      // Metall trägt seine Farbe im Specular. Die Tönung der Schicht bleibt dort
      // weg: Metallschichten (TintMode 2) stehen mit Tönung 0 bzw. 0,016 im
      // Material (Aluminium, Titan) und wären mit ihr schwarz.
      // Ohne Schichten (Illum): nur ohne eigene Farbkarte (oder mit conductor_diff) und
      // ohne Specular-Karte — mit Karte ist Specular deren Faktor, keine Farbe.
      const metal = L0 ? isMetal(spec) : isMetal(spec) && (!kTexFile(sub?.d) || conductor) && !/%SPECULAR_MAP(?![A-Z_])/.test(sub?.genMask || '');
      if (metal) { m.setMetallicFactor(1); factor = spec; }
      const shin = Number((L0 ? LI?.shininess : sub?.shininess) ?? 128);
      m.setRoughnessFactor(r3(Math.min(1, Math.max(0.05, 1 - (shin / 255) * (L0?.glossMult ?? 1)))));
      m.setBaseColorFactor([...factor.map((v) => Math.min(1, v)), 1]);
      matInfo.set(name, { sub, mtl, alt, neu: { metallic: m.getMetallicFactor(), base: factor.map((v) => r3(Math.min(1, v))) }, pal: pe ? pal : null });
      if (/glass/i.test(sub?.shader || '')) m.setAlphaMode('BLEND').setBaseColorFactor([0.2, 0.22, 0.25, 0.3]).setRoughnessFactor(0.05);
      else if (/%DECAL(?![A-Z_])/.test(sub?.genMask || '') || /MeshDecal/i.test(sub?.shader || '')) m.setAlphaMode('BLEND');
      else if (Number(sub?.alphaTest) > 0 && !flach) m.setAlphaMode('MASK').setAlphaCutoff(Number(sub.alphaTest));
      if (/glow/i.test(sub?.name || '') && d) m.setEmissiveTexture(m.getBaseColorTexture()).setEmissiveFactor([1, 1, 1]);
      matCache.set(name, m);
      return m;
    };
    // Stück aus seiner Quelle als Knoten: Ursprung unten mittig, +Y oben
    const addNode = async (q, node) => {
      const src = await io.read(fileURLToPath(new URL(q.glb, SRC)));
      const mesh = doc.createMesh(node);
      const prims = src.getRoot().listMeshes().flatMap((me) => me.listPrimitives());
      const plan = FZ_KATS.has(q.kat) ? await werkstattPlan(q, prims.map((p) => (p.getIndices()?.getCount() ?? 0) / 3)) : null;
      prims.forEach((sp, i) => {
        let s = q.ids?.[i] ?? i;
        const pl = plan?.get(s);
        if (pl?.skip) return;
        if (pl?.use != null) s = pl.use;
        const fl = plan?.get(s)?.flach ?? pl?.flach;
        const sub = fl ? { ...q.subs?.[s], flach: fl } : q.subs?.[s];
        if (/NoDraw/i.test(sub?.shader || '') || /proxy/i.test(sub?.name || '')) return;
        // Decal-Flächen ohne eigene Karte (Branding aus $TintPaletteDecal zur Laufzeit,
        // Glow-Decals ohne Bild) wären weiße Platten: weglassen
        const decalish = /%DECAL(?![A-Z_])/.test(sub?.genMask || '') || /MeshDecal/i.test(sub?.shader || '') || /decal/i.test(sub?.name || '');
        if (decalish && !kTexFile(sub?.d)) return;
        const p = doc.createPrimitive();
        // COLOR_0: alle vier Kanäle (Abnutzung, Schmutz, Verschattung …), siehe materials[].vertex
        for (const sem of ['POSITION', 'NORMAL', 'TEXCOORD_0', 'TEXCOORD_1', 'COLOR_0']) { const a = sp.getAttribute(sem); if (a) p.setAttribute(sem, doc.createAccessor().setType(a.getType()).setNormalized(a.getNormalized()).setArray(a.getArray().slice()).setBuffer(buf)); }
        const idx = sp.getIndices(); if (idx) p.setIndices(doc.createAccessor().setType('SCALAR').setArray(idx.getArray().slice()).setBuffer(buf));
        transformPrimitive(p, ROOT_ZUP);
        // Untermaterial einer anderen .mtl (Fahrzeuge, Tor) und fremde Palette (Lafette u. ä.)
        mesh.addPrimitive(p.setMaterial(material(sub?.mtl ?? q.mtl, sub, sub?.fremd ? null : q.palette)));
      });
      if (!mesh.listPrimitives().length) { mesh.dispose(); return null; }
      // Werkstatt: ein Primitiv je Material; fehlt einem Teil die zweite UV, nimmt es die erste
      if (plan) {
        const groups = new Map();
        for (const p of mesh.listPrimitives()) { const k = `${p.getMaterial().getName()}|${p.listSemantics().filter((s) => s !== 'TEXCOORD_1').sort().join(',')}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
        for (const g of groups.values()) {
          if (g.length < 2) continue;
          if (g.some((p) => p.getAttribute('TEXCOORD_1'))) for (const p of g) if (!p.getAttribute('TEXCOORD_1')) { const a = p.getAttribute('TEXCOORD_0'); p.setAttribute('TEXCOORD_1', doc.createAccessor().setType(a.getType()).setArray(a.getArray().slice()).setBuffer(buf)); }
          const j = joinPrimitives(g);
          for (const p of g) { mesh.removePrimitive(p); p.dispose(); }
          mesh.addPrimitive(j);
        }
      }
      const n = doc.createNode(node).setMesh(mesh);
      const b = getBounds(n);
      const bc = [(b.min[0] + b.max[0]) / 2, b.min[1], (b.min[2] + b.max[2]) / 2];
      for (const p of mesh.listPrimitives()) transformPrimitive(p, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -bc[0], -bc[1], -bc[2], 1]);
      scene.addChild(n);
      const size = [0, 1, 2].map((i) => r3(b.max[i] - b.min[i]));
      const tris = Math.round(mesh.listPrimitives().reduce((t, p) => t + (p.getIndices()?.getCount() ?? 0) / 3, 0));
      return { size, tris, materials: mesh.listPrimitives().length, ...(plan ? { eigen: new Set(mesh.listPrimitives().map((p) => p.getMaterial()).filter((m) => !istFlach(m))).size } : {}) };
    };
    return { doc, scene, addNode };
  };
  // je Datei ≤ 3 MB: sonst mit halber Kantenlänge neu packen
  const pack = async (doc, file) => {
    const outPath = fileURLToPath(new URL(`props/${file}.glb`, OUT));
    let bytes = await packDoc(doc, outPath, { tex: 1024, ntex: 512, keepAttributes: true });
    if (bytes > 3 * 1048576) { const d2 = await io.read(outPath); bytes = await packDoc(d2, outPath, { tex: 512, ntex: 256, q: 76, keepAttributes: true }); }
    return { bytes, v: createHash('sha1').update(readFileSync(outPath)).digest('hex').slice(0, 8) };
  };
  // erst die Kategorien bis v2, dann die der Hallendeko, dann der Boden, zuletzt die der
  // Werkstatt: so behalten die Karten unter schichten/ ihre Namen (gleichnamige bekommen
  // in Bau-Reihenfolge ein „_“)
  const baueKategorie = async (kat, list) => {
    const { doc, addNode } = kit(kat);
    const nodes = [];
    for (const q of list) {
      const node = `prop_${kat}_${clean(q.key)}`;
      const made = await addNode(q, node);
      if (!made) continue;
      nodes.push(node);
      const e = entries.get(q.key) || null;
      // Items (Schiffsbauteile) stehen in keiner Halle: ihre Spieldaten bringt die Quelle mit
      const sp = q.spiel || null;
      const name = e?.name ?? sp?.name ?? null;
      const z = zweckOf(q.key, kat);
      out.props.push({
        node, kategorie: kat, file: `/hangar/props/${kat}.glb`, path: q.p4k.replace(/\\/g, '/').replace(/^Data\//i, ''),
        klasse: e?.klasse ?? sp?.klasse ?? null, name, beschreibung: e?.beschreibung ?? sp?.beschreibung ?? null,
        typ: e?.typ ?? sp?.typ ?? null, tags: e?.tags ?? sp?.tags ?? [], benutzung: [], tragbar: null,
        ...(sp?.groesse != null ? { groesse: sp.groesse } : {}),
        zweck: z.zweck, nutzung: z.nutzung,
        quelle: { geometrie: q.quelle, name: name?.en ? 'spiel' : null, zweck: z.zweck ? 'abgeleitet' : null, aufstellung: e ? 'spiel' : null },
        size: made.size, footprint: [made.size[0], made.size[2]], front: '-z', tris: made.tris, lod: q.lod, materials: made.materials,
        // Werkstatt: Materialien mit eigener Karte, Glas oder Leuchten; Dreiecke vor dem Ausdünnen, Reifen, Maßstab der Aufstellung
        ...(made.eigen != null ? { eigeneMaterialien: made.eigen } : {}),
        ...(q.werkstatt ? { werkstatt: Object.fromEntries(Object.entries(q.werkstatt).filter(([k]) => k !== 'tris' && k !== 'container')) } : {}),
        anschluesse: [],
        aufstellung: e?.aufstellung ?? null, nachbarn: e?.nachbarn ?? [],
        zone: e?.zone ?? null, stapel: e?.stapel ?? null, reihen: e?.reihen ?? null,
        from: e?.from ?? [], count: e?.count ?? 0, hallen: e?.hallen ?? 0, fundorte: e?.fundorte ?? {},
      });
    }
    if (!nodes.length) return;
    const { bytes, v } = await pack(doc, kat);
    out.kategorien[kat] = { file: `/hangar/props/${kat}.glb`, bytes, props: nodes, v };
    report.push([kat, nodes.length, out.props.filter((p) => p.kategorie === kat).reduce((s, p) => s + p.tris, 0), bytes]);
  };
  const reihe = [...kats].sort(([a], [b]) => NEU_KATS.has(a) - NEU_KATS.has(b) || a.localeCompare(b));
  for (const [kat, list] of reihe.filter(([k]) => !FZ_KATS.has(k))) await baueKategorie(kat, list);
  // ── Boden für Zonen und Wege (hangar-deko.md D2, Punkt 4) ──
  // Knoten decal_<rolle>_<name>: projizierte Decals als Einheitsquadrat 1 × 1 m
  // (Kante im Spiel unter size), Boden-Meshes des Spiels mit Ursprung unten mittig.
  const boden = { decals: [] };
  if (qf.boden) {
    const { doc, scene, addNode } = kit('boden');
    const used = new Set();
    const nodeName = (rolle, n) => { let s = `decal_${rolle}_${clean(n)}`; while (used.has(s)) s += '_'; used.add(s); return s; };
    for (const q of qf.boden.quads || []) {
      if (!q.mtl) continue;
      const node = nodeName(q.rolle, q.material.split('/').pop());
      const m = { ...q.mtl, maskTex: q.mtl.blendMap };
      const dm = await decalMaterial(doc, node, m);
      if (!dm) { used.delete(node); continue; }
      scene.addChild(doc.createNode(node).setMesh(doc.createMesh(node).addPrimitive(quadPrim(doc, 1, 1, 1, 1).setMaterial(dm.mat))));
      const meta = await sharp(dm.dFile).metadata();
      boden.decals.push({ node, rolle: q.rolle, art: 'projektion', path: q.material, size: [q.kante, q.kante], einheit: [1, 1], alpha: true, opacityMap: !!dm.maskFile, n: q.n, hallen: q.hallen, fundorte: q.fundorte, texture: [meta.width, meta.height],
        game: { shader: q.mtl.shader, genMask: q.mtl.genMask, diffuse: q.mtl.diffuse, opacity: q.mtl.opacity, shininess: q.mtl.shininess, d: q.mtl.d, n: q.mtl.n, mask: q.mtl.blendMap ?? null, tileD: q.mtl.tileD ?? null, params: q.mtl.params } });
    }
    for (const q of (qf.boden.meshes || []).filter((x) => !x.missing)) {
      const node = nodeName(q.rolle, q.key);
      const made = await addNode(q, node);
      if (!made) { used.delete(node); continue; }
      boden.decals.push({ node, rolle: q.rolle, art: 'mesh', path: q.p4k.replace(/\\/g, '/').replace(/^Data\//i, ''), size: [made.size[0], made.size[2]], hoehe: made.size[1], tris: made.tris, materials: made.materials, n: q.n, flach: q.flach, hallen: q.hallen, fundorte: q.fundorte });
    }
    if (boden.decals.length) Object.assign(boden, { file: '/hangar/props/boden.glb', ...(await pack(doc, 'boden')) });
  }
  for (const [kat, list] of reihe.filter(([k]) => FZ_KATS.has(k))) await baueKategorie(kat, list);
  // ── Materialien mit allen Schichten (.planning/notes/hangar-requisiten.md, R1) ──
  // Karten der Schichten und Blend-Maps je einmal als public/hangar/props/schichten/<name>.webp,
  // ≤ 256 px; bei _ddna steht die Glätte im Alpha der Normalenkarte.
  const SCH = fileURLToPath(new URL('props/schichten/', OUT));
  mkdirSync(SCH, { recursive: true });
  const schichtOf = new Map(), schichtUsed = new Set();
  const schicht = async (p) => {
    const f = kTexFile(p);
    if (!f) return null;
    if (schichtOf.has(f)) return schichtOf.get(f);
    let stem = f.split(/[\\/]/).pop().replace(/\.png$/i, '').toLowerCase();
    while (schichtUsed.has(stem)) stem += '_';
    const name = `${stem}.webp`;
    schichtUsed.add(stem);
    let img = sharp(readFileSync(f)).resize(256, 256, { fit: 'inside', withoutEnlargement: true });
    const gl = f.replace(/\.png$/i, '.gloss.png');
    if (existsSync(gl)) {
      const { data, info } = await img.removeAlpha().png().toBuffer({ resolveWithObject: true });
      const g = await sharp(readFileSync(gl)).resize(info.width, info.height, { fit: 'fill' }).extractChannel(0).png().toBuffer();
      img = sharp(data).joinChannel(g);
    }
    await img.webp({ quality: 80, alphaQuality: 90 }).toFile(SCH + name);
    schichtOf.set(f, name);
    return name;
  };
  const rgbOrNull = (s) => (s == null ? null : String(s).split(',').map(Number));
  // Vertexfarbe laut Shader-Definition: HardSurface nennt die Kanäle, LayerBlend_V2
  // nur „Vertex Wear-Dirt-AO“ ohne Zuordnung
  const vertexOf = (sub) => {
    const mask = String(sub?.genMask || '');
    if (/^HardSurface$/i.test(sub?.shader || '') && /%VERTCOLORS(?![A-Z_])/.test(mask)) return { damage: 'r', glow: 'g', ao: 'b', wear: 'a' };
    if (/%WEAR_DIRT_AO_VERTEX(?![A-Z_])/.test(mask)) return { wear: null, dirt: null, ao: null };
    return null;
  };
  const materials = {}, schichtDateien = {};
  // Attribute der Schicht, die oben noch nicht als eigenes Feld stehen
  const rest = (a) => { if (!a) return null; const { Name, Path, TintColor, WearTint, GlossMult, UVTiling, PaletteTint, ...r } = a; return r; };
  for (const [name, { sub, alt, neu, pal }] of matInfo) {
    if (!sub) { materials[name] = { shader: null, mask: [], layers: [], params: {}, blendMap: null, blendUv: null, vertex: null }; continue; }
    const layers = [];
    for (const l of sub.layers || []) {
      const L = layerInfo[l.path] || {};
      layers.push({
        name: l.name, path: l.path, tint: rgbOrNull(l.tint), wearTint: rgbOrNull(l.wearTint), glossMult: l.glossMult, uvTiling: l.uvTiling,
        paletteTint: l.paletteTint != null ? Number(l.paletteTint) : null, attrs: rest(l.raw),
        maps: { d: await schicht(L.d), n: await schicht(L.n) },
      });
      if (l.path && !schichtDateien[l.path]) schichtDateien[l.path] = { shader: L.shader ?? null, diffuse: rgbOrNull(L.diffuse), specular: rgbOrNull(L.specular), shininess: L.shininess != null ? Number(L.shininess) : null, tiling: L.tiling ?? null, params: L.params ?? {} };
    }
    const { Name, Shader, StringGenMask, ...head } = sub.head || {};
    const blendMap = await schicht(sub.blendMap);
    materials[name] = {
      shader: sub.shader ?? null, mask: String(sub.genMask || '').split('%').filter(Boolean), layers,
      params: { ...head, ...(sub.params || {}) }, textures: sub.textures ?? {},
      blendMap, blendUv: blendMap ? 0 : null, vertex: vertexOf(sub),
      // Illum mit BLENDLAYER: zweite Schicht (Werte BlendLayer2* stehen in params)
      blendLayer: /%BLENDLAYER(?![A-Z_])/.test(sub.genMask || '') ? { d: await schicht(sub.textures?.TexSlot9), n: await schicht(sub.textures?.TexSlot3) } : null,
      gltf: { baseColorFactor: neu.base, metallic: neu.metallic }, vorher: { baseColorFactor: alt.base.map(r3), metallic: alt.metallic },
      // Palette der Entity (linear): Schichten mit paletteTint 1/2/3 nehmen a/b/c.tint statt ihrer tint
      ...(pal ? { palette: pal } : {}),
    };
  }
  const nodeOf = new Map(out.props.map((p) => [p.path.split('/').pop().replace(/\.(cgf|cga|cdf|skin)$/i, '').toLowerCase(), p.node]));
  const ref = (key) => nodeOf.get(key) ?? key;
  const platz = (pl) => pl && { ...pl, mitglieder: pl.mitglieder.map((m) => ({ node: ref(m.key), kategorie: m.kat, at: m.at, y: m.y })) };
  // Arbeitsplätze und Leitungen wie bis v2 (K3), dazu der Platz des Vertreters mit Wandseite
  const arbeitsplaetze = inv.arbeitsplaetze.map((a) => ({ ...a, platz: platz(a.platz) }));
  const leitungen = inv.leitungen;
  // Zonen der Hallen (hangar-deko.md D4)
  const zonen = inv.zonen.map(({ mitglieder, ...z }) => ({ ...z, mitglieder: mitglieder.map((m) => ({ node: ref(m.key), kategorie: m.kat, at: m.at, y: m.y })) }));
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
  const json = { v: 3, kategorien: out.kategorien, props: out.props, arbeitsplaetze, leitungen, zonen, boden, fundorte: inv.fundorte, schiffe, materials, schichten: schichtDateien,
    hinweise: {
      materials: 'Je Material im GLB: Shader, Maske, alle Schichten mit ihren Rohwerten (attrs = übrige Attribute wörtlich; die Werte der Schicht-Datei stehen einmal unter schichten[path]), params = Kopf und PublicParams des Materials wörtlich. Karten liegen unter /hangar/props/schichten/; bei Normalenkarten (_ddna) steht die Glätte im Alpha. blendUv 0 = TEXCOORD_0. vertex: Kanal je Bedeutung, null = vom Spiel nicht benannt. gltf = Werte im GLB, vorher = Werte bis v1.',
      anschluesse: 'Die Requisiten-Modelle tragen keine Helfer, Sockets oder Knochen mit Namen; Anschlusspunkte gibt das Spiel nicht her.',
      namen: 'Spielname und Beschreibung gibt es nur, wo eine Entity mit Lokalisierung die Geometrie trägt; Deko-Requisiten nennen @LOC_PLACEHOLDER. Schiffsbauteile (Kategorie bauteile) sind Items: Name, Beschreibung, Typ und groesse (S1–S3) aus ihrem Datensatz.',
      leitungen: 'Am Boden legt das Spiel kaum Leitungen: kurze Ketten aus 2 bis 3 Stücken, kein Kabel vom Generator zum Schiff. Die meisten Kabelstücke sind Wand- und Deckenzüge. Wie bis v2, nur aus den Hangars.',
      aufstellung: 'Gezählt über alle Fundorte (fundorte). Höhe = Unterkante über dem Boden darunter (Ebene, auf der mindestens drei Bodenstücke stehen, oder Bodenplatte), ohne Boden über dem Feld; Abstand zum Feldrand achsparallel (innen negativ), nur in Hallen mit Landefläche; Wandabstand zur nächsten Bauwand oder zum nächsten Wandgerät; Richtung = Vorderseite (lokale +Y des Spiels, im GLB −z) zur Feldmitte.',
      zone: 'Anteil der Aufstellungen je Zone, Vorrang in dieser Reihenfolge: decke (Unterkante > 2,6 m über dem Boden), ecke (≤ 3 m von zwei Wänden quer zueinander, die zweite ≥ 3,5 m lang), wand (≤ 1,5 m), tor (≤ 8 m von einer Öffnung ≥ 6 m breit und ≥ 5 m hoch auf Höhe des Stücks), feldrand (≤ 6 m vom Feld, innen zählt mit), halle (sonst). Wand = Bauwand (aufrecht, dünn, ≥ 3,5 m lang, oder Wandstück) oder Rückseite eines Wandgeräts (Feuerschlauch, Verteilerdose, Wandbildschirm …), ±4 m entlang.',
      stapel: 'auf: worauf es steht (art boden, palette, kiste, regal = in einem Regal, tisch, geraet, bau = Einbau über dem Boden, haengt = ohne Träger über dem Boden), node = Art des Trägers, anteil, hoehe = Unterkante über dem Boden (Median). traegt: Anteil der Aufstellungen, auf denen etwas steht, und was. saeule: Kisten übereinander in der Säule jeder Aufstellung (Median, Maximum). Nur Brushes mit Box.',
      reihen: 'Gleiche Stücke in einer Flucht, gleich ausgerichtet, mindestens drei je Reihe: Zahl der Reihen, stueck (Median), abstand (Mitte zu Mitte), laenge, gang = lichte Weite zur nächsten parallelen Reihe derselben Art (0,5 bis 12 m), doppelreihen = Rücken an Rücken.',
      zonen: 'Gruppen, deren Requisiten näher als 6 m zueinander stehen (ohne Wand- und Deckenteile, Leitungsstücke und Kleinteile unter 25 cm). name = Kategorien mit ≥ 20 % der Mitglieder; n = Gruppen, Vertreter = Gruppe mittlerer Größe (bis 120 Stück).',
      platz: 'Platzkoordinaten (zonen[] und arbeitsplaetze[].platz): +z zeigt zur nächsten Wand (≤ 3 m von einem Mitglied), z = 0 ist die Wandfläche, x = 0 die Mitte entlang der Wand; at = [x, z, Drehung in Grad um Y], Drehung 0 = Vorderseite des Spiels (im GLB −z) zur Halle; y = Höhe über dem Boden. wand.aus = bauwand oder wandgeraet; ecke.x = Lage der Querwand. Ohne Wand: achse "feld" (+z zur Feldmitte) oder "halle" (Achsen der Halle, +z = Spiel −Y).',
      boden: 'boden.glb: projizierte Decals als Einheitsquadrat (1 × 1 m in XZ, u entlang +X, v = 0 an −Z), size = Kantenlänge im Spiel (Median); Boden-Meshes des Spiels (Gitter, Linien, Ecken, Ziffern) mit Ursprung unten mittig, size = Grundfläche. rolle: schraffur, linie, pfeil, ziffer, parkfeld, markierung, gitter, oel, reifenspur, schleifspur.',
      fundorte: 'Hangars (111 socpaks) und die Fundorte der Hallendeko samt Kind-Containern; je socpak einmal gezählt, auch wo das Spiel es mehrfach einsetzt.',
      werkstatt: 'Kategorien fahrzeug, tor, reifen (Fahrzeugwerkstatt). fahrzeug: das ganze Fahrzeug im Stand, geschlossen, Standardlack (palette), ohne Relais, eingebaute Bauteile, Armaturen und Schadensnetze; werkstatt.roh = Dreiecke der Stufe davor, werkstatt.reifen = Reifen vor und nach dem Ausdünnen, unterkante = Abstand der Reifen zur Unterkante des Ganzen (0 = Räder am Boden), werkstatt.netzRepariert = Knoten, deren Netz der Export einem Geschwister zugeordnet hatte und die das Netz des gleichnamigen Knotens bekamen. Je Stück behalten höchstens drei Untermaterialien ihre eigene, nicht gekachelte Farb- oder Normalenkarte, die übrigen sind gekachelt oder einfarbig (Namen mit _flach, Farbe = Mittelwert der Karte), Glas ist ein Material; eigeneMaterialien = Materialien, die ein eigenes Zeichnen brauchen (Karte, Glas, Leuchten), die übrigen sind flach wie im Wartungsplatz. tor: geschlossene Ruhelage, werkstatt.massstab = Maßstab, in dem das Spiel es aufstellt. Eine Hebebühne für Fahrzeuge gibt es im Spiel nicht.',
    } };
  mkdirSync(fileURLToPath(new URL('props/', OUT)), { recursive: true });
  const jsonOut = fileURLToPath(new URL('props/katalog.json', OUT));
  writeFileSync(jsonOut, JSON.stringify(json) + '\n');
  return {
    url: '/hangar/props/katalog.json', v: createHash('sha1').update(readFileSync(jsonOut)).digest('hex').slice(0, 8), bytes: statSync(jsonOut).size,
    props: out.props.length, kategorien: Object.fromEntries(Object.entries(out.kategorien).map(([k, x]) => [k, { file: x.file, v: x.v, bytes: x.bytes, props: x.props.length }])),
    boden: boden.file ? { url: boden.file, v: boden.v, bytes: boden.bytes, decals: boden.decals.length } : null,
    report: { kats: report, name: out.props.filter((p) => p.name?.en).length, desc: out.props.filter((p) => p.beschreibung?.en).length, zweck: out.props.filter((p) => p.zweck).length, auf: out.props.filter((p) => p.aufstellung).length, ap: arbeitsplaetze.length, apPlatz: arbeitsplaetze.filter((a) => a.platz).length, zonen: zonen.length, lt: leitungen.length, boden: boden.decals.map((d) => `${d.rolle}:${d.art === 'mesh' ? 'm' : 'p'}`).reduce((o, k) => ((o[k] = (o[k] || 0) + 1), o), {}), ports: schiffe.map((s) => `${s.schiff} ${s.anschluesse.length}`).join(', ') },
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
    // Drehung des Knochens (nur die Zylinder haben eine Spur): Container-Quaternion (x, y, z, w) -> glTF (x, z, −y, w)
    const rotCh = (caf) => (g.bone ? caf?.bones.find((x) => x.name === g.bone.name)?.rot : null);
    const quatAt = (caf, f) => { const ch = rotCh(caf); if (!ch?.values) return null; const q = sampleCafRot(ch, f); return [q[0], q[2], -q[1], q[3]].map((v) => Math.round(v * 1e4) / 1e4); };
    const tOf = (caf, k) => r3(((k / 30) * (caf?.frames || 450)) / (caf?.fps || 30) / (T.speed || 1));
    const track = (caf) => [...Array(31)].map((_, k) => { const f = (k / 30) * (caf?.frames || 450); const p = g.bone ? toShaft(worldAt(g.bone, caf, f)) : [0, 0, 0]; return [tOf(caf, k), ...p.map(r3)]; });
    // Drehung getrennt von keys (dort bleibt es bei [t, x, y, z]): [t, qx, qy, qz, qw]
    const rotTrack = (caf) => (rotCh(caf)?.values ? [...Array(31)].map((_, k) => [tOf(caf, k), ...quatAt(caf, (k / 30) * (caf?.frames || 450))]) : null);
    parts.push({
      node, bone: g.bone?.name ?? null, n,
      size: [0, 1, 2].map((i) => r3(b.max[i] - b.min[i])),
      tris: g.prims.reduce((t, p) => t + (p.getIndices()?.getCount() ?? 0) / 3, 0),
      closed: { pos: pivot.map(r3), quat: quatAt(cafOpen, 0) || [0, 0, 0, 1] },
      open: { pos: (g.bone ? toShaft(worldAt(g.bone, cafOpen, cafOpen.frames)) : [0, 0, 0]).map(r3), quat: quatAt(cafOpen, cafOpen.frames) || [0, 0, 0, 1] },
      rotation: rotCh(cafOpen)?.values ? `Drehspur des Spiels (${rotCh(cafOpen).keys} Schlüssel, 48-Bit-Quaternion): keysRot-Zeilen [t, qx, qy, qz, qw] (glTF), Drehung um den Knoten-Ursprung` : null,
      keys: { close: track(cafClose), open: track(cafOpen) },
      ...(rotCh(cafOpen)?.values ? { keysRot: { close: rotTrack(cafClose), open: rotTrack(cafOpen) } } : {}),
    });
  }
  // Fester Teil (Netz-Knoten 0, …_non_merged001): nur LOD0 hat ihn
  if (T.frame) {
    const d0 = await io.read(fileURLToPath(new URL(T.frame.glb, SRC)));
    const g0 = d0.getRoot().listNodes().find((n) => /ht_hangar_ship_elev_door_med_a/.test(n.getMesh()?.getName() || ''));
    const p0 = g0?.getMesh().listPrimitives() || [];
    // Primitive den Teilnetzen zuordnen: in Reihenfolge, Teilnetze ohne Primitiv (vom Export verworfenes Material) überspringen
    const map = []; let k = 0;
    for (const sub of T.frame.subsets) { if (k < p0.length && p0[k].getIndices().getCount() / 3 === sub.tris) { map.push([sub, p0[k]]); k++; } }
    const framePrims = map.filter(([sub]) => sub.node === 0).map(([, pr]) => pr);
    if (framePrims.length) {
      const mesh = doc.createMesh('gate_frame_0');
      const W0 = g0.getWorldMatrix();
      for (const pr of framePrims) {
        // aus dem LOD0-Dokument übernehmen: Attribute kopieren, Material gleichen Namens im Tor-Dokument
        const q = doc.createPrimitive();
        for (const sem of pr.listSemantics()) { const a = pr.getAttribute(sem); q.setAttribute(sem, doc.createAccessor().setType(a.getType()).setArray(a.getArray().slice()).setNormalized(a.getNormalized()).setBuffer(root.listBuffers()[0])); }
        q.setIndices(doc.createAccessor().setType('SCALAR').setArray(pr.getIndices().getArray().slice()).setBuffer(root.listBuffers()[0]));
        transformPrimitive(q, W0);
        transformPrimitive(q, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -LIFT_SHAFT.floorY, 0, 1]);
        const mn = pr.getMaterial()?.getName();
        const mat = root.listMaterials().find((m) => m.getName() === mn);
        if (mat) q.setMaterial(mat);
        mesh.addPrimitive(q);
      }
      const n = doc.createNode('gate_frame_0').setMesh(mesh);
      const b = getBounds(n);
      parts.push({ node: 'gate_frame_0', bone: null, n, size: [0, 1, 2].map((i) => r3(b.max[i] - b.min[i])), tris: framePrims.reduce((t, p) => t + p.getIndices().getCount() / 3, 0),
        closed: { pos: [0, 0, 0], quat: [0, 0, 0, 1] }, open: { pos: [0, 0, 0], quat: [0, 0, 0, 1] }, rotation: null,
        keys: (() => { const st = (c) => [...Array(31)].map((_, k) => [r3(((k / 30) * c.frames) / c.fps / (T.speed || 1)), 0, 0, 0]); return { close: st(cafClose), open: st(cafOpen) }; })(),
        what: `fester Knoten …_non_merged001 (nur LOD0), Material ${framePrims[0].getMaterial()?.getName()}, Box ${b.min.map(r3).join('/')} … ${b.max.map(r3).join('/')}` });
    }
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
    palette: (() => {
      const own = T.palettes?.find((x) => x.cls === 'LoadingPlatformLoadingGate');
      const key = own?.palette.split('/').pop().replace(/&lt;\d+&gt;|<\d+>/, '').toLowerCase();
      const c = T.palColors?.[key];
      const lin = (v) => r3((v / 255) ** 2.2);
      return own && c ? {
        source: `RenderProxy Palette am Entity LoadingPlatformLoadingGate (${own.palette}), Paletten-Datensatz TintPaletteTree ${c.file}`, name: key, wear: own.wear,
        entries: Object.fromEntries(Object.entries(c.entries).map(([k, e]) => [k, { rgb: e.rgb, linear: e.rgb.map(lin), spec: e.spec, gloss: e.gloss }])), glass: c.glass, decal: c.decal,
        layers: { paint_b_primary_041: 1, paint_b_secondary_042: 2, paint_b_tertiary_043: 3, paint_c_notint_044: 0, trim_metal_a_030: 0, trim_greebles_a_031: 0, metal_a_046: 0, glow_a_019: 0 },
        layersNote: 'PaletteTint der Basisschicht (Primary) je Material: 1 = primary (A), 2 = secondary (B), 3 = tertiary (C), 0 = eigene Tönung der Schicht; die Wear-Schichten haben überall 0',
        others: Object.entries(T.palColors || {}).filter(([k]) => k !== key).map(([k, v]) => ({ name: k, where: k === 'gen_grey_darkgrey_yellow' ? 'Tor und Plattform der Industrie-Hangars util_a (Lorville, Levski, Nyx)' : k === 'gen_grey_darkblue_darkorange' ? 'Plattform der Hightech-Hangars (LoadingPlatform)' : k.startsWith('aeroview') ? 'Itembanks im Hangar' : null, entries: v.entries })),
        locations: 'Alle Hightech-Hangars (sml/med/lrg/xl, top und front) setzen am Tor gen_grey_darkgrey_darkblue; die Ortsvarianten _newbab und _orison setzen keine eigene',
      } : null;
    })(),
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

// ─── Rand der Toröffnung (.planning/notes/hangar-schachttor.md, Torrahmen) ─
// Was in Ruhe um die Öffnung zu sehen ist: alle Netze des Schacht-Rohexports
// (hangar_medtop_001, LOD2 aus dem Tor-Lauf) mit Bezugspunkt im Band bis 4 m um den Rand der
// Öffnung (Schachtraum |x| 24…32 oder |z| 40…48, y −4…+1), außer den
// Bausatzteilen, die medtop.glb schon trägt (Randleisten), und dem Tor.
// Je Exemplar ein Knoten rand_<art>_<n> im Schachtraum (Ursprung 0).
// Hologramm über dem Feld (hangar_holo_m) ist kein fester Rand, es blendet die Sequenz ein und aus
const RAND_SKIP = /hangar_ship_elevator_|ht_hangar_ship_elev|light_hazard_2_d|hangar_holo/;
const randKind = (k) => (/walkway_str/.test(k) ? 'steg' : /walkway_corner/.test(k) ? 'stegecke' : /light_landing/.test(k) ? 'landeleuchte' : /light_hazard/.test(k) ? 'warnlampe'
  : /light_floor/.test(k) ? 'bodenleuchte' : /logo/.test(k) ? 'logo' : k.replace(/_[a-z]$/, ''));
async function buildRand() {
  const doc = await io.read(fileURLToPath(new URL('tor/medtop-lod2.glb', SRC)));
  const root = doc.getRoot(), scene = root.listScenes()[0];
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const inBand = (p) => { const ax = Math.abs(p[0]), az = Math.abs(p[2]); return p[1] >= -4 && p[1] <= 1 && ((ax >= 24 && ax <= 32 && az <= 48) || (az >= 40 && az <= 48 && ax <= 32)); };
  const made = [], count = new Map();
  for (const n of root.listNodes()) {
    const m = n.getMesh(); if (!m || !m.listPrimitives().length) continue;
    const key = m.getName().replace(/.*[\\/]/, '').replace(/\.(cgf|cga)$/i, '');
    if (RAND_SKIP.test(key)) continue;
    const w = n.getWorldMatrix();
    const at = [w[12], w[13] - LIFT_SHAFT.floorY, w[14]];
    if (!inBand(at)) continue;
    const kind = randKind(key), i = count.get(kind) || 0; count.set(kind, i + 1);
    const name = `rand_${kind}_${i}`;
    const mesh = doc.createMesh(name);
    for (const p of m.listPrimitives()) {
      const q = p.clone();
      for (const sem of q.listSemantics()) q.setAttribute(sem, p.getAttribute(sem).clone());
      if (p.getIndices()) q.setIndices(p.getIndices().clone());
      transformPrimitive(q, w);
      transformPrimitive(q, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -LIFT_SHAFT.floorY, 0, 1]);
      mesh.addPrimitive(q);
    }
    made.push({ node: name, kind, key, at: at.map(r3), mesh, mats: m.listPrimitives().map((p) => p.getMaterial()) });
  }
  // Schichten je Material (vor applyLayers/cleanMaterials festhalten)
  const materials = {};
  for (const mt of new Set(made.flatMap((x) => x.mats))) {
    const x = mt?.getExtras() || {};
    const man = x.semantic?.layer_manifest || [];
    materials[mt?.getName()] = { shader: x.shader ?? null, layers: man.map((l) => ({ name: l.name, path: l.path, tint: l.tint_color, paletteTint: l.palette_tint, glossMult: l.gloss_mult, uvTiling: l.uv_tiling })), palette: x.semantic?.palette?.source_name ?? (x.semantic?.palette ? 'layer' : null), diffuse: x.diffuse_tex ?? null };
  }
  for (const n of root.listNodes()) n.dispose();
  for (const x of made) scene.addChild(doc.createNode(x.node).setMesh(x.mesh));
  await doc.transform(prune({ keepAttributes: true }));
  applyLayers(doc, 'medtop', 'lift');
  await attachHallTextures(doc);
  stripAttributes(doc, 'lift');
  cleanMaterials(doc);
  await doc.transform(dedup(), join({ keepNamed: true }), weld());
  const nodes = scene.listChildren().map((n) => {
    const x = made.find((y) => y.node === n.getName()); const b = getBounds(n);
    return { node: n.getName(), kind: x.kind, path: x.key, place: x.at, size: [0, 1, 2].map((i) => r3(b.max[i] - b.min[i])), box: [b.min.map(r3), b.max.map(r3)], tris: Math.round(n.getMesh().listPrimitives().reduce((t, p) => t + (p.getIndices()?.getCount() ?? 0) / 3, 0)), materials: x.mats.map((m) => m?.getName()) };
  });
  const tris = nodes.reduce((t, n) => t + n.tris, 0);
  const outPath = fileURLToPath(new URL('lift/medtop-rand.glb', OUT));
  const bytes = await packDoc(doc, outPath, { tex: 1024, ntex: 512 });
  const json = { v: 1, source: { container: 'hangar_medtop_001 (Hightech)', lod: 2, band: 'Schachtraum |x| 24…32 oder |z| 40…48, y −4…+1; ohne Randleisten (in medtop.glb) und Tor', palette: 'Brushes tragen keine eigene Palette; Schichten mit PaletteTint > 0 nehmen die Vorgabe des Containers' }, nodes, materials, tris };
  const jsonOut = fileURLToPath(new URL('lift/medtop-rand.json', OUT));
  writeFileSync(jsonOut, JSON.stringify(json) + '\n');
  const v = createHash('sha1').update(readFileSync(outPath)).update(readFileSync(jsonOut)).digest('hex').slice(0, 8);
  return { url: '/hangar/lift/medtop-rand.glb', json: '/hangar/lift/medtop-rand.json', bytes, v, report: { nodes: nodes.length, tris, kinds: [...count], jsonBytes: statSync(jsonOut).size } };
}

let prev = {};
try { prev = JSON.parse(readFileSync(MANIFEST, 'utf8')); } catch { /* erster Lauf */ }
// Die leichte Hallenstufe steht im Manifest unter hallLite: die Seite nimmt
// den ersten Eintrag unter hall als Halle.
const isLite = (kind, name) => kind === 'hall' && /-lod1$/.test(name);
const slotOf = (kind, name) => (isLite(kind, name) ? 'hallLite' : kind);
const manifest = { ships: {}, weapons: {}, hall: {}, hallLite: {}, npc: {}, lift: {}, props: {}, werkhalle: {} };
let built = 0, reused = 0;
const webShip = (name) => !!prev.ships?.[name] || SHIPS_ARG.includes(name) || SHIPS_ARG.includes('all');
for (const kind of Object.keys(BUDGET)) {
  const dir = new URL(`${kind}/`, SRC);
  // ohne Quellordner auf diesem Rechner (oder andere Art verlangt): bisherige Einträge unverändert übernehmen
  if (!existsSync(dir) || (KIND && KIND !== kind)) { for (const slot of kind === 'hall' ? ['hall', 'hallLite'] : [kind]) Object.assign(manifest[slot], prev[slot] || {}); continue; }
  for (const f of readdirSync(dir).filter((x) => x.toLowerCase().endsWith('.glb'))) {
    const name = f.replace(/\.glb$/i, '');
    const slot = slotOf(kind, name);
    if (kind === 'ships' && !webShip(name)) continue;
    if (ONLY && name !== ONLY) { if (prev[slot]?.[name]) manifest[slot][name] = prev[slot][name]; continue; }
    const inPath = fileURLToPath(new URL(f, dir));
    const outPath = fileURLToPath(new URL(`${kind}/${name}.glb`, OUT));
    // Wiederverwenden nur, wenn das Ergebnis jünger ist als alle Eingaben:
    // bei der Halle zählen Lampenprotokoll und Materialnachtrag mit, und ihre
    // Lampenliste muss schon da sein.
    const side = kind === 'hall' || kind === 'lift' || kind === 'werkhalle' ? ['lights-src.txt', 'matfix.json', 'entities.json', 'layers.json', 'tor.json'].map((x) => fileURLToPath(new URL(`${name}.${x}`, dir))).filter((x) => existsSync(x)) : [];
    // Werkhalle: Maße und Lampenliste müssen jünger sein; die Maße lesen auch die Bühnen-Rohdatei
    const werkOut = kind === 'werkhalle' && !/-buehne$/.test(name) ? ['json', 'lights.json'].map((x) => fileURLToPath(new URL(`werkhalle/${name}.${x}`, OUT))) : [];
    if (werkOut.length && existsSync(fileURLToPath(new URL(`${name}-buehne.glb`, dir)))) side.push(fileURLToPath(new URL(`${name}-buehne.glb`, dir)));
    const lightsOut = fileURLToPath(new URL(`${kind}/${name}.lights.json`, OUT));
    // beim Aufzug ebenso seine Teile-/Lampenliste (writeLiftJson): fehlt sie, laesst die Seite den Schacht weg
    const liftOut = fileURLToPath(new URL(`lift/${name}.json`, OUT));
    // bei Schiffen auch der Lack-Bauplan: Lackliste, Index des zerlegten
    // Exports und Sidecar des Rohexports müssen älter sein als Modell und Bauplan
    if (kind === 'ships') side.push(...[fileURLToPath(new URL('../src/data/ship-paints.json', import.meta.url)), fileURLToPath(new URL('index.json', PAINT_DEC)), ...['json', 'matfix.json', 'layers.json'].map((x) => fileURLToPath(new URL(`${name}.${x}`, dir)))].filter((x) => existsSync(x)));
    const paintOut = kind === 'ships' && prev.ships?.[name]?.paints ? fileURLToPath(new URL(`paints/${name}.json`, OUT)) : null;
    const fresh = existsSync(outPath) && [inPath, ...side].every((x) => statSync(outPath).mtimeMs > statSync(x).mtimeMs)
      && (!paintOut || (existsSync(paintOut) && [inPath, ...side].every((x) => statSync(paintOut).mtimeMs > statSync(x).mtimeMs)))
      && (kind !== 'hall' || isLite(kind, name) || !side.some((x) => x.endsWith('.lights-src.txt')) || (existsSync(lightsOut) && side.every((x) => statSync(lightsOut).mtimeMs > statSync(x).mtimeMs)))
      && (kind !== 'lift' || (existsSync(liftOut) && [inPath, ...side].every((x) => statSync(liftOut).mtimeMs > statSync(x).mtimeMs)))
      && werkOut.every((o) => existsSync(o) && [inPath, ...side].every((x) => statSync(o).mtimeMs > statSync(x).mtimeMs));
    // Schiffe ohne Tauschteile oder Lackkanäle (vor der Layout-Werkstatt gebaut) neu
    if (!FORCE && prev[slot]?.[name] && fresh && (kind !== 'ships' || (prev[slot][name].swap && prev[slot][name].palette))) {
      manifest[slot][name] = prev[slot][name]; reused++; continue;
    }
    try {
      const r = await buildOne(kind, name, inPath);
      if (kind === 'hall') r.room = HALL_ROOM[name.replace(/-lod1$/, '')] ?? null;
      manifest[slot][name] = r; built++;
      console.log(`  ${kind}/${name.padEnd(28)} ${r.trisRaw.toLocaleString().padStart(8)} -> ${r.tris.toLocaleString().padStart(8)} Dreiecke  ${String(r.textures).padStart(3)} Texturen  ${(r.bytes / 1048576).toFixed(2)} MB${r.pool ? ` + ${r.pool.images} Bilder ${(r.pool.bytes / 1048576).toFixed(2)} MB (neu in der Ablage ${(r.pool.fresh / 1048576).toFixed(2)} MB)` : ''}`);
      if (r.crease) console.log(`    Normalen: ${r.crease.changedPct} % der Ecken über Kanten geglättet, neu berechnet`);
      if (r.swap) console.log(`    Tauschteile: ${Object.keys(r.swap).length} Waffen-Ports (${Object.values(r.swap).reduce((a, b) => a + b, 0)} Exemplare, ${r.swapNodes} Knoten)${Object.keys(r.swap).length ? '' : ' — WARNUNG: keine Serienwaffe im Rohexport gefunden'}`);
      if (r.palette) console.log(`    Lackfarben: ${r.palette[1] + r.palette[2] + r.palette[3]} Materialien (A ${r.palette[1]}, B ${r.palette[2]}, C ${r.palette[3]})`);
      if (kind === 'ships') console.log(`    Quelle: ${r.record ?? 'Rohexport ohne Sidecar'}${r.game ? ` (CL ${r.game})` : ''}, Innenraum ${r.interiorDropped ? `${r.interiorDropped} Container entfernt` : 'behalten'}`);
      if (kind === 'ships' && r.matfix) console.log(`    Materialnachtrag: ${r.matfix.fixed} Primitive (${r.matfix.reused} auf Materialien des Exports, ${r.matfix.created} neue Materialien, ${r.matfix.layered ?? 0} mit Schichtkarten), ${r.matfix.dropped} NoDraw entfernt; ohne Material ${r.cover.before.trisOhneMaterial} -> ${r.cover.after.trisOhneMaterial} Dreiecke`);
      const pr = r.paintReport;
      delete r.paintReport;
      if (kind === 'ships') console.log(pr ? `    Lacke: ${pr.paints} (${pr.linked} mit Lack-Item, ${pr.patterned} mit eigenem Material: ${pr.stencils} Stencil-, ${pr.layerSwaps} Schichtwechsel), ${pr.textures} Karten${pr.missing ? `; ${pr.missing} Lack-Materialien nicht im Web-Modell (Innenraum, Glühen u. ä. weggelassen: ${pr.missingNames.slice(0, 6).join(', ')})` : ''}` : '    Lacke: keine Lackvarianten im zerlegten Export (oder kein Export, Extraktor-Teil ships)');
      if (kind === 'ships' && sisterUsed.length) console.log(`    Paletten aus Schwesterpaketen: ${sisterUsed.splice(0).join('; ')}`);
      if (r.anchorBy) console.log(`    Befestigung über ${r.anchorBy === 'name' ? 'den Entity-Namen' : r.anchorBy === 'kind' ? 'das einzige Kind der Wurzel' : 'die Szenenwurzel — WARNUNG: Lage am Schiff ungeprüft'}`);
      if (r.furnitureNodes) console.log(`    Einrichtung: ${r.furnitureNodes.roots} Möbel in ${r.furnitureNodes.nodes} eigenen Knoten (Originalgröße im Viewer), Halle ${r.furnitureNodes.drawCalls} Draw-Calls`);
      if (r.hull) {
        // heile Halle: 0,04 %; aufgerissene Längswände: 1,1 bis 2,3 %
        const where = Object.entries(r.hull.walls).filter(([, n]) => n).sort((p, q) => q[1] - p[1]).map(([k, n]) => `${k} ${n}`).join(', ');
        console.log(`    Hülle: ${r.hull.pct} % von ${r.hull.rays.toLocaleString()} Blickstrahlen aus dem Raum treffen nichts${r.hull.pct > 0.5 ? ` — WARNUNG: Löcher in der Hülle (${where}; x = Längswände, z = Stirnwände, y = Decke/Boden)` : ''}`);
      }
      if (kind === 'hall' && r.tris > BUDGET.hall.tris) console.log(`    WARNUNG Halle: ${r.tris.toLocaleString()} Dreiecke über der Warnschwelle von ${BUDGET.hall.tris.toLocaleString()} (nicht dezimiert)`);
      if (kind === 'werkhalle') {
        const b = BUDGET.werkhalle;
        console.log(`    Werkhalle: ${r.materials} Materialien, Knoten ${JSON.stringify(r.nodes)}`);
        if (r.room) console.log(`    Maße: ${JSON.stringify(r.room)}`);
        for (const [what, have, max] of [['Dreiecke', r.tris, b.tris], ['Materialien', r.materials, b.materials], ['Bytes', r.bytes, b.bytes]]) if (have > max) console.log(`    WARNUNG Werkhalle: ${have.toLocaleString()} ${what} über dem Budget von ${max.toLocaleString()}`);
      }
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
        console.log(`    Halle: ${r.tris.toLocaleString()} Dreiecke, ${r.furniture != null ? `${r.furniture} Einrichtungsobjekte, ` : ''}${r.lights.total} Lichter (${t}; ${r.lights.matched} mit Spieltyp${r.lights.withFixture != null ? `, ${r.lights.withFixture} an einem Leuchtkörper` : ''}), ${(r.bytes / 1048576).toFixed(2)} MB`);
        const o = r.lights.orient;
        if (o) console.log(`    Lampen: ${o.spots} Spots umgerechnet (${o.spotsAway} von ${o.spotsMounted} montierten zeigen von ihrer Fläche weg), ${o.areaMounted} von ${o.area} Flächenlichtern an ihrer Fläche ausgerichtet`);
      }
    } catch (err) {
      console.error(`  ${kind}/${name}: FEHLER ${err.stack || err.message}`);
    }
  }
}
// Lackkarten, auf die kein Bauplan mehr zeigt (alte Namen ohne Inhaltskennung,
// geänderte Karten), nur auf dem Rechner mit Rohbestand entfernen
const PAINT_DIR = fileURLToPath(new URL('paints/', OUT));
if (existsSync(new URL('ships/', SRC)) && existsSync(`${PAINT_DIR}tex`)) {
  const used = new Set(readdirSync(PAINT_DIR).filter((f) => f.endsWith('.json'))
    .flatMap((f) => [...readFileSync(`${PAINT_DIR}${f}`, 'utf8').matchAll(/\/hangar\/paints\/tex\/([^"]+)/g)].map((m) => m[1])));
  const stale = readdirSync(`${PAINT_DIR}tex`).filter((f) => !used.has(f));
  for (const f of stale) rmSync(`${PAINT_DIR}tex/${f}`);
  console.log(`  Lackkarten: ${used.size} in Gebrauch, ${stale.length} verwaiste entfernt`);
}
// Schiffsbilder, auf die kein Schiff mehr zeigt, ebenso nur dort entfernen
if (existsSync(new URL('ships/', SRC)) && (!KIND || KIND === 'ships')) {
  const r = prunePool(SHIP_POOL.poolDir, [fileURLToPath(new URL('ships/', OUT))], SHIP_POOL.uriPrefix);
  console.log(`  Schiffsbilder: ${r.used} in Gebrauch, ${r.removed.length} verwaiste entfernt`);
}
// Werkstatt: eigene Quelle (zwei Stufen eines Hangars), nur bei Bedarf neu
if ((!ONLY || ONLY === 'werkstatt') && !KIND) {
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
  if ((ONLY && ONLY !== 'tor') || KIND || !existsSync(tj) || (!FORCE && fresh && keep)) { if (keep) manifest.lift.medtop.gate = keep; }
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
// Rand der Toröffnung: hängt ebenfalls an lift.medtop (Quelle: Schacht-Rohexport)
if (manifest.lift.medtop) {
  const keep = prev.lift?.medtop?.rand;
  if ((ONLY && ONLY !== 'tor' && ONLY !== 'rand') || KIND) { if (keep) manifest.lift.medtop.rand = keep; }
  else {
    try {
      const r = await buildRand();
      const { report, ...rand } = r;
      manifest.lift.medtop.rand = rand; built++;
      console.log(`  lift/medtop-rand  ${report.nodes} Knoten, ${report.tris.toLocaleString()} Dreiecke, ${(r.bytes / 1048576).toFixed(2)} MB, JSON ${(report.jsonBytes / 1024).toFixed(0)} KB: ${report.kinds.map(([k, n]) => `${n}× ${k}`).join(', ')}`);
    } catch (err) { console.error(`  lift/medtop-rand: FEHLER ${err.stack || err.message}`); if (keep) manifest.lift.medtop.rand = keep; }
  }
}
// Gerätekatalog: eigene Quelle (scripts/extract-hangar-katalog.mjs)
if ((!ONLY || ONLY === 'katalog') && !KIND) {
  const q = fileURLToPath(new URL('katalog/quellen.json', SRC)), qi = fileURLToPath(new URL('katalog/inventar.json', SRC));
  // neu bauen, sobald eine der beiden Quellen juenger ist (inventar.json schreibt der Auszug zuerst)
  const newest = () => Math.max(statSync(q).mtimeMs, existsSync(qi) ? statSync(qi).mtimeMs : 0);
  // Boden der Hallendeko (props/boden.glb) entsteht im selben Lauf
  const keep = () => { if (prev.props?.katalog) manifest.props.katalog = prev.props.katalog; if (prev.props?.boden) manifest.props.boden = prev.props.boden; };
  if (!existsSync(q)) { keep(); console.log('  katalog: Quelle fehlt (scripts/extract-hangar-katalog.mjs), Eintrag bleibt'); }
  else if (!FORCE && prev.props?.katalog && existsSync(fileURLToPath(new URL('props/katalog.json', OUT))) && statSync(fileURLToPath(new URL('props/katalog.json', OUT))).mtimeMs > newest()) { keep(); reused++; }
  else {
    try {
      const r = await buildKatalog();
      const { report, boden, ...entry } = r;
      manifest.props.katalog = entry; built++;
      if (boden) manifest.props.boden = boden;
      console.log(`  props/katalog  ${r.props} Requisiten in ${Object.keys(r.kategorien).length} Kategorien, katalog.json ${(r.bytes / 1024).toFixed(0)} KB`);
      for (const [k, n, t, b] of report.kats) console.log(`    ${k.padEnd(12)} ${String(n).padStart(3)} Requisiten  ${String(t).padStart(7)} Dreiecke  ${(b / 1048576).toFixed(2)} MB`);
      console.log(`    mit Spielname ${report.name}, mit Beschreibung ${report.desc}, mit Zweck (abgeleitet) ${report.zweck}, mit Aufstellung aus dem Spiel ${report.auf}, mit Anschlusspunkten 0`);
      console.log(`    Arbeitsplätze ${report.ap} (mit Platz ${report.apPlatz}), Zonen ${report.zonen}, Leitungen ${report.lt}; Schiffsanschlüsse: ${report.ports}`);
      if (boden) console.log(`  props/boden  ${boden.decals} Decals (${Object.entries(report.boden).map(([k, n]) => `${n} ${k}`).join(', ')}), ${(boden.bytes / 1048576).toFixed(2)} MB`);
    } catch (err) { console.error(`  props/katalog: FEHLER ${err.stack || err.message}`); keep(); }
  }
} else { if (prev.props?.katalog) manifest.props.katalog = prev.props.katalog; if (prev.props?.boden) manifest.props.boden = prev.props.boden; }
// Schlüssel, die andere Skripte pflegen (z. B. weapons), bleiben stehen;
// Reihenfolge wie bisher in der Datei
const merged = { source: 'StarBreaker entity/socpak export -> gltf-transform (Draco, WebP)' };
for (const k of Object.keys(prev)) if (k !== 'source') merged[k] = k in manifest ? manifest[k] : prev[k];
for (const k of Object.keys(manifest)) if (!(k in merged)) merged[k] = manifest[k];
await writeFile(MANIFEST, JSON.stringify(merged, null, 2) + '\n', 'utf8');
console.log(`${built} gebaut, ${reused} unveraendert -> ${PROBE ? fileURLToPath(MANIFEST) : 'src/data/hangar-assets.json'}`);
