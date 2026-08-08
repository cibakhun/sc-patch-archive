/* ============================================================
   verify-sync.mjs — SYNC-01/SYNC-02, Struktur-Fingerabdruck EN<->DE.

   Pruefverfahren gegen den GEBAUTEN Stand (dist/), nicht die Quelle —
   Vorbild scripts/verify-fx.mjs. Bleibt als eigenstaendiges Werkzeug
   (`npm run verify:sync`), absichtlich NOCH NICHT im Dockerfile: D-03
   sagt "erst beheben, dann scharf" — beheben ist Plan 02, scharf schalten
   Plan 03.

   D-01: der Massstab ist Element-Typ UND Klassen in Autorenreihenfolge,
   OHNE Textinhalte — kein Sortieren, keine Verschachtelungstiefe. Die
   Recherche (04-RESEARCH.md) hat das ueber alle 8.678 Paare gegen vier
   Alternativen gerechnet: sortierte Klassen und tiefenbewusste Varianten
   liefern IDENTISCHE Ergebnisse zur einfachsten Fassung, "nur Tagname"
   ist halb so scharf, eine reine Zaehlung sieht 1.631 von 1.712
   Abweichungen nicht. Die einfachste Fassung gewinnt, weil jede
   Raffinesse mehr Code ohne Signalgewinn waere.

   Fuenf Zusicherungen, jede mit einer Soll-/Ist-Zeile:

     1  Paarung: findPagePairs() aus scripts/lib/page-pairs.mjs ueber alle
        HTML-Dateien unter dist/ (rekursiv) — dieselbe Paarung wie
        verify:fx/help/typo, kein vierter eigener Code. Zwei Untergrenzen: die geerbte "< 60" (die
        Paarung selbst ist kaputt) und eine EIGENE "< 5000"
        (Paarungs-PLAUSIBILITAET, keine Sperrklinke auf den Ist-Stand —
        D-03 verwirft das Einfrieren; 60 wuerde einen Build durchwinken,
        der 8.000 Seiten verliert).
     2  Fingerabdruck: tokenize() je Datei, dann elementweiser Vergleich
        der geordneten Folgen (nach Ausnahme aus Zusicherung 3).
     3  Ausnahmen aus scripts/lib/sync-exclusions.mjs, ZWEI Modi:
          - X-langsw-order (multiset-children): splitLangsw() zieht die
            Kinder JEDER .langsw-Instanz aus der Folge und vergleicht sie
            als MENGE ({cur:1, opt:1, sep:1}); der Behaelter div.langsw
            selbst bleibt in der Folge. Eng, kein Seitenausschluss — ein
            fehlendes Kind faellt weiterhin auf.
          - X-onepager-de-only, X-impressum-mstv (cut-region): cutRegion()
            schneidet VOR dem Tokenisieren eine per Quellstelle verankerte
            Region aus EINER Seite des Paars (Plan 02, Task 2).
     4  Vollstaendigkeit: jede Abweichung, die keine benannte Ausnahme
        erklaert, ist ein FEHLER.
     5  Zombie-Waechter: jede Ausnahme aus EXCLUSIONS muss in DIESEM
        Durchgang mindestens einmal gegriffen haben (mindestens ein Paar
        erklaert bzw. mindestens eine Region tatsaechlich ausgeschnitten).
        Eine Ausnahme, deren Anlass verschwunden ist, deckt sonst spaeter
        echte Drift zu, statt zu verschwinden — Gegenrichtung zu
        Zusicherung 4 (die haelt UNBENANNTE Abweichungen auf, diese haelt
        Ausnahmen auf, deren Anlass entfallen ist).

   Performance (siehe 04-01-PLAN.md <performance>): Ausnahmen zuerst
   anwenden, danach ein LINEARER Gleichheitstest der beiden Token-Felder.
   Eine teure Umfeld-Diagnose laeuft nur fuer das eine Paar, das gerade
   gefallen ist. Dateien werden PAARWEISE gelesen, nicht alle 17.000 im
   Speicher gehalten (anders als verify-fx.mjs — dort ist Zeichenketten-
   suche billig genug fuer einen Gesamt-Cache, hier waeren es
   Token-Felder).

   ⚠ Der Tokenizer arbeitet NICHT zeilenweise (\s/[^<>] fassen \r
   ohnehin) — die CRLF-Vorsicht des Hauses gilt hier ausdruecklich NICHT.
   Sie gilt fuer den zeilenweisen Hellmodus-Vergleich in Plan 03.

   Zwei Aufrufarten:
     node scripts/verify-sync.mjs             Tor: Exit 1 bei jeder
                                               unerklaerten Abweichung.
     node scripts/verify-sync.mjs --report    Erstbefund: zaehlt und
                                               gruppiert dieselben
                                               Abweichungen, endet immer
                                               mit Exit 0.
   ============================================================ */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findPagePairs, assertMinimumPairs } from './lib/page-pairs.mjs';
