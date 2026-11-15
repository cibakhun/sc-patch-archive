// Wandelt die offiziellen RSI-Bilder für die Patchseite 4.10.3 in Repo-Assets um.
// Aufruf: node scripts/patch-4-10-3-rsi-bilder.mjs --roh <Ordner mit den Originalen>
// Schreibt assets/patch-4-10-3/rsi/*, assets/patch-4-10-3/HERKUNFT.md
// und src/data/patch-4-10-3/bilder-rsi.json. Läuft beliebig oft; Ergebnis hängt nur
// von Liste und Rohdateien ab.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUS_DIR = path.join(WURZEL, 'assets', 'patch-4-10-3', 'rsi');
const HERKUNFT = path.join(WURZEL, 'assets', 'patch-4-10-3', 'HERKUNFT.md');
const MANIFEST = path.join(WURZEL, 'src', 'data', 'patch-4-10-3', 'bilder-rsi.json');
const URL_PRAEFIX = '/assets/patch-4-10-3/rsi/';

const BREITEN = [1920, 1200, 640];
const WEBP_Q = 82;
const AVIF_Q = 52;
const AVIF_MAX_ANTEIL = 0.8; // AVIF nur, wenn höchstens 80 % der WebP-Größe
const BUDGET_KB = 4500;
const ABGERUFEN = '2026-11-15';

const MEDIA = 'https://media.robertsspaceindustries.com';
const CL = 'https://robertsspaceindustries.com/en/comm-link/transmission';

