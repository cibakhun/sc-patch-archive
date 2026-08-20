/* ============================================================
   verify-shipconsole.mjs — Konsolen-Tor fuer die Schiffs-Detailseite
   (Phase 16, D-01/D-02/P-1/P-2/P-3, 16-UI-SPEC.md).

   Pruefverfahren gegen den GEBAUTEN Stand von dist/schiffe/*.html und
   dist/de/schiffe/*.html — Vorbild scripts/verify-shipcard.mjs (Hausform:
   Abbruch bei fehlendem dist/, je Zusicherung eine nummerierte
   Ueberschrift mit Soll-/Ist-Zeile, fail()-Sammelurteil, --report-Modus,
   Tag-Abtastung ohne HTML-Bibliothek, Depth-Zaehlung fuer Regionsgrenzen).
   KEINE HTML-Bibliothek, kein git, kein Netz, kein Kindprozess, keine
   Data.p4k — schienenfaehig fuer Schiene A (Grundsatz 4).

   Einige Grundwerkzeuge (stripCommentsAndScripts, scanElements,
   visibleText, extractRegion) sind HIER DUPLIZIERT aus
   scripts/verify-shipcard.mjs statt importiert — dieselbe Entscheidung
   und derselbe Vorbehalt wie in scripts/probes/schiffskonsole-messung.mjs
   Kopfkommentar: verify-shipcard.mjs bricht beim Import sofort mit
   process.exit(1) ab, wenn dist/ fehlt, und dieser Task darf nur die drei
   in 16-02-PLAN.md Task 1 genannten Dateien beruehren. Aendern sich die
   Grundwerkzeuge dort, muss diese Kopie von Hand nachgezogen werden — an
   dieser Stelle vermerkt.

   WARUM ES DEN GIBT: D-02 (16-CONTEXT.md) ist die Bedingung, unter der
   D-01 ueberhaupt sicher ist — die Konsole darf die vier Kapitel nur
   ersetzen, solange jede Auslesung im ausgelieferten HTML steht. Bei rund
   17.000 indexierbaren Seiten und einem Zulauf, der praktisch vollstaendig
   aus Suche kommt (30 Tage: Bing 67 / DDG 38 / ChatGPT 10 / Google 7,
   siehe traffic-source-bing-not-google), ist eine im Quelltext leere
   Schiffsseite kein Schoenheitsfehler, sondern der Verlust des Zulaufs.
   Dieses Skript ist die Abnahme dafuer — es prueft den ZIELZUSTAND der
   Wellen 3/4 (eine Konsole mit Rail, Systemabschnitten und Auslesung, ohne
   JavaScript als lesbare Liste) und ist deshalb bis zu deren Abschluss
   zwangslaeufig ROT gegen den heutigen Stand. Der Registry-Eintrag steht
   deshalb vorerst auf `disabled` (scripts/lib/gate-registry.mjs) —
   scharfgeschaltet in 16-05-PLAN.md, Praezedenz verify:shipcard
   (14-01 -> 14-04: erst beheben, dann scharf).

   Gegen WELCHES Artefakt: dist/schiffe/*.html + dist/de/schiffe/*.html,
   der GEBAUTE Stand (Grundsatz 7) — nicht ShipDetail.astro.

   ACHT ZUSICHERUNGEN, jede mit einer Soll-/Ist-Zeile:

     1  Bestand und Selbstauskunft. Gelesene Schiffsseiten je Sprache und
        in Summe; Sperrklinke bei < 440.
     2  Konsolen-Geruest. Je Seite mindestens ein .holo__sys INNERHALB von
        section.holo (Tiefenzaehlung), mit einer id aus {sys-core,
        sys-arms, sys-prop, sys-other}, keine doppelt. Verteilung der
        Systemzahl je Seite gegen die in Welle 1 gemessene Rail-Verteilung
        gehalten (WELLE1_RAIL_VERTEILUNG unten).
     3  Bijektion Rail <-> System. Jeder Anker in .holo__rail zeigt auf
        eine vorhandene sys-*-id derselben Seite; jede vorhandene sys-*-id
        hat genau einen Rail-Anker.
     4  Kein Eintrag ohne Marker (P-3). Der Zaehl-Chip (.holo__rail-ct)
        jedes Rail-Eintrags == Zahl der Ports dieser Gruppe im
        #holodata-Block derselben Seite, und > 0.
     5  Ohne JavaScript sichtbar (D-02). Kein .holo__sys traegt `hidden`;
        kein .holo__sys liegt in einem <template>; Rail-Eintraege sind
        echte <a href="#sys-...">-Anker; der sichtbare Text INNERHALB
        jedes Systemabschnitts ist nicht leer.
     6  Textbestand (Erfolgskriterium 3). Sperrklinke in Hausform gegen
        den GANZEN sichtbaren Dokumenttext je Seite (visibleText(), wie
        scripts/probes/schiffskonsole-messung.mjs Messgruppe c).
     7  Sprachparitaet. Je EN/DE-Paar: Zahl der Systemabschnitte,
        Rail-Eintraege und Marker je Gruppe stimmen ueberein.
     8  Zombie-Waechter. Jede Ausnahme aus shipconsole-exclusions.mjs (falls
        vorhanden) muss in DIESEM Durchgang mindestens einmal gegriffen
        haben; ohne Ausnahmeliste druckt diese Zusicherung "keine
        Ausnahmen" und bleibt bestehen.

   BERICHTSMODUS (--report): dasselbe Verfahren, druckt alle Befunde,
   faellt aber KEIN Urteil und gibt IMMER 0 zurueck (wie verify-shipcard.mjs
   --report). Anlass woertlich aus verify-shipcard.mjs uebernommen: am
   16.08.2026 steckten in diesem Projekt zwei Fehler im Pruefer selbst —
   ein neues Tor faehrt zuerst als reiner Bericht.

     node scripts/verify-shipconsole.mjs             Tor: Exit 1 bei jedem
                                                       unerklaerten Befund.
     node scripts/verify-shipconsole.mjs --report     Erstbefund, immer Exit 0.
   ============================================================ */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findPagePairs, assertMinimumPairs } from './lib/page-pairs.mjs';

