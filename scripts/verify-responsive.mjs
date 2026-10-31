// Haelt zwei Regeln fest, die im Aufloesungs-Durchgang vom 30.08.2026 als
// Ursache fuer abgeschnittene Seiten gemessen wurden. Beide sind statisch
// pruefbar — kein Browser, kein Netz, kein git (Schiene A).
//
// ---------------------------------------------------------------------------
// 1) SPALTENREZEPTE MUESSEN SCHRUMPFEN KOENNEN
//
// `grid-template-columns: repeat(auto-fit, minmax(320px, 1fr))` liest sich wie
// „mindestens 320 px, sonst umbrechen". Das ist es nicht: `auto-fit` bricht nur
// die ANZAHL der Spalten um. Bleibt eine einzige uebrig, ist ihre Breite
// weiterhin mindestens 320 px — auch in einem 284 px breiten Inhaltskasten.
// Die Karte ragt dann ueber den Rand, und weil `html` seitwaerts klemmt,
// scrollt die Seite nicht dorthin: der Rand ist schlicht abgeschnitten.
//
// Gemessen am 30.08.2026 im gebauten dist/:
//   /missionen.html     320 px Fenster -> Karten 27 px ueber dem Rand
//   /downloads.html     320 px Fenster -> Kacheln 23 px ueber dem Rand
//
// Richtig ist `minmax(min(320px, 100%), 1fr)`: dort, wo Platz ist, verhaelt es
// sich unveraendert; wo keiner ist, gibt die Spalte nach.
//
// ---------------------------------------------------------------------------
// 2) EIGENSTAENDIGE HTML-SEITEN BRAUCHEN EIGENE MOBILREGELN
//
// Alles unter public/*.html geht an Astro, am Layout und damit auch an
// assets/mobile-ux.css VORBEI. Diese Dateien tragen ihr komplettes CSS selbst.
// Die beiden One-Pager hatten am 30.08.2026 genau eine Medienabfrage
// (max-width: 1024px) — auf 390 px ragte ihre h1 mit 6rem 268 px ueber den
// Rand hinaus. Wer hier eine Datei ablegt, muss an Telefone denken; das Tor
// erinnert daran.
//
// ---------------------------------------------------------------------------
// SPERRKLINKEN: beide Zaehlungen haben eine Untergrenze. Faellt der Bestand
// darunter, hat jemand Dateien entfernt oder der Sucher greift nicht mehr —
// beides soll auffallen, statt als „0 Befunde" durchzurutschen.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/* Sperrklinken (nur nach oben; nach unten per Commit mit Begruendung). */
const MIN_RECIPES = 90; // gezaehlt 30.08.2026: 95
const MIN_STANDALONE = 2; // gezaehlt 30.08.2026: 2 Quelldateien

const ROOTS = ['src', 'assets'];
const PUBLIC = 'public';

/* public/downloads/ steht bewusst NICHT drin: der Ordner ist gitignoriert und
   wird von scripts/build-downloads.mjs aus public/onepager/ erzeugt (dieselbe
   Datei, nur mit eingebetteten Bildern). Wer die Kopien pruefte, pruefte
   dieselbe Regel zweimal — und im Container vor dem Build gar nichts. */
const SKIP = new Set(['downloads']);

function walk(dir, hit, keep) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && SKIP.has(e.name) && dir === PUBLIC) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, hit, keep);
    else if (keep(e.name)) hit(p);
  }
}

