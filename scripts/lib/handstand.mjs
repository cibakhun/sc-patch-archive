// Stempel von Hand gepflegter Datenbestaende.
//
// Ein Handbestand (z. B. assets/wikelo-curated.json) traegt seinen Stand im
// Feld `stand` direkt neben den Werten: `art` ("patch" mit `patch: "X.Y.Z"`
// oder "datum" mit `geaendert: "YYYY-MM-DD"`) und `pruefsumme`, eine SHA-256
// ueber alle uebrigen Felder. Die Seite liest nur diesen Stempel.
// verify:datastand rechnet die Pruefsumme nach: aendern sich die Werte ohne
// neuen Stempel (oder der Stempel ohne die Werte), reisst das Tor.
// Geschrieben wird der Stempel nur von scripts/stempel-hand.mjs.
import { createHash } from 'node:crypto';

const sortiert = (v) => (Array.isArray(v)
  ? v.map(sortiert)
  : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortiert(v[k])]))
    : v);

/** SHA-256 ueber alle Felder ausser `stand`, unabhaengig von der Schluesselreihenfolge. */
export function pruefsumme(daten) {
  const { stand: _stand, ...werte } = daten;
  return createHash('sha256').update(JSON.stringify(sortiert(werte))).digest('hex').slice(0, 16);
}

/** Die Handbestaende der Site: Datei und wo sie sich zeigen. */
export const HANDBESTAENDE = [
  { datei: 'assets/refinery-methods.json', art: 'patch', zeigt: 'Refinery (Bewertung der Raffinationsmethoden)' },
];
