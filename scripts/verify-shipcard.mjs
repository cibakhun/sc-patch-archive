/* ============================================================
   verify-shipcard.mjs — Entdopplungs- und Kapitelgeruest-Tor fuer die
   Schiffs-Detailseite (Phase 14, D-01/D-02/D-03).

   Pruefverfahren gegen den GEBAUTEN Stand von dist/schiffe/*.html und
   dist/de/schiffe/*.html — Vorbild scripts/verify-fx.mjs (Hausform:
   Abbruch bei fehlendem dist/, je Zusicherung eine nummerierte
   Ueberschrift mit Soll-/Ist-Zeile, fail()-Sammelurteil) und
   scripts/verify-sync.mjs (Tag-Abtastung ueber tokenize()-Verfahren,
   cutRegion()-Depth-Zaehlung fuer verschachtelte Blockgrenzen, benannte
   Ausnahmen aus einer eigenen Registry-Datei). KEINE HTML-Bibliothek.

   WARUM ES DEN GIBT: 14-CONTEXT.md § "Die Doppelungen, maschinell
   gezaehlt" belegt sieben Werte, die heute an zwei bis vier Stellen der
   Seite stehen (126 m viermal, 456 SCU dreimal, 140 m/s dreimal, ...),
   plus das komplett redundante "Datenblatt"-Panel. Konkrete Vorgabe 5
   verlangt: "Die Entdopplung wird maschinell belegt, nicht behauptet ...
   und muss vor der Umsetzung einmal vorgefuehrt rot sein." Dieses Skript
   ist die Abnahme dafuer — es prueft den ZIELZUSTAND dieser Phase (ein
   Kapitelgeruest mit Sprungleiste, kein Einheitsrahmen, keine
   vergleichslosen Balken, kein Wert an mehr als einem Ort) und ist
   deshalb bis Welle 4 zwangslaeufig ROT gegen den heutigen Stand. Der
   Registry-Eintrag steht deshalb vorerst auf `disabled`
   (scripts/lib/gate-registry.mjs) — die Ausgangsmessung dieser Welle
   (siehe 14-01-SUMMARY.md) ist genau diese vorgefuehrte Rot-Meldung.

   ACHT ZUSICHERUNGEN, jede mit einer Soll-/Ist-Zeile:

     1  Bestand und Selbstauskunft. Gelesene Schiffsseiten je Sprache und
        in Summe; Sperrklinke bei < 440 (heute 454 = 227 je Sprache,
        scripts/lib/metrics-baseline.mjs#seitenSchiffe).
     2  Konsolengeruest UND Abwesenheit der Kapitel (D-01). Null
        .sd__chapter und null .sd__jump site-weit; je Seite genau EINE
        .holo__rail; ein bis acht .holo__sys mit je einer id aus SYS_IDS,
        keine doppelt.
     3  Bijektion Rail-Eintrag <-> Abschnitt. Jeder Anker in .holo__rail
        zeigt auf eine vorhandene sys-id derselben Seite; jeder Abschnitt
        mit id hat genau einen Rail-Eintrag.
     4  Der Einheitsrahmen ist weg. Null .sd__panel site-weit; je Seite
        Zahl(.holo__sys-ct) === Zahl(.holo__sys) — jeder Abschnitt traegt
        genau eine Herkunftszeile (UI-SPEC Punkt 7).
     5  Balken nur, wo sie vergleichen (D-02). Null .sd__gtrack
        site-weit; .sd__proftrack nur auf Seiten mit einem sys-rank-
        Abschnitt, dort mindestens eines.
     6  Entdopplung (D-03) — der Kern. div.sd wird in Regionen zerlegt
        (jedes direkte Kind + jede .sd__sub-Unterueberschrift trennt neu
        auf), das Raster fuer aehnliche Schiffe faellt per benannter
        Ausnahme heraus, und jedes Zahl+Einheit-Token aus dem sichtbaren
        Text (Meter, SCU, m/s, km/s, HP, DPS), das in mehr als einer
        Region derselben Seite steht, ist ein Befund.
     7  Sprachparitaet. Je EN/DE-Seitenpaar (scripts/lib/page-pairs.mjs)
        muessen die Zaehlungen von Konsolenabschnitten, Rail-Eintraegen,
        Balkenspuren, Perzentilspuren und Herkunftszeilen uebereinstimmen.
     8  Zombie-Waechter. Jede Ausnahme aus shipcard-exclusions.mjs muss in
        DIESEM Durchgang mindestens einmal gegriffen haben.

   BERICHTSMODUS (--report): dasselbe Verfahren, druckt die Befunde aus
   Zusicherung 6 gruppiert nach Token, faellt aber KEIN Urteil und gibt
   IMMER 0 zurueck (wie verify-sync.mjs --report). Grund im Kopf von
   scripts/verify-sync.mjs woertlich zitiert: am 16.08.2026 steckten in
   diesem Projekt zwei Fehler im Pruefer selbst, ein drittes Tor waere zu
   89 % Fehlalarm gewesen — ein neues Tor faehrt zuerst als reiner Bericht.

   Schienenfaehigkeit (Grundsatz 4): kein git, kein Netz, kein
   Kindprozess, keine Data.p4k — nur node:fs gegen dist/.

     node scripts/verify-shipcard.mjs             Tor: Exit 1 bei jedem
                                                    unerklaerten Befund.
     node scripts/verify-shipcard.mjs --report     Erstbefund, immer Exit 0.
   ============================================================ */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findPagePairs, assertMinimumPairs } from './lib/page-pairs.mjs';
