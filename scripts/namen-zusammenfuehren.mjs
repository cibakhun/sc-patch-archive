// namen-zusammenfuehren.mjs — legt im fertigen assets/universal-items.json
// Items mit altem oder abweichendem Namen auf den Namen im Spiel zusammen
// (Tabelle scripts/lib/item-namen-aliase.mjs, IA C8, Krisz 24.11.2026).
//
// WARUM ES DIESES SKRIPT GIBT (und nicht einfach einen Neubau):
// build-universal-db.mjs fuehrt die Namen seit IA C8 beim Bau selbst zusammen.
// Ein Neubau braucht aber die Spieldaten-Extraktion vom PC
// (data/items-gamefiles.json, nicht im Repo). Dieses Skript zieht den
// committeten Katalog ohne Datenlauf nach und rechnet dabei wie der Bau:
//   - die Bezugszeilen beider Eintraege zusammen; Preislisten-Zeilen schlagen
//     den Shop-Schnappschuss (src: "schnappschuss"), wie in build-universal-db
//   - kann das Item laut Spiel nicht als Loot entstehen (game.lootable ===
//     false), fallen Loot-Zeilen und Guide weg, die Exklusiv-Zeile bleibt
//   - doppelte Zeilen raus, Sortierung wie im Bau (billigste zuerst, dann Ort)
//   - die Ids neu wie slugId() im Bau: ueber die nach Namen sortierte Liste.
//     Ein Item, das bisher nur wegen seines Doppels „-2" hiess, bekommt so
//     die Grund-Id (lynx-legs-2 -> lynx-legs), genau wie beim naechsten Neubau.
//   - Fundorte und Kennzahlen neu (wendeFundorteAn, wie apply:loot-fundorte)
// Danach zieht es die Ids in den Dateien nach, die Items per Id ansprechen
// (3D-Modelle, 3D-Befunde, Hangar-Waffenmodelle), und traegt jede
// verschwundene Adresse als 301 in nginx/umzuege.conf ein (EN und DE).
//
// Idempotent: ein zweiter Lauf findet nichts mehr und schreibt nichts.
// verify:namen-aliase prueft das Ergebnis im Tor.
//
// Aufruf: node scripts/namen-zusammenfuehren.mjs [--dry]
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NAMEN_ALIASE, ALTE_ADRESSEN } from './lib/item-namen-aliase.mjs';
import { wendeFundorteAn } from './lib/loot-orte.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DB = resolve(ROOT, 'assets', 'universal-items.json');
const FD = resolve(ROOT, 'src', 'data', 'loot-fundorte.json');
const UMZUEGE = resolve(ROOT, 'nginx', 'umzuege.conf');
const ID_DATEIEN = {
  item3d: resolve(ROOT, 'src', 'data', 'item-3d.json'),
  befunde: resolve(ROOT, 'src', 'data', 'item-3d-befunde.json'),
  hangar: resolve(ROOT, 'src', 'data', 'hangar-assets.json'),
};
const DRY = process.argv.includes('--dry');

const db = JSON.parse(readFileSync(DB, 'utf8'));
if (!Array.isArray(db.items)) throw new Error('universal-items.json: items ist keine Liste');
const schluessel = (n) => String(n).toLowerCase().trim();
const nachName = new Map();
for (const it of db.items) {
  const k = schluessel(it.name);
  if (nachName.has(k)) throw new Error(`zwei Items mit dem Namen "${it.name}" — der Katalog fuehrt Namen eindeutig, hier stimmt etwas Grundsaetzliches nicht`);
  nachName.set(k, it);
}

const fehler = [];
const zusammen = []; // [alt, ziel]
let schonZusammen = 0, lootGestrichen = 0, guidesGestrichen = 0, snapRueckfall = 0;
for (const [von, nach] of NAMEN_ALIASE) {
  const alt = nachName.get(schluessel(von));
  const ziel = nachName.get(schluessel(nach));
  if (!ziel) { fehler.push(`Ziel "${nach}" fehlt im Katalog`); continue; }
  if (!ziel.game) { fehler.push(`Ziel "${nach}" traegt keine Spieldaten — dann ist es nicht der Spielname`); continue; }
  if (!alt) { schonZusammen++; continue; }
  if (alt.game) { fehler.push(`"${von}" traegt selbst Spieldaten — kein Doppel, Paar pruefen`); continue; }
  zusammen.push([alt, ziel]);
}
if (fehler.length) {
  for (const f of fehler) console.error(`FEHLER: ${f}`);
  process.exit(1);
}

