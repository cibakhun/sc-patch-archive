/* ============================================================
   verify-typo-motion.mjs

   Pruefverfahren gegen den GEBAUTEN Stand (dist/), nicht die Quelle —
   Vorbild scripts/verify-fx.mjs Zeile fuer Zeile (Abbruch mit klarer
   Meldung wenn dist/ fehlt, je Zusicherung eine Soll/Ist-Zeile,
   Sammelurteil am Ende, Rueckgabecode 1 bei Fehlschlag). Bleibt als
   eigenstaendiges Werkzeug (`npm run verify:typo`), absichtlich NICHT
   in `npm run build` eingehaengt — dieselbe Begruendung wie im Kopf
   von verify-fx.mjs: der Build ist bereits eine lange Kette, ein Tor,
   das ihn blockiert, wird beim ersten Fehlalarm herausgenommen. Das
   Einhaengen ins Dockerfile-Tor macht Plan 07.

   ⚠⚠ Durchsucht DREI Orte — eine Pruefung mit nur einem Durchlauf ueber
   .html sieht von dieser Phase praktisch nichts:
     - dist/assets/theme.css   (die Token-DEFINITIONEN)
     - dist/_astro/*.css       (gescopte Komponenten-Stile, hier liegt
                                 der Loewenanteil — Astro lagert normale
                                 <style>-Bloecke dorthin aus)
     - alle .html-Dateien unterhalb von dist/ (is:inline-Stile und rohe style="…")

   Fuenf Zusicherungen:

     1  Token-Schicht ausgeliefert: dist/assets/theme.css definiert
        alle 19 --fs-*, 20 --ls-*, drei --dur-*, --ease-ui. Soll 43
        Definitionen.
     2  Tokens werden benutzt: var(--fs-, var(--ls-, var(--dur-,
        var(--ease-ui) kommen in dist/_astro/*.css + allen .html-Dateien unter dist/
        ZUSAMMEN mindestens so oft vor wie die hinterlegte Untergrenze.
        Die Untergrenze ist eine Sperrklinke auf dem nach Plan 02
        erreichten Stand — Plaene 03-06 duerfen sie NICHT anfassen.
     3  Ambiente unberuehrt: Scroll-Reveal traegt im gebauten Stand
        weiterhin seine urspruengliche Dauer (Vorkommen auf .reveal-
        Regeln, Soll > 0), Ken-Burns-Schleifen (kb, kb2, kenburns,
        scrollx) tragen unveraendert ihre Sekundenwerte. Maschinischer
        Waechter fuer D-03/FX-07.
     4  Wandlung unberuehrt: die Hero-Regel clamp(2.9rem,12vw,8.5rem)
        und die 360px-Regel (2.5rem) stehen im gebauten HTML beider
        Startseiten; die Wortmarke rendert aus einem Token, dessen
        Wert in theme.css exakt 1rem ist (TYPO-03, maschinelle Fassung
        des --s-Arguments).
     5  Sprachparitaet (SYNC-01 als Tor): fuer jede EN-Seite mit
        DE-Gegenstueck muessen die Zaehlungen von var(--fs-, var(--ls-,
        var(--dur-, var(--ease-ui) paarweise uebereinstimmen.
        Paarungslogik wortwoertlich aus verify-fx.mjs Zusicherung 6,
        samt der Sperre "< 60 Paare = Paarungslogik pruefen".

   ⚠ Windows: Select-String findet auf sehr langen minifizierten Zeilen
   nicht alle Treffer. Deshalb readFileSync + split, kein Shell-Werkzeug.

     node scripts/verify-typo-motion.mjs
   ============================================================ */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

if (!(() => { try { readdirSync('dist'); return true; } catch { return false; } })()) {
  console.error(
    'verify-typo-motion: dist/ fehlt. Erst `npm.cmd run build`, dann `npm run verify:typo` — ' +
      'dieses Skript prueft den GEBAUTEN Stand, nicht die Quelle.'
  );
  process.exit(1);
}

/* Sperrklinke: Stand nach Plan 02-01 (Tracer: SiteNav + beide index.astro).
   Plaene 03-06 duerfen diese Zahl NICHT anfassen — nur Plan 07 hebt sie an,
   wenn alle Sweeps durch sind. */
