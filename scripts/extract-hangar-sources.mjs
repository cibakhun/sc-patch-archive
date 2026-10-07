// Holt die Rohmodelle der Hangar-Seite aus der lokalen Data.p4k — Schiffe
// MIT Texturen, die Halle, die Hangar-Crew — in den gitignorierten Cache.
// Danach baut scripts/build-hangar-assets.mjs daraus die Web-Modelle.
//
// Nur lokal (Schiene C): braucht StarBreaker + Data.p4k, liest nur, schreibt
// nichts ins Spiel. Rohdateien bleiben in .cache/ und werden nie eingecheckt.
//
//   SC_STARBREAKER=<pfad zur starbreaker.exe>   (Default siehe unten)
//   SC_P4K=<pfad zur Data.p4k>
//
// Usage:  node scripts/extract-hangar-sources.mjs [ships|hall|npc ...] [--ships slug,slug] [--force]
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, unpartition } from '@gltf-transform/functions';

const STARBREAKER = process.env.SC_STARBREAKER ?? 'G:/Projects/games/Star Citizen/tools/starbreaker-cli/starbreaker.exe';
const P4K = process.env.SC_P4K ?? 'F:/Games/Star Citizen/StarCitizen/LIVE/Data.p4k';
const SRC = fileURLToPath(new URL('../.cache/hangar-src/', import.meta.url));

// Schiffe mit Werkslack. Slug = vehicles.json-id; die Entity heißt wie der
// Slug mit Unterstrichen (aegs-gladius -> AEGS_Gladius, Teilstring-Suche).
const SHIPS = [
  'aegs-gladius', 'anvl-arrow', 'anvl-hornet-f7c-mk2', 'aegs-avenger-titan', 'rsi-aurora-mk2',
  'drak-cutlass-black', 'misc-freelancer', 'orig-300i', 'crus-starlifter-c2', 'rsi-constellation-andromeda',
];
// Innenraum nur bei Jägern, deren Cockpit man durch die Haube sieht. Bei
// allen anderen sind Kabinen und Laderäume von außen unsichtbar, aber bis zu
// zwei Drittel der Dreiecke (Aurora Mk II: 2 von 3 Millionen).
const KEEP_INTERIOR = new Set(['aegs-gladius', 'anvl-arrow', 'anvl-hornet-f7c-mk2', 'aegs-avenger-titan', 'orig-300i']);
// Die Halle: Revel & York, Deluxe-Hangar (72 x 136 m Boden). Weitere Hallen
// über denselben Weg (socpak-Name als Teilstring).
const HALLS = [{ key: 'revelyork-single', socpak: 'hangar_revelyork_single.socpak' }];
// Hangar-Crew: die RSI-Deckcrew-Montur, Teil für Teil (.skin). Der Weg über
// die NPC-Archetypen scheitert: deren Skelett (.chr) exportiert StarBreaker
// nicht, und ihre Kleidungs-Loadouts liegen nicht in der Data.p4k. Der Helm
// verdeckt das Gesicht — ein Kopfmodell braucht es nicht.
const NPCS = [
  {
    key: 'deckcrew-m',
    parts: ['m_rsi_deckcrew_01_undersuit', 'm_rsi_deckcrew_01_core', 'm_rsi_deckcrew_01_arms', 'm_rsi_deckcrew_01_legs', 'm_rsi_deckcrew_01_helmet'],
  },
];

const argv = process.argv.slice(2);
const FORCE = argv.includes('--force');
const shipArg = argv.includes('--ships') ? argv[argv.indexOf('--ships') + 1].split(',') : null;
const parts = argv.filter((a) => ['ships', 'hall', 'npc'].includes(a));
const want = (p) => !parts.length || parts.includes(p);

if (!existsSync(STARBREAKER)) { console.error(`StarBreaker fehlt: ${STARBREAKER} (SC_STARBREAKER setzen)`); process.exit(1); }
if (!existsSync(P4K)) { console.error(`Data.p4k fehlt: ${P4K} (SC_P4K setzen)`); process.exit(1); }

function sb(args) {
  const r = spawnSync(STARBREAKER, [...args, '--p4k', P4K], { encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' | '));
  return r.stdout;
}
// mip 1 = halbe Kantenlänge (bis 2048 px); der Build deckelt Farbe auf 1024, Normalen auf 512
const COMMON = ['--materials', 'textures', '--mip', '1', '--lod', '1'];
// skin export kennt keine Material-/LOD-Schalter: reine Geometrie, volle Stufe.
const sbSkin = (part, file) => sb(['skin', 'export', part, file]);