const zeilenSchluessel = (o) => `${o.kind}|${o.loc}|${o.price ?? ''}`;
const vorherZeilen = new Map(zusammen.map(([alt, ziel]) => [alt, ziel.obtain.length]));
for (const [alt, ziel] of zusammen) {
  const kauf = (o) => o.kind === 'shop';
  const alle = [...ziel.obtain, ...alt.obtain];
  // Shop-Zeilen: Preisliste vor Schnappschuss, wie im Bau (shopUex.length ? shopUex : shopSnap).
  const preisliste = alle.filter((o) => kauf(o) && o.src !== 'schnappschuss');
  let zeilen = preisliste.length ? alle.filter((o) => !(kauf(o) && o.src === 'schnappschuss')) : alle;
  let guide = ziel.guide ?? alt.guide ?? null;
  if (ziel.game.lootable === false) {
    const vorher = zeilen.length;
    zeilen = zeilen.filter((o) => o.kind !== 'loot');
    lootGestrichen += vorher - zeilen.length;
    if (alt.guide) guidesGestrichen++;
    guide = ziel.guide ?? null;
  }
  const gesehen = new Set();
  zeilen = zeilen.filter((o) => { const k = zeilenSchluessel(o); if (gesehen.has(k)) return false; gesehen.add(k); return true; });
  zeilen.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) || a.loc.localeCompare(b.loc));
  // Zaehler des Baus: Schnappschuss-Zeilen zaehlen nur, wo keine Preisliste greift.
  const snap = (rows) => rows.filter((o) => kauf(o) && o.src === 'schnappschuss').length;
  const uex = (rows) => rows.some((o) => kauf(o) && o.src !== 'schnappschuss');
  snapRueckfall += (preisliste.length ? 0 : snap(alle)) - (uex(alt.obtain) ? 0 : snap(alt.obtain)) - (uex(ziel.obtain) ? 0 : snap(ziel.obtain));
  // Feldreihenfolge wie im Bau (id, name, category, obtain, guide, game, …),
  // damit ein Neubau mit derselben Tabelle byte-gleich herauskommt.
  const VORN = ['id', 'name', 'category', 'obtain', 'guide', 'game'];
  const { id, name, category, game } = ziel;
  const rest = Object.entries(ziel).filter(([f]) => !VORN.includes(f));
  for (const f of Object.keys(ziel)) delete ziel[f];
  Object.assign(ziel, { id, name, category, obtain: zeilen }, guide ? { guide } : {}, game ? { game } : {}, Object.fromEntries(rest));
}

// Ids neu wie slugId() in build-universal-db.mjs.
const weg = new Set(zusammen.map(([alt]) => alt));
const zielVon = new Map(zusammen.map(([alt, ziel]) => [alt.id, ziel]));
const bleiben = db.items.filter((i) => !weg.has(i));
bleiben.sort((a, b) => a.name.localeCompare(b.name, 'en'));
const vergeben = new Set();
const slugId = (name) => {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
  let id = base, n = 2;
  while (vergeben.has(id)) id = `${base}-${n++}`;
  vergeben.add(id);
  return id;
};
const umbenannt = new Map(); // alte Id -> neue Id (bleibendes Item)
for (const it of bleiben) {
  const neu = slugId(it.name);
  if (neu !== it.id) umbenannt.set(it.id, neu);
}
// Adressen, die verschwinden: die alten Ids der zusammengelegten Eintraege und
// alte Ids bleibender Items, die nicht wieder vergeben sind.
const neueIds = new Set(bleiben.map((it) => umbenannt.get(it.id) ?? it.id));
const umzug = new Map(); // alte Id -> neue Id des Ziels
for (const [alt, ziel] of zusammen) if (!neueIds.has(alt.id)) umzug.set(alt.id, umbenannt.get(ziel.id) ?? ziel.id);
for (const [vorher, nachher] of umbenannt) if (!neueIds.has(vorher)) umzug.set(vorher, nachher);
// Ein bleibendes Item darf seine Id nur von seinem eigenen Doppel uebernehmen,
// nie von einem fremden Item. Sonst zeigte eine bekannte Adresse still auf
// etwas anderes.
const nachId = new Map(db.items.map((it) => [it.id, it]));
for (const [vorher, nachher] of umbenannt) {
  const it = nachId.get(vorher);
  const frueher = nachId.get(nachher);
  if (!frueher || !weg.has(frueher) || zielVon.get(nachher) !== it) {
    fehler.push(`${vorher} -> ${nachher}: die neue Id gehoerte ${frueher ? `"${frueher.name}"` : 'niemandem'}, nicht einem Doppel von "${it.name}"`);
  }
}
if (fehler.length) {
  for (const f of fehler) console.error(`FEHLER: ${f}`);
  process.exit(1);
}

