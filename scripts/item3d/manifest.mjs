// Items in 3D: macht aus dem Bauprotokoll (<out>/manifest.jsonl) die Liste für
// die Seite (src/data/item-3d.json) und den Befundbericht daneben
// (src/data/item-3d-befunde.json).
//
//   node scripts/item3d/manifest.mjs <out> <repo>/src/data/item-3d.json [--alle]
//
// In die Liste kommt ein Item nur, wenn
//   - sein Modell UND alle seine Texturen in <out>/hochgeladen.txt stehen
//     (ohne --alle; sonst zeigte die Seite einen Knopf, hinter dem nichts liegt),
//   - es kein Merkmal trägt, das die Tabelle anhält (unbekannt oder Fehler,
//     scripts/lib/item3d-merkmale.mjs). Eingeordnet wird hier neu, mit der
//     Tabelle dieses Checkouts, nicht mit dem Urteil des Laufs.
// Der Bericht nennt je Item seine Merkmale samt Einordnung; angehaltene
// Items stehen dort mit Grund. Das Tor verify:item3d-befunde prüft Liste und
// Bericht gegen die Tabelle.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { einordnen, HALT } from '../lib/item3d-merkmale.mjs';

const argv = process.argv.slice(2);
const ALLE = argv.includes('--alle');
const [OUT, ZIEL] = argv.filter((a) => !a.startsWith('--'));
if (!OUT || !ZIEL) { console.error('Aufruf: node scripts/item3d/manifest.mjs <out> <ziel.json> [--alle]'); process.exit(2); }
const BERICHT = join(dirname(ZIEL), 'item-3d-befunde.json');

const zeilen = readFileSync(join(OUT, 'manifest.jsonl'), 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
const letzte = new Map();
for (const z of zeilen) letzte.set(z.id, z); // spätere Läufe gewinnen
const oben = existsSync(join(OUT, 'hochgeladen.txt'))
  ? new Set(readFileSync(join(OUT, 'hochgeladen.txt'), 'utf8').split(/\r?\n/).filter(Boolean))
  : new Set();

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
let ohneUpload = 0, ohneDatei = 0, ohneBefund = 0;
for (const id of [...letzte.keys()].sort()) {
  const z = letzte.get(id);
  if (!existsSync(join(OUT, z.file))) { ohneDatei++; continue; }
  if (!ALLE && (!oben.has(z.file) || z.tex.some((h) => !oben.has(`t/${h}.webp`)))) { ohneUpload++; continue; }
  // Zeilen ohne Befunde stammen aus einem Bäcker vor der Merkmal-Tabelle:
  // nicht ungeprüft in die Liste.
  if (!z.merk) { ohneBefund++; continue; }
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

// Bericht: jedes Merkmal einmal mit seiner Einordnung zur Zeit des Laufs,
// je Item die Indizes seiner Merkmale.
const liste = [...merkmale.keys()].map((k) => [k, einordnen(k).art]);
writeFileSync(BERICHT, `{\n "_": ${JSON.stringify('Items in 3D: Befunde je Item aus dem Massenlauf (scripts/item3d/manifest.mjs). merkmale: [Merkmal, Einordnung] nach scripts/lib/item3d-merkmale.mjs; items und angehalten: je Item die Indizes seiner Merkmale (angehalten: nur die anhaltenden). Das Tor verify:item3d-befunde prüft Liste und Bericht gegen die Tabelle.')},\n "merkmale": [\n${liste.map((e) => `  ${JSON.stringify(e)}`).join(',\n')}\n ],\n "items": ${block(imBericht)},\n "angehalten": ${block(angehalten)}\n}\n`);

const kb = Object.values(items).reduce((s, e) => s + e[1], 0);
const n = Object.keys(items).length;
console.log(`${n} Items in ${ZIEL} (im Schnitt ${Math.round(kb / Math.max(1, n))} KB je Item)`
  + `${ohneUpload ? `, ${ohneUpload} noch nicht hochgeladen` : ''}${ohneDatei ? `, ${ohneDatei} ohne Datei` : ''}${ohneBefund ? `, ${ohneBefund} ohne Befunde (alter Bäcker)` : ''}`);
console.log(`Bericht ${BERICHT}: ${liste.length} Merkmale, ${Object.keys(angehalten).length} Items angehalten`
  + (Object.keys(angehalten).length ? ` (${Object.entries(angehalten).slice(0, 10).map(([id, ks]) => `${id}: ${ks.map((i) => liste[i][0]).join(', ')}`).join('; ')})` : ''));
