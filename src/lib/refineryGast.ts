// Refinery-Auftraege ohne Konto (UX-Audit 24.11.2026, Paket G11, Task-Flow
// F07/V21). Bis dahin zeigte der Tracker Gaesten nur ein Schloss und den
// Anmelde-Knopf; wer einen Auftrag eintragen wollte, musste erst ein Konto
// anlegen. Jetzt laeuft er wie der Crafting-Planer: ohne Anmeldung liegen die
// Auftraege in diesem Browser, das Konto bringt nur die Discord-Nachricht und
// den Abgleich zwischen Geraeten dazu.
//
// Beim ersten Laden mit Konto wandern die Gast-Auftraege einmal ins Konto
// (refinery_jobs) und die Ablage wird geleert, wie beim Crafting-Planer und in
// der Datenschutzerklaerung (#storage) beschrieben. Der Schluessel hat weder
// Punkt-Konto-ID noch Praefix eines Kontospiegels: Abmelden laesst ihn stehen
// (src/lib/account-cleanup.ts raeumt nur Kontodaten weg).
//
// Ohne Laufzeit-Importe, damit tests/e2e/refinery-gast.test.js die Datei
// unveraendert laden kann (Node entfernt die Typen beim Laden).
import type { RefineryJob, RefineryItem } from './refinery';

export const GAST_KEY = 'vb.refinery.v1';
/** Obergrenze der Ablage; aeltere abgeholte Auftraege fallen zuerst weg. */
export const GAST_MAX = 200;

/** Das Noetigste von Storage, damit Tests eine Map hineinreichen koennen. */
export interface GastStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const text = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.length >= 1 && v.length <= max && !/[<>]/.test(v) ? v : null;
const zahl = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const zeit = (v: unknown): string | null =>
  typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(Date.parse(v)).toISOString() : null;

function posten(v: unknown): RefineryItem | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const ore = text(o.ore, 80);
  const rawScu = zahl(o.rawScu) ?? 0;
  const yieldScu = zahl(o.yieldScu) ?? 0;
  return ore ? { ore, rawScu, yieldScu } : null;
}

/**
 * Prueft einen Eintrag der Ablage gegen dieselben Regeln, die das Konto an
 * refinery_jobs stellt (Laengen, keine spitzen Klammern, Betraege >= 0,
 * hoechstens 30 Erze). Was nicht passt, faellt weg, statt die Seite oder die
 * spaetere Uebernahme ins Konto zu stoeren. Von Hand veraenderte Ablagen
 * sind so harmlos; ausgegeben wird ohnehin nur als Text.
 */
export function gastAuftrag(v: unknown): RefineryJob | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const id = typeof o.id === 'number' && Number.isInteger(o.id) && o.id > 0 ? o.id : null;
  const station = text(o.station, 80);
  const method = text(o.method, 60);
  const started = zeit(o.started_at);
  const ready = zeit(o.ready_at);
  const status = o.status === 'active' || o.status === 'done' ? o.status : null;
  if (id == null || !station || !method || !started || !ready || !status) return null;
  if (!Array.isArray(o.items) || o.items.length > 30) return null;
  const items = o.items.map(posten);
  if (items.some((x) => x == null)) return null;
  const note = typeof o.note === 'string' && o.note.trim() && o.note.length <= 500 ? o.note : null;
  return {
    id,
    station,
    method,
    items: items as RefineryItem[],
    input_scu: zahl(o.input_scu) ?? 0,
    yield_scu: zahl(o.yield_scu) ?? 0,
    cost: zahl(o.cost) ?? 0,
    est_value: zahl(o.est_value),
    sold_value: zahl(o.sold_value),
    started_at: started,
    ready_at: ready,
    collected_at: status === 'done' ? zeit(o.collected_at) : null,
    status,
    note,
    created_at: zeit(o.created_at) ?? started,
  };
}

