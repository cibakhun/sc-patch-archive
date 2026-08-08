/* ============================================================
   migrate-layers.mjs — Massendurchlauf ueber die 19 Patch-Koerper
   (Phase 3, Plan 04). Vorbild: scripts/migrate-typo-motion.mjs
   (Trockenlauf als Standard, --apply schreibt, Soll-/Ist-Zeile je
   Datei, Abbruch mit Rueckgabecode 1 bei jeder Abweichung — es raet
   nichts und ueberspringt nichts still).

   WARUM: die 19 Patch-Koerper verlinken assets/detail.css NICHT —
   jede Aenderung am geteilten System (Plan 01/02) geht an ihnen
   vorbei. Dieser Lauf repliziert dieselbe Form woertlich aus
   03-02-SUMMARY.md in jeden der 19 Koerper.

   ⚠ Ein LINIENBASIERTER Massendurchlauf hat diese Phase bereits
   einmal gebissen (Plan 03, PilotPage.astro: ein eingebetteter \r
   OHNE folgendes \n liess einen zeilenweisen Entferner das
   schliessende </style> mitreissen — der Build lief trotzdem
   durch). Dieses Skript arbeitet deshalb NIE zeilenweise: jede
   Aenderung ist ein Volltext-Ersatz eines woertlich bekannten,
   vorab auf Eindeutigkeit geprueften Blocks (String.replace mit
   einer als einmalig verifizierten Nadel), keine Regex-Erfassung
   ueber Zeilengrenzen. Zusaetzlich wird jede Datei vor jeder
   Aenderung auf eingebettete \r-ohne-\n / \n-ohne-\r-Artefakte
   geprueft und bricht bei einem Fund ab, statt zu raten.

   Vier Umschreibungen je Koerper (siehe 03-04-PLAN.md):
     (a) body::after begrenzen — derselbe Wortlaut wie
         assets/detail.css (Plan 01), Zeilenraster faellt aus der
         background-Liste, beide Masken-Schreibweisen kommen dazu.
     (b) Rasterschichten anlegen — je vorhandenem Ziel
         (.hero, .shot, .tile.img, .video, .ship) eine neue
         ::before-Regel, woertlich derselbe Text wie im geteilten
         System. Vor dem Schreiben wird JE ZIEL geprueft, dass die
         zugehoerige Container-Regel positioniert ist UND beschneidet
         (position:relative|sticky + overflow:hidden) — fehlt das,
         bricht der Lauf fuer diese Datei ab.
     (c) Den Beobachter heilen — derselbe Sichtbarkeitsanteil-Fix
         wie assets/detail.js (Plan 01): rootMargin statt threshold.
     (d) Nichts anderes — jede neu geschriebene Regel besteht
         ausschliesslich aus Eigenschaften der Erlaubnisliste unten;
         das wird einmalig gegen die Vorlagen selbst bewiesen
         (assertAllowedProps), nicht nur behauptet.

   Zusaetzliche Invarianten (aus den measured_targets des Plans),
   je Datei UND ueber alle 19 gerechnet, VOR jedem Schreiben:
     - animation:-Deklarationen unveraendert (Ist 133)
     - transition:-Deklarationen unveraendert (Ist 160)
     - Menge der referenzierten Bilddateien (url(...)) unveraendert
   Eine Abweichung in irgendeiner dieser Zahlen ist ein Abbruchgrund
   — der Durchlauf haette dann Bewegung oder ein Bildmotiv angefasst,
   was ausdruecklich nicht sein darf.

   Schalter:
     (ohne)     Trockenlauf — meldet nur Soll/Ist, schreibt nichts.
     --apply    schreibt, aber nur wenn Pass 1 (Berechnung + alle
                Zusicherungen) fehlerfrei war.

     node scripts/migrate-layers.mjs
     node scripts/migrate-layers.mjs --apply
   ============================================================ */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const APPLY = process.argv.includes('--apply');

/* ---------------------------------------------------------- */
/* Zieldateien: alle 19 Patch-Koerper, keine --only-Eingrenzung
   noetig (der Umfang ist per Plan fest: alle 19). */

const PATCH_DIR = 'src/components/patches';
const targetFiles = readdirSync(PATCH_DIR)
  .filter((f) => /^sc-4-[\d-]+\.astro$/.test(f))
  .sort()
  .map((f) => join(PATCH_DIR, f).replace(/\\/g, '/'));

const EXPECT_FILES = 19;
const EXPECT_BODY_AFTER = 19;
const EXPECT_RASTER = 87; // 19 hero + 19 shot + 19 tile.img + 17 video + 13 ship
const EXPECT_OBSERVER = 19;

