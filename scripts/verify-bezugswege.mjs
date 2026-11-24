// verify-bezugswege.mjs — Zeigt jedes Item-Blatt seine Wege, jeder Bauplan
// seine Quelle, jede Waffe eine Feuerrate?
//
// WARUM ES DEN GIBT (UX-Audit 24.11.2026, Paket D): Das Item-Blatt ist der
// groesste Einstieg der Seite. Es nannte nie eine Mission (Item -> Mission 0 %),
// obwohl „Bauplan -> Mission" der haeufigste Uebergang ist; 940 Bauplaene
// endeten in der Vermutung „evtl. über Shop oder Reputation"; 190 Waffenblaetter
// zeigten zwei verschiedene Feuerraten. Alle drei Luecken entstehen still: ein
// Datenlauf, der den Join Item -> Bauplan -> Mission bricht, ein Umbau, der den
// Block verliert, ein sync:items mit einem alten Bauskript.
//
// ZUSICHERUNGEN (gegen dist/, Grundsatz 7; alle FEHLER):
//   1  Jedes Item-Blatt beider Sprachen traegt „So bekommst du es"
//      (#so-bekommst-du-es) mit mindestens einem Weg oder dem Hinweis-Link.
//      Klinke fuer die Zahl der Blaetter.
//   2  Item -> Mission: verlinkt der Block einen Bauplan, dessen Seite
//      Missionen verlinkt, nennt auch der Block mindestens eine Mission.
//      Klinke fuer die Zahl der Item-Blaetter mit Missionslink.
//   3  Jede Bauplan-Seite verlinkt Missionen oder sagt ihre Quelle ehrlich
//      (data-quelle) mit Hinweis-Link; die alte Vermutung steht nirgends mehr.
//      Klinke fuer die Zahl der Bauplan-Seiten.
//   4  Eine Feuerrate je Waffe: zeigt ein Blatt die Kennzahl Feuerrate oder
//      Magazin, steht dieselbe Groesse nicht noch einmal im Beschreibungstext.
//   5  Der Katalog (assets/ und dist/assets/universal-items.json) steht auf
//      dem Stand der Regel in scripts/lib/hersteller-zeilen.mjs.
//   6  Fahrzeug-Itemblaetter verlinken sichtbar ihr Schiffsblatt (Krisz,
//      24.11.2026: gleichrangig, kein Canonical, gegenseitige Links). Klinke.
//   Zweite Stufe (P2, gleicher Tag):
//   7  D4 Pool statt „100 %": jede Zeile der Missionstabelle eines Bauplans
//      nennt ihren Pool (data-pool), keine Zelle sagt nur „100 %". Klinke.
//      Zieht die Mission aus mehreren Pools (src/data/missions.json), nennt
//      keine Zeile mehr Bauplaene als ihr groesster Pool.
//   8  D10 Der Planer-Knopf steht je Bauplan- und Crafting-Kategorieseite
//      hoechstens einmal.
//   9  D7 Kein Seitentitel doppelt unter den Item- und Bauplan-Seiten einer
//      Sprache; gleichnamige Seiten verlinken einander (data-zwilling). Welche
//      Seiten gleichnamig sind, sagt die Ueberschrift, nicht der Hinweis: jede
//      Seite einer Namensgruppe traegt ihn und verlinkt alle anderen, keine
//      Seite ohne Zwilling traegt ihn.
//  10  D6 Schiffsteile verlinken ihr Schiff; die Zahl der Item-Blaetter ganz
//      ohne Weg bleibt unter ihrer Decke (Decken wandern nur nach UNTEN).
//  11  D5 Bezugsquellen: kein Ø-Preis je Zeile, Preisspalte nur mit Preis,
//      keine Zelle nur mit „—", Systemfilter genau dann, wenn die Zeilen mehr
//      als ein System (oder „ohne“) nennen.
//  12  D8 Bauplan-Seiten nennen fuer JEDES Material Abbau und Kauf (als Weg
//      oder ausdrueckliches „nein“) und schlagen nie vor,
//      das herzustellende Item selbst zu zerlegen. Klinke.
//  13  P52 Eine Blueprint-Zahl: Verzeichnis (/crafting.html) und Werkbank
//      (/topics/crafting.html) nennen je Sprache dieselbe Zahl, und sie ist
//      die Zahl der Bauplan-Seiten; der Satz zum Spielbestand rechnet auf
//      (gezeigt + ohne Item = alle Bauplaene in crafting-db.json). Und eine
//      Einheit: die ausgelieferte Crafting-Datenbank (assets/crafting-app.js)
//      zeigt Mengen in SCU wie die Bauplan-Seiten, nirgends als cSCU.
//  14  P64 „Ähnliche Items" einer Handwaffe: gleiche Waffenart vor jeder
//      anderen (scripts/lib/waffen-art.mjs), die erste Karte hat die Art,
//      sobald die Kategorie eine zweite Waffe dieser Art kennt, und kein
//      Modell steht oefter als AUSFUEHRUNGEN_JE_MODELL mal da. Klinke.
// SELBSTAUSKUNFT ohne Urteil: Kaufzeilen ohne Systemangabe (Fremdquelle,
// nie FEHLER, Grundsatz 3).
//
// Schiene A: kein git, kein Netz, keine Spielinstallation — dist/ und
// committete JSON.
//
//   node scripts/verify-bezugswege.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { doppelteZeilen } from './lib/hersteller-zeilen.mjs';
import { AUSFUEHRUNGEN_JE_MODELL, modellName, waffenArt } from './lib/waffen-art.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');

