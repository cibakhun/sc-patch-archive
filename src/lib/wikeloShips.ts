// Wikelo-Tausche, die ein Schiff liefern, und ihre Schiffsseiten. Die
// Wikelo-Seite verweist von der Belohnung aufs Datenblatt, das Datenblatt
// zurueck auf Wikelo (Vernetzung in beide Richtungen).
//
// Zuordnung ueber den Namen der Belohnung, wie im Katalog mit oder ohne
// Hersteller ("Argo ATLS IKTI" = ATLS IKTI). Nur eindeutige Namen: "ATLS GEO"
// steht bei zwei Tauschen, einer davon liefert laut Spiel die Lackierung
// "Orange Line" (eigene Seite) — ein Namensvergleich traefe dort die falsche
// Seite. Belastbar waere die Item-Klasse der Belohnung; die fuehrt
// assets/wikelo-trades.json bisher nicht.
import TRADES from '../../assets/wikelo-trades.json';
import vehiclesSnapshot from '../data/vehicles.json';

type Tausch = { name: string; get?: string };
const belohnung = (t: Tausch) => t.get ?? t.name;

const schiffNachName = new Map<string, string>();
for (const v of (vehiclesSnapshot as { vehicles: { id: string; name: string; manufacturer: string | null; makerCode: string | null }[] }).vehicles) {
  for (const n of [v.name, `${(v.manufacturer ?? '').split(' ')[0]} ${v.name}`, `${v.makerCode ?? ''} ${v.name}`]) schiffNachName.set(n.trim().toLowerCase(), v.id);
}
const zahl = new Map<string, number>();
for (const t of TRADES as Tausch[]) zahl.set(belohnung(t), (zahl.get(belohnung(t)) ?? 0) + 1);

/** Fahrzeug-Id zur Belohnung eines Tauschs, oder null (kein Schiff oder Name mehrdeutig). */
export function schiffZurBelohnung(name: string): string | null {
  if ((zahl.get(name) ?? 0) > 1) return null;
  return schiffNachName.get(name.replace(/["“”]/g, '').trim().toLowerCase()) ?? null;
}

const SCHIFFE_BEI_WIKELO = new Set(
  (TRADES as Tausch[]).map((t) => schiffZurBelohnung(belohnung(t))).filter((x): x is string => !!x),
);

/** Liefert ein Wikelo-Tausch dieses Fahrzeug? */
export const beiWikelo = (id: string): boolean => SCHIFFE_BEI_WIKELO.has(id);
