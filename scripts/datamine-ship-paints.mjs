// datamine-ship-paints.mjs — Lackierungen je Hangar-Schiff mit ihren drei
// Palettenfarben (A/B/C) aus dem DataCore. Ausgabe: src/data/ship-paints.json
// { ships: { <ship-id>: { base: {a,b,c,finish?}, paints: [{id,name,tag,a,b,c,finish?,pattern}] } } },
// finish = { a: { specular: '#rrggbb', gloss: 0..255 }, b, c }.
//
// Kernstruktur im Spiel: das Lack-Item (SAttachableComponentParams,
// AttachDef.Type 'Paints') nennt in AttachDef.Tags seine Selektoren
// ("@Paint_Gladius_..."). Das Schiff fuehrt unter SGeometryResourceParams.
// Geometry.SubGeometry[] je Lack einen Eintrag mit demselben Tag, eigener
// Palette (TintPaletteTree) und optional eigenem Material (= Muster).
//
// Aufruf: node scripts/datamine-ship-paints.mjs [--p4k <Data.p4k>]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { openP4k, DEFAULT_P4K } from './lib/p4k.mjs';
import { openDataCore } from './lib/datacore.mjs';
import { palettePbr } from '../assets/hangar-viewer.js';

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
// Je Kanal die Diffusfarbe (tintColor) und der Glanz: finish = Glanzfarbe
// (specColor) und Glätte (glossiness 0..255), Schlüssel wie palette.finish in
// den Lack-Bauplänen. Das Spiel zeichnet mit Glanzfarbe; Metall hat Tönung 0
// und eine helle Glanzfarbe (.planning/notes/hangar-landung.md, Teil A).
// finish nur, wenn alle drei Kanäle ihn tragen: Fehlt einer, rechnen Seite und
// Viewer die ganze Lackierung auf dem alten Weg (nur Farbe). Die Zähler
// sammeln Paletten (Record und ChildPath), nicht Aufrufe: Die Schwestersuche
// liest dieselbe Palette mehrfach.
const childPathFallbacks = new Set(), finishPartial = new Set();
const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const treeRoots = new Map();
function paletteColours(pal) {
  const rec = pal?.RootRecord?.__ref ? db.recordById.get(pal.RootRecord.__ref) : null;
  if (!rec) return null;
  if (!treeRoots.has(rec.id)) treeRoots.set(rec.id, db.readRecord(rec, { typed: true, maxDepth: 10 })?.root ?? null);
  const root = treeRoots.get(rec.id);
  if (!root) return null;
  const key = `${rec.id}|${pal.ChildPath ?? ''}`;
  let node = root;
  for (const step of (pal.ChildPath || '').split('/').filter(Boolean)) {
    node = node?.children?.find((ch) => ch?.name?.toLowerCase() === step.toLowerCase());
  }
  if (!node) { childPathFallbacks.add(key); node = root; }
  const entries = { a: node.entryA, b: node.entryB, c: node.entryC };
  const fin = (e) => (e?.specColor && Number.isFinite(e.glossiness) ? { specular: hex(e.specColor), gloss: Math.max(0, Math.min(255, Math.round(e.glossiness))) } : null);
  const finish = Object.fromEntries(Object.entries(entries).map(([k, e]) => [k, fin(e)]));
  const full = Object.values(finish).every(Boolean);
  if (!full && Object.values(finish).some(Boolean)) finishPartial.add(key);
  return { a: hex(entries.a.tintColor), b: hex(entries.b.tintColor), c: hex(entries.c.tintColor), ...(full ? { finish } : {}) };
}

// ---- Schiffe ----
// Dieselbe Liste wie HANGAR_IDS in src/lib/hangar/catalog.ts.
const readJson = (f) => JSON.parse(readFileSync(resolve(DATA, f), 'utf8'));
const meshes = readJson('holo-meshes.json').meshes;
const slugs = readJson('vehicles.json').vehicles.map((v) => v.id).filter((id) => meshes[id]);

