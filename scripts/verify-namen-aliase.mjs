/* ============================================================
   verify-namen-aliase.mjs — steht jedes Item nur noch unter seinem
   Namen im Spiel, und fuehrt jede alte Adresse dorthin?

   IA C8 (24.11.2026): 56 Items standen doppelt im Katalog, einmal unter
   einem alten oder anders geschriebenen Namen aus Preisliste, Shop-
   Schnappschuss oder Loot-Recherche (mit Bezugswegen) und einmal unter
   dem Namen im Spiel (mit Spielwerten). Krisz hat entschieden: zusammen-
   legen, alte Adresse per 301. Die Paare stehen in
   scripts/lib/item-namen-aliase.mjs; build-universal-db.mjs und
   scripts/namen-zusammenfuehren.mjs lesen sie.

   Was still kaputtgehen kann: ein Datenlauf mit altem Bauskript legt die
   Doppel wieder an; eine Quelle benennt ein Item um, und das Paar laeuft
   leer (Ausnahme ohne Anlass); eine Weiterleitung fehlt, und die alte
   Adresse endet im 404.

     [1] Tabelle in sich stimmig: kein alter Name doppelt, kein Ziel ist
         selbst ein alter Name, alt und Ziel verschieden
     [2] Katalog (assets/ und das Artefakt dist/assets/): kein alter Name
         steht als eigenes Item, jedes Ziel ist ein Item mit Spieldaten
     [3] Zombie-Waechter: jeder alte Name kommt noch in einer Quelle vor
         (src/data/loot-items.json, src/data/item-prices.json,
         assets/dismantling-items.json) — sonst Paar streichen
     [4] Adressen: die Seite jedes Ziels ist in EN und DE Ziel einer
         Weiterleitung in nginx/umzuege.conf, und die Adresse, die der alte
         Name ergab, ist entweder die Seite des Ziels selbst oder leitet
         dorthin. Dass jede Quelle keine Seite mehr ist und jedes Ziel eine,
         prueft verify:redirects [6].

   Selbstauskunft: Paare, Katalog-Items, Quellennamen, Weiterleitungen;
   Klinke fuer die Zahl der Paare. Kein git, kein Netz, kein Kindprozess.

     node scripts/verify-namen-aliase.mjs [--dist <Ordner>]
   ============================================================ */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NAMEN_ALIASE } from './lib/item-namen-aliase.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const DIST = arg('--dist') ? resolve(arg('--dist')) : resolve(ROOT, 'dist');
const lies = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));

// Klinke (nur nach oben; nach unten nur per Commit, der das gestrichene Paar nennt).
const MIN_PAARE = 56; // 24.11.2026: 12 Schreibweisen, 44 Umbenennungen
const MIN_QUELLENNAMEN = 4000; // verschiedene Namen in den drei Quellen (24.11.2026: 4.111)

const fehler = [];
const liste = (xs, n = 8) => xs.slice(0, n).join(', ') + (xs.length > n ? ` … (+${xs.length - n})` : '');
const k = (n) => String(n).toLowerCase().trim();
const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';

console.log(`verify-namen-aliase: ${NAMEN_ALIASE.length} Paare in scripts/lib/item-namen-aliase.mjs (Klinke ${MIN_PAARE})`);
if (NAMEN_ALIASE.length < MIN_PAARE) fehler.push(`nur ${NAMEN_ALIASE.length} Paare (Klinke ${MIN_PAARE}) — Paar gestrichen, ohne die Klinke per Commit mit Ursache zu senken?`);

// [1]
const alte = new Map();
const tabelle = [];
for (const [von, nach, art] of NAMEN_ALIASE) {
  if (alte.has(k(von))) tabelle.push(`"${von}" doppelt`);
  alte.set(k(von), nach);
  if (k(von) === k(nach)) tabelle.push(`"${von}" zeigt auf sich selbst`);
  if (!['schreibweise', 'umbenannt'].includes(art)) tabelle.push(`"${von}": Art "${art}" unbekannt`);
}
for (const [, nach] of NAMEN_ALIASE) if (alte.has(k(nach))) tabelle.push(`Ziel "${nach}" ist selbst ein alter Name (Kette)`);
console.log('\n[1] Tabelle in sich stimmig');
console.log(`    Paare: ${NAMEN_ALIASE.length}   Widersprueche — Soll: 0   Ist: ${tabelle.length}`);
if (tabelle.length) fehler.push(`[1] ${liste(tabelle)}`);

