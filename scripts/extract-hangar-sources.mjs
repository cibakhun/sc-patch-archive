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

// Schiffe mit Werkslack. Slug = vehicles.json-id; die Entity heißt wie der
// Slug mit Unterstrichen (aegs-gladius -> AEGS_Gladius, Teilstring-Suche).
const SHIPS = [
  'aegs-gladius', 'anvl-arrow', 'anvl-hornet-f7c-mk2', 'aegs-avenger-titan', 'rsi-aurora-mk2',
  'drak-cutlass-black', 'misc-freelancer', 'orig-300i', 'crus-starlifter-c2', 'rsi-constellation-andromeda',
  'drak-corsair', 'rsi-zeus-es', 'misc-prospector', 'aegs-sabre', 'crus-intrepid', 'drak-vulture',
  'anvl-c8x-pisces-expedition', 'orig-400i', 'anvl-carrack', 'rsi-polaris',
];
// Innenraum nur bei Jägern, deren Cockpit man durch die Haube sieht. Bei
// allen anderen sind Kabinen und Laderäume von außen unsichtbar, aber bis zu
// zwei Drittel der Dreiecke (Aurora Mk II: 2 von 3 Millionen).
const KEEP_INTERIOR = new Set(['aegs-gladius', 'anvl-arrow', 'anvl-hornet-f7c-mk2', 'aegs-avenger-titan', 'orig-300i', 'aegs-sabre']);
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
const parts = argv.filter((a) => ['ships', 'hall', 'lift', 'werkstatt', 'npc'].includes(a));
const want = (p) => !parts.length || parts.includes(p);

if (!existsSync(STARBREAKER)) { console.error(`StarBreaker fehlt: ${STARBREAKER} (SC_STARBREAKER setzen)`); process.exit(1); }
if (!existsSync(P4K)) { console.error(`Data.p4k fehlt: ${P4K} (SC_P4K setzen)`); process.exit(1); }

