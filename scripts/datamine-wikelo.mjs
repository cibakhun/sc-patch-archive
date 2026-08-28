// datamine-wikelo.mjs — Wikelos Tauschangebote aus den Spieldateien.
//
// WARUM ES DAS GIBT: Bis zum 28.08.2026 galt im Projekt als gesichert, dass es
// "keine Tauschtabelle in den Spieldaten" gebe und die 63 Angebote von Hand
// gepflegt werden muessten. Das war falsch, und zwar aus einem Grund, den das
// Projekt schon zweimal bezahlt hat: geprueft wurde die EIGENE missions.json,
// nicht der Bestand. Zwei Dinge verstecken die Tabelle:
//
//   1. Wikelo heisst intern `TheCollector`. Eine Namenssuche nach "wikelo"
//      findet 28 Records — Reputation, Missionstypen, Farbpaletten — und
//      keinen einzigen Vertrag.
//   2. Die Gegenleistung heisst nicht "barter" oder "cost", sondern
//      `haulingOrders`: dieselbe Struktur, mit der auch Frachtauftraege
//      beschrieben werden. Jeder Eintrag traegt `entityClass` (die Ware) und
//      `minAmount` (die Menge).
//
// Der Weg: ContractGenerator.TheCollector -> generators[].contracts[] ->
// template -> objectiveTokens[].objectiveHandler.haulingOrders[].
// Der Titel steht als Loc-Schluessel in paramOverrides.stringParamOverrides.
//
// Der Name endet auf `-gamefiles.json`, und das ist keine Kosmetik: nur so
// haelt _sync-assets.mjs die Datei aus public/assets heraus. Der erste Anlauf
// hiess `wikelo-orders.json`, wurde mitausgeliefert und von audit:site
// gefangen — die Kopfzeile nennt ihren Erzeuger, und Herkunft gehoert nicht
// ins Ausgelieferte. Diese Datei ist eine Build-EINGABE, kein Endprodukt.
//
//   node scripts/datamine-wikelo.mjs            schreibt assets/wikelo-gamefiles.json
//   node scripts/datamine-wikelo.mjs --report   nur zaehlen, nichts schreiben
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openP4k, DEFAULT_P4K } from './lib/p4k.mjs';
import { openDataCore } from './lib/datacore.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPORT = process.argv.includes('--report');

const p4k = openP4k();
const iniText = p4k.read(/Localization[\\/]english[\\/]global\.ini$/i).toString('utf8');
const db = openDataCore(p4k.read(/^Data[\\/]Game2\.dcb$/i));
p4k.close();

/* ---------- Loc ---------- */
const EN = new Map();
for (const zeile of iniText.split(/\r?\n/)) {
  const i = zeile.indexOf('=');
  if (i < 0) continue;
  const k = zeile.slice(0, i).trim().toLowerCase();
  if (!EN.has(k)) EN.set(k, zeile.slice(i + 1));
}
const LEER = new Set(['@LOC_UNINITIALIZED', '@LOC_EMPTY', '@LOC_PLACEHOLDER', '']);
const loc = (k) => {
  if (typeof k !== 'string' || LEER.has(k)) return null;
  if (!k.startsWith('@')) return k.trim() || null;
  const v = EN.get(k.slice(1).toLowerCase());
  const t = v == null ? '' : v.replace(/\s+/g, ' ').trim();
  return t === '' ? null : t;
};

/* ---------- Anzeigename einer EntityClassDefinition ---------- */
// Dieselbe Kette wie in datamine-crafting.mjs: AttachDef-Name, dann die
// Konvention @item_Name<Klasse>, dann die Kurzform.
const nameCache = new Map();
function entityName(ref) {
  if (!ref?.__ref) return null;
  if (nameCache.has(ref.__ref)) return nameCache.get(ref.__ref);
  const rec = db.recordById.get(ref.__ref);
  let out = null;
  if (rec) {
    try {
      const e = db.readRecord(rec, { typed: true, maxDepth: 6 });
      const comps = new Map();
      for (const c of e?.Components ?? []) if (c?.__type && !comps.has(c.__type)) comps.set(c.__type, c);
      const attach = comps.get('SAttachableComponentParams')?.AttachDef;
      const klasse = rec.name.replace('EntityClassDefinition.', '');
      out = loc(attach?.Localization?.Name) ?? loc('@item_Name' + klasse) ?? loc(attach?.Localization?.ShortName) ?? null;
    } catch { /* Name bleibt null */ }
  }
  nameCache.set(ref.__ref, out);
  return out;
}

/* ---------- Die Vertraege ---------- */
const genRec = db.records.find((r) => r.name === 'ContractGenerator.TheCollector');
if (!genRec) { console.error('FEHLER: ContractGenerator.TheCollector fehlt — heisst Wikelo noch "TheCollector"?'); process.exit(1); }
const gen = db.readRecord(genRec, { typed: true, maxDepth: 12 });

const vertraege = [];
for (const g of gen.generators ?? []) for (const c of g.contracts ?? []) vertraege.push(c);

const strParam = (c, name) => (c.paramOverrides?.stringParamOverrides ?? []).find((p) => p.param === name)?.value ?? null;

