/* ============================================================
   verify-action-pins.mjs — Schiene B: stammt jeder angeheftete Commit einer
   Action wirklich aus dem Repo der Action?

   WARUM ES DEN GIBT (Durchsicht des oeffentlichen Repos, 27.11.2026):
   verify:supply-chain prueft nur die FORM des Pins (`owner/repo@<40 hex>`).
   GitHub liefert unter `owner/repo@<sha>` aber auch Commits aus, die nur in
   einem Fork liegen (das ganze Fork-Netz teilt sich die Objekte). Ein Pin
   auf einen solchen Commit sieht aus wie jeder andere, hat die richtige
   Form und laeuft trotzdem fremden Code. Dazu stand an einem Pin eine
   falsche Version im Kommentar (`# v4` an einem Commit von v5.0.1) — die
   Form-Pruefung kann das nicht sehen.

   GEPRUEFT: jede `uses:`-Zeile aus .github/workflows/ und den Vorlagen
   (dieselben Dateien wie verify:supply-chain). Je Repo werden alle Zweige
   und Tags OHNE Inhalte geholt (git fetch --filter=tree:0, nur Commits),
   und der Commit muss in `git rev-list --all` stehen, also von einem Zweig
   oder Tag aus erreichbar sein. refs/pull/* zaehlt nicht. Nachladen ist
   abgeschaltet (GIT_NO_LAZY_FETCH): ein Teilklon holte ein fehlendes Objekt
   sonst still nach, und eine reine "liegt vor"-Abfrage waere dann auch fuer
   einen Fork-Commit wahr (so im unabhaengigen Review vom 28.11.2026
   gefunden, bevor die Pruefung je lief).

   URTEIL (Grundsatz 3):
     FEHLER   der Commit liegt auf keinem Zweig und keinem Tag des eigenen
              Repos (Fork-Commit, geloeschter Stand) — die Handlungsanweisung
              "auf den Commit eines Release-Tags anheften" ist immer richtig;
              weniger Pins oder Repos als die Klinke.
     WARNUNG  kein Tag zeigt auf den Commit (Stand zwischen zwei Releases);
              die Version im Kommentar passt zu keinem Tag des Commits, oder
              es steht keine dabei. Bewusst nur WARNUNG: verschiebt das
              Repo der Action einen Tag (Fremdquelle; genau so sah im Maerz
              2025 der Angriff auf tj-actions aus), waere "Kommentar
              anpassen" falsch — dann muss ein Mensch hinsehen.

   AUFRUF (Schiene B: braucht git und Netz zu github.com)
     node scripts/verify-action-pins.mjs
   Laeuft ausserdem in .github/workflows/pr-check.yml (Job action-pins).

   Vorgefuehrt rot (28.11.2026), jeweils actions/checkout in pr-check.yml
   umgeschrieben (die Form stimmt, verify:supply-chain bleibt gruen):
     auf einen Commit dieses Repos und auf 2f547d07…, den Kopf von
     refs/pull/2588 in actions/checkout (auf keinem Zweig, keinem Tag):
     FEHLER: .github/workflows/pr-check.yml:44: actions/checkout@2f547d07…
     liegt auf keinem Zweig und keinem Tag von actions/checkout …
   Die erste Fassung (Abfrage per cat-file) meldete fuer 2f547d07… nur eine
   WARNUNG und Exit 0: git hatte den Commit still nachgeladen. Dazu die
   WARNUNG am Kommentar `# v4` der dependency-review-action (Commit traegt
   v5.0.1), vor dessen Korrektur.

   Exit: 0 gruen (WARNUNGEN erlaubt) · 1 FEHLER · 2 nicht geprueft (kein
   git, ein Repo nicht abrufbar).
   ============================================================ */
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WORKFLOW_VORLAGEN } from './lib/workflow-vorlagen.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW_DIR = '.github/workflows';

// Sperrklinken (Grundsatz 5), Stand 28.11.2026: 42 uses-Zeilen (mit dem
// eigenen Job in pr-check.yml) aus 8 Repos.
export const KLINKE = { pins: 42, repos: 8 };