/* ---------------------------------------------------------- */
/* Woertliche Texte. body::after (neu) und die Rasterregel-Form
   sind woertlich aus assets/detail.css uebernommen (Plan 01/02,
   03-02-SUMMARY.md "Die Endform der Rasterregel") — hier nicht neu
   formuliert. */

const OLD_BODY_AFTER =
  'body::after{content:"";position:fixed;inset:0;z-index:9000;pointer-events:none;background:radial-gradient(130% 115% at 50% 42%,transparent 54%,var(--vignette) 100%),repeating-linear-gradient(0deg,var(--scanline) 0 1px,transparent 1px 3px);opacity:var(--ambient-opacity)}';

const NEW_BODY_AFTER =
  'body::after{content:"";position:fixed;inset:0;z-index:9000;pointer-events:none;background:radial-gradient(130% 115% at 50% 42%,transparent 54%,var(--vignette) 100%);opacity:var(--ambient-opacity);-webkit-mask-image:linear-gradient(90deg,#000 0,#000 calc(50% - var(--maxw)/2 - 80px),transparent calc(50% - var(--maxw)/2),transparent calc(50% + var(--maxw)/2),#000 calc(50% + var(--maxw)/2 + 80px),#000 100%);mask-image:linear-gradient(90deg,#000 0,#000 calc(50% - var(--maxw)/2 - 80px),transparent calc(50% - var(--maxw)/2),transparent calc(50% + var(--maxw)/2),#000 calc(50% + var(--maxw)/2 + 80px),#000 100%)}';

function rasterRule(selector) {
  return `${selector}::before{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:repeating-linear-gradient(0deg,var(--scanline) 0 1px,transparent 1px 3px);opacity:var(--ambient-opacity)}`;
}

const OLD_OBSERVER =
  "const io=new IntersectionObserver((es)=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.1});";
const NEW_OBSERVER =
  "const io=new IntersectionObserver((es)=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{rootMargin:'0px 0px -10% 0px',threshold:0});";

/* ---------------------------------------------------------- */
/* (d) Erlaubnisliste: welche Eigenschaften in einer NEU
   geschriebenen Regel vorkommen duerfen. Wird einmalig gegen die
   Vorlagen selbst bewiesen (nicht gegen fremden, unbekannten Text —
   wir schreiben ausschliesslich woertlich bekannte Bloecke). */

const ALLOWED_PROPS = new Set([
  'content',
  'position',
  'inset',
  'z-index',
  'pointer-events',
  'background',
  'opacity',
  '-webkit-mask-image',
  'mask-image',
]);

function assertAllowedProps(cssRuleText, label) {
  const body = cssRuleText.slice(cssRuleText.indexOf('{') + 1, cssRuleText.lastIndexOf('}'));
  for (const decl of body.split(';')) {
    const t = decl.trim();
    if (!t) continue;
    const prop = t.split(':')[0].trim();
    if (!ALLOWED_PROPS.has(prop)) {
      throw new Error(`Erlaubnisliste verletzt in "${label}": Eigenschaft "${prop}" ist nicht zugelassen`);
    }
  }
}

// Selbsttest der Vorlagen — bricht den GESAMTEN Lauf ab (Programmierfehler),
// bevor auch nur eine Datei gelesen wird.
assertAllowedProps(NEW_BODY_AFTER, 'body::after (neu)');
for (const sel of ['.hero', '.shot', '.tile.img', '.video', '.ship']) {
  assertAllowedProps(rasterRule(sel), `${sel}::before (neu)`);
}

/* ---------------------------------------------------------- */
/* Archetypen-Register: Anker (bereits vorhandene, eindeutige Regel,
   an der die neue ::before-Regel angehaengt wird) + Container-Regel
   (fuer die Positionierungs-/Beschneidungs-Pruefung). Bei .hero gibt
   es keine .hero::after — der Anker ist .hero__photo::after (genau
   wie im geteilten System, siehe assets/detail.css Zeile 93-100:
   .hero::before steht dort UNMITTELBAR NACH .hero__photo::after).
   Bei den uebrigen vier steht die neue ::before-Regel UNMITTELBAR
   VOR der schon vorhandenen ::after-Regel derselben Basisklasse
   (dasselbe Muster wie .band/.split__media/etc. im geteilten
   System, 03-02-SUMMARY.md). */

