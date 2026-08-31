#!/usr/bin/env node
/* verify:sprachpaar-css — traegt die deutsche Fassung dieselben
   Media-Queries wie die englische?

   ANLASS (beide gemessen, beide echt):
     30.08.2026  `.tools{position:static}` stand nur in der EN-Fassung von
                 /downloads. Auf der deutschen Seite klebte die
                 Werkzeugleiste weiter ueber dem Inhalt.
     31.08.2026  Der Fix, der die Tastenkappen „Ctrl K" auf Touchgeraeten
                 ausblendet, wirkte auf /index.html. Auf /de.html blieben
                 sie stehen: die deutsche Startseite ist eine EIGENE Quelle
                 (src/pages/de/index.astro), kein erzeugtes Abbild.

   `verify:sync` vergleicht die GERUESTFORM beider Fassungen und sah beide
   Faelle nicht — das Seiten-CSS ist je Sprache dupliziert und faellt
   auseinander, ohne dass sich am Markup etwas aendert.

   GEMESSEN WIRD AM ARTEFAKT (dist/), nicht an der Quelle: was zaehlt, ist
   was ausgeliefert wird (CLAUDE.md, Grundsatz 7). Verglichen werden nur
   die inline <style>-Bloecke der Seite — die gebuendelten _astro-Dateien
   sind fuer beide Sprachen dieselbe Datei und koennen nicht abweichen.

   SPERRKLINKE: MIN_PAARE. Faellt die Zahl der geprueften Paare darunter,
   reisst das Tor — sonst waere ein leerlaufender Waechter von einem
   echten nicht zu unterscheiden (Grundsatz 2).                          */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';

const DIST = 'dist';
const MIN_PAARE = 8000;      /* Stand 31.08.2026: 8721 */

const mq = (html) => {
  const s = new Set();
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g))
    for (const q of m[1].matchAll(/@media[^{]+/g))
      s.add(q[0].replace(/@media\s*/, '').replace(/\s+/g, ' ').trim());
  return s;
};

const seiten = [];
const lauf = (d) => {
  for (const e of readdirSync(d)) {
    const p = d + '/' + e;
    if (statSync(p).isDirectory()) { if (!/^(_astro|assets|vendor|downloads|de)$/.test(e)) lauf(p); continue; }
    if (e.endsWith('.html')) seiten.push(p);
  }
};

if (!existsSync(DIST)) {
  console.error('FEHLER  dist/ fehlt — erst `npm run build`.');
  process.exit(1);
}
lauf(DIST);

let paare = 0;
const muster = {};
for (const en of seiten) {
  const rel = en.slice(DIST.length);
  const de = DIST + '/de' + rel;
  if (!existsSync(de)) continue;
  paare++;
  const a = mq(readFileSync(en, 'utf8'));
  const b = mq(readFileSync(de, 'utf8'));
  const nurEN = [...a].filter((x) => !b.has(x));
  const nurDE = [...b].filter((x) => !a.has(x));
  if (!nurEN.length && !nurDE.length) continue;
  const k = nurEN.map((x) => 'nur EN: @media ' + x).concat(nurDE.map((x) => 'nur DE: @media ' + x)).join('  |  ');
  (muster[k] ||= []).push(rel);
}

const schief = Object.values(muster).reduce((n, v) => n + v.length, 0);
console.log(`verify:sprachpaar-css — ${paare} Seitenpaare geprueft (Klinke ${MIN_PAARE})`);

if (paare < MIN_PAARE) {
  console.error(`FEHLER  nur ${paare} Paare gefunden, erwartet mindestens ${MIN_PAARE}.`);
  console.error('        Entweder ist der Build unvollstaendig, oder dieses Tor laeuft leer.');
  process.exit(1);
}

if (!schief) {
  console.log('  OK  beide Sprachfassungen tragen dieselben Media-Queries.');
  process.exit(0);
}

console.error(`FEHLER  ${schief} Seitenpaare mit abweichenden Media-Queries (${Object.keys(muster).length} Muster):`);
for (const [k, v] of Object.entries(muster).sort((a, b) => b[1].length - a[1].length).slice(0, 12)) {
  console.error(`  ${String(v.length).padStart(5)} Seiten  ${k}`);
  console.error(`           z. B. ${v.slice(0, 3).join('  ')}`);
}
console.error('');
console.error('  Seiten-CSS ist je Sprache dupliziert: src/pages/x.astro UND');
console.error('  src/pages/de/x.astro sind zwei eigene Quellen. Wer eine Regel in');
console.error('  einer der beiden aendert, muss sie in der anderen mitaendern.');
process.exit(1);
