// Stempel von Hand gepflegter Datenbestaende.
//
// Ein Handbestand (z. B. assets/wikelo-curated.json) traegt seinen Stand im
// Feld `stand` direkt neben den Werten: `art` ("patch" mit `patch: "X.Y.Z"`,
// oder "X.Y", wenn die Quelle den Patch nicht genauer nennt,
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

/** Form eines Patch-Stempels: X.Y.Z, oder X.Y, wenn die Quelle nicht genauer ist. */
export const PATCH_MUSTER = /^\d+\.\d+(?:\.\d+)?$/;

/** Die Handbestaende der Site: Datei und wo sie sich zeigen. */
export const HANDBESTAENDE = [
  { datei: 'assets/refinery-methods.json', art: 'patch', zeigt: 'Refinery (Bewertung der Raffinationsmethoden)' },
  { datei: 'assets/wikelo-curated.json', art: 'datum', zeigt: 'Wikelo-Seite (Bilder, Ausstattung und Hinweise je Tausch)' },
  { datei: 'assets/aaron-halo-bands.json', art: 'patch', zeigt: 'Precision Jump (Dichtebaender des Aaron Halo)' },
];
