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
     · Kontrast 1,74:1 im (inzwischen entfernten) Hellmodus, waehrend das
       Kontrast-Tor gruen meldete

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

   Acht Zusicherungen je Seitenaufruf:
     1  keine unbehandelte JS-Ausnahme (pageerror)
     2  keine eigene Ressource antwortet mit >= 400 (faengt tote ?v=-Verweise)
     3  kein CSP-Verstoss (securitypolicyviolation am Dokument)
     4  das Leitelement der Seite ist WIRKLICH sichtbar, nicht nur im DOM
     5  kein waagerechter Ueberlauf (die wiederkehrende 360-px-Falle)
     6  kein Element mit hidden-Attribut wird gezeichnet
     7  Selbstauskunft + Klinke: wie viele Aufrufe wurden wirklich gefahren
     8  1, 2 und 3 auch nach dem ersten Blick (nachgeladene Dateien, alles,
        was eine Probe bedient, Seiten in einem Rahmen), und jedes eigene
        Stilblatt ist geladen (ein gescheitertes meldet der Browser nie als
        Antwort). Stilblaetter und CSP melden die Dokumente selbst, jedes in
        jedem Rahmen und sofort: auch eines, das es am Ende nicht mehr gibt

     node scripts/browser-smoke.mjs --base http://localhost:4321
     node scripts/browser-smoke.mjs --base https://staging.verse-base.com
   ============================================================ */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { hangarImArtefaktUeberNetz } from './lib/hangar-switch.mjs';

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
const MIN_AUFRUFE = 40;
// [6] Wie viele Elemente mit hidden-Attribut der Lauf je angesehen hat.
// Gemessen 07.11.2026: 1128 im Vorschau-Bau, davon 790 auf den beiden
// Hangar-Szenarien; ohne sie (Live-Bau) bleiben 338. Die Untergrenze gilt
// fuer beide Artefakte. Ohne Klinke waere ein Lauf, dessen Abfrage still
// nichts findet, von einem echten nicht zu unterscheiden.
const MIN_HIDDEN = 300;
// [7] Filter-Schubladen am Telefon: Crafting-Planer und Missionen je EN/DE
// (der Vorschau-Bau hat mit der Werkbank zwei mehr).
const MIN_SCHUBLADEN = 4;

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
// Zusatzschalter fuer den Browser, z. B. wie im CI-Container ohne GPU:
// SMOKE_CHROME_ARGS="--disable-gpu" (Software-WebGL als Rueckfall) oder
// "--use-angle=swiftshader --enable-unsafe-swiftshader" (erzwungen).
const BROWSER_ARGS = (process.env.SMOKE_CHROME_ARGS || '').split(/\s+/).filter(Boolean);
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
   Detailseite, der 3D-Hangar und der 404-Fall. Was hier laeuft, laeuft auf den
   Geschwisterseiten mit — sie entstehen aus demselben Koerper.
   `leit` ist bewusst ein Bedienelement oder ein Inhaltstraeger, KEIN
   Kopfleisten-Element: die Kopfleiste steht auch auf einer Seite, deren
   Inhalt gar nicht geladen hat. */
