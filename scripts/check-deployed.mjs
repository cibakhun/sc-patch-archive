/* ============================================================
   check-deployed.mjs — liefert die Seite wirklich den Stand aus, den ich
   gerade gebaut habe?

   `npm run check:staging`   gegen https://staging.verse-base.com
   `npm run check:live`      gegen https://verse-base.com
   `node scripts/check-deployed.mjs --base <url> [--sha <commit>] [--warte 600]`

   WARUM ES DEN GIBT: "CI ist gruen" beantwortet die Frage NICHT.

     · 08.08.2026 (cf58c76): jeder staging-Build riss am neunten Tor,
       staging lieferte knapp vier Stunden den Vortagsstand aus. Eine
       Sitzung schrieb daraufhin "alle 5 Phasen durch, auf staging" ins
       Gedaechtnis, und eine Sichtpruefung haette gegen einen Build
       geprueft, der den Fix gar nicht enthielt.
     · Coolify hing an anderem Tag 20 Minuten in der Warteschlange,
       nachdem CI laengst gruen war.

   Ohne Soll-Kennung wird `git rev-parse origin/staging` bzw. origin/main
   befragt — hier laeuft das Skript auf dem Entwicklungsrechner, wo es git
   gibt (anders als im Build-Container, siehe _write-build-stamp.mjs).

   Weist der Bot-Schutz vor der Domain /build.json ab (401/403/429), liest
   das Skript denselben Stempel aus <base>/build.txt — gemessen 08.11.2026:
   Cloudflare sperrt den GitHub-Runner seit mindestens 01.11. fuer .json,
   HTML und Pfade ohne Endung, laesst aber Endungen durch, die es als
   statisch fuehrt (.css, .js, robots.txt; .txt steht auf seiner Liste).
   So soll der Warte-Schritt der Deploy-Laeufe wieder messen, statt nach
   einer Sekunde "NICHT geprueft" zu melden (ob Cloudflare /build.txt dem
   Runner durchlaesst, zeigt erst der erste Lauf damit). Kommt /build.txt
   aus Cloudflares Zwischenspeicher (cf-cache-status HIT/STALE/UPDATING),
   zaehlt die Antwort nicht: sie
   sagt nichts ueber den Deploy, und ein alter Stempel daraus waere ein
   falscher FEHLER.

   Vier Zusicherungen:
     1  <base>/build.json (bei Sperre <base>/build.txt) ist erreichbar und lesbar
     2  die ausgelieferte Kennung entspricht der erwarteten
     3  Vorschau/Live passt zum Ziel (eine Live-Domain darf keinen
        Vorschau-Build ausliefern und umgekehrt)
     4  Selbstauskunft: Kennung, Alter des Builds, Ziel
   ============================================================ */
import { execFileSync } from 'node:child_process';

const argv = process.argv.slice(2);
const flag = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const BASE = (flag('--base', 'https://staging.verse-base.com')).replace(/\/$/, '');
const WARTE = Number(flag('--warte', '0'));           // Sekunden pollen
const ERWARTET_VORSCHAU = argv.includes('--vorschau');
const ERWARTET_LIVE = argv.includes('--live');
// --weich: „gar nicht erreichbar" wird WARNUNG statt FEHLER; eine falsche
// Kennung bleibt in jedem Fall ein FEHLER.
//
// WARUM diese Unterscheidung (Grundsatz 3): „die Seite liefert den falschen
// Stand" ist ein Befund, gegen den jemand etwas tun kann. „CI kommt an die
// Domain nicht heran" ist keiner — Cloudflare steht mit Bot-Schutz davor,
// und UEX zeigt schon, dass Rechenzentrums-IPs hier geblockt werden. Ein
// Schritt, der nach einem tadellosen Deploy rot wird, weil der Runner nicht
// hinkommt, ist genau der Fehlalarm, der binnen einer Woche uebergangen
// wird. Lokal (`npm run check:staging`) laeuft die Pruefung deshalb streng.
const WEICH = argv.includes('--weich');

/** Soll-Kennung: Argument, sonst der Zweig-Kopf aus git. */
function sollSha() {
  const arg = flag('--sha', null);
  if (arg) return arg.trim();
  const zweig = ERWARTET_LIVE ? 'origin/main' : 'origin/staging';
  try {
    return execFileSync('git', ['rev-parse', zweig], { encoding: 'utf8' }).trim();
  } catch {
    return null; // kein git / kein Repository — dann nur berichten
  }
}

