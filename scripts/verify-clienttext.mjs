// verify-clienttext.mjs — der Text, den die Werkzeuge erst im Browser bauen.
//
// WARUM ES DEN GIBT: audit:site und verify:sprache lesen das statische HTML.
// Der Item Finder baut seine Karten und sein Detail-Modal aber erst im
// Browser aus assets/universal-items.json zusammen — diesen Text hat bis zum
// 04.11.2026 KEIN Tor gelesen. So stand der Schildwiderstand im Finder-Modal
// als "Physisch NaN% · Distortion NaN%" da (behoben am 03.11.2026 in
// assets/item-finder-app.js, fmtResist), und nichts haette verhindert, dass
// derselbe Fehler morgen zurueckkommt: die Pruefung, die ihn auf den
// statischen Seiten faengt, sieht das Modal nie.
//
// WAS ES TUT (Schiene A, ohne Browser): fuehrt das AUSGELIEFERTE Skript
// dist/assets/item-finder-app.js in node:vm gegen ein schmales DOM aus, mit
// der ausgelieferten Konfiguration (window.__UIF aus dist/item-finder.html
// und dist/de/item-finder.html) und den ausgelieferten Daten. Eine Pruefnaht
// wird NUR in die geladene Kopie eingesetzt (vor dem letzten "})();"), nicht
// in die Datei. Dann rendert es je Sprache JEDES Item als Karte und als
// Modal (mit Crafting-Abschnitt) und jedes Set, und prueft den Text nach den
// Regeln aus scripts/lib/textregeln.mjs:
//   1  Rohtext (NaN, undefined, Infinity, [object, null neben Zeichen,
//      {Platzhalter}, %schluessel%, ReputationStanding_) und "-1" als Wert,
//   2  mehrwortiger Katalogtext der anderen Sprache; auf EN zusaetzlich kein
//      deutsches Funktionswort (Rueckfalltexte des Skripts sind deutsch),
//   3  Zahl im Format der anderen Sprache,
//   4  Katalogschluessel statt Text,
//   5  jeder woertliche tr('schluessel', …) im Skript steht im
//      ausgelieferten Katalog BEIDER Sprachen — sonst zeigt die EN-Seite den
//      deutschen Rueckfalltext des Skripts.
// Selbstauskunft und Klinken fuer Items, Modals mit Crafting, Sets,
// Textstellen und Schluessel.
//
// Kein git, kein Netz, kein Kindprozess.
//
//   node scripts/verify-clienttext.mjs [--dist <ordner>] [--js <item-finder-app.js>]
//   (--js prueft eine andere Fassung des Skripts gegen denselben Bau — so
//   wird die Gegenprobe gegen den Stand vor dem Fix gefahren.)
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import {
  ROHTEXT_RE, PLATZHALTERWERT_RE, ZAHL_EN_AUF_DE_RE, ZAHL_DE_AUF_EN_RE, DE_FUNKTIONSWORT_RE,
  ladeKataloge, sprachMengen, textStellen, norm, rohschluesselRe, findeRohschluessel,
} from './lib/textregeln.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? resolve(argv[i + 1]) : null; };
const DIST = opt('--dist') || resolve(ROOT, 'dist');
const JS = opt('--js') || join(DIST, 'assets', 'item-finder-app.js');
if (!existsSync(DIST)) { console.error(`${DIST} fehlt — erst npm run build.`); process.exit(2); }

// Klinken (Grundsatz 5), gemessen am 04.11.2026: 9.412 Items, 136 Sets,
// 1.594 Modals mit Crafting-Abschnitt je Sprache, 141 Sets, 823.745
// Textstellen ueber beide Sprachen, 92 woertliche Schluessel im Skript.
const MIN_ITEMS = 9_000;
const MIN_SETS = 120;
const MIN_MODAL_CRAFT = 1_400;
const MIN_STELLEN = 800_000;
const MIN_SCHLUESSEL = 80;

const fehler = [];
const funde = { roh: [], wert: [], sprache: [], funktion: [], zahl: [], schluessel: [], katalog: [] };

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

/* ---------- Ausgeliefertes lesen ---------- */
const QUELLE = readFileSync(JS, 'utf8');
const ANKER = QUELLE.lastIndexOf('})();');
if (ANKER < 0 || QUELLE.slice(ANKER + 5).trim() !== '') {
  console.error(`FEHLER: ${JS} endet nicht mit "})();" — die Pruefnaht findet ihren Platz nicht. Das Skript wurde umgebaut; die Naht hier anpassen.`);
  process.exit(1);
}
const NAHT = `
  window.__pruefnaht = {
    laden: function () { return loadCraft(); },
    items: function () { return ALL_ITEMS; },
    sets: function () { return Object.keys(SETS).length; },
    modal: function (it) {
      openModal(it);
      return document.getElementById('uif-modal-body-content').innerHTML;
    },
    karten: function () {
      filteredItems = ALL_ITEMS.slice(); currentPage = 1; itemsPerPage = ALL_ITEMS.length + 1;
      renderItemsGrid();
      return document.getElementById('uif-results-grid').innerHTML;
    },
    setkarten: function () {
      filteredSets = Object.keys(SETS).map(function (k) { return SETS[k]; }); currentPage = 1; itemsPerPage = filteredSets.length + 1;
      renderSetsGrid();
      return document.getElementById('uif-results-grid').innerHTML;
    }
  };
`;
const CODE = QUELLE.slice(0, ANKER) + NAHT + QUELLE.slice(ANKER);

