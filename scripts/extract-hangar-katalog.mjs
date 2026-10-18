// Gerätekatalog für die Hangar-Seite (.planning/notes/hangar-katalog.md).
//
// Liest die Hangar-socpaks des Spiels (Industrie-Hangars util_a, VFG
// Industrial, Self-Land, verlassene Asteroidenbasis) direkt aus der
// Data.p4k, ohne socpak-Export: Brushes und Decals aus der .soc
// (scripts/lib/soc-objects.mjs), Entities und Landefläche aus deren
// Entity-XML. Daraus:
//   - Inventar aller Requisiten aus Wartung, Energie, Treibstoff, Luft,
//     Werkzeug, Diagnose, Transport, Lager, Heben, Reinigung, Sicherheit;
//   - je Requisit: Aufstellung (Boden/Wand/…, Höhe, Abstand zu Feld und
//     Wand, Ausrichtung), Nachbarn in 3 m, Zahl und Hallen;
//   - Arbeitsplätze (Gruppen < 2,5 m) und Leitungen (Ketten aus Kabel- und
//     Schlauchstücken) mit ihren Endgeräten;
//   - Spielname, Beschreibung, Typ und Tags aus DataCore und Lokalisierung,
//     wo eine Entity die Geometrie trägt;
//   - Quellen für den Build: je ausgewähltem Requisit Geometrie (skin
//     export), Untermaterial-IDs (.cgfm), Material samt Schichten (.mtl).
// Ausgabe (gitignored): .cache/hangar-src/katalog/
//
// Usage: node scripts/extract-hangar-katalog.mjs [--force]
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readZip, socObjects, worldOffset } from './lib/soc-objects.mjs';

const STARBREAKER = process.env.SC_STARBREAKER ?? 'G:/Projects/games/Star Citizen/tools/starbreaker-cli/starbreaker.exe';
const P4K = process.env.SC_P4K ?? 'F:/Games/Star Citizen/StarCitizen/LIVE/Data.p4k';
const SRC = fileURLToPath(new URL('../.cache/hangar-src/', import.meta.url));
const OUT = `${SRC}katalog/`, RAW = `${SRC}katalog-raw/`;
const FORCE = process.argv.includes('--force');
mkdirSync(OUT, { recursive: true }); mkdirSync(RAW, { recursive: true });

function sb(args) {
  const r = spawnSync(STARBREAKER, [...args, '--p4k', P4K], { encoding: 'utf8', maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' | '));
  return r.stdout;
}
const listFiles = (dir) => (existsSync(dir) ? readdirSync(dir, { recursive: true }).map((f) => `${dir}${String(f).replace(/\\/g, '/')}`) : []);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const base = (p) => String(p).replace(/\\/g, '/').split('/').pop().replace(/\.(cgf|cga|cdf)$/i, '').toLowerCase();
const r3 = (v) => Math.round(v * 1000) / 1000;
const med = (a) => { if (!a.length) return null; const s = [...a].sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };

// ─── Kategorien ─────────────────────────────────────────────────────────
// Reihenfolge zählt: der erste Treffer gewinnt. Nur Geometrie unter einem
// Requisiten-Ordner (…/prop/…, Gadgets, Usables) oder Entities.
export const KATEGORIEN = [
  ['sicherheit', /extinguisher|fire_hose|fire-hose|barrier|(^|_)cone_|first_?aid|medical_kit|medical_canister|canister_medical|sign_warning|warning_sign/],
  ['reinigung', /(^|_)mop|bucket|broom|trash|garbage|cleaning|dustbin|waste/],
  ['heben', /(^|_)jack_|hoist|winch|(^|_)crane(?!_welding)|ladder|lifter/],
  ['schlauch', /hose|airduct/],
  ['kabel', /^cable|^cables_|cable_reel|cable_terminal|cable_box|junctionbox|maintenance_cable|extension_cord/],
  ['energie', /generator|battery|power_(box|unit|cell|node)|charger|transformer|fuse_?box|breaker|capacitor/],
  ['treibstoff', /fuel|tank_gas|gas_tank|canister|jerry|refuel/],
  ['luft', /oxygen|compressor|heater|air_?filter|ventilator|airduct_fan|dehumid|scrubber/],
  ['licht', /work-light|work_light|light_?stand|lamp_?stand|flood_?light|light_portable|tripod/],
  ['diagnose', /diagnos|maintenance_terminal|panel_engineering|computer|server_rack|scanner|terminal_(port|mobile|stand)/],
  ['werkzeug', /(^|_)tool[_s-]|toolbox|tool_?chest|cabinet_tool|tool_drawer|welder|welding|drill|wrench|ratchet|socket_set|bag_toolbox|workbench|circularsaw|tester|(^|_)vice|grinder/],
  ['transport', /trolley|(^|_)cart|forklift|pallet|dolly|creeper/],
  ['lager', /crate|container_|(^|_)box_|drum|barrel|shelf|rack_|locker|cabinet|storage|(^|_)bin_|(^|_)bag_|case_/],
];
// addon: Luftschläuche (lt_airduct_hose_*) liegen im Ausbau-Ordner der Räume
const PROPDIR = /\/(prop|props|gadgets|usable|usablehelpers|items|addon)\//i;
// Sitze (Hocker, Kisten mit Sitzpunkt) sind Mobiliar, keine Werkstatt
const NOT_PROP = /_lod\d|_proxy|_col$|_damaged|decal|sign_billboard|screen_|display_video|light_(hung|fluorescent|landing|floor(?!_)|wall|ceiling|hazard|fixture)|door|window|wall|ceiling|stair|railing|walkway|seat|stool|chair|bench(?!_work)|barstool|anim$/;
export function kategorie(name, path = '') {
  const n = name.toLowerCase();
  if (NOT_PROP.test(n)) return null;
  if (path && !PROPDIR.test(String(path).replace(/\\/g, '/'))) return null;
  for (const [k, re] of KATEGORIEN) if (re.test(n)) return k;
  return null;
}