let EXCLUSIONS = [];
try {
  ({ EXCLUSIONS } = await import('./lib/shipconsole-exclusions.mjs'));
} catch {
  // Keine Ausnahmeliste vorhanden — das ist der erwartete Zustand beim
  // Anlegen dieses Tors (16-02-PLAN.md): eine Liste entsteht NUR, wenn ein
  // Berichtslauf sie erzwingt, nie auf Verdacht (sonst reisst der
  // Zombie-Waechter sofort). EXCLUSIONS bleibt [].
}

const REPORT_MODE = process.argv.includes('--report');
const MIN_PAGES = 440;
const MIN_PAIRS = 200;
const SYS_IDS = ['sys-core', 'sys-arms', 'sys-prop', 'sys-other'];
const GROUP_FOR_SYS_ID = { 'sys-core': 'core', 'sys-arms': 'arms', 'sys-prop': 'prop', 'sys-other': 'other' };
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/* Sperrklinke in Hausform (docs/maschinelle-validierung.md Grundsatz 5):
   Wert, Regel — wandert nur nach oben —, Anlass mit Messlauf, Datum,
   Artefakt und Ist-Wert, plus bezifferte, begruendete Reserve. Dieselbe
   Mechanik wie scripts/lib/metrics-baseline.mjs (regel 'min' +
   toleranzProzent), hier auf den Textbestand einer Schiffsseite
   angewendet statt auf eine Bestandszahl. */