/** Die Konfiguration, wie die gebaute Seite sie setzt (Inline-Skript ausgefuehrt). */
function konfiguration(seite) {
  const html = readFileSync(join(DIST, seite), 'utf8');
  const m = /<script[^>]*>(window\.__UIF=[\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error(`${seite}: kein window.__UIF-Block`);
  const ctx = { window: {} };
  vm.runInNewContext(m[1], ctx);
  return ctx.window.__UIF;
}
const ausDist = (url) => join(DIST, String(url).split('?')[0]);

/* ---------- Schmales DOM ---------- */
function element() {
  const el = {
    innerHTML: '', textContent: '', value: '', hidden: false, style: {}, dataset: {}, children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute() {}, getAttribute: () => null, removeAttribute() {}, addEventListener() {},
    querySelector: () => null, querySelectorAll: () => [], appendChild() {}, focus() {}, closest: () => null,
    contains: () => false, scrollIntoView() {}, scrollTo() {},
  };
  return el;
}
function umgebung(cfg, daten) {
  const els = new Map();
  const document = {
    readyState: 'complete',
    getElementById: (id) => { if (!els.has(id)) els.set(id, element()); return els.get(id); },
    createElement: () => element(),
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {},
    body: element(), documentElement: element(),
  };
  const fetch = (url) => {
    const pfad = ausDist(url);
    if (!daten.has(pfad)) {
      if (!existsSync(pfad)) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) });
      daten.set(pfad, JSON.parse(readFileSync(pfad, 'utf8')));
    }
    // Jede Umgebung bekommt eine eigene Kopie: das Skript haengt Felder an
    // (bp.__slug), die zweite Sprache soll denselben Ausgangsstand sehen.
    const kopie = structuredClone(daten.get(pfad));
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(kopie) });
  };
  const window = { __UIF: cfg };
  const ctx = {
    window, document, fetch, console: { log() {}, warn() {}, error() {} },
    location: { search: '', pathname: '/', hash: '' }, URLSearchParams, setTimeout, clearTimeout,
    navigator: { language: cfg.lang }, Promise, Intl, Number, String, Math, Object, Array, JSON, Set, Map,
  };
  window.document = document; window.location = ctx.location;
  return vm.createContext(ctx);
}
const ruhe = () => new Promise((r) => setTimeout(r, 0));

/* ---------- Pruefen ---------- */
let stellen = 0;
const zaehlung = {};
function pruefe(html, lang, wo) {
  const fremd = lang === 'de' ? M.mehrwortNurEn : M.mehrwortNurDe;
  const zahlRe = lang === 'de' ? ZAHL_EN_AUF_DE_RE : ZAHL_DE_AUF_EN_RE;
  for (const roh of textStellen(html)) {
    stellen++;
    const t = norm(roh);
    const r = ROHTEXT_RE.exec(t);
    if (r) funde.roh.push(`${lang} ${wo}: „${r[0]}" in „${t.slice(Math.max(0, r.index - 40), r.index + r[0].length + 30)}"`);
    if (PLATZHALTERWERT_RE.test(t)) funde.wert.push(`${lang} ${wo}: „-1" als Wert`);
    if (fremd.has(t)) funde.sprache.push(`${lang} ${wo}: „${t}"`);
    else if (lang === 'en') {
      const fw = DE_FUNKTIONSWORT_RE.exec(t);
      if (fw) funde.funktion.push(`${lang} ${wo}: „${fw[0]}" in „${t.slice(0, 100)}"`);
    }
    const z = zahlRe.exec(t);
    if (z) funde.zahl.push(`${lang} ${wo}: „${z[0]}" in „${t.slice(0, 80)}"`);
    const k = findeRohschluessel(t, ROHSCHLUESSEL_RE);
    if (k) funde.schluessel.push(`${lang} ${wo}: „${k[0]}"`);
  }
}

const daten = new Map();
const SEITEN = { en: 'item-finder.html', de: 'de/item-finder.html' };
const katalogSchluessel = {};
for (const [lang, seite] of Object.entries(SEITEN)) {
  const cfg = konfiguration(seite);
  katalogSchluessel[lang] = new Set(Object.keys(cfg.t || {}));
  const ctx = umgebung(cfg, daten);
  try {
    vm.runInContext(CODE, ctx, { filename: JS });
  } catch (err) {
    fehler.push(`${lang}: das Skript bricht beim Start ab — ${err.message}`);
    continue;
  }
  for (let i = 0; i < 5; i++) await ruhe();
  const naht = ctx.window.__pruefnaht;
  if (!naht) { fehler.push(`${lang}: Pruefnaht nicht erreichbar`); continue; }
  await naht.laden();
  for (let i = 0; i < 5; i++) await ruhe();
  const items = naht.items();
  const z = (zaehlung[lang] = { items: items.length, modals: 0, mitCraft: 0, sets: naht.sets() });
  for (const it of items) {
    let html;
    try { html = naht.modal(it); } catch (err) { fehler.push(`${lang}: Modal von „${it.name}" bricht ab — ${err.message}`); continue; }
    z.modals++;
    if (html.includes('uif-crafting')) z.mitCraft++;
    pruefe(html, lang, `Modal „${it.name}"`);
  }
  try { pruefe(naht.karten(), lang, 'Karten'); } catch (err) { fehler.push(`${lang}: Kartenraster bricht ab — ${err.message}`); }
  try { pruefe(naht.setkarten(), lang, 'Set-Karten'); } catch (err) { fehler.push(`${lang}: Set-Raster bricht ab — ${err.message}`); }
}

