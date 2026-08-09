/* ============================================================
   verify-theme-gen.mjs — THEME-02: kein generierter Hellmodus-Block
   wurde von Hand veraendert (D-04).

   Ruft die DREI ECHTEN Generatoren hinter `npm run theme`
   (build-light-palettes.mjs, tokenize-theme-colors.mjs,
   build-light-overrides.mjs) auf, in genau dieser Reihenfolge — statt
   ihre Ableitungsregeln nachzubauen, wird das tatsaechliche Skript
   ausgefuehrt. Der Waechter kann deshalb nicht von den Generatoren
   selbst abweichen.

   ⚠⚠ Laeuft NIEMALS gegen den Arbeitsbaum. Alle drei Generatoren
   schreiben in jede .astro-Datei unter src/, ohne zu fragen (Codemod-
   Skripte, keine Pruefungen) — ein Lauf gegen den echten Baum veraendert
   laut 04-RESEARCH.md 67 Dateien unangekuendigt. Dieser Waechter legt
   deshalb VORHER eine Kopie unter os.tmpdir() an, lenkt das
   Arbeitsverzeichnis der Generatoren dorthin um und vergleicht danach
   den ECHTEN Bestand gegen diese Ablage. Die Ablage wird am Ende immer
   geloescht (auch im Fehlerfall, `finally`), und Zusicherung 3 prueft
   zusaetzlich maschinell, dass `src/` und `assets/` unveraendert
   geblieben sind.

   ------------------------------------------------------------
   WAS DIESER WAECHTER ABDECKT UND WAS NICHT

   Abgedeckt: die beiden markierten Bloecke, die `npm run theme`
   tatsaechlich erzeugt, ueber ALLE .astro-Dateien unter src/:
     Block A  der Kommentar "Hellmodus — erzeugt von
              build-light-palettes.mjs" gefolgt von
              :root[data-theme="light"]{...}
     Block B  der Abschnitt ab der Marke "Hell-Entsprechungen — erzeugt
              von build-light-overrides.mjs" bis zum Ende des
              jeweiligen <style>-Blocks

   NICHT abgedeckt: `assets/theme.css`. Alle drei Generatoren globben
   ausschliesslich .astro-Dateien unter src/ — diese Datei liegt
   ausserhalb ihres Suchbereichs, obwohl ihr eigener Kopfkommentar
   bislang das Gegenteil behauptet hat (04-RESEARCH.md Fund 2, in Task 2 dieses
   Plans richtiggestellt: assets/theme.css traegt jetzt die Marke
   HANDGEPFLEGT). Die Generator-Glob zu erweitern waere eine echte
   Verhaltensaenderung an `npm run theme` und ist in dieser Phase
   ausdruecklich NICHT vorgesehen (04-RESEARCH.md Annahme A2, offene
   Frage 2) — dieser Waechter deckt nur ab, was die Generatoren
   tatsaechlich anfassen.

   NICHT abgedeckt, informativ (live gemessen, nicht eingefroren):
   `tokenize-theme-colors.mjs` hinterlaesst KEINEN markierten Block;
   sein Ergebnis fliesst nur mittelbar in Block B ein. Ein `--dry`-Lauf
   gegen den sauberen Bestand meldete bei Planausfuehrung (08.-09.08.2026)
   4 ausstehende Deklarationen in 3 Dateien (SiteNav.astro, vom Skript
   selbst als "nicht zuordenbar" gemeldet). Dieser Rest liegt ausserhalb
   der Bloecke A/B und wird deshalb NICHT geprueft — die Zahl wird bei
   jedem Lauf frisch gemessen und unten ausgegeben, nie als Schwelle
   eingefroren (D-03).

   KEINE Ausnahme mehr (Stand 09.08.2026). Die einzige, die es je gab —
   X-shipsoverview-fcard-status-fr — beschrieb eine "fehlende
   Hell-Entsprechung" fuer `.fcard__status.fr`. Nachgesehen: die Zeile
   stand laengst im Bestand und war ausgeliefert; die tatsaechliche
   Abweichung waren drei Zeilen handgeschriebener Kommentar IM erzeugten
   Block. Der Merkposten steht jetzt ueber dem Blockanfang, der Block ist
   zeichengleich zur Generator-Ausgabe, die Ausnahme ist entfallen.
   Begruendung ausfuehrlich an ihrer alten Stelle unten. Bleibt die Liste
   leer, prueft Zusicherung 2 ohne jeden Abzug — der schaerfste Zustand.
   ------------------------------------------------------------

   Waehrend der Planausfuehrung wurden zwei echte, vorbestehende Bugs in
   build-light-overrides.mjs gefunden UND behoben (Rule 1 — direkt durch
   den in diesem Task vorgeschriebenen echten Lauf entdeckt, siehe
   04-03-SUMMARY.md fuer den vollen Befund):
     - stripTrailingRootRules() loeschte den GUELTIGEN generierten hellen
       Zwilling mit, wenn ein <style>-Block NUR aus der dunklen Palette
       plus ihrem hellen Zwilling bestand (PilotPage.astro).
     - topLevelRules() zaehlte Klammern INNERHALB von Kommentaren mit —
       ein Kommentar, der ueber CSS-Syntax redet (":root{}"-Block" als
       Prosa), riss die naechste echte Regel entzwei (ArmorSets.astro).
   Beide Fixes sind minimal (Kommentare/Randfall ueberspringen), aendern
   keine Ableitungsregel und sind in build-light-overrides.mjs selbst
   dokumentiert.

   Drei Zusicherungen, jede mit einer Soll-/Ist-Zeile, plus ein
   Zombie-Waechter fuer die Ausnahmeliste:

     1  Dateien mit erzeugten Bloecken > 0 — sonst prueft der Lauf Luft.
     2  Unerklaerte Abweichungen (normalisiert verglichen, nach Abzug
        benannter EXCLUSIONS) = 0.
     3  Arbeitsbaum unveraendert: `git status --porcelain src assets`
        ist nach dem Lauf leer.
     4  Zombie-Waechter: jede Ausnahme aus EXCLUSIONS muss in DIESEM
        Durchgang tatsaechlich gegriffen haben — sonst FEHLER (ihr
        Anlass ist entfallen, der Eintrag gehoert entfernt).

   Normalisierung vor dem Vergleich (04-RESEARCH.md Pitfall 1 — ein
   woertlicher Byte-Vergleich meldet Fehlalarme durch eine echte, aber
   rein whitespace-seitige Nicht-Idempotenz der Generatoren; gemessen an
   diesem Bestand: 103 Bloecke unterscheiden sich roh, aber NICHT mehr
   nach Normalisierung): \r\n? -> \n, Leerraum am Zeilenende weg, mehrere
   Leerzeilen auf eine. Verglichen wird NUR der Inhalt innerhalb der
   Bloecke A/B, nicht die ganze Datei.

     node scripts/verify-theme-gen.mjs
   ============================================================ */

