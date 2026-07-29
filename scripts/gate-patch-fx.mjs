/* ============================================================
   gate-patch-fx.mjs

   Haengt die 36 byte-gleichen Partikel-Schleifen der Patch-Seiten
   (18 EN + 18 DE, ALLE ausser sc-4-2-0 + DE-Zwilling) an den in
   Phase 01.1 Plan 01 festgelegten data-fx/vbfxchange-Vertrag.

   Ohne dieses Gatter startet jede dieser Leinwaende (#stars auf 34
   Seiten, #dust auf sc-4-9-0 + DE-Zwilling) ihre requestAnimationFrame-
   Kette selbststaendig beim Laden — genau der Leerlauf-Stromverbrauch,
   den die Rueckmeldung beanstandet (siehe .planning/REQUIREMENTS.md
   § „Ambiente-Effekte").

   ------------------------------------------------------------
   DIE FUENF ANKER: jede Datei muss VOR dem Schreiben exakt einmal
   treffen. Bei jeder anderen Zahl wird NICHTS geschrieben, sondern
   die Datei mit ihren Ankerzaehlungen gemeldet, und das Skript endet
   am Ende mit einem Fehlerstatus. Lieber ein Rest von Hand als eine
   falsche automatische Ersetzung (Vorbild: tokenize-theme-colors.mjs).

     Anker 1  Leinwandname   document.getElementById('<name>')
                             (nur der Treffer, dem sofort
                             if(!c)return;const x=c.getContext('2d');
                             folgt — daraus wird <name> gelesen,
                             'stars' oder 'dust')
     Anker 2  Deklaration    if(!c)return;const x=c.getContext('2d');
     Anker 3  Schleifenkopf  function tick(){x.clearRect(0,0,w,h);
     Anker 4  Startzeile     size();addEventListener('resize',size);
                             if(!matchMedia('(prefers-reduced-motion:
                             reduce)').matches)tick();})();
     Anker 5  Inline-Regel   #<name>{...} (endet beim naechsten „}")

   AUSNAHME: sc-4-2-0.astro + der deutsche Zwilling zeichnen auf der
   #stars-Leinwand Regen und Blitz, nicht Sterne — ihre Schleife ist
   anders gebaut (Wiederanmeldung und Start liegen an getrennten
   Stellen, kein Anker-4-Muster). Sie werden hier fest ausgeschlossen
   und in Plan 02 Task 3 von Hand gefasst.

   ------------------------------------------------------------
       node scripts/gate-patch-fx.mjs --dry     Bericht, nichts schreiben
       node scripts/gate-patch-fx.mjs           Anker ersetzen und schreiben
       … --only=<pfadteil>                      Dateiauswahl eingrenzen
   ============================================================ */

import { readFile, writeFile, glob } from 'node:fs/promises';

/* Fest eingebaute Ausschlussliste — genau dieses Paar, aus dem Grund
   im Kopfkommentar oben. Nicht aus einem Muster ableiten: ein Muster,
   das sc-4-2-0 automatisch erkennt, waere selbst wieder eine Heuristik. */
const EXCLUDE = new Set([
  'src/pages/patches/sc-4-2-0.astro',
  'src/pages/de/patches/sc-4-2-0.astro',
]);

const ANCHOR1_RE = /document\.getElementById\('(\w+)'\)(?=;if\(!c\)return;const x=c\.getContext\('2d'\);)/g;
const ANCHOR2 = "if(!c)return;const x=c.getContext('2d');";
const ANCHOR3 = 'function tick(){x.clearRect(0,0,w,h);';
const ANCHOR4 = "size();addEventListener('resize',size);if(!matchMedia('(prefers-reduced-motion:reduce)').matches)tick();})();";

const countLiteral = (src, literal) => src.split(literal).length - 1;
const anchor5Re = (name) => new RegExp('#' + name + '\\{[^}]*\\}', 'g');

function newDecl() {
  return "let running=false;const fxOn=()=>document.documentElement.getAttribute('data-fx')==='on';";
}
function newAnchor4() {
  return (
    "size();addEventListener('resize',size);" +
    "document.addEventListener('vbfxchange',(e)=>{" +
    'if(e.detail.on&&!running){size();running=true;requestAnimationFrame(tick);}' +
    'else if(!e.detail.on){running=false;}' +
    '});' +
    "if(!matchMedia('(prefers-reduced-motion:reduce)').matches&&fxOn()){running=true;tick();}" +
    '})();'
  );
}
function cssGate(name) {
  return `html:not([data-fx="on"]) #${name}{display:none}`;
}

