// verify-clienttext.mjs — der Text, den die Werkzeuge erst im Browser bauen.
//
// WARUM ES DEN GIBT: audit:site und verify:sprache lesen das statische HTML.
// Der Item Finder baute seine Karten und sein Detail-Modal aber erst im
// Browser aus assets/universal-items.json zusammen — diesen Text hat bis zum
// 04.11.2026 KEIN Tor gelesen. So stand der Schildwiderstand im Finder-Modal
// als "Physisch NaN% · Distortion NaN%" da (behoben am 03.11.2026 im
// Finder-Skript, fmtResist), und nichts haette verhindert, dass derselbe
// Fehler morgen zurueckkommt: die Pruefung, die ihn auf den statischen
// Seiten faengt, sieht das Modal nie.
// Am selben Abend zeigte sich, dass das fuer JEDES Werkzeug gilt: das
// Blueprint-Fenster des Crafting-Rechners listete Missionen als
// "Wanted: {TargetName}" und "Defend {Location} From Mercs", sein
// Qualitaetsrechner schrieb auf der deutschen Seite "0.5", und
// assets/detail.js sprach auf allen englischen Seiten "Bild öffnen: Asgard"
// vor. Deshalb Teil 2.
//
// TEIL 1 — Items-Seite, vollstaendig (Schiene A, ohne Browser): seit dem
// 26.11.2026 ist der Item Finder in der Items-Werkbank auf /items.html
// aufgegangen. Teil 1 oeffnet dist/items.html und dist/de/items.html im
// Pruefstand (linkedom, scripts/lib/pruefstand.mjs) mit der ausgelieferten
// Konfiguration (window.__WZI) und den ausgelieferten Daten. In die geladene
// Kopie von assets/items-werkbank.js — nicht in die Datei — wird vor dem
// letzten "})();" eine Pruefnaht gesetzt. Dann rendert es je Sprache JEDES
// Item als Kachel und als Blatt (mit Crafting-Abschnitt) und jedes Set als
// Kachel und als Blatt.
//
// TEIL 2 — jede Seitenart, bedient (scripts/lib/pruefstand.mjs): laedt je
// Sprache eine Seite jeder Art (gleiche Skripte, gleiche Inline-Form — die
// Werkzeuge sind je eine eigene Art, die 7.190 Item- und Crafting-Seiten
// eine) in ein echtes DOM, fuehrt ihre Skripte aus (auch die Astro-Module),
// und bedient dann, was bedienbar ist: Auswahllisten, Regler, Haken,
// Knoepfe, Reiter, Suchfelder und jedes Klickziel, das ein Skript per
// closest()/matches() anspricht. Geprueft wird nur Text, den ein Skript
// geschrieben hat; der statische gehoert audit:site und verify:sprache.
//
// Regeln (scripts/lib/textregeln.mjs, pruefeStelle — dieselben Ausdruecke
// wie im statischen HTML), je Textknoten und gelesenem Attribut
// (aria-label, title, alt, placeholder …):
//   1  Rohtext (NaN, undefined, Infinity, [object, null neben Zeichen,
//      {Platzhalter} in beiden Schreibweisen, ${ / {{, %schluessel%,
//      ReputationStanding_, Gleitkomma-Rauschen, Exponentenform) und "-1"
//      als Wert,
//   2  mehrwortiger Katalogtext der anderen Sprache; auf EN zusaetzlich kein
//      deutsches Funktionswort, kein Wort mit Umlaut, kein deutsches
//      Bedienwort (Rueckfalltexte der Skripte sind deutsch),
//   3  Zahl, Dezimalzahl und Datum im Format der eigenen Sprache,
//   4  Katalogschluessel statt Text, "The The" aus einer Satzvorlage,
//   5  (Teil 1) jeder woertliche tr('schluessel', …) im Skript steht im
//      ausgelieferten Katalog BEIDER Sprachen — sonst zeigt die EN-Seite den
//      deutschen Rueckfalltext des Skripts; ebenso jeder w('schluessel') im
//      Textsatz der Werkbank (fehlt er, zeigt die Seite den Schluessel
//      selbst; seit 26.11.2026). Dazu jeder Schluessel, den das
//      Skript beim Rendern WIRKLICH fragt, auch zusammengesetzte wie
//      tr('w' + klasse) oder tr('ex' + grund) (Review 04.11.2026): steht er
//      nur in einem der beiden Kataloge, ist das ein FEHLER; fehlt er in
//      beiden, zeigt die Seite den Rohwert der Spieldaten — WARNUNG, weil das
//      so gewollt ist, bis jemand das Label ergaenzt.
//   6  (Teil 2) kein Skript bricht beim Laden oder Bedienen ab. Ein Abbruch
//      ist entweder ein echter Fehler der Seite oder eine Faehigkeit, die
//      dem Pruefstand fehlt — in beiden Faellen sieht die Pruefung den Text
//      dahinter nicht, also FEHLER.
// Selbstauskunft und Klinken fuer Items, Blaetter mit Crafting, Sets,
// Textstellen und Schluessel (Teil 1), fuer Seitenarten, Bedienschritte und
// geschriebene Texte (Teil 2) und je Werkzeug fuer dessen Texte.
//
// Kein git, kein Netz: was die Seiten nachladen, liest der Pruefstand aus
// dist/, fremde Hosts antworten wie ohne Verbindung. Einziger Kindprozess ist
// esbuilds Dienst beim Buendeln der Kataloge und der Astro-Module.
//
//   node scripts/verify-clienttext.mjs [--dist <ordner>] [--js <items-werkbank.js>] [--alle]
//   (--js prueft eine andere Fassung des Skripts gegen denselben Bau — so
//   wird die Gegenprobe gegen den Stand vor dem Fix gefahren.)
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import {
  ladeKataloge, sprachMengen, textStellen, norm, rohschluesselRe, pruefeStelle, REGEL_TITEL,
} from './lib/textregeln.mjs';
import { oeffneSeite, erkunde, texteAus, seitenArten, AUSGELASSEN as SKRIPT_AUSGELASSEN } from './lib/pruefstand.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? resolve(argv[i + 1]) : null; };
const DIST = opt('--dist') || resolve(ROOT, 'dist');
const JS = opt('--js') || join(DIST, 'assets', 'items-werkbank.js');
const ALLE = argv.includes('--alle'); // jeden Befund zeigen, nicht nur die ersten zwoelf
if (!existsSync(DIST)) { console.error(`${DIST} fehlt — erst npm run build.`); process.exit(2); }