const SOLL = sollSha()?.toLowerCase() ?? null;
if (SOLL !== null && !/^[0-9a-f]{7,40}$/.test(SOLL)) {
  console.error(`check-deployed: --sha "${SOLL}" ist keine Commit-Kennung (7 bis 40 Hex-Zeichen).`);
  process.exit(2);
}
const kurz = (s) => (s ? s.slice(0, 7) : '—');
// --sha darf gekuerzt sein (mind. 7 Zeichen), build.json traegt immer die
// volle Kennung: verglichen wird deshalb ueber den Anfang. Am 29.10.2026 lief
// `--sha 59d2421` volle zehn Minuten in die Wartegrenze und meldete dann
// "liefert 59d2421 aus, erwartet war 59d2421" als FEHLER.
const istSoll = (ist) => !!ist && String(ist).toLowerCase().startsWith(SOLL);

// ⚠ MIT Zeitlimit. Ohne das haengt der Aufruf, wenn die Gegenstelle die
// Verbindung offen haelt statt zu antworten — und ein Wartelauf in CI, der
// „bis zu 10 Minuten" pollen soll, laeuft dann bis zum Job-Timeout weiter.
// Genau so passiert am 09.08.2026 im ersten scharfen Lauf: der Schritt stand
// noch, als der Deploy laengst durch war. Ein Tor, das haengt, ist schlimmer
// als eins, das rot wird.
const SPERRE = new Set([401, 403, 429]);
const anfrage = (url) =>
  fetch(url, {
    cache: 'no-store',
    redirect: 'manual', // die Vorschau leitet ohne Ausweis auf /gate.html um — das ist kein Stempel
    signal: AbortSignal.timeout(15000),
    headers: { 'cache-control': 'no-cache' },
  });
/** Fehler mit Grund: `gesperrt` = Bot-Schutz, `zwischenspeicher` = Antwort
 *  aus Cloudflares Cache. Beides ist keine Aussage ueber den Deploy, und
 *  Weiterpollen aendert daran nichts. */
const fehler = (msg, art) => Object.assign(new Error(msg), art ? { [art]: true } : {});

let quelle = 'build.json';
async function hole() {
  const r = await anfrage(`${BASE}/build.json`);
  if (r.ok) {
    quelle = 'build.json';
    return r.json();
  }
  if (!SPERRE.has(r.status)) throw fehler(`HTTP ${r.status}`);
  // build.json gesperrt: derselbe Stempel als build.txt. Wegwerf-Parameter
  // je Anfrage, damit Cloudflare jede beim Ursprung holt (er gehoert zum
  // Cache-Schluessel, nginx ignoriert ihn fuer die location-Wahl).
  const t = await anfrage(`${BASE}/build.txt?vbst=${Date.now().toString(36)}`);
  const vorne = `build.json HTTP ${r.status}, build.txt`;
  if (SPERRE.has(t.status)) throw fehler(`HTTP ${r.status} (build.json), HTTP ${t.status} (build.txt)`, 'gesperrt');
  // 404 oder die Umleitung des Tors: das laufende Image ist aelter als
  // build.txt — waehrend eines Deploys genau der Zustand vor dem Wechsel.
  if (!t.ok) throw fehler(`${vorne} HTTP ${t.status}`);
  const cache = (t.headers.get('cf-cache-status') ?? '').toUpperCase();
  if (['HIT', 'STALE', 'UPDATING'].includes(cache))
    throw fehler(`${vorne} kam aus Cloudflares Zwischenspeicher (cf-cache-status ${cache})`, 'zwischenspeicher');
  let body = null;
  try { body = JSON.parse(await t.text()); } catch { /* unten */ }
  if (!body || typeof body.sha !== 'string' || !/^[0-9a-f]{7,40}$|^dev$/i.test(body.sha))
    throw fehler(`${vorne} traegt keinen lesbaren Stempel`);
  quelle = `build.txt (build.json: HTTP ${r.status})`;
  return body;
}

console.log(`\n=== Ausgelieferter Stand von ${BASE} ===`);
console.log(`Soll-Kennung: ${kurz(SOLL)}${SOLL ? '' : ' (kein git — es wird nur berichtet)'}\n`);

const bis = Date.now() + WARTE * 1000;
let stempel = null, letzterFehler = null, gesperrt = false, zwischenspeicher = false;
for (;;) {
  try {
    stempel = await hole();
    if (!SOLL || istSoll(stempel.sha)) break;
    letzterFehler = `ausgeliefert ${kurz(stempel.sha)}, erwartet ${kurz(SOLL)}`;
  } catch (e) {
    letzterFehler = e.message;
    // build.json fehlt: entweder laeuft der Deploy noch, oder der Stand ist
    // aelter als dieses Verfahren (dann ist genau das die Antwort).
    //
    // 403/401/429 auf BEIDEN Wegen ist etwas ANDERES: das ist der Bot-
    // Schutz vor der Domain, keine Aussage ueber den Deploy. Weiterzupollen
    // bringt dann nichts — gemessen am 09.08.2026: der GitHub-Runner bekommt
    // von Cloudflare durchgehend 403, der Schritt lief zehn Minuten fuer
    // nichts. Dieselbe Sperre wie bei UEX. Also sofort abbrechen statt das
    // Fenster auszusitzen. Ebenso bei einer Antwort aus dem Zwischenspeicher.
    if (e.gesperrt) { gesperrt = true; break; }
    if (e.zwischenspeicher) { zwischenspeicher = true; break; }
  }
  if (Date.now() >= bis) break;
  process.stdout.write('.');
  await new Promise((r) => setTimeout(r, 10000));
}
if (WARTE) console.log('');
if (gesperrt)
  console.log(`Abgebrochen: die Domain weist diesen Rechner ab (${letzterFehler}) — Bot-Schutz, keine Aussage ueber den Deploy.\n`);
