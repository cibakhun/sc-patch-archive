/* ============================================================
   verify-supply-chain.mjs — haelt die Lieferkette fest: woher Pakete,
   Actions und Basis-Images kommen und mit welchen Rechten gebaut wird.

   WARUM ES DEN GIBT (Sicherheitsbefund vom 29.10.2026): Actions liefen
   ueber veraenderliche Tags (`@v4`), beide Dockerfiles bauten auf
   `nginx:alpine` / `node:22-…` ohne Digest, und der Job, der fremden
   npm-Code ausfuehrte, hielt zugleich das Schreibrecht fuer die Registry
   und den Coolify-Token. Jede dieser Stellen ist mit einer Zeile wieder
   aufgemacht — und nichts bricht dabei sichtbar. Deshalb ein Tor.

   Schiene A: liest nur Dateien. Kein git, kein Netz, kein Kindprozess.
   Im Docker-Build liegt .github mit im Kontext (.dockerignore), damit die
   Workflows auch dort geprueft werden.

   Fuenf Zusicherungen, alle FEHLER (die Handlungsanweisung dahinter ist
   immer richtig — es gibt keinen Fremdquellen-Verzug):
     1  Lockfiles: jedes Paket kommt von registry.npmjs.org und traegt
        einen sha512-Integritaets-Hash (npm ci prueft ihn beim Laden).
     2  Workflows: jede fremde Action per Commit-SHA angeheftet; jede
        Datei mit ausdruecklichem `permissions:`; kein
        `pull_request_target`; jeder Checkout ohne hinterlegtes Token
        (`persist-credentials: false`); kein Fremdtext aus dem Ereignis
        (Titel, Rumpf, Zweigname …) direkt in einer `run:`-Zeile (die
        Skripte liest ein YAML-Leser, js-yaml aus dem Lockfile).
     3  Dockerfiles: jedes Basis-Image per @sha256 angeheftet; in der
        LETZTEN Stufe (dem Image, das laeuft) wird kein Compiler
        installiert.
     4  Dependabot kennt jedes Lockfile-Verzeichnis, jedes Dockerfile und
        die Actions — Anheften ohne Nachziehen hiesse, Luecken
        festzuschreiben.
     5  Selbstauskunft und Sperrklinken: gedruckt wird, wie viel geprueft
        wurde; faellt eine Zahl unter ihre Klinke, laeuft der Waechter
        leer und reisst.

   Ausnahmen sind benannt (CHECKOUT_MIT_TOKEN) und tragen ihren Anlass.
   Verliert eine ihren Anlass, reisst das Tor (Zombie-Waechter).
   ============================================================ */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => p.replace(ROOT + '/', '').replace(ROOT + '\\', '');
const lesen = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const LOCKFILES = ['package-lock.json', 'discord/package-lock.json', 'discord/bot/package-lock.json'];
const DOCKERFILES = ['Dockerfile', 'discord/bot/Dockerfile'];
const WORKFLOW_DIR = '.github/workflows';
const REGISTRY = 'https://registry.npmjs.org/';

// Sperrklinken (Grundsatz 5). Nur nach oben; nach unten nur per Commit,
// dessen Botschaft die Ursache nennt. Stand 29.10.2026.
// Die Paketzahl schwankt mit jedem Dependabot-Update um einige Eintraege,
// deshalb dort etwas Luft; sie soll nur erkennen, dass ein Lockfile leer
// oder unlesbar geworden ist. Die uebrigen Zahlen aendern sich nur mit
// einer Workflow- oder Dockerfile-Aenderung und stehen auf dem Ist-Stand.
const KLINKE = {
  pakete: 480, // Summe ueber alle drei Lockfiles (gemessen 402 + 25 + 75 = 502)
  workflows: 11,
  actions: 35, // fremde `uses:`-Zeilen ueber alle Workflows
  checkouts: 14,
  runBloecke: 59, // 57 + Kopfzeilen-Pruefung nach beiden Deploys (29.10.2026)
  basisImages: 4,
};