import { EXCLUSIONS } from './lib/sync-exclusions.mjs';

const REPORT_MODE = process.argv.includes('--report');

/* ---------- dist/ einlesen ---------- */
function walk(dir, ext, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name).replace(/\\/g, '/');
    if (e.isDirectory()) walk(p, ext, out);
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

/* ---------- tokenize(html): Struktur-Fingerabdruck (D-01) ----------
   Kommentare und Script-/Style-Ruempfe zuerst entfernen (das TAG selbst
   bleibt, damit ein fehlendes <script> weiterhin auffaellt), dann jedes
   OEFFNENDE Tag in Dokumentreihenfolge einsammeln: kleingeschriebener
   Tagname, ein Punkt, die Klassen in Autorenreihenfolge (nicht sortiert)
   mit Punkten verbunden. Textinhalt geht nirgends ein. */
export function tokenize(html) {
  let s = html.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, '$1$3');
  s = s.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, '$1$3');
  const tags = [];
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^<>]*?)?)\/?>/g;
  let m;
  while ((m = tagRe.exec(s))) {
    if (m[0].startsWith('</')) continue;
    const name = m[1].toLowerCase();
    const attrs = m[2] || '';
    const classMatch = /\bclass\s*=\s*"([^"]*)"/i.exec(attrs) || /\bclass\s*=\s*'([^']*)'/i.exec(attrs);
    const classes = classMatch ? classMatch[1].trim().split(/\s+/).filter(Boolean) : [];
    tags.push(`${name}.${classes.join('.')}`);
  }
  return tags;
}

function parseToken(tok) {
  const dot = tok.indexOf('.');
  const tag = dot === -1 ? tok : tok.slice(0, dot);
  const classPart = dot === -1 ? '' : tok.slice(dot + 1);
  const classes = classPart ? classPart.split('.') : [];
  return { tag, classes };
}

/* ---------- splitLangsw(tokens, params): die enge Sprachumschalter-Ausnahme ----------
   Ein Token mit der Klasse `container` (Standard "langsw") eroeffnet eine
   neue Instanz und BLEIBT in der Folge. Ein Token, dessen Klassenliste
   eine Klasse mit dem Praefix `childPrefix` (Standard "langsw__") traegt,
   gehoert zur AKTUELLEN Instanz und faellt aus der Folge — stattdessen
   zaehlt es in die Mengen-Zusicherung der Instanz ein. Null Instanzen
   (keine .langsw-Stelle auf der Seite, ~17.000 DataShell-Seiten) ist ein
   gueltiger Fall und liefert die Folge unveraendert zurueck.

   Die Parameter kommen vom Aufrufer aus der Registry
   (scripts/lib/sync-exclusions.mjs) — das Tor selbst traegt keine
   Ausnahme im eigenen Code, die Defaults hier dienen nur den Tests. */
export function splitLangsw(tokens, { container = 'langsw', childPrefix = 'langsw__' } = {}) {
  const seq = [];
  const instances = [];
  let current = null;
  for (const tok of tokens) {
    const { classes } = parseToken(tok);
    if (classes.includes(container)) {
      current = {};
      instances.push(current);
      seq.push(tok);
      continue;
    }
    const childClass = classes.find((c) => c.startsWith(childPrefix));
    if (childClass) {
      if (!current) {
        // Robustheit fuer entartetes HTML (Kind ohne vorangehenden
        // Behaelter) — sollte im gebauten Bestand nicht vorkommen.
        current = {};
        instances.push(current);
      }
      current[childClass] = (current[childClass] || 0) + 1;
      continue;
    }
    seq.push(tok);
  }
  return { seq, instances };
}