const MIN_TOKEN_USAGES = 183;

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
const cssFiles = readdirSync('dist/_astro').filter((f) => f.endsWith('.css')).map((f) => 'dist/_astro/' + f);

const htmlCache = new Map();
for (const f of htmlFiles) htmlCache.set(f, readFileSync(f, 'utf8'));
const cssCache = new Map();
for (const f of cssFiles) cssCache.set(f, readFileSync(f, 'utf8'));

let ok = true;
const fail = (msg) => {
  ok = false;
  console.error(`  FEHLER: ${msg}`);
};

/* ---- Zusicherung 1: Token-Schicht ausgeliefert ---- */
console.log('\n[1] dist/assets/theme.css definiert alle 43 Tokens (19 --fs-* + 20 --ls-* + 3 --dur-* + --ease-ui)');
{
  let themeCss;
  try {
    themeCss = readFileSync('dist/assets/theme.css', 'utf8');
  } catch {
    fail('dist/assets/theme.css fehlt');
    themeCss = '';
  }
  const need = [];
  for (let i = 1; i <= 19; i++) need.push(`--fs-${i}:`);
  for (let i = 1; i <= 20; i++) need.push(`--ls-${i}:`);
  need.push('--dur-fast:', '--dur-base:', '--dur-slow:', '--ease-ui:');
  const missing = need.filter((n) => !themeCss.includes(n));
  console.log(`    Soll: 43 Definitionen   Ist: ${need.length - missing.length}`);
  if (missing.length) fail(`Fehlende Token-Definitionen in dist/assets/theme.css: ${missing.join(', ')}`);
}

/* ---- Zusicherung 2: Tokens werden benutzt (Sperrklinke) ---- */
console.log(`\n[2] var(--fs-/--ls-/--dur-/--ease-ui) in dist/_astro/*.css + dist/**/*.html >= ${MIN_TOKEN_USAGES}`);
{
  const needles = ['var(--fs-', 'var(--ls-', 'var(--dur-', 'var(--ease-ui)'];
  let total = 0;
  for (const s of [...htmlCache.values(), ...cssCache.values()]) {
    for (const n of needles) total += count(s, n);
  }
  console.log(`    Soll: >= ${MIN_TOKEN_USAGES}   Ist: ${total}`);
  if (total < MIN_TOKEN_USAGES) fail(`Weniger Token-Nutzungen als die Sperrklinke erlaubt (${total} < ${MIN_TOKEN_USAGES})`);
}

/* ---- Zusicherung 3: Ambiente unberuehrt (D-03/FX-07) ---- */
console.log('\n[3] Ambiente unberuehrt: Scroll-Reveal-Dauer + Ken-Burns-Sekundenwerte');
{
  /* 17000+ Seiten NICHT zu einem einzigen String zusammenfuegen (RangeError:
     Invalid string length) — je Datei zaehlen und aufsummieren. */
  let revealHits = 0;
  const kenBurnsIds = ['kenburns', 'kb', 'kb2', 'scrollx'];
  const kenBurnsRe = kenBurnsIds.map((id) => [id, new RegExp(`animation:\\s*${id}\\s+[\\d.]+s`, 'g')]);
  const kenBurnsHits = Object.fromEntries(kenBurnsIds.map((id) => [id, 0]));
  for (const html of htmlCache.values()) {
    revealHits += count(html, 'transition:opacity .6s ease,transform .6s ease');
    for (const [id, re] of kenBurnsRe) {
      re.lastIndex = 0;
      kenBurnsHits[id] += (html.match(re) || []).length;
    }
  }
  console.log(`    Scroll-Reveal (.reveal, opacity .6s) — Soll: > 0   Ist: ${revealHits}`);
  if (revealHits <= 0) fail('Scroll-Reveal-Dauer nicht mehr im gebauten HTML gefunden — FX-07 verletzt?');

  for (const id of kenBurnsIds) {
    console.log(`    Ken-Burns-Schleife "${id}" mit Sekundenwert — Soll: > 0   Ist: ${kenBurnsHits[id]}`);
    if (kenBurnsHits[id] <= 0) fail(`Ken-Burns-Schleife "${id}" traegt keinen literalen Sekundenwert mehr — Ambiente angetastet?`);
  }
}