/** Alle fremden `uses:`-Zeilen einer Datei: { zeile, ref, repo, sha, version }. */
export function pinsAusText(text) {
  const pins = [];
  text.replace(/\r\n/g, '\n').split('\n').forEach((z, i) => {
    if (/^\s*#/.test(z)) return;
    const m = /^\s*(?:-\s+)?uses:\s*['"]?([^\s'"#]+)['"]?\s*(?:#\s*(.*))?$/.exec(z);
    if (!m) return;
    const ref = m[1];
    if (ref.startsWith('./') || ref.startsWith('docker://')) return;
    const at = ref.lastIndexOf('@');
    const pfad = at > 0 ? ref.slice(0, at) : ref;
    const sha = at > 0 ? ref.slice(at + 1) : '';
    const [owner, name] = pfad.split('/');
    const version = /^(v?\d[\w.+-]*)/.exec((m[2] || '').trim())?.[1] || null;
    pins.push({ zeile: i + 1, ref, repo: `${owner}/${name}`, sha, version });
  });
  return pins;
}

/** Passt die Version im Kommentar zu einem der Tags des Commits? v4 passt zu v4.4.0. */
export function versionPasst(version, tags) {
  return tags.some((t) => t === version || t.startsWith(`${version}.`));
}

/**
 * Urteil fuer einen Pin. stand: { vorhanden, tags } aus dem geholten Repo
 * (vorhanden: der Commit ist von einem Zweig oder Tag aus erreichbar).
 */
export function urteil(pin, stand, ort) {
  const fehler = [];
  const warnungen = [];
  if (!/^[0-9a-f]{40}$/.test(pin.sha)) {
    // Die Form prueft verify:supply-chain; hier nur, damit kein Pin still durchrutscht.
    fehler.push(`${ort}: ${pin.ref} ist nicht per Commit-SHA angeheftet`);
    return { fehler, warnungen };
  }
  if (!stand.vorhanden) {
    fehler.push(`${ort}: ${pin.ref} liegt auf keinem Zweig und keinem Tag von ${pin.repo} -- ein Commit aus einem Fork oder ein geloeschter Stand; auf den Commit eines Release-Tags von ${pin.repo} anheften`);
    return { fehler, warnungen };
  }
  if (!stand.tags.length) {
    warnungen.push(`${ort}: ${pin.ref} traegt keinen Tag (Stand zwischen zwei Releases von ${pin.repo}) -- pruefen, ob das gewollt ist`);
  } else if (!pin.version) {
    warnungen.push(`${ort}: ${pin.ref} ohne Version im Kommentar (der Commit traegt ${stand.tags.join(', ')})`);
  } else if (!versionPasst(pin.version, stand.tags)) {
    warnungen.push(`${ort}: Kommentar nennt ${pin.version}, der Commit traegt ${stand.tags.join(', ')} -- Kommentar richtigstellen, ausser ${pin.repo} hat Tags verschoben (dann hinsehen)`);
  }
  return { fehler, warnungen };
}

function dateien() {
  const wf = readdirSync(join(ROOT, WORKFLOW_DIR))
    .filter((f) => /\.ya?ml$/.test(f))
    .sort()
    .map((f) => `${WORKFLOW_DIR}/${f}`);
  return [...wf, ...WORKFLOW_VORLAGEN];
}

const git = (args, opts = {}) =>
  execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
    // GIT_NO_LAZY_FETCH: der Abruf ohne Inhalte macht das Zeitverzeichnis zu
    // einem Teilklon, und git holte ein fehlendes Objekt sonst beim ersten
    // Zugriff still bei github.com nach -- auch einen Commit aus einem Fork.
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_NO_LAZY_FETCH: '1' },
    ...opts,
  });

