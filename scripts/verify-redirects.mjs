/* ============================================================
   verify-redirects.mjs — Schiene A: jede Weiterleitung in
   nginx/default.conf schreibt nur Ziele auf DIESER Seite.

   Kein Netz, kein git, kein Kindprozess — liest nginx/default.conf,
   nginx/gate.js und die Seitenliste aus dist/ als Text. Die Regeln
   werden nicht nur gelesen, sondern NACHGESPIELT: jedes Umleitungs-
   muster laeuft gegen eine Angriffsliste und gegen jede gebaute Seite.

   WARUM ES DEN GIBT: Eine Weiterleitung, die ein Stueck des angefragten
   Pfads in die Location uebernimmt, sieht harmlos aus und ist es nur,
   solange das Stueck nicht mit "/" oder "\" beginnt: "//x" und "/\x"
   lesen Browser als Adresse auf dem Host x. Ebenso darf ein dekodierter
   Pfad nie roh in eine Kopfzeile. Beides ist von aussen nicht zu sehen,
   bis jemand die passende Adresse baut — deshalb wird hier nachgespielt
   statt nur gelesen.

   Fuenf Zusicherungen, jede mit Soll/Ist-Zeile:

     1  Riegel: auf Server-Ebene steht ein `if ($uri ~ "…") { return
        400; }`, dessen Muster JEDES Steuerzeichen (0x00–0x1f, 0x7f) und
        den Rueckstrich trifft — und keine einzige gebaute Seite.
     2  Ziele: jede Weiterleitung (return 301/302/303/307/308, rewrite
        …redirect|permanent) setzt nur Variablen aus KNOWN_VARS ein. Roh
        eingesetzte Pfadvariablen ($uri, $request_uri, $document_uri)
        sind FEHLER. Benannte Ausnahme mit Zombie-Waechter: $vb_base,
        nur hinter `if (-f $document_root$vb_base.html)` — dort kann es
        nur der Pfad einer existierenden Datei sein.
     3  Nachgespielt: jedes umleitende rewrite laeuft gegen die
        Angriffsliste; kein Ergebnis darf mit "//" oder "/\" beginnen
        oder Steuerzeichen/Rueckstriche tragen.
     4  Abdeckung: die alte /en/-Adresse jeder gebauten Seite leitet
        weiterhin auf genau diese Seite. Luecken sind WARNUNG (neue Seiten
        hatten nie eine /en/-Adresse), keine FEHLER.
     5  Ruecksprungziel des Tors: $vb_next kommt aus gate.next, und die
        Funktion aus nginx/gate.js liefert fuer die Angriffsliste nur
        prozentkodierte Zeichen (in node:vm ausgefuehrt, wie test:e2e).

   Kopfzeile: gepruefte Weiterleitungen, Angriffe, Seiten, Artefakt.
   Untergrenzen als Sperrklinken (Grundsatz 5).

     node scripts/verify-redirects.mjs
     node scripts/verify-redirects.mjs --conf <alte default.conf>   # Gegenprobe
   ============================================================ */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const NGINX_CONF = arg('--conf', 'nginx/default.conf');
const NGINX_GATE_JS = arg('--gate-js', 'nginx/gate.js');
const DIST = arg('--dist', 'dist');

// Untergrenzen. Duerfen nur nach OBEN wandern (Grundsatz 5).
// Stand 29.10.2026: 12 Weiterleitungen (mit dem Tor vor /hangar/), 18.222
// Seiten. main traegt bis zum naechsten Zusammenfuehren mit staging eine
// eigene Fassung dieser Datei mit 11 (dort fehlt das Hangar-Tor noch); mit
// dem Zusammenfuehren kommen Tor und Klinke gemeinsam an.
const MIN_WEITERLEITUNGEN = 12;
const MIN_SEITEN = 17000;

