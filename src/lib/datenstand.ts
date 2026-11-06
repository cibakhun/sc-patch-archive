// Datenstand — woher die Werte einer Datenseite stammen und wie alt sie sind.
//
// Bestandsaufnahme C (06.11.2026, Freigabe Krisz „Wie empfohlen"): jede
// Seitenart zeigte Quelle und Datum anders, vier Wertegruppen standen unter
// einem falschen Etikett. Dieser Baustein vereinheitlicht nur die FORM, nie
// die Staende: jede Zeile liest ihre Kennung oder ihr Datum aus der eigenen
// Datendatei, und verify:patch-angaben [6] haelt jede Zeile im gebauten Stand
// gegen dieselbe Datei.
//
// Fuenf Zeilenarten mit festem Wortlaut:
//   spiel          „Spielversion 4.10.2"   Spielwerte. Kein Datum (die
//                                          Version IST der Stand), keine
//                                          Herkunft im Text (audit:site).
//   fremd          „UEX Corp, Stand 11. Oktober 2026"
//   hand           „von Hand gepflegt, Stand 4.10.1"
//   schnappschuss  „starcitizen.tools, Schnappschuss vom 18. Juli 2026"
//   quelle         „eigene Recherche" / „starcitizen.tools" (ohne Datum,
//                                          weil die Datei keines belegt)
//
// „Älterer Stand" steht nur nach Tatsache, nie nach Frist: wenn eine Zeile
// aus einem frueheren Patch stammt als die Spielwerte derselben Seite, oder
// wenn sie ein eingefrorener Schnappschuss ist. Eine Altersgrenze („aelter
// als 30 Tage") waere auf einer statischen Seite zwischen zwei Builds falsch
// und eine erfundene Schwelle.
//
// Nur fuer den Seitenbau (Frontmatter): die Datendateien landen sonst im
// Client-Bundle.
import type { Locale } from '../i18n/ui';
import ITEMS from '../../assets/universal-items.json';
import CRAFT from '../../assets/crafting-db.json';
import MINING from '../../assets/mining-db.json';
import FROZEN from '../../assets/mining-frozen.json';
import REFINERY from '../../assets/refinery-data.json';
import MISSIONS from '../data/missions.json';
import VEHICLES from '../data/vehicles.json';
import VEHICLE_PRICES from '../data/vehicle-prices.json';
import SHIP_EXTRAS from '../data/ship-extras.json';
import VEHICLE_EXTERNAL from '../data/vehicle-external.json';

export type StandArt = 'spiel' | 'fremd' | 'hand' | 'schnappschuss' | 'quelle';

export interface StandZeile {
  /** fester Schluessel, ueber den das Tor die Datendatei findet */
  quelle: string;
  art: StandArt;
  /** Wertegruppe, z. B. „Kaufpreise" */
  was: string;
  /** Fremdquelle mit Link (fremd, schnappschuss, quelle) */
  name?: string;
  link?: string;
  /** maschinenlesbarer Stand: Fassung X.Y.Z oder ISO-Datum */
  wert?: string;
  /** sichtbarer Text NACH dem Namen (bzw. ganz, wenn kein Name) */
  text: string;
  aelter: boolean;
}

const T = {
  de: {
    titel: 'Datenstand',
    aelter: 'älterer Stand',
    melden: 'Falschen Wert melden',
    spielversion: 'Spielversion',
    stand: 'Stand',
    hand: 'von Hand gepflegt',
    schnappschuss: 'Schnappschuss vom',
    recherche: 'eigene Recherche',
    aufbereitung: 'eigene Aufbereitung',
    spielwerte: 'Spielwerte',
    kaufpreise: 'Kaufpreise',
    fundorte: 'Fundorte',
    rezepte: 'Rezepte und Drop-Chancen',
    missionen: 'Missionsdaten',
    schiffswerte: 'Werte und Bewaffnung',
    ingamePreise: 'Ingame-Preise',
    lackierungen: 'Lackierungen',
    varianten: 'Varianten',
    leihschiffe: 'Leihschiffe',
    huelle: '3D-Hülle',
    wiki: 'Pledge-Preis, Maße, Crew, Status',
    bild: 'Bild',
    erzpreise: 'Erzpreise',
    ausbeute: 'Ausbeute je Station',
  },
  en: {
    titel: 'Data status',
    aelter: 'older data',
    melden: 'Report a wrong value',
    spielversion: 'Game version',
    stand: 'as of',
    hand: 'maintained by hand',
    schnappschuss: 'snapshot of',
    recherche: 'own research',
    aufbereitung: 'processed in-house',
    spielwerte: 'Game values',
    kaufpreise: 'Purchase prices',
    fundorte: 'Loot locations',
    rezepte: 'Recipes and drop chances',
    missionen: 'Mission data',
    schiffswerte: 'Stats and loadout',
    ingamePreise: 'In-game prices',
    lackierungen: 'paints',
    varianten: 'variants',
    leihschiffe: 'loaners',
    huelle: '3D hull',
    wiki: 'Pledge price, dimensions, crew, status',
    bild: 'Image',
    erzpreise: 'Ore prices',
    ausbeute: 'Yield per station',
  },
} as const;

