/* ============================================================
   schiffskarte-messung.mjs — die Hoehen-Sperrklinke, die Backstop-Punkte
   der UI-SPEC ("UI Considerations") und der Kontrast des Kapitel-Zahl-Chips
   AM GERENDERTEN BILDPUNKT gemessen, nicht aus dem CSS-Wert geschaetzt.

   EINE SONDE, KEIN TOR: liegt in scripts/probes/, wird von keinem npm-Ziel
   gerufen und haengt an keiner Strecke der Torkette (npm run gate). Sie
   braucht einen echten, installierten Browser (playwright-core bringt
   keinen mit) — derselbe Grund, aus dem scripts/browser-smoke.mjs NICHT im
   Baucontainer laeuft (node:22-alpine hat keinen Browser). Ausgefuehrt von
   Hand gegen eine laufende Vorschau (npm run preview); ihr Ergebnis wandert
   in 14-01-SUMMARY.md (Ausgangsmessung) und spaeter 14-04-SUMMARY.md
   (Schlussmessung).

   WARUM UEBERHAUPT: 14-CONTEXT.md § "Ausgangsmessung" nennt 5.554 px als
   Carrack-Seitenhoehe bei 1280x720 und Konkrete Vorgabe 1 verlangt, dass
   die Schlussmessung "an derselben Seite, derselben Breite, demselben
   Werkzeug" laeuft — ein Werkzeug, das den Ausgangswert nicht reproduziert,
   ist kein gueltiger Massstab fuer die spaetere Sperrklinke (14-01-PLAN.md
   Task 2). 14-UI-SPEC.md Punkt 1 verlangt zusaetzlich, den geschaetzten
   scroll-margin-top-Wert (64 px) am Bildpunkt nachzumessen statt ihn
   anzunehmen.

   PRUEFZIELE AUS DEN DATEN (src/data/vehicles.json), nicht fest verdrahtet:
     - Bezug: die Carrack (anvl-carrack) — einziger fest genannter Wert,
       weil die Ausgangsmessung an ihr haengt (14-CONTEXT.md).
     - Groesstes Schiff nach lengthM, berechnet bei jedem Lauf neu (Stand
       18.08.2026 laeuft dies auf ein 243-Meter-Schiff hinaus, siehe die
       Kopfzeile "Pruefschiffe" beim Programmstart fuer den Ist-Stand).
     - Kargstes Schiff nach einem berechneten Fuellgrad: Zahl der belegten
       Felder aus {lengthM, cargoSCU, scmSpeed, pitch, pilotDps, hullHp,
       shieldHp, qtSpeedMs, h2Fuel, insClaimMin, components} — ein Feld
       zaehlt als belegt, wenn sein Wert WAHR ist (0/null/leeres Array
       zaehlen NICHT als Daten); components zaehlt als belegt, wenn
       mindestens eine seiner fuenf Unterlisten nicht leer ist (Stand
       18.08.2026: 2 von 11 Feldern bei der knappsten Kandidatin, siehe
       ebenfalls die Kopfzeile beim Programmstart). Ein spaeterer Datenlauf,
       der diese Auswahl verschiebt, faellt beim Lesen der Kopfzeile auf —
       die AUSWAHL selbst bleibt berechnet, nicht die Kennung.

   MESSMATRIX: 3 Schiffe x 2 Sprachen (Wurzelpfad, /de/-Praefix) x 2 Breiten
   (1280x720, 360x740) x 2 Farbmodi (data-theme am Wurzelelement gesetzt,
   Neuzeichnen abgewartet) = 24 Laeufe, ZEHN Messgruppen (a-j, seit
   16-05-PLAN.md Task 2: j-konsolen-kontrast) je Lauf.
   Gruppe i (Backstop E2, seit 14-04-PLAN.md Task 2) laeuft nur bei
   1280x720: kein Innenraster ueberschreitet die Breite seines Kapitels,
   kein Kapitel ueberschreitet die lokale Hoechstbreite von 1100px.

   MESSMETHODE Kontrast (Gruppe f): kein zweites Kontrastmass — dieselbe
   contrast()/luminance()-Formel wie scripts/verify-layers.mjs und
   scripts/probes/mining-locview-messung.mjs, aus derselben Bibliothek
   importiert (siehe Import unten). Dunkelster/hellster Bildpunkt in einem
   eng zugeschnittenen Ausschnitt
   SIND bei einer einfarbigen Flaeche mit einfarbigem Text Hintergrund und
   Textkern (Praezedenz: 12-03-SUMMARY.md).

     node scripts/probes/schiffskarte-messung.mjs --base http://localhost:4321
     node scripts/probes/schiffskarte-messung.mjs --base http://localhost:4321 --baseline
     node scripts/probes/schiffskarte-messung.mjs --base http://localhost:4321 --only anvl-carrack
   ============================================================ */
import { existsSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { contrast, luminance } from '../lib/theme-color.mjs';

const argv = process.argv.slice(2);
const flag = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const BASE = (flag('--base', process.env.SMOKE_BASE || 'http://localhost:4321')).replace(/\/$/, '');
const NUR = flag('--only', null);
const KOPF = argv.includes('--headed');
const BASELINE = argv.includes('--baseline');

/* ---------- Browser finden (Bauform wie scripts/browser-smoke.mjs, scripts/probes/mining-locview-messung.mjs) ---------- */
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

/* ---------- Pruefschiffe aus den Daten waehlen ---------- */
const FELDER = ['lengthM', 'cargoSCU', 'scmSpeed', 'pitch', 'pilotDps', 'hullHp', 'shieldHp', 'qtSpeedMs', 'h2Fuel', 'insClaimMin', 'components'];
function fuellgrad(v) {
  let n = 0;
  for (const f of FELDER) {
    const val = v[f];
    if (f === 'components') {
      if (val && Object.values(val).some((arr) => Array.isArray(arr) && arr.length > 0)) n++;
    } else if (val) n++;
  }
  return n;
}
const vehiclesRaw = JSON.parse(readFileSync('src/data/vehicles.json', 'utf8'));
const vehicles = vehiclesRaw.vehicles || [];
if (!vehicles.length) {
  console.error('src/data/vehicles.json liefert keine Fahrzeuge — Sonde kann nicht laufen.');
  process.exit(2);
}
const CARRACK_ID = 'anvl-carrack';
const bezug = vehicles.find((v) => v.id === CARRACK_ID);
if (!bezug) {
  console.error(`Bezugsschiff "${CARRACK_ID}" nicht in src/data/vehicles.json gefunden — Ausgangsmessung nicht reproduzierbar.`);
  process.exit(2);
}
let groesstes = vehicles[0];
for (const v of vehicles) if ((v.lengthM || 0) > (groesstes.lengthM || 0)) groesstes = v;
let kargstes = vehicles[0];
let kargstesN = fuellgrad(vehicles[0]);
for (const v of vehicles) {
  const n = fuellgrad(v);
  if (n < kargstesN) {
    kargstesN = n;
    kargstes = v;
  }
}
const ALLE_ZIELE = [
  { id: bezug.id, name: bezug.name, grund: 'Bezug der Ausgangsmessung (14-CONTEXT.md)' },
  { id: groesstes.id, name: groesstes.name, grund: `groesstes Schiff nach lengthM (${groesstes.lengthM} m)` },
  { id: kargstes.id, name: kargstes.name, grund: `kargstes Schiff nach Fuellgrad (${kargstesN} von ${FELDER.length} Feldern belegt)` },
];
const ZIELE = NUR ? ALLE_ZIELE.filter((z) => z.id === NUR) : ALLE_ZIELE;
if (!ZIELE.length) {
  console.error(`Unbekanntes Ziel "${NUR}". Bekannt: ${ALLE_ZIELE.map((z) => z.id).join(', ')}`);
  process.exit(2);
}

const SPRACHEN = [
  { id: 'en', pfad: (id) => `/schiffe/${id}.html` },
  { id: 'de', pfad: (id) => `/de/schiffe/${id}.html` },
];
const BREITEN = [
  { id: '1280x720', breite: 1280, hoehe: 720 },
  { id: '360x740', breite: 360, hoehe: 740 },
];
const FARBMODI = ['dark', 'light'];

/* Hoehen-Sperrklinke, Hausform wie scripts/lib/metrics-baseline.mjs: Wert,
   Regel (wandert NUR nach unten, docs/maschinelle-validierung.md
   Grundsatz 5), und ein Anlass mit Messlauf, Datum, Messbreite, Farbmodus
   und dem gemessenen Ist-Wert. Eine Anhebung von `wert` braucht einen
   eigenen Commit, dessen Botschaft die Ursache nennt — kein stilles
   Nachgeben, wenn ein spaeterer Umbau die Seite wieder waechst. */
const HOEHEN_KLINKE_CARRACK_DUNKEL_1280 = {
  wert: 4200,
  regel: 'max', // wandert nur nach unten
  anlass:
    'Schlussmessung 18.08.2026 (14-04-PLAN.md Task 2) gegen den nach Welle 4 gebauten dist/ dieses Worktrees — Carrack, DE, 1280x720, dunkler Modus, node scripts/probes/schiffskarte-messung.mjs --base http://localhost:4322: gemessener Ist-Wert 4.179px (Ausgang 5.554px aus 14-CONTEXT.md, -1.375px / -24,8%). EN misst 4.117px am selben Lauf. Die Klinke bleibt bei den in Erfolgskriterium 6 festgeschriebenen 4.200px stehen (nicht auf 4.179px abgesenkt) — 21px Reserve gegen Rundungsschwankungen zwischen zwei Laeufen desselben Standes, siehe Grundsatz 5: eine Klinke ist eine Untergrenze fuer KUENFTIGE Läufe, kein exakter Momentwert des heutigen. ' +
    'NACHGEMESSEN 20.08.2026 (16-05-PLAN.md Task 2, Fall 1 der Drei-Faelle-Regel) gegen den nach der Konsole gebauten dist/ dieses Worktrees, node scripts/probes/schiffskarte-messung.mjs --base http://localhost:4399: EN 3.609px, DE 3.641px — deutlich UNTER der Marke, obwohl document.documentElement.scrollHeight weiterhin die volle Seitenhoehe misst (Rail/Buehne/Auslesung, dann die drei verbliebenen ch-gear-Unterabschnitte). Grund: die Konsole ersetzt Bewaffnung/Komponenten als hohe, gestapelte Kapitelinhalte durch ein KOMPAKTES Drei-Spalten-Band (.holo__wrap clamp(380px,50vh,450px) bei 1280x720, gegen die vormalige Einspalten-Hero-Klammer clamp(540px,74vh,760px)) — die Rail-/Auslesung-Spalten wachsen NICHT additiv zur Seitenhoehe, weil sie GRID-SPALTEN sind, keine gestapelten Bloecke. Fall 1 der Drei-Faelle-Regel (Grundsatz 5): die Marke bleibt bei 4.200px stehen, nicht abgesenkt — obwohl sie messbar nicht mehr ausgereizt wird, ist eine Klinke eine Untergrenze fuer KUENFTIGE Laeufe, kein Momentwert des heutigen.',
};
const HOEHEN_MARKE_CARRACK_DUNKEL_1280 = HOEHEN_KLINKE_CARRACK_DUNKEL_1280.wert;
const KONTRAST_MARKE = 4.5;
const LAENGSTE_PILLE_DE = 'Ausstattung'; // 11 Zeichen, laut UI-SPEC Punkt 1 der Referenzfall fuer Umbruch/Ueberlauf

/* ---------- Hellmodus setzen (Bauform + Kniffe wie mining-locview-messung.mjs):
   Wahl ist Admin-only, addInitScript trifft den leeren Ursprung -> laden,
   setzen, neu laden, dann data-theme direkt gegenpruefen. ---------- */
async function farbmodusSetzen(page, schema) {
  if (schema === 'dark') return null;
  await page.evaluate(() => {
    sessionStorage.setItem('vb_user_role', '{"role":"admin"}');
    localStorage.setItem('vb.theme', 'light');
    localStorage.setItem('vb.help.seen', '{"all":1}');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(() => (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()));
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  const ist = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  if (ist !== 'light') return `Hellmodus liess sich nicht setzen (data-theme="${ist}")`;
  return null;
}

function clipFromBox(box, minW = 1, minH = 1) {
  return {
    x: Math.max(0, box.x),
    y: Math.max(0, box.y),
    width: Math.max(minW, Math.round(box.width)),
    height: Math.max(minH, Math.round(box.height)),
  };
}

async function sampleExtremes(page, box) {
  const { default: sharp } = await import('sharp');
  const buf = await page.screenshot({ clip: clipFromBox(box) });
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  let minL = Infinity, maxL = -Infinity, minPix = null, maxPix = null;
  for (let i = 0; i < data.length; i += ch) {
    const px = { r: data[i] / 255, g: data[i + 1] / 255, b: data[i + 2] / 255 };
    const L = luminance(px);
    if (L < minL) { minL = L; minPix = px; }
    if (L > maxL) { maxL = L; maxPix = px; }
  }
  return { minPix, maxPix, ratio: contrast(minPix, maxPix) };
}

/* ---------- Lauf ---------- */
console.log(`\n=== Schiffskarten-Messsonde gegen ${BASE} ===`);
console.log(`Browser: ${BROWSER}`);
console.log(`Modus: ${BASELINE ? '--baseline (nur Bericht, kein Urteil)' : 'Tor (scharfe Marken)'}`);
console.log('Pruefschiffe (aus den Daten gewaehlt):');
for (const z of ZIELE) console.log(`  ${z.id} — "${z.name}" — ${z.grund}`);
console.log('');

const ergebnisse = [];
let gemessen = 0, fehlgeschlagen = 0;
function melde(lauf, zielId, gruppe, ok, detail, { baselineOnly = false } = {}) {
  gemessen++;
  if (!ok && !(baselineOnly && BASELINE)) fehlgeschlagen++;
  ergebnisse.push({ lauf, zielId, gruppe, ok, detail, baselineOnly });
  console.log(`  [${lauf}/${zielId}] ${gruppe}: ${ok ? 'OK' : baselineOnly && BASELINE ? 'BERICHT' : 'FEHLT'} — ${detail}`);
}

const browser = await chromium.launch({ executablePath: BROWSER, headless: !KOPF });
let navHoehe = null; // gemessener --nav-h-Wert, gruppenuebergreifend gleich

for (const ziel of ZIELE) {
  for (const sprache of SPRACHEN) {
    for (const breite of BREITEN) {
      for (const schema of FARBMODI) {
        const lauf = `${ziel.id}/${sprache.id}/${breite.id}/${schema}`;
        const kontext = await browser.newContext({
          viewport: { width: breite.breite, height: breite.hoehe },
          colorScheme: schema,
        });
        await kontext.addInitScript(() => {
          try { localStorage.setItem('vb.help.seen', JSON.stringify({ all: 1 })); } catch (e) { /* privater Modus */ }
        });
        const page = await kontext.newPage();
        const url = `${BASE}${sprache.pfad(ziel.id)}`;
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded' });
          // Webfonts (Rajdhani/Barlow/Orbitron) laden nach — ohne diese
          // Wartestelle rutscht die Seitenhoehe je nach Zeitpunkt des
          // Font-Swaps um bis zu ~150px (Zeilenumbrueche verschieben sich),
          // was Messung a) undeterministisch macht. document.fonts.ready
          // ist Standard-Web-API, kein Sonderfall.
          await page.evaluate(() => (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()));
          const err = await farbmodusSetzen(page, schema);
          if (err) throw new Error(err);
        } catch (e) {
          for (const g of ['a-seitenhoehe', 'b-sprungleiste', 'c-scroll-margin', 'd-pillen-360', 'e-umbruch', 'f-kontrast-chip', 'g-ueberlauf-360', 'h-struktur', 'i-rasterbreite-1280', 'j-konsolen-kontrast']) {
            melde(lauf, ziel.id, g, false, `Seitenaufruf fehlgeschlagen: ${e.message}`);
          }
          await page.close();
          await kontext.close();
          continue;
        }

        // (a) Seitenhoehe: Scrollmass des Wurzelelements. Sperrklinke NUR
        // fuer Carrack/1280x720/dunkel — bis zum Umbau zwangslaeufig
        // gerissen, deshalb --baseline: Bericht statt Urteil.
        try {
          const scrollH = await page.evaluate(() => document.documentElement.scrollHeight);
          const istBezugslauf = ziel.id === CARRACK_ID && breite.id === '1280x720' && schema === 'dark';
          if (istBezugslauf) {
            const passt = scrollH <= HOEHEN_MARKE_CARRACK_DUNKEL_1280;
            melde(lauf, ziel.id, 'a-seitenhoehe', passt, `${scrollH}px (Marke ${HOEHEN_MARKE_CARRACK_DUNKEL_1280}px)`, { baselineOnly: true });
          } else {
            melde(lauf, ziel.id, 'a-seitenhoehe', true, `${scrollH}px (keine Sperrklinke ausserhalb Carrack/1280x720/dunkel)`);
          }
        } catch (e) {
          melde(lauf, ziel.id, 'a-seitenhoehe', false, e.message);
        }

        // (b) Sprungleiste: vorhanden oder nicht; wenn vorhanden, Hoehe,
        // gemessener --nav-h-Wert, und ob ihre Unterkante ohne Scrollen
        // oberhalb von 720px liegt (Erfolgskriterium 3, nur bei 1280x720
        // sinnvoll geprueft).
        try {
          const jump = page.locator('.sd__jump').first();
          const vorhanden = await jump.count();
          if (!vorhanden) {
            melde(lauf, ziel.id, 'b-sprungleiste', true, 'nicht vorhanden — gibt es in dieser Welle noch nicht');
          } else {
            const box = await jump.boundingBox();
            const gemessenNavH = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || null);
            if (gemessenNavH != null) navHoehe = gemessenNavH;
            if (!box) throw new Error('.sd__jump ohne Bounding-Box');
            const unterkante = box.y + box.height;
            const ohneScrollenSichtbar = breite.id !== '1280x720' || unterkante <= breite.hoehe;
            melde(
              lauf, ziel.id, 'b-sprungleiste',
              breite.id !== '1280x720' || ohneScrollenSichtbar,
              `Hoehe ${box.height.toFixed(1)}px, --nav-h ${gemessenNavH ?? '?'}px, Unterkante bei ${unterkante.toFixed(1)}px (Fenster ${breite.hoehe}px)`
            );
          }
        } catch (e) {
          melde(lauf, ziel.id, 'b-sprungleiste', false, e.message);
        }

        // (c) scroll-margin-top-Sollwert: gemessener --nav-h + gemessene
        // Sprungleistenhoehe (UI-SPEC Punkt 1 nennt 64px als Schaetzung,
        // hier wird nachgemessen statt angenommen).
        try {
          const jump = page.locator('.sd__jump').first();
          if (!(await jump.count())) {
            melde(lauf, ziel.id, 'c-scroll-margin', true, 'Sprungleiste nicht vorhanden — kein Sollwert zu bilden');
          } else {
            const box = await jump.boundingBox();
            const gemessenNavH = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 0);
            const soll = gemessenNavH + (box ? box.height : 0);
            melde(lauf, ziel.id, 'c-scroll-margin', true, `Soll ${soll.toFixed(1)}px (--nav-h ${gemessenNavH}px + Sprungleiste ${(box ? box.height : 0).toFixed(1)}px) — UI-SPEC nennt 64px als Schaetzung`);
          }
        } catch (e) {
          melde(lauf, ziel.id, 'c-scroll-margin', false, e.message);
        }

        // (d) Sprungleiste bei 360px: Pillenzahl, Scrollbreite gegen
        // sichtbare Breite, jede Pille per Bildlauf erreichbar, und ob die
        // Bildlaufleiste des inneren Kastens am Bildpunkt sichtbar ist
        // (nicht nur im CSS) — Muster aus mining-locview-messung.mjs (e).
        if (breite.id === '360x740') {
          try {
            const inner = page.locator('.sd__jump__in').first();
            if (!(await inner.count())) {
              melde(lauf, ziel.id, 'd-pillen-360', true, 'Sprungleiste nicht vorhanden — kein Innenkasten zu pruefen');
            } else {
              const pillen = await page.locator('.sd__jump__in a').count();
              const masse = await inner.evaluate((el) => ({ scrollW: el.scrollWidth, clientW: el.clientWidth }));
              const ueberlauft = masse.scrollW > masse.clientW + 1;
              let scrollwirkung = 'kein Ueberlauf';
              if (ueberlauft) {
                const vorher = await inner.evaluate((el) => el.scrollLeft);
                await inner.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
                const nachher = await inner.evaluate((el) => el.scrollLeft);
                await inner.evaluate((el) => { el.scrollLeft = 0; });
                scrollwirkung = Math.abs(nachher - vorher) > 2 ? `scrollt wirklich (${vorher}->${nachher})` : `scrollt NICHT wirklich (${vorher}->${nachher})`;
              }
              melde(lauf, ziel.id, 'd-pillen-360', true, `${pillen} Pille(n), scrollW=${masse.scrollW} clientW=${masse.clientW}, ${scrollwirkung}`);
            }
          } catch (e) {
            melde(lauf, ziel.id, 'd-pillen-360', false, e.message);
          }
        } else {
          melde(lauf, ziel.id, 'd-pillen-360', true, 'nur bei 360px geprueft');
        }

        // (e) Umbruch: bricht eine Pille um, oder ist ihre Hoehe groesser
        // als die der uebrigen (Referenzfall DE "Ausstattung", 11 Zeichen)?
        try {
          const pills = page.locator('.sd__jump__in a, .sd__jump a');
          const n = await pills.count();
          if (!n) {
            melde(lauf, ziel.id, 'e-umbruch', true, 'Sprungleiste nicht vorhanden — kein Umbruch zu pruefen');
          } else {
            const hoehen = [];
            for (let i = 0; i < n; i++) {
              const box = await pills.nth(i).boundingBox();
              if (box) hoehen.push(box.height);
            }
            const min = Math.min(...hoehen), max = Math.max(...hoehen);
            const bricht = max - min > 1;
            melde(lauf, ziel.id, 'e-umbruch', !bricht, `${n} Pillen, Hoehen ${min.toFixed(1)}-${max.toFixed(1)}px (Referenz „${LAENGSTE_PILLE_DE}“)`);
          }
        } catch (e) {
          melde(lauf, ziel.id, 'e-umbruch', false, e.message);
        }

        // (f) Kontrast des Kapitel-Zahl-Chips (.sd__chnum) am Bildpunkt,
        // gegen 4,5:1 — kein zweites Kontrastmass, siehe Kopfkommentar.
        try {
          const chip = page.locator('.sd__chnum').first();
          if (!(await chip.count())) {
            melde(lauf, ziel.id, 'f-kontrast-chip', true, 'nicht vorhanden — gibt es in dieser Welle noch nicht');
          } else {
            // Das Kapitel liegt bei 1280x720 unterhalb des Falzes (y ~778px
            // bei 720px Fensterhoehe) — page.screenshot({clip}) akzeptiert
            // NUR den sichtbaren Ausschnitt, ein Clip ausserhalb wirft
            // "Clipped area is either empty or outside the resulting image".
            // Erst ins Bild scrollen, dann die Box NEU lesen (scrollIntoView
            // aendert die Seitenkoordinaten).
            await chip.scrollIntoViewIfNeeded();
            const box = await chip.boundingBox();
            if (!box) throw new Error('.sd__chnum ohne Bounding-Box');
            const ext = await sampleExtremes(page, box);
            melde(lauf, ziel.id, 'f-kontrast-chip', ext.ratio >= KONTRAST_MARKE, `${ext.ratio.toFixed(2)}:1 (Marke ${KONTRAST_MARKE}:1)`);
          }
        } catch (e) {
          melde(lauf, ziel.id, 'f-kontrast-chip', false, e.message);
        }

        // (g) Waagerechter Ueberlauf bei 360px: Scrollbreite des
        // Wurzelelements gegen seine sichtbare Breite. Soll: kein Ueberlauf.
        if (breite.id === '360x740') {
          try {
            const masse = await page.evaluate(() => ({ scrollW: document.body.scrollWidth, clientW: document.documentElement.clientWidth }));
            const ok2 = masse.scrollW <= masse.clientW + 1;
            melde(lauf, ziel.id, 'g-ueberlauf-360', ok2, `body.scrollWidth=${masse.scrollW} vs clientWidth=${masse.clientW}`);
          } catch (e) {
            melde(lauf, ziel.id, 'g-ueberlauf-360', false, e.message);
          }
        } else {
          melde(lauf, ziel.id, 'g-ueberlauf-360', true, 'nur bei 360px geprueft');
        }

        // (h) Struktur: Zahl der Kapitel und Pillen — Gegenprobe zum Tor,
        // am lebenden Dokument statt am HTML-Text gemessen. Zusaetzlich der
        // messbare Teil von Backstop E4 (14-04-PLAN.md Task 2): Zahl der
        // Perzentilzeilen und Kapitelhoehe des Leistungsprofils, am kargsten
        // und groessten Pruefschiff steht das direkt im Beleg.
        try {
          const kapitel = await page.locator('.sd__chapter').count();
          const pillenGesamt = await page.locator('.sd__jump a').count();
          const profilZeilen = await page.locator('#ch-profile .sd__profrow').count();
          const profilHoehe = await page.locator('#ch-profile').count()
            ? (await page.locator('#ch-profile').boundingBox())?.height ?? null
            : null;
          melde(lauf, ziel.id, 'h-struktur', true, `${kapitel} Kapitel, ${pillenGesamt} Pille(n), Leistungsprofil: ${profilZeilen} Perzentilzeile(n)${profilHoehe != null ? `, Kapitelhoehe ${profilHoehe.toFixed(1)}px` : ' (Kapitel nicht vorhanden)'}`);
        } catch (e) {
          melde(lauf, ziel.id, 'h-struktur', false, e.message);
        }

        // (i) Backstop E2 (14-04-PLAN.md Task 2, nur bei 1280x720): kein
        // Kapitel ueberschreitet die lokale Hoechstbreite (var(--maxw) =
        // 1100px), und innerhalb der kapitelinternen Zweispaltigkeit
        // (.sd__ch2col) ueberschreitet kein Innenraster die rechte Kante
        // seines Kapitels. Gemessen am Bildpunkt (getBoundingClientRect),
        // nicht am CSS-Wert — derselbe Grund wie bei allen anderen Gruppen.
        if (breite.id === '1280x720') {
          try {
            const raster = await page.evaluate(() => {
              const KAPITEL_MAX = 1100;
              const kandidaten = ['.sd__dims', '.sd__grid', '.arm__sum', '.arm__list', '.sd__slots', '.sd__inscards', '.sd__paints', '.sd__reflist', '.sd__qgrid', '.sd__ch2col'];
              const chapters = Array.from(document.querySelectorAll('.sd__chapter'));
              let schmalster = Infinity;
              const befunde = [];
              for (const ch of chapters) {
                const cb = ch.getBoundingClientRect();
                const spielKapitel = KAPITEL_MAX - cb.width;
                if (spielKapitel < schmalster) schmalster = spielKapitel;
                if (spielKapitel < -1) befunde.push(`${ch.id || '(ohne id)'}: Kapitelbreite ${cb.width.toFixed(1)}px > ${KAPITEL_MAX}px`);
                for (const sel of kandidaten) {
                  ch.querySelectorAll(sel).forEach((el) => {
                    const eb = el.getBoundingClientRect();
                    const spielInner = cb.right - eb.right;
                    if (spielInner < schmalster) schmalster = spielInner;
                    if (spielInner < -1) befunde.push(`${ch.id || '(ohne id)'} ${sel}: ${eb.right.toFixed(1)}px rechts vom Kapitelrand ${cb.right.toFixed(1)}px`);
                  });
                }
              }
              return { schmalster, befunde };
            });
            const ok3 = raster.befunde.length === 0;
            melde(lauf, ziel.id, 'i-rasterbreite-1280', ok3, `schmalster Spielraum ${raster.schmalster === Infinity ? 'n/a' : raster.schmalster.toFixed(1)}px${ok3 ? '' : ' — ' + raster.befunde.join(' | ')}`);
          } catch (e) {
            melde(lauf, ziel.id, 'i-rasterbreite-1280', false, e.message);
          }
        } else {
          melde(lauf, ziel.id, 'i-rasterbreite-1280', true, 'nur bei 1280x720 geprueft');
        }

        // (j) Konsolen-Kontrast (16-05-PLAN.md Task 2, Erfolgskriterium 7 —
        // "beide Farbmodi sind gemessen"): dieselbe contrast()-Bibliothek
        // wie Gruppe f, hier auf zwei Konsolen-Stellen angewendet, die
        // Gruppe f (Kapitel-Zahl-Chip) nicht abdeckt — die Rail-Zaehlzeile
        // (.holo__rail-ct, Farbe je System per --gc) und die "Augenbraue"
        // der Auslesung (.holo__sys-h, dieselbe --gc-Logik, Kopfzeile ueber
        // der Gruppen-/Einzelansicht). Beide existieren erst ab Welle 3/4 —
        // vorher wird das als "nicht vorhanden" gemeldet wie bei Gruppe f.
        try {
          const railCt = page.locator('.holo__rail-ct').first();
          const sysH = page.locator('.holo__readout .holo__sys-h, .holo__sys-h').first();
          const railVorhanden = await railCt.count();
          const sysHVorhanden = await sysH.count();
          if (!railVorhanden && !sysHVorhanden) {
            melde(lauf, ziel.id, 'j-konsolen-kontrast', true, 'nicht vorhanden — gibt es in dieser Welle noch nicht');
          } else {
            const teile = [];
            let alleOk = true;
            if (railVorhanden) {
              await railCt.scrollIntoViewIfNeeded();
              const box = await railCt.boundingBox();
              if (box) {
                const ext = await sampleExtremes(page, box);
                const ok4 = ext.ratio >= KONTRAST_MARKE;
                if (!ok4) alleOk = false;
                teile.push(`Rail-Zaehlzeile ${ext.ratio.toFixed(2)}:1${ok4 ? '' : ' UNTER DER MARKE'}`);
              } else {
                alleOk = false;
                teile.push('Rail-Zaehlzeile ohne Bounding-Box');
              }
            }
            if (sysHVorhanden) {
              await sysH.scrollIntoViewIfNeeded();
              const box = await sysH.boundingBox();
              if (box) {
                const ext = await sampleExtremes(page, box);
                const ok5 = ext.ratio >= KONTRAST_MARKE;
                if (!ok5) alleOk = false;
                teile.push(`Auslesung-Augenbraue ${ext.ratio.toFixed(2)}:1${ok5 ? '' : ' UNTER DER MARKE'}`);
              } else {
                alleOk = false;
                teile.push('Auslesung-Augenbraue ohne Bounding-Box');
              }
            }
            melde(lauf, ziel.id, 'j-konsolen-kontrast', alleOk, `${teile.join(', ')} (Marke ${KONTRAST_MARKE}:1)`);
          }
        } catch (e) {
          melde(lauf, ziel.id, 'j-konsolen-kontrast', false, e.message);
        }

        await page.close();
        await kontext.close();
      }
    }
  }
}
await browser.close();

