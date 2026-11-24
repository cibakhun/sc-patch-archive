// Missions-Snapshot + Formathelfer.
//
// Datenquelle: src/data/missions.json, gebaut von scripts/datamine-missions.mjs
// aus Data.p4k -> Game2.dcb. Die Typen stehen hier explizit und werden NICHT aus
// dem JSON abgeleitet: die Datei ist ~2 MB, und `typeof import(...)` darauf macht
// den TS-Server im Editor zaeh.

import DB from '../data/missions.json';
import type { Locale } from '../i18n/ui';
import { lesbarerBezeichner } from './lesbar';
import { baueMissionsNamen, titelTeile, titelText, zusatzText, deCamel as deCamelTitel } from './missionTitel';
import type { MissionName } from './missionTitel';

export interface MissionRep {
  faction: string | null;
  factionName: string | null;
  scope: string | null;
  comparison: string | null;
  standing: string | null;
  standingMin: number | null;
  perk: string | null;
}
export interface MissionFlow {
  steps: { name: string; startsActive: boolean }[];
  rules: string[];
}
export interface BlueprintPool {
  pool: string;
  poolKey: string;
  chance: number | null;
  blueprints: { name: string; weight: number }[];
}
export interface MissionVariant {
  key: string;
  source: 'broker' | 'contract';
  guild: string | null;
  rankMin: string | null;
  rankMax: string | null;
  blueprints: number;
  title: string | null;
  type: string | null;
  giver: string | null;
  locality: string | null;
  places: string[];
  reward: number;
  rewardMax: number;
  currency: string;
  buyIn: number;
  difficulty: number | null;
  lawful: boolean;
  shareable: boolean;
  onceOnly: boolean;
  maxPlayers: number | null;
  deadlineSec: number;
  lifetimeMin: number;
  cooldownMin: number;
  wantedMax: number | null;
  requestOnly: boolean;
  availableInPrison: boolean;
  failIfCriminal: boolean;
  rep: MissionRep[];
  flow: MissionFlow;
  module: string | null;
  file: string;
}
export interface Mission {
  slug: string;
  title: string;
  noTitle: boolean;
  titleDynamic: boolean;
  titleTokens: string[];
  titleVariants: { org: string; text: string }[];
  desc: string | null;
  descDynamic: boolean;
  /** 'broker' = Missionsbrett (Legacy), 'contract' = Contract-Manager. Beides moeglich. */
  sources: ('broker' | 'contract')[];
  guilds: string[];
  orgs: string[];
  ranks: string[];
  blueprints: BlueprintPool[];
  bpChance: number | null;
  /** Contract ohne feste Lohnzahl: der Betrag entsteht zur Laufzeit aus der Schwierigkeit. */
  calcReward: boolean;
  types: string[];
  typeNames: string[];
  givers: string[];
  giverNames: string[];
  localities: string[];
  localityNames: string[];
  places: string[];
  factions: string[];
  factionNames: string[];
  rewardMin: number;
  rewardMax: number;
  lawful: boolean;
  unlawful: boolean;
  tutorial: boolean;
  shareable: boolean;
  maxPlayers: number | null;
  flow: MissionFlow;
  module: string | null;
  tags: string[];
  count: number;
  variants: MissionVariant[];
}
export interface NamedRef { id: string; key: string; name: string }
export interface MissionsDb {
  meta: {
    source: string; lang: string; objectives: string;
    systems: string; guilds: string; blueprints: string;
    patch: string | null; generated: string;
    counts: Record<string, number>;
  };
  guilds: NamedRef[];
  types: NamedRef[];
  givers: NamedRef[];
  factions: (NamedRef & { isNPC: boolean; logo: string | null })[];
  localities: (NamedRef & { places: string[] })[];
  missions: Mission[];
}

export const db = DB as unknown as MissionsDb;
export const missions = db.missions;
export const missionBySlug = new Map(missions.map((m) => [m.slug, m]));

/* ---------- Lesbare, unterscheidbare Namen (UX-Audit F1) ---------- */
// Einmal fuer alle Missionen gerechnet: der Zusatz einer Mission haengt
// davon ab, welche anderen Missionen gleich heissen (src/lib/missionTitel.ts).
const NAMEN = baueMissionsNamen(missions, db.localities);
/** Missionen, die auch mit Zusatz noch gleich lauten (Selbstauskunft fuer Tore). */
export const missionNamenRestDoppelt = NAMEN.restDoppelt;

