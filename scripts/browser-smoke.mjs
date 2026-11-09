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

   Sieben Zusicherungen je Seitenaufruf:
     1  keine unbehandelte JS-Ausnahme (pageerror)
     2  keine eigene Ressource antwortet mit >= 400 (faengt tote ?v=-Verweise)
     3  kein CSP-Verstoss (securitypolicyviolation am Dokument)
     4  das Leitelement der Seite ist WIRKLICH sichtbar, nicht nur im DOM
     5  kein waagerechter Ueberlauf (die wiederkehrende 360-px-Falle)
     6  kein Element mit hidden-Attribut wird gezeichnet
     7  Selbstauskunft + Klinke: wie viele Aufrufe wurden wirklich gefahren

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
    leit: '#cdb-grid .cbp', minAnzahl: 50, schwer: true, probe: probeCraftingSync,
  },
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
  // Der 3D-Hangar, als tiefer Link auf ein Schiff, das nicht das Startschiff
  // ist: die Ausstattung kommt dann als Buchtdokument per Abruf.
  {
    id: 'hangar',
    // pane=ship: die Vorgabe der Tafel ist die Layout-Werkstatt, geprueft werden hier die Schiffsdaten.
    en: '/hangar.html?ship=drak-cutlass-black&tab=weapons&hp=hardpoint_turret&pane=ship',
    de: '/de/hangar.html?ship=drak-cutlass-black&tab=weapons&hp=hardpoint_turret&pane=ship',
    leit: '#hgx-panelhost .hgx-slot', schwer: true, probe: probeHangar,
    nurMitHangar: true,
  },
  // Die Layout-Werkstatt, die Vorgabe der Tafel: ihre Slots kommen aus
  // /hangar-layouts.json und stehen erst, wenn Datei und Skript geladen sind.
  { id: 'hangar-layout', en: '/hangar.html', de: '/de/hangar.html', leit: '#hgl-slots .hgl-slot', minAnzahl: 3, warteLeit: 30000, probe: probeWerkstatt, nurMitHangar: true },
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
let aufrufe = 0, geprueftePunkte = 0, erwarteteCsp = 0, hiddenGeprueft = 0, syncAnzeigen = 0;

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
    await page.goto(hangar + (q ? `${q}&pane=ship` : '?pane=ship'), { waitUntil: 'domcontentloaded' });
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
      const korb = '?cmp=aegs-gladius,drak-cutlass-black&pane=ship';
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
      await page.goto(hangar + '?ship=anvl-arrow&tab=weapons&hp=hardpoint_weapon_wing_left&pane=ship', { waitUntil: 'domcontentloaded' });
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
  await tausche('weapons');
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
        const anzeigen = await p.evaluate(() => [...document.querySelectorAll('.cdb-sync')].map((h) => {
          // checkVisibility gibt es erst ab Chrome 105 (die Optionsnamen ab
          // 121, davor checkVisibilityCSS/checkOpacity); ohne es entscheidet
          // der berechnete Stil des Elements und seiner Vorfahren.
          const zu = (el) => {
            if (!el || el.getClientRects().length === 0) return false;
            if (typeof el.checkVisibility === 'function') {
              return el.checkVisibility({ visibilityProperty: true, opacityProperty: true, checkVisibilityCSS: true, checkOpacity: true });
            }
            if (getComputedStyle(el).visibility === 'hidden') return false;
            for (let n = el; n; n = n.parentElement) if (getComputedStyle(n).opacity === '0') return false;
            return true;
          };
          return {
            wo: h.classList.contains('cdb-sync--drawer') ? 'Planer' : 'Kopfleiste',
            state: h.dataset.state,
            text: (h.querySelector('.cdb-sync__txt')?.textContent ?? '').trim(),
            zu: zu(h),
            login: zu(h.querySelector('.cdb-sync__login')),
            retry: zu(h.querySelector('.cdb-sync__retry')),
          };
        }));
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

/* Die Crafting-Werkbank (Prototyp, Skizze 016-3, nur im Vorschau-Bau):
   dasselbe Werkzeug wie der Planer, anders gestellt. Am Schreibtisch steht
   das Rezept als feste Mitte neben der Liste und der Planer als Spalte
   rechts; Waehlen, Schliessen und ein tiefer Link muessen dort ohne Dialog
   gehen. Am Telefon ist die Mitte zu, ein Antippen legt das Rezept als
   ganze Ebene ueber die Liste, „← Liste“ fuehrt zurueck, und der Planer
   sitzt als Leiste unten. Gemessen an Lage und Inhalt, nicht am Markup. */