// Klinken Teil 1 (Grundsatz 5), gemessen am 04.11.2026 am Item Finder:
// 9.412 Items, 1.594 Modals mit Crafting-Abschnitt je Sprache, 141 Sets,
// 823.745 Textstellen ueber beide Sprachen, 92 woertliche Schluessel.
// Neu gemessen am 26.11.2026 an der Items-Werkbank, die den Item Finder
// ersetzt: 9.462 Items, 1.615 Blaetter mit Crafting je Sprache, 143 Sets,
// 1.357.380 Textstellen (Kachel und Blatt je Item, Set-Kachel und -Blatt),
// 68 woertliche tr()- und 38 woertliche w()-Schluessel im Skript, 97 beim
// Rendern gefragte tr()-Schluessel. Schluessel und Laufzeit-Schluessel
// sinken, weil die Werkbank ihre eigenen Woerter im Textsatz w() fuehrt
// statt im Katalog tr() — Ursache benannt, Klinken nach unten.
const MIN_ITEMS = 9_000;
const MIN_SETS = 120;
const MIN_MODAL_CRAFT = 1_400;
const MIN_STELLEN = 1_200_000;
const MIN_SCHLUESSEL = 60;
const MIN_SCHLUESSEL_W = 32;
const MIN_LAUFZEIT = 85;
// Crafting-Rechner (Regel 5 auch dort, 11.11.2026): gemessen 40 woertliche
// Schluessel in assets/crafting-app.js, 41 Eintraege im Katalog je Sprache.
const MIN_SCHLUESSEL_CRAFT = 34;
const CRAFT_JS = join(DIST, 'assets', 'crafting-app.js');
const CRAFT_SEITEN = { en: 'topics/crafting.html', de: 'de/topics/crafting.html' };