export const standTexte = (lang: Locale) => T[lang];

const MONATE = {
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
} as const;

/** „2026-10-11" -> „11. Oktober 2026" (DE) / „October 11, 2026" (EN). Ohne gueltiges Datum bricht der Bau. */
export function datumLang(iso: string, lang: Locale): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  const mon = m ? MONATE[lang][Number(m[2]) - 1] : undefined;
  if (!m || !mon) throw new Error(`datenstand: kein ISO-Datum: ${JSON.stringify(iso)}`);
  const tag = Number(m[3]);
  return lang === 'de' ? `${tag}. ${mon} ${m[1]}` : `${mon} ${tag}, ${m[1]}`;
}

/** Fassung X.Y.Z aus einer Kennung („sc-alpha-4.10.2@12881860", „4.10.2-live.…"). Ohne Fassung bricht der Bau. */
export function fassung(kennung: unknown, wo: string): string {
  const m = typeof kennung === 'string' ? /(\d+\.\d+\.\d+)/.exec(kennung) : null;
  if (!m) throw new Error(`datenstand: ${wo} traegt keine Fassung X.Y.Z (${JSON.stringify(kennung)})`);
  return m[1];
}

const zahl = (f: string) => f.split('.').map(Number);
/** a < b fuer Fassungen X.Y.Z */
export function frueher(a: string, b: string): boolean {
  const [x, y] = [zahl(a), zahl(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i];
  return false;
}

const isoAus = (s: unknown, wo: string): string => {
  const m = typeof s === 'string' ? /^\d{4}-\d{2}-\d{2}/.exec(s) : null;
  if (!m) throw new Error(`datenstand: ${wo} traegt kein Datum (${JSON.stringify(s)})`);
  return m[0];
};

/* ---------- Zeilen ---------- */

function spiel(lang: Locale, quelle: string, was: string, f: string, bezug?: string): StandZeile {
  return { quelle, art: 'spiel', was, wert: f, text: `${T[lang].spielversion} ${f}`, aelter: !!bezug && frueher(f, bezug) };
}
function fremd(lang: Locale, quelle: string, was: string, name: string, link: string, iso: string): StandZeile {
  return { quelle, art: 'fremd', was, name, link, wert: iso, text: `, ${T[lang].stand} ${datumLang(iso, lang)}`, aelter: false };
}
function hand(lang: Locale, quelle: string, was: string, f: string, bezug: string): StandZeile {
  return { quelle, art: 'hand', was, wert: f, text: `${T[lang].hand}, ${T[lang].stand} ${f}`, aelter: frueher(f, bezug) };
}

/* ---------- Staende aus den Datendateien ---------- */

const ITEM_F = fassung((ITEMS as { gameVersion?: string }).gameVersion, 'assets/universal-items.json gameVersion');
const ITEM_PREISE = isoAus((ITEMS as { pricesAsOf?: string }).pricesAsOf, 'assets/universal-items.json pricesAsOf');
const CRAFT_F = fassung((CRAFT as { version?: string }).version, 'assets/crafting-db.json version');
const MISSION_F = fassung((MISSIONS as { meta?: { patch?: string } }).meta?.patch, 'src/data/missions.json meta.patch');
const FAHRZEUG_F = fassung((VEHICLES as { gameVersion?: string }).gameVersion, 'src/data/vehicles.json gameVersion');
const SCHIFF_PREISE = isoAus((VEHICLE_PRICES as { fetchedAt?: string }).fetchedAt, 'src/data/vehicle-prices.json fetchedAt');
const EXTRAS_DATUM = isoAus((SHIP_EXTRAS as { fetchedAt?: string }).fetchedAt, 'src/data/ship-extras.json fetchedAt');
const WIKI_DATUM = isoAus(/fetchedAt (\d{4}-\d{2}-\d{2})/.exec((VEHICLE_EXTERNAL as { source?: string }).source ?? '')?.[1], 'src/data/vehicle-external.json source (fetchedAt)');
const MINING_F = fassung((MINING as { game_version?: string }).game_version, 'assets/mining-db.json game_version');
const AUSBEUTE_F = fassung((FROZEN as { frozen_from?: string }).frozen_from, 'assets/mining-frozen.json frozen_from');
const REFINERY_F = fassung((REFINERY as { meta?: { gameVersion?: string } }).meta?.gameVersion, 'assets/refinery-data.json meta.gameVersion');
const ERZ_PREISE = isoAus((REFINERY as { meta?: { priceDate?: string } }).meta?.priceDate, 'assets/refinery-data.json meta.priceDate');

/** Fassungen und Daten fuer Stellen ausserhalb des Bausteins (Kennzahlen im Kopf, Einleitungen). */
export const STAND = { items: ITEM_F, itemPreise: ITEM_PREISE, crafting: CRAFT_F } as const;

const UEX = { name: 'UEX Corp', link: 'https://uexcorp.space' };

/** Item-Datenblatt, Item-Listen, Rüstungs-Sets. `preise`: die Seite zeigt Kaufpreise; `fundorte`: sie zeigt Loot-Fundorte. */
export function standItems(lang: Locale, o: { preise: boolean; fundorte: boolean }): StandZeile[] {
  const t = T[lang];
  const z = [spiel(lang, 'items', t.spielwerte, ITEM_F)];
  if (o.preise) z.push(fremd(lang, 'uex-items', t.kaufpreise, UEX.name, UEX.link, ITEM_PREISE));
  if (o.fundorte) z.push({ quelle: 'fundorte', art: 'quelle', was: t.fundorte, text: t.recherche, aelter: false });
  return z;
}

/** Blueprint-Seiten, Blueprint-Listen und -Übersicht. */
export function standCrafting(lang: Locale): StandZeile[] {
  return [spiel(lang, 'crafting', T[lang].rezepte, CRAFT_F)];
}

/** Missionsseiten. */
export function standMission(lang: Locale): StandZeile[] {
  return [spiel(lang, 'missionen', T[lang].missionen, MISSION_F)];
}

/**
 * Schiffsseite. `kennung` ist der Stempel DES Datensatzes (ATLS: 4.9.0, gegen
 * den Kopf 4.10.2 also älterer Stand). `fleetyards`: was die Seite von dort
 * zeigt; `wiki`: Pledge/Maße/Crew/Status aus dem Schnappschuss; `bild`: Quelle
 * des Kopfbilds.
 * `huelle`: woher die 3D-Hülle stammt, die die Seite zeigt. 'eigen' ist das
 * eigene Hüllenmodell (holoData), es hat Vorrang; nur ohne es zeigt die Seite
 * die Hülle von FleetYards (extras.holo). Bis zur Review-Korrektur stand
 * FleetYards auch dort, wo die Seite gar nicht dessen Hülle zeigte.
 */
export function standSchiff(
  lang: Locale,
  o: { kennung: string | null | undefined; lackierungen: boolean; varianten: boolean; leihschiffe: boolean; huelle: 'eigen' | 'fleetyards' | null; wiki: boolean; bild: string | null },
): StandZeile[] {
  const t = T[lang];
  const z = [spiel(lang, 'fahrzeug', t.schiffswerte, fassung(o.kennung, 'Fahrzeug-Datensatz gameVersion'), FAHRZEUG_F)];
  z.push(fremd(lang, 'uex-schiffe', t.ingamePreise, UEX.name, UEX.link, SCHIFF_PREISE));
  if (o.huelle === 'eigen') z.push({ quelle: 'huelle', art: 'quelle', was: t.huelle, text: t.aufbereitung, aelter: false });
  const teile = [
    o.lackierungen && t.lackierungen, o.varianten && t.varianten, o.leihschiffe && t.leihschiffe, o.huelle === 'fleetyards' && t.huelle,
  ].filter((x): x is NonNullable<typeof x> => !!x) as string[];
  if (teile.length) {
    const was = teile.join(', ');
    z.push(fremd(lang, 'fleetyards', was.charAt(0).toUpperCase() + was.slice(1), 'FleetYards', 'https://fleetyards.net', EXTRAS_DATUM));
  }
  if (o.wiki) {
    z.push({
      quelle: 'wiki', art: 'schnappschuss', was: t.wiki, name: 'starcitizen.tools', link: 'https://starcitizen.tools',
      wert: WIKI_DATUM, text: `, ${t.schnappschuss} ${datumLang(WIKI_DATUM, lang)}`, aelter: true,
    });
  }
  if (o.bild) z.push({ quelle: 'bild', art: 'quelle', was: t.bild, text: o.bild, aelter: false });
  return z;
}

/** Refinery (Wissensteil). */
export function standRefinery(lang: Locale): StandZeile[] {
  const t = T[lang];
  return [
    spiel(lang, 'refinery', t.spielwerte, REFINERY_F),
    fremd(lang, 'uex-erze', t.erzpreise, UEX.name, UEX.link, ERZ_PREISE),
    hand(lang, 'ausbeute', t.ausbeute, AUSBEUTE_F, REFINERY_F),
  ];
}

/** Mining-Datenbank. */
export function standMining(lang: Locale): StandZeile[] {
  const t = T[lang];
  return [spiel(lang, 'mining', t.spielwerte, MINING_F), hand(lang, 'ausbeute', t.ausbeute, AUSBEUTE_F, MINING_F)];
}
