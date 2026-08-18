/* ============================================================
   check-gate.mjs — Schiene C: die AUSGELIEFERTE Zugriffskontrolle,
   mit und ohne Ausweis (D-06, D-07, D-09/D-12, Phase 14 Plan 09).

   `node scripts/check-gate.mjs --base <url> [--live <url>] [--weich]`
   `npm run check:gate`   -> gegen https://staging.verse-base.com

   Vorbild: scripts/check-deployed.mjs — fragt eine LAUFENDE Seite,
   nicht den Quelltext, braucht deshalb Netz und kann prinzipbedingt
   nicht ins Dockerfile-Tor (Schiene A hat keinen laufenden Server;
   was OHNE Netz messbar ist, prueft scripts/verify-gate.mjs).

   Keine eigene Pfadliste: die gesperrten Stichproben kommen aus dist/
   (ein paar Leitseiten, dazu je eine Datei unter /_astro/ und /holo/),
   die offenen aus den GATE-AUSNAHME-Zeilen in nginx/default.conf —
   derselbe Text, den scripts/verify-gate.mjs liest. Zwei Listen, die
   auseinanderlaufen koennten, waeren genau die Sorte Pruefer, die
   gruen meldet und nichts misst (T-14-60).

   Fuenf Zusicherungen, jede mit Soll/Ist:

     1  Gesperrt ist gesperrt: jede gesperrte Stichprobe antwortet OHNE
        Cookie mit 302 auf /gate.html. Ein 200 ist FEHLER.
     2  Offen ist offen: jeder Eintrag der Ausnahmeliste antwortet ohne
        Cookie mit 200 (bei /_gate/mint genuegt "nicht 302", weil er
        ohne Kopfzeile 401 gibt, siehe nginx/gate.js mint()). Ein 302
        hier ist FEHLER — die Torseite wuerde sich selbst aussperren.
     3  /build.json lebt und traegt gueltiges JSON mit einer
        Commit-Kennung (D-07) — sonst koennte `npm run check:staging`
        still verstummen.
     4  Der Bypass ist kein Dauerschluessel (T-14-56/T-14-57): ein je
        Lauf gewuerfelter Wert in der Bypass-Kopfzeile (X-VB-Gate-
        Bypass, siehe nginx/gate.js und .github/workflows/
        deploy-staging.yml, Aufgabe 3 dieses Plans) auf eine gesperrte
        Stichprobe muss weiterhin 302 liefern. Ein 200 waere der
        schlimmste denkbare Zustand: ein offener Bypass, den niemand
        kennt.
     5  Die Live-Seite ist unberuehrt (nur mit --live <url>): eine
        gewoehnliche Seite antwortet mit 200 ohne jedes Cookie (D-12) —
        gegen das Artefakt geprueft, nicht behauptet.

   Selbstauskunft: gepruefte Adresse, Zahl der gesperrten und der
   offenen Stichproben. Untergrenzen als Sperrklinken — duerfen nur
   nach OBEN wandern (Grundsatz 5).

   --weich: Nichterreichbarkeit (Cloudflare weist Rechenzentren mit
   401/403/429 ab oder das Netz fehlt ganz — an scripts/check-
   deployed.mjs bereits gemessen) wird WARNUNG statt FEHLER. "Ich
   komme nicht hin" ist kein Befund ueber das Tor (Grundsatz 3). Ohne
   --weich bleibt der Lauf streng — wie `npm run check:staging` vom
   Entwicklungsrechner aus.
   ============================================================ */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const argv = process.argv.slice(2);
const flag = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const BASE = flag('--base', 'https://staging.verse-base.com').replace(/\/$/, '');
const LIVE = flag('--live', null);
const WEICH = argv.includes('--weich');

// Kopfzeile, gegen die eine gesperrte Stichprobe geprueft wird — dieselbe
// Marke, die nginx/gate.js check() (Aufgabe 3) und scripts/browser-smoke.mjs
// (SMOKE_GATE_BYPASS -> extraHTTPHeaders) verwenden. EIN Name, an einer
// Stelle benannt, damit er nicht auseinanderlaufen kann.
const BYPASS_HEADER = 'X-VB-Gate-Bypass';

