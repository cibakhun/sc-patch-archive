// Brücke Crafting-Material <-> Mineral der Mining-Datenbank.
//
// Die Rezepte nennen ihre Zutaten beim Spielnamen ("Titanium", "Lindinium"),
// die Mining-DB führt dieselben Namen als Mineral mit Fundorten. Bisher musste
// man den Namen von Hand in die Mining-Suche tippen — diese Schicht macht aus
// jedem Materialnamen einen Deep-Link auf das Mineral-Datenblatt und zurück.
//
// Beide Kataloge kommen aus denselben Spieldaten, deshalb decken sich 35 der 37
// Materialnamen exakt. Nur zwei tragen im Rezept die veredelte bzw. präzisierte
// Form (siehe ALIASES); "Yormandi Eye" hat gar kein Mineral — dort entsteht
// bewusst kein Link, statt auf eine falsche Seite zu zeigen.

import MINE from '../../assets/mining-db.json';
import CRAFT from '../../assets/crafting-db.json';
import { href, type Locale } from '../i18n/ui';

/** Rezept-Name -> Mineral-Name, wo beide auseinanderlaufen. */
const ALIASES: Record<string, string> = {
  // Rezepte verlangen die veredelte Form; abgebaut wird das rohe "Ice".
  'pressurized ice': 'Ice',
  // Rezept präzisiert den Aggregatzustand, das Mineral heißt schlicht so.
  'saldynium (ore)': 'Saldynium',
};

const mineralNames = new Map<string, string>();
for (const m of MINE.minerals) mineralNames.set(m.name.toLowerCase(), m.name);

/**
 * Materialname (klein) -> Mineral-Anzeigename. Enthält die Alias-Schlüssel mit,
 * damit ein einziger Lookup reicht — auch im Client-JS (window.__CRAFT.mine).
 */
export const mineralByMaterial: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [key, name] of mineralNames) out[key] = name;
  for (const [key, target] of Object.entries(ALIASES)) {
    const real = mineralNames.get(target.toLowerCase());
    if (real) out[key] = real;
  }
  return out;
})();

/**
 * Materialname (Originalschreibweise) -> Zahl der Blueprints, die es verlangen.
 *
 * Selbst gezaehlt statt `resources[].used_in_blueprints` uebernommen: das Feld
 * zaehlt SLOT-Vorkommen, und 8 Materialien stecken in manchen Rezepten in zwei
 * Slots (Iron 248 statt 228, Riccite 96 statt 84). Die Zahl steht als
 * "Wird in N Blueprints gebraucht" neben einem Link, der genau diese Liste
 * filtert — sie muss also dasselbe zaehlen wie der Filter: DISTINKTE Rezepte.
 */
export const usedIn: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  for (const b of CRAFT.blueprints) {
    const seen = new Set<string>();
    for (const ing of b.ingredients ?? [])
      for (const o of ing.options ?? []) if (o.name) seen.add(o.name);
    for (const name of seen) out[name] = (out[name] ?? 0) + 1;
  }
  return out;
})();

/** Gegenrichtung: Mineral -> Materialname, wie ihn der Crafting-Filter kennt. */
export const materialByMineral: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const r of CRAFT.resources) {
    const mineral = mineralByMaterial[r.name.toLowerCase()];
    if (!mineral) continue;
    // Bei Dubletten (z. B. "Raw Ice" und "Pressurized Ice" zeigen beide auf
    // "Ice") gewinnt das Material, das tatsächlich in Rezepten steckt.
    const cur = out[mineral];
    if (!cur || (usedIn[r.name] ?? 0) > (usedIn[cur] ?? 0)) out[mineral] = r.name;
  }
  return out;
})();

/** Wie viele Blueprints dieses Mineral (unter seinem Rezept-Namen) brauchen. */
export const blueprintsPerMineral: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  for (const [mineral, material] of Object.entries(materialByMineral)) {
    const n = usedIn[material] ?? 0;
    if (n > 0) out[mineral] = n;
  }
  return out;
})();

export const miningPath = '/topics/mining.html';
export const craftingPath = '/topics/crafting.html';

/** Mineral zu einem Rezept-Material — oder null, wenn es keins gibt. */
export function mineralFor(material: string): string | null {
  return mineralByMaterial[String(material ?? '').trim().toLowerCase()] ?? null;
}

/** Deep-Link auf das Mineral-Datenblatt ("wo baue ich das ab?"). */
export function miningLink(material: string, lang: Locale): string | null {
  const mineral = mineralFor(material);
  if (!mineral) return null;
  return `${href(miningPath, lang)}?mineral=${encodeURIComponent(mineral)}#db`;
}
