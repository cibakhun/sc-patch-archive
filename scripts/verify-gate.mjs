/* ============================================================
   verify-gate.mjs — Schiene A: die Ausnahmeliste des Testpilot-Tors
   als Tor (D-06, Phase 14 Plan 09).

   Kein Netz, kein git, kein Kindprozess, kein Browser, keine Data.p4k —
   liest ausschliesslich dist/ und die beiden nginx-Dateien als Text.
   Genau deshalb bleibt es im Bau-Container lauffaehig und kann das
   Auslieferungs-Image verhindern (Grundsatz 4,
   docs/maschinelle-validierung.md § 4).

   Sechs Zusicherungen, jede mit einer Soll/Ist-Zeile:

     1  Jede Ausnahme traegt ihren Anlass: Zeilen im Format
        "# GATE-AUSNAHME: <pfad> — <anlass>" muessen einen unmittelbar
        folgenden location-Block haben, und jeder Anlass mindestens
        zehn Zeichen Prosa. Absichtlich BREIT erkannt (nur der Zeilen-
        anfang muss stimmen) — ein beschaedigter Anlass verschwindet
        so nicht einfach aus der Zaehlung, sondern faellt als "zu kurz"
        auf.
     2  Die Liste deckt, was die Torseite (dist/gate.html) anfordert:
        link[href]/script[src]/img[src]/source[src] + url() in
        Inline-Stilen, fremde Hosts und data: verworfen — jeder
        verbleibende Pfad muss in der Liste stehen (Pitfall 6,
        maschinell statt geraten).
     3  Zombie-Waechter, die Gegenrichtung: eine Ausnahme, die weder
        von der Torseite angefordert wird (direkt ODER transitiv ueber
        eine ihrer eigenen, ebenfalls ausgenommenen .css-Dateien — die
        vier .woff2-Anker kommen aus assets/fonts.css, nicht direkt aus
        gate.html, ein echter Browser laedt sie trotzdem) noch zu den
        vier festen Eintraegen gehoert (/gate.html, /_gate/,
        /build.json, /robots.txt), hat ihren Anlass verloren. Der Test
        der Enge: ein erfundener Eintrag muss hier reissen.
     4  Die Torseite bleibt eigenstaendig: kein /_astro/-Buendel (D-11
        — ein content-gehashter Name waere in der Liste nicht
        benennbar), kein Seitenmenue, dist/de/gate.html existiert nicht
        (bewusst ungepaart, nur Englisch).
     5  Kein Geheimnis im Modul: nginx/gate.js liest VB_GATE_SECRET NUR
        aus der Umgebung — kein Zeichenkettenliteral > 16 Zeichen an
        einer *secret*-Variablen, kein Vorgabewert, der bei fehlender
        Variablen einspringt (D-09: der Tuersteher muss GESCHLOSSEN
        ausfallen).
     6  Der Schalter ist umlegbar: der $vb_gate_on-Map-Block in
        nginx/default.conf steht in genau der Form, auf die der sed im
        Dockerfile zielt (mehrzeilig, "default "0";" als eigene Zeile)
        — verschiebt sich das, greift der sed nicht mehr, und ohne
        diese Zusicherung fiele das erst auf, wenn die Vorschau offen
        steht (D-12).

   Kopfzeile: geprueft Ausnahmen, geprueft Ressourcen der Torseite,
   geprueftes Artefakt (dist/). Untergrenzen als Sperrklinken — sie
   duerfen nur nach OBEN wandern (Grundsatz 5).

     node scripts/verify-gate.mjs
   ============================================================ */
import { readFileSync, existsSync } from 'node:fs';

const DIST_GATE = 'dist/gate.html';
const DIST_DE_GATE = 'dist/de/gate.html';
const NGINX_CONF = 'nginx/default.conf';
const NGINX_GATE_JS = 'nginx/gate.js';

if (!existsSync(DIST_GATE)) {
  console.error(
    'verify-gate: dist/gate.html fehlt. Erst `npm run build`, dann `node scripts/verify-gate.mjs` — ' +
      'dieses Tor prueft den GEBAUTEN Stand, nicht die Quelle.'
  );
  process.exit(1);
}
if (!existsSync(NGINX_CONF) || !existsSync(NGINX_GATE_JS)) {
  console.error(`verify-gate: ${NGINX_CONF} oder ${NGINX_GATE_JS} fehlt.`);
  process.exit(1);
}

const confRaw = readFileSync(NGINX_CONF, 'utf8');
const htmlRaw = readFileSync(DIST_GATE, 'utf8');
const jsRaw = readFileSync(NGINX_GATE_JS, 'utf8');
const lines = confRaw.split(/\r?\n/);

