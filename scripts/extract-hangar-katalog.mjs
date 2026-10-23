// Gerätekatalog für die Hangar-Seite (.planning/notes/hangar-katalog.md,
// Hallendeko .planning/notes/hangar-deko.md).
//
// Liest die Hallen des Spiels direkt aus ihren socpaks, ohne socpak-Export:
// Brushes und Decals aus der .soc (scripts/lib/soc-objects.mjs), Entities
// und Landefläche aus deren Entity-XML. Fundorte:
//   - die 111 Hangar-socpaks (Industrie util_a, Hightech, VFG Industrial,
//     Self-Land, Asteroidenbasen);
//   - Verteilzentren, Lagerhallen, Frachtdecks, Stations-Hangars,
//     Landezonen und Läden für Schiffsteile, je samt ihren Kind-Containern.
// Daraus:
//   - Inventar aller Requisiten; je Requisit Aufstellung (Boden/Wand/…,
//     Höhe, Abstand zu Feld und Wand, Ausrichtung), Zone (Feldrand, Halle,
//     Wand, Ecke, Decke, Tor), Stapel (worauf, was darauf, Stapelhöhe),
//     Reihen (Abstand, Länge, Gang), Nachbarn in 3 m, Zahl, Hallen;
//   - Zonen (Gruppen < 6 m) und für die Arbeitsplätze des Katalogs (K3) je
//     den Vertreter in Platzkoordinaten mit Wandseite;
//   - Spielname, Beschreibung, Typ und Tags aus DataCore und Lokalisierung;
//   - Boden-Decals für Zonen und Wege, projiziert und als Spiel-Mesh;
//   - Quellen für den Build: je Requisit Geometrie (skin export, für Items
//     entity export), Untermaterial-IDs, Material samt
//     Schichten (.mtl) und Karten.
// Welche Requisiten exportiert werden, steht im Katalog im Repo
// (public/hangar/props/katalog.json): Was dort steht, bleibt mit Knoten und
// Kategorie, wie es ist; neu ausgewählt werden nur die Kategorien der
// Hallendeko (NEU_KATEGORIEN). Fest dazu kommt die Fahrzeugwerkstatt
// (.planning/notes/hangar-fahrzeuge.md): Bodenfahrzeuge, ein Garagentor, Reifen.
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
// alle socpaks des Spiels, einmal ausgepackt (4,8 GB, rund 50 s)
const PAKS = fileURLToPath(new URL('../.cache/socpak-all/', import.meta.url));
const KATALOG = fileURLToPath(new URL('../public/hangar/props/katalog.json', import.meta.url));
const FORCE = process.argv.includes('--force');
mkdirSync(OUT, { recursive: true }); mkdirSync(`${RAW}soc/`, { recursive: true });

function sb(args) {
  const r = spawnSync(STARBREAKER, [...args, '--p4k', P4K], { encoding: 'utf8', maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' | '));
  return r.stdout;
}
const listFiles = (dir) => (existsSync(dir) ? readdirSync(dir, { recursive: true }).map((f) => `${dir}${String(f).replace(/\\/g, '/')}`) : []);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const base = (p) => String(p).replace(/\\/g, '/').split('/').pop().replace(/\.(cgf|cga|cdf|skin)$/i, '').toLowerCase();
const geoKey = (p) => String(p).replace(/\\/g, '/').replace(/^data\//i, '').toLowerCase();
const r3 = (v) => Math.round(v * 1000) / 1000;
const med = (a) => { if (!a.length) return null; const s = [...a].sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
const quant = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor((s.length - 1) * p)]; };
const count = (list, f) => list.reduce((o, x) => { const k = f(x); if (k != null) o[k] = (o[k] || 0) + 1; return o; }, {});

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
// Kategorien der Hallendeko (hangar-deko.md D2), geprüft vor den alten und
// nur für Arten, die noch nicht im Katalog stehen. Mobiliar, Wand- und
// Deckenteile gehören hier dazu; Fracht nur in den SCU-Maßen des Spiels
// (1 SCU = 1,25 m, im Namen 0125; 025 = 2,5 m … 1 = 10 m) samt Paletten.
const SCU = /(^|_)(0125|025|05|075|1|10)x(0125|025|05|075|1|10|5)x(0125|025|05|075|1|10)(_|$)|\d+scu/;
export const NEU_KATEGORIEN = [
  ['bauteile', /^(powr|cool|shld|qdrv)_|component_(rack|crate|stand)|engine_stand/],
  ['maschine', /lift_scissor|lift_platform|forklift_machine|trolley_pallet_powered|(^|_)crane_\d|hcrane|construction_scaffold/],
  ['decke', /hvac|light_hung|pulley|hoist|cable_rack|cable_tray|cable_hanging_[a-z]$|cable_sign_hanging/],
  ['wand', /relay_electrical|fuse_mounted|fusebox|breaker_|electrical_(box|panel)|control_panel|console_(desk|wall)(?!.*chair)|display_video_wall|nav_sign|sign_(warning|hazard|safety|caution|info)|(warning|danger|safety)_panel_sign|cable_terminal_\d_wall|(^|_)pipe_air|addon_cable_pipe|addon_pipe|pipe_addon|intercom/],
  ['regal', /shelf|shelves|(^|_)rack_(?!torpedo|overhead)|cargo_rack|storage_rack|racking/],
  ['fracht', /^cargo_(?!rack)|cargo_container|^crate_|^container_|^shipping_container|^storage_container|freight_container|box_wrapped|pallet_shipping|pallet_dumper|crate_dumper_pallet/, (n) => SCU.test(n) || /pallet|freight/.test(n)],
  ['crew', /locker|seat_(?!access)|bench(?!_work)|stool|chair|sofa|couch|(^|_)table_|desk|water_?cooler|vending|coffeemachine|coffee_?machine|trashcan|waste_bin|(^|_)bin_|fridge/],
];
const HARD_SKIP = /_lod\d|_proxy|_col$|_damaged|decal|anim$|_physicsgrid/;
const NEU_SET = new Set(NEU_KATEGORIEN.map(([k]) => k));
// Fahrzeugwerkstatt (.planning/notes/hangar-fahrzeuge.md): feste Auswahl, nicht aus dem
// Inventar. Fahrzeuge über ihre Entity (entity export), das Tor über einen Container,
// in dem das Spiel es aufstellt (die .cga gibt es nur als Entity mit Animation), Reifen
// und Räder als Lagerteile aus dem Archiv. Eine Hebebühne für Fahrzeuge hat das Spiel nicht.
const FAHRZEUGE = ['RSI_Ursa_Rover', 'TMBL_Cyclone', 'GRIN_ROC', 'GRIN_PTV'];
const TORE = [{ key: 'high_tech_garage_door_s', p4k: 'Objects/buildingsets/human/hightech/delta/int/garage/high_tech_garage_door_s.cga', socpak: 'shippart\\cousincrows\\cousincrows_orison.socpak' }];
// Nicht darunter, nach Sichtprüfung: racetrack_tyre_seat_a (der Reifenstapel als Sitz
// kommt als einzelner stehender Reifen heraus)
const REIFEN = ['ptv_tire', 'racetrack_tyre_1_a', 'landing_wheel_1_a', 'landing_wheel_2_a', 'landing_wheel_3_a'];
const FZ_SET = new Set(['fahrzeug', 'tor', 'reifen']);
// Bestand: was der Katalog im Repo führt, behält Kategorie und Knoten; seine
// Arbeitsplätze und Leitungen (K3) bleiben wörtlich, neu ist nur der Platz
const KAT0 = existsSync(KATALOG) ? JSON.parse(readFileSync(KATALOG, 'utf8')) : null;
const bestand = KAT0?.props ?? [];
if (!bestand.length) throw new Error(`${KATALOG} fehlt oder ist leer: den Katalog aus git wiederherstellen, er bestimmt die Auswahl`);
const BESTAND = new Map(bestand.map((p) => [base(p.path), p]));
const keyOfNode = new Map(bestand.map((p) => [p.node, base(p.path)]));
// Einteilung bis v2 für die Arbeitsplätze von K3: Bestand der alten Kategorien, sonst
// die alten Regeln, auch für Stücke, die inzwischen in einer neuen Kategorie stehen
const katAltOf = (key, ...paths) => { const b = BESTAND.get(key)?.kategorie; return b && !NEU_SET.has(b) && !FZ_SET.has(b) ? b : paths.map((p) => kategorie(key, p)).find(Boolean) ?? null; };
// Die Werkstatt-Stücke zählen im Inventar wie vor ihrer Aufnahme (sonst änderten sich
// Nachbarn und Zonen der übrigen Requisiten)
function katOf(key, path = '') {
  if (BESTAND.has(key) && !FZ_SET.has(BESTAND.get(key).kategorie)) return BESTAND.get(key).kategorie;
  const n = key.toLowerCase();
  if (HARD_SKIP.test(n)) return null;
  if (path && !PROPDIR.test(String(path).replace(/\\/g, '/'))) return null;
  for (const [k, re, ok] of NEU_KATEGORIEN) if (re.test(n) && (!ok || ok(n))) return k;
  return kategorie(n, path);
}