// [2]
console.log('\n[2] Katalog: kein alter Name als eigenes Item, jedes Ziel mit Spieldaten');
const kataloge = [['assets/universal-items.json', resolve(ROOT, 'assets/universal-items.json')]];
const distKatalog = resolve(DIST, 'assets/universal-items.json');
if (existsSync(distKatalog)) kataloge.push(['dist/assets/universal-items.json', distKatalog]);
else fehler.push('[2] dist/assets/universal-items.json fehlt — erst bauen (npm run build), dann pruefen');
let zielIds = null;
for (const [name, pfad] of kataloge) {
  const items = JSON.parse(readFileSync(pfad, 'utf8')).items;
  const nachName = new Map(items.map((i) => [k(i.name), i]));
  const nochDa = NAMEN_ALIASE.filter(([von]) => nachName.has(k(von))).map(([von]) => `"${von}" (${nachName.get(k(von)).id})`);
  const zielOhne = NAMEN_ALIASE.filter(([, nach]) => !nachName.get(k(nach))?.game).map(([, nach]) => `"${nach}"`);
  console.log(`    ${name}: ${items.length} Items   alter Name als eigenes Item — Soll: 0   Ist: ${nochDa.length}   Ziel fehlt oder ohne Spieldaten — Soll: 0   Ist: ${zielOhne.length}`);
  if (nochDa.length) fehler.push(`[2] ${name}: ${nochDa.length} alte(r) Name(n) wieder als eigenes Item — node scripts/namen-zusammenfuehren.mjs laufen lassen: ${liste(nochDa)}`);
  if (zielOhne.length) fehler.push(`[2] ${name}: ${zielOhne.length} Ziel(e) fehlen oder tragen keine Spieldaten — Spielname geaendert? Paar anpassen: ${liste(zielOhne)}`);
  if (!zielIds) zielIds = new Map(NAMEN_ALIASE.map(([von, nach]) => [von, nachName.get(k(nach))?.id ?? null]));
}

// [3]
console.log('\n[3] Zombie-Waechter: jeder alte Name kommt noch in einer Quelle vor');
const quellen = new Set([
  ...Object.keys(lies('src/data/loot-items.json')),
  ...Object.values(lies('src/data/item-prices.json').items).map((i) => i.name),
  ...lies('assets/dismantling-items.json').map((i) => i.name),
].filter(Boolean).map(k));
const zombies = NAMEN_ALIASE.filter(([von]) => !quellen.has(k(von))).map(([von]) => `"${von}"`);
console.log(`    Quellennamen gelesen: ${quellen.size}   Paar ohne Quelle — Soll: 0   Ist: ${zombies.length}`);
if (quellen.size < MIN_QUELLENNAMEN) fehler.push(`[3] nur ${quellen.size} Quellennamen gelesen — Quelldatei leer oder Format geaendert? Dann prueft [3] nichts`);
if (zombies.length) fehler.push(`[3] ${zombies.length} Paar(e) ohne Anlass: keine Quelle nennt den alten Namen mehr — Paar in scripts/lib/item-namen-aliase.mjs streichen (Weiterleitung bleibt): ${liste(zombies)}`);

// [4]
console.log('\n[4] Adressen: jede Zielseite empfaengt eine Weiterleitung, die alte Adresse fuehrt dorthin');
const umzug = new Map();
for (const z of readFileSync(resolve(ROOT, 'nginx/umzuege.conf'), 'utf8').split('\n')) {
  const m = /^(\S+) (\S+);$/.exec(z.trim());
  if (m && !z.startsWith('#')) umzug.set(m[1], m[2]);
}
const empfaenger = new Set(umzug.values());
const adressFehler = [];
let geprueft = 0;
for (const [von] of NAMEN_ALIASE) {
  const ziel = zielIds?.get(von);
  if (!ziel) continue; // fehlt schon unter [2]
  for (const p of ['', '/de']) {
    geprueft++;
    const zielSeite = `${p}/items/${ziel}.html`;
    if (!empfaenger.has(zielSeite)) adressFehler.push(`${zielSeite} empfaengt keine Weiterleitung`);
    const alt = `${p}/items/${slug(von)}.html`;
    if (alt !== zielSeite && umzug.get(alt) !== zielSeite) adressFehler.push(`${alt} -> ${umzug.get(alt) ?? '(keine Weiterleitung)'} statt ${zielSeite}`);
  }
}
console.log(`    Weiterleitungen in nginx/umzuege.conf: ${umzug.size}   Paare x Sprachen geprueft: ${geprueft}   ohne Weg zur Zielseite — Soll: 0   Ist: ${adressFehler.length}`);
if (adressFehler.length) fehler.push(`[4] ${adressFehler.length} alte Adresse(n) ohne Weg zur Seite mit dem Spielnamen: ${liste(adressFehler)}`);

if (fehler.length) {
  console.error(`\nverify-namen-aliase: ${fehler.length} FEHLER`);
  for (const f of fehler) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`\nverify-namen-aliase gruen — ${NAMEN_ALIASE.length} Paare: jedes Item steht unter seinem Spielnamen, jede alte Adresse fuehrt dorthin.`);