// Untergrenzen. Duerfen nur nach OBEN wandern (Grundsatz 5) — eine
// leergeraeumte Ableitung haette sonst dasselbe Aussehen wie eine
// vollstaendige. Stand 18.08.2026: 5 gesperrte (3 Leitseiten + _astro +
// holo), 7 offene (aus nginx/default.conf).
const MIN_GESPERRT = 5;
const MIN_OFFEN = 4;

let ok = true;
const fail = (msg) => {
  ok = false;
  console.error(`  FEHLER: ${msg}`);
};

if (!existsSync('dist')) {
  console.error(
    'check-gate: dist/ fehlt. Erst `npm run build`, dann `node scripts/check-gate.mjs` — ' +
      'die Stichproben werden aus dem gebauten Stand abgeleitet.'
  );
  process.exit(1);
}
if (!existsSync('nginx/default.conf')) {
  console.error('check-gate: nginx/default.conf fehlt.');
  process.exit(1);
}

/* ---------- Stichproben aus dist/ und der Ausnahmeliste ableiten ---------- */
function walk(dir, ext, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p, ext, out);
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}
function ersteDatei(dir) {
  if (!existsSync(dir)) return null;
  const norm = dir.replace(/\/+$/, ''); // Aufrufer kann "dist/assets/fonts/" (mit Endschraegstrich) uebergeben
  const entries = readdirSync(norm)
    .filter((n) => !n.startsWith('.'))
    .sort();
  return entries.length ? `${norm}/${entries[0]}` : null;
}
function distPfadZuUrl(distPfad) {
  return distPfad === 'dist/index.html' ? '/' : distPfad.slice('dist'.length);
}

// Gesperrte Stichproben: Wurzel + zwei weitere Leitseiten (build.format:
// 'file' legt sie direkt unter dist/ ab, keine Unterverzeichnisse), dazu
// je eine Datei unter /_astro/ und /holo/ (D-06 sperrt ausdruecklich auch
// diese beiden, siehe nginx/default.conf).
const wurzelHtml = walk('dist', '.html')
  .filter((f) => f.split('/').length === 2 && f !== 'dist/gate.html' && f !== 'dist/404.html')
  .sort();
const leitseiten = ['dist/index.html', ...wurzelHtml.filter((f) => f !== 'dist/index.html')].slice(0, 3);
const astroDatei = ersteDatei('dist/_astro');
const holoDatei = ersteDatei('dist/holo');
const gesperrteStichproben = [...leitseiten, astroDatei, holoDatei].filter(Boolean).map(distPfadZuUrl);

// Offene Stichproben: aus den GATE-AUSNAHME-Zeilen in nginx/default.conf —
// keine eigene, zweite Liste, sondern derselbe Text, den scripts/verify-
// gate.mjs liest. Eine Praefix-Ausnahme (endet auf "/") wird ueber die
// erste Datei im entsprechenden dist/-Verzeichnis in eine konkrete URL
// aufgeloest.
const confText = readFileSync('nginx/default.conf', 'utf8');
const AUSNAHME_RE = /^# GATE-AUSNAHME: (.+)$/gm;
const ausnahmePfade = [];
let am;
while ((am = AUSNAHME_RE.exec(confText))) {
  const rest = am[1];
  const dashIdx = rest.indexOf(' — ');
  ausnahmePfade.push(dashIdx === -1 ? rest.trim() : rest.slice(0, dashIdx).trim());
}
function offeneStichprobeFuer(pfad) {
  if (!pfad.endsWith('/')) return pfad;
  const lokal = ersteDatei(`dist${pfad}`);
  return lokal ? distPfadZuUrl(lokal) : null;
}
const offeneStichproben = ausnahmePfade
  .map((pfad) => ({ pfad, url: offeneStichprobeFuer(pfad) }))
  .filter((e) => e.url);