console.log(`Paare in der Tabelle: ${NAMEN_ALIASE.length}   schon zusammengelegt: ${schonZusammen}   jetzt zusammengelegt: ${zusammen.length}`);
for (const [alt, ziel] of zusammen) console.log(`   ${alt.id}  ->  ${umbenannt.get(ziel.id) ?? ziel.id}   (${alt.obtain.length} + ${vorherZeilen.get(alt)} Zeilen -> ${ziel.obtain.length})`);
console.log(`Loot-Zeilen gestrichen (laut Spiel kein Loot): ${lootGestrichen}   Guides gestrichen: ${guidesGestrichen}`);
console.log(`Ids neu vergeben: ${umbenannt.size}${umbenannt.size ? ` (${[...umbenannt].map(([a, b]) => `${a} -> ${b}`).join(', ')})` : ''}`);
console.log(`Verschwundene Adressen (301): ${umzug.size}`);
console.log(`Katalog: ${db.items.length} -> ${bleiben.length}`);
if (!zusammen.length) { console.log('Nichts zu tun.'); process.exit(0); }
// Erst alles im Speicher rechnen und pruefen, dann schreiben, den Katalog
// zuletzt (Review #471): scheitert eine Pruefung, ist nichts geschrieben.
// Bricht das Schreiben mittendrin ab, steht das Doppel noch im Katalog; ein
// neuer Lauf legt es wieder zusammen und erkennt die schon umgeschluesselten
// Verweise und vorhandenen Weiterleitungen als erledigt.
for (const it of bleiben) if (umbenannt.has(it.id)) it.id = umbenannt.get(it.id);
db.items = bleiben;
if (db.counts) {
  db.counts.items = bleiben.length;
  db.counts.purgedLootRows = (db.counts.purgedLootRows ?? 0) + lootGestrichen;
  db.counts.purgedGuides = (db.counts.purgedGuides ?? 0) + guidesGestrichen;
  if (db.counts.snapFallbackRows != null) db.counts.snapFallbackRows += snapRueckfall;
}
const fz = wendeFundorteAn(db, JSON.parse(readFileSync(FD, 'utf8')));
const katalogText = JSON.stringify(db);

// Jede verschwundene Adresse muss in ALTE_ADRESSEN stehen, mit dem Spielnamen
// als Ziel: daraus prueft verify:namen-aliase [4] die Weiterleitungen.
const nameVonId = new Map(bleiben.map((it) => [it.id, it.name]));
const festgehalten = new Map(ALTE_ADRESSEN.map(([id, nach]) => [id, nach]));
for (const [vorher, nachher] of umzug) {
  const nach = nameVonId.get(nachher);
  if (festgehalten.get(vorher) !== nach) fehler.push(`verschwundene Adresse ${vorher} (-> "${nach}") fehlt in ALTE_ADRESSEN (scripts/lib/item-namen-aliase.mjs) oder nennt ein anderes Ziel — dort ergaenzen`);
}

