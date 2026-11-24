/* ============================================================
   run-e2e.mjs — faehrt die e2e-Suite (jede .test.js unter tests/e2e/) und zaehlt
   dabei selbst, statt dem Exit-Code von `node --test` zu glauben.

   WARUM: node:test zaehlt eine Suite, deren eigener Rumpf wirft, nicht als
   Fehler. Ein describe(), das beim Laden abbricht (synchron oder async),
   steht in der Ausgabe als "not ok", in der Bilanz aber als "# fail 0", und
   der Exit-Code ist 0. Am 24.11.2026 lief so die Suite "Vergleich: Daten
   aus dem einen Kennwert-Verzeichnis" (tests/e2e/schiff-vergleich.test.js)
   nicht mehr: ihr esbuild-Buendel brach beim Import ab, sieben Tests fielen
   still weg, und test:e2e wie das Tor blieben gruen. Nachgemessen mit
   Node 22: eine Datei, die beim Import wirft, und ein Haken, der wirft,
   faerbt node selbst rot; eine Suite, die selbst wirft, auf keiner Ebene.

   Deshalb zaehlt hier jeder Fehlschlag, gleich welcher Art (Test, Suite,
   ganze Datei), ausser todo. Eine Suite, die nur wegen roter Tests rot ist,
   zaehlt nicht doppelt; die Tests darin zaehlen selbst.

   Selbstauskunft (Grundsatz 2): Dateien, Suiten, bestandene Tests, Rote,
   davon Suiten mit eigenem Abbruch. Klinken: Dateien und bestandene Tests.

   Vorgefuehrt rot (24.11.2026) am Stand vor der Reparatur in
   src/lib/hangar/layouts.ts (staging 01e1b0f9):
     FEHLER  tests/e2e/schiff-vergleich.test.js:100  "Vergleich: Daten aus
     dem einen Kennwert-Verzeichnis": Suite brach selbst ab, beim Laden oder
     in ihrem Rumpf; ihre Tests liefen nicht (...) — (intermediate
     value).glob is not a function
   node --test meldete an derselben Stelle "# fail 0" und Exit 0. Dazu je
   eine Probedatei mit synchron und async werfender Suite, verschachtelt
   werfender Suite, werfendem before() und Wurf beim Import: alle fuenf
   Faelle rot. Die Klinken: mit Untergrenzen 86 Dateien und 1500 Tests je
   ein eigener FEHLER.

       node scripts/run-e2e.mjs                         alle Dateien
       node scripts/run-e2e.mjs tests/e2e/x.test.js     nur diese (Diagnose,
                                                        ohne Klinken)
   ============================================================ */