function exportTo(file, args) {
  if (!FORCE && existsSync(file)) { console.log(`  = ${file.slice(SRC.length)}`); return false; }
  mkdirSync(dirname(file), { recursive: true });
  const t = Date.now();
  sb([...args, file, ...COMMON]);
  console.log(`  + ${file.slice(SRC.length)}  (${((Date.now() - t) / 1000).toFixed(0)} s)`);
  return true;
}

if (want('ships')) {
  console.log('Schiffe');
  for (const slug of shipArg ?? SHIPS) {
    const args = ['entity', 'export', slug.replace(/-/g, '_')];
    if (!KEEP_INTERIOR.has(slug)) args.push('--no-interior');
    try { exportTo(`${SRC}ships/${slug}.glb`, args); }
    catch (e) { console.error(`  ! ${slug}: ${e.message}`); }
  }
}

if (want('hall')) {
  console.log('Halle');
  for (const h of HALLS) {
    const file = `${SRC}hall/${h.key}.glb`;
    try { exportTo(file, ['socpak', 'export', h.socpak]); }
    catch (e) { console.error(`  ! ${h.key}: ${e.message}`); continue; }
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(file);
    const fix = hallMaterialFix(doc);
    writeFileSync(`${SRC}hall/${h.key}.matfix.json`, JSON.stringify(fix, null, 1));
    console.log(`  Materialien nachgetragen: ${Object.keys(fix.meshes).length} Meshes, ${Object.keys(fix.mtls).length} .mtl`);

    // socpak export bettet keine Bilder ein, nennt aber die Pfade: einzeln
    // dekodieren (mip 1 = halbe Kantenlänge; der Build deckelt auf 1024 px).
    const paths = new Set();
    const add = (p) => { if (p && !/defaults\//i.test(p)) paths.add(p.replace(/\\/g, '/')); };
    for (const m of doc.getRoot().listMaterials()) { const x = m.getExtras() || {}; add(x.diffuse_tex); add(x.normal_tex); }
    for (const subs of Object.values(fix.mtls)) for (const s of subs) { add(s.d); add(s.n); add(s.s); add(s.blend?.d); add(s.blend?.mask); }
    // _ddna trägt neben den Normalen im Alpha die Glätte: als eigene Karte
    // (.gloss.png), daraus macht der Build die Rauheit. Viele _ddna der Halle
    // sind im Spiel selbst flach (jeder BC5-Block kodiert 0/0/1) — dort ist
    // die Glätte die einzige Information.
    let ok = 0, skip = 0, bad = 0, gloss = 0;
    for (const p of paths) {
      const rel = p.replace(/^data\//i, '').replace(/\.(tif|dds)$/i, '');
      const base = `${SRC}tex-m1/${rel.toLowerCase()}`;
      const ddna = /_ddna$/i.test(rel);
      mkdirSync(dirname(base), { recursive: true });
      if (ddna && (FORCE || !existsSync(`${base}.gloss.png`))) {
        try { sb(['dds', 'decode', `Data/${rel}.dds`, `${base}.gloss.png`, '--mip', '1', '--alpha']); gloss++; } catch { /* ohne Glätte */ }
      }
      if (!FORCE && existsSync(`${base}.png`)) { skip++; continue; }
      try { sb(['dds', 'decode', `Data/${rel}.dds`, `${base}.png`, '--mip', '1']); ok++; }
      catch { bad++; }
    }
    console.log(`  Texturen: ${ok} dekodiert, ${skip} vorhanden, ${bad} nicht gefunden (von ${paths.size}); ${gloss} Glättekarten`);
  }
}

// ─── Hallen-Materialien, die der socpak-Export nicht auflöst ─────────────
// Ein Teil der Bausatz-Meshes (Wände, Türrahmen, Geländer, Plattformen)
// nennt sein Material als „Data/Objects/…/hangar_deluxe_kit_master“ — mit
// Data/-Präfix. Diese Schreibweise löst StarBreaker nicht auf; die
// Primitive kommen ohne Material (Grau #e7e7e7, ~25 % der Hallendreiecke).
// Hier holen wir das nach: Material-Pfad aus der .cgf, Untermaterial-ID je
// Submesh aus der .cgfm (32-Bit-Wort vor first_index: untere 16 Bit =
// Material, obere = Knoten), Untermaterialien samt Texturen aus der .mtl.
// Für alle .mtl der Halle gehen außerdem die Specular-Maps (TexSlot4) mit:
// bei CryEngine-Metall steckt dort die Farbe.
function hallMaterialFix(doc) {
  const RAW = `${SRC}hall-raw/`;
  const unresolved = new Map();   // Meshname -> Primitiv-Indexzahlen
  const bases = new Set();
  for (const m of doc.getRoot().listMeshes()) {
    const prims = m.listPrimitives();
    if (prims.some((p) => !p.getMaterial()?.getName())) {
      unresolved.set(m.getName().replace(/.*[\\/]/, '').replace(/\.(cgf|cga)$/i, ''), prims.map((p) => p.getIndices()?.getCount() ?? 0));
    }
    for (const p of prims) {
      const n = p.getMaterial()?.getName() || '';
      if (n.includes('_mtl_')) bases.add(n.split('_mtl_')[0]);
    }
  }
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Meshes: .cgf (Materialpfad) und .cgfm (Submeshes), Grund- und LOD1-Stufe
  if (unresolved.size) {
    sb(['p4k', 'extract', '-o', RAW, '--regex', `(?i)[\\\\/](${[...unresolved.keys()].map(esc).join('|')})(_lod1)?\\.cgfm?$`]);
  }
  const files = listFiles(RAW);
  const meshes = {};
  for (const [name, counts] of unresolved) {
    const cgf = files.find((f) => f.toLowerCase().endsWith(`/${name.toLowerCase()}.cgf`));
    if (!cgf) continue;
    const mtl = (readFileSync(cgf, 'latin1').match(/(?:Data\/)?(?:Objects\/[\w/]+\/)?([\w]+)(?=\0)/g) || [])
      .map((s) => s.replace(/^Data\//i, '').split('/').pop())
      .find((s) => bases.has(s) || /master|_mtl|kit/i.test(s));
    if (!mtl) continue;
    // die Stufe nehmen, deren Submeshes zu den exportierten Primitiven passen
    for (const lod of [`${name}_lod1.cgfm`, `${name}.cgfm`]) {
      const f = files.find((x) => x.toLowerCase().endsWith(`/${lod.toLowerCase()}`));
      const subs = f && readSubsets(readFileSync(f));
      if (subs && subs.length === counts.length && subs.every((s, i) => s.num === counts[i])) {
        meshes[name] = { mtl, ids: subs.map((s) => s.mat) };
        bases.add(mtl);
        break;
      }
    }
  }
  // .mtl lesen (CryXmlB -> XML) und Untermaterialien festhalten
  sb(['p4k', 'extract', '-o', RAW, '--regex', `(?i)[\\\\/](${[...bases].map(esc).join('|')})\\.mtl$`]);
  const mtls = {};
  for (const f of listFiles(RAW).filter((x) => x.toLowerCase().endsWith('.mtl'))) {
    const base = f.split('/').pop().replace(/\.mtl$/i, '');
    if (!bases.has(base) || mtls[base]) continue;
    const xml = `${f}.xml`;
    if (!existsSync(xml)) spawnSync(STARBREAKER, ['cryxml', 'convert', f, xml]);
    if (!existsSync(xml)) continue;
    mtls[base] = parseSubMaterials(readFileSync(xml, 'utf8'));
  }
  return { meshes, mtls };
}

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true }).map((f) => `${dir}${String(f).replace(/\\/g, '/')}`);
}

// Submesh-Tabelle einer IVO-.cgfm: Zeilen zu 48 Byte, je Zeile
// [Material|Knoten, first_index, num_indices, first_vertex, 0, num_vertices,
// radius, center x/y/z, 2 x unbekannt]. Gesucht wird die längste Kette, in
// der first_index jeweils an die vorige Zeile anschließt.
function readSubsets(buf) {
  const i32 = (o) => buf.readInt32LE(o);
  let best = null;
  for (let o = 0; o + 48 <= buf.length; o += 4) {
    if (i32(o + 4) !== 0 || i32(o + 12) !== 0 || i32(o + 16) !== 0) continue;
    const rows = [];
    let at = o, next = 0;
    while (at + 48 <= buf.length && i32(at + 4) === next && i32(at + 8) > 0 && i32(at + 8) % 3 === 0 && i32(at + 16) === 0) {
      rows.push({ mat: buf.readUInt16LE(at), num: i32(at + 8) });
      next += i32(at + 8);
      at += 48;
    }
    if (rows.length && (!best || rows.length > best.length)) best = rows;
  }
  return best;
}

function parseSubMaterials(xml) {
  const out = [];
  const body = xml.split(/<SubMaterials>/i)[1] || '';
  for (const block of body.split(/<Material\b/i).slice(1)) {
    const head = block.slice(0, block.indexOf('>'));
    const attr = (k) => (head.match(new RegExp(`\\b${k}="([^"]*)"`, 'i')) || [])[1];
    const tex = (slot) => (block.match(new RegExp(`Map="${slot}"[^>]*File="([^"]*)"|File="([^"]*)"[^>]*Map="${slot}"`, 'i')) || []).slice(1).find(Boolean);
    // Kachelung einer Textur: <TexMod TileU=… TileV=…> direkt im <Texture>.
    // Nur ein nicht selbstschließendes <Texture> hat ein TexMod — sonst
    // griffe der Ausdruck das TexMod der nächsten Textur.
    const tile = (slot) => {
      const t = block.match(new RegExp(`<Texture\\b[^>]*Map="${slot}"[^>]*?(?<!/)>([\\s\\S]*?)</Texture>`, 'i'))?.[1] || '';
      const u = Number(t.match(/TileU="([^"]*)"/)?.[1] || 1), v = Number(t.match(/TileV="([^"]*)"/)?.[1] || 1);
      return u !== 1 || v !== 1 ? [u, v] : undefined;
    };
    // Zweite Blendschicht (StringGenMask %BLENDLAYER): Farbe TexSlot9, Maske
    // TexSlot12, Mischung über die PublicParams der .mtl
    const pp = (block.match(/<PublicParams\b([^>]*)\/>/i) || [])[1] || '';
    const param = (k) => (pp.match(new RegExp(`\\b${k}="([^"]*)"`)) || [])[1];
    const blend = /BLENDLAYER/i.test(attr('StringGenMask') || '') && tex('TexSlot9') ? {
      d: tex('TexSlot9'), mask: tex('TexSlot12'), td: tile('TexSlot9'), tm: tile('TexSlot12'),
      factor: Number(param('BlendFactor') ?? 0), falloff: Number(param('BlendFalloff') ?? 1),
      tiling: Number(param('BlendLayer2Tiling') ?? 1), maskTiling: Number(param('BlendMaskTiling') ?? 1),
      color: param('BlendLayer2DiffuseColor'), gloss: Number(param('BlendLayer2Glossiness') ?? 255),
    } : undefined;
    out.push({
      name: attr('Name'), shader: attr('Shader'), diffuse: attr('Diffuse'), specular: attr('Specular'),
      shininess: attr('Shininess'), opacity: attr('Opacity'),
      d: tex('TexSlot1'), n: tex('TexSlot2'), s: tex('TexSlot4'), td: tile('TexSlot1'), tn: tile('TexSlot2'),
      blend,
    });
  }
  return out;
}

if (want('npc')) {
  console.log('Hangar-Crew');
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  for (const n of NPCS) {
    const out = `${SRC}npc/${n.key}.glb`;
    if (!FORCE && existsSync(out)) { console.log(`  = npc/${n.key}.glb`); continue; }
    try {
      // Teile einzeln exportieren, dann zu einer Figur zusammenlegen. Jedes
      // Teil bekommt ein Material mit seinem Namen — daran hängt der Build
      // die Farben (Overall, Helm, Visier, Leuchten).
      const doc = new Document();
      for (const part of n.parts) {
        const file = `${SRC}npc-parts/${part}.glb`;
        if (FORCE || !existsSync(file)) { mkdirSync(dirname(file), { recursive: true }); sbSkin(`${part}.skin`, file); }
        const src = await io.read(file);
        const mat = src.createMaterial(part.replace(/^.*_01_/, ''));
        for (const m of src.getRoot().listMeshes()) for (const p of m.listPrimitives()) p.setMaterial(mat);
        mergeDocuments(doc, src);
      }
      // jedes Teil brachte eine eigene Szene mit: alles in die erste
      const [scene, ...rest] = doc.getRoot().listScenes();
      for (const s of rest) { for (const c of s.listChildren()) scene.addChild(c); s.dispose(); }
      doc.getRoot().setDefaultScene(scene);
      await doc.transform(unpartition());   // ein Puffer je GLB
      mkdirSync(dirname(out), { recursive: true });
      await io.write(out, doc);
      console.log(`  + npc/${n.key}.glb  (${n.parts.length} Teile)`);
    } catch (e) { console.error(`  ! ${n.key}: ${e.message}`); }
  }
}