import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, rmSync } from 'node:fs';
import { glob } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const GEN_PALETTES = join(SCRIPTS_DIR, 'build-light-palettes.mjs');
const GEN_TOKENIZE = join(SCRIPTS_DIR, 'tokenize-theme-colors.mjs');
const GEN_OVERRIDES = join(SCRIPTS_DIR, 'build-light-overrides.mjs');

/* ------------------------------------------------------------
   EXCLUSIONS — bekannte, benannte Faelle, in denen Block A/B NICHT mit
   dem Ergebnis der echten Generatoren uebereinstimmt, aus einem Grund,
   der NICHT "von Hand veraendert" ist. Vorbild scripts/lib/sync-
   exclusions.mjs: eine unbegruendete Ausnahme waere dasselbe wie ein
   blindes Tor — jeder Eintrag traegt deshalb eine Begruendung UND wird
   durch den Zombie-Waechter (Zusicherung 4) abgesichert.
   ------------------------------------------------------------ */
const EXCLUSIONS = [

];

/* ------------------------------------------------------------
   ENTFALLEN am 09.08.2026: X-shipsoverview-fcard-status-fr.

   Die Ausnahme beschrieb eine "fehlende Hell-Entsprechung" fuer
   .fcard__status.fr. Nachgesehen: die Zeile
   `:root[data-theme="light"] .fcard__status.fr{color:#046945}` stand
   laengst im Bestand UND war auf staging ausgeliefert — die
   Flight-Ready-Marke sah im Hellmodus bereits richtig aus. Ein
   Kontrollauf von build-light-overrides.mjs --only=ships/ShipsOverview
   hat exakt dieselbe Zeile erzeugt.

   Die echte Abweichung waren drei Zeilen handgeschriebener Kommentar IM
   erzeugten Block (Merkposten zum entfallenen .sdb__sub-Override) — also
   genau die Handaenderung, die THEME-02 verbietet. Der Merkposten steht
   jetzt UEBER dem Blockanfang, wo die Generatoren ihn nicht sehen; der
   Block ist damit zeichengleich zu ihrer Ausgabe und braucht keine
   Ausnahme mehr.

   Es wurde dabei KEINE neue sichtbare Farbe eingefuehrt (das war die
   Bedingung an WINDOWS.md id 7): #046945 war schon da.
   ------------------------------------------------------------ */