export function missionName(m: Pick<Mission, 'slug' | 'title'>): MissionName {
  return NAMEN.get(m.slug) ?? { teile: titelTeile(m.title), titel: titelText(titelTeile(m.title)), abgeleitet: false, zusatz: [] };
}
/** Unterscheidende Merkmale als eine Zeile: „Hydrogen · 1 Abholort, 2 Ziele" (leer, wenn der Titel allein eindeutig ist). */
export const missionZusatz = (m: Pick<Mission, 'slug' | 'title'>, lang: Locale) => zusatzText(missionName(m), lang);
/**
 * Titel und Zusatz in einer Zeile, fuer <title>, Suchtreffer und Listen
 * anderer Seiten: „Hauler Needed for Small Shipment (Hydrogen · 1 Abholort,
 * 2 Ziele)". Ohne Zusatz nur der Titel.
 */
export function missionVollname(m: Pick<Mission, 'slug' | 'title'>, lang: Locale): string {
  const n = missionName(m);
  const z = zusatzText(n, lang);
  return z ? `${n.titel} (${z})` : n.titel;
}
/** Suchwoerter einer Mission: Titel, Zusatz in beiden Sprachen, Vorlage ohne Klammern. */
export function missionSuchwoerter(m: Mission): string {
  const n = missionName(m);
  return [n.titel, zusatzText(n, 'en'), zusatzText(n, 'de'), m.title.replace(/\{([^}]*)\}/g, (_, t) => deCamelTitel(t))].join(' ');
}

/* ---------- Orte und Regionen lesbar (UX-Audit F2) ---------- */
// Fuer Stationen in Pyro fuehren die Spieldaten teils nur eine Kennung
// („RR_P1_L2_CLINIC" = Klinik der Raststation am Lagrange-Punkt L2 von
// Pyro I). Kennt die Ortsliste die Station (rr-p3-l1 = Starlight Service
// Station), steht ihr Name da; sonst der Name, den das Spiel fuer den Punkt
// selbst benutzt („PYR1 L2"), bzw. der Planet fuer die Station im niedrigen
// Orbit („Monox LEO"). „Clinic" bleibt englisch wie „Checkmate Clinic" in
// denselben Daten.
const ORT_BY_ID = new Map(db.localities.map((l) => [l.id, l.name]));
export function ortName(p: string): string {
  const x = /^RR_P(\d)_(L\d|LEO)(_CLINIC)?$/.exec(p);
  if (!x) return p;
  const station = ORT_BY_ID.get(`rr-p${x[1]}-${x[2].toLowerCase()}`)
    ?? (x[2] === 'LEO' ? `${ORT_BY_ID.get(`pyro${x[1]}`) ?? `PYR${x[1]}`} LEO` : `PYR${x[1]} ${x[2]}`);
  return x[3] ? `${station} Clinic` : station;
}

// Die vier Pyro-Regionen der Contracts: welche Planeten dazugehoeren, steht
// in ihrer Ortsliste. „Region B" sagt Spielern ohne das nichts.
const PYRO_PLANETEN = new Set((db.localities.find((l) => l.id === 'pyrostar')?.places ?? []).filter((p) => !/^Pyro( System)?$/.test(p)));
const REGION_HINWEIS = new Map<string, string[]>();
for (const l of db.localities) {
  if (!/^region[a-d]$/.test(l.id)) continue;
  REGION_HINWEIS.set(l.name, l.places.filter((p) => PYRO_PLANETEN.has(p)));
}
const undListe = (pl: string[], lang: Locale) =>
  pl.length > 1 ? `${pl.slice(0, -1).join(', ')} ${lang === 'de' ? 'und' : 'and'} ${pl[pl.length - 1]}` : pl[0];
/** „Region B" -> „Pyro, um Bloom" (null fuer Orte, die sich selbst erklaeren). */
export function regionHinweis(name: string, lang: Locale): string | null {
  const pl = REGION_HINWEIS.get(name);
  if (!pl || !pl.length) return null;
  return lang === 'de' ? `Pyro, um ${undListe(pl, lang)}` : `Pyro, around ${undListe(pl, lang)}`;
}
/**
 * Erklaerung fuer alle Pyro-Regionen einer Mission in EINEM Satz, nach
 * Buchstaben sortiert: „Region B liegt in Pyro, um Bloom." bzw. bei mehreren
 * „Pyro-Regionen: A um Pyro I und Monox · B um Bloom". null ohne Region.
 */