const SEITEN = [
  { id: 'start', en: '/', de: '/de.html', leit: 'main', schwer: true, probe: probeSuche },
  {
    id: 'item-finder', en: '/item-finder.html', de: '/de/item-finder.html',
    leit: '#uif-search-input', schwer: true, probe: probeItemFinder,
  },
  {
    id: 'schiffe', en: '/schiffe.html', de: '/de/schiffe.html',
    leit: '#sf-q', schwer: true, probe: probeSchiffe,
  },
  // Die Crafting-Werkbank, ein Prototyp nur im Vorschau-Bau (Skizze 016-3).
  // Sie steht unter demselben Schalter wie der Hangar (hangarImBau), daher
  // nurMitHangar; verify:hangar-schalter [4]/[5] prueft beide Richtungen.
  {
    id: 'crafting-werkbank', en: '/topics/crafting-werkbank.html', de: '/de/topics/crafting-werkbank.html',
    leit: '#cdb-grid .cbp', minAnzahl: 50, schwer: true, probe: probeWerkbank, nurMitHangar: true,
  },
  { id: 'crafting', en: '/crafting.html', de: '/de/crafting.html', leit: '.dp-card--cat', minAnzahl: 50, schwer: true },
  // Der Crafting-Planer mit seiner Konto-Anzeige. Am Handy stand dort
  // „Synced to your account" neben „Sign in" und „Retry" (Krisz, 07.11.2026):
  // die Logik setzte hidden richtig, mobile-ux.css hob es auf. Die Probe
  // spielt jeden Zustand der Anzeige bei 360 und 1280 px durch.
  {
    id: 'crafting-planer', en: '/topics/crafting.html', de: '/de/topics/crafting.html',
    leit: '#cdb-grid .cbp', minAnzahl: 50, schwer: true,
    probe: async (page) => (await probeZurueckMarke(page, 'Crafting-Planer')) ?? (await probeZerlegen(page, 'Crafting-Planer')) ?? (await probeRezeptDialog(page, 'Crafting-Planer')) ?? (await probeCraftingSync(page)),
  },
  { id: 'archiv', en: '/archiv.html', de: '/de/archiv.html', leit: 'main' },
  // schwer: auch bei 360 px, wegen der Filter-Schublade ([7]).
  { id: 'missionen', en: '/missionen.html', de: '/de/missionen.html', leit: 'main', schwer: true },
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
  // Der 3D-Hangar, als tiefer Link auf ein Schiff, das nicht das Startschiff
  // ist: die Ausstattung kommt dann als Buchtdokument per Abruf.
  {
    id: 'hangar',
    // station=uebersicht&tafel=1: die Vorgabe ist die Station Loadout (Werkstatt), geprueft werden hier
    // die Schiffsdaten als Tafel; ohne tafel=1 stuende die Uebersicht ab 761 px als Hologramm in der Halle.
    en: '/hangar.html?ship=drak-cutlass-black&tab=weapons&hp=hardpoint_turret&station=uebersicht&tafel=1',
    de: '/de/hangar.html?ship=drak-cutlass-black&tab=weapons&hp=hardpoint_turret&station=uebersicht&tafel=1',
    leit: '#hgx-panelhost .hgx-slot', schwer: true, probe: probeHangar,
    // spieltEin: Die Probe „Wiederholen nach gescheiterter Bucht“ beantwortet
    // einen Buchtabruf selbst mit 500. Genau so viele Fehlantworten ohne Server
    // nimmt [8] diesem Szenario ab, keine mehr, und fehlt sie nach einer Probe
    // ohne Befund, reisst das Tor (die Ausnahme haette ihren Anlass verloren).
    spieltEin: 1,
    nurMitHangar: true,
  },
  // Die Layout-Werkstatt, die Vorgabe der Tafel: ihre Slots kommen aus
  // /hangar-layouts.json und stehen erst, wenn Datei und Skript geladen sind.
  // tafel=1: ohne steht die Ausruestung ab 761 px als Hologramm in der Halle
  // (dieselbe Werkstatt, gezeichnet statt als Knoepfe), und #hgl-slots bleibt zu.
  { id: 'hangar-layout', en: '/hangar.html?tafel=1', de: '/de/hangar.html?tafel=1', leit: '#hgl-slots .hgl-slot', minAnzahl: 3, warteLeit: 30000, probe: async (page) => (await probeWerkstatt(page)) ?? (await probeTerminal(page)) ?? (await probeFussleiste(page)) ?? (await probeLeitTastatur(page)), minRahmenAntworten: 8, minRahmenBlaetter: 8, nurMitHangar: true },
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
   Alles einmal bei 1280x720 (der Normalfall). Die JS-schweren Seiten
   zusaetzlich schmal — dort sitzt die dokumentierte Falle (360-px-
   Ueberlauf) — und mit einer alten Hell-Wahl im Browser: den hellen Modus
   gibt es seit dem 02.11.2026 nicht mehr, wer ihn vorher gewaehlt hatte,
   muss trotzdem die dunkle Seite bekommen (siehe alteHellwahl()). Das
   Betriebssystem steht in dieser Variante auf hell, damit auch ein
   Rueckfall auf prefers-color-scheme auffiele. */
const VARIANTEN = [
  { id: 'dunkel-1280', breite: 1280, hoehe: 720, schema: 'dark', alle: true },
  { id: 'dunkel-360', breite: 360, hoehe: 740, schema: 'dark', alle: false },
  { id: 'alte-hellwahl-1280', breite: 1280, hoehe: 720, schema: 'light', alteHellwahl: true, alle: false },
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
let aufrufe = 0, geprueftePunkte = 0, erwarteteCsp = 0, hiddenGeprueft = 0, syncAnzeigen = 0, schubladen = 0, fussBreiten = 0, fussEng = 0, fussNeben = 0, probenLaeufe = 0, probenAntworten = 0, probenRahmen = 0, probenEingespielt = 0, leitKnoepfe = 0, stilblaetter = 0, stilDokumente = 0, stilGehoert = 0, stilRahmen = 0, cspGehoertGesamt = 0, cspSpaetGesamt = 0;

/* ---------- Was „sichtbar“ heisst ----------
   EINE Bestimmung fuer die Frage „sieht man das?“, damit keine Probe ihre
   eigene, schwaechere schreibt (Anlass: drei Review-Runden an #345, jede fand
   an der eigenen Fassung der Werkstatt-Probe eine Luecke weiter:
   hidden-Attribut, visibility, Opazitaet, dann an dieser hier der Kasten
   ohne Flaeche). Sichtbar ist ein Element, das einen Kasten MIT FLAECHE hat
   (Breite und Hoehe ueber null: transform:scale(0) oder eine auf null
   zusammengeschobene Zeile behalten ihren Kasten) und das der Browser selbst
   als sichtbar ausweist: Element.checkVisibility mit visibility und
   Opazitaet, beides ueber alle Vorfahren. checkVisibility gibt es erst ab
   Chrome 105 (die Optionsnamen ab 121, davor checkVisibilityCSS/
   checkOpacity); ohne es entscheidet der berechnete Stil des Elements und
   seiner Vorfahren.
   NICHT geprueft sind Lage, Beschnitt und Ueberdeckung (aus dem Bild
   geschoben, clip-path, von einem Vorfahren abgeschnitten, etwas liegt
   darueber). Das ist eine andere Frage und bekommt, wo sie zaehlt, eine
   eigene Probe wie kreuzVerdeckt.
   SICHTBAR laeuft im Browser und darf nichts von hier draussen benutzen. */
const SICHTBAR = (el) => {
  if (!el || ![...el.getClientRects()].some((r) => r.width > 0 && r.height > 0)) return false;
  if (typeof el.checkVisibility === 'function') {
    return el.checkVisibility({ visibilityProperty: true, opacityProperty: true, checkVisibilityCSS: true, checkOpacity: true });
  }
  if (getComputedStyle(el).visibility !== 'visible') return false;
  for (let n = el; n; n = n.parentElement) if (getComputedStyle(n).opacity === '0') return false;
  return true;
};
/* fn laeuft im Browser und bekommt SICHTBAR als zweites Argument. Eine
   Funktion laesst sich einer Seite nicht als Argument mitgeben, deshalb reist
   ihr Quelltext im Ausdruck mit. */
const mitSichtbar = (page, fn, arg = null) => page.evaluate(`(${fn})(${JSON.stringify(arg)}, ${SICHTBAR})`);

/* ---------- Alte Hell-Wahl im Browser ----------
   Bis zum 02.11.2026 konnten Admins hell waehlen; die Wahl lag als
   vb.theme im localStorage und bleibt dort liegen, bis die Seite sie
   raeumt (Kopfskript in Layout.astro). Nachgespielt wird genau das:
   Admin-Rolle im Sitzungs-Cache, vb.theme=light, dann NEU laden —
   addInitScript traefe beim ersten Aufruf den leeren Ursprung.
   Geprueft wird am Ergebnis, nicht am Code: die Wahl ist weg, <html>
   traegt kein data-theme, die Seite rechnet mit color-scheme dark, und
   die Seitenflaeche ist wirklich dunkel. */
async function alteHellwahl(page) {
  await page.evaluate(() => {
    sessionStorage.setItem('vb_user_role', '{"role":"admin"}');
    localStorage.setItem('vb.theme', 'light');
    localStorage.setItem('vb.help.seen', '{"all":1}'); // Erstbesuch-Hilfe wegraeumen
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const st = await page.evaluate(() => {
    const deckend = (el) => {
      const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g) || [];
      return m.length >= 3 && (m[3] === undefined || +m[3] > 0.5) ? m.slice(0, 3).map(Number) : null;
    };
    return {
      rest: localStorage.getItem('vb.theme'),
      attr: document.documentElement.getAttribute('data-theme'),
      schema: getComputedStyle(document.documentElement).colorScheme,
      grund: deckend(document.body) || deckend(document.documentElement),
    };
  });
  if (st.rest !== null) return `die alte Wahl vb.theme="${st.rest}" liegt nach dem Laden noch im Browser`;
  if (st.attr !== null) return `<html> traegt data-theme="${st.attr}"`;
  if (!/dark/.test(st.schema)) return `color-scheme ist "${st.schema}", erwartet dark`;
  if (st.grund) {
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const L = 0.2126 * lin(st.grund[0]) + 0.7152 * lin(st.grund[1]) + 0.0722 * lin(st.grund[2]);
    if (L > 0.1) return `die Seitenflaeche ist hell (rgb ${st.grund.join(',')}, Leuchtdichte ${L.toFixed(2)})`;
  }
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

/* Die Suche (Strg+K) von der Startseite aus, zweimal: am Desktop und auf
   einem Telefon mit Touch (isMobile setzt hover:none + pointer:coarse).
   Anlass 07.11.2026: Krisz tippte am iPhone auf staging "Panther" und sah
   nur einen leeren Streifen und Tastenhinweise (Pfeile, Enter, Esc), die es
   dort nicht gibt. "Panther" steht nur im ZWEITEN Index-Teil (Items) — ein
   Treffer der Art Item belegt, dass beide Teile durch die echte Auslieferung
   (nginx, CSP, Tor) ankommen und durchsucht werden. Auf Touch muessen die
   Fusszeile mit den Tastenhinweisen weg sein und der Schliessen-Knopf ein
   Wort statt "Esc" zeigen; am Desktop bleibt beides. Wie die Liste Laden und Scheitern zeigt,
   prueft tests/e2e/suche-status.test.js. */
async function probeSuche(page) {
  const WORT = 'Panther';
  // Sichtbare Zeilen einer Trefferliste als Text: so vergleicht der
  // Rauchtest Startseiten-Feld und Dialog (ein Suchkern, Skizze 016).
  const zeilenText = (p, liste) =>
    p.$$eval(`${liste} > li[role="option"]`, (ls) => ls.map((l) => `${l.className.replace(/\s*\bsel\b/, '')} | ${l.innerText.replace(/\s+/g, ' ').trim()}`));
  const pruefen = async (p, touch) => {
    const wo = touch ? 'Telefon' : 'Desktop';
    // 1. Das grosse Feld der Startseite sucht selbst — kein zweites Fenster.
    await (touch ? p.tap('#hs-in') : p.click('#hs-in'));
    if (!(await p.locator('#hs.is-open').count())) return `${wo}: das Startseiten-Feld klappt beim Antippen keine Treffer auf`;
    if (!(await p.locator('#scs').isHidden())) return `${wo}: das Startseiten-Feld oeffnete den Dialog statt selbst zu suchen`;
    await p.locator('#hs-in').fill(WORT);
    const feldItem = p.locator('#hs-list .scs__hit--item');
    await feldItem.first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    if (!(await feldItem.count())) {
      const liste = ((await p.locator('#hs-list').innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
      return `${wo}: Startseiten-Feld, "${WORT}" zeigte keinen Item-Treffer (Liste: "${liste.slice(0, 120) || 'leer'}")`;
    }
    // Liegt die Liste im Bild? (Der Hero schneidet sein Bild zu, nicht die
    // Treffer; ein abgeschnittenes Panel saehe aus wie "nur eine Zeile".)
    const panel = await p.locator('.hs__panel').boundingBox();
    if (!panel || panel.height < 120) return `${wo}: die Trefferliste unter dem Feld ist nur ${panel ? Math.round(panel.height) : 0} px hoch`;
    const tasten = await p.locator('#hs-list .scs__keys').isVisible().catch(() => false);
    if (touch && tasten) return `${wo}: Tastenhinweise im Startseiten-Feld stehen auf einem Touch-Geraet`;
    if (!touch && !tasten) return `${wo}: Tastenhinweise im Startseiten-Feld fehlen`;
    if (touch) {
      // Auf dem Telefon steht das Feld oben, die Kopfleiste ist weg.
      await p.waitForTimeout(700);
      const feld = await p.locator('#hs-field').boundingBox();
      if (!feld || feld.y > 40) return `${wo}: das Feld rueckt beim Suchen nicht nach oben (y=${feld ? Math.round(feld.y) : '?'})`;
      const leiste = await p.locator('#topbar').boundingBox();
      if (leiste && leiste.y + leiste.height > 4) return `${wo}: die Kopfleiste liegt beim Suchen ueber dem Feld`;
    }
    const feldZeilen = await zeilenText(p, '#hs-list');
    const hx = p.locator('.hs__x');
    const hk = await hx.boundingBox();
    if (!hk) return `${wo}: Schliessen-Knopf des Startseiten-Felds nicht sichtbar`;
    const haufschrift = ((await hx.innerText().catch(() => '')) || '').trim();
    if (touch) {
      if (!haufschrift || /\besc\b/i.test(haufschrift)) return `${wo}: Schliessen im Startseiten-Feld zeigt "${haufschrift}" statt eines Worts`;
      if (hk.width < 44 || hk.height < 44) return `${wo}: Schliessen im Startseiten-Feld nur ${Math.round(hk.width)}x${Math.round(hk.height)} px (Ziel 44x44)`;
    } else if (!/^esc$/i.test(haufschrift)) return `${wo}: Schliessen im Startseiten-Feld zeigt "${haufschrift}" statt "Esc"`;
    await (touch ? hx.tap() : hx.click());
    if (await p.locator('#hs.is-open').count()) return `${wo}: das Startseiten-Feld schliesst nicht ueber den Knopf`;

    // 2. Weiter unten auf der Seite oeffnet der Knopf der Kopfleiste den
    //    Dialog — mit DERSELBEN Liste fuer dasselbe Wort.
    await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await p.waitForTimeout(400);
    await (touch ? p.tap('.snav__search') : p.click('.snav__search'));
    if (await p.locator('#scs').isHidden()) return `${wo}: der Suchknopf der Kopfleiste oeffnet unten auf der Startseite keinen Dialog`;
    await p.locator('#scs-in').fill(WORT);
    const item = p.locator('#scs-list .scs__hit--item');
    await item.first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    if (!(await item.count())) {
      const liste = ((await p.locator('#scs-list').innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
      return `${wo}: Suche "${WORT}" zeigte keinen Item-Treffer (Liste: "${liste.slice(0, 120) || 'leer'}")`;
    }
    const dialogZeilen = await zeilenText(p, '#scs-list');
    if (JSON.stringify(dialogZeilen) !== JSON.stringify(feldZeilen)) {
      const i = dialogZeilen.findIndex((z, n) => z !== feldZeilen[n]);
      return `${wo}: Dialog und Startseiten-Feld zeigen fuer "${WORT}" verschiedene Listen (Zeile ${i + 1}: Feld "${feldZeilen[i] ?? '—'}", Dialog "${dialogZeilen[i] ?? '—'}")`;
    }
    const fuss = await p.locator('.scs__foot').isVisible();
    if (touch && fuss) return `${wo}: Tastenhinweise (↑↓ ↵ Esc) stehen auf einem Touch-Geraet`;
    if (!touch && !fuss) return `${wo}: Tastenhinweise der Suche fehlen`;
    const x = p.locator('.scs__x');
    const kasten = await x.boundingBox();
    if (!kasten) return `${wo}: Schliessen-Knopf der Suche nicht sichtbar`;
    // Sichtbarer Text (innerText laesst display:none weg): "Esc" nur mit
    // Tastatur, auf Touch das Wort fuer Schliessen.
    const aufschrift = ((await x.innerText().catch(() => '')) || '').trim();
    if (touch) {
      if (!aufschrift || /\besc\b/i.test(aufschrift)) return `${wo}: Schliessen-Knopf zeigt "${aufschrift}" statt eines Worts fuer Schliessen`;
      if (kasten.width < 44 || kasten.height < 44)
        return `${wo}: Schliessen-Knopf nur ${Math.round(kasten.width)}x${Math.round(kasten.height)} px (Ziel 44x44)`;
    } else if (!/^esc$/i.test(aufschrift)) return `${wo}: Schliessen-Knopf zeigt "${aufschrift}" statt "Esc"`;
    await (touch ? x.tap() : x.click());
    if (!(await p.locator('#scs').isHidden())) return `${wo}: Suche schliesst nicht ueber den Knopf`;
    return null;
  };

  const desktop = await pruefen(page, false);
  if (desktop) return desktop;

  // Eigener Kontext fuer das Telefon: isMobile/hasTouch lassen sich an einem
  // bestehenden nicht umstellen. Tor-Kopfzeile, Fremdhost-Sperre und die
  // Grundpruefungen [1]-[3] von pruefe() (JS-Ausnahme, eigene Ressource
  // >= 400, CSP) wie im Hauptlauf (Review #312): sonst ginge ein Fehler, der
  // nur auf Touch auftritt, durch, solange die Suche selbst noch findet.
  const kontext = await page.context().browser().newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'dark',
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: GATE_BYPASS_HEADERS,
  });
  await kontext.route('**/*', (route) => {
    route.request().url().startsWith(BASE) ? route.continue() : route.abort();
  });
  await kontext.addInitScript(() => {
    window.__cspVerstoesse = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspVerstoesse.push(`${e.violatedDirective} ${e.blockedURI || ''}`.trim());
    });
  });
  try {
    const p = await kontext.newPage();
    const befunde = [];
    p.on('pageerror', (e) => befunde.push(`JS-Ausnahme: ${e.message.split('\n')[0]}`));
    p.on('response', (r) => {
      if (r.url().startsWith(BASE) && r.status() >= 400) befunde.push(`${r.status()} ${r.url().slice(BASE.length)}`);
    });
    await p.goto(page.url(), { waitUntil: 'load', timeout: 60000 });
    const such = await pruefen(p, true);
    if (such) return such;
    // Der Zaehl-Host folgt seiner eigenen, artefakt-abhaengigen Regel in
    // pruefe() [3] und wird dort schon fuer diese Seite beurteilt.
    const csp = [...new Set(await p.evaluate(() => window.__cspVerstoesse ?? []))].filter((v) => !ZAEHLER_HOST.test(v));
    if (csp.length) befunde.push(`CSP-Verstoss: ${csp.slice(0, 3).join(', ')}`);
    if (befunde.length) return `Telefon: ${befunde.slice(0, 3).join(' | ')}`;
    return null;
  } finally {
    await kontext.close();
  }
}

/* Der Hangar: der tiefe Link landet im Waffen-Tab mit offener Zeile und
   Markern aus der Bucht, Pfeil rechts wechselt das Schiff, der Vergleich
   oeffnet und Zurueck schliesst ihn, und "Zur Flotte" schreibt ohne Konto in
   diesen Browser. Lebende Marker brauchen WebGL; ohne (ein Browser ohne
   GPU) zeigt die Seite ihren Rueckfall, und genau dieser eine Teil entfaellt
   — ein fehlendes WebGL ist kein Fehler dieser Seite.
   Klicks und Wartezeiten mit langer Frist: das Laden von Halle und Modell
   blockiert den Hauptfaden (beim ersten Aufruf mit kaltem Cache laenger als
   5 s), eine Taste wartet so lange in der Schlange, und Playwright klickt
   erst auf ein ruhiges Bild.
   Danach die Wettlaeufe des Controllers, je auf einer frischen Seite:
   gehaltene Pfeiltaste, Pfeile im Feld fuer den Link, ein werfendes
   replaceState, die Adresse beim Tippen, ein Wechsel waehrend eines
   haengenden Abrufs, Wiederholen nach einer gescheiterten Bucht, zweimal
   Schliessen des Vergleichs und ein tiefer Link mit langsamer Bucht. Was
   haengen oder scheitern soll, haelt eine Route. */
async function probeHangar(page) {
  const KLICK = { timeout: 30000 };
  const warte = (fn, ms = 20000, arg = null) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);

  if (!(await warte(() => document.querySelector('[data-bay="panel"]')?.dataset.id === 'drak-cutlass-black')))
    return 'tiefer Link: die Bucht der Cutlass Black wurde nicht eingesetzt';
  const tief = await page.evaluate(() => ({
    tab: document.getElementById('hgx-tab-weapons')?.getAttribute('aria-selected'),
    zeilen: document.querySelectorAll('#hgx-tp-weapons .hgx-slot').length,
    offen: [...document.querySelectorAll('#hgx-tp-weapons .hgx-slot__btn[aria-expanded="true"]')].map((b) => b.closest('.hgx-slot').dataset.ports),
    marker: document.querySelectorAll('.hgx-marks[data-id="drak-cutlass-black"] .hgx-mk[data-tab="weapons"]').length,
  }));
  if (tief.tab !== 'true' || tief.zeilen < 1 || !tief.offen.some((p) => p.split(' ').includes('hardpoint_turret')))
    return `tiefer Link: Waffen-Tab ${tief.tab}, ${tief.zeilen} Zeilen, offen ${JSON.stringify(tief.offen)} statt hardpoint_turret`;
  if (tief.marker < 1) return 'tiefer Link: die Bucht bringt keine Waffen-Marker mit';

  if (!(await warte(() => document.querySelector('.hgx-marks')?.hasAttribute('data-live') || !document.getElementById('hg-fallback').hidden, 45000)))
    return 'Halle: nach 45 s weder lebende Marker noch der Rueckfall';
  // Erst nach der Einfahrt: in den ersten Bildern nach dem Aufsetzen ist das
  // Schiff noch unsichtbar, project() liefert null, und die Marker warten zu
  // Recht (gemessen: alle acht nach weniger als 700 ms sichtbar).
  if (await page.evaluate(() => document.getElementById('hg-fallback').hidden)) {
    const sichtbar = () => [...document.querySelectorAll('.hgx-mk[data-tab="weapons"]')]
      .some((el) => getComputedStyle(el).display !== 'none' && el.style.visibility !== 'hidden');
    if (!(await warte(sichtbar, 15000))) return 'Halle laeuft, aber nach 15 s ist kein Waffen-Marker sichtbar';
  }

  const vorher = await page.evaluate(() => document.querySelector('.hg-card[aria-current="true"]')?.dataset.id);
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('ArrowRight');
  if (!(await warte(() => document.querySelector('.hg-card[aria-current="true"]')?.dataset.id !== 'drak-cutlass-black', 30000)))
    return `Pfeil rechts wechselte das Schiff nicht (${vorher})`;

  await page.goto(page.url().replace(/\?.*$/, '') + '?cmp=aegs-gladius,drak-cutlass-black', { waitUntil: 'domcontentloaded' });
  await page.locator('#hgx-cmp-open').click(KLICK);
  if (!(await warte(() => document.getElementById('hgx-cmp').open && location.search.includes('view=compare'), 30000)))
    return 'Vergleich: der Dialog oeffnete nicht';
  await page.goBack();
  if (!(await warte(() => !document.getElementById('hgx-cmp').open && !location.search.includes('view=compare'), 30000)))
    return 'Vergleich: Zurueck schloss den Dialog nicht';

  await page.evaluate(() => localStorage.removeItem('vb.fleet.v1'));
  const schiff = await page.evaluate(() => document.getElementById('hgx-fleet').dataset.fleetShip);
  await page.locator('#hgx-fleet').click(KLICK);
  const an = await page.evaluate(() => ({ p: document.getElementById('hgx-fleet').getAttribute('aria-pressed'), s: localStorage.getItem('vb.fleet.v1') }));
  if (an.p !== 'true' || !String(an.s).includes(`"${schiff}"`)) return `Flotte: Klick ergab aria-pressed ${an.p}, Ablage ${an.s}`;
  await page.locator('#hgx-fleet').click(KLICK);
  const aus = await page.evaluate(() => ({ p: document.getElementById('hgx-fleet').getAttribute('aria-pressed'), s: localStorage.getItem('vb.fleet.v1') }));
  if (aus.p !== 'false' || aus.s !== null) return `Flotte: zweiter Klick ergab aria-pressed ${aus.p}, Ablage ${aus.s}`;

  return probeHangarRennen(page, page.url().replace(/\?.*$/, ''), KLICK, warte);
}

async function probeHangarRennen(page, hangar, KLICK, warte) {
  const START = 'aegs-gladius';
  const jetzt = () => page.evaluate(() => document.querySelector('.hg-card[aria-current="true"]')?.dataset.id);
  const waehle = (id) => page.evaluate((id) => document.querySelector(`.hg-card[data-id="${id}"]`).click(), id);
  // Frisch auf dem Startschiff; liefert, ob der Viewer laeuft (sonst Rueckfall
  // ohne WebGL). Danach zweimal Leerlauf: die Halle laedt noch nach und blockiert
  // den Hauptfaden sekundenlang, und jeder Fall misst Zeitgeber von 150 ms.
  const frisch = async (q = '') => {
    await page.goto(hangar + (q ? `${q}&station=uebersicht&tafel=1` : '?station=uebersicht&tafel=1'), { waitUntil: 'domcontentloaded' });
    await warte(() => document.querySelector('.hgx-marks')?.hasAttribute('data-live') || !document.getElementById('hg-fallback').hidden, 45000);
    await page.evaluate(() => new Promise((ok) => requestIdleCallback(() => requestIdleCallback(ok, { timeout: 5000 }), { timeout: 5000 })));
    return page.evaluate(() => document.getElementById('hg-fallback').hidden);
  };
  const buchtPfad = (id) => new RegExp(`/hangar-bay/${id}\\.html$`);
  const gehalten = [];
  const halte = async (match, handler = () => {}) => { await page.route(match, handler); gehalten.push(match); };
  const gibFrei = async () => { for (const m of gehalten.splice(0)) await page.unroute(m); };

  let mitGl = await frisch();
  const reihe = await page.evaluate(() => [...document.getElementById('hg-strip').children].map((li) => li.dataset.id));
  const modelle = await page.evaluate(() => JSON.parse(document.getElementById('hg-stage').textContent).models);
  const modellPfade = (id) => new Set(modelle[id].slice(0, 2).filter(Boolean).map((u) => new URL(u, hangar).pathname));

  // Jeder Fall prueft fuer sich und meldet; die ersten vier teilen sich die erste Seite.
  const faelle = [
    ['gehaltene Pfeiltaste', async () => {
      await page.evaluate(() => document.activeElement?.blur());
      for (let i = 0; i < 3; i++) await page.keyboard.down('ArrowRight');
      await page.keyboard.up('ArrowRight');
      const naechstes = reihe[(reihe.indexOf(START) + 1) % reihe.length];
      if (!(await warte((s) => document.querySelector('.hg-card[aria-current="true"]')?.dataset.id !== s, 30000, START))) return 'kein Wechsel';
      await page.waitForTimeout(400);
      const ist = await jetzt();
      return ist === naechstes ? null : `${ist} statt ${naechstes}, eine Wiederholung wechselte weiter`;
    }],
    ['Pfeil im Feld fuer den Link', async () => {
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
        configurable: true, value: { writeText: () => Promise.reject(new Error('verweigert')) },
      }));
      await page.locator('#hgx-copy').click(KLICK);
      if (!(await warte(() => document.activeElement?.id === 'hgx-copyfield', 10000))) return 'ohne Zwischenablage kein Feld mit Fokus';
      const vor = await jetzt();
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(400);
      const nach = await jetzt();
      return nach === vor ? null : `das Schiff wechselte (${vor} -> ${nach}) statt des Cursors`;
    }],
    ['replaceState wirft', async () => {
      // WebKit wirft nach 100 replaceState in 10 s; die Seite folgt dem Klick trotzdem.
      await page.evaluate(() => {
        window.__rs = history.replaceState;
        history.replaceState = () => { throw new DOMException('Attempt to use history.replaceState() more than 100 times per 10 seconds', 'SecurityError'); };
      });
      await page.locator('#hgx-tab-systems').click(KLICK);
      const ist = await page.evaluate(() => ({
        tab: document.getElementById('hgx-tab-systems').getAttribute('aria-selected'),
        panel: document.getElementById('hgx-tp-systems')?.hidden === false,
      }));
      await page.evaluate(() => { history.replaceState = window.__rs; });
      return ist.tab === 'true' && ist.panel ? null : `Tab Systeme aria-selected ${ist.tab}, Panel sichtbar ${ist.panel}`;
    }],
    ['Adresse beim Tippen', async () => {
      await page.evaluate(() => {
        window.__rsN = 0;
        const echt = history.replaceState.bind(history);
        history.replaceState = (...a) => { window.__rsN++; return echt(...a); };
      });
      // Die Suche steht im Dock, und das ist zu, bis jemand es aufklappt.
      if (await page.evaluate(() => document.getElementById('main').dataset.dock === 'closed')) await page.locator('#hgx-docktog').click(KLICK);
      await page.locator('#hg-q').focus();
      await page.keyboard.type('cut', { delay: 60 });
      const beimTippen = await page.evaluate(() => window.__rsN);
      await page.waitForTimeout(900);
      const nach = await page.evaluate(() => ({ n: window.__rsN, q: new URLSearchParams(location.search).get('q') }));
      return beimTippen === 0 && nach.n === 1 && nach.q === 'cut' ? null
        : `${beimTippen} Adresswechsel beim Tippen, ${nach.n} nach der Pause, q=${nach.q} (erwartet 0, 1, cut)`;
    }],
    ['Wechsel waehrend eines haengenden Abrufs', async () => {
      // Beide Wahlen in einer Aufgabe: die Bucht des Startschiffs steht im Cache
      // und ist in Mikroaufgaben fertig, also immer vor dem 150-ms-Zeitgeber des
      // ueberholten Schiffs. Sein Modell scheitert sofort, meist vor den 180 ms.
      mitGl = await frisch();
      const fern = reihe[Math.floor(reihe.length / 2)];
      const fernModell = modellPfade(fern);
      const startModell = modellPfade(START);
      await halte(buchtPfad(fern));
      await halte((url) => fernModell.has(url.pathname));
      await halte((url) => startModell.has(url.pathname), (r) => r.abort());
      await page.evaluate(([f, s]) => {
        document.querySelector(`.hg-card[data-id="${f}"]`).click();
        document.querySelector(`.hg-card[data-id="${s}"]`).click();
      }, [fern, START]);
      await page.waitForTimeout(1200);
      const ist = await page.evaluate(() => ({
        busy: document.getElementById('hgx-panelhost').getAttribute('aria-busy'),
        gedimmt: document.querySelector('.hg-title').classList.contains('is-busy'),
        laden: !document.getElementById('hg-load').hidden,
        bucht: document.querySelector('[data-bay="panel"]').dataset.id,
      }));
      await gibFrei();
      const funde = [];
      if (ist.busy !== 'false' || ist.gedimmt || ist.bucht !== START) funde.push(`aria-busy ${ist.busy}, gedimmt ${ist.gedimmt}, Bucht ${ist.bucht}`);
      if (mitGl && ist.laden) funde.push('die Ladeanzeige des ueberholten Schiffs bleibt stehen');
      return funde.length ? `${fern} -> ${START}: ${funde.join('; ')}` : null;
    }],
    ['Wiederholen nach gescheiterter Bucht', async () => {
      // Nur show() bewegt den Balken: bleibt er stehen, lud das Modell nicht neu.
      // Vorher muss das erste show() fertig sein, und das zeigt nur sein 100 %:
      // Die Ladeanzeige erscheint erst nach 180 ms, die Bucht scheitert schneller
      // (gemessen 50 ms), und die Abfahrt im Aufzug allein dauert 1,9 s.
      mitGl = await frisch();
      const kaputt = reihe[Math.floor(reihe.length / 3)];
      await halte(buchtPfad(kaputt), (r) => r.fulfill({ status: 500, body: 'kaputt' }));
      await waehle(kaputt);
      if (!(await warte(() => !document.getElementById('hgx-bayerr').hidden, 15000))) return `Bucht ${kaputt} mit 500: keine Fehlermeldung`;
      await gibFrei();
      if (mitGl && !(await warte(() => document.querySelector('#hg-load i').style.getPropertyValue('--p') === '100%' || !document.getElementById('hgx-modelerr').hidden, 30000)))
        return `das Modell von ${kaputt} war nach 30 s nicht fertig`;
      await page.evaluate(() => document.querySelector('#hg-load i').style.setProperty('--p', '7%'));
      await page.locator('#hgx-bayretry').click(KLICK);
      if (!(await warte((k) => document.querySelector('[data-bay="panel"]')?.dataset.id === k && document.getElementById('hgx-bayerr').hidden, 15000, kaputt)))
        return `die Bucht von ${kaputt} kam nicht`;
      await page.waitForTimeout(1500);
      const balken = await page.evaluate(() => document.querySelector('#hg-load i').style.getPropertyValue('--p'));
      return !mitGl || balken === '7%' ? null : `das Modell von ${kaputt} lud neu (Balken ${balken}), es soll nur die Bucht kommen`;
    }],
    ['zweimal Schliessen des Vergleichs', async () => {
      const korb = '?cmp=aegs-gladius,drak-cutlass-black&station=uebersicht&tafel=1';
      await page.goto(hangar + korb, { waitUntil: 'domcontentloaded' });
      await page.locator('#hgx-cmp-open').click(KLICK);
      if (!(await warte(() => document.getElementById('hgx-cmp').open, 30000))) return 'der Vergleich oeffnete nicht';
      await page.evaluate(() => { const b = document.getElementById('hgx-cmp-close'); b.click(); b.click(); });
      await page.waitForTimeout(1500);
      const zu = await page.evaluate(() => ({ href: location.href, offen: document.getElementById('hgx-cmp')?.open ?? null }))
        .catch((e) => ({ href: `(Navigation: ${e.message.split('\n')[0]})`, offen: null }));
      return zu.href.endsWith(korb) && zu.offen === false ? null : `${zu.href} (Dialog offen ${zu.offen}) statt ${korb}`;
    }],
    ['Ansage nur nach eigenem Klick', async () => {
      // Ein anderer Tab nimmt ein Schiff in die Flotte: die Live-Region schweigt.
      await frisch();
      const vorher = await page.evaluate(() => document.getElementById('hgx-live').textContent);
      const anderer = await page.context().newPage();
      try {
        await anderer.goto(new URL(hangar).origin + '/robots.txt');
        await anderer.evaluate(() => localStorage.setItem('vb.fleet.v1', '{"ships":[{"id":"anvl-arrow","label":"Arrow"}]}'));
      } finally {
        await anderer.close();
      }
      if (!(await warte(() => document.querySelector('.hg-card[data-id="anvl-arrow"]')?.parentElement.classList.contains('is-fleet'), 10000)))
        return 'die Flotte aus dem anderen Tab kam nicht an';
      const still = await page.evaluate(() => document.getElementById('hgx-live').textContent);
      await page.locator('#hgx-fleet').click(KLICK);
      const nachKlick = await page.evaluate(() => ({
        live: document.getElementById('hgx-live').textContent,
        name: document.getElementById('hgx-fleet').dataset.fleetLabel,
      }));
      await page.evaluate(() => localStorage.removeItem('vb.fleet.v1'));
      if (still !== vorher) return `der Abgleich wurde angesagt: "${still}"`;
      return nachKlick.live.includes(nachKlick.name) ? null : `der eigene Klick wurde nicht angesagt: "${nachKlick.live}"`;
    }],
    ['tiefer Link mit langsamer Bucht', async () => {
      // Die Bucht kommt nach dem Modell; hp haelt, bis sie da ist.
      await halte(buchtPfad('anvl-arrow'), async (r) => { await new Promise((ok) => setTimeout(ok, 2500)); await r.continue(); });
      await page.goto(hangar + '?ship=anvl-arrow&tab=weapons&hp=hardpoint_weapon_wing_left&station=uebersicht&tafel=1', { waitUntil: 'domcontentloaded' });
      const kam = await warte(() => document.querySelector('[data-bay="panel"]')?.dataset.id === 'anvl-arrow', 30000);
      await gibFrei();
      if (!kam) return 'die Bucht der Arrow kam nicht';
      const ist = await page.evaluate(() => ({
        hp: new URLSearchParams(location.search).get('hp'),
        offen: [...document.querySelectorAll('#hgx-tp-weapons .hgx-slot__btn[aria-expanded="true"]')].map((b) => b.closest('.hgx-slot').dataset.ports),
      }));
      if (ist.hp !== 'hardpoint_weapon_wing_left' || !ist.offen.some((p) => p.split(' ').includes('hardpoint_weapon_wing_left')))
        return `hp=${ist.hp}, offen ${JSON.stringify(ist.offen)}`;
      if (mitGl && !(await warte(() => document.querySelector('.hgx-mk.is-sel[data-port="hardpoint_weapon_wing_left"]'), 15000)))
        return 'der Marker des Hardpoints ist nicht gewaehlt';
      return null;
    }],
  ];
  const funde = [];
  for (const [name, fall] of faelle) {
    const fund = await fall().catch((e) => e.message.split('\n')[0]);
    if (fund) funde.push(`${name}: ${fund}`);
    await gibFrei();
  }
  return funde.length ? funde.join(' | ') : null;
}

/* Die Werkstatt nach Kategorien wie im Spiel: je ein Tausch unter Waffen und
   unter Systeme, dann zeigt jeder Reiter nur seine Gruppen, zaehlt seine
   Tausche und benennt am Schiff nur seine getauschten Teile (#hgl-mods). */