// ─── 1. Fundorte ────────────────────────────────────────────────────────
if (!existsSync(`${PAKS}Data`)) sb(['p4k', 'extract', '-o', PAKS, '--regex', '(?i)\\.socpak$']);
const OC = `${PAKS}Data/ObjectContainers/`;
const ALL = new Map(listFiles(OC).filter((f) => /\.socpak$/i.test(f)).map((f) => [f.slice(OC.length).toLowerCase(), f]));
const PAK_RE = /hangar\/(util_a|hightech_a)\/hangar_(medtop|lrgtop|smltop|medfrnt|lrgfrnt|lrgfront|smlfrnt|xltop)_00[123][^/]*\.socpak$|vfgindustrial\/[^/]*\.socpak$|selfland\/[^/]*\.socpak$|hangar_medfrnt_asteroidbase_[^/]*\.socpak$/;
// Wurzeln je Fundort (hangar-deko.md D1); dazu jeder Kind-Container, den sie nennen
const FUNDORTE = [
  ['verteilzentrum', /^pu\/loc\/mod\/ugf\/util\/layout\/(dc_final|dc_interiors)\/|^pu\/loc\/mod\/ugf\/util\/layout\/dc_(int|perimeter)/],
  ['lagerhalle', /^pu\/loc\/mod\/fob\/util\/compound\/(warehouse|cargo)\/|^pu\/loc\/mod\/outpost\/ht\/structure\/ht_freight/],
  ['frachtdeck', /^pu\/loc\/mod\/station\/util_a\/int\/module\/cargo\/|^pu\/loc\/mod\/station\/nyx\/int\/module\/(cargodeck|storage)\/|^pu\/loc\/mod\/(stanton|pyro)\/station\/ser\/reststop_cargo\/|^pu\/station\/reststop\/pyro\/rooms\/cargo_hub|^pu\/loc\/mod\/pyro\/asteroid_base\/ext\/ab_ext\/ab_cargo|^pu\/shops\/cargo_admin\/|^pu\/loc\/mod\/common\/ext_cargo\//],
  ['stationshangar', /^pu\/loc\/mod\/station\/(util_a|nyx)\/int\/module\/hangar\/|^pu\/loc\/mod\/nyx\/station\/ser\/reststop_hangar\/|^pu\/station\/reststop\/pyro\/rooms\/hangar\/|^pu\/loc\/mod\/(pyro|stanton)\/asteroid_base\/ext\/.*hangar|^pu\/loc\/mod\/nyx\/station\/asteroid_base\/hangars\//],
  ['landezone', /^pu\/loc\/flagship\/stanton\/[^/]+\/[^/]*_sp_int|^pu\/loc\/mod\/common\/hangar\/util_a\/cargo_elevator_|^pu\/shops\/commex\/tdd\//],
  ['laden', /^pu\/shops\/(shippart|dealership|service|shipweapon|salvage)\//],
];
// Aufzüge, Spawn-Kammern und Lichtsätze sind keine Hallen
const NOT_HALL = /^setup\/|\/lighting\//;
const kinder = (rel) => {
  const zip = readZip(readFileSync(ALL.get(rel)));
  const x = [...zip.keys()].find((n) => /^[^/]+\.xml$/i.test(n) && !/_editor\.xml$/i.test(n));
  return x ? [...zip.get(x)().toString('utf8').matchAll(/<Child\b[^>]*\bname="([^"]+\.socpak)"/gi)].map((m) => m[1].replace(/^data\/objectcontainers\//i, '').toLowerCase()) : [];
};
const fundort = new Map([...ALL.keys()].filter((r) => PAK_RE.test(r)).map((r) => [r, 'hangar']));
const wurzeln = {};
for (const [art, re] of FUNDORTE) {
  const stack = [...ALL.keys()].filter((r) => re.test(r));
  wurzeln[art] = stack.length;
  while (stack.length) {
    const r = stack.pop();
    if (fundort.has(r) || NOT_HALL.test(r) || !ALL.has(r)) continue;
    fundort.set(r, art);
    try { stack.push(...kinder(r)); } catch { /* socpak ohne lesbares XML */ }
  }
}
console.log(`Fundorte: ${Object.entries(count([...fundort.values()], (a) => a)).map(([a, n]) => `${a} ${n}`).join(', ')} socpaks`);

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
const dSize = dcbMap(`${AD}.Size`, 'dcb-size.txt');
const byGeo = new Map();
for (const [cls, p] of dGeo) { if (!p) continue; const b = base(p); if (!byGeo.has(b)) byGeo.set(b, []); byGeo.get(b).push(cls); }
// Farbpalette der Entity (TintPaletteRef): Schichten mit PaletteTint 1–3 nehmen im
// Spiel deren Einträge A–C statt ihrer TintColor (Stor*All-Kisten: dunkelgrau, grau, orange)
const dPal = dcbMap('Components[SGeometryResourceParams].Geometry.Geometry.Palette', 'dcb-palette.txt');
const lin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
function paletteOf(cls) {
  let root = null;
  try { root = JSON.parse(dPal.get(cls) || 'null')?.RootRecord?.root; } catch { root = null; }
  if (!root?.entryA) return null;
  const e = (x) => ({ tint: ['r', 'g', 'b'].map((k) => r3(lin(x.tintColor[k]))), spec: ['r', 'g', 'b'].map((k) => r3(lin(x.specColor[k]))), glossiness: x.glossiness });
  return { klasse: cls, name: root.name, a: e(root.entryA), b: e(root.entryB), c: e(root.entryC) };
}

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

// ─── 3. Hallen ──────────────────────────────────────────────────────────
const halls = [];
for (const [rel, art] of fundort) {
  const name = rel.split('/').pop().replace(/\.socpak$/i, '');
  const zip = readZip(readFileSync(ALL.get(rel)));
  const socName = [...zip.keys()].find((k) => k.toLowerCase().endsWith('.soc'));
  if (!socName) continue;
  const soc = zip.get(socName)();
  const { brushes, decals } = socObjects(soc);
  const xml = entityXml(soc, `${RAW}soc/${rel.replace(/\.socpak$/, '').replace(/\//g, '~')}`);
  const ents = [...xml.matchAll(/<Entity\b([^>]*)>([\s\S]*?)<\/Entity>|<Entity\b([^>]*)\/>/g)].map((m) => {
    const head = m[1] ?? m[3], body = m[2] || '';
    const at = (k) => (head.match(new RegExp(`\\b${k}="([^"]*)"`)) || [])[1];
    return { cls: at('EntityClass'), name: at('Name'), pos: String(at('Pos') || '0,0,0').split(',').map(Number), rot: at('Rotate'), body };
  });
  const la = ents.find((e) => e.cls === 'LandingArea');
  const dims = la && ['x', 'y', 'z'].map((k) => Number((la.body.match(new RegExp(`<dimensions[^>]*\\b${k}="([^"]*)"`)) || [])[1]));
  halls.push({ name, rel, art, brushes, decals, ents, la: la ? { pos: la.pos, rot: la.rot || null, dims } : null, offset: worldOffset(decals) });
}
// Dressing-socpaks (…_gh_dressing usw.) liegen im Raum ihrer Grundhalle: deren Feld nehmen
for (const h of halls) if (!h.la) {
  const parent = halls.filter((p) => p.la && p.art === h.art && h.name.startsWith(p.name)).sort((a, b) => b.name.length - a.name.length)[0];
  if (parent) { h.la = parent.la; h.laFrom = parent.name; }
  if (!h.offset && parent) h.offset = parent.offset;
}

// ─── 3a. Boxen im Container-Raum ────────────────────────────────────────
// Die Weltbox eines Brushes liegt im Raum der Spielwelt. In den meisten
// .soc ist sie nur verschoben (Versatz aus den Decals), in manchen aber mit
// dem Container gedreht (util_a/hangar_medtop_001: Mitte − Lage streut über
// 100 m). Darum: aus den sauberen .soc (Mitte − Lage der Requisiten streut
// unter 0,5 m) je Geometrie die lokale Box lernen, an Brushes mit Drehung in
// Vierteln um Z, und jede Box als Hülle der gedrehten lokalen Box neu
// berechnen. Ohne gelernte Box gilt die Weltbox − Versatz, aber nur in
// sauberen .soc.
for (const h of halls) {
  const pr = h.brushes.filter((b) => PROPDIR.test(b.cgf.replace(/\\/g, '/')));
  const all = pr.length >= 5 ? pr : h.brushes;
  if (all.length < 3) { h.clean = false; continue; }
  const dx = all.map((b) => (b.box[0] + b.box[3]) / 2 - b.m[3]), dy = all.map((b) => (b.box[1] + b.box[4]) / 2 - b.m[7]);
  h.spread = Math.max(quant(dx, 0.75) - quant(dx, 0.25), quant(dy, 0.75) - quant(dy, 0.25));
  h.clean = h.spread < 0.5;
  if (h.clean) h.boxOff = [med(dx), med(dy), h.decals.length ? h.offset[2] : med((pr.length ? pr : all).map((b) => b.box[2] - b.m[11]))];
}
const learned = new Map();
for (const h of halls.filter((x) => x.clean)) for (const b of h.brushes) {
  const m = b.m, sc = Math.hypot(m[0], m[4], m[8]);
  if (sc < 1e-3 || Math.abs(m[10] / sc - 1) > 1e-3) continue;
  const a = Math.atan2(m[4], m[0]), k = Math.round(a / (Math.PI / 2));
  if (Math.abs(a - k * Math.PI / 2) > 1e-3) continue;
  const t = [m[3], m[7], m[11]];
  const lo = [0, 1, 2].map((i) => b.box[i] - h.boxOff[i] - t[i]), hi = [0, 1, 2].map((i) => b.box[i + 3] - h.boxOff[i] - t[i]);
  const rot = (x, y) => [[x, y], [y, -x], [-x, -y], [-y, x]][((k % 4) + 4) % 4];
  const [ax, ay] = rot(lo[0], lo[1]), [bx, by] = rot(hi[0], hi[1]);
  const lb = [Math.min(ax, bx) / sc, Math.min(ay, by) / sc, lo[2] / sc, Math.max(ax, bx) / sc, Math.max(ay, by) / sc, hi[2] / sc];
  const g = geoKey(b.cgf);
  if (!learned.has(g)) learned.set(g, []);
  learned.get(g).push(lb);
}
const localBox = new Map([...learned].map(([g, list]) => [g, [0, 1, 2, 3, 4, 5].map((i) => med(list.map((l) => l[i])))]));
// m: Zeilenmatrix 3×4 (Spalten = lokale Achsen samt Maßstab, letzte Spalte = Lage)
function hull(m, lb) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < 8; i++) {
    const p = [lb[i & 1 ? 3 : 0], lb[i & 2 ? 4 : 1], lb[i & 4 ? 5 : 2]];
    for (let r = 0; r < 3; r++) { const v = m[r * 4] * p[0] + m[r * 4 + 1] * p[1] + m[r * 4 + 2] * p[2] + m[r * 4 + 3]; lo[r] = Math.min(lo[r], v); hi[r] = Math.max(hi[r], v); }
  }
  return [...lo, ...hi];
}

// ─── 3b. Objekte einer Halle ────────────────────────────────────────────
const quatMat = (q) => { // q = (w, x, y, z) wie Rotate der Entity-XML; Zeilen
  const [w, x, y, z] = q;
  return [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y), 2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x), 2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)];
};
const items = [];   // { hall, key, kat, path, kind, pos[3], ax[3], ay[3], scale, box?, b2? }
let boxLearned = 0, boxWorld = 0, boxNone = 0;
for (const h of halls) {
  h.items = [];
  for (const b of h.brushes) {
    const key = base(b.cgf), kat = katOf(key, b.cgf);
    const m = b.m;
    const lb = localBox.get(geoKey(b.cgf));
    const box = lb ? hull(m, lb) : h.clean ? [0, 1, 2, 3, 4, 5].map((i) => b.box[i] - h.boxOff[i % 3]) : null;
    if (lb) boxLearned++; else if (box) boxWorld++; else boxNone++;
    // katAlt: Einteilung des Katalogs bis v2, damit die Arbeitsplätze von K3 wiedergefunden werden
    const it = { hall: h, key, kat, katAlt: katAltOf(key, b.cgf), path: b.cgf, kind: 'brush', pos: [m[3], m[7], m[11]], ax: [m[0], m[4], m[8]], ay: [m[1], m[5], m[9]], scale: Math.hypot(m[0], m[4], m[8]), box, mat: b.material };
    h.items.push(it);
  }
  for (const e of h.ents) {
    const geo = dGeo.get(e.cls) || (e.body.match(/(?:Geometry|path)="([^"]+\.(?:cgf|cga))"/) || [])[1];
    if (!geo) continue;
    const key = base(geo), kat = katOf(key, geo) || katOf(String(e.cls || '').toLowerCase());
    const b0 = BESTAND.get(key)?.kategorie;
    const katAlt = b0 && !NEU_SET.has(b0) ? b0 : (kategorie(key, geo) || kategorie(String(e.cls || '').toLowerCase()));
    const r = e.rot ? quatMat(e.rot.split(',').map(Number)) : [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const m = [r[0], r[1], r[2], e.pos[0], r[3], r[4], r[5], e.pos[1], r[6], r[7], r[8], e.pos[2]];
    const lb = localBox.get(geoKey(geo));
    h.items.push({ hall: h, key, kat, katAlt, path: geo, kind: 'entity', cls: e.cls, pos: e.pos, ax: [r[0], r[3], r[6]], ay: [r[1], r[4], r[7]], scale: 1, box: lb ? hull(m, lb) : null });
  }
  for (const it of h.items) it.b2 = it.box ? [it.box[0], it.box[1], it.box[3], it.box[4]] : [it.pos[0] - 0.05, it.pos[1] - 0.05, it.pos[0] + 0.05, it.pos[1] + 0.05];
  items.push(...h.items);
}
const props = items.filter((i) => i.kat);
console.log(`Objekte: ${items.length}, davon Requisiten: ${props.length} in ${new Set(props.map((p) => p.key)).size} Arten; Boxen gelernt ${boxLearned}, Weltbox ${boxWorld}, ohne ${boxNone} (Brushes); saubere .soc ${halls.filter((h) => h.clean).length} von ${halls.length}`);

// Raster für Nachbarschaftsfragen (Container-Raum, 4 m)
function grid(list, cell = 4) {
  const g = new Map();
  const at = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  for (const it of list) {
    const [x0, y0, x1, y1] = it.b2;
    for (let x = Math.floor(x0 / cell); x <= Math.floor(x1 / cell); x++) for (let y = Math.floor(y0 / cell); y <= Math.floor(y1 / cell); y++) {
      const k = `${x},${y}`; if (!g.has(k)) g.set(k, []); g.get(k).push(it);
    }
  }
  return (x0, y0, x1, y1) => {
    const out = new Set();
    for (let x = Math.floor(x0 / cell); x <= Math.floor(x1 / cell); x++) for (let y = Math.floor(y0 / cell); y <= Math.floor(y1 / cell); y++) for (const it of g.get(`${x},${y}`) || []) out.add(it);
    return out;
  };
}
const gap2 = (a, b) => Math.hypot(Math.max(b[0] - a[2], 0, a[0] - b[2]), Math.max(b[1] - a[3], 0, a[1] - b[3]));

// ─── 4. Hallengeometrie: Boden, Wände, Tore ─────────────────────────────
// Nur aus Architektur (keine Requisite) mit Box. Boden: flache Platten
// (≤ 1,5 m hoch, ≥ 2 m²) oder Bodenteile nach Namen. Wand: aufrecht
// (≥ 2,4 m hoch), dünn (≤ 1,5 m) und lang (≥ 3,5 m; kürzere sind Rippen und
// Pfeiler, die sonst jede Wandstelle zur Ecke machten), dazu schmale Stücke
// mit „wall“ im Namen wie bisher. Tor: Türen und Tore ≥ 5 m breit und ≥ 3 m
// hoch.
const FLOOR_NAME = /floor|ground|deck|plate|tile|grate|platform|trench_cover/;
const DOOR_NAME = /door|gate|shutter|doorway/;
for (const h of halls) {
  const arch = h.items.filter((i) => !i.kat && i.box && !PROPDIR.test(String(i.path).replace(/\\/g, '/')));
  const ext = (b) => [b[3] - b[0], b[4] - b[1], b[5] - b[2]];
  h.floors = arch.filter((i) => { const [dx, dy, dz] = ext(i.box); return (dz <= 1.5 && dx * dy >= 2) || FLOOR_NAME.test(i.key); });
  h.walls = arch.filter((i) => {
    const [dx, dy, dz] = ext(i.box);
    if (DOOR_NAME.test(i.key) && !/wall/.test(i.key)) return false;
    return (dz >= 2.4 && Math.min(dx, dy) <= 1.5 && Math.max(dx, dy) >= 3.5) || (/wall/.test(i.key) && Math.min(dx, dy) < 3 && Math.max(dx, dy) >= 2 && dz >= 1);
  }).map((i) => ({ ...i, wart: 'bau', aspect: i.box[3] - i.box[0] >= i.box[4] - i.box[1] ? 'x' : 'y' }));
  h.doors = h.items.filter((i) => i.box && DOOR_NAME.test(i.key) && !/sign|decal|button|light|panel|trim/.test(i.key)).filter((i) => { const [dx, dy, dz] = ext(i.box); return Math.max(dx, dy) >= 5 && dz >= 3; });
  h.floorAt = grid(h.floors);
  h.wallAt = grid(h.walls);
  h.doorAt = grid(h.doors);
  h.allAt = grid(h.items.filter((i) => i.box));
}
// Oberkante des Bodens unter einem Punkt (höchste Platte, die nicht über der Unterkante liegt)
function floorUnder(h, x, y, z) {
  let best = null;
  for (const f of h.floorAt(x, y, x, y)) if (f.b2[0] - 0.05 <= x && x <= f.b2[2] + 0.05 && f.b2[1] - 0.05 <= y && y <= f.b2[3] + 0.05 && f.box[5] <= z + 0.15 && (best == null || f.box[5] > best)) best = f.box[5];
  return best;
}
// Wände an einem Stück. Zwei Arten:
//  - Bauwand (Box, wart "bau"): Abstand ist der Spalt zwischen den Boxen;
//    die Wandfläche liegt auf der Seite mit dem größeren Spalt (along "x" =
//    Wand verläuft entlang x, Fläche quer zu y). Das Seitenverhältnis der Box
//    taugt dafür nicht: kurze, dicke Wandstücke (2 × 3 m) kippten.
//  - Wandgerät (wart "geraet", Zeugen unten): Feuerschlauch, Verteilerdose,
//    Wandbildschirm … hängen an einer Wand, auch wo die Wand selbst nur in
//    einem riesigen Modul steckt (util_a/hangar_lrgfrnt_001: Bildschirme in
//    der Box eines 56 × 20 × 65 m großen Eingangsmoduls). Die Wandfläche ist
//    ihre Rückseite, ±4 m entlang; Vorderseite = lokale +Y, weg von der Wand.
// Je Stück die nächste Wand (bis 16 m) und die nächste quer dazu, die
// mindestens 3,5 m lang ist (2-m-Wandstücke und Laibungen an Türen machten
// sonst jede Türseite zur Ecke). Bauwände zählen, wo sie die Höhe des Stücks
// überdecken, Wandgeräte auf derselben Bodenhöhe.
const corners2 = (b2) => [[b2[0], b2[1]], [b2[2], b2[1]], [b2[0], b2[3]], [b2[2], b2[3]]];
function wallHit(it, w, z0, z1, fz) {
  if (w.wart === 'bau') {
    if (w.box[2] > z1 + 0.5 || w.box[5] < z0 + 0.2) return null;
    const gx = Math.max(w.b2[0] - it.b2[2], 0, it.b2[0] - w.b2[2]), gy = Math.max(w.b2[1] - it.b2[3], 0, it.b2[1] - w.b2[3]);
    const along = gy > gx ? 'x' : gx > gy ? 'y' : w.aspect;
    const len = along === 'x' ? w.b2[2] - w.b2[0] : w.b2[3] - w.b2[1];
    // Stirnseite einer Wand (unter 1 m) ist keine Wandfläche
    return len < 1 ? null : { w, d: Math.hypot(gx, gy), along, len };
  }
  if (fz == null || Math.abs(fz - w.z0) > 1.2 || w.src === it) return null;
  const cs = corners2(it.b2).map(([x, y]) => [(x - w.o[0]) * w.t[0] + (y - w.o[1]) * w.t[1], (x - w.o[0]) * w.n[0] + (y - w.o[1]) * w.n[1]]);
  if (Math.min(...cs.map((c) => Math.abs(c[0]))) > 4 || Math.max(...cs.map((c) => c[1])) < -0.3) return null;
  return { w, d: Math.max(0, Math.min(...cs.map((c) => c[1]))), along: w.along, len: 8 };
}
function wallsNear(it, z0, z1, fz, reach = 16) {
  const [x0, y0, x1, y1] = it.b2;
  const best = { x: null, y: null }, long = { x: null, y: null };
  for (const w of [...it.hall.wallAt(x0 - reach, y0 - reach, x1 + reach, y1 + reach), ...(it.hall.zeugeAt?.(x0 - 6, y0 - 6, x1 + 6, y1 + 6) ?? [])]) {
    const hit = wallHit(it, w, z0, z1, fz);
    if (!hit || hit.d > reach) continue;
    if (!best[hit.along] || hit.d < best[hit.along].d) best[hit.along] = hit;
    if (hit.len >= 3.5 && (!long[hit.along] || hit.d < long[hit.along].d)) long[hit.along] = hit;
  }
  const a = [best.x, best.y].filter(Boolean).sort((p, q) => p.d - q.d)[0];
  const b = a && long[a.along === 'x' ? 'y' : 'x'];
  return { w1: a ?? null, d1: a ? a.d : null, w2: b ?? null, d2: b ? b.d : null };
}
// Fläche einer Wand für den Platz: +z (ez) zur Wand, Ursprung auf der Fläche gegenüber der Mitte c
function faceOf(hit, c) {
  const w = hit.w;
  if (w.wart === 'geraet') { const s = (c[0] - w.o[0]) * w.n[0] + (c[1] - w.o[1]) * w.n[1]; return { ez: [-w.n[0], -w.n[1]], o: [c[0] - w.n[0] * s, c[1] - w.n[1] * s] }; }
  const b = w.b2;
  if (hit.along === 'x') { const s = (b[1] + b[3]) / 2 > c[1] ? 1 : -1; return { ez: [0, s], o: [c[0], s > 0 ? b[1] : b[3]] }; }
  const s = (b[0] + b[2]) / 2 > c[0] ? 1 : -1; return { ez: [s, 0], o: [s > 0 ? b[0] : b[2], c[1]] };
}
// Tor: fahrzeuggroße Öffnung (≥ 6 m breit, ≥ 5 m hoch) auf Höhe des Stücks
const doorDist = (it, z) => {
  let d = Infinity;
  for (const x of it.hall.doorAt(it.b2[0] - 8, it.b2[1] - 8, it.b2[2] + 8, it.b2[3] + 8)) {
    if (Math.max(x.box[3] - x.box[0], x.box[4] - x.box[1]) < 6 || x.box[5] - x.box[2] < 5 || x.box[2] > z + 1 || x.box[5] < z + 1) continue;
    d = Math.min(d, gap2(it.b2, x.b2));
  }
  return d;
};

// ─── 5. Aufstellung, Zone, Stapel ───────────────────────────────────────
// Worauf ein Stück steht: das Höchste, dessen Box die Mitte trägt und dessen
// Oberkante an der Unterkante liegt (±12 cm); in einem Regal das Regal; sonst
// der Boden. Was darauf steht, ist die Umkehrung.
const isCrate = (k) => /crate|cargo|container|box|drum|barrel|ammo|torpedo/.test(k) && !/pallet|rack|shelf|trolley/.test(k);
const supArt = (s) => (!s.kat ? 'boden' : /pallet/.test(s.key) ? 'palette' : s.kat === 'regal' || /shelf|rack/.test(s.key) ? 'regal' : /table|desk|counter|workbench|bench/.test(s.key) ? 'tisch' : isCrate(s.key) ? 'kiste' : 'geraet');
for (const p of props) {
  if (!p.box) continue;
  const [x, y] = [(p.box[0] + p.box[3]) / 2, (p.box[1] + p.box[4]) / 2], z = p.box[2];
  let sup = null, inShelf = null;
  for (const s of p.hall.allAt(x, y, x, y)) {
    if (s === p || !(s.b2[0] - 0.02 <= x && x <= s.b2[2] + 0.02 && s.b2[1] - 0.02 <= y && y <= s.b2[3] + 0.02)) continue;
    if (Math.abs(s.box[5] - z) <= 0.12 && (!sup || s.box[5] > sup.box[5]) && (s.box[5] - s.box[2]) > 0.02) sup = s;
    else if (s.kat && supArt(s) === 'regal' && s.box[2] + 0.1 < z && z < s.box[5] - 0.05) inShelf = s;
  }
  p.sup = sup || inShelf || null;
  if (p.sup?.kat) (p.sup.carries ||= []).push(p);
}
// Bodenhöhen einer Halle. Galerien und Leitstände stehen oft auf Böden aus
// anderen Containern (util_a/hangar_lrgfrnt_001: Stühle auf 20 m, darunter
// kein Brush). Darum zählt als Ebene jede Höhe, auf der mindestens drei
// aufrechte Bodenstücke (Kisten, Wagen, Sitze, Regale, Geräte) stehen, die
// nicht auf einer Requisite stehen; dazu die Landefläche.
const FLOOR_KATS = new Set(['fracht', 'lager', 'transport', 'crew', 'regal', 'maschine', 'energie', 'treibstoff', 'luft', 'munition', 'reinigung', 'heben', 'bauteile']);
for (const h of halls) {
  const bins = new Map();
  for (const p of h.items) {
    if (!FLOOR_KATS.has(p.kat) || p.sup?.kat || p.ax[0] * p.ay[1] - p.ax[1] * p.ay[0] < 0.9 * p.scale * p.scale) continue;
    const z = p.box ? p.box[2] : p.pos[2], k = Math.round(z / 0.05);
    if (!bins.has(k)) bins.set(k, []); bins.get(k).push(z);
  }
  const lv = [...bins.values()].filter((b) => b.length >= 3).map((b) => med(b));
  if (h.la) lv.push(h.la.pos[2]);
  h.levels = lv.sort((a, b) => a - b).filter((z, i, a) => !i || z - a[i - 1] > 0.3);
}
// Boden unter einem Stück: über die Requisiten, auf denen es steht, bis zum
// tragenden Bau; liegt der über 35 cm über der Ebene darunter, ist er ein
// Einbau (Konsole, Tresen) und der Boden die Ebene. Ohne Träger die höchste
// Ebene oder Bodenplatte nicht über der Unterkante.
const levelBelow = (h, z) => h.levels.filter((x) => x <= z + 0.15).pop() ?? null;
function floorOf(it, seen = new Set()) {
  if (it.sup?.kat && !seen.has(it)) { seen.add(it); return floorOf(it.sup, seen); }
  if (it.sup && !it.sup.kat) { const t = it.sup.box[5], lv = levelBelow(it.hall, t); return lv != null && t - lv > 0.35 ? lv : t; }
  const z = it.box ? it.box[2] : it.pos[2];
  const lv = levelBelow(it.hall, z), fu = floorUnder(it.hall, it.pos[0], it.pos[1], z);
  return lv == null ? fu : fu == null ? lv : Math.max(lv, fu);
}
function placement(it) {
  const h = it.hall, la = h.la;
  const bottom = it.box ? it.box[2] : it.pos[2], top = it.box ? it.box[5] : it.pos[2] + 0.5;
  const floorZ = floorOf(it);
  const hgt = floorZ != null ? bottom - floorZ : null;
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
  const wn = wallsNear(it, bottom, top, floorZ);
  const dWall = wn.d1;
  // Ort: liegend/hängend über die Hochachse; Höhe über dem Boden
  const up = [it.ax[1] * it.ay[2] - it.ax[2] * it.ay[1], it.ax[2] * it.ay[0] - it.ax[0] * it.ay[2], it.ax[0] * it.ay[1] - it.ax[1] * it.ay[0]];
  const upZ = up[2] / (Math.hypot(...up) || 1);
  let ort = 'boden';
  if (hgt != null && hgt > 2.6) ort = 'decke';
  else if (hgt != null && hgt > 0.35 && dWall != null && dWall < 0.8) ort = upZ < 0.7 ? 'wand' : 'regal';
  else if (hgt != null && hgt > 0.35) ort = 'tisch';
  // Zone in der Halle (hangar-deko.md D3), Vorrang in dieser Reihenfolge
  const dDoor = doorDist(it, bottom);
  let zone = 'halle';
  if (hgt != null && hgt > 2.6) zone = 'decke';
  else if (wn.d1 != null && wn.d1 <= 3 && wn.d2 != null && wn.d2 <= 3) zone = 'ecke';
  else if (wn.d1 != null && wn.d1 <= 1.5) zone = 'wand';
  else if (dDoor <= 8) zone = 'tor';
  else if (dField != null && dField <= 6) zone = 'feldrand';
  return { hgt, floorZ, dField, dWall, facing, ort, zone, walls: wn };
}
// Wandzeugen: Wandgerät, das frei (auf keiner Requisite) 0,3 bis 5 m über dem Boden hängt
const WANDGERAET = /fire_hose|extinguisher_cabinet|junctionbox|relay_electrical|fuse_mounted|display_video_wall|nav_sign|cable_terminal_\d_wall|extinguisher_1_mount|medical_kit|panel_engineering/;
let zeugen = 0;
for (const h of halls) {
  const zs = [];
  for (const p of h.items) {
    if (!p.kat || !WANDGERAET.test(p.key) || p.sup?.kat) continue;
    const fz = floorOf(p), bottom = p.box ? p.box[2] : p.pos[2];
    if (fz == null || bottom - fz < 0.3 || bottom - fz > 5) continue;
    const l = Math.hypot(p.ay[0], p.ay[1]);
    if (l < 0.9 * p.scale) continue;
    const n = [p.ay[0] / l, p.ay[1] / l];
    // Wandfläche an der hintersten Ecke der Box gegen die Vorderseite
    const back = p.box ? Math.min(0, ...corners2(p.b2).map(([x, y]) => (x - p.pos[0]) * n[0] + (y - p.pos[1]) * n[1])) : 0;
    const o = [p.pos[0] + n[0] * back, p.pos[1] + n[1] * back];
    zs.push({ wart: 'geraet', key: p.key, src: p, o, n, t: [-n[1], n[0]], z0: fz, along: Math.abs(n[1]) >= Math.abs(n[0]) ? 'x' : 'y', b2: [o[0] - 4, o[1] - 4, o[0] + 4, o[1] + 4] });
  }
  h.zeugeAt = grid(zs);
  zeugen += zs.length;
}
for (const p of props) p.pl = placement(p);
console.log(`Wände: ${halls.reduce((s, h) => s + h.walls.length, 0)} Bauwände in ${halls.filter((h) => h.walls.length).length} Hallen, ${zeugen} Wandgeräte als Zeugen; Ebenen je Halle im Mittel ${(halls.reduce((s, h) => s + h.levels.length, 0) / halls.length).toFixed(1)}`);

// Kisten in einer Säule: darunter (über Kisten bis zum Boden oder zur Palette) und darüber
const below = (p, seen = new Set()) => (p.sup?.kat && isCrate(p.sup.key) && !seen.has(p) ? 1 + below(p.sup, seen.add(p)) : 0);
const above = (p, seen = new Set()) => (seen.has(p) ? 0 : (seen.add(p), Math.max(0, ...(p.carries || []).filter((c) => isCrate(c.key)).map((c) => 1 + above(c, seen)))));

const byKey = new Map();
for (const p of props) { if (!byKey.has(p.key)) byKey.set(p.key, []); byKey.get(p.key).push(p); }
const byHall = new Map(halls.map((h) => [h, h.items.filter((p) => p.kat)]));
const d3 = (a, b) => Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1], a.pos[2] - b.pos[2]);
const propAt = new Map(halls.map((h) => [h, grid(byHall.get(h).map((p) => ({ ...p, b2: [p.pos[0], p.pos[1], p.pos[0], p.pos[1]], src: p })), 6)]));
const nearProps = (p, r) => [...propAt.get(p.hall)(p.pos[0] - r, p.pos[1] - r, p.pos[0] + r, p.pos[1] + r)].map((x) => x.src).filter((q) => q !== p && d3(p, q) < r);

