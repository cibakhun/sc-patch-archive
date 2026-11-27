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

     [1] Liste und Bericht decken sich: der Bericht trägt den Fingerabdruck
         genau dieser Liste (Item und Modelldatei), jedes Item der Liste hat
         eine Befundliste, keins steht zugleich unter „angehalten“, der
         Bericht nennt kein Item, das die Liste nicht hat
     [2] kein Item der Liste trägt ein Merkmal, das die Tabelle anhält
         (unbekannt oder Fehler)
     [3] jedes Merkmal ist heute so eingeordnet wie beim Lauf; sonst sind
         die Modelle mit einer anderen Einordnung gebacken (neu backen)
     [4] jede benannte Ausnahme der Tabelle hängt an mindestens einem Item
         der Liste (sonst ist sie tot und gehört gestrichen)
     [5] Abdeckung: jedes Item des Katalogs (assets/universal-items.json)
         hat genau ein Schicksal — in der Liste, angehalten oder als Lücke
         mit Grund (scripts/item3d/liste.mjs, manifest.mjs). Anlass
         (27.11.2026): gebacken wurde aus Hand-Listen für Rüstung und
         Waffen; Kleidung, Werkzeuge, Verbrauchsgüter und Sonstiges standen
         auf keiner, und kein Tor merkte es. Je Katalog-Bereich eine Klinke
         für die Modelle der Liste. Ist der Katalog seit dem Lauf ein
         anderer (Datenlauf), ist das nur WARNUNG: neue Items warten auf den
         nächsten Lauf.

   Selbstauskunft: Items, Merkmale, Einordnungen und Schicksale je Bereich
   gezählt, mit Klinken. Kein git, kein Netz, kein Kindprozess — liest nur
   die beiden Dateien, den Katalog und die Tabelle.

     node scripts/verify-item3d-befunde.mjs [--liste <json>] [--bericht <json>] [--katalog <json>]
   ============================================================ */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { einordnen, HALT, AUSNAHMEN, ARTEN } from './lib/item3d-merkmale.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const LISTE = resolve(arg('--liste') ?? resolve(ROOT, 'src/data/item-3d.json'));
const BERICHT = resolve(arg('--bericht') ?? resolve(ROOT, 'src/data/item-3d-befunde.json'));
const KATALOG = resolve(arg('--katalog') ?? resolve(ROOT, 'assets/universal-items.json'));

// Klinke (nur nach oben; nach unten nur per Commit mit Ursache): geprüfte
// Items der Liste (24.11.2026: Rüstung, Waffen und Aufsätze, 2 965;
// 27.11.2026 der ganze Katalog: 6 128).
const MIN_ITEMS = 6000;
// Klinken je Katalog-Bereich (erster Teil der Kategorie): Modelle der Liste.
// Fällt ein Bereich still heraus (wie bis 27.11.2026 die Kleidung), reißt es
// hier. Bereiche ohne Eintrag haben keine Klinke (Lackierungen: kein Modell).
// Stand 27.11.2026 (Backfassung 8): Armour 2 427, Clothing 1 802, Vehiclegear
// 524, Weapons 393, Utility 347, Other 286, Commodity 185, Attachment 153.
const MIN_JE_BEREICH = { Armour: 2380, Clothing: 1760, Vehiclegear: 510, Weapons: 380, Utility: 335, Other: 275, Commodity: 178, Attachment: 148 };
const WARN = [];

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
// Gleiche IDs reichen nicht: ein Bericht aus einem älteren Lauf nennt
// dieselben Items mit anderen Modellen. Der Fingerabdruck deckt Item UND
// Modelldatei (manifest.mjs rechnet ihn genauso).
const abdruck = createHash('sha256').update(JSON.stringify([...ids].sort().map((id) => [id, liste.items[id]?.[0] ?? null]))).digest('hex').slice(0, 16);
if (bericht.liste !== abdruck) fail(`[1] Bericht passt nicht zu dieser Liste: Fingerabdruck der Liste ${abdruck}, der Bericht nennt ${bericht.liste ?? 'keinen'} (Liste und Bericht aus verschiedenen Läufen? scripts/item3d/manifest.mjs neu laufen lassen)`);
let ohne = 0, doppelt = 0, fremd = 0;
for (const id of ids) {
  if (items[id] && !Array.isArray(items[id])) fail(`[1] ${id}: Befunde sind keine Liste (${JSON.stringify(items[id]).slice(0, 40)})`);
  if (!items[id]) { ohne++; if (ohne <= 10) fail(`[1] ${id}: steht in der Liste, hat aber keine Befunde im Bericht (Liste und Bericht aus verschiedenen Läufen? scripts/item3d/manifest.mjs neu laufen lassen)`); }
  if (angehalten[id]) { doppelt++; fail(`[1] ${id}: steht in der Liste UND unter „angehalten“`); }
}
const inListe = new Set(ids);
for (const id of Object.keys(items)) if (!inListe.has(id)) { fremd++; if (fremd <= 10) fail(`[1] ${id}: hat Befunde, steht aber nicht in der Liste`); }
if (ohne > 10) fail(`[1] … und ${ohne - 10} weitere Items ohne Befunde`);
if (fremd > 10) fail(`[1] … und ${fremd - 10} weitere Befunde ohne Listeneintrag`);
console.log(`\n[1] Liste und Bericht: Fingerabdruck ${bericht.liste === abdruck ? 'passt' : 'passt NICHT'}, ${ids.length - ohne} von ${ids.length} Modellen mit Befunden, ${doppelt} zugleich angehalten, ${fremd} Befunde ohne Listeneintrag`);

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

