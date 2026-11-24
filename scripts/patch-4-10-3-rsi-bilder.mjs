// Wandelt die offiziellen RSI-Bilder für die Patchseite 4.10.3 in Repo-Assets um.
// Aufruf: node scripts/patch-4-10-3-rsi-bilder.mjs --roh <Ordner mit den Originalen> [--nur key,key]
// Schreibt assets/patch-4-10-3/rsi/*, assets/patch-4-10-3/HERKUNFT.md
// und src/data/patch-4-10-3/bilder-rsi.json. Läuft beliebig oft; Ergebnis hängt nur
// von Liste und Rohdateien ab.
// --nur rechnet nur die genannten Motive nach und lässt alle anderen Dateien, Manifest-Einträge
// und Herkunftszeilen stehen: so braucht ein Nachtrag nicht alle Originale.
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
const BUDGET_KB = 5200;
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

  { key: 'vanduul-angriff', roh: 'cl-vanduul.jpg', thema: 'vanduul-incursion', hero: true,
    quelle: `${CL}/21420-Star-Citizen-Alpha-4103-Vanduul-Incursion`,
    de: 'Vanduul-Kriegsschiff mit zackigem Rumpf feuert in einem Asteroidenfeld rote Strahlen auf kleinere Schiffe',
    en: 'Vanduul warship with a spiked hull firing red beams at smaller ships in an asteroid field' },

  { key: 'vncl-stinger', roh: 'ship-stinger.jpg', thema: 'vncl-stinger',
    quelle: `${MEDIA}/90r0njd8ob87b/source.jpg`,
    de: 'Vanduul-Schiffe im Angriffsflug unter bewölktem Himmel',
    en: 'Vanduul ships in an attack run under a cloudy sky' },
  { key: 'vncl-glaive', roh: 'ship-glaive.jpg', thema: 'vncl-glaive', abgerufen: '2026-11-24', seite: 'https://robertsspaceindustries.com/pledge/ships/esperia-glaive/Glaive',
    quelle: `${MEDIA}/msy0lud5dd4eg/source.jpg`,
    de: 'Vanduul-Jäger mit zwei sichelförmigen Flügeln feuert aus beiden Flügelspitzen über einem Planetenrand',
    en: 'Vanduul fighter with two sickle-shaped wings firing from both wingtips above the edge of a planet' },
  { key: 'rsi-polaris', roh: 'ship-polaris.jpg', thema: 'rsi-polaris',
    quelle: `${MEDIA}/oe0wikh6g3ltm/source.jpg`,
    de: 'RSI Polaris, eine dunkle Korvette, feuert aus mehreren Türmen zwischen Asteroiden',
    en: 'RSI Polaris, a dark corvette, firing from several turrets among asteroids' },
  { key: 'rsi-galaxy', roh: 'ship-galaxy.jpg', thema: 'rsi-galaxy', hero: true,
    quelle: `${MEDIA}/bb6z60h2ou5a0/source.jpg`,
    de: 'RSI Galaxy, ein großes dunkles Modulschiff mit blauen Akzenten, im Flug über Wolken',
    en: 'RSI Galaxy, a large dark modular ship with blue accents, flying above clouds' },
  // RSI nennt die Bilder „RSI Modular Ship Promo CargoModule IAE22“ und „… ModuleMedical IAE22“; Quelle ist die Bilddatei selbst.
  { key: 'rsi-galaxy-modul-fracht', roh: 'cargo-iae22.webp', thema: 'rsi-galaxy', abgerufen: '2026-11-23', seite: `${CL}/18836-RSI-Galaxy`,
    quelle: 'https://robertsspaceindustries.com/i/c4ab4ade2bdb585ec4ab434abefdaca4eea609db/resize(1500,643,crop(5120,2194,0,0,ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjReseBXMFmxo524s3f7ezPNoZjQNAPtsJn686))/75/rsi-modular-ship-promo-cargomodule-iae22.webp',
    de: 'Frachtmodul von innen: ein großer roter Container unter Traktorstrahlen, davor zwei Personen und Frachtkisten',
    en: 'Inside the cargo module: a large red container under tractor beams, with two people and cargo crates in front' },
  { key: 'rsi-galaxy-modul-medizin', roh: 'medical-iae22.webp', thema: 'rsi-galaxy', abgerufen: '2026-11-23', seite: `${CL}/18836-RSI-Galaxy`,
    quelle: 'https://robertsspaceindustries.com/i/b0246c4168df2c495bd6f874494dac0d5fcb89d5/resize(1500,643,crop(5119,2194,0,0,ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjResjCmt4eJEZFGekLXXzZazFc4YWgqXmg12N))/75/rsi-modular-ship-promo-modulemedical-iae22.webp',
    de: 'Medizinmodul von innen: eine helle Station mit Betten auf einer tieferen Ebene, Liegen an der Wand und eine Person an einer Trage',
    en: 'Inside the medical module: a bright ward with beds on a lower level, bunks along the wall and a person at a stretcher' },
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
const n = args.indexOf('--nur');
const NUR = n < 0 ? null : new Set((args[n + 1] ?? '').split(',').filter(Boolean));