const ARCHETYPES = [
  {
    id: 'hero',
    selector: '.hero',
    containerRe: /\.hero\{([^}]*)\}/,
    anchorNeedle: null, // wird aus dem Dateiinhalt via anchorRe bestimmt
    anchorRe: /\.hero__photo::after\{[^}]*\}/,
    placement: 'after',
    required: true,
  },
  {
    id: 'shot',
    selector: '.shot',
    containerRe: /\.shot\{([^}]*)\}/,
    anchorRe: /\.shot::after\{[^}]*\}/,
    placement: 'before',
    required: true,
  },
  {
    id: 'tile.img',
    selector: '.tile.img',
    containerRe: /\.tile\{([^}]*)\}/, // Positionierung kommt von .tile{, nicht .tile.img{ (Plan-Vorgabe)
    anchorRe: /\.tile\.img::after\{[^}]*\}/,
    placement: 'before',
    required: true,
  },
  {
    id: 'video',
    selector: '.video',
    containerRe: /\.video\{([^}]*)\}/,
    anchorRe: /\.video::after\{[^}]*\}/,
    placement: 'before',
    required: false, // 17 von 19 (sc-4-3-2, sc-4-8-1 haben keinen .video)
  },
  {
    id: 'ship',
    selector: '.ship',
    containerRe: /\.ship\{([^}]*)\}/,
    anchorRe: /\.ship::after\{[^}]*\}/,
    placement: 'before',
    required: false, // 13 von 19
  },
];

function isPositionedAndClipped(containerBody) {
  return /position:\s*(relative|sticky|absolute|fixed)/.test(containerBody) && /overflow:\s*hidden/.test(containerBody);
}

/* ---------------------------------------------------------- */
/* Zeilenenden-Waechter — die Plan-03-Falle (PilotPage.astro): ein
   eingebettetes \r OHNE folgendes \n (oder umgekehrt) macht jeden
   Volltext-Ersatz riskant, weil dann nicht mehr sicher ist, wo eine
   "Zeile" im Sinn des Editors endet. Dieses Skript ersetzt zwar nie
   zeilenweise, aber die neu eingefuegten Regeln sollen mit \r\n
   (dem in diesen 19 Dateien durchgehend verwendeten Zeilenende)
   umgeben werden — bei einem Artefakt waere diese Annahme falsch. */
function lineEndingIssues(raw) {
  let bareLf = 0;
  let bareCr = 0;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '\n' && raw[i - 1] !== '\r') bareLf++;
    if (raw[i] === '\r' && raw[i + 1] !== '\n') bareCr++;
  }
  return { bareLf, bareCr };
}

function countUrls(raw) {
  return (raw.match(/url\([^)]*\)/g) || []).slice().sort();
}
function countDecl(raw, prop) {
  return (raw.match(new RegExp(`${prop}:`, 'g')) || []).length;
}

/* ---------------------------------------------------------- */
/* Pro-Datei-Durchlauf: berechnet alles, schreibt NICHTS. */

