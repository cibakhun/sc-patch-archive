// Refinery-Datengrundlage + reine Helfer fürs Konto-Dashboard.
// Fakten (Erze/Stationen) sind game-sourced, Preise UEX — gebaut von
// scripts/build-refinery-data.mjs → assets/refinery-data.json.
//
// Bewusst OHNE Schätzmodell: die exakte Refinery-Ökonomie (Ausbeute/Zeit/Kosten
// pro Methode) ist serverseitig; der Nutzer trägt die Zahlen aus dem Ingame-
// Terminal ein. Dieses Modul liefert nur die Auswahllisten, den Verkaufspreis
// für die Wert-Schätzung und Formatierungs-/Zeit-Helfer.
import DATA from '../../assets/refinery-data.json';

export type RefLevel = 'vlow' | 'low' | 'mid' | 'high';

export interface RefMethod {
  key: string;
  name: string;
  speed: RefLevel;
  cost: RefLevel;
  yield: RefLevel;
}

export interface RefStation {
  key: string;
  name: string;
  short: string;
  system: string;
}

export interface RefOre {
  name: string;
  code: string | null;
  kind: string | null;
  weight_scu: number | null;
  rarity: string | null;
  systems: string[];
  /** UEX-Durchschnitts-Verkaufspreis (aUEC/SCU), robust; null wenn unbekannt */
  sell: number | null;
  /** bester aktueller Terminal-Verkaufspreis */
  sellMax: number | null;
  /** Ort des besten Preises */
  sellLoc: string | null;
  /** beste Raffinerie (Kurzname) nach game-echtem Yield-Bonus */
  bestRefinery: string | null;
  bestRefineryBonus: number | null;
}

export interface RefineryData {
  meta: {
    builtAt: string;
    gameVersion: string | null;
    priceDate: string | null;
    priceSource: string | null;
    note: string;
  };
  methods: RefMethod[];
  stations: RefStation[];
  ores: RefOre[];
}

export const REFINERY = DATA as RefineryData;

// ---- Nachschlage-Maps -------------------------------------------------------
export const oreByName = new Map<string, RefOre>(REFINERY.ores.map((o) => [o.name, o]));
export const stationByKey = new Map<string, RefStation>(REFINERY.stations.map((s) => [s.key, s]));
export const stationByName = new Map<string, RefStation>(REFINERY.stations.map((s) => [s.name, s]));
export const methodByKey = new Map<string, RefMethod>(REFINERY.methods.map((m) => [m.key, m]));

/** Stationen nach System gruppiert (Reihenfolge: Stanton, Pyro, Nyx, Rest). */
export function stationsBySystem(): { system: string; stations: RefStation[] }[] {
  const order = ['Stanton', 'Pyro', 'Nyx'];
  const groups = new Map<string, RefStation[]>();
  for (const s of REFINERY.stations) {
    if (!groups.has(s.system)) groups.set(s.system, []);
    groups.get(s.system)!.push(s);
  }
  return [...groups.keys()]
    .sort((a, b) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    })
    .map((system) => ({ system, stations: groups.get(system)! }));
}

// ---- DB-Zeile (public.refinery_jobs) ---------------------------------------
export interface RefineryItem {
  ore: string;
  rawScu: number;
  yieldScu: number;
}

export type RefineryStatus = 'active' | 'done';

export interface RefineryJob {
  id: number;
  user_id?: string;
  station: string;
  method: string;
  items: RefineryItem[];
  input_scu: number;
  yield_scu: number;
  cost: number;
  est_value: number | null;
  sold_value: number | null;
  started_at: string;
  ready_at: string;
  collected_at: string | null;
  status: RefineryStatus;
  note: string | null;
  created_at: string;
}

// ---- Wert-Schätzung ---------------------------------------------------------
/** Geschätzter aUEC-Verkaufswert der Ausbeute (Summe yieldScu × UEX-Preis). */
export function estimateValue(items: RefineryItem[]): number {
  let sum = 0;
  for (const it of items) {
    const ore = oreByName.get(it.ore);
    if (ore?.sell && it.yieldScu > 0) sum += it.yieldScu * ore.sell;
  }
  return Math.round(sum);
}

// ---- Zeit / Zahlen ----------------------------------------------------------
/** „2d 3h 15m" / „3h 15m" / „15m" / „<1m". Kompakt, ohne Sekunden. */
export function fmtDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts: string[] = [];
  if (d) parts.push(d + 'd');
  if (h) parts.push(h + 'h');
  if (m || (!d && !h)) parts.push((m || (s > 0 ? '<1' : 0)) + 'm');
  return parts.join(' ');
}

/** Countdown „2d 03:12:45" / „03:12:45" — für den Live-Ticker. */
export function fmtCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const hms = `${pad(h)}:${pad(m)}:${pad(sec)}`;
  return d > 0 ? `${d}d ${hms}` : hms;
}

/** aUEC mit lokalisiertem Tausendertrennzeichen. */
export function fmtAuec(n: number | null | undefined, lang: 'de' | 'en'): string {
  if (n == null || !isFinite(n)) return '—';
  return Math.round(n).toLocaleString(lang === 'de' ? 'de-DE' : 'en-US');
}

/** SCU mit bis zu 2 Nachkommastellen, ohne unnötige Nullen. */
export function fmtScu(n: number | null | undefined, lang: 'de' | 'en'): string {
  if (n == null || !isFinite(n)) return '—';
  return n.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 2 });
}