// ─── 1. Hangar-socpaks ──────────────────────────────────────────────────
const PAK_RE = '(?i)(hangar[\\\\/](util_a|hightech_a)[\\\\/]hangar_(medtop|lrgtop|smltop|medfrnt|lrgfrnt|lrgfront|smlfrnt|xltop)_00[123][^\\\\/]*|vfgindustrial[\\\\/][^\\\\/]*|selfland[\\\\/][^\\\\/]*|hangar_medfrnt_asteroidbase_[^\\\\/]*)\\.socpak$';
sb(['p4k', 'extract', '-o', RAW, '--regex', PAK_RE]);
const paks = listFiles(RAW).filter((f) => f.endsWith('.socpak'));
console.log(`Hangar-socpaks: ${paks.length}`);

// Entity-XML einer .soc (CryXmlB-Chunk) über StarBreaker
function entityXml(soc, tmp) {
  const cnt = soc.readUInt32LE(8), tab = soc.readUInt32LE(12);
  for (let i = 0; i < cnt; i++) {
    const o = tab + i * 16, size = soc.readUInt32LE(o + 8), off = soc.readUInt32LE(o + 12);
    if (soc.toString('latin1', off, off + 7) !== 'CryXmlB') continue;
    if (FORCE || !existsSync(`${tmp}.xml`)) { writeFileSync(`${tmp}.cryxml`, soc.subarray(off, off + size)); spawnSync(STARBREAKER, ['cryxml', 'convert', `${tmp}.cryxml`, `${tmp}.xml`]); }
    return existsSync(`${tmp}.xml`) ? readFileSync(`${tmp}.xml`, 'utf8') : '';
  }
  return '';
}

// ─── 2. DataCore: Geometrie -> Entity-Klassen, Name/Beschreibung/Typ/Tags ─
function dcbMap(field, file) {
  const f = `${OUT}${file}`;
  if (FORCE || !existsSync(f)) writeFileSync(f, sb(['dcb', 'query', `EntityClassDefinition.${field}`]));
  const m = new Map();
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const [k, ...v] = line.replace(/\r$/, '').split('\t');
    if (!k) continue;
    const cls = k.replace(/^EntityClassDefinition\./, '');
    if (!m.has(cls)) m.set(cls, v.join('\t'));
  }
  return m;
}
const dGeo = dcbMap('Components[SGeometryResourceParams].Geometry.Geometry.Geometry.path', 'dcb-geometry.txt');
const AD = 'Components[SAttachableComponentParams].AttachDef';
const dName = dcbMap(`${AD}.Localization.Name`, 'dcb-name.txt');
const dDesc = dcbMap(`${AD}.Localization.Description`, 'dcb-desc.txt');
const dType = dcbMap(`${AD}.Type`, 'dcb-type.txt');
const dSub = dcbMap(`${AD}.SubType`, 'dcb-subtype.txt');
const dTags = dcbMap(`${AD}.Tags`, 'dcb-tags.txt');
const byGeo = new Map();
for (const [cls, p] of dGeo) { if (!p) continue; const b = base(p); if (!byGeo.has(b)) byGeo.set(b, []); byGeo.get(b).push(cls); }

// Lokalisierung (Englisch, Deutsch)
sb(['p4k', 'extract', '-o', RAW, '--regex', '(?i)localization[\\\\/](english|german_\\(germany\\))[\\\\/]global\\.ini$']);
function ini(lang) {
  const f = listFiles(RAW).find((x) => x.toLowerCase().includes(`/localization/${lang}/global.ini`));
  const m = new Map();
  if (!f) return m;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) { const i = line.indexOf('='); if (i > 0) m.set(line.slice(0, i).toLowerCase().replace(/,p$/, ''), line.slice(i + 1)); }
  return m;
}
const EN = ini('english'), DE = ini('german_(germany)');
const loc = (key, m) => { if (!key || /LOC_(PLACEHOLDER|EMPTY|UNINITIALIZED)/i.test(key)) return null; return m.get(key.replace(/^@/, '').toLowerCase()) || null; };