if (zwischenspeicher)
  console.log(`Abgebrochen: ${letzterFehler} — keine Aussage ueber den Deploy.\n`);

const fail = [];

console.log('[1] Stempel erreichbar (build.json, bei Sperre build.txt)');
if (!stempel) {
  console.log(`    Ist: nein (${letzterFehler})`);
  const satz =
    `Der Stempel von ${BASE} ist nicht abrufbar (${letzterFehler}). Entweder laeuft der Deploy noch, ` +
    `oder die ausgelieferte Fassung ist aelter als der Build-Stempel — dann ist sie in jedem Fall nicht der aktuelle Stand.`;
  if (WEICH) {
    console.log(`    WARNUNG (--weich): ${satz}`);
    if (gesperrt || zwischenspeicher) {
      console.log(`    Grund ist ${gesperrt ? 'der Bot-Schutz vor der Domain' : 'Cloudflares Zwischenspeicher'}, nicht der Deploy — von hier aus`);
      console.log('    ist die Frage nicht beantwortbar. Auf dem Entwicklungsrechner geht es:');
    } else {
      console.log('    Blockiert nicht — von hier aus laesst sich nicht unterscheiden, ob die Seite');
      console.log('    alt ist oder ob dieser Rechner sie nur nicht erreicht. Lokal nachsehen:');
    }
    console.log('      npm run check:staging');
  } else {
    fail.push(satz);
  }
} else {
  console.log(`    Ist: ja   Kennung ${stempel.kurz}   gebaut ${stempel.gebautAm}   Quelle ${quelle}`);
}

if (stempel) {
  console.log('\n[2] Kennung stimmt mit dem erwarteten Stand ueberein');
  if (!SOLL) {
    console.log('    uebersprungen: keine Soll-Kennung ermittelbar');
  } else {
    console.log(`    Soll: ${kurz(SOLL)}   Ist: ${stempel.kurz}`);
    if (!istSoll(stempel.sha))
      fail.push(
        `die Seite liefert ${kurz(stempel.sha)} aus, erwartet war ${kurz(SOLL)} — ` +
          `der Deploy ist noch nicht durch oder ein Build ist fehlgeschlagen. "CI gruen" heisst nicht "ausgeliefert".`,
      );
  }

  console.log('\n[3] Vorschau/Live passt zum Ziel');
  console.log(`    Artefakt: ${stempel.staging ? 'Vorschau-Build' : 'Live-Build'}`);
  if (ERWARTET_VORSCHAU && !stempel.staging)
    fail.push('auf der Vorschau-Domain liegt ein LIVE-Build — er waere indexierbar und damit Duplicate Content');
  if (ERWARTET_LIVE && stempel.staging)
    fail.push('auf der Live-Domain liegt ein VORSCHAU-Build — die ganze Domain stuende auf noindex');

  console.log('\n[4] Selbstauskunft');
  const alterMin = Math.round((Date.now() - Date.parse(stempel.gebautAm)) / 60000);
  console.log(`    Ziel ${BASE} · Kennung ${stempel.kurz} · Build ${Number.isFinite(alterMin) ? alterMin + ' Min alt' : 'Zeit unlesbar'}`);
}

if (fail.length) {
  console.error(`\ncheck-deployed: ${fail.length} FEHLER\n`);
  for (const f of fail) console.error(`  · ${f}`);
  console.error('');
  process.exit(1);
}
// Nicht „bestanden" behaupten, wenn gar nichts geprueft werden konnte — das
// waere dieselbe hohle Gruen-Meldung, gegen die das ganze Verfahren gebaut
// ist (siehe die leere Schiene in run-gate.mjs).
if (!stempel) {
  console.log('\ncheck-deployed: NICHT geprueft — der Stempel war nicht erreichbar (--weich)\n');
  process.exit(0);
}
console.log(`\ncheck-deployed: die Seite liefert den erwarteten Stand aus ✓ (gelesen aus ${quelle})\n`);