const out = [];
let ohneTemplate = 0, ohneOrders = 0;
for (const c of vertraege) {
  if (c.notForRelease || c.workInProgress) continue;
  const titel = loc(strParam(c, 'Title'));
  const beschreibung = loc(strParam(c, 'Description'));
  const tRec = c.template?.__ref ? db.recordById.get(c.template.__ref) : null;
  if (!tRec) { ohneTemplate++; continue; }
  const t = db.readRecord(tRec, { typed: true, maxDepth: 12 });

  // Gegenleistung — ZWEI Wege, beide noetig:
  //
  //   A) eigenes Template je Vertrag: die Waren stehen direkt in
  //      objectiveTokens[].objectiveHandler.haulingOrders[]
  //   B) generisches Template (ItemResourceGathering_TheCollector, 32 von 69
  //      Vertraegen teilen es): dort steht nichts Konkretes, die Waren kommen
  //      aus dem Vertrag selbst — paramOverrides.propertyOverrides mit
  //      missionVariableName "HaulingOverride" und haulingOrderContent[].
  //
  // Wer nur A liest, sieht 37 von 69 Vertraegen mit Gegenleistung und haelt
  // die uebrigen 32 fuer leer. Sie sind es nicht.
  const orders = [];
  const nimm = (o) => {
    if (!o?.entityClass) return;
    orders.push({
      klasse: o.entityClass.name?.replace('EntityClassDefinition.', '') ?? null,
      name: entityName(o.entityClass),
      min: o.minAmount ?? null,
      max: o.maxAmount ?? null,
    });
  };
  for (const tok of t.objectiveTokens ?? []) {
    for (const o of tok.objectiveHandler?.haulingOrders ?? []) {
      if (o.__type === 'HaulingOrder_EntityClass') nimm(o);
    }
  }
  for (const p of c.paramOverrides?.propertyOverrides ?? []) {
    if (p.value?.__type !== 'MissionPropertyValue_HaulingOrders') continue;
    for (const o of p.value.haulingOrderContent ?? []) {
      if (o.__type === 'HaulingOrderContent_EntityClass') nimm(o);
    }
  }
  if (!orders.length) ohneOrders++;

  // Belohnung: die Reputationsstufe steht als eigener Record, das Item im Ergebnis
  const rep = [];
  const items = [];
  const lauf = (o, tiefe) => {
    if (!o || typeof o !== 'object' || tiefe > 8) return;
    for (const [k, v] of Object.entries(o)) {
      if (k === 'name' && typeof v === 'string' && v.startsWith('SReputationRewardAmount.')) rep.push(v.replace('SReputationRewardAmount.', ''));
      if (k === 'entityClass' && v?.__ref) { const n = entityName(v); if (n) items.push(n); }
      if (typeof v === 'object') lauf(v, tiefe + 1);
    }
  };
  lauf(c.contractResults, 0);
  lauf(t.contractDisplayInfo, 0);

  out.push({
    id: c.id ?? null,
    debugName: c.debugName ?? null,
    template: tRec.name.replace('ContractTemplate.', ''),
    titel,
    beschreibung: beschreibung ? beschreibung.slice(0, 400) : null,
    orders,
    rewardItems: [...new Set(items)],
    reputation: [...new Set(rep)],
  });
}

const mitOrders = out.filter((x) => x.orders.length).length;
const ordersGesamt = out.reduce((n, x) => n + x.orders.length, 0);
const ohneNamen = out.flatMap((x) => x.orders).filter((o) => !o.name).length;

console.log(`Vertraege unter TheCollector: ${vertraege.length}`);
console.log(`  ausgeliefert (ohne WIP/notForRelease): ${out.length}`);
console.log(`  mit Gegenleistung: ${mitOrders} | ohne: ${ohneOrders} | ohne Template: ${ohneTemplate}`);
console.log(`  Warenposten gesamt: ${ordersGesamt}, davon ohne Anzeigename: ${ohneNamen}`);
console.log(`  mit Titel: ${out.filter((x) => x.titel).length}`);

if (!REPORT) {
  const ziel = resolve(ROOT, 'assets', 'wikelo-gamefiles.json');
  const bm = resolve(dirname(DEFAULT_P4K), 'build_manifest.id');
  let gameVersion = null;
  if (existsSync(bm)) {
    try { const d = JSON.parse(readFileSync(bm, 'utf8')).Data; gameVersion = `${(d.Branch || '').replace(/^sc-alpha-/, '')}-live.${d.RequestedP4ChangeNum}`; } catch { /* bleibt null */ }
  }
  writeFileSync(ziel, JSON.stringify({
    generator: 'scripts/datamine-wikelo.mjs',
    generatedAt: new Date().toISOString(),
    gameVersion,
    counts: { contracts: out.length, withOrders: mitOrders, orderLines: ordersGesamt },
    contracts: out.sort((a, b) => String(a.titel ?? a.debugName).localeCompare(String(b.titel ?? b.debugName), 'en')),
  }, null, 1) + '\n');
  console.log(`geschrieben: ${ziel}`);
}
