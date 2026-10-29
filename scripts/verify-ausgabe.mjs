/* ============================================================
   verify-ausgabe.mjs — Ausgabekodierung: JSON in <script>-Bloecken
   und die HTML-Maskierer.

   WARUM ES DEN GIBT: Bis zum 29.10.2026 setzten 15 Stellen Baudaten per
   set:html={JSON.stringify(…)} in <script>-Bloecke, und nur zwei davon
   maskierten '<'. Der HTML-Parser beendet ein Skript beim ersten
   `</script`, auch mitten in einem JSON-String — und ein Teil der
   Strings kommt aus Fremdquellen (Schiffsliste, Preise, Datenlauf). Dazu
   lagen sieben Kopien eines HTML-Maskierers ohne Apostroph im Bestand.
   Seither gibt es EINEN Helfer (src/lib/safeJson.ts: jsonForScript) und
   einen Zeichensatz fuer alle Maskierer (src/lib/escape.ts). Dieses Tor
   haelt beides fest — an der Quelle UND am gebauten Stand.

   Vier Zusicherungen, jede mit Soll/Ist-Zeile:

     1  Die echten Helfer (gebuendelt aus src/lib/, kein Nachbau): '<',
        U+2028 und U+2029 kommen nie roh aus jsonForScript, der Wert
        ueberlebt JSON.parse UND die Auswertung als JavaScript
        unveraendert, und ohne diese drei Zeichen ist die Ausgabe Byte fuer
        Byte die von JSON.stringify. escapeHtml maskiert alle fuenf
        Zeichen & < > " '.
     2  Quelle: kein set:html-Ausdruck in den .astro-Dateien unter
        src/ ruft JSON.stringify( auf — weder fuer type="application/(ld+)json"
        noch fuer `window.__X=${…}` in ausfuehrbaren Inline-Skripten.
        Benannte Ausnahmen tragen ihren Anlass; verliert eine ihn, reisst
        das Tor (Zombie-Waechter). Klinke: Zahl der jsonForScript-Stellen.
     3  Quelle: jede Maskierer-Kopie (function esc / escHtml / escapeHtml)
        in assets/*.js und src/ deckt alle fuenf Zeichen. Die klassischen
        Skripte unter assets/ und die is:inline-Skripte koennen nichts
        importieren und tragen deshalb Kopien. Klinke: Zahl der Kopien.
     4  Artefakt dist/: jeder <script type="application/json"> und
        "application/ld+json"-Block ist gueltiges JSON ohne rohes '<', und
        jedes Inline-Skript der Form `window.__X={…};` ebenso. Roh
        stehende U+2028/U+2029 sind eine WARNUNG (seit ES2019 in Strings
        erlaubt, aber nicht durch den Helfer gelaufen). Klinke: Zahl der
        Bloecke.

   FEHLER blockt, WARNUNG nicht. Kein git, kein Netz, kein eigener
   Kindprozess: liest src/, assets/ und dist/ als Text; zum Laden der
   Helfer wird wie in verify-crafting-specs.mjs esbuild gebuendelt (unter
   os.tmpdir(), danach geloescht).

       node scripts/verify-ausgabe.mjs
   ============================================================ */
import { readFileSync, readdirSync, statSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { isDeepStrictEqual } from 'node:util';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
const rel = (p) => relative(ROOT, p).replaceAll('\\', '/');

// Klinken (Grundsatz 5): wandern nur nach oben; nach unten nur per Commit,
// dessen Botschaft die Ursache nennt.
// Stand 29.10.2026: 19 jsonForScript-Stellen in set:html (18 direkt, dazu
// HangarApp ueber die Variable payload), 30 Maskierer (7 Kopien in assets/,
// 22 Patchseiten, src/lib/escape.ts). Bloecke gemessen an zwei Builds vom
// selben Tag: Live-Build 17.510 Seiten / 52.929 JSON-Bloecke, Vorschau-Build
// 18.222 Seiten / 53.687 JSON-Bloecke, in beiden 10 window.__X-Bloecke
// (__UIF, __MX, __PJUMP, __CRAFT, __WKB je Sprache). Die Klinke folgt dem
// kleineren.
const MIN_HELFER_STELLEN = 19;
const MIN_MASKIERER = 30;
const MIN_JSON_BLOECKE = 52900;
const MIN_FENSTER_BLOECKE = 10;

// Benannte Ausnahmen fuer Zusicherung 2. Jede braucht einen Anlass; trifft
// sie keinen JSON.stringify-Ausdruck mehr, ist sie ein Zombie und reisst.
const AUSNAHMEN = [
  {
    datei: 'src/components/ShipDetail.astro',
    anlass:
      'maskiert "<" bereits von Hand (.replace(/</g, …)), aber nicht U+2028/U+2029; die Umstellung auf jsonForScript steht aus, weil die Datei bei der Einfuehrung des Helfers in anderer Bearbeitung war',
  },
];

const fail = [];
const warn = [];
const need = (cond, msg) => { if (!cond) fail.push(msg); };

function walk(dir, test, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, test, out);
    else if (test(name)) out.push(p);
  }
  return out;
}
const lineOf = (s, i) => s.slice(0, i).split('\n').length;

