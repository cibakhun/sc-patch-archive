// bezugswege.ts — „So bekommst du es": alle Wege zu einem Item an einer Stelle.
//
// Warum es das gibt (UX-Audit 24.11.2026, Paket D1): 72 % der Einstiege landen
// auf einem Datenblatt, das Item-Blatt ist der groesste. Es nannte Kaufen und
// Loot in einer Preistabelle, Herstellen ganz unten, und Missionen nie:
// Item -> Mission war 0 %, obwohl „Blueprint -> Mission" der haeufigste
// Uebergang der ganzen Seite ist. Hier stehen die Wege, die die Daten
// hergeben, nebeneinander, jeder mit seinem naechsten Schritt:
//   Kaufen     Kauf- und Haendlerzeilen, nach Sternsystem gebuendelt
//   Finden     Loot-Zeilen (bestaetigt / eigene Recherche / unbekannt)
//   Herstellen Bauplan + die Missionen, die ihn geben (oder: Quelle unbekannt)
//   Wikelo     Tauschgeschaefte, die das Item GEBEN (verlangen ist kein Weg)
//   Ab Werk    Schiffe, auf denen das Teil serienmaessig sitzt
//   Sonderweg  Exklusiv-Zeilen (Promo, Concierge …)
// Nur lesen, nichts erfinden: ein Weg ohne Daten fehlt, statt geraten zu werden.
import { minPrice, pageItems, sortedObtain, type Item, type Obtain } from './items';
import { blueprintsByMission, craftDb, recipeForItem, type BlueprintEntry } from './crafting';
import ZERLEGEN from '../../assets/dismantling-items.json';
import ROHSTOFFE from '../data/commodity-prices.json';
import { missionBySlug, seoTitle } from './missions';
import {
  schiffeZumTeil, shopSystem, stockShips, wikeloBlueprintTrades, wikeloTrades, SYSTEME,
  type SternSystem, type StockShip,
} from './itemLinks';

export interface KaufGruppe {
  /** null = Ort ohne sichere Systemangabe */
  system: SternSystem | null;
  stellen: number;
  ab: number;
}

export interface MissionsWeg {
  slug: string;
  label: string;
  /** hat eine eigene Missions-Seite (sonst nur Text) */
  seite: boolean;
}

export interface Bezugswege {
  kaufen: { ab: number; stellen: number; gruppen: KaufGruppe[] } | null;
  finden: { bestaetigt: Obtain[]; recherche: Obtain[]; unbekannt: boolean } | null;
  herstellen: {
    bp: BlueprintEntry;
    /** verschiedene Missionstitel, beste zuerst (mit Seite, hoechste Chance) */
    missionen: MissionsWeg[];
    /** Bauplan per Wikelo-Tausch */
    wikelo: number;
  } | null;
  /** Wikelo-Tauschgeschaefte, die das Item geben */
  wikelo: number;
  abWerk: StockShip[];
  /** Schiffsgebundenes Teil: kommt mit diesem Schiff (D6), nur ohne abWerk */
  schiff: StockShip[];
  sonderweg: Obtain[];
  /** Zahl der Wege, die die Daten kennen (0 = keiner) */
  anzahl: number;
}

const istKauf = (o: Obtain) => (o.kind === 'shop' || o.kind === 'vehicle') && o.price != null && o.price > 0;

/** Kaufzeilen je System: Stanton, Pyro, Nyx, dann die ohne Angabe. */
export function kaufGruppen(rows: Obtain[]): KaufGruppe[] {
  const by = new Map<SternSystem | null, KaufGruppe>();
  for (const o of rows) {
    if (!istKauf(o)) continue;
    const sys = shopSystem(o.loc);
    const g = by.get(sys);
    if (g) {
      g.stellen++;
      if (o.price! < g.ab) g.ab = o.price!;
    } else by.set(sys, { system: sys, stellen: 1, ab: o.price! });
  }
  return [...SYSTEME, null].map((s) => by.get(s)).filter((g): g is KaufGruppe => !!g);
}

/** Gruppe der Bezugsquellen-Tabelle: ein System, mehrere, oder ohne Angabe. */
export type GruppenSchluessel = SternSystem | 'mehrere' | null;
export interface TabellenZeile { o: Obtain; systeme: SternSystem[] }
export interface TabellenGruppe { system: GruppenSchluessel; rows: TabellenZeile[] }

