/* ============================================================
   strip-cursorglow.mjs

   Tilgt den Schein um den Mauszeiger — Element, Regel und
   Zeiger-Horcher — sowie den stillen ?nofx-Not-Ausgang, restlos
   aus dem Bestand. Vorbild: scripts/tokenize-theme-colors.mjs
   (Kopfform, --dry, --only, Zwang auf eine feste Sollzahl, lieber
   ein Rest von Hand als eine falsche automatische Ersetzung).

   ------------------------------------------------------------
   SOLLZAHLEN — weichen von der urspruenglichen Planungsakte
   (107/38/38/10) ab. Der „Ein-Koerper"-Umbau (vor dieser Phase)
   hat Patch- und Themen-Koerper von src/pages/** nach
   src/components/{patches,topics}/** verschoben und dabei die
   vormals 38 sprachgetrennten Patch-Seiten zu 19 gemeinsamen
   Koerpern zusammengelegt (EN+DE teilen jetzt EINE Datei). Die
   Fundstellen sind dieselben, nur in weniger Dateien. Gemessener
   Ist-Zustand (05.08.2026, vor diesem Lauf): 65 / 19 / 19 / 8.

   Vier Muster, je Datei hoechstens einmal erwartet:

     A  Element      <div class="cursorglow" aria-hidden="true"></div>
                      Sollzahl: 65 Dateien (jede Seite/Komponente,
                      die den Effekt je zeigte)
     B  Regel         .cursorglow{...} im inline <style>
                      Sollzahl: 19 Dateien (nur die 19 Patch-Koerper
                      unter src/components/patches/ — alle anderen
                      Seiten nutzen die zentrale Regel, die Plan 01
                      bereits aus assets/detail.css entfernt hat)
     C  Zeiger-Horcher  addEventListener('pointermove', ...
                      setProperty('--mx',...)/('--my',...))
                      Sollzahl: 19 Dateien (dieselben 19 Patch-Koerper;
                      assets/detail.js ist bereits in Plan 01 gefallen)
     D  Not-Ausgang   <script is:inline>...location.search...nofx...
                      getElementById('stars')...remove()...</script>
                      Sollzahl: 8 Dateien (die 8 verbliebenen Koerper,
                      die den ?nofx-Notausgang trugen — zwei davon
                      sind gemeinsame DE+EN-Koerper unter
                      src/components/topics/, daher 8 Dateien statt
                      der urspruenglich 10 seitengetrennten Fundstellen)

   Zwei-Pass-Ablauf: erst ALLE Dateien inspizieren (nichts
   schreiben), die vier Summen gegen das Soll halten. Weicht auch
   nur EINE Summe ab (ausserhalb von --only, das die Sollzahl per
   Definition nicht erreicht), wird NICHTS geschrieben und das
   Skript endet mit Fehlerstatus. Innerhalb einer Datei gilt:
   jedes vorkommende Muster genau einmal — sonst wird DIESE Datei
   uebersprungen und gemeldet, nicht geschrieben.

   KEINE GRABSTEIN-KOMMENTARE: die Loeschmuster hinterlassen keinen
   Kommentar, der einen der entfernten Bezeichner woertlich nennt.

       node scripts/strip-cursorglow.mjs --dry     Bericht, nichts schreiben
       node scripts/strip-cursorglow.mjs           Muster entfernen und schreiben
       … --only=<pfadteil>                          Dateiauswahl eingrenzen
   ============================================================ */

import { readFile, writeFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';

const EXPECTED = { a: 65, b: 19, c: 19, d: 8 };

const RE_A =
  /^[ \t]*<div class="cursorglow" aria-hidden="true"><\/div>[ \t]*\r?\n/;
const RE_B = /^[ \t]*\.cursorglow\{[^}]*\}[ \t]*\r?\n/;
const RE_C =
  /^[ \t]*addEventListener\('pointermove',e=>\{document\.documentElement\.style\.setProperty\('--mx',e\.clientX\+'px'\);document\.documentElement\.style\.setProperty\('--my',e\.clientY\+'px'\);\},\{passive:true\}\);[ \t]*\r?\n/;
