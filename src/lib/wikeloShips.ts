// Wikelo-Tausche, die ein Schiff liefern, und ihre Schiffsseiten. Die
// Wikelo-Seite verweist von der Belohnung aufs Datenblatt, das Datenblatt
// zurueck auf Wikelo (Vernetzung in beide Richtungen).
//
// Zuordnung zuerst ueber die Klasse der Belohnung (cls, aus datamine-wikelo),
// wenn der Katalog sie fuehrt: ATLS ueber die Liste der Power Suits, sonst wie
// der Fahrzeug-Katalog seine Ids bildet (Gold-Standard ohne -gs). Die meisten
// Schiffe gibt Wikelo als eigene Collector-Fassung (ANVL_Asgard_Collector_
// Military), die keine Katalogseite hat; dann zaehlt der Name wie im Katalog,
// mit oder ohne Hersteller, und nur wenn er eindeutig ist. "ATLS GEO" steht bei
// zwei Tauschen, die laut Klasse ATLS Snowland Color und ATLS Orange Line
// liefern, nicht den ATLS GEO.
import TRADES from '../../assets/wikelo-trades.json';
import vehiclesSnapshot from '../data/vehicles.json';
import { POWER_SUITS } from '../../scripts/lib/power-suits.mjs';

type Tausch = { name: string; get?: string; cls?: string };
const belohnung = (t: Tausch) => t.get ?? t.name;

const schiffNachName = new Map<string, string>();
for (const v of (vehiclesSnapshot as { vehicles: { id: string; name: string; manufacturer: string | null; makerCode: string | null }[] }).vehicles) {
  for (const n of [v.name, `${(v.manufacturer ?? '').split(' ')[0]} ${v.name}`, `${v.makerCode ?? ''} ${v.name}`]) schiffNachName.set(n.trim().toLowerCase(), v.id);
}
const KATALOG = new Set((vehiclesSnapshot as { vehicles: { id: string }[] }).vehicles.map((v) => v.id));
const POWER_SUIT_ID = new Map(Object.entries(POWER_SUITS).map(([id, cls]) => [cls.toLowerCase(), id]));
function schiffZurKlasse(cls: string): string | null {
  const k = cls.toLowerCase();
  const ps = POWER_SUIT_ID.get(k);
  if (ps) return ps;
  const id = k.replace(/_/g, '-');
  if (KATALOG.has(id)) return id;
  const ohneGs = id.replace(/-gs$/, '');
  return KATALOG.has(ohneGs) ? ohneGs : null;
}

const zahl = new Map<string, number>();
for (const t of TRADES as Tausch[]) zahl.set(belohnung(t), (zahl.get(belohnung(t)) ?? 0) + 1);

/** Fahrzeug-Id zur Belohnung eines Tauschs, oder null (kein Schiff oder Name mehrdeutig). */
export function schiffZurBelohnung(name: string, cls?: string): string | null {
  const perKlasse = cls ? schiffZurKlasse(cls) : null;
  if (perKlasse) return perKlasse;
  if ((zahl.get(name) ?? 0) > 1) return null;
  return schiffNachName.get(name.replace(/["“”]/g, '').trim().toLowerCase()) ?? null;
}

const SCHIFFE_BEI_WIKELO = new Set(
  (TRADES as Tausch[]).map((t) => schiffZurBelohnung(belohnung(t), t.cls)).filter((x): x is string => !!x),
);

/** Liefert ein Wikelo-Tausch dieses Fahrzeug? */
export const beiWikelo = (id: string): boolean => SCHIFFE_BEI_WIKELO.has(id);
