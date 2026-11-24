// shipQuerwege.ts — Wege vom Schiffsdatenblatt zu den anderen Datenarten
// (UX-Audit 24.11.2026, Paket E, Punkt E5; Befunde IA V6/V16/C5, TF C11).
//
// Was hier steht, sind nur Beziehungen, die im Datenbestand wirklich stecken —
// geraten wird nichts. Nachgemessen am 24.11.2026:
//   Fahrzeug-Itemblatt   230 von 235 Schiffen tragen genau denselben Namen wie
//                        ein Item der Kategorie "Vehicle" (keins doppelt); die
//                        fuenf ohne Treffer bekommen keinen Link.
//   Wikelo               jedes Schiff, das beiWikelo() kennt; der Link traegt
//                        den Namen der Belohnung (?item=), die Seite hebt den
//                        Tausch dann hervor.
//   Missionen            nur Auftraege, deren Titel der Schiffsname ist (drei
//                        ATLS-Lackierungen von Wikelo). Belohnungen in Schiffen
//                        kennen die Missionsdaten sonst nicht.
//
// Schiffsblatt und Fahrzeug-Itemblatt sind gleichrangig (Krisz 24.11.2026,
// Entscheidung D9): kein Canonical, nur Links in beide Richtungen. Den Weg vom
// Itemblatt zurueck baut Paket D.
import TRADES from '../../assets/wikelo-trades.json';
import { pageItems, itemPath, type Item } from './items';
import { missions } from './missions';
import { schiffZurBelohnung } from './wikeloShips';

const norm = (s: string) => s.toLowerCase().replace(/["“”]/g, '').replace(/\s+/g, ' ').trim();

/* ---------- Fahrzeug-Itemblatt ---------- */
const fahrzeugeNachName = new Map<string, Item[]>();
for (const it of pageItems) {
  if (it.category !== 'Vehicle') continue;
  const k = norm(it.name);
  const list = fahrzeugeNachName.get(k);
  if (list) list.push(it);
  else fahrzeugeNachName.set(k, [it]);
}

/** Das Item-Datenblatt desselben Schiffs — nur bei genau einem Treffer. */
export function fahrzeugItem(name: string): { name: string; path: string } | null {
  const hits = fahrzeugeNachName.get(norm(name));
  return hits && hits.length === 1 ? { name: hits[0].name, path: itemPath(hits[0]) } : null;
}

/* ---------- Wikelo ---------- */
type Tausch = { name: string; get?: string; cls?: string };
const belohnungNachSchiff = new Map<string, string>();
for (const t of TRADES as Tausch[]) {
  const name = t.get ?? t.name;
  const id = schiffZurBelohnung(name, t.cls);
  if (id && !belohnungNachSchiff.has(id)) belohnungNachSchiff.set(id, name);
}

/** Name der Wikelo-Belohnung, unter dem die Seite den Tausch hervorhebt. */
export const wikeloBelohnung = (id: string): string | null => belohnungNachSchiff.get(id) ?? null;

/* ---------- Missionen ---------- */
const auftraegeNachTitel = new Map<string, { slug: string; title: string }[]>();
for (const m of missions) {
  const k = norm(m.title);
  const list = auftraegeNachTitel.get(k);
  const e = { slug: m.slug, title: m.title };
  if (list) list.push(e);
  else auftraegeNachTitel.set(k, [e]);
}

/** Auftraege, deren Titel genau der Schiffsname ist. */
export const schiffsAuftraege = (name: string): { slug: string; title: string }[] =>
  auftraegeNachTitel.get(norm(name)) ?? [];
