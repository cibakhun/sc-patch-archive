/* ============================================================
   migrate-typo-motion.mjs

   Der ueberpruefbare Massendurchlauf fuer Phase 2 (Schrift- und
   Bewegungsskala). Vorbild: scripts/strip-cursorglow.mjs (Zwei-Pass,
   --dry, --only, Zwang auf Sollzahlen, lieber ein Rest von Hand als
   eine falsche automatische Ersetzung — "KEINE GRABSTEIN-KOMMENTARE"
   gilt sinngemaess: keine stillschweigenden Annahmen).

   Die Zuordnungslogik (Skala, Regex, Klassifikation, Dateisuche) ist
   NICHT hier ein zweites Mal geschrieben — sie lebt in
   scripts/lib/typo-motion.mjs und wird 1:1 mit
   scripts/audit-typo-motion.mjs geteilt. Zwei Regex-Fassungen
   derselben Regel wuerden auseinanderdriften, und dann meldet die
   Pruefung gruen, was dieser Durchlauf gar nicht angefasst hat.

   ------------------------------------------------------------
   WAS ERSETZT WIRD (siehe 02-03-PLAN.md Task 1):
     - font-size mit statischem px/rem-Wert       -> var(--fs-N)
     - letter-spacing mit statischem em-Wert/`0`  -> var(--ls-N)
     - transition-Teile, Dauer <= 350ms           -> var(--dur-*)
     - deren Kurve (ease/ease-out/ease-in-out,
       jedes cubic-bezier(...), oder ein lokaler
       Alias-Token wie --ease/--ease-out/--dp-ease,
       dessen EIGENE Definition auf eine solche
       Kurve zeigt)                                -> var(--ease-ui)
       Fehlt die Kurve ganz, wird sie ergaenzt (D-04/D-07,
       Erfolgskriterium 2: Dauer UND Kurve teilen sich, sonst
       bleiben zwei Bewegungssprachen nebeneinander).

   WAS VERWEIGERT WIRD (und mit Datei+Zeile+Wert gemeldet, damit es
   von Hand abgearbeitet werden kann):
     - font-size in em (elternrelativ, D-05 gilt hier nicht)
     - unbekannte/nicht parsbare Werte ("other")
     - jede Ersetzung, deren Abweichung zur naechsten Stufe zu gross
       waere. ZWEI verschiedene, je nach Eigenschaft ETABLIERTE
       Schwellen (siehe 02-01-PLAN.md, nicht neu erfunden):
         * font-size:      deviationPct > 6%   (relativ)
         * letter-spacing: deviationEm  > 0.02em (absolut — die
           Laufweiten-Stufen liegen nur 0.01-0.02em auseinander,
           eine relative 6%-Schwelle waere dort bei JEDEM zweiten
           Wert ausgeloest und keine sinnvolle Schwelle)
       (02-03-PLAN.md Task 1 nennt pauschal "6%" — das ist die
       font-size-Schwelle aus 02-01-PLAN.md; fuer letter-spacing gilt
       dort ausdruecklich eine absolute Schwelle, siehe "3 von 855
       Werten verschieben sich um mehr als 0.02em".)
     - transition-Teile mit mehr als einer Zeitangabe (Dauer+Delay
       nicht sicher unterscheidbar — lieber verweigern als raten)
     - transition-Teile, deren Dauer in keine der drei Stufen faellt
       (die Luecken 170-180ms/220-240ms zwischen den Bereichen)

   Kategorien, die NIE angefasst und NICHT gemeldet werden (bereits
   etablierte, dauerhafte Ausnahmen aus Plan 01/RESEARCH):
     token (schon var(...)), clamp() (fluide Formel bleibt),
     dynamische style={`...`}-Werte, die Hero-Ausnahme
     (.hero__mark h1), `normal` (letter-spacing-Schluesselwort),
     Ambiente-transition (Dauer > 350ms ODER Scroll-Reveal-Selektor),
     `transition: none`, `linear`/`steps()` als Kurve (Dauer darf auf
     die Skala, die Kurve bleibt woertlich stehen) und `animation:` in
     jeder Form (wird von den Regex hier gar nicht erst erfasst).

   ------------------------------------------------------------
   Schalter:
     --dry              schreibt nichts, meldet nur Soll/Ist je Datei
     --only <Praefix>   mehrfach angebbar; OHNE --only verweigert das
                         Skript den Dienst -- ein unbeaufsichtigter
                         Lauf ueber alle ~95 Dateien ist genau das,
                         was die Plaene 03-06 in kontrollierte
                         Portionen zerlegen sollen.
     --expect <n>       erwartete GESAMTZAHL der Ersetzungen ueber
                         alle --only-Treffer; Abbruch (Code 1) bei
                         Abweichung, VOR jedem Schreiben.

   Zwei-Pass-Ablauf: Pass 1 (immer) berechnet alle Edits/Verweigerungen
   im Speicher und prueft --expect, falls gesetzt. Nur wenn Pass 1
   fehlerfrei ist UND --dry NICHT gesetzt ist, schreibt Pass 2 die
   Dateien. Nach jedem Schreiblauf: Zusicherung, dass sich die Anzahl
   der NICHT von \r begleiteten \n-Zeichen (bare LF) nicht veraendert
   hat -- unsere Ersetzungen fuegen selbst nie ein \n ein, diese
   Zusicherung waere also nur bei einem Programmierfehler in der
   Offset-Rechnung verletzt. Sie ist der mechanische Beleg dafuer,
   dass kein Zeilenendewechsel als Riesendiff im Commit auftaucht.
   ============================================================ */

