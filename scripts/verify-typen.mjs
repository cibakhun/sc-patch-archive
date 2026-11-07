// verify-typen.mjs — der Typcheck ueber Seiten, Komponenten und Skripte.
//
// WARUM ES DEN GIBT: tsconfig.json steht seit Beginn auf
// astro/tsconfigs/strict, aber kein Tor hat je einen Typcheck gefahren —
// die Typen waren eine Behauptung. Der erste Lauf am 04.11.2026 (astro
// check, unveraenderter Stand origin/staging d76478f2 und PR #292) fand 93
// Fehler in 665 Dateien, darunter:
//   - ein echter Anzeigefehler: das Materialsuchfeld des Zerlege-Rechners
//     hatte keinen Platzhalter, weil CraftingApp.astro S.calcSearchPlaceholder
//     las und der Text in JS_T stand (TS2339);
//   - ein Aufruf vor der Deklaration (account-dashboard.ts rief updateCard()
//     vor seiner const-Zeile, TS2448), der nur hielt, weil kein await
//     dazwischen lag;
//   - Datenfelder ohne Typ (Erz-Pods, Mining-Module in BlueprintItemStats),
//     Labels ohne Schluesseltyp (Wikelo), null in Kartenlisten;
//   - 30 Fehler in supabase/functions — die laufen unter Deno, nicht hier
//     (Ausnahme unten; ihr `deno check` ist kein Tor, siehe dort).
// Und PR #292 hat gezeigt, warum das Tor fehlte: eine stille Standardsprache
// war typgerecht, aber ohne Typcheck haette nicht einmal ein Typfehler sie
// verraten.
//
// Geprueft wird (alles FEHLER, Grundsatz 3: "Typfehler beheben" ist immer
// die richtige Handlungsanweisung; Warnungen werden gezaehlt, blocken nicht):
//   1  astro check ueber das Programm aus tsconfig.json — .astro-Dateien
//      samt ihren <script>-Bloecken, .ts, und JS mit @ts-check: 0 Fehler.
//      Derselbe Pruefer wie `npx astro check`, hier im eigenen Prozess, damit
//      die Zahlen fuer die Selbstauskunft und die Klinken greifbar sind.
//   2  Die Konfiguration bleibt streng: tsconfig.json erbt von
//      astro/tsconfigs/strict(est), `strict` ist wirksam an, und kein Glied
//      der strict-Familie ist einzeln abgeschaltet. Ein Typcheck, den man per
//      Konfiguration gruen schaltet, waere Dekoration.
//   3  Keine Unterdrueckung im Quelltext: @ts-ignore, @ts-nocheck und
//      @ts-expect-error in src/ und astro.config.mjs nur als benannte
//      Ausnahme (heute keine).
//   4  Jeder Eintrag in tsconfig.json#exclude ist eine benannte Ausnahme mit
//      Anlass; gibt es den Pfad nicht mehr, reisst das Tor (Zombie-Waechter).
//   5  Abdeckung: jede .astro- und .ts-Datei unter src/ steht im geprueften
//      Programm (sonst fiele eine Datei still aus dem Check, etwa durch ein
//      zu enges include). Selbstauskunft und Klinken je Dateiart.
//
// Schiene A: kein git, kein Netz, kein Kindprozess. Braucht mehr Speicher als
// Nodes Vorgabe (bis ~3 GB, die grossen Datendateien unter src/data und
// assets/ werden mitgetypt) — deshalb setzt das npm-Skript
// --max-old-space-size; ohne den Schalter bricht V8 bei ~2 GB ab.
//
//   node --max-old-space-size=6144 scripts/verify-typen.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname, relative, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => relative(ROOT, p).replaceAll('\\', '/');
const require = createRequire(import.meta.url);

// Klinken (Grundsatz 5): gemessen am 04.11.2026 auf PR #292 plus diesem
// Stand: 661 Dateien im Programm, davon unter src/ 255 .astro und 87 .ts.
// Nur nach oben verschieben; nach unten nur per Commit, der die Ursache nennt.
const MIN_DATEIEN = 661;
const MIN_ASTRO = 255;
const MIN_TS = 87;

// Benannte Ausnahmen zu tsconfig.json#exclude (Grundsatz 6). `dist` ist die
// Bauausgabe und darf fehlen (vor dem ersten Bau); jeder andere Pfad muss
// existieren, sonst ist die Ausnahme ein Zombie.
const EXCLUDE_AUSNAHMEN = {
  dist: { bauausgabe: true, anlass: 'Bauausgabe von astro build, kein Quelltext' },
  'supabase/functions': {
    anlass:
      'Supabase Edge Functions laufen unter Deno: Deno.*, jsr:- und npm:-Importe gibt es im Node-/Astro-Programm nicht (30 Fehler am 04.11.2026, alle nur daher). Ihren Typcheck (`deno check`, braucht Netz) faehrt KEIN Tor; am 04.11.2026 einmal von Hand gelaufen, ohne Befund. Offener Posten: eigener CI-Schritt.',
  },
};

