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
    try { patchLabel = JSON.parse(readFileSync(bm, 'utf8'))?.Data?.RequestedP4kVersion ?? null; } catch { /* egal */ }
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

// Missionstypen
const missionTypes = new Map();
for (const r of byStruct('MissionType')) {
  const d = db.readRecord(r, { maxDepth: 1 });
  const key = shortName(r);
  missionTypes.set(r.id, { id: kebab(key), key, name: loc(d?.displayName) ?? key.replace(/_/g, ' ') });
}

// Missionsgeber
const givers = new Map();
for (const r of byStruct('MissionGiver')) {
  const d = db.readRecord(r, { maxDepth: 2 });
  const key = shortName(r);
  givers.set(r.id, {
    id: kebab(key), key,
    name: loc(d?.displayName) ?? loc(d?.name) ?? key.replace(/^MissionGiver_/, '').replace(/_/g, ' '),
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
  const org = { id: kebab(key), key, name: key.replace(/([a-z])([A-Z])/g, '$1 $2'), strings };
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
const clean = (s) => String(s).replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();

function analyseTitle(rawKey) {
  const text = loc(rawKey);
  if (!text) return { text: null, dynamic: false, pure: false, tokens: [], variants: [], fragment: null };
  const tokens = [...text.matchAll(TMPL_RE)].map((m) => m[1]);
  if (!tokens.length) return { text: clean(text), dynamic: false, pure: false, tokens: [], variants: [], fragment: null };
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
  const display = clean(braces(text));
  // "pure" = der Titel besteht NUR aus einem Platzhalter ("~mission(Title)") und
  // taugt damit nicht als Name.
  const pure = /^\{[^}]*\}$/.test(display);
  return { text: display, dynamic: true, pure, tokens, variants: variants.slice(0, 24), fragment: pure ? fragment : null };
}

// Interner Recordname -> lesbares Label (nur als Notnagel, klar gekennzeichnet)
const humanize = (key) => String(key)
  .replace(/^PU_/, '').replace(/_/g, ' ')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/\s+/g, ' ').trim();

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
  const desc = analyseTitle(d.description);
  const giverText = loc(d.missionGiver);
  const key = shortName(r);
  // Titelkaskade: echter Titel > Auftragssorte aus dem Contractor-Fragment
  // ("Base Sweep") > interner Recordname (dann als noTitle markiert, damit die
  // UI das nicht als offiziellen Namen ausgibt).
  const hasTitle = !!title.text && !title.pure;
  const label = hasTitle ? title.text : (title.fragment || humanize(key));

  entries.push({
    key,
    file: r.fileName,
    titleKey: typeof d.title === 'string' ? d.title : null,
    title: label,
    noTitle: !hasTitle && !title.fragment,
    titleDynamic: title.dynamic && !title.pure,
    titleTokens: title.tokens,
    titleVariants: title.variants,
    desc: desc.text,
    descDynamic: desc.dynamic,
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
    objectives: 'Der Spielertext der Missionsziele ist nicht Teil der Client-Dateien: MissionObjective/ObjectiveDisplayInfo haben im DataCore null Instanzen, gefuellt werden sie von den Subsumption-Modulen, die serverseitig laufen (unter Libs/Subsumption/Missions liegen nur AC/EA/Environmental). Ausgegeben wird darum der Ablauf aus objectiveTokens (Entwicklernamen) und missionFlow (Designer-Beschreibungen).',
    patch: patchLabel,
    generated: process.env.SNAP_DATE ?? new Date().toISOString().slice(0, 10),
    counts: {
      brokerEntries: brokers.length,
      notForRelease: skippedDev,
      live: entries.length,
      families: families.length,
      withReward: entries.filter((e) => e.reward.uec > 0).length,
      withRep: entries.filter((e) => e.rep.length).length,
      withFlow: entries.filter((e) => e.flow.steps.length || e.flow.rules.length).length,
      dynamicTitles: entries.filter((e) => e.titleDynamic).length,
      noTitle: entries.filter((e) => e.noTitle).length,
    },
  },
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
