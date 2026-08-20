/* ============================================================
   browser-smoke.mjs — die Leitseiten in einem ECHTEN Browser.

   WARUM ES DEN GIBT: Bis zum 09.08.2026 hat kein einziges Tor je eine Seite
   in einen Browser geladen. Alle Pruefungen lesen dist/ als TEXT oder fuehren
   Inline-Skripte gegen ein Mock-DOM aus. Damit ist eine ganze Fehlerklasse
   unbewacht — „HTML korrekt, Browser macht trotzdem etwas anderes":

     · clip-path ueber backdrop-filter (Menue-Eintritt 840 ms statt 320)
     · :global() in <style is:inline> — der Browser wirft die Regel still weg
     · assets/theme.css killt jede Scrollbar mit !important
     · stale ?v=-Cache-Busts zeigen auf Dateien, die es nicht mehr gibt
     · eine klebende Filterspalte ohne max-height macht sticky wirkungslos
     · Kontrast 1,74:1 im Hellmodus, waehrend das Kontrast-Tor gruen meldet

   Jede dieser Fallen ist real passiert. Konzept: docs/maschinelle-
   validierung.md, Baustein B6.

   ABSICHTLICH KEIN zweiter E2E-Testbestand: das Verhalten pruefen bereits 234
   node:vm-Tests gegen die ECHTEN Inline-Skripte, deterministisch und ohne
   Browserstart. Was denen fehlt, ist die UMGEBUNG — CSS-Wirkung, CSP-Header,
   Ladefehler. Genau die und nicht mehr prueft dieses Skript, mit wenigen
   scharfen Zusicherungen statt einer breiten Suite.

   ⚠ LAEUFT NICHT IM BUILD-CONTAINER (node:22-alpine hat keinen Browser) und
   gehoert deshalb NICHT in `npm run gate`. Es prueft eine LAUFENDE Seite:
   in CI den frisch gebauten Container vor dem Push, lokal `astro preview`
   oder eine beliebige URL.

   Sechs Zusicherungen je Seitenaufruf:
     1  keine unbehandelte JS-Ausnahme (pageerror)
     2  keine eigene Ressource antwortet mit >= 400 (faengt tote ?v=-Verweise)
     3  kein CSP-Verstoss (securitypolicyviolation am Dokument)
     4  das Leitelement der Seite ist WIRKLICH sichtbar, nicht nur im DOM
     5  kein waagerechter Ueberlauf (die wiederkehrende 360-px-Falle)
     6  Selbstauskunft + Klinke: wie viele Aufrufe wurden wirklich gefahren

     node scripts/browser-smoke.mjs --base http://localhost:4321
     node scripts/browser-smoke.mjs --base https://staging.verse-base.com
   ============================================================ */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const argv = process.argv.slice(2);
const flag = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const BASE = (flag('--base', process.env.SMOKE_BASE || 'http://localhost:8080')).replace(/\/$/, '');
const NUR = flag('--only', null);          // Teilmenge zur Diagnose
const KOPF = argv.includes('--headed');    // zum Zusehen

// Testpilot-Tor (Plan 09, Aufgabe 3): steht das Tor auf dem Ziel scharf
// (CI-Pruef-Container, VB_GATE_BYPASS gesetzt), kaeme der Rauchtest ohne
// diesen Wert nicht an einer einzigen Leitseite vorbei — jeder Aufruf
// liefe auf /gate.html statt auf die echte Seite. Der Wert wandert an
// ZWEI Stellen: in jeden Browser-Kontext (extraHTTPHeaders, damit jeder
// Seitenaufruf ihn traegt) und an den robots.txt-Abruf VOR dem Lauf unten
// (sonst bricht der ohne den Wert schon mit Exit 2 ab, bevor der Browser
// ueberhaupt startet). Ist die Variable nicht gesetzt (lokal gegen astro
// preview, wo es kein Tor gibt), aendert sich am Verhalten nichts.
const GATE_BYPASS = process.env.SMOKE_GATE_BYPASS || '';
const GATE_BYPASS_HEADERS = GATE_BYPASS ? { 'X-VB-Gate-Bypass': GATE_BYPASS } : {};

// Untergrenze der Aufrufe. Wie ueberall im Projekt: darf nur nach OBEN
// wandern. Ohne sie waere eine leergeraeumte Seitenliste von einem
// vollstaendigen Lauf nicht zu unterscheiden — beide melden gruen.
const MIN_AUFRUFE = 34;

