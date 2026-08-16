/* ============================================================
   verify-help.mjs

   Pruefverfahren gegen den GEBAUTEN Stand (dist/), nicht die
   Quelle — Vorbild scripts/verify-fx.mjs Zeile fuer Zeile. Bleibt
   als eigenstaendiges Werkzeug im Repository (`npm run verify:help`),
   absichtlich NICHT in `npm run build` eingehaengt.

   Acht Zusicherungen, jede mit Soll/Ist-Zeile (7 und 8 seit 16.08.2026 —
   sie halten Hilfetext und Bestand zusammen, s. ihren Block unten):

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
        vergleicht sie gegen die feste Liste in TOOL_IDS. Ohne
        --complete nur Stand melden; mit --complete alle verlangen.
        (Die Zahl stand hier als Wort — „ELF" — und war nach dem
        zwoelften Werkzeug still falsch. Jetzt zaehlt der Code.)
     5  Ladeort (DOC-06): jede Seite, die tool-help.js laedt, traegt
        mindestens ein data-tool-id.
     6  Element-Hilfe je WERKZEUG (WR-05): jedes data-tool-id traegt
        mindestens einen EIGENEN data-help-Anker (zugeordnet ueber die
        Dokumentreihenfolge bis zum naechsten data-tool-id), und kein
        data-help-Wert ist leer. Ohne diese Zusicherung meldete
        Zusicherung 4 weiterhin "abgedeckt", selbst wenn einem Werkzeug
        alle data-help-Anker geloescht wurden — Zusicherung 3 sieht das
        ebenfalls nicht, weil sie nur EN gegen DE zaehlt (0 === 0
        besteht dort klaglos).
        ZAEHLTE BIS 11.08.2026 PRO SEITE und war damit selbst blind:
        die Mining-Seite traegt zwei Werkzeuge, und die Anker des
        Refinery-Finders deckten den Totalverlust der Mining-Werkbank
        zu. Gegenprobe protokolliert in
        .planning/notes/mining-werkbank-defekte.md.

       node scripts/verify-help.mjs [--complete]
   ============================================================ */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findPagePairs, assertMinimumPairs } from './lib/page-pairs.mjs';

if (!(() => { try { readdirSync('dist'); return true; } catch { return false; } })()) {
  console.error(
    'verify-help: dist/ fehlt. Erst `npm run build`, dann `npm run verify:help` — ' +
      'dieses Skript prueft den GEBAUTEN Stand, nicht die Quelle.'
  );
  process.exit(1);
}

// Feste Liste, EINE Stelle. „refinerytracker" ist das Dashboard unter
// /refinery.html. Den „refineryfinder" auf der Mining-Seite gibt es seit
// 15.08.2026 nicht mehr — eine Kennung "refinery" gab es nie.
const TOOL_IDS = [
  'itemfinder', 'crafting', 'mining', 'fracturing',
  'refinerytracker', 'missions', 'ships', 'precisionjump', 'archive',
  'wikelo', 'armorsets',
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
  const { pairs: pairList } = findPagePairs(htmlFiles);
  let pairs = 0;
  let pairsWithHelp = 0;
  const mismatches = [];
  for (const [f, dePath] of pairList) {
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
  // Vor Plan 02 fehlte diese Untergrenze in verify-help.mjs — die einzige der
  // drei Kopien ohne sie (Befund aus dem Vorher-Vergleich, 04-02-SUMMARY.md).
  // Vereinheitlichung macht die Zusicherung staerker, nicht schwaecher (D-02).
  assertMinimumPairs(pairList, fail, 60);
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
console.log(`\n[4] Werkzeugabdeckung (DOC-07)${COMPLETE ? ` — --complete: alle ${TOOL_IDS.length} verlangt` : ''}`);
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

/* ---- Zusicherung 6: JEDES WERKZEUG hat eigene data-help-Anker (WR-05) ----
   Zaehlte bis 11.08.2026 pro SEITE — und das reichte nachweislich nicht.
   Die Mining-Seite trug ZWEI Werkzeuge (mining + refineryfinder). Als der
   Werkbank-Umbau saemtliche data-help der Mining-Werkbank verlor, hielten
   die drei Anker des Refinery-Finders weiter unten die Seite gruen; der
   Knopf „Elemente erklaeren" der Werkbank hob danach nur noch fremde
   Elemente ausserhalb des Blickfelds hervor. Genau die Luecke, vor der
   Grundsatz 1 warnt: ein Tor, das nie rot war, ist Dekoration.

   Zuordnung ueber die Dokumentreihenfolge: ToolHelp steht in jedem Werkzeug
   am Kopf seiner eigenen Filterleiste, die Bedienelemente folgen darunter.
   Alles zwischen dem ersten data-tool-id eines Werkzeugs und dem des
   naechsten gehoert damit zu diesem Werkzeug. Mehrfachvorkommen derselben
   Kennung (ToolHelp setzt sie auf <details> UND auf den Knopf) zaehlen nur
   einmal — sonst entstuende dazwischen ein leeres Teilstueck. */
console.log('\n[6] Element-Hilfe je WERKZEUG (WR-05): jedes data-tool-id verlangt >=1 eigenen, nicht-leeren data-help-Anker');
{
  const idRe = /data-tool-id="([^"]*)"/g;
  const helpRe = /data-help="([^"]*)"/g;
  let checked = 0;
  let withoutAnchor = 0;
  let withEmptyValue = 0;
  for (const f of htmlFiles) {
    const html = htmlCache.get(f);
    if (!html.includes('data-tool-id=')) continue;
    const marks = [];
    for (const m of html.matchAll(idRe)) {
      if (!marks.some((x) => x.id === m[1])) marks.push({ id: m[1], at: m.index });
    }
    for (let i = 0; i < marks.length; i++) {
      checked++;
      const to = i + 1 < marks.length ? marks[i + 1].at : html.length;
      const vals = [...html.slice(marks[i].at, to).matchAll(helpRe)].map((m) => m[1]);
      if (!vals.length) {
        withoutAnchor++;
        fail(`${f}: Werkzeug "${marks[i].id}" hat KEINEN eigenen data-help-Anker`);
        continue;
      }
      if (vals.some((v) => !v.trim())) {
        withEmptyValue++;
        fail(`${f}: Werkzeug "${marks[i].id}" hat einen leeren data-help-Wert`);
      }
    }
  }
  console.log(
    `    Gepruefte Werkzeug-Vorkommen: ${checked}   ohne eigenen Anker: ${withoutAnchor}   ` +
      `mit leerem Wert: ${withEmptyValue}   Soll: 0 / 0`
  );
}

