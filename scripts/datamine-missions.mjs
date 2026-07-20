// datamine-missions.mjs — Missions-Datenbank direkt aus den Spieldateien.
//
// Quelle: Data.p4k -> Data/Game2.dcb (DataCore v8) + Data/Localization/*/global.ini.
// KEINE Community-API hat Missionsdaten (UEX nein, sc-craft.tools nur Blueprints,
// SC-Wiki 403 auf Bots) — der DataCore ist die einzige Quelle.
//
// Aufruf:  npm run datamine:missions        (Patch-Day-Schritt, braucht lokales SC)
//          SC_P4K=<pfad> node scripts/datamine-missions.mjs
//          node scripts/datamine-missions.mjs --dcb <datei> --ini <dir>   (offline)
// Ausgabe: src/data/missions.json (getrackter Snapshot; die Site liest nie das p4k).
//          Liegt in src/data und nicht in assets, weil die Seite alles serverseitig
//          rendert — der Client zieht das JSON nie, also gehoert es nicht ins
//          oeffentliche Verzeichnis (vgl. vehicles.json).
//
// Modell: Ein MissionBrokerEntry ist EIN Angebot am Missionsboard. Viele davon
// sind Varianten derselben Mission (gleicher Titel-Loc-Key, anderer Auftraggeber
// / Ort / Rang / Lohn) — die werden zu einer "Familie" gebuendelt und die
// Unterschiede als Varianten-Tabelle gefuehrt. Handgebaute Missionen landen als
// Familie der Groesse 1.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDataCore } from './lib/datacore.mjs';
import { openP4k, DEFAULT_P4K } from './lib/p4k.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'src', 'data', 'missions.json');

const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

/* ---------------- Quellen laden ---------------- */
let dcbBuf, iniEn, iniDe, patchLabel = null;
const dcbArg = argOf('--dcb');
if (dcbArg) {
  const iniDir = argOf('--ini') ?? dirname(dcbArg);
  dcbBuf = readFileSync(dcbArg);
  iniEn = readFileSync(join(iniDir, 'global_en.ini'), 'utf8');
  iniDe = existsSync(join(iniDir, 'global_de.ini')) ? readFileSync(join(iniDir, 'global_de.ini'), 'utf8') : '';
  console.log(`offline: ${dcbArg}`);
} else {
  const p4k = openP4k(argOf('--p4k') ?? DEFAULT_P4K);
  console.log(`p4k: ${p4k.path} (${(p4k.size / 2 ** 30).toFixed(1)} GiB, ${p4k.entryCount} Eintraege)`);
  dcbBuf = p4k.read(/^Data[\\/]Game2\.dcb$/i);
  iniEn = p4k.read(/Localization[\\/]english[\\/]global\.ini$/i).toString('utf8');
  try { iniDe = p4k.read(/Localization[\\/]german_\(germany\)[\\/]global\.ini$/i).toString('utf8'); } catch { iniDe = ''; }
  // Patch-Kennung aus der Build-Manifest-Datei neben dem p4k (best effort)
  const bm = resolve(dirname(p4k.path), 'build_manifest.id');
  if (existsSync(bm)) {
    try { const d = JSON.parse(readFileSync(bm, 'utf8'))?.Data; patchLabel = d?.Branch ?? d?.Version ?? null; } catch { /* egal */ }
  }
  p4k.close();
}

function parseIni(txt) {
  const m = new Map();
  for (const line of txt.split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0) m.set(line.slice(0, i).replace(/^﻿/, '').toLowerCase(), line.slice(i + 1));
  }
  return m;
}
const EN = parseIni(iniEn);
const DE = parseIni(iniDe);
console.log(`localization: EN ${EN.size} keys, DE ${DE.size} keys`);

const t0 = Date.now();
const db = openDataCore(dcbBuf);
console.log(`DataCore v${db.version}: ${db.records.length} Records, ${db.structs.length} Structs (${Date.now() - t0} ms)`);