/* ---------- Browser finden ---------- */
// playwright-core bringt bewusst KEINEN Browser mit (~5 MB statt ~300).
// Genommen wird der installierte — dieselbe Loesung wie bei den
// Sichtpruefungen der Phasen 2-4.
const KANDIDATEN = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean);
const BROWSER = KANDIDATEN.find((p) => existsSync(p));
if (!BROWSER) {
  console.error('\nKein Browser gefunden. Gesucht wurde an diesen Stellen:\n');
  for (const k of KANDIDATEN) console.error(`  ${k}`);
  console.error('\nEinen Pfad ueber CHROME_PATH setzen, dann laeuft es.\n');
  process.exit(2);
}

/* ---------- Die Leitseiten ----------
   Nicht alle 17.361 Seiten, sondern je einmal jede BAUART: Startseite,
   die vier JS-schweren Werkzeuge, ein Themen-Koerper mit zwei
   Hilfe-Instanzen, eine Patch-Seite mit Ambiente, eine erzeugte
   Detailseite und der 404-Fall. Was hier laeuft, laeuft auf den
   Geschwisterseiten mit — sie entstehen aus demselben Koerper.
   `leit` ist bewusst ein Bedienelement oder ein Inhaltstraeger, KEIN
   Kopfleisten-Element: die Kopfleiste steht auch auf einer Seite, deren
   Inhalt gar nicht geladen hat. */
const SEITEN = [
  { id: 'start', en: '/', de: '/de.html', leit: 'main', schwer: true },
  {
    id: 'item-finder', en: '/item-finder.html', de: '/de/item-finder.html',
    leit: '#uif-search-input', schwer: true, probe: probeItemFinder,
  },
  {
    id: 'schiffe', en: '/schiffe.html', de: '/de/schiffe.html',
    leit: '#sf-q', schwer: true, probe: probeSchiffe,
  },
  { id: 'crafting', en: '/crafting.html', de: '/de/crafting.html', leit: '.dp-card--cat', minAnzahl: 50, schwer: true },
  { id: 'archiv', en: '/archiv.html', de: '/de/archiv.html', leit: 'main' },
  { id: 'missionen', en: '/missionen.html', de: '/de/missionen.html', leit: 'main' },
  { id: 'armor-sets', en: '/armor-sets.html', de: '/de/armor-sets.html', leit: 'main' },
  { id: 'precision-jump', en: '/precision-jump.html', de: '/de/precision-jump.html', leit: 'main' },
  { id: 'support', en: '/support.html', de: '/de/support.html', leit: 'main' },
  { id: 'downloads', en: '/downloads.html', de: '/de/downloads.html', leit: 'main' },
  // Zwei unabhaengige ToolHelp-Instanzen auf EINER Seite (Phase 1.2, Plan 02).
  { id: 'mining-thema', en: '/topics/mining.html', de: '/de/topics/mining.html', leit: '[data-tool-id]', minAnzahl: 2 },
  // Patch-Koerper: eigenes Ambiente, eigener .reveal-Beobachter, eigenes body::after.
  { id: 'patch', en: '/patches/sc-4-9-0.html', de: '/de/patches/sc-4-9-0.html', leit: 'main', schwer: true },
  // Erzeugte Detailseite (eine von ~17.000) — stellvertretend fuer die Masse.
  { id: 'item-detail', en: '/items/hardy-boots.html', de: '/de/items/hardy-boots.html', leit: 'main' },
  // Der 404-Fall: nginx muss die EIGENE Seite ausliefern, nicht sein
  // Standardblatt. Als Marke dient der Heimweg-Link — ein `h1` haette auch
  // die nginx-Standardseite („404 Not Found"), dieser Link nur unserer.
  // ⚠ Bewusst NICHT `main`: die 404-Seite hat keine solche Landmarke
  // (gemessen 09.08.2026, sie traegt nur h1 + Text). Das ist eine kleine
  // A11y-Luecke und gehoert zu audit:site, nicht hierher — dieser Test soll
  // sie nicht heimlich mit erledigen.
  { id: '404', en: '/gibtsnicht-abcxyz.html', de: null, leit: 'a.home', erwarteterStatus: 404 },
];

/* ---------- Varianten ----------
   Alles einmal in Dunkel bei 1280x720 (der Normalfall). Die JS-schweren
   Seiten zusaetzlich schmal und hell — dort sitzen die dokumentierten
   Fallen (360-px-Ueberlauf, Hellmodus-Kontrast). Der Hellmodus ist
   Admin-only, siehe hellmodusSetzen(). */