// Klinken (Grundsatz 5): nur nach OBEN; nach unten nur per Commit, dessen
// Botschaft die Ursache nennt. Erster Lauf 24.11.2026 (Katalog 4.10.3) —
// Werte im Registry-Eintrag; die Klinken knapp darunter.
const KLINKEN = {
  itemBlaetter: 11500, mitMission: 1350, bauplanSeiten: 3200, fahrzeugBlaetter: 350, katalogItems: 9000,
  poolTabellen: 1350, materialSeiten: 3200, schiffsteile: 210, bezugsTabellen: 10900,
  waffenBlaetter: 700,
};
// Decken (P2): nur nach UNTEN. Item-Blaetter beider Sprachen ganz ohne Weg —
// vor D6 430 (215 je Sprache), danach 278.
const DECKEN = { ohneWeg: 290 };

const fail = [];
const need = (cond, msg) => { if (!cond) fail.push(msg); };
const liste = (xs, n = 10) => xs.slice(0, n).join(', ') + (xs.length > n ? ` … (+${xs.length - n})` : '');

if (!existsSync(join(DIST, 'items'))) {
  console.error('verify:bezugswege: dist/items fehlt — erst bauen (npm run build), dann pruefen');
  process.exit(1);
}

/** Seiten eines Ordners (nur Dateien direkt darin), als [Pfad, Quelltext]. */
function* seiten(rel) {
  const dir = join(DIST, rel);
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    if (!f.isFile() || !f.name.endsWith('.html')) continue;
    yield [`/${rel}/${f.name}`, readFileSync(join(dir, f.name), 'utf8')];
  }
}

/** Der Abschnitt ab dem Element mit dieser id bis zu seinem </section>. */
function abschnitt(html, id) {
  const i = html.indexOf(`id="${id}"`);
  if (i < 0) return null;
  const start = html.lastIndexOf('<section', i);
  const ende = html.indexOf('</section>', i);
  return ende < 0 ? null : html.slice(start, ende);
}

/**
 * Ueberschrift einer Seite als Vergleichsschluessel (wie src/lib/vehicleItems.ts):
 * Text ohne Tags und Entitaeten, klein, nur Buchstaben und Ziffern. Zeichen-
 * weise statt per Regex-Ersetzung — ein Vergleichsschluessel, kein Bereiniger,
 * und so meldet die Code-Analyse kein unvollstaendiges Entfernen.
 */
const h1Name = (html) => {
  const t = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1];
  if (t == null) return null;
  let text = '';
  let imTag = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (imTag) { if (c === '>') imTag = false; continue; }
    if (c === '<') { imTag = true; continue; }
    if (c === '&') {
      const ende = t.indexOf(';', i);
      if (ende > i && ende - i <= 10) { i = ende; continue; }
    }
    text += c;
  }
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
};

const MISSION_LINK = /href="(?:\/de)?\/missionen\/[a-z0-9-]+\.html"/;
const ALTE_VERMUTUNG = /evtl\. über Shop oder Reputation|may be obtainable via shop or reputation/;