// ─── 5a. Reihen: gleiche Stücke in einer Flucht, gleich ausgerichtet ────
// je Halle und Art: nach Richtung der lokalen X (auf 5°, ohne Vorzeichen),
// dann nach dem Versatz quer dazu (0,3 m), dann entlang; eine Reihe hat
// mindestens drei Stücke ohne Lücke über dem Doppelten des üblichen Abstands.
function rowsOf(list) {
  const out = [];
  const dirs = new Map();
  for (const p of list) {
    const a = ((Math.round((Math.atan2(p.ax[1], p.ax[0]) * 180) / Math.PI / 5) * 5) % 180 + 180) % 180;
    if (!dirs.has(a)) dirs.set(a, []); dirs.get(a).push(p);
  }
  for (const [a, ps] of dirs) {
    if (ps.length < 3) continue;
    const u = [Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180)], v = [-u[1], u[0]];
    const pts = ps.map((p) => ({ p, u: p.pos[0] * u[0] + p.pos[1] * u[1], v: p.pos[0] * v[0] + p.pos[1] * v[1] })).sort((x, y) => x.v - y.v);
    const lines = []; let cur = [pts[0]];
    for (const q of pts.slice(1)) { if (q.v - cur[cur.length - 1].v > 0.3) { lines.push(cur); cur = []; } cur.push(q); }
    lines.push(cur);
    for (const line of lines) {
      line.sort((x, y) => x.u - y.u);
      const gaps = line.slice(1).map((q, i) => q.u - line[i].u).filter((g) => g > 0.05);
      if (gaps.length < 2) continue;
      const g0 = med(gaps);
      let run = [line[0]];
      const flush = () => { if (run.length >= 3) out.push({ a, u, v, run, vpos: med(run.map((x) => x.v)) }); };
      // gleiche Stelle (gestapelt) zählt einmal
      for (let i = 1; i < line.length; i++) { const g = line[i].u - line[i - 1].u; if (g <= 0.05) continue; if (g > 2 * g0 + 0.3 || g > 12) { flush(); run = []; } run.push(line[i]); }
      flush();
    }
  }
  return out.map((r) => {
    const gaps = r.run.slice(1).map((q, i) => q.u - r.run[i].u);
    const p0 = r.run[0].p;
    const along = p0.box ? Math.abs(r.u[0]) > 0.7 ? p0.box[3] - p0.box[0] : p0.box[4] - p0.box[1] : med(gaps);
    const depth = p0.box ? Math.abs(r.u[0]) > 0.7 ? p0.box[4] - p0.box[1] : p0.box[3] - p0.box[0] : 0;
    return { ...r, abstand: med(gaps), laenge: r.run[r.run.length - 1].u - r.run[0].u + along, stueck: r.run.length, depth, u0: r.run[0].u, u1: r.run[r.run.length - 1].u };
  });
}
const rowStats = new Map();   // key -> { rows: [], hallen: Set }
for (const [h, list] of byHall) {
  const per = new Map();
  for (const p of list) { if (p.pl.hgt != null && p.pl.hgt > 2.6) continue; if (!per.has(p.key)) per.set(p.key, []); per.get(p.key).push(p); }
  for (const [key, ps] of per) {
    if (ps.length < 3) continue;
    const rows = rowsOf(ps);
    for (const r of rows) {
      // Gang: nächste parallele Reihe derselben Art, die sich entlang überdeckt; lichte Weite ohne Tiefe
      const others = rows.filter((o) => o !== r && o.a === r.a && Math.min(r.u1, o.u1) - Math.max(r.u0, o.u0) > 0.3 * (r.u1 - r.u0));
      const clear = others.map((o) => Math.abs(o.vpos - r.vpos) - r.depth).filter((g) => g > -0.2);
      // über 12 m liegt zwischen zwei Reihen kein Gang mehr, sondern Halle
      r.gang = clear.filter((g) => g > 0.5 && g <= 12).sort((x, y) => x - y)[0] ?? null;
      r.doppelt = clear.some((g) => g <= 0.5);
    }
    if (!rows.length) continue;
    const e = rowStats.get(key) || { rows: [], hallen: new Set() };
    e.rows.push(...rows); e.hallen.add(h.name); rowStats.set(key, e);
  }
}