async function probeWerkbank(page) {
  const kasten = (p, sel) => p.locator(sel).first().boundingBox();
  const zuSehen = (p, sel) => p.locator(sel).first().isVisible().catch(() => false);
  const bpi = (p) => new URL(p.url()).searchParams.get('bpi');
  const wahl = (p) => p.$$eval('#cdb-grid .cbp.is-sel', (c) => c.map((x) => x.dataset.i));
  const titel = async (p) => ((await p.locator('#cdb-modal .cbm__name').first().innerText().catch(() => '')) || '').trim();

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
  // Filter: Schublade von links. Geschlossen weder fokussierbar noch
  // vorlesbar (inert), offen bedienbar, Esc schliesst.
  const inert = () => page.$eval('#cdb-sidebar', (el) => el.inert === true);
  if (!(await inert())) return 'Werkbank 1280 px: die geschlossene Filter-Schublade ist nicht inert (per Tab erreichbar)';
  await page.locator('#cdb-filter-toggle').click();
  await page.waitForTimeout(400);
  const fk = await kasten(page, '#cdb-sidebar');
  if ((await inert()) || !fk || fk.x < -1) return `Werkbank 1280 px: die Filter-Schublade oeffnet nicht (x=${fk ? Math.round(fk.x) : '?'}, inert ${await inert()})`;
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
  // Die Mitte klebt unter der Kopfleiste, wenn die Seite weiter rollt:
  // so weit rollen, dass sie ohne Kleben 30 px ueber ihrer Klebelinie
  // stuende (Raum dafuer hat die Spalte, die Liste ist hoeher als die Mitte).
  const klebt = await page.evaluate(async () => {
    const m = document.querySelector('#cdb-modal');
    const soll = parseFloat(getComputedStyle(m).top);
    const bild = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    // instant: die Seite rollt sonst weich, und gemessen wuerde mitten im Lauf.
    window.scrollTo({ top: 0, behavior: 'instant' });
    await bild();
    window.scrollTo({ top: m.getBoundingClientRect().top - soll + 30, behavior: 'instant' });
    await bild();
    return { soll, ist: m.getBoundingClientRect().top };
  });
  if (!Number.isFinite(klebt.soll) || Math.abs(klebt.ist - klebt.soll) > 4)
    return `Werkbank 1280 px: die Mitte klebt nicht unter der Kopfleiste (oben ${Math.round(klebt.ist)} px, ${Number.isFinite(klebt.soll) ? `soll ${Math.round(klebt.soll)} px` : 'top ist auto, steht eine Kurzform wie inset danach?'})`;
  // Zum Planer: die Spalte rechnet sofort mit.
  await page.locator('#cdb-modal .cbm__plan').first().click();
  const imPlaner = await page.locator('#cdb-plan-list .cdb-plan-item .pi__n').allInnerTexts();
  if (!imPlaner.map((s) => s.trim()).includes(name)) return `Werkbank 1280 px: „Zum Planer“ zeigt „${name}“ nicht in der Planer-Spalte (dort: ${JSON.stringify(imPlaner)})`;
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
  const lage = await page.evaluate((n) => {
    const g = document.querySelector('#cdb-grid').getBoundingClientRect();
    const k = document.querySelector(`#cdb-grid .cbp[data-i="${n}"]`).getBoundingClientRect();
    return { y: window.scrollY, drin: k.top >= g.top - 1 && k.bottom <= g.bottom + 1 };
  }, weit.i);
  if ((await titel(page)) !== weit.name) return `Werkbank 1280 px: der tiefe Link auf „${weit.name}“ zeigt „${await titel(page)}“`;
  if (lage.y > 2) return `Werkbank 1280 px: der tiefe Link auf ein Rezept weit unten schiebt die Seite um ${Math.round(lage.y)} px`;
  if (!lage.drin) return `Werkbank 1280 px: der tiefe Link auf „${weit.name}“ rollt die Liste nicht zu seiner Karte`;

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
    if (await zuSehen(p, '#cdb-modal')) return 'Werkbank 390 px: die Rezept-Ebene liegt schon ohne Wahl ueber der Liste';
    const leiste = await kasten(p, '#cdb-planner-open');
    if (!leiste || leiste.y + leiste.height < 844 - 40 || leiste.height < 44)
      return `Werkbank 390 px: die Planer-Leiste sitzt nicht unten (${leiste ? `y=${Math.round(leiste.y)}, h=${Math.round(leiste.height)}` : 'fehlt'})`;
    const k = p.locator('#cdb-grid .cbp').nth(1);
    const n2 = ((await k.locator('.cbp__name').textContent()) || '').trim();
    await k.locator('.cbp__name').tap();
    await p.waitForTimeout(300);
    const ebene = await kasten(p, '#cdb-modal .cdb-modal__box');
    if (!ebene || ebene.y > 2 || ebene.width < 380) return `Werkbank 390 px: das Rezept liegt nicht als ganze Ebene ueber der Liste (${ebene ? `y=${Math.round(ebene.y)}, b=${Math.round(ebene.width)}` : 'nicht zu sehen'})`;
    if ((await titel(p)) !== n2) return `Werkbank 390 px: nach Antippen von „${n2}“ zeigt die Ebene „${await titel(p)}“`;
    const zur = await kasten(p, '#cdb-modal .cdb-wb-zur');
    if (!zur || zur.height < 44) return `Werkbank 390 px: „← Liste“ fehlt oder ist nur ${zur ? Math.round(zur.height) : 0} px hoch`;
    if (await zuSehen(p, '#cdb-modal .cdb-modal__back')) return 'Werkbank 390 px: neben „← Liste“ steht noch der kleine Zurueck-Pfeil';
    await p.locator('#cdb-modal .cdb-wb-zur').tap();
    await p.waitForTimeout(300);
    if (await zuSehen(p, '#cdb-modal')) return 'Werkbank 390 px: „← Liste“ fuehrt nicht zur Liste zurueck';
    if (bpi(p) !== null) return 'Werkbank 390 px: nach „← Liste“ traegt die Adresse noch bpi';
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

    if (variante.alteHellwahl) {
      geprueftePunkte++;
      const p = await alteHellwahl(page);
      if (p) melde('dunkel', p);
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