const VARIANTEN = [
  { id: 'dunkel-1280', breite: 1280, hoehe: 720, schema: 'dark', alle: true },
  { id: 'dunkel-360', breite: 360, hoehe: 740, schema: 'dark', alle: false },
  { id: 'hell-1280', breite: 1280, hoehe: 720, schema: 'light', hell: true, alle: false },
];

/* ---------- Benannte Ausnahmen ----------
   Jede Zeile ist eine BEKANNTE, gemessene Abweichung — kein Freibrief. Sie
   nennt ihren Anlass, und der Zombie-Waechter am Ende reisst, sobald der
   Befund verschwunden ist: eine Ausnahme, die niemand mehr braucht, muss
   raus. Verfahren wie scripts/lib/sync-exclusions.mjs.

   ⚠ Ausnahmen sind SCHULDEN, keine Dauerzustaende. Sie erscheinen bei jedem
   Lauf in der Bilanz. */
const AUSNAHMEN = [
  // Leer — und das ist der Normalzustand. Der einzige Eintrag, den es je
  // gab (X-de-patch-360-ueberlauf), ist am 09.08.2026 durch den Fix in
  // src/components/patches/sc-4-9-0.astro entfallen; der Zombie-Waechter
  // unten haette ihn sonst selbst eingefordert.
];
const benutzteAusnahmen = new Set();
const erklaert = [];

// Der selbst gehostete Zaehler (Umami). Auf dem Vorschau-Build absichtlich
// aus der CSP genommen, auf dem Live-Build absichtlich erlaubt — siehe [3].
const ZAEHLER_HOST = /stats\.verse-base\.com/;

const fehler = [];
let aufrufe = 0, geprueftePunkte = 0, erwarteteCsp = 0;

/* ---------- Hellmodus erzwingen ----------
   Drei Stolpersteine, alle drei sind bei den Sichtpruefungen passiert:
   1. Die Wahl ist Admin-only (Nicht-Admins haengen fest auf Dunkel).
   2. addInitScript trifft beim ERSTEN Aufruf den leeren Ursprung — der
      Speicher landet im Nirgendwo. Also: laden, setzen, NEU laden.
   3. reconcile() zieht das Theme nach ein paar hundert ms an die echte
      Rolle zurueck. Direkt vor der Messung data-theme nochmal setzen. */