/* ---- 1) Spaltenrezepte ---------------------------------------------- */
const RECIPE = /repeat\(\s*auto-(?:fit|fill)\s*,\s*minmax\(\s*([^,()]*(?:\([^()]*\))?[^,()]*?)\s*,/g;
let recipes = 0;
const rigid = [];

/* Nicht nur .astro/.css: ein Spaltenrezept kann auch aus einer JS-Datei in die
   Seite geschrieben werden (assets/tool-help.js baut z. B. seinen Blasen-Stil
   als Zeichenkette), und die eigenstaendigen Seiten unter public/ tragen ihr
   CSS ohnehin inline. Heute steht in keiner dieser Dateien ein Rezept — genau
   deshalb kostet die Abdeckung nichts und schliesst ein Loch, bevor es eins
   gibt. Gegengeprueft am 30.08.2026 gegen das ARTEFAKT: 6561 Rezepte in
   dist/, davon 0 starr. */
const RECIPE_DATEIEN = /\.(astro|css|js|mjs|ts)$/;

for (const root of ROOTS) {
  walk(root, (p) => {
    /* Ueber die GANZE Datei, nicht zeilenweise: ein Rezept darf umgebrochen
       sein (`repeat(auto-fit,` Zeilenumbruch `minmax(...))`) — eine
       Zeilensuche haette genau die uebersehen und das Tor still leer laufen
       lassen. */
    const src = readFileSync(p, 'utf8');
    RECIPE.lastIndex = 0;
    let m;
    while ((m = RECIPE.exec(src))) {
      recipes++;
      const low = m[1].trim().replace(/\s+/g, ' ');
      /* Nachgiebig ist alles, was nicht auf eine feste Laenge festgenagelt
         ist: min()/clamp() geben nach, `auto` und `0` ohnehin. */
      if (/^(min|clamp)\s*\(/.test(low) || /^(auto|0)$/.test(low)) continue;
      const line = src.slice(0, m.index).split('\n').length;
      rigid.push({ file: p, line, min: low });
    }
  }, (n) => RECIPE_DATEIEN.test(n));
}

/* Die eigenstaendigen Seiten tragen ihr CSS inline — dieselbe Regel gilt. */
walk(PUBLIC, (p) => {
  const src = readFileSync(p, 'utf8');
  RECIPE.lastIndex = 0;
  let m;
  while ((m = RECIPE.exec(src))) {
    recipes++;
    const low = m[1].trim().replace(/\s+/g, ' ');
    if (/^(min|clamp)\s*\(/.test(low) || /^(auto|0)$/.test(low)) continue;
    rigid.push({ file: p, line: src.slice(0, m.index).split('\n').length, min: low });
  }
}, (n) => n.endsWith('.html'));

/* ---- 2) Eigenstaendige Seiten unter public/ -------------------------- */
let standalone = 0;
const naked = [];
walk(PUBLIC, (p) => {
  const html = readFileSync(p, 'utf8');
  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) return; // kein Dokument fuer Leser
  standalone++;
  const mobile = /@media[^{]*max-width\s*:\s*(\d+)px/gi;
  let ok = false, m;
  while ((m = mobile.exec(html))) if (Number(m[1]) <= 900) { ok = true; break; }
  if (!ok) naked.push(p);
}, (n) => n.endsWith('.html'));

/* ---- Selbstauskunft -------------------------------------------------- */
console.log(
  `Aufloesungs-Regeln geprueft: ${recipes} Spaltenrezepte (Klinke ${MIN_RECIPES}), ` +
  `${standalone} eigenstaendige Seiten unter ${PUBLIC}/ (Klinke ${MIN_STANDALONE})`,
);

const problems = [];
if (recipes < MIN_RECIPES)
  problems.push(
    `nur ${recipes} Spaltenrezepte gefunden, Klinke steht auf ${MIN_RECIPES}.\n` +
    '      Entweder wurden Dateien entfernt (dann Klinke im Commit senken und\n' +
    '      begruenden) oder der Sucher greift nicht mehr.',
  );
if (standalone < MIN_STANDALONE)
  problems.push(`nur ${standalone} eigenstaendige Seiten gefunden, Klinke steht auf ${MIN_STANDALONE}.`);

for (const r of rigid)
  problems.push(
    `${r.file}:${r.line} — Spalte kann nicht unter ${r.min} schrumpfen.\n` +
    `      Richtig: minmax(min(${r.min},100%), …)`,
  );
for (const p of naked)
  problems.push(
    `${p} — eigenstaendige Seite ohne eine einzige Medienabfrage unter 901px.\n` +
    '      Diese Datei geht an assets/mobile-ux.css vorbei und traegt ihre\n' +
    '      Telefonregeln selbst.',
  );

if (problems.length) {
  console.error('\nFEHLER — Aufloesungs-Regeln verletzt:\n');
  for (const p of problems) console.error(`  ${p}`);
  console.error('');
  process.exit(1);
}
console.log('  keine starren Spaltenrezepte, keine nackte eigenstaendige Seite ✓');
