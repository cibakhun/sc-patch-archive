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
//      Ihr Abschnitt „Technische Daten" sagt, dass die Werte dort stehen, und
//      verlinkt dasselbe Schiffsblatt (IA C8).
//   Zweite Stufe (P2, gleicher Tag):
//   7  D4 Pool statt „100 %": jede Zeile der Missionstabelle eines Bauplans
//      nennt ihren Pool (data-pool), keine Zelle sagt nur „100 %". Klinke.
//      Jede Zahl (auch jedes Ende einer Spanne) ist die Groesse eines Pools
//      genau dieser Mission (verschiedene Bauplaene, src/data/missions.json).
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
//  15  Missionsnamen (Paket F1): jeder Link auf eine Missionsseite in der
//      Missionstabelle eines Bauplans und im Block „So bekommst du es" traegt
//      denselben Namen wie die Missionsseite selbst (ihr <title> vor „ — "),
//      also Titel samt unterscheidendem Zusatz statt des Arbeitsnamens. Klinke.
//  16  IA C8 (26.11.2026): JEDES Item-Blatt beider Sprachen traegt den
//      Abschnitt „Technische Daten" (#technische-daten), und er ist nicht
//      leer: Werte, Angaben (Hersteller/Beschreibung), der Link aufs
//      Schiffsblatt oder ein benannter Hinweis — „hier gibt es keine
//      Werte-Übersicht" (data-specs-ohne-werte) bzw. „kein Item dieses Namens
//      im Spiel" (data-specs-nicht-im-spiel), im Wortlaut von
//      src/i18n/itemText.ts. Die Hinweise stehen genau dort, wo der Katalog
//      das Item so markiert (game.ohneWerte / nichtImSpiel). Klinke fuer die
//      Flugblaetter mit Werten, Decke fuer die Blaetter „nicht im Spiel".
//  17  Crafting-Werkbank wie das Bauplan-Blatt (Krisz 27.11.2026 im Bericht
//      „Datenblätter und Werkbänke“: „alle drei wege auf die werkbank
//      einbauen“, „hier soll craftingwerkbank wie datenblatt funktionieren“).
//      window.__CRAFT.wege beider Werkbank-Seiten kennt jedes Material der
//      Bauplan-Seiten, mit derselben Aussage zu Kaufen und Zerlegen; die
//      Rezepte ohne Mission mit einem Weg zum Item und die Wikelo-Bauplaene
//      sind so viele wie die Seiten, die das sagen; alle Texte stehen da, und
//      das ausgelieferte Skript zeichnet sie. Klinke fuer die Rezepte ohne
//      Mission mit Weg.
// SELBSTAUSKUNFT ohne Urteil: Kaufzeilen ohne Systemangabe (Fremdquelle,
// nie FEHLER, Grundsatz 3).
//
// Schiene A: kein git, kein Netz, keine Spielinstallation — dist/ und
// committete JSON.
//
//   node scripts/verify-bezugswege.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { doppelteZeilen } from './lib/hersteller-zeilen.mjs';
import { AUSFUEHRUNGEN_JE_MODELL, modellName, waffenArt } from './lib/waffen-art.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');