function processFile(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const errors = [];

  const { bareLf, bareCr } = lineEndingIssues(raw);
  if (bareLf || bareCr) {
    errors.push(
      `eingebettetes Zeilenende-Artefakt gefunden (bare LF: ${bareLf}, bare CR: ${bareCr}) — dieselbe Fallenklasse wie PilotPage.astro in Plan 03, Voraussetzung fuer einen sicheren Ersatz verletzt`
    );
  }

  /* (a) body::after */
  const bodyAfterHits = raw.match(/body::after\{[^}]*\}/g) || [];
  let bodyAfterEdit = null;
  let bodyAfterAlready = false;
  if (bodyAfterHits.length !== 1) {
    errors.push(`erwartet genau 1 body::after-Regel, gefunden ${bodyAfterHits.length}`);
  } else if (bodyAfterHits[0] === NEW_BODY_AFTER) {
    bodyAfterAlready = true;
  } else if (bodyAfterHits[0] !== OLD_BODY_AFTER) {
    errors.push(`body::after weicht vom erwarteten Wortlaut ab — Voraussetzung verletzt (Ist: ${JSON.stringify(bodyAfterHits[0])})`);
  } else {
    bodyAfterEdit = { from: OLD_BODY_AFTER, to: NEW_BODY_AFTER };
  }

  /* (b) Rasterschichten je Archetyp */
  const rasterEdits = [];
  const archetypeReport = [];
  for (const arch of ARCHETYPES) {
    const anchorMatches = raw.match(new RegExp(arch.anchorRe.source, 'g')) || [];
    const already = raw.includes(rasterRule(arch.selector));

    if (anchorMatches.length === 0) {
      if (arch.required) {
        errors.push(`Ziel "${arch.id}": erwarteter Anker (${arch.anchorRe}) fehlt, obwohl dieses Ziel als vorhanden gilt (19/19)`);
      }
      archetypeReport.push({ id: arch.id, present: false });
      continue;
    }
    if (anchorMatches.length > 1) {
      errors.push(`Ziel "${arch.id}": Anker (${arch.anchorRe}) ist nicht eindeutig (${anchorMatches.length}x gefunden)`);
      archetypeReport.push({ id: arch.id, present: true, ok: false });
      continue;
    }

    const containerMatch = arch.containerRe.exec(raw);
    if (!containerMatch) {
      errors.push(`Ziel "${arch.id}": Container-Regel ${arch.containerRe} nicht gefunden`);
      archetypeReport.push({ id: arch.id, present: true, ok: false });
      continue;
    }
    if (!isPositionedAndClipped(containerMatch[1])) {
      errors.push(
        `Ziel "${arch.id}": Container-Regel ist nicht (position:relative|sticky|absolute|fixed + overflow:hidden) — Voraussetzung verletzt, kein Schreiben (Ist: ${containerMatch[1]})`
      );
      archetypeReport.push({ id: arch.id, present: true, ok: false });
      continue;
    }

    archetypeReport.push({ id: arch.id, present: true, ok: true, already });
    if (!already) {
      rasterEdits.push({ id: arch.id, anchor: anchorMatches[0], placement: arch.placement, rule: rasterRule(arch.selector) });
    }
  }

  /* (c) Beobachter */
  const oldObserverCount = raw.split(OLD_OBSERVER).length - 1;
  const newObserverCount = raw.split(NEW_OBSERVER).length - 1;
  let observerEdit = null;
  let observerAlready = false;
  if (oldObserverCount === 0 && newObserverCount === 1) {
    observerAlready = true;
  } else if (oldObserverCount === 1 && newObserverCount === 0) {
    observerEdit = { from: OLD_OBSERVER, to: NEW_OBSERVER };
  } else {
    errors.push(
      `.reveal-Beobachter weicht vom erwarteten Wortlaut ab (alte Form ${oldObserverCount}x, neue Form ${newObserverCount}x gefunden) — erwartet genau 1x alt ODER 1x neu`
    );
  }

  const invariantBefore = {
    urls: countUrls(raw),
    animation: countDecl(raw, 'animation'),
    transition: countDecl(raw, 'transition'),
  };

  return {
    filePath,
    raw,
    errors,
    bodyAfterEdit,
    bodyAfterAlready,
    rasterEdits,
    archetypeReport,
    observerEdit,
    observerAlready,
    invariantBefore,
  };
}

function applyEdits(result) {
  let out = result.raw;
  if (result.bodyAfterEdit) {
    out = out.replace(result.bodyAfterEdit.from, result.bodyAfterEdit.to);
  }
  for (const edit of result.rasterEdits) {
    const insertion = edit.placement === 'after' ? `${edit.anchor}\r\n${edit.rule}` : `${edit.rule}\r\n${edit.anchor}`;
    out = out.replace(edit.anchor, insertion);
  }
  if (result.observerEdit) {
    out = out.replace(result.observerEdit.from, result.observerEdit.to);
  }
  return out;
}

/* ---------------------------------------------------------- */
/* Pass 1: berechnen, nichts schreiben. */

const results = targetFiles.map(processFile);

let totalBodyAfter = 0;
let totalRaster = 0;
let totalObserver = 0;
let totalErrors = 0;
const rasterBySelector = new Map();

console.log(`migrate-layers: ${targetFiles.length} Patch-Koerper im Umfang${APPLY ? ' (--apply)' : ' — Trockenlauf'}\n`);

for (const r of results) {
  const bodyAfterCount = r.bodyAfterEdit ? 1 : 0;
  const rasterCount = r.rasterEdits.length;
  const observerCount = r.observerEdit ? 1 : 0;
  totalBodyAfter += bodyAfterCount;
  totalRaster += rasterCount;
  totalObserver += observerCount;
  totalErrors += r.errors.length;
  for (const edit of r.rasterEdits) {
    rasterBySelector.set(edit.id, (rasterBySelector.get(edit.id) || 0) + 1);
  }

  const presentSummary = r.archetypeReport
    .map((a) => (a.present ? `${a.id}${a.already ? '(bereits)' : ''}` : `${a.id}(fehlt)`))
    .join(', ');
  console.log(
    `${r.filePath}: body::after ${bodyAfterCount}${r.bodyAfterAlready ? ' (bereits migriert)' : ''}, Rasterregeln ${rasterCount}, Beobachter ${observerCount}${r.observerAlready ? ' (bereits migriert)' : ''} — [${presentSummary}]`
  );
  for (const e of r.errors) {
    console.log(`  ! FEHLER: ${e}`);
  }
}

