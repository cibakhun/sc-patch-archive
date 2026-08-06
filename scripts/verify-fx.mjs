/* ============================================================
   verify-fx.mjs

   Pruefverfahren gegen den GEBAUTEN Stand (dist/), nicht die
   Quelle — Vorbild scripts/_verify.mjs ("gegen dist pruefen").
   Bleibt als eigenstaendiges Werkzeug im Repository
   (`npm run verify:fx`), absichtlich NICHT in `npm run build`
   eingehaengt: der Build ist bereits eine lange Kette, und eine
   Pruefung, die ihn blockiert, wird beim ersten Fehlalarm
   herausgenommen.

   Sieben Zusicherungen, jede mit Soll/Ist-Zeile:

     1  Null Vorkommen des getilgten Klassennamens (cursorglow)
        in allen .html-Dateien unter dist/ (rekursiv).
     2  Null Vorkommen der beiden getilgten Positions-Eigenschaften
        (--mx/--my) in allen .html-Dateien unter dist/ UND allen
        .js-Dateien unter dist/assets/.
     3  Null Vorkommen der Abfragezeichenkette des Not-Ausgangs
        (das ?nofx-Muster `location.search.indexOf('nofx')`, nicht
        die blosse Zeichenfolge „nofx" — die kommt zufaellig auch in
        Base64-Bilddaten vor und waere ein falscher Alarm) in allen
        .html-Dateien unter dist/.
     4  Jede gebaute Seite, die die Umschalter-Klasse (js-fx-toggle)
        traegt, traegt sie mindestens zweimal (Leiste + Menuefuss).
     5  Der Kopf-Schnipsel, der data-fx setzt, steht in jeder
        gebauten Seite VOR dem ersten <script src=...>-Verweis auf
        ein Seiten-Asset (Zeichenposition vergleichen) — die
        maschinelle Fassung von D-11.
     6  Sprachparitaet: fuer jede EN-Seite unter dist/ mit einem
        DE-Gegenstueck unter dist/de/ (bzw. dist/index.html <->
        dist/de.html) muessen die Zaehlungen von Umschalter-Klasse,
        Effekt-Attribut (data-fx) und Ereignisname (vbfxchange)
        paarweise UEBEREINSTIMMEN.
     7  Genau 38 gebaute Patch-Seiten (19 je Sprache, unter einem
        patches/-Ordner mit Dateinamen sc-*.html) enthalten den
        Ereignisnamen.

       node scripts/verify-fx.mjs
   ============================================================ */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

if (!(() => { try { readdirSync('dist'); return true; } catch { return false; } })()) {
  console.error(
    'verify-fx: dist/ fehlt. Erst `npm run build`, dann `npm run verify:fx` — ' +
      'dieses Skript prueft den GEBAUTEN Stand, nicht die Quelle.'
  );
  process.exit(1);
}

const TOGGLE = 'js-fx-toggle';
const FX_ATTR = 'data-fx';
const EVENT = 'vbfxchange';
const HEAD_FLAG = "setAttribute('data-fx'";
const NOFX_ESCAPE = "location.search.indexOf('nofx')";

function walk(dir, ext) {
  let out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name).replace(/\\/g, '/');
    if (e.isDirectory()) out = out.concat(walk(p, ext));
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

const count = (s, needle) => s.split(needle).length - 1;

const htmlFiles = walk('dist', '.html');
const jsFiles = readdirSync('dist/assets').filter((f) => f.endsWith('.js')).map((f) => 'dist/assets/' + f);

let ok = true;
const fail = (msg) => {
  ok = false;
  console.error(`  FEHLER: ${msg}`);
};

/* Ein Lesevorgang je Datei — alle Zusicherungen, die HTML brauchen,
   greifen auf denselben gecachten Text zurueck. */
const htmlCache = new Map();
for (const f of htmlFiles) htmlCache.set(f, readFileSync(f, 'utf8'));

/* ---- Zusicherung 1: cursorglow ---- */
console.log('\n[1] cursorglow in dist/**/*.html');
{
  const hits = htmlFiles.filter((f) => htmlCache.get(f).includes('cursorglow'));
  console.log(`    Soll: 0   Ist: ${hits.length}`);
  if (hits.length) fail(`cursorglow noch vorhanden in: ${hits.slice(0, 10).join(', ')}`);
}

/* ---- Zusicherung 2: --mx/--my ---- */
console.log('\n[2] --mx/--my in dist/**/*.html und dist/assets/*.js');
{
  const htmlHits = htmlFiles.filter((f) => htmlCache.get(f).includes('--mx') || htmlCache.get(f).includes('--my'));
  const jsHits = jsFiles.filter((f) => {
    const s = readFileSync(f, 'utf8');
    return s.includes('--mx') || s.includes('--my');
  });
  const total = htmlHits.length + jsHits.length;
  console.log(`    Soll: 0   Ist: ${total} (HTML: ${htmlHits.length}, JS: ${jsHits.length})`);
  if (total) fail(`--mx/--my noch vorhanden in: ${[...htmlHits, ...jsHits].slice(0, 10).join(', ')}`);
}