const TEXTBESTAND_KLINKE = {
  wert: 3224,
  regel: 'min', // wandert nur nach oben
  toleranzProzent: 2,
  anlass:
    'Messlauf 20.08.2026 (16-05-PLAN.md Task 1, Scharfschaltung) gegen den nach Welle 4+Kollisionsfix ' +
    'gebauten dist/ dieses Worktrees (Commit ae2f1f2, frisch gebaut fuer diesen Lauf: npm run build, dann ' +
    'node scripts/verify-shipconsole.mjs --report) — Minimum ueber alle 454 Schiffsseiten jetzt 3.224 Bytes ' +
    '(dist/schiffe/argo-atls-geo-collector-grad01.html), Median 4.777, Maximum 5.536 ' +
    '(dist/de/schiffe/drak-cutlass-black.html). Ausgangswert aus Welle 1/2 (16-02-PLAN.md Task 1, Messlauf ' +
    '20.08.2026 gegen den nach Welle 1 gebauten Stand, Commit bfdffe8): 3.177 Bytes — Differenz +47 Bytes, die ' +
    'Klinke wandert damit nach OBEN, wie Grundsatz 5 verlangt (Bewaffnung/Komponenten sind seit Welle 3/4 aus dem ' +
    'Ausstattungs-Kapitel in die Konsole umgezogen und tragen dort dieselbe Aussage plus die neu ausgeschriebenen ' +
    'prop/other-Stueckzahllisten, siehe 16-UI-SPEC.md Punkt 12). Reserve weiterhin 2% (effektive Untergrenze ' +
    '~3.160 Bytes) gegen Rundungsschwankungen zwischen zwei Laeufen desselben Standes — u. a. traegt jede Seite ' +
    'ein Datum (t(\'ship.asof\') + pricesFetchedAt) und eine variable Zahl an Shopzeilen, die sich mit jedem ' +
    'Preislauf leicht verschieben koennen, ohne dass das etwas mit dieser Phase zu tun hat. Praezedenz: die ' +
    'Hoehenklinke aus 14-04-PLAN.md blieb 21px ueber dem gemessenen Ist-Wert stehen (docs/maschinelle-validierung.md ' +
    'Grundsatz 5: eine Klinke ist eine Untergrenze fuer KUENFTIGE Laeufe, kein exakter Momentwert des heutigen) — ' +
    'hier ein Prozentsatz statt eines festen Byte-Versatzes, weil dieselbe Mechanik (regel "min" + toleranzProzent) ' +
    'bereits in scripts/lib/metrics-baseline.mjs fuer genau diesen Zweck existiert.',
};

/* Rail-Laengen-Verteilung je Sprache (EN und DE identisch, da Ports
   sprachunabhaengig sind — belegt durch die a-sprachparitaet-gruppenzahl-
   Messung derselben Sonde: 227 gleich, 0 ungleich). Gemessen 20.08.2026
   gegen denselben Stand wie TEXTBESTAND_KLINKE, node
   scripts/probes/schiffskonsole-messung.mjs --census, Zeile
   "Rail-Laengen-Verteilung (ausgeliefert, Ist-Zustand)". P-3 (Variante C)
   ist seit Welle 1 (7bb10df) entschieden und fest — diese Verteilung
   aendert sich nicht mehr durch spaetere Wellen, nur durch eine neue
   P-3-Entscheidung. */
const WELLE1_RAIL_VERTEILUNG = { 1: 6, 2: 22, 3: 20, 4: 179 };

if (!existsSync('dist')) {
  console.error(
    'verify-shipconsole: dist/ fehlt. Erst `npm run build`, dann `npm run verify:shipconsole` — ' +
      'dieses Skript prueft den GEBAUTEN Stand, nicht die Quelle.'
  );
  process.exit(1);
}

function walk(dir, ext, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name).replace(/\\/g, '/');
    if (e.isDirectory()) walk(p, ext, out);
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

let ok = true;
const fail = (msg) => {
  ok = false;
  console.error(`  FEHLER: ${msg}`);
};

/* ---------- Grundwerkzeug, dupliziert aus verify-shipcard.mjs (siehe Kopfkommentar) ---------- */
function stripCommentsAndScripts(html) {
  let s = html.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, '$1$3');
  s = s.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, '$1$3');
  return s;
}

function scanElements(html) {
  const s = stripCommentsAndScripts(html);
  const out = [];
  const re = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^<>]*?)?)\/?>/g;
  let m;
  while ((m = re.exec(s))) {
    if (m[0].startsWith('</')) continue;
    const tag = m[1].toLowerCase();
    const attrs = m[2] || '';
    const classMatch = /\bclass\s*=\s*"([^"]*)"/i.exec(attrs) || /\bclass\s*=\s*'([^']*)'/i.exec(attrs);
    const classes = classMatch ? classMatch[1].trim().split(/\s+/).filter(Boolean) : [];
    const idMatch = /\bid\s*=\s*"([^"]*)"/i.exec(attrs) || /\bid\s*=\s*'([^']*)'/i.exec(attrs);
    const hrefMatch = /\bhref\s*=\s*"([^"]*)"/i.exec(attrs) || /\bhref\s*=\s*'([^']*)'/i.exec(attrs);
    // \bhidden\b statt Praefix-Suche: eine Klasse "hiddenish" o.ae. darf
    // nicht als Versteck-Attribut zaehlen (gibt es hier nicht, aber die
    // Unterscheidung ist derselbe Grundsatz wie beim class-Praefix unten).
    const hidden = /(^|\s)hidden(\s|=|\/|>|$)/i.test(attrs);
    out.push({ tag, classes, id: idMatch ? idMatch[1] : null, href: hrefMatch ? hrefMatch[1] : null, hidden });
  }
  return out;
}

