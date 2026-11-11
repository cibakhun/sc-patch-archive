// apply-loot-fundorte.mjs — bestaetigte Fundorte in die Item-Datenbank tragen.
//
// Liest src/data/loot-fundorte.json (Datenlauf datamine:loot, PC) und die
// kuratierten Ortsarten aus scripts/lib/loot-orte.mjs und schreibt
// assets/universal-items.json neu: Kopf `fundorte`, je Item `fund`, dazu die
// Kennzahlen withObtain/catalogOnly/withFundort. Idempotent — vorhandene
// Eintraege werden erst entfernt. Braucht weder p4k noch Netz, laeuft also
// auch in der Cloud, z. B. nach einer Umbenennung in loot-orte.mjs.
//
// Haengt hinter jedem Lauf, der die Datenbank neu baut (sync:items,
// sync:item-prices) und hinter datamine:loot. verify:loot-fundorte prueft,
// dass die Datenbank auf dem Stand dieser Rechnung ist.
//
// Aufruf: npm run apply:loot-fundorte
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wendeFundorteAn } from './lib/loot-orte.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DB = resolve(ROOT, 'assets', 'universal-items.json');
const FD = resolve(ROOT, 'src', 'data', 'loot-fundorte.json');

const db = JSON.parse(readFileSync(DB, 'utf8'));
const fd = JSON.parse(readFileSync(FD, 'utf8'));
const z = wendeFundorteAn(db, fd);
// kompakt wie build-universal-db.mjs (kein Pretty-Print)
writeFileSync(DB, JSON.stringify(db));
console.log(`OK: ${DB}`);
console.log(`Fundorte ${fd.meta.patch}: ${z.items} Items mit bestaetigtem Fundort, ${z.zeilen} Zeilen, ${z.profile} Profile, ${z.arten} Ortsarten` +
  ` (${z.gesperrt} Items laut Spiel nicht als Loot, ${z.nurVersteckt} nur in versteckten Belegungen)`);