// Benannte Ausnahmen: Workflow-Datei -> Anlass. Ein Checkout dort darf das
// Token hinterlegen. Derzeit keine — Pushes reichen das Token im
// Push-Schritt selbst herein (siehe build.yml, track-marketplace.yml).
const CHECKOUT_MIT_TOKEN = {};

const fail = [];
const need = (ok, msg) => { if (!ok) fail.push(msg); return ok; };
const zahl = {};

// ---------------------------------------------------------------- [1]
console.log('\n[1] Lockfiles: Herkunft registry.npmjs.org + sha512-Integritaet');
zahl.pakete = 0;
for (const f of LOCKFILES) {
  const abs = join(ROOT, f);
  if (!need(existsSync(abs), `${f} fehlt`)) continue;
  const lock = JSON.parse(lesen(abs));
  need(lock.lockfileVersion >= 2, `${f}: lockfileVersion ${lock.lockfileVersion} — ohne "packages"-Tabelle ist nichts pruefbar (npm >= 7 neu sperren)`);
  let n = 0;
  for (const [name, p] of Object.entries(lock.packages || {})) {
    if (name === '' || p.link || p.inBundle) continue;
    n++;
    need(typeof p.resolved === 'string' && p.resolved.startsWith(REGISTRY),
      `${f}: ${name} kommt nicht von ${REGISTRY} (${p.resolved ?? 'ohne resolved'}) — Git-, Tarball- und Spiegelquellen umgehen die Registry-Signatur`);
    need(/^sha512-[A-Za-z0-9+/]+=*$/.test(p.integrity || ''),
      `${f}: ${name} ohne sha512-Integritaet (${p.integrity ?? 'fehlt'}) — npm ci koennte ein ausgetauschtes Paket nicht erkennen`);
  }
  console.log(`    ${f.padEnd(32)} ${n} Pakete`);
  zahl.pakete += n;
}