/* ---------- [1] Die echten Helfer ---------- */
console.log('\n[1] Helfer jsonForScript / escapeHtml (echte Quelle aus src/lib/)');
const tmp = mkdtempSync(join(tmpdir(), 'verify-ausgabe-'));
let H;
try {
  const esbuild = await import('esbuild');
  await esbuild.build({
    stdin: {
      contents:
        "export { jsonForScript } from './src/lib/safeJson.ts';\n" +
        "export { escapeHtml } from './src/lib/escape.ts';\n",
      resolveDir: ROOT,
      sourcefile: 'verify-ausgabe-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: join(tmp, 'helfer.mjs'),
    logLevel: 'silent',
  });
  H = await import(pathToFileURL(join(tmp, 'helfer.mjs')).href);
} catch (err) {
  console.error('FEHLER: src/lib/safeJson.ts oder src/lib/escape.ts liess sich nicht buendeln — das Tor kann die echten Helfer nicht pruefen.');
  console.error(String(err && err.message ? err.message : err));
  rmSync(tmp, { recursive: true, force: true });
  process.exit(1);
}
rmSync(tmp, { recursive: true, force: true });

const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);
{
  const { jsonForScript, escapeHtml } = H;
  // Probe mit allem, was den HTML-Parser oder alte JS-Parser stoert, in
  // Werten UND Schluesseln, verschachtelt.
  const probe = {
    a: '</script><script>x()</script>',
    b: ['<!--', '-->', '<\/SCRIPT >', `zeile${LS}trenner${PS}absatz`],
    '<k>': { tief: [[`${LS}`]], n: 1.5, z: -0, w: true, x: null },
  };
  const out = jsonForScript(probe);
  const roh = [...out].filter((c) => c === '<' || c === LS || c === PS).length;
  console.log(`    Probe: ${out.length} Zeichen Ausgabe   rohe < / U+2028 / U+2029 — Soll: 0   Ist: ${roh}`);
  need(roh === 0, `jsonForScript laesst ${roh} rohe(s) '<'/U+2028/U+2029 durch — der Helfer in src/lib/safeJson.ts maskiert nicht mehr vollstaendig`);
  let parsed, evaluated;
  try { parsed = JSON.parse(out); } catch { parsed = undefined; }
  try { evaluated = new Function(`return (${out});`)(); } catch { evaluated = undefined; }
  const viaJson = isDeepStrictEqual(parsed, JSON.parse(JSON.stringify(probe)));
  const viaJs = isDeepStrictEqual(evaluated, JSON.parse(JSON.stringify(probe)));
  console.log(`    Wert nach JSON.parse unveraendert: ${viaJson ? 'ja' : 'NEIN'}   nach Auswertung als JavaScript: ${viaJs ? 'ja' : 'NEIN'}`);
  need(viaJson, 'jsonForScript(x) ergibt nach JSON.parse nicht mehr x — die Maskierung veraendert Werte');
  need(viaJs, 'jsonForScript(x) ergibt als JavaScript ausgewertet nicht mehr x — window.__X=${…} bekaeme andere Werte');
  // Byte-Gleichheit ohne die drei Zeichen: die 52.929 gemessenen Bloecke
  // des Bestands enthielten keines davon, ihre Ausgabe darf sich nicht aendern.
  const ohne = [{ name: 'Gladius', 'ä€😀': ['&', '>', '"', "'", '\\', '\n', '\u0000', '\ud800'] }, 0.1 + 0.2, 1e21, [], {}, 'x', null];
  const abweichend = ohne.filter((v) => jsonForScript(v) !== JSON.stringify(v)).length;
  console.log(`    ohne die drei Zeichen gleich JSON.stringify — Soll: ${ohne.length}/${ohne.length}   Ist: ${ohne.length - abweichend}/${ohne.length}`);
  need(!abweichend, `jsonForScript weicht bei ${abweichend} Wert(en) ohne '<'/U+2028/U+2029 von JSON.stringify ab — die Ausgabe des Bestands waere nicht mehr byte-gleich`);
  need(jsonForScript(undefined) === '', 'jsonForScript(undefined) muss "" liefern (wie set:html={undefined}: kein Inhalt)');

  const esc = escapeHtml(`&<>"'`);
  console.log(`    escapeHtml("&<>\\"'") = ${esc}`);
  need(esc === '&amp;&lt;&gt;&quot;&#39;', `escapeHtml maskiert nicht alle fuenf Zeichen (Ist: ${esc})`);
}

