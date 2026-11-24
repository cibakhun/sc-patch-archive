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
import { minPrice, sortedObtain, type Item, type Obtain } from './items';
import { recipeForItem, type BlueprintEntry } from './crafting';
import { missionBySlug, seoTitle } from './missions';
import {
  shopSystem, stockShips, wikeloBlueprintTrades, wikeloTrades, SYSTEME,
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

/**
 * Missionen eines Bauplans als verschiedene Titel. Viele Missionen teilen
 * sich einen Titel („Reputation Rank …"), dreimal derselbe Text hilft
 * niemandem; je Titel zaehlt die erste Mission mit eigener Seite.
 */
export function missionsWege(bp: BlueprintEntry): MissionsWeg[] {
  const list = [...(bp.missions ?? [])]
    .map((m) => ({ slug: m.id, label: seoTitle(m.name), seite: missionBySlug.has(m.id), chance: m.drop_chance }))
    .filter((m) => m.label)
    .sort((a, b) => Number(b.seite) - Number(a.seite) || b.chance - a.chance || a.label.localeCompare(b.label, 'en'));
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
  const sonderweg = rows.filter((o) => o.kind === 'exclusive');

  const anzahl = [kaufen, finden, herstellen, wikelo > 0, abWerk.length > 0, sonderweg.length > 0].filter(Boolean).length;
  return { kaufen, finden, herstellen, wikelo, abWerk, sonderweg, anzahl };
}