/* ---------- cutRegion(html, openTagPattern, tagName): benannte Regionen herausschneiden ----------
   Schneidet ab dem Treffer von openTagPattern bis zum ZUGEHOERIGEN
   schliessenden Tag heraus (zaehlt gleichnamige Tags dazwischen mit, damit
   Verschachtelung nicht zu frueh schliesst). Seit Plan 02 von zwei
   cut-region-Ausnahmen benutzt (X-onepager-de-only, X-impressum-mstv, siehe
   scripts/lib/sync-exclusions.mjs und applyCutRegionExclusions() unten) —
   fuer X-impressum-mstv absichtlich mit tagName 'p' UND einem openTagPattern,
   das schon am <h2> startet: cutRegion() depth-trackt dann NUR <p>-Tags ab
   diesem Index und schneidet dadurch <h2>…</h2> UND den unmittelbar
   folgenden <p>…</p> in einem Aufruf — kein zweiter Ausschneide-Code. */
export function cutRegion(html, openTagPattern, tagName) {
  const startMatch = openTagPattern.exec(html);
  if (!startMatch) return html;
  const start = startMatch.index;
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const combinedRe = new RegExp(`<${escapedTag}\\b[^>]*>|</${escapedTag}\\s*>`, 'gi');
  combinedRe.lastIndex = start;
  let depth = 0;
  let end = -1;
  let m;
  while ((m = combinedRe.exec(html))) {
    if (m[0].startsWith('</')) {
      depth--;
      if (depth === 0) {
        end = m.index + m[0].length;
        break;
      }
    } else {
      depth++;
    }
  }
  if (end === -1) return html;
  return html.slice(0, start) + html.slice(end);
}

/* ---------- Vergleich je Paar ---------- */
function arraysEqualFrom(a, b, startIndex) {
  if (a.length !== b.length) return false;
  for (let i = startIndex; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function firstDiffIndex(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return i;
  }
  return -1;
}

/** Vergleicht zwei Instanzlisten (je Instanz eine Klasse->Anzahl-Menge).
    Liefert null bei Uebereinstimmung, sonst einen kurzen Grund-Schluessel
    fuer die Berichts-Gruppierung. */
function compareInstances(enInstances, deInstances) {
  if (enInstances.length !== deInstances.length) return 'langsw:instanzzahl';
  for (let i = 0; i < enInstances.length; i++) {
    const a = enInstances[i];
    const b = deInstances[i];
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if ((a[k] || 0) !== (b[k] || 0)) return `langsw:${k}`;
    }
  }
  return null;
}

/* ---------- cut-region-Ausnahmen anwenden (VOR dem Tokenisieren) ----------
   Fuer jede EXCLUSIONS-Eintrag mit mode:'cut-region', dessen match(enPath)
   zutrifft: cutRegion() auf die per `side` benannte Fassung anwenden. Ein
   tatsaechlicher Schnitt (Ergebnis != Eingabe) zaehlt in `usage` fuer den
   Zombie-Waechter (Zusicherung 5) — unabhaengig davon, ob das Paar am Ende
   vollstaendig uebereinstimmt oder anderswo noch abweicht. */
function applyCutRegionExclusions(enPath, enHtml, deHtml, cutEntries, usage) {
  let en = enHtml;
  let de = deHtml;
  for (const ex of cutEntries) {
    if (!ex.match(enPath)) continue;
    if (ex.side === 'en' || ex.side === 'both') {
      const cut = cutRegion(en, ex.openTagPattern(), ex.tagName);
      if (cut !== en) usage.set(ex.id, (usage.get(ex.id) || 0) + 1);
      en = cut;
    }
    if (ex.side === 'de' || ex.side === 'both') {
      const cut = cutRegion(de, ex.openTagPattern(), ex.tagName);
      if (cut !== de) usage.set(ex.id, (usage.get(ex.id) || 0) + 1);
      de = cut;
    }
  }
  return { en, de };
}