import { readFileSync, writeFileSync } from 'node:fs';
import {
  AMBIENT_SELECTOR_RE,
  DUR_RANGES,
  FS_RE,
  HERO_EXCEPTION_SELECTOR_RE,
  LINEAR_OR_STEPS_RE,
  LS_RE,
  TR_RE,
  allTargetFiles,
  classifyFontSizeValue,
  classifyLetterSpacingValue,
  classifyTransitionPart,
  durTokenFor,
  getStyleText,
  lineOf,
  nearestSelector,
  splitTopLevelWithSpans,
} from './lib/typo-motion.mjs';

const OUTLIER_FS_PCT = 6; // 02-01-PLAN.md § "Die Skala": ">6% verschieben sich" (7 von 1634)
const OUTLIER_LS_EM = 0.02; // 02-01-PLAN.md § "Laufweiten-Stufen": ">0.02em verschieben sich" (3 von 855)

const DURATION_RE = /(-?[\d.]+)(ms|s)\b/;
const CURVE_KEYWORD_SRC = '(?<!-)\\b(?:ease-in-out|ease-in|ease-out|ease)\\b';
const CURVE_CUBIC_BEZIER_SRC = 'cubic-bezier\\([^)]*\\)';

/* ---------------------------------------------------------- */
/* CLI */

function collectFlagValues(flag) {
  const vals = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === flag) vals.push(process.argv[i + 1]);
  }
  return vals;
}

const DRY = process.argv.includes('--dry');
const ONLY = collectFlagValues('--only').filter(Boolean);
const EXPECT = (() => {
  const i = process.argv.indexOf('--expect');
  return i !== -1 ? Number(process.argv[i + 1]) : null;
})();

if (ONLY.length === 0) {
  console.error(
    'Abbruch: kein --only angegeben. Ein unbeaufsichtigter Lauf ueber alle Dateien ist ' +
      'nicht vorgesehen (02-03-PLAN.md Task 1) — mit --only <Pfadpraefix> eingrenzen ' +
      '(mehrfach angebbar).'
  );
  process.exit(1);
}

const allFiles = allTargetFiles();
const targetFiles = allFiles.filter((f) => ONLY.some((prefix) => f.includes(prefix)));

/* ---------------------------------------------------------- */
/* Lokale Kurven-Aliase: ein Datei-eigener Custom-Property-Name, dessen
   EIGENE Definition auf eine der zu vereinheitlichenden Kurven zeigt
   (assets/archive.css: --ease/--ease-out; assets/data-page.css:
   --dp-ease — alle drei sind Belege fuer D-04/Pattern 2 der
   Recherche: "das bestehende --ease/--ease-out ist ein Praezedenzfall,
   kein Neuland"). Nur SOLCHE var(--X)-Referenzen werden als Kurve
   erkannt — nicht jeder beliebige lokale Name. */
function buildLocalEaseAliasSet(raw) {
  const set = new Set();
  const re = /--([\w-]+)\s*:\s*([^;}]+)[;}]/g;
  let m;
  while ((m = re.exec(raw))) {
    const value = m[2].trim();
    if (/^(ease-in-out|ease-in|ease-out|ease)$/.test(value) || value.includes('cubic-bezier(')) {
      set.add(`--${m[1]}`);
    }
  }
  return set;
}

function buildCurveRe(aliasSet) {
  const parts = [];
  if (aliasSet.size) {
    const aliasAlt = [...aliasSet]
      .map((n) => n.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'))
      .map((n) => `var\\(${n}\\)`)
      .join('|');
    parts.push(aliasAlt);
  }
  parts.push(CURVE_CUBIC_BEZIER_SRC);
  parts.push(CURVE_KEYWORD_SRC);
  return new RegExp(parts.join('|'), 'd');
}

function bareLfCount(text) {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n' && text[i - 1] !== '\r') n++;
  }
  return n;
}

