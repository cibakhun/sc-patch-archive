/* ============================================================
   audit-typo-motion.mjs

   Erhebungswerkzeug fuer Phase 2 (Schrift- und Bewegungsskala).
   Schreibt NICHTS — reiner Soll/Ist-Bericht. Vorbild fuer Stil und
   Ausgabeform: scripts/strip-cursorglow.mjs (Soll/Ist-Zeilen,
   deutschsprachiger Kopfkommentar, --only zur Eingrenzung).

   Durchsucht rekursiv alle *.astro-Dateien unterhalb von src/ (ohne
   node_modules/dist/public) und die Dateien direkt unter assets/ mit
   der Endung .css nach `font-size`,
   `letter-spacing` und `transition`.

   Die eigentliche Zuordnungslogik (Skala, Regex, Klassifikation,
   Dateisuche) lebt seit 02-03-PLAN.md Task 1 in
   scripts/lib/typo-motion.mjs — gemeinsam mit
   scripts/migrate-typo-motion.mjs genutzt, damit beide Werkzeuge
   NIE auseinanderdriften koennen. Dieses Skript ist nur noch
   Berichtsausgabe + die site-weiten Sollzahlen.

   ⚠⚠ Werte-Extraktion NUR mit dem Muster [^;}]+[;}] — ein Muster,
   das nur bis zum naechsten Semikolon sucht, frisst bei kompaktem
   CSS ohne Semikolon vor der schliessenden Klammer die halbe
   Folgeregel mit (siehe 02-RESEARCH.md, Anti-Patterns).

   Rechnet px/rem in effektive Pixel um, Basis 18 — NICHT 16:
   src/layouts/Layout.astro setzt html{font-size:112.5%}, 1rem ist
   auf dieser Seite effektiv 18px.

   Klassifiziert `transition`-Teile nach der mechanischen Regel aus
   02-01-PLAN.md § "Bedienübergang oder Ambiente":
     - Teil-Dauer <= 350ms UND nicht Teil einer Scroll-Reveal-Regel
       (.reveal / .node.lit / .era*) => Bedienübergang (auf die Skala)
     - alles andere => Ambiente (bleibt woertlich stehen)
   `linear`/`steps()` und `transition: none` sind eigene Ausnahmen:
   ihre Dauer darf auf die Skala, ihre Kurve/ihr Wert bleibt.

   Ausschlussliste (nicht skalenpflichtig, werden gezaehlt aber nicht
   als "Restwert" gegen die Skala gehalten):
     - `em`-Schriftgrade (elternrelativ, D-05 gilt hier nicht)
     - `clamp()`-Formeln (fluid, Formel bleibt)
     - dynamische `style={\`...\`}`-Werte (zur Bauzeit unbekannt —
       erkennbar daran, dass das rohe Bracket-Muster [^;}]+ an einem
       `${...}`-Interpolationsende vorzeitig abbricht und dadurch ein
       `$`/`{` im Rohwert traegt)

   Aufrufe:
     node scripts/audit-typo-motion.mjs
       Gesamtbericht ueber alle Dateien (reproduziert die Zahlen aus
       02-01-PLAN.md § "Die Skala": 1968 font-size / 95 Dateien /
       865 letter-spacing / 663 Bedienuebergang-Teile).

     node scripts/audit-typo-motion.mjs --only <Pfadpraefix>
       Beschraenkt den Bericht auf Dateien, deren Pfad das Praefix
       enthaelt.

     node scripts/audit-typo-motion.mjs --expect-remaining <n>
       Zaehlt die "Restwerte" (skalenpflichtige Rohwerte, die noch
       KEIN var(--fs-*)/var(--ls-*)/var(--dur-*) sind) im gewaehlten
       Dateiumfang und beendet mit Rueckgabecode 1, wenn die Zahl
       von <n> abweicht. Kombinierbar mit --only.
   ============================================================ */

import { readFileSync } from 'node:fs';
import {
  HERO_EXCEPTION_SELECTOR_RE,
  AMBIENT_SELECTOR_RE,
  DYNAMIC_STYLE_ATTR_RE,
  FS_RE,
  LS_RE,
  TR_RE,
  allTargetFiles,
  classifyFontSizeValue,
  classifyLetterSpacingValue,
  classifyTransitionPart,
  getStyleText,
  nearestSelector,
  splitTopLevel,
} from './lib/typo-motion.mjs';