const RE_D =
  /^[ \t]*<script is:inline>if\(location\.search\.indexOf\('nofx'\)>-1\)\{document\.documentElement\.style\.setProperty\('scroll-behavior','auto'\);var c=document\.getElementById\('stars'\);if\(c\)c\.remove\(\);\}<\/script>[ \t]*\r?\n/;

const PATTERNS = { a: RE_A, b: RE_B, c: RE_C, d: RE_D };

function countMatches(src, re) {
  const g = new RegExp(re.source, 'gm');
  return (src.match(g) || []).length;
}

function inspect(src) {
  const counts = {};
  for (const [key, re] of Object.entries(PATTERNS)) counts[key] = countMatches(src, re);
  return counts;
}

function apply(src) {
  let out = src;
  for (const re of Object.values(PATTERNS)) {
    const g = new RegExp(re.source, 'gm');
    out = out.replace(g, '');
  }
  return out;
}

/* ---------------------------------------------------------- */

const DRY = process.argv.includes('--dry');
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7);

const files = [];
for await (const f of glob('src/**/*.astro')) files.push(f.replace(/\\/g, '/'));
files.sort();
const targets = ONLY ? files.filter((f) => f.includes(ONLY)) : files;

const totals = { a: 0, b: 0, c: 0, d: 0 };
const perFile = [];
const anomalies = [];

for (const file of targets) {
  const src = await readFile(file, 'utf8');
  const counts = inspect(src);
  const touched = Object.values(counts).some((n) => n > 0);
  if (!touched) continue;

  const bad = Object.entries(counts).filter(([, n]) => n > 1);
  if (bad.length) {
    anomalies.push({ file, counts });
    console.log(
      `  ! ${file}  A=${counts.a} B=${counts.b} C=${counts.c} D=${counts.d}  — mehr als 1 Treffer je Muster, uebersprungen`
    );
    continue;
  }

  for (const k of Object.keys(totals)) totals[k] += counts[k];
  perFile.push(file);
  console.log(`  ${file}  A=${counts.a} B=${counts.b} C=${counts.c} D=${counts.d}`);
}

console.log(
  `\nstrip-cursorglow: A=${totals.a}/${EXPECTED.a}  B=${totals.b}/${EXPECTED.b}  ` +
    `C=${totals.c}/${EXPECTED.c}  D=${totals.d}/${EXPECTED.d}  ` +
    `(${perFile.length} Dateien betroffen)`
);

if (anomalies.length) {
  console.error(`\n${anomalies.length} Datei(en) mit unerwarteter Anzahl je Muster:`);
  for (const a of anomalies) {
    console.error(
      `  ! ${a.file}  A=${a.counts.a} B=${a.counts.b} C=${a.counts.c} D=${a.counts.d}`
    );
  }
}

const sollAbweichung =
  !ONLY &&
  (totals.a !== EXPECTED.a ||
    totals.b !== EXPECTED.b ||
    totals.c !== EXPECTED.c ||
    totals.d !== EXPECTED.d);

if (sollAbweichung) {
  console.error(
    `\nAbbruch: Sollzahl weicht ab (erwartet A=${EXPECTED.a} B=${EXPECTED.b} C=${EXPECTED.c} D=${EXPECTED.d}). ` +
      `Es wird NICHTS geschrieben.`
  );
  process.exit(1);
}

if (anomalies.length) {
  console.error(`\nAbbruch wegen Anomalien in einzelnen Dateien. Es wird NICHTS geschrieben.`);
  process.exit(1);
}

if (!DRY) {
  for (const file of perFile) {
    const src = await readFile(file, 'utf8');
    await writeFile(file, apply(src));
  }
  console.log(`\n${perFile.length} Dateien geschrieben.`);
} else {
  console.log(`\n${perFile.length} Dateien wuerden geschrieben (Probelauf).`);
}
