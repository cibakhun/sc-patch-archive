// Items in 3D: macht aus dem Bauprotokoll (<out>/manifest.jsonl) die Liste für
// die Seite (src/data/item-3d.json) und den Befundbericht daneben
// (src/data/item-3d-befunde.json).
//
//   node scripts/item3d/manifest.mjs <out> <repo>/src/data/item-3d.json [--alle] [--bucket versebase-items]
//
// In die Liste kommt ein Item nur, wenn
//   - sein Modell UND alle seine Texturen in <out>/hochgeladen.txt stehen
//     (ohne --alle; sonst zeigte die Seite einen Knopf, hinter dem nichts liegt),
//     und dieser Nachweis zum Bucket der Seite gehört (<out>/hochgeladen.ziel),
//   - es mit der Merkmal-Tabelle DIESES Checkouts gebacken wurde (Kennung tab
//     in der Zeile): dann ist die Einordnung hier dieselbe wie beim Backen,
//   - es kein Merkmal trägt, das die Tabelle anhält (unbekannt oder Fehler,
//     scripts/lib/item3d-merkmale.mjs).
// Der Bericht nennt je Item seine Merkmale samt Einordnung; angehaltene
// Items stehen dort mit Grund. Das Tor verify:item3d-befunde prüft Liste und
// Bericht gegen die Tabelle.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { einordnen, HALT } from '../lib/item3d-merkmale.mjs';

const argv = process.argv.slice(2);
const ALLE = argv.includes('--alle'); if (ALLE) argv.splice(argv.indexOf('--alle'), 1);
const bi = argv.indexOf('--bucket');
const BUCKET = bi >= 0 ? argv.splice(bi, 2)[1] : 'versebase-items';
const [OUT, ZIEL] = argv;
if (!OUT || !ZIEL) { console.error('Aufruf: node scripts/item3d/manifest.mjs <out> <ziel.json> [--alle]'); process.exit(2); }
const BERICHT = join(dirname(ZIEL), 'item-3d-befunde.json');

// Kennung der Tabelle wie in batch.mjs (dort steht sie als tab in jeder Zeile)
const TABELLE = createHash('sha256').update(readFileSync(fileURLToPath(new URL('../lib/item3d-merkmale.mjs', import.meta.url)))).digest('hex').slice(0, 8);
const sha16 = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

const letzte = new Map();
let kaputt = 0;
for (const l of readFileSync(join(OUT, 'manifest.jsonl'), 'utf8').split(/\r?\n/)) {
  if (!l.trim()) continue;
  try { const z = JSON.parse(l); if (typeof z?.id === 'string') letzte.set(z.id, z); else kaputt++; } catch { kaputt++; } // spätere Läufe gewinnen
}
// Der Upload-Nachweis gilt nur für das Ziel, das upload.mjs daneben vermerkt.
let oben = new Set();
if (!ALLE) {
  const zf = join(OUT, 'hochgeladen.ziel');
  const ziel = existsSync(zf) ? JSON.parse(readFileSync(zf, 'utf8')) : null;
  if (!ziel || ziel.bucket !== BUCKET) {
    console.error(ziel ? `hochgeladen.txt gehört zu Bucket ${ziel.bucket}, die Seite liest ${BUCKET}: kein gültiger Upload-Nachweis` : 'hochgeladen.ziel fehlt: erst scripts/item3d/upload.mjs laufen lassen (vermerkt das Ziel)');
    process.exit(2);
  }
  if (existsSync(join(OUT, 'hochgeladen.txt'))) oben = new Set(readFileSync(join(OUT, 'hochgeladen.txt'), 'utf8').split(/\r?\n/).filter(Boolean));
}

// Testeinträge des Spiels (der Lauf lehnt sie ab) fallen auch dann heraus,
// wenn ein früherer Lauf sie noch gebaut hatte.
const test = new Set(existsSync(join(OUT, 'fehler.jsonl'))
  ? readFileSync(join(OUT, 'fehler.jsonl'), 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)).filter((f) => /Testeintrag/.test(f.fehler)).map((f) => f.id)
  : []);
for (const id of test) letzte.delete(id);