export function regionenHinweis(names: string[], lang: Locale): string | null {
  const r = [...new Set(names)].filter((n) => REGION_HINWEIS.get(n)?.length).sort();
  if (!r.length) return null;
  if (r.length === 1) {
    const pl = undListe(REGION_HINWEIS.get(r[0])!, lang);
    return lang === 'de' ? `${r[0]} liegt in Pyro, um ${pl}.` : `${r[0]} is in Pyro, around ${pl}.`;
  }
  const teile = r.map((n) => `${n.replace(/^Region /, '')} ${lang === 'de' ? 'um' : 'around'} ${undListe(REGION_HINWEIS.get(n)!, lang)}`);
  return `${lang === 'de' ? 'Pyro-Regionen' : 'Pyro regions'}: ${teile.join(' · ')}`;
}

// Karrierestufen standen in Datenreihenfolge („Junior – Master – Rookie").
// Jede Gilde hat ihre eigene Leiter; die Woerter darin folgen aber derselben
// Ordnung. Unbekanntes bleibt in seiner Reihenfolge am Ende.
const RANG_STUFEN: RegExp[] = [
  /^Neutral$/, /Applicant|Prospective/, /Trainee|Probationary/, /^Rookie$/, /Jr\.|Junior/,
  /^Associate$/, /^(?:Member|Contractor|Security Contractor|Guild Member)$/, /Trusted/, /Experienced/,
  /Sr\.|Senior/, /Veteran/, /Elite/, /Lead/, /Head/, /Master|Steward/, /Prestige/,
];
const rangStufe = (r: string) => { const i = RANG_STUFEN.findIndex((re) => re.test(r)); return i < 0 ? RANG_STUFEN.length : i; };
/** Karrierestufen von niedrig nach hoch („Rookie, Junior, Master"). */
export function rangFolge(ranks: string[]): string[] {
  return ranks.map((r, i) => ({ r, i, s: rangStufe(r) })).sort((a, b) => a.s - b.s || (/Prestige/.test(a.r) && /Prestige/.test(b.r) ? a.r.localeCompare(b.r) : a.i - b.i)).map((x) => x.r);
}

/** Orte und Systeme in Datenreihenfolge, die Pyro-Regionen danach nach Buchstaben (vorher „Region D, Region A, Region B"). */
export function regionFolge(names: string[]): string[] {
  return names.map((n, i) => ({ n, i, r: /^Region [A-Z]$/.test(n) ? 1 : 0 }))
    .sort((a, b) => a.r - b.r || (a.r ? a.n.localeCompare(b.n) : a.i - b.i)).map((x) => x.n);
}

/* ---------- Format ---------- */
const NUM = { de: 'de-DE', en: 'en-US' } as const;
export const uec = (n: number, lang: Locale) => n.toLocaleString(NUM[lang]);

/**
 * Spieler je Instanz, oder null, wenn die Daten keine Zahl nennen. Das Spiel
 * schreibt -1 fuer "keine Angabe"; die Seite zeigte das bis 04.11.2026 auf 91
 * Missionen je Sprache als "Spieler je Instanz: -1" (`m.maxPlayers || '—'`
 * liess die -1 durch, weil sie wahr ist). audit:site faengt die nackte -1.
 */
export function spielerJeInstanz(m: Pick<Mission, 'maxPlayers'>): number | null {
  return Number.isInteger(m.maxPlayers) && (m.maxPlayers as number) >= 1 ? (m.maxPlayers as number) : null;
}

/** Sekunden -> "1 h 30 min" / "45 min". 0 => null (kein Limit). */
export function dur(sec: number, lang: Locale): string | null {
  if (!sec || sec <= 0) return null;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}