/* ---------- 5: woertliche Schluessel im Skript ---------- */
const woertlich = [...new Set([...QUELLE.matchAll(/\btr\(\s*'([A-Za-z][\w.]*)'\s*,/g)].map((m) => m[1]))];
for (const k of woertlich) for (const lang of Object.keys(SEITEN)) {
  if (!katalogSchluessel[lang]?.has(k)) funde.katalog.push(`${lang}: tr('${k}') steht nicht im ausgelieferten Katalog — die Seite zeigt den Rueckfalltext des Skripts`);
}

/* ---------- Bilanz ---------- */
console.log(`verify:clienttext — Item Finder aus ${JS.slice(ROOT.length + 1) || JS}`);
for (const [lang, z] of Object.entries(zaehlung)) {
  console.log(`${lang}: ${z.items.toLocaleString('de-DE')} Items (Klinke ${MIN_ITEMS.toLocaleString('de-DE')}), ${z.modals.toLocaleString('de-DE')} Modals, davon ${z.mitCraft.toLocaleString('de-DE')} mit Crafting (Klinke ${MIN_MODAL_CRAFT.toLocaleString('de-DE')}), ${z.sets} Sets (Klinke ${MIN_SETS})`);
  if (z.items < MIN_ITEMS) fehler.push(`${lang}: nur ${z.items} Items gerendert (Klinke ${MIN_ITEMS})`);
  if (z.modals < z.items) fehler.push(`${lang}: nur ${z.modals} von ${z.items} Modals gerendert`);
  if (z.mitCraft < MIN_MODAL_CRAFT) fehler.push(`${lang}: nur ${z.mitCraft} Modals mit Crafting-Abschnitt (Klinke ${MIN_MODAL_CRAFT}) — laedt die Rezept-DB noch?`);
  if (z.sets < MIN_SETS) fehler.push(`${lang}: nur ${z.sets} Sets (Klinke ${MIN_SETS})`);
}
for (const lang of Object.keys(SEITEN)) if (!zaehlung[lang]) fehler.push(`${lang}: nichts gerendert`);
console.log(`Textstellen: ${stellen.toLocaleString('de-DE')} (Klinke ${MIN_STELLEN.toLocaleString('de-DE')}), woertliche Schluessel im Skript: ${woertlich.length} (Klinke ${MIN_SCHLUESSEL})`);
if (stellen < MIN_STELLEN) fehler.push(`nur ${stellen} Textstellen geprueft (Klinke ${MIN_STELLEN})`);
if (woertlich.length < MIN_SCHLUESSEL) fehler.push(`nur ${woertlich.length} woertliche Schluessel gefunden (Klinke ${MIN_SCHLUESSEL}) — hat sich die Form tr('…', …) geaendert?`);

const zeige = (liste, titel, cap = 12) => {
  if (!liste.length) return;
  const zaehl = new Map();
  for (const f of liste) zaehl.set(f, (zaehl.get(f) || 0) + 1);
  console.log(`\n== FEHLER ${titel}: ${liste.length} Stelle(n) ==`);
  for (const [f, n] of [...zaehl].slice(0, cap)) console.log(`   ${f}${n > 1 ? `   (${n}×)` : ''}`);
  if (zaehl.size > cap) console.log(`   … +${zaehl.size - cap} weitere`);
};
zeige(funde.roh, '1 Rohtext im gerenderten Text');
zeige(funde.wert, '1 Platzhalterwert -1');
zeige(funde.sprache, '2 Katalogtext der anderen Sprache');
zeige(funde.funktion, '2 deutsches Funktionswort im EN-Text (Rueckfalltext des Skripts?)');
zeige(funde.zahl, '3 Zahl im Format der anderen Sprache');
zeige(funde.schluessel, '4 Katalogschluessel statt Text');
zeige(funde.katalog, '5 Schluessel fehlt im ausgelieferten Katalog');
for (const f of fehler) console.log(`\n== FEHLER ${f} ==`);

const summe = Object.values(funde).reduce((s, l) => s + l.length, 0) + fehler.length;
if (summe) {
  console.log(`\nverify:clienttext ROT — ${summe} Befund(e).`);
  process.exit(1);
}
console.log('\nverify:clienttext gruen — jede Karte, jedes Modal und jedes Set des Item Finders ohne Rohtext, in der Sprache der Seite.');