// ---------------------------------------------------------------- [2]
console.log('\n[2] Workflows: angeheftete Actions, Rechte, Checkout, Fremdtext');
const einr = (z) => z.match(/^\s*/)[0].length;
const ohneKommentar = (z) => (/^\s*#/.test(z) ? '' : z);
// Fremdtext aus dem Ausloeser — in `run:` wird er zu Shell-Code. Zahlen
// und Kennungen (…number, …id, …sha) sind kein Fremdtext.
// Gesucht wird in JEDEM Ausdruck, nicht nur im nackten `${{ pfad }}`:
// `${{ github.head_ref || 'x' }}`, `${{ toJSON(github.event) }}`, die
// Klammerform (`github['event']['issue']['title']`), Leerzeichen zwischen
// den Teilen, jede Schreibweise (Actions unterscheidet bei Namen nicht nach
// Gross/Klein) und der ganze Kontext (`toJSON(github)`, `github.*`) setzen
// denselben Text ein. Ein Ausdruck endet wie bei Actions erst am `}}`
// ausserhalb von '…' — `format('{{"a":"{0}"}}', …)` baut so JSON. '…' ist
// eine Zeichenkette, kein Zugriff; als Index (`x['name']`) wird daraus der
// Zugriff `x.name`, damit `steps['github']` nicht als Kontext gilt.
const AUSDRUCK = /\$\{\{((?:'[^']*'|[^'}]|\}(?!\}))*)\}\}/g;
const ohneText = (x) => x.replace(/\[\s*'([\w-]+)'\s*\]|'[^']*'/g, (m, idx) => (idx !== undefined ? `.${idx}` : "''"));
const FREMDTEXT = /(?<![\w.-])github\s*(?:\.\s*head_ref\b|\.\s*event\b(?:\s*\.\s*[\w-]+|\s*\[[^\]]*\]|\s*\.\s*\*)*)/gi;
// Ein `[` hinter `github`, das ohneText stehen liess, ist ein berechneter
// Index (`github[format('{0}', 'head_ref')]`) und damit wieder der ganze Kontext.
const GANZ = /(?<![\w.-])github\b(?!\s*\.)|(?<![\w.-])github\s*\.\s*\*/gi;
const HARMLOS = /\.(number|id|sha|size|draft|merged|run_id|run_number)$/i;
// In das Skript kommt nur der WERT des Ausdrucks, und gesucht wird nur in
// den Operanden, die zu ihm werden koennen. || liefert einen seiner
// Operanden; && liefert den linken nur, wenn er falsy ist ('', 0, false,
// null, NaN: kein Fremdtext), sonst den rechten. Je ||-Teil zaehlt also
// nur das letzte &&-Glied. Ein Glied, das nur true/false liefert (ein
// Vergleich oder `!…` auf oberster Ebene, ein Aufruf von contains,
// startsWith oder endsWith; dahinter kann in gueltiger Syntax nur ein
// Operator stehen), traegt nichts ein; eine Klammer um einen ganzen
// Ausdruck wird ebenso zerlegt. Literale enthalten nach ohneText keinen
// Pfad mehr. So bleiben `a == 'x' && '--flag' || ''` und
// `github.head_ref && 'pr' || 'push'` frei, `a == 'x' && github.event.issue.body`
// ist ein Treffer. Erwartet den Ausdruck nach ohneText.
function teilen(x, op) {
  const out = [];
  let tiefe = 0, start = 0;
  for (let i = 0; i < x.length; i++) {
    const c = x[i];
    if (c === '(' || c === '[') tiefe++;
    else if (c === ')' || c === ']') tiefe--;
    else if (tiefe === 0 && x.startsWith(op, i)) { out.push(x.slice(start, i)); start = i + op.length; i++; }
  }
  return [...out, x.slice(start)];
}
function nurWahrheitswert(t) {
  let tiefe = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t[i], zwei = t.slice(i, i + 2);
    if (c === '(' || c === '[') tiefe++;
    else if (c === ')' || c === ']') tiefe--;
    else if (tiefe === 0 && (['==', '!=', '<=', '>='].includes(zwei) || c === '<' || c === '>')) return true;
  }
  return t.startsWith('!') || /^(?:contains|startsWith|endsWith)\s*\(/i.test(t);
}
function ganzGeklammert(t) {
  if (!t.startsWith('(')) return false;
  let tiefe = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '(' || t[i] === '[') tiefe++;
    else if ((t[i] === ')' || t[i] === ']') && --tiefe === 0) return i === t.length - 1;
  }
  return false;
}
function wertGlieder(x) {
  return teilen(x, '||').flatMap((teil) => {
    const glied = teilen(teil, '&&').at(-1).trim();
    if (nurWahrheitswert(glied)) return [];
    return ganzGeklammert(glied) ? wertGlieder(glied.slice(1, -1)) : [glied];
  });
}
const fremd = (s) => [...s.matchAll(AUSDRUCK)].flatMap(([, roh]) => wertGlieder(ohneText(roh)).flatMap((x) => {
  const pfade = [...x.matchAll(FREMDTEXT)].map((t) => t[0].replace(/\s+/g, '')).filter((p) => !HARMLOS.test(p));
  return [...pfade, ...[...x.matchAll(GANZ)].map((t) => t[0].replace(/\s+/g, ''))];
}));

// Jeder `run:`-Schritt mit dem Skript, das Actions daraus macht. Gelesen
// wird mit einem YAML-Leser statt mit Zeilenregeln: ob eine `#`-Zeile
// Shell-Kommentar (wird ersetzt) oder YAML-Kommentar (wird es nicht) ist,
// wie weit `|2` einrueckt, was in "…" oder hinter `!!str` steht, entscheidet
// so der Leser wie bei GitHub. js-yaml kommt mit astro (package-lock.json).
let yaml = null;
try { yaml = (await import('js-yaml')).default; } catch (e) {
  need(false, `js-yaml laesst sich nicht laden (${e.code || e.message}) — ohne YAML-Leser bleiben run:-Bloecke ungeprueft. Kommt mit astro; npm ci gelaufen?`);
}
function runSkripte(text, name) {
  if (!yaml) return [];
  let doc;
  try { doc = yaml.load(text); } catch (e) {
    fail.push(`${name}: kein gueltiges YAML (${e.reason || e.message}) — GitHub lehnt den Workflow ebenso ab`);
    return [];
  }
  const out = [];
  for (const [job, def] of Object.entries(doc?.jobs || {})) {
    (Array.isArray(def?.steps) ? def.steps : []).forEach((st, n) => {
      // Auch Skripte, die eine Action als Eingabe nimmt (`with: run:` bei
      // Container- und VM-Actions, `with: script:` bei github-script).
      for (const [quelle, text] of [['', st?.run], [' with.run', st?.with?.run], [' with.script', st?.with?.script]]) {
        if (typeof text === 'string') out.push({ ort: `Job ${job}, Schritt ${n + 1}${st.name ? ` (${st.name})` : ''}${quelle}`, text });
      }
    });
  }
  return out;
}

