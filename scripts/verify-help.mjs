/* ============================================================
   verify-help.mjs

   Pruefverfahren gegen den GEBAUTEN Stand (dist/), nicht die
   Quelle — Vorbild scripts/verify-fx.mjs Zeile fuer Zeile. Bleibt
   als eigenstaendiges Werkzeug im Repository (`npm run verify:help`),
   absichtlich NICHT in `npm run build` eingehaengt.

   Sechs Zusicherungen, jede mit Soll/Ist-Zeile:

     1  Kostenfreiheit vor dem Oeffnen (DOC-06, D-11). Liest
        dist/assets/tool-help.js, findet die Marken
        HELP:STAGE2:BEGIN/HELP:STAGE2:END im Rohtext (die Marken
        selbst stehen in einem Kommentar), entfernt dann Zeilen- und
        Blockkommentare NUR innerhalb der beiden Aussenbereiche und
        prueft: keiner der Stufe-2-Bezeichner (mouseover, focusin,
        keydown, getBoundingClientRect, requestAnimationFrame,
        setInterval, setTimeout, fetch, createElement,
        XMLHttpRequest) kommt dort vor; ausserhalb steht genau EIN
        addEventListener — der delegierte Klick.
        Bekannte Grenze (RESEARCH Annahme A3): ein dynamisch
        zusammengesetzter Aufrufname (z. B. ueber Zeichenketten-
        Verkettung gebildet) entginge dieser Zeichensuche.
     2  Kein markup-setzender Zuweisungspfad (T-01.2-02): weder
        innerHTML noch outerHTML noch insertAdjacentHTML noch
        document.write in dist/assets/tool-help.js; textContent
        muss vorkommen (das ist der einzige zulaessige Sinkpfad).
     3  Sprachparitaet (DOC-04): fuer jedes EN/DE-Seitenpaar unter
        dist/ (Paarungslogik aus verify-fx.mjs Zusicherung 6, inkl.
        dist/index.html <-> dist/de.html) muessen die Zaehlungen von
        data-tool-id=, data-help= und class="tool-help" paarweise
        uebereinstimmen.
     4  Werkzeugabdeckung (DOC-07): sammelt alle data-tool-id-Werte
        aus allen gebauten .html-Dateien unter dist/ (rekursiv) und
        vergleicht sie gegen die feste Liste der ELF Kennungen. Ohne
        --complete nur Stand melden; mit --complete alle elf verlangen.
     5  Ladeort (DOC-06): jede Seite, die tool-help.js laedt, traegt
        mindestens ein data-tool-id.
     6  Element-Hilfe vorhanden (WR-05): jede Seite mit data-tool-id
        traegt mindestens einen data-help-Anker, und kein data-help-
        Wert ist leer. Ohne diese Zusicherung meldete Zusicherung 4
        weiterhin "abgedeckt", selbst wenn einem Werkzeug alle
        data-help-Anker geloescht wurden — Zusicherung 3 sieht das
        ebenfalls nicht, weil sie nur EN gegen DE zaehlt (0 === 0
        besteht dort klaglos).

       node scripts/verify-help.mjs [--complete]
   ============================================================ */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

if (!(() => { try { readdirSync('dist'); return true; } catch { return false; } })()) {
  console.error(
    'verify-help: dist/ fehlt. Erst `npm run build`, dann `npm run verify:help` — ' +
      'dieses Skript prueft den GEBAUTEN Stand, nicht die Quelle.'
  );
  process.exit(1);
}

// Feste Liste, EINE Stelle. Die beiden Refinerys sind zwei verschiedene
// Werkzeuge — eine Kennung "refinery" gibt es nicht.
const TOOL_IDS = [
  'itemfinder', 'crafting', 'mining', 'refineryfinder', 'refinerytracker',
  'missions', 'ships', 'precisionjump', 'archive', 'wikelo', 'armorsets',
];

const COMPLETE = process.argv.includes('--complete');

const STAGE2_BEGIN = 'HELP:STAGE2:BEGIN';
const STAGE2_END = 'HELP:STAGE2:END';
const BANNED = [
  'mouseover', 'focusin', 'keydown', 'getBoundingClientRect',
  'requestAnimationFrame', 'setInterval', 'setTimeout', 'fetch',
  'createElement', 'XMLHttpRequest',
];

function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

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