export function mins(m: number, lang: Locale): string | null {
  if (!m || m <= 0) return null;
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** Belohnungsspanne einer Familie: "12.000" oder "5.000 – 30.000". */
export function rewardLabel(m: Mission, lang: Locale): string | null {
  if (!m.rewardMax) return null;
  return m.rewardMin === m.rewardMax
    ? uec(m.rewardMax, lang)
    : `${uec(m.rewardMin, lang)} – ${uec(m.rewardMax, lang)}`;
}

/**
 * Belohnung als Anzeige (UX-Audit F3). 829 Missionen fuehren keine feste
 * Zahl: der Lohn entsteht beim Annehmen aus der Schwierigkeit. Dort stand
 * „wird zur Laufzeit berechnet" — richtig, aber keine Antwort. Jetzt
 * „variiert" mit dem Grund als Hinweis; feste Betraege und Spannen wie
 * bisher. `zahl` sagt, ob ein Betrag dasteht (fuer die Zahlschrift).
 */
export function belohnung(m: Pick<Mission, 'rewardMin' | 'rewardMax' | 'calcReward'>, lang: Locale): { text: string; zahl: boolean; hinweis: string | null } {
  if (m.rewardMax) {
    const t = m.rewardMin !== m.rewardMax ? `${uec(m.rewardMin, lang)} – ${uec(m.rewardMax, lang)}` : uec(m.rewardMax, lang);
    return { text: `${t} aUEC`, zahl: true, hinweis: null };
  }
  if (m.calcReward) {
    return lang === 'de'
      ? { text: 'variiert', zahl: false, hinweis: 'Den Lohn berechnet das Spiel beim Annehmen aus der Schwierigkeit — eine feste Zahl gibt es nicht.' }
      : { text: 'varies', zahl: false, hinweis: 'The game sets the payout when you accept, based on difficulty — there is no fixed number.' };
  }
  // 155 Missionen nennen weder Betrag noch Berechnung (Bergungsrechte,
  // Notrufbaken, Beutezuege). „keine" behauptete mehr, als die Daten sagen.
  return lang === 'de'
    ? { text: 'nicht genannt', zahl: false, hinweis: 'Der Auftrag nennt keinen Betrag in aUEC.' }
    : { text: 'not listed', zahl: false, hinweis: 'The contract lists no aUEC amount.' };
}

/** Vergleichsoperator der Reputationsbedingung, sprachneutral als Zeichen. */
export const cmpSign = (c: string | null) =>
  c === 'GreaterThanOrEqualTo' ? '≥' : c === 'LessThanOrEqualTo' ? '≤'
    : c === 'GreaterThan' ? '>' : c === 'LessThan' ? '<'
      : c === 'NotEqualTo' ? '≠' : '=';

/**
 * Ruf-Stufe einer Bedingung als lesbarer Text.
 *
 * ⚠ ANLASS (03.11.2026): drei Formen standen roh auf der Seite —
 *   - Stufen ohne Anzeigenamen im Spiel kommen als interner Schluessel
 *     („ReputationStanding_Affinity_Neutral_015", 208 Bedingungen, 73 Familien),
 *   - Bedingungen ohne Stufe zeigten „≠ null" (Citizens For Prosperity,
 *     Foxwell Enforcement),
 *   - und die Variantentabelle schrieb eine fehlende Fraktion als „null".
 *
 * Getrennt wird, nicht uebersetzt (Regel aus lesbar.ts): aus dem Schluessel
 * fallen das Praefix, der Bereich (steht schon in der eigenen Spalte) und die
 * Stufenzahl weg, es bleibt das letzte Glied; die Zahl ist die Schwelle und kommt aus `standingMin`, das in
 * den Daten neben dem Schluessel steht. `mitSchwelle` haengt sie an, wo es
 * keine eigene Schwellen-Spalte gibt — sonst lesen sich „Neutral 0" und
 * „Neutral 1.500" beide als „≥ Neutral".
 */
export function standingLabel(r: MissionRep, lang: Locale, mitSchwelle = true): string {
  // Ohne Stufe gibt es nichts zu vergleichen. `standingMin` steht dann
  // manchmal trotzdem da (CFP: 0) — als „≠ 0" gelesen waere das eine
  // Behauptung, die die Daten nicht machen. Die Schwellen-Spalte zeigt es.
  if (!r.standing) return '—';
  const schwelle = r.standingMin != null ? uec(r.standingMin, lang) : null;
  const m = r.standing.match(/^ReputationStanding_(.+?)(?:_(-?\d+))?$/);
  if (!m) return r.standing;
  // Die Stufe ist das letzte Glied: Affinity_Neutral, NPC_Fired_Fired,
  // NPC_Reliability_Fireable. Am Bereich der Bedingung abschneiden reicht
  // nicht — eine Mission fuehrt Bereich NPC_Fired mit einem Affinity-Schluessel
  // (assassin-sync), und dort stand dann „Affinity Neutral".
  const stufe = m[1].slice(m[1].lastIndexOf('_') + 1);
  const name = lesbarerBezeichner(stufe);
  return m[2] != null && mitSchwelle && schwelle != null ? `${name} (${schwelle})` : name;
}

/**
 * Eine Bedingung als Zeile: „Ruto ≥ Neutral (1.500)". Eine fehlende Fraktion
 * faellt weg, eine fehlende Stufe samt Vergleichszeichen.
 */
export function repLine(r: MissionRep, lang: Locale): string {
  const stufe = r.standing ? `${cmpSign(r.comparison)} ${standingLabel(r, lang)}` : null;
  return [r.factionName, stufe].filter(Boolean).join(' ') || '—';
}

/** Eindeutige Rep-Bedingungen einer Familie (ueber alle Varianten). */
export function repSummary(m: Mission): MissionRep[] {
  const seen = new Set<string>();
  const out: MissionRep[] = [];
  for (const v of m.variants) {
    for (const r of v.rep) {
      const k = `${r.faction}|${r.standing}|${r.comparison}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
  }
  return out;
}

/** Wie viele verschiedene Blueprints kann diese Mission ueberhaupt abwerfen? */
export function bpCount(m: Mission): number {
  const seen = new Set<string>();
  for (const p of m.blueprints) for (const b of p.blueprints) seen.add(b.name);
  return seen.size;
}

/* ---------- SEO-Meta (Titel/Description ohne rohe Platzhalter) ---------- */
// 247 Missionstitel tragen Laufzeit-Platzhalter ({TargetName}, {ReputationRank},
// …). Seit dem UX-Audit (24.11.2026, F1) stehen sie nirgends mehr als
// Kaestchen im Titel: missionTitel.ts setzt bekannte Werte ein, laesst
// Rang/Lohn ersatzlos fallen und schreibt den Rest als allgemeines Wort
// („Target", „Location"). Die Vorlage mit Marken zeigt nur noch der Hinweis
// auf der Detailseite (Ehrlichkeitsregel).

/** "CargoGradeToken" -> "Cargo Grade Token"; "location" -> "Location". */
const deCamel = deCamelTitel;

// Beschriftung der Marken in der Vorlage (Hinweis auf der Detailseite).
const PH_LABEL: Record<string, string> = {
  targetname: 'Target', last: 'Target',
  defendlocationwrapperlocation: 'Location', address: 'Location', playlocation: 'Location',
  pickuplocation: 'Pickup Location', dropofflocation: 'Dropoff Location',
  racetype: 'Race', reputationrank: 'Reputation Rank', reward: 'Reward',
};

/**
 * Lesbare Beschriftung einer Marke in der Titel-Vorlage (D-03, Phase 18
 * Plan 02) — erst PH_LABEL, sonst deCamel(). Ersatzlos geloescht wird hier
 * nichts: die Vorlage zeigt jede Stelle, die das Spiel fuellt.
 */
export function phLabel(marke: string): string {
  const k = String(marke).toLowerCase();
  // „Token" ist Entwickler-Wort, kein Spielbegriff — die Marke zeigt die Sache
  // (03.11.2026: „Cargo Grade Token" stand in 78 Titeln).
  if (k === 'cargogradetoken') return 'Cargo Grade';
  return PH_LABEL[k] ?? deCamel(marke);
}

/** Missionstitel ohne den Laufzeit-Platzhalter am Ende („Target Shattered Blade: {TargetName}" -> „Target Shattered Blade"). */
export function kurztitel(title: string): string {
  return String(title).replace(/[\s:,–—-]*\{[^}]*\}\s*$/, '');
}

/**
 * Missionstitel ohne Klammern, nur aus dem Titeltext (wer nur den Titel hat,
 * z. B. Bauplan-Seiten und Suche): Platzhalter wie in missionTitel.ts. Wer
 * die Mission hat, nimmt missionVollname() — der kennt Frachtklasse und
 * Unterscheider.
 */
export function seoTitle(title: string): string {
  return titelText(titelTeile(title));
}

/**
 * Description-Text: Platzhalter stehen hier mitten in Prosa ("processed a
 * bunch of {Item}") — nur CamelCase-Split, KEIN Woerterbuch (ein ersatzloser
 * Drop risse Luecken in den Satz). Whitespace flach fuer das Meta-Attribut.
 */
export function seoText(s: string): string {
  return String(s)
    .replace(/\{([^}]*)\}/g, (_, t) => deCamel(t))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Auf max. `max` Zeichen kuerzen — an der Wortgrenze, mit Ellipse. */
export function clip(s: string, max = 160): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

/** Suchindex-Text einer Mission (klein geschrieben, fuer das data-Attribut). */
export function searchText(m: Mission): string {
  return [
    // desc nur als Anfang: die vollen DataCore-Briefe (bis ~2 KB) standen hier
    // komplett drin und machten den Missionen-Index zur 3,7-MB-Seite. Gesucht
    // wird realistisch nach Titel/Namen/Orten — 200 Zeichen Brieftext reichen.
    missionSuchwoerter(m), m.desc ? clip(seoText(m.desc), 200) : '',
    ...m.typeNames, ...m.giverNames, ...m.factionNames,
    ...m.localityNames, ...m.places.slice(0, 12).map(ortName),
    ...m.titleVariants.map((v) => `${v.org} ${v.text}`),
    ...m.guilds, ...m.orgs,
    ...m.blueprints.flatMap((p) => p.blueprints.map((b) => b.name)).slice(0, 30),
    m.blueprints.length ? 'blueprint blueprints' : '',
    m.module,
  ].filter(Boolean).join(' ').toLowerCase();
}
