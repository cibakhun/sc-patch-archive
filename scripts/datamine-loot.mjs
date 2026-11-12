// datamine-loot.mjs — Woher kommt ein Item, das kein Shop fuehrt?
//
// Loest die Loot-Ketten des Spiels auf und schreibt, in welchen Behaeltern an
// welchen Ortsarten ein Item entstehen kann, und auf welchen Planeten, Monden
// und Stationen diese Ortsarten liegen. Grundlage fuer den Fundort-Status
// „bestaetigt" im Item Finder und auf den Itemseiten (Discord-Vorschlag
// „Loot-only Items – Find Locations & How to Get Them", 10.11.2026).
//
// Kette (gemessen am 10.11.2026 an der LIVE-Fassung sc-alpha-4.10.2@12913470):
//   Ort (socpak im Level)
//     -> Belegung: SubHarvestableMultiConfigRecord / SubHarvestableConfigRecord
//        (die socpaks nennen ihre GUID in .entxml/.soc), HarvestablePreset,
//        HarvestableProviderPreset
//     -> Slot: subHarvestables[] = { harvestable (Behaelter-Preset),
//        harvestableEntityClass (lose liegendes Item), lootConfig.lootTable /
//        lootTableV3 }; die Grundbelegung einer MultiConfig (defaultConfig)
//        zaehlt wie ihre Varianten
//     -> Tabelle: LootTable (alt) / LootTableV3Record
//     -> Archetyp: LootArchetype (alt) / LootArchetypeV3Record
//     -> Tags -> Items
//   Semantik der Archetypen (Juli-Messung, docs/item-finder-armor-sets-deep-dive.md
//   § 4.2): alt = ODER innerhalb einer Gruppe, UND zwischen den Gruppen, exakter
//   Tag-Treffer, negativeTags/excludedTags schliessen aus. V3 = alle positiven
//   Tags eines Eintrags noetig, keiner der negativen.
//   Orte: Ein socpak verweist ueber seine .entxml auf Kind-socpaks. Von den
//   Wurzeln der Sternsysteme (pu/system/<system>/<koerper>.socpak und
//   pu/system/<system>/<system>system.socpak) abwaerts ergibt das je Belegung
//   die Himmelskoerper, auf denen sie wirklich steht. Die System-Wurzel
//   erreicht auch alles auf den Koerpern; sie zaehlt deshalb nur fuer
//   Container, die kein Himmelskoerper erreicht (im All). Belegungen ohne Weg
//   von einer Wurzel stehen nur in Missions-, Arena- oder Testinhalten und
//   fallen heraus.
//
// Aufruf:  npm run datamine:loot           (Patch-Day-Schritt, braucht lokales SC;
//                                          traegt danach die Item-Datenbank nach)
//          SC_P4K=<pfad> node scripts/datamine-loot.mjs
//          node scripts/datamine-loot.mjs --out <datei>     (anderer Zielpfad)
//          node scripts/datamine-loot.mjs --roh <datei>     (zusaetzlich die volle
//                                          Kette mit Stufen, Behaeltern, Tabellen)
//          node scripts/datamine-loot.mjs --trotz-lesefehler (schreibt auch, wenn
//                                          socpaks nicht lesbar waren; ihre Zahl
//                                          steht dann in meta.counts.scanFehler)
// Abbruch ohne Ausgabe: keine Patch-Kennung mit Changelist neben dem p4k, oder
// Lesefehler im Scan (ohne --trotz-lesefehler). Beides ergaebe einen Stand, der
// nicht zuzuordnen bzw. still lueckenhaft ist; geschrieben wird dann nichts.
// Ausgabe: src/data/loot-fundorte.json (getrackter Schnappschuss; die Seite liest
//          nie das p4k): je Item die platzierten Belegungen, je Belegung die
//          Himmelskoerper. Die lesbaren Ortsnamen stehen NICHT hier, sondern
//          kuratiert in scripts/lib/loot-orte.mjs — so laesst sich die
//          Benennung ohne neuen PC-Lauf verbessern, und verify:loot-fundorte
//          prueft, dass jede Belegung einen Namen hat.
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openP4k, DEFAULT_P4K, clientManifest } from './lib/p4k.mjs';
import { openDataCore } from './lib/datacore.mjs';
import { buildTagIndex } from './lib/tags.mjs';
import { readZip } from './lib/soc-objects.mjs';
import { schreibeFundorte } from './lib/loot-orte.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const OUT = resolve(argOf('--out') ?? resolve(__dirname, '..', 'src', 'data', 'loot-fundorte.json'));
const ROH = argOf('--roh') ? resolve(argOf('--roh')) : null;

