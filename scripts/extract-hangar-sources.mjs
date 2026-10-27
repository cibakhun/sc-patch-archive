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
// Usage:  node scripts/extract-hangar-sources.mjs [ships|ships-matfix|weapons|hall|lift|werkstatt|werkhalle|npc ...] [--ships slug,slug] [--force]
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { inflateRawSync } from 'node:zlib';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, unpartition } from '@gltf-transform/functions';

const STARBREAKER = process.env.SC_STARBREAKER ?? 'G:/Projects/games/Star Citizen/tools/starbreaker-cli/starbreaker.exe';
const P4K = process.env.SC_P4K ?? 'F:/Games/Star Citizen/StarCitizen/LIVE/Data.p4k';
const SRC = fileURLToPath(new URL('../.cache/hangar-src/', import.meta.url));

// Schiffe: jedes Fahrzeug mit Hangar-Modell (src/data/holo-meshes.json), diese
// zuerst. Slug = vehicles.json-id, Record = Slug mit Unterstrichen; gibt es
// <Record>_GS (4.10.2: Constellation, Hammerhead), gewinnt er wie in
// scripts/lib/vehicle-records.mjs, sonst stünde das alte Modell im Hangar.
const SHIPS_FIRST = [
  'aegs-gladius', 'anvl-arrow', 'anvl-hornet-f7c-mk2', 'aegs-avenger-titan', 'rsi-aurora-mk2',
  'drak-cutlass-black', 'misc-freelancer', 'orig-300i', 'crus-starlifter-c2', 'rsi-constellation-andromeda',
  'drak-corsair', 'rsi-zeus-es', 'misc-prospector', 'aegs-sabre', 'crus-intrepid', 'drak-vulture',
  'anvl-c8x-pisces-expedition', 'orig-400i', 'anvl-carrack', 'rsi-polaris',
];
// Ein Export je Schiff, MIT Innenraum: die Container hängen als
// interior_*-Knoten unter der Wurzel, der Build nimmt sie für die Außenfassung
// weg. --materials all: Normalen und Rauheit auch der Schichtmaterialien
// (Rumpf, Lackkanäle); mit „textures“ fehlen sie genau dort.
const SHIP_ARGS = ['--materials', 'all', '--mip', '1', '--lod', '1'];
// Speichergrenze je Export (MB) und Zeitgrenze: ein Großschiff mit Innenraum
// bricht ab statt den Rechner auszulagern (Polaris: 24 GB, dann Stillstand
// ohne Rechenzeit); der Lauf versucht es dann ohne Innenraum.
const SHIP_MEM_CAP = '24000';
const SHIP_TIMEOUT = 15 * 60000;
// Ab dieser Länge (m, vehicles.json) gleich ohne Innenraum: Polaris (181 m)
// sprengte mit ihm den Speicher, die Carrack (126 m) ging noch (771 MB).
const SHIP_NO_INTERIOR_M = 150;
// Daneben der zerlegte Export in EINEN gemeinsamen Ordner (geteilte Texturen
// liegen einmal): Lackvarianten mit Muster-Material (paints.json), Paletten
// samt Finish (palettes.json), je .mtl die Untermaterialien mit Schichten,
// Stencil und Decal-Karten (<mtl>_TEX1.materials.json), Texturen als PNG.
const SHIP_DEC = `${SRC}ships-dec/`;
// Die Halle: Revel & York, Deluxe-Hangar (72 x 136 m Boden). Weitere Hallen
// über denselben Weg (socpak-Name als Teilstring).
// lod 0 = volle Stufe (Rechner), lod 1 = dichte, leichtere Kopie (Telefone)
const HALLS = [
  { key: 'revelyork-single', socpak: 'hangar_revelyork_single.socpak', lod: 0 },
  { key: 'revelyork-single-lod1', socpak: 'hangar_revelyork_single.socpak', lod: 1 },
];
// Schiffsaufzug der heutigen Hangars (Hightech, „medtop“: Landefläche 56 x 88 m,
// am nächsten an unserem Schiffsfeld 32 x 96 m). Exportiert wird der ganze
// Hangar wie die Halle; der Build schneidet Plattform, Tor und Schacht heraus.
const LIFTS = [{ key: 'medtop', socpak: 'hangar_medtop_001.socpak', lod: 1 }];
// Werkstatt (.planning/notes/hangar-werkstatt.md): der Industrie-Hangar mit
// den meisten Boden-Decals und dem meisten Arbeitsgerät am Feld (util_a,
// mittlere Größe, Feld 56 x 88 m wie der Schacht). Beide Stufen: der Build
// nimmt je Requisit LOD 0, wenn es ins Budget passt, sonst LOD 1.
const WERKSTATT = [
  { key: 'util-medtop002', socpak: 'util_a\\hangar_medtop_002.socpak', lod: 0 },
  { key: 'util-medtop002-lod1', socpak: 'util_a\\hangar_medtop_002.socpak', lod: 1, info: true },
];
// Öl und Risse, die in der Vorlagenhalle fehlen, im Spiel aber auf
// Hallenböden liegen (Fundorte und mittlere Kantenlänge aus 87 Hangar-socpaks
// von util_a, VFG Industrial und Self-Land). Ohne Anordnung, die Cloud setzt sie.
const WERK_EXTRA_DECALS = [
  { material: 'materials/decals/cracks/cracks_c', edge: 5.2, from: ['hangar_smlfrnt_001_gh', 'hangar_smltop_001_gh', 'hangar_xltop_001_gh'] },
  { material: 'materials/pu/decal/concrete/decal_concrete_crack_b', edge: 3.7, from: ['hangar_lrgtop_001_delving'] },
  { material: 'materials/pu/decal/concrete/decal_concrete_debris_a', edge: 3.0, from: ['hangar_lrgtop_001_delving'] },
  { material: 'materials/decals/oil/oil_puddle_a', edge: 6.2, from: ['hangar_lrgfrnt_001_gh', 'hangar_lrgfrnt_001_law', 'hangar_medfrnt_001_gh', 'hangar_medfrnt_001_gh_dressing', 'hangar_medfrnt_001_rest_rund_dressing'] },
  { material: 'materials/decals/oil/oil_splat_a', edge: 14.9, from: ['hangar_lrgfrnt_001_gh', 'hangar_lrgfrnt_001_law', 'hangar_xltop_001_gh_dressing'] },
];

// Werkhalle für Bodenfahrzeuge (.planning/notes/hangar-werkhalle.md): die
// große Garage der Hightech-Städte (Bausatz delta/int/garage). Der Teilstring
// trifft zwei socpaks im selben Raum: die Hülle garage_lrg_001 und ihre
// Einrichtung in New Babbage (garage_lrg_001_newbab: Torrahmen, Leuchten,
// Lampen; sie nennt die Hülle als externes Kind, das StarBreaker nicht
// nachlädt). Das Torblatt stellt erst der Raumhafen auf, der die Garage
// enthält (bei Garage (19, −287, 16), ungedreht, Container-Raum Z oben).
// Die Bühnen sind eigene Teile: zwei Lastenaufzug-Plattformen desselben
// Bausatzes und der Drehteller der Ausstellungshalle.
const WERKHALLE = [{
  key: 'ht-garage-lrg', socpak: 'hightech_a\\garage_lrg_001', lod: 0,
  // Blätter = Knochen der .cga; was an keinem hängt, ist tor_rahmen
  tor: {
    socpak: 'newbab\\newbab_sp_surface_entrance_int.socpak', cga: 'high_tech_garage_door_l', garage: [19, 16, 287],
    blatt: { door_bottom_primary: 'tor_unten_1', door_bottom_secondary: 'tor_unten_2', door_top_primary: 'tor_oben_1', door_top_secundary: 'tor_oben_2' },
  },
  buehnen: [
    { node: 'buehne_lift_m', socpak: 'elev_hightech\\elev_ht_cargo_hangar_med_a.socpak', mesh: /[\\/]elev_ht_cargo_pad_m\.cga$/i },
    { node: 'buehne_lift_l', socpak: 'elev_hightech\\elev_ht_cargo_hangar_lrg_a.socpak', mesh: /[\\/]elev_ht_cargo_pad_l\.cga$/i },
    { node: 'buehne_drehteller', socpak: 'hightech_a\\ht_fw_center_connection_master.socpak', mesh: /^expo_hall_connection_turntable_001_a$/i },
  ],
}];

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
const parts = argv.filter((a) => ['ships', 'ships-matfix', 'weapons', 'hall', 'lift', 'werkstatt', 'werkhalle', 'npc'].includes(a));
const want = (p) => !parts.length || parts.includes(p);

if (!existsSync(STARBREAKER)) { console.error(`StarBreaker fehlt: ${STARBREAKER} (SC_STARBREAKER setzen)`); process.exit(1); }
if (!existsSync(P4K)) { console.error(`Data.p4k fehlt: ${P4K} (SC_P4K setzen)`); process.exit(1); }

// log: StarBreaker mit -v aufrufen und dessen Protokoll (stderr) mit zurückgeben
// timeout (ms): danach abbrechen — ein Großschiff, das den Speicher auslagert,
// steht sonst ohne Rechenzeit still, statt an der Grenze abzubrechen
function sb(args, { log = false, timeout = 0 } = {}) {
  const r = spawnSync(STARBREAKER, [...(log ? ['-v'] : []), ...args, '--p4k', P4K], { encoding: 'utf8', maxBuffer: 256 << 20, timeout });
  if (r.error?.code === 'ETIMEDOUT') throw new Error(`abgebrochen nach ${Math.round(timeout / 60000)} min`);
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' | '));
  return log ? { stdout: r.stdout, log: r.stderr } : r.stdout;
}
// mip 1 = halbe Kantenlänge (bis 2048 px); der Build deckelt Farbe auf 1024, Normalen auf 512
const COMMON = ['--materials', 'textures', '--mip', '1', '--lod', '1'];
// skin export kennt keine Material-/LOD-Schalter: reine Geometrie, volle Stufe.
const sbSkin = (part, file) => sb(['skin', 'export', part, file]);

function exportTo(file, args, common = COMMON, { log = false } = {}) {
  if (!FORCE && existsSync(file)) { console.log(`  = ${file.slice(SRC.length)}`); return false; }
  mkdirSync(dirname(file), { recursive: true });
  const t = Date.now();
  const r = sb([...args, file, ...common], { log });
  console.log(`  + ${file.slice(SRC.length)}  (${((Date.now() - t) / 1000).toFixed(0)} s)`);
  return log ? r.log : true;
}

// Spielstand der Data.p4k (build_manifest.id daneben): steht in jeder
// Schiffs-Sidecar, damit ein neuer Patch den Rohbestand als veraltet erkennt.
function gameBuild() {
  const f = `${dirname(P4K)}/build_manifest.id`;
  if (!existsSync(f)) return null;
  const d = JSON.parse(readFileSync(f, 'utf8')).Data ?? {};
  return { branch: d.Branch ?? null, change: d.RequestedP4ChangeNum ?? null };
}