// ─── 5b. Einträge je Art ────────────────────────────────────────────────
const hallFamily = (n) => n.replace(/_(gh|nyx|levski|lorville|a18|law|occu|rund|rest|dressing|delving|tsg|dc|distributioncenter|newbab|orison|static|gm|ugf|fleet_week|cargo_test)(_.*)?$/, '');
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
    for (const q of nearProps(p, 3)) {
      const d = d3(p, q);
      if (!seenK.has(q.key)) { seenK.add(q.key); const e = nk.get(q.key) || { n: 0, d: [] }; e.n++; e.d.push(d); nk.set(q.key, e); }
      if (!seenC.has(q.kat)) { seenC.add(q.kat); const e = nc.get(q.kat) || { n: 0, d: [] }; e.n++; e.d.push(d); nc.set(q.kat, e); }
    }
  }
  const nb = (m, field) => [...m].map(([k, e]) => ({ [field]: k, anteil: r3(e.n / list.length), abstand: r3(e.d.reduce((s, x) => s + x, 0) / e.d.length) })).sort((a, b) => b.anteil - a.anteil);
  // Zone: Anteil je Zone über alle Aufstellungen
  const zc = count(pl, (x) => x.zone);
  const zone = { n: list.length, anteile: Object.fromEntries(['feldrand', 'halle', 'wand', 'ecke', 'decke', 'tor'].map((z) => [z, r3((zc[z] || 0) / list.length)])) };
  // Stapel: worauf (Art des Trägers, bei Requisiten die Art selbst) und was darauf
  const withBox = list.filter((p) => p.box);
  const aufM = new Map();
  // ohne Träger: auf Bodenhöhe der Boden (er liegt dann in einem anderen Container), sonst hängt es
  const onFloor = (p) => p.pl.hgt != null && Math.abs(p.pl.hgt) <= 0.15;
  for (const p of withBox) {
    const k = p.sup ? (p.sup.kat ? `${supArt(p.sup)}|${p.sup.key}` : onFloor(p) ? 'boden|' : `bau|${p.sup.key}`) : onFloor(p) ? 'boden|' : 'haengt|';
    const e = aufM.get(k) || { n: 0, h: [] }; e.n++; if (p.pl.hgt != null) e.h.push(p.pl.hgt); aufM.set(k, e);
  }
  const traeger = withBox.filter((p) => p.carries?.length);
  const tM = new Map();
  for (const p of traeger) for (const k of new Set(p.carries.map((c) => c.key))) tM.set(k, (tM.get(k) || 0) + 1);
  // Stapelhöhe: Kisten in der Säule jeder Aufstellung
  const cols = isCrate(key) ? withBox.map((p) => 1 + below(p) + above(p)) : [];
  const stapel = withBox.length ? {
    n: withBox.length,
    auf: [...aufM].map(([k, e]) => { const [art, node] = k.split('|'); return { art, ...(node ? { node } : {}), anteil: r3(e.n / withBox.length), hoehe: e.h.length ? r3(med(e.h)) : null }; }).sort((a, b) => b.anteil - a.anteil).slice(0, 6),
    traegt: { anteil: r3(traeger.length / withBox.length), arten: [...tM].map(([k, n]) => ({ node: k, anteil: r3(n / withBox.length) })).sort((a, b) => b.anteil - a.anteil).slice(0, 6) },
    saeule: cols.length >= 3 ? { median: med(cols), max: Math.max(...cols), n: cols.length } : null,
  } : null;
  const rs = rowStats.get(key);
  const reihen = rs ? {
    n: rs.rows.length, hallen: rs.hallen.size, stueck: med(rs.rows.map((r) => r.stueck)), abstand: r3(med(rs.rows.map((r) => r.abstand))),
    laenge: r3(med(rs.rows.map((r) => r.laenge))), gang: rs.rows.some((r) => r.gang != null) ? r3(med(rs.rows.filter((r) => r.gang != null).map((r) => r.gang))) : null,
    doppelreihen: rs.rows.filter((r) => r.doppelt).length,
  } : null;
  // Spieldaten über die Entity, die diese Geometrie trägt
  const classes = byGeo.get(key) || [];
  const used = list.find((p) => p.cls)?.cls;
  const cls = used || classes.find((c) => loc(dName.get(c), EN)) || classes[0] || null;
  // Material-Überschreibung der Brushes (manche .cgf nennen selbst keine .mtl): die häufigste
  const mats = Object.entries(count(list, (p) => p.mat || null)).sort((a, b) => b[1] - a[1]);
  entries.push({
    key, kat: list[0].kat, path: list[0].path, count: list.length, hallen: new Set(list.map((p) => hallFamily(p.hall.name))).size,
    ...(mats.length ? { material: mats[0][0] } : {}),
    from: [...new Set(list.map((p) => p.hall.name))].sort(), fundorte: count(list, (p) => p.hall.art),
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
    zone, stapel, reihen,
    nachbarn: [...nb(nc, 'kategorie').slice(0, 6), ...nb(nk, 'node').slice(0, 8)],
  });
}
entries.sort((a, b) => b.count - a.count);

// ─── 6. Platzkoordinaten mit Wandseite (hangar-deko.md D4) ──────────────
// +z zeigt zur nächsten Wand (≤ 3 m von einem Mitglied), z = 0 ist die
// Wandfläche, x = 0 die Gruppenmitte entlang der Wand; Drehung 0 heißt
// Vorderseite des Spiels (lokale +Y, im GLB −z) zur Halle. Ohne Wand: +z zur
// Feldmitte (achse "feld"), ohne Feld die Achsen der Halle (achse "halle",
// +z = Spiel −Y wie im GLB). Höhe y über dem Boden darunter.
function platz(members) {
  const h = members[0].hall;
  const c = [0, 1].map((k) => members.reduce((s, x) => s + x.pos[k], 0) / members.length);
  let best = null;
  for (const m of members) { const w = m.pl.walls; if (w.w1 && w.d1 <= 3 && (!best || w.d1 < best.d)) best = { hit: w.w1, d: w.d1, hit2: w.w2, d2: w.d2 }; }
  let ez, o, wand = null, ecke = null, achse = 'wand';
  if (best) {
    ({ ez, o } = faceOf(best.hit, c));
    wand = { abstand: r3(best.d), aus: best.hit.w.wart === 'bau' ? 'bauwand' : 'wandgeraet', ...(best.hit.w.wart === 'bau' ? { laenge: r3(best.hit.len) } : { geraet: best.hit.w.key }) };
  } else if (h.la) {
    const t = [h.la.pos[0] - c[0], h.la.pos[1] - c[1]], n = Math.hypot(...t) || 1;
    ez = [t[0] / n, t[1] / n]; o = c; achse = 'feld';
  } else { ez = [0, -1]; o = c; achse = 'halle'; }
  const ex = [-ez[1], ez[0]];
  const P = (p) => [(p[0] - o[0]) * ex[0] + (p[1] - o[1]) * ex[1], (p[0] - o[0]) * ez[0] + (p[1] - o[1]) * ez[1]];
  if (best?.hit2 && best.d2 <= 3) ecke = { x: r3(P(faceOf(best.hit2, c).o)[0]), abstand: r3(best.d2) };
  const rot = (m) => { const n = Math.hypot(m.ax[0], m.ax[1]) || 1, a = [m.ax[0] / n, m.ax[1] / n]; return r3((Math.atan2(-(a[0] * ez[0] + a[1] * ez[1]), a[0] * ex[0] + a[1] * ex[1]) * 180) / Math.PI); };
  const mitglieder = members.map((m) => { const [x, z] = P(m.pos); return { key: m.key, kat: m.kat, at: [r3(x), r3(z), rot(m)], y: r3(m.pl.hgt ?? 0) }; });
  const xs = mitglieder.map((m) => m.at[0]), zs = mitglieder.map((m) => m.at[1]);
  return { achse, wand, ecke, flaeche: [r3(Math.max(...xs) - Math.min(...xs)), r3(Math.max(...zs) - Math.min(...zs))], mitglieder };
}