/* extractRegion(): dieselbe Depth-Zaehlung wie in verify-shipcard.mjs,
   gibt die getroffene Region zurueck statt sie zu entfernen. Braucht
   bereits bereinigtes HTML. */
function extractRegion(cleanHtml, openPattern, tagName) {
  const m = openPattern.exec(cleanHtml);
  if (!m) return null;
  const start = m.index;
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<${escapedTag}\\b[^>]*>|</${escapedTag}\\s*>`, 'gi');
  re.lastIndex = start;
  let depth = 0;
  let end = -1;
  let mm;
  while ((mm = re.exec(cleanHtml))) {
    if (mm[0].startsWith('</')) {
      depth--;
      if (depth === 0) {
        end = mm.index + mm[0].length;
        break;
      }
    } else {
      depth++;
    }
  }
  if (end === -1) return null;
  return cleanHtml.slice(start, end);
}

/* extractRegionByClass(): wie extractRegion(), aber die Tagart ist NICHT
   vorab bekannt — sie wird aus dem Fund selbst gelesen. Genau EXAKTES
   class="X" (kein Klassenlisten-Wortabgleich): section.holo traegt heute
   und nach dieser Phase ausschliesslich diese eine Klasse (ShipDetail.astro
   Z. 1214, `class="holo"`), dieselbe Genauigkeitsstufe wie das bestehende
   `<div class="sd">` in verify-shipcard.mjs. GEGENPROBE gegen
   Ueberreichweite (16-UI-SPEC.md Punkt 11.3-Forderung "exakt am
   Klassenattribut, nicht per Praefix"): die Zeichenkette
   `class="holo__bar"` (Kennwerte-Leiste, ShipDetail.astro Z. 1397, ein
   SIBLING von section.holo, kein Kind) enthaelt NICHT die Teilzeichenkette
   `class="holo"` — das schliessende Anfuehrungszeichen muss unmittelbar
   auf "holo" folgen, bei "holo__bar" folgt stattdessen "_". Derselbe
   Beweis gilt fuer `class="holo__toggle"`/`class="holo__rail"`/etc. */
function extractRegionByClass(cleanHtml, exactClass) {
  const openRe = new RegExp(`<([a-zA-Z][a-zA-Z0-9-]*)\\b[^>]*\\bclass="${exactClass}"[^>]*>`);
  const m = openRe.exec(cleanHtml);
  if (!m) return null;
  const tagName = m[1].toLowerCase();
  return extractRegion(cleanHtml, new RegExp(`<${tagName}\\b[^>]*\\bclass="${exactClass}"[^>]*>`), tagName);
}

/* extractAllRegionsByClass(): wie extractRegionByClass(), aber ALLE
   Vorkommen im Dokument, mit Start-Offset (fuer die Tiefenpruefung "liegt
   INNERHALB section.holo" in Zusicherung 2) — Klassenlisten-Wortabgleich
   (jede Klasse, die exactClass als eigenes Wort traegt), damit ein
   Element mit ZUSAETZLICHEN Klassen (z. B. "holo__sys is-active") noch
   gefunden wird. */
function extractAllRegionsByClass(cleanHtml, className) {
  const out = [];
  const openRe = new RegExp(`<([a-zA-Z][a-zA-Z0-9-]*)\\b[^>]*\\bclass\\s*=\\s*"([^"]*)"[^>]*>`, 'g');
  let m;
  while ((m = openRe.exec(cleanHtml))) {
    const classes = m[2].trim().split(/\s+/).filter(Boolean);
    if (!classes.includes(className)) continue;
    const tagName = m[1].toLowerCase();
    const start = m.index;
    const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`<${escapedTag}\\b[^>]*>|</${escapedTag}\\s*>`, 'gi');
    re.lastIndex = start;
    let depth = 0;
    let end = -1;
    let mm;
    while ((mm = re.exec(cleanHtml))) {
      if (mm[0].startsWith('</')) {
        depth--;
        if (depth === 0) {
          end = mm.index + mm[0].length;
          break;
        }
      } else {
        depth++;
      }
    }
    if (end === -1) continue;
    const attrs = m[0];
    const idMatch = /\bid\s*=\s*"([^"]*)"/i.exec(attrs);
    const hidden = /(^|\s)hidden(\s|=|\/|>|$)/i.test(attrs);
    out.push({ tagName, start, end, html: cleanHtml.slice(start, end), id: idMatch ? idMatch[1] : null, hidden });
    openRe.lastIndex = end; // nicht in verschachtelte Fundstellen derselben Klasse hineinsuchen
  }
  return out;
}

