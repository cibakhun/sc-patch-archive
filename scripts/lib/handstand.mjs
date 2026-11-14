import { createHash } from 'node:crypto';

const sortiert = (v) => (Array.isArray(v)
  ? v.map(sortiert)
  : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortiert(v[k])]))
    : v);

export function pruefsumme(daten) {
  const { stand: _stand, ...werte } = daten;
  return createHash('sha256').update(JSON.stringify(sortiert(werte))).digest('hex').slice(0, 16);
}

export const PATCH_MUSTER = /^\d+\.\d+(?:\.\d+)?$/;

export const HANDBESTAENDE = [
  { datei: 'assets/wikelo-curated.json', art: 'datum', zeigt: 'Wikelo-Seite (Bilder, Ausstattung und Hinweise je Tausch)' },
  { datei: 'assets/aaron-halo-bands.json', art: 'patch', zeigt: 'Precision Jump (Dichtebaender des Aaron Halo)' },
];