// Selbstprobe: faellt ein Muster auf eine engere oder weitere Form zurueck,
// merkt es sonst niemand — die Workflows enthalten heute keinen Treffer.
for (const s of ['${{ github.head_ref || github.ref_name }}', "${{ github.event.pull_request.title || '' }}",
  '${{ toJSON(github.event) }}', "${{ github.event['pull_request']['title'] }}", '${{ github.event.issue.body }}',
  `\${{ format('{{"a":"{0}"}}', github.event.issue.title) }}`, "${{ format('}}', github.event.issue.title) }}",
  '${{ GitHub.head_ref }}', '${{ github.EVENT.issue.title }}', "${{ github['event']['issue']['title'] }}", "${{ github['head_ref'] }}",
  "${{ github['EVENT'].issue.title }}", '${{ github . event . issue . title }}', "${{ github ['event'].issue.title }}",
  '${{ toJSON(github) }}', '${{ github.* }}', '${{ fromJSON(toJSON(github)).event.issue.title }}',
  "${{ contains(github.event.issue.labels.*.name, 'bug') || github.event.issue.title }}",
  "${{ format('{0}{1}', github.event.issue.title, 1 == 1) }}", "${{ github.event.issue.title == 'a' && github.event.issue.body }}",
  '${{ (github.event.issue.title) }}', "${{ github.event.inputs.x == 'true' && github.event.inputs.y || '' }}",
  "${{ (github.event.issue.title == 'a') || github.event.issue.body }}", "${{ '' || github.head_ref }}",
  "${{ steps.a.outputs.b && github.event.issue.body }}", "${{ (github.event_name == 'x' && github.event.issue.body) || '' }}",
  "${{ github.event.issue.title || 'It''s' }}", "${{ (github.event.issue.title).x }}",
  "${{ case(github.event_name == 'push' && !contains(github.ref, 'x'), 'prod', github.head_ref) }}",
  "${{ github[format('{0}', 'head_ref')] }}", "${{ toJSON(github[('event')]) }}"])
  need(fremd(s).length > 0, `Selbstprobe: ${s} wird nicht als Fremdtext erkannt — AUSDRUCK/FREMDTEXT/GANZ pruefen`);
