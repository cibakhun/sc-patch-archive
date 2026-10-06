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
import { existsSync, mkdirSync } from 'node:fs';
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
const COMMON = ['--materials', 'textures', '--mip', '2', '--lod', '1'];
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
    // socpak export bettet keine Bilder ein, nennt aber die Pfade: einzeln
    // dekodieren (mip 2 = 1/4 Kantenlänge, reicht für die Web-Fassung).
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(file);
    const paths = new Set();
    for (const m of doc.getRoot().listMaterials()) {
      const x = m.getExtras() || {};
      for (const p of [x.diffuse_tex, x.normal_tex]) if (p && !/defaults\//i.test(p)) paths.add(p.replace(/\\/g, '/'));
    }
    let ok = 0, skip = 0, bad = 0;
    for (const p of paths) {
      const rel = p.replace(/^data\//i, '').replace(/\.(tif|dds)$/i, '');
      const out = `${SRC}tex/${rel.toLowerCase()}.png`;
      if (!FORCE && existsSync(out)) { skip++; continue; }
      mkdirSync(dirname(out), { recursive: true });
      try { sb(['dds', 'decode', `Data/${rel}.dds`, out, '--mip', '2']); ok++; }
      catch { bad++; }
    }
    console.log(`  Texturen: ${ok} dekodiert, ${skip} vorhanden, ${bad} nicht gefunden (von ${paths.size})`);
  }
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