// Derselbe Record wie das 3D-Modell (scripts/extract-hangar-sources.mjs): gibt
// es <Record>_GS, gewinnt er (Constellation, Hammerhead), sonst passten
// Farben und Lackliste nicht zum Neubau. Dieselbe Regel wie preferGoldStandard
// in lib/vehicle-records.mjs, hier über Record-Namen statt Katalog-Ids.
const shipByName = new Map();
for (const r of entityRecs) { const n = r.name.toLowerCase(); if (!shipByName.has(n)) shipByName.set(n, r); }

const byFile = new Map();
for (const r of entityRecs) { const f = r.fileName?.toLowerCase(); if (f && !byFile.has(f)) byFile.set(f, r); }

const ownShips = [];
for (const slug of slugs) {
  const key = 'entityclassdefinition.' + slug.replace(/-/g, '_');
  const rec = shipByName.get(`${key}_gs`) ?? shipByName.get(key);
  ownShips.push({ slug, rec, geo: rec ? component(db.readRecord(rec, { typed: true, maxDepth: 10 }), 'SGeometryResourceParams')?.Geometry : null });
}

// Schwester: Hat der Eintrag eines Lacks keine eigene Palette (600i BIS2951:
// Cold Forge, Sterling), dieselbe Lackierung (gleicher Tag) aus einem anderen
// Hangar-Schiff mit Palette. Dieselbe Regel wie sisterPalette in
// scripts/build-hangar-assets.mjs: aus der eigenen Familie (gleiche zwei erste
// Wörter des Records: ORIG 600i), sonst nur, wenn es genau eine Palette für den
// Tag gibt; gleiche Paletten mehrerer Schiffe zählen als eine. Nur dieselbe
// Lackierung: gleiches Material (Muster) wie der eigene Eintrag, und eine
// Palette des Lacks, nicht die Grundpalette der Schwester. Die Cutlass-Varianten
// tragen Hawthorn je mit eigenem Material, nur die Red mit Palette; der
// Vindicator-Eintrag der Mustang Alpha CitizenCon2018 nennt die Grundpalette der
// Alpha (Befund 29.10.2026, .planning/notes/hangar-landung.md). Grundpalette
// heißt hier wie im Bau: base des Schwesterschiffs, wie es in ship-paints.json
// steht (mit Lack ab Werk), nur die Farben a/b/c verglichen (Befund 30.10.2026).
const family = (rec) => rec.name.replace(/^EntityClassDefinition\./i, '').split('_').slice(0, 2).join(' ').toLowerCase();
const mtlOf = (sub) => (sub.Geometry?.Material?.path ?? '').replace(/\\/g, '/').toLowerCase();
const sisterIndex = new Map(), baseOf = new Map();
for (const { slug, rec, geo } of ownShips) for (const sub of geo?.SubGeometry ?? []) {
  const colours = paletteColours(sub.Geometry?.Palette);
  if (colours && !baseOf.has(slug)) baseOf.set(slug, shipBase(rec, geo).base);
  const base = colours && baseOf.get(slug);
  if (!colours || (base && [colours.a, colours.b, colours.c].join() === [base.a, base.b, base.c].join())) continue;
  for (const t of tokens(sub.Tags)) {
    const k = t.toLowerCase();
    if (!sisterIndex.has(k)) sisterIndex.set(k, []);
    sisterIndex.get(k).push({ slug, fam: family(rec), mtl: mtlOf(sub), colours });
  }
}
const sisterUsed = [], sisterAmbiguous = [];
function sisterColours(slug, rec, sub) {
  for (const t of tokens(sub.Tags)) {
    const hits = (sisterIndex.get(t.toLowerCase()) ?? []).filter((h) => h.slug !== slug && h.mtl === mtlOf(sub));
    if (!hits.length) continue;
    // je verschiedene Palette die Schiffe, die sie tragen
    const distinct = (hs) => [...Map.groupBy(hs, (h) => JSON.stringify(h.colours)).values()];
    const own = distinct(hits.filter((h) => h.fam === family(rec))), all = distinct(hits);
    const hit = own.length === 1 ? own[0] : !own.length && all.length === 1 ? all[0] : null;
    const names = (g) => g.map((h) => h.slug).join(', ');
    if (hit) { sisterUsed.push(`${slug}: ${t} aus ${names(hit)}`); return hit[0].colours; }
    sisterAmbiguous.push(`${slug}: ${t} (${(own.length ? own : all).map((g) => `[${names(g)}]`).join(' ')})`);
  }
  return null;
}