function shipRecords(db, slugs) {
  const names = new Map();
  for (const r of db.records) {
    if (db.structs[r.structIndex]?.name !== 'EntityClassDefinition') continue;
    const n = r.name.replace(/^EntityClassDefinition\./, '');
    if (!names.has(n.toLowerCase())) names.set(n.toLowerCase(), n);
  }
  return new Map(slugs.map((s) => {
    const base = s.replace(/-/g, '_').toLowerCase();
    return [s, names.get(`${base}_gs`) ?? names.get(base) ?? null];
  }));
}

if (want('ships')) {
  console.log('Schiffe');
  const root = new URL('../', import.meta.url);
  const holo = Object.keys(JSON.parse(readFileSync(new URL('src/data/holo-meshes.json', root), 'utf8')).meshes);
  const slugs = shipArg ?? [...new Set([...SHIPS_FIRST.filter((s) => holo.includes(s)), ...holo])];
  const { openP4k } = await import('./lib/p4k.mjs');
  const { openDataCore } = await import('./lib/datacore.mjs');
  const p4k = openP4k(P4K);
  const recs = shipRecords(openDataCore(p4k.read(/^Data[\\/]Game2\.dcb$/i)), slugs);
  p4k.close();
  const build = gameBuild();
  const sig = { args: SHIP_ARGS, interior: true, build };
  const lengthM = new Map(JSON.parse(readFileSync(new URL('src/data/vehicles.json', root), 'utf8')).vehicles.map((v) => [v.id, v.lengthM ?? 0]));
  mkdirSync(`${SRC}ships`, { recursive: true });
  mkdirSync(SHIP_DEC, { recursive: true });
  const decIndexFile = `${SHIP_DEC}index.json`;
  const decIndex = existsSync(decIndexFile) ? JSON.parse(readFileSync(decIndexFile, 'utf8')) : {};
  const t0 = Date.now();
  let done = 0, fresh = 0, fail = 0;
  for (const slug of slugs) {
    const rec = recs.get(slug);
    done++;
    if (!rec) { console.error(`  ! ${slug}: kein Record`); fail++; continue; }
    const glb = `${SRC}ships/${slug}.glb`, side = `${SRC}ships/${slug}.json`;
    const prev = existsSync(side) ? JSON.parse(readFileSync(side, 'utf8')) : null;
    const same = prev && prev.record === rec && JSON.stringify(prev.sig) === JSON.stringify(sig) && existsSync(glb) && decIndex[slug]?.record === rec;
    if (same && !FORCE) { console.log(`  = ${slug} (${rec})`); continue; }
    const t = Date.now();
    const info = { slug, record: rec, sig, interior: true };
    try {
      const limits = { timeout: SHIP_TIMEOUT };
      try {
        if (lengthM.get(slug) >= SHIP_NO_INTERIOR_M) throw new Error(`${lengthM.get(slug)} m lang`);
        sb(['entity', 'export', rec, glb, ...SHIP_ARGS, '--mem-cap', SHIP_MEM_CAP], limits);
      } catch (e) {
        // Großschiff über der Speichergrenze: dann wenigstens die Außenhaut,
        // und reicht auch das nicht (Idris: 24 GB ohne Innenraum), mit Texturen
        // in halber Kantenlänge (mip 2, der Build deckelt ohnehin auf 1024)
        console.error(`  ! ${slug}: ${e.message} — zweiter Versuch ohne Innenraum`);
        info.interior = false;
        try { sb(['entity', 'export', rec, glb, ...SHIP_ARGS, '--no-interior', '--mem-cap', SHIP_MEM_CAP], limits); }
        catch (e2) {
          console.error(`  ! ${slug}: ${e2.message.split(' | ').at(-1)} — dritter Versuch mit mip 2`);
          try { sb(['entity', 'export', rec, glb, ...SHIP_ARGS.map((a, i, all) => (all[i - 1] === '--mip' ? '2' : a)), '--no-interior', '--mem-cap', SHIP_MEM_CAP], limits); }
          catch (e3) {
            // Idris, Ironclad, Perseus: auch das sprengt die Grenze; dann die
            // gröbere Stufe (LOD 2), die Außenhaut reicht für den Hangar
            console.error(`  ! ${slug}: ${e3.message.split(' | ').at(-1)} — vierter Versuch mit LOD 2`);
            sb(['entity', 'export', rec, glb, ...SHIP_ARGS.map((a, i, all) => (all[i - 1] === '--mip' ? '2' : all[i - 1] === '--lod' ? '2' : a)), '--no-interior', '--mem-cap', SHIP_MEM_CAP], limits);
            info.lod = 2;
          }
          info.mip = 2;
        }
      }
      const before = new Set(existsSync(`${SHIP_DEC}Packages`) ? readdirSync(`${SHIP_DEC}Packages`) : []);
      const decArgs = SHIP_ARGS.map((a, i, all) => (all[i - 1] === '--mip' && info.mip ? String(info.mip) : all[i - 1] === '--lod' && info.lod ? String(info.lod) : a));
      sb(['entity', 'export', rec, SHIP_DEC.replace(/\/$/, ''), '--kind', 'decomposed', ...decArgs, '--skip-existing-assets', ...(info.interior ? [] : ['--no-interior']), '--mem-cap', SHIP_MEM_CAP], limits);
      // Das Paket heißt nach dem Record (Unterstriche als Leerzeichen); gibt es
      // den Namen nicht, das neu angelegte
      const named = `${rec.replace(/_/g, ' ')}_LOD1_TEX${info.mip ?? 1}`;
      const pkg = existsSync(`${SHIP_DEC}Packages/${named}`) ? named : readdirSync(`${SHIP_DEC}Packages`).find((p) => !before.has(p)) ?? null;
      decIndex[slug] = { record: rec, package: pkg };
      writeFileSync(decIndexFile, JSON.stringify(decIndex, null, 1));
      info.seconds = Math.round((Date.now() - t) / 1000);
      info.bytes = statSync(glb).size;
      writeFileSync(side, JSON.stringify(info, null, 1) + '\n');
      fresh++;
      const eta = ((Date.now() - t0) / fresh) * (slugs.length - done) / 60000;
      console.log(`  + ${slug} (${rec}${info.interior ? '' : ', ohne Innenraum'})  ${(info.bytes / 1e6).toFixed(0)} MB, ${info.seconds} s, Paket ${pkg ?? '?'}  [${done}/${slugs.length}, noch ~${eta.toFixed(0)} min]`);
    } catch (e) { console.error(`  ! ${slug} (${rec}): ${e.message}`); fail++; }
  }
  console.log(`  ${fresh} exportiert, ${slugs.length - fresh - fail} aktuell, ${fail} fehlgeschlagen`);
}