const keys = BILDER.map((b) => b.key);
if (new Set(keys).size !== keys.length) throw new Error('Doppelte key in der Liste');
if (NUR && (!NUR.size || [...NUR].some((k) => !keys.includes(k)))) throw new Error(`--nur nennt unbekannte Motive: ${[...NUR].join(', ')}`);
const LAUF = NUR ? BILDER.filter((b) => NUR.has(b.key)) : BILDER;
const gehoertZu = (datei, key) => new RegExp(`^${key}-\\d+\\.(webp|avif)$`).test(datei);

fs.mkdirSync(AUS_DIR, { recursive: true });
fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
for (const f of fs.readdirSync(AUS_DIR)) if (!NUR || LAUF.some((b) => gehoertZu(f, b.key))) fs.rmSync(path.join(AUS_DIR, f));

const kb = (n) => Math.round(n / 1024);
const manifest = { bilder: [] };
const zeilen = [];
let gesamt = 0;

for (const b of LAUF) {
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
    quelle: b.quelle, ...(b.seite ? { seite: b.seite } : {}), abgerufen: b.abgerufen ?? ABGERUFEN, groessen,
  });
}

const zeile = (z) => `- \`${z.datei}\` | ${z.b.quelle}${z.b.seite ? ` (auf ${z.b.seite})` : ''} | ${z.b.de} | ${z.b.abgerufen ?? ABGERUFEN}`;
if (NUR) {
  const alt = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).bilder.filter((x) => !NUR.has(x.key));
  manifest.bilder = [...alt, ...manifest.bilder].sort((a, b) => keys.indexOf(a.key) - keys.indexOf(b.key));
  /* Die Herkunftsliste traegt auch Abschnitte, die andere Skripte pflegen: nur die Zeilen der Motive tauschen. */
  const md = fs.readFileSync(HERKUNFT, 'utf8').split(/\r?\n/).filter((l) => !LAUF.some((b) => l.startsWith(`- \`${b.key}-`) && gehoertZu(l.slice(3, l.indexOf('`', 3)), b.key)));
  const ende = md.findIndex((l, j) => j > 0 && l.startsWith('- `') && !md[j + 1]?.startsWith('- `'));
  md.splice(ende + 1, 0, ...zeilen.map(zeile));
  fs.writeFileSync(HERKUNFT, md.join('\n'));
} else {
  fs.writeFileSync(HERKUNFT, [
    '# Herkunft der RSI-Bilder (Patchseite 4.10.3)',
    '',
    'Offizielles Bildmaterial von robertsspaceindustries.com bzw. media.robertsspaceindustries.com, mit Erlaubnis des Seitenbetreibers genutzt. Erzeugt von `scripts/patch-4-10-3-rsi-bilder.mjs`. Bei Comm-Link-Bildern ist die Comm-Link-Seite angegeben, bei Schiffsbildern die Originaldatei auf dem RSI-Medienserver. Abgerufen am ' + ABGERUFEN + '.',
    '',
    ...zeilen.map(zeile),
    '',
  ].join('\n'));
}
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

console.log(`${LAUF.length} Motive, ${zeilen.length} Dateien`);
for (const z of zeilen) console.log(`${String(kb(z.bytes)).padStart(5)} KB  ${z.datei}`);
console.log(`Gesamt: ${kb(gesamt)} KB (Budget ${BUDGET_KB} KB)`);
if (kb(gesamt) > BUDGET_KB) {
  console.error('Budget überschritten, Qualität oder Motivzahl senken.');
  process.exit(1);
}
