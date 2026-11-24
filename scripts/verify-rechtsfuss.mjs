/* ============================================================
   verify-rechtsfuss.mjs  (Heuristik P13, 24.11.2026)

   Jede gebaute Seite verlinkt Impressum UND Datenschutz. Bis zum
   24.11.2026 endeten die Patchseiten (live 22 je Sprache, im
   Vorschau-Bau 23 und die Film-Seite) und 404 ohne Fuss; wer dort
   Kontakt oder Rechtliches suchte, musste erst
   die Seite wechseln (und das Impressum soll „unmittelbar
   erreichbar“ sein). Seitdem haengt Layout.astro einen schlichten
   Rechtsfuss an jede Seite, deren Inhalt die beiden Links nicht
   selbst traegt. Diese Pruefung haelt das fuer jede Datei in dist/
   fest, gegen das Artefakt, nicht gegen die Quelle.

   Ausgenommen sind nur benannte Seiten ohne Layout, jede mit Anlass.
   Zombie-Waechter: eine Ausnahme, die keine Datei mehr trifft oder
   deren Dateien die Links inzwischen selbst tragen, reisst das Tor
   (Ausnahmen sind Schulden, sie sollen nicht still liegen bleiben).

   Selbstauskunft: druckt die Zahl der geprueften Seiten und reisst
   unter der Klinke.

       node scripts/verify-rechtsfuss.mjs
   ============================================================ */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hangarImArtefakt } from './lib/hangar-switch.mjs';

const DIST = 'dist';
// Gemessen 24.11.2026: 18.654 Seiten live (ohne Weiterleitungen).
const KLINKE = 17000;

const AUSNAHMEN = [
  {
    muster: /^gate\.html$/,
    anlass:
      'Testpiloten-Tor, eigenstaendig ohne Layout (gate.astro). Auf staging liegen Impressum und Datenschutz selbst hinter dem Tor, ein Link fuehrte zurueck aufs Tor; dafuer braeuchte nginx eine eigene GATE-AUSNAHME.',
  },
  {
    muster: /^(?:de\/)?hangar-bay\//,
    nurVorschau: true,
    anlass: 'Hangar-Bucht, nur im Vorschau-Bau und ohne Layout (Heuristik P80, bei den Hangar-Threads).',
  },
  {
    muster: /^onepager\/|^downloads\/onepager-[a-z0-9-]+\.html$/,
    anlass: 'Onepager, eigenstaendige Leitfaeden zum Herunterladen, ohne Layout (Heuristik P70, Paket H).',
  },
];

function walk(dir) {
  let out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

try {
  readdirSync(DIST);
} catch {
  console.error('verify:rechtsfuss: dist/ fehlt. Erst `npm run build`, dann pruefen.');
  process.exit(1);
}

const vorschau = hangarImArtefakt(DIST);
const hat = (html, pfad) => new RegExp(`href="(?:https://verse-base\\.com)?(?:/de)?/${pfad}\\.html"`).test(html);

let geprueft = 0;
let umleitungen = 0;
const fehlt = [];
const treffer = new Map(AUSNAHMEN.map((a) => [a, { dateien: 0, mitLinks: [] }]));

for (const f of walk(DIST)) {
  const rel = f.slice(DIST.length + 1).replace(/\\/g, '/');
  const html = readFileSync(f, 'utf8');
  // Weiterleitungsseiten (meta refresh) sind keine Seiten zum Lesen.
  if (/<meta[^>]+http-equiv=["']refresh["']/i.test(html.slice(0, 4000))) { umleitungen++; continue; }
  const beide = hat(html, 'impressum') && hat(html, 'datenschutz');
  const ausnahme = AUSNAHMEN.find((a) => a.muster.test(rel));
  if (ausnahme) {
    const t = treffer.get(ausnahme);
    t.dateien++;
    if (beide) t.mitLinks.push(rel);
    continue;
  }
  geprueft++;
  if (!beide) fehlt.push(rel);
}

let ok = true;
const fail = (msg) => { ok = false; console.error(`  FEHLER: ${msg}`); };

console.log(`verify:rechtsfuss — ${DIST} (${vorschau ? 'Vorschau-Bau' : 'Live-Bau'})`);
console.log(`\n[1] Jede Seite verlinkt Impressum und Datenschutz`);
console.log(`    Seiten geprueft: ${geprueft} (Klinke ${KLINKE}), Weiterleitungen uebersprungen: ${umleitungen}`);
console.log(`    ohne einen der beiden Links — Soll: 0   Ist: ${fehlt.length}`);
if (geprueft < KLINKE) fail(`nur ${geprueft} Seiten geprueft, erwartet mindestens ${KLINKE} — laeuft die Pruefung leer?`);
if (fehlt.length) fail(`Impressum oder Datenschutz fehlt auf: ${fehlt.slice(0, 12).join(', ')}${fehlt.length > 12 ? ` (+${fehlt.length - 12})` : ''}`);

console.log(`\n[2] Ausnahmen (benannt, mit Zombie-Waechter)`);
for (const a of AUSNAHMEN) {
  const t = treffer.get(a);
  console.log(`    ${a.muster}: ${t.dateien} Datei(en) — ${a.anlass}`);
  if (!t.dateien && !(a.nurVorschau && !vorschau)) fail(`Ausnahme ${a.muster} trifft keine Datei mehr — Anlass weg, Ausnahme streichen`);
  if (t.mitLinks.length) fail(`Ausnahme ${a.muster}: ${t.mitLinks.slice(0, 3).join(', ')} traegt die Links inzwischen selbst — Ausnahme anpassen`);
}

if (!ok) {
  console.error('\nverify:rechtsfuss ROT.');
  process.exit(1);
}
console.log('\nverify:rechtsfuss gruen — jede Seite fuehrt zu Impressum und Datenschutz.');
