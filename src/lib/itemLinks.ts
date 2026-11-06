// itemLinks.ts — Brücken zwischen Item-Datenblättern und Schiffsseiten.
//
// Warum es das gibt (06.11.2026): Die Schiffsseiten nannten ihre Waffen und
// Bauteile nur als Text, und die Item-Seite eines Schiffsteils wusste nicht,
// auf welchen Schiffen es ab Werk sitzt. Wer über eine Suche auf
// /items/cf-337-panther-repeater.html landet, kam von dort nicht zu den
// Schiffen, die sie tragen — und umgekehrt.
//
// Zuordnung über Name + Größe, dieselbe Regel wie der Hangar
// (src/lib/hangar/layouts.ts, `byName`): die Serienbelegung
// (src/data/ship-loadouts.json) und die Schiffsdaten (src/data/vehicles.json)
// tragen keine Item-Kennung, nur den Anzeigenamen und die Größe. Gemessen am
// 06.11.2026 über alle Item-Seiten:
//   Serienbelegung   3.656 von 3.709 Blättern eindeutig, 0 mehrdeutig
//   Schiffsseiten    Waffen 598 von 599, Bauteile 1.072 von 1.082, 0 mehrdeutig
// Ein Name, der auf MEHR als eine Item-Seite passt, wird nie verlinkt — der
// Build bricht nicht ab, er lässt den Text stehen (das Tor verify:metrics hält
// die Zahl der Treffer als Sperrklinke, damit ein Datenlauf, der den Join
// bricht, nicht still alle Links verliert).
//
// Nur Seiten mit Datenblatt (pageItemIds) sind Ziel: ein Link auf ein Item
// ohne eigene Seite wäre ein toter Link.
import LOADOUTS from '../data/ship-loadouts.json';
import VEHICLES from '../data/vehicles.json';
import MINING_MODEL from '../../assets/mining-model.json';
import WIKELO from '../../assets/wikelo-trades.json';
import { pageItems, type Item } from './items';
import { matchItemName } from './wikeloItemMatch';

