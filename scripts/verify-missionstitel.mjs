/* ============================================================
   verify-missionstitel.mjs — tragen die Missionen lesbare und
   unterscheidbare Namen? (UX-Audit Paket F1, 24.11.2026)

   Vorher hiess die Haelfte der Missionen auf ihrem Blatt, in der Liste
   und im Seitentitel wie ihre Vorlage: „{Reputation Rank} Hauler Needed
   for {Cargo Grade} Shipment", 213 nur nach ihrem Arbeitsnamen, und 77
   Namen standen auf 258 Seiten. Seit F1 setzt src/lib/missionTitel.ts
   allgemeine Woerter fuer die Marken ein und schreibt unter gleichnamige
   Missionen, was sie unterscheidet (Ware, Route, Auftraggeber, Stufe …).

     [1] Missionsblatt (beide Sprachen): die Ueberschrift ist da und
         enthaelt keine Marke ({…}, ~…, […]), keine Marke als Pille
         (md__ph, so stand die Vorlage bis F1 im Titel) und keinen
         internen Bezeichner (Wort_mit_Unterstrich)
     [2] <title> derselben Seite: dieselben Regeln
     [3] Unterscheidbarkeit: Seiten, deren Name samt Zusatzzeile genau so
         auf einer anderen Seite derselben Sprache steht — hoechstens
         --klinke-doppelt (Sperrklinke: wandert nur nach unten)
     [4] Missionsliste (beide Sprachen): jede Karte verlinkt genau ein
         Missionsblatt, jedes Blatt hat genau eine Karte, Titel und Zusatz
         der Karte sind die des Blatts; Kartentitel nach [1] und dieselbe
         Doppel-Klinke wie [3]

   Selbstauskunft: gelesene Missionsblaetter und Karten je Sprache, mit
   Klinke. Kein git, kein Netz, kein Kindprozess — liest nur dist/.

     node scripts/verify-missionstitel.mjs [--dist <Ordner>]
       [--klinke-seiten <n>] [--klinke-doppelt <n>]
   ============================================================ */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const DIST = arg('--dist') ? resolve(arg('--dist')) : resolve(ROOT, 'dist');
// 1.366 Missionsblaetter je Sprache am 24.11.2026; 2 % Luft wie die Kennzahl
// seitenMissionen, weil der Bestand je Patch schwankt.
const MIN_SEITEN = Number(arg('--klinke-seiten') ?? 1335);
// Gemessen 24.11.2026: 8 Seiten je Sprache in 4 Paaren, die sich in keinem
// sichtbaren Merkmal unterscheiden (gleicher Titel, Geber, Ort, Lohn, Stufe).
const MAX_DOPPELT = Number(arg('--klinke-doppelt') ?? 8);

const SPRACHEN = [
  { lang: 'en', ordner: 'missionen', liste: 'missionen.html' },
  { lang: 'de', ordner: 'de/missionen', liste: 'de/missionen.html' },
];

