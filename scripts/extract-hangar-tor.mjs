// Schachttor des mittleren Hangars (.planning/notes/hangar-schachttor.md).
//
// Das Tor ist die Geometrie ht_hangar_ship_elev_door_med_a.cga der Entity
// LoadingPlatformLoadingGate in hangar_medtop_001 (Hightech). Die .cga ist
// ein Knotenbaum: Knochen (anim_door_l_019 …) mit je einem Netz-Knoten
// (…_mesh); die Teilnetze der .cgam tragen den Index ihres Netz-Knotens
// (obere 16 Bit des ersten Worts einer 48-Byte-Zeile). Der socpak-Export legt
// die .cga zu einem Mesh zusammen, ein Primitiv je Teilnetz in derselben
// Reihenfolge (Teilnetze mit vom Export verworfenem Material fehlen).
// Bewegung: door_close/door_open (.caf, scripts/lib/ivo-caf.mjs), dazu die
// Plattform (Knochen anim_pad001 in ht_hangar_ship_elev_med_door_*.caf).
//
// Ausgabe (gitignored): .cache/hangar-src/tor/
//   medtop-lodN.glb   socpak-Export des Hangars in der gewählten Stufe
//   tor.json          Knotenbaum, Teilnetze, Primitiv->Knochen, Spuren
// Usage: node scripts/extract-hangar-tor.mjs [--force]
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readCaf } from './lib/ivo-caf.mjs';

const STARBREAKER = process.env.SC_STARBREAKER ?? 'G:/Projects/games/Star Citizen/tools/starbreaker-cli/starbreaker.exe';
const P4K = process.env.SC_P4K ?? 'F:/Games/Star Citizen/StarCitizen/LIVE/Data.p4k';
const SRC = fileURLToPath(new URL('../.cache/hangar-src/', import.meta.url));
const OUT = `${SRC}tor/`, RAW = `${SRC}tor-raw/`;
const FORCE = process.argv.includes('--force');
const BUDGET = 30000;   // Dreiecke für die beste Stufe darunter
mkdirSync(OUT, { recursive: true }); mkdirSync(RAW, { recursive: true });
const sb = (args) => { const r = spawnSync(STARBREAKER, [...args, '--p4k', P4K], { encoding: 'utf8', maxBuffer: 1 << 28 }); if (r.status !== 0) throw new Error((r.stderr || r.stdout).trim().split('\n').slice(-2).join(' | ')); return r.stdout; };
const listFiles = (d) => (existsSync(d) ? readdirSync(d, { recursive: true }).map((f) => `${d}${String(f).replace(/\\/g, '/')}`) : []);

sb(['p4k', 'extract', '-o', RAW, '--regex', '(?i)hangar[\\\\/]elev[\\\\/]ht_hangar_ship_elev_(door_)?med']);
sb(['p4k', 'extract', '-o', RAW, '--regex', '(?i)hightech_a[\\\\/]hangar_medtop_001\\.socpak$']);
const files = listFiles(RAW);
const find = (re) => files.find((f) => re.test(f));

// Knotenbaum der .cga (StarBreaker nmc dump)
const cga = find(/ht_hangar_ship_elev_door_med_a\.cga$/i);
const dump = spawnSync(STARBREAKER, ['nmc', 'dump', cga], { encoding: 'utf8' }).stdout;
const nodes = [...dump.matchAll(/\[\s*(\d+)\] (\S+) parent=(\S+) geom=(\d+)[^\n]*\n\s*b2w\[0\] = \[([^\]]+)\]\n\s*b2w\[1\] = \[([^\]]+)\]\n\s*b2w\[2\] = \[([^\]]+)\]/g)].map((m) => ({
  index: Number(m[1]), name: m[2], parent: m[3] === 'root' ? null : Number(m[3]), geom: Number(m[4]),
  t: [m[5], m[6], m[7]].map((r) => Number(r.split(',')[3])),
}));