// hero: true => zusätzlich AVIF in 1920
const BILDER = [
  { key: 'iae-2956-halle', roh: 'cl-twitch.jpg', thema: 'iae-2956', hero: true,
    quelle: `${CL}/21434-Twitch-Drops-IAE-2956`,
    de: 'Raumfahrer im orange-blauen Anzug vor einem beleuchteten Torbogen mit dem IAE-2956-Logo',
    en: 'Spacefarer in an orange and blue suit in front of a lit archway with the IAE 2956 logo' },
  { key: 'iae-2956-stadt', roh: 'cl-patchnotes.jpg', thema: 'iae-2956',
    quelle: 'https://robertsspaceindustries.com/en/comm-link/Patch-Notes/21429-Star-Citizen-Alpha-4103',
    de: 'Mehrere Raumschiffe fliegen bei Nacht durch eine Hochhausstadt, im Hintergrund das IAE-2956-Zeichen',
    en: 'Several spaceships flying through a skyscraper city at night with the IAE 2956 emblem behind them' },
  { key: 'iae-2956-logo', roh: 'cl-iae-schedule.jpg', thema: 'iae-2956',
    quelle: `${CL}/21386-Intergalactic-Aerospace-Expo-2956-Free-Fly-And-Manufacturer-Schedule`,
    de: 'IAE-2956-Logo vor dunkelblauen, geschwungenen Lichtbahnen',
    en: 'IAE 2956 logo against dark blue sweeping light streaks' },

  { key: 'vanduul-angriff', roh: 'cl-vanduul.jpg', thema: 'vanduul-incursion', hero: true,
    quelle: `${CL}/21420-Star-Citizen-Alpha-4103-Vanduul-Incursion`,
    de: 'Vanduul-Kriegsschiff mit zackigem Rumpf feuert in einem Asteroidenfeld rote Strahlen auf kleinere Schiffe',
    en: 'Vanduul warship with a spiked hull firing red beams at smaller ships in an asteroid field' },
  { key: 'vncl-scythe', roh: 'ship-scythe.jpg', thema: 'vncl-scythe',
    quelle: `${MEDIA}/kysobeqkurqyd/source.jpg`,
    de: 'Vanduul Scythe mit ausladenden Flügeln vor einem rötlichen Planeten, Triebwerk glüht',
    en: 'Vanduul Scythe with sweeping wings in front of a reddish planet, engine glowing' },
  { key: 'vncl-glaive', roh: 'ship-glaive.jpg', thema: 'vncl-glaive',
    quelle: `${MEDIA}/msy0lud5dd4eg/source.jpg`,
    de: 'Rotes, gebogenes Vanduul-Schiff Glaive feuert mit hellen Triebwerksflammen vor schwarzem Hintergrund',
    en: 'Red curved Vanduul Glaive firing with bright engine flares against a black backdrop' },
  { key: 'vncl-blade', roh: 'ship-blade.png', thema: 'vncl-blade',
    quelle: `${MEDIA}/0s9bslimticmx/source.png`,
    de: 'Dunkles Vanduul-Schiff Blade steht nachts im Nebel auf dem Boden',
    en: 'Dark Vanduul Blade resting on the ground in night fog' },
  { key: 'vncl-stinger', roh: 'ship-stinger.jpg', thema: 'vncl-stinger',
    quelle: `${MEDIA}/90r0njd8ob87b/source.jpg`,
    de: 'Vanduul Stinger im Angriffsflug unter bewölktem Himmel, andere Jäger im Hintergrund',
    en: 'Vanduul Stinger in an attack run under a cloudy sky with other fighters behind it' },

  { key: 'rsi-galaxy', roh: 'ship-galaxy.jpg', thema: 'rsi-galaxy', hero: true,
    quelle: `${MEDIA}/bb6z60h2ou5a0/source.jpg`,
    de: 'RSI Galaxy, ein großes dunkles Modulschiff mit blauen Akzenten, im Flug über Wolken',
    en: 'RSI Galaxy, a large dark modular ship with blue accents, flying above clouds' },
  { key: 'rsi-galaxy-flug', roh: 'cl-galaxy-old.jpg', thema: 'rsi-galaxy',
    quelle: `${CL}/18836-RSI-Galaxy`,
    de: 'RSI Galaxy schräg von vorn im schnellen Flug, Triebwerksspuren und Wolkenschleier',
    en: 'RSI Galaxy seen at an angle in fast flight with engine trails and cloud streaks' },
  { key: 'anvl-liberator', roh: 'ship-liberator.png', thema: 'anvl-liberator',
    quelle: `${MEDIA}/k2zu1md2ulfxn/source.png`,
    de: 'Anvil Liberator mit großen Doppeltriebwerken auf einem Flugfeld, kleine Schiffe fliegen dahinter',
    en: 'Anvil Liberator with large twin engines on an airfield, smaller ships flying behind it' },

  { key: 'aegs-tiburon', roh: 'ship-tiburon.jpg', thema: 'aegs-tiburon',
    quelle: `${MEDIA}/yqgidk6parmtz/source.jpg`,
    de: 'Aegis Tiburon feuert in einem grünlichen Asteroidenfeld',
    en: 'Aegis Tiburon firing in a greenish asteroid field' },
  { key: 'misc-starlite', roh: 'ship-starlite.jpg', thema: 'misc-starlite',
    quelle: `${MEDIA}/6cdv5u7nvigrn/source.jpg`,
    de: 'MISC Starlite, ein silbergraues Schiff, steht nachts zwischen Palmen am Boden',
    en: 'MISC Starlite, a silver-grey ship, resting on the ground at night among palms' },
  { key: 'drak-ironclad', roh: 'ship-ironclad.jpg', thema: 'drak-ironclad',
    quelle: `${MEDIA}/g948zfjuiznu4/source.jpg`,
    de: 'Drake Ironclad, ein gepanzertes Frachtschiff, fliegt an einem Planeten vorbei',
    en: 'Drake Ironclad, an armored freighter, flying past a planet' },
  { key: 'drak-ironclad-assault', roh: 'ship-ironclad-assault.jpg', thema: 'drak-ironclad-assault',
    quelle: `${MEDIA}/llaw71tcvmgmy/source.jpg`,
    de: 'Drake Ironclad Assault von unten mit gelbem Rumpf und Bewaffnung, Rauch im Hintergrund',
    en: 'Drake Ironclad Assault seen from below with a yellow hull and weapons, smoke behind it' },
  { key: 'drak-pitbull', roh: 'ship-pitbull.jpg', thema: 'drak-pitbull',
    quelle: `${MEDIA}/9jazkmawt8ggi/source.jpg`,
    de: 'Drake Pitbull fliegt mit Triebwerksflammen durch einen großen Industrieschacht',
    en: 'Drake Pitbull flying with engine flares through a large industrial shaft' },
  { key: 'glsn-basher', roh: 'ship-basher.jpg', thema: 'glsn-basher',
    quelle: `${MEDIA}/h84m7m1hw0dcq/source.jpg`,
    de: 'Grey\'s Basher kippt in einer Wüste durch eine Staubwolke, weitere Renner dahinter',
    en: 'Grey\'s Basher tilting through a dust cloud in a desert with more racers behind it' },
  { key: 'orig-m80', roh: 'ship-m80.jpg', thema: 'orig-m80',
    quelle: `${MEDIA}/nledgsyyzmjov/source.jpg`,
    de: 'Origin M80, ein schlankes helles Schiff, fliegt in der Abenddämmerung über Berge',
    en: 'Origin M80, a sleek light-coloured ship, flying over mountains at dusk' },
  { key: 'gama-tyilui', roh: 'ship-tyilui.jpg', thema: 'gama-tyilui',
    quelle: `${MEDIA}/fojrwsximct23/source.jpg`,
    de: 'Gatac Tyilui mit zwei langen Flügeln fliegt über einer roten Planetenoberfläche',
    en: 'Gatac Tyilui with two long wings flying over a red planet surface' },
];