// Ab Werk lackiert: Steckt in der Standardausrüstung ein Lack (hardpoint_paint,
// Gladius Pirate und Valiant), trägt das Schiff dessen Palette, nicht die
// Grundpalette seiner Geometrie. Der Eintrag nennt das Teil über den Verweis
// (entityClassReference) oder den Namen (entityClassName); der Verweis gilt
// zuerst, sonst sein Name oder seine Datei, dann der Name des Eintrags.
const factoryVia = { Verweis: 0, Name: 0 };
function factoryItem(e) {
  const ref = e?.entityClassReference;
  const viaRef = (ref?.__ref && db.recordById.get(ref.__ref)) || (ref?.name && shipByName.get(ref.name.toLowerCase())) || (ref?.fileName && byFile.get(ref.fileName.toLowerCase()));
  if (viaRef) return { item: viaRef, via: 'Verweis' };
  const viaName = e?.entityClassName && shipByName.get(`entityclassdefinition.${e.entityClassName.toLowerCase()}`);
  return viaName ? { item: viaName, via: 'Name' } : null;
}
// Grundpalette des Schiffs, wie sie als base in ship-paints.json steht: die
// Palette der Geometrie, oder der Lack ab Werk (factory: Teil und Weg)
function shipBase(rec, geo) {
  const base = paletteColours(geo?.Geometry?.Palette);
  if (!base) return { base: null, factory: null };
  const factory = (component(db.readRecord(rec, { typed: true, maxDepth: 6 }), 'SEntityComponentDefaultLoadoutParams')?.loadout?.entries ?? [])
    .filter((e) => /paint/i.test(e?.itemPortName ?? '')).map(factoryItem).find(Boolean);
  if (!factory) return { base, factory: null };
  const tags = new Set(tokens(component(db.readRecord(factory.item, { typed: true, maxDepth: 6 }), 'SAttachableComponentParams')?.AttachDef?.Tags).map((t) => t.replace(/^@/, '').toLowerCase()));
  const sub = (geo.SubGeometry ?? []).find((s) => tokens(s.Tags).some((t) => tags.has(t.toLowerCase())));
  const c = sub && paletteColours(sub.Geometry?.Palette);
  return c ? { base: c, factory } : { base, factory: null };
}

