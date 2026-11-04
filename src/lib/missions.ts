// Missions-Snapshot + Formathelfer.
//
// Datenquelle: src/data/missions.json, gebaut von scripts/datamine-missions.mjs
// aus Data.p4k -> Game2.dcb. Die Typen stehen hier explizit und werden NICHT aus
// dem JSON abgeleitet: die Datei ist ~2 MB, und `typeof import(...)` darauf macht
// den TS-Server im Editor zaeh.

import DB from '../data/missions.json';
import type { Locale } from '../i18n/ui';
import { lesbarerBezeichner } from './lesbar';

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
  maxPlayers: number;
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

/* ---------- Format ---------- */
const NUM = { de: 'de-DE', en: 'en-US' } as const;
export const uec = (n: number, lang: Locale) => n.toLocaleString(NUM[lang]);

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
// 227 Missionstitel tragen Laufzeit-Platzhalter ({TargetName}, {ReputationRank},
// …). Auf der SEITE bleiben sie als gestylte Marker sichtbar (Ehrlichkeit),
// aber in <title>/og:title/meta description stuende sonst rohes CamelCase —
// "Bounty Assignment: TargetName (HRT)" sieht in Suchergebnissen kaputt aus.
// Kuratiertes Woerterbuch fuer die Titel-Slots; Fallback ist CamelCase-Split.
const PH_TITLE: Record<string, string> = {
  // Bounty-/Vermissten-Familien: das Spiel setzt einen NPC-Namen ein
  targetname: 'Target',
  last: 'Target', // {Last} = Nachname des Ziels
  // Orts-Slots, die nicht schon selbst lesbar sind ({Location} bleibt via Split)
  defendlocationwrapperlocation: 'Location',
  address: 'Location',
  // D-03 (Slot-Art erhalten statt kollabieren, Phase 18 Plan 02): die vier
  // Ortsarten, die braces() in scripts/datamine-missions.mjs jetzt aus dem
  // ersten statt dem letzten Trennsegment bildet ({PlayLocation}/
  // {Destination}/{PickupLocation}/{DropoffLocation} statt {Address}).
  playlocation: 'Location',
  destination: 'Destination',
  pickuplocation: 'Pickup Location',
  dropofflocation: 'Dropoff Location',
  racetype: 'Race',
  // Rang-/Frachtklassen-/Lohn-Slots: ersatzlos — der Satz traegt ohne sie
  // ("{ReputationRank} Hauler Needed for {CargoGradeToken} Shipment"
  //  -> "Hauler Needed for Shipment")
  reputationrank: '',
  cargogradetoken: '',
  reward: '',
  // Recovery-/Delivery-Familien tragen den ganzen Titel im Token
  timesensitiverecovertitle: 'Time-Sensitive Recovery',
  recoverstashtitle: 'Stash Recovery',
  recoverstashstealtitle: 'Stash Recovery',
  localdeliverydrugprodtitle: 'Local Delivery',
  // Einzelfall "{Title} ({Item})" (mission-station-wastedisposal, Typ maintenance)
  title: 'Maintenance',
  item: '',
};

/** "CargoGradeToken" -> "Cargo Grade Token"; "location" -> "Location". */
const deCamel = (s: string) =>
  s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^[a-z]/, (c) => c.toUpperCase());

/**
 * Lesbare Beschriftung einer Chip-Marke (D-03, Phase 18 Plan 02) — erst
 * PH_TITLE, sonst deCamel(). Anders als seoTitle() darf sie NICHT ersatzlos
 * loeschen: Marken mit leerem PH_TITLE-Wert (z.B. "reward") sind fuer den
 * Suchmaschinentitel verzichtbar, bleiben aber auf der Seite selbst als
 * sichtbarer Marker stehen — die Ehrlichkeitsregel hinter PH_TITLE.
 */
export function phLabel(marke: string): string {
  const k = String(marke).toLowerCase();
  // „Token" ist Entwickler-Wort, kein Spielbegriff — die Marke zeigt die Sache
  // (03.11.2026: „Cargo Grade Token" stand in 78 Titeln).
  if (k === 'cargogradetoken') return 'Cargo Grade';
  const v = PH_TITLE[k];
  return v ? v : deCamel(marke);
}

/** Missionstitel fuer <title>/og — Platzhalter ersetzt, Trenner aufgeraeumt. */
export function seoTitle(title: string): string {
  return String(title)
    .replace(/\{([^}]*)\}/g, (_, t) => PH_TITLE[t.toLowerCase()] ?? deCamel(t))
    .replace(/\(\s*\)/g, ' ') // leere Klammerpaare nach ersatzlosen Slots
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,:–—-]+|[\s,:–—-]+$/g, '');
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
    m.title, m.desc ? clip(seoText(m.desc), 200) : '',
    ...m.typeNames, ...m.giverNames, ...m.factionNames,
    ...m.localityNames, ...m.places.slice(0, 12),
    ...m.titleVariants.map((v) => `${v.org} ${v.text}`),
    ...m.guilds, ...m.orgs,
    ...m.blueprints.flatMap((p) => p.blueprints.map((b) => b.name)).slice(0, 30),
    m.blueprints.length ? 'blueprint blueprints' : '',
    m.module,
  ].filter(Boolean).join(' ').toLowerCase();
}
