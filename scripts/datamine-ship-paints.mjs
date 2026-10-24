// datamine-ship-paints.mjs — Lackierungen je Hangar-Schiff mit ihren drei
// Palettenfarben (A/B/C) aus dem DataCore. Ausgabe: src/data/ship-paints.json
// { ships: { <ship-id>: { base: {a,b,c}, paints: [{id,name,tag,a,b,c,pattern}] } } }.
//
// Kernstruktur im Spiel: das Lack-Item (SAttachableComponentParams,
// AttachDef.Type 'Paints') nennt in AttachDef.Tags seine Selektoren
// ("@Paint_Gladius_..."). Das Schiff fuehrt unter SGeometryResourceParams.
// Geometry.SubGeometry[] je Lack einen Eintrag mit demselben Tag, eigener
// Palette (TintPaletteTree) und optional eigenem Material (= Muster).
//
// Aufruf: node scripts/datamine-ship-paints.mjs [--p4k <Data.p4k>]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { openP4k, DEFAULT_P4K } from './lib/p4k.mjs';
import { openDataCore } from './lib/datacore.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(__dirname, '..', 'src', 'data');
const OUT = resolve(DATA, 'ship-paints.json');
const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const p4k = openP4k(argOf('--p4k') ?? DEFAULT_P4K);
const db = openDataCore(p4k.read(/^Data[\\/]Game2\.dcb$/i));
const iniEn = p4k.read(/Localization[\\/]english[\\/]global\.ini$/i).toString('utf8');
p4k.close();

const EN = new Map();
for (const line of iniEn.split(/\r?\n/)) { const i = line.indexOf('='); if (i > 0) EN.set(line.slice(0, i).replace(/^\uFEFF/, '').toLowerCase(), line.slice(i + 1)); }
// Manche Lacknamen stehen nur unter "<key>,P" (Railen, Tyilui, Constellation Mk V).
const loc = (k) => { if (!k || typeof k !== 'string' || !k.startsWith('@')) return null; const key = k.slice(1).toLowerCase(); const v = (EN.get(key) ?? EN.get(key + ',p'))?.trim(); return v && !/^@|PLACEHOLDER|LOC_EMPTY/.test(v) && !/placeholder|<=|=>|\bTBD\b/i.test(v) ? v : null; };
const component = (o, type) => o?.Components?.find((c) => c?.__type === type);
const tokens = (s) => (s || '').split(/\s+/).filter(Boolean);

const entityRecs = db.records.filter((r) => db.structs[r.structIndex]?.name === 'EntityClassDefinition');

// ---- Lack-Items, nach Selektor-Tag ----
let itemsTotal = 0, itemsNoName = 0;
const paintsByTag = new Map();
for (const r of entityRecs) {
  const att = component(db.readRecord(r, { typed: true, maxDepth: 10 }), 'SAttachableComponentParams')?.AttachDef;
  if (att?.Type !== 'Paints') continue;
  itemsTotal++;
  const name = loc(att.Localization?.Name);
  if (!name) { itemsNoName++; continue; }
  const item = { id: r.id, name };
  for (const t of tokens(att.Tags)) {
    if (!t.startsWith('@')) continue;
    const key = t.slice(1).toLowerCase();
    if (!paintsByTag.has(key)) paintsByTag.set(key, []);
    paintsByTag.get(key).push(item);
  }
}

// ---- Paletten ----
let childPathFallbacks = 0;
const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const treeRoots = new Map();
function paletteColours(pal) {
  const rec = pal?.RootRecord?.__ref ? db.recordById.get(pal.RootRecord.__ref) : null;
  if (!rec) return null;
  if (!treeRoots.has(rec.id)) treeRoots.set(rec.id, db.readRecord(rec, { typed: true, maxDepth: 10 })?.root ?? null);
  const root = treeRoots.get(rec.id);
  if (!root) return null;
  let node = root;
  for (const step of (pal.ChildPath || '').split('/').filter(Boolean)) {
    node = node?.children?.find((ch) => ch?.name?.toLowerCase() === step.toLowerCase());
  }
  if (!node) { childPathFallbacks++; node = root; }
  return { a: hex(node.entryA.tintColor), b: hex(node.entryB.tintColor), c: hex(node.entryC.tintColor) };
}

// ---- Schiffe ----
// Dieselbe Liste wie HANGAR_IDS in src/lib/hangar/catalog.ts.
const readJson = (f) => JSON.parse(readFileSync(resolve(DATA, f), 'utf8'));
const meshes = readJson('holo-meshes.json').meshes;
const slugs = readJson('vehicles.json').vehicles.map((v) => v.id).filter((id) => meshes[id]);

// Derselbe Record wie das 3D-Modell (scripts/extract-hangar-sources.mjs): gibt
// es <Record>_GS, gewinnt er (Constellation, Hammerhead), sonst passten
// Farben und Lackliste nicht zum Neubau.
const shipByName = new Map();
for (const r of entityRecs) { const n = r.name.toLowerCase(); if (!shipByName.has(n)) shipByName.set(n, r); }

