/* Wie ersetze.mjs, aber Suche und Ersatz stehen in REINEN TEXTDATEIEN.
   ⚠⚠ Grund: der JSON-Auftrag von ersetze.mjs scheitert an jedem Backslash
   im Ersatztext — ein Regex wie /rgba\(.*\)/ ist in JSON ein ungueltiges
   Escape, und das ist am 31.08.2026 dreimal passiert. Der Heredoc der
   Git-Bash frisst zusaetzlich JEDEN doppelten Backslash. Mit zwei
   Textdateien gibt es weder das eine noch das andere Problem.

   Ein abschliessender Zeilenumbruch der beiden Dateien wird ignoriert.

   node …/ersetze2.mjs <zieldatei> <suche.txt> <ersatz.txt>               */
import { readFileSync, writeFileSync } from 'node:fs';
const [ziel, sDat, eDat] = process.argv.slice(2);
const ohneEnde = (s) => s.replace(/\r?\n$/, '');
const roh = readFileSync(ziel, 'utf8');
const crlf = /\r\n/.test(roh);
const flach = roh.replace(/\r\n/g, '\n');
const suche = ohneEnde(readFileSync(sDat, 'utf8').replace(/\r\n/g, '\n'));
const ersatz = ohneEnde(readFileSync(eDat, 'utf8').replace(/\r\n/g, '\n'));
const n = flach.split(suche).length - 1;
if (n !== 1) { console.error(`FEHLER ${ziel}: Suchtext ${n}x gefunden, erwartet 1x`); process.exit(1); }
const neu = flach.replace(suche, () => ersatz);
writeFileSync(ziel, crlf ? neu.replace(/\n/g, '\r\n') : neu, 'utf8');
console.log(`  ok ${ziel}  (${crlf ? 'CRLF' : 'LF'} erhalten)`);