let ok = true;
const fail = (msg) => {
  ok = false;
  console.error(`  FEHLER: ${msg}`);
};

const htmlCache = new Map();
for (const f of htmlFiles) htmlCache.set(f, readFileSync(f, 'utf8'));

/* ---- Zusicherung 1: Kostenfreiheit vor dem Oeffnen ---- */
console.log('\n[1] Kostenfreiheit vor dem Oeffnen — dist/assets/tool-help.js');
{
  let jsRaw;
  try {
    jsRaw = readFileSync('dist/assets/tool-help.js', 'utf8');
  } catch {
    jsRaw = null;
  }
  if (jsRaw === null) {
    fail('dist/assets/tool-help.js nicht gefunden');
  } else {
    const beginIdx = jsRaw.indexOf(STAGE2_BEGIN);
    const endIdx = jsRaw.indexOf(STAGE2_END);
    if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
      fail('Marken HELP:STAGE2:BEGIN/HELP:STAGE2:END fehlen oder sind vertauscht');
    } else {
      const outside = stripComments(jsRaw.slice(0, beginIdx)) + '\n' + stripComments(jsRaw.slice(endIdx));

      const leaks = BANNED.filter((name) => outside.includes(name));
      console.log(`    Verbotene Bezeichner ausserhalb der Marken — Soll: 0   Ist: ${leaks.length}`);
      if (leaks.length) fail(`Bezeichner ausserhalb der Marken gefunden: ${leaks.join(', ')}`);

      const listenerCount = (outside.match(/addEventListener/g) || []).length;
      console.log(`    addEventListener ausserhalb der Marken — Soll: 1   Ist: ${listenerCount}`);
      if (listenerCount !== 1) {
        fail(`Erwartet genau 1 addEventListener ausserhalb der Marken (der delegierte Klick), gefunden ${listenerCount}`);
      }
    }
  }
}

/* ---- Zusicherung 2: kein markup-setzender Zuweisungspfad ---- */
console.log('\n[2] Kein markup-setzender Zuweisungspfad (T-01.2-02) — dist/assets/tool-help.js');
{
  let jsRaw;
  try {
    jsRaw = readFileSync('dist/assets/tool-help.js', 'utf8');
  } catch {
    jsRaw = null;
  }
  if (jsRaw === null) {
    fail('dist/assets/tool-help.js nicht gefunden');
  } else {
    const dangerous = ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write'];
    const hits = dangerous.filter((needle) => jsRaw.includes(needle));
    console.log(`    Gefaehrliche Zuweisungspfade — Soll: 0   Ist: ${hits.length}`);
    if (hits.length) fail(`Markup-setzender Zuweisungspfad gefunden: ${hits.join(', ')}`);

    const usesTextContent = jsRaw.includes('.textContent');
    console.log(`    Nutzung von textContent — Soll: vorhanden   Ist: ${usesTextContent ? 'vorhanden' : 'fehlt'}`);
    if (!usesTextContent) fail('Kein textContent-Zugriff gefunden — Blasentext-Zuweisung nicht nachweisbar');
  }
}

/* ---- Zusicherung 3: Sprachparitaet ---- */
console.log('\n[3] Sprachparitaet EN<->DE (data-tool-id=, data-help=, class="tool-help")');
{
  const MARKERS = ['data-tool-id=', 'data-help=', 'class="tool-help"'];
  const set = new Set(htmlFiles);
  const enFiles = htmlFiles.filter((f) => !f.startsWith('dist/de/') && f !== 'dist/de.html');
  let pairs = 0;
  let pairsWithHelp = 0;
  const mismatches = [];
  for (const f of enFiles) {
    const rel = f.slice('dist/'.length);
    const dePath = rel === 'index.html' ? 'dist/de.html' : 'dist/de/' + rel;
    if (!set.has(dePath)) continue;
    pairs++;
    const enHtml = htmlCache.get(f);
    const deHtml = htmlCache.get(dePath);
    const enC = MARKERS.map((m) => count(enHtml, m));
    const deC = MARKERS.map((m) => count(deHtml, m));
    if (enC.some((v) => v > 0) || deC.some((v) => v > 0)) pairsWithHelp++;
    if (MARKERS.some((_, i) => enC[i] !== deC[i])) mismatches.push({ en: f, de: dePath, enC, deC });
  }
  console.log(
    `    Verglichene Seitenpaare: ${pairs}   Davon mit Werkzeug-Hilfe: ${pairsWithHelp}   Soll: 0 Abweichungen   Ist: ${mismatches.length}`
  );
  if (mismatches.length) {
    fail(`Sprachparitaet gerissen bei ${mismatches.length} Paar(en):`);
    for (const m of mismatches.slice(0, 10)) {
      console.error(
        `      ${m.en} (${MARKERS.map((mk, i) => `${mk}${m.enC[i]}`).join(' ')}) <-> ` +
          `${m.de} (${MARKERS.map((mk, i) => `${mk}${m.deC[i]}`).join(' ')})`
      );
    }
  }
}