// Benannte Ausnahmen zu Regel 3, je { datei, anlass }. Heute keine.
const UNTERDRUECKUNG_AUSNAHMEN = [];

const fail = [];
const warn = [];

/* ---------- 2: Konfiguration bleibt streng ---------- */
const ts = require('typescript');
const tsconfigPfad = resolve(ROOT, 'tsconfig.json');
const roh = ts.readConfigFile(tsconfigPfad, ts.sys.readFile);
if (roh.error) {
  console.error(`tsconfig.json nicht lesbar: ${ts.flattenDiagnosticMessageText(roh.error.messageText, '\n')}`);
  process.exit(2);
}
const eigen = roh.config ?? {};
const wirksam = ts.parseJsonConfigFileContent(eigen, ts.sys, ROOT, undefined, tsconfigPfad).options;
const STRENG_ERBE = /^astro\/tsconfigs\/(strict|strictest)$/;
const STRICT_FAMILIE = [
  'noImplicitAny', 'noImplicitThis', 'strictNullChecks', 'strictFunctionTypes',
  'strictBindCallApply', 'strictPropertyInitialization', 'useUnknownInCatchVariables', 'alwaysStrict',
];
console.log('\n[2] Konfiguration bleibt streng');
console.log(`    extends: ${eigen.extends ?? '—'}   strict wirksam: ${wirksam.strict === true ? 'ja' : 'NEIN'}`);
if (!STRENG_ERBE.test(String(eigen.extends ?? '')))
  fail.push(`tsconfig.json erbt nicht mehr von astro/tsconfigs/strict (steht: "${eigen.extends}") — der Typcheck waere damit abgeschwaecht`);
if (wirksam.strict !== true) fail.push('tsconfig.json: strict ist nicht wirksam an');
const abgeschaltet = STRICT_FAMILIE.filter((k) => wirksam[k] === false);
console.log(`    einzeln abgeschaltete strict-Glieder — Soll: 0   Ist: ${abgeschaltet.length}`);
for (const k of abgeschaltet) fail.push(`tsconfig.json schaltet ${k} ab — Typfehler beheben statt die Pruefung zu lockern`);

/* ---------- 4: exclude nur als benannte Ausnahme ---------- */
console.log('\n[4] exclude in tsconfig.json: benannte Ausnahmen');
const exclude = Array.isArray(eigen.exclude) ? eigen.exclude.map((e) => String(e).replace(/\/+$/, '')) : [];
for (const e of exclude) {
  const a = EXCLUDE_AUSNAHMEN[e];
  if (!a) {
    fail.push(`tsconfig.json#exclude nennt "${e}" ohne benannte Ausnahme in scripts/verify-typen.mjs (EXCLUDE_AUSNAHMEN) — Anlass eintragen oder die Datei pruefen lassen`);
    continue;
  }
  if (!a.bauausgabe && !existsSync(resolve(ROOT, e)))
    fail.push(`Ausnahme "${e}" in EXCLUDE_AUSNAHMEN: den Pfad gibt es nicht mehr — Zombie, aus exclude und Liste streichen`);
  console.log(`    · ${e}: ${a.anlass}`);
}
for (const e of Object.keys(EXCLUDE_AUSNAHMEN))
  if (!exclude.includes(e)) fail.push(`Ausnahme "${e}" steht in EXCLUDE_AUSNAHMEN, aber nicht mehr in tsconfig.json#exclude — Zombie, streichen`);

/* ---------- 3: keine Unterdrueckung im Quelltext ---------- */
console.log('\n[3] Unterdrueckungen im Quelltext');
const QUELL_ENDUNGEN = new Set(['.ts', '.astro', '.mjs', '.js', '.mts', '.tsx']);
const walk = (dir, out = []) => {
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, d.name);
    if (d.isDirectory()) walk(p, out);
    else if (QUELL_ENDUNGEN.has(extname(d.name))) out.push(p);
  }
  return out;
};
const quellen = [...walk(resolve(ROOT, 'src')), resolve(ROOT, 'astro.config.mjs')];
const UNTERDRUECKUNG_RE = /@ts-(?:ignore|nocheck|expect-error)\b/g;
let unterdrueckungen = 0;
const ausnahmeGetroffen = new Set();
for (const f of quellen) {
  const n = (readFileSync(f, 'utf8').match(UNTERDRUECKUNG_RE) ?? []).length;
  if (!n) continue;
  const a = UNTERDRUECKUNG_AUSNAHMEN.find((x) => x.datei === rel(f));
  if (a) { ausnahmeGetroffen.add(a.datei); continue; }
  unterdrueckungen += n;
  fail.push(`${rel(f)}: ${n}× @ts-ignore/@ts-nocheck/@ts-expect-error — Ursache beheben oder als benannte Ausnahme mit Anlass fuehren`);
}
for (const a of UNTERDRUECKUNG_AUSNAHMEN)
  if (!ausnahmeGetroffen.has(a.datei)) fail.push(`Unterdrueckungs-Ausnahme fuer ${a.datei} trifft nichts mehr — Zombie, streichen`);