// Gruppen durch Einzelverkettung (Abstand < r)
function cluster(list, r) {
  const at = grid(list.map((p) => ({ b2: [p.pos[0], p.pos[1], p.pos[0], p.pos[1]], src: p })), Math.max(r, 2));
  const seen = new Set(), out = [];
  for (const p of list) {
    if (seen.has(p)) continue;
    const g = [p]; seen.add(p);
    for (let i = 0; i < g.length; i++) { const x = g[i]; for (const q of at(x.pos[0] - r, x.pos[1] - r, x.pos[0] + r, x.pos[1] + r)) if (!seen.has(q.src) && d3(x, q.src) < r) { seen.add(q.src); g.push(q.src); } }
    out.push(g);
  }
  return out;
}

// ─── 6a. Arbeitsplätze: Gruppen < 2,5 m ─────────────────────────────────
// Die Arbeitsplätze des Katalogs (K3) bleiben, wie sie sind. Für den Platz
// ihres Vertreters mit Wandseite wird die Gruppe wie in K3 neu gebildet (nur
// Hangars, Einteilung bis v2 = katAlt) und über Halle und Mitglieder
// wiedergefunden; Reihenfolge und Gleichstand spielen so keine Rolle.
const groups = [];
for (const [h, list] of byHall) {
  if (h.art !== 'hangar') continue;
  const work = list.filter((p) => p.katAlt && (p.katAlt !== 'kabel' || /reel|terminal|box/.test(p.key)));
  for (const g of cluster(work, 2.5)) if (g.length >= 2) groups.push({ hall: h.name, members: g });
}
const membersKey = (keys) => [...keys].sort().join('|');
const groupBy = new Map(groups.map((g) => [`${g.hall}#${membersKey(g.members.map((m) => m.key))}`, g]));
const arbeitsplaetze = (KAT0.arbeitsplaetze || []).map((a) => {
  const g = groupBy.get(`${a.halle}#${membersKey(a.mitglieder.map((m) => keyOfNode.get(m.node) ?? m.node))}`);
  return { ...a, platz: g ? platz(g.members) : null };
});
console.log(`Arbeitsplätze: ${arbeitsplaetze.filter((a) => a.platz).length} von ${arbeitsplaetze.length} mit Platz (${groups.length} Gruppen in den Hangars)`);

// ─── 6b. Zonen: Gruppen < 6 m (Lager, Frachtstapel, Crew-Ecke …) ─────────
// Mitglieder: was am Boden oder darauf steht, ohne Wand- und Deckenteile,
// ohne Leitungsstücke und ohne Kleinteile unter 25 cm. Zusammensetzung = die
// Kategorien mit mindestens 20 % der Mitglieder (höchstens drei). Vertreter:
// die Gruppe mit der mittleren Größe ihrer Zusammensetzung (bis 120 Stück).
const LINE = /^cable_(straight|bend|corner|split|small)|^cable_floor|^cables_a_|^hose_floor(?!_\d_socket)|maintenance_(cable|hose)|lt_airduct_hose_(straight|corner|junction|torn)|cable_terminal_\d_floor/;
const zoneGroups = [];
for (const [h, list] of byHall) {
  const zl = list.filter((p) => !(p.pl.hgt != null && p.pl.hgt > 2.6) && !['wand', 'decke'].includes(p.kat) && !LINE.test(p.key) && (p.kat !== 'kabel' || /reel/.test(p.key))
    && (!p.box || Math.max(p.box[3] - p.box[0], p.box[4] - p.box[1], p.box[5] - p.box[2]) >= 0.25));
  for (const g of cluster(zl, 6)) {
    if (g.length < 3) continue;
    const kc = Object.entries(count(g, (x) => x.kat)).sort((a, b) => b[1] - a[1]);
    const sig = kc.filter(([, n]) => n / g.length >= 0.2).slice(0, 3).map(([k]) => k).sort().join('+') || kc[0][0];
    zoneGroups.push({ hall: h, sig, members: g });
  }
}
const zsig = new Map();
for (const g of zoneGroups) { if (!zsig.has(g.sig)) zsig.set(g.sig, []); zsig.get(g.sig).push(g); }
const zonen = [];
for (const [sig, gs] of zsig) {
  if (gs.length < 3) continue;
  const sizes = gs.map((g) => g.members.length), m = med(sizes);
  const pool = gs.filter((g) => g.members.length <= 120);
  const rep = (pool.length ? pool : gs).sort((a, b) => Math.abs(a.members.length - m) - Math.abs(b.members.length - m) || a.hall.name.localeCompare(b.hall.name))[0];
  zonen.push({
    name: sig, n: gs.length, hallen: new Set(gs.map((g) => g.hall.name)).size, fundorte: count(gs, (g) => g.hall.art),
    groesse: { median: m, min: Math.min(...sizes), max: Math.max(...sizes) },
    halle: rep.hall.name, art: rep.hall.art, ...platz(rep.members),
  });
}
zonen.sort((a, b) => b.n - a.n);

// ─── 8. Schiffsseite: Item-Ports mit Tank-/Stromnamen ──────────────────
const SHIPS = ['AEGS_Gladius', 'DRAK_Cutlass_Black', 'RSI_Constellation_Andromeda'];
const schiffe = [];
for (const s of SHIPS) {
  let tree = '';
  try { tree = sb(['entity', 'loadout', s]); } catch (e) { tree = ''; }
  const hits = tree.split('\n').filter((l) => /fuel|refuel|intake|umbilical|power_?port|ground_?power|nozzle/i.test(l)).map((l) => l.trim());
  schiffe.push({ schiff: s, anschluesse: hits.slice(0, 40), zeilen: tree.split('\n').length });
}

// ─── 9. Boden-Decals (hangar-deko.md D2, Punkt 4) ───────────────────────
// Projizierte Decals (Satztyp 0x10) auf dem Boden: Drehung nur um Z. Dazu
// Boden-Meshes für Wege und Zonen (Linien, Ecken, Ziffern) und Abflussgitter.
// Rolle aus dem Namen; die Öl-, Reifen- und Schleifspuren des Wartungsplatzes
// (werkstatt-boden.glb) stehen dort schon.
// erster Treffer gewinnt: Spuren vor Markierungen (oil_line, tire_marks_corner), Gitter vor Feldern (square_cover)
const BODEN_ROLLE = [
  ['oel', /oil/],
  ['reifenspur', /tire|tyre/],
  ['schleifspur', /scuff|skid|streak_swirl/],
  ['gitter', /drain|grate|trench_cover|_cover_/],
  ['ziffer', /number_\d|nmbr|digit|letter/],
  ['schraffur', /warning_strip|caution|hazard|chevron|stripe/],
  ['pfeil', /arrow/],
  ['parkfeld', /square|corner|walkzone|parking|redcross|floor_decal_\d/],
  ['linie', /line|_decal_\d+m_|decal_set/],
];
// Staub, Pfützen und Logos einzelner Orte sind keine Zonen- oder Wegmarke
const rolleOf = (n) => (/dust|grime|puddle|moss|logo|sand/.test(n) ? null : BODEN_ROLLE.find(([, re]) => re.test(n))?.[0] ?? null);
const WERK_BODEN = new Set(existsSync(fileURLToPath(new URL('../public/hangar/hall/werkstatt.json', import.meta.url))) ? JSON.parse(readFileSync(fileURLToPath(new URL('../public/hangar/hall/werkstatt.json', import.meta.url)), 'utf8')).decals.map((d) => d.path) : []);
const quadStat = new Map();
for (const h of halls) for (const d of h.decals) {
  if (!d.material || Math.abs(d.q[0]) >= 0.02 || Math.abs(d.q[1]) >= 0.02) continue;
  const n = d.material.split('/').pop();
  const rolle = rolleOf(n) || (/manmade_marking/.test(d.material) && !/logo/.test(n) ? 'markierung' : null);
  if (!rolle) continue;
  const e = quadStat.get(d.material) || { material: d.material, rolle, n: 0, edges: [], hallen: new Set(), fundorte: {} };
  e.n++; e.edges.push(2 * d.half); e.hallen.add(h.name); e.fundorte[h.art] = (e.fundorte[h.art] || 0) + 1; quadStat.set(d.material, e);
}
const meshStat = new Map();
for (const h of halls) for (const it of h.items) {
  if (it.kind !== 'brush' || !/decal|drain|grate|trench_cover|secondary_number/.test(it.key) || /light|lob_decal|pipe|panel|screen|ceiling|hangingframes/.test(it.key)) continue;
  const rolle = rolleOf(it.key); if (!rolle) continue;
  // flach auf dem Boden: aufrecht eingesetzt und höchstens 30 cm über dem Boden darunter
  const up = it.ax[0] * it.ay[1] - it.ax[1] * it.ay[0];
  const bottom = it.box ? it.box[2] : it.pos[2], fu = floorUnder(h, it.pos[0], it.pos[1], bottom) ?? h.la?.pos[2];
  const flat = it.scale > 0 && up / (it.scale * it.scale) > 0.99 && (fu == null || bottom - fu < 0.3);
  const e = meshStat.get(it.key) || { key: it.key, path: it.path, rolle, n: 0, flach: 0, hallen: new Set(), fundorte: {} };
  e.n++; if (flat) e.flach++; e.hallen.add(h.name); e.fundorte[h.art] = (e.fundorte[h.art] || 0) + 1; meshStat.set(it.key, e);
}
const BODEN_KAPPE = 6;
const pickBy = (list, f) => { const per = {}; return list.filter((x) => { const k = f(x); per[k] = (per[k] || 0) + 1; return per[k] <= BODEN_KAPPE; }); };
// gleichnamige Materialien aus zwei Ordnern (oil/fs_oil_dirt, weathered/fs_oil_dirt): das häufigere
const quadNames = new Set();
const quads = pickBy([...quadStat.values()].filter((e) => e.n >= 3 && !WERK_BODEN.has(e.material)).sort((a, b) => b.n - a.n), (e) => e.rolle)
  .filter((e) => { const n = e.material.split('/').pop(); if (quadNames.has(n)) return false; quadNames.add(n); return true; });
// Ziffern: der ganze Satz 0–9, auch die, die das Spiel nur an Wände setzt
const meshes = pickBy([...meshStat.values()].filter((e) => (e.rolle === 'ziffer' && /secondary_number_\d$/.test(e.key)) || (e.n >= 3 && e.flach / e.n >= 0.25)).sort((a, b) => b.n - a.n), (e) => (e.rolle === 'ziffer' ? `${e.rolle}${e.key}` : e.rolle));

writeFileSync(`${OUT}inventar.json`, JSON.stringify({
  hallen: halls.map((h) => ({ name: h.name, rel: h.rel, art: h.art, feld: h.la?.dims ?? null, feldVon: h.laFrom ?? null, versatz: !!h.offset, sauber: h.clean, brushes: h.brushes.length, entities: h.ents.length, waende: h.walls.length, boeden: h.floors.length, tore: h.doors.length })),
  fundorte: Object.fromEntries(['hangar', ...FUNDORTE.map(([a]) => a)].map((a) => {
    const hs = halls.filter((h) => h.art === a), ps = props.filter((p) => p.hall.art === a);
    return [a, { wurzeln: wurzeln[a] ?? null, socpaks: hs.length, brushes: hs.reduce((s, h) => s + h.brushes.length, 0), entities: hs.reduce((s, h) => s + h.ents.length, 0), requisiten: ps.length, arten: new Set(ps.map((p) => p.key)).size, kategorien: count(ps, (p) => p.kat) }];
  })),
  boxen: { gelernt: localBox.size, brushesGelernt: boxLearned, brushesWeltbox: boxWorld, brushesOhne: boxNone },
  entries, arbeitsplaetze, zonen, leitungen: KAT0.leitungen || [], schiffe,
  boden: { quads: quads.map((e) => ({ ...e, hallen: e.hallen.size, edges: undefined, kante: r3(med(e.edges)) })), meshes: meshes.map((e) => ({ ...e, hallen: e.hallen.size })) },
}, null, 1));