/** Holt Zweige und Tags eines Repos ohne Inhalte; liefert (sha) => { vorhanden, tags }. */
function holeRepo(repo, basis) {
  const dir = join(basis, repo.replace('/', '__'));
  git(['init', '-q', '--bare', dir]);
  git(['-C', dir, 'fetch', '-q', '--filter=tree:0', '--no-tags', `https://github.com/${repo}`,
    '+refs/heads/*:refs/heads/*', '+refs/tags/*:refs/tags/*']);
  const tagsJe = new Map();
  const zeilen = git(['-C', dir, 'for-each-ref', '--format=%(refname:short) %(objectname) %(*objectname)', 'refs/tags']);
  for (const z of zeilen.split('\n').filter(Boolean)) {
    const [name, obj, peeled] = z.split(' ');
    const ziel = peeled || obj;
    if (!tagsJe.has(ziel)) tagsJe.set(ziel, []);
    tagsJe.get(ziel).push(name);
  }
  const zweige = git(['-C', dir, 'for-each-ref', '--format=%(refname)', 'refs/heads']).split('\n').filter(Boolean).length;
  // Erreichbar heisst: in der Geschichte eines Zweigs oder Tags. Bewusst kein
  // "liegt das Objekt vor" (cat-file): das waere auch nach einem Nachladen wahr.
  const erreichbar = new Set(
    git(['-C', dir, 'rev-list', '--all'], { maxBuffer: 256 * 1024 * 1024 }).split('\n').filter(Boolean),
  );
  return {
    zweige,
    tags: tagsJe.size,
    commits: erreichbar.size,
    stand: (sha) => ({ vorhanden: erreichbar.has(sha), tags: (tagsJe.get(sha) || []).sort() }),
  };
}

function main() {
  try { git(['--version']); } catch {
    console.error('\nverify-action-pins: NICHT GEPRUEFT -- git fehlt.\n');
    return 2;
  }
  const alle = [];
  for (const f of dateien()) {
    for (const p of pinsAusText(readFileSync(join(ROOT, f), 'utf8'))) alle.push({ ...p, datei: f });
  }
  const repos = [...new Set(alle.map((p) => p.repo))].sort();
  const basis = mkdtempSync(join(tmpdir(), 'action-pins-'));
  const fehler = [];
  const warnungen = [];
  const nichtGeprueft = [];
  console.log('\nverify-action-pins: Herkunft der angehefteten Actions');
  try {
    for (const repo of repos) {
      let r;
      try { r = holeRepo(repo, basis); } catch (e) {
        nichtGeprueft.push(`${repo}: nicht abrufbar (${String(e.stderr || e.message).trim().split('\n').pop()})`);
        continue;
      }
      const eigene = alle.filter((p) => p.repo === repo);
      console.log(`    ${repo.padEnd(36)} ${String(eigene.length).padStart(2)} Pins   ${r.zweige} Zweige, ${r.tags} getaggte Commits, ${r.commits} Commits erreichbar`);
      for (const p of eigene) {
        const u = urteil(p, r.stand(p.sha), `${p.datei}:${p.zeile}`);
        fehler.push(...u.fehler);
        warnungen.push(...u.warnungen);
      }
    }
  } finally {
    rmSync(basis, { recursive: true, force: true });
  }
  console.log(`\n    Pins: ${alle.length} (Klinke ${KLINKE.pins})   Repos: ${repos.length} (Klinke ${KLINKE.repos})   nicht abrufbar: ${nichtGeprueft.length}\n`);
  if (alle.length < KLINKE.pins) fehler.push(`nur ${alle.length} Pins gefunden, Klinke ${KLINKE.pins} -- der Leser laeuft leer`);
  if (repos.length < KLINKE.repos) fehler.push(`nur ${repos.length} Repos gefunden, Klinke ${KLINKE.repos}`);
  for (const w of warnungen) console.log(`WARNUNG: ${w}`);
  for (const n of nichtGeprueft) console.error(`NICHT GEPRUEFT: ${n}`);
  for (const f of fehler) console.error(`FEHLER: ${f}`);
  console.log(`\nverify-action-pins: FEHLER ${fehler.length} | WARNUNGEN ${warnungen.length} | NICHT GEPRUEFT ${nichtGeprueft.length}`);
  if (fehler.length) return 1;
  return nichtGeprueft.length ? 2 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exit(main()); } catch (e) {
    console.error(`\nverify-action-pins: NICHT GEPRUEFT -- ${e?.stack || e}\n`);
    process.exit(2);
  }
}