/* [5] Abdeckung: jedes Katalog-Item mit genau einem Schicksal */
const katalogText = readFileSync(KATALOG, 'utf8');
const katalog = JSON.parse(katalogText).items ?? [];
const katalogAbdruck = createHash('sha256').update(katalogText).digest('hex').slice(0, 16);
const ab = bericht.abdeckung;
const schicksal = new Map(); // id -> 'liste' | 'angehalten' | Grund der Lücke
if (!ab || typeof ab !== 'object' || !ab.zahl || !ab.luecken || typeof ab.katalog !== 'string') {
  fail('[5] Bericht ohne Abdeckung (abdeckung): er stammt aus einem Lauf vor scripts/item3d/liste.mjs — mit der Liste aus dem ganzen Katalog neu backen und scripts/item3d/manifest.mjs --liste … laufen lassen');
} else {
  let mehrfach = 0;
  const setze = (id, s) => { if (schicksal.has(id)) { mehrfach++; if (mehrfach <= 10) fail(`[5] ${id}: hat zwei Schicksale (${schicksal.get(id)} und ${s})`); } else schicksal.set(id, s); };
  for (const id of ids) setze(id, 'liste');
  for (const id of Object.keys(angehalten)) setze(id, 'angehalten');
  let nLuecken = 0;
  for (const [grund, l] of Object.entries(ab.luecken)) {
    if (!Array.isArray(l)) { fail(`[5] Lücke „${grund}“ ist keine Liste`); continue; }
    for (const id of l) { setze(id, grund); nLuecken++; }
  }
  if (mehrfach > 10) fail(`[5] … und ${mehrfach - 10} weitere Items mit zwei Schicksalen`);
  const z = ab.zahl;
  if (z.gelistet !== ids.length) fail(`[5] Abdeckung nennt ${z.gelistet} gelistet, die Liste hat ${ids.length}`);
  if (z.angehalten !== Object.keys(angehalten).length) fail(`[5] Abdeckung nennt ${z.angehalten} angehalten, der Bericht ${Object.keys(angehalten).length}`);
  if (z.luecken !== nLuecken) fail(`[5] Abdeckung nennt ${z.luecken} Lücken, die Gründe tragen ${nLuecken}`);
  if (z.gelistet + z.angehalten + z.luecken !== z.katalog) fail(`[5] Schicksale (${z.gelistet} + ${z.angehalten} + ${z.luecken}) decken den Katalog des Laufs (${z.katalog}) nicht ab`);
  const imKatalog = new Set(katalog.map((i) => i.id));
  const ohneSchicksal = katalog.filter((i) => !schicksal.has(i.id)).map((i) => i.id);
  const nichtImKatalog = [...schicksal.keys()].filter((id) => !imKatalog.has(id));
  if (ab.katalog === katalogAbdruck) {
    if (z.katalog !== katalog.length) fail(`[5] Abdeckung nennt ${z.katalog} Katalog-Items, der Katalog hat ${katalog.length}`);
    if (ohneSchicksal.length) fail(`[5] ${ohneSchicksal.length} Katalog-Items ohne Schicksal (${ohneSchicksal.slice(0, 8).join(', ')}${ohneSchicksal.length > 8 ? ', …' : ''}) — sie wurden weder gebacken noch begründet ausgelassen`);
    if (nichtImKatalog.length) fail(`[5] ${nichtImKatalog.length} Schicksale für Items, die der Katalog nicht hat (${nichtImKatalog.slice(0, 8).join(', ')})`);
  } else {
    WARN.push(`[5] Katalog seit dem Lauf geändert (Lauf ${ab.katalog}, heute ${katalogAbdruck}): ${ohneSchicksal.length} neue Items ohne Schicksal, ${nichtImKatalog.length} Schicksale für Items, die es nicht mehr gibt — beim nächsten Lauf neu backen (scripts/item3d/liste.mjs)`);
  }
  // Selbstauskunft und Klinke je Bereich
  const bereich = new Map(katalog.map((i) => [i.id, (i.category ?? 'Other').split(' / ')[0]]));
  const je = {};
  for (const [id, s] of schicksal) {
    const b = bereich.get(id) ?? '(nicht im Katalog)';
    const e = (je[b] ??= { liste: 0, angehalten: 0, luecken: 0 });
    if (s === 'liste') e.liste++; else if (s === 'angehalten') e.angehalten++; else e.luecken++;
  }
  console.log(`[5] Abdeckung: Katalog ${katalog.length} Items (${ab.katalog === katalogAbdruck ? 'derselbe wie beim Lauf' : 'seit dem Lauf geändert'}), ${ids.length} in der Liste, ${Object.keys(angehalten).length} angehalten, ${nLuecken} Lücken mit Grund`);
  for (const [b, e] of Object.entries(je).sort((x, y) => y[1].liste - x[1].liste)) console.log(`    ${b.padEnd(18)} ${String(e.liste).padStart(5)} Modelle  ${String(e.angehalten).padStart(4)} angehalten  ${String(e.luecken).padStart(5)} Lücken`);
  const gruende = Object.entries(ab.luecken).sort((x, y) => y[1].length - x[1].length);
  console.log(`    Lücken nach Grund: ${gruende.slice(0, 8).map(([g, l]) => `${g} ${l.length}`).join('; ')}`);
  for (const [b, min] of Object.entries(MIN_JE_BEREICH)) {
    const n = je[b]?.liste ?? 0;
    if (n < min) fail(`[5] Klinke: Bereich ${b} hat ${n} Modelle in der Liste, erwartet mindestens ${min} — fällt eine Art still heraus?`);
  }
}

if (geprueft !== ids.length) fail(`[2] nur ${geprueft} von ${ids.length} Modellen der Liste geprüft: die übrigen haben keine gültige Befundliste`);
if (geprueft < MIN_ITEMS) fail(`Klinke: nur ${geprueft} Items geprüft, erwartet mindestens ${MIN_ITEMS} — leere oder gekürzte Liste?`);

for (const w of WARN) console.log(`  WARNUNG ${w}`);
if (fehler.length) {
  console.error(`\nverify-item3d-befunde: ${fehler.length} FEHLER`);
  for (const f of fehler) console.error(`  FEHLER ${f}`);
  process.exit(1);
}
console.log(`\nverify-item3d-befunde: ok — ${geprueft} Modelle, jedes Merkmal eingeordnet, keins hält an, jedes Katalog-Item mit Schicksal.`);