// ─── 3. Inventar ────────────────────────────────────────────────────────
const halls = [];
for (const pak of paks) {
  const name = pak.split('/').pop().replace(/\.socpak$/i, '');
  const zip = readZip(readFileSync(pak));
  const socName = [...zip.keys()].find((k) => k.toLowerCase().endsWith('.soc'));
  if (!socName) continue;
  const soc = zip.get(socName)();
  const { brushes, decals } = socObjects(soc);
  const xml = entityXml(soc, `${RAW}${name}`);
  const ents = [...xml.matchAll(/<Entity\b([^>]*)>([\s\S]*?)<\/Entity>|<Entity\b([^>]*)\/>/g)].map((m) => {
    const head = m[1] ?? m[3], body = m[2] || '';
    const at = (k) => (head.match(new RegExp(`\\b${k}="([^"]*)"`)) || [])[1];
    return { cls: at('EntityClass'), name: at('Name'), pos: String(at('Pos') || '0,0,0').split(',').map(Number), rot: at('Rotate'), body };
  });
  const la = ents.find((e) => e.cls === 'LandingArea');
  const dims = la && ['x', 'y', 'z'].map((k) => Number((la.body.match(new RegExp(`<dimensions[^>]*\\b${k}="([^"]*)"`)) || [])[1]));
  halls.push({ name, brushes, decals, ents, la: la ? { pos: la.pos, rot: la.rot || null, dims } : null, offset: worldOffset(decals) });
}
// Dressing-socpaks (…_gh_dressing usw.) liegen im Raum ihrer Grundhalle: deren Feld nehmen
for (const h of halls) if (!h.la) {
  const parent = halls.filter((p) => p.la && h.name.startsWith(p.name)).sort((a, b) => b.name.length - a.name.length)[0];
  if (parent) { h.la = parent.la; h.laFrom = parent.name; }
  if (!h.offset && parent) h.offset = parent.offset;
}

// Objekte einer Halle: Brushes und Entities mit Lage (Container-Raum, Z oben)
const quatMat = (q) => { // q = (w, x, y, z) wie Rotate der Entity-XML
  const [w, x, y, z] = q;
  return [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y), 2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x), 2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)];
};
const items = [];   // { hall, key, kat, path, kind, pos[3], ax[3], ay[3], scale, box? }
for (const h of halls) {
  for (const b of h.brushes) {
    const key = base(b.cgf), kat = kategorie(key, b.cgf);
    const m = b.m;
    const ax = [m[0], m[4], m[8]], ay = [m[1], m[5], m[9]];
    const sc = Math.hypot(...ax);
    const off = h.offset;
    items.push({ hall: h, key, kat, path: b.cgf, kind: 'brush', pos: [m[3], m[7], m[11]], ax, ay, scale: sc, box: off ? [0, 1, 2, 3, 4, 5].map((i) => b.box[i] - off[i % 3]) : null });
  }
  for (const e of h.ents) {
    const geo = dGeo.get(e.cls) || (e.body.match(/(?:Geometry|path)="([^"]+\.(?:cgf|cga))"/) || [])[1];
    if (!geo) continue;
    const key = base(geo), kat = kategorie(key, geo) || kategorie(String(e.cls || '').toLowerCase());
    const r = e.rot ? quatMat(e.rot.split(',').map(Number)) : [1, 0, 0, 0, 1, 0, 0, 0, 1];
    items.push({ hall: h, key, kat, path: geo, kind: 'entity', cls: e.cls, pos: e.pos, ax: [r[0], r[3], r[6]], ay: [r[1], r[4], r[7]], scale: 1 });
  }
}
const props = items.filter((i) => i.kat);
console.log(`Objekte: ${items.length}, davon Requisiten: ${props.length} in ${new Set(props.map((p) => p.key)).size} Arten`);