// Dateien, die Items per Id ansprechen. Ersetzt wird im Text, damit ihr
// Format (eine Zeile je Item) bleibt, wie die Erzeuger es schreiben.
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Hat das Modell `vorher` (irgendwo in der Hangar-Liste) schon key = `nachher`?
function hangarKeyIst(text, vorher, nachher) {
  const suche = (o) => o && typeof o === 'object' && (o[vorher]?.key === nachher || Object.values(o).some(suche));
  return suche(JSON.parse(text));
}
const vorherText = {}, nachherText = {}, nachgezogen = {};
for (const [art, pfad] of Object.entries(ID_DATEIEN)) {
  let text = (vorherText[art] = readFileSync(pfad, 'utf8'));
  let n = 0;
  for (const [vorher, nachher] of umbenannt) {
    // 3D-Dateien: Schluessel am Zeilenanfang. Hangar: das Feld key verbindet
    // ein Modell (benannt nach seiner Datei) mit dem Katalog-Item
    // (src/lib/hangar/layouts.ts: a.key ?? file).
    const muster = art === 'hangar' ? new RegExp(`"key": "${esc(vorher)}"`, 'g') : new RegExp(`^(\\s*)"${esc(vorher)}":`, 'gm');
    const treffer = text.match(muster)?.length ?? 0;
    if (!treffer) {
      // Ein Modell, das nach der alten Id heisst, braucht key = neue Id. Traegt
      // es den schon (frueherer Lauf), ist nichts zu tun; sonst von Hand.
      if (art === 'hangar' && new RegExp(`"${esc(vorher)}": \\{`).test(text) && !hangarKeyIst(text, vorher, nachher)) fehler.push(`${pfad}: Modell ${vorher} ohne Feld key — von Hand nachziehen`);
      continue;
    }
    if (art !== 'hangar' && (treffer > 1 || new RegExp(`^\\s*"${esc(nachher)}":`, 'm').test(text))) { fehler.push(`${pfad}: ${vorher} -> ${nachher} nicht eindeutig umschluesselbar`); continue; }
    text = text.replace(muster, art === 'hangar' ? `"key": "${nachher}"` : `$1"${nachher}":`);
    n += treffer;
  }
  nachherText[art] = text;
  nachgezogen[art] = n;
}
// Der 3D-Bericht traegt den Fingerabdruck der Liste (Item und Modelldatei),
// damit verify:item3d-befunde einen Bericht aus einem anderen Lauf erkennt.
// Umgeschluesselt sind beide gleich: dieselben Modelle, dieselben Befunde, nur
// die Id ist neu. Das gilt aber nur, wenn der Bericht schon vorher zur Liste
// passte (Review #471): sonst machte das Umschluesseln einen fremden Bericht
// passend. Derselbe Abdruck wie in scripts/item3d/manifest.mjs bzw. im Tor.
const abdruckVon = (text) => {
  const liste = JSON.parse(text).items ?? {};
  return createHash('sha256').update(JSON.stringify(Object.keys(liste).sort().map((id) => [id, liste[id]?.[0] ?? null]))).digest('hex').slice(0, 16);
};
const LISTE_RE = /^( "liste": )"([0-9a-f]{16})",$/m;
if (nachherText.item3d !== vorherText.item3d) {
  const bisher = vorherText.befunde.match(LISTE_RE)?.[2];
  const passend = abdruckVon(vorherText.item3d);
  if (bisher !== passend) fehler.push(`${ID_DATEIEN.befunde}: Fingerabdruck ${bisher ?? '(fehlt)'} passt schon vor dem Umschluesseln nicht zur Liste (${passend}) — der Bericht stammt aus einem anderen Lauf; erst node scripts/item3d/manifest.mjs, dann dieses Skript erneut`);
  else nachherText.befunde = nachherText.befunde.replace(LISTE_RE, `$1"${abdruckVon(nachherText.item3d)}",`);
}

// 301 je verschwundene Adresse, EN und DE, alphabetisch eingereiht.
const confVorher = readFileSync(UMZUEGE, 'utf8');
const kopf = [], paare = [];
for (const z of confVorher.split('\n')) (z.startsWith('#') || (!paare.length && !z.trim()) ? kopf : paare).push(z);
const vorhanden = new Set(paare.filter((z) => z.trim()).map((z) => z.split(' ')[0]));
let neu = 0;
for (const [vorher, nachher] of umzug) {
  for (const p of ['', '/de']) {
    const quelle = `${p}/items/${vorher}.html`;
    if (vorhanden.has(quelle)) continue;
    paare.push(`${quelle} ${p}/items/${nachher}.html;`);
    neu++;
  }
}
const confNachher = `${[...kopf, ...paare.filter((z) => z.trim()).sort()].join('\n')}\n`;

if (fehler.length) {
  for (const f of fehler) console.error(`FEHLER: ${f}`);
  console.error('Nichts geschrieben.');
  process.exit(1);
}
if (DRY) { console.log('--dry: alles geprueft, nichts geschrieben.'); process.exit(0); }

for (const art of Object.keys(ID_DATEIEN)) {
  if (nachherText[art] !== vorherText[art]) writeFileSync(ID_DATEIEN[art], nachherText[art]);
  console.log(`${art}: ${nachgezogen[art]} Id(s) nachgezogen${art === 'befunde' && nachherText.befunde !== vorherText.befunde ? `, Fingerabdruck der Liste -> ${nachherText.befunde.match(LISTE_RE)[2]}` : ''}`);
}
if (confNachher !== confVorher) writeFileSync(UMZUEGE, confNachher);
console.log(`nginx/umzuege.conf: ${neu} Weiterleitung(en) neu`);
writeFileSync(DB, katalogText);
console.log(`OK: ${DB} (Fundorte ${fz.items} Items, withObtain ${db.counts?.withObtain})`);