/* ---- Zusicherungen 7 und 8: der Hilfetext beschreibt, was es GIBT ----
   Anlass (16.08.2026): der Betreiber fand einen Hilfesatz, der eine Zahlung
   versprach, die es nicht gibt („the stations that pay best" — die Rangliste
   zeigt ± % Raffinerie-Ertrag), und eine Vorzeile, die vier Tage lang Physik
   und Gesteinsarten nannte, obwohl beide auf eine andere Seite gezogen sind.
   Kein Tor sah das. Diese beiden hier sehen es AUCH NICHT — inhaltliche
   Richtigkeit ist maschinell nicht zu haben, und das soll hier offen stehen
   statt hinter einem gruenen Haken zu verschwinden.
   Was sie sehr wohl fangen, ist die haerteste Form desselben Zerfalls:
   Hilfe, die ins Leere zeigt. Genau das ist hier schon einmal passiert und
   steht in .planning/notes/mining-werkbank-defekte.md als Befund 8 — neun
   `mining.ctl.*` fuer Knoepfe, die der Werkbank-Umbau entfernt hatte.

   ⚠ Was hier BEWUSST NICHT geprueft wird: ob der Anker auf einem verborgenen
   Element sitzt. Gemessen am 16.08.2026 traefe das 18 Anker — davon sind 16
   der kontogebundene Refinery-Tracker, dessen Felder serverseitig `hidden`
   stehen und erst nach der Anmeldung per JS aufgehen. Ein Tor mit 89 %
   Fehlalarm ist schlechter als keins; „verborgen beim Bauen" heisst auf
   dieser Seite regelmaessig „wird spaeter eingeblendet". */
{
  const HELP_SRC = 'src/i18n/help.ts';
  const src = readFileSync(HELP_SRC, 'utf8');
  /* ⚠ Astro schreibt " als &#34;, NICHT als &quot;. Ohne die Zahlen-Entitaeten
     meldete ein erster Anlauf mining.ctl.shortlist als verwaist, obwohl der
     Anker danebenstand — der Pruefer war falsch, nicht der Bestand. */
  const unesc = (s) => s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  const entries = (re) => {
    const out = [];
    for (const m of src.matchAll(re)) out.push({ key: m[1], text: m[2].replace(/\\'/g, "'") });
    return out;
  };

  /* ---- 7: jeder *.ctl.*-Schluessel hat einen Anker im Bestand ---- */
  console.log('\n[7] Element-Hilfe zeigt auf etwas: jeder *.ctl.*-Schluessel braucht >=1 data-help-Anker in dist/');
  const ctlKeys = entries(/'([a-z0-9]+\.ctl\.[A-Za-z0-9]+)'\s*:\s*'((?:[^'\\]|\\.)*)'/g);
  const anchored = new Set();
  for (const f of htmlFiles) {
    const html = htmlCache.get(f);
    if (!html.includes('data-help=')) continue;
    for (const m of html.matchAll(/data-help="([^"]*)"/g)) anchored.add(unesc(m[1]));
  }
  const orphans = ctlKeys.filter((k) => !anchored.has(k.text));
  for (const o of orphans) fail(`${HELP_SRC}: "${o.key}" beschreibt ein Bedienelement, das es im Bestand nicht gibt`);
  console.log(`    *.ctl.*-Schluessel: ${ctlKeys.length}   verschiedene Anker: ${anchored.size}   ohne Anker: ${orphans.length}   Soll: 0`);

  /* ---- 8: jeder Schritt-/Zweck-/Titeltext wird auch ausgeliefert ----
     Faengt die Falle, in die dieser Durchgang selbst zweimal getappt ist:
     einen `mining.stepN` anlegen und `steps={N}` an ToolHelp zu erhoehen
     vergessen. Der Schluessel steht dann da und niemand liest ihn je. */
  console.log('\n[8] Anleitung wird auch ausgeliefert: jeder *.step/purpose/title-Text steht in einer gebauten Seite');
  const bodyKeys = entries(/'([a-z0-9]+\.(?:step\d+|purpose|title))'\s*:\s*'((?:[^'\\]|\\.)*)'/g);
  let helpHtml = '';
  for (const f of htmlFiles) {
    const html = htmlCache.get(f);
    if (html.includes('tool-help__')) helpHtml += unesc(html);
  }
  const unused = bodyKeys.filter((k) => !helpHtml.includes(k.text));
  for (const u of unused) fail(`${HELP_SRC}: "${u.key}" wird nirgends ausgeliefert (steps= am ToolHelp zu niedrig?)`);
  console.log(`    Schritt-/Zweck-/Titeltexte: ${bodyKeys.length}   nicht ausgeliefert: ${unused.length}   Soll: 0`);
}

console.log(`\nverify-help: ${ok ? 'ALLE ZUSICHERUNGEN ERFUELLT ✓' : 'FEHLGESCHLAGEN ✗'}`);
if (!ok) process.exit(1);
