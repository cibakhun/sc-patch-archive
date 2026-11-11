// Fahrzeug-Item <-> Schiffsdatenblatt (09.11.2026, Skizze 016).
//
// Der Item-Katalog fuehrt Schiffe und Bodenfahrzeuge auch als Items
// (Kategorie "Vehicle", 169 mit eigenem Datenblatt), weil sie im Spiel an
// Terminals verkauft werden. Bis hierher wusste keine der beiden Seiten von
// der anderen: die Suche zeigte "Gladius" zweimal, und vom Item-Datenblatt
// fuehrte kein Weg zum Schiff.
//
// Zuordnung ueber den Namen, Gross/Klein und Satzzeichen egal — gemessen
// 09.11.2026 treffen alle 169 Fahrzeug-Items mit Datenblatt genau ein Schiff.
// Ein Name, den zwei Fahrzeuge teilen, ordnet nichts zu: lieber kein Link
// als der falsche.
import { getCollection } from 'astro:content';
import type { Item } from './items';

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

let byName: Promise<Map<string, string | null>> | null = null;
function shipIdsByName(): Promise<Map<string, string | null>> {
  byName ??= getCollection('vehicles').then((vs) => {
    const m = new Map<string, string | null>();
    for (const v of vs) {
      const k = key(v.data.name);
      m.set(k, m.has(k) ? null : v.id);
    }
    return m;
  });
  return byName;
}

/** Schiffs-id (/schiffe/<id>.html) zu einem Fahrzeug-Item — oder null. */
export async function shipIdForVehicleItem(it: Item): Promise<string | null> {
  if (it.category !== 'Vehicle') return null;
  return (await shipIdsByName()).get(key(it.name)) ?? null;
}
