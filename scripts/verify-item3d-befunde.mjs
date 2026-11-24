/* ============================================================
   verify-item3d-befunde.mjs — zeigt die Seite nur Modelle, deren
   Spielmaterial der Bäcker kennt?

   Items in 3D backt Spielmaterialien zu Web-Modellen. Was der Bäcker an
   einem Material kennt, steht in scripts/lib/item3d-merkmale.mjs; der
   Massenlauf meldet je Item alle Merkmale, und scripts/item3d/manifest.mjs
   schreibt daraus die Liste der Seite (src/data/item-3d.json) und den
   Bericht (src/data/item-3d-befunde.json). Anlass: Ein unbekannter Schalter
   (%DECALS) machte die Prism "Irradiated" zu Chrom, und niemand merkte es,
   bis Krisz das Bild sah (23.11.2026). Dieses Tor prüft Liste und Bericht
   gegen die Tabelle DIESES Checkouts:

     [1] Liste und Bericht decken sich: jedes Item der Liste hat Befunde,
         keins steht zugleich unter „angehalten“, der Bericht nennt kein
         Item, das die Liste nicht hat
     [2] kein Item der Liste trägt ein Merkmal, das die Tabelle anhält
         (unbekannt oder Fehler)
     [3] jedes Merkmal ist heute so eingeordnet wie beim Lauf; sonst sind
         die Modelle mit einer anderen Einordnung gebacken (neu backen)
     [4] jede benannte Ausnahme der Tabelle hängt an mindestens einem Item
         der Liste (sonst ist sie tot und gehört gestrichen)

   Selbstauskunft: Items, Merkmale und Einordnungen gezählt, mit Klinke.
   Kein git, kein Netz, kein Kindprozess — liest nur die beiden Dateien und
   die Tabelle.

     node scripts/verify-item3d-befunde.mjs [--liste <json>] [--bericht <json>]
   ============================================================ */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { einordnen, HALT, AUSNAHMEN, ARTEN } from './lib/item3d-merkmale.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const LISTE = resolve(arg('--liste') ?? resolve(ROOT, 'src/data/item-3d.json'));
const BERICHT = resolve(arg('--bericht') ?? resolve(ROOT, 'src/data/item-3d-befunde.json'));

// Klinke (nur nach oben; nach unten nur per Commit mit Ursache): geprüfte
// Items der Liste (24.11.2026: Rüstung, Waffen und Aufsätze).
const MIN_ITEMS = 2900;

const fehler = [];
const fail = (m) => fehler.push(m);
const liste = JSON.parse(readFileSync(LISTE, 'utf8'));
const bericht = JSON.parse(readFileSync(BERICHT, 'utf8'));
const ids = Object.keys(liste.items ?? {});
const merkmale = bericht.merkmale ?? [];
const items = bericht.items ?? {};
const angehalten = bericht.angehalten ?? {};
console.log(`verify-item3d-befunde: ${ids.length} Modelle in der Liste, ${Object.keys(items).length} Items mit Befunden, ${Object.keys(angehalten).length} angehalten, ${merkmale.length} verschiedene Merkmale`);

// Einordnung jedes Merkmals heute; Bericht-Indizes müssen gültig sein
const heute = merkmale.map(([k]) => einordnen(k));
const schluessel = (id, i) => {
  if (!Number.isInteger(i) || i < 0 || i >= merkmale.length) { fail(`[1] ${id}: Merkmal-Index ${i} gibt es im Bericht nicht`); return null; }
  return merkmale[i][0];
};

/* [1] Liste und Bericht decken sich */
let ohne = 0, doppelt = 0, fremd = 0;
for (const id of ids) {
  if (!items[id]) { ohne++; if (ohne <= 10) fail(`[1] ${id}: steht in der Liste, hat aber keine Befunde im Bericht (Liste und Bericht aus verschiedenen Läufen? scripts/item3d/manifest.mjs neu laufen lassen)`); }
  if (angehalten[id]) { doppelt++; fail(`[1] ${id}: steht in der Liste UND unter „angehalten“`); }
}
const inListe = new Set(ids);
for (const id of Object.keys(items)) if (!inListe.has(id)) { fremd++; if (fremd <= 10) fail(`[1] ${id}: hat Befunde, steht aber nicht in der Liste`); }
if (ohne > 10) fail(`[1] … und ${ohne - 10} weitere Items ohne Befunde`);
if (fremd > 10) fail(`[1] … und ${fremd - 10} weitere Befunde ohne Listeneintrag`);
console.log(`\n[1] Liste und Bericht: ${ids.length - ohne} von ${ids.length} Modellen mit Befunden, ${doppelt} zugleich angehalten, ${fremd} Befunde ohne Listeneintrag`);