const noRecord = [], noBase = [], sameName = [];
let subNoPalette = 0, dupDropped = 0;
const ships = {};
for (const slug of slugs) {
  const key = 'entityclassdefinition.' + slug.replace(/-/g, '_');
  const rec = shipByName.get(`${key}_gs`) ?? shipByName.get(key);
  if (!rec) { noRecord.push(slug); continue; }
  const geo = component(db.readRecord(rec, { typed: true, maxDepth: 10 }), 'SGeometryResourceParams')?.Geometry;
  const matched = (geo?.SubGeometry ?? [])
    .map((sub) => ({ sub, items: tokens(sub.Tags).flatMap((t) => paintsByTag.get(t.toLowerCase()) ?? []) }))
    .filter((m) => m.items.length);
  if (!matched.length) continue;
  const base = paletteColours(geo.Geometry?.Palette);
  if (!base) { noBase.push(slug); continue; }

  const byId = new Map();
  for (const { sub, items } of matched) {
    // Die Palette des Schiffs-Eintrags gilt, nicht die des Lack-Items (dessen
    // Eimer-Symbol): Gladius White_Blue_Blue nennt am Item white_blue_blue,
    // am Schiff white_white_blue, und das Schiff wird so gezeichnet.
    let colours = paletteColours(sub.Geometry?.Palette);
    if (!colours) { subNoPalette++; colours = base; }
    const pattern = !!sub.Geometry?.Material?.path;
    // tag: der Selektor dieses Eintrags, Schlüssel des Lack-Bauplans
    // (public/hangar/paints/<schiff>.json, scripts/build-hangar-assets.mjs)
    const tagOf = (it) => tokens(sub.Tags).find((t) => (paintsByTag.get(t.toLowerCase()) ?? []).includes(it)) ?? null;
    for (const it of items) if (!byId.has(it.id)) byId.set(it.id, { id: it.id, name: it.name, tag: tagOf(it), ...colours, pattern });
  }
  const byLook = new Map();
  for (const p of [...byId.values()].sort((x, y) => (x.id < y.id ? -1 : 1))) {
    const look = [p.name, p.a, p.b, p.c, p.pattern].join('|');
    if (byLook.has(look)) { dupDropped++; continue; }
    byLook.set(look, p);
  }
  const paints = [...byLook.values()].sort((x, y) => x.name.localeCompare(y.name, 'en') || (x.id < y.id ? -1 : 1));
  const byName = Map.groupBy(paints, (p) => p.name);
  for (const [name, looks] of byName) if (looks.length > 1) sameName.push({ slug, name, looks });
  ships[slug] = { base, paints };
}

// ---- Selbstauskunft ----
const all = Object.values(ships).flatMap((s) => s.paints);
const withPattern = all.filter((p) => p.pattern).length;
console.log('\n=== datamine:paints — Lackierungen der Hangar-Schiffe ===');
console.log(`Lack-Items:                    ${itemsTotal} (ohne echten Namen uebersprungen: ${itemsNoName}, Selektor-Tags: ${paintsByTag.size})`);
console.log(`Hangar-Schiffe:                ${slugs.length}`);
console.log(`  ohne exakten Record:         ${noRecord.length}${noRecord.length ? '  ' + noRecord.join(', ') : ''}`);
console.log(`  ohne Grundpalette:           ${noBase.length}${noBase.length ? '  ' + noBase.join(', ') : ''}`);
console.log(`Schiffe geschrieben:           ${Object.keys(ships).length}`);
console.log(`Lackierungen gesamt:           ${all.length} (mit Muster: ${withPattern}, nur Palette: ${all.length - withPattern})`);
console.log(`ChildPath nicht gefunden:      ${childPathFallbacks} (Wurzel der Palette genommen)`);
console.log(`SubGeometry ohne Palette:      ${subNoPalette} (Grundfarben des Schiffs genommen)`);
console.log(`Doppelte verworfen:            ${dupDropped} (gleicher Name, gleiche Farben, niedrigste Id bleibt)`);
console.log(`Gleicher Name, andere Farben:  ${sameName.length}`);
for (const s of sameName) console.log(`  ${s.slug}: ${s.name} -> ${s.looks.map((p) => `${p.a} ${p.b} ${p.c}${p.pattern ? ' Muster' : ''}`).join(' | ')}`);

if (!Object.keys(ships).length || !all.length) {
  console.error(`FEHLER: ${Object.keys(ships).length} Schiffe, ${all.length} Lackierungen — der Leser ist kaputt, nicht der Bestand. Datei bleibt unveraendert.`);
  process.exit(1);
}
writeFileSync(OUT, JSON.stringify({ ships }, null, 2) + '\n');
console.log(`\n-> ${OUT} geschrieben`);