/* Literale Marken der Generatoren — dupliziert, nicht importiert: die
   drei Skripte exportieren nichts, und dieser Waechter aendert ihr
   Verhalten nicht (Plan-Vorgabe fuer Task 1: nur verify-theme-gen.mjs +
   package.json). Block-A-Regex ist WOERTLICH derselben Form wie der
   Entfernungs-Vorlauf in build-light-palettes.mjs selbst — aendert sich
   dort das Format, faellt es hier durch einen Regex-Fehlschlag auf,
   nicht durch stilles Uebersehen. */
const MARK_A = 'erzeugt von scripts/build-light-palettes.mjs';
const BEGIN_B = '/* Hell-Entsprechungen — erzeugt von scripts/build-light-overrides.mjs. Nicht von Hand ändern. */';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function blockARegex() {
  return new RegExp(`/\\* Hellmodus[^*]*${escapeRe(MARK_A)}[^*]*\\*/\\s*:root\\[data-theme="light"\\]\\{[^}]*\\}`, 'g');
}

function extractBlocksA(text) {
  return [...text.matchAll(blockARegex())].map((m) => m[0]);
}

function extractBlocksB(text) {
  const out = [];
  let idx = text.indexOf(BEGIN_B);
  while (idx !== -1) {
    const end = text.indexOf('</style>', idx);
    const stop = end === -1 ? text.length : end;
    out.push(text.slice(idx, stop));
    idx = text.indexOf(BEGIN_B, stop);
  }
  return out;
}

