/* ============================================================
   inhalt.ts — alles, was die Seite zu Alpha 4.10.3 sagt, einmal.

   Die heutige Seite (src/components/patches/sc-4-10-3.astro) und die drei
   Entwuerfe (src/components/patch-konzepte/) lesen nur hier. Was die
   Spieldaten wissen, kommt aus ihnen; der Rest ist geprueftes Redaktionsgut
   (Faktencheck 9c79ab59).

   Links tragen die Basisform des Pfads (/items/x.html); die Seite macht mit
   href(pfad, lang) daraus den Pfad ihrer Sprache. Externe Ziele beginnen mit
   https://. Jeder Wert nennt die Fassung, aus der er stammt (stand).

   Nur fuer den Seitenbau (Frontmatter): die Datendateien landen sonst im
   Client-Bundle.
   ============================================================ */
import { getCollection } from 'astro:content';
import type { Locale } from '../../i18n/ui';
import { fassung } from '../fassung';
import { priceInfo } from '../shipExtras';
import { pickThumb } from '../shipRenders';
import { missionBySlug, bpCount } from '../missions';
import ITEMS from '../../../assets/universal-items.json';
import CRAFT from '../../../assets/crafting-db.json';
import MISSIONS from '../../data/missions.json';
import VEHICLES from '../../data/vehicles.json';
import PRICES from '../../data/vehicle-prices.json';
import RSI_BILDER from '../../data/patch-4-10-3/bilder-rsi.json';
import RENDER_BILDER from '../../data/patch-4-10-3/bilder-render.json';

/* ---------- Typen ---------- */

/** Spielfassung, aus der ein Wert stammt. */
export type Fassung = '4.10.2' | '4.10.3';

/** h: Basisform eines Seitenpfads (/schiffe/x.html) oder eine https-URL. */
export type Link = { t: string; h: string };
/** Hervorgehobenes Wort im Fliesstext. */
export type Hervor = { b: string };
/** Fliesstext mit eingebetteten Links und Hervorhebungen. */
export type Text = (string | Link | Hervor)[];

export type BildArt = 'rsi' | 'render' | 'holo' | 'szene';
export type BildGroesse = { w: number; h: number; src: string; avif?: string };
export type Bild = {
  key: string;
  art: BildArt;
  /** Schiffs-Id (rsi-galaxy, vncl-scythe) oder Thema (iae-2956, vanduul-incursion, skarnov, raider-camo) */
  thema: string;
  alt: string;
  /** breiteste zuerst */
  groessen: BildGroesse[];
  /** nur bei art 'rsi': Herkunft (steht nicht auf der Seite, siehe assets/patch-4-10-3/HERKUNFT.md) */
  quelle?: string;
};

export type AbschnittId = 'auftraege' | 'schiffe' | 'auec' | 'werte' | 'radar' | 'salvage' | 'kampf' | 'vanguard' | 'ausruestung' | 'namen' | 'bestand' | 'akte';
export type Abschnitt = { id: AbschnittId; t: string };

export type KachelArt = 'new' | 'changed' | 'removed' | 'event';
export type Kachel = {
  art: KachelArt;
  /** Bezeichnung (Kachelkopf) */
  k: string;
  /** die grosse Zahl oder Kurzangabe */
  v: string;
  /** was hinter der Zahl steht, ein Satz */
  s: string;
  /** Abschnitt dieser Seite, der die Zahl aufschluesselt */
  ziel: AbschnittId;
  /** Seite der Website, auf der das Ding selbst steht */
  link: Link | null;
  stand: Fassung;
  bilder: Bild[];
};

export type Auftrag = {
  titel: string;
  link: Link;
  /** niedrigster Rang, ab dem der Auftrag angeboten wird */
  rang: string;
  ort: string;
  auftraggeber: string;
  /** Baupläne, die der Auftrag als Belohnung vergeben kann (Anzahl), dazu der namentlich genannte */
  bauplaene: number;
  belohnung: Link | null;
  stand: Fassung;
};
export type AuftragsGruppe = { typ: string; titel: string; text: string; auftraege: Auftrag[] };

export type Kennwert = { k: string; v: Text };
export type Vergleichswert = { k: string; dieses: string; jenes: string };
export type NeuesSchiff = {
  id: string;
  hersteller: string;
  name: string;
  link: Link;
  text: string;
  werte: Kennwert[];
  module: Link[];
  /** Schiff aehnlicher Rolle, Werte aus denselben Spieldaten */
  vergleich: { schiff: Link; werte: Vergleichswert[] };
  /** das handgemachte Hologramm der heutigen Seite */
  hologramm: Bild;
  bilder: Bild[];
  stand: Fassung;
};

export type Angebot = { haendler: string; ort: string; preis: number };
export type AuecSchiff = {
  id: string;
  name: string;
  hersteller: string;
  link: Link;
  angebote: Angebot[];
  /** Vorschaubild der Schiffsliste (fremd, Nachweis in der Fusszeile der Seite) */
  vorschau: string | null;
  bilder: Bild[];
  stand: Fassung;
  /** Tag, an dem die Preise abgerufen wurden */
  preiseVom: string;
};

export type Zelle = { v: Text; zahl?: number };
export type Aenderung = {
  schiffe: Link[];
  /** welcher Wert (leer, wenn die Gruppe nur einen Wert kennt) */
  was: Text;
  /** null: der Wert ist neu oder es gab ihn schon (siehe schon) */
  vorher: Zelle | null;
  nachher: Zelle;
  /** nur bei Zahlen: (nachher - vorher) / vorher in Prozent, gerundet */
  delta: number | null;
  /** Radar: das Schiff hatte Groesse 3 schon vorher */
  schon?: true;
  vorherStand: Fassung;
  stand: Fassung;
};
export type AenderungsGruppe = {
  id: 'radar' | 'salvage' | 'kampf' | 'vanguard';
  titel: string;
  tag: string;
  /** false: steht nicht in den offiziellen Patch Notes */
  inNotes: boolean;
  /** Masseinheit, wenn alle Zeilen Zahlen derselben Einheit sind */
  einheit: string | null;
  zeilen: Aenderung[];
  notiz: Text;
  bilder: Bild[];
};

