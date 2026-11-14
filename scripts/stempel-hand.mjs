// Schreibt den Stempel eines Handbestands neu (scripts/lib/handstand.mjs).
//
//   node scripts/stempel-hand.mjs <datei> --geaendert YYYY-MM-DD   (Art "datum")
//   node scripts/stempel-hand.mjs <datei> --patch X.Y.Z            (Art "patch")
//
// Der Stand wird immer ausdruecklich genannt: das Skript leitet ihn nicht aus
// dem heutigen Datum oder der installierten Spielversion ab, weil nur der
// Mensch weiss, gegen welchen Stand er die Werte geprueft hat.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pruefsumme, HANDBESTAENDE } from './lib/handstand.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [datei, schalter, wert] = process.argv.slice(2);
const eintrag = HANDBESTAENDE.find((h) => h.datei === datei);
if (!eintrag) { console.error(`stempel-hand: ${datei} ist kein Handbestand (${HANDBESTAENDE.map((h) => h.datei).join(', ')})`); process.exit(2); }
const soll = eintrag.art === 'datum' ? '--geaendert' : '--patch';
const muster = eintrag.art === 'datum' ? /^\d{4}-\d{2}-\d{2}$/ : /^\d+\.\d+\.\d+$/;
if (schalter !== soll || !muster.test(wert ?? '')) { console.error(`stempel-hand: ${datei} braucht ${soll} ${eintrag.art === 'datum' ? 'YYYY-MM-DD' : 'X.Y.Z'}`); process.exit(2); }

const pfad = resolve(ROOT, datei);
const roh = readFileSync(pfad, 'utf8');
const daten = JSON.parse(roh);
const stand = eintrag.art === 'datum'
  ? { art: 'datum', geaendert: wert, pruefsumme: pruefsumme(daten) }
  : { art: 'patch', patch: wert, pruefsumme: pruefsumme(daten) };
const neu = { stand, ...Object.fromEntries(Object.entries(daten).filter(([k]) => k !== 'stand')) };
const einzug = /\n( +)"/.exec(roh)?.[1].length ?? 2;
writeFileSync(pfad, JSON.stringify(neu, null, einzug) + '\n');
console.log(`stempel-hand: ${datei} → ${JSON.stringify(stand)}`);
