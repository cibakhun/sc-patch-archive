/**
 * cut-chassis-9slice.mjs — macht aus der Gehäuse-Vorlage einen echten
 * 9-Slice-Rahmen für `border-image`.
 *
 * WARUM DAS JETZT DOCH GEHT (in Skizze 010 war 9-Slice noch verworfen):
 * `border-image` streckt die MITTE jeder Kante. Die Vorlage hatte dort ihre
 * Zeichnung — Steckerbuchse und Lüftungsgitter unten, angewinkelte Kopfband-
 * Mitte oben, Seriennummer oben rechts, Leuchtsegmente und Gitter in den
 * Holmen. Der Betreiber hat inzwischen Titel, Vorzeile UND Seriennummer
 * gestrichen; die restlichen Zierteile werden hier mit sauberem Blech
 * übermalt. Was dann in den Streckbereichen steht, ist glattes Metall — und
 * das darf beliebig lang gezogen werden.
 *
 * Der Gewinn ist der eigentliche Punkt: mit `border-image-width` ist die
 * RAHMENSTÄRKE eine freie Zahl in Pixeln. Vorher war sie über das feste
 * Seitenverhältnis an die Breite gekettet (7,4 % je Seite = 141 px bei 1920,
 * Rückmeldung: „viel zu fett"). Jetzt sind Stärke, Größe und Höhe voneinander
 * unabhängig.
 *
 * Erzeugt:
 *   chassis-frame.webp   — Rahmen mit ausgestanzter Mitte, Zierteile entfernt
 *   chassis-plug.webp    — die Steckerbuchse als eigenes Stück (mittig unten)
 *   chassis-lamp.webp    — ein Leuchtsegment als eigenes Stück (mittig seitlich)
 *
 * Aufruf:
 *   node .planning/sketches/tools/cut-chassis-9slice.mjs <quelle> <zielordner>
 */
import { chromium } from 'playwright-core';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const CHROME = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
].filter(Boolean).find((p) => existsSync(p));
if (!CHROME) { console.error('Kein Chrome gefunden — CHROME_PATH setzen.'); process.exit(1); }