function comparePair(enPath, dePath, langswParams, cutEntries, cutUsage) {
  const enHtmlRaw = readFileSync(enPath, 'utf8');
  const deHtmlRaw = readFileSync(dePath, 'utf8');
  const { en: enHtml, de: deHtml } = applyCutRegionExclusions(enPath, enHtmlRaw, deHtmlRaw, cutEntries, cutUsage);
  const cutApplied = enHtml !== enHtmlRaw || deHtml !== deHtmlRaw;

  const enTokens = tokenize(enHtml);
  const deTokens = tokenize(deHtml);

  if (arraysEqualFrom(enTokens, deTokens, 0)) {
    return { status: cutApplied ? 'cut-region-explained' : 'identical', enPath, dePath };
  }

  const enSplit = splitLangsw(enTokens, langswParams);
  const deSplit = splitLangsw(deTokens, langswParams);

  const instanceIssue = compareInstances(enSplit.instances, deSplit.instances);
  const seqDiffIndex = firstDiffIndex(enSplit.seq, deSplit.seq);

  if (!instanceIssue && seqDiffIndex === -1) {
    return { status: 'langsw-explained', enPath, dePath };
  }

  let family;
  let index;
  if (seqDiffIndex !== -1) {
    index = seqDiffIndex;
    family = enSplit.seq[seqDiffIndex] ?? deSplit.seq[seqDiffIndex] ?? '(Ende der Folge)';
  } else {
    index = -1;
    family = instanceIssue;
  }

  return { status: 'unexplained', enPath, dePath, index, family, enSplit, deSplit };
}

function formatContext(seq, idx, n = 3) {
  const before = seq.slice(Math.max(0, idx - n), idx);
  const cur = idx < seq.length ? seq[idx] : '∅ (Folge endet hier)';
  const after = seq.slice(idx + 1, idx + 1 + n);
  return `[…${before.join(', ')}] >>> ${cur} <<< [${after.join(', ')}…]`;
}

function printDiagnostic(u) {
  const where = u.index === -1 ? `Sprachumschalter-Menge (${u.family})` : `Index ${u.index}`;
  console.error(`    ${u.enPath} <-> ${u.dePath}  (erste Abweichung: ${where})`);
  if (u.index !== -1) {
    console.error(`      EN: ${formatContext(u.enSplit.seq, u.index)}`);
    console.error(`      DE: ${formatContext(u.deSplit.seq, u.index)}`);
  }
}