// Klinken Teil 2, gemessen am 04.11.2026 auf dem Live-Bau: 102 Seitenarten
// aus 17.752 Seiten, 4.327 Bedienschritte, 11.874 geschriebene Texte.
const MIN_SEITENARTEN = 95;
const MIN_AKTIONEN = 3_800;
const MIN_TEXTE = 10_500;
// Je Werkzeug: so viele Texte schreibt es beim Bedienen mindestens (gut 85 %
// des am 04.11.2026 gemessenen Werts, in Klammern). Faellt eins darunter,
// hat der Pruefstand es nicht mehr erreicht (Skript umbenannt,
// Bedienelement versteckt) — dann prueft das Tor dort nichts. Steht ein
// Werkzeug hier, wird es auch geladen, wenn es seine Seitenart mit einer
// anderen Seite teilt.
const WERKZEUGE = {
  'topics/crafting.html': 2_100, // (2.422)
  'de/topics/crafting.html': 2_100, // (2.427)
  'topics/mining.html': 1_000, // (1.187)
  'de/topics/mining.html': 1_000, // (1.196)
  'fracturing.html': 640, // (747)
  'de/fracturing.html': 640, // (752)
  'items.html': 6_900, // (8.167, gemessen 26.11.2026 an der Items-Werkbank; vorher Item Finder 270)
  'de/items.html': 7_000, // (8.271; vorher Item Finder 480)
  'precision-jump.html': 200, // (243)
  'de/precision-jump.html': 200, // (248)
  'topics/wikelo-emporium.html': 140, // (168)
  'de/topics/wikelo-emporium.html': 140, // (174)
  'missionen.html': 50, // (61)
  'de/missionen.html': 55, // (66)
  'schiffe.html': 38, // (45)
  'de/schiffe.html': 42, // (50)
  'archiv.html': 32, // (38)
  'de/archiv.html': 36, // (43)
  'refinery.html': 10, // (12)
  'de/refinery.html': 14, // (17)
};

// Seiten, die Teil 2 nicht laedt.
const OHNE_SEITEN = [
  { pfad: 'onepager/', anlass: 'eigenstaendige EN-Druckseiten ohne Sprachpaar (wie audit:site und verify:sprache)' },
];

const fehler = [];
const funde = {};
for (const r of Object.keys(REGEL_TITEL)) funde[r] = [];
funde.katalog = [];
funde.abbruch = [];

/* ---------- Kataloge fuer die Sprachregeln ---------- */
let M;
try {
  M = sprachMengen(await ladeKataloge(ROOT));
} catch (err) {
  console.error('FEHLER: die i18n-Kataloge liessen sich nicht laden — die Pruefung kann nicht urteilen.');
  console.error(String(err && err.message ? err.message : err));
  process.exit(1);
}
const ROHSCHLUESSEL_RE = rohschluesselRe(M.praefixe);

/** Eine Textstelle nach allen Regeln; Befund mit Ort und Umfeld. */
function pruefeText(t, lang, wo) {
  for (const { regel, treffer, index } of pruefeStelle(t, lang, M, ROHSCHLUESSEL_RE)) {
    const umfeld = t.length > treffer.length ? ` in „${t.slice(Math.max(0, index - 40), index + treffer.length + 40)}"` : '';
    funde[regel].push(`${lang} ${wo}: „${treffer}"${umfeld}`);
  }
}

/* ================================================================
   TEIL 1 — Items-Seite (Items-Werkbank)
   ================================================================ */