/* ---- Zusicherung 4: Wandlung unberuehrt (TYPO-03) ---- */
console.log('\n[4] Hero-Wandlung unberuehrt: clamp(2.9rem,12vw,8.5rem) + 360px-Regel + Wortmarke = 1rem-Token');
{
  const HERO_CLAMP = 'clamp(2.9rem,12vw,8.5rem)';
  const NARROW_RULE = 'font-size:2.5rem';
  for (const [label, path] of [['EN', 'dist/index.html'], ['DE', 'dist/de.html']]) {
    const html = htmlCache.get(path);
    if (!html) {
      fail(`${path} fehlt im gebauten Stand`);
      continue;
    }
    const hasClamp = html.includes(HERO_CLAMP);
    const hasNarrow = html.includes(NARROW_RULE);
    console.log(`    ${label} ${path}: Hero-clamp() vorhanden=${hasClamp}, 360px-Regel vorhanden=${hasNarrow}`);
    if (!hasClamp) fail(`${path}: Hero-clamp() ${HERO_CLAMP} fehlt`);
    if (!hasNarrow) fail(`${path}: 360px-Regel ${NARROW_RULE} fehlt`);
  }

  let themeCss = '';
  try {
    themeCss = readFileSync('dist/assets/theme.css', 'utf8');
  } catch {
    /* Zusicherung 1 hat das bereits gemeldet */
  }
  const fs10IsOneRem = /--fs-10:\s*1rem\b/.test(themeCss);
  console.log(`    --fs-10 in theme.css ist exakt 1rem (Wortmarken-Token) — Soll: true   Ist: ${fs10IsOneRem}`);
  if (!fs10IsOneRem) fail('--fs-10 ist nicht mehr exakt 1rem — die Wortmarken-Kopplung (--s) waere nicht mehr 1:1 (TYPO-03)');
}

/* ---- Zusicherung 5: Sprachparitaet (SYNC-01) ---- */
console.log('\n[5] Sprachparitaet EN<->DE (var(--fs-/--ls-/--dur-/--ease-ui) paarweise gleich)');
{
  const set = new Set(htmlFiles);
  const enFiles = htmlFiles.filter((f) => !f.startsWith('dist/de/') && f !== 'dist/de.html');
  const needles = ['var(--fs-', 'var(--ls-', 'var(--dur-', 'var(--ease-ui)'];
  let pairs = 0;
  const mismatches = [];
  for (const f of enFiles) {
    const rel = f.slice('dist/'.length);
    const dePath = rel === 'index.html' ? 'dist/de.html' : 'dist/de/' + rel;
    if (!set.has(dePath)) continue;
    pairs++;
    const enHtml = htmlCache.get(f);
    const deHtml = htmlCache.get(dePath);
    const enC = Object.fromEntries(needles.map((n) => [n, count(enHtml, n)]));
    const deC = Object.fromEntries(needles.map((n) => [n, count(deHtml, n)]));
    const diff = needles.some((n) => enC[n] !== deC[n]);
    if (diff) mismatches.push({ en: f, de: dePath, enC, deC });
  }
  console.log(`    Verglichene Seitenpaare: ${pairs}   Soll: 0 Abweichungen   Ist: ${mismatches.length}`);
  if (pairs < 60) fail(`Zu wenige Seitenpaare gefunden (${pairs} < 60) — Paarungslogik pruefen`);
  if (mismatches.length) {
    fail(`Sprachparitaet gerissen bei ${mismatches.length} Paar(en):`);
    for (const m of mismatches.slice(0, 10)) {
      console.error(`      ${m.en} <-> ${m.de}: ${JSON.stringify(m.enC)} vs ${JSON.stringify(m.deC)}`);
    }
  }
}

console.log(`\nverify-typo-motion: ${ok ? 'ALLE ZUSICHERUNGEN ERFUELLT ✓' : 'FEHLGESCHLAGEN ✗'}`);
if (!ok) process.exit(1);