console.log(
  `\nGesamt: body::after-Umschreibungen: ${totalBodyAfter} (Soll ${EXPECT_BODY_AFTER})   Rasterregeln: ${totalRaster} (Soll ${EXPECT_RASTER})   Beobachter-Heilungen: ${totalObserver} (Soll ${EXPECT_OBSERVER})`
);
console.log(
  `Rasterregeln je Ziel: ${[...rasterBySelector.entries()].map(([id, n]) => `${id}=${n}`).join(', ')}`
);
console.log(`Dateien im Umfang: ${targetFiles.length} (Soll ${EXPECT_FILES})`);

let ok = totalErrors === 0;

// Sollzahlen nur gegen den REST pruefen, der noch zu tun ist -- ein erneuter
// Lauf nach --apply darf 0 melden, ohne als Fehlschlag zu gelten. Beim ERSTEN
// Lauf (kein Ziel "bereits migriert") muessen die Zahlen exakt den
// Plan-Sollwerten entsprechen.
const anyAlready =
  results.some((r) => r.bodyAfterAlready || r.observerAlready || r.archetypeReport.some((a) => a.already));
if (!anyAlready) {
  if (targetFiles.length !== EXPECT_FILES) {
    console.error(`\nFEHLER: erwartete Dateizahl weicht ab (Soll ${EXPECT_FILES}, Ist ${targetFiles.length})`);
    ok = false;
  }
  if (totalBodyAfter !== EXPECT_BODY_AFTER) {
    console.error(`\nFEHLER: erwartete body::after-Umschreibungen weichen ab (Soll ${EXPECT_BODY_AFTER}, Ist ${totalBodyAfter})`);
    ok = false;
  }
  if (totalRaster !== EXPECT_RASTER) {
    console.error(`\nFEHLER: erwartete Rasterregeln weichen ab (Soll ${EXPECT_RASTER}, Ist ${totalRaster})`);
    ok = false;
  }
  if (totalObserver !== EXPECT_OBSERVER) {
    console.error(`\nFEHLER: erwartete Beobachter-Heilungen weichen ab (Soll ${EXPECT_OBSERVER}, Ist ${totalObserver})`);
    ok = false;
  }
}

if (!ok) {
  console.error('\nAbbruch: es wird NICHTS geschrieben.');
  process.exit(1);
}

if (!APPLY) {
  console.log('\nTrockenlauf: nichts geschrieben. Mit --apply erneut aufrufen, um zu schreiben.');
  process.exit(0);
}

/* ---------------------------------------------------------- */
/* Pass 2: schreiben, mit Invarianten-Zusicherung je Datei. */

let written = 0;
for (const r of results) {
  if (!r.bodyAfterEdit && r.rasterEdits.length === 0 && !r.observerEdit) continue; // bereits vollstaendig migriert

  const newContent = applyEdits(r);

  const after = {
    urls: countUrls(newContent),
    animation: countDecl(newContent, 'animation'),
    transition: countDecl(newContent, 'transition'),
  };
  const urlsEqual =
    r.invariantBefore.urls.length === after.urls.length &&
    r.invariantBefore.urls.every((u, i) => u === after.urls[i]);

  if (!urlsEqual) {
    console.error(`FEHLER: ${r.filePath} — Menge der referenzierten Bilddateien (url(...)) hat sich veraendert. Datei NICHT geschrieben, Lauf abgebrochen.`);
    process.exit(1);
  }
  if (after.animation !== r.invariantBefore.animation) {
    console.error(
      `FEHLER: ${r.filePath} — animation:-Zaehlung veraendert (vorher ${r.invariantBefore.animation}, nachher ${after.animation}). Datei NICHT geschrieben, Lauf abgebrochen.`
    );
    process.exit(1);
  }
  if (after.transition !== r.invariantBefore.transition) {
    console.error(
      `FEHLER: ${r.filePath} — transition:-Zaehlung veraendert (vorher ${r.invariantBefore.transition}, nachher ${after.transition}). Datei NICHT geschrieben, Lauf abgebrochen.`
    );
    process.exit(1);
  }

  writeFileSync(r.filePath, newContent);
  written++;
}

console.log(`\n${written} Datei(en) geschrieben. body::after: ${totalBodyAfter}, Rasterregeln: ${totalRaster}, Beobachter: ${totalObserver}.`);