let ok = true;
const fail = (msg) => {
  ok = false;
  console.error(`  FEHLER: ${msg}`);
};

// Untergrenzen. Duerfen nur nach OBEN wandern (Grundsatz 5) — eine
// leergeraeumte Liste haette sonst dasselbe Aussehen wie ein
// vollstaendiger Lauf. Stand 18.08.2026: 7 Ausnahmen, 2 Ressourcen
// (theme.css, fonts.css).
const MIN_AUSNAHMEN = 6;
const MIN_TORSEITE_RESSOURCEN = 2;

/* ---------- GATE-AUSNAHME-Zeilen einsammeln ---------- */
const AUSNAHME_RE = /^# GATE-AUSNAHME: (.+)$/;
const ausnahmen = [];
lines.forEach((line, i) => {
  const m = AUSNAHME_RE.exec(line);
  if (!m) return;
  const rest = m[1];
  const dashIdx = rest.indexOf(' — ');
  const pfad = dashIdx === -1 ? rest.trim() : rest.slice(0, dashIdx).trim();
  const anlass = dashIdx === -1 ? '' : rest.slice(dashIdx + 3).trim();
  ausnahmen.push({ pfad, anlass, zeile: i + 1, naechsteZeile: lines[i + 1] ?? '' });
});

console.log(`\n=== verify-gate: Ausnahmeliste gegen die gebaute Torseite (Schiene A) ===`);
console.log(`Geprueftes Artefakt: dist/ (${DIST_GATE}, ${NGINX_CONF}, ${NGINX_GATE_JS})`);

/* ---- [1] Jede Ausnahme traegt ihren Anlass ---- */
console.log('\n[1] Jede Ausnahme traegt ihren Anlass');
const mitLocation = ausnahmen.filter((a) => /\blocation\b/.test(a.naechsteZeile));
console.log(
  `    GATE-AUSNAHME-Zeilen: ${ausnahmen.length}   davon mit unmittelbar folgendem location-Block — Soll: ${ausnahmen.length}   Ist: ${mitLocation.length}`
);
for (const a of ausnahmen) {
  if (!/\blocation\b/.test(a.naechsteZeile))
    fail(`GATE-AUSNAHME "${a.pfad}" (Zeile ${a.zeile}): keine location-Zeile unmittelbar danach — Block ohne zugehoerigen Ort oder verschoben`);
}
const kurzeAnlaesse = ausnahmen.filter((a) => a.anlass.length < 10);
console.log(`    Anlass-Prosa >= 10 Zeichen — Soll: 0 zu kurz   Ist: ${kurzeAnlaesse.length}`);
for (const k of kurzeAnlaesse)
  fail(
    `GATE-AUSNAHME "${k.pfad}" (Zeile ${k.zeile}): Anlass traegt weniger als zehn Zeichen Prosa ("${k.anlass}") — ein Block ohne Anlass ist FEHLER`
  );
console.log(`    Ausnahmen insgesamt — Untergrenze: ${MIN_AUSNAHMEN}   Ist: ${ausnahmen.length}`);
if (ausnahmen.length < MIN_AUSNAHMEN)
  fail(`nur ${ausnahmen.length} GATE-AUSNAHME-Eintraege gefunden, Untergrenze ist ${MIN_AUSNAHMEN} — Ursache klaeren, nicht die Untergrenze senken`);

/* ---------- Torseiten-Ressourcen extrahieren (fuer [2] und [3]) ---------- */
function extractAttr(html, tag, attr) {
  const re = new RegExp(`<${tag}\\b[^>]*\\b${attr}\\s*=\\s*["']([^"']+)["']`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}
function extractStyleUrls(html) {
  const out = [];
  for (const block of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    for (const m of block[1].matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)) out.push(m[2]);
  }
  return out;
}
function extractCssUrls(css) {
  const out = [];
  for (const m of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)) out.push(m[2]);
  return out;
}
function normalizePfad(u) {
  if (!u) return null;
  if (u.startsWith('data:')) return null;
  if (u.startsWith('//')) return null; // protokoll-relativ -> fremder Host
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return null; // http:, https:, mailto: ...
  if (!u.startsWith('/')) return null; // same-origin-absolut ist die einzige Form auf dieser Seite
  return u.split('?')[0].split('#')[0];
}

const rohRessourcen = [
  ...extractAttr(htmlRaw, 'link', 'href'),
  ...extractAttr(htmlRaw, 'script', 'src'),
  ...extractAttr(htmlRaw, 'img', 'src'),
  ...extractAttr(htmlRaw, 'source', 'src'),
  ...extractStyleUrls(htmlRaw),
];
const ressourcen = [...new Set(rohRessourcen.map(normalizePfad).filter(Boolean))].sort();