const t0 = Date.now();
const sek = () => ((Date.now() - t0) / 1000).toFixed(0) + ' s';
const p4k = openP4k(argOf('--p4k') ?? DEFAULT_P4K);
console.log(`p4k: ${p4k.path} (${(p4k.size / 2 ** 30).toFixed(1)} GiB)`);
let patch = null;
{
  // Patch-Kennung wie datamine-missions.mjs: Branch + Changelist (D-16).
  const d = clientManifest(p4k.path);
  patch = d?.Branch && d?.RequestedP4ChangeNum ? `${d.Branch}@${d.RequestedP4ChangeNum}` : (d?.Branch ?? d?.Version ?? null);
}
// Ohne Changelist ist der Stand keinem Patch zuzuordnen; verify:loot-fundorte
// verwirft ihn ohnehin. Abbrechen, bevor etwas geschrieben oder in den Katalog
// getragen wird (npm run datamine:loot haengt apply mit && an).
if (!patch || !/@\d{6,}$/.test(patch)) {
  console.error(`Abbruch: keine Patch-Kennung mit Changelist (${patch ?? 'build_manifest.id fehlt oder ist nicht lesbar'}) neben ${p4k.path} — nichts geschrieben.`);
  process.exit(1);
}
const db = openDataCore(p4k.read(/^Data[\\/]Game2\.dcb$/i));
const TAGS = buildTagIndex(db);
console.log(`DataCore v${db.version}: ${db.records.length} Records, ${TAGS.count} Tags (${sek()})`);

/* ---------------- Helfer ---------------- */
const sName = (r) => db.structs[r.structIndex]?.name || '?';
const kurz = (r) => r.name.replace(/^[A-Za-z0-9]+\./, '');
const rd = (r, d = 14) => db.readRecord(r, { typed: true, maxDepth: d });
const refId = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v.__ref ?? null : null);
const refsIn = (o) => [...new Set([...JSON.stringify(o).matchAll(/"__ref":"([0-9a-f]{32})"/g)].map((m) => m[1]))];
const tagIds = (arr) => (arr || []).map(refId).filter(Boolean);
const byId = db.recordById;
const isScItem = (r) => sName(r) === 'EntityClassDefinition' && /entities[\\/]scitem[\\/]/i.test(r.fileName || '');
// Die socpaks nennen GUIDs in der ueblichen Schreibweise (8-4-4-4-12); der
// DataCore fuehrt sie als 32 Hex in Byte-Reihenfolge. Gegenprobe: ein
// Tag-Record traegt seine GUID im Namen (Tag.<guid>).
const kanon = (h) => {
  const s = h.slice(0, 16).match(/../g).reverse().join('') + h.slice(16).match(/../g).reverse().join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
};
{
  const tag = db.records.find((r) => sName(r) === 'Tag');
  if (`Tag.${kanon(tag.id)}` !== tag.name) throw new Error(`GUID-Schreibweise stimmt nicht: ${kanon(tag.id)} vs ${tag.name}`);
}

/* ---------------- 1) Items und ihre Tags ---------------- */
const items = new Map(); // id -> { tags:Set, lootable }
for (const r of db.records) {
  if (!isScItem(r)) continue;
  let o; try { o = db.readRecord(r, { maxDepth: 2 }); } catch { continue; }
  const tags = new Set(tagIds(o?.tags));
  const paths = TAGS.pathsOf(o?.tags);
  const lootable = paths.some((p) => p.startsWith('LootGeneration.CannotGenerateAsLoot')) ? false
    : paths.some((p) => p.startsWith('LootGeneration.CanGenerateAsLoot')) ? true : null;
  items.set(r.id, { tags, lootable });
}
console.log(`Items: ${items.size} (${sek()})`);
const hatAlle = (it, ids) => ids.every((g) => it.tags.has(g));
const hatKeins = (it, ids) => !ids.some((g) => it.tags.has(g));