/* ---------------- Helfer ---------------- */
const EMPTY_LOC = new Set(['@LOC_UNINITIALIZED', '@LOC_EMPTY', '@LOC_PLACEHOLDER', '@blank_space', '']);
const isEmptyLoc = (s) => !s || EMPTY_LOC.has(s);
// Loc-Key aufloesen. Nicht-@-Strings sind bereits Klartext.
function loc(key, tbl = EN) {
  if (typeof key !== 'string' || isEmptyLoc(key)) return null;
  if (!key.startsWith('@')) return key;
  const v = tbl.get(key.slice(1).toLowerCase());
  return v == null || v === '' ? null : v;
}
const sname = (r) => db.structs[r.structIndex]?.name;
const byStruct = (n) => db.records.filter((r) => sname(r) === n);
const shortName = (r) => String(r.name ?? '').replace(/^[^.]*\./, '');
const kebab = (s) => String(s).trim().toLowerCase()
  .replace(/[''`]/g, '').replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72) || 'mission';
// Interner Recordname -> lesbares Label (Notnagel, wo das Spiel keinen Text hat)
const humanize = (key) => String(key)
  .replace(/^PU_/, '').replace(/_/g, ' ')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/\s+/g, ' ').trim();

/* ---------------- Nachschlagetabellen ---------------- */
// Tags: 18.600 Records, Name ist die GUID -> echter Name steckt in tagName.
const tagName = new Map(); // record.id -> tagName
for (const r of byStruct('Tag')) {
  const d = db.readRecord(r, { maxDepth: 1 });
  if (d?.tagName) tagName.set(r.id, d.tagName);
}
console.log(`tags: ${tagName.size}`);
const refTag = (ref) => (ref?.__ref ? tagName.get(ref.__ref) ?? null : null);
const tagList = (holder) => (holder?.tags ?? []).map(refTag).filter(Boolean);

// Fraktionen
const factions = new Map(); // record.id -> {...}
for (const r of byStruct('FactionReputation')) {
  const d = db.readRecord(r, { maxDepth: 1 });
  if (!d) continue;
  const id = shortName(r).replace(/^FactionReputation_/, '');
  factions.set(r.id, {
    id: kebab(id),
    key: shortName(r),
    name: loc(d.displayName) ?? id.replace(/_/g, ' '),
    isNPC: !!d.isNPC,
    logo: typeof d.logo === 'string' && d.logo ? d.logo : null,
  });
}
console.log(`factions: ${factions.size}`);

// Eigennamen retten: humanize() zerlegt Binnenmajuskeln, aus "BlacJac" wird
// "Blac Jac" und aus "MicroTech" "Micro Tech". Die richtige Schreibweise kennt
// das Spiel selbst — aus den Fraktionsnamen und den *_repui_name-Keys (dort
// steht z. B. "BlacJac", zu dem es gar keine FactionReputation gibt). Nur Namen
// MIT Binnenmajuskel sind interessant; laengste zuerst, damit "InterSec Defense
// Solutions" vor "InterSec" greift.
const properNames = [
  ...[...factions.values()].map((f) => f.name),
  ...[...EN].filter(([k]) => /_repui_name$/.test(k)).map(([, v]) => v),
].filter((n) => n && /[a-z0-9][A-Z]/.test(n))
  .sort((a, b) => b.length - a.length);
const RX_ESC = /[.*+?^${}()|[\]\\]/g;
function fixProper(s) {
  let out = String(s);
  for (const p of properNames) {
    const spaced = p.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    if (spaced === p) continue;
    // case-insensitiv: humanize liefert "Micro Tech", der echte Name ist "microTech"
    out = out.replace(new RegExp(spaced.replace(RX_ESC, '\\$&'), 'gi'), p);
  }
  return out;
}
const nameFrom = (key, prefix) => fixProper(humanize(String(key).replace(prefix, '')));

// Reputations-Raenge: minReputation + Anzeigename + Perk
const standings = new Map(); // record.id -> {...}
for (const r of byStruct('SReputationStandingParams')) {
  const d = db.readRecord(r, { maxDepth: 1 });
  if (!d) continue;
  standings.set(r.id, {
    key: shortName(r),
    name: loc(d.displayName),
    perk: loc(d.perkDescription),
    min: typeof d.minReputation === 'number' ? d.minReputation : null,
    gated: !!d.gated,
  });
}
console.log(`standings: ${standings.size}`);

// Reputations-Scopes (Affinity/Rank/...)
const scopes = new Map();
for (const r of byStruct('SReputationScopeParams')) scopes.set(r.id, shortName(r).replace(/^ReputationScope_/, ''));

// Missionstypen — der Anzeigename haengt an LocalisedTypeName (NICHT displayName;
// das Feld existiert auf MissionType gar nicht). Genau das, was das mobiGlas zeigt.
const missionTypes = new Map();
for (const r of byStruct('MissionType')) {
  const d = db.readRecord(r, { maxDepth: 1 });
  const key = shortName(r);
  missionTypes.set(r.id, {
    id: kebab(key), key,
    name: loc(d?.LocalisedTypeName) ?? nameFrom(key, /^$/),
    icon: typeof d?.svgIconPath === 'string' && d.svgIconPath ? d.svgIconPath : null,
  });
}

// Missionsgeber — die meisten displayName sind @LOC_UNINITIALIZED. Dann greift
// die verknuepfte Fraktion (die hat einen echten Namen), zuletzt der Recordname.
const givers = new Map();
for (const r of byStruct('MissionGiver')) {
  const d = db.readRecord(r, { maxDepth: 2 });
  const key = shortName(r);
  const fac = d?.reputation?.__ref ? factions.get(d.reputation.__ref) : null;
  givers.set(r.id, {
    id: kebab(key), key,
    name: loc(d?.displayName) ?? nameFrom(key, /^MissionGiver_/) ?? fac?.name ?? key,
    faction: fac?.id ?? null,
    desc: loc(d?.description),
  });
}

// StarMap-Objekte: echte Ortsnamen
const starmap = new Map();
for (const r of byStruct('StarMapObject')) {
  const d = db.readRecord(r, { maxDepth: 1 });
  starmap.set(r.id, loc(d?.displayName) ?? loc(d?.name) ?? shortName(r));
}

// Localities: Bereich -> konkrete Orte
const localities = new Map();
for (const r of byStruct('MissionLocality')) {
  const d = db.readRecord(r, { maxDepth: 1 });
  const key = shortName(r);
  const places = (d?.availableLocations ?? []).map((x) => (x?.__ref ? starmap.get(x.__ref) : null)).filter(Boolean);
  localities.set(r.id, { id: kebab(key), key, name: key, places: [...new Set(places)] });
}
console.log(`types ${missionTypes.size} | givers ${givers.size} | localities ${localities.size} | starmap ${starmap.size}`);

// Organisationen: liefern die Contractor-Titelfragmente fuer ~mission(Contractor|X)
const orgs = new Map();          // record.id -> {id,key,name,strings:Map(tagName->locKey)}
const contractorTitles = new Map(); // tagName -> [{org, text}]
for (const r of byStruct('MissionOrganization')) {
  const d = db.readRecord(r, { maxDepth: 3 });
  if (!d) continue;
  const key = shortName(r);
  const strings = new Map();
  for (const v of d.stringVariants?.variants ?? []) {
    const tn = refTag(v?.tag);
    if (tn && typeof v.string === 'string') strings.set(tn, v.string);
  }
  const org = { id: kebab(key), key, name: nameFrom(key, /^$/), strings };
  orgs.set(r.id, org);
  for (const [tn, lk] of strings) {
    const txt = loc(lk);
    if (!txt) continue;
    if (!contractorTitles.has(tn)) contractorTitles.set(tn, []);
    contractorTitles.get(tn).push({ org: org.name, text: txt });
  }
}
console.log(`orgs: ${orgs.size} | contractor-Fragmente: ${contractorTitles.size} Tag-Sorten`);

/* ---------------- Titel-Templates ---------------- */
// Titel wie "~mission(Contractor|BountyTitle)" werden erst zur Laufzeit gefuellt.
// Wir loesen auf, was aufloesbar ist (Contractor-Fragmente), und markieren den
// Rest als dynamisch, statt einen erfundenen Titel als Fakt hinzuschreiben.
const TMPL_RE = /~mission\(([^)]*)\)/g;
// Platzhalter lesbar machen: ~mission(ReputationRank) -> {ReputationRank}
const braces = (s) => String(s).replace(TMPL_RE, (_, t) => `{${t.split('|').pop()}}`);
// Das Spiel formatiert Missionstexte mit eigenen Tags: <EM4> hebt Werte hervor
// (6.736 Vorkommen), <EM>/<I> selten. Inhalt behalten, Tag weg — die
// {Platzhalter} darin werden ohnehin als Chip gerendert. Andere spitze Klammern
// bleiben stehen, damit echter Text nicht stillschweigend verschwindet.
const stripTags = (s) => String(s).replace(/<\/?(?:EM\d*|I)>/gi, '');
// Zeilenumbrueche stehen in der global.ini als literales \n (Backslash + n).
// Titel: alles auf eine Zeile.
const clean = (s) => stripTags(s).replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
// Beschreibungen sind mehrabsaetzige Briefings — Absaetze erhalten, sonst wird
// aus dem Auftragstext eine Textwurst.
const cleanText = (s) => stripTags(s)
  .replace(/\\n/g, '\n')
  .replace(/[ \t]+/g, ' ')
  .replace(/[ \t]*\n[ \t]*/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

// multi=true -> Absaetze erhalten (Beschreibungen); sonst einzeilig (Titel).
function analyseTitle(rawKey, multi = false) {
  const norm = multi ? cleanText : clean;
  const text = loc(rawKey);
  if (!text) return { text: null, dynamic: false, pure: false, tokens: [], variants: [], fragment: null };
  const tokens = [...text.matchAll(TMPL_RE)].map((m) => m[1]);
  if (!tokens.length) return { text: norm(text), dynamic: false, pure: false, tokens: [], variants: [], fragment: null };
  // Contractor-Fragmente aufloesen -> die Titel, die im Spiel wirklich erscheinen
  const variants = [];
  let fragment = null;
  for (const tok of tokens) {
    const m = /^Contractor\|(.+)$/i.exec(tok);
    if (!m) continue;
    // "BaseSweepTitle" -> "Base Sweep": die Sorte des Auftrags, wie das Spiel
    // sie selbst benennt. Besser als der interne Recordname.
    fragment ??= humanize(m[1].replace(/Title$/i, ''));
    for (const v of contractorTitles.get(m[1]) ?? []) {
      variants.push({ org: v.org, text: clean(braces(text.replace(`~mission(${tok})`, v.text))) });
    }
  }
  const display = norm(braces(text));
  // "pure" = der Text besteht NUR aus einem Platzhalter ("~mission(Title)") und
  // taugt damit nicht als Name/Beschreibung.
  const pure = /^\{[^}]*\}$/.test(display);
  return { text: display, dynamic: true, pure, tokens, variants: variants.slice(0, 24), fragment: pure ? fragment : null };
}

/* ---------------- Reputationsanforderungen ---------------- */
function repExpr(node) {
  if (!node) return [];
  const out = [];
  for (const e of node.expression ?? []) {
    const f = e?.factionReputation?.__ref ? factions.get(e.factionReputation.__ref) : null;
    const s = e?.standing?.__ref ? standings.get(e.standing.__ref) : null;
    if (!f && !s) continue;
    out.push({
      faction: f?.id ?? null,
      factionName: f?.name ?? null,
      scope: e?.reputationScope?.__ref ? scopes.get(e.reputationScope.__ref) ?? null : null,
      comparison: e?.comparison ?? null,
      standing: s?.name ?? (s?.key ?? null),
      standingMin: s?.min ?? null,
      perk: s?.perk ?? null,
    });
  }
  return out;
}

/* ---------------- Missionsablauf ---------------- */
// WICHTIG (Ehrlichkeit): Der Spielertext der Ziele ("Fliege nach X", "Toete Y")
// steckt NICHT in den Client-Dateien. Er haengt an MissionObjective/
// ObjectiveDisplayInfo (Felder shortDescription/longDescription/
// objectiveMarkerLabel, alle Locale-Typ) — beide Structs haben im DataCore
// *null* Instanzen. Gefuellt werden sie von den Subsumption-Missionsmodulen
// (`missionModule`, z. B. PU/Missions/InfiltrateAndDefend/PU_EliminateSpecific.xml),
// und die liegen NICHT im p4k: unter Libs/Subsumption/Missions gibt es nur
// EnvironmentalMissionScenarios/GlobalFunctions/AC/EA — die PU-Missionslogik
// laeuft serverseitig. Verifiziert: p4k-Suche nach EliminateSpecific/
// MultiStopDelivery = 0 Treffer.
//
// Was es GIBT und was wir deshalb ausgeben — als "Ablauf", nicht als "Ziele":
//   - objectiveTokens[].debugName  -> die Schritte, aber mit Entwicklernamen
//   - missionFlow.triggers[].description -> von Designern geschriebene, gut
//     lesbare Ablaufregeln ("When [Hauling] abandoned ... -> Start [ReturnGoods]")
function flowOf(d) {
  const steps = [];
  for (const tok of d.objectiveTokens ?? []) {
    if (!tok?.debugName) continue;
    steps.push({ name: tok.debugName, startsActive: !!tok.startsActive });
  }
  const rules = [];
  for (const tr of d.missionFlow?.triggers ?? []) {
    const desc = typeof tr?.description === 'string' ? tr.description.trim() : '';
    // HTML-Entities aus dem DataCore ("-&gt;") zurueckdrehen
    if (desc) rules.push(desc.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&'));
  }
  return { steps, rules: [...new Set(rules)] };
}

/* ---------------- Contract-System ---------------- */
// Neben dem Missionsbrett (MissionBrokerEntry) laeuft der Contract-Manager:
// ContractGenerator (nach Gilden sortiert) -> Handler -> Contract/CareerContract/
// ContractLegacy -> ContractTemplate + contractResults. CIG migriert dorthin —
// `ContractLegacy.missionBrokerEntry` ist die Bruecke zurueck aufs alte System,
// und das Wort "Legacy" ist CIGs eigenes. Neue Features haengen NUR hier:
// Blueprint-Pools, Karrierestufen, Gilden. Ohne diesen Zweig fehlt der
// Datenbank genau das, was den heutigen Contract-Manager fuellt.

// Blueprint-Pools: 116 Pools -> je eine gewichtete Blueprint-Liste
const bpPools = new Map();
for (const r of byStruct('BlueprintPoolRecord')) {
  const d = db.readRecord(r, { maxDepth: 3 });
  // Blueprint-Recordnamen sind Item-Keys (BP_CRAFT_SHLD_SECO_S00_PIN_SCItem).
  // Praefix/Suffix weg — der Rest bleibt roh, weil es der Name ist, den das
  // Spiel fuehrt; huebschere Namen haette nur die crafting-db (anderer Patch).
  const bps = (d?.blueprintRewards ?? []).map((b) => ({
    name: b?.blueprintRecord?.name
      ? shortName(b.blueprintRecord).replace(/^BP_CRAFT_/i, '').replace(/_SCItem$/i, '')
      : null,
    weight: b?.weight ?? 1,
  })).filter((b) => b.name);
  bpPools.set(r.id, { id: kebab(shortName(r)), key: shortName(r), blueprints: bps });
}
console.log(`blueprint-pools: ${bpPools.size} (${[...bpPools.values()].reduce((s, p) => s + p.blueprints.length, 0)} Eintraege)`);

// ContractTemplates: liefern Titel/Beschreibung/Typ, wenn der Contract nichts ueberschreibt
const templates = new Map();
for (const r of byStruct('ContractTemplate')) {
  const d = db.readRecord(r, { maxDepth: 4 });
  const ds = d?.contractDisplayInfo?.displayString ?? [];
  templates.set(r.id, {
    key: shortName(r),
    title: ds[0] ?? null,
    desc: ds[2] ?? null,
    type: d?.contractDisplayInfo?.type?.__ref ?? null,
    illegal: !!d?.contractDisplayInfo?.illegal,
    notForRelease: !!d?.notForRelease,
    flow: flowOf(d ?? {}),
  });
}
console.log(`contract-templates: ${templates.size}`);

// Gilde + Auftraggeber stehen im Pfad des Generators:
//   contracts/contractgenerator/<gilde>_guild/<org>/[...]/<name>.xml
//
// Die Gildennamen sind NICHT lokalisiert — in der global.ini gibt es keine
// Entsprechung, es sind CIGs Ordnernamen. Sie werden hier nur lesbar gemacht
// (die Zuordnung ist eindeutig, aber es ist keine offizielle Bezeichnung; das
// steht so im Quellenhinweis). Ordner ohne `_guild` (tutorial,
// yearspecificcontent) sind Ablagen, keine Gilden -> null.
const GUILDS = {
  academyofsciences: 'Academy of Sciences',
  interstellartransport: 'Interstellar Transport',
  mercenary: 'Mercenary',
  thebackpocket: 'The Back Pocket',
  thecouncil: 'The Council',
  unitedresourceworkers: 'United Resource Workers',
};
// Org-Ordner gegen die echten Fraktions-/Org-Namen aufloesen, statt zu raten:
// "headhunters" -> "Headhunters", "eckhartsecurity" -> "Eckhart Security".
const orgLookup = new Map();
const orgKey = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
for (const f of factions.values()) orgLookup.set(orgKey(f.name), f.name);
for (const o of orgs.values()) if (!orgLookup.has(orgKey(o.name))) orgLookup.set(orgKey(o.name), o.name);
// Zwei Ordner weichen zu stark ab, als dass ein Praefix greift ("bountyhunterguild"
// gegen "Bounty Hunters Guild" — das fehlende s; "ftl" ist zu kurz zum Matchen).
const ORG_ALIAS = { ftl: 'FTL Courier', bountyhunterguild: 'Bounty Hunters Guild' };
function prettyOrg(s) {
  const k = orgKey(s);
  const exact = ORG_ALIAS[k] ?? orgLookup.get(k);
  if (exact) return exact;
  // Ordnername und Fraktionsname weichen oft leicht ab: "ftl" -> "FTL Courier",
  // "redwind" -> "Red Wind Linehaul", "rayariinc" -> "Rayari Incorporated".
  // Laengster Praefix-Treffer in beide Richtungen; ab 4 Zeichen, damit kurze
  // Namen nicht wild matchen.
  let best = null;
  for (const [lk, name] of orgLookup) {
    if (lk.length < 4 || k.length < 4) continue;
    if (!lk.startsWith(k) && !k.startsWith(lk)) continue;
    const score = Math.min(lk.length, k.length);
    if (!best || score > best.score) best = { name, score };
  }
  if (best) return best.name;
  return nameFrom(s, /^$/).replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function guildOf(fileName) {
  const m = /contractgenerator\/([^/]+)(?:\/([^/]+))?/i.exec(fileName ?? '');
  if (!m || /\.xml$/i.test(m[1])) return { guild: null, org: null };
  const gm = /^(.+)_guild$/i.exec(m[1]);
  const o = m[2] && !/\.xml$/i.test(m[2]) ? m[2] : null;
  return {
    guild: gm ? (GUILDS[gm[1].toLowerCase()] ?? nameFrom(gm[1], /^$/)) : null,
    org: o ? prettyOrg(o) : null,
  };
}

// Prerequisites eines Contracts -> Reputationsbedingungen (wie repExpr, andere Form)
function contractRep(list) {
  const out = [];
  for (const p of list ?? []) {
    if (p?.__type !== 'ContractPrerequisite_Reputation') continue;
    const f = p.factionReputation?.__ref ? factions.get(p.factionReputation.__ref) : null;
    const mn = p.minStanding?.__ref ? standings.get(p.minStanding.__ref) : null;
    const mx = p.maxStanding?.__ref ? standings.get(p.maxStanding.__ref) : null;
    if (!f && !mn && !mx) continue;
    out.push({
      faction: f?.id ?? null, factionName: f?.name ?? null,
      scope: p.scope?.__ref ? scopes.get(p.scope.__ref) ?? null : null,
      comparison: p.exclude ? 'NotEqualTo' : 'GreaterThanOrEqualTo',
      standing: mn?.name ?? mx?.name ?? null,
      standingMin: mn?.min ?? null,
      perk: mn?.perk ?? null,
    });
  }
  return out;
}

// contractResults -> Belohnungen. Der Baum ist polymorph (ContractResultBase),
// __type sagt, was drinsteckt.
function contractResults(node) {
  const out = { uec: 0, calculated: false, blueprints: [], bpChance: null, rep: [] };
  for (const r of node?.contractResults ?? []) {
    if (!r) continue;
    // ContractResult_CalculatedReward fuehrt KEINE Zahl — der Lohn entsteht zur
    // Laufzeit aus der Schwierigkeit. "0" waere hier gelogen ("keine Belohnung"),
    // also merken und die UI "wird berechnet" sagen lassen.
    if (r.__type === 'ContractResult_CalculatedReward') out.calculated = true;
    if (r.__type === 'BlueprintRewards' && r.blueprintPool?.__ref) {
      const pool = bpPools.get(r.blueprintPool.__ref);
      if (pool) {
        out.blueprints.push({ pool: pool.id, poolKey: pool.key, chance: r.chance ?? null, blueprints: pool.blueprints });
        if (r.chance != null) out.bpChance = Math.max(out.bpChance ?? 0, r.chance);
      }
    } else if (r.__type === 'ContractResult_Reward' && typeof r.reward === 'number') {
      out.uec = Math.max(out.uec, r.reward);
    } else if (r.contractResultReputationAmounts) {
      const f = r.contractResultReputationAmounts.factionReputation?.__ref
        ? factions.get(r.contractResultReputationAmounts.factionReputation.__ref) : null;
      if (f) out.rep.push(f.id);
    }
  }
  return out;
}

const contracts = [];
const brokerLinked = new Map(); // MissionBrokerEntry-Recordname -> Contract-Zusatzinfos
let genCount = 0;
for (const gen of byStruct('ContractGenerator')) {
  const d = db.readRecord(gen, { maxDepth: 9, typed: true });
  if (!d) continue;
  genCount++;
  const { guild, org } = guildOf(gen.fileName);
  for (const h of d.generators ?? []) {
    if (!h || h.notForRelease) continue;
    const hFaction = h.factionReputation?.__ref ? factions.get(h.factionReputation.__ref) : null;
    const hPre = h.defaultAvailability?.prerequisites ?? [];
    // alle Contract-Sorten eines Handlers einsammeln
    const lists = [
      ...(h.contracts ?? []), ...(h.introContracts ?? []), ...(h.legacyContracts ?? []),
      ...(h.serviceBeaconContracts ?? []), ...(h.PVPBountyContract ?? []),
    ];
    for (const c of lists) {
      if (!c || c.notForRelease) continue;
      const tpl = c.template?.__ref ? templates.get(c.template.__ref) : null;
      // Der Spielertext steht in den stringParamOverrides (param = Title/Description/
      // Contractor); nur wenn dort nichts steht, greift der Template-Text.
      const ov = {};
      for (const s of c.paramOverrides?.stringParamOverrides ?? []) if (s?.param) ov[s.param] = s.value;
      const rawTitle = ov.Title ?? tpl?.title ?? null;
      const rawDesc = ov.Description ?? tpl?.desc ?? null;
      const title = analyseTitle(rawTitle);
      const desc = analyseTitle(rawDesc, true);
      const typeRef = c.paramOverrides?.missionTypeOverride?.__ref ?? tpl?.type;
      const type = typeRef ? missionTypes.get(typeRef) : null;
      const res = contractResults(c.contractResults);
      const rep = [...contractRep(c.additionalPrerequisites), ...contractRep(hPre)];
      const mn = c.minStanding?.__ref ? standings.get(c.minStanding.__ref) : null;
      const mx = c.maxStanding?.__ref ? standings.get(c.maxStanding.__ref) : null;
      const brokerKey = c.missionBrokerEntry?.name ? shortName(c.missionBrokerEntry) : null;

      const entry = {
        key: c.debugName || tpl?.key || 'contract',
        kind: c.__type ?? 'Contract',
        guild, org,
        contractor: loc(ov.Contractor),
        title: title.text, titleDynamic: title.dynamic, pure: title.pure,
        titleTokens: title.tokens,
        desc: desc.pure ? null : desc.text,
        type: type?.id ?? null, typeName: type?.name ?? null,
        illegal: !!tpl?.illegal,
        faction: hFaction?.id ?? null, factionName: hFaction?.name ?? null,
        rankMin: mn?.name ?? null, rankMax: mx?.name ?? null,
        uec: res.uec,
        calcReward: res.calculated,
        blueprints: res.blueprints,
        bpChance: res.bpChance,
        rep,
        template: tpl?.key ?? null,
        generator: shortName(gen),
        brokerKey,
      };
      // Legacy-Contract: gehoert zu einem Brett-Eintrag, den die Seite schon hat.
      // Nicht doppelt listen — nur die Zusatzinfos an die Familie haengen.
      if (brokerKey) {
        brokerLinked.set(brokerKey, entry);
      } else {
        contracts.push(entry);
      }
    }
  }
}
console.log(`contracts: ${genCount} Generatoren -> ${contracts.length} eigenstaendig + ${brokerLinked.size} an Brett-Eintraege gebunden`);
console.log(`  mit Blueprints: ${contracts.filter((c) => c.blueprints.length).length}`);

/* ---------------- Missionen einlesen ---------------- */
const brokers = byStruct('MissionBrokerEntry');
const entries = [];
let skippedDev = 0;
for (const r of brokers) {
  const d = db.readRecord(r, { maxDepth: 5 });
  if (!d) continue;
  if (d.notForRelease) { skippedDev++; continue; }

  const type = d.type?.__ref ? missionTypes.get(d.type.__ref) : null;
  const giverRec = d.missionGiverRecord?.__ref ? givers.get(d.missionGiverRecord.__ref) : null;
  const locality = d.localityAvailable?.__ref ? localities.get(d.localityAvailable.__ref) : null;
  const reward = d.missionReward ?? {};
  const title = analyseTitle(d.title);
  const desc = analyseTitle(d.description, true);
  const giverText = loc(d.missionGiver);
  const key = shortName(r);
  // Titelkaskade: echter Titel > Auftragssorte aus dem Contractor-Fragment
  // ("Base Sweep") > interner Recordname (dann als noTitle markiert, damit die
  // UI das nicht als offiziellen Namen ausgibt).
  const hasTitle = !!title.text && !title.pure;
  const label = hasTitle ? title.text : (title.fragment || humanize(key));
  // Haengt an diesem Brett-Eintrag ein Legacy-Contract? Der kennt Gilde und
  // Auftraggeber, die das Brett selbst nicht fuehrt.
  const ctr = brokerLinked.get(key);

  entries.push({
    key,
    source: 'broker',
    guild: ctr?.guild ?? null,
    org: ctr?.org ?? null,
    blueprints: ctr?.blueprints ?? [],
    bpChance: ctr?.bpChance ?? null,
    file: r.fileName,
    titleKey: typeof d.title === 'string' ? d.title : null,
    title: label,
    noTitle: !hasTitle && !title.fragment,
    titleDynamic: title.dynamic && !title.pure,
    titleTokens: title.tokens,
    titleVariants: title.variants,
    // Reine Platzhalter-Beschreibungen ("~mission(BountyDescription)") sagen dem
    // Leser nichts — die traegt erst das Spiel zur Laufzeit nach. Weglassen
    // statt "{BountyDescription}" hinschreiben.
    desc: desc.pure ? null : desc.text,
    descDynamic: desc.dynamic && !desc.pure,
    giverText: giverText && !giverText.includes('~mission(') ? giverText : null,
    giverTextDynamic: !!(giverText && giverText.includes('~mission(')),
    type: type?.id ?? null,
    typeName: type?.name ?? null,
    giver: giverRec?.id ?? null,
    giverName: giverRec?.name ?? null,
    locality: locality?.id ?? null,
    localityName: locality?.name ?? null,
    places: locality?.places ?? [],
    reward: {
      uec: reward.reward ?? 0,
      max: reward.max ?? 0,
      currency: reward.currencyType ?? 'UEC',
      plusBonuses: !!reward.plusBonuses,
    },
    buyIn: d.missionBuyInAmount ?? 0,
    difficulty: typeof d.missionDifficulty === 'number' && d.missionDifficulty >= 0 ? d.missionDifficulty : null,
    lawful: !!d.lawfulMission,
    tutorial: !!d.tutorial,
    shareable: !!d.canBeShared,
    onceOnly: !!d.onceOnly,
    maxPlayers: d.maxPlayersPerInstance ?? null,
    maxInstances: d.maxInstances ?? null,
    requestOnly: !!d.requestOnly,
    availableInPrison: !!d.availableInPrison,
    failIfCriminal: !!d.failIfBecameCriminal,
    failIfPrison: !!d.failIfSentToPrison,
    deadlineSec: d.missionDeadline?.missionCompletionTime || 0,
    lifetimeMin: d.instanceHasLifeTime ? (d.instanceLifeTime ?? 0) : 0,
    cooldownMin: d.hasPersonalCooldown ? (d.personalCooldownTime ?? 0) : 0,
    wantedMax: d.reputationPrerequisites?.wantedLevel?.maxValue ?? null,
    wantedMin: d.reputationPrerequisites?.wantedLevel?.minValue ?? null,
    rep: repExpr(d.reputationRequirements),
    repPre: repExpr(d.reputationPrerequisites?.expression ? d.reputationPrerequisites : null),
    tags: tagList(d.completionTags),
    missionTags: (d.missionTags ?? []).map(refTag).filter(Boolean),
    module: typeof d.missionModule === 'string' ? d.missionModule.replace(/^Libs\/Subsumption\/Missions\//i, '') : null,
    flow: flowOf(d),
  });
}
console.log(`broker entries: ${brokers.length} | notForRelease uebersprungen: ${skippedDev} | live: ${entries.length}`);

// Eigenstaendige Contracts in dieselbe Form bringen, damit sie durch dieselbe
// Familienbildung laufen wie die Brett-Eintraege. Felder, die es im Contract-
// System schlicht nicht gibt (Ort, Deadline, Cooldown), bleiben leer statt
// geraten zu werden.
for (const c of contracts) {
  const hasTitle = !!c.title && !c.pure;
  entries.push({
    key: c.key,
    source: 'contract',
    guild: c.guild,
    org: c.org,
    blueprints: c.blueprints,
    bpChance: c.bpChance,
    file: `contracts/${c.generator}`,
    titleKey: null,
    title: hasTitle ? c.title : humanize(c.key),
    noTitle: !hasTitle,
    titleDynamic: !!c.titleDynamic,
    titleTokens: c.titleTokens ?? [],
    titleVariants: [],
    desc: c.desc,
    descDynamic: false,
    giverText: c.contractor,
    giverTextDynamic: false,
    type: c.type, typeName: c.typeName,
    giver: null, giverName: c.org ?? c.factionName ?? null,
    locality: null, localityName: null, places: [],
    reward: { uec: c.uec ?? 0, max: 0, currency: 'UEC', plusBonuses: false },
    calcReward: !!c.calcReward,
    buyIn: 0,
    difficulty: null,
    lawful: !c.illegal,
    tutorial: false,
    shareable: false,
    onceOnly: false,
    maxPlayers: null,
    maxInstances: null,
    requestOnly: false,
    availableInPrison: false,
    failIfCriminal: false,
    failIfPrison: false,
    deadlineSec: 0, lifetimeMin: 0, cooldownMin: 0,
    wantedMax: null, wantedMin: null,
    rankMin: c.rankMin, rankMax: c.rankMax,
    rep: c.rep,
    repPre: [],
    tags: [],
    missionTags: [],
    module: c.template ? `Contract/${c.template}` : null,
    flow: { steps: [], rules: [] },
  });
}
console.log(`gesamt (Brett + Contracts): ${entries.length} Angebote`);

/* ---------------- Familien bilden ---------------- */
// Gruppenschluessel = angezeigter Titel + Missionsmodul.
//
// Nur der Titel-Loc-Key reicht nicht: "Confiscate Contraband" existiert 4x unter
// verschiedenen Keys (gleiche Mission, kuenstlich getrennt). Nur der Titeltext
// reicht auch nicht: "BlacJac Bounty Trial Contract" gibt es gleichnamig aus
// SpaceBounty UND EliminateSpecific — das sind zwei verschiedene Missionen.
// Titel+Modul trennt genau dort, wo es einen echten Unterschied gibt.
// Eintraege ohne Titel gruppieren ueber ihren Loc-Key (trennt z. B. die
// DataHeist-Schwierigkeitsgrade), sonst ueber den Recordnamen.
const famMap = new Map();
const normT = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
for (const e of entries) {
  const head = e.noTitle
    ? (e.titleKey && e.titleKey.startsWith('@') && !EMPTY_LOC.has(e.titleKey) ? `k:${e.titleKey.toLowerCase()}` : `n:${e.key.toLowerCase()}`)
    : `t:${normT(e.title)}`;
  const k = `${head}|m:${(e.module ?? '').toLowerCase()}`;
  if (!famMap.has(k)) famMap.set(k, []);
  famMap.get(k).push(e);
}

const uniq = (a) => [...new Set(a.filter((x) => x != null && x !== ''))];
const slugs = new Set();
// Slugs sind URLs — sie muessen ueber Patches hinweg stabil bleiben. Darum
// NICHT "-2/-3" nach Iterationsreihenfolge vergeben (dann tauschen zwei
// gleichnamige Missionen beim naechsten Patch die Adresse), sondern bei
// Kollision mit dem Missionsmodul unterscheiden. Die Familien werden vorher
// deterministisch sortiert, damit auch der erste Treffer feststeht.
function uniqueSlug(base, module) {
  const b = kebab(base);
  if (!slugs.has(b)) { slugs.add(b); return b; }
  const mod = kebab(String(module ?? '').split('/').pop()?.replace(/\.xml$/i, '').replace(/^pu[-_]?/i, '') ?? '');
  let s = mod ? `${b}-${mod}` : b;
  let i = 2;
  while (slugs.has(s)) s = `${b}-${mod || 'x'}-${i++}`;
  slugs.add(s);
  return s;
}

// Deterministische Reihenfolge vor der Slug-Vergabe (Titel, dann Modul, dann
// erster Recordname als letzter Anker).
const famKeys = [...famMap.keys()].sort((a, b) => {
  const A = famMap.get(a), B = famMap.get(b);
  const at = String(A[0].title ?? ''), bt = String(B[0].title ?? '');
  return at.localeCompare(bt) || String(A[0].module ?? '').localeCompare(String(B[0].module ?? ''))
    || A[0].key.localeCompare(B[0].key);
});

const families = [];
for (const list of famKeys.map((k) => famMap.get(k))) {
  const head = list.find((e) => !e.noTitle) ?? list[0];
  // Slug aus dem angezeigten Titel; Platzhalter fliegen raus, damit aus
  // "{ReputationRank} Rank - {CargoGradeToken} Cargo Haul" ein lesbarer
  // "rank-cargo-haul"-Slug wird statt Klammersalat.
  const slugBase = String(head.title ?? head.key).replace(/\{[^}]*\}/g, ' ');
  const rewards = list.map((e) => e.reward.uec).filter((n) => n > 0);
  const allRep = [];
  for (const e of list) for (const r of e.rep) allRep.push(r);
  // Ablauf: die reichhaltigste Variante gewinnt. Eine Union waere Fantasie —
  // verschiedene Varianten haben nicht zwingend denselben Ablauf.
  const flowSrc = list.slice().sort((a, b) =>
    (b.flow.steps.length + b.flow.rules.length) - (a.flow.steps.length + a.flow.rules.length))[0];

  families.push({
    slug: uniqueSlug(slugBase || head.key, head.module),
    title: head.title,
    noTitle: !!head.noTitle,
    titleDynamic: !!head.titleDynamic,
    titleTokens: head.titleTokens,
    titleVariants: head.titleVariants,
    desc: list.find((e) => e.desc)?.desc ?? null,
    descDynamic: !!list.find((e) => e.desc)?.descDynamic,
    sources: uniq(list.map((e) => e.source)),
    guilds: uniq(list.map((e) => e.guild)),
    orgs: uniq(list.map((e) => e.org)),
    ranks: uniq(list.flatMap((e) => [e.rankMin, e.rankMax])),
    // Blueprint-Pools der Familie, dedupliziert (mehrere Varianten teilen sich Pools)
    blueprints: (() => {
      const seen = new Map();
      for (const e of list) for (const b of e.blueprints ?? []) if (!seen.has(b.poolKey)) seen.set(b.poolKey, b);
      return [...seen.values()];
    })(),
    bpChance: Math.max(0, ...list.map((e) => e.bpChance ?? 0)) || null,
    calcReward: list.some((e) => e.calcReward),
    types: uniq(list.map((e) => e.type)),
    typeNames: uniq(list.map((e) => e.typeName)),
    givers: uniq(list.map((e) => e.giver)),
    giverNames: uniq([...list.map((e) => e.giverName), ...list.map((e) => e.giverText)]),
    localities: uniq(list.map((e) => e.locality)),
    localityNames: uniq(list.map((e) => e.localityName)),
    places: uniq(list.flatMap((e) => e.places)).slice(0, 40),
    factions: uniq(allRep.map((r) => r.faction)),
    factionNames: uniq(allRep.map((r) => r.factionName)),
    rewardMin: rewards.length ? Math.min(...rewards) : 0,
    rewardMax: rewards.length ? Math.max(...rewards) : 0,
    lawful: list.some((e) => e.lawful),
    unlawful: list.some((e) => !e.lawful),
    tutorial: list.every((e) => e.tutorial),
    shareable: list.some((e) => e.shareable),
    maxPlayers: Math.max(...list.map((e) => e.maxPlayers ?? 1)),
    flow: flowSrc.flow,
    module: head.module,
    tags: uniq(list.flatMap((e) => e.missionTags)),
    count: list.length,
    variants: list.map((e) => ({
      key: e.key,
      source: e.source,
      guild: e.guild,
      rankMin: e.rankMin ?? null,
      rankMax: e.rankMax ?? null,
      blueprints: (e.blueprints ?? []).length,
      title: e.title,
      type: e.typeName,
      giver: e.giverName ?? e.giverText,
      locality: e.localityName,
      places: e.places.slice(0, 12),
      reward: e.reward.uec,
      rewardMax: e.reward.max,
      currency: e.reward.currency,
      buyIn: e.buyIn,
      difficulty: e.difficulty,
      lawful: e.lawful,
      shareable: e.shareable,
      onceOnly: e.onceOnly,
      maxPlayers: e.maxPlayers,
      deadlineSec: e.deadlineSec,
      lifetimeMin: e.lifetimeMin,
      cooldownMin: e.cooldownMin,
      wantedMax: e.wantedMax,
      requestOnly: e.requestOnly,
      availableInPrison: e.availableInPrison,
      failIfCriminal: e.failIfCriminal,
      rep: e.rep,
      flow: e.flow,
      module: e.module,
      file: e.file,
    })),
  });
}
families.sort((a, b) => (b.count - a.count) || String(a.title ?? a.slug).localeCompare(String(b.title ?? b.slug)));

/* ---------------- Schreiben ---------------- */
// Filter-Listen nur mit dem, was auch vorkommt — sonst bietet die UI 40 Typen
// an, von denen 20 kein Ergebnis liefern.
const usedFactions = new Set(families.flatMap((f) => f.factions));
const usedTypes = new Set(families.flatMap((f) => f.types));
const usedGivers = new Set(families.flatMap((f) => f.givers));
const usedLocs = new Set(families.flatMap((f) => f.localities));
const out = {
  meta: {
    source: 'Star Citizen Data.p4k -> Data/Game2.dcb (DataCore v8) + Localization/english/global.ini — eigene Extraktion',
    lang: 'Missionstexte liegen in den Spieldateien nur auf Englisch vor; die deutsche global.ini enthaelt keine Missionstitel/-beschreibungen.',
    systems: 'Zwei Quellen: das Missionsbrett (MissionBrokerEntry) und der Contract-Manager (ContractGenerator -> Contract/CareerContract). CIG migriert vom ersten zum zweiten; ContractLegacy.missionBrokerEntry ist die Bruecke, ueber die beide Systeme dieselbe Mission bezeichnen — solche Eintraege stehen hier nur einmal.',
    guilds: 'Die Gildenzuordnung stammt aus der Ordnerstruktur der Spieldateien (contractgenerator/<gilde>_guild/...), nicht aus einem lokalisierten Namen — die global.ini fuehrt dafuer keine Bezeichnungen. Lesbar gemacht, aber keine offizielle Schreibweise.',
    blueprints: 'Blueprint-Belohnungen haengen ausschliesslich am Contract-System; kein einziger der 419 Legacy-Contracts hat einen Pool. Ein Pool ist eine gewichtete Liste, aus der gezogen wird — welcher Blueprint faellt, ist Zufall.',
    objectives: 'Der Spielertext der Missionsziele ist nicht Teil der Client-Dateien: MissionObjective/ObjectiveDisplayInfo haben im DataCore null Instanzen, gefuellt werden sie von den Subsumption-Modulen, die serverseitig laufen (unter Libs/Subsumption/Missions liegen nur AC/EA/Environmental). Ausgegeben wird darum der Ablauf aus objectiveTokens (Entwicklernamen) und missionFlow (Designer-Beschreibungen).',
    patch: patchLabel,
    generated: process.env.SNAP_DATE ?? new Date().toISOString().slice(0, 10),
    counts: {
      brokerEntries: brokers.length,
      notForRelease: skippedDev,
      live: entries.length,
      brokerLive: entries.filter((e) => e.source === 'broker').length,
      contracts: entries.filter((e) => e.source === 'contract').length,
      legacyBridged: brokerLinked.size,
      families: families.length,
      withReward: entries.filter((e) => e.reward.uec > 0).length,
      withRep: entries.filter((e) => e.rep.length).length,
      withFlow: entries.filter((e) => e.flow.steps.length || e.flow.rules.length).length,
      withBlueprints: families.filter((f) => f.blueprints.length).length,
      blueprintPools: bpPools.size,
      dynamicTitles: entries.filter((e) => e.titleDynamic).length,
      noTitle: entries.filter((e) => e.noTitle).length,
    },
  },
  guilds: uniq(families.flatMap((f) => f.guilds)).sort().map((g) => ({ id: kebab(g), key: g, name: g })),
  types: [...missionTypes.values()].filter((x) => usedTypes.has(x.id)).sort((a, b) => a.name.localeCompare(b.name)),
  givers: [...givers.values()].filter((x) => usedGivers.has(x.id)).sort((a, b) => a.name.localeCompare(b.name)),
  factions: [...factions.values()].filter((f) => usedFactions.has(f.id)).sort((a, b) => a.name.localeCompare(b.name)),
  localities: [...localities.values()].filter((x) => usedLocs.has(x.id)).sort((a, b) => a.name.localeCompare(b.name)),
  missions: families,
};
writeFileSync(OUT, JSON.stringify(out) + '\n');
const kb = (Buffer.byteLength(JSON.stringify(out)) / 1024).toFixed(0);
console.log(`\ngeschrieben: ${OUT} (${kb} KB)`);
console.log(`  Familien ${families.length} | Varianten ${entries.length} | Typen ${out.types.length} | Geber ${out.givers.length} | Fraktionen ${out.factions.length}`);
console.log(`  groesste Familien: ${families.slice(0, 6).map((f) => `${f.title ?? f.slug} (${f.count})`).join(', ')}`);