/** Liest die Gast-Auftraege. Fehlt die Ablage oder ist sie kaputt: leere Liste. */
export function ladeGast(store: GastStore | null | undefined): RefineryJob[] {
  if (!store) return [];
  let roh: unknown;
  try { roh = JSON.parse(store.getItem(GAST_KEY) || 'null'); } catch { return []; }
  const liste = roh && typeof roh === 'object' && Array.isArray((roh as { jobs?: unknown }).jobs) ? (roh as { jobs: unknown[] }).jobs : [];
  const out: RefineryJob[] = [];
  const ids = new Set<number>();
  for (const v of liste) {
    const j = gastAuftrag(v);
    if (j && !ids.has(j.id)) { ids.add(j.id); out.push(j); }
  }
  return out;
}

/**
 * Schreibt die Gast-Auftraege. Ueber GAST_MAX fallen die am laengsten
 * abgeholten zuerst weg, laufende nie. Leere Liste: Ablage entfernen.
 * Gibt false zurueck, wenn der Browser das Schreiben ablehnt oder die Grenze
 * nur durch Loeschen laufender Auftraege zu halten waere (dann bleibt die
 * Ablage, wie sie war).
 */
export function speichereGast(store: GastStore | null | undefined, jobs: readonly RefineryJob[]): boolean {
  if (!store) return false;
  try {
    if (!jobs.length) { store.removeItem(GAST_KEY); return true; }
    let behalten = [...jobs];
    if (behalten.length > GAST_MAX) {
      const fertig = behalten
        .filter((j) => j.status === 'done')
        .sort((a, b) => Date.parse(a.collected_at || a.created_at) - Date.parse(b.collected_at || b.created_at));
      const weg = new Set(fertig.slice(0, behalten.length - GAST_MAX).map((j) => j.id));
      behalten = behalten.filter((j) => !weg.has(j.id));
      if (behalten.length > GAST_MAX) return false;
    }
    store.setItem(GAST_KEY, JSON.stringify({ v: 1, jobs: behalten }));
    return true;
  } catch {
    return false;
  }
}

/** Naechste freie Kennung (nur innerhalb dieses Browsers eindeutig). */
export function naechsteGastId(jobs: readonly Pick<RefineryJob, 'id'>[]): number {
  return jobs.reduce((m, j) => Math.max(m, j.id), 0) + 1;
}

/** Hat dieser Browser Gast-Auftraege? Fuer den Gast-Riegel vor dem ersten Bild. */
export function hatGastAuftraege(store: GastStore | null | undefined): boolean {
  return ladeGast(store).length > 0;
}

/**
 * Zeile fuer refinery_jobs aus einem Gast-Auftrag: ohne id, user_id und
 * created_at (die setzt das Konto), sonst alles, auch Abholzeit und Erloes.
 */
export function kontoZeile(j: RefineryJob): Omit<RefineryJob, 'id' | 'user_id' | 'created_at'> {
  return {
    station: j.station,
    method: j.method,
    items: j.items.map((it) => ({ ore: it.ore, rawScu: it.rawScu, yieldScu: it.yieldScu })),
    input_scu: j.input_scu,
    yield_scu: j.yield_scu,
    cost: j.cost,
    est_value: j.est_value,
    sold_value: j.sold_value,
    started_at: j.started_at,
    ready_at: j.ready_at,
    collected_at: j.collected_at,
    status: j.status,
    note: j.note,
  };
}

/**
 * Nimmt die Gast-Auftraege fuer die Uebernahme ins Konto aus der Ablage.
 * Erst nehmen, dann schreiben: ein zweiter Tab, der gleichzeitig angemeldet
 * laedt, findet die Ablage schon leer und legt nichts doppelt an. Schlaegt
 * das Schreiben ins Konto fehl, legt zurueckLegen() sie wieder hin.
 */
export function nimmGast(store: GastStore | null | undefined): RefineryJob[] {
  const jobs = ladeGast(store);
  if (jobs.length && store) {
    try { store.removeItem(GAST_KEY); } catch { return []; }
  }
  return jobs;
}

/**
 * Legt nicht uebernommene Auftraege zurueck, zu dem, was inzwischen dort
 * liegt. false: der Browser hat sie nicht wieder genommen (die Seite sagt das).
 */
export function zurueckLegen(store: GastStore | null | undefined, jobs: readonly RefineryJob[]): boolean {
  if (!jobs.length) return true;
  const jetzt = ladeGast(store);
  let id = naechsteGastId(jetzt);
  return speichereGast(store, [...jetzt, ...jobs.map((j) => ({ ...j, id: id++ }))]);
}