// ─── 4. Aufstellung und Nachbarn ────────────────────────────────────────
// Wände: Brushes mit „wall“ im Namen, ihre Box im Container-Raum (2D)
// nur schmale Wandstücke (unter 3 m tief): große Wandmodule umschließen mit
// ihrer Box ganze Bereiche, jeder Punkt darin hätte Wandabstand 0
const wallBoxes = new Map(halls.map((h) => [h, items.filter((i) => i.hall === h && i.box && /wall/.test(i.key) && !i.kat && Math.min(i.box[3] - i.box[0], i.box[4] - i.box[1]) < 3).map((i) => i.box)]));
const distBox2 = (p, b) => Math.hypot(Math.max(b[0] - p[0], 0, p[0] - b[3]), Math.max(b[1] - p[1], 0, p[1] - b[4]));
function placement(it) {
  const h = it.hall, la = h.la;
  const floorZ = la ? la.pos[2] : null;
  const hgt = floorZ != null ? it.pos[2] - floorZ : null;
  // Feldrand: Abstand zum Rechteck der Landefläche (achsparallel; Rotate wird nicht ausgewertet), innen negativ
  let dField = null, facing = null;
  if (la?.dims) {
    const dx = Math.abs(it.pos[0] - la.pos[0]) - la.dims[0] / 2, dy = Math.abs(it.pos[1] - la.pos[1]) - la.dims[1] / 2;
    dField = dx > 0 || dy > 0 ? Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) : Math.max(dx, dy);
    // Ausrichtung: lokale +Y (Vorderseite) gegen die Richtung zur Feldmitte
    const to = [la.pos[0] - it.pos[0], la.pos[1] - it.pos[1]], f = [it.ay[0], it.ay[1]];
    const n1 = Math.hypot(...to), n2 = Math.hypot(...f);
    if (n1 > 0.1 && n2 > 0.1) { const c = (to[0] * f[0] + to[1] * f[1]) / n1 / n2; facing = c > 0.707 ? 'zugewandt' : c < -0.707 ? 'abgewandt' : 'quer'; }
  }
  const walls = wallBoxes.get(h) || [];
  const dWall = walls.length ? Math.min(...walls.map((b) => distBox2(it.pos, b))) : null;
  // Ort: liegend/hängend über die Hochachse; Höhe über dem Boden
  const up = [it.ax[1] * it.ay[2] - it.ax[2] * it.ay[1], it.ax[2] * it.ay[0] - it.ax[0] * it.ay[2], it.ax[0] * it.ay[1] - it.ax[1] * it.ay[0]];
  const upZ = up[2] / (Math.hypot(...up) || 1);
  let ort = 'boden';
  if (hgt != null && hgt > 2.6) ort = 'decke';
  else if (hgt != null && hgt > 0.35 && dWall != null && dWall < 0.8) ort = upZ < 0.7 ? 'wand' : 'regal';
  else if (hgt != null && hgt > 0.35) ort = 'tisch';
  return { hgt, dField, dWall, facing, ort };
}
for (const p of props) p.pl = placement(p);

const byKey = new Map();
for (const p of props) { if (!byKey.has(p.key)) byKey.set(p.key, []); byKey.get(p.key).push(p); }
const byHall = new Map(halls.map((h) => [h, props.filter((p) => p.hall === h)]));
const d3 = (a, b) => Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1], a.pos[2] - b.pos[2]);

const entries = [];
for (const [key, list] of byKey) {
  const pl = list.map((p) => p.pl);
  const cnt = (o) => pl.filter((x) => x.ort === o).length;
  const span = (a) => { const v = a.filter((x) => x != null); return v.length ? [r3(med(v)), r3(Math.min(...v)), r3(Math.max(...v))] : null; };
  const facings = ['zugewandt', 'abgewandt', 'quer'].map((f) => [f, pl.filter((x) => x.facing === f).length]).sort((a, b) => b[1] - a[1]);
  // Nachbarn in 3 m: je Art und je Kategorie Anteil der Aufstellungen und mittlerer Abstand
  const nk = new Map(), nc = new Map();
  for (const p of list) {
    const seenK = new Set(), seenC = new Set();
    for (const q of byHall.get(p.hall)) {
      if (q === p) continue;
      const d = d3(p, q); if (d > 3) continue;
      if (!seenK.has(q.key)) { seenK.add(q.key); const e = nk.get(q.key) || { n: 0, d: [] }; e.n++; e.d.push(d); nk.set(q.key, e); }
      if (!seenC.has(q.kat)) { seenC.add(q.kat); const e = nc.get(q.kat) || { n: 0, d: [] }; e.n++; e.d.push(d); nc.set(q.kat, e); }
    }
  }
  const nb = (m, field) => [...m].map(([k, e]) => ({ [field]: k, anteil: r3(e.n / list.length), abstand: r3(e.d.reduce((s, x) => s + x, 0) / e.d.length) })).sort((a, b) => b.anteil - a.anteil);
  // Spieldaten über die Entity, die diese Geometrie trägt
  const classes = byGeo.get(key) || [];
  const used = list.find((p) => p.cls)?.cls;
  const cls = used || classes.find((c) => loc(dName.get(c), EN)) || classes[0] || null;
  entries.push({
    key, kat: list[0].kat, path: list[0].path, count: list.length, hallen: new Set(list.map((p) => p.hall.name.replace(/_(gh|nyx|levski|lorville|a18|law|occu|rund|rest|dressing|delving|tsg|dc|distributioncenter|newbab|orison|static|gm|ugf|fleet_week|cargo_test)(_.*)?$/, ''))).size,
    from: [...new Set(list.map((p) => p.hall.name))].sort(),
    klasse: cls, klassen: classes.slice(0, 6),
    name: cls ? { en: loc(dName.get(cls), EN), de: loc(dName.get(cls), DE) } : null,
    beschreibung: cls ? { en: loc(dDesc.get(cls), EN), de: loc(dDesc.get(cls), DE) } : null,
    typ: cls ? [dType.get(cls), dSub.get(cls)].filter((x) => x && x !== 'UNDEFINED').join('.') || null : null,
    tags: cls ? String(dTags.get(cls) || '').split(/[\s,]+/).filter(Boolean) : [],
    aufstellung: {
      boden: cnt('boden'), wand: cnt('wand'), regal: cnt('regal'), tisch: cnt('tisch'), decke: cnt('decke'),
      hoehe: span(pl.map((x) => x.hgt)), abstandFeld: span(pl.map((x) => x.dField)), abstandWand: span(pl.map((x) => x.dWall)),
      richtung: facings[0][1] ? facings[0][0] : null, richtungen: Object.fromEntries(facings),
    },
    nachbarn: [...nb(nc, 'kategorie').slice(0, 6), ...nb(nk, 'node').slice(0, 8)],
  });
}
entries.sort((a, b) => b.count - a.count);