// Materialnachtrag der Schiffe (.planning/notes/hangar-innenraum.md): je
// Rohexport mit Primitiven ohne Material ships/<slug>.matfix.json (Form wie
// bei der Halle) und ships/<slug>.layers.json, Texturen der neuen
// Untermaterialien nach tex-m1/. Ohne solche Primitive fallen beide weg.
if (want('ships-matfix')) {
  console.log('Schiffe: Materialnachtrag');
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const decIndex = existsSync(`${SHIP_DEC}index.json`) ? JSON.parse(readFileSync(`${SHIP_DEC}index.json`, 'utf8')) : {};
  const slugs = shipArg ?? readdirSync(`${SRC}ships`).filter((f) => f.endsWith('.glb')).map((f) => f.slice(0, -4));
  for (const slug of slugs) {
    const glb = `${SRC}ships/${slug}.glb`;
    if (!existsSync(glb)) { console.error(`  ! ${slug}: kein Rohexport`); continue; }
    const out = (x) => `${SRC}ships/${slug}.${x}.json`;
    const sceneFile = `${SHIP_DEC}Packages/${decIndex[slug]?.package}/scene.json`;
    const fix = shipMaterialFix(await io.read(glb), existsSync(sceneFile) ? JSON.parse(readFileSync(sceneFile, 'utf8')) : null);
    if (!fix) {
      for (const x of ['matfix', 'layers']) if (existsSync(out(x))) rmSync(out(x));
      console.log(`  = ${slug}: alle Primitive mit Material`);
      continue;
    }
    const { report, fresh, ...matfix } = fix;
    const layers = layerMaterials(new Set(fresh.flatMap((s) => (s.d ? [] : (s.layers || []).map((l) => l.path)))));
    writeFileSync(out('matfix'), JSON.stringify(matfix, null, 1));
    if (Object.keys(layers).length) writeFileSync(out('layers'), JSON.stringify(layers, null, 1));
    else if (existsSync(out('layers'))) rmSync(out('layers'));
    const paths = new Set();
    const add = (p) => { if (p && !/defaults\//i.test(p)) paths.add(p.replace(/\\/g, '/')); };
    for (const s of fresh) { add(s.d); add(s.n); add(s.s); add(s.blend?.d); add(s.blend?.mask); }
    for (const l of Object.values(layers)) { add(l.d); add(l.n); }
    const t = decodeTextures(paths);
    const r = report;
    console.log(`  + ${slug}: ${r.bareBefore} -> ${r.bareAfter} Dreiecke ohne Material (${r.meshes} Meshes, ${Object.keys(matfix.meshes).length} Mesh-Namen zugeordnet)`);
    console.log(`    .mtl: ${Object.keys(matfix.mtls).join(', ')}`);
    console.log(`    Untermaterialien: ${r.subs} benutzt (${r.subs - fresh.length - r.nodraw} schon im Export, ${fresh.length} neu, ${r.nodraw} NoDraw), ${Object.keys(layers).length} Schicht-.mtl`);
    console.log(`    Texturen: ${t.ok} dekodiert, ${t.skip} vorhanden, ${t.bad} nicht gefunden (von ${paths.size}); ${t.gloss} Glättekarten`);
    for (const m of r.missing) console.log(`    ? ${m.mesh} (${m.tris} Dreiecke): ${m.why}`);
  }
}

// Bordwaffen für den Tausch in der Layout-Werkstatt: jede Waffe, die in einen
// Waffen-Port eines Schiffs mit Rohexport passt (Größe wie das Serienteil),
// als eigenes Modell. Datei = Schlüssel der Werkstatt (<id> oder <id>~<größe>,
// „~“ wird „-s“), daneben <datei>.json mit Schlüssel und Entity-Namen: der
// Build sucht unter diesem Namen den Befestigungspunkt.
if (want('weapons')) {
  console.log('Waffen');
  const { openP4k } = await import('./lib/p4k.mjs');
  const { openDataCore } = await import('./lib/datacore.mjs');
  const root = new URL('../', import.meta.url);
  const loadouts = JSON.parse(readFileSync(new URL('src/data/ship-loadouts.json', root), 'utf8')).ships;
  const raw = existsSync(`${SRC}ships`) ? readdirSync(`${SRC}ships`).filter((f) => f.endsWith('.glb')).map((f) => f.slice(0, -4)) : [];
  const sizes = new Set();
  for (const slug of raw) for (const items of Object.values(loadouts[slug] ?? {})) {
    for (const it of items) if (it.cat === 'weapon' && it.turretKind !== 'pdc' && it.size >= 1) sizes.add(it.size);
  }
  const all = JSON.parse(readFileSync(new URL('assets/universal-items.json', root), 'utf8'));
  const want2 = [];
  for (const it of Array.isArray(all) ? all : all.items ?? Object.values(all)) {
    if (it.category !== 'Vehiclegear / Weapons / Guns' || /placeholder|<=|=>|\bTBD\b/i.test(it.name)) continue;
    const g = it.game ?? {};
    const vs = g.variants?.length ? g.variants.map((v) => ({ size: v.size, guid: v.guid, key: `${it.id}~${v.size}` })) : [{ size: g.size, guid: g.guid, key: it.id }];
    for (const v of vs) if (sizes.has(v.size) && v.guid) want2.push(v);
  }
  console.log(`  ${want2.length} Waffen in den Größen ${[...sizes].sort((a, b) => a - b).join(', ')} (aus ${raw.length} Schiffen)`);
  const p4k = openP4k(P4K);
  const db = openDataCore(p4k.read(/^Data[\\/]Game2\.dcb$/i));
  p4k.close();
  let fail = 0;
  for (const v of want2) {
    const stem = db.recordById.get(v.guid)?.name?.replace(/^EntityClassDefinition\./, '');
    if (!stem) { console.error(`  ! ${v.key}: kein Record`); fail++; continue; }
    const file = `${SRC}weapons/${v.key.replace('~', '-s')}.glb`;
    try {
      exportTo(file, ['entity', 'export', stem]);
      writeFileSync(file.replace(/\.glb$/, '.json'), JSON.stringify({ key: v.key, stem }) + '\n');
    } catch (e) { console.error(`  ! ${v.key} (${stem}): ${e.message}`); fail++; }
  }
  if (fail) console.log(`  ${fail} Waffen ohne Modell`);
}

// Halle und Aufzug: socpak-Export mit Lichtprotokoll, Materialnachtrag, Texturen
const containers = [
  ...(want('hall') ? HALLS.map((h) => ({ ...h, dir: 'hall' })) : []),
  ...(want('lift') ? LIFTS.map((h) => ({ ...h, dir: 'lift' })) : []),
  ...(want('werkstatt') ? WERKSTATT.map((h) => ({ ...h, dir: 'werkstatt' })) : []),
  // Werkhalle: Raum roh nach werkhalle-raw/, daraus Raum mit Torblatt und die
  // Bühnen-Datei (werkhalleCompose); beide laufen dann wie die Halle weiter
  ...(want('werkhalle') ? WERKHALLE.flatMap((h) => [
    { ...h, dir: 'werkhalle', raw: `${SRC}werkhalle-raw/${h.key}.raum.glb` },
    { key: `${h.key}-buehne`, dir: 'werkhalle', from: h.key },
  ]) : []),
];
if (containers.length) {
  console.log('Halle/Aufzug');
  for (const h of containers) {
    const file = `${SRC}${h.dir}/${h.key}.glb`;
    mkdirSync(`${SRC}${h.dir}`, { recursive: true });
    // Stufe je Halle (h.lod): die volle Stufe hat Fasen, Schrauben und
    // Kantenprofile, die LOD 1 fehlen. Schiffe bleiben bei COMMON.
    // Lichter: das GLB trägt sie als KHR_lights_punctual, kennt aber nur
    // Punkt und Spot. Den Spieltyp (Planar = Flächenlicht, Projector, Omni,
    // Ambient) und die Spiel-Intensität nennt nur das Protokoll des Exports
    // (-v): "Light '<name>' type=… intensity=… radius=… color=[…]". Diese
    // Zeilen gehen nach <halle>.lights-src.txt, der Build verbindet sie über
    // den Namen mit den Lichtknoten.
    try {
      if (h.socpak) {
        const log = exportTo(h.raw ?? file, ['socpak', 'export', h.socpak], COMMON.map((a, i, all) => (all[i - 1] === '--lod' ? String(h.lod) : a)), { log: true });
        if (typeof log === 'string') {
          const lines = log.split('\n').filter((l) => / Light '/.test(l)).map((l) => l.replace(/^.*?\] +/, ''));
          writeFileSync(`${SRC}${h.dir}/${h.key}.lights-src.txt`, lines.join('\n') + '\n');
          console.log(`  Lichtangaben: ${lines.length}`);
        }
      }
      if (h.tor) await werkhalleCompose(h, file);
    } catch (e) { console.error(`  ! ${h.key}: ${e.message}`); continue; }
    if (!existsSync(file)) { console.error(`  ! ${h.key}: ${file.slice(SRC.length)} fehlt (Teil von ${h.from})`); continue; }
    if (h.dir === 'lift') {
      const info = liftEntities(h);
      writeFileSync(`${SRC}lift/${h.key}.entities.json`, JSON.stringify(info, null, 1));
      console.log(`  Aufzug: Plattform ${info.platform?.geometry}, ${info.padLights.length} Plattform-Lampen, Sequenzen ${info.sequences.map((s) => `${s.name} ${s.end} s`).join(', ')}`);
    }
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(file);
    const fix = hallMaterialFix(doc);
    writeFileSync(`${SRC}${h.dir}/${h.key}.matfix.json`, JSON.stringify(fix, null, 1));
    console.log(`  Materialien nachgetragen: ${Object.keys(fix.meshes).length} Meshes, ${Object.keys(fix.mtls).length} .mtl`);

    // socpak export bettet keine Bilder ein, nennt aber die Pfade: einzeln
    // dekodieren (mip 1 = halbe Kantenlänge; der Build deckelt auf 1024 px).
    const paths = new Set();
    const add = (p) => { if (p && !/defaults\//i.test(p)) paths.add(p.replace(/\\/g, '/')); };
    for (const m of doc.getRoot().listMaterials()) { const x = m.getExtras() || {}; add(x.diffuse_tex); add(x.normal_tex); }
    for (const subs of Object.values(fix.mtls)) for (const s of subs) { add(s.d); add(s.n); add(s.s); add(s.blend?.d); add(s.blend?.mask); }
    // Decal-Farbkarten tragen ihr Alpha (Deckkraft) schon im RGBA-PNG
    if (h.info) {
      const info = werkstattInfo(h);
      writeFileSync(`${SRC}${h.dir}/${h.key}.info.json`, JSON.stringify(info, null, 1));
      for (const m of Object.values(info.decalMaterials)) { add(m.d); add(m.n); add(m.maskTex); }
      console.log(`  Werkstatt: Landefläche ${info.landingArea?.dimensions?.join(' x ')} m, ${info.decals.length} Decals (${info.decals.filter((d) => d.floor).length} auf dem Boden), ${Object.keys(info.decalMaterials).length} Decal-Materialien`);
    }
    if (h.dir === 'lift' || h.dir === 'werkstatt' || h.dir === 'werkhalle') {
      const layers = layerMaterials(docLayerPaths(doc));
      writeFileSync(`${SRC}${h.dir}/${h.key}.layers.json`, JSON.stringify(layers, null, 1));
      for (const l of Object.values(layers)) { add(l.d); add(l.n); }
      console.log(`  Schichtmaterialien: ${Object.keys(layers).length} .mtl (${Object.values(layers).filter((l) => l.d).length} mit Farbkarte)`);
    }
    // Schacht: Beiwerk (Decal-Meshes, Decal-Objekte) und Projektortexturen
    if (h.dir === 'lift') {
      const deco = liftDeco(h, doc);
      deco.decalMaterials = readDecalMaterials([...new Set(deco.decals.map((d) => d.material).filter(Boolean))], `${SRC}lift-raw/`);
      writeFileSync(`${SRC}lift/${h.key}.deco.json`, JSON.stringify(deco, null, 1));
      for (const d of deco.deco) for (const s of d.subs || []) { add(s.d); add(s.n); }
      for (const m of Object.values(deco.decalMaterials)) { add(m.d); add(m.n); add(m.maskTex); }
      const ent = JSON.parse(readFileSync(`${SRC}lift/${h.key}.entities.json`, 'utf8'));
      const proj = new Set([...ent.shaftLights, ...ent.padLights].map((l) => l.projector).filter(Boolean));
      for (const p of proj) add(p);
      console.log(`  Schacht-Beiwerk: ${deco.deco.length} Decal-Meshes (${deco.deco.reduce((n, d) => n + d.instances.length, 0)} Exemplare, ${deco.deco.filter((d) => d.missing).length} ohne Quelle), ${deco.decals.length} Decal-Objekte, ${proj.size} Projektortexturen`);
    }
    const t = decodeTextures(paths);
    console.log(`  Texturen: ${t.ok} dekodiert, ${t.skip} vorhanden, ${t.bad} nicht gefunden (von ${paths.size}); ${t.gloss} Glättekarten`);
  }
}

// p4k-Texturpfade nach tex-m1/<pfad>.png (mip 1 = halbe Kantenlänge; der
// Build deckelt auf 1024 px). _ddna trägt neben den Normalen im Alpha die
// Glätte: als eigene Karte (.gloss.png), daraus macht der Build die Rauheit.
// Viele _ddna der Halle sind im Spiel selbst flach (jeder BC5-Block kodiert
// 0/0/1) — dort ist die Glätte die einzige Information.
function decodeTextures(paths) {
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
  return { ok, skip, bad, gloss };
}

// ─── Schiffsaufzug: Entities aus dem socpak ───────────────────────────────
// Der socpak ist ein ZIP. Die .soc darin ist eine CryEngine-Chunkdatei; ein
// Chunk ist CryXmlB mit allen Entities samt Pos (Container-Raum, Z oben),
// Rotate (w, x, y, z) und Komponenten. Daraus: Plattform, Tor, Landefläche,
// Manager (Lichtzustände je Phase), die beiden Trackview-Sequenzen (Länge,
// Lichtwechsel) und die Lampen der Lichtgruppe, die am Plattform-Bone hängt
// (StarBreaker lässt sie im GLB weg). Dazu die Animationsangaben der .cga
// (.chrparams, .animevents, Kopf der .caf).
function readZip(buf) {
  const files = new Map();
  let eocd = buf.length - 22;
  while (eocd > 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  let p = buf.readUInt32LE(eocd + 16);
  const n = buf.readUInt16LE(eocd + 10);
  for (let i = 0; i < n; i++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42), name = buf.toString('utf8', p + 46, p + 46 + nl);
    const data = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(data, data + csize);
    files.set(name, () => (method === 8 ? inflateRawSync(raw) : raw));
    p += 46 + nl + xl + cl;
  }
  return files;
}

function socEntitiesXml(socBuf, tmpBase) {
  const cnt = socBuf.readUInt32LE(8), tab = socBuf.readUInt32LE(12);
  for (let i = 0; i < cnt; i++) {
    const o = tab + i * 16, size = socBuf.readUInt32LE(o + 8), off = socBuf.readUInt32LE(o + 12);
    if (socBuf.toString('latin1', off, off + 7) !== 'CryXmlB') continue;
    writeFileSync(`${tmpBase}.cryxml`, socBuf.subarray(off, off + size));
    spawnSync(STARBREAKER, ['cryxml', 'convert', `${tmpBase}.cryxml`, `${tmpBase}.xml`]);
    if (existsSync(`${tmpBase}.xml`)) return readFileSync(`${tmpBase}.xml`, 'utf8');
  }
  return '';
}

function liftEntities(h) {
  const RAW = `${SRC}lift-raw/`;
  mkdirSync(RAW, { recursive: true });
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  sb(['p4k', 'extract', '-o', RAW, '--regex', `(?i)[\\\\/]${esc(h.socpak)}$`]);
  const pak = listFiles(RAW).find((f) => f.toLowerCase().endsWith(`/${h.socpak.toLowerCase()}`));
  const zip = readZip(readFileSync(pak));
  const socName = [...zip.keys()].find((k) => k.toLowerCase().endsWith('.soc'));
  const xml = socEntitiesXml(zip.get(socName)(), `${RAW}${h.key}`);
  const ents = [...xml.matchAll(/<Entity\b([^>]*)>([\s\S]*?)<\/Entity>/g)].map((m) => {
    const at = (k) => (m[1].match(new RegExp(`\\b${k}="([^"]*)"`)) || [])[1];
    return { head: m[1], body: m[2], at, cls: at('EntityClass'), name: at('Name'), guid: at('EntityCryGUID') };
  });
  const one = (c) => ents.find((e) => e.cls === c);
  const num = (s) => String(s || '').split(',').map(Number);
  const geo = (e) => (e?.body.match(/GlobalResourceGeometry" path="([^"]+)"/) || [])[1];
  const platform = one('LoadingPlatform'), gate = one('LoadingPlatformLoadingGate');
  const manager = one('LoadingPlatformManager'), landing = one('LandingArea');
  const lg = (manager?.body.match(/<lightGroupParams\b([^>]*)\/>/) || [])[1] || '';
  const attr = (s, k) => (s.match(new RegExp(`\\b${k}="([^"]*)"`)) || [])[1];
  // Trackview-Sequenzen: Länge und Lichtzustände je Lichtgruppe
  const sequences = [...xml.matchAll(/<Sequence\b([^>]*)>([\s\S]*?)<\/Sequence>/g)].map((s) => ({
    name: attr(s[1], 'Name'), end: Number(attr(s[1], 'EndTime')),
    lightStates: [...s[2].matchAll(/<Key\b[^>]*time="([^"]*)"[^>]*lightState="([^"]*)"/g)].map((k) => [Number(k[1]), Number(k[2])]),
    sounds: [...s[2].matchAll(/<Key\b[^>]*time="([^"]*)"[^>]*StartTrigger="([^"]*)"/g)].map((k) => [Number(k[1]), k[2]]),
  }));
  // Lampen der Lichtgruppe am Plattform-Bone
  const padGroup = ents.find((e) => /anim_pad/i.test(e.at('AttachmentTarget') || '') && /LightGroup/i.test(e.cls));
  const lightRecord = (l) => {
    const b = l[2], st = (k) => b.match(new RegExp(`<${k}\\b([^>]*)>\\s*<color[^>]*r="([^"]*)" g="([^"]*)" b="([^"]*)"`)) || [];
    const state = (k) => { const s = st(k); return s[1] ? { intensity: Number(attr(s[1], 'intensity')), temperature: Number(attr(s[1], 'temperature')), lightStyle: Number(attr(s[1], 'lightStyle')), color: [s[2], s[3], s[4]].map(Number) } : null; };
    const xf = (b.match(/<RelativeXForm\b([^>]*)\/>/) || [])[1] || '';
    const comp = (b.match(/<EntityComponentLight\b([^>]*)>/) || [])[1] || '';
    const sty = (b.match(/<styleParams\b([^>]*)\/>/) || [])[1] || '';
    return {
      name: attr(l[1], 'Name'), type: attr(comp, 'lightType'), useTemperature: attr(comp, 'useTemperature') === '1',
      radius: Number(attr((b.match(/<sizeParams\b([^>]*)\/>/) || [])[1] || '', 'lightRadius')),
      fov: Number(attr((b.match(/<projectorParams\b([^>]*)\/>/) || [])[1] || '', 'FOV')) || null,
      // Muster im Lichtkegel (nur Projector)
      projector: attr((b.match(/<projectorParams\b([^>]*)\/>/) || [])[1] || '', 'texture') || null,
      default: state('defaultState'), emergency: state('emergencyState'), auxiliary: state('auxiliaryState'),
      style: { animationSpeed: Number(attr(sty, 'animationSpeed')), lightanimation: attr(sty, 'lightanimation'), angularSpeed: Number(attr(sty, 'angularSpeed')) },
      rotation: num(attr(xf, 'rotation')), translation: num(attr(xf, 'translation')),
    };
  };
  const groupLights = (g) => [...(g?.body.matchAll(/<Light\b([^>]*)>([\s\S]*?)<\/Light>/g) || [])].map(lightRecord);
  const padLights = groupLights(padGroup);
  // Lampen im Schacht aus den übrigen Lichtgruppen. Lage im glTF-Raum des
  // Exports (x, z, −y), Richtung = lokale +X-Achse der Lampe (CryEngine-
  // Projektoren strahlen entlang +X). Der Index ist der des Lichtknotens im
  // Export (lg_…_lightgroup-NNN, nur für die erste Gruppe so benannt).
  const rot = (q, v) => {   // q = (w, x, y, z)
    const [w, x, y, z] = q, [vx, vy, vz] = v;
    const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
    return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
  };
  const toGltf = (v) => [v[0], v[2], -v[1]];
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const shaftLights = [];
  for (const g of ents.filter((e) => /LightGroup/i.test(e.cls) && e !== padGroup)) {
    const gp = num(g.at('Pos'));
    groupLights(g).forEach((l, index) => {
      const pos = toGltf(l.translation.map((v, i) => v + (gp[i] || 0)));
      if (Math.abs(pos[0]) > 36 || Math.abs(pos[2]) > 52 || pos[1] > -50.5 || pos[1] < -92) return;
      shaftLights.push({ group: g.name, index, ...l, pos: pos.map(r3), dir: toGltf(rot(l.rotation, [1, 0, 0])).map(r3) });
    });
  }
  // Animationsangaben der beiden .cga: Liste (.chrparams), Ereignisse
  // (.animevents, Zeit 0..1 der Animation), Kopf der .caf (Bilder/s, Bilder)
  const anims = {};
  for (const g of [geo(platform), geo(gate)].filter(Boolean)) {
    const base = g.replace(/\.cga$/i, '').split('/').pop();
    sb(['p4k', 'extract', '-o', RAW, '--regex', `(?i)[\\\\/](events[\\\\/])?${esc(base)}\\.(chrparams|animevents)$`]);
    // ist die Quelle frisch ausgepackt, die alte Wandlung weg (sonst kaemen alte Angaben mit)
    const conv = (f) => { const x2 = `${f}.xml`; if (existsSync(x2) && statSync(x2).mtimeMs < statSync(f).mtimeMs) rmSync(x2); if (!existsSync(x2)) spawnSync(STARBREAKER, ['cryxml', 'convert', f, x2]); return existsSync(x2) ? readFileSync(x2, 'utf8') : readFileSync(f, 'utf8'); };
    const chr = listFiles(RAW).find((f) => f.toLowerCase().endsWith(`/${base}.chrparams`));
    const ev = listFiles(RAW).find((f) => f.toLowerCase().endsWith(`/${base}.animevents`));
    const list = chr ? [...conv(chr).matchAll(/<Animation name="([^"$#][^"]*)" path="([^"]+)"/g)].map((m) => ({ name: m[1], caf: m[2] })) : [];
    for (const a of list) {
      sb(['p4k', 'extract', '-o', RAW, '--regex', `(?i)[\\\\/]${esc(a.caf)}$`]);
      const caf = listFiles(RAW).find((f) => f.toLowerCase().endsWith(`/${a.caf.toLowerCase()}`));
      if (caf) { const cb = readFileSync(caf); a.fps = cb.readUInt16LE(0x34); a.frames = cb.readUInt32LE(0x40); a.seconds = a.fps ? Math.round((a.frames / a.fps) * 100) / 100 : null; }
    }
    const events = ev ? [...conv(ev).matchAll(/<animation name="([^"]+)">([\s\S]*?)<\/animation>/g)].map((m) => ({
      caf: m[1].split('/').pop(),
      events: [...m[2].matchAll(/<event name="([^"]*)" time="([^"]*)"[^>]*parameter="([^"]*)"/g)].map((e) => ({ t: Number(e[2]), what: e[3] })),
    })) : [];
    anims[base] = { animations: list, events, doorAnimationSpeed: Number((platform?.body.match(/DoorAnimationSpeed="([^"]*)"/) || [])[1]) };
  }
  return {
    socpak: h.socpak,
    platform: platform && { name: platform.name, geometry: geo(platform), pos: num(platform.at('Pos')) },
    gate: gate && { name: gate.name, geometry: geo(gate), pos: num(gate.at('Pos')) },
    landingArea: landing && { pos: num(landing.at('Pos')), dimensions: ['x', 'y', 'z'].map((k) => Number(attr((landing.body.match(/<dimensions\b([^>]*)\/>/) || [])[1] || '', k))) },
    manager: manager && {
      platformInTransitLightState: attr(lg, 'platformInTransitLightState'), platformIdleOpenLightState: attr(lg, 'platformIdleOpenLightState'),
      platformObstructedLightState: attr(lg, 'platformObstructedLightState'),
    },
    sequences, padLightGroup: padGroup && { name: padGroup.name, helper: padGroup.at('AttachmentTarget'), parentOffsetPos: num(padGroup.at('ParentOffsetPos')) },
    padLights, shaftLights, anims,
  };
}

// ─── Werkhalle: Raum, Torblatt, Bühnen ───────────────────────────────────
// Das Torblatt (.cga) steht nur im Raumhafen. Dessen socpak-Export legt es
// als ein Mesh ab, ein Primitiv je Teilnetz der .cgam in deren Reihenfolge
// (Teilnetze mit verworfenem Material fehlen); welches Blatt ein Teilnetz
// trägt, sagt sein Netz-Knoten (obere 16 Bit, wie beim Schachttor). Je Blatt
// ein eigener Knoten tor_<blatt> im Raum der Garage, geschlossen; die
// Bewegung (Lage je Knochen über die Bilder der .caf) geht nach
// <key>.tor.json. Die Bühnen je als eigener Knoten, mittig über dem
// Ursprung, Oberkante y = 0, nach <key>-buehne.glb.
async function werkhalleCompose(h, file) {
  const { copyToDocument, getBounds } = await import('@gltf-transform/functions');
  const { readCaf } = await import('./lib/ivo-caf.mjs');
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const RAW = `${SRC}werkhalle-raw/`;
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const part = (socpak) => {
    const f = `${RAW}teile/${socpak.split('\\').pop().replace(/\.socpak$/i, '')}-lod${h.lod}.glb`;
    if (FORCE || !existsSync(f)) {
      mkdirSync(dirname(f), { recursive: true });
      sb(['socpak', 'export', socpak, f, '--materials', 'textures', '--mip', '1', '--lod', String(h.lod), '--no-lights']);
      console.log(`  + ${f.slice(SRC.length)}`);
    }
    return f;
  };
  const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
  const move = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];

  const room = await io.read(h.raw);
  const scene = room.getRoot().listScenes()[0];
  const t = h.tor;
  const src = await io.read(part(t.socpak));
  const re = new RegExp(`[\\\\/]${esc(t.cga)}\\.cga$`, 'i');
  const off = (n) => { const w = n.getWorldMatrix(); return Math.hypot(w[12] - t.garage[0], w[13] - t.garage[1], w[14] - t.garage[2]); };
  const door = src.getRoot().listNodes().filter((n) => n.getMesh() && re.test(n.getMesh().getName())).sort((a, b) => off(a) - off(b))[0];
  if (!door || off(door) > 2) throw new Error(`${t.cga}.cga steht nicht am Garagentor in ${t.socpak}`);
  const W = door.getWorldMatrix();

  // Knotenbaum und Teilnetze der .cga, Animationen
  sb(['p4k', 'extract', '-o', RAW, '--regex', `(?i)delta[\\\\/]int[\\\\/]garage[\\\\/]${esc(t.cga)}`]);
  const files = listFiles(RAW);
  const cga = files.find((f) => f.toLowerCase().endsWith(`/${t.cga}.cga`));
  const dump = spawnSync(STARBREAKER, ['nmc', 'dump', cga], { encoding: 'utf8', maxBuffer: 1 << 28 }).stdout || '';
  const nodes = [...dump.matchAll(/\[\s*(\d+)\] (\S+) parent=(\S+) geom=(\d+)[^\n]*\n\s*b2w\[0\] = \[([^\]]+)\]\n\s*b2w\[1\] = \[([^\]]+)\]\n\s*b2w\[2\] = \[([^\]]+)\]/g)].map((m) => ({
    index: Number(m[1]), name: m[2], parent: m[3] === 'root' ? null : Number(m[3]), t: [m[5], m[6], m[7]].map((r) => Number(r.split(',')[3])),
  }));
  if (!nodes.length) throw new Error('nmc dump: kein Knoten erkannt');
  const cgam = files.find((f) => f.toLowerCase().endsWith(`/${t.cga}${h.lod ? `_lod${h.lod}` : ''}.cgam`));
  const subs = readSubsetsNode(readFileSync(cgam));
  const blattOf = (i) => { for (let n = nodes.find((x) => x.index === i); n; n = nodes.find((x) => x.index === n.parent)) if (t.blatt[n.name]) return t.blatt[n.name]; return 'tor_rahmen'; };
  // Primitive den Teilnetzen zuordnen: gleiche Indexzahl, ausgelassene Teilnetze überspringen
  const prims = door.getMesh().listPrimitives();
  const owner = [];
  let s = 0;
  for (const p of prims) {
    const n = p.getIndices()?.getCount() ?? 0;
    while (s < subs.length && subs[s].tris * 3 !== n) s++;
    if (s >= subs.length) throw new Error(`Tor: Primitiv ${owner.length} (${n / 3} Dreiecke) passt zu keinem Teilnetz`);
    owner.push(blattOf(subs[s].node)); s++;
  }
  // Die Primitive teilen sich einen Vertex-Puffer (14 000 Ecken für das ganze
  // Tor): je Primitiv auf die benutzten Ecken verdichten
  const map = copyToDocument(room, src, [door.getMesh()]);
  const shared = map.get(door.getMesh());
  const copied = shared.listPrimitives().map((p) => compactPrimitive(room, p));
  const old = new Set(shared.listPrimitives().flatMap((p) => [p.getIndices(), ...p.listAttributes()]));
  for (const p of shared.listPrimitives()) p.dispose();
  for (const a of old) a?.dispose();
  shared.dispose();
  const M = mul(move(-t.garage[0], -t.garage[1], -t.garage[2]), W);
  const blaetter = {};
  for (const name of [...new Set(owner)]) {
    const mesh = room.createMesh(`${t.cga}_${name}`);
    copied.forEach((p, i) => { if (owner[i] === name) mesh.addPrimitive(p); });
    scene.addChild(room.createNode(name).setMesh(mesh).setMatrix(M));
    blaetter[name] = { prims: mesh.listPrimitives().length, tris: mesh.listPrimitives().reduce((a, p) => a + (p.getIndices()?.getCount() ?? 0) / 3, 0) };
  }
  // Spuren: Lage je Knochen (Elternraum, Container-Achsen Z oben) über die Bilder
  const cafs = {};
  for (const f of files.filter((x) => x.toLowerCase().endsWith('.caf'))) {
    const c = readCaf(readFileSync(f), nodes.map((n) => n.name));
    const tracks = {};
    for (const b of c.bones) if (b.name && b.pos?.times && b.pos?.values) tracks[b.name] = b.pos.times.map((tt, k) => [tt, ...b.pos.values[k].map((v) => Math.round(v * 10000) / 10000)]);
    cafs[f.split('/').pop().replace(/\.caf$/i, '')] = { fps: c.fps, frames: c.frames, tracks };
  }
  const scale = Math.hypot(W[0], W[1], W[2]);
  writeFileSync(`${SRC}werkhalle/${h.key}.tor.json`, JSON.stringify({ cga: t.cga, container: t.socpak, garage: t.garage, lod: h.lod, scale: Math.round(scale * 1000) / 1000, nodes, subsets: subs, owner, blaetter, blattOf: t.blatt, cafs }, null, 1));
  await room.transform(unpartition());
  await io.write(file, room);
  console.log(`  Tor: ${t.cga} aus ${t.socpak} (Abstand ${off(door).toFixed(2)} m, Maßstab ${scale.toFixed(3)}), ${Object.entries(blaetter).map(([k, v]) => `${k} ${v.tris}`).join(', ')}; Spuren ${Object.keys(cafs).join(', ')}`);

  // Bühnen
  const bdoc = new Document();
  bdoc.createBuffer();
  const bscene = bdoc.createScene();
  const report = [];
  for (const b of h.buehnen) {
    const s2 = await io.read(part(b.socpak));
    const n = s2.getRoot().listNodes().find((x) => x.getMesh() && b.mesh.test(x.getMesh().getName()));
    if (!n) { console.error(`  ! ${b.node}: ${b.mesh} steht nicht in ${b.socpak}`); continue; }
    const bb = getBounds(n);
    const c = [(bb.min[0] + bb.max[0]) / 2, bb.max[1], (bb.min[2] + bb.max[2]) / 2];
    const m2 = copyToDocument(bdoc, s2, [n.getMesh()]);
    bscene.addChild(bdoc.createNode(b.node).setMesh(m2.get(n.getMesh())).setMatrix(mul(move(-c[0], -c[1], -c[2]), n.getWorldMatrix())));
    report.push(`${b.node} ${(bb.max[0] - bb.min[0]).toFixed(2)} x ${(bb.max[2] - bb.min[2]).toFixed(2)} x ${(bb.max[1] - bb.min[1]).toFixed(2)} m`);
  }
  await bdoc.transform(unpartition());
  await io.write(`${SRC}werkhalle/${h.key}-buehne.glb`, bdoc);
  console.log(`  Bühnen: ${report.join('; ')}`);
}

function compactPrimitive(doc, sp) {
  const buf = doc.getRoot().listBuffers()[0];
  const ix = sp.getIndices().getArray();
  const neu = new Map(), alt = [];
  const idx = new Uint32Array(ix.length);
  for (let i = 0; i < ix.length; i++) { let v = neu.get(ix[i]); if (v === undefined) { v = alt.length; neu.set(ix[i], v); alt.push(ix[i]); } idx[i] = v; }
  const p = doc.createPrimitive().setMaterial(sp.getMaterial()).setExtras(sp.getExtras());
  for (const sem of sp.listSemantics()) {
    const a = sp.getAttribute(sem), e = a.getElementSize(), arr = a.getArray(), out = new arr.constructor(alt.length * e);
    for (let i = 0; i < alt.length; i++) for (let k = 0; k < e; k++) out[i * e + k] = arr[alt[i] * e + k];
    p.setAttribute(sem, doc.createAccessor().setType(a.getType()).setNormalized(a.getNormalized()).setArray(out).setBuffer(buf));
  }
  return p.setIndices(doc.createAccessor().setType('SCALAR').setArray(idx).setBuffer(buf));
}

// Teilnetze einer .cgam mit Netz-Knoten: [Material, Knoten, Dreiecke]
function readSubsetsNode(buf) {
  const i32 = (o) => buf.readInt32LE(o);
  let best = null;
  for (let o = 0; o + 48 <= buf.length; o += 4) {
    if (i32(o + 4) !== 0 || i32(o + 12) !== 0 || i32(o + 16) !== 0) continue;
    const rows = []; let at = o, next = 0;
    while (at + 48 <= buf.length && i32(at + 4) === next && i32(at + 8) > 0 && i32(at + 8) % 3 === 0) { rows.push({ mat: buf.readUInt16LE(at), node: buf.readUInt16LE(at + 2), tris: i32(at + 8) / 3 }); next += i32(at + 8); at += 48; }
    if (rows.length && (!best || rows.length > best.length)) best = rows;
  }
  return best || [];
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

// ─── Schiffs-Materialien, die der Export nicht auflöst ───────────────────
// Sitze, Konsolen, Triebwerke, Fahrwerk und Teile des Innenraums nennen im
// DataCore kein Material (zerlegte Szene: material_path „Data/“,
// material_sidecar null). Das Spiel nimmt dann das .mtl der Geometrie selbst,
// StarBreaker lässt die Primitive ohne Material. Quelle je Mesh: die
// Geometrie (.cga/.cgf/.skin) der Szene, die ein Vorfahrenknoten trägt
// (Anbauteile: Knoten heißt wie die Datei oder wie die Entity) oder die der
// Mesh-Name nennt (Innenraum: Pfad oder Dateiname), sonst eine andere
// Geometrie in deren Ordner. Alle Primitive eines Meshes teilen den
// Vertex-Puffer der Datei, beim .skin auch die je Knochen zerlegten Meshes;
// welches Teilnetz ein Primitiv ist, sagt sein Eckenbereich (first_vertex,
// num_vertices der Teilnetz-Tabelle), nicht die Reihenfolge. Je Mesh-Name
// die Zuordnung mit den Dreieckszahlen ihrer Primitive (tris); trägt derselbe
// Name verschiedene Netze, stehen mehrere Einträge da.
function shipMaterialFix(doc, scene) {
  const RAW = `${SRC}ships-raw/`;
  const root = doc.getRoot();
  const users = new Map();
  for (const n of root.listNodes()) if (n.getMesh()) users.set(n.getMesh(), [...(users.get(n.getMesh()) || []), n]);
  const isBare = (p) => !p.getMaterial()?.getName();
  const trisOf = (p) => (p.getIndices()?.getCount() ?? 0) / 3;
  const bare = [...users.keys()].filter((m) => m.listPrimitives().some(isBare));
  if (!bare.length) return null;
  const bareTris = (m) => m.listPrimitives().filter(isBare).reduce((a, p) => a + trisOf(p), 0) * users.get(m).length;
  const stem = (p) => p.replace(/\\/g, '/').split('/').pop().replace(/\.\w+$/, '').toLowerCase();
  const geo = new Map();
  // Fahrwerk: der Knoten heißt wie die .skin ohne „_SKIN“ (300I_LandingGear_Front)
  const addGeo = (p) => {
    if (!p || !/\.(cga|cgf|skin)$/i.test(p)) return;
    const rel = p.replace(/\\/g, '/').replace(/^data\//i, '');
    for (const k of [stem(p), stem(p).replace(/_skin$/, '')]) if (!geo.has(k)) geo.set(k, rel);
  };
  addGeo(scene?.root_entity?.geometry_path);
  for (const c of scene?.children ?? []) addGeo(c.geometry_path);
  for (const it of scene?.interiors ?? []) for (const pl of it.placements ?? []) addGeo(pl.cgf_path);
  // ohne Dateiknoten hängt das Netz am Knoten der Entity (M50: ORIG_M50_Thruster_Main)
  const entity = new Map();
  for (const c of scene?.children ?? []) if (c.entity_name && c.geometry_path) {
    const k = c.entity_name.toLowerCase();
    entity.set(k, [...(entity.get(k) || []), c.geometry_path.replace(/\\/g, '/').replace(/^data\//i, '')]);
  }
  const candidates = new Map();
  for (const m of bare) {
    const c = [];
    const name = m.getName();
    if (/\.(cga|cgf|skin)$/i.test(name) && name.includes('/')) c.push(name.replace(/^data\//i, ''));
    if (geo.has(stem(name))) c.push(geo.get(stem(name)));
    for (const n of users.get(m)) for (let p = n; p; p = p.getParentNode()) {
      const k = p.getName().toLowerCase();
      if (p !== n && geo.has(k)) c.push(geo.get(k));
      c.push(...(entity.get(k) || []));
    }
    candidates.set(m, [...new Set(c)]);
  }
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = (p) => p.replace(/\.\w+$/, '').split('/').map(esc).join('[\\\\/]');
  const all = [...new Set([...candidates.values()].flat())];
  if (all.length) sb(['p4k', 'extract', '-o', RAW, '--regex', `(?i)(${all.map(rx).join('|')})(_lod1)?\\.(cga|cgf|skin)m?$`]);
  const files = listFiles(RAW);
  const find = (rel) => files.find((f) => f.toLowerCase().endsWith(`/${rel.toLowerCase()}`));
  // Material der Geometrie: erster Pfad unter Objects/ oder Materials/ (mit
  // oder ohne Data/ und .mtl), der keine Geometrie oder Textur ist; ein
  // bloßer Name (StorAll: „BigBox.mtl“) liegt im Ordner der Geometrie
  const mtlOf = (rel) => {
    const f = find(rel);
    if (!f) return null;
    const text = readFileSync(f, 'latin1');
    const s = [...text.matchAll(/(?:data\/)?(?:objects|materials)\/[\x20-\x7e]{1,240}?(?=\0)/gi)].map((x) => x[0])
      .find((x) => !/\.(cga|cgf|skin|chr|cdf|dds|tif|caf|anm)$/i.test(x));
    if (s) return s.replace(/^data\//i, '').replace(/\.mtl$/i, '');
    const own = text.match(/([\w-]+)\.mtl(?=\0)/i)?.[1];
    return own ? `${rel.replace(/[^/]+$/, '')}${own}` : null;
  };
  const rangeOf = (p) => { let lo = Infinity, hi = -1; for (const v of p.getIndices()?.getArray() ?? []) { if (v < lo) lo = v; if (v > hi) hi = v; } return [lo, hi]; };
  // Teilnetz je Primitiv. Der Puffer kann mehrere Dateien hintereinander
  // tragen (.cdf: Düse und Gehäuse des Haupttriebwerks): Versatz 0, sonst der,
  // bei dem das erste Primitiv ohne Material am Anfang eines Teilnetzes steht.
  // Ein Primitiv einer .cga/.cgf deckt sein Teilnetz genau; die je Knochen
  // zerlegten Primitive einer .skin liegen nur darin.
  const fit = (prims, rows, n, skin) => {
    const total = Math.max(...rows.map((r) => r.fv + r.nv));
    const lo0 = rangeOf(prims.find(isBare))[0];
    const fits = (lo, hi, a, b) => (skin ? lo >= a && hi < b : lo === a && hi === b - 1);
    for (const o of new Set([0, ...rows.map((r) => lo0 - r.fv)])) {
      if (o < 0 || o + total > n || (o > 0 && total === n)) continue;
      const ids = prims.map((p) => { const [lo, hi] = rangeOf(p); return rows.find((r) => fits(lo, hi, o + r.fv, o + r.fv + r.nv))?.mat ?? null; });
      if (prims.every((p, i) => !isBare(p) || ids[i] != null)) return { ids, offset: o };
    }
    return null;
  };
  const meshes = {}, missing = [], mtlPaths = new Map(), hits = new Map();
  let bareBefore = 0, bareAfter = 0;
  for (const m of bare) {
    const prims = m.listPrimitives(), tb = bareTris(m);
    bareBefore += tb;
    const pos = prims[0].getAttribute('POSITION');
    let hit = null, why = candidates.get(m).length ? 'keine Teilnetz-Tabelle passt zum Vertex-Puffer' : 'keine Geometrie in der Szene';
    const tryFiles = (list) => {
      for (const rel of list) {
        const mtl = mtlOf(rel);
        for (const lod of ['_lod1', '']) {
          const f = find(rel.replace(/\.(\w+)$/, `${lod}.$1m`));
          const rows = f && readSubsets(readFileSync(f));
          const r = rows && fit(prims, rows, pos.getCount(), /\.skin$/i.test(rel));
          if (!r) continue;
          if (!mtl) { why = `${rel}: kein .mtl in der Geometrie`; continue; }
          hit = { mtl: mtl.split('/').pop(), ids: r.ids, tris: prims.map(trisOf), geometry: rel, lod: lod ? 1 : 0, ...(r.offset ? { offset: r.offset } : {}) };
          mtlPaths.set(hit.mtl, mtl);
          return;
        }
      }
    };
    if (!prims.every((p) => p.getAttribute('POSITION') === pos)) why = 'Primitive ohne gemeinsamen Vertex-Puffer';
    else {
      tryFiles(candidates.get(m));
      // sonst die übrigen Geometrien im Ordner der Kandidaten (Gehäuse einer .cdf)
      if (!hit && candidates.get(m).length) {
        const dirs = [...new Set(candidates.get(m).map((c) => c.replace(/[^/]+$/, '').toLowerCase()))];
        sb(['p4k', 'extract', '-o', RAW, '--regex', `(?i)(${dirs.map((d) => d.split('/').map(esc).join('[\\\\/]')).join('|')})[^\\\\/]+\\.(cga|cgf|skin)m?$`]);
        files.splice(0, files.length, ...listFiles(RAW));
        const near = files.map((f) => f.slice(f.toLowerCase().indexOf('/data/') + 6))
          .filter((rel) => /\.(cga|cgf|skin)$/i.test(rel) && !/_lod\d\.\w+$/i.test(rel) && dirs.includes(rel.replace(/[^/]+$/, '').toLowerCase()) && !candidates.get(m).includes(rel));
        tryFiles(near);
      }
    }
    if (!hit) { missing.push({ mesh: m.getName(), tris: tb, why }); bareAfter += tb; continue; }
    hits.set(m, hit);
    const list = meshes[m.getName()] || (meshes[m.getName()] = []);
    if (!list.some((e) => JSON.stringify([e.mtl, e.ids, e.tris]) === JSON.stringify([hit.mtl, hit.ids, hit.tris]))) list.push(hit);
  }
  // .mtl lesen (CryXmlB -> XML), über den vollen Pfad
  const mtls = {};
  if (mtlPaths.size) sb(['p4k', 'extract', '-o', RAW, '--regex', `(?i)(${[...mtlPaths.values()].map(rx).join('|')})\\.mtl$`]);
  for (const [base, rel] of mtlPaths) {
    const f = listFiles(RAW).find((x) => x.toLowerCase().endsWith(`/${rel.toLowerCase()}.mtl`));
    if (!f) continue;
    const xml = `${f}.xml`;
    if (FORCE || !existsSync(xml)) spawnSync(STARBREAKER, ['cryxml', 'convert', f, xml]);
    if (existsSync(xml)) mtls[base] = parseSubMaterials(readFileSync(xml, 'utf8'));
  }
  // benutzte Untermaterialien; neu sind die, die der Export nicht schon als
  // <mtl>_mtl_<name>_<index> trägt (die nimmt der Build, samt Karten)
  const have = new Set(root.listMaterials().map((x) => x.getName().toLowerCase()));
  const used = new Map(), lost = new Map();
  for (const [mesh, e] of hits) mesh.listPrimitives().forEach((p, i) => {
    if (!isBare(p)) return;
    const sub = mtls[e.mtl]?.[e.ids[i]], t = trisOf(p) * users.get(mesh).length;
    if (sub?.name) { used.set(`${e.mtl}|${e.ids[i]}`, sub); return; }
    bareAfter += t;
    if (mtls[e.mtl]) missing.push({ mesh: mesh.getName(), tris: t, why: `${e.mtl}.mtl hat kein Untermaterial ${e.ids[i]} (nur ${mtls[e.mtl].length})` });
    else lost.set(e.mtl, (lost.get(e.mtl) || 0) + t);
  });
  const nodraw = [...used.values()].filter((s) => /nodraw/i.test(s.shader || '')).length;
  const fresh = [...used].filter(([k, s]) => {
    const [base, id] = k.split('|');
    return !/nodraw/i.test(s.shader || '') && ![...have].some((h) => h.startsWith(`${base}_mtl_${s.name}_`.toLowerCase()) && Number(h.slice(`${base}_mtl_${s.name}_`.length)) === Number(id));
  }).map(([, s]) => s);
  for (const [base, rel] of mtlPaths) if (!mtls[base]) missing.push({ mesh: `Meshes mit ${base}`, tris: lost.get(base) || 0, why: `${rel}.mtl steht nicht in der Data.p4k` });
  return { meshes, mtls, fresh, report: { bareBefore, bareAfter, meshes: bare.length, subs: used.size, nodraw, missing } };
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
    // Folgezeilen: nur first_index-Anschluss prüfen (Spalte 5 ist bei großen
    // Submeshes nicht 0)
    while (at + 48 <= buf.length && i32(at + 4) === next && i32(at + 8) > 0 && i32(at + 8) % 3 === 0) {
      rows.push({ mat: buf.readUInt16LE(at), num: i32(at + 8), fv: i32(at + 12), nv: i32(at + 20) });
      next += i32(at + 8);
      at += 48;
    }
    if (rows.length && (!best || rows.length > best.length)) best = rows;
  }
  return best;
}

// ─── Schacht-Beiwerk (.planning/notes/hangar-schacht-tiefe.md) ──────────
// Brush-Sätze (Typ 1, 208 Byte) im IncludedObjects-Chunk: u16 bei +60 =
// Index in die cgf-Tabelle (256-Byte-Pfade, erste Tabelle des Chunks), u16
// bei +170 = Material-Überschreibung (Index in die Materialtabelle, 0xffff =
// das Material der .cgf). Gibt je cgf (Dateiname ohne Endung) das häufigste
// überschriebene Material zurück.
function socBrushMaterials(b) {
  const cnt = b.readUInt32LE(8), tab = b.readUInt32LE(12);
  let c0 = 0, c1 = 0;
  for (let i = 0; i < cnt; i++) { const o = tab + i * 16; if (b.readUInt32LE(o) === 0x10010) { c0 = b.readUInt32LE(o + 12); c1 = c0 + b.readUInt32LE(o + 8); } }
  if (!c0) return new Map();
  const name = (o) => b.toString('latin1', o, o + 256).split('\0')[0];
  const isName = (t) => /^[\x20-\x7e]{4,}$/.test(t);
  const geo = /\.(cgf|cga|cdf|chr|skin)$/i;
  let cg0 = 0;
  for (let o = c0; o < c1; o += 4) if (geo.test(name(o)) && !isName(name(o - 256))) { cg0 = o; break; }
  const cgfs = []; for (let o = cg0; cg0 && isName(name(o)); o += 256) cgfs.push(name(o));
  const { materials } = socDecals(b);
  const votes = new Map();
  for (let o = c0; o < c1 - 208; o += 4) {
    if (b.readUInt32LE(o) !== 1) continue;
    const box = [0, 1, 2, 3, 4, 5].map((k) => b.readDoubleLE(o + 4 + k * 8));
    if (!(box[0] < box[3] && box[1] < box[4] && box[2] <= box[5]) || box.some((v) => !Number.isFinite(v) || Math.abs(v) > 1e7)) continue;
    const cgf = cgfs[b.readUInt16LE(o + 60)], mi = b.readUInt16LE(o + 170);
    if (!cgf || mi === 0xffff || !materials[mi]) continue;
    const key = cgf.split('/').pop().replace(geo, '').toLowerCase();
    const v = votes.get(key) || new Map(); v.set(materials[mi], (v.get(materials[mi]) || 0) + 1); votes.set(key, v);
  }
  return new Map([...votes].map(([k, v]) => [k, [...v].sort((a, c) => c[1] - a[1])[0][0]]));
}

// Beiwerk im Schacht: Meshes mit Decal-Material (Leitlinien, Chevrons, Pfeile,
// Nummern, Lichtrahmen) kommen aus dem socpak-Export ohne Primitive — der
// Export lässt Decal-Material weg, die Knoten mit ihrer Lage bleiben. Je
// cgf: Geometrie per skin export (Modellraum Z oben, wie die Mesh-Daten im
// socpak-Export), Untermaterial-IDs aus der .cgfm, Material = Überschreibung
// aus dem Brush-Satz, sonst das der .cgf; Untermaterialien samt Karten aus
// der .mtl. Dazu die Decal-Objekte (Typ 0x10) im Schacht.
// Bereich im Exportraum: der Schacht (innen x ±28, z ±44, y −86 … −50) und
// der Hallenboden an seiner Kante bis 14 m (Leitlinien, Chevrons, Spuren
// am Rand, die man beim Blick hinunter sieht): |x| ≤ 42, |z| ≤ 58, y −87 … −49,4.
function liftDeco(h, doc) {
  const RAW = `${SRC}lift-raw/`, OUTD = `${SRC}lift/deco/`;
  mkdirSync(OUTD, { recursive: true });
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pak = listFiles(RAW).find((f) => f.toLowerCase().endsWith(`/${h.socpak.toLowerCase()}`));
  const zip = readZip(readFileSync(pak));
  const soc = zip.get([...zip.keys()].find((k) => k.toLowerCase().endsWith('.soc')))();
  const override = socBrushMaterials(soc);
  const inShaft = (p) => Math.abs(p[0]) <= 42 && Math.abs(p[2]) <= 58 && p[1] >= -87 && p[1] <= -49.4;
  const found = new Map();
  for (const n of doc.getRoot().listNodes()) {
    // Decal-Meshes (ohne Primitive) und die Leuchtengehäuse der Bodenstrahler
    const m = n.getMesh(); if (!m || (m.listPrimitives().length && !/light_fluorescent/i.test(m.getName()))) continue;
    const w = n.getWorldMatrix();
    if (!inShaft([w[12], w[13], w[14]])) continue;
    const base = m.getName().replace(/.*[\\/]/, '').replace(/\.(cgf|cga)$/i, '');
    if (!found.has(base)) found.set(base, []);
    found.get(base).push(w.map((v) => Math.round(v * 1e5) / 1e5));
  }
  const bases = [...found.keys()];
  if (bases.length) sb(['p4k', 'extract', '-o', RAW, '--regex', `(?i)[\\\\/](${bases.map(esc).join('|')})\\.cgfm?$`]);
  const files = listFiles(RAW);
  const deco = [];
  const mtlNeeded = new Set();
  for (const base of bases) {
    const cgf = files.find((f) => f.toLowerCase().endsWith(`/${base.toLowerCase()}.cgf`));
    const cgfm = files.find((f) => f.toLowerCase().endsWith(`/${base.toLowerCase()}.cgfm`));
    if (!cgf || !cgfm) { deco.push({ cgf: base, missing: true, instances: found.get(base) }); continue; }
    const own = (readFileSync(cgf, 'latin1').match(/(?:Data\/)?objects\/[\w/]+(?=\0)/gi) || [])[0]?.replace(/^Data\//i, '') || null;
    const mtl = override.get(base.toLowerCase()) || own;
    const glb = `${OUTD}${base}.glb`;
    // Teilstring-Suche: mit Pfadtrenner davor, sonst träfe primary_… auch secondary_…
    if (FORCE || !existsSync(glb)) { try { sb(['skin', 'export', `\\${base}.cgf`, glb]); } catch (e) { deco.push({ cgf: base, missing: e.message, instances: found.get(base) }); continue; } }
    const subs = readSubsets(readFileSync(cgfm)) || [];
    if (mtl) mtlNeeded.add(mtl.split('/').pop());
    deco.push({ cgf: base, mtl, own, glb: `lift/deco/${base}.glb`, ids: subs.map((s) => s.mat), instances: found.get(base) });
  }
  // Untermaterialien der beteiligten .mtl
  const mtls = {};
  if (mtlNeeded.size) {
    sb(['p4k', 'extract', '-o', RAW, '--regex', `(?i)[\\\\/](${[...mtlNeeded].map(esc).join('|')})\\.mtl$`]);
    for (const f of listFiles(RAW).filter((x) => x.toLowerCase().endsWith('.mtl'))) {
      const b = f.split('/').pop().replace(/\.mtl$/i, '');
      if (!mtlNeeded.has(b) || mtls[b]) continue;
      const xml = `${f}.xml`;
      if (!existsSync(xml)) spawnSync(STARBREAKER, ['cryxml', 'convert', f, xml]);
      if (existsSync(xml)) mtls[b] = parseSubMaterials(readFileSync(xml, 'utf8'));
    }
  }
  for (const d of deco) if (d.mtl) d.subs = (d.ids || []).map((id) => ({ id, ...(mtls[d.mtl.split('/').pop()]?.[id] || { missing: true }) }));
  // Decal-Objekte im Schacht (Container-Raum = Exportraum vor Z-oben-Drehung)
  const { decals } = socDecals(soc);
  const shaftDecals = decals.filter((d) => inShaft([d.pos[0], d.pos[2], -d.pos[1]]));
  return { deco, decals: shaftDecals, overrides: Object.fromEntries([...override].filter(([k]) => found.has(k))) };
}

// ─── Werkstatt: Landefläche, Decals, Decal-Materialien ──────────────────
// Decals stehen in der .soc nicht als Entity, sondern als eigener Objekttyp
// im IncludedObjects-Chunk (Chunktyp 0x10010; StarBreaker überspringt ihn,
// Protokoll „skipping Type10“). Ein Satz ist 132 Byte:
//   u32 0x10 | 6 double Weltbox | u32 0 | u32 | u32 | 4 double Drehung
//   (x, y, z, w) | 3 double Lage (Container-Raum, Z oben) | double Halbmaß |
//   u32 (untere 16 Bit = Index in die Materialtabelle des Chunks)
// Die Materialtabelle steht im selben Chunk: 256-Byte-Einträge mit Pfad. Ein
// Decal ist ein Würfel mit Halbmaß s (die Weltbox ist 2 s weit): Fläche
// 2 s × 2 s, projiziert entlang seiner lokalen Z. Boden-Decals haben eine
// Drehung nur um Z.
function socDecals(b) {
  const cnt = b.readUInt32LE(8), tab = b.readUInt32LE(12);
  let c0 = 0, c1 = 0;
  for (let i = 0; i < cnt; i++) { const o = tab + i * 16; if (b.readUInt32LE(o) === 0x10010) { c0 = b.readUInt32LE(o + 12); c1 = c0 + b.readUInt32LE(o + 8); } }
  const mt = [];
  if (!c0) return { materials: mt, decals: [] };
  const name = (o) => b.toString('latin1', o, o + 256).split('\0')[0];
  const isName = (t) => /^[\x20-\x7e]{4,}$/.test(t);
  const geo = /\.(cgf|cga|cdf|chr|skin)$/i;
  for (let o = c0; o < c1 - 256; o += 4) {
    const t = name(o);
    if (isName(t) && !geo.test(t) && /^(materials|objects)\//i.test(t) && !(isName(name(o - 256)) && !geo.test(name(o - 256)))
      && isName(name(o + 256)) && !geo.test(name(o + 256))) {
      for (let p = o; isName(name(p)); p += 256) mt.push(name(p));
      break;
    }
  }
  const decals = [];
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  for (let o = c0; o < c1 - 132; o += 4) {
    if (b.readUInt32LE(o) !== 0x10) continue;
    const box = [0, 1, 2, 3, 4, 5].map((k) => b.readDoubleLE(o + 4 + k * 8));
    if (!(box[0] < box[3] && box[1] < box[4] && box[2] < box[5]) || box.some((v) => !Number.isFinite(v) || Math.abs(v) > 1e7)) continue;
    const q = [0, 1, 2, 3].map((k) => b.readDoubleLE(o + 64 + k * 8));
    if (Math.abs(Math.hypot(...q) - 1) > 1e-3) continue;
    const pos = [0, 1, 2].map((k) => b.readDoubleLE(o + 96 + k * 8));
    const half = b.readDoubleLE(o + 120);
    const m = b.readUInt32LE(o + 128) & 0xffff;
    decals.push({ material: mt[m] ?? null, q: q.map(r4), pos: pos.map(r4), half: r4(half), floor: Math.abs(q[0]) < 0.02 && Math.abs(q[1]) < 0.02 });
  }
  return { materials: mt, decals };
}

// Decal-Materialien (.mtl unter Materials/Decals): Farbe TexSlot1 (mit
// Alpha), Normalen/Glätte TexSlot2, Kopfwerte und PublicParams wörtlich
function readDecalMaterials(used, RAW) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const attr = (s, k) => (s.match(new RegExp(`\\b${k}="([^"]*)"`)) || [])[1];
  if (!used.length) return {};
  sb(['p4k', 'extract', '-o', RAW, '--regex', `(?i)[\\\\/](${used.map((u) => esc(u.split('/').pop())).join('|')})\\.mtl$`]);
  const files = listFiles(RAW);
  const decalMaterials = {};
  for (const u of used) {
    const f = files.find((x) => x.toLowerCase().replace(/\\/g, '/').endsWith(`/${u.toLowerCase()}.mtl`));
    if (!f) { decalMaterials[u] = { missing: true }; continue; }
    let x = readFileSync(f, 'latin1');
    if (x.startsWith('CryXmlB')) { spawnSync(STARBREAKER, ['cryxml', 'convert', f, `${f}.xml`]); x = readFileSync(`${f}.xml`, 'utf8'); }
    const head = x.slice(0, x.indexOf('>'));
    const tex = (slot) => (x.match(new RegExp(`Map="${slot}"[^>]*File="([^"]*)"`)) || [])[1];
    const pp = (x.match(/<PublicParams\b([^>]*)\/>/) || [])[1] || '';
    decalMaterials[u] = {
      shader: attr(head, 'Shader'), genMask: attr(head, 'StringGenMask'), diffuse: attr(head, 'Diffuse'), specular: attr(head, 'Specular'),
      opacity: attr(head, 'Opacity'), shininess: attr(head, 'Shininess'), surface: attr(head, 'SurfaceType'),
      d: tex('TexSlot1'), n: tex('TexSlot2'),
      // %OPACITY_MAP: Deckkraft aus TexSlot12 (Maske, ungekachelt); Farbe mit TexMod
      maskTex: tex('TexSlot12'),
      tileD: (() => { const t = x.match(/<Texture\b[^>]*Map="TexSlot1"[^>]*?(?<!\/)>([\s\S]*?)<\/Texture>/)?.[1] || ''; const u = Number(t.match(/TileU="([^"]*)"/)?.[1] || 1), v = Number(t.match(/TileV="([^"]*)"/)?.[1] || 1); return u !== 1 || v !== 1 ? [u, v] : null; })(),
      params: Object.fromEntries([...pp.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]])),
    };
  }
  return decalMaterials;
}

function werkstattInfo(h) {
  const RAW = `${SRC}werkstatt-raw/`;
  mkdirSync(RAW, { recursive: true });
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  sb(['p4k', 'extract', '-o', RAW, '--regex', `(?i)[\\\\/]${esc(h.socpak)}$`]);
  const pak = listFiles(RAW).find((f) => f.toLowerCase().replace(/\\/g, '/').endsWith(`/${h.socpak.toLowerCase().replace(/\\/g, '/')}`));
  const zip = readZip(readFileSync(pak));
  const soc = zip.get([...zip.keys()].find((k) => k.toLowerCase().endsWith('.soc')))();
  const xml = socEntitiesXml(soc, `${RAW}${h.key}`);
  const la = (xml.match(/<Entity\b[^>]*EntityClass="LandingArea"[^>]*>[\s\S]*?<\/Entity>/) || [])[0] || '';
  const attr = (s, k) => (s.match(new RegExp(`\\b${k}="([^"]*)"`)) || [])[1];
  const { materials, decals } = socDecals(soc);
  // Decal-Materialien (.mtl unter Materials/Decals): Farbe TexSlot1 (mit
  // Alpha), Normalen/Glätte TexSlot2, Kopfwerte und PublicParams wörtlich
  const used = [...new Set([...decals.map((d) => d.material), ...WERK_EXTRA_DECALS.map((e) => e.material)].filter(Boolean))];
  const decalMaterials = readDecalMaterials(used, RAW);
  return {
    socpak: h.socpak,
    landingArea: la && {
      pos: String(attr(la, 'Pos') || '0,0,0').split(',').map(Number), rotate: attr(la, 'Rotate') || null,
      dimensions: ['x', 'y', 'z'].map((k) => Number(attr((la.match(/<dimensions\b([^>]*)\/>/) || [])[1] || '', k))),
    },
    materialTable: materials.length, decals, decalMaterials, extraDecals: WERK_EXTRA_DECALS,
  };
}

// ─── Schichtmaterialien (HardSurface / LayerBlend) ─────────────────────
// Bausatzteile wie die Schachtwände tragen keine eigenen Karten: Ihr Material
// nennt Schichten (extras.layers, je eine .mtl unter Materials/PU/layer/ mit
// Tönung). Die erste Schicht (Primary) bestimmt das Bild: Farbe TexSlot1,
// Normalen/Glätte TexSlot2, Kachelung LayerTiling. Diese .mtl werden hier
// gelesen; der Build hängt ihre Karten an und tönt sie (Grundfarbe = Tönung).
function docLayerPaths(doc) {
  const want = new Set();
  for (const m of doc.getRoot().listMaterials()) {
    const x = m.getExtras() || {};
    // alle Schichten (Primary, Wear, …): der Build nimmt die erste, die JSON nennt alle
    if (!x.diffuse_tex) for (const l of x.layers || []) if (l?.path) want.add(l.path.replace(/\\/g, '/'));
  }
  return want;
}

function layerMaterials(want) {
  const RAW = `${SRC}layer-raw/`;
  mkdirSync(RAW, { recursive: true });
  if (!want.size) return {};
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  sb(['p4k', 'extract', '-o', RAW, '--regex', `(?i)[\\\\/](${[...want].map((w) => esc(w.split('/').pop())).join('|')})$`]);
  const files = listFiles(RAW);
  const out = {};
  for (const w of want) {
    const f = files.find((x) => x.toLowerCase().endsWith('/' + w.toLowerCase()));
    if (!f) { out[w] = { missing: true }; continue; }
    let xml = readFileSync(f, 'latin1');
    if (xml.startsWith('CryXmlB')) { spawnSync(STARBREAKER, ['cryxml', 'convert', f, `${f}.xml`]); xml = readFileSync(`${f}.xml`, 'utf8'); }
    const head = xml.slice(0, xml.indexOf('>'));
    const attr = (src, k) => (src.match(new RegExp(`\\b${k}="([^"]*)"`)) || [])[1];
    const tex = (slot) => (xml.match(new RegExp(`Map="${slot}"[^>]*File="([^"]*)"`)) || [])[1];
    const pp = (xml.match(/<PublicParams\b([^>]*)\/>/) || [])[1] || '';
    out[w] = {
      shader: attr(head, 'Shader'), d: tex('TexSlot1'), n: tex('TexSlot2'), detail: tex('TexSlot7'),
      tiling: Number(attr(pp, 'LayerTiling') || 1), diffuse: attr(head, 'Diffuse'), specular: attr(head, 'Specular'), shininess: Number(attr(head, 'Shininess') || 0),
    };
  }
  return out;
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
    // Schichten (HardSurface/LayerBlend): je <Layer> die Schicht-.mtl und ihre Tönung
    const layers = [...((block.match(/<MatLayers>([\s\S]*?)<\/MatLayers>/i) || [])[1] || '').matchAll(/<Layer\b([^>]*)>/gi)].map((l) => {
      const la = (k) => (l[1].match(new RegExp(`\\b${k}="([^"]*)"`, 'i')) || [])[1];
      return { path: la('Path')?.replace(/\\/g, '/'), tint_color: la('TintColor')?.split(',').map(Number), name: la('Name') };
    }).filter((l) => l.path);
    out.push({
      name: attr('Name'), shader: attr('Shader'), diffuse: attr('Diffuse'), specular: attr('Specular'),
      shininess: attr('Shininess'), opacity: attr('Opacity'),
      d: tex('TexSlot1'), n: tex('TexSlot2'), s: tex('TexSlot4'), td: tile('TexSlot1'), tn: tile('TexSlot2'),
      blend,
      // %VERTCOLORS: das Spiel dunkelt die Fläche mit COLOR_0 ab (Build behält es)
      vc: /VERTCOLORS/i.test(attr('StringGenMask') || ''),
      // Schiffe: Decals blenden, Glow leuchtet (wie die Materialien des Exports)
      decal: /%DECAL(?![A-Z_])/i.test(attr('StringGenMask') || '') || undefined,
      glow: Number(attr('Glow')) || undefined,
      ...(layers.length ? { layers } : {}),
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