const QUELLE = readFileSync(JS, 'utf8');
const ANKER = QUELLE.lastIndexOf('})();');
if (ANKER < 0 || QUELLE.slice(ANKER + 5).trim() !== '') {
  console.error(`FEHLER: ${JS} endet nicht mit "})();" — die Pruefnaht findet ihren Platz nicht. Das Skript wurde umgebaut; die Naht hier anpassen.`);
  process.exit(1);
}
// Die Naht laeuft am Ende des Skripts, waehrend der Katalog noch laedt; sie
// ruft nur Funktionen, die das Skript selbst benutzt. Kachel und Blatt sind
// HTML-Zeichenketten; den Crafting-Abschnitt setzt craftEinsetzen() wie beim
// Oeffnen eines Items in das eingehaengte Blatt. leere(): der Pruefstand
// meldet jede beobachtete Marke als sichtbar, also legt das Gitter beim
// Laden alle Kacheln an (rund 150.000 Knoten); craftEinsetzen() sucht mit
// getElementById, das linkedom durch den ganzen Baum fuehrt — 30 ms je
// Blatt. Vor der Blatt-Schleife wird das Gitter deshalb geleert; die
// Kacheln prueft die Schleife als Zeichenkette.
const NAHT = `
  var __gefragt = {}, __gefragtW = {};
  tr = (function (orig) {
    return function (k) { __gefragt[k] = 1; return orig.apply(this, arguments); };
  })(tr);
  w = (function (orig) {
    return function (k) { __gefragtW[k] = 1; return orig.apply(this, arguments); };
  })(w);
  window.__pruefnaht = {
    gefragt: function () { return Object.keys(__gefragt); },
    gefragtW: function () { return Object.keys(__gefragtW); },
    bereit: function () { return bereit; },
    ladeFehler: function () { return ladeFehler; },
    laden: function () { return ladeCraft(); },
    leere: function () { if (io) io.disconnect(); el.gitter.innerHTML = ''; },
    items: function () { return ITEMS; },
    sets: function () { return SETLISTE; },
    blatt: function (it) {
      el.inh.innerHTML = blattItem(it);
      craftEinsetzen(it, document.getElementById('wzb-craft'));
      return el.inh.innerHTML;
    },
    kachel: function (it) { return kachel(it); },
    setkachel: function (st) { return setKachel(st); },
    satz: function (st) { return blattSatz(st); }
  };
`;
const CODE = QUELLE.slice(0, ANKER) + NAHT + QUELLE.slice(ANKER);
const SKRIPT = '/assets/items-werkbank.js';

let stellen = 0;
function pruefeHtml(html, lang, wo) {
  // Ein Blattelement mit eigenem lang-Attribut zaehlt in SEINER Sprache
  // (englischer Spieltext im DE-Blatt, lang="en") — wie im Pruefstand
  // (texteAus) und in verify:sprache.
  const eigen = [];
  const rest = html.replace(/<(\w+)\b[^>]*\slang="(de|en)"[^>]*>([^<]*)<\/\1>/g, (m, tag, l, innen) => {
    if (l === lang) return m;
    eigen.push([innen, l]);
    return ' ';
  });
  for (const roh of textStellen(rest)) {
    stellen++;
    pruefeText(norm(roh), lang, wo);
  }
  for (const [innen, l] of eigen) {
    for (const roh of textStellen(`>${innen}<`)) {
      stellen++;
      pruefeText(norm(roh), l, wo);
    }
  }
}