// ─── 5. Arbeitsplätze: Gruppen < 2,5 m (Einzelverkettung) ───────────────
const groups = [];
for (const [h, list] of byHall) {
  const work = list.filter((p) => p.kat !== 'kabel' || /reel|terminal|box/.test(p.key));
  const seen = new Set();
  for (const p of work) {
    if (seen.has(p)) continue;
    const g = [p]; seen.add(p);
    for (let i = 0; i < g.length; i++) for (const q of work) if (!seen.has(q) && d3(g[i], q) < 2.5) { seen.add(q); g.push(q); }
    if (g.length < 2) continue;
    const c = [0, 1, 2].map((k) => g.reduce((s, x) => s + x.pos[k], 0) / g.length);
    const pl = placement({ ...g[0], pos: c });
    const yaw = (x) => r3((Math.atan2(x.ax[1], x.ax[0]) * 180) / Math.PI);
    groups.push({
      hall: h.name, size: g.length,
      sig: [...new Set(g.map((x) => x.kat))].sort().join('+'),
      mitglieder: g.map((x) => ({ key: x.key, kat: x.kat, at: [r3(x.pos[0] - c[0]), r3(x.pos[2] - c[2]), r3(-(x.pos[1] - c[1]))], drehungY: yaw(x), y: r3(x.pl.hgt ?? 0) })),
      abstandFeld: pl.dField != null ? r3(pl.dField) : null, abstandWand: pl.dWall != null ? r3(pl.dWall) : null,
    });
  }
}
const sigs = new Map();
for (const g of groups) { const e = sigs.get(g.sig) || { sig: g.sig, n: 0, hallen: new Set(), vertreter: null }; e.n++; e.hallen.add(g.hall); if (!e.vertreter || g.size > e.vertreter.size) e.vertreter = g; sigs.set(g.sig, e); }

// ─── 6. Leitungen: Ketten aus Kabel- und Schlauchstücken ────────────────
const LINE = /^cable_(straight|bend|corner|split)|^cables_a_|lt_airduct_hose_(straight|corner|junction|torn)|cable_terminal_\d_floor/;
const lines = [];
for (const [h, list] of byHall) {
  // nur am Boden (bis 0,6 m): die Kabelzüge an Wänden und Decken sind keine Leitung zum Gerät
  const pieces = list.filter((p) => LINE.test(p.key) && p.pl.hgt != null && p.pl.hgt < 0.6);
  const seen = new Set();
  for (const p of pieces) {
    if (seen.has(p)) continue;
    const g = [p]; seen.add(p);
    for (let i = 0; i < g.length; i++) for (const q of pieces) if (!seen.has(q) && d3(g[i], q) < 2.3) { seen.add(q); g.push(q); }
    // Reihenfolge: vom äußersten Stück aus jeweils das nächste
    const far = g.reduce((a, x) => (g.reduce((s, y) => s + d3(x, y), 0) > g.reduce((s, y) => s + d3(a, y), 0) ? x : a), g[0]);
    const order = [far]; const rest = new Set(g.filter((x) => x !== far));
    while (rest.size) { const last = order[order.length - 1]; const nx = [...rest].sort((a, b) => d3(last, a) - d3(last, b))[0]; order.push(nx); rest.delete(nx); }
    const len = order.slice(1).reduce((s, x, i) => s + d3(order[i], x), 0) + 2;
    const endDev = (e) => list.filter((q) => !LINE.test(q.key) && q.kat !== 'kabel' && d3(e, q) < 1.5).sort((a, b) => d3(e, a) - d3(e, b))[0]
      || list.filter((q) => !LINE.test(q.key) && d3(e, q) < 1.5).sort((a, b) => d3(e, a) - d3(e, b))[0];
    const yaw = (x) => r3((Math.atan2(x.ax[1], x.ax[0]) * 180) / Math.PI);
    const von = endDev(order[0])?.key ?? null, nach = endDev(order[order.length - 1])?.key ?? null;
    if (order.length < 2 && !von && !nach) continue;
    // Lage relativ zur Feldmitte (glTF: x, y über dem Boden, z)
    const c = h.la ? h.la.pos : [0, 0, 0];
    lines.push({
      halle: h.name, laenge: r3(len),
      stuecke: order.map((x) => ({ key: x.key, at: [r3(x.pos[0] - c[0]), r3(x.pos[2] - c[2]), r3(-(x.pos[1] - c[1])), yaw(x)] })),
      von, nach,
    });
  }
}