export type Ausfuehrung = { name: string; link: Link; neu: boolean; farbe: string | null; toene: string[] };
export type CamoGruppe = { k: string; v: Link[] };
export type AusruestungsKarte = {
  id: 'skarnov' | 'raider-camo' | 'deterrent' | 'iae-2956' | 'namen';
  titel: string;
  tag: string;
  text: Text;
  liste: { k: string | null; v: Link[] }[];
  /** neu in 4.10.3, umbenannt oder entfernt */
  marken: ('neu' | 'umbenannt' | 'entfernt')[];
  bilder: Bild[];
  stand: Fassung;
};

export type Bestandszeile = { was: Link; vorher: number; nachher: number; vorherStand: Fassung; stand: Fassung };

export type PatchInhalt = {
  lang: Locale;
  version: '4.10.3';
  codename: string;
  datum: string;
  notes: Link;
  vorgaenger: Link & { titel: string };
  kopf: { eyebrow: string; titel: string; codename: Text; satz: string; bilder: Bild[] };
  abschnitte: Abschnitt[];
  kacheln: Kachel[];
  auftraege: { titel: string; auftraggeber: string; lead: Text; gruppen: AuftragsGruppe[]; bilder: Bild[] };
  neueSchiffe: NeuesSchiff[];
  auec: { titel: string; lead: Text; schiffe: AuecSchiff[]; bildnachweis: string };
  werte: AenderungsGruppe[];
  ausruestung: { titel: string; bauplaeneNeu: number; karten: AusruestungsKarte[]; skarnov: Ausfuehrung[]; camo: CamoGruppe[] };
  /** notiz: Satz mit den neuen Fahrzeugen; Link-Ziel #namen zeigt auf den Abschnitt dieser Seite */
  bestand: { zeilen: Bestandszeile[]; neueFahrzeuge: Link[]; notiz: Text };
  dossier: { ziel: 'akte'; titel: string; text: string };
  /** jedes Bild dieser Seite, nach Thema auffindbar */
  bilder: Bild[];
};

/* ---------- Bilder ---------- */

type BildRoh = { key: string; art: BildArt; thema: string; alt: { de: string; en: string }; groessen: BildGroesse[]; quelle?: string };
const HAND: BildRoh[] = [
  { key: 'rsi-galaxy-hologramm', art: 'holo', thema: 'rsi-galaxy', alt: { de: 'Hologramm der RSI Galaxy, schräg von vorn', en: 'Hologram of the RSI Galaxy, front three-quarter view' }, groessen: [{ w: 1600, h: 900, src: '/assets/patch-4-10-3/rsi-galaxy-holo.webp' }] },
  { key: 'anvl-liberator-hologramm', art: 'holo', thema: 'anvl-liberator', alt: { de: 'Hologramm der Anvil Liberator, schräg von der Seite', en: 'Hologram of the Anvil Liberator, side three-quarter view' }, groessen: [{ w: 1600, h: 854, src: '/assets/patch-4-10-3/anvl-liberator-holo.webp' }] },
];
const ALLE_BILDER: BildRoh[] = [
  ...(RSI_BILDER as { bilder: BildRoh[] }).bilder,
  ...(RENDER_BILDER as { bilder: BildRoh[] }).bilder,
  ...HAND,
];
const ART_FOLGE: BildArt[] = ['rsi', 'szene', 'render', 'holo'];

/* ---------- Spieldaten und ihre Fassung ---------- */

const F_ITEMS = fassung((ITEMS as { gameVersion?: string }).gameVersion, 'assets/universal-items.json gameVersion');
const F_CRAFT = fassung((CRAFT as { version?: string }).version, 'assets/crafting-db.json version');
const F_MISSIONS = fassung((MISSIONS as { meta?: { patch?: string } }).meta?.patch, 'src/data/missions.json meta.patch');
const F_VEHICLES = fassung((VEHICLES as { gameVersion?: string }).gameVersion, 'src/data/vehicles.json gameVersion');
/** Die Seite beschreibt 4.10.3: rueckt eine Datei weiter, muessen ihre Zahlen hier eingefroren werden. */
function nur4103(f: string, wo: string): Fassung {
  if (f !== '4.10.3') throw new Error(`patch-4-10-3/inhalt: ${wo} steht auf ${f}; die Zahlen der 4.10.3-Seite hier als Literal einfrieren`);
  return f;
}

const NOTES_URL = 'https://robertsspaceindustries.com/en/comm-link/Patch-Notes/21429-Star-Citizen-Alpha-4103';

/**
 * Der Inhalt der Seite in einer Sprache. Wirft, wenn die Spieldaten nicht
 * mehr hergeben, was die Seite behauptet (fehlendes Schiff, mehrdeutiger
 * Preis, Datenstand nicht 4.10.3).
 */