/* Pro Datei: alle fuenf Ankerzaehlungen ermitteln (ohne zu schreiben). */
function inspect(src) {
  const m1 = [...src.matchAll(ANCHOR1_RE)];
  const name = m1.length === 1 ? m1[0][1] : null;
  const counts = {
    anchor1: m1.length,
    anchor2: countLiteral(src, ANCHOR2),
    anchor3: countLiteral(src, ANCHOR3),
    anchor4: countLiteral(src, ANCHOR4),
    anchor5: name ? (src.match(anchor5Re(name)) || []).length : 0,
  };
  const ok = name !== null && Object.values(counts).every((n) => n === 1);
  return { name, counts, ok };
}

function apply(src, name) {
  let out = src;
  out = out.replace(ANCHOR2, ANCHOR2 + newDecl());
  out = out.replace(ANCHOR3, 'function tick(){if(!running)return;x.clearRect(0,0,w,h);');
  out = out.replace(ANCHOR4, newAnchor4());
  out = out.replace(anchor5Re(name), (m) => m + cssGate(name));
  return out;
}

/* ---------------------------------------------------------- */

const DRY = process.argv.includes('--dry');
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7);

const files = [];
for await (const f of glob('src/pages/patches/*.astro')) files.push(f.replace(/\\/g, '/'));
for await (const f of glob('src/pages/de/patches/*.astro')) files.push(f.replace(/\\/g, '/'));
files.sort();

const targets = files
  .filter((f) => !EXCLUDE.has(f))
  .filter((f) => (ONLY ? f.includes(ONLY) : true));

let written = 0;
let alreadyGated = 0;
let failed = 0;
const byName = { stars: 0, dust: 0, other: 0 };

console.log(`gate-patch-fx: ${targets.length} Zieldateien (Ausnahme sc-4-2-0 x2 ausgeschlossen)\n`);

for (const file of targets) {
  const src = await readFile(file, 'utf8');
  const { name, counts, ok } = inspect(src);

  if (!ok) {
    // Idempotenz-Fall: ein zweiter Lauf trifft auf bereits ersetzte Anker
    // (Anker 2/4 kommen dann nicht mehr in der Urform vor, Anker 3 hat den
    // running-Riegel schon). Das ist kein Fehler, sondern der Beweis, dass
    // diese Datei bereits gegattert ist — separat gemeldet, nicht als Fund.
    const gatedProbe = src.includes('vbfxchange') && src.includes('let running=false;');
    if (gatedProbe) {
      alreadyGated++;
      console.log(`  = ${file}  bereits gegattert, uebersprungen`);
      continue;
    }
    failed++;
    console.log(
      `  ! ${file}  Leinwandname=${name ?? '?'}  ` +
        `Anker: 1=${counts.anchor1} 2=${counts.anchor2} 3=${counts.anchor3} 4=${counts.anchor4} 5=${counts.anchor5}  ` +
        `— erwartet ueberall genau 1, NICHT geschrieben`
    );
    continue;
  }

  byName[name] = (byName[name] ?? 0) + 1;
  console.log(
    `  ✓ ${file}  Leinwandname=${name}  Anker: 1=${counts.anchor1} 2=${counts.anchor2} 3=${counts.anchor3} 4=${counts.anchor4} 5=${counts.anchor5}`
  );

  if (!DRY) {
    const out = apply(src, name);
    await writeFile(file, out);
  }
  written++;
}

console.log(
  `\ngate-patch-fx: ${written} Dateien ${DRY ? 'würden gegattert (Probelauf)' : 'gegattert'}` +
    (alreadyGated ? `, ${alreadyGated} bereits gegattert (uebersprungen)` : '') +
    (failed ? `, ${failed} FEHLGESCHLAGEN (Ankerzahl abweichend, nicht geschrieben)` : '') +
    ` — Leinwandnamen: stars=${byName.stars ?? 0} dust=${byName.dust ?? 0}`
);

if (failed) {
  console.error(`\nAbbruch: ${failed} Datei(en) hatten keine eindeutigen Anker. Von Hand pruefen.`);
  process.exit(1);
}