async function hellmodusSetzen(page) {
  await page.evaluate(() => {
    sessionStorage.setItem('vb_user_role', '{"role":"admin"}');
    localStorage.setItem('vb.theme', 'light');
    localStorage.setItem('vb.help.seen', '{"all":1}'); // Erstbesuch-Hilfe wegraeumen
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  // Gegenpruefen, statt es zu glauben.
  const ist = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  if (ist !== 'light') return `Hellmodus liess sich nicht setzen (data-theme="${ist}")`;
  return null;
}

/* ---------- Interaktionsproben ----------
   Wenige, dafuer scharfe: filtert das Werkzeug wirklich, oder sieht es nur
   so aus? Beides liest den Ergebniszaehler der Seite, nicht ein Textfeld. */
async function probeItemFinder(page) {
  const zaehler = page.locator('#uif-stats-count');
  const vorher = (await zaehler.textContent().catch(() => '')) ?? '';
  await page.fill('#uif-search-input', 'arrow');
  await page.waitForTimeout(600); // die Liste baut sich clientseitig neu auf
  const nachher = (await zaehler.textContent().catch(() => '')) ?? '';
  const treffer = await page.locator('#uif-results-grid > *').count();
  if (nachher === vorher) return `Suche "arrow" aenderte den Ergebniszaehler nicht (${vorher})`;
  if (!treffer) return 'Suche "arrow" ergab 0 gerenderte Treffer';
  return null;
}

async function probeSchiffe(page) {
  const zaehler = page.locator('#sf-count');
  const vorher = parseInt((await zaehler.textContent().catch(() => '')) ?? '', 10);
  // Erste echte Rollenfamilie waehlen (Index 1, weil 0 die Alle-Option ist).
  const werte = await page.locator('#sf-rolefam option').evaluateAll((os) => os.map((o) => o.value));
  const wahl = werte.find((v) => v);
  if (!wahl) return 'Rollenfilter #sf-rolefam hat keine auswaehlbare Option';
  await page.selectOption('#sf-rolefam', wahl);
  await page.waitForTimeout(400);
  const nachher = parseInt((await zaehler.textContent().catch(() => '')) ?? '', 10);
  if (!Number.isFinite(vorher) || !Number.isFinite(nachher))
    return `Ergebniszaehler #sf-count ist keine Zahl (vorher "${vorher}", nachher "${nachher}")`;
  if (nachher >= vorher) return `Rollenfilter "${wahl}" senkte die Trefferzahl nicht (${vorher} -> ${nachher})`;
  if (nachher === 0) return `Rollenfilter "${wahl}" liess 0 Schiffe uebrig`;
  return null;
}

/* ---------- Ein Seitenaufruf ---------- */
async function pruefe(kontext, variante, seite, pfad, sprache) {
  const page = await kontext.newPage();
  const jsFehler = [];
  const schlechteAntworten = [];
  page.on('pageerror', (e) => jsFehler.push(e.message.split('\n')[0]));
  page.on('response', (r) => {
    if (r.url().startsWith(BASE) && r.status() >= 400 && r.status() !== (seite.erwarteterStatus ?? -1))
      schlechteAntworten.push(`${r.status()} ${r.url().slice(BASE.length)}`);
  });

  const marke = `${seite.id}/${sprache} [${variante.id}]`;
  // Ein Befund ist ein FEHLER — es sei denn, genau diese Stelle steht als
  // benannte Ausnahme mit Grund in AUSNAHMEN. Dann wird sie als erklaert
  // verbucht UND als benutzt vermerkt; der Zombie-Waechter am Ende reisst,
  // sobald eine Ausnahme ihren Anlass verloren hat. Gleiches Verfahren wie
  // scripts/lib/sync-exclusions.mjs.
  const melde = (punkt, m) => {
    const a = AUSNAHMEN.find(
      (x) => x.seite === seite.id && x.sprache === sprache && x.variante === variante.id && x.punkt === punkt,
    );
    if (a) { benutzteAusnahmen.add(a.id); erklaert.push(`${marke} ${punkt}: ${m}`); return; }
    fehler.push(`${marke}: ${m}`);
  };

  try {
    const antwort = await page.goto(BASE + pfad, { waitUntil: 'domcontentloaded', timeout: 30000 });
    aufrufe++;
    if (seite.erwarteterStatus && antwort?.status() !== seite.erwarteterStatus)
      melde('status', `Status ${antwort?.status()} statt ${seite.erwarteterStatus}`);

    if (variante.hell) {
      const p = await hellmodusSetzen(page);
      if (p) melde('hell', p);
    }

    // [1] keine unbehandelte JS-Ausnahme
    geprueftePunkte++;
    if (jsFehler.length) melde('js', `JS-Ausnahme: ${jsFehler.slice(0, 2).join(' | ')}`);

    // [2] keine eigene Ressource >= 400
    geprueftePunkte++;
    if (schlechteAntworten.length)
      melde('http', `${schlechteAntworten.length} eigene Ressource(n) >= 400: ${schlechteAntworten.slice(0, 3).join(', ')}`);

    // [3] CSP — und zwar artefakt-abhaengig, in BEIDE Richtungen.
    //
    // Der Vorschau-Build nimmt den Zaehl-Host absichtlich aus der CSP
    // (Dockerfile: der sed auf die $vb_rum_-Map), damit die Vorschau nicht
    // in die Live-Statistik zaehlt. Der daraus folgende CSP-Verstoss ist
    // dort GEWOLLT und im Dockerfile so beschrieben — ihn als Fehler zu
    // melden waere ein Dauer-Fehlalarm auf 47 von 47 Aufrufen (genau das
    // ist beim ersten CI-Lauf am 09.08.2026 passiert).
    //
    // Auf dem LIVE-Build kehrt sich die Erwartung um: dort MUSS der Zaehler
    // laden duerfen. Ein Verstoss waere dann eine abgeschaltete Statistik —
    // dieselbe Sorte stiller Schaden, gegen die audit:csp gebaut ist.
    geprueftePunkte++;
    const csp = [...new Set(await page.evaluate(() => window.__cspVerstoesse ?? []))];
    const erwartet = csp.filter((v) => ZAEHLER_HOST.test(v));
    const unerwartet = csp.filter((v) => !ZAEHLER_HOST.test(v));
    if (unerwartet.length) melde('csp', `CSP-Verstoss: ${unerwartet.slice(0, 3).join(', ')}`);
    if (erwartet.length) {
      if (IST_VORSCHAU) erwarteteCsp++;
      else melde('csp', `der Zaehl-Host ist auf dem LIVE-Build blockiert: ${erwartet[0]} — die Besucherstatistik laedt nicht`);
    }

    // [4] Leitelement wirklich sichtbar
    geprueftePunkte++;
    const leit = page.locator(seite.leit);
    const anzahl = await leit.count();
    if (!anzahl) melde('leit', `Leitelement "${seite.leit}" fehlt`);
    else {
      if (!(await leit.first().isVisible())) melde('leit', `Leitelement "${seite.leit}" ist im DOM, aber unsichtbar`);
      if (seite.minAnzahl && anzahl < seite.minAnzahl)
        melde('leit', `nur ${anzahl}x "${seite.leit}", erwartet >= ${seite.minAnzahl}`);
    }

    // [5] kein waagerechter Ueberlauf
    //
    // Gemessen wird `document.body.scrollWidth` — und zwar genau der, nach
    // zwei verworfenen Anlaeufen, die beide die Negativkontrolle aufgedeckt
    // hat (09.08.2026):
    //
    //   · `documentElement.scrollWidth` ist NUTZLOS: die Seite setzt
    //     `overflow-x: clip` auf html UND body, der Wert wird dort auf die
    //     Fensterbreite gedeckelt. Ein eingeschobenes 3000px-Element blieb
    //     unbemerkt — die Zusicherung war unfaelschbar gruen.
    //   · Die „rechte Kante des breitesten Elements" ist ZU SCHARF: sie
    //     ignoriert, dass ein Elternelement beschneidet. Das Hero-Motiv
    //     (.hero__photo) ist absichtlich 1510px breit und wird vom
    //     Container geschnitten — es meldete 115px „Ueberlauf", den kein
    //     Besucher je sieht. Ein Dauer-Fehlalarm auf jeder Seite mit Hero.
    //
    // body.scrollWidth trifft beides richtig: es sieht echten Ueberlauf
    // (3000 gegen 1280) und respektiert das Beschneiden durch Vorfahren.
    // Waagerecht scrollende Kaesten (.vb-scrollbox) faelschen es ebenfalls
    // nicht — ihr Inhalt haengt an ihrem eigenen Scrollbereich.
    // Schwelle 4px, nicht 0: /archiv meldet 1281 statt 1280, ohne dass ein
    // einziges unbeschnittenes Element uebersteht (in einem isolierten
    // Rahmen nachgemessen, 09.08.2026) — Subpixel-Rundung aus Raendern und
    // Rastern. Was diese Pruefung finden SOLL, ist abgeschnittener Inhalt,
    // und der faengt bei zweistelligen Werten an (der DE-Patch-Fall unten:
    // 31px). Eine Schwelle, die Rauschen von Inhalt trennt, ist kein
    // aufgeweichter Test — eine bei 0 waere ein Dauer-Fehlalarm.
    geprueftePunkte++;
    const ueber = await page.evaluate(() =>
      Math.round(document.body.scrollWidth - window.innerWidth),
    );
    if (ueber > 4) melde('ueberlauf', `waagerechter Ueberlauf: ${ueber}px breiter als das Fenster`);

    // Interaktionsprobe nur im Normalfall — sie soll das Verhalten belegen,
    // nicht dreimal dasselbe.
    if (seite.probe && variante.id === 'dunkel-1280') {
      geprueftePunkte++;
      const p = await seite.probe(page);
      if (p) melde('probe', p);
    }
  } catch (e) {
    melde('aufruf', `Aufruf fehlgeschlagen: ${e.message.split('\n')[0]}`);
  } finally {
    await page.close();
  }
}

/* ---------- Welches Artefakt liegt da? ----------
   Am ARTEFAKT erkannt (gesperrte robots.txt), nicht an einer Umgebungs-
   variablen — dasselbe Signal, das deploy-staging.yml am fertigen Image
   prueft und das audit:site seit dem 09.08.2026 nutzt. Der Unterschied ist
   nicht kosmetisch: Vorschau- und Live-Build erwarten beim Zaehl-Host das
   GEGENTEIL voneinander. */
let IST_VORSCHAU = false;
try {
  const r = await fetch(`${BASE}/robots.txt`, { headers: GATE_BYPASS_HEADERS });
  IST_VORSCHAU = /^Disallow:\s*\/\s*$/m.test(await r.text());
} catch (e) {
  console.error(`\n${BASE}/robots.txt ist nicht erreichbar (${e.message}) — laeuft der Server?\n`);
  process.exit(2);
}

/* ---------- Lauf ---------- */
console.log(`\n=== Browser-Rauchtest gegen ${BASE} ===`);
console.log(`Artefakt: ${IST_VORSCHAU ? 'Vorschau-Build (site-weit noindex)' : 'Live-Build'}`);
// Selbstauskunft, unter welcher Bedingung dieser Lauf gruen war (Grundsatz
// 7) — und dieselbe Zeile macht sichtbar, wenn jemand lokal versehentlich
// MIT Bypass misst.
console.log(`Testpilot-Tor-Bypass: ${GATE_BYPASS ? 'MIT Bypass geprueft (SMOKE_GATE_BYPASS gesetzt)' : 'ohne Bypass'}`);
console.log(`Browser: ${BROWSER}\n`);

const browser = await chromium.launch({ executablePath: BROWSER, headless: !KOPF });
const seiten = NUR ? SEITEN.filter((s) => s.id === NUR) : SEITEN;
if (!seiten.length) {
  console.error(`Unbekannte Seite "${NUR}". Bekannt: ${SEITEN.map((s) => s.id).join(', ')}`);
  await browser.close();
  process.exit(2);
}

for (const variante of VARIANTEN) {
  const dran = seiten.filter((s) => variante.alle || s.schwer);
  if (!dran.length) continue;
  console.log(`\n──────── Variante ${variante.id} (${dran.length} Seiten) ────────`);
  const kontext = await browser.newContext({
    viewport: { width: variante.breite, height: variante.hoehe },
    colorScheme: variante.schema,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: GATE_BYPASS_HEADERS,
  });
  // CSP-Verstoesse am Dokument mitschreiben — das ist das einzige Signal,
  // das den echten nginx-Header prueft. Muss VOR dem ersten Laden haengen.
  await kontext.addInitScript(() => {
    window.__cspVerstoesse = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspVerstoesse.push(`${e.violatedDirective} ${e.blockedURI || ''}`.trim());
    });
  });
  // Fremde Hosts abbrechen: CI hat keinen verlaesslichen Weg ins Netz, und
  // der Ausfall eines Dritten ist kein Fehler dieser Seite.
  await kontext.route('**/*', (route) => {
    route.request().url().startsWith(BASE) ? route.continue() : route.abort();
  });

  for (const s of dran) {
    const fassungen = [['en', s.en]];
    if (s.de) fassungen.push(['de', s.de]);
    for (const [sprache, pfad] of fassungen) {
      process.stdout.write(`  ${s.id}/${sprache} … `);
      const vorher = fehler.length;
      await pruefe(kontext, variante, s, pfad, sprache);
      console.log(fehler.length === vorher ? 'ok' : 'FEHLER');
    }
  }
  await kontext.close();
}
await browser.close();