/* ---------- main ---------- */
function main() {
  const t0 = Date.now();

  if (!existsSync('dist')) {
    console.error(
      'verify-sync: dist/ fehlt. Erst `npm.cmd run build`, dann `npm run verify:sync` — ' +
        'dieses Tor prueft den GEBAUTEN Stand, nicht die Quelle.'
    );
    process.exit(1);
  }

  let ok = true;
  const fail = (msg) => {
    ok = false;
    console.error(`  FEHLER: ${msg}`);
  };

  const htmlFiles = walk('dist', '.html');
  console.log(`verify-sync: ${htmlFiles.length} .html-Dateien unter dist/ gefunden`);

  /* ---- Zusicherung 1: Paarung ---- */
  console.log('\n[1] Seitenpaarung EN<->DE (scripts/lib/page-pairs.mjs)');
  const { pairs, enOnly } = findPagePairs(htmlFiles);
  console.log(`    Gefundene Paare: ${pairs.length}   Ungepaarte EN-Dateien: ${enOnly.length}`);
  if (enOnly.length) {
    console.log(`    (erwartet, siehe 04-RESEARCH.md § Pairing): ${enOnly.slice(0, 10).join(', ')}`);
  }
  assertMinimumPairs(pairs, fail, 60);
  // Eigene Untergrenze: Paarungs-PLAUSIBILITAET, KEINE Sperrklinke auf den
  // Ist-Stand (D-03 verwirft das Einfrieren) — 60 wuerde einen Build
  // durchwinken, der 8.000 Seiten verliert.
  console.log(`    Plausibilitaets-Untergrenze: Soll >= 5000   Ist ${pairs.length}`);
  if (pairs.length < 5000) {
    fail(`Paarzahl unter der Plausibilitaets-Untergrenze (${pairs.length} < 5000) — Build unvollstaendig?`);
  }

  /* ---- Zusicherungen 2-4: Fingerabdruck, Ausnahmen, Vollstaendigkeit ---- */
  console.log('\n[2-4] Struktur-Fingerabdruck je Paar (D-01), benannte Ausnahmen, Vollstaendigkeit');
  const langswEntry = EXCLUSIONS.find((e) => e.id === 'X-langsw-order');
  if (!langswEntry) fail('scripts/lib/sync-exclusions.mjs: X-langsw-order fehlt in EXCLUSIONS');
  const langswParams = langswEntry
    ? { container: langswEntry.container, childPrefix: langswEntry.childPrefix }
    : undefined;
  const cutEntries = EXCLUSIONS.filter((e) => e.mode === 'cut-region');
  const cutUsage = new Map();

  let identicalCount = 0;
  let langswExplainedCount = 0;
  let cutRegionExplainedCount = 0;
  const unexplained = [];

  for (const [enPath, dePath] of pairs) {
    const result = comparePair(enPath, dePath, langswParams, cutEntries, cutUsage);
    if (result.status === 'identical') identicalCount++;
    else if (result.status === 'langsw-explained') langswExplainedCount++;
    else if (result.status === 'cut-region-explained') cutRegionExplainedCount++;
    else unexplained.push(result);
  }

  console.log(`    Verglichene Paare: ${pairs.length}`);
  console.log(`    Zeichengleich: ${identicalCount}`);
  console.log(`    Allein durch ${langswEntry ? langswEntry.id : '?'} erklaert: ${langswExplainedCount}`);
  console.log(`    Allein durch eine cut-region-Ausnahme erklaert: ${cutRegionExplainedCount}`);
  console.log(`    Unerklaerter Rest (Soll 0): ${unexplained.length}`);

  if (REPORT_MODE) {
    const groups = new Map();
    for (const u of unexplained) {
      if (!groups.has(u.family)) groups.set(u.family, []);
      groups.get(u.family).push(u);
    }
    const sortedGroups = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
    console.log(`\n    Unerklaerter Rest, gruppiert nach erster abweichender Tokenfamilie (${sortedGroups.length} Gruppe(n)):`);
    for (const [family, items] of sortedGroups) {
      console.log(`      "${family}": ${items.length} Paar(e)`);
      for (const it of items.slice(0, 5)) {
        console.log(`        ${it.enPath} <-> ${it.dePath}`);
      }
    }
  } else if (unexplained.length) {
    fail(`${unexplained.length} Paar(e) mit unerklaerter Strukturabweichung:`);
    for (const u of unexplained.slice(0, 10)) printDiagnostic(u);
  }

  /* ---- Zusicherung 5: Zombie-Waechter ----
     Jede Ausnahme aus EXCLUSIONS muss in DIESEM Durchgang mindestens einmal
     gegriffen haben. X-langsw-order "greift" bei jedem Paar mit Status
     'langsw-explained' (langswExplainedCount); jede cut-region-Ausnahme
     "greift", wenn cutRegion() bei mindestens einem Paar tatsaechlich etwas
     entfernt hat (cutUsage, siehe applyCutRegionExclusions). Eine Ausnahme
     ohne jeden Treffer deckt keine echte Abweichung mehr — ihr Anlass ist
     entfallen und der Eintrag gehoert entfernt, nicht stehen gelassen. */
  console.log('\n[5] Zombie-Waechter: jede Ausnahme muss mindestens ein Paar erklaert haben');
  for (const ex of EXCLUSIONS) {
    const usedCount = ex.mode === 'multiset-children' ? langswExplainedCount : cutUsage.get(ex.id) || 0;
    console.log(`    ${ex.id}: ${usedCount} erklaerte(s)/geschnittene(s) Paar(e)`);
    if (usedCount === 0) {
      fail(`Ausnahme ${ex.id} trifft auf kein Paar mehr zu — Anlass entfallen, Eintrag entfernen`);
    }
  }

  const elapsedMs = Date.now() - t0;
  console.log(`\nLaufzeit: ${elapsedMs} ms`);

  if (REPORT_MODE) {
    console.log('\nverify-sync --report: Erstbefund abgeschlossen (immer Exit 0, unabhaengig vom Ergebnis)');
    process.exit(0);
  }

  console.log(`\nverify-sync: ${ok ? 'ALLE ZUSICHERUNGEN ERFUELLT ✓' : 'FEHLGESCHLAGEN ✗'}`);
  if (!ok) process.exit(1);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main();
