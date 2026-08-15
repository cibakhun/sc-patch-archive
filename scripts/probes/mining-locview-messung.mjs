/* ============================================================
   mining-locview-messung.mjs — die neun offenen Zustandszusicherungen der
   Fundort-Ansicht (Phase 12, UI-SPEC "UI Considerations", 🧪 backstop) AM
   GERENDERTEN BILDPUNKT gemessen, nicht aus dem CSS-Wert geschaetzt.

   EINE SONDE, KEIN TOR: liegt in scripts/probes/, wird von keinem npm-Ziel
   gerufen und haengt an keiner Strecke der Torkette (npm run gate). Sie
   braucht einen echten, installierten Browser (playwright-core bringt
   keinen mit) — genau dieselbe Begruendung, aus der scripts/browser-
   smoke.mjs NICHT im Baucontainer laeuft (node:22-alpine hat keinen
   Browser). Ausgefuehrt von Hand gegen eine laufende Vorschau; ihr Ergebnis
   wandert in .planning/phases/12-.../12-03-SUMMARY.md.

   WARUM UEBERHAUPT: das UI-SPEC nennt die Startwerte der Spurenzeilen-
   Daempfung (62 %/65 %) AUSDRUECKLICH "kein Freigabewert" — sie muessen am
   echten Bildpunkt gegen die Marke 4,5:1 gehalten werden, in BEIDEN
   Farbmodi. `getComputedStyle()` allein reicht dafuer nicht: `.wb__row2`
   traegt selbst keine eigene, aufloesbare Hintergrundfarbe (die sichtbare
   Zeilenflaeche entsteht erst durch das Stapeln mehrerer halbtransparenter
   Glasflaechen uebereinander) — nur ein echter Bildschirmausschnitt zeigt
   die tatsaechlich zusammengesetzte Farbe.

   MESSMETHODE (Kontrast, Zusicherung a/f): kein zweites Kontrastmass neben
   scripts/lib/theme-color.mjs — dieselbe contrast()/luminance()-Formel wie
   scripts/verify-layers.mjs. Statt einer zweiten Formel fuer "wo ist der
   Hintergrund, wo ist der Text" wird der EXTREMWERT innerhalb eines eng
   zugeschnittenen Bildausschnitts genommen: die dunkelste und die hellste
   Bildpunktfarbe in diesem Ausschnitt SIND (bei einer einfarbigen Flaeche
   mit einfarbigem Text darauf) der Hintergrund und der Textkern — Kanten-
   Bildpunkte mit Kantengeglaettung liegen dazwischen und veraendern das
   Ergebnis nicht. Fuer die Dreifach-Ueberlagerung (f) reicht "messbar
   verschieden" (euklidischer Abstand im RGB-Raum), weil das UI-SPEC dort
   keine WCAG-Marke nennt, sondern nur fordert, dass sich die drei Flaechen
   ueberhaupt unterscheiden lassen.

   VIER LAEUFE (1280x720/1920x1080 x hell/dunkel) x DREI ORTE (meiste Erze,
   laengster Name, meiste Anflugpunkte, aus assets/mining-db.json selbst
   ermittelt statt fest verdrahtet — sonst veraltet die Sonde beim naechsten
   Datenlauf still) x SECHS Messgruppen (a-f) = mindestens 72 Messpunkte.

     node scripts/probes/mining-locview-messung.mjs --base http://localhost:4321
     node scripts/probes/mining-locview-messung.mjs --base http://localhost:4321 --only meiste-erze
   ============================================================ */
import { existsSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { contrast, luminance } from '../lib/theme-color.mjs';

const argv = process.argv.slice(2);
const flag = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const BASE = (flag('--base', process.env.SMOKE_BASE || 'http://localhost:4321')).replace(/\/$/, '');
const NUR = flag('--only', null);
const KOPF = argv.includes('--headed');
const PAGE_PATH = '/topics/mining.html';

/* ---------- Browser finden (Bauform wie scripts/browser-smoke.mjs) ---------- */
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

/* ---------- Zielorte aus den Spieldaten (nicht fest verdrahtet) ---------- */
function buildLocIndex() {
  const db = JSON.parse(readFileSync('assets/mining-db.json', 'utf8'));
  const idx = {};
  for (const m of db.minerals) {
    for (const l of (m.locations || [])) {
      (idx[l.location] || (idx[l.location] = [])).push({
        n: m.name, s: l.system, t: l.type, mi: l.mining, ms: l.maxShare, ch: l.chance, pt: l.points || [],
      });
    }
  }
  return idx;
}
const locIdx = buildLocIndex();
const ortsnamen = Object.keys(locIdx);
if (!ortsnamen.length) {
  console.error('assets/mining-db.json liefert keine Fundorte — Sonde kann nicht laufen.');
  process.exit(2);
}
let meisteErze = ortsnamen[0];
for (const p of ortsnamen) if (locIdx[p].length > locIdx[meisteErze].length) meisteErze = p;
let laengsterName = ortsnamen[0];
for (const p of ortsnamen) if (p.length > laengsterName.length) laengsterName = p;
let meisteAnflug = ortsnamen[0], meisteAnflugN = -1;
for (const p of ortsnamen) {
  const n = (locIdx[p][0].pt || []).length;
  if (n > meisteAnflugN) { meisteAnflugN = n; meisteAnflug = p; }
}
const ALLE_ZIELE = [
  { id: 'meiste-erze', name: meisteErze },
  { id: 'laengster-name', name: laengsterName },
  { id: 'meiste-anflugpunkte', name: meisteAnflug },
];
const ZIELE = NUR ? ALLE_ZIELE.filter((z) => z.id === NUR) : ALLE_ZIELE;
if (!ZIELE.length) {
  console.error(`Unbekanntes Ziel "${NUR}". Bekannt: ${ALLE_ZIELE.map((z) => z.id).join(', ')}`);
  process.exit(2);
}

const VARIANTEN = [
  { id: 'dunkel-1280', breite: 1280, hoehe: 720, schema: 'dark' },
  { id: 'dunkel-1920', breite: 1920, hoehe: 1080, schema: 'dark' },
  { id: 'hell-1280', breite: 1280, hoehe: 720, schema: 'light' },
  { id: 'hell-1920', breite: 1920, hoehe: 1080, schema: 'light' },
];

const KONTRAST_MARKE = 4.5;
const UNTERSCHEIDBARKEIT_MARKE = 8; // RGB-Abstand (0..441), siehe pixDist()

/* ---------- Hellmodus erzwingen (Bauform + drei Kniffe wie browser-smoke.mjs) ----------
   1. Die Wahl ist Admin-only. 2. addInitScript/localStorage.setItem VOR dem
   ersten Laden trifft den leeren Ursprung -- also: laden, setzen, NEU laden.
   3. reconcile() zieht das Theme nach kurzer Zeit an die echte Rolle zurueck
   -- direkt vor der Messung data-theme nochmal setzen UND gegenpruefen. */
async function hellmodusSetzen(page) {
  await page.evaluate(() => {
    sessionStorage.setItem('vb_user_role', '{"role":"admin"}');
    localStorage.setItem('vb.theme', 'light');
    localStorage.setItem('vb.help.seen', '{"all":1}');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  const ist = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  if (ist !== 'light') return `Hellmodus liess sich nicht setzen (data-theme="${ist}")`;
  return null;
}

function cssEsc(s) {
  return String(s).replace(/["\\]/g, '\\$&');
}

/* ---------- Pixel-Sampling ---------- */
function clipFromBox(box, minW = 1, minH = 1) {
  return {
    x: Math.max(0, box.x),
    y: Math.max(0, box.y),
    width: Math.max(minW, Math.round(box.width)),
    height: Math.max(minH, Math.round(box.height)),
  };
}

/** Durchschnittsfarbe eines Ausschnitts -- fuer Flaechen ohne Text (Kachelecke,
 *  Kachelflaeche, Nadelflaeche). */
async function sampleAverage(page, box) {
  const buf = await page.screenshot({ clip: clipFromBox(box) });
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += ch) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
  return { r: r / n / 255, g: g / n / 255, b: b / n / 255 };
}

/** Extremwerte (hellster/dunkelster Bildpunkt) eines Ausschnitts -- fuer
 *  Text-gegen-Flaeche-Kontrast: bei einer einfarbigen Flaeche mit einfarbigem
 *  Text SIND diese beiden Extreme Hintergrund und Textkern, unabhaengig davon,
 *  wo im Ausschnitt genau der Text sitzt. */
async function sampleExtremes(page, box) {
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

function pixDist(a, b) {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2) * 255;
}

/* ---------- Lauf ---------- */
console.log(`\n=== Fundort-Ansicht-Messsonde gegen ${BASE} ===`);
console.log(`Browser: ${BROWSER}`);
console.log(`Ziele: ${ZIELE.map((z) => `${z.id}="${z.name}"`).join(' · ')}\n`);

const ergebnisse = [];
let gemessen = 0, fehlgeschlagen = 0;
function melde(lauf, ortId, gruppe, ok, detail) {
  gemessen++;
  if (!ok) fehlgeschlagen++;
  ergebnisse.push({ lauf, ortId, gruppe, ok, detail });
  console.log(`  [${lauf}/${ortId}] ${gruppe}: ${ok ? 'OK' : 'FEHLT'} — ${detail}`);
}

const browser = await chromium.launch({ executablePath: BROWSER, headless: !KOPF });

for (const variante of VARIANTEN) {
  console.log(`\n──────── ${variante.id} ────────`);
  const kontext = await browser.newContext({
    viewport: { width: variante.breite, height: variante.hoehe },
    colorScheme: variante.schema,
  });
  /* Erstbesuch-Hilfe VOR dem ersten Laden wegraeumen -- OHNE diesen Schritt
     klappt assets/tool-help.js das <details class="tool-help"> bei JEDEM
     frischen Kontext (auch im Dunkelmodus) automatisch auf, seine absolut
     positionierte .tool-help__body ueberlagert dann Teile der Kachelspalte
     und faengt Klicks ab (gemessen: Playwright-Timeout beim Nadelklick fuer
     Messgruppe f, elementFromPoint traf die Hilfe-Zeile statt die Nadel).
     ⚠ Der Speicher-Schluessel ist je TOOL-ID geschluesselt
     (assets/tool-help.js Z. 56f.: `seen[id]`, id = data-tool-id="mining"),
     NICHT unter einem Sammelschluessel "all" -- browser-smoke.mjs schreibt
     dort `{"all":1}`, was fuer KEIN Werkzeug tatsaechlich `seen[id]` trifft
     und den Zweck-Abschnitt dort ebenfalls nicht schliesst; unbemerkt, weil
     dessen sechs Zusicherungen ein offenes Hilfe-Panel nicht pruefen. Fuer
     BEIDE Farbmodi noetig, nicht nur fuer hell. */
  await kontext.addInitScript(() => {
    try { localStorage.setItem('vb.help.seen', JSON.stringify({ mining: 1 })); } catch (e) { /* privater Modus */ }
  });

  // Erz-Kopf-Hoehe: ortsunabhaengige Basiszahl fuer (b), einmal je Lauf
  // gemessen (nicht je Ort neu -- #wb-orehead haengt nicht vom offenen
  // Fundort ab, ein zweiter/dritter Messwert waere derselbe).
  let oreheadHoehe = null;
  {
    const page = await kontext.newPage();
    await page.goto(BASE + PAGE_PATH, { waitUntil: 'domcontentloaded' });
    if (variante.schema === 'light') {
      const err = await hellmodusSetzen(page);
      if (err) melde(variante.id, '-', 'setup-hellmodus', false, err);
    }
    const box = await page.locator('#wb-orehead').boundingBox();
    oreheadHoehe = box ? box.height : null;
    if (oreheadHoehe == null) melde(variante.id, '-', 'setup-orehead', false, '#wb-orehead nicht sichtbar/keine Bounding-Box');
    await page.close();
  }

  for (const ziel of ZIELE) {
    const entries = locIdx[ziel.name];
    const ore = entries[0].n;
    const page = await kontext.newPage();
    const url = `${BASE}${PAGE_PATH}?mineral=${encodeURIComponent(ore)}&fundort=${encodeURIComponent(ziel.name)}`;
    const lauf = variante.id;

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      if (variante.schema === 'light') {
        const err = await hellmodusSetzen(page);
        if (err) throw new Error(err);
      }
    } catch (e) {
      // Ein fehlgeschlagener Seitenaufruf darf die restlichen sechs
      // Messgruppen nicht STILL ueberspringen -- jede zaehlt als Fehlschlag,
      // kein Nichts.
      for (const g of ['a-kontrast-spur', 'b-kopfhoehe', 'c-erste-zeile-sichtbar', 'd-zeilenhoehe-langname', 'e-bildlauf', 'f-dreifach-ueberlagerung']) {
        melde(lauf, ziel.id, g, false, `Seitenaufruf fehlgeschlagen: ${e.message}`);
      }
      await page.close();
      continue;
    }

    // (a) Kontrast der Spurenzeile: Name, Unterzeile, Prozentzahl gegen die
    // Zeilenflaeche; das Abzeichen gegen seine EIGENE Flaeche.
    try {
      const traceRow = page.locator('#wb-locview .wb__row2.is-trace').first();
      if (!(await traceRow.count())) throw new Error('keine Spurenzeile an diesem Ort gefunden');
      const teile = [];
      for (const [label, sel] of [['Name', '.p'], ['Unterzeile', '.s'], ['Prozent', 'em'], ['Abzeichen', '.wb__tag.is-trace']]) {
        const loc = traceRow.locator(sel);
        if (!(await loc.count())) throw new Error(`"${label}" nicht in der Spurenzeile gefunden`);
        const box = await loc.first().boundingBox();
        if (!box) throw new Error(`"${label}" hat keine Bounding-Box`);
        const ext = await sampleExtremes(page, box);
        teile.push(`${label} ${ext.ratio.toFixed(2)}:1`);
        if (ext.ratio < KONTRAST_MARKE) throw new Error(`${label} nur ${ext.ratio.toFixed(2)}:1 (Marke ${KONTRAST_MARKE}:1); Werte: ${teile.join(', ')}`);
      }
      melde(lauf, ziel.id, 'a-kontrast-spur', true, teile.join(', '));
    } catch (e) {
      melde(lauf, ziel.id, 'a-kontrast-spur', false, e.message);
    }

    // (b) Fundort-Kopf nicht hoeher als der Erz-Kopf.
    try {
      if (oreheadHoehe == null) throw new Error('Erz-Kopf-Basiswert fehlt (Lauf-Vorbedingung fehlgeschlagen)');
      const lochead = await page.locator('#wb-lochead').boundingBox();
      if (!lochead) throw new Error('#wb-lochead nicht sichtbar');
      const diff = lochead.height - oreheadHoehe;
      if (diff > 0.5) throw new Error(`Fundort-Kopf ${lochead.height.toFixed(1)}px > Erz-Kopf ${oreheadHoehe.toFixed(1)}px (+${diff.toFixed(1)}px)`);
      melde(lauf, ziel.id, 'b-kopfhoehe', true, `Fundort ${lochead.height.toFixed(1)}px vs Erz ${oreheadHoehe.toFixed(1)}px (Diff ${diff.toFixed(1)}px)`);
    } catch (e) {
      melde(lauf, ziel.id, 'b-kopfhoehe', false, e.message);
    }

    // (c) 1280x720: erste Erzzeile ohne Scrollen vollstaendig sichtbar --
    // bei 1920x1080 dieselbe Pruefung, dort naturgemaess unkritisch.
    try {
      const first = await page.locator('#wb-locview .wb__row2').first().boundingBox();
      if (!first) throw new Error('keine Erzzeile gefunden');
      const passt = first.y >= 0 && (first.y + first.height) <= variante.hoehe;
      if (!passt) throw new Error(`erste Zeile bei y=${first.y.toFixed(0)}..${(first.y + first.height).toFixed(0)}, Fenster ${variante.hoehe}px hoch`);
      melde(lauf, ziel.id, 'c-erste-zeile-sichtbar', true, `y=${first.y.toFixed(0)}..${(first.y + first.height).toFixed(0)} in ${variante.hoehe}px`);
    } catch (e) {
      melde(lauf, ziel.id, 'c-erste-zeile-sichtbar', false, e.message);
    }

    // (d) Spurenzeile mit dem laengsten Erznamen an DIESEM Ort: keine
    // Hoehenabweichung gegen eine gewoehnliche Zeile (kein Umbruch).
    try {
      const traceEntries = entries.filter((e) => (e.ms || 0) <= 10);
      const fullEntries = entries.filter((e) => (e.ms || 0) > 10);
      if (!traceEntries.length || !fullEntries.length) throw new Error('dieser Ort liefert nicht beide Zeilenarten (Spur + voll)');
      const longest = traceEntries.slice().sort((a, b) => b.n.length - a.n.length)[0];
      const tBox = await page.locator(`#wb-locview .wb__row2[data-ore="${cssEsc(longest.n)}"]`).boundingBox();
      const nBox = await page.locator(`#wb-locview .wb__row2[data-ore="${cssEsc(fullEntries[0].n)}"]`).boundingBox();
      if (!tBox || !nBox) throw new Error('Zeile(n) nicht gefunden');
      const diff = Math.abs(tBox.height - nBox.height);
      if (diff > 0.5) throw new Error(`Spurenzeile "${longest.n}" ${tBox.height.toFixed(1)}px != normale Zeile "${fullEntries[0].n}" ${nBox.height.toFixed(1)}px`);
      melde(lauf, ziel.id, 'd-zeilenhoehe-langname', true, `"${longest.n}" ${tBox.height.toFixed(1)}px == "${fullEntries[0].n}" ${nBox.height.toFixed(1)}px`);
    } catch (e) {
      melde(lauf, ziel.id, 'd-zeilenhoehe-langname', false, e.message);
    }

    // (e) #wb-locview scrollt tatsaechlich INNEN: ueberlaeuft der Kasten,
    // muss scrollTop den sichtbaren Inhalt wirklich verschieben.
    //
    // ⚠ NICHT ueber offsetWidth-clientWidth gemessen (erster Versuch, siehe
    // 12-03-SUMMARY.md "Deviations"): dieses Chromium rendert
    // `scrollbar-width:thin` (assets/mobile-ux.css) als echten Overlay --
    // 0px reservierte Breite trotz nachgewiesenem Ueberlauf (gemessen
    // 668===668 bei 914px Inhalt > 778px Kasten). Die Breitendifferenz ist
    // fuer DIESES Projekt kein gueltiges Signal fuer "Leiste sichtbar";
    // die tatsaechliche Scroll-WIRKUNG ist es.
    try {
      const vorher = await page.locator('#wb-locview').evaluate((el) => ({
        scrollH: el.scrollHeight, clientH: el.clientHeight,
      }));
      const ueberlauft = vorher.scrollH > vorher.clientH + 1;
      if (ueberlauft) {
        const zeileVorher = await page.locator('#wb-locview .wb__row2').first().boundingBox();
        await page.locator('#wb-locview').evaluate((el) => { el.scrollTop = 80; });
        const zeileNachher = await page.locator('#wb-locview .wb__row2').first().boundingBox();
        await page.locator('#wb-locview').evaluate((el) => { el.scrollTop = 0; });
        const verschiebung = zeileVorher && zeileNachher ? Math.abs(zeileVorher.y - zeileNachher.y) : 0;
        if (verschiebung < 10) throw new Error(`Kasten ueberlaeuft (${vorher.scrollH}px > ${vorher.clientH}px), scrollTop=80 verschob die erste Zeile aber nur um ${verschiebung.toFixed(1)}px -- scrollt vermutlich nicht wirklich innen`);
        melde(lauf, ziel.id, 'e-bildlauf', true, `ueberlaeuft (${vorher.scrollH}px > ${vorher.clientH}px), scrollTop verschiebt den Inhalt um ${verschiebung.toFixed(1)}px`);
      } else {
        melde(lauf, ziel.id, 'e-bildlauf', true, `kein Ueberlauf an diesem Ort/dieser Fenstergroesse (${vorher.scrollH}px <= ${vorher.clientH}px) -- nichts zu scrollen`);
      }
    } catch (e) {
      melde(lauf, ziel.id, 'e-bildlauf', false, e.message);
    }

    // (f) Dreifach-Ueberlagerung: Kachel des offenen Fundorts anheften, dann
    // Kachelecke (.is-here), Kachelflaeche (.is-sel-Toenung) und Nadelflaeche
    // (.wb__pin.is-on) einzeln lesen -- alle drei muessen sich messbar
    // unterscheiden lassen.
    try {
      const pinBtn = page.locator(`.wb__tile[data-min="${cssEsc(ore)}"] .wb__pin`);
      if (!(await pinBtn.count())) throw new Error('Nadelknopf der Kachel nicht gefunden');
      await pinBtn.click();
      const tile = page.locator(`.wb__tile[data-min="${cssEsc(ore)}"]`);
      const tileBox = await tile.boundingBox();
      const pinBox = await pinBtn.boundingBox();
      if (!tileBox || !pinBox) throw new Error('Kachel oder Nadel ohne Bounding-Box');
      const eckeClip = { x: tileBox.x, y: tileBox.y, width: 8, height: 8 };
      const flaecheClip = { x: tileBox.x + tileBox.width * 0.3, y: tileBox.y + tileBox.height * 0.7, width: 10, height: 10 };
      const [ecke, flaeche, nadel] = await Promise.all([
        sampleAverage(page, eckeClip),
        sampleAverage(page, flaecheClip),
        sampleAverage(page, pinBox),
      ]);
      const dEF = pixDist(ecke, flaeche), dEN = pixDist(ecke, nadel), dFN = pixDist(flaeche, nadel);
      await pinBtn.click(); // zuruecksetzen -- der Kontext dient noch weiteren Orten/Laeufen
      if (dEF < UNTERSCHEIDBARKEIT_MARKE || dEN < UNTERSCHEIDBARKEIT_MARKE || dFN < UNTERSCHEIDBARKEIT_MARKE) {
        throw new Error(`Ecke/Flaeche/Nadel zu aehnlich (Marke ${UNTERSCHEIDBARKEIT_MARKE}): Ecke-Flaeche ${dEF.toFixed(1)}, Ecke-Nadel ${dEN.toFixed(1)}, Flaeche-Nadel ${dFN.toFixed(1)}`);
      }
      melde(lauf, ziel.id, 'f-dreifach-ueberlagerung', true, `Ecke-Flaeche ${dEF.toFixed(1)}, Ecke-Nadel ${dEN.toFixed(1)}, Flaeche-Nadel ${dFN.toFixed(1)}`);
    } catch (e) {
      melde(lauf, ziel.id, 'f-dreifach-ueberlagerung', false, e.message);
    }

    await page.close();
  }
  await kontext.close();
}
await browser.close();

/* ---------- Selbstauskunft + Urteil ---------- */
const ERWARTET = VARIANTEN.length * ZIELE.length * 6;
console.log(`\n=== Selbstauskunft ===`);
console.log(`  Laeufe: ${VARIANTEN.length}  Orte: ${ZIELE.length}  Messgruppen je Lauf x Ort: 6`);
console.log(`  gefahrene Messpunkte: ${gemessen}  (erwartet ${ERWARTET})`);
console.log(`  bestanden: ${gemessen - fehlgeschlagen}  fehlgeschlagen: ${fehlgeschlagen}`);

if (gemessen !== ERWARTET) {
  console.error(`\nmining-locview-messung: ${ERWARTET - gemessen} Messpunkt(e) uebersprungen statt gefahren -- das ist ein Fehlschlag, kein Nichts.\n`);
  process.exitCode = 1;
}
if (fehlgeschlagen) {
  console.error(`\nmining-locview-messung: ${fehlgeschlagen} FEHLGESCHLAGENE Messung(en):\n`);
  for (const r of ergebnisse) if (!r.ok) console.error(`  · [${r.lauf}/${r.ortId}] ${r.gruppe}: ${r.detail}`);
  console.error('');
  process.exitCode = 1;
}
if (!process.exitCode) console.log('\nmining-locview-messung: ALLE ZUSICHERUNGEN ERFUELLT ✓\n');