const noRecord = [], noBase = [], sameName = [], factoryPaint = [], baseFallback = [];
let subNoPalette = 0, dupDropped = 0;
const ships = {};
for (const { slug, rec, geo } of ownShips) {
  if (!rec) { noRecord.push(slug); continue; }
  const matched = (geo?.SubGeometry ?? [])
    .map((sub) => ({ sub, items: tokens(sub.Tags).flatMap((t) => paintsByTag.get(t.toLowerCase()) ?? []) }))
    .filter((m) => m.items.length);
  if (!matched.length) continue;
  const { base, factory } = shipBase(rec, geo);
  if (!base) { noBase.push(slug); continue; }
  if (factory) { factoryVia[factory.via]++; factoryPaint.push(`${slug} (${factory.item.name.replace(/^EntityClassDefinition\./i, '')}, ${factory.via})`); }

  const byId = new Map();
  for (const { sub, items } of matched) {
    // Die Palette des Schiffs-Eintrags gilt, nicht die des Lack-Items (dessen
    // Eimer-Symbol): Gladius White_Blue_Blue nennt am Item white_blue_blue,
    // am Schiff white_white_blue, und das Schiff wird so gezeichnet.
    let colours = paletteColours(sub.Geometry?.Palette);
    if (!colours) {
      subNoPalette++;
      colours = sisterColours(slug, rec, sub);
      if (!colours) { colours = base; baseFallback.push(`${slug}: ${tokens(sub.Tags).join(' ')}`); }
    }
    const pattern = !!sub.Geometry?.Material?.path;
    // tag: der Selektor dieses Eintrags, Schlüssel des Lack-Bauplans
    // (public/hangar/paints/<schiff>.json, scripts/build-hangar-assets.mjs)
    const tagOf = (it) => tokens(sub.Tags).find((t) => (paintsByTag.get(t.toLowerCase()) ?? []).includes(it)) ?? null;
    for (const it of items) if (!byId.has(it.id)) byId.set(it.id, { id: it.id, name: it.name, tag: tagOf(it), ...colours, pattern });
  }
  const byLook = new Map();
  for (const p of [...byId.values()].sort((x, y) => (x.id < y.id ? -1 : 1))) {
    const look = [p.name, p.a, p.b, p.c, p.pattern, JSON.stringify(p.finish ?? null)].join('|');
    if (byLook.has(look)) { dupDropped++; continue; }
    byLook.set(look, p);
  }
  const paints = [...byLook.values()].sort((x, y) => x.name.localeCompare(y.name, 'en') || (x.id < y.id ? -1 : 1));
  const byName = Map.groupBy(paints, (p) => p.name);
  for (const [name, looks] of byName) if (looks.length > 1) sameName.push({ slug, name, looks });
  ships[slug] = { base, paints };
}

// ---- Gegenprobe gegen die Lack-Baupläne ----
// Farben und finish je Tag gegen palette des zerlegten Exports
// (public/hangar/paints/<schiff>.json, build-hangar-assets.mjs, dort linHex).
// Verglichen wird, was der Bauplan trägt: Manchen Paletten fehlt dort die
// Glätte (gloss null), ein Rückfall auf diese Datei trägt gar keinen finish.
const PLANS = resolve(__dirname, '..', 'public', 'hangar', 'paints');
const probe = { full: 0, partial: 0, colourOnly: 0, same: 0, noPlan: 0, planNoPalette: 0, notInData: 0, diffs: [] };
for (const [slug, s] of Object.entries(ships)) {
  const file = resolve(PLANS, `${slug}.json`);
  if (!existsSync(file)) { probe.noPlan++; continue; }
  for (const v of JSON.parse(readFileSync(file, 'utf8')).paints ?? []) {
    if (!v.palette) { probe.planNoPalette++; continue; }
    const p = s.paints.find((x) => x.tag?.toLowerCase() === v.tag?.toLowerCase());
    if (!p) { probe.notInData++; continue; }
    const pf = v.palette.finish ?? {};
    const fields = ['a', 'b', 'c'].flatMap((k) => [
      [`${k}`, v.palette[k], p[k]],
      ...(pf[k]?.specular ? [[`${k}.specular`, pf[k].specular, p.finish?.[k]?.specular]] : []),
      ...(Number.isFinite(pf[k]?.gloss) ? [[`${k}.gloss`, pf[k].gloss, p.finish?.[k]?.gloss]] : []),
    ]);
    const n = fields.length - 3;
    if (n === 6) probe.full++; else if (n) probe.partial++; else probe.colourOnly++;
    const d = fields.filter(([, want, got]) => want !== got).map(([f, want, got]) => `${f} Bauplan ${want}, Daten ${got}`);
    if (d.length) probe.diffs.push(`${slug} ${v.tag}: ${d.join('; ')}`);
    else probe.same++;
  }
}