const ent = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ', thinsp: ' ' };
// Sichtbarer Text eines Markup-Stuecks, nur zum Vergleichen und Melden (die
// Ausgabe geht in die Konsole, nie zurueck in eine Seite). Tags fallen per
// Zeichenlauf weg statt per Regex (CodeQL haelt <[^>]*> fuer unvollstaendig
// bereinigt). Sichtbare spitze Klammern (&lt; &gt;) werden zu ‹ ›: so bleibt
// „Rescue <VIP>" von „Rescue VIP" unterscheidbar, und kein < oder > steht
// im Ergebnis.
const ohneTags = (h) => {
  let aus = '';
  let drin = false;
  for (const c of h) {
    if (c === '<') drin = true;
    else if (c === '>') drin = false;
    else if (!drin) aus += c;
  }
  return aus;
};
const text = (h) => ohneTags(h)
  .replace(/&(#\d+|[a-z]+);/g, (m, e) => ent[e] ?? (e[0] === '#' ? String.fromCharCode(+e.slice(1)) : m))
  .replace(/</g, '‹').replace(/>/g, '›')
  .replace(/\s+/g, ' ').trim();
// Marke oder interner Bezeichner im sichtbaren Namen
const MARKE = /[{}~[\]]|\b[A-Za-z0-9]+_[A-Za-z0-9_]+\b/;

const fehler = [];
const zaehl = {};
const melde = (nr, f) => { zaehl[nr] = (zaehl[nr] ?? 0) + 1; if (zaehl[nr] <= 8) fehler.push(`[${nr}] ${f}`); };

function doppelt(namen) {
  const g = new Map();
  for (const [wo, n] of namen) g.set(n, [...(g.get(n) ?? []), wo]);
  return [...g].filter(([, w]) => w.length > 1);
}

if (!existsSync(resolve(DIST, 'build.json'))) {
  console.error('verify-missionstitel: dist/build.json fehlt — erst bauen (npm run build).');
  process.exit(1);
}

for (const sp of SPRACHEN) {
  const dir = resolve(DIST, sp.ordner);
  const dateien = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.html')) : [];
  const namen = [];
  const blattName = new Map();
  let titel = 0;
  for (const f of dateien) {
    const h = readFileSync(join(dir, f), 'utf8');
    const wo = `/${sp.ordner}/${f}`;
    const h1 = /<h1 class="md__h1"[^>]*>([\s\S]*?)<\/h1>/.exec(h);
    const name = h1 ? text(h1[1]) : '';
    if (!name) melde(1, `${wo}: keine Ueberschrift`);
    else if (h1 && /class="md__ph/.test(h1[1])) melde(1, `${wo}: Marke als Pille im Titel „${name}"`);
    else if (MARKE.test(name)) melde(1, `${wo}: „${name}"`);
    const t = /<title>([^<]*)<\/title>/.exec(h);
    const tt = t ? text(t[1]).split(' — ')[0] : '';
    if (!tt || MARKE.test(tt)) melde(2, `${wo}: <title> „${tt}"`);
    else titel++;
    const sub = /<p class="md__sub"[^>]*>([\s\S]*?)<\/p>/.exec(h);
    namen.push([wo, `${name} | ${sub ? text(sub[1]) : ''}`]);
    blattName.set(wo, `${name} | ${sub ? text(sub[1]) : ''}`);
  }
  const dop = doppelt(namen);
  const nDop = dop.reduce((s, [, w]) => s + w.length, 0);
  if (nDop > MAX_DOPPELT) {
    fehler.push(`[3] ${sp.lang}: ${nDop} Missionsblaetter teilen ihren Namen samt Zusatz mit einem anderen (Klinke ${MAX_DOPPELT})`);
    for (const [n, w] of dop.slice(0, 6)) fehler.push(`      „${n}": ${w.join(', ')}`);
  }
  if (dateien.length < MIN_SEITEN) fehler.push(`${sp.lang}: ${dateien.length} Missionsblaetter gelesen, Klinke ${MIN_SEITEN} — unvollstaendiger Bau?`);
  console.log(`  [1–3] ${sp.lang}: ${dateien.length} Missionsblaetter gelesen (Klinke ${MIN_SEITEN}), ${titel} Seitentitel lesbar, ${nDop} Seiten mit gleichem Namen samt Zusatz (Klinke ${MAX_DOPPELT})`);

  // [4] Liste
  const lp = resolve(DIST, sp.liste);
  const l = existsSync(lp) ? readFileSync(lp, 'utf8') : '';
  const karten = [...l.matchAll(/<a class="mc__link" href="([^"]*)"[^>]*>[\s\S]*?<h3 class="mc__h"[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<div class="mc__chips")/g)];
  const kNamen = [];
  const verlinkt = new Map();
  for (const [, href, h3, rest] of karten) {
    const n = text(h3);
    if (!n || MARKE.test(n) || /class="mc__ph/.test(h3)) melde(4, `/${sp.liste}: Kartentitel „${n}"`);
    const sub = /<p class="mc__sub"[^>]*>([\s\S]*?)<\/p>/.exec(rest);
    const voll = `${n} | ${sub ? text(sub[1]) : ''}`;
    kNamen.push([n, voll]);
    const ziel = href.replace(/[?#].*$/, '');
    verlinkt.set(ziel, (verlinkt.get(ziel) ?? 0) + 1);
    if (!blattName.has(ziel)) melde(4, `/${sp.liste}: Karte „${n}" verlinkt ${ziel}, das kein Missionsblatt ist`);
    else if (blattName.get(ziel) !== voll) melde(4, `/${sp.liste}: Karte „${voll}" passt nicht zum Blatt ${ziel} („${blattName.get(ziel)}")`);
  }
  for (const wo of blattName.keys()) {
    const k = verlinkt.get(wo) ?? 0;
    if (k !== 1) melde(4, `/${sp.liste}: ${wo} hat ${k} Karten statt einer`);
  }
  const kDop = doppelt(kNamen).reduce((s, [, w]) => s + w.length, 0);
  if (kDop > MAX_DOPPELT) fehler.push(`[4] /${sp.liste}: ${kDop} Karten teilen ihren Namen samt Zusatz mit einer anderen (Klinke ${MAX_DOPPELT})`);
  console.log(`  [4]   ${sp.lang}: ${karten.length} Karten gelesen, ${verlinkt.size} Blaetter verlinkt, ${kDop} mit gleichem Namen samt Zusatz`);
}
for (const [nr, n] of Object.entries(zaehl)) if (n > 8) fehler.push(`[${nr}] … und ${n - 8} weitere`);

if (fehler.length) {
  console.error(`\nFEHLER: ${fehler.length}`);
  for (const m of fehler) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('verify-missionstitel: ALLE ZUSICHERUNGEN ERFUELLT ✓');
