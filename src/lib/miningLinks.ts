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

// Dieser Join laeuft ueber den Namen — anders als bei Items ist das hier
// zulaessig, aber nur solange Mineral- und Ressourcennamen eindeutig sind.
// Gemessen 07.08.2026: 37 Minerale und 207 Crafting-Ressourcen, null Dubletten
// auf beiden Seiten. Rohstoffnamen sind im Spiel echte Bezeichner ("Titanium",
// "Lindinium"), keine Anzeigetexte, hinter denen mehrere Dinge stecken.
//
// Die Annahme wird hier GEPRUEFT statt vorausgesetzt: taucht je ein doppelter
// Name auf, bricht der Build laut ab, statt still den falschen Fundort zu
// verlinken. Das ist die Lehre aus den Item-Namen — siehe COLLIDING_NAMES in
// crafting.ts und `entity_guid`. Waere die Pruefung hier verletzt, ist der
// richtige Weg NICHT ein Alias, sondern ein Schluessel: `datamine-mining.mjs`
// kennt die Record-Id jedes Minerals (`elemByGuid`) und `datamine-crafting.mjs`
// die jeder Ressource — beide schreiben sie nur nicht heraus.
function assertEindeutig(namen: string[], quelle: string): void {
  const gesehen = new Set<string>();
  const doppelt = new Set<string>();
  for (const n of namen) {
    const k = n.toLowerCase();
    if (gesehen.has(k)) doppelt.add(k);
    gesehen.add(k);
  }
  if (doppelt.size) {
    throw new Error(
      `miningLinks: ${quelle} fuehrt ${doppelt.size} doppelte Namen — der Join ueber den Namen raet dort still. ` +
      `Betroffen: ${[...doppelt].join(', ')}. Fix ist ein Schluessel (Record-Id), kein Alias.`,
    );
  }
}
assertEindeutig(MINE.minerals.map((m) => m.name), 'assets/mining-db.json (minerals)');
assertEindeutig(CRAFT.resources.map((r) => r.name), 'assets/crafting-db.json (resources)');

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