// log: StarBreaker mit -v aufrufen und dessen Protokoll (stderr) mit zurückgeben
function sb(args, { log = false } = {}) {
  const r = spawnSync(STARBREAKER, [...(log ? ['-v'] : []), ...args, '--p4k', P4K], { encoding: 'utf8', maxBuffer: 256 << 20 });
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

if (want('ships')) {
  console.log('Schiffe');
  for (const slug of shipArg ?? SHIPS) {
    const args = ['entity', 'export', slug.replace(/-/g, '_')];
    if (!KEEP_INTERIOR.has(slug)) args.push('--no-interior');
    try { exportTo(`${SRC}ships/${slug}.glb`, args); }
    catch (e) { console.error(`  ! ${slug}: ${e.message}`); }
  }
}

// Halle und Aufzug: socpak-Export mit Lichtprotokoll, Materialnachtrag, Texturen
const containers = [
  ...(want('hall') ? HALLS.map((h) => ({ ...h, dir: 'hall' })) : []),
  ...(want('lift') ? LIFTS.map((h) => ({ ...h, dir: 'lift' })) : []),
  ...(want('werkstatt') ? WERKSTATT.map((h) => ({ ...h, dir: 'werkstatt' })) : []),
];
if (containers.length) {
  console.log('Halle/Aufzug');
  for (const h of containers) {
    const file = `${SRC}${h.dir}/${h.key}.glb`;
    // Stufe je Halle (h.lod): die volle Stufe hat Fasen, Schrauben und
    // Kantenprofile, die LOD 1 fehlen. Schiffe bleiben bei COMMON.
    // Lichter: das GLB trägt sie als KHR_lights_punctual, kennt aber nur
    // Punkt und Spot. Den Spieltyp (Planar = Flächenlicht, Projector, Omni,
    // Ambient) und die Spiel-Intensität nennt nur das Protokoll des Exports
    // (-v): "Light '<name>' type=… intensity=… radius=… color=[…]". Diese
    // Zeilen gehen nach <halle>.lights-src.txt, der Build verbindet sie über
    // den Namen mit den Lichtknoten.
    try {
      const log = exportTo(file, ['socpak', 'export', h.socpak], COMMON.map((a, i, all) => (all[i - 1] === '--lod' ? String(h.lod) : a)), { log: true });
      if (typeof log === 'string') {
        const lines = log.split('\n').filter((l) => / Light '/.test(l)).map((l) => l.replace(/^.*?\] +/, ''));
        writeFileSync(`${SRC}${h.dir}/${h.key}.lights-src.txt`, lines.join('\n') + '\n');
        console.log(`  Lichtangaben: ${lines.length}`);
      }
    } catch (e) { console.error(`  ! ${h.key}: ${e.message}`); continue; }
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
      for (const m of Object.values(info.decalMaterials)) { add(m.d); add(m.n); add(m.mask); }
      console.log(`  Werkstatt: Landefläche ${info.landingArea?.dimensions?.join(' x ')} m, ${info.decals.length} Decals (${info.decals.filter((d) => d.floor).length} auf dem Boden), ${Object.keys(info.decalMaterials).length} Decal-Materialien`);
    }
    if (h.dir === 'lift' || h.dir === 'werkstatt') {
      const layers = layerMaterials(doc);
      writeFileSync(`${SRC}${h.dir}/${h.key}.layers.json`, JSON.stringify(layers, null, 1));
      for (const l of Object.values(layers)) { add(l.d); add(l.n); }
      console.log(`  Schichtmaterialien: ${Object.keys(layers).length} .mtl (${Object.values(layers).filter((l) => l.d).length} mit Farbkarte)`);
    }
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
    // Folgezeilen: nur first_index-Anschluss prüfen (Spalte 5 ist bei großen
    // Submeshes nicht 0)
    while (at + 48 <= buf.length && i32(at + 4) === next && i32(at + 8) > 0 && i32(at + 8) % 3 === 0) {
      rows.push({ mat: buf.readUInt16LE(at), num: i32(at + 8) });
      next += i32(at + 8);
      at += 48;
    }
    if (rows.length && (!best || rows.length > best.length)) best = rows;
  }
  return best;
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
      shader: attr(head, 'Shader'), mask: attr(head, 'StringGenMask'), diffuse: attr(head, 'Diffuse'), specular: attr(head, 'Specular'),
      opacity: attr(head, 'Opacity'), shininess: attr(head, 'Shininess'), surface: attr(head, 'SurfaceType'),
      d: tex('TexSlot1'), n: tex('TexSlot2'),
      // %OPACITY_MAP: Deckkraft aus TexSlot12 (Maske, ungekachelt); Farbe mit TexMod
      mask: tex('TexSlot12'),
      tileD: (() => { const t = x.match(/<Texture\b[^>]*Map="TexSlot1"[^>]*?(?<!\/)>([\s\S]*?)<\/Texture>/)?.[1] || ''; const u = Number(t.match(/TileU="([^"]*)"/)?.[1] || 1), v = Number(t.match(/TileV="([^"]*)"/)?.[1] || 1); return u !== 1 || v !== 1 ? [u, v] : null; })(),
      params: Object.fromEntries([...pp.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]])),
    };
  }
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
function layerMaterials(doc) {
  const RAW = `${SRC}layer-raw/`;
  mkdirSync(RAW, { recursive: true });
  const want = new Set();
  for (const m of doc.getRoot().listMaterials()) {
    const x = m.getExtras() || {};
    // alle Schichten (Primary, Wear, …): der Build nimmt die erste, die JSON nennt alle
    if (!x.diffuse_tex) for (const l of x.layers || []) if (l?.path) want.add(l.path.replace(/\\/g, '/'));
  }
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
    out.push({
      name: attr('Name'), shader: attr('Shader'), diffuse: attr('Diffuse'), specular: attr('Specular'),
      shininess: attr('Shininess'), opacity: attr('Opacity'),
      d: tex('TexSlot1'), n: tex('TexSlot2'), s: tex('TexSlot4'), td: tile('TexSlot1'), tn: tile('TexSlot2'),
      blend,
      // %VERTCOLORS: das Spiel dunkelt die Fläche mit COLOR_0 ab (Build behält es)
      vc: /VERTCOLORS/i.test(attr('StringGenMask') || ''),
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