/* Diese Zahlen sind KEINE Abschrift aus 02-01-PLAN.md § "Die Skala"
   (1968/95/865/663) — jene Zahlen waren die Prosa-Schaetzung der
   Recherche VOR diesem Werkzeug. Ein rigoroser Nachvollzug mit diesem
   Skript UND einer unabhaengigen `grep -c`-Gegenprobe (siehe
   02-01-SUMMARY.md § Deviations) ergab den tatsaechlichen, minimal
   abweichenden Ist-Stand — u. a. weil eine statische
   `style="font-size:44px"`-Zuweisung (AccountDashboard.astro) in der
   urspruenglichen Schaetzung fehlte. Diese Konstanten sind die
   nachgemessene, verifizierte Grundgesamtheit. */
const EXPECTED = { fontSize: 1961, files: 96, letterSpacing: 863, uiTransitionParts: 660 };

/* --only ist mehrfach angebbar (wie in migrate-typo-motion.mjs) -- die
   <verify>-Befehle der Plaene 04-06 rufen dieses Skript wiederholt mit
   mehreren --only-Praefixen in EINEM Aufruf auf, um mehrere Dateien/
   Verzeichnisse in einem Bericht zu pruefen. Eine einzelwertige Fassung
   wuerde dort stillschweigend nur das ERSTE Praefix beachten. */
function collectFlagValues(flag) {
  const vals = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === flag) vals.push(process.argv[i + 1]);
  }
  return vals;
}

const ONLY = collectFlagValues('--only').filter(Boolean);
const EXPECT_REMAINING = (() => {
  const i = process.argv.indexOf('--expect-remaining');
  return i !== -1 ? Number(process.argv[i + 1]) : null;
})();

const allFiles = allTargetFiles();
const targetFiles = ONLY.length ? allFiles.filter((f) => ONLY.some((prefix) => f.includes(prefix))) : allFiles;

/* ---------------------------------------------------------- */
/* Hauptdurchlauf */

const stats = {
  filesTouched: new Set(),
  fontSize: { total: 0, cats: {} },
  letterSpacing: { total: 0, cats: {} },
  transitionParts: { total: 0, ui: 0, ambient: 0, none: 0, dynamic: 0, other: 0, token: 0 },
  dynamicStyleAttrs: 0,
  remaining: 0,
  perFile: [],
};

function bump(obj, key) {
  obj[key] = (obj[key] || 0) + 1;
}

for (const file of targetFiles) {
  const src = readFileSync(file, 'utf8');
  let touched = false;
  let fileRemaining = 0;

  if (!file.endsWith('.css')) {
    const dyn = src.match(DYNAMIC_STYLE_ATTR_RE);
    if (dyn) stats.dynamicStyleAttrs += dyn.length;
  }

  const styleBlocks = getStyleText(src, file);

  /* font-size — ganze Datei (nicht nur <style>-Bloecke): trifft auch die
     wenigen rohen style="font-size:…"-Attribute im Markup, die keinen
     eigenen <style>-Block haben. */
  {
    const re = new RegExp(FS_RE.source, 'g');
    let m;
    while ((m = re.exec(src))) {
      touched = true;
      stats.fontSize.total++;
      const isHero = HERO_EXCEPTION_SELECTOR_RE.test(nearestSelector(src, m.index));
      const c = classifyFontSizeValue(m[1], isHero);
      bump(stats.fontSize.cats, c.cat);
      if (c.cat === 'skalenpflichtig') fileRemaining++;
    }
  }

  /* letter-spacing — ganze Datei, siehe font-size oben */
  {
    const re = new RegExp(LS_RE.source, 'g');
    let m;
    while ((m = re.exec(src))) {
      touched = true;
      stats.letterSpacing.total++;
      const isHero = HERO_EXCEPTION_SELECTOR_RE.test(nearestSelector(src, m.index));
      const c = classifyLetterSpacingValue(m[1], isHero);
      bump(stats.letterSpacing.cats, c.cat);
      if (c.cat === 'skalenpflichtig') fileRemaining++;
    }
  }

  /* transition — gebraucht Selektor-Kontext fuer die Scroll-Reveal-Ausnahme */
  {
    for (const block of styleBlocks) {
      const styleText = block.text;
      const re = new RegExp(TR_RE.source, 'g');
      let m;
      while ((m = re.exec(styleText))) {
        touched = true;
        const selector = nearestSelector(styleText, m.index);
        const ambientSelector = AMBIENT_SELECTOR_RE.test(selector);
        const parts = splitTopLevel(m[1]);
        for (const part of parts) {
          stats.transitionParts.total++;
          const c = classifyTransitionPart(part, ambientSelector);
          bump(stats.transitionParts, c.cat === 'ui' ? 'ui' : c.cat);
          if (c.cat === 'ui') fileRemaining++;
        }
      }
    }
  }

  if (touched) stats.filesTouched.add(file);
  if (fileRemaining > 0) stats.perFile.push({ file, remaining: fileRemaining });
  stats.remaining += fileRemaining;
}

