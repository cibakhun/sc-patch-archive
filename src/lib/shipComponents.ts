// Bauteil-Steckplatzgroessen je Schiff (aus src/data/ship-components.json,
// generiert von scripts/datamine-ship-components.mjs). D-01: gefragt ist die
// maximale ItemPort.maxSize je Kategorie -- was ein Steckplatz AUFNEHMEN kann,
// nicht was ab Werk drinsteckt. D-07: diese Groessen werden NIRGENDS im UI
// angezeigt, nur zum Filtern verwendet -- compAttr liefert deshalb bewusst
// eine reine Filter-Kodierung, kein Anzeige-Format.
import compSnapshot from '../data/ship-components.json';

// Feste Kategorie-Reihenfolge: Waffe, Turm, Rakete, Schild, Kuehler,
// Kraftwerk, Quantenantrieb, Radar. Turm (t) ist Teil der Reihenfolge, auch
// wenn Plan 05-01 noch keine Turm-Ports befuellt (kommt in 05-02, D-06).
export const CAT_ORDER = 'wtmscpqr';
export type CatLetter = 'w' | 't' | 'm' | 's' | 'c' | 'p' | 'q' | 'r';

type ShipComponentEntry = Partial<Record<CatLetter, number>>;
type ShipComponentsSnapshot = { ships: Record<string, ShipComponentEntry> };

/**
 * Kompaktes Filter-Attribut fuer ein Schiff, z.B. "w3m2s1c1p1q1r1".
 *
 * Sentinel `-`: die id steht NICHT unter `ships` -- das Schiff hat keine
 * Steckplatz-Daten (D-08). Ein Schiff MIT Daten, aber ohne passende Kategorie,
 * liefert stattdessen den Platzhalter `_` (siehe Kommentar unten -- NICHT die
 * leere Zeichenkette). Die beiden Zustaende "keine Daten" und "Daten, aber
 * keine Kategorie" duerfen nicht auf denselben Attributwert fallen -- sonst
 * zaehlt der Ergebniszaehler aus D-08 falsch (er muesste "ohne Steckplatz-
 * Daten" melden, saehe aber optisch denselben Wert wie "hat Daten, trifft nur
 * keine Kategorie").
 */
export function compAttr(id: string): string {
  const ships = (compSnapshot as ShipComponentsSnapshot).ships;
  const entry = ships[id];
  if (!entry) return '-';
  let out = '';
  for (const letter of CAT_ORDER) {
    const size = entry[letter as CatLetter];
    if (size == null) continue;
    // Groesse ab 10 als grosses X kodiert (kein Wert im Datensatz liegt ueber
    // 10); echte Groesse 0 bleibt als Ziffer 0 erhalten -- S0-Ports zaehlen
    // damit weiterhin fuer "hat diese Kategorie ueberhaupt", sind aber ueber
    // das Groessenfeld nicht waehlbar (Dropdown beginnt bei S1, siehe D-10).
    out += letter + (size >= 10 ? 'X' : String(size));
  }
  // ASTRO-FALLE: ein leerer String als Attributwert wird von Astro OHNE das
  // "=" gerendert (bares Attribut `data-comp` statt `data-comp=""`) -- exakt
  // dasselbe Verhalten zeigt das bestehende `data-archive`-Attribut weiter
  // unten in dieser Datei bei `d.patches.length ? '1' : ''`. Im Browser macht
  // das keinen Unterschied (getAttribute liefert in beiden Faellen ""), aber
  // es waere aus dem rohen HTML-Text nicht mehr zuverlaessig von einem ganz
  // fehlenden Attribut zu unterscheiden. Ein harmloser Platzhalter, der KEIN
  // Kategorie-Muster trifft (parseComp("_") liefert weiterhin {}), erzwingt
  // die quotierte Form, ohne die Filterlogik zu veraendern.
  return out || '_';
}