import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import { readdirSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = resolve(ROOT, 'tests/e2e');

// Untergrenzen. Duerfen nur nach OBEN wandern; nach unten nur per Commit,
// dessen Botschaft die Ursache nennt (Grundsatz 5).
// Stand 24.11.2026: 85 Testdateien, 1433 bestandene Tests (gegen einen
// frischen Bau). Die Dateien sind exakt geklinkt. Die Tests mit Abstand:
// ein Teil entsteht je Item, Schiff oder Rezept aus den Daten, und ein
// Datenlauf darf ihre Zahl leicht bewegen, ohne das Tor zu reissen. Die
// Klinke faengt das Wegbrechen ganzer Suiten, nicht einzelne Tests.
const MIN_DATEIEN = 85;
const MIN_TESTS = 1400;

const args = process.argv.slice(2);
const AUSWAHL = args.length > 0;
const dateien = AUSWAHL
  ? args.map((a) => resolve(ROOT, a))
  : readdirSync(DIR, { recursive: true })
      .filter((f) => f.endsWith('.test.js'))
      .map((f) => resolve(DIR, f))
      .sort();

// Die Tests lesen Pfade relativ zum Projektordner (wie unter npm).
process.chdir(ROOT);

const zahl = { suiten: 0, tests: 0, uebersprungen: 0, todo: 0 };
const rot = [];
const stream = run({ files: dateien, concurrency: true });

stream.on('test:pass', (d) => {
  if (d.details?.type === 'suite') zahl.suiten++;
  else if (d.skip) zahl.uebersprungen++;
  else if (d.todo) zahl.todo++;
  else zahl.tests++;
});
stream.on('test:fail', (d) => {
  const suite = d.details?.type === 'suite';
  if (suite) zahl.suiten++;
  if (d.todo) { zahl.todo++; return; }
  const err = d.details?.error;
  const typ = err?.failureType ?? '?';
  // Rot nur, weil Tests darin rot sind: die zaehlen selbst.
  if (suite && typ === 'subtestsFailed') return;
  rot.push({
    art: suite ? 'Suite' : 'Test',
    name: d.name,
    ort: d.file ? `${relative(ROOT, d.file).replaceAll('\\', '/')}${d.line ? `:${d.line}` : ''}` : '?',
    typ,
    meldung: String(err?.cause?.message ?? err?.message ?? '').split('\n')[0].slice(0, 200),
  });
});

const ausgabe = stream.compose(spec);
ausgabe.pipe(process.stdout);
await new Promise((ok, fehler) => {
  ausgabe.on('end', ok);
  ausgabe.on('error', fehler);
});

/* ---------- Selbstauskunft ---------- */
const abbrueche = rot.filter((r) => r.art === 'Suite' && r.typ === 'testCodeFailure');
console.log('\n=== test:e2e — Selbstauskunft (scripts/run-e2e.mjs) ===');
console.log(`  Dateien: ${dateien.length}${AUSWAHL ? ' (Auswahl, ohne Klinken)' : `   Untergrenze ${MIN_DATEIEN}`}`);
console.log(`  Suiten: ${zahl.suiten}   Tests bestanden: ${zahl.tests}${AUSWAHL ? '' : `   Untergrenze ${MIN_TESTS}`}`);
if (zahl.uebersprungen || zahl.todo) console.log(`  uebersprungen: ${zahl.uebersprungen}   todo: ${zahl.todo}`);
console.log(`  Rot: ${rot.length}   davon Suiten mit eigenem Abbruch: ${abbrueche.length}`);

const fehler = [];
if (!AUSWAHL) {
  if (dateien.length < MIN_DATEIEN)
    fehler.push(`nur ${dateien.length} Testdateien unter tests/e2e/, Untergrenze ${MIN_DATEIEN} — Ursache klaeren, nicht die Untergrenze senken`);
  if (zahl.tests < MIN_TESTS)
    fehler.push(`nur ${zahl.tests} bestandene Tests, Untergrenze ${MIN_TESTS} — sind ganze Suiten weggefallen?`);
}
for (const r of rot) {
  const wie = abbrueche.includes(r)
    ? 'Suite brach selbst ab, beim Laden oder in ihrem Rumpf; ihre Tests liefen nicht (node zaehlt das nicht als Fehler, dieses Tor schon)'
    : `${r.art} rot (${r.typ})`;
  fehler.push(`${r.ort}  "${r.name}": ${wie}${r.meldung ? ` — ${r.meldung}` : ''}`);
}

if (fehler.length) {
  console.error('');
  // Ein kaputter Bau reisst Dutzende Tests; die ersten 40 genuegen, der
  // Rest steht oben in der Ausgabe des Reporters.
  for (const f of fehler.slice(0, 40)) console.error(`  FEHLER  ${f}`);
  if (fehler.length > 40) console.error(`  ... und ${fehler.length - 40} weitere (siehe Ausgabe oben)`);
  console.error(`\n✗ test:e2e ROT — ${fehler.length} Befund(e).\n`);
  process.exitCode = 1;
} else {
  console.log('\n✓ test:e2e GRUEN\n');
}