// Klinken (Grundsatz 5): nur nach OBEN; nach unten nur per Commit, dessen
// Botschaft die Ursache nennt. Erster Lauf 24.11.2026 (Katalog 4.10.3) —
// Werte im Registry-Eintrag; die Klinken knapp darunter.
// bezugsTabellen 10900 -> 10850 am 24.11.2026 (IA C8): 56 Doppel-Items sind
// in ihr Spiel-Item aufgegangen; bei 49 hatten beide Seiten eine Tabelle,
// jetzt hat sie nur noch die Seite mit dem Spielnamen (10.994 -> 10.896,
// alle 110 Zielseiten mit Tabelle).
const KLINKEN = {
  itemBlaetter: 11500, mitMission: 1350, bauplanSeiten: 3200, fahrzeugBlaetter: 350, katalogItems: 9000,
  poolTabellen: 1350, materialSeiten: 3200, schiffsteile: 210, bezugsTabellen: 10850,
  waffenBlaetter: 700, missionsNamen: 10700,
  // [16] IA C8 26.11.2026: Flugblaetter (PHB/TSB) mit Flugwerten, beide
  // Sprachen. Steigt mit dem Datenlauf, der den Typ FlightController liest.
  flugblaetter: 128,
  // [17] 27.11.2026: Rezepte ohne Mission, deren Item einen Weg hat (846).
  werkbankOhneMission: 820,
};
// Decken (P2): nur nach UNTEN. Item-Blaetter beider Sprachen ganz ohne Weg —
// vor D6 430 (215 je Sprache), danach 278.
// [16] IA C8 26.11.2026: Item-Blaetter ohne Abschnitt „Technische Daten"
// (vor dem Datenlauf mit Flugblaettern und Identitaet 232 = 116 je Sprache) und
// Blaetter mit dem Hinweis „nicht im Spiel" (erwartet nach dem Datenlauf:
// 11 Items, die kein Record im Spiel traegt, je Sprache).
const DECKEN = { ohneWeg: 290, ohneTechDaten: 0, nichtImSpiel: 22 };

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
// Missionsfamilie -> Groessen ihrer Pools (verschiedene Bauplaene je Pool,
// src/data/missions.json). Jede Zahl der Tabelle muss die Groesse eines
// dieser Pools sein: die Summe der Familie (vorher „1 von 25“ bei Pools
// 7 + 5 + 5 + 8) ist es nicht, und die Zahl der Bauplan-Seiten auch nicht,
// wo sie vom Pool abweicht (Review #434).
const poolGroessen = new Map(
  JSON.parse(readFileSync(resolve(ROOT, 'src/data/missions.json'), 'utf8')).missions
    .filter((m) => (m.blueprints ?? []).length > 0)
    .map((m) => [m.slug, { mehrere: m.blueprints.length > 1, groessen: new Set(m.blueprints.map((p) => new Set(p.blueprints.map((b) => String(b.name).toLowerCase())).size)) }]),
);
let poolGeprueft = 0;
let poolGeprueftMehrere = 0;
const poolFremd = [];
let poolTexte = 0;
let poolZeilen = 0;
const poolTextFalsch = [];
const planerDoppelt = [];
let materialSeiten = 0;
// [17] Material -> was die Bauplan-Seiten (EN) dazu sagen: kaufen ja/nein,
// zerlegen ja/nie/leer (je Seite, ein Material steht auf vielen).
const blattMaterial = new Map();
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
// [15] Missionsnamen wie auf der Missionsseite. Der Name steht im <title>
// der Missionsseite vor „ — <Art> | VerseBase" (MissionDetail.astro, seoName
// = missionVollname). Verglichen wird sichtbarer Text, Leerraum gefaltet.
const missionsSeitenNamen = new Map(); // Pfad -> Name oder null (Seite fehlt)
const falte = (x) => x.replace(/\s+/g, ' ').trim();
function missionsSeitenName(ziel) {
  if (!missionsSeitenNamen.has(ziel)) {
    const datei = join(DIST, ziel);
    const t = existsSync(datei) ? readFileSync(datei, 'utf8').match(/<title>([^<]*)<\/title>/)?.[1] : null;
    const ende = t == null ? -1 : t.lastIndexOf(' — ');
    missionsSeitenNamen.set(ziel, t == null ? null : falte(sichtbar(ende < 0 ? t : t.slice(0, ende))));
  }
  return missionsSeitenNamen.get(ziel);
}
/**
 * Attribute eines Start-Tags (der Teil nach dem Tag-Namen) als Map: Name klein,
 * Wert ohne Anfuehrungszeichen. Gelesen von links nach rechts wie im HTML-
 * Tokenizer: ein Wert in Anfuehrungszeichen ist ein Stueck, was darin steht,
 * ist kein Attribut; bei doppeltem Namen gilt das erste (Review #451).
 */