/* ---------------------------------------------------------- */
/* Bericht */

console.log(`audit-typo-motion: ${targetFiles.length} Datei(en) durchsucht${ONLY.length ? ` (--only ${ONLY.join(', ')})` : ''}\n`);

console.log(`Dateien mit mind. einem Treffer (font-size/letter-spacing/transition): ${stats.filesTouched.size}` +
  (ONLY.length ? '' : `   Soll: ${EXPECTED.files}`));

console.log(`\nfont-size gesamt: ${stats.fontSize.total}` + (ONLY.length ? '' : `   Soll: ${EXPECTED.fontSize}`));
for (const [cat, n] of Object.entries(stats.fontSize.cats).sort()) {
  console.log(`  - ${cat}: ${n}`);
}

console.log(`\nletter-spacing gesamt: ${stats.letterSpacing.total}` + (ONLY.length ? '' : `   Soll: ${EXPECTED.letterSpacing}`));
for (const [cat, n] of Object.entries(stats.letterSpacing.cats).sort()) {
  console.log(`  - ${cat}: ${n}`);
}

console.log(`\ntransition-Teile gesamt: ${stats.transitionParts.total}`);
console.log(`  - Bedienuebergang (ui): ${stats.transitionParts.ui}` + (ONLY.length ? '' : `   Soll: ${EXPECTED.uiTransitionParts}`));
console.log(`  - Ambiente: ${stats.transitionParts.ambient || 0}`);
console.log(`  - none: ${stats.transitionParts.none || 0}`);
console.log(`  - bereits Token: ${stats.transitionParts.token || 0}`);
console.log(`  - dynamisch: ${stats.transitionParts.dynamic || 0}`);
console.log(`  - sonstige: ${stats.transitionParts.other || 0}`);

console.log(`\ndynamische style={\`…\`}-Zuweisungen ausserhalb von <style> (Pitfall 5, ausgenommen): ${stats.dynamicStyleAttrs}`);

console.log(`\nRestwerte (skalenpflichtig, noch kein var(--fs-*)/var(--ls-*)/var(--dur-*)): ${stats.remaining}`);
if (stats.perFile.length && (ONLY.length || stats.perFile.length <= 20)) {
  for (const { file, remaining } of stats.perFile.slice(0, 20)) {
    console.log(`  ! ${file}: ${remaining}`);
  }
  if (stats.perFile.length > 20) console.log(`  ... und ${stats.perFile.length - 20} weitere Dateien`);
}

let ok = true;

if (!ONLY.length) {
  if (stats.filesTouched.size !== EXPECTED.files) {
    console.error(`\nFEHLER: Dateizahl weicht ab (Soll ${EXPECTED.files}, Ist ${stats.filesTouched.size})`);
    ok = false;
  }
  if (stats.fontSize.total !== EXPECTED.fontSize) {
    console.error(`FEHLER: font-size gesamt weicht ab (Soll ${EXPECTED.fontSize}, Ist ${stats.fontSize.total})`);
    ok = false;
  }
  if (stats.letterSpacing.total !== EXPECTED.letterSpacing) {
    console.error(`FEHLER: letter-spacing gesamt weicht ab (Soll ${EXPECTED.letterSpacing}, Ist ${stats.letterSpacing.total})`);
    ok = false;
  }
  /* ui + token statt nur ui: sobald ein spaeterer Plan eine Datei umstellt,
     wandern ihre Teile von "ui" (noch roh) nach "token" (var(--dur-*)) —
     die GESAMTZAHL der Bedienuebergaenge aendert sich dadurch nicht, nur
     der Anteil, der schon umgestellt ist. Ein Vergleich gegen "ui" allein
     wuerde nach jedem weiteren Plan faelschlich als Regression melden. */
  const uiPlusToken = stats.transitionParts.ui + (stats.transitionParts.token || 0);
  if (uiPlusToken !== EXPECTED.uiTransitionParts) {
    console.error(
      `FEHLER: Bedienuebergang-Teile (roh + bereits Token) weichen ab (Soll ${EXPECTED.uiTransitionParts}, Ist ${uiPlusToken})`
    );
    ok = false;
  }
}

if (EXPECT_REMAINING !== null) {
  console.log(`\nErwartete Restwerte: ${EXPECT_REMAINING}   Ist: ${stats.remaining}`);
  if (stats.remaining !== EXPECT_REMAINING) {
    console.error(`FEHLER: Restwerte weichen von --expect-remaining ${EXPECT_REMAINING} ab (Ist ${stats.remaining})`);
    ok = false;
  }
}

console.log(`\naudit-typo-motion: ${ok ? 'OK' : 'ABWEICHUNG'}`);
if (!ok) process.exit(1);