/* ---------- P2-Pruefungen je Seite: [7] [8] [9] [11] [12] ---------- */
const PLANER_KNOPF = /Im Fabricator-Planer öffnen|Open in the fabricator planner/g;
const titel = new Map(); // Sprache|Titel -> Pfade
let poolTabellen = 0;
const poolOhne = [];
// Missionsfamilien mit mehreren Pools: Slug -> groesster Pool (src/data/missions.json)
const groessterPool = new Map(
  JSON.parse(readFileSync(resolve(ROOT, 'src/data/missions.json'), 'utf8')).missions
    .filter((m) => (m.blueprints ?? []).length > 1)
    .map((m) => [m.slug, Math.max(...m.blueprints.map((p) => p.blueprints.length))]),
);
let poolGeprueft = 0;
const poolZuGross = [];
const planerDoppelt = [];
let materialSeiten = 0;
let materialMitItem = 0;
const materialFehlt = [];
const selbstZerlegen = [];
let zwillingsSeiten = 0;
// [9] Gleichnamige Seiten werden aus der Ueberschrift ermittelt, nicht aus dem
// Hinweis selbst: fehlt der Hinweis ganz, faellt die Seite sonst durch
// (Review #434). Schluessel wie namensSchluessel() in src/lib/itemSeo.ts.
const namensSchluessel = (s) => s.toLowerCase().replace(/["'`„“”‚‘’]/g, '').replace(/\s+/g, ' ').trim();
const ENTITAET = { amp: '&', quot: '"', '#39': "'", '#x27': "'", lt: '<', gt: '>' };
/** Sichtbarer Text eines Schnipsels: Tags Zeichen fuer Zeichen entfernt, Entitaeten in einem Durchgang. */
function sichtbar(schnipsel) {
  let text = '';
  let imTag = false;
  for (const c of schnipsel) {
    if (imTag) { if (c === '>') imTag = false; continue; }
    if (c === '<') { imTag = true; continue; }
    text += c;
  }
  return text.replace(/&(amp|quot|#39|#x27|lt|gt);/g, (_, e) => ENTITAET[e]);
}
const namensGruppen = new Map(); // Ordner|Name -> [{ pfad, hinweis, ziele }]
function merkeTitel(pfad, html) {
  const t = html.match(/<title>([^<]*)<\/title>/)?.[1];
  if (!t) return;
  const k = `${pfad.startsWith('/de/') ? 'de' : 'en'}|${t}`;
  const l = titel.get(k);
  if (l) l.push(pfad);
  else titel.set(k, [pfad]);
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1];
  if (h1 == null) return;
  const hinweis = html.includes('data-zwilling');
  if (hinweis) zwillingsSeiten++;
  const note = html.match(/<p class="dp-note dp-zwilling"[\s\S]*?<\/p>/)?.[0] ?? '';
  const ziele = new Set([...note.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]));
  const g = `${pfad.slice(0, pfad.lastIndexOf('/'))}|${namensSchluessel(sichtbar(h1))}`;
  const eintrag = { pfad, hinweis, ziele };
  const liste = namensGruppen.get(g);
  if (liste) liste.push(eintrag);
  else namensGruppen.set(g, [eintrag]);
}
function pruefeBauplanP2(pfad, html) {
  merkeTitel(pfad, html);
  // [8] Planer-Knopf einmal
  if ((html.match(PLANER_KNOPF) ?? []).length > 1) planerDoppelt.push(pfad);
  // [7] Pool je Missionszeile
  const sec = abschnitt(html, 'missionen');
  const tabelle = sec && sec.match(/<table[\s\S]*?<\/table>/)?.[0];
  if (tabelle) {
    poolTabellen++;
    const zellen = [...tabelle.matchAll(/<td class="dp-num"([^>]*)>([^<]*)<\/td>/g)];
    const zeilen = (tabelle.match(/<tr\b/g) ?? []).length - 1; // ohne Kopfzeile
    const mitPool = zellen.filter((z) => /data-pool="\d+"/.test(z[1])).length;
    if (!zeilen || mitPool !== zeilen || zellen.some((z) => /^\s*100\s?%\s*$/.test(z[2]))) poolOhne.push(pfad);
    // Zieht die Mission aus mehreren Pools, nennt keine Zeile mehr Bauplaene
    // als ihr groesster Pool (vorher „1 von 25“ bei Pools 7 + 5 + 5 + 8).
    for (const [, slug, pool] of tabelle.matchAll(/href="(?:\/de)?\/missionen\/([a-z0-9-]+)\.html"[\s\S]*?data-pool="(\d+)"/g)) {
      const groesster = groessterPool.get(slug);
      if (groesster == null) continue;
      poolGeprueft++;
      if (Number(pool) > groesster) poolZuGross.push(`${pfad} (${slug}: ${pool} > ${groesster})`);
    }
  }
  // [12] Materialwege
  if (/<h2[^>]*>(?:Zutaten|Ingredients)<\/h2>/.test(html)) {
    materialSeiten++;
    const mat = html.match(/<ul class="bp-mat"[\s\S]*?<\/ul>/)?.[0];
    // Jedes Material einzeln: Abbau und Kauf stehen immer da (als Weg oder als
    // ausdrueckliches „nein“/„unbekannt“), Zerlegen, wo es etwas zu sagen gibt.
    // Ein einziges data-material reicht nicht (Review #434).
    const eintraege = mat ? [...mat.matchAll(/<li data-material="([^"]*)"[^>]*>([\s\S]*?)<\/li>/g)] : [];
    const ohneWege = eintraege
      .filter(([, , li]) => (li.match(/<(?:a|span)\b[^>]*(?:data-mat-weg="|class="dp-muted)/g) ?? []).length < 2)
      .map(([, name]) => name);
    if (!eintraege.length) materialFehlt.push(pfad);
    else if (ohneWege.length) materialFehlt.push(`${pfad} (${ohneWege.join(', ')})`);
    else {
      const eigen = html.match(/href="(?:\/de)?\/items\/([a-z0-9-]+)\.html"[^>]*>(?:Item-Datenblatt öffnen|Open item data sheet)/)?.[1];
      if (eigen) materialMitItem++;
      if (eigen && new RegExp(`data-mat-weg="zerlegen"[^>]*>[^<]*<a href="(?:/de)?/items/${eigen}\\.html"`).test(mat)) selbstZerlegen.push(pfad);
    }
  }
}

/* ---------- [3] Bauplan-Seiten (zuerst: [2] braucht ihr Ergebnis) ---------- */
console.log('[3] Jede Bauplan-Seite verlinkt Missionen oder sagt ehrlich, woher der Bauplan kommt');
const bauplanMitMission = new Set();
let bauplaene = 0;
let bauplanUnbekannt = 0;
let bauplanWikelo = 0;
{
  const ohne = [];
  const vermutung = [];
  for (const rel of ['crafting', 'de/crafting']) {
    for (const [pfad, html] of seiten(rel)) {
      if (!html.includes('data-bp-item') && !html.includes('id="missionen"')) { // Kategorie- und Verzeichnisseiten
        if ((html.match(PLANER_KNOPF) ?? []).length > 1) planerDoppelt.push(pfad);
        continue;
      }
      bauplaene++;
      if (ALTE_VERMUTUNG.test(html)) vermutung.push(pfad);
      pruefeBauplanP2(pfad, html);
      const sec = abschnitt(html, 'missionen');
      if (sec && MISSION_LINK.test(sec)) { bauplanMitMission.add(pfad.replace(/^\/de/, '')); continue; }
      const quelle = sec && sec.match(/data-quelle="(unbekannt|wikelo)"/);
      // Der Hinweis-Link im Quellenblock nennt DIESE Seite (wert=<Pfad>),
      // sonst kaeme die Meldung beim falschen Bauplan an.
      const wert = sec && sec.match(/href="(?:\/de)?\/feedback\.html\?wert=([^"]+)"[^>]*data-hinweis/)?.[1];
      let hinweis = false;
      try { hinweis = !!wert && decodeURIComponent(wert) === pfad; } catch { hinweis = false; }
      if (!quelle || !hinweis) { ohne.push(pfad); continue; }
      if (quelle[1] === 'wikelo') bauplanWikelo++;
      else bauplanUnbekannt++;
    }
  }
  console.log(`    Bauplan-Seiten: ${bauplaene} (Klinke ${KLINKEN.bauplanSeiten})   mit Missionslink: ${bauplaene - bauplanUnbekannt - bauplanWikelo - ohne.length}   Quelle unbekannt: ${bauplanUnbekannt}   nur Wikelo: ${bauplanWikelo}`);
  console.log(`    ohne Missionslink und ohne ehrliche Quelle — Soll: 0   Ist: ${ohne.length}`);
  console.log(`    alte Vermutung „evtl. über Shop oder Reputation" — Soll: 0   Ist: ${vermutung.length}`);
  need(bauplaene >= KLINKEN.bauplanSeiten, `nur ${bauplaene} Bauplan-Seiten, Klinke ${KLINKEN.bauplanSeiten} — Ursache klaeren, nicht die Klinke senken`);
  need(!ohne.length, `${ohne.length} Bauplan-Seite(n) ohne Missionslink und ohne „Woher kommt der Bauplan?" mit Hinweis-Link auf genau diese Seite — ${liste(ohne)}`);
  need(!vermutung.length, `${vermutung.length} Seite(n) mit der alten Vermutung statt einer ehrlichen Quelle — ${liste(vermutung)}`);
}

/* ---------- [1] [2] [4] [6] Item-Blaetter ---------- */
let blaetter = 0;
let mitMission = 0;
let ohneSystem = 0;
let kaufBlaetter = 0;
let fahrzeuge = 0;
let feuerGeprueft = 0;
let magGeprueft = 0;
const ohneBlock = [];
const leer = [];
const missionFehlt = [];
const doppelt = [];
const fahrzeugOhneSchiff = [];
const fahrzeugFalschesSchiff = [];
let ohneWeg = 0;
let schiffsteile = 0;
const schiffsteilOhneLink = [];
let tabellen = 0;
let gefiltert = 0;
const tabelleFalsch = [];
const DOPPEL = [
  { kennzahl: /<b[^>]*>(?:Feuerrate|Fire rate)<\/b>/, text: /(?:^|\n|>)\s*(?:Rate of Fire|Feuerrate)\s*:/i, name: 'Feuerrate' },
  { kennzahl: /<b[^>]*>(?:Magazin|Magazine)<\/b>/, text: /(?:^|\n|>)\s*(?:Magazine Size|Battery Size|Magazingröße|Batteriegröße)\s*:/i, name: 'Magazin' },
];
/* [14] P64 Aehnliche Items einer Handwaffe */
const katalog = JSON.parse(readFileSync(resolve(ROOT, 'assets/universal-items.json'), 'utf8')).items;
const itemNachId = new Map(katalog.map((it) => [it.id, it]));
const artenJeKategorie = new Map(); // Kategorie|Art -> Zahl der Handwaffen
for (const it of katalog) {
  const art = waffenArt(it);
  if (!art) continue;
  const k = `${it.category}|${art}`;
  artenJeKategorie.set(k, (artenJeKategorie.get(k) ?? 0) + 1);
}
let waffenBlaetter = 0;
const aehnlichFalsch = [];
function pruefeAehnlich(pfad, html) {
  const item = itemNachId.get(pfad.match(/\/([^/]+)\.html$/)?.[1]);
  const art = item && waffenArt(item);
  if (!art) return;
  waffenBlaetter++;
  const kartenHtml = html.match(/<ul class="dp-cards"[^>]*data-aehnlich[^>]*>([\s\S]*?)<\/ul>/)?.[1];
  if (kartenHtml == null) { aehnlichFalsch.push(`${pfad} (Block fehlt)`); return; }
  // Jede Karte zaehlt, auch eine ohne data-item (Review #434): sie wird
  // gemeldet und nimmt als unbekannte Art an der Reihenfolge teil.
  const karten = [...kartenHtml.matchAll(/<li\b([^>]*)>/g)].map((m) => itemNachId.get(m[1].match(/\bdata-item="([^"]+)"/)?.[1] ?? ''));
  const arten = karten.map((k) => (k ? waffenArt(k) : null));
  const probleme = [];
  const ersteFremde = arten.findIndex((a) => a !== art);
  if (ersteFremde >= 0 && arten.slice(ersteFremde).includes(art)) probleme.push('fremde Art vor gleicher Art');
  if ((artenJeKategorie.get(`${item.category}|${art}`) ?? 0) > 1 && arten[0] !== art) probleme.push(`erste Karte keine ${art}`);
  const jeModell = new Map();
  for (const k of karten) if (k) jeModell.set(modellName(k.name), (jeModell.get(modellName(k.name)) ?? 0) + 1);
  const zuOft = [...jeModell].filter(([, n]) => n > AUSFUEHRUNGEN_JE_MODELL).map(([m, n]) => `${m} ${n}x`);
  if (zuOft.length) probleme.push(`Modell zu oft: ${zuOft.join(', ')}`);
  if (karten.some((k) => !k)) probleme.push('Karte ohne data-item oder ohne Katalogeintrag');
  if (probleme.length) aehnlichFalsch.push(`${pfad} (${probleme.join('; ')})`);
}

for (const rel of ['items', 'de/items']) {
  for (const [pfad, html] of seiten(rel)) {
    blaetter++;
    pruefeAehnlich(pfad, html);
    const block = abschnitt(html, 'so-bekommst-du-es');
    if (!block) { ohneBlock.push(pfad); continue; }
    const wege = Number(block.match(/data-wege="(\d+)"/)?.[1] ?? NaN);
    if (!(wege > 0) && !/href="(?:\/de)?\/feedback\.html\?wert=/.test(block)) leer.push(pfad);
    if (wege === 0) ohneWeg++;
    merkeTitel(pfad, html);
    // [10] Schiffsteil -> Schiff
    if (block.includes('data-weg="schiffsteil"')) {
      schiffsteile++;
      if (!/href="(?:\/de)?\/schiffe\/[a-z0-9-]+\.html"[^>]*data-weg-schiff/.test(block)) schiffsteilOhneLink.push(pfad);
    }
    // [11] Bezugsquellen-Tabelle
    const bq = abschnitt(html, 'bezugsquellen');
    const tab = bq && bq.match(/<table class="dp-table dp-bezug"[\s\S]*?<\/table>/)?.[0];
    if (tab) {
      tabellen++;
      const kopf = tab.match(/<thead\b[\s\S]*?<\/thead>/)?.[0] ?? '';
      // Filterknoepfe = alle Systeme der Zeilen (data-sys, mehrere durch Leerzeichen)
      const optionen = new Set([...tab.matchAll(/<tr\b[^>]*\bdata-sys="([^"]*)"/g)].flatMap((m) => m[1].split(' ')));
      const filter = bq.includes('data-sysfilter');
      if (filter) gefiltert++;
      const preisKopf = />(?:Preis|Price)<\/th>/.test(kopf);
      const preise = tab.includes('class="dp-price"');
      const probleme = [];
      if (/>(?:Ø Preis|Avg price)<\/th>/.test(kopf)) probleme.push('Ø-Spalte');
      if (preisKopf !== preise) probleme.push(preise ? 'Preise ohne Spalte' : 'Preisspalte ohne Preis');
      if (filter !== optionen.size > 1) probleme.push(`Filter ${filter ? 'bei nur einem System' : 'fehlt bei mehreren Systemen'}`);
      if (/<td\b[^>]*>\s*(?:<span[^>]*>)?\s*—\s*(?:<\/span>)?\s*<\/td>/.test(tab)) probleme.push('Leerwert „—“ statt leerer Zelle');
      if (probleme.length) tabelleFalsch.push(`${pfad} (${probleme.join(', ')})`);
    }
    // [2] Item -> Mission
    const bp = block.match(/href="(?:\/de)?(\/crafting\/[a-z0-9-]+\.html)"/);
    const hatMission = MISSION_LINK.test(block);
    if (hatMission) mitMission++;
    if (bp && bauplanMitMission.has(bp[1]) && !hatMission) missionFehlt.push(pfad);
    // Selbstauskunft: Kaufzeilen ohne Systemangabe
    if (block.includes('data-weg="kaufen"')) {
      kaufBlaetter++;
      if (block.includes('data-system="ohne"')) ohneSystem++;
    }
    // [4] eine Zahl je Groesse
    const desc = html.match(/<p class="dp-desc"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? '';
    for (const d of DOPPEL) {
      if (!d.kennzahl.test(html)) continue;
      if (d.name === 'Feuerrate') feuerGeprueft++;
      else magGeprueft++;
      if (d.text.test(desc)) doppelt.push(`${pfad} (${d.name})`);
    }
    // [6] Fahrzeug-Itemblatt -> Schiffsblatt
    // Das Ziel muss SEIN Schiffsblatt sein: dieselbe Zuordnung wie die Seite
    // (src/lib/vehicleItems.ts, Name ohne Gross/Klein und Satzzeichen) —
    // verglichen wird die Ueberschrift des Items mit der des Schiffsblatts.
    if (html.includes('data-fahrzeug-item')) {
      fahrzeuge++;
      const ziel = html.match(/href="((?:\/de)?\/schiffe\/[a-z0-9-]+\.html)"[^>]*data-weg="schiff"/)?.[1];
      if (!ziel) fahrzeugOhneSchiff.push(pfad);
      else {
        const zielDatei = join(DIST, ziel);
        const schiffH1 = existsSync(zielDatei) ? h1Name(readFileSync(zielDatei, 'utf8')) : null;
        if (!schiffH1 || schiffH1 !== h1Name(html)) fahrzeugFalschesSchiff.push(`${pfad} -> ${ziel}`);
      }
    }
  }
}
console.log('\n[1] Jedes Item-Blatt zeigt „So bekommst du es"');
console.log(`    Item-Blaetter: ${blaetter} (Klinke ${KLINKEN.itemBlaetter})   ohne Block — Soll: 0   Ist: ${ohneBlock.length}   leer ohne Hinweis-Link — Soll: 0   Ist: ${leer.length}`);
need(blaetter >= KLINKEN.itemBlaetter, `nur ${blaetter} Item-Blaetter, Klinke ${KLINKEN.itemBlaetter} — Ursache klaeren, nicht die Klinke senken`);
need(!ohneBlock.length, `${ohneBlock.length} Item-Blatt/-Blaetter ohne „So bekommst du es" — ${liste(ohneBlock)}`);
need(!leer.length, `${leer.length} Item-Blatt/-Blaetter mit leerem Block ohne Hinweis-Link — ${liste(leer)}`);

console.log('\n[2] Item -> Mission: wo der Bauplan Missionen hat, nennt sie auch das Item-Blatt');
console.log(`    Item-Blaetter mit Missionslink: ${mitMission} (Klinke ${KLINKEN.mitMission})   Bauplan mit Mission, Block ohne — Soll: 0   Ist: ${missionFehlt.length}`);
need(mitMission >= KLINKEN.mitMission, `nur ${mitMission} Item-Blaetter verlinken eine Mission, Klinke ${KLINKEN.mitMission} — bricht der Join Item -> Bauplan -> Mission? Ursache klaeren, nicht die Klinke senken`);
need(!missionFehlt.length, `${missionFehlt.length} Item-Blatt/-Blaetter verlinken einen Bauplan mit Missionen, nennen aber keine — ${liste(missionFehlt)}`);

console.log('\n[4] Eine Feuerrate je Waffe: keine Kennzahl doppelt im Beschreibungstext');
console.log(`    Blaetter mit Kennzahl Feuerrate: ${feuerGeprueft}   mit Kennzahl Magazin: ${magGeprueft}   doppelt — Soll: 0   Ist: ${doppelt.length}`);
need(feuerGeprueft > 0, 'kein Blatt mit der Kennzahl Feuerrate gefunden — Muster veraltet? Ohne Treffer prueft [4] nichts');
need(!doppelt.length, `${doppelt.length} Blatt/Blaetter zeigen eine Kennzahl ein zweites Mal im Beschreibungstext — ${liste(doppelt)}`);

console.log('\n[6] Fahrzeug-Itemblaetter verlinken ihr Schiffsblatt');
console.log(`    Fahrzeug-Itemblaetter: ${fahrzeuge} (Klinke ${KLINKEN.fahrzeugBlaetter})   ohne Link zum Schiffsblatt — Soll: 0   Ist: ${fahrzeugOhneSchiff.length}`);
need(fahrzeuge >= KLINKEN.fahrzeugBlaetter, `nur ${fahrzeuge} Fahrzeug-Itemblaetter erkannt, Klinke ${KLINKEN.fahrzeugBlaetter} — Ursache klaeren, nicht die Klinke senken`);
need(!fahrzeugOhneSchiff.length, `${fahrzeugOhneSchiff.length} Fahrzeug-Itemblatt/-blaetter ohne sichtbaren Link zum Schiffsblatt — ${liste(fahrzeugOhneSchiff)}`);
console.log(`    Link auf ein fremdes Schiffsblatt (Ueberschriften verschieden) — Soll: 0   Ist: ${fahrzeugFalschesSchiff.length}`);
need(!fahrzeugFalschesSchiff.length, `${fahrzeugFalschesSchiff.length} Fahrzeug-Itemblatt/-blaetter zeigen auf ein anderes Schiffsblatt als ihr eigenes — ${liste(fahrzeugFalschesSchiff)}`);

console.log('\n[7] D4 Missionstabelle eines Bauplans nennt den Pool statt „100 %"');
console.log(`    Tabellen: ${poolTabellen} (Klinke ${KLINKEN.poolTabellen})   ohne Pool oder mit nacktem „100 %" — Soll: 0   Ist: ${poolOhne.length}`);
need(poolTabellen >= KLINKEN.poolTabellen, `nur ${poolTabellen} Missionstabellen, Klinke ${KLINKEN.poolTabellen} — Ursache klaeren, nicht die Klinke senken`);
need(!poolOhne.length, `${poolOhne.length} Missionstabelle(n) ohne Pool je Zeile oder mit nacktem „100 %" — ${liste(poolOhne)}`);
console.log(`    Zeilen zu Missionen mit mehreren Pools: ${poolGeprueft} (Missionen: ${groessterPool.size})   groesser als der groesste Pool — Soll: 0   Ist: ${poolZuGross.length}`);
need(groessterPool.size > 0 && poolGeprueft > 0, 'keine Mission mit mehreren Pools geprueft — Daten oder Muster veraltet?');
need(!poolZuGross.length, `${poolZuGross.length} Zeile(n) nennen mehr Bauplaene als der groesste Pool ihrer Mission — ${liste(poolZuGross)}`);

// Die Crafting-Kategorieseiten liegen eine Ebene tiefer.
let kategorieSeiten = 0;
for (const rel of ['crafting/category', 'de/crafting/category']) {
  for (const [pfad, html] of seiten(rel)) {
    kategorieSeiten++;
    if ((html.match(PLANER_KNOPF) ?? []).length > 1) planerDoppelt.push(pfad);
  }
}
console.log('\n[8] D10 Planer-Knopf hoechstens einmal je Seite');
console.log(`    Bauplan-Seiten: ${bauplaene}   Kategorieseiten: ${kategorieSeiten}   mit doppeltem Knopf — Soll: 0   Ist: ${planerDoppelt.length}`);
need(kategorieSeiten > 0, 'keine Crafting-Kategorieseite gefunden — Ordner verschoben? Ohne Treffer prueft [8] sie nicht');
need(!planerDoppelt.length, `${planerDoppelt.length} Seite(n) mit zwei Planer-Knoepfen — ${liste(planerDoppelt)}`);

const doppelteTitel = [...titel.entries()].filter(([, l]) => l.length > 1);
let erwarteteZwillinge = 0;
const zwillingFalsch = [];
for (const eintraege of namensGruppen.values()) {
  if (eintraege.length < 2) {
    for (const e of eintraege) if (e.hinweis) zwillingFalsch.push(`${e.pfad} (Hinweis ohne gleichnamige Seite)`);
    continue;
  }
  erwarteteZwillinge += eintraege.length;
  for (const e of eintraege) {
    const fehlt = eintraege.filter((o) => o !== e && !e.ziele.has(o.pfad)).map((o) => o.pfad);
    if (!e.hinweis) zwillingFalsch.push(`${e.pfad} (kein Hinweis auf ${fehlt.join(', ')})`);
    else if (fehlt.length) zwillingFalsch.push(`${e.pfad} (verlinkt nicht ${fehlt.join(', ')})`);
  }
}
console.log('\n[9] D7 Kein Seitentitel doppelt, gleichnamige Seiten verlinken einander');
console.log(`    Titel geprueft: ${titel.size}   doppelt — Soll: 0   Ist: ${doppelteTitel.length}   gleichnamige Seiten (aus der Ueberschrift): ${erwarteteZwillinge}   mit Hinweis: ${zwillingsSeiten}   Hinweis fehlt, unvollstaendig oder ohne Zwilling — Soll: 0   Ist: ${zwillingFalsch.length}`);
need(titel.size >= KLINKEN.itemBlaetter, `nur ${titel.size} Titel gelesen — Muster veraltet?`);
need(!doppelteTitel.length, `${doppelteTitel.length} Titel stehen auf mehreren Seiten — ${liste(doppelteTitel.map(([k, l]) => `„${k.split('|')[1].split(' — ')[0]}" ${l.join(' + ')}`), 5)}`);
need(erwarteteZwillinge > 0, 'keine gleichnamigen Seiten gefunden — Ueberschrift-Muster veraltet? Ohne Treffer prueft [9] die Hinweise nicht');
need(!zwillingFalsch.length, `${zwillingFalsch.length} gleichnamige Seite(n) ohne vollstaendigen Hinweis auf ihre Zwillinge — ${liste(zwillingFalsch)}`);

console.log('\n[10] D6 Schiffsteile verlinken ihr Schiff; Blaetter ganz ohne Weg unter der Decke');
console.log(`    Schiffsteile: ${schiffsteile} (Klinke ${KLINKEN.schiffsteile})   ohne Schiffslink — Soll: 0   Ist: ${schiffsteilOhneLink.length}   Blaetter ohne Weg: ${ohneWeg} (Decke ${DECKEN.ohneWeg})`);
need(schiffsteile >= KLINKEN.schiffsteile, `nur ${schiffsteile} Schiffsteile erkannt, Klinke ${KLINKEN.schiffsteile} — Ursache klaeren, nicht die Klinke senken`);
need(!schiffsteilOhneLink.length, `${schiffsteilOhneLink.length} Schiffsteil(e) ohne Link zum Schiff — ${liste(schiffsteilOhneLink)}`);
need(ohneWeg <= DECKEN.ohneWeg, `${ohneWeg} Item-Blaetter ganz ohne Weg, Decke ${DECKEN.ohneWeg} — welcher Weg ist verloren gegangen? Decke nicht heben`);

console.log('\n[11] D5 Bezugsquellen: Ø einmal, Preisspalte nur mit Preis, keine „—“-Zellen, Systemfilter bei mehr als einem System');
console.log(`    Tabellen: ${tabellen} (Klinke ${KLINKEN.bezugsTabellen})   davon mit Systemfilter: ${gefiltert}   falsch — Soll: 0   Ist: ${tabelleFalsch.length}`);
need(tabellen >= KLINKEN.bezugsTabellen, `nur ${tabellen} Bezugsquellen-Tabellen erkannt, Klinke ${KLINKEN.bezugsTabellen} — Muster veraltet? Ursache klaeren, nicht die Klinke senken`);
need(!tabelleFalsch.length, `${tabelleFalsch.length} Bezugsquellen-Tabelle(n) falsch gebaut — ${liste(tabelleFalsch)}`);

console.log('\n[12] D8 Rezept-Materialien nennen ihre Wege');
console.log(`    Bauplan-Seiten mit Zutaten: ${materialSeiten} (Klinke ${KLINKEN.materialSeiten})   ohne Materialwege — Soll: 0   Ist: ${materialFehlt.length}   schlagen das eigene Item zum Zerlegen vor (geprueft ${materialMitItem}) — Soll: 0   Ist: ${selbstZerlegen.length}`);
need(materialSeiten >= KLINKEN.materialSeiten, `nur ${materialSeiten} Bauplan-Seiten mit Zutaten, Klinke ${KLINKEN.materialSeiten}`);
need(!materialFehlt.length, `${materialFehlt.length} Bauplan-Seite(n) ohne „Woher die Materialien kommen" — ${liste(materialFehlt)}`);
need(!selbstZerlegen.length, `${selbstZerlegen.length} Bauplan-Seite(n) schlagen vor, das herzustellende Item zu zerlegen — ${liste(selbstZerlegen)}`);

/* ---------- [13] P52 eine Blueprint-Zahl ---------- */
console.log('\n[13] P52 Verzeichnis und Werkbank nennen dieselbe Blueprint-Zahl, Mengen stehen ueberall in SCU');
{
  const zahl = (s) => (s == null ? null : Number(String(s).replace(/[.,\s]/g, '')));
  const spielBestand = JSON.parse(readFileSync(resolve(ROOT, 'assets/crafting-db.json'), 'utf8')).blueprints.length;
  for (const [pre, ordner] of [['', 'crafting'], ['de/', 'de/crafting']]) {
    const seitenZahl = [...seiten(ordner)].length;
    const hubPfad = join(DIST, `${pre}crafting.html`);
    const wbPfad = join(DIST, `${pre}topics/crafting.html`);
    const hub = existsSync(hubPfad) ? readFileSync(hubPfad, 'utf8') : '';
    const wb = existsSync(wbPfad) ? readFileSync(wbPfad, 'utf8') : '';
    const hubZahl = zahl(hub.match(/<b[^>]*>Blueprints<\/b>\s*<span[^>]*>([\d.,]+)<\/span>/)?.[1]);
    const ohneItem = zahl(hub.match(/data-ohne-item="(\d+)"/)?.[1]) ?? 0;
    const wbZahl = zahl(wb.match(/id="cdb-count"[^>]*>[\d.,]+<\/b>\s*\/\s*([\d.,]+)/)?.[1]);
    console.log(`    /${pre}: Bauplan-Seiten ${seitenZahl}   Verzeichnis ${hubZahl}   Werkbank ${wbZahl}   ohne Item ${ohneItem}   Spielbestand ${spielBestand}`);
    need(hubZahl != null && wbZahl != null, `/${pre}: Blueprint-Zahl im Verzeichnis oder auf der Werkbank nicht gefunden — Muster veraltet?`);
    need(hubZahl === seitenZahl && wbZahl === seitenZahl, `/${pre}: Verzeichnis ${hubZahl}, Werkbank ${wbZahl}, Bauplan-Seiten ${seitenZahl} — eine Zahl fuer alle drei`);
    need(seitenZahl + ohneItem === spielBestand, `/${pre}: ${seitenZahl} gezeigt + ${ohneItem} ohne Item ergibt nicht den Spielbestand ${spielBestand} — der Satz im Verzeichnis rechnet nicht auf`);
  }
  // Eine Einheit: „64 cSCU“ in der Datenbank gegen „0,64 SCU“ auf dem Bauplan
  // war dieselbe Menge. Gezaehlt werden Zeichenketten, die cSCU anzeigen;
  // Bezeichner wie quantity_cSCU stehen nicht in Anfuehrungszeichen.
  const appPfad = join(DIST, 'assets/crafting-app.js');
  const app = existsSync(appPfad) ? readFileSync(appPfad, 'utf8') : '';
  const cscu = app.match(/(['"])(?:(?!\1)[^\\\n]|\\.)*\bcSCU\b(?:(?!\1)[^\\\n]|\\.)*\1/g) ?? [];
  const scuAnzeigen = (app.match(/['"] SCU\b/g) ?? []).length;
  console.log(`    Crafting-Datenbank: Mengenanzeigen in SCU ${scuAnzeigen}   in cSCU — Soll: 0   Ist: ${cscu.length}`);
  need(app.length > 0, 'dist/assets/crafting-app.js fehlt — erst bauen');
  need(scuAnzeigen >= 3, `nur ${scuAnzeigen} Mengenanzeigen in SCU in der Crafting-Datenbank (erwartet: Zutat, Einkaufsliste, Zerlegen) — Muster veraltet?`);
  need(!cscu.length, `Crafting-Datenbank zeigt Mengen in cSCU, die Bauplan-Seiten in SCU — eine Einheit: ${liste(cscu)}`);
}

/* ---------- [14] P64 Aehnliche Items nach Waffenart ---------- */
console.log('\n[14] P64 „Ähnliche Items" einer Handwaffe: gleiche Art zuerst, hoechstens ' + AUSFUEHRUNGEN_JE_MODELL + ' Ausfuehrungen je Modell');
console.log(`    Handwaffen-Blaetter: ${waffenBlaetter} (Klinke ${KLINKEN.waffenBlaetter})   falsch geordnet — Soll: 0   Ist: ${aehnlichFalsch.length}`);
need(waffenBlaetter >= KLINKEN.waffenBlaetter, `nur ${waffenBlaetter} Handwaffen-Blaetter erkannt, Klinke ${KLINKEN.waffenBlaetter} — Ursache klaeren, nicht die Klinke senken`);
need(!aehnlichFalsch.length, `${aehnlichFalsch.length} Handwaffen-Blatt/Blaetter mit falsch geordneten „Ähnlichen Items" — ${liste(aehnlichFalsch)}`);

console.log('\n    Selbstauskunft (kein Urteil, Fremdquelle): Blaetter mit Kaufzeilen ohne Systemangabe '
  + `${ohneSystem} von ${kaufBlaetter}`);

/* ---------- [5] Katalog auf dem Stand der Regel ---------- */
console.log('\n[5] Katalog auf dem Stand der Regel „eine Zahl je Groesse"');
// Dazu: die ausgelieferte Kopie (dist/, liest der Item Finder) traegt dieselben
// gemessenen Werte wie die Quelle, aus der die Blaetter gebaut sind — sonst
// zeigen Blatt und Finder zwei Feuerraten.
const KENNZAHLEN = ['fireRate', 'magazine'];
const messwerte = (db) => {
  const m = new Map();
  for (const it of db.items) {
    const g = it.game;
    if (!g) continue;
    const werte = [g.stats, ...(g.variants ?? []).map((v) => v?.stats)].map((st) => KENNZAHLEN.map((k) => st?.[k] ?? null).join('/'));
    m.set(it.id, werte.join('|'));
  }
  return m;
};
const katalogWerte = [];
for (const rel of ['assets/universal-items.json', 'dist/assets/universal-items.json']) {
  const p = resolve(ROOT, rel);
  if (!existsSync(p)) { fail.push(`${rel} fehlt`); continue; }
  const db = JSON.parse(readFileSync(p, 'utf8'));
  katalogWerte.push(messwerte(db));
  const treffer = [];
  for (const it of db.items) for (const z of doppelteZeilen(it.game)) treffer.push(`${it.id} „${z.zeile}"`);
  console.log(`    ${rel}: ${db.items.length} Items geprueft (Klinke ${KLINKEN.katalogItems}), doppelte Kopfzeilen — Soll: 0   Ist: ${treffer.length}`);
  need(db.items.length >= KLINKEN.katalogItems, `${rel}: nur ${db.items.length} Items, Klinke ${KLINKEN.katalogItems}`);
  need(!treffer.length, `${rel}: ${treffer.length} Kopfzeile(n) doppeln eine Kennzahl — Bau mit scripts/build-universal-db.mjs (Regel scripts/lib/hersteller-zeilen.mjs) oder neu bauen — ${liste(treffer, 5)}`);
}

if (katalogWerte.length === 2) {
  const [quelle, kopie] = katalogWerte;
  // Vereinigung beider Schluesselmengen: ein Item, das nur noch in der Kopie
  // steht (aus assets/ entfernt, dist/ alt), zaehlt genauso als Abweichung.
  const ids = new Set([...quelle.keys(), ...kopie.keys()]);
  const abweichend = [...ids]
    .filter((id) => !quelle.has(id) || !kopie.has(id) || quelle.get(id) !== kopie.get(id))
    .map((id) => (!kopie.has(id) ? `${id} (nur in assets/)` : !quelle.has(id) ? `${id} (nur in dist/)` : id));
  console.log(`    Feuerrate und Magazin: Quelle gegen ausgelieferte Kopie, ${ids.size} Items — abweichend oder nur auf einer Seite — Soll: 0   Ist: ${abweichend.length}`);
  need(!abweichend.length, `${abweichend.length} Item(s) mit anderer Feuerrate oder Magazin in dist/ als in assets/ — Kopie veraltet, neu bauen — ${liste(abweichend)}`);
}

if (fail.length) {
  console.error(`\nverify:bezugswege: ${fail.length} FEHLER`);
  for (const f of fail) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`\nOK — ${blaetter} Item-Blaetter mit Bezugswegen (${mitMission} mit Mission), ${bauplaene} Bauplan-Seiten mit Quelle, keine doppelte Kennzahl`);