for (const s of ['${{ github.event_name }}', '${{ GITHUB.EVENT_NAME }}', '${{ github.event.pull_request.number || 0 }}',
  '${{ github.event.pull_request.NUMBER }}', '${{ github . event . pull_request . number }}', '${{ steps.a.outputs.b }}',
  "${{ contains(github.event_name, 'github') }}", "${{ format('github.event.issue.title {0}', github.run_id) }}",
  '${{ secrets.GITHUB_TOKEN }}', '${{ steps.github.outputs.event }}', '${{ github.token }}',
  "${{ format('{0}}}', github.run_id) }} github.event.issue.title }}",
  "${{ steps['github'].outputs.x }}", "${{ needs['github-pages'].outputs.url }}", "${{ x['github.event.issue.title'] }}",
  "${{ contains(github.event.issue.labels.*.name, 'bug') }}", "${{ startsWith(github.head_ref, 'dependabot/') }}",
  '${{ github.event.pull_request.head.repo.full_name == github.repository }}', '${{ !github.event.issue.title }}',
  "${{ github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name != github.repository }}",
  "${{ contains(github.event.pull_request.labels.*.name, 'skip-e2e') && '--skip' || '' }}",
  "${{ github.event.inputs.dry_run == 'true' && '--dry-run' || '' }}", "${{ (github.event.issue.title == 'x') }}",
  "${{ (contains(github.event.issue.labels.*.name, 'bug')) }}", "${{ github.event.pull_request.merged == true && 1 || 0 }}",
  "${{ startsWith(github.head_ref, 'release/') && env.RELEASE_URL || env.DEV_URL }}",
  "${{ github.event.action == 'published' && steps.meta.outputs.tag || 'nightly' }}",
  "${{ github.head_ref && 'pr' || 'push' }}", "${{ github.event.issue.pull_request && 'pr' || 'issue' }}",
  "${{ github.event.inputs.x == 'a' && 'It''s' || '' }}", "${{ (github.event_name == 'x' && 'a') || 'b' }}"])
  need(fremd(s).length === 0, `Selbstprobe: ${s} gilt faelschlich als Fremdtext — AUSDRUCK/FREMDTEXT/GANZ pruefen`);
const probe = (...schritte) => runSkripte(['on: push', 'permissions: {}', 'jobs:', '  j:', '    runs-on: x', '    steps:', ...schritte].join('\n'), 'Selbstprobe')
  .flatMap((b) => fremd(b.text));
for (const [soll, wozu, schritte] of [
  [1, 'Shell-Kommentar in `run: |`', ['      - run: |', '          # ${{ github.event.issue.body }}', '          echo hi']],
  [0, 'YAML-Kommentar unter `run: befehl`', ['      - run: npm test', '        # nicht ${{ github.event.issue.title }}']],
  [0, 'flacherer YAML-Kommentar nach `run: |`', ['      - run: |', '          echo hi', '         # ${{ github.head_ref }}']],
  [1, 'Einrueckungsangabe `run: |2`', ['      - run: |2', '            echo first', '          echo "${{ github.event.issue.title }}"']],
  [1, '`#`-Zeile in "…"', ['      - run: "echo a', '          # ${{ github.event.issue.title }}', '          echo b"']],
  [1, '`run: !!str |`', ['      - run: !!str |', '          # ${{ github.event.issue.body }}']],
  [1, '`with: run:` einer Action', ['      - uses: a/b@c', '        with:', '          run: echo "${{ github.event.issue.title }}"']],
  [1, '`with: script:` (github-script)', ['      - uses: a/b@c', '        with:', '          script: console.log("${{ github.event.issue.title }}")']],
]) need(probe(...schritte).length === soll, `Selbstprobe: ${wozu} — erwartet ${soll} Treffer, runSkripte pruefen`);

const wfDir = join(ROOT, WORKFLOW_DIR);
const wfs = existsSync(wfDir) ? readdirSync(wfDir).filter((f) => /\.ya?ml$/.test(f)).sort() : [];
need(wfs.length > 0, `${WORKFLOW_DIR}/ fehlt oder ist leer — im Docker-Build: steht .github wieder in .dockerignore?`);
zahl.workflows = wfs.length;
zahl.actions = 0; zahl.checkouts = 0; zahl.runBloecke = 0;
const ausnahmeGebraucht = new Set();