const items = {};
const merkmale = new Map(); // Schlüssel -> Index im Bericht
const idx = (k) => { if (!merkmale.has(k)) merkmale.set(k, merkmale.size); return merkmale.get(k); };
const imBericht = {}, angehalten = {};
let ohneUpload = 0, ohneDatei = 0, ohneBefund = 0, andereTabelle = 0;
for (const id of [...letzte.keys()].sort()) {
  const z = letzte.get(id);
  if (!existsSync(join(OUT, z.file))) { ohneDatei++; continue; }
  if (!ALLE && (!oben.has(z.file) || z.tex.some((h) => !oben.has(`t/${h}.webp`)))) { ohneUpload++; continue; }
  // Zeilen ohne Befunde stammen aus einem Bäcker vor der Merkmal-Tabelle:
  // nicht ungeprüft in die Liste.
  if (!z.merk) { ohneBefund++; continue; }
  // Mit einer anderen Tabelle gebacken: die Befunde wären hier anders
  // eingeordnet als beim Backen. Nicht in die Liste, neu backen.
  if (z.tab !== TABELLE) { andereTabelle++; continue; }
  const keys = Object.keys(z.merk).sort();
  const halt = keys.filter((k) => HALT.has(einordnen(k).art));
  if (halt.length) { angehalten[id] = halt.map(idx); continue; }
  items[id] = [z.file, z.kb];
  imBericht[id] = keys.map(idx);
}

const alt = existsSync(ZIEL) ? JSON.parse(readFileSync(ZIEL, 'utf8')) : {};
const neu = {
  _: alt._ ?? 'Items in 3D: Modelldatei und Größe (KB) je Item-ID. Erzeugt aus dem Bauprotokoll des Massenlaufs; die Dateien liegen unter base, nicht im Repo (src/lib/item3d.ts).',
  base: alt.base ?? 'https://items.verse-base.com/',
  items,
};
// Eine Zeile je Item: kleine Diffs nach einem neuen Lauf.
const zeile = (o) => Object.entries(o).map(([id, e]) => `  ${JSON.stringify(id)}: ${JSON.stringify(e)}`).join(',\n');
const block = (o) => { const r = zeile(o); return `{${r ? `\n${r}\n ` : ''}}`; };
writeFileSync(ZIEL, `{\n "_": ${JSON.stringify(neu._)},\n "base": ${JSON.stringify(neu.base)},\n "items": ${block(items)}\n}\n`);

// Bericht: jedes Merkmal einmal mit seiner Einordnung zur Zeit des Laufs
// (Tabelle tabelle, mit der jedes gelistete Item gebacken ist), je Item die
// Indizes seiner Merkmale. liste: Fingerabdruck der Liste (Item und
// Modelldatei), damit das Tor einen Bericht aus einem anderen Lauf erkennt.
const liste = [...merkmale.keys()].map((k) => [k, einordnen(k).art]);
const fingerabdruck = sha16(JSON.stringify(Object.entries(items).map(([id, e]) => [id, e[0]])));
writeFileSync(BERICHT, `{\n "_": ${JSON.stringify('Items in 3D: Befunde je Item aus dem Massenlauf (scripts/item3d/manifest.mjs). merkmale: [Merkmal, Einordnung] nach scripts/lib/item3d-merkmale.mjs; items und angehalten: je Item die Indizes seiner Merkmale (angehalten: nur die anhaltenden). Das Tor verify:item3d-befunde prüft Liste und Bericht gegen die Tabelle.')},\n "tabelle": ${JSON.stringify(TABELLE)},\n "liste": ${JSON.stringify(fingerabdruck)},\n "merkmale": [\n${liste.map((e) => `  ${JSON.stringify(e)}`).join(',\n')}\n ],\n "items": ${block(imBericht)},\n "angehalten": ${block(angehalten)}\n}\n`);

const kb = Object.values(items).reduce((s, e) => s + e[1], 0);
const n = Object.keys(items).length;
console.log(`${n} Items in ${ZIEL} (im Schnitt ${Math.round(kb / Math.max(1, n))} KB je Item)`
  + `${ohneUpload ? `, ${ohneUpload} noch nicht hochgeladen` : ''}${ohneDatei ? `, ${ohneDatei} ohne Datei` : ''}${ohneBefund ? `, ${ohneBefund} ohne Befunde (alter Bäcker)` : ''}${kaputt ? `, ${kaputt} kaputte Protokollzeilen` : ''}`);
if (andereTabelle) console.log(`ACHTUNG: ${andereTabelle} Items mit einer anderen Merkmal-Tabelle gebacken (heute ${TABELLE}) und darum NICHT in der Liste: neu backen (scripts/item3d/batch.mjs)`);
console.log(`Bericht ${BERICHT}: ${liste.length} Merkmale, ${Object.keys(angehalten).length} Items angehalten`
  + (Object.keys(angehalten).length ? ` (${Object.entries(angehalten).slice(0, 10).map(([id, ks]) => `${id}: ${ks.map((i) => liste[i][0]).join(', ')}`).join('; ')})` : ''));