/* ---- [2] Die Liste deckt, was die Torseite anfordert ---- */
console.log('\n[2] Die Liste deckt, was die Torseite (dist/gate.html) anfordert');
const exakt = new Set(ausnahmen.filter((a) => !a.pfad.endsWith('/')).map((a) => a.pfad));
const praefixe = ausnahmen.filter((a) => a.pfad.endsWith('/')).map((a) => a.pfad);
const gedecktDurchListe = (pfad) => exakt.has(pfad) || praefixe.some((p) => pfad.startsWith(p));
const ungedeckt = ressourcen.filter((r) => !gedecktDurchListe(r));
console.log(`    Angeforderte eigene Ressourcen: ${ressourcen.length} (${ressourcen.join(', ') || '—'})`);
console.log(`    Davon durch die Ausnahmeliste gedeckt — Soll: ${ressourcen.length}   Ist: ${ressourcen.length - ungedeckt.length}`);
for (const u of ungedeckt)
  fail(`Torseite fordert "${u}" an, aber keine GATE-AUSNAHME deckt diesen Pfad — ohne Ausnahme haengt niemand hinter dem Tor je hinein (Pitfall 6)`);
console.log(`    Ressourcen insgesamt — Untergrenze: ${MIN_TORSEITE_RESSOURCEN}   Ist: ${ressourcen.length}`);
if (ressourcen.length < MIN_TORSEITE_RESSOURCEN)
  fail(
    `nur ${ressourcen.length} eigene Ressourcen auf der Torseite gefunden, Untergrenze ist ${MIN_TORSEITE_RESSOURCEN} — Ursache klaeren (leergeraeumte Seite?), nicht die Untergrenze senken`
  );

/* ---- [3] Zombie-Waechter, die Gegenrichtung ---- */
console.log('\n[3] Zombie-Waechter: jede Ausnahme muss noch treffen');
// Transitiv: was die verlinkten, SELBST ausgenommenen .css-Dateien der
// Torseite ihrerseits per url() nachladen (die vier .woff2-Anker kommen
// aus assets/fonts.css, nicht direkt aus gate.html — ein echter Browser
// laedt sie trotzdem, weil er der CSS-Datei folgt).
const transitiv = [];
for (const r of ressourcen) {
  if (!r.endsWith('.css')) continue;
  const lokalePfad = 'dist' + r;
  if (!existsSync(lokalePfad)) continue;
  const css = readFileSync(lokalePfad, 'utf8');
  transitiv.push(...extractCssUrls(css).map(normalizePfad).filter(Boolean));
}
const erlaubtBasis = new Set([...ressourcen, ...transitiv]);
const FESTE_EXAKT = new Set(['/gate.html', '/build.json', '/robots.txt']);
const FESTE_PRAEFIXE = ['/_gate/'];

function hatDeckung(a) {
  if (a.pfad.endsWith('/')) {
    return [...erlaubtBasis].some((r) => r.startsWith(a.pfad)) || FESTE_PRAEFIXE.some((p) => a.pfad === p || a.pfad.startsWith(p));
  }
  return erlaubtBasis.has(a.pfad) || FESTE_EXAKT.has(a.pfad) || FESTE_PRAEFIXE.some((p) => a.pfad.startsWith(p));
}
const zombies = ausnahmen.filter((a) => !hatDeckung(a));
console.log(
  `    Ausnahmen geprueft: ${ausnahmen.length}   ohne Deckung (weder Torseite noch einer der vier festen Eintraege) — Soll: 0   Ist: ${zombies.length}`
);
for (const z of zombies)
  fail(
    `GATE-AUSNAHME "${z.pfad}": weder von der Torseite (direkt oder ueber eine ihrer .css-Dateien) angefordert noch einer der vier festen Eintraege (/gate.html, /_gate/, /build.json, /robots.txt) — Anlass verloren, Eintrag entfernen`
  );

/* ---- [4] Die Torseite bleibt eigenstaendig ---- */
console.log('\n[4] Die Torseite bleibt eigenstaendig (Pitfall 6, D-11)');
const hatAstroBuendel = /\/_astro\//.test(htmlRaw);
const hatSeitenmenue = /<nav\b/i.test(htmlRaw);
const hatDePartner = existsSync(DIST_DE_GATE);
console.log(`    Verweis auf ein /_astro/-Buendel — Soll: nein   Ist: ${hatAstroBuendel ? 'ja' : 'nein'}`);
console.log(`    <nav>-Seitenmenue im Dokument — Soll: nein   Ist: ${hatSeitenmenue ? 'ja' : 'nein'}`);
console.log(`    dist/de/gate.html existiert (ungepaart erwartet, D-11) — Soll: nein   Ist: ${hatDePartner ? 'ja' : 'nein'}`);
if (hatAstroBuendel)
  fail('dist/gate.html verweist auf ein /_astro/-Buendel — ein content-gehashter Bundle-Dateiname ist in der Ausnahmeliste nicht fest benennbar');