/* ---------------------------------------------------------- */
/* Pro-Datei-Durchlauf: berechnet Edits + Verweigerungen, schreibt NICHTS */

function processFile(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const edits = []; // { start, end, text }
  const refusals = []; // { line, kind, value, reason }
  let replaced = 0;

  /* --- font-size (ganze Datei, wie im Audit) --- */
  {
    const re = new RegExp(FS_RE.source, 'gd');
    let m;
    while ((m = re.exec(raw))) {
      const [vs, ve] = m.indices[1];
      const isHero = HERO_EXCEPTION_SELECTOR_RE.test(nearestSelector(raw, m.index));
      const c = classifyFontSizeValue(m[1], isHero);
      const line = lineOf(raw, vs);
      if (c.cat === 'em') {
        refusals.push({ line, kind: 'font-size', value: c.raw, reason: 'em ist elternrelativ (D-05 gilt hier nicht)' });
      } else if (c.cat === 'other') {
        refusals.push({ line, kind: 'font-size', value: c.raw, reason: 'unbekanntes Wertformat' });
      } else if (c.cat === 'skalenpflichtig') {
        if (c.nearest.deviationPct > OUTLIER_FS_PCT) {
          refusals.push({
            line,
            kind: 'font-size',
            value: c.raw,
            reason: `Abweichung ${c.nearest.deviationPct.toFixed(2)}% zur naechsten Stufe ${c.nearest.step.name} (> ${OUTLIER_FS_PCT}%) — Menschen-Entscheidung noetig`,
          });
        } else {
          edits.push({ start: vs, end: ve, text: `var(${c.nearest.step.name})` });
          replaced++;
        }
      }
      /* token/clamp/dynamic/hero-exception: etablierte Dauerausnahmen, kein Eintrag */
    }
  }

  /* --- letter-spacing (ganze Datei) --- */
  {
    const re = new RegExp(LS_RE.source, 'gd');
    let m;
    while ((m = re.exec(raw))) {
      const [vs, ve] = m.indices[1];
      const isHero = HERO_EXCEPTION_SELECTOR_RE.test(nearestSelector(raw, m.index));
      const c = classifyLetterSpacingValue(m[1], isHero);
      const line = lineOf(raw, vs);
      if (c.cat === 'other') {
        refusals.push({ line, kind: 'letter-spacing', value: c.raw, reason: 'unbekanntes Wertformat' });
      } else if (c.cat === 'skalenpflichtig') {
        /* Epsilon gegen Gleitkomma-Rauschen: 0.26-0.24 ergibt in JS
           0.020000000000000018 statt exakt 0.02 — ohne Tolerenz wuerde
           ein Wert, der GENAU einen Rasterschritt entfernt liegt, je
           nach Rundungsrichtung mal als Ausreisser gelten, mal nicht
           (siehe assets/detail.css:142 vs. eine `.3em`-Fundstelle mit
           spiegelbildlichem Rundungsfehler in die andere Richtung). */
        if (c.nearest.deviationEm > OUTLIER_LS_EM + 1e-9) {
          refusals.push({
            line,
            kind: 'letter-spacing',
            value: c.raw,
            reason: `Abweichung ${c.nearest.deviationEm.toFixed(3)}em zur naechsten Stufe ${c.nearest.step.name} (> ${OUTLIER_LS_EM}em) — Menschen-Entscheidung noetig`,
          });
        } else {
          edits.push({ start: vs, end: ve, text: `var(${c.nearest.step.name})` });
          replaced++;
        }
      }
      /* token/dynamic/hero-exception/keyword(normal): etablierte Ausnahmen, kein Eintrag */
    }
  }

  /* --- transition (nur innerhalb von <style>-Bloecken / *.css ganz) --- */
  {
    const aliasSet = buildLocalEaseAliasSet(raw);
    const curveRe = buildCurveRe(aliasSet);
    const blocks = getStyleText(raw, filePath);
    for (const block of blocks) {
      const styleText = block.text;
      const blockOffset = block.offset;
      const re = new RegExp(TR_RE.source, 'gd');
      let m;
      while ((m = re.exec(styleText))) {
        const selector = nearestSelector(styleText, m.index);
        const ambientSelector = AMBIENT_SELECTOR_RE.test(selector);
        const [valStart] = m.indices[1];
        const valueText = m[1];
        const spans = splitTopLevelWithSpans(valueText);
        for (const span of spans) {
          const partText = span.text; // roh, inkl. umgebendem Leerraum, OHNE Komma
          const trimmed = partText.trim();
          if (!trimmed) continue;
          const c = classifyTransitionPart(trimmed, ambientSelector);
          const absBase = blockOffset + valStart + span.start;
          const line = lineOf(raw, absBase);
          if (c.cat !== 'ui') continue; // none/ambient/dynamic/token/other: unangetastet, kein Eintrag

          const durMatches = [...partText.matchAll(new RegExp(DURATION_RE.source, 'g'))];
          if (durMatches.length !== 1) {
            refusals.push({
              line,
              kind: 'transition',
              value: trimmed,
              reason: `mehrdeutige Zeitangabe (${durMatches.length} Zeitwerte im Teil) — Dauer/Verzoegerung nicht sicher unterscheidbar`,
            });
            continue;
          }
          const durMatch = new RegExp(DURATION_RE.source, 'd').exec(partText);
          const [ds, de] = durMatch.indices[0];
          const ms = durMatch[2] === 's' ? parseFloat(durMatch[1]) * 1000 : parseFloat(durMatch[1]);
          const durToken = durTokenFor(ms);
          if (!durToken) {
            refusals.push({
              line,
              kind: 'transition',
              value: trimmed,
              reason: `Dauer ${ms}ms faellt in keine der drei Stufen (Luecke zwischen den Bereichen)`,
            });
            continue;
          }

          edits.push({ start: absBase + ds, end: absBase + de, text: `var(${durToken})` });
          replaced++;

          if (!c.keepsOwnCurve) {
            const curveMatch = curveRe.exec(partText);
            if (curveMatch) {
              const [cs, ce] = curveMatch.indices[0];
              edits.push({ start: absBase + cs, end: absBase + ce, text: 'var(--ease-ui)' });
            } else {
              edits.push({ start: absBase + de, end: absBase + de, text: ' var(--ease-ui)' });
            }
          }
          /* keepsOwnCurve (linear/steps()): Dauer ist jetzt Token, Kurve bleibt woertlich stehen */
        }
      }
    }
  }

  return { file: filePath, raw, edits, refusals, replaced };
}