// ─── 7. Schiffsseite: Item-Ports mit Tank-/Stromnamen ──────────────────
const SHIPS = ['AEGS_Gladius', 'DRAK_Cutlass_Black', 'RSI_Constellation_Andromeda'];
const schiffe = [];
for (const s of SHIPS) {
  let tree = '';
  try { tree = sb(['entity', 'loadout', s]); } catch (e) { tree = ''; }
  const hits = tree.split('\n').filter((l) => /fuel|refuel|intake|umbilical|power_?port|ground_?power|nozzle/i.test(l)).map((l) => l.trim());
  schiffe.push({ schiff: s, anschluesse: hits.slice(0, 40), zeilen: tree.split('\n').length });
}

writeFileSync(`${OUT}inventar.json`, JSON.stringify({
  hallen: halls.map((h) => ({ name: h.name, feld: h.la?.dims ?? null, feldVon: h.laFrom ?? null, versatz: !!h.offset, brushes: h.brushes.length, entities: h.ents.length })),
  entries, gruppen: groups, zusammensetzungen: [...sigs.values()].map((e) => ({ sig: e.sig, n: e.n, hallen: e.hallen.size, vertreter: e.vertreter })).sort((a, b) => b.n - a.n),
  leitungen: lines, schiffe,
}, null, 1));
// ─── 8. Auswahl und Quellen für den Build ───────────────────────────────
// Ausgewählt werden:
//  - aus den Hangars jede Art, die mindestens dreimal steht; bei Lager und
//    Müll nur die häufigsten (die Spielhallen stapeln Dutzende Kisten-
//    und Müllsackvarianten), bei Wand-Kabelkanälen drei;
//  - alle Bodenkabel- und Schlauchstücke (gerade, Bogen, Ecke, Abzweig,
//    Enden), damit sich Leitungen zusammensetzen lassen;
//  - das Wartungsgerät des Archivs (…/prop/maintenance/…) und einzelne
//    Werkstattstücke, die in Hangars fehlen.
// Je Requisit: Geometrie per skin export (volle Stufe, sonst _lod1/_lod2
// bis ≤ 8 000 Dreiecke, große Geräte ≤ 20 000), Untermaterial-IDs aus der
// .cgfm, Material der .cgf samt Schichten (<MatLayers>) und Karten.
const ARCHIV_EXTRA = /workbench_mobile_1_a|crane_welding_arm_1_a|trolley_creeper_1_a|generator_oxygen_1_a|storage_toolbox_a|light_tripod_1_a|lamp_slaver_1_tripod_a/i;
const archivList = sb(['p4k', 'list', '--regex', '(?i)[\\\\/]prop[\\\\/].*\\.cgf$']).split('\n').map((l) => l.split('\t')[0].trim()).filter(Boolean)
  .filter((f) => !/_lod\d|_damaged|_dmg|_proxy|tool_socket_\d|_anim|bolts|nuts|scrap_|[\\/](ships|spaceships|vehicles)[\\/]/i.test(f))
  .filter((f) => /[\\/]prop[\\/]maintenance[\\/]/i.test(f) || ARCHIV_EXTRA.test(f));