function visibleText(regionHtml) {
  let s = regionHtml.replace(/<[^>]*>/g, ' ');
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&middot;/g, '·')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return s.replace(/\s+/g, ' ').trim();
}

function textBytesVon(html) {
  return Buffer.byteLength(visibleText(stripCommentsAndScripts(html)), 'utf8');
}

/* ---------- #holodata lesen (T-15-07: try/catch, Parserfehler ist FEHLER, kein stiller Uebersprung) ---------- */
function holodataAus(html, file) {
  const m = /<script[^>]*id="holodata"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!m) return { data: null, parseError: false };
  try {
    return { data: JSON.parse(m[1]), parseError: false };
  } catch {
    fail(`${file}: #holodata ist kein gueltiges JSON — Parserfehler statt stillem Uebersprung (T-15-07)`);
    return { data: null, parseError: true };
  }
}

/* ---------- Rail-Eintraege aus .holo__rail lesen: <a href="#sys-x">...</a>-
   Bloecke, mit optionalem Zaehl-Chip .holo__rail-ct als Kindelement.
   Anker duerfen KEINE eigene Klasse tragen (D-02, 16-UI-SPEC.md Punkt 6:
   "reine Anker-Liste", exakt das .sd__jump-Muster) — das href-Praefix
   #sys- ist deshalb das robustere Merkmal als ein Klassenname. ---------- */
function railEntriesAus(railHtml) {
  if (!railHtml) return [];
  const out = [];
  const re = /<a\b[^>]*\bhref="(#sys-[a-z]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(railHtml))) {
    const target = m[1].slice(1);
    const inner = m[2];
    const ctMatch = /class="[^"]*\bholo__rail-ct\b[^"]*"[^>]*>([^<]*)</.exec(inner);
    const count = ctMatch ? parseInt(ctMatch[1].replace(/[^\d]/g, ''), 10) : null;
    out.push({ target, count, html: m[0] });
  }
  return out;
}

