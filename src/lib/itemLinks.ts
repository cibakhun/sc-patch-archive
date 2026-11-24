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

/* ---------- Werkzeuge, die zu einem Item passen ---------- */

// Bergbau-Ausruestung: Laserkoepfe, Module und Gadgets rechnet der
// Bruchrechner (/fracturing.html, components/FracturingCalc.astro). Die
// Mining-Werkbank beantwortet seit 12.08.2026 nur noch "welches Erz, wo" —
// fuer Ausruestung ist sie das falsche Ziel. Verlinkt wird nur, was der
// Rechner wirklich zur Auswahl hat (dieselbe Datei, aus der er seine Listen
// baut) — die Kategorie allein reicht nicht: unter "Utility / Gadgets"
// stehen auch Feuerloescher und Traktorstrahler.
// Laser filtert der Rechner wie hier: fest verbaute (builtIn, z. B. der
// Pitman am Golem) und solche ohne Abbauwert fehlen in seiner Auswahl.
type MiningEntry = { name: string; builtIn?: boolean; mining?: { dps?: number } };
const MM = MINING_MODEL as unknown as Record<'lasers' | 'modules' | 'gadgets', MiningEntry[] | undefined>;
const fracturingNames = new Set(
  [
    ...(MM.lasers ?? []).filter((l) => !l.builtIn && l.mining && l.mining.dps),
    ...(MM.modules ?? []),
    ...(MM.gadgets ?? []),
  ].map((g) => norm(g.name)),
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

/* ---------- Sternsystem einer Verkaufsstelle ---------- */

// Paket D (UX-Audit 24.11.2026, „So bekommst du es" und Bezugsquellen nach
// System): Die Kaufzeilen tragen keinen Systemschluessel, nur den Ortsnamen.
// Der Preisabruf haengt an Orte ausserhalb von Stanton den Systemnamen in
// Klammern an ("Guns - Checkmate (Pyro)"), Zeilen aus dem eigenen
// Shop-Schnappschuss tragen ihn immer. Ohne Zusatz ist eine Zeile nur dann
// Stanton, wenn ihr Ort sicher in Stanton liegt (Landezonen, Stationen,
// Lagrange-Punkte); Ausnahmen ohne Zusatz, die sicher woanders liegen, stehen
// in ANDERSWO. Alles Uebrige bleibt `null` = "ohne Systemangabe" — lieber
// eine ehrliche Luecke als ein geratenes System (Astor's Clearing, Dunboro …).
export type SternSystem = 'Stanton' | 'Pyro' | 'Nyx';
export const SYSTEME: readonly SternSystem[] = ['Stanton', 'Pyro', 'Nyx'];
const SYS_ZUSATZ = /\((Stanton|Pyro|Nyx)\)\s*$/;
const ANDERSWO: ReadonlyArray<readonly [RegExp, SternSystem]> = [
  [/\bLevski\b|\bNyx\b/, 'Nyx'],
  [/\b(?:Checkmate|Orbituary|Ruin Station|Gaslight|Patch City|Endgame|Rat's Nest|Starlight Service|Megumi|Dudley|Rod's Fuel)\b/, 'Pyro'],
];
const STANTON_ORT =
  /\b(?:Area ?18|Lorville|New Babbage|Orison|GrimHEX|Everus Harbor|Port Tressler|Baijini Point|Seraphim|(?:ARC|CRU|HUR|MIC)-L\d|Crusader|Hurston|microTech|ArcCorp)\b/i;

/** System einer Kauf- oder Haendlerzeile; null = ohne sichere Angabe. */
export function shopSystem(loc: string): SternSystem | null {
  const z = loc.match(SYS_ZUSATZ);
  if (z) return z[1] as SternSystem;
  for (const [re, sys] of ANDERSWO) if (re.test(loc)) return sys;
  return STANTON_ORT.test(loc) ? 'Stanton' : null;
}

/* ---------- Wikelo gibt einen Bauplan ---------- */

// Ein Tauschgeschaeft kann statt eines Items auch einen Bauplan geben
// ('Killshot "Dominion Camo" Rifle Blueprint'). Schluessel: der Bauplan-Name
// in Kleinbuchstaben, wie crafting.ts `blueprintByName`.
const wikeloBp = new Map<string, number>();
for (const tr of WIKELO as unknown as WikeloTrade[]) {
  const roh = (tr.get ?? tr.name).trim();
  const m = roh.match(/^(.*\S)\s+Blueprint$/i);
  if (!m) continue;
  const k = m[1].toLowerCase();
  wikeloBp.set(k, (wikeloBp.get(k) ?? 0) + 1);
}
/** Wie viele Wikelo-Tauschgeschaefte diesen Bauplan geben (0 = keins). */
export const wikeloBlueprintTrades = (bpName: string): number => wikeloBp.get(bpName.toLowerCase()) ?? 0;

/* ---------- Schiffsteile: Item -> sein Schiff (UX-Audit D6) ---------- */

// 215 Item-Blaetter zeigten im Block „So bekommst du es" keinen einzigen Weg,
// die meisten davon Teile, die nur mit ihrem Schiff kommen: Raketenhalter,
// Tuerme, Module, Bodykits, schiffseigene Taeuschkoerperwerfer. Kaufen kann
// man sie nicht, finden auch nicht — der Weg ist das Schiff. Zwei Quellen,
// beide vorsichtig („lieber kein Link als der falsche"):
//   1. Serienbelegung der Taeuschkoerperwerfer (oben ausgelassen, weil sie an
//      fast jedem Schiff sitzen): nur wo der Werfer an hoechstens
//      SCHIFFSTEIL_MAX Schiffen sitzt, also wirklich zu wenigen gehoert.
//   2. Der Name nennt das Schiff („Aegis Eclipse Torpedo Rack"), nur in den
//      Kategorien schiffsgebundener Teile. Einwortnamen („Liberator",
//      „Galaxy") zaehlen nur, wenn auch der Hersteller passt — die
//      Liberator-Raketen von Thermyte sind kein Teil der Anvil Liberator.
const SCHIFFSTEIL_MAX = 8;
const TEIL_KATEGORIEN = /^Vehiclegear \/ (?:Weapons \/ (?:Missile Racks|Turrets)|Module|Salvage|Tool Arm|Countermeasures)$/;
const SCHIFFSPANZER = /\bShip Armou?r\b/i;

type Fahrzeug = { id: string; name: string; manufacturer?: string; makerCode?: string; isSpaceship?: boolean };
const FAHRZEUGE = (VEHICLES as unknown as { vehicles: Fahrzeug[] }).vehicles;
const worte = (s: string) => ` ${s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()} `;
const ersterTeil = (s: string | null | undefined) => worte(s ?? '').trim().split(' ')[0] ?? '';

// Je Fahrzeug die Schreibweisen, unter denen ein Teil es nennt:
// „Gladius", „Aegis Gladius", „AEGS Gladius"; „MISC Reliant Tana" auch ohne „MISC".
const nennungen = FAHRZEUGE.filter((v) => vehicleInfo.has(v.id)).map((v) => {
  const name = worte(v.name);
  const marke = ersterTeil(v.manufacturer);
  const formen = new Set([name, worte(`${marke} ${v.name}`)]);
  const erstes = name.trim().split(' ')[0];
  if (erstes === marke || erstes === (v.makerCode ?? '').toLowerCase()) formen.add(` ${name.trim().split(' ').slice(1).join(' ')} `);
  return { id: v.id, marke, mehrwortig: name.trim().includes(' '), formen: [...formen].filter((f) => f.trim()) };
});

const cmSchiffe = new Map<string, Set<string>>();
for (const [shipId, ports] of Object.entries(shipLoadouts)) {
  if (!vehicleInfo.has(shipId)) continue;
  for (const leaves of Object.values(ports)) {
    for (const leaf of leaves) {
      if (leaf.cat !== 'countermeasure') continue;
      const it = itemForPart(leaf.name, leaf.size);
      if (!it) continue;
      const set = cmSchiffe.get(it.id);
      if (set) set.add(shipId);
      else cmSchiffe.set(it.id, new Set([shipId]));
    }
  }
}

const alsSchiffe = (ids: Iterable<string>): StockShip[] =>
  [...ids].map((id) => ({ id, ...vehicleInfo.get(id)! })).sort((a, b) => a.name.localeCompare(b.name, 'en'));

function schiffAusName(item: Item): string[] {
  if (!TEIL_KATEGORIEN.test(item.category ?? '') && !SCHIFFSPANZER.test(item.name)) return [];
  const w = worte(item.name);
  const marke = ersterTeil(item.game?.manufacturer ?? item.game?.variants?.[0]?.manufacturer);
  let best: string[] = [];
  let laenge = 0;
  for (const n of nennungen) {
    const form = n.formen.filter((f) => w.includes(f)).sort((a, b) => b.length - a.length)[0];
    if (!form) continue;
    const mitMarke = form.trim().startsWith(n.marke) && n.marke !== '';
    if (!mitMarke && !n.mehrwortig && marke !== n.marke && !w.startsWith(` ${n.marke} `)) continue;
    if (form.length > laenge) { laenge = form.length; best = [n.id]; }
    else if (form.length === laenge) best.push(n.id);
  }
  return best;
}

/**
 * Schiffe, zu denen ein schiffsgebundenes Teil gehoert — nur fuer Teile, die
 * nicht ohnehin als Serienteil gefuehrt sind (stockShips). Leer, wenn die
 * Zuordnung nicht eindeutig genug ist.
 */
export function schiffeZumTeil(item: Item): StockShip[] {
  if (stockByItem.has(item.id) || item.category === 'Vehicle') return [];
  const cm = cmSchiffe.get(item.id);
  if (cm && cm.size <= SCHIFFSTEIL_MAX) return alsSchiffe(cm);
  const ausName = schiffAusName(item);
  return ausName.length && ausName.length <= SCHIFFSTEIL_MAX ? alsSchiffe(ausName) : [];
}