console.log(`\n=== check-gate: die ausgelieferte Zugriffskontrolle gegen ${BASE} ===`);
console.log(`Gesperrte Stichproben (aus dist/): ${gesperrteStichproben.length}   ${gesperrteStichproben.join(', ') || '—'}`);
console.log(`Offene Stichproben (aus nginx/default.conf): ${offeneStichproben.length}   ${offeneStichproben.map((e) => e.url).join(', ') || '—'}`);

if (gesperrteStichproben.length < MIN_GESPERRT)
  fail(
    `nur ${gesperrteStichproben.length} gesperrte Stichproben abgeleitet, Untergrenze ist ${MIN_GESPERRT} — Ursache klaeren (dist/ unvollstaendig?), nicht die Untergrenze senken`
  );
if (offeneStichproben.length < MIN_OFFEN)
  fail(
    `nur ${offeneStichproben.length} offene Stichproben abgeleitet, Untergrenze ist ${MIN_OFFEN} — Ursache klaeren (Ausnahmeliste geschrumpft?), nicht die Untergrenze senken`
  );

/* ---------- Netz-Hilfsfunktion ---------- */
// ⚠ MIT Zeitlimit und redirect:'manual' — wir wollen den 302 SEHEN, nicht
// ihm folgen (genau umgekehrt zu scripts/check-deployed.mjs, das den
// Endstand einer offenen Ressource lesen will).
async function holen(pfad, { headers = {} } = {}) {
  return fetch(`${BASE}${pfad}`, {
    redirect: 'manual',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
    headers: { 'cache-control': 'no-cache', ...headers },
  });
}

/* ---------- Erreichbarkeit vorab pruefen (Muster: check-deployed.mjs) ---------- */
// /robots.txt ist selbst eine GATE-AUSNAHME (offen) — ein 401/403/429 hier
// ist NICHT das Tor, sondern Cloudflares Bot-Schutz vor Rechenzentrums-IPs
// (an check-deployed.mjs bereits gemessen, dieselbe Sperre wie bei UEX).
async function vorabErreichbar() {
  try {
    const r = await holen('/robots.txt');
    if ([401, 403, 429].includes(r.status)) return { erreichbar: false, grund: `Bot-Schutz vor der Domain (HTTP ${r.status})` };
    return { erreichbar: true };
  } catch (e) {
    return { erreichbar: false, grund: e.message };
  }
}

const vorab = await vorabErreichbar();
if (!vorab.erreichbar) {
  const satz = `${BASE} ist von hier aus nicht erreichbar (${vorab.grund}) — keine Aussage ueber das Tor.`;
  if (WEICH) {
    console.log(`\n${satz}`);
    console.log('\ncheck-gate: NICHT geprueft — von hier aus nicht erreichbar (--weich)\n');
    process.exit(0);
  }
  console.error(`\ncheck-gate: 1 FEHLER\n\n  · ${satz}\n`);
  process.exit(1);
}

/* ---- [1] Gesperrt ist gesperrt ---- */
console.log('\n[1] Gesperrt ist gesperrt');
let gesperrtOk = 0;
for (const pfad of gesperrteStichproben) {
  try {
    const r = await holen(pfad);
    const location = r.headers.get('location') || '';
    const trifft = r.status === 302 && /\/gate\.html/.test(location);
    if (trifft) gesperrtOk++;
    else
      fail(
        `${pfad}: Soll 302 auf /gate.html, Ist ${r.status}${location ? ' Location: ' + location : ''}` +
          (r.status === 200 ? ' — die Seite ist OHNE Ausweis lesbar' : '')
      );
  } catch (e) {
    fail(`${pfad}: Anfrage fehlgeschlagen (${e.message})`);
  }
}
console.log(`    Gepruefte gesperrte Stichproben: ${gesperrteStichproben.length}   302 auf /gate.html — Soll: ${gesperrteStichproben.length}   Ist: ${gesperrtOk}`);