function applyEdits(raw, edits) {
  const sorted = [...edits].sort((a, b) => b.start - a.start || b.end - a.end);
  let out = raw;
  for (const e of sorted) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  return out;
}

/* ---------------------------------------------------------- */
/* Pass 1: alles berechnen, nichts schreiben */

const results = targetFiles.map(processFile);
const totalReplaced = results.reduce((sum, r) => sum + r.replaced, 0);
const totalRefused = results.reduce((sum, r) => sum + r.refusals.length, 0);

console.log(
  `migrate-typo-motion: ${targetFiles.length} Datei(en) im Umfang (--only ${ONLY.join(', ')})${DRY ? ' — Trockenlauf' : ''}\n`
);

for (const r of results) {
  if (r.replaced === 0 && r.refusals.length === 0) continue;
  console.log(`${r.file}: ersetzt: ${r.replaced}, verweigert: ${r.refusals.length}`);
  for (const ref of r.refusals) {
    console.log(`  ! ${r.file}:${ref.line}  [${ref.kind}] ${JSON.stringify(ref.value)} — ${ref.reason}`);
  }
}

console.log(`\nGesamt: ersetzt: ${totalReplaced}, verweigert: ${totalRefused}`);

let ok = true;

if (EXPECT !== null && totalReplaced !== EXPECT) {
  console.error(`\nFEHLER: erwartete Ersetzungszahl weicht ab (Soll ${EXPECT}, Ist ${totalReplaced}). Es wird NICHTS geschrieben.`);
  ok = false;
}

if (!ok) process.exit(1);

if (DRY) {
  console.log('\nTrockenlauf: nichts geschrieben.');
  process.exit(0);
}

/* ---------------------------------------------------------- */
/* Pass 2: schreiben, mit Zeilenenden-Zusicherung je Datei */

let written = 0;
for (const r of results) {
  if (r.edits.length === 0) continue;
  const before = bareLfCount(r.raw);
  const newContent = applyEdits(r.raw, r.edits);
  const after = bareLfCount(newContent);
  if (before !== after) {
    console.error(
      `FEHLER: ${r.file} — Zeilenenden veraendert (bare-LF vorher ${before}, nachher ${after}). ` +
        `Datei NICHT geschrieben, Lauf abgebrochen.`
    );
    process.exit(1);
  }
  writeFileSync(r.file, newContent);
  written++;
}

console.log(`\n${written} Datei(en) geschrieben, ${totalReplaced} Ersetzungen insgesamt.`);