import { EXCLUSIONS } from './lib/shipcard-exclusions.mjs';

const REPORT_MODE = process.argv.includes('--report');
const MIN_PAGES = 440;
const MIN_PAIRS = 200;
/* Bis D-01 standen hier die vier Kapitel-ids. Sie sind mit dem Kapitelgeruest
   entfallen: die Konsole ist an seine Stelle getreten. Die Zusicherungen 2, 3,
   5 und 7 pruefen seither DIESELBE Aussage an der neuen Struktur — sie wurden
   umgehaengt, nicht stillgelegt.

   ⚠ Genau dieser Schritt fehlte in Phase 16 und ist der Grund, warum D-01
   fuenf Wellen lang nicht geliefert wurde: verify-shipcard VERLANGTE das
   Kapitelgeruest, verify-shipconsole verlangte die Konsole, und der einzige
   Zustand mit beiden Toren gruen war der falsche — beides uebereinander.
   Wer hier eine Struktur festschreibt, muss sie mitziehen, wenn eine spaetere
   Phase sie abloest. */
const SYS_IDS = [
  // Portgruppen (Marker auf der Buehne, HOLO_GRP_ORDER in ShipDetail.astro)
  'sys-core', 'sys-arms', 'sys-prop', 'sys-other',
  // Inhaltsgruppen (CONTENT_GROUPS_SOURCE, vormals die vier Kapitel)
  'sys-spec', 'sys-trade', 'sys-rank', 'sys-context',
];
/* Der Rang-Abschnitt ist der Erbe von ch-profile: nur dort gehoeren
   Perzentilbalken hin (D-02). */
const PROFILE_SYS_ID = 'sys-rank';
const UNIT_ALTS = ['km/s', 'm/s', 'SCU', 'DPS', 'HP', 'm'];
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

if (!existsSync('dist')) {
  console.error(
    'verify-shipcard: dist/ fehlt. Erst `npm run build`, dann `npm run verify:shipcard` — ' +
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

/* ---------- Grundwerkzeug: Tags/Klassen/id/href in Dokumentreihenfolge (Vorbild verify-sync.mjs tokenize()) ---------- */
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
    out.push({ tag, classes, id: idMatch ? idMatch[1] : null, href: hrefMatch ? hrefMatch[1] : null });
  }
  return out;
}

/* ---------- extractRegion(): dieselbe Depth-Zaehlung wie cutRegion() in
   verify-sync.mjs, aber sie GIBT die getroffene Region zurueck statt sie
   zu entfernen. Braucht CLEAN html (Kommentare/Script-/Style-Ruempfe schon
   entfernt), sonst koennten unpassende "<div" in einem Skript-Rumpf die
   Tiefenzaehlung verfaelschen. ---------- */
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

/* ---------- splitTopLevelChildren(): generischer Tag-Stapel ueber JEDE
   Tagart (nicht nur div), um die DIREKTEN Kinder von div.sd zu finden.
   Selbstschliessende und void-Elemente (img, br, ...) oeffnen keine
   Verschachtelung. Braucht ebenfalls schon bereinigtes HTML. ---------- */
function splitTopLevelChildren(innerHtml) {
  const children = [];
  const re = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^<>]*?)?)\/?>/g;
  let depth = 0;
  let curStart = -1;
  let m;
  while ((m = re.exec(innerHtml))) {
    const isClose = m[0].startsWith('</');
    const selfClose = /\/\s*>$/.test(m[0]);
    const name = m[1].toLowerCase();
    const isLeaf = VOID_TAGS.has(name) || selfClose;
    if (!isClose) {
      if (depth === 0) curStart = m.index;
      if (!isLeaf) {
        depth++;
      } else if (depth === 0) {
        children.push(innerHtml.slice(curStart, m.index + m[0].length));
        curStart = -1;
      }
    } else {
      depth--;
      if (depth === 0 && curStart !== -1) {
        children.push(innerHtml.slice(curStart, m.index + m[0].length));
        curStart = -1;
      }
    }
  }
  return children;
}