/* ---------- [2] Quelle: kein JSON.stringify in set:html ---------- */
// Liest den JSX-Ausdruck, der bei `start` (Index NACH der oeffnenden '{')
// beginnt, bis zu seiner schliessenden Klammer. Liefert deren Index und den
// CODE des Ausdrucks — das, was beim Bauen ausgewertet wird. Der Text von
// Strings, Template-Literalen (ausser ${…}), Regex-Literalen und Kommentaren
// wird dabei durch Leerzeichen ersetzt: ein `JSON.stringify(` im Text eines
// Inline-Skripts laeuft erst im Browser und ist hier kein Befund. Was der
// Leser nicht schliessen kann, meldet das Tor als FEHLER statt still.
function liesAusdruck(s, start) {
  const stack = ['{'];
  let i = start;
  let prev = '{'; // letztes Nicht-Leerzeichen im Code-Kontext
  let code = '';
  while (i < s.length) {
    const c = s[i];
    const top = stack[stack.length - 1];
    if (top === '`') {
      if (c === '\\') { i += 2; code += '  '; continue; }
      if (c === '`') { stack.pop(); prev = '`'; i++; code += ' '; continue; }
      if (c === '$' && s[i + 1] === '{') { stack.push('{'); prev = '{'; i += 2; code += '  '; continue; }
      i++; code += ' '; continue;
    }
    if (top === "'" || top === '"') {
      if (c === '\\') { i += 2; code += '  '; continue; }
      if (c === top) { stack.pop(); prev = c; }
      i++; code += ' '; continue;
    }
    if (c === "'" || c === '"' || c === '`') { stack.push(c); i++; code += ' '; continue; }
    if (c === '/' && s[i + 1] === '/') { const nl = s.indexOf('\n', i); const e = nl < 0 ? s.length : nl; code += ' '.repeat(e - i); i = e; continue; }
    if (c === '/' && s[i + 1] === '*') { const x = s.indexOf('*/', i + 2); const e = x < 0 ? s.length : x + 2; code += ' '.repeat(e - i); i = e; continue; }
    if (c === '/' && /[(,=:[!&|?{};+\-*%<>~^]/.test(prev)) {
      // Regex-Literal: bis zum unmaskierten '/' ausserhalb einer Zeichenklasse.
      let j = i + 1, klasse = false;
      while (j < s.length && s[j] !== '\n') {
        if (s[j] === '\\') { j += 2; continue; }
        if (s[j] === '[') klasse = true;
        else if (s[j] === ']') klasse = false;
        else if (s[j] === '/' && !klasse) break;
        j++;
      }
      code += ' '.repeat(j + 1 - i); i = j + 1; prev = '/'; continue;
    }
    if (c === '{') stack.push('{');
    else if (c === '}') { stack.pop(); if (!stack.length) return { ende: i, code }; }
    if (!/\s/.test(c)) prev = c;
    code += c;
    i++;
  }
  return { ende: -1, code };
}

console.log('\n[2] Quelle: set:html-Ausdruecke in den .astro-Dateien unter src/');
const astroDateien = walk(resolve(ROOT, 'src'), (n) => n.endsWith('.astro'));
let setHtml = 0, helferStellen = 0;
const treffer = []; // { datei, zeile }
for (const f of astroDateien) {
  const s = readFileSync(f, 'utf8');
  const re = /set:html=\{/g;
  let m;
  while ((m = re.exec(s))) {
    setHtml++;
    const { ende, code } = liesAusdruck(s, m.index + m[0].length);
    if (ende < 0) {
      fail.push(`${rel(f)}:${lineOf(s, m.index)}: set:html-Ausdruck laesst sich nicht lesen (keine schliessende Klammer gefunden) — Ausdruck vereinfachen oder dieses Tor nachziehen`);
      continue;
    }
    if (/\bjsonForScript\s*\(/.test(code)) helferStellen++;
    if (/\bJSON\.stringify\s*\(/.test(code)) treffer.push({ datei: rel(f), zeile: lineOf(s, m.index) });
  }
}
// HangarApp setzt den Helfer ueber eine Variable ein (set:html={payload}).
for (const f of astroDateien) {
  const s = readFileSync(f, 'utf8');
  const fm = s.startsWith('---') ? s.slice(0, s.indexOf('\n---', 3)) : '';
  const vars = [...fm.matchAll(/const\s+(\w+)\s*=\s*jsonForScript\s*\(/g)].map((x) => x[1]);
  for (const v of vars) if (new RegExp(`set:html=\\{${v}\\}`).test(s)) helferStellen++;
}
const ausnahmeTreffer = new Map(AUSNAHMEN.map((a) => [a.datei, 0]));
const offen = [];
for (const t of treffer) {
  if (ausnahmeTreffer.has(t.datei)) ausnahmeTreffer.set(t.datei, ausnahmeTreffer.get(t.datei) + 1);
  else offen.push(t);
}
console.log(`    .astro-Dateien: ${astroDateien.length}   set:html-Ausdruecke: ${setHtml}   davon mit jsonForScript: ${helferStellen}   Klinke: ${MIN_HELFER_STELLEN}`);
console.log(`    JSON.stringify in set:html ohne Ausnahme — Soll: 0   Ist: ${offen.length}`);
for (const t of offen)
  fail.push(`${t.datei}:${t.zeile}: set:html mit JSON.stringify( — jsonForScript aus src/lib/safeJson.ts verwenden (maskiert '<', U+2028, U+2029; fuer Daten ohne diese Zeichen byte-gleich)`);
for (const a of AUSNAHMEN) {
  const n = ausnahmeTreffer.get(a.datei);
  console.log(`    Ausnahme ${a.datei}: ${n} Treffer — Anlass: ${a.anlass}`);
  if (!n) fail.push(`Ausnahme ${a.datei} trifft keinen JSON.stringify-Ausdruck mehr — Zombie-Ausnahme, aus AUSNAHMEN in scripts/verify-ausgabe.mjs entfernen`);
}
need(helferStellen >= MIN_HELFER_STELLEN, `nur ${helferStellen} set:html-Stellen mit jsonForScript, Klinke ${MIN_HELFER_STELLEN} — wurde ein Block entfernt oder am Helfer vorbei gebaut? Ursache klaeren, nicht die Klinke senken`);

/* ---------- [3] Quelle: Maskierer-Kopien ---------- */
console.log('\n[3] Quelle: HTML-Maskierer (esc / escHtml / escapeHtml) decken & < > " \'');
const quellDateien = [
  ...walk(resolve(ROOT, 'assets'), (n) => n.endsWith('.js')).filter((p) => !p.includes(`${join('assets', 'vendor')}`)),
  ...walk(resolve(ROOT, 'src'), (n) => /\.(astro|ts|js|mjs)$/.test(n)),
];
// Eine Definition: function esc(…) / const esc = (…) => / const escHtml = …
const DEF = /(?:function\s+(esc|escHtml|escapeHtml)\s*\(|(?:const|let|var)\s+(esc|escHtml|escapeHtml)\s*=\s*(?:\(|function|[a-z_]\w*\s*=>))/g;
let kopien = 0;
const luecken = [];
for (const f of quellDateien) {
  const s = readFileSync(f, 'utf8');
  let m;
  DEF.lastIndex = 0;
  while ((m = DEF.exec(s))) {
    // Der Rumpf: bis zur naechsten Leerzeile bzw. hoechstens 400 Zeichen —
    // alle Kopien im Bestand sind kurz (eine bis fuenf Zeilen).
    const rumpf = s.slice(m.index, m.index + 400).split(/\n\s*\n/)[0];
    if (!/&lt;/.test(rumpf)) continue; // kein HTML-Maskierer (z. B. Regex-esc in Werkzeugen)
    kopien++;
    const fehlt = ['&amp;', '&lt;', '&gt;', '&quot;', '&#39;'].filter((e) => !rumpf.includes(e));
    if (fehlt.length) luecken.push({ datei: rel(f), zeile: lineOf(s, m.index), fehlt });
  }
}
// Der zentrale Helfer selbst zaehlt mit (er steht als MAP, nicht in einer Funktion).
const zentral = readFileSync(resolve(ROOT, 'src/lib/escape.ts'), 'utf8');
if (/export const escapeHtml/.test(zentral)) kopien++;
console.log(`    Maskierer gefunden: ${kopien}   Klinke: ${MIN_MASKIERER}   unvollstaendig — Soll: 0   Ist: ${luecken.length}`);
for (const l of luecken)
  fail.push(`${l.datei}:${l.zeile}: HTML-Maskierer ohne ${l.fehlt.join(' ')} — alle fuenf Zeichen maskieren (Zeichensatz wie src/lib/escape.ts); im gebuendelten Code src/lib/escape.ts importieren`);
need(kopien >= MIN_MASKIERER, `nur ${kopien} HTML-Maskierer gefunden, Klinke ${MIN_MASKIERER} — findet das Tor die Kopien nicht mehr? Ursache klaeren, nicht die Klinke senken`);

/* ---------- [4] Artefakt dist/ ---------- */
console.log('\n[4] Artefakt dist/: JSON in <script>-Bloecken');
if (!existsSync(DIST)) {
  fail.push('dist/ fehlt — erst `npm run build`, dann dieses Tor: Zusicherung 4 prueft den GEBAUTEN Stand, nicht die Quelle');
} else {
  const seiten = walk(DIST, (n) => n.endsWith('.html'));
  let jsonBloecke = 0, fensterBloecke = 0, mitTrenner = 0, sonstige = 0;
  const kaputt = [];
  const OPEN = /<script\b([^>]*)>/gi;
  for (const f of seiten) {
    const s = readFileSync(f, 'utf8');
    OPEN.lastIndex = 0;
    let m;
    while ((m = OPEN.exec(s))) {
      const attrs = m[1];
      const start = m.index + m[0].length;
      const ende = s.indexOf('</script', start);
      if (ende < 0) { kaputt.push(`${rel(f)}: <script> ohne </script>`); break; }
      OPEN.lastIndex = ende;
      const body = s.slice(start, ende);
      const isJson = /\btype\s*=\s*["']?application\/(?:ld\+)?json\b/i.test(attrs);
      const fenster = !isJson && !/\bsrc\s*=/i.test(attrs) && /^\s*window\.__[A-Za-z0-9_]+\s*=/.test(body);
      if (!isJson && !fenster) { sonstige++; continue; }
      let json = body;
      if (fenster) {
        fensterBloecke++;
        json = body.replace(/^\s*window\.__[A-Za-z0-9_]+\s*=\s*/, '').replace(/;\s*$/, '');
      } else jsonBloecke++;
      const wo = `${rel(f)}:${lineOf(s, start)}`;
      if (json.includes('<')) { kaputt.push(`${wo}: rohes '<' im ${fenster ? 'window.__X-Block' : 'JSON-Block'} — jsonForScript verwenden`); continue; }
      try { JSON.parse(json); } catch (e) { kaputt.push(`${wo}: ${fenster ? 'window.__X-Block' : 'JSON-Block'} ist kein gueltiges JSON (${String(e.message).slice(0, 80)})`); continue; }
      if (json.includes(LS) || json.includes(PS)) { mitTrenner++; if (mitTrenner <= 5) warn.push(`${wo}: rohes U+2028/U+2029 — nicht durch jsonForScript gelaufen`); }
    }
  }
  console.log(`    Seiten: ${seiten.length}   JSON-Bloecke: ${jsonBloecke} (Klinke ${MIN_JSON_BLOECKE})   window.__X-Bloecke: ${fensterBloecke} (Klinke ${MIN_FENSTER_BLOECKE})   uebrige Skripte: ${sonstige}`);
  console.log(`    ungueltig oder mit rohem '<' — Soll: 0   Ist: ${kaputt.length}   rohe U+2028/U+2029 (WARNUNG): ${mitTrenner}`);
  for (const k of kaputt.slice(0, 20)) fail.push(k);
  if (kaputt.length > 20) fail.push(`… und ${kaputt.length - 20} weitere Bloecke`);
  need(jsonBloecke >= MIN_JSON_BLOECKE, `nur ${jsonBloecke} JSON-Bloecke in dist/, Klinke ${MIN_JSON_BLOECKE} — prueft das Tor den richtigen Build? Ursache klaeren, nicht die Klinke senken`);
  need(fensterBloecke >= MIN_FENSTER_BLOECKE, `nur ${fensterBloecke} window.__X-Bloecke in dist/, Klinke ${MIN_FENSTER_BLOECKE} — Ursache klaeren, nicht die Klinke senken`);
}

for (const w of warn) console.log(`  WARNUNG ${w}`);
if (fail.length) {
  console.error(`\nverify-ausgabe: ${fail.length} FEHLER\n`);
  for (const f of fail) console.error(`  · ${f}`);
  console.error('');
  process.exit(1);
}
console.log(`\nverify-ausgabe: ALLE ZUSICHERUNGEN ERFUELLT ✓${warn.length ? ` (${warn.length} WARNUNG(EN))` : ''}\n`);