/**
 * In welchen Systemen gilt eine Bezugszeile? Bestaetigte Fundorte nennen
 * ihre Systeme selbst (wo), Kaufzeilen ueber den Ort (shopSystem).
 */
function zeilenSysteme(o: Obtain): SternSystem[] {
  if (o.kind === 'exclusive') return [];
  if (o.wo) {
    const keys = Object.keys(o.wo).map((k) => k.toLowerCase());
    return SYSTEME.filter((s) => keys.includes(s.toLowerCase()));
  }
  const s = shopSystem(o.loc);
  return s ? [s] : [];
}

/**
 * Die Bezugsquellen-Tabelle nach Sternsystem (D5): Stanton, Pyro, Nyx, dann
 * Fundorte in mehreren Systemen, dann Zeilen ohne sichere Angabe. Reihenfolge
 * in der Gruppe bleibt (guenstigste zuerst). Wer in Pyro spielt, will nicht an
 * sieben Stanton-Laeden vorbei.
 */
export function tabellenGruppen(rows: Obtain[]): TabellenGruppe[] {
  const by = new Map<GruppenSchluessel, TabellenZeile[]>();
  for (const o of rows) {
    const systeme = zeilenSysteme(o);
    const k: GruppenSchluessel = systeme.length === 1 ? systeme[0] : systeme.length > 1 ? 'mehrere' : null;
    const g = by.get(k);
    const z = { o, systeme };
    if (g) g.push(z);
    else by.set(k, [z]);
  }
  const reihe: GruppenSchluessel[] = [...SYSTEME, 'mehrere', null];
  return reihe.filter((s) => by.has(s)).map((s) => ({ system: s, rows: by.get(s)! }));
}

/**
 * Wie viele Bauplaene teilen sich den Pool dieser Mission (UX-Audit D4)?
 * Die Spieldaten nennen die Chance des POOLS (bei 3.763 von 3.798
 * Zuordnungen 1, also 100 %); welcher Bauplan daraus kommt, entscheidet der
 * Zufall, und alle tragen dasselbe Gewicht. „100 %" am Bauplan las sich wie
 * „jedes Mal genau dieser". Dieselbe Zahl zeigt die Missionsseite.
 */
export const poolGroesse = (missionId: string): number => blueprintsByMission.get(missionId)?.length ?? 0;

/** Aussicht auf genau diesen Bauplan: Pool-Chance geteilt durch Pool-Groesse. */
const aussicht = (chance: number, pool: number) => chance / Math.max(pool, 1);

export interface MissionsZeile { slug: string; label: string; seite: boolean; chance: number; pool: number }

/** Alle Missionen eines Bauplans fuer die Tabelle, beste Aussicht zuerst. */
export function missionsZeilen(bp: BlueprintEntry): MissionsZeile[] {
  return (bp.missions ?? [])
    .map((m) => ({ slug: m.id, label: seoTitle(m.name), seite: missionBySlug.has(m.id), chance: m.drop_chance, pool: poolGroesse(m.id) }))
    .sort((a, b) => aussicht(b.chance, b.pool) - aussicht(a.chance, a.pool) || a.label.localeCompare(b.label, 'en'));
}

/**
 * Missionen eines Bauplans als verschiedene Titel. Viele Missionen teilen
 * sich einen Titel („Reputation Rank …"), dreimal derselbe Text hilft
 * niemandem; je Titel zaehlt die erste Mission mit eigener Seite.
 */
export function missionsWege(bp: BlueprintEntry): MissionsWeg[] {
  // Missionen mit eigener Seite zuerst, darin die beste Aussicht (D4).
  const list = missionsZeilen(bp)
    .filter((m) => m.label)
    .sort((a, b) => Number(b.seite) - Number(a.seite));
  const seen = new Set<string>();
  const out: MissionsWeg[] = [];
  for (const m of list) {
    const k = m.label.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ slug: m.slug, label: m.label, seite: m.seite });
  }
  return out;
}