const esbuild = await import('esbuild');
const buendel = new Map();
const SEITEN = { en: 'items.html', de: 'de/items.html' };
const katalogSchluessel = {};
const katalogW = {};
const gefragt = {};
const gefragtW = {};
const zaehlung = {};
const t1 = Date.now();
for (const [lang, seite] of Object.entries(SEITEN)) {
  if (!existsSync(join(DIST, seite))) { fehler.push(`${seite} fehlt — die Items-Seite ist nicht im Bau`); continue; }
  let naht = null, p = null;
  try {
    p = await oeffneSeite({
      dist: DIST, seite, esbuild, buendel, sprache: lang === 'de' ? 'de-DE' : 'en-US',
      umbau: (name, code) => {
        if (name !== SKRIPT) return code;
        naht = true;
        return CODE;
      },
    });
  } catch (err) {
    fehler.push(`${lang}: ${seite} laesst sich nicht oeffnen — ${err.message}`);
    continue;
  }
  if (!naht) { fehler.push(`${lang}: ${seite} laedt ${SKRIPT} nicht — Skript umbenannt? Dann SKRIPT hier nachziehen.`); p.schliesse(); continue; }
  await p.settle(3000);
  // Jede Uebernahme leert p.fehler: was spaeter einlaeuft (nach dem Laden des
  // Katalogs, beim Rendern der Blaetter), kommt genau einmal in den Bericht.
  const uebernimm = () => { for (const f of p.fehler.splice(0)) fehler.push(`${lang}: ${seite} — ${f}`); };
  uebernimm();
  const cfg = p.window.__WZI || {};
  katalogSchluessel[lang] = new Set(Object.keys(cfg.t || {}));
  katalogW[lang] = new Set(Object.keys(cfg.w || {}));
  naht = p.window.__pruefnaht;
  if (!naht) { fehler.push(`${lang}: Pruefnaht nicht erreichbar — bricht das Skript vor seinem Ende ab?`); p.schliesse(); continue; }
  if (!naht.bereit()) { fehler.push(`${lang}: der Item-Katalog ist nicht geladen${naht.ladeFehler() ? ' (Ladefehler)' : ''} — dbUrl in window.__WZI pruefen`); p.schliesse(); continue; }
  await naht.laden();
  await p.settle(500);
  uebernimm();
  naht.leere();
  const items = naht.items();
  const sets = naht.sets();
  const z = (zaehlung[lang] = { items: items.length, modals: 0, mitCraft: 0, sets: sets.length });
  for (const it of items) {
    let html;
    try { html = naht.blatt(it); } catch (err) { fehler.push(`${lang}: Blatt von „${it.name}" bricht ab — ${err.message}`); continue; }
    // Der Pruefstand merkt sich jedes beschriebene Element bis zur naechsten
    // Ernte; ohne sie hielte er alle 9.462 ersetzten Blaetter fest (gemessen
    // 26.11.2026: 0,2 GB je 1.000 Blaetter, 3,7 GB nach Teil 1, danach kam
    // Teil 2 auf /topics/crafting.html nicht mehr voran). Teil 1 liest den
    // Text aus der Zeichenkette, die Ernte selbst wird verworfen.
    p.ernte();
    z.modals++;
    if (html.includes('class="wzb-craft"')) z.mitCraft++;
    pruefeHtml(html, lang, `Items, Blatt „${it.name}"`);
    try { pruefeHtml(naht.kachel(it), lang, `Items, Kachel „${it.name}"`); } catch (err) { fehler.push(`${lang}: Kachel von „${it.name}" bricht ab — ${err.message}`); }
  }
  for (const st of sets) {
    try { pruefeHtml(naht.setkachel(st), lang, `Items, Set-Kachel „${st.name}"`); } catch (err) { fehler.push(`${lang}: Set-Kachel „${st.name}" bricht ab — ${err.message}`); }
    try { pruefeHtml(naht.satz(st), lang, `Items, Set-Blatt „${st.name}"`); } catch (err) { fehler.push(`${lang}: Set-Blatt „${st.name}" bricht ab — ${err.message}`); }
  }
  gefragt[lang] = new Set(naht.gefragt());
  gefragtW[lang] = new Set(naht.gefragtW());
  uebernimm();
  p.schliesse();
}

