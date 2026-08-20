/* ============================================================
   verify-windows.mjs — Schiene A: bleibt .planning/WINDOWS.md fuer
   `gsd-tools` lesbar?

   Anlass, dreimal an EINEM Tag bezahlt (20.08.2026): das Register war
   dreimal unlesbar, jedes Mal aus einem anderen Grund, jedes Mal von Hand
   repariert — und jedes Mal kam es zurueck. Die Fehler sind heimtueckisch,
   weil die Datei dabei voellig normal aussieht: jede Zeile richtig, jede
   Tabelle gerade, nur eben ein Wert, den der Parser nicht kennt, oder ein
   \r am Zeilenende. Wer sie liest, sieht nichts; wer sie oeffnet, bekommt
   eine Ausnahme und damit gar keine Eintraege.

     1. `kind: sight` — kein gueltiger Wert (gsd-core kennt acht, dieser ist
        keiner davon). Erst EIN Eintrag, spaeter sieben aus einer
        Parallelsitzung.
     2. CRLF — `parseLedger` bricht am angehaengten \r der Frontmatter ab.
        Dauerhaft abgestellt per .gitattributes; diese Pruefung bemerkt es
        trotzdem, falls die Regel je verlorengeht.
     3. `reason: null` statt '' — description/reason muessen Zeichenketten
        sein.

   Diese Pruefung tut GENAU EINES: sie laesst gsd-cores eigenen Parser ueber
   die Datei laufen. Keine zweite, nachgebaute Auslegung dessen, was gueltig
   ist — die liefe irgendwann auseinander und wuerde gruen melden, waehrend
   das echte Werkzeug scheitert. Ist der Parser da, entscheidet er; fehlt er
   (fremder Rechner ohne gsd-core), faellt die Pruefung auf die drei
   Muster oben zurueck und sagt das ausdruecklich.

   Bewusst KEIN Netz, kein git, kein Kindprozess — Schiene A.
   ============================================================ */
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { homedir } from 'node:os';

const LEDGER = '.planning/WINDOWS.md';
let ok = true;
const fail = (msg) => { ok = false; console.error(`  FEHLER: ${msg}`); };

console.log('\n=== verify-windows: ist das Fenster-Register maschinell lesbar? ===');

if (!existsSync(LEDGER)) {
  // Kein Register ist kein Fehler — nicht jedes Projekt fuehrt eines.
  console.log(`${LEDGER} existiert nicht — nichts zu pruefen.`);
  process.exit(0);
}

const raw = readFileSync(LEDGER, 'utf8');
console.log(`Datei: ${LEDGER}   ${raw.length} Zeichen, ${raw.split('\n').length} Zeilen`);

/* ---------- 1. Der echte Parser, wenn er erreichbar ist ---------- */
const require = createRequire(import.meta.url);
const KANDIDATEN = [
  join(homedir(), '.claude', 'gsd-core', 'bin', 'lib', 'broken-windows.cjs'),
];
const parserPfad = KANDIDATEN.find((p) => existsSync(p));

let eintraege = null;
if (parserPfad) {
  try {
    const bw = require(parserPfad);
    const led = bw.parseLedger(raw);
    eintraege = led.entries.length;
    console.log(`\n[1] gsd-cores eigener Parser`);
    console.log(`    parseLedger() gelesen — Soll: ohne Ausnahme   Ist: ${eintraege} Eintraege`);
    const kinds = [...new Set(led.entries.map((e) => e.kind))].sort();
    console.log(`    verwendete kind-Werte: ${kinds.join(', ')}`);
    console.log(`    erlaubt laut gsd-core : ${bw.KINDS.join(', ')}`);
  } catch (e) {
    console.log(`\n[1] gsd-cores eigener Parser`);
    fail(`parseLedger() wirft: ${String(e.message).slice(0, 200)}`);
    console.error('         Das Register ist damit fuer `gsd-tools windows` unbrauchbar —');
    console.error('         nicht teilweise, sondern vollstaendig: der Parser liefert dann');
    console.error('         GAR KEINE Eintraege, nicht die uebrigen.');
  }
} else {
  console.log('\n[1] gsd-cores Parser nicht gefunden — Rueckfall auf Mustererkennung.');
  console.log(`    gesucht: ${KANDIDATEN.join(', ')}`);
}

/* ---------- 2. Die drei bekannten Muster, immer ---------- */
// Auch wenn der Parser gruen war: er sagt nur "heute lesbar". Diese drei
// haben je einmal zugeschlagen und sind billig zu pruefen.
console.log('\n[2] Die drei Muster, die es schon zerlegt haben');

const crCount = (raw.match(/\r/g) || []).length;
console.log(`    \\r im Text (CRLF) — Soll: 0   Ist: ${crCount}`);
if (crCount > 0)
  fail(`${crCount} Wagenruecklaeufe im Register — parseLedger bricht an der Frontmatter ab. ` +
       'Ursache ist core.autocrlf=true ohne Regel in .gitattributes.');

const sightCount = (raw.match(/"kind":\s*"sight"/g) || []).length;
console.log(`    kind "sight" — Soll: 0   Ist: ${sightCount}`);
if (sightCount > 0)
  fail(`${sightCount}x kind "sight" — kein gueltiger Wert. Gemeint ist "unrun-verify" ` +
       '(ein menschliches Sichturteil, das noch aussteht).');

const nullText = (raw.match(/"(description|reason)":\s*null/g) || []).length;
console.log(`    description/reason null — Soll: 0   Ist: ${nullText}`);
if (nullText > 0)
  fail(`${nullText}x null statt Zeichenkette bei description/reason — validateEntryShape weist das ab. ` +
       "Leer ist '', nicht null.");

/* ---------- 3. Selbstauskunft (Grundsatz 2) ---------- */
// Ein Waechter, der nicht sagt, WIE VIEL er geprueft hat, ist von einem
// leerlaufenden nicht zu unterscheiden.
const MIN_EINTRAEGE = 1;
if (eintraege !== null) {
  console.log(`\n[3] Selbstauskunft`);
  console.log(`    geprueft: ${eintraege} Eintraege — Untergrenze: ${MIN_EINTRAEGE}`);
  if (eintraege < MIN_EINTRAEGE)
    fail(`nur ${eintraege} Eintraege gelesen — Ursache klaeren, nicht die Untergrenze senken`);
}

console.log('');
if (!ok) {
  console.error('verify-windows: REGISTER UNLESBAR ✗');
  process.exit(1);
}
console.log('verify-windows: Register lesbar ✓\n');