for (const f of wfs) {
  const name = `${WORKFLOW_DIR}/${f}`;
  const zeilen = lesen(join(wfDir, f)).split('\n');
  const code = zeilen.map(ohneKommentar);

  need(code.some((z) => /^permissions\s*:/.test(z)),
    `${name}: kein Workflow-weites \`permissions:\` — dann gilt die Repo-Vorgabe, im schlimmsten Fall Schreibrecht auf alles`);
  need(!code.some((z) => /\bpull_request_target\b/.test(z)),
    `${name}: \`pull_request_target\` fuehrt Code aus Fork-PRs mit den Rechten und Secrets dieses Repos aus — \`pull_request\` nehmen`);

  code.forEach((z, i) => {
    const m = /^\s*(?:-\s+)?uses:\s*['"]?([^\s'"#]+)/.exec(z);
    if (m) {
      const ref = m[1];
      if (ref.startsWith('./') || ref.startsWith('docker://')) return;
      zahl.actions++;
      need(/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/.test(ref),
        `${name}:${i + 1}: ${ref} ist nicht per Commit-SHA angeheftet — ein Tag kann jederzeit auf anderen Code zeigen (Version als Kommentar dahinter, Dependabot hebt beides an)`);
      if (/^actions\/checkout@/.test(ref)) {
        zahl.checkouts++;
        // Der Schritt: von seinem "- " bis zur naechsten Zeile auf gleicher
        // oder kleinerer Einrueckung.
        let s = i;
        while (s > 0 && !/^\s*-\s/.test(code[s])) s--;
        const tiefe = einr(code[s]);
        let e = s + 1;
        while (e < code.length && (code[e].trim() === '' || einr(code[e]) > tiefe)) e++;
        const block = code.slice(s, e).join('\n');
        const ohneToken = /persist-credentials:\s*['"]?false/.test(block);
        if (CHECKOUT_MIT_TOKEN[f]) { if (!ohneToken) ausnahmeGebraucht.add(f); }
        else need(ohneToken, `${name}:${i + 1}: Checkout ohne \`persist-credentials: false\` — das Token liegt sonst in .git/config, lesbar fuer jeden folgenden Schritt und jedes installierte Paket`);
      }
    }
  });
  for (const { ort, text } of runSkripte(zeilen.join('\n'), name)) {
    zahl.runBloecke++;
    for (const pfad of fremd(text)) {
      fail.push(`${name}: ${ort}: ${pfad} steht in einem \${{ }}-Ausdruck direkt im Skript — Fremdtext wird so zu Code. Ueber \`env:\` hereinreichen und als "$VARIABLE" (in github-script: process.env.VARIABLE) verwenden.`);
    }
  }
}
for (const [f, warum] of Object.entries(CHECKOUT_MIT_TOKEN)) {
  need(wfs.includes(f), `Ausnahme CHECKOUT_MIT_TOKEN["${f}"] (${warum}): die Datei gibt es nicht mehr — Eintrag entfernen`);
  need(!wfs.includes(f) || ausnahmeGebraucht.has(f), `Ausnahme CHECKOUT_MIT_TOKEN["${f}"] (${warum}) ist ein Zombie: kein Checkout dort hinterlegt mehr das Token — Eintrag entfernen`);
}
console.log(`    ${zahl.workflows} Workflows, ${zahl.actions} fremde Actions, ${zahl.checkouts} Checkouts, ${zahl.runBloecke} run-Bloecke`);

// ---------------------------------------------------------------- [3]
console.log('\n[3] Dockerfiles: Basis-Images per Digest, kein Compiler im Laufzeit-Image');
zahl.basisImages = 0;
const COMPILER = /\b(apt-get|apt|apk|dnf|yum|microdnf)\b[^\n]*\b(install|add)\b[^\n]*\s(g\+\+|gcc|clang|make|build-essential|build-base|python3?)(\s|$)/;
for (const f of DOCKERFILES) {
  const abs = join(ROOT, f);
  if (!need(existsSync(abs), `${f} fehlt`)) continue;
  // Fortsetzungszeilen zusammenziehen, Kommentare weg.
  const anw = lesen(abs).replace(/\\\n/g, ' ').split('\n').filter((z) => z.trim() && !/^\s*#/.test(z));
  const stufen = new Set();
  let letzte = -1;
  anw.forEach((z, i) => {
    const m = /^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)(?:\s+AS\s+(\S+))?/i.exec(z);
    if (!m) return;
    letzte = i;
    const bild = m[1];
    // `FROM deps` greift auf eine fruehere Stufe zu — kein Basis-Image.
    const istStufe = stufen.has(bild.toLowerCase());
    if (m[2]) stufen.add(m[2].toLowerCase());
    if (bild === 'scratch' || istStufe) return;
    zahl.basisImages++;
    need(/@sha256:[0-9a-f]{64}$/.test(bild),
      `${f}: FROM ${bild} ohne @sha256-Digest — derselbe Tag kann morgen ein anderes, ungeprueftes Image sein`);
  });
  const laufzeit = anw.slice(letzte).filter((z) => /^\s*RUN\b/i.test(z));
  for (const z of laufzeit) {
    need(!COMPILER.test(z), `${f}: die letzte Stufe installiert einen Compiler (${z.trim().slice(0, 90)}…) — in eine Bau-Stufe verschieben, nur das Ergebnis kopieren`);
  }
}
console.log(`    ${DOCKERFILES.length} Dockerfiles, ${zahl.basisImages} Basis-Images`);

// ---------------------------------------------------------------- [4]
console.log('\n[4] Dependabot zieht alles Angeheftete nach');
const dbPfad = join(ROOT, '.github/dependabot.yml');
if (need(existsSync(dbPfad), '.github/dependabot.yml fehlt — angeheftete SHAs und Digests veralten dann still')) {
  const db = lesen(dbPfad).split('\n').map(ohneKommentar).join('\n');
  // Je Eintrag: Oekosystem und Verzeichnis(se).
  const eintraege = db.split(/\n\s*-\s+package-ecosystem:/).slice(1).map((b) => {
    const eco = /^\s*['"]?([\w-]+)/.exec(b)?.[1];
    const dirs = [];
    const d1 = /\n\s*directory:\s*['"]?([^\s'"]+)/.exec(b);
    if (d1) dirs.push(d1[1]);
    const d2 = /\n\s*directories:\s*\[([^\]]*)\]/.exec(b);
    if (d2) dirs.push(...d2[1].split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean));
    // dieselbe Liste in Blockschreibweise (`directories:` und darunter `- "/"`)
    const d3 = /\n([ \t]*)directories:[ \t]*\n((?:\1[ \t]+-[^\n]*(?:\n|$))+)/.exec(b);
    if (d3) for (const m of d3[2].matchAll(/-\s*['"]?([^\s'"#]+)/g)) dirs.push(m[1]);
    return { eco, dirs: dirs.map((x) => (x === '/' ? '/' : '/' + x.replace(/^\/|\/$/g, ''))) };
  });
  const deckt = (eco, dir) => eintraege.some((e) => e.eco === eco && e.dirs.includes(dir));
  const dirOf = (f) => { const d = dirname(f); return d === '.' ? '/' : '/' + d; };
  let n = 0;
  for (const f of LOCKFILES) { n++; need(deckt('npm', dirOf(f)), `dependabot.yml: npm fuer ${dirOf(f)} fehlt (${f})`); }
  for (const f of DOCKERFILES) { n++; need(deckt('docker', dirOf(f)), `dependabot.yml: docker fuer ${dirOf(f)} fehlt (${f})`); }
  n++; need(deckt('github-actions', '/'), 'dependabot.yml: github-actions fuer / fehlt');
  console.log(`    ${n} Bezugsstellen abgedeckt geprueft (${eintraege.length} Eintraege)`);
}

// ---------------------------------------------------------------- [5]
console.log('\n[5] Selbstauskunft gegen Sperrklinken');
for (const [k, min] of Object.entries(KLINKE)) {
  const ist = zahl[k] ?? 0;
  console.log(`    ${k.padEnd(12)} ${String(ist).padStart(4)}   Klinke ${min}`);
  need(ist >= min, `${k}: nur ${ist} geprueft, Klinke steht bei ${min} — laeuft der Waechter leer? Ursache klaeren, nicht die Klinke senken`);
}

if (fail.length) {
  console.error(`\nFEHLER — Lieferkette (${fail.length}):\n`);
  for (const m of fail) console.error(`  ✗ ${m}`);
  console.error('');
  process.exit(1);
}
console.log('\n✓ Lieferkette: Herkunft, Anheftung und Rechte wie vorgesehen.\n');