if (hatSeitenmenue) fail('dist/gate.html traegt ein <nav>-Element — die Menuestruktur eines gesperrten Bereichs waere selbst eine Auskunft (D-11)');
if (hatDePartner) fail('dist/de/gate.html existiert — die Torseite soll bewusst UNGEPAART bleiben (D-11, nur Englisch)');

/* ---- [5] Kein Geheimnis im Modul ---- */
console.log('\n[5] Kein Geheimnis im Modul (nginx/gate.js, D-09)');
// Nur der fuehrende Blockkommentar wird entfernt — gate.js hat keine
// //-Zeilenkommentare, die faelschlich "https://…"-Literale zerschneiden
// koennten (gepruefte Annahme, siehe Read-First dieser Aufgabe).
const jsOhneKopfkommentar = jsRaw.replace(/\/\*[\s\S]*?\*\//, '');
const nutztEnvVar = /process\.env\.VB_GATE_SECRET/.test(jsOhneKopfkommentar);
console.log(`    process.env.VB_GATE_SECRET wird gelesen — Soll: ja   Ist: ${nutztEnvVar ? 'ja' : 'NEIN'}`);
if (!nutztEnvVar) fail('nginx/gate.js liest VB_GATE_SECRET nicht (mehr) aus der Umgebung');

const langeLiterale = [];
for (const m of jsOhneKopfkommentar.matchAll(/\b\w*[Ss]ecret\w*\s*=\s*(['"`])((?:(?!\1)[^\\]|\\.)*)\1/g)) {
  if (m[2].length > 16) langeLiterale.push(m[2]);
}
console.log(`    Zeichenkettenliterale > 16 Zeichen an *secret*-Variablen — Soll: 0   Ist: ${langeLiterale.length}`);
if (langeLiterale.length)
  fail(`nginx/gate.js: ${langeLiterale.length} Zeichenkettenliteral(e) > 16 Zeichen an einer *secret*-Variablen — ein eingebauter Schluessel im Modul`);

const vorgabewerte = [];
for (const m of jsOhneKopfkommentar.matchAll(/process\.env\.VB_GATE_SECRET\s*\|\|\s*(['"`])((?:(?!\1)[^\\]|\\.)*)\1/g)) {
  if (m[2].length > 0) vorgabewerte.push(m[2]);
}
console.log(`    Vorgabewert bei fehlender VB_GATE_SECRET — Soll: keiner   Ist: ${vorgabewerte.length ? vorgabewerte.join(', ') : 'keiner'}`);
if (vorgabewerte.length)
  fail(
    `nginx/gate.js: ein Vorgabewert springt ein, wenn VB_GATE_SECRET fehlt ("${vorgabewerte[0]}") — der Tuersteher muss geschlossen ausfallen (D-09), nicht offen`
  );

/* ---- [6] Der Schalter ist umlegbar ---- */
console.log('\n[6] Der Schalter ist umlegbar ($vb_gate_on, Dockerfile-sed)');
const mapStart = lines.findIndex((l) => l.trim() === 'map $host $vb_gate_on {');
let hatVorgabe0 = false;
if (mapStart !== -1) {
  for (let i = mapStart + 1; i < lines.length; i++) {
    if (lines[i].trim() === '}') break;
    if (lines[i].trim() === 'default "0";') {
      hatVorgabe0 = true;
      break;
    }
  }
}
console.log(`    Zeile "map \$host \$vb_gate_on {" — Soll: vorhanden   Ist: ${mapStart !== -1 ? 'vorhanden' : 'FEHLT'}`);
console.log(`    Vorgabewert default "0"; im Block — Soll: vorhanden   Ist: ${hatVorgabe0 ? 'vorhanden' : 'FEHLT'}`);
if (mapStart === -1)
  fail(
    'nginx/default.conf: die Zeile "map $host $vb_gate_on {" fehlt oder ist nicht mehr exakt in dieser Form — der Dockerfile-sed zielt woertlich darauf und griffe nicht mehr'
  );
else if (!hatVorgabe0)
  fail(
    'nginx/default.conf: im $vb_gate_on-Block fehlt "default "0";" in genau dieser Form — der Dockerfile-sed griffe nicht mehr, und ohne diese Zusicherung fiele das erst auf, wenn die Vorschau offen steht'
  );

console.log(`\nverify-gate: ${ok ? 'ALLE ZUSICHERUNGEN ERFUELLT ✓' : 'FEHLGESCHLAGEN ✗'}`);
if (!ok) process.exit(1);