/* ---------------- 2) Archetypen -> Items ---------------- */
const archItems = new Map(); // archetype record id -> Set(itemId)
function altArchetyp(o) {
  const excl = tagIds(o?.excludedTags?.tags);
  const entryOk = (it, e) => {
    const t = refId(e?.tag);
    const pos = tagIds(e?.additionalTags?.positiveTags);
    if (t && !it.tags.has(t)) return false;
    if (!hatAlle(it, pos)) return false;
    if (!hatKeins(it, tagIds(e?.additionalTags?.negativeTags))) return false;
    return Boolean(t) || pos.length > 0;
  };
  const gruppen = [o?.primaryOrGroup?.entries || [], ...(o?.secondaryOrGroups || []).map((g) => g?.entries || [])].filter((g) => g.length);
  const set = new Set();
  if (!gruppen.length) return set;
  for (const [id, it] of items) {
    if (!hatKeins(it, excl)) continue;
    if (gruppen.every((g) => g.some((e) => entryOk(it, e)))) set.add(id);
  }
  return set;
}
function v3Eintraege(entries) {
  const set = new Set();
  for (const e of entries || []) {
    const sel = e?.selector;
    const pos = tagIds(sel?.tags?.positiveTags), neg = tagIds(sel?.tags?.negativeTags);
    if (pos.length) for (const [id, it] of items) if (hatAlle(it, pos) && hatKeins(it, neg)) set.add(id);
    // Andere Selektoren nennen Items direkt (heute gibt es nur den Tag-Selektor).
    for (const g of refsIn(sel)) if (items.has(g)) set.add(g);
  }
  return set;
}
let archAlt = 0, archV3 = 0;
for (const r of db.records) {
  const s = sName(r);
  if (s === 'LootArchetype') { archItems.set(r.id, altArchetyp(rd(r))); archAlt++; }
  else if (s === 'LootArchetypeV3Record') { archItems.set(r.id, v3Eintraege(rd(r)?.lootArchetype?.entries)); archV3++; }
}
console.log(`Archetypen: ${archAlt} alt + ${archV3} V3 (${sek()})`);

/* ---------------- 3) Tabellen -> Archetypen ---------------- */
const tabArch = new Map(); // table record id -> Set(archetype id) (inline V3 als eigene Pseudo-Id)
let inlineN = 0;
for (const r of db.records) {
  const s = sName(r);
  if (s !== 'LootTable' && s !== 'LootTableV3Record') continue;
  const o = rd(r);
  const set = new Set();
  if (s === 'LootTable') {
    for (const g of refsIn(o)) if (archItems.has(g)) set.add(g);
  } else {
    for (const la of o?.lootTable?.lootArchetypes || []) {
      const a = la?.archetype;
      const ref = refId(a?.lootArchetypeRecord);
      if (ref) { if (archItems.has(ref)) set.add(ref); continue; }
      const inl = a?.lootArchetype?.entries || a?.entries;
      if (inl) { const pid = `inline:${r.id}:${inlineN++}`; archItems.set(pid, v3Eintraege(inl)); set.add(pid); }
    }
  }
  tabArch.set(r.id, set);
}
console.log(`Tabellen: ${tabArch.size} (${sek()})`);

/* ---------------- 4) Behaelter-Entities mit eigener Tabelle ---------------- */
// Nicht-Item-Entities, die selbst eine Loot-Tabelle nennen (Kisten, Leichen,
// Regale). Sie stehen entweder in einem Slot (HarvestablePreset.entityClass)
// oder direkt im Level (per Klassenname in der .entxml).
const entTabs = new Map(); // entity id -> Set(table id)
for (const r of db.records) {
  if (sName(r) !== 'EntityClassDefinition' || isScItem(r)) continue;
  let o; try { o = db.readRecord(r, { maxDepth: 10 }); } catch { continue; }
  const t = refsIn(o).filter((g) => tabArch.has(g));
  if (t.length) entTabs.set(r.id, new Set(t));
}
console.log(`Behaelter-Entities mit Tabelle: ${entTabs.size} (${sek()})`);