// Variablen, die eine Weiterleitung einsetzen darf — jede mit Anlass.
const KNOWN_VARS = {
  vb_next: 'prozentkodiert durch gate.next (Zusicherung 5)',
  is_args: 'nur "?" oder leer',
  args: 'Query-String wie empfangen; ein Rohzeilenumbruch kann in der Anfragezeile nicht stehen',
};
// Benannte Ausnahme: ein Pfad-Variablen-Ziel, das nur hinter einer
// Existenzpruefung steht. Verliert es die Pruefung oder verschwindet es,
// reisst das Tor (Zombie-Waechter).
const AUSNAHMEN = [
  {
    variable: 'vb_base',
    wache: /^if \(-f \$document_root\$vb_base\.html\) \{$/,
    anlass: '.html-Zwillingsregel: Ziel ist nur der Pfad einer existierenden Datei aus dist/',
  },
];
const PFAD_VARS = new Set(['uri', 'request_uri', 'document_uri', 'vb_base']);

// Angriffsliste, in der DEKODIERTEN Form, in der nginx $uri und rewrite
// sehen. Der Rueckstrich ist das eigentliche Werkzeug (/\host == //host).
const ANGRIFFE = [
  '\\fremd.example',
  '\\\\fremd.example',
  '/fremd.example',
  '//fremd.example',
  '\\/fremd.example',
  '\t/fremd.example',
  '\r\nSet-Cookie: x=1',
  '\nLocation: //fremd.example',
  '\x00fremd',
  '\x7ffremd',
  ' /fremd.example',
  'a\\b',
  'x/../\\fremd.example',
];

if (!existsSync(NGINX_CONF) || !existsSync(NGINX_GATE_JS)) {
  console.error(`verify-redirects: ${NGINX_CONF} oder ${NGINX_GATE_JS} fehlt.`);
  process.exit(1);
}
if (!existsSync(DIST)) {
  console.error(
    `verify-redirects: ${DIST}/ fehlt. Erst \`npm run build\`, dann \`node scripts/verify-redirects.mjs\` — ` +
      'die Abdeckung wird gegen den GEBAUTEN Stand geprueft.'
  );
  process.exit(1);
}

let ok = true;
let warnungen = 0;
const fail = (msg) => {
  ok = false;
  console.error(`  FEHLER: ${msg}`);
};
const warn = (msg) => {
  warnungen++;
  console.warn(`  WARNUNG: ${msg}`);
};
const zeig = (s) => JSON.stringify(s).replace(/\x7f/g, '\\u007f');

/* ---------- Konfiguration in Anweisungen zerlegen ---------- */
// Kommentar ab "#" ausserhalb von Anfuehrungszeichen weg, Klammertiefe
// je Zeile mitfuehren (Klammern in Zeichenketten zaehlen nicht).
function zerlege(text) {
  const out = [];
  let tiefe = 0;
  text.split(/\r?\n/).forEach((roh, i) => {
    let code = '';
    let q = null;
    for (let k = 0; k < roh.length; k++) {
      const c = roh[k];
      if (q) {
        code += c;
        if (c === '\\') code += roh[++k] ?? '';
        else if (c === q) q = null;
        continue;
      }
      if (c === '#') break;
      if (c === '"' || c === "'") q = c;
      code += c;
    }
    code = code.trim();
    const tiefeVorher = tiefe;
    let q2 = null;
    for (let k = 0; k < code.length; k++) {
      const c = code[k];
      if (q2) {
        if (c === '\\') k++;
        else if (c === q2) q2 = null;
      } else if (c === '"' || c === "'") q2 = c;
      else if (c === '{') tiefe++;
      else if (c === '}') tiefe--;
    }
    if (code) out.push({ zeile: i + 1, code, tiefe: tiefeVorher });
  });
  return out;
}
// nginx entschaerft in Zeichenketten nur \" \' \\ (plus \t \r \n); alles
// andere, etwa \x00, reicht es unveraendert an PCRE weiter.
function nginxString(tok) {
  if (!/^["']/.test(tok)) return tok;
  return tok
    .slice(1, -1)
    .replace(/\\(["'\\])/g, '$1')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\n/g, '\n');
}

const conf = zerlege(readFileSync(NGINX_CONF, 'utf8'));

/* ---------- Seitenliste aus dist/ ---------- */
const seiten = [];
(function walk(dir, pre) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walk(join(dir, e.name), `${pre}/${e.name}`);
    else if (e.name.endsWith('.html')) seiten.push(`${pre}/${e.name}`);
  }
})(DIST, '');

/* ---------- Weiterleitungen einsammeln ---------- */
const RETURN_RE = /(?:^|[\s{;])return\s+(30[12378])\s+((?:"(?:[^"\\]|\\.)*")|[^;\s]+)\s*;/;
const REWRITE_RE = /^rewrite\s+("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\S+)\s+(\S+)(?:\s+(last|break|redirect|permanent))?\s*;/;
const weiterleitungen = [];
const rewritesUmleitend = [];
conf.forEach((a, idx) => {
  const r = RETURN_RE.exec(a.code);
  if (r) weiterleitungen.push({ art: `return ${r[1]}`, ziel: nginxString(r[2]), zeile: a.zeile, idx });
  const w = REWRITE_RE.exec(a.code);
  if (w) {
    const ziel = nginxString(w[2]);
    const umleitend = w[3] === 'redirect' || w[3] === 'permanent' || /^(https?:\/\/|\$scheme)/.test(ziel);
    if (umleitend) {
      const eintrag = { art: `rewrite ${w[3] ?? ''}`.trim(), muster: nginxString(w[1]), ziel, zeile: a.zeile, idx };
      weiterleitungen.push(eintrag);
      rewritesUmleitend.push(eintrag);
    }
  }
});

console.log('\n=== verify-redirects: Weiterleitungen bleiben auf dieser Seite (Schiene A) ===');
console.log(`Geprueftes Artefakt: ${NGINX_CONF}, ${NGINX_GATE_JS}, ${DIST}/ (${seiten.length} Seiten)`);

/* ---- [1] Riegel ---- */
console.log('\n[1] Server-weiter Riegel gegen Steuerzeichen und Rueckstriche');
const RIEGEL_RE = /^if \(\$uri ~\*? ("(?:[^"\\]|\\.)*")\) \{ return 400; \}$/;
const riegel = conf.filter((a) => RIEGEL_RE.test(a.code));
const riegelServer = riegel.filter((a) => a.tiefe === 1);
console.log(`    Riegel auf Server-Ebene — Soll: 1   Ist: ${riegelServer.length} (insgesamt ${riegel.length})`);
if (riegelServer.length !== 1) {
  fail(
    'kein (oder mehr als ein) `if ($uri ~ "…") { return 400; }` direkt im server-Block — ohne Riegel reicht jede Regel, die $uri weitergibt, "/\\host" und Zeilenumbrueche an den Browser durch'
  );
} else {
  const muster = new RegExp(nginxString(RIEGEL_RE.exec(riegelServer[0].code)[1]));
  const zeichen = [...Array(0x20).keys(), 0x7f, 0x5c].map((c) => String.fromCharCode(c));
  const durch = zeichen.filter((c) => !muster.test(`/a${c}b`));
  console.log(`    Zeichen, die der Riegel treffen muss — Soll: ${zeichen.length}/${zeichen.length}   Ist: ${zeichen.length - durch.length}/${zeichen.length}`);
  if (durch.length)
    fail(`Riegel (Zeile ${riegelServer[0].zeile}) laesst ${durch.map((c) => '0x' + c.charCodeAt(0).toString(16)).join(', ')} durch`);
  const getroffen = seiten.filter((p) => muster.test(p));
  console.log(`    gebaute Seiten, die der Riegel faelschlich sperrt — Soll: 0   Ist: ${getroffen.length}`);
  if (getroffen.length) fail(`Riegel sperrt echte Seiten, z. B. ${zeig(getroffen[0])} — die Seite antwortete mit 400`);
}

/* ---- [2] Ziele ---- */
console.log('\n[2] Weiterleitungsziele setzen nur bekannte Variablen ein');
console.log(`    Weiterleitungen gefunden — Untergrenze: ${MIN_WEITERLEITUNGEN}   Ist: ${weiterleitungen.length}`);
if (weiterleitungen.length < MIN_WEITERLEITUNGEN)
  fail(`nur ${weiterleitungen.length} Weiterleitungen erkannt, Untergrenze ${MIN_WEITERLEITUNGEN} — Erkennung kaputt oder Regeln verschwunden, Ursache klaeren`);
const ausnahmeTreffer = new Map(AUSNAHMEN.map((x) => [x.variable, 0]));
let rohePfade = 0;
for (const w of weiterleitungen) {
  for (const [, v] of w.ziel.matchAll(/\$\{?([A-Za-z_][A-Za-z0-9_]*|\d)\}?/g)) {
    if (/^\d$/.test(v)) {
      if (!w.art.startsWith('rewrite')) fail(`Zeile ${w.zeile}: $${v} in einem return-Ziel — ohne rewrite gibt es keine Gruppe`);
      continue; // Gruppen prueft [3] durch Nachspielen
    }
    if (KNOWN_VARS[v]) continue;
    const ausnahme = AUSNAHMEN.find((x) => x.variable === v);
    if (ausnahme) {
      const vorher = conf[w.idx - 1];
      if (vorher && ausnahme.wache.test(vorher.code)) {
        ausnahmeTreffer.set(v, ausnahmeTreffer.get(v) + 1);
        continue;
      }
      fail(`Zeile ${w.zeile}: $${v} im Ziel ohne die Existenzpruefung davor (${ausnahme.wache.source}) — so kann jeder Pfad in die Location`);
      rohePfade++;
      continue;
    }
    if (PFAD_VARS.has(v)) {
      rohePfade++;
      fail(`Zeile ${w.zeile}: ${w.art} setzt $${v} roh ein (${zeig(w.ziel)}) — dekodierter Pfad in der Location; prozentkodiert ueber njs ($vb_next) einsetzen`);
    } else {
      fail(`Zeile ${w.zeile}: ${w.art} setzt $${v} ein, das nicht in KNOWN_VARS steht — pruefen, ob ein Fremder den Wert bestimmt, dann mit Anlass eintragen`);
    }
  }
}
console.log(`    roh eingesetzte Pfadvariablen — Soll: 0   Ist: ${rohePfade}`);
for (const x of AUSNAHMEN) {
  const n = ausnahmeTreffer.get(x.variable);
  console.log(`    Ausnahme $${x.variable} (${x.anlass}) — Soll: >= 1 Treffer   Ist: ${n}`);
  if (!n) fail(`Ausnahme $${x.variable} hat keinen Treffer mehr — Anlass verloren, Eintrag aus AUSNAHMEN streichen`);
}

/* ---- [3] Nachgespielt ---- */
console.log('\n[3] Umleitende rewrites gegen die Angriffsliste nachgespielt');
const sicher = (loc) => /^\/(?![\/\\])/.test(loc) && !/[\x00-\x1f\x7f\\]/.test(loc);
const ersetze = (ziel, m) => ziel.replace(/\$(\d)/g, (_, n) => m[Number(n)] ?? '');
// Literaler Anfang des Musters (^/en/(…) -> "/en/"), damit die Angriffe die
// Regel ueberhaupt erreichen.
const praefix = (muster) => (/^\^((?:[^\\()[\].*+?{}|$^]|\\[./-])*)/.exec(muster)?.[1] ?? '').replace(/\\(.)/g, '$1');
let gespielt = 0;
let durchgerutscht = 0;
for (const w of rewritesUmleitend) {
  let re;
  try {
    re = new RegExp(w.muster);
  } catch (e) {
    fail(`Zeile ${w.zeile}: Muster ${zeig(w.muster)} laesst sich nicht nachspielen (${e.message}) — vereinfachen oder hier unterstuetzen`);
    continue;
  }
  const p = praefix(w.muster);
  for (const angriff of ANGRIFFE) {
    gespielt++;
    const m = re.exec(p + angriff);
    if (!m) continue;
    const loc = ersetze(w.ziel, m);
    if (!sicher(loc)) {
      durchgerutscht++;
      fail(`Zeile ${w.zeile}: ${w.art} macht aus ${zeig(p + angriff)} die Location ${zeig(loc)} — fuer Browser eine fremde Adresse oder eine kaputte Kopfzeile`);
    }
  }
}
console.log(`    umleitende rewrites: ${rewritesUmleitend.length}   Angriffe gespielt: ${gespielt}   unsichere Ziele — Soll: 0   Ist: ${durchgerutscht}`);

/* ---- [4] Abdeckung ---- */
console.log('\n[4] Alte /en/-Adressen jeder gebauten Seite leiten auf die Seite');
console.log(`    gebaute Seiten — Untergrenze: ${MIN_SEITEN}   Ist: ${seiten.length}`);
if (seiten.length < MIN_SEITEN) fail(`nur ${seiten.length} Seiten in ${DIST}/, Untergrenze ${MIN_SEITEN} — Build unvollstaendig?`);
const enRegel = rewritesUmleitend.find((w) => praefix(w.muster) === '/en/');
if (!enRegel) {
  fail('kein umleitendes rewrite fuer /en/ gefunden — die indexierten /en/-Adressen aus der Zeit vor dem Sprach-Tausch liefen ins 404');
} else {
  const re = new RegExp(enRegel.muster);
  const luecken = seiten.filter((s) => {
    const m = re.exec('/en' + s);
    return !m || ersetze(enRegel.ziel, m) !== s;
  });
  const wurzel = re.exec('/en/');
  const wurzelOk = !!wurzel && ersetze(enRegel.ziel, wurzel) === '/';
  console.log(`    /en/<seite> -> /<seite> — Soll: ${seiten.length}   Ist: ${seiten.length - luecken.length}   /en/ -> / — Soll: ja   Ist: ${wurzelOk ? 'ja' : 'nein'}`);
  if (luecken.length)
    warn(`${luecken.length} Seite(n) ohne /en/-Weiterleitung, z. B. ${zeig(luecken[0])} — nur relevant, wenn die Seite vor dem Sprach-Tausch unter /en/ indexiert war`);
  if (!wurzelOk) warn('/en/ leitet nicht mehr auf die Startseite');
}

/* ---- [5] Ruecksprungziel des Tors ---- */
console.log('\n[5] $vb_next ist prozentkodiert (gate.next aus nginx/gate.js)');
const nutztNext = weiterleitungen.filter((w) => /\$vb_next\b/.test(w.ziel)).length;
const jsSet = conf.some((a) => /^js_set \$vb_next gate\.next;$/.test(a.code) && a.tiefe === 0);
console.log(`    js_set $vb_next gate.next auf http-Ebene — Soll: ja   Ist: ${jsSet ? 'ja' : 'nein'}   (benutzt in ${nutztNext} Weiterleitungen)`);
if (nutztNext && !jsSet) fail('$vb_next wird benutzt, aber nicht ueber `js_set $vb_next gate.next;` gesetzt');
const js = readFileSync(NGINX_GATE_JS, 'utf8');
const exportiert = /export default \{[^}]*\bnext\b[^}]*\}/.test(js);
const kopf = js.indexOf('function next(r)');
let nextFn = null;
if (kopf !== -1) {
  let tiefe = 0;
  for (let k = js.indexOf('{', kopf); k < js.length; k++) {
    if (js[k] === '{') tiefe++;
    else if (js[k] === '}' && --tiefe === 0) {
      nextFn = js.slice(kopf, k + 1);
      break;
    }
  }
}
console.log(`    function next(r) vorhanden und exportiert — Soll: ja   Ist: ${nextFn && exportiert ? 'ja' : 'nein'}`);
if (nutztNext && !(nextFn && exportiert)) fail('nginx/gate.js: function next(r) fehlt oder steht nicht im Default-Export');
if (nextFn) {
  const next = vm.runInNewContext(`(${nextFn})`, {});
  const proben = [...ANGRIFFE.map((a) => '/schiffe/' + a), '/a b?c#d&e', '/\ud800', '/"<x>'];
  const schlecht = proben.filter((u) => !/^[A-Za-z0-9%\/._~!*'()-]*$/.test(String(next({ uri: u }))));
  console.log(`    Proben mit Zeichen ausserhalb der Prozentkodierung — Soll: 0/${proben.length}   Ist: ${schlecht.length}/${proben.length}`);
  if (schlecht.length) fail(`gate.next liefert fuer ${zeig(schlecht[0])} ${zeig(next({ uri: schlecht[0] }))} — nicht kodiert`);
}

console.log(`\nverify-redirects: ${ok ? 'ALLE ZUSICHERUNGEN ERFUELLT ✓' : 'FEHLGESCHLAGEN ✗'}${warnungen ? ` (${warnungen} Warnung(en))` : ''}`);
if (!ok) process.exit(1);