async function probeWerkstatt(page) {
  const KLICK = { timeout: 15000 };
  const cats = page.locator('#hgl-cats');
  if (!(await cats.isVisible())) return 'Werkstatt: Reiterleiste #hgl-cats fehlt beim bewaffneten Startschiff';
  async function tausche(c) {
    await page.click(`#hgl-cats [data-cat="${c}"]`, KLICK);
    await page.click('#hgl-slots .hgl-grp:not([hidden]) .hgl-slot__btn', KLICK);
    await page.click('#hgl-slots .hgl-slot.is-open .hgl-opt[aria-pressed="false"]', KLICK);
  }
  // Die Waffe tauscht das Datenblatt der flachen Werkstatt: das i an einer
  // Zeile der Auswahl stellt es an die Stelle der Liste, „Zur Auswahl“ fuehrt
  // zurueck, sein Knopf baut ein. Platz und Streifen rechnet die Werkstatt
  // (verify:hangar [22] prueft sie am gebauten Skript); hier zaehlt, dass der
  // Weg im Browser traegt und kein rohes Wort auf dem Blatt steht.
  // Das Blatt oeffnet sich aus einer GEFILTERTEN Liste: nur so faellt auf,
  // wenn „Zur Auswahl“ das Suchwort oder die Zeile verliert. Das Suchwort
  // trifft mindestens zwei Zeilen, und geoeffnet wird NICHT die erste davon:
  // ein Rueckweg, der stets das erste sichtbare i ansteuert, bestuende sonst.
  // Unter den Paaren aus Zeile und Wort gewinnt das mit den wenigsten Treffern.
  const OFFEN = '#hgl-slots .hgl-slot.is-open';
  const I = `${OFFEN} li:has(.hgl-opt[aria-pressed="false"]) .hgl-info`;
  await page.click('#hgl-cats [data-cat="weapons"]', KLICK);
  await page.click('#hgl-slots .hgl-grp:not([hidden]) .hgl-slot__btn', KLICK);
  if (!(await page.locator(I).count())) return 'Werkstatt: die Zeilen der Auswahl tragen kein i zum Datenblatt (.hgl-info)';
  const wahl = await page.locator(`${OFFEN} .hgl-opts`).evaluate((ul) => {
    const zeilen = [...ul.children];
    const teil = (li) => li.querySelector('.hgl-opt')?.dataset.item ?? '';
    const trifft = (w) => zeilen.filter((li) => li.dataset.q.includes(w));
    let wahl = null;
    for (const li of zeilen) {
      if (!li.querySelector('.hgl-info') || li.querySelector('.hgl-opt')?.getAttribute('aria-pressed') !== 'false') continue;
      for (const w of new Set(li.dataset.q.split(/\s+/).filter((x) => x.length >= 3))) {
        const t = trifft(w);
        if (t.length < 2 || t.length >= zeilen.length || t[0] === li) continue;
        if (!wahl || t.length < wahl.treffer.length) wahl = { item: teil(li), suche: w, treffer: t.map(teil) };
      }
    }
    return { ...wahl, gefunden: !!wahl, alle: zeilen.length };
  });
  if (!wahl.gefunden) return `Werkstatt: keine der ${wahl.alle} Zeilen der Auswahl taugt fuer die Probe des Rueckwegs (gesucht: nicht eingebaut, mit einem Suchwort ab 3 Zeichen, das mindestens zwei und nicht alle Zeilen trifft und dessen erster Treffer eine andere Zeile ist)`;
  const IT = `${OFFEN} .hgl-info[data-info=${JSON.stringify(wahl.item)}]`;
  // sichtbar nennt die Zeilen, die zu sehen sind (SICHTBAR, oben: die eine
  // Bestimmung dieses Skripts, dieselbe wie beim Crafting-Planer), nicht die
  // ohne hidden-Attribut: eine Stilregel mit display kann [hidden] schlagen,
  // dann stuende die ganze Liste da, obwohl jede verborgene Zeile ihr
  // Attribut traegt. Verglichen werden die Teile, nicht ihre Zahl: zwei
  // falsche Zeilen sind auch zwei.
  const liste = () => mitSichtbar(page, (offen, da) => {
    const slot = document.querySelector(offen), a = document.activeElement;
    return {
      zeilen: slot?.querySelectorAll('.hgl-opt').length ?? 0,
      sichtbar: slot ? [...slot.querySelectorAll('.hgl-opts > li')].filter(da).map((li) => li.querySelector('.hgl-opt')?.dataset.item ?? '') : [],
      suche: slot?.querySelector('.hgl-q')?.value ?? null,
      fokus: a?.classList.contains('hgl-info') && da(a) ? a.dataset.info : null,
      blatt: !!document.querySelector('#hgl-slots .hgl-sheet'),
    };
  }, OFFEN);
  const gleich = (a, b) => a.length === b.length && a.every((x, k) => x === b[k]);
  const kurz = (a) => `${a.length} (${a.slice(0, 4).join(', ')}${a.length > 4 ? ', …' : ''})`;
  await page.fill(`${OFFEN} .hgl-q`, wahl.suche, KLICK);
  const gefiltert = await liste();
  if (!gleich(gefiltert.sichtbar, wahl.treffer)) return `Werkstatt: die Suche "${wahl.suche}" zeigt nicht genau ihre Treffer (sichtbar: ${kurz(gefiltert.sichtbar)}; erwartet: ${kurz(wahl.treffer)} von ${wahl.alle} Zeilen)`;
  await page.click(IT, KLICK);
  const blatt = await page.evaluate(() => {
    const s = document.querySelector('#hgl-slots .hgl-slot.is-open .hgl-sheet');
    if (!s) return null;
    const streifen = [...s.querySelectorAll('.hgl-strip')];
    return {
      streifen: streifen.length,
      gezeichnet: streifen.filter((li) => li.querySelectorAll('.hgl-strip__t .is-me').length === 1 && li.querySelector('.hgl-strip__t .is-dot')).length,
      text: s.textContent.replace(/\s+/g, ' ').trim(),
      satz: s.querySelector('.hgl-sheet__lead')?.textContent.trim() ?? '',
      bau: !!s.querySelector('.hgl-sheet__fit'),
      liste: !!document.querySelector('#hgl-slots .hgl-slot.is-open .hgl-opts'),
    };
  });
  if (!blatt) return 'Werkstatt: das i an einer Zeile der Auswahl oeffnet kein Datenblatt (.hgl-sheet)';
  if (blatt.liste) return 'Werkstatt: neben dem Datenblatt steht die Auswahlliste weiter';
  if (blatt.streifen < 3 || blatt.gezeichnet < 3) return `Werkstatt: Datenblatt mit ${blatt.streifen} Streifen, davon ${blatt.gezeichnet} mit Punkten der Klasse und dem eigenen Punkt (erwartet je >= 3 bei einer Bordwaffe)`;
  if (blatt.satz.length < 20) return `Werkstatt: dem Datenblatt fehlt der Satz der Einordnung ("${blatt.satz}")`;
  const roh = /\{\w+\}|\b(?:sheet|slot|sp|tot|unit|grp|lo)\.[a-z][\w.]*/.exec(blatt.text);
  if (roh) return `Werkstatt: auf dem Datenblatt steht ein rohes Wort ("${roh[0]}"): fehlt sein Schluessel in LAYOUT_MSG (LayoutWorkshop.astro)?`;
  if (!blatt.bau) return 'Werkstatt: dem Datenblatt eines nicht eingebauten Teils fehlt der Knopf zum Einbauen (.hgl-sheet__fit)';
  await page.click(`${OFFEN} .hgl-sheet__back`, KLICK);
  const zurueck = await liste();
  if (!zurueck.zeilen || zurueck.blatt) return 'Werkstatt: „Zur Auswahl“ fuehrt vom Datenblatt nicht zurueck in die Liste';
  if (zurueck.suche !== wahl.suche || !gleich(zurueck.sichtbar, wahl.treffer)) return `Werkstatt: „Zur Auswahl“ stellt das Suchwort der Liste nicht wieder her (Feld: "${zurueck.suche}", erwartet "${wahl.suche}"; sichtbar: ${kurz(zurueck.sichtbar)}; erwartet: ${kurz(wahl.treffer)})`;
  if (zurueck.fokus !== wahl.item) return `Werkstatt: nach „Zur Auswahl“ liegt der Fokus nicht auf dem i derselben Zeile (Fokus: ${zurueck.fokus ?? 'kein i einer sichtbaren Zeile'}, erwartet ${wahl.item}; erster Treffer der Suche: ${wahl.treffer[0]})`;
  await page.click(IT, KLICK);
  await page.click(`${OFFEN} .hgl-sheet__fit`, KLICK);
  const gebaut = await page.evaluate(() => {
    const neu = [...document.querySelectorAll('#hgl-slots .hgl-slot[data-changed]')];
    // Lage der Zeile des getauschten Slots (das prueft SICHTBAR nicht): im
    // Fenster der Liste unter den klebenden Reitern, am Telefon im Fenster
    // der Seite. Der echte Klick hat „Einbauen“ erst ins Bild gerollt.
    const r = neu[0]?.querySelector('.hgl-slot__btn')?.getBoundingClientRect();
    const host = document.getElementById('hgl-scroll'), cats = document.getElementById('hgl-cats');
    const rollt = !!host && host.scrollHeight > host.clientHeight, h = host?.getBoundingClientRect();
    const oben = rollt ? h.top + (cats && !cats.hidden ? cats.offsetHeight : 0) : (cats && !cats.hidden ? cats.getBoundingClientRect().bottom : 0);
    const unten = rollt ? h.bottom : innerHeight;
    return {
      offen: !!document.querySelector('#hgl-slots .hgl-slot.is-open'), neu: neu.length,
      zeile: r ? [Math.round(r.top), Math.round(r.bottom)] : null, fenster: [Math.round(oben), Math.round(unten)],
      imBlick: !!r && r.height > 0 && r.top >= oben - 1 && r.bottom <= unten + 1,
    };
  });
  if (gebaut.offen || gebaut.neu !== 1) return `Werkstatt: „Einbauen“ auf dem Datenblatt tauscht nicht (Slot offen: ${gebaut.offen}, getauschte Slots: ${gebaut.neu}, erwartet zu und 1)`;
  if (!gebaut.imBlick) return `Werkstatt: nach „Einbauen“ auf dem Datenblatt steht die Zeile des getauschten Slots nicht im sichtbaren Teil der Liste (Zeile ${gebaut.zeile?.join('–') ?? 'fehlt'} px, sichtbar ${gebaut.fenster.join('–')} px): man sieht nicht, was nun eingebaut ist`;
  await tausche('systems');
  for (const c of ['systems', 'weapons']) {
    await page.click(`#hgl-cats [data-cat="${c}"]`, KLICK);
    const st = await page.evaluate((c) => ({
      sel: document.querySelector(`#hgl-cats [data-cat="${c}"]`)?.getAttribute('aria-selected'),
      fremd: [...document.querySelectorAll('#hgl-slots .hgl-grp')].filter((s) => (s.dataset.cat === c) === s.hidden).length,
      n: ['weapons', 'systems'].map((k) => document.querySelector(`#hgl-cats [data-cat-n="${k}"]`)?.textContent).join('|'),
      mods: document.getElementById('hgl-mods')?.textContent ?? '',
    }), c);
    if (st.sel !== 'true') return `Werkstatt: Reiter ${c} nach Klick nicht gewaehlt`;
    if (st.fremd) return `Werkstatt: unter ${c} stehen ${st.fremd} Gruppe(n) falsch sichtbar oder verborgen`;
    if (st.n !== '1|1') return `Werkstatt: Reiterzaehler "${st.n}", erwartet "1|1"`;
    // Name und Leuchten nur fuer getauschte Waffen; Komponenten bleiben auch
    // getauscht schlichte Punkte ohne Namenszettel (Wunsch Krisz).
    const anderer = c === 'weapons' ? 'systems' : 'weapons';
    const namen = (st.mods.match(/::after/g) ?? []).length;
    if (!st.mods.includes(`[data-tab="${c}"]`)) return `Werkstatt: unter ${c} markiert das Schiff keinen Hardpoint`;
    if (c === 'weapons' && !namen) return 'Werkstatt: unter weapons traegt keine getauschte Waffe am Schiff ihren Namen';
    if (c === 'systems' && namen) return `Werkstatt: unter systems tragen ${namen} Komponente(n) am Schiff einen Namen`;
    if (c === 'systems' && st.mods.includes('box-shadow')) return 'Werkstatt: unter systems leuchtet eine getauschte Komponente am Schiff';
    if (st.mods.includes(`[data-tab="${anderer}"]`)) return `Werkstatt: unter ${c} markiert das Schiff auch ${anderer}`;
  }
  // Raketen bleiben wie Komponenten schlichte Punkte, auch getauscht (Wunsch
  // Krisz); der Port ist markiert, traegt aber weder Namen noch Leuchten.
  await page.click('#hgl-cats [data-cat="weapons"]', KLICK);
  const rakete = page.locator('#hgl-slots .hgl-slot[data-type="missile"] .hgl-slot__btn').first();
  if (!(await rakete.count())) return 'Werkstatt: das Startschiff hat keinen Raketenslot (Startschiff in catalog.ts gewechselt? dann hier eines mit Raketen waehlen)';
  await rakete.click(KLICK);
  await page.click('#hgl-slots .hgl-slot.is-open .hgl-opt[aria-pressed="false"]', KLICK);
  const rk = await page.evaluate(() => {
    const li = document.querySelector('#hgl-slots .hgl-slot[data-changed][data-type="missile"]');
    const port = li ? `hardpoint_${li.dataset.key.split('.')[0]}` : null;
    const mods = document.getElementById('hgl-mods')?.textContent ?? '';
    return { port, regel: port ? mods.split('\n').filter((r) => r.includes(`[data-port="${CSS.escape(port)}"]`)).join('\n') : '' };
  });
  if (!rk.port) return 'Werkstatt: die getauschte Rakete steht nicht als geaendert in der Liste';
  if (!rk.regel) return `Werkstatt: der Raketenport ${rk.port} ist am Schiff nicht markiert`;
  if (rk.regel.includes('::after') || rk.regel.includes('box-shadow')) return `Werkstatt: die getauschte Rakete an ${rk.port} leuchtet oder traegt am Schiff einen Namen`;
  // Lackierung, sofern das Startschiff welche hat: nur ihre Liste, keine
  // Marker am Schiff, Zaehler 1, und der Link traegt sie als viertes Feld.
  const lack = page.locator('#hgl-cats [data-cat="paint"]');
  if (await lack.isVisible()) {
    await lack.click(KLICK);
    await page.click('#hgl-slots .hgl-grp[data-cat="paint"] .hgl-paint[aria-pressed="false"]', KLICK);
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => {
      const code = new URL(location.href).searchParams.get('layout') ?? '';
      let felder = 0;
      try { felder = JSON.parse(atob(code.replace(/-/g, '+').replace(/_/g, '/'))).length; } catch { felder = -1; }
      return {
        sichtbar: [...document.querySelectorAll('#hgl-slots .hgl-grp')].filter((s) => !s.hidden).map((s) => s.dataset.cat).join('|'),
        n: document.querySelector('#hgl-cats [data-cat-n="paint"]')?.textContent,
        mods: document.getElementById('hgl-mods')?.textContent ?? '',
        felder,
      };
    });
    if (st.sichtbar !== 'paint') return `Werkstatt: unter Lackierung stehen die Gruppen "${st.sichtbar}"`;
    if (st.n !== '1') return `Werkstatt: Reiterzaehler Lackierung "${st.n}", erwartet "1"`;
    if (st.mods) return 'Werkstatt: unter Lackierung markiert das Schiff Hardpoints';
    if (st.felder !== 4) return `Werkstatt: der Link traegt die Lackierung nicht (${st.felder} Felder statt 4)`;
  }
  return null;
}

/* ---------- Konto-Anzeige des Crafting-Planers ----------
   Text und Aktionen beider Anzeigen (Kopfleiste und Planer) muessen zu
   EINEM Zustand passen: „Anmelden" nur ohne Konto, „Erneut versuchen" nur
   nach einem Fehler. Jeder Zustand bekommt einen eigenen Kontext mit
   gefaelschter Sitzung und einem Supabase, das hier im Browser antwortet:
     local    keine Sitzung
     syncing  Sitzung, das Lesen haengt
     synced   Sitzung, das Lesen liefert eine leere Liste
     error    Sitzung, das Lesen scheitert (503)
   Bei 360 px (dort sass der Fehler) und 1280 px. Gefragt wird, was der
   Browser zeichnet, nicht das hidden-Attribut: das stand auch im Fehlerfall
   richtig (tests/e2e/crafting-sync.test.js sah ihn deshalb nie).
   Sitzungsschluessel und Supabase-Adresse kommen aus dem ausgelieferten
   account-lite.js: Vorschau und live sprechen mit verschiedenen Projekten. */
const SYNC_ZUSTAENDE = [
  { state: 'local', sitzung: false, lesen: 200, login: true, retry: false },
  { state: 'syncing', sitzung: true, lesen: 'haengt', login: false, retry: false },
  { state: 'synced', sitzung: true, lesen: 200, login: false, retry: false },
  { state: 'error', sitzung: true, lesen: 503, login: false, retry: true },
];
const SYNC_BREITEN = [360, 1280];

/* Terminal im Leitstand (assets/hangar-terminal.js, 13.11.2026): die Seiten
   der Website in einem Fenster der Hangarseite. Der Weg dorthin ist eine
   Kamerafahrt der 3D-Buehne, und die laeuft nicht in jeder Umgebung (ohne
   GPU steht der Rueckfall). Die Probe setzt das Fenster deshalb selbst auf,
   mit demselben Kasten und demselben Modul, die der Controller naehme, und
   prueft, was nur ein echter Browser gegen den echten Server zeigt:

     · der Server laesst die eigene Seite im Rahmen zu (frame-src,
       frame-ancestors und X-Frame-Options aus dist/_csp/, nginx/default.conf)
       — sonst bleibt das Fenster leer, und kein Tor, das dist/ als Text
       liest, sieht es;
     · die Seite steht im Fenster ohne ihre eigene Kopfzeile, die schlanken
       Datenseiten mit ihrem Pfad;
     · ein Bereich der Leiste wechselt die Seite, ohne der Hangarseite einen
       Eintrag im Verlauf zu geben (sonst fuehrte „Zurueck“ des Browsers durch
       jede Seite des Fensters statt aus dem Hangar), der Pfeil fuehrt zurueck;
     · „Suche“ oeffnet die Suche der Seite im Fenster, auf Datenseiten ueber
       deren eigenen Knopf;
     · ein Link zum Hangar laedt keine zweite Halle ins Fenster, einer nach
       draussen verlaesst es nicht.

   Alle Klicks kommen per Skript: der Kasten liegt hier nicht auf dem Schirm
   der Halle, sondern ueber Tafel und Werkstatt, und ein Zeigerklick traefe,
   was gerade darueber liegt. */