/* ---------- Region-Schluessel: aria-label > id > erste Klasse > Tagname
   fuer das direkte Kind; fuer einen sd__sub-Abschnitt der Text der
   Ueberschrift selbst — beides nur fuer die Berichtsausgabe/Diagnose,
   die Dedopplungs-IDENTITAET selbst ist der Array-Index, nicht der Text. */
function regionKeyForChild(childHtml) {
  const openMatch = /^<([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^<>]*?)?)\/?>/.exec(childHtml);
  if (!openMatch) return 'region';
  const attrs = openMatch[2] || '';
  const ariaM = /\baria-label\s*=\s*"([^"]*)"/i.exec(attrs);
  if (ariaM && ariaM[1]) return ariaM[1];
  const idM = /\bid\s*=\s*"([^"]*)"/i.exec(attrs);
  if (idM && idM[1]) return idM[1];
  const clsM = /\bclass\s*=\s*"([^"]*)"/i.exec(attrs);
  if (clsM && clsM[1]) return clsM[1].trim().split(/\s+/)[0];
  return openMatch[1];
}

function regionKeyForSubpiece(pieceHtml) {
  const m = /^<h[34]\b[^>]*>([\s\S]*?)<\/h[34]>/i.exec(pieceHtml);
  if (m) {
    const text = m[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (text) return text;
  }
  return 'sub';
}

const SD_SUB_RE = /<h[34]\b[^>]*class\s*=\s*"[^"]*\bsd__sub\b[^"]*"[^>]*>/gi;
function splitSubHeadings(childHtml) {
  const idxs = [];
  let m;
  SD_SUB_RE.lastIndex = 0;
  while ((m = SD_SUB_RE.exec(childHtml))) idxs.push(m.index);
  if (!idxs.length) return [childHtml];
  const pieces = [];
  let prev = 0;
  for (const idx of idxs) {
    if (idx > prev) pieces.push(childHtml.slice(prev, idx));
    prev = idx;
  }
  pieces.push(childHtml.slice(prev));
  return pieces.filter((p) => p.length > 0);
}

/* ---------- Sichtbarer Text: alle Tags (samt Attributwerten) weg, ein
   paar haeufige Entitaeten dekodiert, Weissraum kollabiert. Damit fallen
   Attributwerte — insbesondere der aria-label-Rohwert der Perzentilspur —
   VOR dem Zaehlen automatisch heraus: sie stehen nie zwischen Tags. */
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

function buildUnitPattern() {
  return new RegExp(`\\d[\\d.,]*\\s?(?:${UNIT_ALTS.join('|')})(?![a-zA-Z])`, 'g');
}

function extractTokens(text) {
  const re = buildUnitPattern();
  const out = [];
  let m;
  while ((m = re.exec(text))) out.push(m[0].replace(/\s+/g, ' ').trim());
  return out;
}

/* ---------- Regionen einer Seite (Zusicherung 6) ----------
   Zwei Bloecke werden abgetastet, seit 16-02-PLAN.md Task 2: weiterhin
   div.sd (Phase 14, die vier Kapitel), UND zusaetzlich section.holo (Phase
   15, die Konsole). Anlass: die Konsole liegt AUSSERHALB von div.sd; ohne
   diese Erweiterung koennte der Scan die in 16-UI-SPEC.md Punkt 6
   verbindliche Regel "kein Bauteiltext zweimal im DOM" fuer die Konsole gar
   nicht pruefen — er saehe dort nicht hin, und das waere ein blinder Fleck,
   keine Entwarnung. Beide Bloecke werden mit derselben Tiefenzaehlung
   geschnitten, in dieselbe Regionsliste zerlegt und unterliegen denselben
   benannten Ausnahmen.

   AUSDRUECKLICH NICHT MITGENOMMEN: die Kennwerte-Leiste `div.holo__bar`
   (ShipDetail.astro). Sie ist ein SIBLING von section.holo, kein Kind davon
   — extractRegion() schneidet section.holo an dessen eigenem schliessenden
   </section>-Tag (Tiefenzaehlung), lange bevor holo__bar im Dokument folgt,
   ueberreicht also strukturell gar nicht bis dorthin. GEGENPROBE gegen eine
   Praefix-Ueberreichweite am Klassenattribut selbst (16-UI-SPEC.md Punkt
   11.3-Forderung "exakt am Klassenattribut, nicht per Praefix"): das
   Oeffnungsmuster ist EXAKT `class="holo"` (kein Klassenlisten-Wortabgleich)
   — die Zeichenkette `class="holo__bar"` enthaelt diese exakte Zeichenfolge
   NICHT, weil das schliessende Anfuehrungszeichen unmittelbar auf "holo"
   folgen muesste und bei "holo__bar" stattdessen "_" folgt. Dieselbe
   Genauigkeitsstufe wie das bestehende `<div class="sd">` unten. */
const REGION_EXCLUSIONS = EXCLUSIONS.filter((e) => e.mode === 'exclude-region');
const IGNORED_UNIT_EXCLUSIONS = EXCLUSIONS.filter((e) => e.mode === 'ignored-units');
const excludeUsage = new Map();
const ignoredUnitUsage = new Map();

function extractRegionsFromBlock(cleanHtml, openPattern, tagName, blockLabel) {
  const region = extractRegion(cleanHtml, openPattern, tagName);
  if (!region) return [];
  const inner = region.slice(region.indexOf('>') + 1, region.length - `</${tagName}>`.length);
  const children = splitTopLevelChildren(inner);
  const regions = [];
  for (const child of children) {
    const excl = REGION_EXCLUSIONS.find((e) => e.match(child));
    if (excl) {
      excludeUsage.set(excl.id, (excludeUsage.get(excl.id) || 0) + 1);
      continue;
    }
    const baseKey = regionKeyForChild(child);
    const pieces = splitSubHeadings(child);
    pieces.forEach((piece, i) => {
      // Ausnahmen wirken seit Task 2 (14-03-PLAN.md) auch je UNTERABSCHNITT,
      // nicht nur je direktem Kind von div.sd — ein Kapitel wie "Specs" (vier
      // Unterabschnitte in EINEM Kind) braucht sonst entweder gar keine oder
      // eine viel zu breite Ausnahme, um einen einzelnen falsch-positiven
      // Unterabschnitt zu erklaeren.
      const pieceExcl = REGION_EXCLUSIONS.find((e) => e.match(piece));
      if (pieceExcl) {
        excludeUsage.set(pieceExcl.id, (excludeUsage.get(pieceExcl.id) || 0) + 1);
        return;
      }
      const key = i === 0 ? baseKey : `${baseKey} › ${regionKeyForSubpiece(piece)}`;
      regions.push({ key, html: piece, block: blockLabel });
    });
  }
  return regions;
}

function computeRegions(cleanHtml) {
  const sdRegions = extractRegionsFromBlock(cleanHtml, /<div class="sd">/g, 'div', 'sd');
  const holoRegions = extractRegionsFromBlock(cleanHtml, /<section\b[^>]*\bclass="holo"[^>]*>/g, 'section', 'holo');
  return [...sdRegions, ...holoRegions];
}

function findingsForPage(regions) {
  const tokenToRegions = new Map();
  let tokenOccurrences = 0;
  for (const r of regions) {
    const text = visibleText(r.html);
    for (const t of extractTokens(text)) {
      tokenOccurrences++;
      if (!tokenToRegions.has(t)) tokenToRegions.set(t, new Set());
      tokenToRegions.get(t).add(r.key);
    }
    for (const ex of IGNORED_UNIT_EXCLUSIONS) {
      let hits = 0;
      for (const u of ex.units) {
        const re = new RegExp(u.source, 'g');
        const found = text.match(re);
        if (found) hits += found.length;
      }
      if (hits) ignoredUnitUsage.set(ex.id, (ignoredUnitUsage.get(ex.id) || 0) + hits);
    }
  }
  const findings = [];
  for (const [token, regionSet] of tokenToRegions) {
    if (regionSet.size > 1) findings.push({ token, regions: [...regionSet] });
  }
  return { findings, tokenOccurrences };
}

/* ========================================================== main ========================================================== */
function main() {
  const t0 = Date.now();

  const enFiles = walk('dist/schiffe', '.html');
  const deFiles = walk('dist/de/schiffe', '.html');
  const allFiles = [...enFiles, ...deFiles];

  console.log(
    `verify-shipcard: prueft dist/schiffe/*.html + dist/de/schiffe/*.html (GEBAUTER Stand, ` +
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

  /* ---- Je Seite einmal lesen und aufbereiten, alle Assertions teilen sich das Ergebnis ---- */
  const fileData = new Map();
  for (const f of allFiles) {
    const html = readFileSync(f, 'utf8');
    const clean = stripCommentsAndScripts(html);
    const els = scanElements(html);
    /* Abgeloeste Struktur — hier NUR noch gezaehlt, um ihre Abwesenheit zu
       belegen (Zusicherung 2). Solange diese drei Zeilen stehen, kann das
       Kapitelgeruest nicht unbemerkt zurueckkehren. */
    const chapterCount = els.filter((e) => e.classes.includes('sd__chapter')).length;
    const jumpCount = els.filter((e) => e.classes.includes('sd__jump')).length;
    const panelCount = els.filter((e) => e.classes.includes('sd__panel')).length;

    /* Aktuelle Struktur: die Konsole. */
    const sysEls = els.filter((e) => e.classes.includes('holo__sys'));
    const sysIds = sysEls.map((e) => e.id).filter(Boolean);
    const railCount = els.filter((e) => e.classes.includes('holo__rail')).length;
    const sysCtCount = els.filter((e) => e.classes.includes('holo__sys-ct')).length;
    const gtrackCount = els.filter((e) => e.classes.includes('sd__gtrack')).length;
    const proftrackCount = els.filter((e) => e.classes.includes('sd__proftrack')).length;

    let railTargets = [];
    if (railCount) {
      const railRegion = extractRegion(clean, /<nav\b[^>]*class="[^"]*\bholo__rail\b[^"]*"[^>]*>/g, 'nav');
      if (railRegion) {
        railTargets = scanElements(railRegion)
          .filter((e) => e.tag === 'a' && e.href && e.href.startsWith('#'))
          .map((e) => e.href.slice(1));
      }
    }

    fileData.set(f, {
      clean,
      chapterCount,
      jumpCount,
      panelCount,
      sysEls,
      sysIds,
      railCount,
      sysCtCount,
      gtrackCount,
      proftrackCount,
      railTargets,
    });
  }

  /* ---- Zusicherung 2: Konsolengeruest — und die Abwesenheit der Kapitel ---- */
  console.log('\n[2] Konsolengeruest (holo__rail genau 1x, holo__sys 1-8x mit fester id-Menge) + Kapitel weg');
  {
    const railBad = [];
    const sysCountBad = [];
    const sysIdBad = [];
    const sysDupBad = [];
    const chapterRest = [];
    const jumpRest = [];
    let chapterTotal = 0;
    let jumpTotal = 0;
    const distribution = {};
    for (const [f, d] of fileData) {
      /* D-01: die Konsole ERSETZT die Kapitel. Genau diese Zeilen fehlten dem
         Tor bis hierher — es prueft die Anwesenheit der neuen Struktur UND die
         Abwesenheit der alten. Ohne den zweiten Teil ist "ersetzt" von
         "zusaetzlich" nicht zu unterscheiden. */
      chapterTotal += d.chapterCount;
      jumpTotal += d.jumpCount;
      if (d.chapterCount) chapterRest.push(`${f} (${d.chapterCount}x .sd__chapter)`);
      if (d.jumpCount) jumpRest.push(`${f} (${d.jumpCount}x .sd__jump)`);

      if (d.railCount !== 1) railBad.push(`${f} (${d.railCount}x)`);
      const n = d.sysEls.length;
      distribution[n] = (distribution[n] || 0) + 1;
      if (n < 1 || n > SYS_IDS.length) sysCountBad.push(`${f} (${n} Abschnitte)`);
      for (const sid of d.sysIds) {
        if (!SYS_IDS.includes(sid)) sysIdBad.push(`${f}: unbekannte id "${sid}"`);
      }
      const seen = new Set();
      for (const sid of d.sysIds) {
        if (seen.has(sid)) sysDupBad.push(`${f}: id "${sid}" doppelt`);
        seen.add(sid);
      }
    }
    const verteilung = Object.keys(distribution)
      .map(Number).sort((a, b) => b - a)
      .map((k) => `${k}=${distribution[k]}`).join(' ');
    console.log(`    .sd__chapter site-weit — Soll: 0   Ist: ${chapterTotal}`);
    console.log(`    .sd__jump site-weit — Soll: 0   Ist: ${jumpTotal}`);
    console.log(`    holo__rail je Seite — Soll: genau 1   Ist Verstoesse: ${railBad.length} von ${allFiles.length} Seiten`);
    console.log(`    holo__sys je Seite — Soll: 1-${SYS_IDS.length}   Ist Verstoesse: ${sysCountBad.length} von ${allFiles.length} Seiten`);
    console.log(`    Verteilung Abschnittszahl: ${verteilung}`);
    console.log(`    sys-id ausserhalb {${SYS_IDS.join(', ')}} — Soll: 0   Ist: ${sysIdBad.length}`);
    console.log(`    Doppelte sys-id je Seite — Soll: 0   Ist: ${sysDupBad.length}`);
    if (chapterRest.length) {
      fail(
        `D-01 verletzt: .sd__chapter noch vorhanden auf ${chapterRest.length} Seite(n) — die Konsole soll die ` +
          `Kapitel ERSETZEN, nicht ergaenzen: ${chapterRest.slice(0, 10).join(', ')}`
      );
    }
    if (jumpRest.length) {
      fail(
        `D-01 verletzt: .sd__jump noch vorhanden auf ${jumpRest.length} Seite(n) — zwei Navigationen ` +
          `uebereinander: ${jumpRest.slice(0, 10).join(', ')}`
      );
    }
    if (railBad.length) fail(`holo__rail nicht genau 1x: ${railBad.slice(0, 10).join(', ')}`);
    if (sysCountBad.length) fail(`holo__sys ausserhalb 1-${SYS_IDS.length}: ${sysCountBad.slice(0, 10).join(', ')}`);
    if (sysIdBad.length) fail(`unbekannte sys-id: ${sysIdBad.slice(0, 10).join(', ')}`);
    if (sysDupBad.length) fail(`doppelte sys-id: ${sysDupBad.slice(0, 10).join(', ')}`);
  }

  /* ---- Zusicherung 3: Bijektion Rail-Eintrag <-> Konsolenabschnitt ---- */
  console.log('\n[3] Bijektion Rail-Eintrag <-> sys-id');
  {
    let pairsChecked = 0;
    const danglingAnchors = [];
    const missingEntries = [];
    for (const [f, d] of fileData) {
      const sysIdSet = new Set(d.sysIds);
      for (const target of d.railTargets) {
        pairsChecked++;
        if (!sysIdSet.has(target)) danglingAnchors.push(`${f}: Anker zeigt auf fehlende sys-id "${target}"`);
      }
      const targetCounts = new Map();
      for (const t of d.railTargets) targetCounts.set(t, (targetCounts.get(t) || 0) + 1);
      for (const sid of d.sysIds) {
        pairsChecked++;
        const n = targetCounts.get(sid) || 0;
        if (n !== 1) missingEntries.push(`${f}: Abschnitt "${sid}" hat ${n} Rail-Eintrag/-Eintraege (erwartet genau 1)`);
      }
    }
    console.log(`    Geprueft: ${pairsChecked} Paar(e)   Soll: 0 Verstoesse   Ist: ${danglingAnchors.length + missingEntries.length}`);
    if (danglingAnchors.length) fail(`Rail-Anker ohne Abschnitt: ${danglingAnchors.slice(0, 10).join(', ')}`);
    if (missingEntries.length) fail(`Abschnitt ohne genau einen Rail-Eintrag: ${missingEntries.slice(0, 10).join(', ')}`);
  }

  /* ---- Zusicherung 4: Einheitsrahmen weg ---- */
  console.log('\n[4] Der Einheitsrahmen ist weg (sd__panel) — holo__sys-ct === Abschnittszahl je Seite');
  {
    let totalPanel = 0;
    const ctMismatch = [];
    for (const [f, d] of fileData) {
      totalPanel += d.panelCount;
      /* Erbe der frueheren Pruefung "sd__code === sd__chapter": jeder Abschnitt
         traegt GENAU EINE Herkunftszeile. Sie ist der Quellen- und
         Standnachweis (UEX, FleetYards, Spielstand) — faellt sie weg, steht
         eine Zahl ohne Herkunft auf der Seite. */
      if (d.sysCtCount !== d.sysEls.length) {
        ctMismatch.push(`${f}: holo__sys-ct=${d.sysCtCount} != holo__sys=${d.sysEls.length}`);
      }
    }
    console.log(`    sd__panel site-weit — Soll: 0   Ist: ${totalPanel}`);
    console.log(`    holo__sys-ct === holo__sys je Seite — Soll: 0 Abweichungen   Ist: ${ctMismatch.length}`);
    if (totalPanel) fail(`sd__panel noch vorhanden: ${totalPanel} Vorkommen ueber ${allFiles.length} Seiten`);
    if (ctMismatch.length) fail(`holo__sys-ct != Abschnittszahl: ${ctMismatch.slice(0, 10).join(', ')}`);
  }

  /* ---- Zusicherung 5: Balken nur, wo sie vergleichen (D-02) ---- */
  console.log(`\n[5] Balken nur, wo sie vergleichen — sd__gtrack weg, sd__proftrack nur mit ${PROFILE_SYS_ID}`);
  {
    let totalGtrack = 0;
    let totalProftrack = 0;
    const profBad = [];
    for (const [f, d] of fileData) {
      totalGtrack += d.gtrackCount;
      totalProftrack += d.proftrackCount;
      /* Umgehaengt von ch-profile auf sys-rank: dieselbe Kopplung, neue
         Struktur. Ohne diesen Schritt haette D-01 das Tor gerissen — jede
         Seite mit Perzentilbalken waere zum Befund geworden, weil es das
         Kapitel nicht mehr gibt. */
      const hasRankSection = d.sysIds.includes(PROFILE_SYS_ID);
      if (hasRankSection && d.proftrackCount < 1) {
        profBad.push(`${f}: Abschnitt ${PROFILE_SYS_ID} vorhanden, aber 0 sd__proftrack`);
      }
      if (!hasRankSection && d.proftrackCount > 0) {
        profBad.push(`${f}: sd__proftrack (${d.proftrackCount}x) ohne Abschnitt ${PROFILE_SYS_ID}`);
      }
    }
    console.log(`    sd__gtrack site-weit — Soll: 0   Ist: ${totalGtrack}`);
    console.log(`    sd__proftrack site-weit — Ist gesamt: ${totalProftrack}   Verstoesse gegen die Kopplung: ${profBad.length}`);
    if (totalGtrack) fail(`sd__gtrack noch vorhanden: ${totalGtrack} Vorkommen ueber ${allFiles.length} Seiten`);
    if (profBad.length) fail(`sd__proftrack <-> ${PROFILE_SYS_ID} nicht gekoppelt: ${profBad.slice(0, 10).join(', ')}`);
  }

  /* ---- Zusicherung 6: Entdopplung (D-03) — der Kern ---- */
  console.log('\n[6] Entdopplung (D-03): ein Zahl+Einheit-Token gehoert genau einer Region');
  {
    let totalTokenOccurrences = 0;
    let totalFindings = 0;
    const reportEntries = [];
    const diagnosticEntries = [];
    // Selbstauskunft, erweitert seit 16-02-PLAN.md Task 2 (Grundsatz 2): wie
    // viele Regionen aus div.sd und wie viele aus section.holo stammen, je
    // Sprache und in Summe. Ohne diese Zahl ist ein Schnitt, der
    // section.holo verfehlt (z. B. weil das Klassenattribut spaeter eine
    // zweite Klasse bekommt und das exakte Oeffnungsmuster nicht mehr
    // greift), von einem echten nicht zu unterscheiden — beide meldeten
    // "0 Befunde", eines davon aus Leerlauf statt aus Entwarnung.
    let sdRegionsEn = 0, sdRegionsDe = 0, holoRegionsEn = 0, holoRegionsDe = 0;
    let minHoloRegionsPerPage = Infinity;
    let minHoloRegionsPage = null;
    for (const [f, d] of fileData) {
      const regions = computeRegions(d.clean);
      const sdCount = regions.filter((r) => r.block === 'sd').length;
      const holoCount = regions.filter((r) => r.block === 'holo').length;
      const isDe = f.startsWith('dist/de/');
      if (isDe) { sdRegionsDe += sdCount; holoRegionsDe += holoCount; } else { sdRegionsEn += sdCount; holoRegionsEn += holoCount; }
      if (holoCount < minHoloRegionsPerPage) {
        minHoloRegionsPerPage = holoCount;
        minHoloRegionsPage = f;
      }
      const { findings, tokenOccurrences } = findingsForPage(regions);
      totalTokenOccurrences += tokenOccurrences;
      totalFindings += findings.length;
      for (const fnd of findings) {
        reportEntries.push({ file: f, token: fnd.token, regions: fnd.regions });
        if (diagnosticEntries.length < 10) diagnosticEntries.push({ file: f, token: fnd.token, regions: fnd.regions });
      }
    }
    console.log(`    Gelesene Seiten: ${allFiles.length}   Gefundene Token (Vorkommen gesamt): ${totalTokenOccurrences}`);
    console.log(`    Befunde (Token in > 1 Region derselben Seite): ${totalFindings}   davon durch benannte Ausnahme erklaert: 0`);
    console.log(`    Regionen aus div.sd: EN ${sdRegionsEn}   DE ${sdRegionsDe}   Summe ${sdRegionsEn + sdRegionsDe}`);
    console.log(`    Regionen aus section.holo: EN ${holoRegionsEn}   DE ${holoRegionsDe}   Summe ${holoRegionsEn + holoRegionsDe}`);
    console.log(
      `    Kleinste section.holo-Regionenzahl je Seite — Soll: >= 1   Ist: ${minHoloRegionsPerPage} (${minHoloRegionsPage})`
    );
    if (minHoloRegionsPerPage < 1) {
      fail(`section.holo liefert auf mindestens einer Seite 0 Regionen (${minHoloRegionsPage}) — der Schnitt greift dort nicht`);
    }

    if (REPORT_MODE) {
      const grouped = new Map();
      for (const it of reportEntries) {
        if (!grouped.has(it.token)) grouped.set(it.token, []);
        grouped.get(it.token).push(it);
      }
      const sorted = [...grouped.entries()].sort((a, b) => b[1].length - a[1].length);
      console.log(`\n    Bericht, gruppiert nach Token (${sorted.length} unterschiedliche Token betroffen):`);
      for (const [token, items] of sorted) {
        console.log(`      "${token}": ${items.length}x`);
        for (const it of items.slice(0, 3)) {
          console.log(`        ${it.file} — Regionen: [${it.regions.join(' | ')}]`);
        }
      }
    } else if (totalFindings) {
      fail(`${totalFindings} Doppelungsbefund(e) ohne benannte Ausnahme, u. a.:`);
      for (const it of diagnosticEntries) {
        console.error(`      ${it.file}: "${it.token}" in Regionen [${it.regions.join(' | ')}]`);
      }
    }
  }

  /* ---- Zusicherung 7: Sprachparitaet ---- */
  console.log('\n[7] Sprachparitaet EN<->DE (Abschnitte, Rail-Eintraege, Balkenspuren, Perzentilspuren, Herkunftszeilen)');
  {
    const { pairs } = findPagePairs(allFiles);
    assertMinimumPairs(pairs, fail, MIN_PAIRS);
    let mismatches = 0;
    const examples = [];
    /* Gezaehlt wird jetzt die Konsole statt der Kapitel. Die Aussage bleibt
       dieselbe: eine Sprache darf nie mehr oder weniger zeigen als die andere.
       Die Rail-Eintraege sind dabei die schaerfere Groesse als die frueheren
       Pillen — sie decken auch die Portgruppen ab. */
    const sig = (x) =>
      `Sys=${x.sysEls.length},Rail=${x.railTargets.length},GT=${x.gtrackCount},PT=${x.proftrackCount},Ct=${x.sysCtCount}`;
    for (const [en, de] of pairs) {
      const a = fileData.get(en);
      const b = fileData.get(de);
      if (!a || !b) continue;
      const same =
        a.sysEls.length === b.sysEls.length &&
        a.railTargets.length === b.railTargets.length &&
        a.gtrackCount === b.gtrackCount &&
        a.proftrackCount === b.proftrackCount &&
        a.sysCtCount === b.sysCtCount;
      if (!same) {
        mismatches++;
        if (examples.length < 10) examples.push(`${en} (${sig(a)}) <-> ${de} (${sig(b)})`);
      }
    }
    console.log(`    Verglichene Seitenpaare: ${pairs.length}   Soll: 0 Abweichungen   Ist: ${mismatches}`);
    if (mismatches) fail(`Sprachparitaet gerissen bei ${mismatches} Paar(en): ${examples.join('; ')}`);
  }

  /* ---- Zusicherung 8: Zombie-Waechter ---- */
  console.log('\n[8] Zombie-Waechter: jede Ausnahme muss in diesem Durchgang gegriffen haben');
  {
    for (const ex of EXCLUSIONS) {
      const usedCount = ex.mode === 'exclude-region' ? excludeUsage.get(ex.id) || 0 : ignoredUnitUsage.get(ex.id) || 0;
      console.log(`    ${ex.id}: ${usedCount} Treffer`);
      if (usedCount === 0) fail(`Ausnahme ${ex.id} hat kein einziges Mal gegriffen — Anlass entfallen, Eintrag entfernen`);
    }
  }

  const elapsedMs = Date.now() - t0;
  console.log(`\nLaufzeit: ${elapsedMs} ms`);

  if (REPORT_MODE) {
    console.log('\nverify-shipcard --report: Erstbefund abgeschlossen (immer Exit 0, unabhaengig vom Ergebnis)');
    process.exit(0);
  }

  console.log(`\nverify-shipcard: ${ok ? 'ALLE ZUSICHERUNGEN ERFUELLT ✓' : 'FEHLGESCHLAGEN ✗'}`);
  if (!ok) process.exit(1);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main();