const args = process.argv.slice(2);
const i = args.indexOf('--roh');
if (i < 0 || !args[i + 1]) {
  console.error('Aufruf: node scripts/patch-4-10-3-rsi-bilder.mjs --roh <Ordner>');
  process.exit(2);
}
const ROH = path.resolve(args[i + 1]);

const keys = BILDER.map((b) => b.key);
if (new Set(keys).size !== keys.length) throw new Error('Doppelte key in der Liste');

fs.mkdirSync(AUS_DIR, { recursive: true });
fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
for (const f of fs.readdirSync(AUS_DIR)) fs.rmSync(path.join(AUS_DIR, f));

const kb = (n) => Math.round(n / 1024);
const manifest = { bilder: [] };
const zeilen = [];
let gesamt = 0;

for (const b of BILDER) {
  const rohPfad = path.join(ROH, b.roh);
  if (!fs.existsSync(rohPfad)) throw new Error(`Rohdatei fehlt: ${rohPfad}`);
  const quellBreite = (await sharp(rohPfad).metadata()).width;
  const groessen = [];
  for (const w of BREITEN) {
    if (w > quellBreite) continue;
    const pipe = () => sharp(rohPfad).resize({ width: w, withoutEnlargement: true });
    const webpName = `${b.key}-${w}.webp`;
    const webp = await pipe().webp({ quality: WEBP_Q, effort: 5 }).toBuffer({ resolveWithObject: true });
    fs.writeFileSync(path.join(AUS_DIR, webpName), webp.data);
    gesamt += webp.data.length;
    zeilen.push({ datei: webpName, b, w, bytes: webp.data.length });
    const g = { w: webp.info.width, h: webp.info.height, src: URL_PRAEFIX + webpName };
    if (w === 1920 && b.hero) {
      const avif = await pipe().avif({ quality: AVIF_Q, effort: 4 }).toBuffer();
      if (avif.length <= webp.data.length * AVIF_MAX_ANTEIL) {
        const avifName = `${b.key}-${w}.avif`;
        fs.writeFileSync(path.join(AUS_DIR, avifName), avif);
        gesamt += avif.length;
        zeilen.push({ datei: avifName, b, w, bytes: avif.length });
        g.avif = URL_PRAEFIX + avifName;
      }
    }
    groessen.push(g);
  }
  if (!groessen.length) throw new Error(`Keine Größe für ${b.key} (Quelle ${quellBreite}px)`);
  groessen.sort((x, y) => y.w - x.w);
  manifest.bilder.push({
    key: b.key, art: 'rsi', thema: b.thema,
    alt: { de: b.de, en: b.en },
    quelle: b.quelle, abgerufen: ABGERUFEN, groessen,
  });
}

fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

const md = [
  '# Herkunft der RSI-Bilder (Patchseite 4.10.3)',
  '',
  'Offizielles Bildmaterial von robertsspaceindustries.com bzw. media.robertsspaceindustries.com, mit Erlaubnis des Seitenbetreibers genutzt. Erzeugt von `scripts/patch-4-10-3-rsi-bilder.mjs`. Bei Comm-Link-Bildern ist die Comm-Link-Seite angegeben, bei Schiffsbildern die Originaldatei auf dem RSI-Medienserver. Abgerufen am ' + ABGERUFEN + '.',
  '',
  ...zeilen.map((z) => `- \`${z.datei}\` | ${z.b.quelle} | ${z.b.de} | ${ABGERUFEN}`),
  '',
].join('\n');
fs.writeFileSync(HERKUNFT, md);

console.log(`${BILDER.length} Motive, ${zeilen.length} Dateien`);
for (const z of zeilen) console.log(`${String(kb(z.bytes)).padStart(5)} KB  ${z.datei}`);
console.log(`Gesamt: ${kb(gesamt)} KB (Budget ${BUDGET_KB} KB)`);
if (kb(gesamt) > BUDGET_KB) {
  console.error('Budget überschritten, Qualität oder Motivzahl senken.');
  process.exit(1);
}