const [src, outDir] = process.argv.slice(2);
if (!src || !outDir) {
  console.error('Aufruf: node cut-chassis-9slice.mjs <quelle> <zielordner>');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
const SRC_URL = `data:image/jpeg;base64,${readFileSync(src).toString('base64')}`;

/* ---- Geometrie, eingemessen (nicht geschätzt) ----------------------------
   Bildfläche über den Blaustich des Bildschirms bestimmt (Metall ist neutral,
   der Schirm blaustichig) — das ist der einzige Weg, der nicht durch die
   dunklen Gitterblenden IM Rahmen hindurchläuft:
       links 503  rechts 2706  oben 205  unten 1063
   Gerätekanten über anhaltende Helligkeit:
       links 279  rechts 2812  oben  62  unten 1229                        */
/* ⚠⚠ RECHTS lag der Schnitt 16 px IM Geraet. Die Blende reicht bis x≈2828,
   geschnitten war bei 2812 — die fehlende Aussenkontur war die vom Betreiber
   dreimal gemeldete „abgeschnittene" Kante. Helligkeitsprofil quer ueber die
   Kante (y 300/500/700/900/1050): bis 2824 Geraetemetall in 40–95, ab 2832
   springt es auf 73–129, das ist bereits die beleuchtete Szene dahinter.
   Jetzt bis 2840 — und bewusst ein paar Pixel Szene RINGSUM: der dunkle Saum
   gibt der Blende einen natuerlichen Abschluss, statt sie hart gegen den
   Seitengrund enden zu lassen. */
const DEV = { x: 276, y: 56, w: 2564, h: 1180 };
const APT = { x: 503, y: 205, w: 2203, h: 858 };
const INSET = {
  left: APT.x - DEV.x,                       // 224
  right: DEV.x + DEV.w - (APT.x + APT.w),    // 106
  top: APT.y - DEV.y,                        // 143
  bottom: DEV.y + DEV.h - (APT.y + APT.h),   // 166
};

/* ---- Zierteile, die aus den STRECKBEREICHEN verschwinden müssen ----------
   Jeder Eintrag: eine saubere Blechfläche (`s`) wird über die Störstelle (`d`)
   gekachelt. Die Quellflächen liegen bewusst nah an der Störstelle, damit
   Verlauf und Helligkeit passen.                                          */
/* ⚠ NICHT kacheln, sondern EINE Bildspur auf die volle Länge ziehen. Der erste
   Anlauf kachelte 90-px-Flicken — im Ergebnis lief ein regelmäßiges Streifen-
   muster über Kopfband und Sockel, und im linken Holm wiederholte sich eine
   Schraffur. Eine 1 px schmale Spur, gestreckt, ist nahtlos und tut genau das,
   was `border-image` mit der Mitte ohnehin macht.
   ⚠ Die Zielflächen decken exakt die STRECKBEREICHE ab (zwischen den Ecken),
   nicht mehr: die Ecken tragen die Bolzen und die angeschrägte Kontur und
   müssen unberührt bleiben. Im ersten Anlauf endete die Kopfband-Fläche 120 px
   zu früh — genau dort stand die Seriennummer und blieb stehen. */
/* ⚠⚠ NUR die WAAGERECHTEN Balken werden glattgezogen, die HOLME NICHT.
   Nachgerechnet: der gerenderte Holm ist bei 1920 rund 826 px hoch bei 858 px
   Vorlage — Faktor 0,96, praktisch 1:1; selbst im hoechsten Fall (1180 px
   Gehaeuse) sind es 1,23. Ein Holm darf seine Zeichnung also behalten, sie
   verzerrt kaum. Die Balken dagegen werden bei 1280 auf 0,52 gestaucht — dort
   ist Glattziehen samt separater Steckerbuchse richtig.
   Das war die Ursache des zuletzt gemeldeten „gerade abgeschnitten": ich hatte
   den Holmen ihre Zeichnung genommen und sie durch ein gleichfoermiges Profil
   ersetzt, das an der Eckkachel unvermittelt anstiess. */
const HEALS = [
  // Kopfband zwischen den Ecken: angewinkelte Mitte, Bolzen, Seriennummer
  { s: [620, 62, 1, 143], d: [503, 62, 2203, 143] },
  // Sockel zwischen den Ecken: Erdungssymbol, Lüftungsgitter, Steckerbuchse
  { s: [700, 1063, 1, 166], d: [503, 1063, 2203, 166] },
  /* ⚠ Die Seriennummer ragt ueber die Streckgrenze (x 2706) hinaus IN die
     rechte obere Eckkachel — und die bleibt sonst unberuehrt. Sie braucht
     deshalb einen eigenen, eng gefassten Flicken. Die Quellspur liegt bei
     x 2600 und ist zu diesem Zeitpunkt bereits glattgezogen (die Flicken
     laufen der Reihe nach ueber DIESELBE Leinwand). */
  { s: [2600, 108, 1, 46], d: [2652, 108, 122, 46] },
];

/* ---- Stücke, die separat wieder obenauf kommen -------------------------- */
/* ⚠⚠ Der Schnitt muss das Zierteil GANZ enthalten UND glattes Blech an beiden
   Enden. Erster Anlauf: `lamp` von y 470 bis 660 — das Gitterfeld im Holm geht
   aber von rund 440 bis 810, der Schnitt lag also MITTEN darin. Sichtbar war
   danach eine harte waagerechte Kante, an der das Muster abbricht („siehst du
   wie da einfach abgeschnitten aussieht?"). Die Maske half nicht: sie blendete
   Muster gegen Muster aus. Jetzt 390–870, also das Feld samt Fassung plus rund
   50 px ruhiges Blech oben und unten — dort greift die Maske. */
const PIECES = [
  /* Symmetrisch um die Mitte der Bildflaeche ((503+2706)/2 = 1604): der erste
     Schnitt (1380–2020) erwischte nur das RECHTE Lueftungsgitter, im Original
     sitzt links eines gegenueber. */
  { name: 'plug', rect: [1174, 1063, 860, 166] },   // Buchse mit BEIDEN Gittern
  { name: 'lamp', rect: [2706, 390, 106, 480] },    // Gitterfeld im Holm + Rand
];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();

const result = await page.evaluate(async ({ url, DEV, APT, HEALS, PIECES }) => {
  const img = new Image(); img.src = url; await img.decode();

  const full = document.createElement('canvas');
  full.width = img.naturalWidth; full.height = img.naturalHeight;
  const fg = full.getContext('2d');
  fg.drawImage(img, 0, 0);

  /* Die separaten Stücke VOR dem Übermalen schneiden — danach sind sie weg. */
  const pieces = {};
  for (const { name, rect } of PIECES) {
    const c = document.createElement('canvas');
    c.width = rect[2]; c.height = rect[3];
    c.getContext('2d').drawImage(full, rect[0], rect[1], rect[2], rect[3], 0, 0, rect[2], rect[3]);
    pieces[name] = { url: c.toDataURL('image/webp', 0.92), w: rect[2], h: rect[3] };
  }

  /* Übermalen — in BEIDE Richtungen kacheln, weil die Holme senkrecht und die
     Balken waagerecht zu füllen sind. Rand weich auslaufen lassen, sonst steht
     dort eine sichtbare Naht. */
  for (const { s, d } of HEALS) {
    const patch = document.createElement('canvas');
    patch.width = d[2]; patch.height = d[3];
    const pg = patch.getContext('2d');
    pg.imageSmoothingEnabled = false;      // die Spur soll gestreckt, nicht weichgezeichnet werden
    pg.drawImage(full, s[0], s[1], s[2], s[3], 0, 0, d[2], d[3]);
    /* Kurzer Ausklang an den Stossstellen zu den Ecken.
       ⚠ Ein LANGER Ausklang (14 %) war zwischendurch drin — als Versuch, den
       Uebergang an den Holmen weicher zu machen. Er ist wieder raus, weil die
       Holme gar nicht mehr uebermalt werden UND weil er an den Balken die
       Seriennummer wieder durchscheinen liess: 14 % von 2203 px heisst, dass
       der Flicken ab x 2398 durchsichtig wird — genau dort steht sie. Wer die
       Zahl erhoeht, prueft die obere rechte Ecke nach. */
    const waagerecht = d[2] >= d[3];
    const grad = waagerecht
      ? pg.createLinearGradient(0, 0, d[2], 0)
      : pg.createLinearGradient(0, 0, 0, d[3]);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.03, 'rgba(0,0,0,1)');
    grad.addColorStop(0.97, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    pg.globalCompositeOperation = 'destination-in';
    pg.fillStyle = grad; pg.fillRect(0, 0, d[2], d[3]);
    fg.drawImage(patch, d[0], d[1]);
  }

  /* Auf das Gerät zuschneiden und die Bildfläche transparent ausstanzen —
     ohne das Loch zeichnet `border-image` mit `fill` eine gestreckte
     Metallfläche hinter den Inhalt. */
  const c = document.createElement('canvas');
  c.width = DEV.w; c.height = DEV.h;
  const g = c.getContext('2d');
  g.drawImage(full, DEV.x, DEV.y, DEV.w, DEV.h, 0, 0, DEV.w, DEV.h);
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.roundRect(APT.x - DEV.x, APT.y - DEV.y, APT.w, APT.h, 18);
  g.fill();

  return { frame: c.toDataURL('image/webp', 0.92), pieces };
}, { url: SRC_URL, DEV, APT, HEALS, PIECES });

await browser.close();

const save = (name, dataUrl) => {
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  const file = join(outDir, name);
  writeFileSync(file, buf);
  return `${name}  ${(buf.length / 1024).toFixed(0)} KB`;
};

const lines = [save('chassis-frame.webp', result.frame)];
for (const [name, p] of Object.entries(result.pieces)) {
  lines.push(save(`chassis-${name}.webp`, p.url) + `  (${p.w}x${p.h})`);
}

console.log(`
Geschrieben:
  ${lines.join('\n  ')}

Rahmen     : ${DEV.w} x ${DEV.h}
Bildflaeche: ${INSET.left} / ${INSET.top} / ${INSET.right} / ${INSET.bottom}  (l/o/r/u)

CSS — die Staerke ist jetzt FREI waehlbar (--rahmen), unabhaengig von Groesse
und Hoehe. Die Ecken werden auf diese Staerke herunterskaliert.

  .chassis {
    --rahmen: 30px;
    border-style: solid;
    border-color: transparent;
    border-image-source: url('chassis-frame.webp');
    border-image-slice: ${INSET.top} ${INSET.right} ${INSET.bottom} ${INSET.left} fill;
    border-image-width: calc(var(--rahmen) * ${(INSET.top / INSET.left).toFixed(3)})
                        calc(var(--rahmen) * ${(INSET.right / INSET.left).toFixed(3)})
                        calc(var(--rahmen) * ${(INSET.bottom / INSET.left).toFixed(3)})
                        var(--rahmen);
    border-width: calc(var(--rahmen) * ${(INSET.top / INSET.left).toFixed(3)})
                  calc(var(--rahmen) * ${(INSET.right / INSET.left).toFixed(3)})
                  calc(var(--rahmen) * ${(INSET.bottom / INSET.left).toFixed(3)})
                  var(--rahmen);
  }

⚠ 'fill' ist Pflicht — ohne das bleibt die Mittelkachel ungezeichnet.
⚠ border-image-width UND border-width setzen: das erste bestimmt, wie gross der
  Rahmen GEZEICHNET wird, das zweite, wie viel Platz er im Kasten BELEGT.
  Stimmen sie nicht ueberein, liegt die Grafik ueber dem Inhalt.
`);