/* ========================================================== main ========================================================== */
async function main() {
  const t0 = Date.now();

  const enFiles = walk('dist/schiffe', '.html');
  const deFiles = walk('dist/de/schiffe', '.html');
  const allFiles = [...enFiles, ...deFiles];

  console.log(
    `verify-shipconsole: prueft dist/schiffe/*.html + dist/de/schiffe/*.html (GEBAUTER Stand, ` +
      `nicht die Quelle) — ${REPORT_MODE ? 'Berichtsmodus (--report)' : 'Tor-Modus'}`
  );

  /* ---- Zusicherung 1: Bestand und Selbstauskunft ---- */
  console.log('\n[1] Bestand und Selbstauskunft');
  console.log(`    EN: ${enFiles.length}   DE: ${deFiles.length}   Summe: ${allFiles.length}`);
  console.log(`    Soll: >= ${MIN_PAGES} Seiten gesamt   Ist: ${allFiles.length}`);
  if (allFiles.length < MIN_PAGES) {
    fail(
      `nur ${allFiles.length} Schiffsseiten gelesen (< ${MIN_PAGES}) — der Lauf selbst ist kaputt, ` +
        `nicht die Seite (EN ${enFiles.length}, DE ${deFiles.length})`
    );
  }

  /* ---- Je Seite einmal lesen und aufbereiten ---- */
  const fileData = new Map();
  for (const f of allFiles) {
    const html = readFileSync(f, 'utf8');
    const clean = stripCommentsAndScripts(html);
    const { data: holodata } = holodataAus(html, f);
    const holoRegionHtml = extractRegionByClass(clean, 'holo');
    const sysSections = holoRegionHtml ? extractAllRegionsByClass(holoRegionHtml, 'holo__sys') : [];
    const railRegionHtml = holoRegionHtml ? extractRegionByClass(holoRegionHtml, 'holo__rail') : null;
    const railEntries = railEntriesAus(railRegionHtml);
    const templateCount = (holoRegionHtml ? (holoRegionHtml.match(/<template\b/gi) || []).length : 0);
    fileData.set(f, { html, clean, holodata, holoRegionHtml, sysSections, railRegionHtml, railEntries, templateCount });
  }

  /* ---- Zusicherung 2: Konsolen-Geruest ---- */
  console.log('\n[2] Konsolen-Geruest (>=1 .holo__sys je Seite, feste id-Menge, keine doppelt, INNERHALB section.holo)');
  {
    let pagesWithoutSys = [];
    let badIds = [];
    let dupIds = [];
    const distEn = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    const distDe = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const [f, d] of fileData) {
      const n = d.sysSections.length;
      const bucket = Math.min(n, 4);
      (f.startsWith('dist/de/') ? distDe : distEn)[bucket]++;
      if (n < 1) pagesWithoutSys.push(f);
      const seen = new Set();
      for (const s of d.sysSections) {
        if (!s.id || !SYS_IDS.includes(s.id)) badIds.push(`${f}: unbekannte/fehlende id "${s.id}"`);
        if (s.id) {
          if (seen.has(s.id)) dupIds.push(`${f}: id "${s.id}" doppelt`);
          seen.add(s.id);
        }
      }
    }
    console.log(`    .holo__sys je Seite — Soll: >= 1   Ist Verstoesse: ${pagesWithoutSys.length} von ${allFiles.length} Seiten`);
    console.log(`    Verteilung Systemzahl EN: 4=${distEn[4]} 3=${distEn[3]} 2=${distEn[2]} 1=${distEn[1]} 0=${distEn[0]}`);
    console.log(`    Verteilung Systemzahl DE: 4=${distDe[4]} 3=${distDe[3]} 2=${distDe[2]} 1=${distDe[1]} 0=${distDe[0]}`);
    console.log(
      `    Soll (Welle-1-Messung, je Sprache): 4=${WELLE1_RAIL_VERTEILUNG[4]} 3=${WELLE1_RAIL_VERTEILUNG[3]} ` +
        `2=${WELLE1_RAIL_VERTEILUNG[2]} 1=${WELLE1_RAIL_VERTEILUNG[1]}`
    );
    console.log(`    id ausserhalb {${SYS_IDS.join(', ')}} oder fehlend — Soll: 0   Ist: ${badIds.length}`);
    console.log(`    doppelte id je Seite — Soll: 0   Ist: ${dupIds.length}`);
    if (pagesWithoutSys.length)
      fail(
        `${pagesWithoutSys.length} Seite(n) ohne .holo__sys innerhalb section.holo (Soll >=1 je Seite), u. a.: ` +
          `${pagesWithoutSys.slice(0, 10).join(', ')}`
      );
    if (badIds.length) fail(`.holo__sys mit unbekannter/fehlender id: ${badIds.slice(0, 10).join(', ')}`);
    if (dupIds.length) fail(`doppelte .holo__sys-id je Seite: ${dupIds.slice(0, 10).join(', ')}`);
    for (const [n, soll] of Object.entries(WELLE1_RAIL_VERTEILUNG)) {
      if (distEn[n] !== soll) fail(`EN-Verteilung Systemzahl=${n}: Soll ${soll}, Ist ${distEn[n]} — eine der beiden Zaehlungen ist falsch`);
      if (distDe[n] !== soll) fail(`DE-Verteilung Systemzahl=${n}: Soll ${soll}, Ist ${distDe[n]} — eine der beiden Zaehlungen ist falsch`);
    }
  }

  /* ---- Zusicherung 3: Bijektion Rail <-> System ---- */
  console.log('\n[3] Bijektion Rail-Anker <-> .holo__sys-id');
  {
    let pairsChecked = 0;
    const danglingAnchors = [];
    const missingEntries = [];
    for (const [f, d] of fileData) {
      const sysIdSet = new Set(d.sysSections.map((s) => s.id).filter(Boolean));
      for (const entry of d.railEntries) {
        pairsChecked++;
        if (!sysIdSet.has(entry.target)) danglingAnchors.push(`${f}: Rail-Anker zeigt auf fehlende Systemid "${entry.target}"`);
      }
      const targetCounts = new Map();
      for (const entry of d.railEntries) targetCounts.set(entry.target, (targetCounts.get(entry.target) || 0) + 1);
      for (const sid of sysIdSet) {
        pairsChecked++;
        const n = targetCounts.get(sid) || 0;
        if (n !== 1) missingEntries.push(`${f}: System "${sid}" hat ${n} Rail-Eintraege (erwartet genau 1)`);
      }
    }
    console.log(`    Geprueft: ${pairsChecked} Paar(e)   Soll: 0 Verstoesse   Ist: ${danglingAnchors.length + missingEntries.length}`);
    if (danglingAnchors.length) fail(`Rail-Anker ohne Systemziel: ${danglingAnchors.slice(0, 10).join(', ')}`);
    if (missingEntries.length) fail(`System ohne genau einen Rail-Eintrag: ${missingEntries.slice(0, 10).join(', ')}`);
  }

  /* ---- Zusicherung 4: Kein Eintrag ohne Marker (P-3) ---- */
  console.log('\n[4] Kein Rail-Eintrag ohne Marker (P-3): Zaehl-Chip == Portzahl der Gruppe, > 0');
  {
    let groupsChecked = 0;
    let minMarker = Infinity;
    const mismatches = [];
    for (const [f, d] of fileData) {
      if (!d.holodata) continue;
      for (const entry of d.railEntries) {
        const grp = GROUP_FOR_SYS_ID[entry.target];
        if (!grp) continue;
        const portCount = (d.holodata.ports ?? []).filter((p) => p.g === grp).length;
        groupsChecked++;
        if (portCount < minMarker) minMarker = portCount;
        if (entry.count !== portCount || portCount === 0) {
          mismatches.push(`${f}: Gruppe "${grp}" — Zaehl-Chip ${entry.count ?? '(fehlt)'} vs. #holodata ${portCount}`);
        }
      }
    }
    console.log(`    Geprueft: ${groupsChecked} Gruppe(n)   kleinste gefundene Markerzahl: ${minMarker === Infinity ? '(keine Rail-Eintraege gefunden)' : minMarker}`);
    console.log(`    Soll: 0 Abweichungen   Ist: ${mismatches.length}`);
    if (mismatches.length) fail(`Zaehl-Chip stimmt nicht mit #holodata ueberein: ${mismatches.slice(0, 10).join(', ')}`);
  }

  /* ---- Zusicherung 5: Ohne JavaScript sichtbar (D-02) ---- */
  console.log('\n[5] Ohne JavaScript sichtbar (D-02): kein hidden, kein <template>, echte Anker, Text nicht leer');
  {
    const hiddenSys = [];
    const templatePages = [];
    let minSysBytes = Infinity;
    let minSysBytesPage = null;
    let checkedSys = 0;
    for (const [f, d] of fileData) {
      if (d.templateCount > 0) templatePages.push(`${f}: ${d.templateCount}x <template> innerhalb section.holo`);
      for (const s of d.sysSections) {
        if (s.hidden) hiddenSys.push(`${f}: .holo__sys#${s.id} traegt hidden`);
        checkedSys++;
        const bytes = Buffer.byteLength(visibleText(s.html), 'utf8');
        if (bytes < minSysBytes) {
          minSysBytes = bytes;
          minSysBytesPage = `${f}#${s.id}`;
        }
      }
    }
    console.log(`    .holo__sys mit hidden — Soll: 0   Ist: ${hiddenSys.length}`);
    console.log(`    Seiten mit <template> innerhalb section.holo — Soll: 0   Ist: ${templatePages.length}`);
    console.log(
      `    Geprueft: ${checkedSys} Systemabschnitt(e)   kleinste sichtbare Textmenge: ` +
        `${minSysBytes === Infinity ? '(keine Systemabschnitte gefunden)' : `${minSysBytes} Bytes (${minSysBytesPage})`}`
    );
    if (hiddenSys.length) fail(`.holo__sys mit hidden-Attribut (D-02 verlangt sichtbar ohne JS): ${hiddenSys.slice(0, 10).join(', ')}`);
    if (templatePages.length) fail(`<template> innerhalb section.holo (D-02 verlangt echtes, sichtbares Markup): ${templatePages.slice(0, 10).join(', ')}`);
    if (checkedSys > 0 && minSysBytes === 0) fail(`mindestens ein Systemabschnitt ohne sichtbaren Text (${minSysBytesPage})`);
  }

  /* ---- Zusicherung 6: Textbestand (Erfolgskriterium 3) ---- */
  console.log('\n[6] Textbestand je Seite gegen die Sperrklinke (Hausform, wandert nur nach oben)');
  {
    const untergrenze = Math.round(TEXTBESTAND_KLINKE.wert * (1 - TEXTBESTAND_KLINKE.toleranzProzent / 100));
    const bytesByPage = [];
    for (const [f, d] of fileData) bytesByPage.push({ f, bytes: textBytesVon(d.html) });
    bytesByPage.sort((a, b) => a.bytes - b.bytes);
    const min = bytesByPage[0];
    const max = bytesByPage[bytesByPage.length - 1];
    const median = bytesByPage[Math.floor(bytesByPage.length / 2)];
    console.log(`    Klinke: ${JSON.stringify(TEXTBESTAND_KLINKE)}`);
    console.log(`    Effektive Untergrenze (mit ${TEXTBESTAND_KLINKE.toleranzProzent}% Reserve): ${untergrenze} Bytes`);
    console.log(
      `    Textbestand ueber alle ${bytesByPage.length} Seiten: min=${min.bytes} (${min.f}) median=${median.bytes} max=${max.bytes} (${max.f})`
    );
    const violators = bytesByPage.filter((x) => x.bytes < untergrenze);
    console.log(`    Seiten unter der Untergrenze — Soll: 0   Ist: ${violators.length}`);
    if (violators.length)
      fail(`${violators.length} Seite(n) unter der Textbestands-Klinke (${untergrenze} Bytes): ${violators.slice(0, 10).map((x) => `${x.f} (${x.bytes})`).join(', ')}`);
  }

  /* ---- Zusicherung 7: Sprachparitaet ---- */
  console.log('\n[7] Sprachparitaet EN<->DE (Systemabschnitte, Rail-Eintraege, Marker je Gruppe)');
  {
    const { pairs } = findPagePairs(allFiles);
    assertMinimumPairs(pairs, fail, MIN_PAIRS);
    let mismatches = 0;
    const examples = [];
    for (const [en, de] of pairs) {
      const a = fileData.get(en);
      const b = fileData.get(de);
      if (!a || !b) continue;
      const groupCounts = (d) => {
        const c = { core: 0, arms: 0, prop: 0, other: 0 };
        for (const p of d.holodata?.ports ?? []) if (c[p.g] !== undefined) c[p.g]++;
        return c;
      };
      const ga = groupCounts(a);
      const gb = groupCounts(b);
      const same =
        a.sysSections.length === b.sysSections.length &&
        a.railEntries.length === b.railEntries.length &&
        ['core', 'arms', 'prop', 'other'].every((g) => ga[g] === gb[g]);
      if (!same) {
        mismatches++;
        if (examples.length < 10) {
          examples.push(
            `${en} (Sys=${a.sysSections.length},Rail=${a.railEntries.length},Grp=${JSON.stringify(ga)}) <-> ` +
              `${de} (Sys=${b.sysSections.length},Rail=${b.railEntries.length},Grp=${JSON.stringify(gb)})`
          );
        }
      }
    }
    console.log(`    Verglichene Seitenpaare: ${pairs.length}   Soll: 0 Abweichungen   Ist: ${mismatches}`);
    if (mismatches) fail(`Sprachparitaet gerissen bei ${mismatches} Paar(en): ${examples.join('; ')}`);
  }

  /* ---- Zusicherung 8: Zombie-Waechter ---- */
  console.log('\n[8] Zombie-Waechter: jede Ausnahme muss in diesem Durchgang gegriffen haben');
  {
    console.log(`    Soll: jede Ausnahme >= 1 Treffer   Ist: ${EXCLUSIONS.length} Ausnahme(n) registriert`);
    if (!EXCLUSIONS.length) {
      console.log('    keine Ausnahmen');
    } else {
      for (const ex of EXCLUSIONS) {
        const usedCount = ex.usedCount ?? 0;
        console.log(`    ${ex.id} — Soll: >= 1 Treffer   Ist: ${usedCount} Treffer`);
        if (usedCount === 0) fail(`Ausnahme ${ex.id} hat kein einziges Mal gegriffen — Anlass entfallen, Eintrag entfernen`);
      }
    }
  }

  const elapsedMs = Date.now() - t0;
  console.log(`\nLaufzeit: ${elapsedMs} ms${elapsedMs > 30000 ? ' — UEBER 30s, das ist ein Befund (T-15-06), kein Normalzustand' : ''}`);

  if (REPORT_MODE) {
    console.log('\nverify-shipconsole --report: Erstbefund abgeschlossen (immer Exit 0, unabhaengig vom Ergebnis)');
    process.exit(0);
  }

  console.log(`\nverify-shipconsole: ${ok ? 'ALLE ZUSICHERUNGEN ERFUELLT ✓' : 'FEHLGESCHLAGEN ✗'}`);
  if (!ok) process.exit(1);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) await main();