/* ---- Zusicherung 4: Werkzeugabdeckung ---- */
console.log(`\n[4] Werkzeugabdeckung (DOC-07)${COMPLETE ? ' — --complete: alle 11 verlangt' : ''}`);
{
  const found = new Set();
  const idRe = /data-tool-id="([^"]+)"/g;
  for (const f of htmlFiles) {
    const html = htmlCache.get(f);
    let m;
    while ((m = idRe.exec(html))) found.add(m[1]);
  }
  const unknown = [...found].filter((id) => !TOOL_IDS.includes(id));
  const covered = TOOL_IDS.filter((id) => found.has(id));
  console.log(`    Abgedeckt: ${covered.length} von ${TOOL_IDS.length} (${covered.join(', ') || '—'})`);
  if (unknown.length) fail(`Unbekannte data-tool-id-Werte ausserhalb der festen Liste: ${unknown.join(', ')}`);
  if (COMPLETE && covered.length !== TOOL_IDS.length) {
    const missing = TOOL_IDS.filter((id) => !found.has(id));
    fail(`--complete verlangt alle ${TOOL_IDS.length} Werkzeuge, es fehlen: ${missing.join(', ')}`);
  }
}

/* ---- Zusicherung 5: Ladeort ---- */
console.log('\n[5] Ladeort: nur Seiten mit data-tool-id laden tool-help.js (DOC-06)');
{
  const bad = [];
  for (const f of htmlFiles) {
    const html = htmlCache.get(f);
    const loadsScript = html.includes('tool-help.js');
    const hasToolId = html.includes('data-tool-id=');
    if (loadsScript && !hasToolId) bad.push(f);
  }
  console.log(`    Seiten, die das Skript ohne data-tool-id laden — Soll: 0   Ist: ${bad.length}`);
  if (bad.length) fail(`Skript geladen ohne data-tool-id: ${bad.slice(0, 10).join(', ')}`);
}

/* ---- Zusicherung 6: jede Werkzeug-Seite hat echte data-help-Anker (WR-05) ----
   Zusicherung 4 sieht nur data-tool-id — ein Werkzeug, dem alle
   data-help-Anker geloescht wurden, meldete dort weiterhin "abgedeckt".
   Diese Zusicherung verlangt fuer JEDE Seite mit data-tool-id mindestens
   einen data-help-Wert und verbietet leere Werte. */
console.log('\n[6] Element-Hilfe vorhanden (WR-05): data-tool-id verlangt >=1 nicht-leeren data-help-Anker');
{
  const helpRe = /data-help="([^"]*)"/g;
  let checked = 0;
  let withoutAnchor = 0;
  let withEmptyValue = 0;
  for (const f of htmlFiles) {
    const html = htmlCache.get(f);
    if (!html.includes('data-tool-id=')) continue;
    checked++;
    const vals = [...html.matchAll(helpRe)].map((m) => m[1]);
    if (!vals.length) {
      withoutAnchor++;
      fail(`${f}: data-tool-id vorhanden, aber KEIN data-help-Anker`);
      continue;
    }
    if (vals.some((v) => !v.trim())) {
      withEmptyValue++;
      fail(`${f}: leerer data-help-Wert (${vals.filter((v) => !v.trim()).length}x)`);
    }
  }
  console.log(
    `    Geprueft: ${checked}   ohne Anker: ${withoutAnchor}   mit leerem Wert: ${withEmptyValue}   Soll: 0 / 0`
  );
}

console.log(`\nverify-help: ${ok ? 'ALLE ZUSICHERUNGEN ERFUELLT ✓' : 'FEHLGESCHLAGEN ✗'}`);
if (!ok) process.exit(1);
