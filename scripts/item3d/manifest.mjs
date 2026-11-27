// Items in 3D: macht aus dem Bauprotokoll (<out>/manifest.jsonl) die Liste für
// die Seite (src/data/item-3d.json) und den Befundbericht daneben
// (src/data/item-3d-befunde.json).
//
//   node scripts/item3d/manifest.mjs <out> <repo>/src/data/item-3d.json --liste <liste.json> --env <r2.env> [--bucket versebase-items]
//   node scripts/item3d/manifest.mjs <out> <ziel.json> --liste <liste.json> --alle     (lokal, ohne Upload-Nachweis)
//
// <liste.json> ist die Backliste aus scripts/item3d/liste.mjs (der ganze
// Katalog). Der Bericht nennt für JEDES Item des Katalogs sein Schicksal
// (abdeckung): in der Liste, angehalten, ohne Modell, gescheitert, offen oder
// ohne Record. So fällt eine ganze Art, die nie gebacken wurde, im Tor auf
// (bis 27.11.2026 fehlten Kleidung, Werkzeuge und Verbrauchsgüter still).
//
// In die Liste kommt ein Item nur, wenn
//   - es in der Backliste steht (eine umbenannte Item-ID lässt ihr altes
//     Modell sonst unter dem alten Namen stehen),
//   - sein Modell UND alle seine Texturen in <out>/hochgeladen.txt stehen
//     (ohne --alle; sonst zeigte die Seite einen Knopf, hinter dem nichts liegt),
//     und dieser Nachweis zu Bucket und Endpunkt der Seite gehört
//     (<out>/hochgeladen.ziel gegen --bucket und R2_ENDPOINT aus --env; aus
//     der Datei wird nur der Endpunkt gelesen, als Kennung verglichen),
//   - sein jüngster Bau gelang: ein späterer Fehlschlag in fehler.jsonl
//     (Zeit zeit) sperrt das ältere Modell, bis ein neuer Erfolg kommt,
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
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : d; };
const BUCKET = flag('--bucket', 'versebase-items');
const ENV = flag('--env', null);
const LISTE = flag('--liste', null);
const [OUT, ZIEL] = argv;
if (!OUT || !ZIEL || !LISTE || (!ALLE && !ENV)) { console.error('Aufruf: node scripts/item3d/manifest.mjs <out> <ziel.json> --liste <liste.json> --env <r2.env> [--bucket …]  |  … --alle'); process.exit(2); }
const backliste = JSON.parse(readFileSync(LISTE, 'utf8'));
if (!Array.isArray(backliste?.liste) || typeof backliste?.katalog !== 'string' || !backliste?.zahl) { console.error(`${LISTE} ist keine Liste aus scripts/item3d/liste.mjs`); process.exit(2); }
if (!backliste.bereiche || typeof backliste.bereiche !== 'object') { console.error(`${LISTE} hat keine Bereiche (bereiche): mit dem heutigen scripts/item3d/liste.mjs neu erzeugen`); process.exit(2); }
const inBackliste = new Set(backliste.liste.map((e) => e.id));
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
  // Endpunkt-Kennung wie in upload.mjs: sha256 des Hosts, 12 Zeichen
  const ep = readFileSync(ENV, 'utf8').split(/\r?\n/).map((l) => l.match(/^\s*R2_ENDPOINT\s*=\s*(.*?)\s*$/)).find(Boolean)?.[1]?.replace(/^["']|["']$/g, '');
  if (!ep) { console.error(`R2_ENDPOINT fehlt in ${ENV}`); process.exit(2); }
  const endpunkt = createHash('sha256').update(new URL(ep).host).digest('hex').slice(0, 12);
  if (!ziel || ziel.bucket !== BUCKET || ziel.endpunkt !== endpunkt) {
    console.error(ziel ? `hochgeladen.txt gehört zu ${ziel.bucket} (${ziel.endpunkt}), die Seite liest ${BUCKET} (${endpunkt}): kein gültiger Upload-Nachweis` : 'hochgeladen.ziel fehlt: erst scripts/item3d/upload.mjs laufen lassen (vermerkt das Ziel)');
    process.exit(2);
  }
  if (existsSync(join(OUT, 'hochgeladen.txt'))) oben = new Set(readFileSync(join(OUT, 'hochgeladen.txt'), 'utf8').split(/\r?\n/).filter(Boolean));
}

// Fehlschläge: Testeinträge des Spiels (der Lauf lehnt sie ab) fallen immer
// heraus, auch wenn ein früherer Lauf sie noch gebaut hatte. Jeder andere
// Fehlschlag sperrt einen älteren Erfolg (Zeit zeit; Zeilen ohne Zeit zählen
// als 0, ein Gleichstand sperrt nicht).
// Ein Fehlschlag nennt im Bericht auch die Ursache, die der Bäcker als
// Fehler festhielt (merk, eingeordnet nach der Tabelle): „keine sichtbaren
// Teilnetze“ hieß sonst auch „Netzdatei fehlt“ (Review #488).
const ursache = (f) => Object.keys(f?.merk ?? {}).filter((k) => einordnen(k).art === 'fehler').map((k) => k.replace(/^Bau /, '')).sort().join(', ');
const test = new Set(), gescheitert = new Map(), fehlerGrund = new Map(), fehlerUrsache = new Map();
if (existsSync(join(OUT, 'fehler.jsonl'))) {
  for (const l of readFileSync(join(OUT, 'fehler.jsonl'), 'utf8').split(/\r?\n/)) {
    if (!l.trim()) continue;
    let f; try { f = JSON.parse(l); } catch { kaputt++; continue; }
    if (typeof f?.id !== 'string') continue;
    if (/Testeintrag/.test(f.fehler)) test.add(f.id);
    const zeit = Number(f.zeit) || 0;
    if (zeit >= (gescheitert.get(f.id) ?? -1)) { fehlerGrund.set(f.id, String(f.fehler ?? 'unbekannt')); fehlerUrsache.set(f.id, ursache(f)); }
    gescheitert.set(f.id, Math.max(gescheitert.get(f.id) ?? 0, zeit));
  }
}
for (const id of test) letzte.delete(id);
// Nur Items der Backliste: eine alte ID (umbenannt, aus dem Katalog
// verschwunden) bleibt im Bauprotokoll, aber nicht auf der Seite.
let nichtInListe = 0;
for (const id of [...letzte.keys()]) if (!inBackliste.has(id)) { letzte.delete(id); nichtInListe++; }
let gesperrt = 0;
for (const [id, z] of [...letzte]) if ((gescheitert.get(id) ?? 0) > (Number(z.zeit) || 0)) { letzte.delete(id); gesperrt++; }

const items = {};
const merkmale = new Map(); // Schlüssel -> Index im Bericht
const idx = (k) => { if (!merkmale.has(k)) merkmale.set(k, merkmale.size); return merkmale.get(k); };
const imBericht = {}, angehalten = {};
const offen = new Map(); // id -> Grund, warum ein gebautes Modell nicht in die Liste kommt
let ohneUpload = 0, ohneDatei = 0, ohneBefund = 0, andereTabelle = 0;
for (const id of [...letzte.keys()].sort()) {
  const z = letzte.get(id);
  if (!existsSync(join(OUT, z.file))) { ohneDatei++; offen.set(id, 'Modelldatei fehlt'); continue; }
  if (!ALLE && (!oben.has(z.file) || z.tex.some((h) => !oben.has(`t/${h}.webp`)))) { ohneUpload++; offen.set(id, 'nicht hochgeladen'); continue; }
  // Zeilen ohne Befunde stammen aus einem Bäcker vor der Merkmal-Tabelle:
  // nicht ungeprüft in die Liste.
  if (!z.merk) { ohneBefund++; offen.set(id, 'alter Bäcker ohne Befunde'); continue; }
  // Mit einer anderen Tabelle gebacken: die Befunde wären hier anders
  // eingeordnet als beim Backen. Nicht in die Liste, neu backen.
  if (z.tab !== TABELLE) { andereTabelle++; offen.set(id, 'mit anderer Tabelle gebacken'); continue; }
  const keys = Object.keys(z.merk).sort();
  const halt = keys.filter((k) => HALT.has(einordnen(k).art));
  if (halt.length) { angehalten[id] = halt.map(idx); continue; }
  items[id] = [z.file, z.kb];
  imBericht[id] = keys.map(idx);
}

// Abdeckung: jedes Item des Katalogs mit genau einem Schicksal. In der
// Liste und angehalten stehen oben; alles andere hier mit Grund (aus dem
// Bauprotokoll, sonst „noch nicht gebacken“). Gründe ohne Pfad und Zahl,
// damit gleiche Fälle zusammenstehen.
const luecken = {};
const zuLuecke = (grund, id) => (luecken[grund] ??= []).push(id);
const grundKurz = (g) => String(g).replace(/\s*\(.*$/s, '').replace(/^Name trifft \d+ Records$/, 'Name trifft mehrere Records').trim().slice(0, 80) || 'unbekannt';
for (const { id } of backliste.liste) {
  if (items[id] || angehalten[id]) continue;
  if (offen.has(id)) zuLuecke(`offen: ${offen.get(id)}`, id);
  else if (test.has(id)) zuLuecke('Testeintrag des Spiels', id);
  else if (fehlerGrund.has(id)) zuLuecke(`${grundKurz(fehlerGrund.get(id))}${fehlerUrsache.get(id) ? `: ${fehlerUrsache.get(id)}` : ''}`, id);
  else zuLuecke('offen: noch nicht gebacken', id);
}
for (const [id, g] of Object.entries(backliste.ohneRecord ?? {})) zuLuecke(`ohne Record: ${grundKurz(g)}`, id);
const lueckenSortiert = Object.fromEntries(Object.entries(luecken).sort((x, y) => y[1].length - x[1].length || x[0].localeCompare(y[0])).map(([g, l]) => [g, l.sort()]));
const nLuecken = Object.values(luecken).reduce((n, l) => n + l.length, 0);
const abdeckung = { katalog: backliste.katalog, zahl: { katalog: backliste.zahl.katalog, gelistet: Object.keys(items).length, angehalten: Object.keys(angehalten).length, luecken: nLuecken } };
// Bereich jedes Katalog-Items zur Zeit des Laufs: danach zählt die Klinke je
// Bereich im Tor, auch wenn ein späterer Datenlauf Items umordnet oder
// streicht (Review #488). Eine Zeile je Bereich.
const bereiche = Object.fromEntries(Object.entries(backliste.bereiche).sort((x, y) => x[0].localeCompare(y[0])).map(([b, l]) => [b, [...l].sort()]));
const nBereiche = Object.values(bereiche).reduce((n, l) => n + l.length, 0);
if (nBereiche !== backliste.zahl.katalog) { console.error(`FEHLER: Bereiche der Liste nennen ${nBereiche} Items, der Katalog des Laufs hat ${backliste.zahl.katalog}`); process.exit(1); }

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
writeFileSync(BERICHT, `{\n "_": ${JSON.stringify('Items in 3D: Befunde je Item aus dem Massenlauf (scripts/item3d/manifest.mjs). merkmale: [Merkmal, Einordnung] nach scripts/lib/item3d-merkmale.mjs; items und angehalten: je Item die Indizes seiner Merkmale (angehalten: nur die anhaltenden). abdeckung: Schicksal jedes Katalog-Items, das weder gelistet noch angehalten ist, nach Grund, und der Bereich jedes Katalog-Items zur Zeit des Laufs (scripts/item3d/liste.mjs). Das Tor verify:item3d-befunde prüft Liste und Bericht gegen die Tabelle und gegen den Katalog.')},\n "tabelle": ${JSON.stringify(TABELLE)},\n "liste": ${JSON.stringify(fingerabdruck)},\n "merkmale": [\n${liste.map((e) => `  ${JSON.stringify(e)}`).join(',\n')}\n ],\n "items": ${block(imBericht)},\n "angehalten": ${block(angehalten)},\n "abdeckung": {\n  "katalog": ${JSON.stringify(abdeckung.katalog)},\n  "zahl": ${JSON.stringify(abdeckung.zahl)},\n  "luecken": {\n${Object.entries(lueckenSortiert).map(([g, l]) => `   ${JSON.stringify(g)}: ${JSON.stringify(l)}`).join(',\n')}\n  },\n  "bereiche": {\n${Object.entries(bereiche).map(([b, l]) => `   ${JSON.stringify(b)}: ${JSON.stringify(l)}`).join(',\n')}\n  }\n }\n}\n`);

const kb = Object.values(items).reduce((s, e) => s + e[1], 0);
const n = Object.keys(items).length;
console.log(`${n} Items in ${ZIEL} (im Schnitt ${Math.round(kb / Math.max(1, n))} KB je Item)`
  + `${ohneUpload ? `, ${ohneUpload} noch nicht hochgeladen` : ''}${ohneDatei ? `, ${ohneDatei} ohne Datei` : ''}${ohneBefund ? `, ${ohneBefund} ohne Befunde (alter Bäcker)` : ''}${kaputt ? `, ${kaputt} kaputte Protokollzeilen` : ''}`);
if (gesperrt) console.log(`ACHTUNG: ${gesperrt} Items sind nach ihrem letzten Erfolg gescheitert (fehler.jsonl) und darum NICHT in der Liste`);
if (nichtInListe) console.log(`${nichtInListe} Items im Bauprotokoll stehen nicht mehr in der Backliste (umbenannt oder aus dem Katalog) und bleiben draußen`);
console.log(`Abdeckung: Katalog ${abdeckung.zahl.katalog} = ${abdeckung.zahl.gelistet} in der Liste + ${abdeckung.zahl.angehalten} angehalten + ${nLuecken} Lücken (${Object.entries(lueckenSortiert).slice(0, 8).map(([g, l]) => `${g} ${l.length}`).join(', ')})`);
if (abdeckung.zahl.gelistet + abdeckung.zahl.angehalten + nLuecken !== abdeckung.zahl.katalog) { console.error('FEHLER: Schicksale decken den Katalog nicht ab'); process.exit(1); }
if (andereTabelle) console.log(`ACHTUNG: ${andereTabelle} Items mit einer anderen Merkmal-Tabelle gebacken (heute ${TABELLE}) und darum NICHT in der Liste: neu backen (scripts/item3d/batch.mjs)`);
console.log(`Bericht ${BERICHT}: ${liste.length} Merkmale, ${Object.keys(angehalten).length} Items angehalten`
  + (Object.keys(angehalten).length ? ` (${Object.entries(angehalten).slice(0, 10).map(([id, ks]) => `${id}: ${ks.map((i) => liste[i][0]).join(', ')}`).join('; ')})` : ''));