export async function patchInhalt(lang: Locale): Promise<PatchInhalt> {
  const de = lang === 'de';
  const T = (d: string, e: string) => (de ? d : e);
  const n = (x: number) => x.toLocaleString(de ? 'de-DE' : 'en-US');
  const bilder: Bild[] = ALLE_BILDER.map((b) => ({ key: b.key, art: b.art, thema: b.thema, alt: b.alt[lang], groessen: b.groessen, ...(b.quelle ? { quelle: b.quelle } : {}) }));
  const bilderZu = (...themen: string[]) => bilder
    .filter((b) => themen.includes(b.thema))
    .sort((a, b) => ART_FOLGE.indexOf(a.art) - ART_FOLGE.indexOf(b.art) || themen.indexOf(a.thema) - themen.indexOf(b.thema));
  const bild = (key: string) => {
    const b = bilder.find((x) => x.key === key);
    if (!b) throw new Error(`patch-4-10-3/inhalt: Bild ${key} fehlt`);
    return b;
  };

  const vehicles = new Map((await getCollection('vehicles')).map((v) => [v.id, v.data]));
  const fahrzeug = (id: string) => {
    const v = vehicles.get(id);
    if (!v) throw new Error(`patch-4-10-3/inhalt: Schiff ${id} fehlt im Bestand`);
    return v;
  };
  const schiff = (id: string, t?: string): Link => ({ t: t ?? fahrzeug(id).name, h: `/schiffe/${id}.html` });
  const sVehicles = nur4103(F_VEHICLES, 'src/data/vehicles.json');

  /* ---- Abschnitte und Kacheln ---- */

  const abschnitte: Abschnitt[] = [
    { id: 'auftraege', t: T('Aufträge', 'Contracts') },
    { id: 'schiffe', t: T('Neue Schiffe', 'New ships') },
    { id: 'auec', t: T('Für aUEC', 'For aUEC') },
    { id: 'werte', t: T('Geänderte Werte', 'Changed values') },
    { id: 'ausruestung', t: T('Ausrüstung', 'Gear') },
    { id: 'bestand', t: T('Bestand', 'Catalogue') },
    { id: 'akte', t: 'Dossier' },
  ];

  const kacheln: Kachel[] = [
    { art: 'event', ziel: 'auftraege', k: 'Vanduul Incursion', v: T('12 Aufträge', '12 contracts'), s: T('Neu von InterSec in Nyx, gegen Vanduul und Shattered Blade', 'New from InterSec in Nyx, against the Vanduul and the Shattered Blade'), link: { t: 'InterSec', h: '/missionen.html' }, stand: '4.10.3', bilder: bilderZu('vanduul-incursion', 'vncl-scythe') },
    { art: 'new', ziel: 'schiffe', k: T('Neue Schiffe', 'New ships'), v: 'Galaxy · Liberator', s: T('Modulschiff mit Wechselmodul und Träger für Schiffe und Fahrzeuge', 'Modular ship with a swappable module and a carrier for ships and vehicles'), link: schiff('rsi-galaxy'), stand: '4.10.3', bilder: bilderZu('rsi-galaxy', 'anvl-liberator') },
    { art: 'new', ziel: 'auec', k: T('Für aUEC', 'For aUEC'), v: T('8 Schiffe', '8 ships'), s: T('Zum ersten Mal im Spiel kaufbar, in Stanton, Nyx und Pyro', 'Buyable in game for the first time, in Stanton, Nyx and Pyro'), link: null, stand: '4.10.3', bilder: bilderZu('drak-ironclad', 'orig-m80') },
    { art: 'changed', ziel: 'radar', k: 'Radar', v: T('Gr. 2 → 3', 'Size 2 → 3'), s: 'Carrack, Perseus, Starlancer MAX · TAC', link: { t: 'Surveyor-Max', h: '/items/surveyor-max.html' }, stand: '4.10.3', bilder: bilderZu('anvl-carrack') },
    { art: 'changed', ziel: 'salvage', k: 'Salvage', v: '240 → 448 SCU', s: T('Reclaimer-Puffer. Die ganze Salvage-Flotte nimmt mehr auf.', 'Reclaimer buffer. The whole salvage fleet holds more.'), link: schiff('aegs-reclaimer', 'Reclaimer'), stand: '4.10.3', bilder: bilderZu('aegs-reclaimer') },
    { art: 'changed', ziel: 'kampf', k: 'Mauler „STRIKER“', v: '64 → 250', s: T(`Energieschaden je Schuss, rund 800 → ${n(3125)} DPS`, `Energy damage per shot, about 800 → ${n(3125)} DPS`), link: { t: 'Mauler „STRIKER“', h: '/items/vanduul-mauler-striker-repeater.html' }, stand: '4.10.3', bilder: bilderZu('vncl-mauler') },
    { art: 'changed', ziel: 'kampf', k: T('Torpedos', 'Torpedoes'), v: T('ab 700 m', 'from 700 m'), s: T('Größe 5 und 7 machen sich erst dann scharf', 'Size 5 and 7 only arm from there'), link: null, stand: '4.10.3', bilder: [] },
    { art: 'new', ziel: 'ausruestung', k: T('Baupläne', 'Blueprints'), v: '+17', s: T('Raider Camo, Skarnov, Deterrent', 'Raider Camo, Skarnov, Deterrent'), link: { t: T('Baupläne', 'Blueprints'), h: '/crafting.html' }, stand: '4.10.3', bilder: bilderZu('raider-camo', 'skarnov') },
  ];

  /* ---- Aufträge: Titel, Rang, Ort und Baupläne aus den Missionsdaten ---- */

  const sMissions = nur4103(F_MISSIONS, 'src/data/missions.json');
  const auftrag = (slug: string, belohnung: Link | null = null): Auftrag => {
    const m = missionBySlug.get(slug);
    if (!m) throw new Error(`patch-4-10-3/inhalt: Auftrag ${slug} fehlt in src/data/missions.json`);
    return { titel: m.title, link: { t: m.title, h: `/missionen/${slug}.html` }, rang: m.ranks[0], ort: 'Nyx', auftraggeber: 'InterSec Defense Solutions', bauplaene: bpCount(m), belohnung, stand: sMissions };
  };
  const gruppen: AuftragsGruppe[] = [
    { typ: T('Flotten', 'Fleets'), titel: T('Verbände abfangen', 'Intercept strike groups'), text: T('Ein Vanduul-Verband steht an einem Punkt in Nyx, und nach dem ersten Schlag folgen Unterstützungswellen.', 'A Vanduul strike group sits at a point in Nyx, and support waves follow the first strike.'),
      auftraege: ['intercept-vanduul-fleet', 'vanduul-strike-group-detected', 'counterstrike-against-vanduul-raiders'].map((s) => auftrag(s)) },
    { typ: 'Mauler', titel: T('Anführer herauslocken', 'Draw out the leaders'), text: T('Ein Mauler führt den Verband und soll nur mit starkem Begleitschutz angegangen werden.', 'A Mauler leads the group and should only be engaged with strong backup.'),
      auftraege: ['draw-out-maulers', 'interdict-vanduul-maulers', 'seek-and-destroy-super-stingers'].map((s) => auftrag(s)) },
    { typ: 'Shattered Blade', titel: T('Dreifrontenkampf', 'Three-way fights'), text: T('Vanduul und die Shattered Blade kämpfen um dasselbe Gebiet, und InterSec will beide loswerden.', 'The Vanduul and the Shattered Blade fight over the same ground, and InterSec wants both gone.'),
      auftraege: ['engage-shattered-blade-and-vanduul', 'neutralize-vanduul-and-shattered-blade-threat', 'stop-vanduul-and-shattered-blade-hostilities'].map((s) => auftrag(s)) },
    { typ: T('An Bord', 'Aboard'), titel: T('Entern und Bergen', 'Boarding and recovery'), text: T('Ein geentertes Schiff zurückerobern, eine lebende Vanduul-Probe in der Kryokapsel abliefern und gezielt Ziele ausschalten.', 'Retake a boarded vessel, deliver a living Vanduul sample in its cryopod and eliminate specific targets.'),
      auftraege: [auftrag('retake-boarded-vessel'), auftrag('living-vanduul-sample'), auftrag('intersec-eliminate-specific-rank1', { t: T('Bauplan Skarnov „Raider Camo“', 'Skarnov "Raider Camo" blueprint'), h: '/crafting/skarnov-raider-camo-rifle.html' })] },
  ];

  /* ---- Neue Schiffe: Kennwerte aus den Fahrzeugdaten ---- */

  const kenn = (id: string) => {
    const v = fahrzeug(id) as unknown as { crewMin: number; hullHp: number; shieldHp: number; scmSpeed: number; maxSpeed: number; cargoSCU: number };
    return v;
  };
  const vergleich = (id: string, mit: string): NeuesSchiff['vergleich'] => {
    const a = kenn(id), b = kenn(mit);
    const zeile = (k: string, f: (x: typeof a) => number, e = '') => ({ k, dieses: `${n(f(a))}${e}`, jenes: `${n(f(b))}${e}` });
    return {
      schiff: schiff(mit),
      werte: [
        zeile(T('Mindestcrew', 'Minimum crew'), (x) => x.crewMin),
        zeile(T('Hülle', 'Hull'), (x) => x.hullHp, ' HP'),
        zeile(T('Schild', 'Shield'), (x) => x.shieldHp, ' HP'),
        zeile('SCM', (x) => x.scmSpeed, ' m/s'),
        zeile('Max', (x) => x.maxSpeed, ' m/s'),
        zeile(T('Fracht', 'Cargo'), (x) => x.cargoSCU, ' SCU'),
      ],
    };
  };
  const galaxy = kenn('rsi-galaxy');
  const liberator = kenn('anvl-liberator');
  const neueSchiffe: NeuesSchiff[] = [
    {
      id: 'rsi-galaxy', hersteller: 'Roberts Space Industries', name: 'Galaxy', link: schiff('rsi-galaxy', 'Galaxy'),
      text: T('Das Mittelmodul bestimmt die Rolle. Das Frachtmodul hebt den Laderaum von 64 auf 720 SCU und bringt einen Industrielift und Traktorstrahl-Konsolen mit. Das Med-Bay-Modul macht die Galaxy zum Feldlazarett mit Medbetten der Stufen 1 bis 3.', 'The central module sets the role. The cargo module takes the hold from 64 to 720 SCU and adds an industrial lift and tractor beam consoles. The med bay module turns the Galaxy into a field hospital with tier 1 to 3 medbeds.'),
      werte: [
        { k: T('Rolle', 'Role'), v: [T('Modulschiff', 'Modular')] },
        { k: T('Mindestcrew', 'Minimum crew'), v: [`${galaxy.crewMin}`] },
        { k: T('Hülle / Schild', 'Hull / shield'), v: [`${n(galaxy.hullHp)} / ${n(galaxy.shieldHp)} HP`] },
        { k: 'SCM / Max', v: [`${galaxy.scmSpeed} / ${galaxy.maxSpeed} m/s`] },
        { k: T('Fracht', 'Cargo'), v: [T(`${galaxy.cargoSCU} SCU, mit Frachtmodul 720 SCU`, `${galaxy.cargoSCU} SCU, 720 SCU with the cargo module`)] },
        { k: T('Raketen', 'Missiles'), v: ['32 × ', { t: 'Tempest II', h: '/items/tempest-ii-missile.html' }] },
      ],
      module: [
        { t: 'Cargo Module', h: '/items/galaxy-cargo-module.html' },
        { t: 'Med Bay Module', h: '/items/galaxy-med-bay-module.html' },
        { t: 'Stock Module', h: '/items/galaxy-stock-module.html' },
        { t: T('Radar Lephari', 'Lephari radar'), h: '/items/lephari.html' },
      ],
      vergleich: vergleich('rsi-galaxy', 'rsi-constellation-andromeda'),
      hologramm: bild('rsi-galaxy-hologramm'),
      bilder: bilderZu('rsi-galaxy'),
      stand: sVehicles,
    },
    {
      id: 'anvl-liberator', hersteller: 'Anvil Aerospace', name: 'Liberator', link: schiff('anvl-liberator', 'Liberator'),
      text: T('Bodenfahrzeuge fahren über die Heckrampe in die Fahrzeughalle. Schiffe passen in den inneren Hangar oder setzen auf Landeflächen im Rumpf und auf der Oberseite auf. Was an Bord steht, wird dort repariert, aufmunitioniert und betankt.', 'Ground vehicles drive up the rear ramp into the vehicle bay. Ships fit in the interior hangar or set down on pads inside the hull and along the top. Ships and vehicles aboard can be repaired, rearmed and refuelled there.'),
      werte: [
        { k: T('Rolle', 'Role'), v: [T('Leichter Träger · Kapitalklasse', 'Light carrier · capital')] },
        { k: T('Hülle / Schild', 'Hull / shield'), v: [`${n(liberator.hullHp)} / ${n(liberator.shieldHp)} HP`] },
        { k: 'SCM / Max', v: [`${liberator.scmSpeed} / ${liberator.maxSpeed} m/s`] },
        { k: T('Fracht', 'Cargo'), v: [`${liberator.cargoSCU} SCU`] },
        { k: T('Türme', 'Turrets'), v: ['4 × ', { t: 'Panther', h: '/items/cf-337-panther-repeater.html' }, ' · 2 × ', { t: 'Galdereen', h: '/items/cf-557-galdereen-repeater.html' }] },
      ],
      module: [],
      vergleich: vergleich('anvl-liberator', 'anvl-carrack'),
      hologramm: bild('anvl-liberator-hologramm'),
      bilder: bilderZu('anvl-liberator'),
      stand: sVehicles,
    },
  ];

  /* ---- Für aUEC: Preise aus der Preisliste, je Händler genau einer ---- */

  type Buy = { price: number; shop: string; where: string; system: string };
  const ORTE: Record<string, { haendler: string; ort: string; passt: (b: Buy) => boolean }> = {
    lorville: { haendler: 'New Deal', ort: 'Lorville', passt: (b) => b.where === 'Lorville' },
    levski: { haendler: "Teach's Ship Shop", ort: 'Levski', passt: (b) => b.where === 'Levski' },
    pyro: { haendler: 'Buy and Fly', ort: T('Ruin Station, Checkmate und Orbituary · Pyro', 'Ruin Station, Checkmate and Orbituary · Pyro'), passt: (b) => b.system === 'Pyro' },
    area18: { haendler: 'Astro Armada', ort: 'Area18', passt: (b) => b.where === 'Area 18' },
  };
  const AUEC: [string, string, string[]][] = [
    ['aegs-tiburon', 'Tiburon', ['lorville']],
    ['misc-starlite', 'Starlite', ['lorville', 'levski']],
    ['drak-ironclad', 'Ironclad', ['levski']],
    ['drak-pitbull', 'Pitbull', ['levski', 'pyro']],
    ['drak-ironclad-assault', 'Ironclad Assault', ['pyro']],
    ['glsn-basher', 'Basher', ['pyro']],
    ['orig-m80', 'M80', ['area18']],
    ['gama-tyilui', 'Tyilui', ['area18']],
  ];
  const preiseVom = (PRICES as { fetchedAt: string }).fetchedAt.slice(0, 10);
  const auecSchiffe: AuecSchiff[] = AUEC.map(([id, name, orte]) => {
    const v = fahrzeug(id);
    const buy = (priceInfo(id)?.buy ?? []) as Buy[];
    if (!v.manufacturer) throw new Error(`inhalt 4.10.3: ${id} ohne Hersteller in vehicles.json`);
    return {
      id, name, hersteller: v.manufacturer, link: schiff(id, name),
      vorschau: pickThumb(v)?.src ?? null,
      angebote: orte.map((o) => {
        const ort = ORTE[o];
        const preise = new Set(buy.filter(ort.passt).map((b) => b.price));
        if (preise.size !== 1) throw new Error(`patch-4-10-3/inhalt: ${preise.size} aUEC-Preise für ${id} in ${ort.ort}, erwartet genau einer`);
        return { haendler: ort.haendler, ort: ort.ort, preis: [...preise][0] };
      }),
      bilder: bilderZu(id),
      stand: '4.10.3',
      preiseVom,
    };
  });

  /* ---- Geänderte Werte ---- */

  const zahl = (x: number): Zelle => ({ v: [n(x)], zahl: x });
  const delta = (a: number, b: number) => Math.round(((b - a) / a) * 100);
  const z = (a: Omit<Aenderung, 'delta' | 'vorherStand' | 'stand'>): Aenderung => ({
    ...a,
    delta: a.vorher?.zahl != null && a.nachher.zahl != null ? delta(a.vorher.zahl, a.nachher.zahl) : null,
    vorherStand: '4.10.2',
    stand: '4.10.3',
  });
  const surveyor: Link = { t: 'Surveyor', h: '/items/surveyor.html' };
  const surveyorMax: Link = { t: 'Surveyor-Max', h: '/items/surveyor-max.html' };
  const resolu: Link = { t: 'Resolu', h: '/items/resolu.html' };
  const werte: AenderungsGruppe[] = [
    {
      id: 'radar', titel: T('Radar Größe 3', 'Size 3 radar'), tag: T('Größe 2 → 3', 'size 2 → 3'), inNotes: true, einheit: null,
      zeilen: [
        z({ schiffe: [schiff('anvl-carrack', 'Carrack'), schiff('anvl-carrack-expedition', 'Expedition')], was: [], vorher: { v: [surveyor] }, nachher: { v: [surveyorMax] } }),
        z({ schiffe: [schiff('misc-starlancer-max', 'Starlancer MAX'), schiff('misc-starlancer-tac', 'TAC')], was: [], vorher: { v: [surveyor] }, nachher: { v: [surveyorMax] } }),
        z({ schiffe: [schiff('rsi-perseus', 'Perseus')], was: [], vorher: { v: [{ t: 'Epier', h: '/items/epier.html' }] }, nachher: { v: [resolu] } }),
        z({ schiffe: [schiff('aegs-hammerhead', 'Hammerhead'), schiff('aegs-tiburon', 'Tiburon')], was: [], vorher: null, schon: true, nachher: { v: [resolu] } }),
      ],
      notiz: [T('Die Perseus hat ihr Relais jetzt an einer Konsole, bei der Starlancer sitzt das Radar im Maschinenraum.', 'The Perseus now has its relay on a console, and the Starlancer\'s radar sits in engineering.')],
      bilder: bilderZu('anvl-carrack', 'rsi-perseus', 'misc-starlancer-max'),
    },
    {
      id: 'salvage', titel: T('Salvage-Puffer', 'Salvage buffer'), tag: 'SCU', inNotes: true, einheit: 'SCU',
      zeilen: ([['aegs-reclaimer', 'Reclaimer', 240, 448], ['argo-moth', 'MOTH', 64, 240], ['drak-vulture', 'Vulture', 13, 16], ['misc-fortune', 'Fortune', 13, 14], ['rsi-salvation', 'Salvation', 6, 8]] as const)
        .map(([id, t, a, b]) => z({ schiffe: [schiff(id, t)], was: [], vorher: zahl(a), nachher: zahl(b) })),
      notiz: [T('Das Zerlegungsfeld ist größer, und der Strahl muss weniger genau ausgerichtet sein.', 'The disintegration field is larger, and the beam needs less precise alignment.')],
      bilder: bilderZu('aegs-reclaimer', 'argo-moth', 'drak-vulture'),
    },
    {
      id: 'kampf', titel: T('Kampf', 'Combat'), tag: T('Vanduul, Kopfgeld, Waffen', 'Vanduul, bounties, weapons'), inNotes: true, einheit: null,
      zeilen: [
        z({ schiffe: [], was: [{ t: T('Mauler „STRIKER“, Energieschaden je Schuss', 'Mauler "STRIKER", energy damage per shot'), h: '/items/vanduul-mauler-striker-repeater.html' }], vorher: zahl(64), nachher: zahl(250) }),
        z({ schiffe: [], was: [T('Mauler „STRIKER“, DPS', 'Mauler "STRIKER", DPS')], vorher: { v: [T('rund 800', 'about 800')], zahl: 800 }, nachher: zahl(3125) }),
        z({ schiffe: [], was: [T('High Risk Target, Ruf bei der Bounty Hunters Guild', 'High Risk Target, Bounty Hunters Guild rep')], vorher: zahl(2000), nachher: zahl(4000) }),
        z({ schiffe: [], was: [T('Torpedos Größe 5 und 7', 'Size 5 and 7 torpedoes')], vorher: null, nachher: { v: [T('scharf ab 700 m', 'armed from 700 m')] } }),
        z({ schiffe: [], was: [T('Bombenhalter Größe 1 und 3, links und rechts', 'Bomb racks size 1 and 3, left and right')], vorher: null, nachher: { v: [T('neu am Waffenkiosk im Crusader-Showroom in Orison', 'now at the weapon kiosk in the Crusader showroom in Orison')] } }),
      ],
      notiz: [T('Vanduul-KI hat mehr Munition und regeneriert sie schneller, der Mauler hat dafür weniger Lebenspunkte.', 'Vanduul AI carries more ammo and regenerates it faster, while the Mauler has less health.')],
      bilder: bilderZu('vncl-mauler', 'vncl-scythe', 'vanduul-incursion'),
    },
    {
      id: 'vanguard', titel: 'Vanguard', tag: T('nicht in den Notes', 'not in the notes'), inNotes: false, einheit: null,
      zeilen: [
        z({ schiffe: [schiff('aegs-vanguard', 'Warden'), schiff('aegs-vanguard-hoplite', 'Hoplite')], was: [T('Turm-DPS', 'Turret DPS')], vorher: zahl(400), nachher: zahl(750) }),
        z({ schiffe: [schiff('aegs-vanguard-sentinel', 'Sentinel')], was: [T('Turmwaffe', 'Turret gun')], vorher: { v: [{ t: 'Suckerpunch-L', h: '/items/suckerpunch-l-cannon.html' }] }, nachher: { v: [{ t: 'Suckerpunch-XL', h: '/items/suckerpunch-xl-cannon.html' }] } }),
        z({ schiffe: [schiff('aegs-vanguard-harbinger', 'Harbinger')], was: [T('Turmwaffen', 'Turret guns')], vorher: zahl(2), nachher: zahl(3) }),
      ],
      notiz: [T('Warden und Hoplite tragen im Turm den ', 'Warden and Hoplite carry the size 3 '), { t: T('SW16BR3 „Shredder“', 'SW16BR3 "Shredder"'), h: '/items/sw16br3-shredder-repeater.html' }, T(' der Größe 3 statt des ', ' in the turret instead of the size 2 '), { t: T('„Sawbuck“', '"Sawbuck"'), h: '/items/sw16br2-sawbuck-repeater.html' }, T(' der Größe 2.', '.')],
      bilder: bilderZu('aegs-vanguard', 'aegs-vanguard-hoplite', 'aegs-vanguard-sentinel', 'aegs-vanguard-harbinger'),
    },
  ];

  /* ---- Ausrüstung: Skarnov-Farben aus den Gegenstandsdaten ---- */

  const sItems = nur4103(F_ITEMS, 'assets/universal-items.json');
  const items = new Map((ITEMS as { items: { id: string; name: string; game?: { desc?: string } }[] }).items.map((x) => [x.id, x]));
  const FARBE_DE: Record<string, string> = {
    'skarnov-ferrite-rifle': 'Tiefschwarze Beize mit Metallakzenten.',
    'skarnov-relay-rifle': 'Rahmen aus blankem Metall mit grauen Details.',
    'skarnov-sparkplug-rifle': 'Leuchtend metallisches Gelb am Lauf auf schwarzem Rahmen.',
    'skarnov-raider-camo-rifle': 'Dunkle Grün- und Brauntöne.',
  };
  const TOENE: Record<string, string[]> = {
    'skarnov-rifle': ['#3a3d42', '#9aa0a8'],
    'skarnov-ferrite-rifle': ['#121212', '#8a8d91'],
    'skarnov-relay-rifle': ['#8c9096', '#4a4d52'],
    'skarnov-sparkplug-rifle': ['#e5c22a', '#121212'],
    'skarnov-raider-camo-rifle': ['#3b4a2c', '#5a4630'],
  };
  const SKARNOV_NAMEN: [string, string][] = [['skarnov-rifle', 'Skarnov'], ['skarnov-ferrite-rifle', '„Ferrite“'], ['skarnov-relay-rifle', '„Relay“'], ['skarnov-sparkplug-rifle', '„Sparkplug“'], ['skarnov-raider-camo-rifle', '„Raider Camo“']];
  const skarnov: Ausfuehrung[] = SKARNOV_NAMEN.map(([id, name]) => {
    const it = items.get(id);
    if (!it) throw new Error(`patch-4-10-3/inhalt: Gegenstand ${id} fehlt`);
    const satz = /The .+ edition .+\.$/.exec((it.game?.desc ?? '').split('\n\n').pop() ?? '')?.[0] ?? null;
    return { name, link: { t: name, h: `/items/${id}.html` }, neu: true, farbe: satz && (de ? FARBE_DE[id] ?? null : satz), toene: TOENE[id] };
  });
  const camo: CamoGruppe[] = [
    { k: T('Panzerung', 'Armour'), v: [{ t: 'Corbel', h: '/crafting/corbel-core-raider-camo.html' }, { t: 'Palatino', h: '/crafting/palatino-core-raider-camo.html' }, { t: 'Tailwind', h: '/crafting/tailwind-flight-suit-raider-camo.html' }] },
    { k: T('Schiffskanonen', 'Ship cannons'), v: [{ t: 'M3A', h: '/crafting/m3a-cannon-raider-camo.html' }, { t: 'M4A', h: '/crafting/m4a-cannon-raider-camo.html' }, { t: 'M5A', h: '/crafting/m5a-cannon-raider-camo.html' }] },
    { k: T('Gewehr', 'Rifle'), v: [{ t: 'Skarnov', h: '/crafting/skarnov-raider-camo-rifle.html' }] },
  ];
  const notes: Link = { t: T('Patch Notes ↗', 'Patch notes ↗'), h: NOTES_URL };
  const p4102: Link = { t: '4.10.2', h: '/patches/sc-4-10-2.html' };
  const karten: AusruestungsKarte[] = [
    {
      id: 'skarnov', titel: 'Skarnov', tag: T('Energiegewehr', 'Energy rifle'), marken: ['neu'], stand: sItems,
      text: [T('Neu in fünf Ausführungen. „Raider Camo“ und ihre Batterie gibt es als Bauplan aus dem InterSec-Auftrag ', 'New in five versions. The "Raider Camo" version and its battery come as a blueprint from the InterSec contract '), { t: 'Intersec Eliminate Specific Rank1', h: '/missionen/intersec-eliminate-specific-rank1.html' }, '.'],
      liste: [
        { k: T('Ausführungen', 'Versions'), v: skarnov.map((s) => s.link) },
        { k: T('Munition', 'Ammo'), v: [{ t: T('Batterie (30 cap)', 'Battery (30 cap)'), h: '/items/skarnov-rifle-battery-30-cap.html' }] },
      ],
      bilder: bilderZu('skarnov'),
    },
    {
      id: 'raider-camo', titel: 'Raider Camo', tag: T('Baupläne', 'Blueprints'), marken: ['neu'], stand: nur4103(F_CRAFT, 'assets/crafting-db.json'),
      text: [T('Die Tarnung „Raider Camo“ gibt es als Bauplan für drei Panzerungen, drei Schiffskanonen und den Skarnov.', '"Raider Camo" comes as a blueprint for three armour sets, three ship cannons and the Skarnov.')],
      liste: camo,
      bilder: bilderZu('raider-camo'),
    },
    {
      id: 'deterrent', titel: 'Deterrent · Lephari', tag: T('Komponenten', 'Components'), marken: ['neu', 'umbenannt'], stand: sItems,
      text: [
        T('Der RSI-Schild der Größe 4, der bis ', 'The RSI size 4 shield called "Glacis" up to '), p4102,
        T(' „Glacis“ hieß, heißt jetzt ', ' is now named '), { t: 'Deterrent', h: '/items/deterrent.html' },
        T('. Die ', '. The '), schiff('rsi-polaris', 'Polaris'),
        T(' trägt ihn ab Werk. Den Namen ', ' carries it from the factory. The '), { t: 'Glacis', h: '/items/glacis.html' },
        T(' trägt jetzt ein neuer Schild der Größe 4 von Origin. Das zivile Radar der Größe 3 in der ', ' name now belongs to a new Origin size 4 shield. The size 3 civilian radar in the '), schiff('rsi-constellation-mk5-centaurus', 'Centaurus'), T(' und der ', ' and the '), schiff('rsi-zeus-es', 'Zeus ES'),
        T(' hatte bisher keinen Namen im Spiel und heißt jetzt ', ' had no in-game name until now and is called '), { t: 'Lephari', h: '/items/lephari.html' }, T('. Die neue ', '. The new '), schiff('rsi-galaxy', 'Galaxy'), T(' trägt es auch.', ' carries it too.'),
      ],
      liste: [{ k: null, v: [{ t: T('Bauplan Deterrent', 'Deterrent blueprint'), h: '/crafting/deterrent.html' }] }, { k: null, v: [{ t: T('Bauplan Lephari', 'Lephari blueprint'), h: '/crafting/lephari.html' }] }],
      bilder: [],
    },
    {
      id: 'iae-2956', titel: 'IAE 2956', tag: T('Expo-Andenken', 'Expo keepsakes'), marken: ['neu'], stand: sItems,
      text: [
        T('Sammelmünzen der Best-in-Show-Schiffe mit Vitrine, dazu eine ', 'Collector coins of the Best in Show ships with a display case, plus a '), { t: T('Kappe', 'cap'), h: '/items/iae-2956-hat.html' },
        T(', ein ', ', a '), { t: 'T-Shirt', h: '/items/iae-2956-t-shirt.html' },
        T(' und die ', ' and the '), { t: '2956 Best in Show Bomber Jacket', h: '/items/2956-best-in-show-bomber-jacket.html' }, '. ',
        schiff('drak-corsair', 'Corsair'), ', ', schiff('drak-ironclad-assault', 'Ironclad Assault'), ', ', schiff('orig-m80', 'M80'), T(' und ', ' and '), schiff('rsi-perseus', 'Perseus'),
        T(' haben je eine Lackierung „2956 Best In Show“. ', ' each get a "2956 Best In Show" livery. '), notes,
      ],
      liste: [
        { k: T('Kleidung', 'Clothing'), v: [{ t: T('Kappe', 'Cap'), h: '/items/iae-2956-hat.html' }, { t: 'T-Shirt', h: '/items/iae-2956-t-shirt.html' }, { t: '2956 Best in Show Bomber Jacket', h: '/items/2956-best-in-show-bomber-jacket.html' }] },
        { k: T('Lackierung „2956 Best In Show“', '"2956 Best In Show" livery'), v: [schiff('drak-corsair', 'Corsair'), schiff('drak-ironclad-assault', 'Ironclad Assault'), schiff('orig-m80', 'M80'), schiff('rsi-perseus', 'Perseus')] },
      ],
      bilder: bilderZu('iae-2956', 'drak-corsair'),
    },
    {
      id: 'namen', titel: T('Namen', 'Names'), tag: 'HM6', marken: ['umbenannt', 'entfernt'], stand: sVehicles,
      text: [
        T('Anvils Bodenfahrzeuge heißen jetzt ', 'Anvil\'s ground vehicles are now called '), schiff('anvl-ballista', 'HM6 Ballista'), ', ', schiff('anvl-spartan', 'HM6 Spartan'), T(' und ', ' and '), schiff('anvl-centurion', 'HM6 Centurion'),
        T('. Phoenix Emerald und Hammerhead 2949 Best In Show stehen nicht mehr als eigene Fahrzeuge im Spiel. Emerald gibt es jetzt als Lackierung für die ', '. The Phoenix Emerald and the Hammerhead 2949 Best In Show are no longer separate vehicles in the game. Emerald is now a livery for the '),
        schiff('rsi-constellation-phoenix', 'Mk IV'), '.',
      ],
      liste: [],
      bilder: bilderZu('anvl-ballista', 'anvl-spartan', 'anvl-centurion'),
    },
  ];

  /* ---- Bestand: 4.10.2 eingefroren, 4.10.3 aus den Daten ---- */

  const sCraft = nur4103(F_CRAFT, 'assets/crafting-db.json');
  const bestandZeilen: Bestandszeile[] = [
    { was: { t: T('Gegenstände', 'Items'), h: '/items.html' }, vorher: 9412, nachher: (ITEMS as { items: unknown[] }).items.length, vorherStand: '4.10.2', stand: sItems },
    { was: { t: T('Baupläne', 'Blueprints'), h: '/crafting.html' }, vorher: 1617, nachher: (CRAFT as { blueprints: unknown[] }).blueprints.length, vorherStand: '4.10.2', stand: sCraft },
    { was: { t: T('Missionsfamilien', 'Mission families'), h: '/missionen.html' }, vorher: 1387, nachher: (MISSIONS as { missions: unknown[] }).missions.length, vorherStand: '4.10.2', stand: sMissions },
    { was: { t: T('Schiffe und Fahrzeuge', 'Ships and vehicles'), h: '/schiffe.html' }, vorher: 231, nachher: (VEHICLES as { vehicles: unknown[] }).vehicles.length, vorherStand: '4.10.2', stand: sVehicles },
  ];
  const neueFahrzeuge: Link[] = [
    schiff('rsi-galaxy', 'Galaxy'),
    schiff('anvl-liberator', 'Liberator'),
    ...['argo-atls-geo-collector-grad02', 'argo-atls-ikti', 'argo-atls-geo-ikti', 'argo-atls-geo-ikti-ntls'].map((id) => schiff(id)),
  ];

  return {
    lang,
    version: '4.10.3',
    codename: 'IAE 2956 & Vanduul Incursion',
    datum: '2026-11-12',
    notes,
    vorgaenger: { ...p4102, titel: '4.10.2 · RSI Discovery Month' },
    kopf: {
      eyebrow: T('12. November 2026 · Point-Release', 'November 12, 2026 · Point Release'),
      titel: '4.10.3',
      codename: ['IAE 2956 & ', 'Vanduul Incursion'],
      satz: T('Die Vanduul greifen in Nyx an, und InterSec sucht Piloten. Dazu kommen die RSI Galaxy und die Anvil Liberator.', 'The Vanduul strike Nyx, and InterSec is hiring pilots. The RSI Galaxy and the Anvil Liberator are new.'),
      bilder: bilderZu('vanduul-incursion', 'iae-2956'),
    },
    abschnitte,
    kacheln,
    auftraege: {
      titel: T('Vanduul-Aufträge in Nyx', 'Vanduul contracts in Nyx'),
      auftraggeber: 'InterSec Defense Solutions',
      lead: [T('Vanduul-Clans bedrohen die Handelsrouten in Nyx. InterSec vergibt zwölf Aufträge. Der Einstiegsrang reicht je nach Auftrag von ', 'Vanduul clans threaten the trade routes in Nyx. InterSec offers twelve contracts. Depending on the contract, the entry rank ranges from '), { b: 'Jr. Contractor' }, T(' bis ', ' to '), { b: 'Elite Contractor' }, T('. Die meisten lassen sich teilen.', '. Most of them can be shared.')],
      gruppen,
      bilder: bilderZu('vanduul-incursion', 'vncl-scythe', 'vncl-glaive', 'vncl-blade', 'vncl-stinger', 'vncl-mauler'),
    },
    neueSchiffe,
    auec: {
      titel: T('Jetzt für aUEC', 'Now for aUEC'),
      lead: [T('Acht Schiffe, die schon flogen, lassen sich ', 'Eight ships that already flew can be '), { b: T('zum ersten Mal im Spiel kaufen', 'bought in game for the first time') }, '.'],
      schiffe: auecSchiffe,
      bildnachweis: T('Schiffsbilder: starcitizen.tools', 'Ship images: starcitizen.tools'),
    },
    werte,
    ausruestung: { titel: T('Ausrüstung und Baupläne', 'Gear and blueprints'), bauplaeneNeu: 17, karten, skarnov, camo },
    bestand: {
      zeilen: bestandZeilen,
      neueFahrzeuge,
      notiz: [T('Neu bei Schiffen und Fahrzeugen: ', 'New ships and vehicles: '), ...neueFahrzeuge.flatMap((x, i) => (i > 0 ? [', ', x] : [x])), T('. Zwei Editionen entfallen, siehe ', '. Two editions were removed, see '), { t: T('Namen', 'Names'), h: '#namen' }, '.'],
    },
    dossier: { ziel: 'akte', titel: 'Dossier', text: T('Alle Änderungen als Liste, Schiffstabelle, Datenstand und offizielle Notes', 'Every change as a list, ship table, data status and official notes') },
    bilder,
  };
}