function attribute(attr) {
  const m = new Map();
  for (const [, name, wert] of attr.matchAll(/([^\s"'>\/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g)) {
    const n = name.toLowerCase();
    if (!m.has(n)) m.set(n, wert == null ? '' : wert.replace(/^(["'])([\s\S]*)\1$/, '$2'));
  }
  return m;
}
let missionsNamen = 0;
const missionsNameFalsch = [];
function pruefeMissionsNamen(pfad, schnipsel) {
  // Jeder Anker, gleich in welcher Reihenfolge seine Attribute stehen, mit
  // „>“ in einem Attributwert, href in doppelten oder einfachen
  // Anfuehrungszeichen, mit oder ohne Anker/Abfrage an der Adresse (Review #451).
  // Das Ziel ist das echte href-Attribut, nicht ein „href=“ im Wert eines
  // anderen Attributs (attribute() liest Werte als Ganzes).
  for (const [, attr, text] of schnipsel.matchAll(/<a\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/a>/g)) {
    const ziel = attribute(attr).get('href')?.match(/^((?:\/de)?\/missionen\/[a-z0-9-]+\.html)(?:[?#].*)?$/)?.[1];
    if (!ziel) continue;
    missionsNamen++;
    const soll = missionsSeitenName(ziel);
    const ist = falte(sichtbar(text));
    if (soll == null) missionsNameFalsch.push(`${pfad} -> ${ziel} (Missionsseite fehlt)`);
    else if (ist !== soll) missionsNameFalsch.push(`${pfad} -> ${ziel} („${ist}“ statt „${soll}“)`);
  }
}

function pruefeBauplanP2(pfad, html) {
  merkeTitel(pfad, html);
  // [8] Planer-Knopf einmal
  if ((html.match(PLANER_KNOPF) ?? []).length > 1) planerDoppelt.push(pfad);
  // [7] Pool je Missionszeile
  const sec = abschnitt(html, 'missionen');
  if (sec) pruefeMissionsNamen(pfad, sec); // [15]
  const tabelle = sec && sec.match(/<table[\s\S]*?<\/table>/)?.[0];
  if (tabelle) {
    poolTabellen++;
    const zellen = [...tabelle.matchAll(/<td class="dp-num"([^>]*)>([^<]*)<\/td>/g)];
    const zeilen = (tabelle.match(/<tr\b/g) ?? []).length - 1; // ohne Kopfzeile
    const mitPool = zellen.filter((z) => /data-pool="\d+"/.test(z[1])).length;
    if (!zeilen || mitPool !== zeilen || zellen.some((z) => /^\s*100\s?%\s*$/.test(z[2]))) poolOhne.push(pfad);
    // Zeile fuer Zeile (jede traegt data-mission, auch ohne Link auf eine
    // Missionsseite): der sichtbare Text der Pool-Zelle sagt dieselbe Zahl
    // wie data-pool/data-pool-min („1 von 8“, „1 von 5–8“, „nur dieser“ = 1),
    // und jede Zahl (auch jedes Ende einer Spanne) ist die Groesse eines
    // Pools genau dieser Mission (Review #434).
    // Alle Zeilen des Tabellenkoerpers, ohne Ausnahme nach Inhalt.
    const koerper = tabelle.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
    const reihen = [...koerper.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/g)];
    if (!reihen.length) poolTextFalsch.push(`${pfad} (Missionstabelle ohne Zeilen im Tabellenkoerper)`);
    for (const [, trAttr, inhalt] of reihen) {
      const slug = trAttr.match(/data-mission="([a-z0-9-]+)"/)?.[1];
      const zelle = inhalt.match(/<td class="dp-num"([^>]*)>([^<]*)<\/td>/);
      const pool = zelle?.[1].match(/data-pool="(\d+)"/)?.[1];
      if (!slug || !pool) {
        poolTextFalsch.push(`${pfad} (Zeile ohne ${!slug ? 'data-mission' : 'Pool-Zelle'})`);
        continue;
      }
      // Eine Mission ohne Pool-Daten haette nur die Zahl der Bauplan-Seiten
      // (poolGroesse) — dann laufen Crafting- und Missionsdaten auseinander.
      if (!poolGroessen.has(slug)) {
        poolTextFalsch.push(`${pfad} (${slug}: Mission ohne Pool-Daten in src/data/missions.json)`);
        continue;
      }
      poolTexte++;
      const poolMin = zelle[1].match(/data-pool-min="(\d+)"/)?.[1];
      if (poolMin != null && Number(poolMin) >= Number(pool)) poolTextFalsch.push(`${pfad} (${slug}: Spanne ${poolMin}–${pool} nicht aufsteigend)`);
      const text = zelle[2];
      const soll = { min: Number(poolMin ?? pool), max: Number(pool) };
      const zahl = (x) => Number(x.replace(/[.,\u00a0\u202f]/g, ''));
      const r = text.match(/(?:von|of)\s+([\d.,\u00a0\u202f]+)(?:\s*–\s*([\d.,\u00a0\u202f]+))?\s*$/);
      const ist = /(?:nur dieser|only this one)\s*$/.test(text) ? { min: 1, max: 1 } : r ? { min: zahl(r[1]), max: zahl(r[2] ?? r[1]) } : null;
      if (!ist || ist.min !== soll.min || ist.max !== soll.max) poolTextFalsch.push(`${pfad} (${slug}: „${text.trim()}“, Attribute ${soll.min === soll.max ? soll.max : `${soll.min}–${soll.max}`})`);
      const m = poolGroessen.get(slug);
      poolGeprueft++;
      if (m.mehrere) poolGeprueftMehrere++;
      for (const n of [pool, poolMin].filter(Boolean)) {
        if (!m.groessen.has(Number(n))) poolFremd.push(`${pfad} (${slug}: ${n}, Pools ${[...m.groessen].join('/')})`);
      }
    }
    poolZeilen += reihen.length;
  }
  // [12] Materialwege
  if (/<h2[^>]*>(?:Zutaten|Ingredients)<\/h2>/.test(html)) {
    materialSeiten++;
    const mat = html.match(/<ul class="bp-mat"[\s\S]*?<\/ul>/)?.[0];
    // Jedes Material einzeln: Abbau UND Kauf stehen immer da, jeder fuer sich
    // als Weg (data-mat-weg) oder als ausdrueckliches „nein“/„unbekannt“
    // (data-mat-ohne); Zerlegen, wo es etwas zu sagen gibt. Ein einziges
    // data-material reicht nicht, und Kauf + Zerlegen ersetzen den Abbau
    // nicht (Review #434, zweimal).
    const eintraege = mat ? [...mat.matchAll(/<li data-material="([^"]*)"[^>]*>([\s\S]*?)<\/li>/g)] : [];
    const aussage = (li, art) => new RegExp(`data-mat-(?:weg|ohne)="${art}"`).test(li);
    if (!pfad.startsWith('/de/')) {
      for (const [, name, li] of eintraege) {
        const n = name.replace(/&(amp|quot|#39);/g, (_, e) => ({ amp: '&', quot: '"', '#39': "'" })[e]);
        const a = blattMaterial.get(n) ?? { kaufen: new Set(), zerlegen: new Set() };
        a.kaufen.add(li.includes('data-mat-weg="kaufen"') ? 'ja' : 'nein');
        a.zerlegen.add(li.includes('data-mat-weg="zerlegen"') ? 'ja' : li.includes('data-mat-ohne="zerlegen"') ? 'nie' : 'leer');
        blattMaterial.set(n, a);
      }
    }
    const ohneWege = eintraege
      .map(([, name, li]) => [name, ['abbauen', 'kaufen'].filter((art) => !aussage(li, art))])
      .filter(([, fehlt]) => fehlt.length)
      .map(([name, fehlt]) => `${name}: ${fehlt.join(' + ')}`);
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
// [17] Was die Bauplan-Seiten (EN) sagen, zum Abgleich mit der Werkbank.
let blattWikelo = 0;
let blattOhneMitWeg = 0;
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
      const en = !pfad.startsWith('/de/');
      if (en && html.includes('class="dp-actions bp-wikelo"')) blattWikelo++;
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
      if (en && sec.includes('#so-bekommst-du-es')) blattOhneMitWeg++;
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
const fahrzeugOhneDaten = [];
// Wortlaut des Hinweises je Sprache, aus derselben Quelle wie die Seite.
const itemWortlaut = (schluessel) => {
  const t = [...readFileSync(resolve(ROOT, 'src/i18n/itemText.ts'), 'utf8').matchAll(new RegExp(`^\\s*${schluessel}: '((?:[^'\\\\]|\\\\.)*)',$`, 'gm'))].map((m) => m[1]);
  if (t.length !== 2) { console.error(`verify:bezugswege: ${schluessel} steht ${t.length}-mal in src/i18n/itemText.ts, erwartet je einmal fuer de und en`); process.exit(1); }
  return { de: t[0], en: t[1] };
};
const SPECS_ON_SHIP = itemWortlaut('specsOnShip');
const SPECS_OHNE_WERTE = itemWortlaut('specsOhneWerte');
const SPECS_NICHT_IM_SPIEL = itemWortlaut('specsNichtImSpiel');
// Die sechs Flugwerte eines Flugblatts, beschriftet wie auf der Seite. Die
// Beschriftungen stehen in itemText.ts zu mehreren in einer Zeile.
const itemBeschriftung = (schluessel) => {
  const t = [...readFileSync(resolve(ROOT, 'src/i18n/itemText.ts'), 'utf8').matchAll(new RegExp(`\\b${schluessel}: '((?:[^'\\\\]|\\\\.)*)'`, 'g'))].map((m) => m[1]);
  if (t.length !== 2) { console.error(`verify:bezugswege: ${schluessel} steht ${t.length}-mal in src/i18n/itemText.ts, erwartet je einmal fuer de und en`); process.exit(1); }
  return { de: t[0], en: t[1] };
};
const FLUGWERTE = ['statScm', 'statMaxSpeed', 'statBoost', 'statPitch', 'statYaw', 'statRoll'].map(itemBeschriftung);
/* [16] IA C8 Technische Daten auf jedem Item-Blatt */
const techArten = { werte: 0, angaben: 0, schiff: 0, ohneWerte: 0, nichtImSpiel: 0 };
const ohneTechDaten = [];
const techLeer = [];
const techMarkeFalsch = [];
let flugblaetter = 0;
const flugblattOhneWerte = [];
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

function pruefeTechDaten(pfad, html) {
  const sek = abschnitt(html, 'technische-daten');
  const h2 = sichtbar(sek?.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? '').trim();
  if (!sek || !/^(Technische Daten|Technical data)$/.test(h2)) { ohneTechDaten.push(pfad); return; }
  const sprache = pfad.startsWith('/de/') ? 'de' : 'en';
  const notiz = (attr) => falte(sichtbar(sek.match(new RegExp(`<p\\b[^>]*\\b${attr}\\b[^>]*>([\\s\\S]*?)<\\/p>`))?.[1] ?? ''));
  const hatOhneWerte = sek.includes('data-specs-ohne-werte');
  const hatNichtImSpiel = sek.includes('data-specs-nicht-im-spiel');
  // Bloecke nach Inhalt, nicht nach Klasse: ein leerer <p class="dp-desc">
  // oder eine Liste ohne Eintrag ist keine Angabe (Review #476).
  const block = (cls) => sek.match(new RegExp(`<(ul|p)\\b[^>]*\\bclass="${cls}"[^>]*>([\\s\\S]*?)<\\/\\1>`))?.[2] ?? '';
  const wertNamen = [...block('dp-stats').matchAll(/<b\b[^>]*>([\s\S]*?)<\/b>/g)].map((m) => falte(sichtbar(m[1])));
  const chipsDa = /<li\b/.test(block('dp-chips'));
  const descDa = falte(sichtbar(block('dp-desc'))) !== '';
  const werte = wertNamen.length > 0;
  const art = sek.includes('data-specs-schiff') ? 'schiff'
    : hatNichtImSpiel ? 'nichtImSpiel'
    : werte ? 'werte'
    : hatOhneWerte ? 'ohneWerte'
    : chipsDa || descDa ? 'angaben'
    : null;
  if (!art) { techLeer.push(pfad); return; }
  techArten[art]++;
  const item = itemNachId.get(pfad.match(/\/([^/]+)\.html$/)?.[1]);
  const probleme = [];
  if (hatNichtImSpiel && notiz('data-specs-nicht-im-spiel') !== SPECS_NICHT_IM_SPIEL[sprache]) probleme.push('Hinweis „nicht im Spiel" im anderen Wortlaut');
  if (hatOhneWerte && notiz('data-specs-ohne-werte') !== SPECS_OHNE_WERTE[sprache]) probleme.push('Hinweis „keine Werte-Übersicht" im anderen Wortlaut');
  if (hatNichtImSpiel !== (item?.nichtImSpiel === true)) probleme.push(hatNichtImSpiel ? 'Hinweis „nicht im Spiel", der Katalog markiert es nicht' : 'Katalog: nicht im Spiel, die Seite sagt es nicht');
  if (item?.nichtImSpiel && item.game) probleme.push('Katalog: nicht im Spiel, traegt aber Spieldaten');
  if (item?.game?.ohneWerte && !hatOhneWerte) probleme.push('Katalog: ohne Werte, die Seite sagt es nicht');
  if (hatOhneWerte && werte) probleme.push('Hinweis „keine Werte-Übersicht" neben Werten');
  // Die andere Richtung: ohne Katalog-Marke steht der Hinweis nur auf einem
  // Blatt, das sonst gar nichts zeigt (Regel in ItemDetail.astro, Review #476).
  if (hatOhneWerte && item?.game?.ohneWerte !== true && (!item?.game || chipsDa || descDa)) probleme.push('Hinweis „keine Werte-Übersicht" ohne Katalog-Marke');
  if (probleme.length) techMarkeFalsch.push(`${pfad} (${probleme.join('; ')})`);
  // Flugblatt zaehlt nur mit allen sechs Flugwerten, nicht mit irgendeinem
  // Werteblock (Review #476).
  if (item?.game?.gameType === 'FlightController') {
    const fehlen = FLUGWERTE.map((w) => w[sprache]).filter((l) => !wertNamen.includes(l));
    if (fehlen.length) flugblattOhneWerte.push(`${pfad} (fehlt: ${fehlen.join(', ')})`);
    else flugblaetter++;
  }
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
    pruefeMissionsNamen(pfad, block); // [15]
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
    // [16] Technische Daten: der Abschnitt steht, und er sagt etwas
    pruefeTechDaten(pfad, html);
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
      // IA C8: der Abschnitt „Technische Daten" fehlt nicht, er sagt, dass
      // die Werte auf dem Schiffsblatt stehen, und verlinkt dasselbe Ziel.
      const sek = [...html.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/g)].map((m) => m[1]).find((x) => x.includes('data-specs-schiff'));
      const sekH2 = sichtbar(sek?.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? '').trim();
      // Das Ziel ist das href eines echten <a> mit data-specs-schiff, gelesen
      // wie in [15]; ein span mit denselben Attributen ist kein Link (Review #465).
      const datenAnker = sek ? [...sek.matchAll(/<a\b((?:[^>"']|"[^"]*"|'[^']*')*)>/g)].map((m) => attribute(m[1])).find((a) => a.has('data-specs-schiff')) : null;
      const datenZiel = datenAnker?.get('href')?.match(/^((?:\/de)?\/schiffe\/[a-z0-9-]+\.html)$/)?.[1];
      // Und der Hinweis davor sagt es im Wortlaut von src/i18n/itemText.ts (Review #465).
      const hinweis = falte(sichtbar(sek?.match(/<p\b[^>]*\bclass="[^"]*\bdp-note\b[^"]*"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? ''));
      const hinweisFehlt = !hinweis.startsWith(SPECS_ON_SHIP[pfad.startsWith('/de/') ? 'de' : 'en']);
      if (!sek || !/^(Technische Daten|Technical data)$/.test(sekH2) || !datenZiel || datenZiel !== ziel || hinweisFehlt) fahrzeugOhneDaten.push(`${pfad}${datenZiel && datenZiel !== ziel ? ` -> ${datenZiel} statt ${ziel}` : ''}${sek && hinweisFehlt ? ' (Hinweis fehlt oder anders)' : ''}`);
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
console.log(`    Abschnitt „Technische Daten" mit Link aufs eigene Schiffsblatt (IA C8) fehlt — Soll: 0   Ist: ${fahrzeugOhneDaten.length}`);
need(!fahrzeugOhneDaten.length, `${fahrzeugOhneDaten.length} Fahrzeug-Itemblatt/-blaetter ohne Abschnitt „Technische Daten" mit Link aufs eigene Schiffsblatt — ${liste(fahrzeugOhneDaten)}`);

console.log('\n[16] IA C8 Jedes Item-Blatt hat „Technische Daten" — Werte, Angaben oder einen benannten Hinweis');
console.log(`    Item-Blaetter: ${blaetter}   mit Werten: ${techArten.werte}   nur Angaben (Hersteller, Beschreibung): ${techArten.angaben}   Fahrzeug -> Schiffsblatt: ${techArten.schiff}   Hinweis „keine Werte-Übersicht": ${techArten.ohneWerte}   Hinweis „nicht im Spiel": ${techArten.nichtImSpiel} (Decke ${DECKEN.nichtImSpiel})`);
console.log(`    ohne Abschnitt: ${ohneTechDaten.length} (Decke ${DECKEN.ohneTechDaten}, Ziel 0)   Abschnitt leer — Soll: 0   Ist: ${techLeer.length}   Hinweis passt nicht zum Katalog oder Wortlaut — Soll: 0   Ist: ${techMarkeFalsch.length}`);
console.log(`    Flugblaetter: ${flugblaetter} (Klinke ${KLINKEN.flugblaetter})   ohne Flugwerte — Soll: 0   Ist: ${flugblattOhneWerte.length}`);
need(ohneTechDaten.length <= DECKEN.ohneTechDaten, `${ohneTechDaten.length} Item-Blatt/-Blaetter ohne Abschnitt „Technische Daten", Decke ${DECKEN.ohneTechDaten} — Spieldaten fehlen und keine Marke ohneWerte/nichtImSpiel? (build-universal-db.mjs, IA C8) Decke nicht heben — ${liste(ohneTechDaten)}`);
need(!techLeer.length, `${techLeer.length} Item-Blatt/-Blaetter mit leerem Abschnitt „Technische Daten" — ${liste(techLeer)}`);
need(!techMarkeFalsch.length, `${techMarkeFalsch.length} Item-Blatt/-Blaetter: Hinweis in „Technische Daten" passt nicht zum Katalog oder zu src/i18n/itemText.ts — ${liste(techMarkeFalsch)}`);
need(techArten.nichtImSpiel <= DECKEN.nichtImSpiel, `${techArten.nichtImSpiel} Item-Blaetter „nicht im Spiel", Decke ${DECKEN.nichtImSpiel} — fehlt im Datenlauf die Identitaetsliste, oder hat ein Patch Items umbenannt? Paare in scripts/lib/item-namen-aliase.mjs pruefen, Decke nicht heben`);
need(flugblaetter >= KLINKEN.flugblaetter, `nur ${flugblaetter} Flugblatt-Seiten, Klinke ${KLINKEN.flugblaetter} — liest datamine-items.mjs den Typ FlightController noch? Ursache klaeren, nicht die Klinke senken`);
need(!flugblattOhneWerte.length, `${flugblattOhneWerte.length} Flugblatt-Seite(n) ohne Flugwerte — ${liste(flugblattOhneWerte)}`);

console.log('\n[7] D4 Missionstabelle eines Bauplans nennt den Pool statt „100 %"');
console.log(`    Tabellen: ${poolTabellen} (Klinke ${KLINKEN.poolTabellen})   ohne Pool oder mit nacktem „100 %" — Soll: 0   Ist: ${poolOhne.length}`);
need(poolTabellen >= KLINKEN.poolTabellen, `nur ${poolTabellen} Missionstabellen, Klinke ${KLINKEN.poolTabellen} — Ursache klaeren, nicht die Klinke senken`);
need(!poolOhne.length, `${poolOhne.length} Missionstabelle(n) ohne Pool je Zeile oder mit nacktem „100 %" — ${liste(poolOhne)}`);
console.log(`    Zeilen mit Pool-Daten: ${poolGeprueft} (davon zu Missionen mit mehreren Pools: ${poolGeprueftMehrere}; Missionen: ${poolGroessen.size})   Zahl ist keine Poolgroesse der Mission — Soll: 0   Ist: ${poolFremd.length}`);
need(poolGeprueft > 0 && poolGeprueftMehrere > 0, 'keine Zeile mit Pool-Daten (oder keine zu einer Mission mit mehreren Pools) geprueft — Daten oder Muster veraltet?');
need(!poolFremd.length, `${poolFremd.length} Zeile(n) nennen eine Zahl, die keine Poolgroesse ihrer Mission ist — ${liste(poolFremd)}`);
console.log(`    sichtbarer Text gegen data-pool/data-pool-min: ${poolTexte} von ${poolZeilen} Tabellenzeilen   Befunde (Text, data-mission, Pool-Daten, Spanne) — Soll: 0   Ist: ${poolTextFalsch.length}`);
need(poolZeilen > 0 && poolTexte === poolZeilen, `${poolTexte} Pool-Zellen geprueft, aber ${poolZeilen} Zeilen in den Missionstabellen — Muster veraltet?`);
need(!poolTextFalsch.length, `${poolTextFalsch.length} Befund(e) in Missionszeilen (ohne data-mission oder Pool-Zelle, Mission ohne Pool-Daten, Spanne nicht aufsteigend oder Text anders als die Attribute) — ${liste(poolTextFalsch)}`);

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

console.log('\n[15] Missionsnamen auf Bauplan- und Item-Seiten wie auf der Missionsseite');
console.log(`    Missionslinks: ${missionsNamen} (Klinke ${KLINKEN.missionsNamen}, Missionsseiten gelesen: ${missionsSeitenNamen.size})   anderer Name oder Seite fehlt — Soll: 0   Ist: ${missionsNameFalsch.length}`);
need(missionsNamen > 0 && missionsNamen >= KLINKEN.missionsNamen, `nur ${missionsNamen} Missionslinks geprueft, Klinke ${KLINKEN.missionsNamen} — Muster veraltet? Ursache klaeren, nicht die Klinke senken`);
need(!missionsNameFalsch.length, `${missionsNameFalsch.length} Missionslink(s) mit anderem Namen als die Missionsseite — ${liste(missionsNameFalsch)}`);

/* ---------- [17] Crafting-Werkbank wie das Bauplan-Blatt ---------- */
console.log('\n[17] Crafting-Werkbank: Materialwege, Quelle ohne Mission und Wikelo wie auf dem Bauplan-Blatt');
{
  const TEXTE = ['matTitle', 'matMineNone', 'matBuyNone', 'matBuyUnknown', 'matSalvageNone', 'bpSourceTitle', 'bpSourceUnknown',
    'bpSourceUnknownText', 'bpSourceWikelo', 'bpSourceWikeloText', 'bpNextTitle', 'bpNextItem', 'bpNextItemBuy', 'bpNextItemFind',
    'bpNextItemStock', 'bpNextItemWikelo', 'bpNextItemOpen', 'bpNextReport', 'report'];
  const WB_TEXTE = ['wegMine', 'wegBuy', 'wegSalvage', 'wegMineLink', 'wegBuyYes', 'wegSalvageFrom', 'wegSalvageNone', 'wegSalvageTitle'];
  const appPfad = join(DIST, 'assets/crafting-app.js');
  const app = existsSync(appPfad) ? readFileSync(appPfad, 'utf8') : '';
  for (const marke of ['data-mat-zerlegen', 'data-mat-weg="kaufen"', 'data-quelle="unbekannt"', 'data-quelle="wikelo"', 'data-quelle-weg="wikelo"', 'data-hinweis']) {
    need(app.includes(marke), `dist/assets/crafting-app.js zeichnet „${marke}“ nicht — die Werkbank zeigt die Wege nicht mehr`);
  }
  for (const pre of ['', 'de/']) {
    const datei = join(DIST, `${pre}topics/crafting.html`);
    const html = existsSync(datei) ? readFileSync(datei, 'utf8') : '';
    const m = /<script[^>]*>(window\.__CRAFT\s*=[\s\S]*?)<\/script>/.exec(html);
    if (!m) { fail.push(`/${pre}topics/crafting.html: kein window.__CRAFT-Block`); continue; }
    const ctx = { window: {} };
    vm.runInNewContext(m[1], ctx);
    const cfg = ctx.window.__CRAFT ?? {};
    const w = cfg.wege;
    if (!w || typeof w.mat !== 'object' || !Array.isArray(w.wik) || typeof w.ohne !== 'string') {
      fail.push(`/${pre}topics/crafting.html: window.__CRAFT.wege fehlt oder hat die Form verloren (mat, wik, ohne)`);
      continue;
    }
    const fehlt = [], kaufAnders = [], zerlegAnders = [];
    for (const [name, a] of blattMaterial) {
      const e = w.mat[name];
      if (!e) { fehlt.push(name); continue; }
      const kauf = e[0] === 1 ? 'ja' : 'nein';
      if (a.kaufen.size !== 1 || !a.kaufen.has(kauf)) kaufAnders.push(`${name} (Blatt ${[...a.kaufen].join('/')}, Werkbank ${kauf})`);
      const z = e[1];
      // Das Blatt laesst das eigene Item weg; die Werkbank traegt zwei Namen
      // und tut dasselbe. „leer“ auf einer Seite ist deshalb kein Widerspruch.
      const nie = z === 'x', weg = Array.isArray(z) && z.length > 0 && z.every((x) => typeof x === 'string' && x);
      if (a.zerlegen.has('nie') !== nie || (a.zerlegen.has('ja') && !weg)) zerlegAnders.push(`${name} (Blatt ${[...a.zerlegen].join('/')}, Werkbank ${JSON.stringify(z)})`);
    }
    const ohne = w.ohne ? w.ohne.split(';') : [];
    const ohneKaputt = ohne.filter((x) => !/^\d+:\d*[fsw]*$/.test(x) || /^\d+:$/.test(x));
    const texte = [...TEXTE.filter((k) => typeof cfg.wegeT?.[k] !== 'string' || !cfg.wegeT[k].trim()), ...WB_TEXTE.filter((k) => typeof cfg.wbT?.[k] !== 'string' || !cfg.wbT[k].trim())];
    console.log(`    /${pre}topics/crafting.html: Materialien ${Object.keys(w.mat).length} (auf den Blaettern ${blattMaterial.size})   ohne Mission mit Weg ${ohne.length} (Blaetter ${blattOhneMitWeg}, Klinke ${KLINKEN.werkbankOhneMission})   Wikelo-Bauplaene ${w.wik.length} (Blaetter ${blattWikelo})`);
    console.log(`      fehlend — Soll: 0   Ist: ${fehlt.length}   Kaufen anders als das Blatt — Soll: 0   Ist: ${kaufAnders.length}   Zerlegen anders — Soll: 0   Ist: ${zerlegAnders.length}   Texte fehlen — Soll: 0   Ist: ${texte.length}`);
    need(blattMaterial.size >= 30, `nur ${blattMaterial.size} Materialien auf den Bauplan-Seiten gelesen — Muster veraltet?`);
    need(!fehlt.length, `/${pre}topics/crafting.html: ${fehlt.length} Material(ien) der Bauplan-Seiten ohne Weg in der Werkbank — ${liste(fehlt)}`);
    need(!kaufAnders.length, `/${pre}topics/crafting.html: Kaufen sagt in der Werkbank etwas anderes als auf dem Blatt — ${liste(kaufAnders)}`);
    need(!zerlegAnders.length, `/${pre}topics/crafting.html: Zerlegen sagt in der Werkbank etwas anderes als auf dem Blatt — ${liste(zerlegAnders)}`);
    need(!ohneKaputt.length, `/${pre}topics/crafting.html: ${ohneKaputt.length} unlesbare Eintraege in wege.ohne — ${liste(ohneKaputt)}`);
    need(ohne.length === blattOhneMitWeg, `/${pre}topics/crafting.html: ${ohne.length} Rezepte ohne Mission mit Weg zum Item, die Bauplan-Seiten nennen ${blattOhneMitWeg}`);
    need(ohne.length >= KLINKEN.werkbankOhneMission, `/${pre}topics/crafting.html: nur ${ohne.length} Rezepte ohne Mission mit Weg, Klinke ${KLINKEN.werkbankOhneMission} — Ursache klaeren, nicht die Klinke senken`);
    need(w.wik.length === blattWikelo, `/${pre}topics/crafting.html: ${w.wik.length} Wikelo-Bauplaene in der Werkbank, die Bauplan-Seiten zeigen ${blattWikelo}`);
    need(!texte.length, `/${pre}topics/crafting.html: Texte fuer die Wege fehlen — ${liste(texte)}`);
  }
}

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