console.log(`    Quelldateien gelesen: ${quellen.length}   Unterdrueckungen ohne Ausnahme — Soll: 0   Ist: ${unterdrueckungen}`);

/* ---------- 1 + 5: astro check ---------- */
// Typen von astro:content, Umgebung und Integrationen (.astro/types.d.ts)
// frisch schreiben — dasselbe, was `astro check` vor dem Pruefen tut.
process.env.ASTRO_TELEMETRY_DISABLED = '1';
const { sync } = await import('astro');
await sync({ root: ROOT, logLevel: 'error' });

// Den Pruefer von @astrojs/check aus dessen eigener Abhaengigkeit laden: so
// ist es genau die Fassung, die `npx astro check` benutzt.
const requireAusCheck = createRequire(require.resolve('@astrojs/check'));
const { AstroCheck, DiagnosticSeverity } = requireAusCheck('@astrojs/language-server');
const checker = new AstroCheck(ROOT, require.resolve('typescript'), tsconfigPfad);
const imProgramm = checker.linter.getRootFileNames().map(rel);

console.log('\n[1] astro check (tsconfig.json, strict)');
const t0 = Date.now();
const ergebnis = await checker.lint({ logErrors: { level: 'warning' } });
const sek = ((Date.now() - t0) / 1000).toFixed(1);
if (ergebnis.status !== 'completed') fail.push(`astro check endete mit Status "${ergebnis.status}" statt "completed"`);
const proArt = {};
for (const f of imProgramm) proArt[extname(f) || '(ohne)'] = (proArt[extname(f) || '(ohne)'] ?? 0) + 1;
const fehlerDateien = ergebnis.fileResult.filter((r) => r.errors.some((d) => (d.severity ?? DiagnosticSeverity.Error) === DiagnosticSeverity.Error));
console.log(`    Dateien geprueft: ${ergebnis.fileChecked}   im Programm: ${imProgramm.length} (${Object.entries(proArt).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} ${k}`).join(', ')})`);
console.log(`    Fehler — Soll: 0   Ist: ${ergebnis.errors} in ${fehlerDateien.length} Datei(en)   Warnungen: ${ergebnis.warnings}   Hinweise: ${ergebnis.hints}   (${sek}s)`);
if (ergebnis.errors > 0)
  fail.push(`${ergebnis.errors} Typfehler in ${fehlerDateien.length} Datei(en): ${fehlerDateien.map((r) => rel(fileURLToPath(r.fileUrl))).join(', ')} — Ursache beheben, nicht unterdruecken`);
if (ergebnis.warnings > 0) warn.push(`${ergebnis.warnings} Warnung(en) von astro check (oben ausgegeben)`);

console.log('\n[5] Abdeckung und Selbstauskunft');
const geprueft = new Set(imProgramm);
const srcDateien = walk(resolve(ROOT, 'src')).map(rel);
const srcAstro = srcDateien.filter((f) => f.endsWith('.astro'));
const srcTs = srcDateien.filter((f) => f.endsWith('.ts'));
const fehlendImProgramm = [...srcAstro, ...srcTs].filter((f) => !geprueft.has(f));
console.log(`    src/: ${srcAstro.length} .astro, ${srcTs.length} .ts   nicht im Programm — Soll: 0   Ist: ${fehlendImProgramm.length}`);
console.log(`    Klinken: Dateien ${ergebnis.fileChecked} ≥ ${MIN_DATEIEN}, .astro ${srcAstro.length} ≥ ${MIN_ASTRO}, .ts ${srcTs.length} ≥ ${MIN_TS}`);
for (const f of fehlendImProgramm.slice(0, 20)) fail.push(`${f} steht nicht im geprueften Programm (tsconfig.json include/exclude) — die Datei faellt still aus dem Typcheck`);
if (fehlendImProgramm.length > 20) fail.push(`… und ${fehlendImProgramm.length - 20} weitere Dateien aus src/ nicht im Programm`);
if (ergebnis.fileChecked !== imProgramm.length)
  fail.push(`astro check hat ${ergebnis.fileChecked} Dateien geprueft, das Programm nennt ${imProgramm.length}`);
if (ergebnis.fileChecked < MIN_DATEIEN) fail.push(`nur ${ergebnis.fileChecked} Dateien geprueft, Untergrenze ${MIN_DATEIEN} — Ursache klaeren, nicht die Untergrenze senken`);
if (srcAstro.length < MIN_ASTRO) fail.push(`nur ${srcAstro.length} .astro-Dateien unter src/, Untergrenze ${MIN_ASTRO}`);
if (srcTs.length < MIN_TS) fail.push(`nur ${srcTs.length} .ts-Dateien unter src/, Untergrenze ${MIN_TS}`);

for (const w of warn) console.warn(`\n  WARNUNG: ${w}`);
if (fail.length) {
  console.error(`\nverify-typen: ${fail.length} FEHLER\n`);
  for (const f of fail) console.error(`  · ${f}`);
  console.error('');
  process.exit(1);
}
console.log(`\nverify-typen: ${ergebnis.fileChecked} Dateien typgeprueft, 0 Fehler ✓\n`);