// ─── 10. Auswahl und Quellen für den Build ──────────────────────────────
// Ausgewählt werden:
//  - alles, was der Katalog im Repo führt (Bestand, gleiche Kategorie und
//    Quelle, in derselben Reihenfolge: die Kategorie-Dateien bleiben gleich);
//  - je neuer Kategorie die häufigsten Arten aus allen Fundorten
//    (≥ 3 Aufstellungen, höchstens KAPPE, je Familie zwei), dazu Stücke aus
//    dem Archiv (ARCHIV_NEU: die SCU-Reihe der Standardkiste, Wasserspender,
//    Hubbühnen, Krane) und die Schiffsbauteile S1–S3 als Items (entity export).
// Je Requisit: Geometrie per skin export (volle Stufe, sonst _lod1/_lod2
// bis ≤ 8 000 Dreiecke, große Geräte ≤ 20 000; Items per
// entity export über --lod), Untermaterial-IDs aus der .cgfm (beim entity
// export über den Namen des Untermaterials), Material der Geometrie samt
// Schichten (<MatLayers>) und Karten.
const want = new Map();   // key -> { key, kat, p4k, quelle, klasse?, ersatz? }
// klasse: Geometrie per entity export (Items); ersatz: Entity, falls der skin export fehlt (.cga ohne .cgf)
const add = (key, kat, p4k, quelle, klasse = null, ersatz = null) => { if (!want.has(key) && kat) want.set(key, { key, kat, p4k: p4k.replace(/\//g, '\\').replace(/^data\\/i, 'Data\\'), quelle, ...(klasse ? { klasse } : {}), ...(ersatz ? { ersatz } : {}) }); };
for (const p of bestand) add(base(p.path), p.kategorie, `Data/${p.path}`, p.quelle?.geometrie ?? 'hangar', p.quelle?.geometrie === 'item' ? p.klasse : null, byGeo.get(base(p.path))?.[0]);
const nBestand = want.size;
// Kategorien der Hallendeko (NEU_SET): Palette und Material-Ersatz gelten für sie, gleich ob neu oder schon im Bestand
for (const w of want.values()) if (NEU_SET.has(w.kat) || FZ_SET.has(w.kat)) { const e = entries.find((x) => x.key === w.key); if (e?.material) w.material = e.material; }
const KAPPE = { fracht: 18, regal: 14, crew: 18, wand: 16, decke: 12, maschine: 10, bauteile: 16 };
// nicht in eine Halle: Ladeneinrichtung, Kleidung, Essen, Kunst der Lobbys
const NICHT_HALLE = /casaba|kiosk|shoe|expo_hall|medical|hosp|clothing|(^|_)hat_|helmet|food|(^|_)bar_(?!table)|planter|flower|hangingframes|showroom|dumpersdepot_screen|_glass|template_/;
const family = (k) => k.replace(/(_[a-z])+$/, '').replace(/_(left|right|mid|middle|start|end|straight)$/, '').replace(/_\d+$/, '');
const archiv = sb(['p4k', 'list', '--regex', '(?i)[\\\\/]objects[\\\\/].*\\.cg[fa]$']).split('\n').map((l) => l.split('\t')[0].trim()).filter(Boolean).filter((f) => !/_lod\d|_damaged|_dmg|_proxy/i.test(f));
const archivOf = new Map(); for (const f of archiv) { const k = base(f); if (!archivOf.has(k) || /\.cgf$/i.test(f)) archivOf.set(k, f); }
// Nicht darunter, nach Sichtprüfung: hangar_business_v2_coffeemachine (ein ganzes
// Hangar-Café mit Säulen und Tresen, keine Maschine), machine_vending_1_a (nur das
// Blechgehäuse), warning/danger/safety_panel_sign_01 (Schießstand-Tafeln, ihre
// Decal-Karte fehlt im Archiv)
const ARCHIV_NEU = [
  ['fracht', ['cargo_multipurpose_1_0125x0125x0125_a', 'cargo_multipurpose_1_025x0125x0125_a', 'cargo_multipurpose_1_025x025x0125_a', 'cargo_multipurpose_1_025x025x025_a', 'cargo_multipurpose_1_025x025x05_a', 'cargo_multipurpose_1_025x025x075_a', 'cargo_multipurpose_1_025x025x1_a']],
  ['crew', ['machine_water_cooler_1_a']],
  ['maschine', ['lift_scissor_1_a', 'col_lift_platform_small_a', 'forklift_machine_1_a', 'trolley_pallet_powered_1_a', 'uee_lawless_prop_hcrane_01', 'crane_1_a']],
];
// je Kategorie zählt der Bestand mit: ein zweiter Lauf auf dem eigenen Katalog wählt nichts dazu
const neu = {}, inKat = count(bestand, (p) => p.kategorie);
const take = (kat, key, p4k, quelle, klasse = null) => { if (want.has(key) || BESTAND.has(key)) return; add(key, kat, p4k, quelle, klasse, klasse ? null : byGeo.get(key)?.[0]); neu[kat] = (neu[kat] || 0) + 1; inKat[kat] = (inKat[kat] || 0) + 1; };
for (const [kat, keys] of ARCHIV_NEU) for (const k of keys) { const f = archivOf.get(k); if (f) take(kat, k, f, entries.some((e) => e.key === k) ? 'fundort' : 'archiv'); }
// je Kategorie zuerst das Häufigste jeder Sorte, die der Auftrag nennt, dann nach Häufigkeit bis KAPPE, je Familie drei
const VIELFALT = {
  fracht: [/^crate_dry/, /^crate_metal/, /container_dry|storage_container/, /shipping_container|freight_container/, /pallet/],
  regal: [/cargo_rack/, /storage_rack/, /shelf_wall|wall_shelf/, /shelf_storage|salvage_shelf/, /occupied|_full|filled|stocked/],
  crew: [/locker/, /bench/, /(^|_)table_/, /stool/, /chair|seat_desk/, /water_?cooler/, /vending|coffee/, /waste|trash|(^|_)bin_/],
  wand: [/relay_electrical|fuse/, /display_video_wall|monitor|screen/, /nav_sign/, /panel_sign|sign_(warning|hazard|caution|safety)/, /pipe/, /cable_terminal_\d_wall/, /console|control_panel/],
  decke: [/hvac/, /light_hung/, /pulley|hoist/, /cable_hanging|cable_rack|cable_tray|cable_sign/],
};
const takeEntry = (kat, e) => { take(kat, e.key, `Data/${e.path.replace(/^data[\\/]/i, '')}`, e.fundorte.hangar ? 'hangar' : 'fundort'); if (e.material && want.has(e.key)) want.get(e.key).material = e.material; };
for (const [kat] of NEU_KATEGORIEN) {
  const cands = entries.filter((x) => x.kat === kat && x.count >= 3 && !NICHT_HALLE.test(x.key) && !BESTAND.has(x.key));
  const imBestand = bestand.filter((p) => p.kategorie === kat).map((p) => base(p.path));
  for (const re of VIELFALT[kat] || []) { if (imBestand.some((k) => re.test(k))) continue; const e = cands.find((x) => re.test(x.key) && !want.has(x.key)); if (e) takeEntry(kat, e); }
  const fam = {};
  for (const k of [...want.keys()].filter((k) => want.get(k).kat === kat)) { const f = family(k); fam[f] = (fam[f] || 0) + 1; }
  for (const e of cands) {
    if ((inKat[kat] || 0) >= KAPPE[kat]) break;
    if (want.has(e.key)) continue;
    const f = family(e.key); if ((fam[f] || 0) >= 3) continue; fam[f] = (fam[f] || 0) + 1;
    takeEntry(kat, e);
  }
}
// Schiffsbauteile als Items: je Art der Hersteller mit S1, S2 und S3, je Größe das erste Item
const BAUART = { PowerPlant: 'Kraftwerk', Cooler: 'Kühler', Shield: 'Schildgenerator', QuantumDrive: 'Quantenantrieb' };
for (const typ of Object.keys(BAUART)) {
  const cands = [...dType].filter(([c, t]) => t === typ && dGeo.get(c) && /_SCItem$/.test(c) && !/template|test|_ai_|placeholder/i.test(c) && loc(dName.get(c), EN))
    .map(([c]) => ({ c, s: Number(dSize.get(c)), m: c.split('_')[1] })).filter((x) => x.s >= 1 && x.s <= 3);
  const mf = Object.entries(count(cands, (x) => x.m)).filter(([m]) => [1, 2, 3].every((s) => cands.some((x) => x.m === m && x.s === s))).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
  for (const s of [1, 2, 3]) {
    const x = cands.filter((y) => y.m === mf && y.s === s).sort((a, b) => a.c.localeCompare(b.c))[0];
    if (x) take('bauteile', base(dGeo.get(x.c)), `Data/${dGeo.get(x.c)}`, 'item', x.c);
  }
}
// Fahrzeugwerkstatt: Entity bzw. Container gelten auch für den Bestand (zweiter Lauf),
// der Katalog nennt nur die Geometrie
for (const c of FAHRZEUGE) { const g = dGeo.get(c); if (g) take('fahrzeug', base(g), `Data/${g}`, 'fahrzeug', c); }
for (const t of TORE) take('tor', t.key, `Data/${t.p4k}`, 'fundort');
for (const k of REIFEN) { const f = archivOf.get(k); if (f) take('reifen', k, f, entries.some((e) => e.key === k) ? 'fundort' : 'archiv'); }
for (const c of FAHRZEUGE) { const w = dGeo.get(c) && want.get(base(dGeo.get(c))); if (w) { w.klasse = c; delete w.ersatz; } }
for (const t of TORE) if (want.has(t.key)) Object.assign(want.get(t.key), { socpak: t.socpak });
// Der ATLS fehlt mit Absicht: Er lässt sich nur als Figur mit Skelett exportieren
// (ARGO_ATLS, .cdf); unter 20 000 Dreiecken bleibt nur LOD 3 (15 839), und dort
// zerfällt das Netz und die Schichten bleiben weiß. LOD 2 hat 41 548.
console.log(`Auswahl: ${want.size} Requisiten (Bestand ${nBestand}; neu ${Object.entries(neu).map(([k, n]) => `${k} ${n}`).join(', ')})`);
// --inventar: nur bis hier (Analyse ohne Exporte), Auswahl nach want.json
if (process.argv.includes('--inventar')) { writeFileSync(`${OUT}want.json`, JSON.stringify([...want.values()].slice(nBestand), null, 1)); process.exit(0); }

const GEO = `${OUT}geo/`; mkdirSync(GEO, { recursive: true });
const MRAW = `${RAW}mesh/`; mkdirSync(MRAW, { recursive: true });
const { NodeIO, Document } = await import('@gltf-transform/core');
const { transformPrimitive, weldPrimitive, simplifyPrimitive } = await import('@gltf-transform/functions');
const { MeshoptSimplifier } = await import('meshoptimizer');
await MeshoptSimplifier.ready;
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
// alle Attribute eines XML-Kopfs als Objekt (Werte wörtlich)
const attrs = (src) => Object.fromEntries([...String(src).matchAll(/\b([\w:]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
// .mtl (XML): Untermaterialien in Reihenfolge, je mit Karten und Schichten
function parseMtl(xml) {
  const blocks = /<SubMaterials>/i.test(xml) ? xml.split(/<SubMaterials>/i)[1].split(/<Material\b/i).slice(1) : [xml.replace(/^[\s\S]*?<Material\b/i, '')];
  return blocks.map((block) => {
    const head = block.slice(0, block.indexOf('>'));
    const at = (src, k) => (src.match(new RegExp(`\\b${k}="([^"]*)"`, 'i')) || [])[1];
    const tex = (slot) => (block.match(new RegExp(`Map="${slot}"[^>]*File="([^"]*)"|File="([^"]*)"[^>]*Map="${slot}"`, 'i')) || []).slice(1).find(Boolean);
    const layers = [...(block.match(/<MatLayers>([\s\S]*?)<\/MatLayers>/i)?.[1] || '').matchAll(/<Layer\b([^>]*)\/?>/gi)].map((m) => ({
      name: at(m[1], 'Name'), path: at(m[1], 'Path'), tint: at(m[1], 'TintColor'), wearTint: at(m[1], 'WearTint'),
      glossMult: Number(at(m[1], 'GlossMult') ?? 1), uvTiling: Number(at(m[1], 'UVTiling') ?? 1), paletteTint: at(m[1], 'PaletteTint'),
      // alle Attribute der Schicht wörtlich (WearGloss, HeightBias, HeightScale, Submtl …)
      raw: attrs(m[1]),
    }));
    // nur der eigene Block bis zu einem verschachtelten Material: Karten und PublicParams
    const own = block.split(/<Material\b/i)[0];
    const textures = Object.fromEntries([...own.matchAll(/<Texture\b([^>]*)\/?>/gi)].map((m) => [at(m[1], 'Map'), at(m[1], 'File')]).filter(([k, v]) => k && v));
    const pp = own.match(/<PublicParams\b([^>]*)\/?>/i);
    // Kachelung der Farbkarte (TexMod), für Decals mit Deckkraftmaske
    const tm = own.match(/<Texture\b[^>]*Map="TexSlot1"[^>]*?(?<!\/)>([\s\S]*?)<\/Texture>/i)?.[1] || '';
    const tu = Number(tm.match(/TileU="([^"]*)"/)?.[1] || 1), tv = Number(tm.match(/TileV="([^"]*)"/)?.[1] || 1);
    return {
      name: at(head, 'Name'), shader: at(head, 'Shader'), genMask: at(head, 'StringGenMask'), diffuse: at(head, 'Diffuse'), specular: at(head, 'Specular'),
      shininess: at(head, 'Shininess'), opacity: at(head, 'Opacity'), alphaTest: at(head, 'AlphaTest'),
      d: tex('TexSlot1'), n: tex('TexSlot2'), s: tex('TexSlot4'), wear: tex('TexSlot11'), blendMap: tex('TexSlot12'), layers,
      head: attrs(head), textures, params: pp ? attrs(pp[1]) : {}, ...(tu !== 1 || tv !== 1 ? { tileD: [tu, tv] } : {}),
    };
  });
}
const xmlOf = (f) => { let x = readFileSync(f, 'latin1'); if (x.startsWith('CryXmlB')) { if (!existsSync(`${f}.xml`)) spawnSync(STARBREAKER, ['cryxml', 'convert', f, `${f}.xml`]); x = existsSync(`${f}.xml`) ? readFileSync(`${f}.xml`, 'utf8') : ''; } return x; };
// Rohdatei aus der p4k im Cache (Pfad ohne Data/, Groß- und Kleinschreibung egal)
const rawPath = (rel) => `${MRAW}Data/${String(rel).replace(/\\/g, '/').replace(/^data\//i, '')}`;
const ensureRaw = (rel, regex = `(?i)${esc(String(rel).replace(/\//g, '\\').replace(/^data\\/i, ''))}$`) => {
  if (!existsSync(rawPath(rel))) sb(['p4k', 'extract', '-o', MRAW, '--regex', regex]);
  return existsSync(rawPath(rel)) ? rawPath(rel) : null;
};
const mtlFile = (mtlPath) => { const f = ensureRaw(`${mtlPath}.mtl`); return f ? parseMtl(xmlOf(f)) : []; };
const mtlPathIn = (file) => (file ? (readFileSync(file, 'latin1').match(/(?:Data\/)?(?:objects|materials)\/[\w/.-]+(?=\0)/i) || [])[0]?.replace(/^Data\//i, '').replace(/\.mtl$/i, '') : null);
// manche .cgf nennen ihr Material nur beim Namen (lowtech_pallet_1_a): die gleichnamige .mtl im Archiv
const mtlByName = (file) => {
  const s = file && readFileSync(file, 'latin1').match(/[\x20-\x7e]{6,}/)?.[0];
  if (!s || !/^[\w-]+$/.test(s)) return null;
  const hit = sb(['p4k', 'list', '--regex', `(?i)[\\\\/]${esc(s)}\\.mtl$`]).split('\n').map((l) => l.split('\t')[0].trim()).filter(Boolean)[0];
  return hit ? hit.replace(/\\/g, '/').replace(/^Data\//i, '').replace(/\.mtl$/i, '') : null;
};
const BIG = /generator|forklift|trolley_cargo|crane|ladder|workbench|heater_large|shelf|server_rack|container_|cargo_container|shipping_container|missile_frame|torpedo|missilestack|pallet|component_display/;
const limitOf = (w) => (w.kat === 'fahrzeug' ? 25000 : w.kat === 'tor' ? 6000 : BIG.test(w.key) || ['maschine', 'regal', 'bauteile'].includes(w.kat) || /025x025x(025|05|075|1)_|_025x05x025|_025x075x025/.test(w.key) ? 20000 : 8000);

// entity export: Knoten in den Raum der Wurzel (Z oben) backen, ein Mesh wie beim skin export
async function entityGlb(cls, lod, out) {
  const raw = `${out}.raw.glb`;
  // die Zeilen zu Datensatz, Geometrie und Material stehen auf stderr
  const r = spawnSync(STARBREAKER, ['entity', 'export', cls, raw, '--lod', String(lod), '--materials', 'colors', '--no-lights', '--no-interior', '--p4k', P4K], { encoding: 'utf8', maxBuffer: 1 << 30 });
  const log = `${r.stdout || ''}\n${r.stderr || ''}`;
  if (r.status !== 0) throw new Error(log.trim().split('\n').slice(-3).join(' | '));
  if (!new RegExp(`EntityClassDefinition\\.${esc(cls)}\\b`).test(log)) throw new Error(`entity export ${cls}: anderer Datensatz (${log.split('\n')[0]})`);
  const d = await io.read(raw);
  const root = d.getRoot();
  const zup = root.listNodes().find((n) => /CryEngine_Z_up/i.test(n.getName()));
  const inv = zup ? invertAffine(zup.getWorldMatrix()) : null;
  const doc = new Document(); const buf = doc.createBuffer(); const mesh = doc.createMesh('mesh');
  const mats = new Map();
  for (const n of root.listNodes()) {
    const me = n.getMesh(); if (!me) continue;
    const w = inv ? mulMat(inv, n.getWorldMatrix()) : n.getWorldMatrix();
    for (const sp of me.listPrimitives()) {
      const p = doc.createPrimitive();
      for (const sem of sp.listSemantics()) { const a = sp.getAttribute(sem); p.setAttribute(sem, doc.createAccessor().setType(a.getType()).setNormalized(a.getNormalized()).setArray(a.getArray().slice()).setBuffer(buf)); }
      const idx = sp.getIndices(); if (idx) p.setIndices(doc.createAccessor().setType('SCALAR').setArray(idx.getArray().slice()).setBuffer(buf));
      for (const sem of p.listSemantics()) if (/^(JOINTS|WEIGHTS)_/.test(sem)) p.setAttribute(sem, null);
      transformPrimitive(p, w);
      const sm = sp.getMaterial();
      const nm = (sm?.getExtras()?.semantic?.authored_attributes || []).find((a) => a.name === 'Name')?.value ?? sm?.getName() ?? 'default';
      if (!mats.has(nm)) mats.set(nm, doc.createMaterial(nm));
      mesh.addPrimitive(p.setMaterial(mats.get(nm)));
    }
  }
  doc.createScene().addChild(doc.createNode('mesh').setMesh(mesh));
  await io.write(out, doc);
  const mtl = (log.match(/^Material:[ \t]*(\S.*)$/m) || [])[1]?.trim().replace(/\\/g, '/').replace(/^Data\//i, '').replace(/\.mtl$/i, '') || null;
  return { mtl, names: mesh.listPrimitives().map((p) => p.getMaterial().getName()) };
}
function invertAffine(m) {
  const [a, b, c, , d, e, f, , g, h, i] = m;
  const det = a * (e * i - f * h) - d * (b * i - c * h) + g * (b * f - c * e);
  const r = [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det, (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det, (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det];
  const t = [m[12], m[13], m[14]];
  const tt = [0, 1, 2].map((k) => -(r[k] * t[0] + r[3 + k] * t[1] + r[6 + k] * t[2]));
  return [r[0], r[1], r[2], 0, r[3], r[4], r[5], 0, r[6], r[7], r[8], 0, tt[0], tt[1], tt[2], 1];
}
const mulMat = (a, b) => { const m = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) m[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return m; };

// ─── Fahrzeugwerkstatt: Fahrzeuge (entity export) und Tor (socpak-Export) ───
// Ein Fahrzeug zeigt im Stand weder Relais noch eingebaute Bauteile (Kühler,
// Kraftwerk, Lebenserhaltung …), Schadensnetze oder Armaturen.
const FZ_DROP = /^RELAY_|damage|_dmg|dashboard|hardpoint_(cooler|powerplant|shield|quantum|life|fuel|radar|computer)|^(COOL|POWR|SHLD|LFSP|QDRV|RADR|FUEL)_|internal|placeholder|^\$/i;
const FZ_TIRE = /tire|tyre/i;
const trisIn = (prims) => Math.round(prims.reduce((t, p) => t + (p.getIndices()?.getCount() ?? 0) / 3, 0));
// Teil eines Primitivs: .mtl (ohne Data/ und Endung), Untermaterial, Lack der eigenen Palette
// (semantic.palette.source_name = die Entity selbst oder fehlt; fremd: Waffenlafette u. ä.)
function partOf(mat, owner) {
  const s = mat?.getExtras()?.semantic || {};
  const id = s.material_set_identity || {};
  const mtl = String(id.source_path || '').replace(/\\/g, '/').replace(/^Data\//i, '').replace(/\.mtl$/i, '') || null;
  const sub = id.submaterial_name ?? (s.authored_attributes || []).find((a) => a.name === 'Name')?.value ?? mat?.getName() ?? 'default';
  const src = s.palette?.source_name;
  return { mtl, sub, eigen: !src || src === owner };
}
// Netz-Knoten in ein Mesh im Raum der Wurzel (Z oben); je Primitiv sein Teil
function bakeParts(src, pick, owner) {
  const root = src.getRoot();
  const zup = root.listNodes().find((n) => /CryEngine_Z_up/i.test(n.getName()));
  const inv = zup ? invertAffine(zup.getWorldMatrix()) : null;
  const doc = new Document(); const buf = doc.createBuffer(); const mesh = doc.createMesh('mesh');
  const teile = [], keyOf = new Map(), mats = new Map(), prims = [], tires = [];
  for (const { node, matrix, mesh: m = node.getMesh() } of pick(root, inv)) {
    for (const sp of m.listPrimitives()) {
      // Die Primitive eines Exports teilen sich oft einen Vertex-Puffer: nur die benutzten Vertices
      const ix = sp.getIndices()?.getArray() ?? Uint32Array.from({ length: sp.getAttribute('POSITION').getCount() }, (_, i) => i);
      const neu = new Map(), alt = [];
      const idx = new Uint32Array(ix.length);
      for (let i = 0; i < ix.length; i++) { let v = neu.get(ix[i]); if (v === undefined) { v = alt.length; neu.set(ix[i], v); alt.push(ix[i]); } idx[i] = v; }
      const p = doc.createPrimitive();
      for (const sem of sp.listSemantics()) {
        if (/^(JOINTS|WEIGHTS)_/.test(sem)) continue;
        const a = sp.getAttribute(sem), e = a.getElementSize(), arr = a.getArray(), out = new arr.constructor(alt.length * e);
        for (let i = 0; i < alt.length; i++) for (let k = 0; k < e; k++) out[i * e + k] = arr[alt[i] * e + k];
        p.setAttribute(sem, doc.createAccessor().setType(a.getType()).setNormalized(a.getNormalized()).setArray(out).setBuffer(buf));
      }
      p.setIndices(doc.createAccessor().setType('SCALAR').setArray(idx).setBuffer(buf));
      transformPrimitive(p, matrix);
      const t = partOf(sp.getMaterial(), owner), k = `${t.mtl}|${t.sub}|${t.eigen}`;
      if (!keyOf.has(k)) { keyOf.set(k, teile.length); teile.push(t); mats.set(k, doc.createMaterial(k)); }
      mesh.addPrimitive(p.setMaterial(mats.get(k)));
      prims.push(keyOf.get(k));
      if (FZ_TIRE.test(node.getName()) || FZ_TIRE.test(t.sub)) tires.push(p);
    }
  }
  doc.createScene().addChild(doc.createNode('mesh').setMesh(mesh));
  return { doc, mesh, teile, prims, tires };
}
const zMin = (prims) => { let m = Infinity; for (const p of prims) { const a = p.getAttribute('POSITION').getArray(); for (let i = 2; i < a.length; i += 3) m = Math.min(m, a[i]); } return m; };
async function fahrzeugGlb(cls, lod, out, limit) {
  const raw = `${out}.raw.glb`;
  if (FORCE || !existsSync(raw) || !existsSync(`${raw}.log`)) {
    const r = spawnSync(STARBREAKER, ['entity', 'export', cls, raw, '--lod', String(lod), '--materials', 'colors', '--no-lights', '--no-interior', '--p4k', P4K], { encoding: 'utf8', maxBuffer: 1 << 30 });
    const l = `${r.stdout || ''}\n${r.stderr || ''}`;
    if (r.status !== 0) throw new Error(l.trim().split('\n').slice(-3).join(' | '));
    writeFileSync(`${raw}.log`, l);
  }
  const log = readFileSync(`${raw}.log`, 'utf8');
  if (!new RegExp(`EntityClassDefinition\\.${esc(cls)}\\b`).test(log)) throw new Error(`entity export ${cls}: anderer Datensatz (${log.split('\n')[0]})`);
  const dropped = (n) => { for (let x = n; x; x = x.getParentNode?.()) if (FZ_DROP.test(x.getName())) return true; return false; };
  // Steckt ein Item zweimal im Fahrzeug, trägt beim zweiten Einbau mancher Knoten das Netz
  // eines Geschwisters (PTV-Rad: Knoten wheel mit dem Netz damper). Dann nimmt er das Netz
  // des gleichnamigen Knotens im gleichen Item, dessen Netz so heißt wie er.
  let repariert = 0;
  const { doc, mesh, teile, prims, tires } = bakeParts(await io.read(raw), (root, inv) => {
    const all = root.listNodes().filter((n) => n.getMesh());
    return all.filter((n) => !dropped(n)).map((n) => {
      const p = n.getParentNode()?.getName();
      const spender = n.getMesh().getName() !== n.getName() && all.find((x) => x !== n && x.getName() === n.getName() && x.getParentNode()?.getName() === p && x.getMesh().getName() === n.getName());
      if (spender) repariert++;
      return { node: n, mesh: spender ? spender.getMesh() : n.getMesh(), matrix: inv ? mulMat(inv, n.getWorldMatrix()) : n.getWorldMatrix() };
    });
  }, cls.toLowerCase());
  const all = mesh.listPrimitives(), roh = trisIn(all), reifenRoh = trisIn(tires);
  // Reifen sind das dichteste Netz (Profil): reicht es, sie um höchstens 70 % zu
  // vereinfachen, bleibt die Stufe; sonst die nächste
  let reifen = reifenRoh;
  if (roh > limit && reifenRoh && roh - 0.7 * reifenRoh <= limit) {
    const ratio = (reifenRoh - (roh - limit * 0.98)) / reifenRoh;
    for (const error of [0.01, 0.03, 0.1]) {
      for (const p of tires) { weldPrimitive(p); simplifyPrimitive(p, { simplifier: MeshoptSimplifier, ratio, error }); }
      reifen = trisIn(tires);
      if (roh - reifenRoh + reifen <= limit) break;
    }
  }
  await io.write(out, doc);
  const mtl = (log.match(/^Material:[ \t]*(\S.*)$/m) || [])[1]?.trim().replace(/\\/g, '/').replace(/^Data\//i, '').replace(/\.mtl$/i, '') || null;
  // Räder am Boden: Unterkante der Reifen gegen die des ganzen Fahrzeugs (Z oben)
  return { mtl, teile, prims, tris: trisIn(all), roh, reifen: tires.length ? { vorher: reifenRoh, nachher: reifen, unterkante: r3(zMin(tires) - zMin(all)) } : null, netzRepariert: repariert };
}
// Tor: die Platzierung der .cga im Container (geschlossen = Ruhelage), im Maßstab,
// in dem das Spiel sie dort aufstellt
async function torGlb(w, lod, out) {
  const raw = `${RAW}socpak/${w.key}-lod${lod}.glb`;
  mkdirSync(`${RAW}socpak/`, { recursive: true });
  if (FORCE || !existsSync(raw)) sb(['socpak', 'export', w.socpak, raw, '--materials', 'colors', '--lod', String(lod), '--no-lights']);
  const re = new RegExp(`[\\\\/]${esc(base(w.p4k))}\\.cga$`, 'i');
  let scale = null;
  const { doc, mesh, teile, prims } = bakeParts(await io.read(raw), (root, inv) => {
    const n = root.listNodes().find((x) => x.getMesh() && re.test(x.getMesh().getName()));
    if (!n) throw new Error(`${base(w.p4k)}.cga steht nicht in ${w.socpak}`);
    const m = inv ? mulMat(inv, n.getWorldMatrix()) : n.getWorldMatrix();
    scale = r3(Math.hypot(m[0], m[1], m[2]));
    return [{ node: n, matrix: [scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, 1] }];
  }, null);
  await io.write(out, doc);
  return { mtl: teile[0]?.mtl ?? null, teile, prims, tris: trisIn(mesh.listPrimitives()), massstab: scale, container: w.socpak };
}
// Spieldaten einer Entity (Items, Fahrzeuge: sie stehen in keiner Halle)
const spielOf = (c) => ({ klasse: c, name: { en: loc(dName.get(c), EN), de: loc(dName.get(c), DE) }, beschreibung: { en: loc(dDesc.get(c), EN), de: loc(dDesc.get(c), DE) }, typ: [dType.get(c), dSub.get(c)].filter((x) => x && x !== 'UNDEFINED').join('.') || null, groesse: dSize.get(c) != null ? Number(dSize.get(c)) : null, tags: String(dTags.get(c) || '').split(/[\s,]+/).filter(Boolean) });
async function werkstattSource(w, limit, make, tag) {
  let chosen = null;
  for (const lod of [0, 1, 2, 3, 4, 5]) {
    const glb = `${GEO}${w.key}_${tag}${lod}.glb`;
    let info;
    if (FORCE || !existsSync(glb) || !existsSync(`${glb}.json`)) { try { info = await make(lod, glb); writeFileSync(`${glb}.json`, JSON.stringify(info)); } catch (e) { if (!lod) return { ...w, missing: e.message }; break; } }
    else info = JSON.parse(readFileSync(`${glb}.json`, 'utf8'));
    chosen = { lod, glb, info };
    if (info.tris <= limit) break;
  }
  const { teile, prims, mtl, ...werkstatt } = chosen.info;
  const subsOf = new Map([...new Set(teile.map((t) => t.mtl).filter(Boolean))].map((m) => [m, mtlFile(m)]));
  const subs = teile.map((t) => {
    const s = (subsOf.get(t.mtl) || []).find((x) => x.name === t.sub) || { name: t.sub, layers: [] };
    // HardSurface: TexSlot1 ist eine Makrokarte (Großflächenmuster, Verschattung), die Farbe kommt aus den Schichten
    const hs = /^HardSurface$/i.test(s.shader || '') && s.layers?.length && s.d ? { d: null, makro: s.d } : {};
    return { ...s, ...hs, mtl: t.mtl, ...(t.eigen ? {} : { fremd: true }) };
  });
  return { ...w, lod: chosen.lod, glb: chosen.glb.slice(SRC.length), tris: chosen.info.tris, ids: prims, mtl: mtl ?? teile[0]?.mtl ?? null, subs, ...(w.klasse ? { spiel: spielOf(w.klasse) } : {}), werkstatt };
}

// Geometrie, Untermaterial-IDs und Material eines Stücks (Requisit oder Boden-Mesh)
async function source(w) {
  const limit = limitOf(w);
  if (w.kat === 'fahrzeug' && w.klasse) return werkstattSource(w, limit, (lod, glb) => fahrzeugGlb(w.klasse, lod, glb, limit), 'f');
  if (w.socpak) return werkstattSource(w, limit, (lod, glb) => torGlb(w, lod, glb), 's');
  if (w.klasse) {
    let chosen = null;
    for (const lod of [0, 1, 2, 3, 4]) {
      const glb = `${GEO}${w.key}_e${lod}.glb`;
      let info;
      if (FORCE || !existsSync(glb) || !existsSync(`${glb}.json`)) { try { info = await entityGlb(w.klasse, lod, glb); writeFileSync(`${glb}.json`, JSON.stringify(info)); } catch (e) { if (!lod) return { ...w, missing: `entity export: ${e.message}` }; break; } }
      else info = JSON.parse(readFileSync(`${glb}.json`, 'utf8'));
      chosen = { lod, glb, tris: await trisOf(glb), info };
      if (chosen.tris <= limit) break;
    }
    // Material: aus dem Export, sonst aus der Geometrie (.cga nennt ihre .mtl)
    const mtlPath = chosen.info.mtl || mtlPathIn(ensureRaw(w.p4k));
    const subs = mtlPath ? mtlFile(mtlPath) : [];
    const ids = chosen.info.names.map((n) => subs.findIndex((s) => s.name === n));
    // Spieldaten des Items selbst (es steht in keiner Halle)
    return { ...w, lod: chosen.lod, glb: chosen.glb.slice(SRC.length), tris: chosen.tris, ids, mtl: mtlPath, subs, spiel: spielOf(w.klasse) };
  }
  const p4k = w.p4k.replace(/\.cga$/i, '.cgf');
  let chosen = null;
  for (const lod of ['', '_lod1', '_lod2']) {
    const path = p4k.replace(/\.cgf$/i, `${lod}.cgf`);
    const glb = `${GEO}${w.key}${lod}.glb`;
    if (FORCE || !existsSync(glb)) { try { sb(['skin', 'export', path.replace(/^Data\\/i, ''), glb]); } catch { if (!lod) break; continue; } }
    const tris = await trisOf(glb);
    chosen = { lod: lod ? Number(lod.slice(4)) : 0, glb, tris, path };
    if (tris <= limit) break;
  }
  if (!chosen) return w.ersatz ? source({ ...w, klasse: w.ersatz }) : { ...w, missing: 'skin export' };
  const rel = chosen.path.replace(/^Data\\/i, '');
  const cgfFile = ensureRaw(rel, `(?i)${esc(rel.replace(/\.cgf$/i, ''))}\\.cgfm?$`);
  const cgfmFile = cgfFile && `${cgfFile}m`;
  const ids = cgfmFile && existsSync(cgfmFile) ? (readSubsets(readFileSync(cgfmFile)) || []).map((r) => r.mat) : [];
  // LOD-Stufen nennen kein Material; das steht nur in der Grund-.cgf
  const mtlSrc = chosen.lod ? ensureRaw(p4k.replace(/^Data\\/i, '')) || cgfFile : cgfFile;
  // ohne eigene .mtl: die Original-.cga, dann die Überschreibung der Brushes in der Halle (nur Kategorien der Hallendeko, die alten bleiben gleich)
  const neuesStueck = NEU_SET.has(w.kat) || FZ_SET.has(w.kat);
  const mtlPath = mtlPathIn(mtlSrc) || (neuesStueck && /\.cga$/i.test(w.p4k) ? mtlPathIn(ensureRaw(w.p4k.replace(/^Data\\/i, ''))) : null) || (neuesStueck ? mtlByName(mtlSrc) : null) || w.material?.replace(/^Data\//i, '').replace(/\.mtl$/i, '') || null;
  return { ...w, lod: chosen.lod, glb: chosen.glb.slice(SRC.length), tris: chosen.tris, ids, mtl: mtlPath, subs: mtlPath ? mtlFile(mtlPath) : [] };
}
const quellen = [];
const entryByKey = new Map(entries.map((e) => [e.key, e]));
for (const w of want.values()) {
  const q = await source(w);
  // Palette nur in den Kategorien der Hallendeko (die alten bleiben, wie sie gebaut sind): die Entity mit Namen, sonst die Ersatz-Entity
  // die SCU-Reihe der Standardkiste einheitlich in der Palette der 1-SCU-Kiste (16–32 SCU gibt es nur mit Warenfarben)
  const serie = /^cargo_multipurpose_1_/.test(w.key) ? 'Carryable_TBO_InventoryContainer_1SCU' : null;
  const pal = !NEU_SET.has(w.kat) && !FZ_SET.has(w.kat) ? null : [serie, w.klasse, entryByKey.get(w.key)?.klasse, w.ersatz, ...(byGeo.get(w.key) || [])].filter(Boolean).map(paletteOf).find(Boolean);
  quellen.push(pal ? { ...q, palette: pal } : q);
}
// Boden: Meshes wie Requisiten, projizierte Decals nur ihr Material
const bodenMeshes = [];
// Ziffern, die in keiner Halle liegen (4–8), aus dem Archiv: der Satz 0–9 ist vollständig
for (let d = 0; d <= 9; d++) { const k = `secondary_number_${d}`; if (!meshes.some((e) => e.key === k) && archivOf.has(k)) meshes.push({ key: k, path: archivOf.get(k).replace(/^Data\\/i, ''), rolle: 'ziffer', n: 0, flach: 0, hallen: new Set(), fundorte: {} }); }
for (const e of meshes) bodenMeshes.push({ ...(await source({ key: e.key, kat: 'boden', p4k: `Data/${e.path.replace(/^data[\\/]/i, '')}`.replace(/\//g, '\\'), quelle: 'fundort' })), rolle: e.rolle, n: e.n, flach: e.flach, hallen: e.hallen.size, fundorte: e.fundorte });
const decalMtl = new Map();
if (quads.length) {
  sb(['p4k', 'extract', '-o', MRAW, '--regex', `(?i)[\\\\/](${quads.map((q) => esc(q.material.split('/').pop())).join('|')})\\.mtl$`]);
  const mf = listFiles(MRAW);
  for (const q of quads) { const f = mf.find((x) => x.toLowerCase().endsWith(`/${q.material.toLowerCase()}.mtl`)); decalMtl.set(q.material, f ? parseMtl(xmlOf(f))[0] : null); }
}
const bodenQuads = quads.map((q) => ({ material: q.material, rolle: q.rolle, n: q.n, hallen: q.hallen.size, fundorte: q.fundorte, kante: r3(med(q.edges)), mtl: decalMtl.get(q.material) }));
// Schicht-.mtl (Basisschichten der LayerBlend-Materialien): Karten, Kachelung
const allSubs = [...quellen, ...bodenMeshes].flatMap((q) => q.subs || []);
const layerPaths = new Set(allSubs.flatMap((s) => s.layers.map((l) => l.path).filter(Boolean)));
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
    layerInfo[lp] = { d: m.d ?? null, n: m.n ?? null, diffuse: m.diffuse, specular: m.specular, shininess: m.shininess, tiling: Number((xml.match(/LayerTiling="([^"]*)"/) || [])[1] || 1), shader: m.shader ?? null, textures: m.textures ?? {}, params: m.params ?? {} };
  }
}
const texPaths = new Set();
for (const s of [...allSubs, ...bodenQuads.map((q) => q.mtl).filter(Boolean)]) {
  // Illum mit BLENDLAYER: zweite Schicht Farbe (TexSlot9) und Normale (TexSlot3), Maske TexSlot12
  const bl = /%BLENDLAYER(?![A-Z_])/.test(s.genMask || '') ? [s.textures?.TexSlot9, s.textures?.TexSlot3] : [];
  for (const t of [s.d, s.n, s.blendMap, ...bl]) if (t && !/^\$|defaults\//i.test(t)) texPaths.add(t);
  for (const l of s.layers || []) { const L = layerInfo[l.path]; if (L?.d) texPaths.add(L.d); if (L?.n) texPaths.add(L.n); }
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
writeFileSync(`${OUT}quellen.json`, JSON.stringify({ quellen, layers: layerInfo, boden: { quads: bodenQuads, meshes: bodenMeshes } }, null, 1));
console.log(`Quellen: ${quellen.filter((q) => !q.missing).length} mit Geometrie (${quellen.filter((q) => q.missing).length} ohne: ${quellen.filter((q) => q.missing).map((q) => q.key).join(', ')}), Boden ${bodenQuads.length} Decals + ${bodenMeshes.filter((q) => !q.missing).length} Meshes, ${Object.keys(layerInfo).length} Schicht-.mtl, ${texPaths.size} Karten (${dec} neu dekodiert)`);

const withName = entries.filter((e) => e.name?.en).length, withDesc = entries.filter((e) => e.beschreibung?.en).length;
console.log(`Arten: ${entries.length} (≥ 3 Aufstellungen: ${entries.filter((e) => e.count >= 3).length}); mit Spielname ${withName}, mit Beschreibung ${withDesc}`);
console.log(`Kategorien: ${[...KATEGORIEN, ...NEU_KATEGORIEN].map(([k]) => `${k} ${entries.filter((e) => e.kat === k).length}`).join(', ')}`);
console.log(`Zonen: ${zoneGroups.length} Gruppen, ${zonen.length} Zusammensetzungen ≥ 3`);
for (const s of schiffe) console.log(`Schiff ${s.schiff}: ${s.anschluesse.length} Port-Zeilen mit Tank/Strom-Namen (Baum ${s.zeilen} Zeilen)`);