/* ---------- 5: woertliche Schluessel im Skript ---------- */
const woertlich = [...new Set([...QUELLE.matchAll(/\btr\(\s*'([A-Za-z][\w.]*)'\s*,/g)].map((m) => m[1]))];
for (const k of woertlich) for (const lang of Object.keys(SEITEN)) {
  if (!katalogSchluessel[lang]?.has(k)) funde.katalog.push(`${lang}: tr('${k}') steht nicht im ausgelieferten Katalog — die Seite zeigt den Rueckfalltext des Skripts`);
}
// Der Textsatz der Werkbank (window.__WZI.w) hat keinen Rueckfalltext: ein
// fehlender Schluessel steht woertlich auf der Seite. Woertlich im Skript und
// beim Rendern gefragt, je Sprache.
const woertlichW = [...new Set([...QUELLE.matchAll(/\bw\(\s*'([A-Za-z][\w.]*)'\s*\)/g)].map((m) => m[1]))];
for (const lang of Object.keys(SEITEN)) {
  for (const k of new Set([...woertlichW, ...(gefragtW[lang] ?? [])])) {
    if (!katalogW[lang]?.has(k)) funde.katalog.push(`${lang}: w('${k}') steht nicht im Textsatz der Werkbank (window.__WZI.w) — die Seite zeigt den Schluessel`);
  }
}
// Zur Laufzeit gefragte Schluessel (auch zusammengesetzte): Paritaet.
const laufzeit = new Set([...(gefragt.de ?? []), ...(gefragt.en ?? [])]);
const ohneLabel = [];
for (const k of laufzeit) {
  const inDe = katalogSchluessel.de?.has(k), inEn = katalogSchluessel.en?.has(k);
  if (inDe && !inEn) funde.katalog.push(`tr('${k}') beim Rendern gefragt, steht nur im DE-Katalog — die EN-Seite zeigt den Rohwert`);
  else if (inEn && !inDe) funde.katalog.push(`tr('${k}') beim Rendern gefragt, steht nur im EN-Katalog — die DE-Seite zeigt den Rohwert`);
  else if (!inDe && !inEn) ohneLabel.push(k);
}

/* ---------- 5, Crafting-Rechner: woertliche Schluessel im Skript ---------- */
// Dieselbe Regel fuer assets/crafting-app.js gegen window.__CRAFT.t der
// ausgelieferten Seiten. Anlass 11.11.2026: tr('category', 'Kategorie') und
// tr('calcLocation', 'Kaufort') standen in keinem der beiden Kataloge, die
// Ergebniskarten des Zerlege-Rechners zeigten auf der englischen Seite
// „Kategorie: … · Kaufort: …“. Regel 2 in Teil 2 sah es nicht: die Karten
// entstehen erst, wenn ein Material angekreuzt ist UND die Rezept-DB
// geladen hat, und keines der beiden Woerter traegt einen Umlaut.
const craftWoertlich = [];
if (!existsSync(CRAFT_JS)) fehler.push(`${CRAFT_JS.slice(ROOT.length + 1)} fehlt — der Crafting-Rechner ist nicht im Bau`);
else {
  const quelle = readFileSync(CRAFT_JS, 'utf8');
  craftWoertlich.push(...new Set([...quelle.matchAll(/\btr\(\s*'([A-Za-z][\w.]*)'\s*,/g)].map((m) => m[1])));
  for (const [lang, seite] of Object.entries(CRAFT_SEITEN)) {
    const datei = join(DIST, seite);
    if (!existsSync(datei)) { fehler.push(`${seite} fehlt — der Katalog des Crafting-Rechners (${lang}) ist nicht pruefbar`); continue; }
    const m = /<script[^>]*>(window\.__CRAFT\s*=[\s\S]*?)<\/script>/.exec(readFileSync(datei, 'utf8'));
    if (!m) { fehler.push(`${seite}: kein window.__CRAFT-Block`); continue; }
    const ctx = { window: {} };
    vm.runInNewContext(m[1], ctx);
    const katalog = new Set(Object.keys(ctx.window.__CRAFT?.t ?? {}));
    for (const k of craftWoertlich) {
      if (!katalog.has(k)) funde.katalog.push(`Crafting ${lang}: tr('${k}') steht nicht im ausgelieferten Katalog — die Seite zeigt den Rueckfalltext des Skripts`);
    }
  }
}
const ms1 = Date.now() - t1;

/* ================================================================
   TEIL 2 — jede Seitenart, bedient
   ================================================================ */
const t2 = Date.now();
const arten = seitenArten(DIST, { ohne: OHNE_SEITEN });
const stichprobe = arten.map((a) => a.seite);
for (const w of Object.keys(WERKZEUGE)) if (!stichprobe.includes(w) && existsSync(join(DIST, w))) stichprobe.push(w);
const bilanz = [];
for (const seite of stichprobe) {
  const tS = Date.now();
  let p;
  try {
    p = await oeffneSeite({ dist: DIST, seite, esbuild, buendel });
  } catch (err) {
    funde.abbruch.push(`${seite}: Seite laesst sich nicht laden — ${err && err.message}`);
    continue;
  }
  const gesehen = new Set();
  let texte = 0;
  const pruefe = (els, info) => {
    for (const el of els) {
      for (const { t: roh, lang, attr } of texteAus(el, p.seitenLang)) {
        const t = norm(roh);
        const key = lang + '|' + t;
        if (p.statisch.has(key) || gesehen.has(key)) continue;
        gesehen.add(key);
        texte++;
        pruefeText(t, lang, `/${seite} [${info.art}${attr ? ' @' + attr : ''}]`);
      }
    }
  };
  await p.settle(5000);
  pruefe(p.ernte(), { art: 'beim Laden' });
  const z = await erkunde(p, { beiErnte: pruefe });
  for (const f of new Set(p.fehler)) funde.abbruch.push(`/${seite}: ${f.slice(0, 300)}`);
  bilanz.push({ seite, texte, arten: z.arten, aktionen: z.aktionen, abgebrochen: z.abgebrochen, ms: Date.now() - tS });
  p.schliesse();
}
const ms2 = Date.now() - t2;

/* ================================================================
   Bilanz
   ================================================================ */
const de = (n) => n.toLocaleString('de-DE');
console.log(`verify:clienttext — ${DIST.slice(ROOT.length + 1) || DIST}`);
console.log(`\nTeil 1, Items-Seite aus ${JS.slice(ROOT.length + 1) || JS} (${de(Math.round(ms1 / 1000))} s)`);
for (const [lang, z] of Object.entries(zaehlung)) {
  console.log(`${lang}: ${de(z.items)} Items (Klinke ${de(MIN_ITEMS)}), ${de(z.modals)} Blaetter, davon ${de(z.mitCraft)} mit Crafting (Klinke ${de(MIN_MODAL_CRAFT)}), ${z.sets} Sets (Klinke ${MIN_SETS})`);
  if (z.items < MIN_ITEMS) fehler.push(`${lang}: nur ${z.items} Items gerendert (Klinke ${MIN_ITEMS})`);
  if (z.modals < z.items) fehler.push(`${lang}: nur ${z.modals} von ${z.items} Blaettern gerendert`);
  if (z.mitCraft < MIN_MODAL_CRAFT) fehler.push(`${lang}: nur ${z.mitCraft} Blaetter mit Crafting-Abschnitt (Klinke ${MIN_MODAL_CRAFT}) — laedt die Rezept-DB noch?`);
  if (z.sets < MIN_SETS) fehler.push(`${lang}: nur ${z.sets} Sets (Klinke ${MIN_SETS})`);
}
for (const lang of Object.keys(SEITEN)) if (!zaehlung[lang]) fehler.push(`${lang}: nichts gerendert`);
console.log(`Textstellen: ${de(stellen)} (Klinke ${de(MIN_STELLEN)}), woertliche Schluessel im Skript: ${woertlich.length} (Klinke ${MIN_SCHLUESSEL})`);
if (stellen < MIN_STELLEN) fehler.push(`nur ${stellen} Textstellen geprueft (Klinke ${MIN_STELLEN})`);
console.log(`beim Rendern gefragte Schluessel: ${laufzeit.size} (Klinke ${MIN_LAUFZEIT}), davon ohne Label in beiden Katalogen: ${ohneLabel.length}`);
if (laufzeit.size < MIN_LAUFZEIT) fehler.push(`nur ${laufzeit.size} Schluessel beim Rendern gefragt (Klinke ${MIN_LAUFZEIT}) — greift die Pruefnaht an tr() noch?`);
if (woertlich.length < MIN_SCHLUESSEL) fehler.push(`nur ${woertlich.length} woertliche Schluessel gefunden (Klinke ${MIN_SCHLUESSEL}) — hat sich die Form tr('…', …) geaendert?`);
console.log(`Textsatz der Werkbank: ${woertlichW.length} woertliche w()-Schluessel im Skript (Klinke ${MIN_SCHLUESSEL_W}), beim Rendern gefragt: ${new Set([...(gefragtW.de ?? []), ...(gefragtW.en ?? [])]).size}`);
if (woertlichW.length < MIN_SCHLUESSEL_W) fehler.push(`nur ${woertlichW.length} woertliche w()-Schluessel gefunden (Klinke ${MIN_SCHLUESSEL_W}) — hat sich die Form w('…') geaendert?`);
console.log(`Crafting-Rechner: ${craftWoertlich.length} woertliche Schluessel im Skript (Klinke ${MIN_SCHLUESSEL_CRAFT}), gegen den Katalog beider Sprachen`);
if (craftWoertlich.length < MIN_SCHLUESSEL_CRAFT) fehler.push(`Crafting-Rechner: nur ${craftWoertlich.length} woertliche Schluessel gefunden (Klinke ${MIN_SCHLUESSEL_CRAFT}) — hat sich die Form tr('…', …) geaendert?`);

const summeT = bilanz.reduce((s, b) => s + b.texte, 0);
const summeA = bilanz.reduce((s, b) => s + b.aktionen, 0);
console.log(`\nTeil 2, jede Seitenart bedient (${de(Math.round(ms2 / 1000))} s): ${arten.length} Seitenarten aus ${de(arten.reduce((s, a) => s + a.anzahl, 0))} Seiten (Klinke ${MIN_SEITENARTEN}), ${de(summeA)} Bedienschritte (Klinke ${de(MIN_AKTIONEN)}), ${de(summeT)} geschriebene Texte (Klinke ${de(MIN_TEXTE)})`);
console.log(`ausgelassen: ${OHNE_SEITEN.map((o) => `${o.pfad} (${o.anlass})`).join('; ')}; Skripte ${SKRIPT_AUSGELASSEN.map((a) => `${a.pfad} (${a.anlass})`).join('; ')}`);
for (const b of [...bilanz].sort((a, c) => c.texte - a.texte)) {
  const min = WERKZEUGE[b.seite];
  console.log(`  ${('/' + b.seite).padEnd(46)} ${String(b.texte).padStart(6)} Texte${min ? ` (Klinke ${min})` : ''}, ${String(b.aktionen).padStart(5)} Schritte, ${String(b.arten).padStart(3)} Arten, ${String(b.ms).padStart(6)} ms${b.abgebrochen ? ', ZEITBUDGET erreicht' : ''}`);
  if (min && b.texte < min) fehler.push(`/${b.seite}: nur ${b.texte} geschriebene Texte (Klinke ${min}) — erreicht der Pruefstand das Werkzeug noch?`);
}
for (const w of Object.keys(WERKZEUGE)) if (!bilanz.some((b) => b.seite === w)) fehler.push(`Werkzeug /${w} nicht geladen — Seite umbenannt? Dann WERKZEUGE nachziehen.`);
if (arten.length < MIN_SEITENARTEN) fehler.push(`nur ${arten.length} Seitenarten (Klinke ${MIN_SEITENARTEN})`);
if (summeA < MIN_AKTIONEN) fehler.push(`nur ${summeA} Bedienschritte (Klinke ${MIN_AKTIONEN})`);
if (summeT < MIN_TEXTE) fehler.push(`nur ${summeT} geschriebene Texte (Klinke ${MIN_TEXTE})`);

const zeige = (liste, titel, cap = ALLE ? Infinity : 12) => {
  if (!liste.length) return;
  const zaehl = new Map();
  for (const f of liste) zaehl.set(f, (zaehl.get(f) || 0) + 1);
  console.log(`\n== FEHLER ${titel}: ${liste.length} Stelle(n) ==`);
  for (const [f, n] of [...zaehl].slice(0, cap)) console.log(`   ${f}${n > 1 ? `   (${n}×)` : ''}`);
  if (zaehl.size > cap) console.log(`   … +${zaehl.size - cap} weitere`);
};
for (const [regel, titel] of Object.entries(REGEL_TITEL)) zeige(funde[regel], titel);
zeige(funde.katalog, 'Schluessel fehlt im ausgelieferten Katalog (Items-Seite, Crafting-Rechner)');
zeige(funde.abbruch, 'Skript bricht im Pruefstand ab (Seite oder Pruefstand reparieren)');
if (ohneLabel.length) {
  console.log(`\n== WARNUNG Schluessel ohne Label in beiden Katalogen: ${ohneLabel.length} — die Seite zeigt den Rohwert der Spieldaten ==`);
  for (const k of ohneLabel.slice(0, 12)) console.log(`   ${k}`);
}
for (const f of fehler) console.log(`\n== FEHLER ${f} ==`);

const summe = Object.values(funde).reduce((s, l) => s + l.length, 0) + fehler.length;
if (summe) {
  console.log(`\nverify:clienttext ROT — ${summe} Befund(e).`);
  process.exit(1);
}
console.log('\nverify:clienttext gruen — jede Kachel, jedes Blatt und jedes Set der Items-Seite und jeder Text, den die Seitenarten beim Laden und Bedienen schreiben, ohne Rohtext und in der Sprache der Seite.');