/* ---------- Selbstauskunft + Urteil ---------- */
const ERWARTET = ZIELE.length * SPRACHEN.length * BREITEN.length * FARBMODI.length * 10;
console.log(`\n=== Selbstauskunft ===`);
console.log(`  Schiffe: ${ZIELE.length}  Sprachen: ${SPRACHEN.length}  Breiten: ${BREITEN.length}  Farbmodi: ${FARBMODI.length}  Messgruppen je Lauf: 10`);
console.log(`  gefahrene Messpunkte: ${gemessen}  (erwartet ${ERWARTET})`);
console.log(`  bestanden: ${gemessen - fehlgeschlagen}  fehlgeschlagen: ${fehlgeschlagen}`);
console.log(`  gemessener --nav-h (site-weit, zuletzt gesehener Wert): ${navHoehe ?? '?'}px`);

if (gemessen !== ERWARTET) {
  console.error(`\nschiffskarte-messung: ${ERWARTET - gemessen} Messpunkt(e) uebersprungen statt gefahren — das ist ein Fehlschlag, kein Nichts.\n`);
  process.exitCode = 1;
}
if (fehlgeschlagen) {
  console.error(`\nschiffskarte-messung: ${fehlgeschlagen} FEHLGESCHLAGENE Messung(en):\n`);
  for (const r of ergebnisse) if (!r.ok && !(r.baselineOnly && BASELINE)) console.error(`  · [${r.lauf}/${r.zielId}] ${r.gruppe}: ${r.detail}`);
  console.error('');
  process.exitCode = 1;
}
if (!process.exitCode) console.log('\nschiffskarte-messung: ALLE ZUSICHERUNGEN ERFUELLT ✓\n');