// ---- Selbstauskunft ----
const all = Object.values(ships).flatMap((s) => s.paints);
const withPattern = all.filter((p) => p.pattern).length;
// Metall wie der Viewer es zeichnet: palettePbr, metalness > 0,5 in mindestens einem Kanal
const metal = (p) => p.finish && ['a', 'b', 'c'].some((k) => palettePbr(p[k], p.finish[k].specular, p.finish[k].gloss).metalness > 0.5);
const bases = Object.values(ships).map((s) => s.base);
console.log('\n=== datamine:paints — Lackierungen der Hangar-Schiffe ===');
console.log(`Lack-Items:                    ${itemsTotal} (ohne echten Namen uebersprungen: ${itemsNoName}, Selektor-Tags: ${paintsByTag.size})`);
console.log(`Hangar-Schiffe:                ${slugs.length}`);
console.log(`  ohne exakten Record:         ${noRecord.length}${noRecord.length ? '  ' + noRecord.join(', ') : ''}`);
console.log(`  ohne Grundpalette:           ${noBase.length}${noBase.length ? '  ' + noBase.join(', ') : ''}`);
console.log(`Schiffe geschrieben:           ${Object.keys(ships).length}`);
console.log(`Lackierungen gesamt:           ${all.length} (mit Muster: ${withPattern}, nur Palette: ${all.length - withPattern})`);
console.log(`  mit vollem finish:           ${all.filter((p) => p.finish).length}, davon Metall: ${all.filter(metal).length} (palettePbr metalness > 0,5 in mindestens einem Kanal)`);
console.log(`Grundpaletten mit finish:      ${bases.filter((b) => b.finish).length} von ${bases.length}, davon Metall: ${bases.filter(metal).length}`);
console.log(`Paletten mit Teil-finish:      ${finishPartial.size} (ohne finish geschrieben)`);
console.log(`ChildPath nicht gefunden:      ${childPathFallbacks.size} (Wurzel der Palette genommen)`);
console.log(`SubGeometry ohne Palette:      ${subNoPalette} (Schwester: ${sisterUsed.length}, Grundfarben des Schiffs: ${baseFallback.length})`);
for (const s of sisterUsed) console.log(`  Schwester  ${s}`);
for (const s of sisterAmbiguous) console.log(`  mehrdeutig ${s} (nicht genommen)`);
for (const s of baseFallback) console.log(`  Grundfarben ${s}`);
console.log(`Ab Werk lackiert:              ${factoryPaint.length} (über Verweis: ${factoryVia.Verweis}, über Namen: ${factoryVia.Name})${factoryPaint.length ? '  ' + factoryPaint.join(', ') : ''} (Grundfarben = Lack der Standardausrüstung)`);
console.log(`Doppelte verworfen:            ${dupDropped} (gleicher Name, gleiche Farben und finish, niedrigste Id bleibt)`);
console.log(`Gegenprobe Lack-Baupläne:      ${probe.full + probe.partial + probe.colourOnly} verglichen (voller finish: ${probe.full}, finish teilweise: ${probe.partial}, nur Farben: ${probe.colourOnly}), ${probe.same} gleich, ${probe.diffs.length} abweichend (Bauplan ohne Palette: ${probe.planNoPalette}, Tag nicht in den Daten: ${probe.notInData}, Schiffe ohne Bauplan: ${probe.noPlan})`);
for (const d of probe.diffs) console.log(`  ${d}`);
console.log(`Gleicher Name, andere Farben:  ${sameName.length}`);
for (const s of sameName) console.log(`  ${s.slug}: ${s.name} -> ${s.looks.map((p) => `${p.a} ${p.b} ${p.c}${p.pattern ? ' Muster' : ''}`).join(' | ')}`);

if (!Object.keys(ships).length || !all.length) {
  console.error(`FEHLER: ${Object.keys(ships).length} Schiffe, ${all.length} Lackierungen — der Leser ist kaputt, nicht der Bestand. Datei bleibt unveraendert.`);
  process.exit(1);
}
writeFileSync(OUT, JSON.stringify({ ships }, null, 2) + '\n');
console.log(`\n-> ${OUT} geschrieben`);