const TERM_PROBE_KASTEN = { l: 96, t: 110, r: 1176, b: 650 };
async function probeTerminal(page) {
  const wo = 'Terminal';
  const warte = (fn, ms = 30000, arg = null) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
  const start = await page.evaluate(async (kasten) => {
    const box = document.getElementById('hgx-term');
    if (!box) return { fehlt: '#hgx-term' };
    const home = box.querySelector(`a[data-term="${box.dataset.home}"]`);
    if (!home) return { fehlt: `der Bereich „${box.dataset.home}“ aus data-home` };
    try { sessionStorage.removeItem('hg-term'); } catch { /* ohne Speicher gilt die Startseite */ }
    window.__termShip = null;
    window.__termTab = null;
    window.open = (...a) => { window.__termTab = a; return null; };
    const m = await import(box.dataset.js);
    window.__term = m.initTerminal(box, { ship: (id) => { window.__termShip = id ?? '(ohne)'; } });
    window.__term.place(kasten);
    return {
      home: new URL(home.href).pathname,
      bereiche: Object.fromEntries([...box.querySelectorAll('a[data-term]')].map((a) => [a.dataset.term, new URL(a.href).pathname])),
      verlauf: history.length,
      hangar: location.pathname,
    };
  }, TERM_PROBE_KASTEN);
  if (start.fehlt) return `${wo}: ${start.fehlt} fehlt auf der Hangarseite`;

  const stand = () => page.evaluate(() => {
    const box = document.getElementById('hgx-term'), f = document.getElementById('hgx-term-frame');
    let d = null;
    try { d = f.contentDocument; } catch { /* fremder Ursprung: die Fehlerseite des Browsers */ }
    const zeigt = (el) => !!el && getComputedStyle(el).display !== 'none';
    const r = box.getBoundingClientRect(), b = box.offsetParent?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const scs = d?.getElementById('scs');
    return {
      bereit: box.classList.contains('is-ready'), zu: box.hidden,
      pfad: d ? d.location.pathname : null,
      kleid: !!d?.documentElement.hasAttribute('data-vb-terminal'),
      kopf: d ? zeigt(d.getElementById('topbar')) : null,
      daten: d?.querySelector('.dp-bar')
        ? { start: zeigt(d.querySelector('.dp-bar>.dp-home')), knopf: zeigt(d.querySelector('.dp-bar>.dp-search')), sprache: zeigt(d.querySelector('.dp-bar>.dp-lang')), pfad: zeigt(d.querySelector('.dp-bar>.dp-crumbs')) }
        : null,
      suche: !!scs && !scs.hidden && zeigt(scs),
      marke: [...box.querySelectorAll('a[data-term][aria-current="page"]')].map((a) => a.dataset.term).join(' '),
      zurueck: !document.getElementById('hgx-term-back').disabled,
      eigen: (() => { try { return new URL(document.getElementById('hgx-term-ext').href).pathname; } catch { return null; } })(),
      kasten: [r.left - b.left, r.top - b.top, r.right - b.left, r.bottom - b.top].map(Math.round),
      text: document.getElementById('hgx-term-load')?.textContent.trim() ?? '',
      verlauf: history.length, schiff: window.__termShip, tab: window.__termTab,
      rahmenCsp: (window.__cspVerstoesse ?? []).filter((v) => /frame/.test(v)),
    };
  });
  const steht = (pfad, ms = 45000) => warte((p) => {
    const box = document.getElementById('hgx-term');
    let d = null;
    try { d = document.getElementById('hgx-term-frame').contentDocument; } catch { /* s. o. */ }
    return !!d && d.location.pathname === p && d.readyState !== 'loading' && box.classList.contains('is-ready') && d.documentElement.hasAttribute('data-vb-terminal');
  }, ms, pfad);
  const klick = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
  const imFenster = (href) => page.evaluate((h) => {
    const d = document.getElementById('hgx-term-frame').contentDocument;
    const a = d.createElement('a');
    a.href = h;
    a.textContent = 'Probe';
    d.body.append(a);
    a.click();
    a.remove();
  }, href);

  // 1 · die Startseite des Terminals steht im Fenster
  if (!(await steht(start.home))) {
    const s = await stand();
    return `${wo}: ${start.home} steht nach 45 s nicht im Fenster (Pfad ${s.pfad}, bereit ${s.bereit}, Meldung „${s.text}“${s.rahmenCsp.length ? `, CSP ${s.rahmenCsp.join(', ')}` : ''}) — laesst der Server die eigene Seite im Rahmen zu (dist/_csp/, X-Frame-Options)?`;
  }
  let s = await stand();
  if (s.zu) return `${wo}: der Kasten ist nach place() noch verborgen`;
  if (s.kopf) return `${wo}: die Kopfzeile der Seite (#topbar) steht im Fenster unter der Leiste des Terminals`;
  if (s.marke !== Object.keys(start.bereiche).find((k) => start.bereiche[k] === start.home)) return `${wo}: nach dem Start ist „${s.marke}“ markiert statt des Startbereichs`;
  if (s.zurueck) return `${wo}: der Zurueck-Pfeil ist auf der ersten Seite bedienbar`;
  const soll = [TERM_PROBE_KASTEN.l, TERM_PROBE_KASTEN.t, TERM_PROBE_KASTEN.r, TERM_PROBE_KASTEN.b];
  if (s.kasten.some((v, i) => Math.abs(v - soll[i]) > 2)) return `${wo}: der Kasten liegt bei ${s.kasten.join(', ')} statt auf dem genannten Rechteck ${soll.join(', ')}`;

  // 2 · Bereich wechseln (eine schlanke Datenseite), ohne Eintrag im Verlauf
  if (!start.bereiche.items) return `${wo}: die Leiste nennt den Bereich „items“ nicht mehr — die Probe braucht eine Datenseite`;
  await klick('#hgx-term a[data-term="items"]');
  if (!(await steht(start.bereiche.items))) return `${wo}: „Items“ in der Leiste brachte ${start.bereiche.items} nicht ins Fenster (dort steht ${(await stand()).pfad})`;
  s = await stand();
  if (s.marke !== 'items') return `${wo}: nach dem Wechsel ist „${s.marke}“ markiert statt „items“`;
  if (!s.zurueck) return `${wo}: nach dem Wechsel bleibt der Zurueck-Pfeil gesperrt`;
  if (s.verlauf !== start.verlauf) return `${wo}: der Wechsel im Fenster schrieb in den Verlauf der Hangarseite (${start.verlauf} → ${s.verlauf} Eintraege)`;
  if (!s.daten) return `${wo}: ${start.bereiche.items} traegt keine Kopfleiste .dp-bar mehr`;
  if (s.daten.start || s.daten.knopf || s.daten.sprache || !s.daten.pfad)
    return `${wo}: Datenseite im Fenster zeigt Startlink ${s.daten.start}, Suchknopf ${s.daten.knopf}, Sprachschalter ${s.daten.sprache}, Pfad ${s.daten.pfad} — Soll: nur der Pfad`;
  // „In eigenem Tab öffnen“ meint die Seite im Fenster, ohne dass jemand den Link schon geklickt hat:
  // Mittelklick und Kontextmenue kennen kein click (Review PR #355). Dasselbe fuer eine Adresse, die
  // die Seite aendert, ohne neu zu laden: nachgezogen wird, bevor der Link ausgeloest wird.
  if (s.eigen !== start.bereiche.items) return `${wo}: „In eigenem Tab öffnen“ zeigt nach dem Wechsel auf ${s.eigen} statt auf ${start.bereiche.items} — Mittelklick und Kontextmenue oeffneten die alte Seite`;
  const anker = await page.evaluate(() => {
    const w = document.getElementById('hgx-term-frame').contentWindow, a = document.getElementById('hgx-term-ext');
    w.history.replaceState(null, '', '#probe');
    a.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 1 }));
    const h = new URL(a.href).hash;
    w.history.replaceState(null, '', w.location.pathname + w.location.search);
    return h;
  });
  if (anker !== '#probe') return `${wo}: „In eigenem Tab öffnen“ folgt einer Adresse nicht, die die Seite im Fenster ohne Neuladen aendert (Anker „${anker}“ statt „#probe“)`;

  // 3 · Suche auf der Datenseite (holt sie erst ueber data-scs-boot)
  await klick('#hgx-term-search');
  if (!(await warte(() => { const x = document.getElementById('hgx-term-frame').contentDocument?.getElementById('scs'); return !!x && !x.hidden; }, 20000)))
    return `${wo}: „Suche“ oeffnete auf der Datenseite nichts`;

  // 4 · der Pfeil fuehrt zurueck
  await klick('#hgx-term-back');
  if (!(await steht(start.home))) return `${wo}: der Zurueck-Pfeil brachte ${start.home} nicht zurueck (dort steht ${(await stand()).pfad})`;
  s = await stand();
  if (s.zurueck) return `${wo}: nach dem Rueckweg auf die erste Seite ist der Pfeil noch bedienbar`;
  if (s.verlauf !== start.verlauf) return `${wo}: der Rueckweg schrieb in den Verlauf der Hangarseite (${start.verlauf} → ${s.verlauf} Eintraege)`;

  // 5 · ein Link zum Hangar holt das Schiff, statt eine zweite Halle zu laden
  await imFenster(`${start.hangar}?ship=aegs-gladius`);
  await page.waitForTimeout(600);
  s = await stand();
  if (s.schiff !== 'aegs-gladius') return `${wo}: ein Link zum Hangar im Fenster meldete das Schiff nicht (${s.schiff})`;
  if (s.pfad !== start.home) return `${wo}: ein Link zum Hangar lud ${s.pfad} ins Fenster`;

  // 6 · ein Link nach draussen geht in einen neuen Tab; danach die Suche der
  // Seiten mit voller Navigation (data-scs-open)
  await imFenster('https://example.org/probe');
  await page.waitForTimeout(600);
  s = await stand();
  if (s.tab?.[0] !== 'https://example.org/probe' || s.tab?.[1] !== '_blank') return `${wo}: ein Link nach draussen oeffnete keinen neuen Tab (${JSON.stringify(s.tab)})`;
  if (s.pfad !== start.home) return `${wo}: ein Link nach draussen ersetzte die Seite im Fenster (${s.pfad})`;
  if (s.rahmenCsp.length) return `${wo}: CSP-Verstoss am Rahmen: ${s.rahmenCsp.join(', ')}`;
  await klick('#hgx-term-search');
  if (!(await warte(() => { const x = document.getElementById('hgx-term-frame').contentDocument?.getElementById('scs'); return !!x && !x.hidden; }, 20000)))
    return `${wo}: „Suche“ oeffnete auf ${start.home} nichts`;

  // 7 · zu: aus dem Layout, die letzte Seite gemerkt
  await page.evaluate(() => window.__term.place(null));
  if (!(await warte(() => document.getElementById('hgx-term').hidden, 5000))) return `${wo}: place(null) nimmt den Kasten nicht aus dem Layout`;
  const gemerkt = await page.evaluate(() => { const v = sessionStorage.getItem('hg-term'); sessionStorage.removeItem('hg-term'); return v; });
  if (!String(gemerkt).startsWith(start.home)) return `${wo}: die letzte Seite wurde nicht gemerkt (${gemerkt})`;
  return null;
}

/* Fussleiste der Hangar-Buehne (Orte, Reiter, „Als Tafel“): Sie steht im
   freien Streifen zwischen Schiffsauswahl und Tafel, rechts der Zeichen der
   Buehne (#hg-tools: Zuruecksetzen, Einsteigen, Grafik, Ton). Anlass
   13.11.2026: Mit den drei Orten wurde sie breiter als dieser Streifen. Bei
   800 px lief sie neben der offenen Schiffsauswahl 132 px aus dem Fenster
   („Als Tafel“ nicht mehr zu erreichen), mit flacher Tafel lag sie bis
   1600 px ueber der Tafel und bei 1280 px ueber dem Ton-Knopf. Kein Tor sah
   das: alle Knoepfe standen im Dokument. Gemessen wird deshalb, was der
   Browser setzt. Je Breite misst die Probe selbst, wie breit die Leiste mit
   Namen, ohne die Namen der Orte (data-eng 1) und nur mit Zeichen
   (data-eng 2) ist, und verlangt:
     · die Leiste traegt die groesste Form, die rechts der Zeichen in den
       Streifen passt: nicht dauernd Zeichen, nicht mehr Namen weg als noetig;
     · passt eine Form, steht die Leiste im Streifen und nicht ueber den
       Zeichen der Buehne;
     · ein Knopf, der nur sein Zeichen zeigt, behaelt seinen Namen im
       Dokument und traegt ihn als title.
   Die Probe oeffnet die Schiffsauswahl und zeigt die Orte und die vier
   Zeichen selbst (ohne 3D gibt es sie nicht), damit sie in jeder Umgebung
   die volle Besetzung misst. Wo die Leiste auch als Zeichen nicht passt
   (beide Spalten offen im schmalen Fenster, schon vor den Orten so),
   verlangt sie nur die kleinste Form. */
const FUSS_BREITEN = [1920, 1600, 1440, 1280, 1100, 900];
const FUSS_MIN_ENG = 2; // je Sprache: Breiten, an denen Namen weichen muessen und die Leiste dann passt
const FUSS_LUFT = 12; // px zwischen den Zeichen der Buehne und der Leiste (fitBar)
async function probeFussleiste(page) {
  const wo = 'Fußleiste';
  const fenster = page.viewportSize();
  const bilder = () => page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(ok, 60)))));
  // volle Besetzung zeigen; true, wenn dafuer etwas einzublenden war
  const besetze = () => page.evaluate(() => {
    let neu = false;
    for (const e of [document.getElementById('hgx-orte'), ...document.getElementById('hg-tools').children]) if (e.hidden) { e.hidden = false; neu = true; }
    return neu;
  });
  const auf = await page.evaluate(() => {
    const need = ['hgx-st', 'hgx-stagebar', 'hgx-orte', 'hgx-docktog', 'hg-tools'].filter((id) => !document.getElementById(id));
    if (need.length) return { fehlt: need.map((id) => `#${id}`).join(', ') };
    const tog = document.getElementById('hgx-docktog');
    const war = { dock: tog.getAttribute('aria-expanded'), zu: [document.getElementById('hgx-orte'), ...document.getElementById('hg-tools').children].filter((e) => e.hidden).map((e) => e.id) };
    if (war.dock !== 'true') tog.click();
    return { war };
  });
  if (auf.fehlt) return `${wo}: ${auf.fehlt} fehlt auf der Hangarseite`;
  let befund = null, eng = 0, weit = 0, neben = 0;
  for (const breite of FUSS_BREITEN) {
    await page.setViewportSize({ width: breite, height: fenster.height });
    await bilder();
    // die Buehne darf beim Neuzeichnen wieder ausblenden, was es ohne 3D nicht gibt
    if (await besetze()) await bilder();
    const m = await page.evaluate((luft) => {
      const st = document.getElementById('hgx-st'), bar = document.getElementById('hgx-stagebar'), tools = document.getElementById('hg-tools');
      const b = bar.getBoundingClientRect(), t = tools.getBoundingClientRect(), z = st.getBoundingClientRect();
      const ab = t.width && t.top < b.bottom && t.bottom > b.top ? Math.max(b.left, t.right + luft) : b.left;
      const ist = st.dataset.eng ?? '';
      const knoepfe = [...st.querySelectorAll('button')].filter((k) => k.offsetParent).map((k) => {
        const span = k.querySelector('span');
        return { name: k.textContent.trim(), zeichen: !!span && span.getBoundingClientRect().width <= 1, title: k.title };
      });
      const r = { ist, platz: Math.floor(b.right - ab), streifen: Math.round(b.width), zeichen: tools.querySelectorAll(':scope > :not([hidden])').length, links: Math.round(z.left - ab), rechts: Math.round(z.right - b.right), knoepfe, dock: document.getElementById('hgx-docktog').getAttribute('aria-expanded') };
      // Bedarf der drei Formen: die Leiste schrumpft nicht unter ihren Inhalt
      r.bedarf = ['', '1', '2'].map((v) => { if (v) st.dataset.eng = v; else delete st.dataset.eng; return Math.ceil(st.getBoundingClientRect().width); });
      if (ist) st.dataset.eng = ist; else delete st.dataset.eng;
      return r;
    }, FUSS_LUFT);
    fussBreiten++;
    const passt = m.bedarf.findIndex((w) => w <= m.platz);
    const soll = passt < 0 ? '2' : ['', '1', '2'][passt];
    const lage = `Bedarf ${m.bedarf.join(' / ')} px mit Namen / ohne die der Orte / nur Zeichen, Platz ${m.platz} px rechts von ${m.zeichen} Zeichen der Buehne`;
    if (m.dock !== 'true') befund = `${wo} ${breite} px: die Schiffsauswahl liess sich nicht oeffnen, gemessen wuerde der weite Streifen`;
    else if (m.knoepfe.length < 4) befund = `${wo} ${breite} px: nur ${m.knoepfe.length} Knoepfe in der Leiste, mit den drei Orten sind es mindestens 4`;
    else if (m.zeichen < 4) befund = `${wo} ${breite} px: nur ${m.zeichen} Zeichen der Buehne im Bild, gemessen wird mit allen vier`;
    else if (!(m.bedarf[0] > m.bedarf[1] && m.bedarf[1] > m.bedarf[2])) befund = `${wo} ${breite} px: data-eng macht die Leiste nicht schmaler (${m.bedarf.join(' / ')} px mit Namen / Stufe 1 / Stufe 2) — die Stufen nehmen keinem Knopf den Namen aus dem Bild`;
    else if (m.ist !== soll) befund = soll === ''
      ? `${wo} ${breite} px: die Leiste zeigt nur Zeichen (data-eng „${m.ist}“), obwohl die Namen in den Streifen passen (${lage})`
      : `${wo} ${breite} px: data-eng ist „${m.ist}“ statt „${soll}“ (${lage})${m.rechts > 0 ? ` — die Leiste laeuft ${m.rechts} px ueber den Streifen, sie liegt dann ueber der Tafel oder laeuft aus dem Fenster` : m.links < 0 ? ` — die Leiste liegt ${-m.links} px ueber den Zeichen der Buehne` : ' — sie gibt mehr Namen ab als noetig'}`;
    else if (passt >= 0 && m.rechts > 0) befund = `${wo} ${breite} px: die Leiste laeuft ${m.rechts} px ueber den freien Streifen, obwohl sie mit data-eng „${m.ist}“ hineinpasst (${lage})`;
    else if (passt >= 0 && m.links < 0) befund = `${wo} ${breite} px: die Leiste liegt ${-m.links} px ueber den Zeichen der Buehne, obwohl sie daneben passt (${lage})`;
    else {
      const stumm = m.knoepfe.find((k) => !k.name), ohne = m.knoepfe.find((k) => k.zeichen && k.title !== k.name), zuviel = m.knoepfe.find((k) => !k.zeichen && k.title);
      if (stumm) befund = `${wo} ${breite} px: ein Knopf der Leiste hat keinen Namen im Dokument`;
      else if (ohne) befund = `${wo} ${breite} px: „${ohne.name}“ zeigt nur sein Zeichen und traegt den Namen nicht als title („${ohne.title}“)`;
      else if (zuviel) befund = `${wo} ${breite} px: „${zuviel.name}“ zeigt seinen Namen und traegt ihn noch einmal als title`;
    }
    if (befund) break;
    if (soll && passt >= 0) eng++;
    if (!soll) weit++;
    // stuende die Leiste in der Mitte des Streifens, laege sie ueber den Zeichen: hier musste sie ruecken
    if (passt >= 0 && (m.streifen - m.bedarf[passt]) / 2 < m.streifen - m.platz) neben++;
  }
  await page.evaluate((war) => {
    for (const id of war.zu) document.getElementById(id).hidden = true;
    const tog = document.getElementById('hgx-docktog');
    if (tog.getAttribute('aria-expanded') !== war.dock) tog.click();
  }, auf.war);
  await page.setViewportSize(fenster);
  await bilder();
  if (befund) return befund;
  fussEng += eng;
  fussNeben += neben;
  if (eng < FUSS_MIN_ENG) return `${wo}: nur an ${eng} von ${FUSS_BREITEN.length} Breiten mussten Namen weichen und passte die Leiste dann, Untergrenze ${FUSS_MIN_ENG} — die Probe misst den engen Streifen nicht mehr`;
  if (!weit) return `${wo}: an keiner der ${FUSS_BREITEN.length} Breiten passten die Namen — die Probe sieht nicht mehr, ob die Leiste sie zeigt, wo Platz ist`;
  if (!neben) return `${wo}: an keiner der ${FUSS_BREITEN.length} Breiten musste die Leiste neben die Zeichen der Buehne ruecken — die Probe sieht nicht mehr, ob sie ueber ihnen liegt`;
  return null;
}

/* Im Leitstand (data-ort="leit" an #main) nimmt das Stilblatt Tafel, Marker
   und Titelblock aus dem Bild. Der Titelblock bleibt fuer Vorleser im
   Dokument und ist nur auf 1 px beschnitten: Seine Knopfreihe (Flotte,
   Vergleich, Link) blieb damit in der Tab-Reihenfolge, und der Fokus stand
   dann nirgends im Bild (Review PR #355). Die Probe setzt den Zustand am
   Dokument, wie paintStation es tut (braucht kein 3D), und verlangt von jedem
   Bedienelement der Hangarseite, das dann mit Tab erreichbar ist, einen Platz
   im Bild: weder es selbst noch ein Vorfahr ist auf einen Punkt beschnitten. */