function normalize(s) {
  return s
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function firstDiffLine(a, b) {
  const la = a.split('\n');
  const lb = b.split('\n');
  const len = Math.max(la.length, lb.length);
  for (let i = 0; i < len; i++) {
    if (la[i] !== lb[i]) return { bestand: la[i] ?? '∅ (Zeile fehlt)', kopie: lb[i] ?? '∅ (Zeile fehlt)' };
  }
  return null;
}

function findExclusion(file, art) {
  const norm = file.replace(/\\/g, '/');
  return EXCLUSIONS.find((e) => e.file === norm && e.art === art);
}

/**
 * `git status --porcelain src assets` — oder `null`, wenn es hier gar keinen
 * Arbeitsbaum zu pruefen gibt.
 *
 * Der Build-Container hat weder das git-Programm noch ein Repository: das
 * Dockerfile kopiert den Quelltext hinein. Ein `execFileSync('git', ...)`
 * stirbt dort an ENOENT und riss bis zum 09.08.2026 das ganze neunte Tor
 * mit — sichtbar als "verify:theme fehlgeschlagen", obwohl die Zusicherungen
 * 1/2 sauber durchgelaufen waren. Unterschieden wird deshalb ausdruecklich
 * zwischen "Baum ist sauber" (leere Zeichenkette) und "es gibt keinen Baum"
 * (null) — ein schmutziger Baum faellt weiterhin durch.
 */
function workTreeStatus() {
  try {
    const inside = execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (inside !== 'true') return null;
  } catch {
    return null; // kein git-Programm oder kein Repository
  }
  return execFileSync('git', ['status', '--porcelain', 'src', 'assets'], { encoding: 'utf8' }).trim();
}

async function main() {
  const t0 = Date.now();
  let ok = true;
  const fail = (msg) => {
    ok = false;
    console.error(`  FEHLER: ${msg}`);
  };

  // Uebersprungene Zusicherungen bleiben im Schlussurteil sichtbar — ein Tor,
  // das stumm weniger prueft als es behauptet, ist schlimmer als kein Tor.
  const skips = [];
  const skipped = (was) => skips.push(was);

  const files = [];
  for await (const f of glob('src/**/*.astro')) files.push(f);
  console.log(`verify-theme-gen: ${files.length} .astro-Dateien unter src/ gefunden`);

  const tmpDir = mkdtempSync(join(tmpdir(), 'verify-theme-gen-'));
  const usedExclusions = new Set();

  // Zustand des Arbeitsbaums VOR dem Lauf festhalten. Zusicherung 3 will
  // wissen, ob DIESER Waechter den Baum veraendert hat — nicht, ob er
  // ueberhaupt schmutzig ist.
  //
  // ⚠ Vorher verglich sie gegen "leer" und schlug damit bei JEDER nicht
  // committeten Aenderung unter src/ oder assets/ an. Das machte die
  // Hausregel "vor jedem Push `npm run gate`" praktisch unbrauchbar: wer
  // gerade etwas geaendert hat — also immer, wenn man pushen will — bekam
  // ein rotes Tor ohne Anlass. Ein Fehlalarm, der genau dann zuschlaegt,
  // wenn man das Tor braucht, wird binnen einer Woche uebergangen (siehe
  // den Kommentar in audit-site.mjs). Gemessen und behoben am 09.08.2026.
  const baumVorher = workTreeStatus();

  function printResult() {
    const elapsedMs = Date.now() - t0;
    console.log(`\nLaufzeit: ${elapsedMs} ms`);
    for (const s of skips) console.log(`Uebersprungen: Zusicherung ${s}`);
    const suffix = skips.length ? ` (${skips.length} uebersprungen, siehe oben)` : '';
    console.log(`\nverify-theme-gen: ${ok ? 'ALLE PRUEFBAREN ZUSICHERUNGEN ERFUELLT ✓' + suffix : 'FEHLGESCHLAGEN ✗'}`);
    if (!ok) process.exitCode = 1;
  }

  try {
    for (const f of files) {
      const dest = join(tmpDir, f);
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(f, dest);
    }

    console.log('\n[0] Generatoren gegen die Ablagekopie ausfuehren (Reihenfolge wie `npm run theme`)');
    for (const [label, script] of [
      ['build-light-palettes.mjs', GEN_PALETTES],
      ['tokenize-theme-colors.mjs', GEN_TOKENIZE],
      ['build-light-overrides.mjs', GEN_OVERRIDES],
    ]) {
      try {
        const out = execFileSync(process.execPath, [script], { cwd: tmpDir, encoding: 'utf8' });
        console.log(`    ${label}: ${out.trim().split('\n')[0]}`);
      } catch (err) {
        fail(`${label} ist gegen die Ablagekopie abgebrochen: ${err.message}`);
        if (err.stdout) console.error(err.stdout);
        if (err.stderr) console.error(err.stderr);
        printResult();
        return;
      }
    }

    console.log('\n[1-2] Bloecke A/B je Datei vergleichen (Bestand vs. Ablage, normalisiert, EXCLUSIONS angewandt)');
    let filesWithBlocks = 0;
    let deviatingBlocks = 0;
    const diffs = [];

    for (const f of files) {
      const bestand = readFileSync(f, 'utf8');
      const kopie = readFileSync(join(tmpDir, f), 'utf8');

      const aBestand = extractBlocksA(bestand);
      const aKopie = extractBlocksA(kopie);
      const bBestand = extractBlocksB(bestand);
      const bKopie = extractBlocksB(kopie);

      if (aBestand.length || bBestand.length) filesWithBlocks++;

      if (aBestand.length !== aKopie.length) {
        const ex = findExclusion(f, 'A');
        if (ex && aKopie.length > aBestand.length) usedExclusions.add(ex.id);
        else {
          deviatingBlocks++;
          diffs.push({ file: f, art: 'A', grund: `Blockzahl ${aBestand.length} (Bestand) != ${aKopie.length} (Ablage)` });
        }
      } else {
        for (let i = 0; i < aBestand.length; i++) {
          const nb = normalize(aBestand[i]);
          const nk = normalize(aKopie[i]);
          if (nb !== nk) {
            deviatingBlocks++;
            diffs.push({ file: f, art: `A[${i}]`, bestand: nb, kopie: nk });
          }
        }
      }

      if (bBestand.length !== bKopie.length) {
        const ex = findExclusion(f, 'B');
        if (ex && ex.kind === 'missing-in-bestand' && bKopie.length > bBestand.length) usedExclusions.add(ex.id);
        else {
          deviatingBlocks++;
          diffs.push({ file: f, art: 'B', grund: `Blockzahl ${bBestand.length} (Bestand) != ${bKopie.length} (Ablage)` });
        }
      } else {
        for (let i = 0; i < bBestand.length; i++) {
          const nb = normalize(bBestand[i]);
          const nk = normalize(bKopie[i]);
          if (nb !== nk) {
            deviatingBlocks++;
            diffs.push({ file: f, art: `B[${i}]`, bestand: nb, kopie: nk });
          }
        }
      }
    }

    console.log(`    Dateien mit erzeugten Bloecken (Soll > 0): ${filesWithBlocks}`);
    if (filesWithBlocks === 0) fail('Kein Lauf hat einen erzeugten Block gefunden — der Waechter prueft Luft');

    console.log(`    Unerklaerte Abweichungen (Soll 0, nach EXCLUSIONS): ${deviatingBlocks}`);
    if (deviatingBlocks) {
      fail(`${deviatingBlocks} Block/Bloecke weichen vom Ergebnis der echten Generatoren ab:`);
      for (const d of diffs.slice(0, 20)) {
        if (d.grund) {
          console.error(`      ${d.file} [${d.art}]: ${d.grund}`);
        } else {
          const fd = firstDiffLine(d.bestand, d.kopie);
          console.error(`      ${d.file} [${d.art}] — erste abweichende Zeile:`);
          console.error(`        Bestand: ${fd.bestand}`);
          console.error(`        Ablage:  ${fd.kopie}`);
        }
      }
      if (diffs.length > 20) console.error(`      ... und ${diffs.length - 20} weitere`);
    }
    if (usedExclusions.size) {
      console.log(`    Durch EXCLUSIONS erklaert (nicht in obiger Zahl enthalten): ${[...usedExclusions].join(', ')}`);
    }

    console.log('\n[3] Der Waechter hat den Arbeitsbaum nicht veraendert (git status --porcelain src assets)');
    const status = workTreeStatus();
    if (status === null) {
      // Im Build-Container gibt es weder git noch einen Arbeitsbaum: der Quelltext
      // ist eine COPY, kein Bestand, den ein Generator schmutzig machen koennte.
      // Ohne diesen Zweig stirbt der Waechter dort an `spawnSync git ENOENT` — das
      // neunte Dockerfile-Tor konnte nie gruen werden (staging blieb am 08.08.2026
      // knapp 4 Stunden auf dem letzten guten Stand stehen).
      console.log('    uebersprungen: kein git-Arbeitsbaum (Build-Container)');
      console.log('    — hier gibt es keinen Bestand, den die Generatoren veraendern koennten;');
      console.log('      die Zusicherungen 1/2/4 laufen unveraendert und tragen das Tor.');
      skipped('3 (Arbeitsbaum) — kein git-Arbeitsbaum vorhanden');
    } else {
      // Verglichen wird VORHER gegen NACHHER, nicht gegen "leer" — siehe
      // die Begruendung bei `baumVorher` oben.
      const zeilen = (s) => (s ? s.split('\n').length : 0);
      console.log(`    vor dem Lauf: ${zeilen(baumVorher)} Zeile(n)   danach: ${zeilen(status)} Zeile(n)   Soll: unveraendert`);
      if (status !== baumVorher) {
        const vorherSet = new Set((baumVorher || '').split('\n').filter(Boolean));
        const neu = status.split('\n').filter((z) => z && !vorherSet.has(z));
        fail(`Der Waechter hat den Arbeitsbaum veraendert:\n${neu.join('\n') || status}`);
      } else if (status) {
        console.log('    (der Baum war schon vorher schmutzig — nicht committete Aenderungen, das ist hier kein Befund)');
      }
    }

    console.log('\n[4] Zombie-Waechter: jede EXCLUSIONS-Ausnahme muss in diesem Durchgang gegriffen haben');
    for (const ex of EXCLUSIONS) {
      const hit = usedExclusions.has(ex.id);
      console.log(`    ${ex.id}: ${hit ? 'getroffen' : 'NICHT getroffen'}`);
      if (!hit) fail(`Ausnahme ${ex.id} trifft nicht mehr zu — Anlass entfallen, Eintrag aus EXCLUSIONS entfernen`);
    }

    console.log('\n[informativ, nicht Teil der Zusicherungen] tokenize-theme-colors.mjs --dry gegen den sauberen Bestand');
    try {
      const dryOut = execFileSync(process.execPath, [GEN_TOKENIZE, '--dry'], { encoding: 'utf8' });
      console.log('    ' + dryOut.trim().split('\n')[0]);
      console.log('    (liegt ausserhalb der Bloecke A/B — siehe Kopfkommentar "Was dieser Waechter abdeckt")');
    } catch (err) {
      console.log(`    Probelauf fehlgeschlagen (rein informativ, aendert das Ergebnis nicht): ${err.message}`);
    }

    printResult();
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

main();
