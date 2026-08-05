/* ============================================================
   strip-cursorglow.mjs

   Tilgt den Schein um den Mauszeiger ersatzlos aus den restlichen
   Fundstellen des Bestands (Plan 01 hat assets/detail.js/.css schon
   geraeumt, Plan 02 hat die Partikel-Leinwaende gegattert — beide
   Fundstellen bleiben in diesem Codemod unberuehrt, sie existieren
   dort nicht mehr).

   ------------------------------------------------------------
   VIER LOESCHMUSTER, jedes mit fest erwarteter Gesamtzahl. Bei jeder
   Abweichung wird NICHTS geschrieben, sondern die Abweichung mit
   Dateiname und Anzahl gemeldet, und das Skript endet mit Fehlerstatus.
   Innerhalb einer Datei gilt: kommt ein Muster vor, dann genau einmal
   — sonst wird DIESE Datei uebersprungen und gemeldet. Lieber ein Rest
   von Hand als eine falsche automatische Loeschung (Vorbild:
   tokenize-theme-colors.mjs, gate-patch-fx.mjs).

     Muster A  Element    <div class="cursorglow" aria-hidden="true"></div>
                          erwartet in allen Zieldateien genau einmal.
     Muster B  Regel      .cursorglow{...} im inline <style> — auf die
                          Regelstruktur gematcht, nicht auf einen festen
                          Farbwert (der ist pro Seite verschieden).
     Muster C  Horcher    der addEventListener('pointermove',...)-Aufruf,
                          dessen Rumpf --mx UND --my auf
                          document.documentElement.style schreibt. Trifft
                          NUR diesen Horcher — jeder andere pointermove
                          (assets/holo-viewer.js, account-dashboard.ts)
                          liegt ausserhalb des Suchpfads src/**/*.astro
                          und bleibt so unangetastet (D-03/FX-08).
     Muster D  Not-Ausgang das inline <script>, das location.search auf
                          nofx prueft und dabei die Sternen-Leinwand
                          entfernt. Die Leinwand selbst bleibt stehen
                          (D-07) — geloescht wird nur dieses Skript.

   ------------------------------------------------------------
       node scripts/strip-cursorglow.mjs --dry     Bericht, nichts schreiben
       node scripts/strip-cursorglow.mjs           Muster loeschen und schreiben
       … --only=<pfadteil>                          Dateiauswahl eingrenzen
   ============================================================ */

import { readFile, writeFile, glob } from 'node:fs/promises';

const EXPECTED = { a: 107, b: 38, c: 38, d: 10 };

const ELEM_RE = /^[ \t]*<div class="cursorglow" aria-hidden="true"><\/div>\r?\n/gm;
const STYLE_RE = /^\.cursorglow\{[^}]*\}\r?\n/gm;
const LISTENER_RE =
  /^addEventListener\('pointermove',e=>\{document\.documentElement\.style\.setProperty\('--mx',e\.clientX\+'px'\);document\.documentElement\.style\.setProperty\('--my',e\.clientY\+'px'\);\},\{passive:true\}\);\r?\n/gm;
const NOFX_RE =
  /^[ \t]*<script is:inline>if\(location\.search\.indexOf\('nofx'\)>-1\)\{document\.documentElement\.style\.setProperty\('scroll-behavior','auto'\);var c=document\.getElementById\('stars'\);if\(c\)c\.remove\(\);\}<\/script>\r?\n/gm;

function countMatches(src, re) {
  re.lastIndex = 0;
  return (src.match(re) || []).length;
}

function apply(src) {
  let out = src;
  out = out.replace(ELEM_RE, '');
  out = out.replace(STYLE_RE, '');
  out = out.replace(LISTENER_RE, '');
  out = out.replace(NOFX_RE, '');
  // Aufraeumen: falls eine Loeschung eine doppelte Leerzeile hinterlaesst.
  out = out.replace(/\n{3,}/g, '\n\n');
  return out;
}

/* ---------------------------------------------------------- */

const DRY = process.argv.includes('--dry');
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7);

const allFiles = [];
for await (const f of glob('src/**/*.astro')) allFiles.push(f.replace(/\\/g, '/'));
allFiles.sort();

// Zieldateien: alles, was mindestens eines der vier Muster ueberhaupt
// tragen KOENNTE — ueber die Signalwoerter vorgefiltert. Die vier
// Loeschmuster selbst entscheiden danach, was tatsaechlich passt.
const targets = allFiles
  .filter((f) => (ONLY ? f.includes(ONLY) : true));

let sumA = 0, sumB = 0, sumC = 0, sumD = 0;
let written = 0;
let anomalies = 0;
const anomalyFiles = [];

console.log(`strip-cursorglow: ${targets.length} durchsuchte Dateien\n`);

for (const file of targets) {
  const src = await readFile(file, 'utf8');
  const a = countMatches(src, ELEM_RE);
  const b = countMatches(src, STYLE_RE);
  const c = countMatches(src, LISTENER_RE);
  const d = countMatches(src, NOFX_RE);

  if (a === 0 && b === 0 && c === 0 && d === 0) continue; // Datei betrifft dieses Skript nicht

  console.log(`  ${file}  A=${a} B=${b} C=${c} D=${d}`);

  if (a > 1 || b > 1 || c > 1 || d > 1) {
    anomalies++;
    anomalyFiles.push(file);
    console.log(`  ! ${file}  Mehrfachtreffer — Datei uebersprungen, NICHT geschrieben`);
    continue;
  }

  sumA += a; sumB += b; sumC += c; sumD += d;

  if (!DRY) {
    const out = apply(src);
    await writeFile(file, out);
  }
  written++;
}

console.log(
  `\nstrip-cursorglow: ${written} Dateien ${DRY ? 'wuerden geaendert (Probelauf)' : 'geaendert'}` +
    (anomalies ? `, ${anomalies} FEHLGESCHLAGEN (Mehrfachtreffer, nicht geschrieben)` : '')
);

console.log('\nSummen:');
console.log(`  Muster A (Element)     ist=${sumA}  soll=${EXPECTED.a}  ${sumA === EXPECTED.a ? 'OK' : 'ABWEICHUNG'}`);
console.log(`  Muster B (Regel)       ist=${sumB}  soll=${EXPECTED.b}  ${sumB === EXPECTED.b ? 'OK' : 'ABWEICHUNG'}`);
console.log(`  Muster C (Horcher)     ist=${sumC}  soll=${EXPECTED.c}  ${sumC === EXPECTED.c ? 'OK' : 'ABWEICHUNG'}`);
console.log(`  Muster D (Not-Ausgang) ist=${sumD}  soll=${EXPECTED.d}  ${sumD === EXPECTED.d ? 'OK' : 'ABWEICHUNG'}`);

const mismatch = sumA !== EXPECTED.a || sumB !== EXPECTED.b || sumC !== EXPECTED.c || sumD !== EXPECTED.d;

if (anomalies || (mismatch && !ONLY)) {
  console.error(
    `\nAbbruch: ${anomalies ? anomalies + ' Mehrfachtreffer' : ''}${anomalies && mismatch ? ' und ' : ''}` +
      `${mismatch ? 'Soll/Ist-Abweichung gegen 107/38/38/10' : ''}. Von Hand pruefen.`
  );
  process.exit(1);
}

if (mismatch && ONLY) {
  console.log(`\nHinweis: --only aktiv, Soll/Ist-Vergleich gegen die Gesamtzahl ist bei Teilmengen nicht aussagekraeftig.`);
}