// Dieselbe Normalisierung wie der Hangar: Anführungszeichen weg, Leerraum
// zusammengefasst, klein geschrieben.
const norm = (s: string) => s.toLowerCase().replace(/["'`„“”‚‘’]/g, '').replace(/\s+/g, ' ').trim();

const key = (name: string, size: number) => `${norm(name)}|${size}`;

// name|groesse -> Item-Seiten. Mehrdeutige Anzeigenamen ("Revenant Gatling" =
// S3/S4/S6) tragen ihre Groessen in game.variants — jede Groesse ist ein
// eigener Schluessel auf dieselbe Seite.
const byKey = new Map<string, Item[]>();
for (const it of pageItems) {
  const g = it.game;
  const sizes = g?.variants?.length ? g.variants.map((v) => v.size) : [g?.size];
  for (const s of new Set(sizes)) {
    if (typeof s !== 'number') continue;
    const k = key(it.name, s);
    const list = byKey.get(k);
    if (list) list.push(it);
    else byKey.set(k, [it]);
  }
}

/** Die Item-Seite zu einem Schiffsteil — nur bei genau einem Treffer. */
export function itemForPart(name: string | null | undefined, size: number | null | undefined): Item | null {
  if (!name || typeof size !== 'number') return null;
  const hits = byKey.get(key(name, size));
  return hits && hits.length === 1 ? hits[0] : null;
}

/* ---------- Serienbelegung: Item -> Schiffe ---------- */

// Nur echte Bauteile. Ausgelassen: Treibstofftanks ("Internal Tank" heisst auf
// 205 Schiffen dasselbe Teil — keine Aussage), Täuschkörperwerfer (an fast
// jedem Schiff, und der Katalog trennt Werfer und Munition nicht sauber) und
// Erzbehälter.
const STOCK_CATS = new Set(['weapon', 'missile', 'shield', 'power', 'cooler', 'quantum', 'radar']);

interface LoadoutLeaf { name: string | null; size: number; cat: string; cls: string; count: number }
const shipLoadouts = (LOADOUTS as unknown as { ships: Record<string, Record<string, LoadoutLeaf[]>> }).ships;
const vehicleInfo = new Map(
  (VEHICLES as unknown as { vehicles: { id: string; name: string; isSpaceship?: boolean }[] }).vehicles.map(
    (v) => [v.id, { name: v.name, spaceship: v.isSpaceship !== false }],
  ),
);

const stockByItem = new Map<string, Set<string>>();
for (const [shipId, ports] of Object.entries(shipLoadouts)) {
  if (!vehicleInfo.has(shipId)) continue; // nur Schiffe mit eigener Seite
  for (const leaves of Object.values(ports)) {
    for (const leaf of leaves) {
      if (!STOCK_CATS.has(leaf.cat)) continue;
      const it = itemForPart(leaf.name, leaf.size);
      if (!it) continue;
      const set = stockByItem.get(it.id);
      if (set) set.add(shipId);
      else stockByItem.set(it.id, new Set([shipId]));
    }
  }
}

/** spaceship: false bei Bodenfahrzeugen (Cyclone, Nova …) — die Seite sagt dann "Fahrzeuge". */
export interface StockShip { id: string; name: string; spaceship: boolean }

/** Schiffe, auf denen dieses Item ab Werk verbaut ist, nach Namen sortiert. */
export function stockShips(item: Item): StockShip[] {
  const ids = stockByItem.get(item.id);
  if (!ids) return [];
  return [...ids]
    .map((id) => ({ id, ...vehicleInfo.get(id)! }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

/** Für das Tor: wie viele Item-Seiten Schiffe nennen, wie viele Paare es gibt. */
export function stockStats(): { items: number; pairs: number } {
  let pairs = 0;
  for (const s of stockByItem.values()) pairs += s.size;
  return { items: stockByItem.size, pairs };
}

/* ---------- Werkzeuge, die zu einem Item passen ---------- */

// Bergbau-Ausruestung: Laserkoepfe, Module und Gadgets rechnet der
// Bruchrechner (/fracturing.html, components/FracturingCalc.astro). Die
// Mining-Werkbank beantwortet seit 12.08.2026 nur noch "welches Erz, wo" —
// fuer Ausruestung ist sie das falsche Ziel. Verlinkt wird nur, was der
// Rechner wirklich zur Auswahl hat (dieselbe Datei, aus der er seine Listen
// baut) — die Kategorie allein reicht nicht: unter "Utility / Gadgets"
// stehen auch Feuerloescher und Traktorstrahler.
const fracturingNames = new Set(
  (['lasers', 'modules', 'gadgets'] as const).flatMap((k) =>
    ((MINING_MODEL as unknown as Record<string, { name: string }[]>)[k] ?? []).map((g) => norm(g.name)),
  ),
);
export const inFracturingCalc = (item: Item): boolean => fracturingNames.has(norm(item.name));

// Wikelo: Tauschgeschaefte, die dieses Item als Material verlangen oder
// als Belohnung geben. Namensabgleich ueber matchItemName — dieselbe Regel,
// mit der die Wikelo-Seite ihre Namen klickbar macht (die Quelle fuehrt keine
// Ids, siehe Kopf von wikeloItemMatch.ts).
interface WikeloTrade { name: string; get?: string; mats?: string[] }
const wikeloUse = new Map<string, { material: number; reward: number }>();
for (const tr of WIKELO as unknown as WikeloTrade[]) {
  const seen = new Set<string>();
  for (const raw of tr.mats ?? []) {
    const n = matchItemName(raw);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    const u = wikeloUse.get(n) ?? { material: 0, reward: 0 };
    u.material++;
    wikeloUse.set(n, u);
  }
  const got = matchItemName(tr.get ?? tr.name);
  if (got && !seen.has(got)) {
    const u = wikeloUse.get(got) ?? { material: 0, reward: 0 };
    u.reward++;
    wikeloUse.set(got, u);
  }
}
/** Wie oft Wikelo dieses Item verlangt (material) oder gibt (reward); null = gar nicht. */
export function wikeloTrades(item: Item): { material: number; reward: number } | null {
  return wikeloUse.get(item.name) ?? null;
}