/* [2] nichts Anhaltendes in der Liste */
const zahl = Object.fromEntries(ARTEN.map((a) => [a, 0]));
let geprueft = 0, haltend = 0;
const nutzung = new Map(); // Schlüssel -> Zahl der Items in der Liste
for (const id of ids) {
  const idx = items[id];
  if (!Array.isArray(idx)) continue;
  geprueft++;
  for (const i of idx) {
    const k = schluessel(id, i);
    if (k === null) continue;
    nutzung.set(k, (nutzung.get(k) ?? 0) + 1);
    const art = heute[i].art;
    zahl[art] = (zahl[art] ?? 0) + 1;
    if (HALT.has(art)) { haltend++; if (haltend <= 15) fail(`[2] ${id}: Merkmal „${k}“ ist ${art === 'unbekannt' ? 'der Tabelle unbekannt' : `ein Fehler (${heute[i].grund})`} — das Item gehört nicht in die Liste. Einordnen in scripts/lib/item3d-merkmale.mjs (und den Bäcker entsprechend), oder neu backen und die Liste neu erzeugen`); }
  }
}
if (haltend > 15) fail(`[2] … und ${haltend - 15} weitere anhaltende Merkmale in der Liste`);
console.log(`[2] ${geprueft} Items geprüft, Merkmale je Item eingeordnet: ${ARTEN.map((a) => `${a} ${zahl[a] ?? 0}`).join(', ')}`);

/* [3] Einordnung unverändert seit dem Lauf */
let anders = 0;
merkmale.forEach(([k, damals], i) => {
  if (!nutzung.has(k)) return;
  if (heute[i].art !== damals) { anders++; if (anders <= 15) fail(`[3] „${k}“ war beim Lauf ${damals}, ist heute ${heute[i].art} — die ${nutzung.get(k)} Items damit sind anders gebacken, als die Tabelle sagt: neu backen (scripts/item3d/batch.mjs) und die Liste neu erzeugen`); }
});
if (anders > 15) fail(`[3] … und ${anders - 15} weitere umgeordnete Merkmale`);
console.log(`[3] ${nutzung.size} Merkmale der Liste, ${anders} seit dem Lauf anders eingeordnet`);

/* [4] Ausnahmen leben */
const tot = Object.keys(AUSNAHMEN).filter((k) => !nutzung.has(k));
for (const k of tot) fail(`[4] Ausnahme „${k}“ hängt an keinem Item der Liste mehr — streichen (scripts/lib/item3d-merkmale.mjs), Ausnahmen sind Schulden`);
console.log(`[4] ${Object.keys(AUSNAHMEN).length} benannte Ausnahmen, ${Object.keys(AUSNAHMEN).length - tot.length} in Gebrauch${tot.length ? '' : ` (${Object.keys(AUSNAHMEN).map((k) => `${k}: ${nutzung.get(k)} Items`).join('; ')})`}`);

// Zur Übersicht: was an den Modellen genähert oder weggelassen ist
const naeh = [...nutzung].filter(([k]) => ['naeh', 'weg'].includes(einordnen(k).art)).sort((a, b) => b[1] - a[1]);
console.log(`\nGenähert oder weggelassen (häufigste von ${naeh.length}):`);
for (const [k, n] of naeh.slice(0, 8)) console.log(`    ${String(n).padStart(5)} Items  ${k} — ${einordnen(k).grund ?? ''}`);
if (Object.keys(angehalten).length) console.log(`Angehalten (nicht in der Liste): ${Object.entries(angehalten).slice(0, 12).map(([id, idx]) => `${id} (${idx.map((i) => merkmale[i]?.[0]).join(', ')})`).join('; ')}`);

if (geprueft < MIN_ITEMS) fail(`Klinke: nur ${geprueft} Items geprüft, erwartet mindestens ${MIN_ITEMS} — leere oder gekürzte Liste?`);

if (fehler.length) {
  console.error(`\nverify-item3d-befunde: ${fehler.length} FEHLER`);
  for (const f of fehler) console.error(`  FEHLER ${f}`);
  process.exit(1);
}
console.log(`\nverify-item3d-befunde: ok — ${geprueft} Modelle, jedes Merkmal eingeordnet, keins hält an.`);