/* ---------------- 5) Belegungen: Slots, Kanten, Quellen ---------------- */
// Knoten = Belegungs-Records. Kanten Eltern -> Kind, damit Orte nach unten
// vererbt werden (eine MultiConfig im Level gibt ihren Ort an jede SubConfig
// weiter, die sie nennt). Quellen haengen am Slot-Eigentuemer.
const BELEGUNG = /^(SubHarvestableMultiConfigRecord|SubHarvestableConfigRecord|HarvestablePreset|HarvestableProviderPreset|HarvestableClusterPreset|HarvestableSetup)$/;
const kinder = new Map(); // id -> Set(id)
const eltern = new Map();
const kante = (a, b) => {
  if (!a || !b || a === b) return;
  if (!kinder.has(a)) kinder.set(a, new Set()); kinder.get(a).add(b);
  if (!eltern.has(b)) eltern.set(b, new Set()); eltern.get(b).add(a);
};
const slots = []; // { owner, stufe, behaelter (preset id|null), tabs:Set, lose: itemId|null }
function slotsIn(owner, o, stufe) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o)) { for (const x of o) slotsIn(owner, x, stufe); return; }
  // MultiConfig: je benannter Variante ("GRADE D - COMMON", "Lootable Containers" …)
  if (Array.isArray(o.taggedConfigs)) {
    for (const tc of o.taggedConfigs) {
      const sub = refId(tc?.subConfig?.subConfigRef);
      if (sub) { kante(owner, sub); stufeVon.set(`${owner}>${sub}`, tc?.name || null); }
      slotsIn(owner, tc?.subConfig, tc?.name || stufe);
    }
    // Die Grundbelegung (defaultConfig) gilt fuer alle Slots ohne passende Variante.
    const def = refId(o.defaultConfig?.subConfigRef);
    if (def) kante(owner, def);
    slotsIn(owner, o.defaultConfig, stufe);
    return;
  }
  if (Array.isArray(o.subHarvestables)) {
    for (const h of o.subHarvestables) {
      const preset = refId(h?.harvestable);
      const lose = refId(h?.harvestableEntityClass);
      const tabs = new Set([refId(h?.lootConfig?.lootTable), refId(h?.lootConfig?.lootTableV3)].filter((g) => g && tabArch.has(g)));
      if (preset) kante(owner, preset);
      if (!tabs.size && preset) {
        // Behaelter ohne Tabelle im Slot: die Entity des Presets kann eine eigene haben.
        const ent = refId(byId.get(preset) && presetEntity.get(preset));
        if (ent && entTabs.has(ent)) for (const t of entTabs.get(ent)) tabs.add(t);
      }
      if (tabs.size || (lose && items.has(lose))) slots.push({ owner, stufe: stufe ?? null, behaelter: preset, tabs, lose: lose && items.has(lose) ? lose : null });
    }
  }
  for (const [k, v] of Object.entries(o)) if (k !== 'subHarvestables' && k !== 'taggedConfigs' && v && typeof v === 'object') slotsIn(owner, v, stufe);
}
const stufeVon = new Map();
const presetEntity = new Map(); // HarvestablePreset id -> entityClass ref
const belegRecs = db.records.filter((r) => BELEGUNG.test(sName(r)));
const belegDaten = new Map();
for (const r of belegRecs) {
  let o; try { o = rd(r); } catch { continue; }
  belegDaten.set(r.id, o);
  if (sName(r) === 'HarvestablePreset') presetEntity.set(r.id, o?.entityClass ?? null);
}
for (const r of belegRecs) {
  const o = belegDaten.get(r.id);
  if (!o) continue;
  slotsIn(r.id, o, null);
  // Provider/Cluster nennen ihre Presets in eigenen Listen (harvestables[].harvestable …)
  if (!/^SubHarvestable/.test(sName(r))) for (const g of refsIn(o)) if (belegDaten.has(g)) kante(r.id, g);
}
// Entities mit eigener Tabelle, die direkt als Preset-Entity dienen, sind
// Kinder ihres Presets; direkt im Level stehende kommen ueber den Scan.
for (const [pid, ent] of presetEntity) { const e = refId(ent); if (e && entTabs.has(e)) kante(pid, e); }
for (const [eid, tabs] of entTabs) slots.push({ owner: eid, stufe: null, behaelter: eid, tabs, lose: null });
console.log(`Slots mit Loot: ${slots.length}, Kanten: ${[...kinder.values()].reduce((n, s) => n + s.size, 0)} (${sek()})`);

