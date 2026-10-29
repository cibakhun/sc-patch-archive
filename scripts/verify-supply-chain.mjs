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
        (Titel, Rumpf, Zweigname …) direkt in einer `run:`-Zeile.
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
  runBloecke: 57,
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
const FREMDTEXT = /\$\{\{\s*(github\.head_ref|github\.event\.[\w.\[\]'"*-]+)\s*\}\}/g;
const HARMLOS = /\.(number|id|sha|size|draft|merged|run_id|run_number)$/;

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
    const r = /^(\s*)(?:-\s+)?run:\s*(.*)$/.exec(z);
    if (r) {
      zahl.runBloecke++;
      // Tiefe = Spalte des Schluessels `run`, nicht des Zeilenanfangs: bei
      // `- run: …` stehen env:/shell:/if: desselben Schritts zwei Spalten
      // tiefer als der Strich und gehoeren NICHT zum Skript.
      const tiefe = z.indexOf('run:');
      let block = r[2];
      for (let k = i + 1; k < code.length && (code[k].trim() === '' || einr(code[k]) > tiefe); k++) block += '\n' + code[k];
      for (const t of block.matchAll(FREMDTEXT)) {
        if (HARMLOS.test(t[1])) continue;
        fail.push(`${name}:${i + 1}: \${{ ${t[1]} }} steht direkt in \`run:\` — Fremdtext wird so zu Shell-Code. Ueber \`env:\` hereinreichen und als "$VARIABLE" verwenden.`);
      }
    }
  });
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