export function bezugswege(item: Item): Bezugswege {
  const rows = sortedObtain(item);
  const ab = minPrice(item);
  const gruppen = kaufGruppen(rows);
  const kaufen = ab != null && gruppen.length
    ? { ab, stellen: gruppen.reduce((n, g) => n + g.stellen, 0), gruppen }
    : null;

  const lootRows = rows.filter((o) => o.kind === 'loot');
  const unbekannt = item.game?.lootable === true && item.obtain.length === 0;
  const finden = lootRows.length || unbekannt
    ? { bestaetigt: lootRows.filter((o) => o.ort), recherche: lootRows.filter((o) => !o.ort), unbekannt }
    : null;

  const bp = recipeForItem(item);
  const herstellen = bp ? { bp, missionen: missionsWege(bp), wikelo: wikeloBlueprintTrades(bp.name) } : null;

  const wikelo = wikeloTrades(item)?.reward ?? 0;
  const abWerk = stockShips(item);
  const schiff = abWerk.length ? [] : schiffeZumTeil(item);
  const sonderweg = rows.filter((o) => o.kind === 'exclusive');

  const anzahl = [kaufen, finden, herstellen, wikelo > 0, abWerk.length > 0, schiff.length > 0, sonderweg.length > 0].filter(Boolean).length;
  return { kaufen, finden, herstellen, wikelo, abWerk, schiff, sonderweg, anzahl };
}

/* ---------- Rezept-Materialien: kaufen und zerlegen (UX-Audit D8) ---------- */

// Die Zutatentabelle eines Bauplans verlinkte jedes Material nur auf seinen
// Abbauort. Wer nicht abbaut, fragte vergeblich: kann ich es kaufen, oder
// aus etwas zerlegen? Beides steht in den Daten:
//   Kaufen    ein Rohstoff-Terminal fuehrt einen Kaufpreis (buy != null)
//   Zerlegen  kaufbare Items, deren Rezept das Material enthaelt — ausser den
//             Materialien, die das Spiel beim Zerlegen nie zurueckgibt
//             (dismantle_blacklist, dieselbe Liste wie im Zerlege-Rechner)
// Vorgeschlagen wird das Item mit der meisten Ausbeute je aUEC Kaufpreis.
type ZerlegItem = { name: string; purchasePrice_aUEC?: number | null; recipe?: { name: string; quantity_cSCU: number }[] };
type Rohstoff = { name: string; buy: number | null };

const klein = (s: string) => s.trim().toLowerCase();
const seiteNachName = new Map<string, Item | null>();
for (const it of pageItems) {
  const k = klein(it.name);
  seiteNachName.set(k, seiteNachName.has(k) ? null : it);
}

// je Material alle kaufbaren Items mit Seite, beste Ausbeute je aUEC zuerst
const zerlegQuellen = new Map<string, Item[]>();
{
  const kandidaten = new Map<string, { item: Item; wert: number }[]>();
  for (const z of ZERLEGEN as unknown as ZerlegItem[]) {
    const preis = z.purchasePrice_aUEC;
    const seite = seiteNachName.get(klein(z.name));
    if (!preis || preis <= 0 || !seite) continue;
    for (const r of z.recipe ?? []) {
      if (!(r.quantity_cSCU > 0)) continue;
      const k = klein(r.name);
      const l = kandidaten.get(k);
      const e = { item: seite, wert: r.quantity_cSCU / preis };
      if (l) l.push(e);
      else kandidaten.set(k, [e]);
    }
  }
  for (const [k, l] of kandidaten) {
    l.sort((a, b) => b.wert - a.wert || a.item.name.localeCompare(b.item.name, 'en'));
    zerlegQuellen.set(k, [...new Map(l.map((e) => [e.item.id, e.item])).values()]);
  }
}

const sperrliste = new Set((craftDb.dismantle_blacklist ?? []).map(klein));
const kaufbar = new Map<string, boolean>(
  Object.values((ROHSTOFFE as unknown as { commodities: Record<string, Rohstoff> }).commodities)
    .map((c) => [klein(c.name), c.buy != null && c.buy > 0] as const),
);

export interface MaterialWege {
  /** true kaufbar, false nur verkaufbar, null unbekannt */
  kaufen: boolean | null;
  /** 'gesperrt' = gibt das Spiel beim Zerlegen nie zurueck */
  zerlegen: { item: Item; anzahl: number } | 'gesperrt' | null;
}

/**
 * Wege zu einem Rezept-Material. `ohne` ist das Item, das der Bauplan
 * herstellt: es zu zerlegen, um es zu bauen, waere kein Weg.
 */
export function materialWege(material: string, ohne?: string | null): MaterialWege {
  const k = klein(material);
  const quellen = (zerlegQuellen.get(k) ?? []).filter((it) => it.id !== ohne);
  return {
    kaufen: kaufbar.has(k) ? kaufbar.get(k)! : null,
    zerlegen: sperrliste.has(k) ? 'gesperrt' : quellen.length ? { item: quellen[0], anzahl: quellen.length } : null,
  };
}