const LEIT_MIN_KNOEPFE = 5; // je Sprache: Bedienelemente, die im Leitstand in der Tab-Reihenfolge stehen
async function probeLeitTastatur(page) {
  const wo = 'Leitstand';
  const r = await page.evaluate(() => {
    const main = document.getElementById('main');
    if (!main) return { fehlt: '#main' };
    const vor = main.dataset.ort;
    main.dataset.ort = 'leit';
    const name = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : ''}`;
    // auf einen Punkt beschnitten: der Kasten ist hoechstens 1 px gross und zeigt nichts darueber hinaus
    const punkt = (n) => {
      const cs = getComputedStyle(n), b = n.getBoundingClientRect();
      return b.width <= 1 && b.height <= 1 && (cs.overflowX !== 'visible' || cs.clipPath !== 'none');
    };
    const ausDemBild = (el) => {
      for (let n = el; n && n !== main.parentElement; n = n.parentElement) if (punkt(n)) return n;
      return null;
    };
    const erreichbar = [...main.querySelectorAll('a[href],button,input:not([type="hidden"]),select,textarea,summary,[tabindex]')]
      .filter((el) => el.tabIndex >= 0 && !el.disabled && !el.closest('[inert]') && el.checkVisibility({ visibilityProperty: true }));
    const aus = erreichbar.map((el) => [el, ausDemBild(el)]).filter(([, n]) => n).map(([el, n]) => (n === el ? name(el) : `${name(el)} in ${name(n)}`));
    const titel = main.querySelector('.hg-title'), h1 = titel?.querySelector('h1');
    const out = { n: erreichbar.length, aus, titel: !!titel && punkt(titel), h1: !!h1 && h1.checkVisibility() };
    if (vor === undefined) delete main.dataset.ort;
    else main.dataset.ort = vor;
    return out;
  });
  if (r.fehlt) return `${wo}: ${r.fehlt} fehlt auf der Hangarseite`;
  leitKnoepfe += r.n;
  // die Voraussetzung der Probe: der Titelblock ist im Leitstand wirklich aus dem Bild und noch im Dokument
  if (!r.titel) return `${wo}: mit data-ort="leit" steht der Titelblock (.hg-title) noch im Bild — die Probe prueft die Tab-Reihenfolge eines Zustands, den es so nicht mehr gibt`;
  if (!r.h1) return `${wo}: mit data-ort="leit" ist die Ueberschrift der Seite nicht mehr im Dokument (display none) — Vorleser faenden im Leitstand keine Ueberschrift`;
  if (r.aus.length) return `${wo}: ${r.aus.length} Bedienelement(e) stehen mit data-ort="leit" in der Tab-Reihenfolge, aber nicht im Bild: ${r.aus.slice(0, 4).join(', ')} — der Fokus stuende dort nirgends sichtbar`;
  if (r.n < LEIT_MIN_KNOEPFE) return `${wo}: nur ${r.n} Bedienelemente in der Tab-Reihenfolge gefunden, Untergrenze ${LEIT_MIN_KNOEPFE} — die Probe sieht die Hangarseite nicht mehr`;
  return null;
}

/* Zerlege-Rechner (zweiter Reiter des Crafting-Werkzeugs, bisherige Seite
   und Werkbank): die Ergebniskarten stehen in voller Hoehe im Kasten.
   Anlass 11.11.2026: #calc-results ist eine Flex-Spalte mit begrenzter Hoehe
   (.vb-scrollbox), die Karten tragen overflow:hidden und durften deshalb
   schrumpfen. Ab etwa fuenf Treffern drueckte der Kasten jede Karte auf
   einen Streifen zusammen (1440x900, 17 Treffer: 45 px hoch, der Inhalt
   braucht 180). Kein Tor sah das: der Text stand ja im Dokument. Gemessen
   wird deshalb, was der Browser zeichnet. Die Probe sucht sich selbst ein
   Material mit mindestens acht Treffern, damit sie nicht an einem Namen
   aus den Spieldaten haengt. */
const ZERLEGEN_MIN_TREFFER = 8;
async function probeZerlegen(page, wo) {
  const reiter = page.locator('.cdb-tab-btn[data-tab="dismantle"]').first();
  if (!(await reiter.count())) return `${wo}: der Reiter des Zerlege-Rechners fehlt`;
  await reiter.click();
  await page.locator('.calc-mat-list .calc-mat-cb').first().waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
  const bild = await page.evaluate(async (min) => {
    const warte = (ms) => new Promise((r) => setTimeout(r, ms));
    const haken = [...document.querySelectorAll('.calc-mat-list .calc-mat-cb')];
    let fund = null;
    for (const h of haken.slice(0, 20)) {
      h.click();
      await warte(150);
      const karten = [...document.querySelectorAll('#calc-results .calc-card')];
      if (karten.length >= min) {
        fund = {
          treffer: karten.length,
          gestaucht: karten.slice(0, min).filter((k) => k.clientHeight < k.scrollHeight - 2).length,
          hoehe: karten[0].clientHeight, braucht: karten[0].scrollHeight,
        };
      }
      h.click();
      await warte(60);
      if (fund) break;
    }
    return { stoffe: haken.length, fund };
  }, ZERLEGEN_MIN_TREFFER);
  await page.locator('.cdb-tab-btn[data-tab="db"]').first().click();
  if (!bild.stoffe) return `${wo}: der Zerlege-Rechner listet keine Materialien`;
  if (!bild.fund) return `${wo}: unter den ersten 20 von ${bild.stoffe} Materialien hat keines ${ZERLEGEN_MIN_TREFFER} Treffer, die Probe kann die Ergebniskarten nicht messen`;
  if (bild.fund.gestaucht)
    return `${wo}: der Zerlege-Rechner staucht seine Ergebniskarten (${bild.fund.treffer} Treffer, ${bild.fund.gestaucht} der ersten ${ZERLEGEN_MIN_TREFFER} abgeschnitten, die erste ${bild.fund.hoehe} px hoch bei ${bild.fund.braucht} px Inhalt)`;
  return null;
}

/* Das Rezept als Dialog (bisherige Seite: immer; Werkbank: unter 821 px).
   Die Box sagt aria-modal="true", der Fokus blieb aber auf der Karte hinter
   dem Fenster, und die Tabulatortaste lief dort weiter (Hinweis von
   CodeRabbit an #349, 11.11.2026). Gemessen mit echten Tasten: Enter auf dem
   Namen einer Karte oeffnet, der Fokus steht im Fenster, Tab bleibt darin
   (einmal ganz herum und weiter), Esc schliesst und gibt ihn dem Namen
   zurueck. */
async function probeRezeptDialog(p, wo) {
  const NAME = '#cdb-grid .cbp:nth-of-type(3) .cbp__name a';
  if (!(await p.locator(NAME).count())) return `${wo}: die dritte Karte hat keinen Namenslink, die Probe kann das Rezept nicht per Tastatur oeffnen`;
  const stand = () => p.evaluate((sel) => {
    const a = document.activeElement, m = document.querySelector('#cdb-modal'), box = m?.querySelector('.cdb-modal__box');
    return {
      offen: !!m && !m.hidden && !m.classList.contains('is-leer') && m.getBoundingClientRect().height > 0,
      drin: !!box && box.contains(a),
      amNamen: a === document.querySelector(sel),
      halte: box ? box.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),summary').length : 0,
      auf: !a || a === document.body ? '<body>' : `<${a.tagName.toLowerCase()}${a.className && typeof a.className === 'string' ? '.' + a.className.split(' ')[0] : ''}>`,
    };
  }, NAME);
  await p.locator(NAME).focus();
  await p.keyboard.press('Enter');
  await p.waitForTimeout(300);
  const auf = await stand();
  if (!auf.offen) return `${wo}: Enter auf dem Namen einer Karte oeffnet das Rezept nicht`;
  if (!auf.drin) return `${wo}: per Tastatur geoeffnet steht der Fokus auf ${auf.auf} statt im Rezeptfenster`;
  const schritte = Math.min(Math.max(auf.halte + 3, 6), 60);
  for (let k = 1; k <= schritte; k++) {
    await p.keyboard.press('Tab');
    const s = await stand();
    if (!s.drin) return `${wo}: die Tabulatortaste verlaesst das offene Rezeptfenster (nach ${k} von ${schritte} Schritten auf ${s.auf})`;
  }
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  const zu = await stand();
  if (zu.offen) return `${wo}: Esc schliesst das Rezeptfenster nicht`;
  if (!zu.amNamen) return `${wo}: nach Esc steht der Fokus auf ${zu.auf} statt auf dem Namen der Karte, die das Rezept geoeffnet hat`;
  return null;
}

/* Die Zurueck-Marke unter der Kopfleiste („← ALPHA 4.10.2“) faellt nur in der
   Werkbank weg (backMark an SiteNav, Krisz 11.11.2026 23:44 UTC „Kann weg“).
   Auf der bisherigen Crafting-Seite, wie auf jeder anderen Blattseite, bleibt
   sie stehen: sichtbar, mit Ziel und Text. Kippt die Vorgabe des Schalters,
   verloeren gut hundert Seiten ihren Rueckweg, und kein anderes Tor saehe es.
   Sichtbar heisst hier wie ueberall im Skript SICHTBAR (oben): eine Marke
   mit visibility:hidden oder opacity:0 hat noch ihren Kasten und gaelte
   sonst als da (Hinweis von CodeRabbit an #349). */
async function probeZurueckMarke(page, wo) {
  const m = await mitSichtbar(page, (_, da) => {
    const a = document.querySelector('#topbar .snav__back');
    if (!da(a)) return null;
    return { text: a.textContent.replace(/\s+/g, ' ').trim(), ziel: a.getAttribute('href') || '' };
  });
  if (!m) return `${wo}: die Zurueck-Marke unter der Kopfleiste ist nicht zu sehen (sie faellt nur in der Werkbank weg)`;
  if (!m.ziel || m.text.length < 3) return `${wo}: die Zurueck-Marke unter der Kopfleiste hat ${m.ziel ? 'keinen Text' : 'kein Ziel'} („${m.text}“)`;
  return null;
}

async function probeCraftingSync(page) {
  const pfad = new URL(page.url()).pathname;
  const ziel = await page.evaluate(async () => {
    const src = document.querySelector('script[src*="account-lite"]')?.src;
    if (!src) return null;
    const t = await (await fetch(src)).text();
    const key = t.match(/STORE\s*=\s*'(sb-[a-z0-9]+-auth-token)'/);
    const url = t.match(/SB_URL\s*=\s*'(https:\/\/[a-z0-9.-]+)'/);
    return key && url ? { key: key[1], url: url[1] } : null;
  });
  if (!ziel) return 'Crafting-Planer: account-lite.js nennt keinen Sitzungsschluessel';
  const texte = new Map();
  // Alle Abweichungen sammeln, nicht nur die erste: der gemeldete Fall
  // (synced mit beiden Aktionen) soll im Protokoll stehen, auch wenn schon
  // local scheitert.
  const probleme = [];
  for (const breite of SYNC_BREITEN) {
    for (const z of SYNC_ZUSTAENDE) {
      const ctx = await page.context().browser().newContext({
        viewport: { width: breite, height: 740 }, colorScheme: 'dark', ignoreHTTPSErrors: true, extraHTTPHeaders: GATE_BYPASS_HEADERS,
      });
      try {
        await ctx.route('**/*', (route) => {
          const u = route.request().url();
          if (u.startsWith(BASE)) return route.continue();
          if (!u.startsWith(ziel.url)) return route.abort();
          if (/\/rest\/v1\/crafting_entries/.test(u)) {
            if (z.lesen === 'haengt') return undefined; // nie beantwortet: der Abgleich laeuft
            return route.fulfill({ status: z.lesen, contentType: 'application/json', body: z.lesen === 200 ? '[]' : '{}' });
          }
          // Profil, Rolle, Puls, Zaehler am Konto-Knopf: leer und gut.
          return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        });
        await ctx.addInitScript(([key, mit]) => {
          try {
            localStorage.setItem('vb.help.seen', '{"all":1}'); // Erstbesuch-Hilfe wegraeumen
            if (mit) {
              localStorage.setItem(key, JSON.stringify({
                access_token: 'smoke', refresh_token: 'smoke', token_type: 'bearer',
                expires_at: Math.floor(Date.now() / 1000) + 3600,
                user: { id: '00000000-0000-4000-8000-00000000c0de' },
              }));
            }
          } catch { /* ohne Ablage bleibt der Planer lokal, und die Probe sagt es */ }
        }, [ziel.key, z.sitzung]);
        const p = await ctx.newPage();
        await p.goto(BASE + pfad, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const da = await p.waitForFunction((st) => {
          const h = [...document.querySelectorAll('.cdb-sync')];
          return h.length > 0 && h.every((x) => x.dataset.state === st);
        }, z.state, { timeout: 15000 }).then(() => true, () => false);
        const wo = `${breite} px, ${z.state}`;
        if (!da) {
          const st = await p.evaluate(() => [...document.querySelectorAll('.cdb-sync')].map((x) => x.dataset.state).join('/'));
          probleme.push(`${wo}: die Konto-Anzeige erreicht den Zustand nicht (steht auf "${st}")`);
          continue;
        }
        // Den Planer oeffnen: seine Anzeige soll so gemessen werden, wie man sie sieht.
        await p.locator('#cdb-planner-open').click({ timeout: 15000 });
        await p.waitForTimeout(400);
        // zu ist SICHTBAR (oben), die eine Bestimmung dieses Skripts.
        const anzeigen = await mitSichtbar(p, (_, zu) => [...document.querySelectorAll('.cdb-sync')].map((h) => ({
          wo: h.classList.contains('cdb-sync--drawer') ? 'Planer' : 'Kopfleiste',
          state: h.dataset.state,
          text: (h.querySelector('.cdb-sync__txt')?.textContent ?? '').trim(),
          zu: zu(h),
          login: zu(h.querySelector('.cdb-sync__login')),
          retry: zu(h.querySelector('.cdb-sync__retry')),
        })));
        if (anzeigen.length !== 2) { probleme.push(`${wo}: ${anzeigen.length} Konto-Anzeigen statt 2 (Kopfleiste und Planer)`); continue; }
        for (const a of anzeigen) {
          const hier = `${wo}, ${a.wo}`;
          if (!a.zu) { probleme.push(`${hier}: die Konto-Anzeige ist nicht zu sehen`); continue; }
          if (!a.text) { probleme.push(`${hier}: die Konto-Anzeige hat keinen Text`); continue; }
          if (a.login !== z.login || a.retry !== z.retry) {
            const zeigt = [a.login && '„Anmelden"', a.retry && '„Erneut versuchen"'].filter(Boolean).join(' und ') || 'keine Aktion';
            const soll = [z.login && '„Anmelden"', z.retry && '„Erneut versuchen"'].filter(Boolean).join(' und ') || 'keine Aktion';
            probleme.push(`${hier}: „${a.text}" zeigt ${zeigt}, erwartet ${soll}`);
            continue;
          }
          const vorher = texte.get(z.state);
          if (vorher && vorher !== a.text) { probleme.push(`${hier}: Text „${a.text}", an anderer Stelle im selben Zustand „${vorher}"`); continue; }
          texte.set(z.state, a.text);
          syncAnzeigen++;
        }
      } finally {
        await ctx.close();
      }
    }
  }
  if (!probleme.length && new Set(texte.values()).size !== SYNC_ZUSTAENDE.length)
    probleme.push(`verschiedene Zustaende teilen sich einen Text (${[...texte].map(([k, v]) => `${k}=„${v}"`).join(', ')})`);
  if (!probleme.length) return null;
  return `Crafting-Planer, ${probleme.length} Abweichung(en): ${probleme.join(' | ')}`;
}

/* Liegt etwas ueber dem ✕ der offenen Filter-Schublade? Gibt null zurueck,
   wenn das ✕ an seiner Mitte das oberste Element ist, sonst den Verdecker
   (Anlass 09.11.2026: die Site-Nav, z 9600, lag ueber der Schublade, 9250). */
async function kreuzVerdeckt(page) {
  return page.evaluate(() => {
    const x = document.querySelector('#cdb-filter-close');
    if (!x) return 'nichts (✕ fehlt)';
    const r = x.getBoundingClientRect();
    if (!r.width || !r.height) return 'nichts (✕ unsichtbar)';
    const oben = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    if (!oben || x.contains(oben)) return null;
    const nav = oben.closest('#topbar');
    return nav ? 'der Site-Nav' : `${oben.tagName}${oben.id ? '#' + oben.id : ''}${oben.className && typeof oben.className === 'string' ? '.' + oben.className.split(' ')[0] : ''}`;
  });
}

/* Die Crafting-Werkbank (Prototyp, Skizze 016-3, nur im Vorschau-Bau):
   dasselbe Werkzeug wie der Planer, anders gestellt. Am Schreibtisch steht
   das Rezept als feste Mitte neben der Liste und der Planer als Spalte
   rechts; Waehlen, Schliessen und ein tiefer Link muessen dort ohne Dialog
   gehen. Seit der zweiten Runde (11.11.2026) traegt sie Kacheln,
   Bedienleiste und Rezeptfenster der bisherigen Seite: die Leiste steht
   ueber allen Spalten, und auf hohen Fenstern passen die drei Spalten
   darunter ins Bild, ohne dass beim Weiterrollen etwas ueberdeckt wird.
   Am Telefon ist die Mitte zu, ein Antippen oeffnet das Fenster der
   bisherigen Seite, ✕ fuehrt zurueck, und der Planer sitzt als Leiste
   unten. Seit der dritten Runde (Krisz 11.11.2026: „das tool die ganze
   seite füllt, überschrift und sowas brauchen wir eig gar nicht“) steht
   kein Kopfband mehr darueber, die Werkbank nimmt die Breite, die Spalten
   reichen bis an den unteren Rand, und die Hilfe ist eine Tafel, die
   nichts schiebt. Gemessen an Lage und Inhalt, nicht am Markup.
   Vierte Runde (Krisz 11.11.2026: „das design auf dem höchsten niveou“,
   „grafik ui animations“): jede Kachel traegt das Zeichen ihrer Bauteilart,
   das Rezept hat einen Kopf mit Emblem und Kennwerten, der Regler bewegt
   Wert und Balken an Ort und Stelle, beim Rollen bleibt eine kleine Leiste
   mit dem Namen stehen, und der Planer zaehlt mit. Der Auftakt beim Laden
   muss enden, bevor gemessen wird. */