/* ---- Zusicherung 3: nofx-Not-Ausgang ---- */
console.log('\n[3] Not-Ausgang (?nofx-Abfragezeichenkette) in dist/**/*.html');
{
  const hits = htmlFiles.filter((f) => htmlCache.get(f).includes(NOFX_ESCAPE));
  console.log(`    Soll: 0   Ist: ${hits.length}`);
  if (hits.length) fail(`Not-Ausgang noch vorhanden in: ${hits.slice(0, 10).join(', ')}`);
}

/* ---- Zusicherung 4: Umschalter-Klasse mindestens zweimal ---- */
console.log('\n[4] js-fx-toggle: jede Seite, die ihn traegt, traegt ihn >= 2x');
{
  const bad = [];
  for (const f of htmlFiles) {
    const n = count(htmlCache.get(f), TOGGLE);
    if (n > 0 && n < 2) bad.push(`${f} (${n}x)`);
  }
  console.log(`    Seiten mit dem Umschalter, aber < 2 Fundstellen — Soll: 0   Ist: ${bad.length}`);
  if (bad.length) fail(`Umschalter fehlt an einer Montagestelle: ${bad.slice(0, 10).join(', ')}`);
}

/* ---- Zusicherung 5: Kopf-Flagge vor dem ersten Asset-Skript (D-11) ---- */
console.log('\n[5] data-fx-Kopf-Schnipsel steht vor dem ersten <script src=...> (D-11)');
{
  const bad = [];
  let checked = 0;
  const scriptSrcRe = /<script[^>]+\bsrc=/;
  for (const f of htmlFiles) {
    const html = htmlCache.get(f);
    const flagIdx = html.indexOf(HEAD_FLAG);
    if (flagIdx === -1) continue; // Seite ohne Kopf-Flagge betrifft diese Zusicherung nicht
    const m = html.match(scriptSrcRe);
    if (!m) continue; // keine Seiten-Asset-Skripte auf dieser Seite
    checked++;
    const srcIdx = html.indexOf(m[0]);
    if (flagIdx >= srcIdx) bad.push(f);
  }
  console.log(`    Geprueft: ${checked} Seiten   Soll: 0 Verstoesse   Ist: ${bad.length}`);
  if (bad.length) fail(`Kopf-Flagge NACH dem ersten Asset-Skript: ${bad.slice(0, 10).join(', ')}`);
}

/* ---- Zusicherung 6: Sprachparitaet ---- */
console.log('\n[6] Sprachparitaet EN<->DE (Umschalter-Klasse, data-fx, Ereignisname)');
{
  const set = new Set(htmlFiles);
  const enFiles = htmlFiles.filter((f) => !f.startsWith('dist/de/') && f !== 'dist/de.html');
  let pairs = 0;
  const mismatches = [];
  for (const f of enFiles) {
    const rel = f.slice('dist/'.length);
    const dePath = rel === 'index.html' ? 'dist/de.html' : 'dist/de/' + rel;
    if (!set.has(dePath)) continue;
    pairs++;
    const enHtml = htmlCache.get(f);
    const deHtml = htmlCache.get(dePath);
    const enC = { toggle: count(enHtml, TOGGLE), fx: count(enHtml, FX_ATTR), ev: count(enHtml, EVENT) };
    const deC = { toggle: count(deHtml, TOGGLE), fx: count(deHtml, FX_ATTR), ev: count(deHtml, EVENT) };
    if (enC.toggle !== deC.toggle || enC.fx !== deC.fx || enC.ev !== deC.ev) {
      mismatches.push({ en: f, de: dePath, enC, deC });
    }
  }
  console.log(`    Verglichene Seitenpaare: ${pairs}   Soll: 0 Abweichungen   Ist: ${mismatches.length}`);
  if (pairs < 60) fail(`Zu wenige Seitenpaare gefunden (${pairs} < 60) — Paarungslogik pruefen`);
  if (mismatches.length) {
    fail(`Sprachparitaet gerissen bei ${mismatches.length} Paar(en):`);
    for (const m of mismatches.slice(0, 10)) {
      console.error(
        `      ${m.en} (toggle=${m.enC.toggle} fx=${m.enC.fx} ev=${m.enC.ev}) <-> ` +
          `${m.de} (toggle=${m.deC.toggle} fx=${m.deC.fx} ev=${m.deC.ev})`
      );
    }
  }
}

/* ---- Zusicherung 7: exakt 38 Patch-Seiten mit dem Ereignisnamen ---- */
console.log('\n[7] Genau 38 gebaute Patch-Seiten (19 je Sprache) enthalten den Ereignisnamen');
{
  const patchFiles = htmlFiles.filter((f) => /\/patches\/sc-[^/]+\.html$/.test(f));
  const withEvent = patchFiles.filter((f) => htmlCache.get(f).includes(EVENT));
  console.log(
    `    Patch-Seiten gesamt: ${patchFiles.length}   mit ${EVENT}: ${withEvent.length}   Soll: 38   Ist: ${withEvent.length}`
  );
  if (withEvent.length !== 38) fail(`Erwartet genau 38 Patch-Seiten mit ${EVENT}, gefunden ${withEvent.length}`);
}

console.log(`\nverify-fx: ${ok ? 'ALLE ZUSICHERUNGEN ERFUELLT ✓' : 'FEHLGESCHLAGEN ✗'}`);
if (!ok) process.exit(1);