// Teilnetze je Stufe: [Material, Netz-Knoten, Dreiecke]
function subsets(buf) {
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
const stages = [0, 1, 2, 3, 4, 5].map((l) => { const f = find(new RegExp(`ht_hangar_ship_elev_door_med_a${l ? `_lod${l}` : ''}\\.cgam$`, 'i')); return f ? { lod: l, subsets: subsets(readFileSync(f)) } : null; }).filter(Boolean);
for (const s of stages) s.tris = s.subsets.reduce((a, r) => a + r.tris, 0);
const pick = stages.find((s) => s.tris <= BUDGET) ?? stages.at(-1);
console.log(`Stufen: ${stages.map((s) => `LOD${s.lod} ${s.tris}`).join(', ')} -> LOD${pick.lod}`);

// socpak-Export in dieser Stufe (Texturen als Pfade; dekodiert hat sie der Schacht-Lauf)
const glb = `${OUT}medtop-lod${pick.lod}.glb`;
if (FORCE || !existsSync(glb)) sb(['socpak', 'export', 'hightech_a\\hangar_medtop_001.socpak', glb, '--materials', 'textures', '--mip', '1', '--lod', String(pick.lod)]);

// Tor-Entity: Exemplare und Lage (Container-Raum; der Schacht-Raum hat die Schachtmitte auf dem Hallenboden)
const pak = find(/hightech_a\/hangar_medtop_001\.socpak$/i);
const { readZip } = await import('./lib/soc-objects.mjs');
const zip = readZip(readFileSync(pak));
const soc = zip.get([...zip.keys()].find((k) => k.toLowerCase().endsWith('.soc')))();
let xml = '';
{
  const cnt = soc.readUInt32LE(8), tab = soc.readUInt32LE(12);
  for (let i = 0; i < cnt; i++) {
    const o = tab + i * 16, size = soc.readUInt32LE(o + 8), off = soc.readUInt32LE(o + 12);
    if (soc.toString('latin1', off, off + 7) !== 'CryXmlB') continue;
    writeFileSync(`${RAW}medtop.cryxml`, soc.subarray(off, off + size));
    spawnSync(STARBREAKER, ['cryxml', 'convert', `${RAW}medtop.cryxml`, `${RAW}medtop.xml`]);
    xml = readFileSync(`${RAW}medtop.xml`, 'utf8');
  }
}
const ents = [...xml.matchAll(/<Entity\b([^>]*)>([\s\S]*?)<\/Entity>/g)].map((m) => ({ head: m[1], body: m[2] }));
const attr = (s, k) => (s.match(new RegExp(`\\b${k}="([^"]*)"`)) || [])[1];
const gates = ents.filter((e) => /ht_hangar_ship_elev_door_med_a\.cga/i.test(e.body)).map((e) => ({ cls: attr(e.head, 'EntityClass'), name: attr(e.head, 'Name'), pos: String(attr(e.head, 'Pos') || '0,0,0').split(',').map(Number), rot: attr(e.head, 'Rotate') || null }));
const platform = ents.find((e) => attr(e.head, 'EntityClass') === 'LoadingPlatform');
const speed = Number((platform?.body.match(/DoorAnimationSpeed="([^"]*)"/) || [])[1] || 1);

// Spuren
const boneNames = nodes.map((n) => n.name).concat(['anim_pad001']);
const cafs = {};
for (const f of files.filter((x) => x.endsWith('.caf'))) cafs[f.split('/').pop()] = readCaf(readFileSync(f), boneNames);
// Ereignisse der Animationen (.animevents, Zeit 0..1)
const events = {};
for (const f of files.filter((x) => x.endsWith('.animevents'))) {
  if (!existsSync(`${f}.xml`)) spawnSync(STARBREAKER, ['cryxml', 'convert', f, `${f}.xml`]);
  const x = existsSync(`${f}.xml`) ? readFileSync(`${f}.xml`, 'utf8') : readFileSync(f, 'latin1');
  events[f.split('/').pop()] = [...x.matchAll(/<event\b([^>]*)\/?>/gi)].map((m) => ({ name: attr(m[1], 'name'), time: Number(attr(m[1], 'time')), parameter: attr(m[1], 'parameter') }));
}

writeFileSync(`${OUT}tor.json`, JSON.stringify({ lod: pick.lod, stages: stages.map((s) => ({ lod: s.lod, tris: s.tris })), subsets: pick.subsets, nodes, gates, speed, cafs, events, glb: glb.slice(SRC.length) }, null, 1));
console.log(`Tor: ${gates.length} Exemplar(e) ${gates.map((g) => `${g.cls} @ ${g.pos.join(',')}`).join('; ')}; ${nodes.length} Knoten; ${pick.subsets.length} Teilnetze; Spuren ${Object.entries(cafs).map(([k, c]) => `${k} ${c.bones.filter((b) => b.pos).length}`).join(', ')}; Ereignisse ${Object.values(events).flat().length}`);