const WB_MIN_ZEICHEN = 20; // verschiedene Zeichen der Bauteilart, gemessen 26 am 11.11.2026
const WB_NAV_FREI = 68; // Freiraum unter der Kopfleiste ohne Zurueck-Marke (--nav-h, SiteNav.astro)
async function probeWerkbank(page) {
  const kasten = (p, sel) => p.locator(sel).first().boundingBox();
  const zuSehen = (p, sel) => p.locator(sel).first().isVisible().catch(() => false);
  const bpi = (p) => new URL(p.url()).searchParams.get('bpi');
  const wahl = (p) => p.$$eval('#cdb-grid .cbp.is-sel', (c) => c.map((x) => x.dataset.i));
  const titel = async (p) => ((await p.locator('#cdb-modal .cbm__name').first().innerText().catch(() => '')) || '').trim();
  // Wartet, bis in sel nichts Endliches mehr laeuft (Auftritt, Uebergang);
  // was endlos dreht, zaehlt nicht. false, wenn es nach ms noch laeuft.
  const ruht = (p, sel, ms = 3000) => p.waitForFunction((s) => {
    const e = document.querySelector(s);
    return !!e && e.getAnimations({ subtree: true }).every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().endTime === Infinity);
  }, sel, { timeout: ms }).then(() => true, () => false);

  // Der Auftakt verschiebt Leiste, Kacheln und Spalten fuer eine gute
  // Sekunde um wenige Pixel; gemessen wird danach. Bleibt die Klasse
  // haengen, spielte er bei jedem Sortieren und Filtern neu.
  const auftaktEndet = await page.waitForFunction(() => !document.querySelector('#cdb.wb-auftakt'), null, { timeout: 6000 }).then(() => true, () => false);
  if (!auftaktEndet) return 'Werkbank 1280 px: der Auftakt endet nicht (#cdb traegt nach 6 s noch wb-auftakt)';
  // 1. Schreibtisch (1280 px): Liste | leere Mitte | Planer.
  if (!(await zuSehen(page, '#cdb-modal .cdb-wb-leer'))) return 'Werkbank 1280 px: die leere Mitte („Rezept waehlen“) ist nicht zu sehen';
  const liste = await kasten(page, '#cdb-grid');
  const mitte = await kasten(page, '#cdb-modal .cdb-modal__box');
  const planer = await kasten(page, '#cdb-planner');
  if (!liste || !mitte || !planer) return `Werkbank 1280 px: Spalten fehlen (Liste ${!!liste}, Mitte ${!!mitte}, Planer ${!!planer})`;
  if (!(liste.x + liste.width <= mitte.x + 1 && mitte.x + mitte.width <= planer.x + 1))
    return `Werkbank 1280 px: die Spalten stehen nicht nebeneinander (Liste x=${Math.round(liste.x)}, Mitte x=${Math.round(mitte.x)}, Planer x=${Math.round(planer.x)})`;
  if (mitte.width < 300) return `Werkbank 1280 px: die Mitte ist nur ${Math.round(mitte.width)} px breit`;
  if (await zuSehen(page, '#cdb-planner-open')) return 'Werkbank 1280 px: der Planer-Knopf steht noch da, obwohl der Planer eine Spalte ist';
  // Die Werkbank fuellt die Seite: kein Kopfband (die Ueberschrift bleibt
  // fuer Vorleser im Dokument), die Reiterzeile direkt unter der Kopfleiste,
  // die Werkbank ueber die Breite, und Liste, Mitte und Planer enden am
  // unteren Rand des Fensters (hohes Fenster, nichts gerollt).
  const fuellt = await mitSichtbar(page, (_, da) => {
    const r = (sel) => { const e = document.querySelector(sel); return e ? e.getBoundingClientRect() : null; };
    const kopf = r('main .hero'), h1 = document.querySelector('main h1'), tabs = r('.cdb-tabs'), cdb = r('#cdb');
    const spalten = { Liste: r('#cdb-grid'), Mitte: r('#cdb-modal .cdb-modal__box'), Planer: r('#cdb-planner') };
    const marke = [...document.querySelectorAll('#topbar .snav__back')].find((a) => da(a));
    return {
      rollt: Math.round(window.scrollY), hoehe: innerHeight, breite: document.documentElement.clientWidth,
      nav: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 68,
      marke: marke ? marke.textContent.replace(/\s+/g, ' ').trim() || '←' : '',
      kopf: kopf ? Math.round(kopf.width * kopf.height) : 0,
      foto: !!document.querySelector('main .hero__photo[style*="background-image"]'),
      h1: h1 ? h1.textContent.trim() : '',
      tabsOben: tabs ? Math.round(tabs.top) : -1,
      rand: cdb ? [Math.round(cdb.left), Math.round(document.documentElement.clientWidth - cdb.right)] : [-1, -1],
      unten: Object.entries(spalten).map(([n, k]) => [n, k ? Math.round(k.bottom) : -1]),
    };
  });
  if (fuellt.kopf > 4 || fuellt.foto) return `Werkbank 1280 px: das Kopfband steht noch ueber dem Werkzeug (Flaeche ${fuellt.kopf} px², Foto ${fuellt.foto})`;
  if (!/Crafting/.test(fuellt.h1)) return `Werkbank 1280 px: die Ueberschrift fehlt im Dokument (h1 „${fuellt.h1}“), Vorleser haetten keinen Seitentitel`;
  // Die Zurueck-Marke („← ALPHA 4.10.2“) steht in der Werkbank nicht mehr
  // unter der Kopfleiste (Krisz 11.11.2026 23:44 UTC „Kann weg“), und ihr
  // Platz ist nicht mehr freigehalten: --nav-h bleibt bei 68 px.
  if (fuellt.marke) return `Werkbank 1280 px: unter der Kopfleiste steht noch die Zurueck-Marke („${fuellt.marke}“)`;
  if (fuellt.nav > WB_NAV_FREI) return `Werkbank 1280 px: unter der Kopfleiste sind ${fuellt.nav} px freigehalten statt ${WB_NAV_FREI} (Platz der Zurueck-Marke)`;
  if (fuellt.rollt === 0 && fuellt.tabsOben > fuellt.nav + 24) return `Werkbank 1280 px: zwischen Kopfleiste (${fuellt.nav} px) und Werkzeug (Reiter bei ${fuellt.tabsOben} px) liegt noch etwas`;
  if (fuellt.rand[0] > 40 || fuellt.rand[1] > 40) return `Werkbank 1280 px: die Werkbank nutzt die Breite nicht (Rand links ${fuellt.rand[0]} px, rechts ${fuellt.rand[1]} px)`;
  const kurz = fuellt.unten.filter(([, u]) => u < fuellt.hoehe - 40 || u > fuellt.hoehe + 1);
  if (fuellt.rollt === 0 && kurz.length)
    return `Werkbank 1280 px: die Spalten enden nicht am unteren Rand (${fuellt.hoehe} px): ${kurz.map(([n, u]) => `${n} bei ${u}`).join(', ')}`;
  // Bei 1280 px bliebe eine Breitengrenze oberhalb von etwa 1200 px
  // unbemerkt (Hinweis von CodeRabbit an #349): dieselbe Messung noch einmal
  // bei 1920 px, danach zurueck auf die Groesse der Variante.
  const fenster = page.viewportSize();
  const zweiBilder = () => page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
  await page.setViewportSize({ width: 1920, height: fenster.height });
  await zweiBilder();
  const breit = await page.evaluate(() => {
    const c = document.querySelector('#cdb').getBoundingClientRect();
    return [Math.round(c.left), Math.round(document.documentElement.clientWidth - c.right)];
  });
  await page.setViewportSize(fenster);
  await zweiBilder();
  if (breit[0] > 40 || breit[1] > 40) return `Werkbank 1920 px: die Werkbank nutzt die Breite nicht (Rand links ${breit[0]} px, rechts ${breit[1]} px)`;
  // Jede Kachel traegt das Zeichen ihrer Bauteilart (data-g), und der Stil
  // kennt zu jeder Art ein Bild (Maske am Kopf der Kachel).
  const zeichen = await page.evaluate(() => {
    const k = [...document.querySelectorAll('#cdb-grid .cbp')];
    const mit = k.filter((c) => c.dataset.g);
    const arten = [...new Set(mit.map((c) => c.dataset.g))];
    const ohneBild = arten.filter((g) => {
      const kopf = mit.find((c) => c.dataset.g === g).querySelector('.cbp__top');
      const st = kopf ? getComputedStyle(kopf, '::after') : null;
      return !st || !/^url\(/.test(st.maskImage || st.webkitMaskImage || '');
    });
    return { alle: k.length, mit: mit.length, arten: arten.length, ohneBild };
  });
  if (zeichen.mit < zeichen.alle) return `Werkbank 1280 px: ${zeichen.alle - zeichen.mit} von ${zeichen.alle} Kacheln tragen kein Zeichen der Bauteilart (data-g)`;
  if (zeichen.arten < WB_MIN_ZEICHEN) return `Werkbank 1280 px: nur ${zeichen.arten} verschiedene Zeichen der Bauteilart (Klinke ${WB_MIN_ZEICHEN})`;
  if (zeichen.ohneBild.length) return `Werkbank 1280 px: zu ${zeichen.ohneBild.length} Bauteilart(en) fehlt das Bild im Stil (${zeichen.ohneBild.slice(0, 5).join(', ')})`;
  // Die Hilfe ist eine Tafel ueber den Spalten: sie schiebt nichts, und ein
  // Klick daneben schliesst sie. Beim ersten Besuch steht sie schon offen
  // (tool-help.js), sonst oeffnet die Probe sie selbst.
  const hilfe = '#cdb-tab-db-content > .tool-help';
  const mitteOben = async () => Math.round((await kasten(page, '#cdb-modal .cdb-modal__box')).y);
  if (!(await page.$eval(hilfe, (d) => d.open))) await page.locator(`${hilfe} > summary`).click();
  const tafel = await page.$eval(hilfe, (d) => ({ offen: d.open, hoehe: Math.round(d.querySelector('.tool-help__body').getBoundingClientRect().height) }));
  if (!tafel.offen || tafel.hoehe < 60) return `Werkbank 1280 px: die Hilfe geht nicht auf (offen ${tafel.offen}, ${tafel.hoehe} px hoch)`;
  const mitHilfe = await mitteOben();
  await page.locator('.cdb-count-row').click();
  if (await page.$eval(hilfe, (d) => d.open)) return 'Werkbank 1280 px: ein Klick neben die Hilfe schliesst sie nicht';
  if ((await mitteOben()) !== mitHilfe) return `Werkbank 1280 px: die offene Hilfe schiebt die Spalten (Mitte offen bei ${mitHilfe}, zu bei ${await mitteOben()} px)`;
  // „Elemente erklaeren“ per Tastatur: die Tafel schliesst sich und nimmt
  // den Knopf mit. Der Fokus muss dann auf der Zeile der Hilfe stehen, nicht
  // auf <body> (Hinweis von CodeRabbit an #349). Esc beendet den Modus
  // wieder, damit die weiteren Schritte ohne Erklaerblasen laufen.
  await page.locator(`${hilfe} > summary`).click();
  await page.locator(`${hilfe} .js-tool-help`).focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);
  const erkl = await page.$eval(hilfe, (d) => ({
    offen: d.open, an: d.querySelector('.js-tool-help').getAttribute('aria-pressed'),
    fokus: document.activeElement === d.querySelector('summary') ? 'summary' : (document.activeElement ? document.activeElement.tagName.toLowerCase() : 'nichts'),
  }));
  await page.keyboard.press('Escape');
  const erklAus = await page.$eval(`${hilfe} .js-tool-help`, (b) => b.getAttribute('aria-pressed'));
  if (erkl.an !== 'true' || erkl.offen) return `Werkbank 1280 px: „Elemente erklaeren“ per Tastatur schaltet nicht um oder laesst die Tafel offen (aria-pressed ${erkl.an}, offen ${erkl.offen})`;
  if (erkl.fokus !== 'summary') return `Werkbank 1280 px: nach „Elemente erklaeren“ per Tastatur steht der Fokus auf <${erkl.fokus}> statt auf der Zeile der Hilfe`;
  if (erklAus !== 'false') return `Werkbank 1280 px: Esc beendet „Elemente erklaeren“ nicht (aria-pressed ${erklAus})`;
  // Bedienleiste wie auf der bisherigen Seite: eine Zeile ueber allen
  // Spalten, mit Raster/Liste-Umschalter; die Liste zeigt Kacheln.
  const leiste = await kasten(page, '.cdb-bar');
  if (!leiste || leiste.x > liste.x + 1 || leiste.x + leiste.width < planer.x + planer.width - 1 || leiste.y + leiste.height > mitte.y + 1)
    return `Werkbank 1280 px: die Bedienleiste steht nicht ueber allen Spalten (${leiste ? `x=${Math.round(leiste.x)}, b=${Math.round(leiste.width)}, unten ${Math.round(leiste.y + leiste.height)}, Mitte oben ${Math.round(mitte.y)}` : 'fehlt'})`;
  if (!(await zuSehen(page, '.cdb-viewtog'))) return 'Werkbank 1280 px: der Raster/Liste-Umschalter fehlt';
  // Der Umschalter muss auch schalten (Hinweis von CodeRabbit an #339):
  // Liste, dann Raster, danach der Stand von vorher (er wird gespeichert).
  const ansicht = () => page.evaluate(() => ({
    liste: !!document.querySelector('#cdb-grid')?.classList.contains('is-list'),
    gedrueckt: [...document.querySelectorAll('.cdb-view')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.view).join(','),
  }));
  const vorher = await ansicht();
  for (const v of ['list', 'grid']) {
    await page.locator(`.cdb-view[data-view="${v}"]`).click();
    const a = await ansicht();
    if (a.liste !== (v === 'list') || a.gedrueckt !== v)
      return `Werkbank 1280 px: der Raster/Liste-Umschalter schaltet nicht auf ${v === 'list' ? 'Liste' : 'Raster'} (is-list ${a.liste}, gedrueckt „${a.gedrueckt}“)`;
  }
  if (vorher.liste) await page.locator('.cdb-view[data-view="list"]').click();
  if (!(await zuSehen(page, '#cdb-grid .cbp >> nth=0 >> .cbp__res'))) return 'Werkbank 1280 px: die Kacheln zeigen keine Ressourcen (kompakte Zeilen statt Kacheln?)';
  // Filter: Schublade von links. Geschlossen weder fokussierbar noch
  // vorlesbar (inert), offen bedienbar, Esc schliesst.
  const inert = () => page.$eval('#cdb-sidebar', (el) => el.inert === true);
  if (!(await inert())) return 'Werkbank 1280 px: die geschlossene Filter-Schublade ist nicht inert (per Tab erreichbar)';
  await page.locator('#cdb-filter-toggle').click();
  await page.waitForTimeout(400);
  const fk = await kasten(page, '#cdb-sidebar');
  if ((await inert()) || !fk || fk.x < -1) return `Werkbank 1280 px: die Filter-Schublade oeffnet nicht (x=${fk ? Math.round(fk.x) : '?'}, inert ${await inert()})`;
  // Der Fokus geht mit hinein (offcanvas.js setup); blieb er auf dem Knopf
  // hinter dem Verdunkler, lief inert noch, als fokussiert wurde.
  const fokus = await page.evaluate(() => {
    const a = document.activeElement;
    return { drin: !!document.querySelector('#cdb-sidebar')?.contains(a), wo: a ? a.tagName + (a.id ? '#' + a.id : '') : '-' };
  });
  if (!fokus.drin) return `Werkbank 1280 px: beim Oeffnen der Filter bleibt der Fokus draussen (${fokus.wo})`;
  const deckt = await kreuzVerdeckt(page);
  if (deckt) return `Werkbank 1280 px: das ✕ der Filter-Schublade liegt unter ${deckt}`;
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  if (!(await inert())) return 'Werkbank 1280 px: Esc schliesst die Filter-Schublade nicht';

  // Waehlen: die zweite Karte (die erste koennte zufaellig schon passen).
  const karte = page.locator('#cdb-grid .cbp').nth(1);
  const i = await karte.getAttribute('data-i');
  const name = ((await karte.locator('.cbp__name').textContent()) || '').trim();
  await karte.scrollIntoViewIfNeeded();
  const y0 = await page.evaluate(() => window.scrollY);
  await karte.locator('.cbp__name').click();
  await page.waitForTimeout(250);
  const y1 = await page.evaluate(() => window.scrollY);
  if (Math.abs(y1 - y0) > 2) return `Werkbank 1280 px: das Waehlen schiebt die Seite um ${Math.round(y1 - y0)} px`;
  if (await page.locator('#cdb-modal [aria-modal="true"]').count())
    return 'Werkbank 1280 px: das Rezept steht als Dialog statt als Mitte (aria-modal)';
  const t1 = await titel(page);
  if (t1 !== name) return `Werkbank 1280 px: nach Klick auf „${name}“ zeigt die Mitte „${t1 || 'nichts'}“`;
  if (JSON.stringify(await wahl(page)) !== JSON.stringify([i])) return `Werkbank 1280 px: markiert sind Karten ${JSON.stringify(await wahl(page))}, erwartet ["${i}"]`;
  if (bpi(page) !== i) return `Werkbank 1280 px: die Adresse traegt bpi=${bpi(page)}, erwartet ${i}`;
  const gesperrt = await page.evaluate(() => getComputedStyle(document.body).overflow === 'hidden' || document.body.style.position === 'fixed' || document.documentElement.classList.contains('is-locked'));
  if (gesperrt) return 'Werkbank 1280 px: mit gewaehltem Rezept laesst sich die Seite nicht mehr scrollen';
  // Passform (hohes Fenster, die Liste rollt fuer sich): steht die Leiste
  // direkt unter der Kopfleiste, liegen Liste, Mitte und Planer ganz im
  // Bild. Rollt die Seite weiter, wandert alles gemeinsam; die Leiste legt
  // sich nicht ueber die Mitte (so sah es aus, als sie klebte).
  const passt = await page.evaluate(async () => {
    const bild = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 68;
    const bar = document.querySelector('.cdb-bar');
    // instant: die Seite rollt sonst weich, und gemessen wuerde mitten im Lauf.
    window.scrollTo({ top: bar.getBoundingClientRect().top + window.scrollY - nav, behavior: 'instant' });
    await bild();
    const r = (sel) => document.querySelector(sel).getBoundingClientRect();
    const unten = r('.cdb-bar').bottom;
    const spalten = { Liste: r('#cdb-grid'), Mitte: r('#cdb-modal .cdb-modal__box'), Planer: r('#cdb-planner') };
    const raus = Object.entries(spalten).filter(([, k]) => k.top < unten - 1 || k.bottom > innerHeight + 1)
      .map(([n, k]) => `${n} ${Math.round(k.top)}–${Math.round(k.bottom)}`);
    window.scrollTo({ top: window.scrollY + 240, behavior: 'instant' });
    await bild();
    const deckt = r('.cdb-bar').bottom > r('#cdb-modal .cdb-modal__box').top + 1;
    window.scrollTo({ top: 0, behavior: 'instant' });
    await bild();
    return { raus, unten: Math.round(unten), hoehe: innerHeight, deckt };
  });
  if (passt.raus.length)
    return `Werkbank 1280 px: unter der Leiste (unten ${passt.unten} px) passen nicht alle Spalten ins Bild (${passt.hoehe} px hoch): ${passt.raus.join(', ')}`;
  if (passt.deckt) return 'Werkbank 1280 px: beim Weiterrollen legt sich die Bedienleiste ueber die Mitte';
  // Zum Planer: die Spalte rechnet sofort mit. Erst den Auftritt des Rezepts
  // abwarten: er schiebt die Zeile mit dem Knopf eine halbe Sekunde lang um
  // 10 px. Einen Zeigerklick auf ein bewegtes Element setzt Playwright neu
  // an und rollt es beim ersten ruhigen Versuch je nach Zaehler ans Ende,
  // in die Mitte oder an den Anfang (scrollIntoView). Gemessen an der Probe
  // ohne dieses Warten: nach zwei unruhigen Versuchen war die Mitte 44 px
  // gerollt, nach dreien 266 px, der Rezeptkopf damit weg, und die Probe der
  // kleinen Leiste weiter unten meldete sie als „schon ohne Rollen aktiv“.
  // Ein Fehlalarm, gesehen am 12.11.2026 einmal in rund siebzig Laeufen;
  // ein oder zwei unruhige Versuche gab es in fast jedem.
  if (!(await ruht(page, '#cdb-modal .cdb-modal__box')))
    return 'Werkbank 1280 px: der Auftritt des Rezepts endet nicht (nach 3 s bewegt sich in der Mitte noch etwas)';
  await page.locator('#cdb-modal .cbm__plan').first().click();
  const imPlaner = await page.locator('#cdb-plan-list .cdb-plan-item .pi__n').allInnerTexts();
  if (!imPlaner.map((s) => s.trim()).includes(name)) return `Werkbank 1280 px: „Zum Planer“ zeigt „${name}“ nicht in der Planer-Spalte (dort: ${JSON.stringify(imPlaner)})`;
  // Die Zeile traegt das Zeichen der Bauteilart, und der Zaehler am Kopf des
  // Planers nennt die Stueckzahl.
  const zeile = await page.evaluate(() => {
    const z = [...document.querySelectorAll('#cdb-plan-list .cdb-plan-item')];
    const n = document.querySelector('#wbp-n');
    return {
      ohneZeichen: z.filter((x) => !(x.querySelector('.wg') && x.querySelector('.wg').dataset.g)).length,
      stueck: z.reduce((s, x) => s + (parseInt(x.querySelector('.pi__ctrl span')?.textContent ?? '', 10) || 0), 0),
      zahl: n && !n.hidden && n.getBoundingClientRect().width > 0 ? n.textContent.trim() : '',
    };
  });
  if (zeile.ohneZeichen) return `Werkbank 1280 px: ${zeile.ohneZeichen} Zeile(n) im Planer ohne Zeichen der Bauteilart`;
  if (zeile.zahl !== String(zeile.stueck)) return `Werkbank 1280 px: der Zaehler am Planer-Kopf zeigt „${zeile.zahl}“, im Planer liegen ${zeile.stueck} Stueck`;
  // Rollt das Rezept, bleibt oben eine kleine Leiste mit Name und „Zum
  // Planer“ stehen; solange sie weg ist, ist sie inert (kein Tabulator-Halt
  // auf einem Knopf, den niemand sieht).
  const fest = await page.evaluate(async () => {
    const warte = () => new Promise((r) => setTimeout(r, 500));
    const box = document.querySelector('#cdb-modal .cdb-modal__box'), l = document.querySelector('#cdb-modal .wbr-fest__in');
    if (!l) return { fehlt: true };
    if (box.scrollHeight < box.clientHeight + 300) return { kurz: box.scrollHeight - box.clientHeight };
    const stand = () => ({ inert: l.inert === true, rollt: box.classList.contains('is-rollt'), deckt: +getComputedStyle(l).opacity, oben: Math.round(l.getBoundingClientRect().top - box.getBoundingClientRect().top) });
    const vor = stand();
    box.scrollTop = 300; await warte();
    const an = stand();
    const kn = l.querySelector('[data-plan]');
    const knopf = !!kn, text = (l.querySelector('.wbr-fest__n')?.textContent ?? '').trim();
    // „Zum Planer“ in der Leiste: die Bestaetigung steht am gedrueckten
    // Knopf, der im Rezept darunter ist weggerollt (Hinweis von CodeRabbit
    // an #349).
    if (kn) kn.click();
    await new Promise((r) => setTimeout(r, 60));
    const ok = !!kn && kn.classList.contains('is-ok');
    box.scrollTop = 0; await warte();
    return { vor, an, nach: stand(), knopf, text, ok };
  });
  if (fest.fehlt) return 'Werkbank 1280 px: dem Rezept fehlt die kleine Leiste fuer das Rollen (.wbr-fest)';
  if (fest.kurz != null) return `Werkbank 1280 px: das Rezept „${name}“ rollt nur ${fest.kurz} px, die Probe braucht ein laengeres`;
  if (!fest.vor.inert || fest.vor.rollt) return 'Werkbank 1280 px: die kleine Leiste ist schon ohne Rollen aktiv';
  if (fest.an.inert || !fest.an.rollt || fest.an.deckt < 0.95 || fest.an.oben < -2 || fest.an.oben > 8)
    return `Werkbank 1280 px: nach dem Rollen steht die kleine Leiste nicht oben in der Mitte (${JSON.stringify(fest.an)})`;
  if (fest.text !== name || !fest.knopf) return `Werkbank 1280 px: die kleine Leiste zeigt „${fest.text}“ statt „${name}“ oder traegt keinen Planer-Knopf`;
  if (!fest.nach.inert || fest.nach.rollt) return 'Werkbank 1280 px: zurueckgerollt bleibt die kleine Leiste stehen';
  if (!fest.ok) return 'Werkbank 1280 px: „Zum Planer“ in der kleinen Leiste bestaetigt nicht am gedrueckten Knopf (der im Rezept ist weggerollt)';
  // Planer per Tastatur: nach dem Neuzeichnen bleibt der Fokus auf demselben
  // Knopf. Verschwindet dessen Zeile (entfernt, oder von eins auf null
  // gezaehlt), geht er auf die nachgerueckte Zeile, im leeren Planer auf den
  // Hinweis, nie auf <body> (Hinweis von CodeRabbit an #349). Dazu kommen
  // zwei weitere Rezepte in den Planer; am Ende ist er leer.
  await page.$$eval('#cdb-grid .cbp .cbp__add', (b) => b.slice(3, 5).forEach((x) => x.click()));
  const planerFokus = () => page.evaluate(() => {
    const a = document.activeElement, z = [...document.querySelectorAll('#cdb-plan-list .cdb-plan-item')];
    const auf = !a || a === document.body ? '<body>'
      : a.matches('#cdb-plan-list .cdb-plan-empty') ? 'Hinweis'
        : a.matches('#cdb-plan-list .cdb-plan-item') ? `Zeile ${z.indexOf(a) + 1}`
          : a.closest('#cdb-plan-list') ? `Knopf ${Object.keys(a.dataset)[0] ?? '?'} in Zeile ${z.indexOf(a.closest('.cdb-plan-item')) + 1}`
            : `<${a.tagName.toLowerCase()}>`;
    return { zeilen: z.length, auf };
  });
  const druecke = async (sel) => {
    await page.locator(sel).first().focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(80);
    return planerFokus();
  };
  const pf0 = await planerFokus();
  if (pf0.zeilen < 3) return `Werkbank 1280 px: die Probe braucht drei Zeilen im Planer, es sind ${pf0.zeilen}`;
  const pfMehr = await druecke('#cdb-plan-list .cdb-plan-item:nth-child(2) [data-inc]');
  if (pfMehr.auf !== 'Knopf inc in Zeile 2') return `Werkbank 1280 px: nach „mehr“ per Tastatur steht der Fokus auf ${pfMehr.auf} statt auf demselben Knopf`;
  const pfWeg = await druecke('#cdb-plan-list .cdb-plan-item:nth-child(1) [data-rm]');
  if (pfWeg.zeilen !== 2 || pfWeg.auf !== 'Zeile 1') return `Werkbank 1280 px: nach dem Entfernen der ersten Planer-Zeile per Tastatur (${pfWeg.zeilen} uebrig) steht der Fokus auf ${pfWeg.auf} statt auf der nachgerueckten Zeile`;
  const pfNull = await druecke('#cdb-plan-list .cdb-plan-item:nth-child(2) [data-dec]');
  if (pfNull.zeilen !== 1 || pfNull.auf !== 'Zeile 1') return `Werkbank 1280 px: nach „weniger“ von eins auf null per Tastatur (${pfNull.zeilen} uebrig) steht der Fokus auf ${pfNull.auf} statt auf der letzten Zeile`;
  const pfLeer = await druecke('#cdb-plan-list .cdb-plan-item [data-rm]');
  if (pfLeer.zeilen !== 0 || pfLeer.auf !== 'Hinweis') return `Werkbank 1280 px: nach dem Entfernen der letzten Planer-Zeile per Tastatur steht der Fokus auf ${pfLeer.auf} statt auf dem Hinweis des leeren Planers`;
  // Schliessen: zurueck zur leeren Mitte, Adresse und Markierung frei.
  await page.locator('#cdb-modal .cdb-modal__x').first().click();
  if (!(await zuSehen(page, '#cdb-modal .cdb-wb-leer'))) return 'Werkbank 1280 px: nach ✕ kommt die leere Mitte nicht zurueck';
  if (bpi(page) !== null || (await wahl(page)).length) return 'Werkbank 1280 px: nach ✕ bleiben Adresse oder Markierung stehen';
  if (!(await zuSehen(page, '#cdb-planner'))) return 'Werkbank 1280 px: ✕ hat die Planer-Spalte mit geschlossen';
  // Tiefer Link: dieselbe Wahl in einer frischen Seite.
  const tief = new URL(page.url());
  tief.searchParams.set('bp', name);
  tief.searchParams.set('bpi', i);
  await page.goto(tief.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('#cdb-modal .cbm__name').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  const t2 = await titel(page);
  if (t2 !== name) return `Werkbank 1280 px: der tiefe Link ?bpi=${i} zeigt „${t2 || 'nichts'}“ statt „${name}“`;
  if (JSON.stringify(await wahl(page)) !== JSON.stringify([i])) return 'Werkbank 1280 px: der tiefe Link markiert die Karte nicht';
  // Kopf des Rezepts: Emblem der Bauteilart (dasselbe Zeichen wie auf der
  // gewaehlten Kachel) und die Kennwerte als Felder.
  const kopf = await page.evaluate(() => {
    const e = document.querySelector('#cdb-modal .wbr-emb .wg'), r = e ? e.getBoundingClientRect() : null;
    const st = e ? getComputedStyle(e) : null;
    const karte = document.querySelector('#cdb-grid .cbp.is-sel');
    return {
      emblem: r ? Math.round(Math.min(r.width, r.height)) : 0, art: e ? e.dataset.g : '', karte: karte ? karte.dataset.g : '',
      bild: !!st && /^url\(/.test(st.maskImage || st.webkitMaskImage || ''),
      felder: document.querySelectorAll('#cdb-modal .wbr-kenn > div').length,
    };
  });
  if (kopf.emblem < 28 || !kopf.bild) return `Werkbank 1280 px: der Rezeptkopf zeigt kein Emblem (${kopf.emblem} px, Bild ${kopf.bild})`;
  if (kopf.art !== kopf.karte) return `Werkbank 1280 px: das Emblem zeigt „${kopf.art}“, die gewaehlte Kachel „${kopf.karte}“`;
  if (kopf.felder < 3) return `Werkbank 1280 px: der Rezeptkopf hat nur ${kopf.felder} Kennwert-Felder`;
  // Der Regler bewegt Wert und Balken, und die Zeile bleibt dabei dieselbe
  // (ein neu geschriebener Balken spraenge, statt zu gleiten). Hat dieses
  // Rezept keinen Regler, nimmt die Probe das naechste mit einem.
  let regler = null;
  for (let versuch = 0; versuch < 12 && !regler; versuch++) {
    regler = await page.evaluate(async () => {
      const s = document.querySelector('#cdb-modal .cbm__slider');
      if (!s) return null;
      const warte = (ms) => new Promise((r) => setTimeout(r, ms));
      const zeilen = () => [...document.querySelectorAll('#cbm-out .wbo')];
      const stand = () => zeilen().map((z) => [z.querySelector('.cbm__b1')?.textContent ?? '', Math.round(z.querySelector('.wbo__fill')?.getBoundingClientRect().width ?? -1)]);
      const erste = zeilen()[0], vorher = stand();
      s.value = s.max;
      s.dispatchEvent(new Event('input', { bubbles: true }));
      await warte(450);
      const nachher = stand();
      return {
        zeilen: vorher.length, text: vorher.some((v, n) => v[0] !== nachher[n]?.[0]), balken: vorher.some((v, n) => Math.abs(v[1] - (nachher[n]?.[1] ?? v[1])) > 2),
        steht: !!erste && zeilen()[0] === erste, spur: s.style.getPropertyValue('--v').trim(),
      };
    });
    if (!regler) {
      const weiter = page.locator('#cdb-grid .cbp:not([hidden])').nth(versuch + 2).locator('.cbp__name');
      if (!(await weiter.count())) break;
      await weiter.click();
      await page.waitForTimeout(250);
    }
  }
  if (!regler) return 'Werkbank 1280 px: unter den ersten Rezepten hat keines einen Qualitaetsregler, die Probe kann ihn nicht messen';
  if (!regler.zeilen) return 'Werkbank 1280 px: das Rezept zeigt keine simulierten Werte (#cbm-out .wbo)';
  if (!regler.text || !regler.balken) return `Werkbank 1280 px: der Regler bewegt ${regler.text ? '' : 'den Wert '}${regler.balken ? '' : 'den Balken '}nicht`;
  if (!regler.steht) return 'Werkbank 1280 px: beim Ziehen des Reglers entstehen die Wertezeilen neu (der Balken springt statt zu gleiten)';
  if (regler.spur !== '1.000') return `Werkbank 1280 px: die Spur des Reglers folgt dem Griff nicht (--v „${regler.spur}“ bei vollem Ausschlag)`;
  // Ein Rezept weit unten in der Liste: die Liste rollt zu ihm, die Seite nicht.
  const weit = await page.$$eval('#cdb-grid .cbp', (c) => {
    const k = c[Math.floor(c.length * 0.6)];
    // textContent: die Karte liegt ausserhalb des Bildes, content-visibility
    // laesst sie ungerendert, und innerText gaebe dann "".
    return { i: k.dataset.i, name: k.querySelector('.cbp__name').textContent.trim() };
  });
  tief.searchParams.set('bp', weit.name);
  tief.searchParams.set('bpi', weit.i);
  await page.goto(tief.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('#cdb-modal .cbm__name').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(150);
  const lage = await page.evaluate((n) => {
    const g = document.querySelector('#cdb-grid').getBoundingClientRect();
    const k = document.querySelector(`#cdb-grid .cbp[data-i="${n}"]`).getBoundingClientRect();
    const m = document.querySelector('#cdb-modal .cdb-modal__box').getBoundingClientRect();
    return { drin: k.top >= g.top - 1 && k.bottom <= g.bottom + 1, imBild: k.top >= 0 && k.bottom <= innerHeight, mitte: m.top >= 0 && m.top < innerHeight / 2 };
  }, weit.i);
  if ((await titel(page)) !== weit.name) return `Werkbank 1280 px: der tiefe Link auf „${weit.name}“ zeigt „${await titel(page)}“`;
  // Der tiefe Link bringt die Werkbank ins Bild (sonst laege das Rezept
  // unter Kopfbild und Hilfe), und die Liste rollt zur Karte.
  if (!lage.mitte) return `Werkbank 1280 px: der tiefe Link auf „${weit.name}“ bringt das Rezept nicht ins Bild`;
  if (!lage.drin || !lage.imBild) return `Werkbank 1280 px: der tiefe Link auf „${weit.name}“ rollt die Liste nicht zu seiner Karte`;

  // Wird das Fenster mit offenem Rezept schmal (Tablet gedreht, Fenster
  // verkleinert), liegt das Rezept ab da als Fenster ueber der Liste: die
  // Seite dahinter rollt nicht mehr, der Fokus steht im Fenster, und Esc
  // gibt ihn der gewaehlten Karte (Hinweis von CodeRabbit an #349).
  await page.setViewportSize({ width: 800, height: fenster.height });
  await zweiBilder();
  const schmal = await page.evaluate(() => {
    const box = document.querySelector('#cdb-modal .cdb-modal__box'), a = document.activeElement;
    return {
      dialog: box.getAttribute('role') === 'dialog' && box.getAttribute('aria-modal') === 'true',
      drin: box.contains(a), sperrt: getComputedStyle(document.body).overflow === 'hidden',
      auf: !a || a === document.body ? '<body>' : `<${a.tagName.toLowerCase()}>`,
    };
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const schmalZu = await page.evaluate((n) => {
    const a = document.activeElement;
    return {
      zu: document.querySelector('#cdb-modal').classList.contains('is-leer'), frei: getComputedStyle(document.body).overflow !== 'hidden',
      amNamen: a === document.querySelector(`#cdb-grid .cbp[data-i="${n}"] .cbp__name a`),
      auf: !a || a === document.body ? '<body>' : `<${a.tagName.toLowerCase()}>`,
    };
  }, weit.i);
  await page.setViewportSize(fenster);
  await zweiBilder();
  if (!schmal.dialog) return 'Werkbank 800 px: nach dem Schmalerwerden ist das offene Rezept kein Dialog (role/aria-modal)';
  if (!schmal.sperrt) return 'Werkbank 800 px: nach dem Schmalerwerden mit offenem Rezept rollt die Seite hinter dem Rezeptfenster weiter';
  if (!schmal.drin) return `Werkbank 800 px: nach dem Schmalerwerden mit offenem Rezept steht der Fokus auf ${schmal.auf} statt im Rezeptfenster`;
  if (!schmalZu.zu || !schmalZu.frei) return `Werkbank 800 px: Esc schliesst das schmal gewordene Rezeptfenster nicht sauber (zu ${schmalZu.zu}, Seite rollt ${schmalZu.frei})`;
  if (!schmalZu.amNamen) return `Werkbank 800 px: nach Esc steht der Fokus auf ${schmalZu.auf} statt auf dem Namen der gewaehlten Karte`;

  // Zweiter Reiter: der Zerlege-Rechner staucht seine Ergebniskarten nicht.
  const zerlegen = await probeZerlegen(page, 'Werkbank 1280 px');
  if (zerlegen) return zerlegen;

  // 2. Telefon (390 px, Touch): eigener Kontext, wie probeSuche.
  const kontext = await page.context().browser().newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    colorScheme: 'dark', ignoreHTTPSErrors: true, extraHTTPHeaders: GATE_BYPASS_HEADERS,
  });
  await kontext.route('**/*', (route) => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  await kontext.addInitScript(() => {
    try { localStorage.setItem('vb.help.seen', '{"all":1}'); } catch { /* ohne Ablage nur die Hilfe */ }
    window.__cspVerstoesse = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspVerstoesse.push(`${e.violatedDirective} ${e.blockedURI || ''}`.trim());
    });
  });
  try {
    const p = await kontext.newPage();
    const befunde = [];
    // Grundpruefungen [1]-[3] von pruefe() wie in probeSuche: JS-Ausnahme,
    // eigene Ressource >= 400, CSP (der Zaehl-Host folgt dort seiner Regel).
    p.on('pageerror', (e) => befunde.push(`JS-Ausnahme: ${e.message.split('\n')[0]}`));
    p.on('response', (r) => {
      if (r.url().startsWith(BASE) && r.status() >= 400) befunde.push(`${r.status()} ${r.url().slice(BASE.length)}`);
    });
    const leer = new URL(page.url());
    leer.search = '';
    await p.goto(leer.href, { waitUntil: 'load', timeout: 60000 });
    await p.locator('#cdb-grid .cbp').first().waitFor({ state: 'visible', timeout: 20000 });
    if (await zuSehen(p, '#cdb-modal')) return 'Werkbank 390 px: das Rezeptfenster liegt schon ohne Wahl ueber der Liste';
    // Auch am Telefon steht die Zurueck-Marke nicht mehr unter der Kopfleiste
    // (dort hielt sie 116 px frei).
    const oben = await mitSichtbar(p, (_, da) => {
      const m = [...document.querySelectorAll('#topbar .snav__back')].find((a) => da(a));
      return { marke: m ? m.textContent.replace(/\s+/g, ' ').trim() || '←' : '', nav: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 68 };
    });
    if (oben.marke) return `Werkbank 390 px: unter der Kopfleiste steht noch die Zurueck-Marke („${oben.marke}“)`;
    if (oben.nav > WB_NAV_FREI) return `Werkbank 390 px: unter der Kopfleiste sind ${oben.nav} px freigehalten statt ${WB_NAV_FREI} (Platz der Zurueck-Marke)`;
    const leiste = await kasten(p, '#cdb-planner-open');
    if (!leiste || leiste.y + leiste.height < 844 - 40 || leiste.height < 44)
      return `Werkbank 390 px: die Planer-Leiste sitzt nicht unten (${leiste ? `y=${Math.round(leiste.y)}, h=${Math.round(leiste.height)}` : 'fehlt'})`;
    const k = p.locator('#cdb-grid .cbp').nth(1);
    const n2 = ((await k.locator('.cbp__name').textContent()) || '').trim();
    await k.locator('.cbp__name').tap();
    await p.waitForTimeout(300);
    // Das Fenster der bisherigen Seite: ueber der Liste, im Bild, mit ✕.
    const fenster = await kasten(p, '#cdb-modal .cdb-modal__box');
    if (!fenster || fenster.x < 0 || fenster.x + fenster.width > 390 || fenster.width < 300 || fenster.y > 120)
      return `Werkbank 390 px: das Rezeptfenster liegt nicht im Bild (${fenster ? `x=${Math.round(fenster.x)}, y=${Math.round(fenster.y)}, b=${Math.round(fenster.width)}` : 'nicht zu sehen'})`;
    if ((await titel(p)) !== n2) return `Werkbank 390 px: nach Antippen von „${n2}“ zeigt das Fenster „${await titel(p)}“`;
    await p.locator('#cdb-modal .cdb-modal__x').first().tap();
    await p.waitForTimeout(300);
    if (await zuSehen(p, '#cdb-modal')) return 'Werkbank 390 px: ✕ fuehrt nicht zur Liste zurueck';
    if (bpi(p) !== null) return 'Werkbank 390 px: nach ✕ traegt die Adresse noch bpi';
    // Unter 821 px ist das Rezept ein Dialog: Fokus hinein, Tab bleibt
    // darin, Esc gibt ihn zurueck (probeRezeptDialog).
    const dialog = await probeRezeptDialog(p, 'Werkbank 390 px');
    if (dialog) return dialog;
    // Filter-Schublade: das ✕ oben muss antippbar sein (nicht unter der
    // Site-Nav) und schliesst. Gilt fuer die klassische Seite genauso, die
    // Werkbank erbt die Telefon-Regel von CraftingApp.
    await p.locator('#cdb-filter-toggle').tap();
    await p.waitForTimeout(400);
    const deckt = await kreuzVerdeckt(p);
    if (deckt) return `Werkbank 390 px: das ✕ der Filter-Schublade liegt unter ${deckt}`;
    await p.locator('#cdb-filter-close').tap();
    await p.waitForTimeout(400);
    if (!(await p.$eval('#cdb-sidebar', (el) => el.inert === true))) return 'Werkbank 390 px: ✕ schliesst die Filter-Schublade nicht';
    const breit = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (breit > 1) return `Werkbank 390 px: die Seite laeuft ${breit} px seitlich ueber`;
    const csp = [...new Set(await p.evaluate(() => window.__cspVerstoesse ?? []))].filter((v) => !ZAEHLER_HOST.test(v));
    if (csp.length) befunde.push(`CSP-Verstoss: ${csp.slice(0, 3).join(', ')}`);
    if (befunde.length) return `Werkbank 390 px: ${befunde.slice(0, 3).join(' | ')}`;
    return null;
  } finally {
    await kontext.close();
  }
}

/* ---------- Ein Seitenaufruf ---------- */
async function pruefe(kontext, variante, seite, pfad, sprache) {
  const page = await kontext.newPage();
  const jsFehler = [];
  const schlechteAntworten = [];
  page.on('pageerror', (e) => jsFehler.push(e.message.split('\n')[0]));
  let eigeneAntworten = 0, rahmenAntworten = 0;
  // wie viel der beiden Listen [1] und [2] schon ausgewertet haben; den Rest holt [8] am Ende
  let gesehenJs = 0, gesehenHttp = 0;
  // Eine Antwort ohne Server hat eine Probe selbst eingespielt (route.fulfill,
  // etwa die 500 fuer „Wiederholen nach gescheiterter Bucht“): Sie sagt nichts
  // ueber das Artefakt. [8] nimmt sie aber nur dem Szenario ab, das sie
  // erklaert (spieltEin), und nur so viele, wie es erklaert. Die Frage nach dem
  // Server ist asynchron, [8] wartet auf alle Antworten (herkunft).
  const herkunft = [], eingespielt = new Set();
  let probeOhneBefund = false;
  page.on('response', (r) => {
    if (!r.url().startsWith(BASE)) return;
    eigeneAntworten++;
    // aus einer Seite in einem Rahmen (das Terminal des Hangars); frame() wirft bei Antworten ohne Rahmen
    try { if (r.frame() !== page.mainFrame()) rahmenAntworten++; } catch { /* zaehlt nur oben */ }
    if (r.status() >= 400 && r.status() !== (seite.erwarteterStatus ?? -1)) {
      const i = schlechteAntworten.push(`${r.status()} ${r.url().slice(BASE.length)}`) - 1;
      herkunft.push(r.serverAddr().then((a) => { if (!a) eingespielt.add(i); }, () => {}));
    }
  });

  // Was der Browser nur dem Dokument sagt (ein Stilblatt ist geladen oder
  // gescheitert, ein CSP-Verstoss), melden die Dokumente selbst heraus: ueber
  // den Meldeweg unten, aus jedem Rahmen und in dem Augenblick, in dem es
  // geschieht. gescheitert und csp tragen den Pfad ihres Dokuments.
  const gehoert = { blaetter: 0, blaetterImRahmen: 0, gescheitert: [], csp: new Map() };
  // die Verstoesse, die [3] am ersten Blick schon gewertet hat
  let cspGesehen = new Set();

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
    // Der Meldeweg aus den Dokumenten. Ein Blick ins Dokument am Ende des
    // Seitenaufrufs sieht nur die Dokumente, die es dann noch gibt, und darin
    // nur die Links, die noch dastehen. Die Probe des Terminals wechselt die
    // Seite im Rahmen aber mehrmals, und die Suche nimmt den Link ihres
    // nachgeladenen Blatts selbst wieder heraus, wenn es scheitert
    // (assets/data-search.js): Beides blieb gruen (Review PR #355, dritte
    // Runde). Deshalb haengt in JEDEM Dokument jedes Rahmens ein Lauscher,
    // bevor dort irgendetwas laedt, und meldet sofort nach draussen. Was er
    // gehoert hat, bleibt gehoert, auch wenn Link oder Dokument danach weg
    // sind. load und error eines Links steigen nicht auf, kommen in der
    // Fangphase aber am Dokument vorbei. Ein Seitenwechsel mitten im Laden
    // loest kein error aus (gemessen: 18 Wechsel zwischen 0 und 400 ms, 71
    // load, kein error), die abgebrochenen Anfragen des Terminals sind also
    // kein Fehlalarm.
    await page.exposeBinding('__vbRauch', ({ frame }, art, was, wo) => {
      const imRahmen = frame !== page.mainFrame();
      if (art === 'blatt-load') { gehoert.blaetter++; if (imRahmen) gehoert.blaetterImRahmen++; }
      else if (art === 'blatt-error') gehoert.gescheitert.push({ was: String(was), wo: String(wo), imRahmen });
      else if (art === 'csp' && !gehoert.csp.has(String(was))) gehoert.csp.set(String(was), { wo: String(wo), imRahmen });
    });
    await page.addInitScript(() => {
      const eigenesBlatt = (t) => t instanceof HTMLLinkElement && t.relList.contains('stylesheet') && !t.relList.contains('alternate')
        && new URL(t.href, location.href).origin === location.origin;
      for (const art of ['load', 'error'])
        document.addEventListener(art, (e) => {
          if (eigenesBlatt(e.target)) window.__vbRauch?.(`blatt-${art}`, e.target.getAttribute('href'), location.pathname);
        }, true);
      document.addEventListener('securitypolicyviolation', (e) => {
        window.__vbRauch?.('csp', `${e.violatedDirective} ${e.blockedURI || ''}`.trim(), location.pathname);
      });
    });

    const antwort = await page.goto(BASE + pfad, { waitUntil: 'domcontentloaded', timeout: 30000 });
    aufrufe++;
    if (seite.erwarteterStatus && antwort?.status() !== seite.erwarteterStatus)
      melde('status', `Status ${antwort?.status()} statt ${seite.erwarteterStatus}`);

    if (variante.alteHellwahl) {
      geprueftePunkte++;
      const p = await alteHellwahl(page);
      if (p) melde('dunkel', p);
    }

    // [1] keine unbehandelte JS-Ausnahme
    geprueftePunkte++;
    if (jsFehler.length) melde('js', `JS-Ausnahme: ${jsFehler.slice(0, 2).join(' | ')}`);
    gesehenJs = jsFehler.length;

    // [2] keine eigene Ressource >= 400
    geprueftePunkte++;
    if (schlechteAntworten.length)
      melde('http', `${schlechteAntworten.length} eigene Ressource(n) >= 400: ${schlechteAntworten.slice(0, 3).join(', ')}`);
    gesehenHttp = schlechteAntworten.length;

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
    cspGesehen = new Set(csp);
    if (unerwartet.length) melde('csp', `CSP-Verstoss: ${unerwartet.slice(0, 3).join(', ')}`);
    if (erwartet.length) {
      if (IST_VORSCHAU) erwarteteCsp++;
      else melde('csp', `der Zaehl-Host ist auf dem LIVE-Build blockiert: ${erwartet[0]} — die Besucherstatistik laedt nicht`);
    }

    // [4] Leitelement wirklich sichtbar
    geprueftePunkte++;
    const leit = page.locator(seite.leit);
    // warteLeit: das Leitelement zeichnet erst ein nachgeladenes Skript.
    if (seite.warteLeit) await leit.first().waitFor({ state: 'attached', timeout: seite.warteLeit }).catch(() => {});
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

    // [6] Kein Element mit hidden-Attribut wird gezeichnet.
    //
    // Die UA-Regel [hidden]{display:none} verliert gegen JEDE Autor-Regel,
    // die display setzt. mobile-ux.css hebt unter 821 px jeden <button> auf
    // inline-flex, und der Crafting-Planer zeigte am Handy „Synced to your
    // account" neben „Sign in" und „Retry" (07.11.2026): die Skripte setzten
    // hidden richtig, der Browser zeichnete trotzdem. Seitdem gewinnt
    // [hidden] in assets/theme.css mit !important; diese Zusicherung haelt
    // das fest, auf jeder Leitseite und in jeder Variante, egal welches
    // Skript gerade was versteckt. Gemeldet wird nur das oberste gezeichnete
    // [hidden]-Element einer Kette. hidden="until-found" ist ausgenommen.
    geprueftePunkte++;
    const versteckt = await page.evaluate(() => {
      const alle = [...document.querySelectorAll('[hidden]:not([hidden="until-found"])')];
      const gezeichnet = alle
        .filter((el) => el.getClientRects().length > 0 && !el.parentElement?.closest('[hidden]:not([hidden="until-found"])'))
        .map((el) => {
          const name = el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') +
            (typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).join('.')}` : '');
          return `${name} („${(el.textContent || '').trim().slice(0, 30)}", display:${getComputedStyle(el).display})`;
        });
      return { n: alle.length, gezeichnet };
    });
    hiddenGeprueft += versteckt.n;
    if (versteckt.gezeichnet.length)
      melde('hidden', `${versteckt.gezeichnet.length} Element(e) mit hidden-Attribut gezeichnet: ${versteckt.gezeichnet.slice(0, 4).join(', ')}`);

    // [7] Filter-Schubladen am Telefon (assets/offcanvas.js). Gemessen
    // 09.11.2026: der Fokus blieb beim Oeffnen auf dem Knopf (inert lief noch),
    // und die Site-Nav (z 9600) lag ueber dem Kopf der Schublade (9250), ihr ✕
    // war nicht antippbar. Jede sichtbare Schublade auf jeder Leitseite: offen
    // geht der Fokus hinein, das erste Bedienelement liegt oben, Esc schliesst
    // und macht sie wieder inert.
    if (variante.breite <= 820) {
      const knoepfe = page.locator('[data-offcanvas-toggle]');
      for (let i = 0; i < (await knoepfe.count()); i++) {
        const knopf = knoepfe.nth(i);
        if (!(await knopf.isVisible())) continue;
        const id = await knopf.getAttribute('data-offcanvas-toggle');
        geprueftePunkte++;
        schubladen++;
        await knopf.click();
        await page.waitForTimeout(450);
        const offen = await page.evaluate((id) => {
          const panel = document.getElementById(id);
          if (!panel) return { fehlt: true };
          const a = document.activeElement;
          const erstes = [...panel.querySelectorAll('button, [href], input, select, textarea')].find((el) => el.getClientRects().length);
          let oben = null;
          if (erstes) {
            const r = erstes.getBoundingClientRect();
            const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            if (el && !erstes.contains(el)) oben = el.closest('#topbar') ? 'der Site-Nav' : el.tagName + (el.id ? `#${el.id}` : '');
          }
          return {
            offen: panel.classList.contains('is-open') && !panel.inert,
            fokusDrin: panel.contains(a),
            fokus: a ? a.tagName + (a.id ? `#${a.id}` : '') : '-',
            erstes: erstes ? erstes.tagName + (erstes.id ? `#${erstes.id}` : '') : null,
            oben,
          };
        }, id);
        if (offen.fehlt) { melde('schublade', `#${id}: Panel zum Knopf fehlt`); continue; }
        if (!offen.offen) { melde('schublade', `#${id} oeffnet nicht (is-open/inert)`); continue; }
        if (!offen.fokusDrin) melde('schublade', `#${id}: beim Oeffnen bleibt der Fokus draussen (${offen.fokus})`);
        if (offen.oben) melde('schublade', `#${id}: ${offen.erstes} liegt unter ${offen.oben}`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(450);
        const zu = await page.evaluate((id) => {
          const panel = document.getElementById(id);
          return !panel.classList.contains('is-open') && panel.inert === true;
        }, id);
        if (!zu) melde('schublade', `#${id}: Esc schliesst nicht oder laesst sie bedienbar (inert fehlt)`);
      }
    }

    // Interaktionsprobe nur im Normalfall — sie soll das Verhalten belegen,
    // nicht dreimal dasselbe.
    if (seite.probe && variante.id === 'dunkel-1280') {
      geprueftePunkte++;
      const vor = { antworten: eigeneAntworten, rahmen: rahmenAntworten };
      const p = await seite.probe(page);
      if (p) melde('probe', p);
      else probeOhneBefund = true;
      probenLaeufe++;
      const imRahmen = rahmenAntworten - vor.rahmen;
      probenAntworten += eigeneAntworten - vor.antworten;
      probenRahmen += imRahmen;
      // Selbstauskunft je Szenario: Laedt die Probe Seiten in einen Rahmen
      // (minRahmenAntworten), muss der Lauscher deren Antworten gesehen haben.
      // Sonst waere [8] fuer genau diese Seiten taub und trotzdem gruen. Nur
      // nach einer Probe ohne Befund: Bricht sie vorher ab, hat sie die
      // Seiten gar nicht geladen.
      if (seite.minRahmenAntworten && !p && imRahmen < seite.minRahmenAntworten)
        melde('probe-lauscher', `waehrend der Probe nur ${imRahmen} Antworten aus Seiten in einem Rahmen mitgelesen, Untergrenze ${seite.minRahmenAntworten} — der Lauscher hoert die Seiten im Terminal nicht mehr; Ursache klaeren, nicht die Untergrenze senken`);
    }

    // [8] Nach dem ersten Blick. [1] und [2] werten aus, was beim Aufbau des
    // Dokuments angekommen war. Was spaeter kam (nachgeladene Dateien, alles,
    // was eine Probe bedient, im Hangar ganze Seiten im Fenster des
    // Terminals), stand danach nur noch in den Listen und nie in der Bilanz
    // (Review PR #355). pageerror und response melden alle Rahmen der Seite,
    // die Seiten im Terminal zaehlen also mit.
    geprueftePunkte++;
    await Promise.all(herkunft);
    const ohneServer = [...eingespielt].filter((i) => i >= gesehenHttp).sort((x, y) => x - y);
    const abgenommen = new Set(ohneServer.slice(0, variante.id === 'dunkel-1280' ? (seite.spieltEin ?? 0) : 0));
    probenEingespielt += abgenommen.size;
    if (seite.spieltEin && probeOhneBefund && ohneServer.length < seite.spieltEin)
      melde('probe-eingespielt', `das Szenario erklaert ${seite.spieltEin} selbst eingespielte Fehlantwort(en), die Probe hat ${ohneServer.length} eingespielt — die Ausnahme hat ihren Anlass verloren; spieltEin am Szenario anpassen`);
    const jsSpaet = jsFehler.slice(gesehenJs), httpSpaet = schlechteAntworten.filter((_, i) => i >= gesehenHttp && !abgenommen.has(i));
    if (jsSpaet.length) melde('js-spaet', `JS-Ausnahme nach dem Aufbau der Seite: ${jsSpaet.slice(0, 2).join(' | ')}`);
    if (httpSpaet.length) melde('http-spaet', `${httpSpaet.length} eigene Ressource(n) >= 400 nach dem Aufbau der Seite: ${httpSpaet.slice(0, 3).join(', ')}`);
    // Ein Stilblatt, das mit 404 oder 500 antwortet, taucht in [2] nie auf:
    // Die Fehlerseite ist text/html, mit nosniff verwirft der Browser sie, und
    // die Anfrage endet als abgebrochen statt als Antwort (gemessen am
    // 13.11.2026 beim Rotlauf zu dieser Zusicherung; ein Skript meldet seine
    // 404 dagegen). Abgebrochene Anfragen sind als Signal unbrauchbar, jeder
    // Seitenwechsel im Fenster des Terminals bricht welche ab. Das Urteil
    // kommt deshalb aus den Dokumenten, auf zwei Wegen:
    //   · gehoert: das error, das der Meldeweg oben in irgendeinem Dokument
    //     des Seitenaufrufs gehoert hat, wann auch immer;
    //   · gesehen: in den Dokumenten, die es jetzt noch gibt, sind die Regeln
    //     jedes eingebundenen eigenen Blatts lesbar. Ein Blatt (link.sheet)
    //     bekommt auch das gescheiterte, erst der Griff nach cssRules wirft
    //     dort (gemessen). Dieser Blick wartet zugleich auf Blaetter, die
    //     noch unterwegs sind, und er haelt den Meldeweg ehrlich: Was er
    //     findet, zaehlt auch dann, wenn der Meldeweg es nicht gehoert hat.
    geprueftePunkte++;
    const ohneBlatt = new Map(); // je Dokument die Blaetter, die dort nicht geladen sind
    const merke = (wo, imRahmen, was) => {
      const k = `${imRahmen ? 'rahmen' : 'oben'} ${wo}`;
      if (!ohneBlatt.has(k)) ohneBlatt.set(k, { wo, imRahmen, was: new Set() });
      ohneBlatt.get(k).was.add(was);
    };
    for (const rahmen of page.frames()) {
      // Fehlen darf hier nur ein Dokument, das es nachweislich nicht mehr gibt
      // (der Rahmen ist weg oder zeigt keine eigene Seite mehr). Ein Dokument,
      // das noch da ist und sich nicht lesen laesst (nach 10 s nicht fertig
      // geladen, oder die Abfrage wirft), wurde bis zur dritten Review-Runde
      // von PR #355 still uebersprungen, und die Blaetter der anderen
      // Seitenaufrufe hielten die Untergrenze trotzdem. Jetzt ist das ein
      // Befund. Zwei Anlaeufe: Wechselt das Dokument waehrend des Lesens,
      // gilt der zweite dem neuen.
      let b = null, grund = '';
      for (let anlauf = 0; anlauf < 2 && !b; anlauf++) {
        if (rahmen.isDetached() || !rahmen.url().startsWith(BASE)) { grund = ''; break; }
        try {
          await rahmen.waitForFunction(() => document.readyState === 'complete', null, { timeout: 10000 });
          b = await rahmen.evaluate(async () => {
            const alle = [...document.querySelectorAll('link[rel~="stylesheet"]:not([rel~="alternate"])')]
              .filter((l) => !l.disabled && new URL(l.href, location.href).origin === location.origin);
            // Ein Blatt, das ein Skript eben erst eingehaengt hat (die Suche laedt
            // ihres beim ersten Oeffnen), ist noch unterwegs und hat noch kein
            // sheet: auf sein load oder error warten, hoechstens 5 s, statt es
            // als gescheitert zu lesen.
            await Promise.all(alle.filter((l) => !l.sheet).map((l) => new Promise((fertig) => {
              l.addEventListener('load', fertig, { once: true });
              l.addEventListener('error', fertig, { once: true });
              setTimeout(fertig, 5000);
            })));
            const geladen = (l) => { try { return !!l.sheet && l.sheet.cssRules.length >= 0; } catch { return false; } };
            return { n: alle.length, ohne: alle.filter((l) => !geladen(l)).map((l) => l.getAttribute('href')), wo: location.pathname };
          });
        } catch (e) {
          grund = e.message.split('\n')[0];
        }
      }
      const imRahmen = rahmen !== page.mainFrame();
      if (!b) {
        if (grund && !rahmen.isDetached() && rahmen.url().startsWith(BASE))
          melde('stilblatt-blick', `die Stilblaetter von ${new URL(rahmen.url()).pathname}${imRahmen ? ' (Seite im Rahmen)' : ''} liessen sich am Ende nicht lesen: ${grund} — das Dokument ist noch da, sein Blick fehlt in der Bilanz`);
        continue;
      }
      stilDokumente++;
      stilblaetter += b.n - b.ohne.length;
      for (const was of b.ohne) merke(b.wo, imRahmen, was);
    }
    for (const g of gehoert.gescheitert) merke(g.wo, g.imRahmen, g.was);
    for (const d of ohneBlatt.values())
      melde('stilblatt', `${d.was.size} Stilblatt/Stilblaetter nicht geladen${d.imRahmen ? ` in ${d.wo} (Seite im Rahmen)` : ''}: ${[...d.was].slice(0, 3).join(', ')}`);
    stilGehoert += gehoert.blaetter;
    stilRahmen += gehoert.blaetterImRahmen;
    // Selbstauskunft je Szenario, wie minRahmenAntworten oben: Laedt die Probe
    // Seiten in einen Rahmen, muss der Meldeweg dort Blaetter laden gehoert
    // haben. Sonst hinge er nur noch im Dokument oben und waere fuer die
    // Seiten im Terminal taub und trotzdem gruen.
    if (seite.minRahmenBlaetter && probeOhneBefund && gehoert.blaetterImRahmen < seite.minRahmenBlaetter)
      melde('stil-lauscher', `nur ${gehoert.blaetterImRahmen} geladene Stilblaetter aus Seiten in einem Rahmen gehoert, Untergrenze ${seite.minRahmenBlaetter} — der Meldeweg aus den Dokumenten hoert die Seiten im Terminal nicht mehr; Ursache klaeren, nicht die Untergrenze senken`);

    // CSP wie [3], fuer den Rest: [3] liest einmal, am ersten Blick, und nur
    // im Dokument oben. Was der Meldeweg darueber hinaus gehoert hat, kam
    // spaeter oder aus einer Seite in einem Rahmen. Gleiche Erwartung wie
    // dort: Der Zaehl-Host darf nur im Vorschau-Bau verstossen.
    geprueftePunkte++;
    const cspNeu = [...gehoert.csp].filter(([v]) => !cspGesehen.has(v));
    cspGehoertGesamt += gehoert.csp.size;
    cspSpaetGesamt += cspNeu.length;
    const woher = ([v, d]) => `${v}${d.imRahmen ? ` in ${d.wo} (Seite im Rahmen)` : ''}`;
    const cspUnerwartet = cspNeu.filter(([v]) => !ZAEHLER_HOST.test(v));
    if (cspUnerwartet.length)
      melde('csp-spaet', `CSP-Verstoss nach dem Aufbau der Seite oder in einer Seite in einem Rahmen: ${cspUnerwartet.slice(0, 3).map(woher).join(', ')}`);
    const cspZaehler = cspNeu.filter(([v]) => ZAEHLER_HOST.test(v));
    if (cspZaehler.length && !IST_VORSCHAU)
      melde('csp-spaet', `der Zaehl-Host ist auf dem LIVE-Build blockiert: ${woher(cspZaehler[0])} — die Besucherstatistik laedt nicht`);
    // Selbstauskunft: Was [3] im Dokument gelesen hat, muss auch der Meldeweg
    // gehoert haben, es ist dasselbe Ereignis. Sonst waere er fuer CSP taub.
    const cspTaub = [...cspGesehen].filter((v) => !gehoert.csp.has(v));
    if (cspTaub.length)
      melde('csp-lauscher', `[3] hat im Dokument ${cspTaub.length} CSP-Verstoss/Verstoesse gelesen, die der Meldeweg aus den Dokumenten nicht gehoert hat (${cspTaub[0]}) — [8] waere fuer CSP taub; Ursache klaeren`);
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

/* ---------- Traegt dieses Artefakt den Hangar? ----------
   Der Live-Bau laesst die Hangar-Routen weg (hangar-switch.mjs: der Betreiber
   hat am 31.10.2026 entschieden, dass live alles AUSSER dem Hangar bekommt).
   Die zwei Hangar-Szenarien liefen trotzdem und fanden 404 — das hat am
   01.11.2026 den Live-Deploy von 2b43b068 gerissen, nachdem Schiene A gruen
   war: die sechs Hangar-Tore dort kennen nurMitHangar, dieser Test nicht.
   Gefragt wird deshalb dieselbe Stelle wie dort, nur ueber das Netz. */
const MIT_HANGAR = await hangarImArtefaktUeberNetz(BASE, GATE_BYPASS_HEADERS);

/* ---------- Lauf ---------- */
console.log(`\n=== Browser-Rauchtest gegen ${BASE} ===`);
console.log(`Artefakt: ${IST_VORSCHAU ? 'Vorschau-Build (site-weit noindex)' : 'Live-Build'}`);
console.log(`Hangar im Artefakt: ${MIT_HANGAR ? 'ja' : 'nein — Hangar-Szenarien entfallen'}`);
// Selbstauskunft, unter welcher Bedingung dieser Lauf gruen war (Grundsatz
// 7) — und dieselbe Zeile macht sichtbar, wenn jemand lokal versehentlich
// MIT Bypass misst.
console.log(`Testpilot-Tor-Bypass: ${GATE_BYPASS ? 'MIT Bypass geprueft (SMOKE_GATE_BYPASS gesetzt)' : 'ohne Bypass'}`);
console.log(`Browser: ${BROWSER}${BROWSER_ARGS.length ? ` (${BROWSER_ARGS.join(' ')})` : ''}\n`);

const browser = await chromium.launch({ executablePath: BROWSER, headless: !KOPF, args: BROWSER_ARGS });
const gewaehlt = NUR ? SEITEN.filter((s) => s.id === NUR) : SEITEN;
if (!gewaehlt.length) {
  console.error(`Unbekannte Seite "${NUR}". Bekannt: ${SEITEN.map((s) => s.id).join(', ')}`);
  await browser.close();
  process.exit(2);
}
const seiten = gewaehlt.filter((s) => MIT_HANGAR || !s.nurMitHangar);
const entfallen = gewaehlt.length - seiten.length;
if (entfallen) console.log(`${entfallen} Szenario(en) entfallen: nicht im Artefakt (nurMitHangar).`);
if (!seiten.length) {
  // Ausdruecklich NICHT gruen: hier wurde nichts geprueft (Grundsatz 2).
  console.error(`\n"${NUR}" gehoert zum Hangar, und dieses Artefakt traegt ihn nicht — nichts geprueft.\n`);
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
console.log(`  [6] Elemente mit hidden-Attribut angesehen: ${hiddenGeprueft}   Untergrenze: ${MIN_HIDDEN}`);
const SYNC_SOLL = SYNC_BREITEN.length * SYNC_ZUSTAENDE.length * 2 * 2; // je Breite und Zustand zwei Anzeigen, zwei Sprachen
const mitPlaner = seiten.some((s) => s.id === 'crafting-planer');
if (mitPlaner) console.log(`  Konto-Anzeigen des Crafting-Planers geprueft: ${syncAnzeigen} von ${SYNC_SOLL}`);
console.log(`  [7] Filter-Schubladen am Telefon geprueft: ${schubladen}   Untergrenze: ${MIN_SCHUBLADEN}`);
if (seiten.some((x) => x.id === 'hangar-layout')) console.log(`  Fussleiste des Hangars: ${fussBreiten} Breiten gemessen, an ${fussEng} wichen Namen den Zeichen (Untergrenze ${FUSS_MIN_ENG} je Sprache), an ${fussNeben} rueckte sie neben die Zeichen der Buehne (Untergrenze 1 je Sprache)`);
if (seiten.some((x) => x.id === 'hangar-layout')) console.log(`  Leitstand: ${leitKnoepfe} Bedienelemente in der Tab-Reihenfolge auf ihren Platz im Bild geprueft (Untergrenze ${LEIT_MIN_KNOEPFE} je Sprache)`);
if (probenLaeufe) console.log(`  Proben: ${probenLaeufe} gefahren, dabei ${probenAntworten} Antworten eigener Ressourcen mitgelesen, ${probenRahmen} davon aus Seiten in einem Rahmen; ${probenEingespielt} Fehlantwort(en) hat eine Probe selbst eingespielt, wie am Szenario erklaert (nicht gewertet)`);
console.log(`  [8] Stilblaetter: ${stilGehoert} beim Laden gehoert, ${stilRahmen} davon in Seiten in einem Rahmen; am Ende ${stilblaetter} mit lesbarem Blatt in ${stilDokumente} Dokumenten   Untergrenze beider Zaehler: eines je Seitenaufruf (${aufrufe})`);
if (stilblaetter < aufrufe)
  fehler.push(`[8] nur ${stilblaetter} geladene Stilblaetter bei ${aufrufe} Seitenaufrufen gezaehlt — leerlaufende Abfrage? Ursache klaeren, nicht die Untergrenze senken`);
if (stilGehoert < aufrufe)
  fehler.push(`[8] der Meldeweg aus den Dokumenten hat nur ${stilGehoert} Stilblaetter laden gehoert bei ${aufrufe} Seitenaufrufen — taub? Ursache klaeren, nicht die Untergrenze senken`);
console.log(`  [8] CSP-Verstoesse ueber den Meldeweg aus den Dokumenten: ${cspGehoertGesamt} gehoert, ${cspSpaetGesamt} davon nach dem ersten Blick oder aus einer Seite in einem Rahmen`);
if (schubladen < MIN_SCHUBLADEN && !NUR)
  fehler.push(`[7] nur ${schubladen} Filter-Schubladen geprueft, Untergrenze ist ${MIN_SCHUBLADEN} — leerlaufende Abfrage? Ursache klaeren, nicht die Untergrenze senken`);
if (hiddenGeprueft < MIN_HIDDEN && !NUR)
  fehler.push(`[6] nur ${hiddenGeprueft} Elemente mit hidden-Attribut angesehen, Untergrenze ist ${MIN_HIDDEN} — leerlaufende Abfrage? Ursache klaeren, nicht die Untergrenze senken`);
if (mitPlaner && syncAnzeigen < SYNC_SOLL && !fehler.some((f) => f.includes('Crafting-Planer')))
  fehler.push(`Crafting-Planer: nur ${syncAnzeigen} von ${SYNC_SOLL} Konto-Anzeigen geprueft`);
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