const want = new Map();   // key -> { key, kat, p4k, quelle }
const add = (key, kat, p4k, quelle) => { if (!want.has(key) && kat) want.set(key, { key, kat, p4k: p4k.replace(/\//g, '\\').replace(/^data\\/i, 'Data\\'), quelle }); };
const LINE_PIECE = /^cable_(straight|bend|corner|split|small)|^cable_floor|^hose_floor|lt_airduct_hose|maintenance_(cable|hose)|cable_terminal_\d_floor/;
const capped = { lager: 12, reinigung: 3 };
const taken = {};
for (const e of entries) {
  const isPiece = LINE_PIECE.test(e.key);
  if (!isPiece && e.count < 3) continue;
  if (/^roomsm_addon_cable/.test(e.key)) { taken.conduit = (taken.conduit || 0) + 1; if (taken.conduit > 3) continue; }
  const cap = capped[e.kat];
  if (cap && !isPiece) { taken[e.kat] = (taken[e.kat] || 0) + 1; if (taken[e.kat] > cap) continue; }
  add(e.key, e.kat, `Data/${e.path.replace(/^data[\\/]/i, '')}`, 'hangar');
}
for (const f of archivList) { const key = base(f); add(key, kategorie(key, f) || (/maintenance/i.test(f) ? 'werkzeug' : null), f, 'archiv'); }
console.log(`Auswahl: ${want.size} Requisiten (${[...want.values()].filter((w) => w.quelle === 'archiv').length} aus dem Archiv)`);

const GEO = `${OUT}geo/`; mkdirSync(GEO, { recursive: true });
const MRAW = `${RAW}mesh/`; mkdirSync(MRAW, { recursive: true });
let NodeIO;
({ NodeIO } = await import('@gltf-transform/core'));
const io = new NodeIO();
const trisOf = async (f) => { const d = await io.read(f); let t = 0; for (const m of d.getRoot().listMeshes()) for (const p of m.listPrimitives()) t += (p.getIndices()?.getCount() ?? 0) / 3; return Math.round(t); };
function readSubsets(buf) {
  const i32 = (o) => buf.readInt32LE(o);
  let best = null;
  for (let o = 0; o + 48 <= buf.length; o += 4) {
    if (i32(o + 4) !== 0 || i32(o + 12) !== 0 || i32(o + 16) !== 0) continue;
    const rows = []; let at = o, next = 0;
    while (at + 48 <= buf.length && i32(at + 4) === next && i32(at + 8) > 0 && i32(at + 8) % 3 === 0) { rows.push({ mat: buf.readUInt16LE(at), num: i32(at + 8) }); next += i32(at + 8); at += 48; }
    if (rows.length && (!best || rows.length > best.length)) best = rows;
  }
  return best;
}
// .mtl (XML): Untermaterialien in Reihenfolge, je mit Karten und Schichten
function parseMtl(xml) {
  const blocks = /<SubMaterials>/i.test(xml) ? xml.split(/<SubMaterials>/i)[1].split(/<Material\b/i).slice(1) : [xml.replace(/^[\s\S]*?<Material\b/i, '')];
  return blocks.map((block) => {
    const head = block.slice(0, block.indexOf('>'));
    const at = (src, k) => (src.match(new RegExp(`\\b${k}="([^"]*)"`, 'i')) || [])[1];
    const tex = (slot) => (block.match(new RegExp(`Map="${slot}"[^>]*File="([^"]*)"`, 'i')) || [])[1];
    const layers = [...(block.match(/<MatLayers>([\s\S]*?)<\/MatLayers>/i)?.[1] || '').matchAll(/<Layer\b([^>]*)\/?>/gi)].map((m) => ({
      name: at(m[1], 'Name'), path: at(m[1], 'Path'), tint: at(m[1], 'TintColor'), wearTint: at(m[1], 'WearTint'),
      glossMult: Number(at(m[1], 'GlossMult') ?? 1), uvTiling: Number(at(m[1], 'UVTiling') ?? 1), paletteTint: at(m[1], 'PaletteTint'),
    }));
    return {
      name: at(head, 'Name'), shader: at(head, 'Shader'), genMask: at(head, 'StringGenMask'), diffuse: at(head, 'Diffuse'), specular: at(head, 'Specular'),
      shininess: at(head, 'Shininess'), opacity: at(head, 'Opacity'), alphaTest: at(head, 'AlphaTest'),
      d: tex('TexSlot1'), n: tex('TexSlot2'), s: tex('TexSlot4'), wear: tex('TexSlot11'), blendMap: tex('TexSlot12'), layers,
    };
  });
}
const xmlOf = (f) => { let x = readFileSync(f, 'latin1'); if (x.startsWith('CryXmlB')) { if (!existsSync(`${f}.xml`)) spawnSync(STARBREAKER, ['cryxml', 'convert', f, `${f}.xml`]); x = existsSync(`${f}.xml`) ? readFileSync(`${f}.xml`, 'utf8') : ''; } return x; };
const BIG = /generator|forklift|trolley_cargo|crane|ladder|workbench|heater_large|shelf|server_rack|container_|cargo_container|shipping_container/;
const quellen = [];
const texPaths = new Set();
for (const w of want.values()) {
  let p4k = w.p4k.replace(/\.cga$/i, '.cgf');
  const limit = BIG.test(w.key) ? 20000 : 8000;
  let chosen = null;
  for (const lod of ['', '_lod1', '_lod2']) {
    const path = p4k.replace(/\.cgf$/i, `${lod}.cgf`);
    const glb = `${GEO}${w.key}${lod}.glb`;
    if (FORCE || !existsSync(glb)) { try { sb(['skin', 'export', path.replace(/^Data\\/i, ''), glb]); } catch { if (!lod) break; continue; } }
    const tris = await trisOf(glb);
    chosen = { lod: lod ? Number(lod.slice(4)) : 0, glb, tris, path };
    if (tris <= limit) break;
  }
  if (!chosen) { quellen.push({ ...w, missing: 'skin export' }); continue; }
  const dirRe = esc(chosen.path.replace(/^Data\\/i, '').replace(/\.cgf$/i, ''));
  sb(['p4k', 'extract', '-o', MRAW, '--regex', `(?i)${dirRe}\\.cgfm?$`]);
  const mf = listFiles(MRAW);
  const cgfFile = mf.find((f) => f.toLowerCase().endsWith(chosen.path.replace(/\\/g, '/').toLowerCase().replace(/^data\//, '/')));
  const cgfmFile = cgfFile && `${cgfFile}m`;
  const ids = cgfmFile && existsSync(cgfmFile) ? (readSubsets(readFileSync(cgfmFile)) || []).map((r) => r.mat) : [];
  // LOD-Stufen nennen kein Material; das steht nur in der Grund-.cgf
  let mtlSrc = cgfFile;
  if (chosen.lod) {
    const baseRe = esc(p4k.replace(/^Data\\/i, '').replace(/\.cgf$/i, ''));
    sb(['p4k', 'extract', '-o', MRAW, '--regex', `(?i)${baseRe}\\.cgf$`]);
    mtlSrc = listFiles(MRAW).find((f) => f.toLowerCase().endsWith(p4k.replace(/\\/g, '/').toLowerCase().replace(/^data\//, '/'))) || cgfFile;
  }
  const mtlPath = mtlSrc ? (readFileSync(mtlSrc, 'latin1').match(/(?:Data\/)?(?:objects|materials)\/[\w/.-]+(?=\0)/i) || [])[0]?.replace(/^Data\//i, '') : null;
  let subs = [];
  if (mtlPath) {
    sb(['p4k', 'extract', '-o', MRAW, '--regex', `(?i)${esc(mtlPath.replace(/\//g, '\\'))}\\.mtl$`]);
    const f = listFiles(MRAW).find((x) => x.toLowerCase().endsWith(`/${mtlPath.toLowerCase()}.mtl`));
    if (f) subs = parseMtl(xmlOf(f));
  }
  quellen.push({ ...w, lod: chosen.lod, glb: chosen.glb.slice(SRC.length), tris: chosen.tris, ids, mtl: mtlPath, subs });
}
// Schicht-.mtl (Basisschichten der LayerBlend-Materialien): Karten, Kachelung
const layerPaths = new Set(quellen.flatMap((q) => (q.subs || []).flatMap((s) => s.layers.map((l) => l.path).filter(Boolean))));
const layerInfo = {};
if (layerPaths.size) {
  const names = [...layerPaths].map((x) => x.split('/').pop());
  for (let i = 0; i < names.length; i += 40) sb(['p4k', 'extract', '-o', MRAW, '--regex', `(?i)[\\\\/](${names.slice(i, i + 40).map(esc).join('|')})$`]);
  const mf = listFiles(MRAW);
  for (const lp of layerPaths) {
    const f = mf.find((x) => x.toLowerCase().endsWith(`/${lp.toLowerCase()}`));
    if (!f) { layerInfo[lp] = { missing: true }; continue; }
    const m = parseMtl(xmlOf(f))[0] || {};
    const xml = xmlOf(f);
    layerInfo[lp] = { d: m.d ?? null, n: m.n ?? null, diffuse: m.diffuse, specular: m.specular, shininess: m.shininess, tiling: Number((xml.match(/LayerTiling="([^"]*)"/) || [])[1] || 1) };
  }
}
for (const q of quellen) for (const s of q.subs || []) {
  for (const t of [s.d, s.n]) if (t && !/^\$|defaults\//i.test(t)) texPaths.add(t);
  for (const l of s.layers) { const L = layerInfo[l.path]; if (L?.d) texPaths.add(L.d); if (L?.n) texPaths.add(L.n); }
}
// Karten dekodieren wie der Hallen-Extraktor (mip 1, _ddna mit Glätte)
let dec = 0;
for (const p of texPaths) {
  const rel = p.replace(/\\/g, '/').replace(/^data\//i, '').replace(/\.(tif|dds)$/i, '');
  const b = `${SRC}tex-m1/${rel.toLowerCase()}`;
  mkdirSync(dirname(b), { recursive: true });
  if (/_ddna$/i.test(rel) && !existsSync(`${b}.gloss.png`)) { try { sb(['dds', 'decode', `Data/${rel}.dds`, `${b}.gloss.png`, '--mip', '1', '--alpha']); } catch { /* ohne Glätte */ } }
  if (!existsSync(`${b}.png`)) { try { sb(['dds', 'decode', `Data/${rel}.dds`, `${b}.png`, '--mip', '1']); dec++; } catch { /* fehlt */ } }
}
writeFileSync(`${OUT}quellen.json`, JSON.stringify({ quellen, layers: layerInfo }, null, 1));
console.log(`Quellen: ${quellen.filter((q) => !q.missing).length} mit Geometrie (${quellen.filter((q) => q.missing).length} ohne), ${Object.keys(layerInfo).length} Schicht-.mtl, ${texPaths.size} Karten (${dec} neu dekodiert)`);

const withName = entries.filter((e) => e.name?.en).length, withDesc = entries.filter((e) => e.beschreibung?.en).length;
console.log(`Arten: ${entries.length} (≥ 3 Aufstellungen: ${entries.filter((e) => e.count >= 3).length}); mit Spielname ${withName}, mit Beschreibung ${withDesc}`);
console.log(`Kategorien: ${KATEGORIEN.map(([k]) => `${k} ${entries.filter((e) => e.kat === k).length}`).join(', ')}`);
console.log(`Arbeitsplätze: ${groups.length} Gruppen, ${sigs.size} Zusammensetzungen; Leitungen: ${lines.length}`);
for (const s of schiffe) console.log(`Schiff ${s.schiff}: ${s.anschluesse.length} Port-Zeilen mit Tank/Strom-Namen (Baum ${s.zeilen} Zeilen)`);