/* ---------- Urteil ---------- */
console.log(`\n=== Bilanz ===`);
console.log(`  Seitenaufrufe: ${aufrufe}   Untergrenze: ${MIN_AUFRUFE}`);
console.log(`  gepruefte Einzelpunkte: ${geprueftePunkte}`);
if (IST_VORSCHAU)
  console.log(`  erwartete CSP-Verstoesse (Zaehl-Host, im Vorschau-Build gewollt): ${erwarteteCsp}`);
if (aufrufe < MIN_AUFRUFE && !NUR)
  fehler.push(`nur ${aufrufe} Seitenaufrufe, Untergrenze ist ${MIN_AUFRUFE} — Ursache klaeren, nicht die Untergrenze senken`);

// Ausnahmen sichtbar halten — und den Zombie-Waechter fahren.
if (erklaert.length) {
  console.log(`\n  ⚠ Durch benannte Ausnahmen erklaert (${erklaert.length}) — offene Schulden:`);
  for (const e of erklaert) console.log(`    · ${e}`);
}
if (!NUR) {
  for (const a of AUSNAHMEN) {
    if (benutzteAusnahmen.has(a.id)) continue;
    fehler.push(
      `Ausnahme "${a.id}" hat in diesem Durchgang nichts erklaert — der Befund ist weg. Ausnahme ersatzlos entfernen (Zombie-Waechter).`,
    );
  }
}

if (fehler.length) {
  console.error(`\nbrowser-smoke: ${fehler.length} FEHLER\n`);
  for (const f of fehler) console.error(`  · ${f}`);
  console.error('');
  process.exit(1);
}
console.log('\nbrowser-smoke: ALLE ZUSICHERUNGEN ERFUELLT ✓\n');