/* ---- [2] Offen ist offen ---- */
console.log('\n[2] Offen ist offen');
let offenOk = 0;
for (const eintrag of offeneStichproben) {
  try {
    const r = await holen(eintrag.url);
    const istMint = eintrag.pfad === '/_gate/mint';
    const trifft = istMint ? r.status !== 302 : r.status === 200;
    if (trifft) offenOk++;
    else
      fail(
        `${eintrag.url} (Ausnahme "${eintrag.pfad}"): Soll ${istMint ? 'nicht 302' : '200'}, Ist ${r.status}` +
          (r.status === 302 ? ' — die Torseite spert sich damit selbst aus' : '')
      );
  } catch (e) {
    fail(`${eintrag.url} (Ausnahme "${eintrag.pfad}"): Anfrage fehlgeschlagen (${e.message})`);
  }
}
console.log(`    Gepruefte offene Stichproben: ${offeneStichproben.length}   erwartetes Ergebnis erreicht — Soll: ${offeneStichproben.length}   Ist: ${offenOk}`);

/* ---- [3] /build.json lebt (D-07) ---- */
console.log('\n[3] /build.json lebt und traegt eine Commit-Kennung (D-07)');
{
  try {
    const r = await holen('/build.json');
    if (r.status !== 200) {
      console.log(`    /build.json erreichbar — Soll: 200   Ist: ${r.status}`);
      fail(`/build.json: Soll 200, Ist ${r.status} — npm run check:staging koennte still verstummen`);
    } else {
      const body = await r.json().catch(() => null);
      const kennung = body && typeof body.sha === 'string' && body.sha.length >= 7 ? body.sha.slice(0, 7) : null;
      console.log(`    /build.json erreichbar, gueltiges JSON mit Commit-Kennung — Soll: ja   Ist: ${kennung ? `ja (${kennung})` : 'NEIN'}`);
      if (!kennung) fail('/build.json: kein lesbares JSON mit Commit-Kennung (Feld "sha") — npm run check:staging koennte still verstummen');
    }
  } catch (e) {
    fail(`/build.json: Anfrage fehlgeschlagen (${e.message})`);
  }
}

/* ---- [4] Der Bypass ist kein Dauerschluessel ---- */
console.log('\n[4] Der Bypass ist kein Dauerschluessel (T-14-56/T-14-57)');
{
  const ziel = gesperrteStichproben[0];
  const geraten = randomBytes(16).toString('hex');
  try {
    const r = await holen(ziel, { headers: { [BYPASS_HEADER]: geraten } });
    const trifft = r.status === 302;
    console.log(`    ${ziel} mit gewuerfeltem Wert in ${BYPASS_HEADER} — Soll: 302   Ist: ${r.status}`);
    if (!trifft)
      fail(
        `${ziel} mit einem gewuerfelten Wert in ${BYPASS_HEADER} antwortet ${r.status} statt 302 — ein Bypass steht offen, den niemand kennt (der schlimmste denkbare Zustand)`
      );
  } catch (e) {
    fail(`Bypass-Probe gegen ${ziel} fehlgeschlagen (${e.message})`);
  }
}

/* ---- [5] Die Live-Seite ist unberuehrt (nur mit --live) ---- */
console.log(`\n[5] Die Live-Seite ist unberuehrt (D-12)${LIVE ? '' : ' — uebersprungen, kein --live angegeben'}`);
if (LIVE) {
  const liveBase = LIVE.replace(/\/$/, '');
  try {
    const r = await fetch(`${liveBase}/`, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(15000) });
    console.log(`    ${liveBase}/ ohne jedes Cookie — Soll: 200   Ist: ${r.status}`);
    if (r.status !== 200) fail(`${liveBase}/ antwortet ${r.status} statt 200 ohne jedes Cookie — die Live-Seite waere hinter dem Tor gelandet (D-12)`);
  } catch (e) {
    fail(`Live-Probe gegen ${liveBase} fehlgeschlagen (${e.message})`);
  }
}

console.log(`\ncheck-gate: ${ok ? 'ALLE ZUSICHERUNGEN ERFUELLT ✓' : 'FEHLGESCHLAGEN ✗'}`);
if (!ok) process.exit(1);