/* ---------------- 6) Orte: socpaks scannen ---------------- */
// Ziel-GUIDs (Schreibweise der Level-Dateien) und Entity-Klassennamen.
const zielGuid = new Map();
for (const r of belegRecs) zielGuid.set(kanon(r.id), r.id);
for (const g of tabArch.keys()) zielGuid.set(kanon(g), g);
const zielKlasse = new Map();
for (const eid of entTabs.keys()) zielKlasse.set(kurz(byId.get(eid)).toLowerCase(), eid);
const GUIDRX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const KLASSERX = /EntityClass="([^"]+)"/g;
const KINDRX = /(?:data[\\/])?objectcontainers[\\/][^"<>\s]*?\.socpak/gi;
const normPfad = (p) => p.toLowerCase().replace(/\\/g, '/').replace(/^data\//, '').replace(/^objectcontainers\//, '');

const socs = p4k.entries(/objectcontainers[\\/].*\.socpak$/i);
console.log(`socpaks: ${socs.length}`);
const platziert = new Map(); // record id -> Map(socpakPfad -> n)
const kindSoc = new Map();   // socpakPfad -> Set(kindPfad)
const hatEltern = new Set();
let dateien = 0, fehler = 0, i = 0;
const fehlerOrte = []; // die ersten unlesbaren socpaks/Dateien fuer die Abbruchmeldung
for (const e of socs) {
  if (++i % 1000 === 0) console.log(`  ${i}/${socs.length} socpaks (${sek()})`);
  const pfad = normPfad(e.name);
  let files; try { files = readZip(p4k.extract(e)); } catch { fehler++; if (fehlerOrte.length < 5) fehlerOrte.push(pfad); continue; }
  const kids = new Set();
  for (const [name, get] of files) {
    if (/\.(cgf|cga|cgam|cgfm|dds|\d+|skin|chr|cdf|mtl|png|tif)$/i.test(name)) continue;
    let s; try { s = get().toString('latin1'); } catch { fehler++; if (fehlerOrte.length < 5) fehlerOrte.push(`${pfad}:${name}`); continue; }
    dateien++;
    const treffer = (id) => {
      if (!platziert.has(id)) platziert.set(id, new Map());
      const m = platziert.get(id); m.set(pfad, (m.get(pfad) || 0) + 1);
    };
    for (const m of s.matchAll(GUIDRX)) { const id = zielGuid.get(m[0].toLowerCase()); if (id) treffer(id); }
    if (/\.entxml$/i.test(name)) for (const m of s.matchAll(KLASSERX)) { const id = zielKlasse.get(m[1].toLowerCase()); if (id) treffer(id); }
    for (const m of s.matchAll(KINDRX)) { const k = normPfad(m[0]); if (k !== pfad) kids.add(k); }
  }
  kindSoc.set(pfad, kids);
  for (const k of kids) hatEltern.add(k);
}
p4k.close();
console.log(`Scan fertig: ${dateien} Dateien, ${fehler} Fehler, ${platziert.size} Belegungen platziert (${sek()})`);
// Ein unlesbares socpak nimmt seine Belegungen und Kind-socpaks still mit; die
// Klinken in verify:loot-fundorte sehen den Verlust einzelner Orte nicht.
if (fehler && !argv.includes('--trotz-lesefehler')) {
  console.error(`Abbruch: ${fehler} Lesefehler im Scan, z. B. ${fehlerOrte.join(', ')}${fehler > fehlerOrte.length ? ' …' : ''} — nichts geschrieben.`);
  console.error('Erst den Leser reparieren. Bewusst trotzdem schreiben: node scripts/datamine-loot.mjs --trotz-lesefehler, danach npm run apply:loot-fundorte (die Zahl steht dann in meta.counts.scanFehler).');
  process.exit(1);
}

// Wurzeln der Welt: Himmelskoerper und Systeme, Levski, Stationen.
// Arena-Commander-/Star-Marine-Karten (ea/) und Editor-Setups zaehlen nicht.
function wurzelVon(p) {
  let m;
  if ((m = /^pu\/system\/(stanton|pyro|nyx)\/([a-z0-9_]+)\.socpak$/.exec(p))) return `${m[1]}/${m[2]}`;
  if ((m = /^pu\/system\/(stanton|pyro|nyx)\.socpak$/.exec(p))) return `${m[1]}/${m[1]}`;
  return null;
}
// Fuer jeden socpak: welche Welt-Wurzeln erreichen ihn (BFS von den Wurzeln abwaerts).
const erreicht = new Map(); // pfad -> Set(wurzel)
for (const [p] of kindSoc) {
  const w = wurzelVon(p);
  if (!w) continue;
  const stack = [p];
  const gesehen = new Set([p]);
  while (stack.length) {
    const cur = stack.pop();
    if (!erreicht.has(cur)) erreicht.set(cur, new Set());
    erreicht.get(cur).add(w);
    for (const k of kindSoc.get(cur) || []) if (!gesehen.has(k)) { gesehen.add(k); stack.push(k); }
  }
}
console.log(`Welt-Wurzeln: ${new Set([...erreicht.values()].flatMap((s) => [...s])).size}, erreichte socpaks: ${erreicht.size} (${sek()})`);

/* ---------------- 7) Orte je Belegung (nach unten vererbt) ---------------- */
// Die System-Wurzel erreicht alles, auch was auf einem Himmelskoerper steht.
// Sie zaehlt deshalb nur, wo kein Koerper desselben Systems den Container
// erreicht: dann steht er im All (Station, Asteroidenbasis).
const istSystemWurzel = (w) => { const [s, k] = w.split('/'); return k === s || k === `${s}system`; };
function wurzelnVon(p) {
  const alle = [...(erreicht.get(p) || [])];
  return alle.filter((w) => !istSystemWurzel(w) || !alle.some((x) => !istSystemWurzel(x) && x.split('/')[0] === w.split('/')[0]));
}
const ortDirekt = new Map(); // id -> { socpaks:Set, wurzeln:Map(w->n) }
for (const [id, m] of platziert) {
  const w = new Map();
  for (const p of m.keys()) for (const x of wurzelnVon(p)) w.set(x, (w.get(x) || 0) + 1);
  ortDirekt.set(id, { socpaks: new Set(m.keys()), wurzeln: w });
}
// Platzierte Vorfahren eines Knotens (inkl. selbst), bis zur ersten platzierten Ebene.
function platzierteVorfahren(id, gesehen = new Set()) {
  if (gesehen.has(id)) return [];
  gesehen.add(id);
  const out = [];
  if (ortDirekt.has(id)) out.push(id);
  for (const p of eltern.get(id) || []) out.push(...platzierteVorfahren(p, gesehen));
  return [...new Set(out)];
}
function oberste(id, gesehen = new Set()) {
  if (gesehen.has(id)) return [];
  gesehen.add(id);
  const ps = [...(eltern.get(id) || [])];
  if (!ps.length) return [id];
  return [...new Set(ps.flatMap((p) => oberste(p, gesehen)))];
}

/* ---------------- 8) Quellen und Items ---------------- */
// Quelle = (Ort-Belegung, Stufe, Behaelter). Ort-Belegung ist die platzierte
// Belegung, unter der der Slot haengt; ohne platzierten Vorfahren die oberste
// (dann steht sie nur in Missions-/Arena-Inhalten: ohne Himmelskoerper).
const quellen = [];
const quelleIdx = new Map();
const quelle = (ort, stufe, behaelter) => {
  const k = `${ort}|${stufe ?? ''}|${behaelter ?? ''}`;
  if (!quelleIdx.has(k)) { quelleIdx.set(k, quellen.length); quellen.push({ ort, stufe: stufe ?? null, behaelter: behaelter ?? null }); }
  return quelleIdx.get(k);
};
const tabQuellen = new Map(); // table id -> Set(quelleIdx)
const loseQuellen = new Map(); // item id -> Set(quelleIdx)
let ohneOrt = 0;
for (const s of slots) {
  let orte = platzierteVorfahren(s.owner);
  if (!orte.length) { orte = oberste(s.owner); ohneOrt++; }
  for (const o of orte) {
    // Stufe: steht der Slot direkt in der MultiConfig, traegt er sie selbst;
    // haengt er in einer SubConfig darunter, nennt die Kante die Variante.
    const stufe = s.stufe ?? stufeVon.get(`${o}>${s.owner}`) ?? null;
    if (s.tabs.size) {
      const q = quelle(o, stufe, s.behaelter && byId.get(s.behaelter) ? kurz(byId.get(s.behaelter)) : null);
      for (const t of s.tabs) { if (!tabQuellen.has(t)) tabQuellen.set(t, new Set()); tabQuellen.get(t).add(q); }
    }
    if (s.lose) { if (!loseQuellen.has(s.lose)) loseQuellen.set(s.lose, new Set()); loseQuellen.get(s.lose).add(quelle(o, stufe, 'lose')); }
  }
}

// Item -> Tabellen (nur Tabellen, die an einer Quelle haengen)
const tabNamen = [...tabQuellen.keys()].sort((a, b) => kurz(byId.get(a)).localeCompare(kurz(byId.get(b))));
const tabIdx = new Map(tabNamen.map((t, n) => [t, n]));
const itemTabs = new Map();
for (const t of tabNamen) {
  for (const a of tabArch.get(t) || []) for (const it of archItems.get(a) || []) {
    if (!itemTabs.has(it)) itemTabs.set(it, new Set());
    itemTabs.get(it).add(tabIdx.get(t));
  }
}
const itemIds = [...new Set([...itemTabs.keys(), ...loseQuellen.keys()])].sort();

// Orte: nur die, die an einer Quelle haengen. Name = Record-Name ohne Struktur.
// Platziert, aber von keiner Welt-Wurzel erreicht: die obersten socpaks nennen,
// unter denen die Belegung steht (Missions-, Arena- oder Event-Inhalte).
const socEltern = new Map();
for (const [p, ks] of kindSoc) for (const k of ks) { if (!socEltern.has(k)) socEltern.set(k, new Set()); socEltern.get(k).add(p); }
function obersteSoc(p, gesehen = new Set()) {
  if (gesehen.has(p)) return [];
  gesehen.add(p);
  const ps = [...(socEltern.get(p) || [])];
  if (!ps.length) return [p];
  return [...new Set(ps.flatMap((x) => obersteSoc(x, gesehen)))];
}
const ortIds = [...new Set(quellen.map((q) => q.ort))];
const ortName = new Map(ortIds.map((id) => [id, byId.get(id) ? kurz(byId.get(id)) : id]));
if (new Set(ortName.values()).size !== ortName.size) throw new Error('Zwei Orte tragen denselben Namen — Schluessel waere nicht eindeutig');
const orte = {};
for (const id of [...ortIds].sort((a, b) => ortName.get(a).localeCompare(ortName.get(b)))) {
  const rec = byId.get(id);
  const d = ortDirekt.get(id);
  const wurzeln = d ? Object.fromEntries([...d.wurzeln].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) : {};
  const o = {
    typ: rec ? sName(rec) : null,
    socpaks: d ? d.socpaks.size : 0,
    wurzeln,
    beispiele: d ? [...d.socpaks].sort().slice(0, 3) : [],
  };
  if (d && !Object.keys(wurzeln).length) o.oberste = [...new Set([...d.socpaks].flatMap((p) => obersteSoc(p)))].sort().slice(0, 4);
  orte[ortName.get(id)] = o;
}
const ortNamen = Object.keys(orte);

// Volle Kette (Stufen, Behaelter, Tabellen) nur auf Wunsch: zum Nachmessen,
// nicht fuer die Seite.
const counts = {
  items: itemIds.length,
  itemsLose: loseQuellen.size,
  quellen: quellen.length,
  tabellen: tabNamen.length,
  orte: ortNamen.length,
  orteMitWelt: ortNamen.filter((n) => Object.keys(orte[n].wurzeln).length).length,
  slotsOhnePlatzierung: ohneOrt,
  socpaks: socs.length,
  socpakDateien: dateien,
  scanFehler: fehler,
};
if (ROH) {
  const roh = {
    meta: { patch, generated: new Date().toISOString().slice(0, 10), generator: 'scripts/datamine-loot.mjs --roh', counts },
    orte,
    quellen: quellen.map((q) => [ortName.get(q.ort), q.stufe, q.behaelter]),
    tabellen: tabNamen.map((t) => ({ name: kurz(byId.get(t)), quellen: [...tabQuellen.get(t)].sort((a, b) => a - b) })),
    // guid -> [Tabellen-Indizes] und/oder { t, l: [Quellen-Indizes] }
    items: Object.fromEntries(itemIds.map((id) => {
      const t = itemTabs.has(id) ? [...itemTabs.get(id)].sort((a, b) => a - b) : [];
      const l = loseQuellen.has(id) ? [...loseQuellen.get(id)].sort((a, b) => a - b) : [];
      return [id, l.length ? { t, l } : t];
    })),
  };
  writeFileSync(ROH, JSON.stringify(roh) + '\n');
  console.log(`roh geschrieben: ${ROH}`);
}

// Fuer die Seite: je Item die platzierten Belegungen (nur solche mit
// Himmelskoerper oder System), gebuendelt zu Profilen, weil viele Items
// dieselben Orte teilen. Alles sortiert: derselbe Lauf ergibt dieselbe Datei.
const inWelt = (n) => Object.keys(orte[n].wurzeln).length > 0;
const itemBelegungen = new Map();
for (const id of itemIds) {
  const qs = new Set(loseQuellen.get(id) || []);
  for (const t of itemTabs.get(id) || []) for (const q of tabQuellen.get(tabNamen[t])) qs.add(q);
  const bel = new Set();
  for (const q of qs) { const n = ortName.get(quellen[q].ort); if (inWelt(n)) bel.add(n); }
  if (bel.size) itemBelegungen.set(id, [...bel].sort());
}
const profilSchluessel = [...new Set([...itemBelegungen.values()].map((b) => JSON.stringify(b)))].sort();
const profilIdx = new Map(profilSchluessel.map((k, i) => [k, i]));
const genutzt = [...new Set([...itemBelegungen.values()].flat())].sort();
const fd = {
  meta: {
    patch,
    generated: new Date().toISOString().slice(0, 10),
    generator: 'scripts/datamine-loot.mjs',
    aussage: 'Ein Item steht unter einer Belegung, wenn einer ihrer Slots es per Tags waehlen kann. Gewichte sind bewusst nicht mitgefuehrt: die Aussage ist „kann dort entstehen", nicht „faellt oft".',
    counts: {
      items: itemBelegungen.size,
      itemsOhneWelt: itemIds.length - itemBelegungen.size,
      belegungen: genutzt.length,
      profile: profilSchluessel.length,
      belegungenOhneWelt: ortNamen.filter((n) => !inWelt(n)).length,
      slotsOhnePlatzierung: ohneOrt,
      socpaks: socs.length,
      socpakDateien: dateien,
      scanFehler: fehler,
    },
  },
  belegungen: Object.fromEntries(genutzt.map((n) => [n, { wurzeln: orte[n].wurzeln, socpaks: orte[n].socpaks }])),
  profile: profilSchluessel.map((k) => JSON.parse(k)),
  items: Object.fromEntries([...itemBelegungen.keys()].sort().map((id) => [id, profilIdx.get(JSON.stringify(itemBelegungen.get(id)))])),
};
const text = schreibeFundorte(fd);
writeFileSync(OUT, text);
console.log(`\ngeschrieben: ${OUT} (${(text.length / 1024).toFixed(0)} KB, ${sek()})`);
console.log({ ...counts, ...fd.meta.counts });
