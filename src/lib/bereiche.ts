// Die Bereichsliste: EINE Quelle fuer jede Stelle, die die Bereiche der Seite
// aufzaehlt (UX-Audit 24.11.2026, Paket A, Punkt A1).
//
// Vorher pflegten fuenf Stellen je ihre eigene Liste: das Menue (SiteNav
// deckGroups), die Werkzeuge der Suche (searchIndex toolEntries), der Fuss der
// Datenblaetter (DataShell), die Kacheln der Startseite (index.astro) und die
// Leiste des Hangar-Terminals (HangarPage TERM). Nur drei Ziele standen
// ueberall; Advanced Loadout und Ruestungs-Sets standen nirgends, das
// Blueprint-Verzeichnis nur im Fuss, Wikelo im Menue unter „Ausruestung“ und
// im Terminal unter „Archiv“, und zwei Linktexte meinten je nach Stelle ein
// anderes Ziel („Preise & Fundorte“, „Blaupausen & Planer“).
//
// Hier steht jedes Ziel einmal, mit seinem einen Namen je Sprache (die
// Begriffsliste dazu: docs/begriffe.md). Wer einen Bereich, eine Unterseite
// oder einen Namen aendert, aendert ihn HIER; die Leisten lesen daraus.
//
// Struktur nach der Zielstruktur des IA-Audits (§ 7): nach Dingen aus dem
// Spiel geordnet, sieben Bereiche, jeder mit seinen Seiten. Die erste Seite
// eines Bereichs ist seine Einstiegsseite (dorthin fuehrt der Bereichsname).
// Keine URL aendert sich dadurch.
//
// `vorschau`: nur im Vorschau-Bau (Hangar und Advanced Loadout, HAS_HANGAR in
// src/lib/seo.ts; live gibt es sie nicht und nichts darf dorthin zeigen).
// Die Helfer unten filtern sie im Live-Bau heraus — keine Leiste muss das
// selbst wissen.
import { href, type Locale } from '../i18n/ui';
import { HAS_HANGAR } from './seo';
import { DISCORD } from '../consts';

type Text = { de: string; en: string };

export interface ZielQuelle {
  /** stabiler Schluessel (Klassen, Markierung, Nachschlagen) */
  key: string;
  /** Basisform des Pfads (EN, ohne /de); bei `extern` die volle Adresse */
  path: string;
  /** der eine Name des Ziels (docs/begriffe.md) */
  name: Text;
  /** Kurzform fuer die waagrechte Leiste, nur wo der Name dort nicht passt */
  kurz?: Text;
  /** Unterzeile (Menue, Kacheln, Suche); jede kommt nur einmal vor */
  sub: Text;
  /** Pfad-Anfaenge (ohne /de), unter denen dieses Ziel seine Seiten fuehrt */
  pre?: string[];
  /** nur im Vorschau-Bau (Hangar) */
  vorschau?: boolean;
  /** verlaesst die Seite (neuer Tab, rel-Schutz) */
  extern?: boolean;
  /** Suchwoerter beider Sprachen fuer die Werkzeuge der Suche; nie angezeigt.
   *  Fehlt es, steht das Ziel nicht in der Suche. */
  such?: string;
  /** roher <path>-Rumpf fuer ein 24er-SVG (kompiliert, keine Nutzereingabe) */
  icon?: string;
  /** Vorschaubild-Name unter /assets/thumb/<name>.webp (Menue-Buehne) */
  bild?: string;
}

export interface BereichQuelle {
  key: string;
  /** Name des Bereichs in der Leiste; fuehrt auf seine erste Seite */
  name: Text;
  kurz?: Text;
  seiten: ZielQuelle[];
}

const ICON = {
  items: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
  finder: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  sets: '<path d="M12 2 4 5v6c0 5.2 3.4 9.4 8 11 4.6-1.6 8-5.8 8-11V5z"/>',
  crafting: '<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>',
  blueprints: '<path d="M4 4h16v16H4z"/><path d="M4 9h16M9 9v11"/>',
  schiffe: '<path d="M12 2L2 22h9l1-6 1 6h9L12 2z"/>',
  // Hallentor: Bogen, Boden, Einfahrt.
  hangar: '<path d="M3 20V11a9 9 0 0 1 18 0v9"/><path d="M2 20h20"/><path d="M8 20v-5h8v5"/>',
  loadout: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  missionen: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>',
  // Spitzhacke: das Schliff-Sechseck davor las sich bei 20 px als Herz.
  mining: '<path d="M8 5a14 14 0 0 1 11 11"/><path d="M4.2 20.2 15.4 9"/>',
  fracturing: '<path d="M13 2 4.5 13H11l-1 9 9.5-12H13z"/>',
  refinery: '<path d="M9 3h6M10 3v5.5L4.6 19A1.4 1.4 0 0 0 5.8 21h12.4a1.4 1.4 0 0 0 1.2-2L14 8.5V3"/><path d="M7.5 15h9"/>',
  sprung: '<circle cx="12" cy="12" r="8"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  wikelo: '<path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0"/>',
  archiv: '<path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/>',
  themen: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>',
  evolution: '<path d="M3 3v18h18M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>',
  downloads: '<path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/>',
  konto: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  feedback: '<path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>',
  // Einziges gefuelltes Glyph: ein Markenzeichen wird wiedererkannt, nicht
  // gelesen. Auf die 24er-Buehne skaliert (127.14 breit -> 0.1888) und darin
  // senkrecht zentriert.
  discord: '<g transform="translate(0 2.9) scale(.1888)" fill="currentColor" stroke="none"><path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21H.55A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/></g>',
  support: '<path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1.1 1L12 21l7.7-7.7 1.1-1a5.5 5.5 0 000-7.7z"/>',
};

// Reihenfolge = Reihenfolge in jeder Leiste. Bilder: dieselben kuratierten
// Motive wie die Startseite; Discord, Unterstuetzen und die Themen tragen
// BEWUSST keines (kein ehrliches Motiv, das Glyph traegt). Precision Jump
// bekam mit seiner Kachel auf der Startseite (A5) den Sprungpunkt.
export const BEREICHE: BereichQuelle[] = [
  {
    key: 'items',
    name: { de: 'Items', en: 'Items' },
    seiten: [
      {
        key: 'items',
        path: '/items.html',
        name: { de: 'Item-Verzeichnis', en: 'Item directory' },
        sub: { de: 'Alle Items nach Kategorie', en: 'Every item by category' },
        pre: ['/items.html', '/items/'],
        such: 'items gegenstaende verzeichnis directory kategorien categories alle all',
        icon: ICON.items,
      },
      {
        key: 'finder',
        path: '/item-finder.html',
        name: { de: 'Item Finder', en: 'Item Finder' },
        sub: { de: 'Preise & Fundorte', en: 'Prices & locations' },
        pre: ['/item-finder.html'],
        such: 'items finder preise prices shops loot fundorte kaufen buy',
        icon: ICON.finder,
        bild: 't-supply-1',
      },
      {
        key: 'sets',
        path: '/armor-sets.html',
        name: { de: 'Rüstungs-Sets', en: 'Armor sets' },
        sub: { de: 'Ganze Sets im Vergleich', en: 'Full sets compared' },
        pre: ['/armor-sets.html'],
        such: 'armor armour sets ruestung ruestungen sets helm helmet',
        icon: ICON.sets,
      },
    ],
  },
  {
    key: 'crafting',
    name: { de: 'Crafting', en: 'Crafting' },
    seiten: [
      {
        key: 'crafting',
        path: '/topics/crafting.html',
        name: { de: 'Crafting', en: 'Crafting' },
        sub: { de: 'Werkbank & Planer', en: 'Workbench & planner' },
        pre: ['/topics/crafting.html'],
        such: 'crafting blueprints bauplaene blaupausen planner planer herstellen werkbank workbench fabricator',
        icon: ICON.crafting,
        bild: 't-craft-1',
      },
      {
        key: 'blueprints',
        path: '/crafting.html',
        name: { de: 'Blueprint-Verzeichnis', en: 'Blueprint directory' },
        sub: { de: 'Alle Blueprints nach Kategorie', en: 'Every blueprint by category' },
        pre: ['/crafting.html', '/crafting/'],
        such: 'blueprints bauplaene blaupausen verzeichnis directory kategorien categories alle all',
        icon: ICON.blueprints,
      },
    ],
  },
  {
    key: 'schiffe',
    name: { de: 'Schiffe', en: 'Ships' },
    seiten: [
      {
        key: 'schiffe',
        path: '/schiffe.html',
        name: { de: 'Schiffe', en: 'Ships' },
        sub: { de: 'Datenblätter & Specs', en: 'Data sheets & specs' },
        pre: ['/schiffe.html', '/schiffe/'],
        such: 'ships schiffe vergleich compare specs fahrzeuge vehicles',
        icon: ICON.schiffe,
        bild: 't-perseus-1',
      },
      {
        key: 'hangar',
        path: '/hangar.html',
        name: { de: 'Hangar', en: 'Hangar' },
        sub: { de: 'Jedes Schiff in 3D', en: 'Every ship in 3D' },
        pre: ['/hangar.html', '/hangar-bay/'],
        vorschau: true,
        such: 'hangar 3d halle hall schiffshalle modell model',
        icon: ICON.hangar,
        // Dasselbe Motiv, mit dem die Hangar-Seite geteilt wird (ogImage).
        bild: 'img-hammerhead',
      },
      {
        key: 'loadout',
        path: '/hangar-loadout.html',
        name: { de: 'Advanced Loadout', en: 'Advanced loadout' },
        sub: { de: 'Ausstattung mit allen Werten', en: 'Components with every stat' },
        pre: ['/hangar-loadout.html'],
        vorschau: true,
        such: 'loadout advanced ausstattung ausruestung komponenten components waffen weapons fitting',
        icon: ICON.loadout,
      },
    ],
  },
  {
    key: 'missionen',
    name: { de: 'Missionen', en: 'Missions' },
    seiten: [
      {
        key: 'missionen',
        path: '/missionen.html',
        name: { de: 'Missionen', en: 'Missions' },
        sub: { de: 'Belohnungen & Ruf', en: 'Rewards & reputation' },
        pre: ['/missionen.html', '/missionen/'],
        such: 'missions missionen contracts auftraege reputation ruf belohnung reward',
        icon: ICON.missionen,
        bild: 't-tsg-4',
      },
    ],
  },
  {
    key: 'mining',
    name: { de: 'Mining', en: 'Mining' },
    seiten: [
      {
        key: 'mining',
        path: '/topics/mining.html',
        name: { de: 'Mining', en: 'Mining' },
        sub: { de: 'Mineralien & Scans', en: 'Minerals & scans' },
        pre: ['/topics/mining.html'],
        such: 'mining bergbau minerals mineralien erze ores scans',
        icon: ICON.mining,
        bild: 't-align-1',
      },
      {
        key: 'fracturing',
        path: '/fracturing.html',
        name: { de: 'Fracturing', en: 'Fracturing' },
        sub: { de: 'Bricht der Brocken?', en: 'Will the rock break?' },
        pre: ['/fracturing.html'],
        such: 'fracturing bruchrechner mining laser module gadgets brechen',
        icon: ICON.fracturing,
      },
      {
        key: 'refinery',
        path: '/refinery.html',
        name: { de: 'Refinery', en: 'Refinery' },
        sub: { de: 'Erträge & Aufträge', en: 'Yields & jobs' },
        pre: ['/refinery.html'],
        such: 'refinery raffinerie jobs auftraege tracker ertrag yield',
        icon: ICON.refinery,
        bild: 'img-refinery',
      },
      {
        key: 'sprung',
        path: '/precision-jump.html',
        name: { de: 'Precision Jump', en: 'Precision Jump' },
        sub: { de: 'Aaron-Halo-Routen', en: 'Aaron Halo routes' },
        pre: ['/precision-jump.html'],
        such: 'aaron halo quantum quantensprung routen routes',
        icon: ICON.sprung,
        bild: 't-mesh-2',
      },
    ],
  },
  {
    key: 'wikelo',
    name: { de: "Wikelo's Emporium", en: "Wikelo's Emporium" },
    kurz: { de: 'Wikelo', en: 'Wikelo' },
    seiten: [
      {
        key: 'wikelo',
        path: '/topics/wikelo-emporium.html',
        name: { de: "Wikelo's Emporium", en: "Wikelo's Emporium" },
        kurz: { de: 'Wikelo', en: 'Wikelo' },
        sub: { de: 'Banu-Handel', en: 'Banu trades' },
        pre: ['/topics/wikelo-emporium.html'],
        such: 'wikelo banu trades tausch handel',
        icon: ICON.wikelo,
        bild: 'img-railen',
      },
    ],
  },
  {
    key: 'archiv',
    name: { de: 'Patch-Archiv', en: 'Patch archive' },
    seiten: [
      {
        key: 'archiv',
        path: '/archiv.html',
        name: { de: 'Patch-Archiv', en: 'Patch archive' },
        sub: { de: 'Alle Versionen', en: 'All versions' },
        // /topics/ steht hier als Ganzes: die drei Werkzeuge darunter
        // (Crafting, Mining, Wikelo) gewinnen in bereichVon(), weil ihr
        // Anfang laenger ist.
        pre: ['/archiv.html', '/patches/', '/topics/'],
        such: 'patches archiv archive versionen versions',
        icon: ICON.archiv,
        bild: 'img-vanduul',
      },
      {
        key: 'themen',
        path: '/archiv.html#themen',
        name: { de: 'Alle Themen', en: 'All topics' },
        sub: { de: 'Themen-Verzeichnis', en: 'Topic directory' },
        icon: ICON.themen,
      },
      {
        key: 'evolution',
        path: '/evolution.html',
        name: { de: 'Evolution', en: 'Evolution' },
        sub: { de: 'Systeme × Patches', en: 'Systems × patches' },
        pre: ['/evolution.html'],
        such: 'evolution systeme systems',
        icon: ICON.evolution,
        bild: 't-mesh-1',
      },
      {
        key: 'downloads',
        path: '/downloads.html',
        name: { de: 'Downloads', en: 'Downloads' },
        sub: { de: 'Medien & Onepager', en: 'Media & one-pagers' },
        pre: ['/downloads.html'],
        such: 'downloads medien media onepager wallpaper',
        icon: ICON.downloads,
        bild: 't-hangar-1',
      },
    ],
  },
];

// Konto und Service: rechts in der Leiste bzw. im Fuss, nicht unter den
// Bereichen. Der Konto-Eintrag nennt seinen Zustand selbst (account-lite.js
// tauscht „Anmelden“ gegen „Konto“); hier steht der Name des Ziels.
export const DIENSTE: ZielQuelle[] = [
  {
    key: 'konto',
    path: '/account/login.html',
    name: { de: 'Anmelden', en: 'Sign in' },
    sub: { de: 'Flotte & Profil', en: 'Fleet & profile' },
    pre: ['/account/', '/account.html', '/pilot.html'],
    icon: ICON.konto,
  },
  {
    key: 'flotte',
    path: '/account/fleet.html',
    name: { de: 'Meine Flotte', en: 'My fleet' },
    sub: { de: 'Schiffe aus „Zur Flotte“, auch ohne Konto', en: 'Ships from “Add to fleet”, even without an account' },
    pre: ['/account/fleet.html'],
    icon: ICON.konto,
  },
  {
    key: 'feedback',
    path: '/feedback.html',
    name: { de: 'Feedback', en: 'Feedback' },
    sub: { de: 'Ideen & Fehler melden', en: 'Ideas & bug reports' },
    pre: ['/feedback.html'],
    icon: ICON.feedback,
    bild: 't-def-1',
  },
  {
    key: 'discord',
    path: DISCORD.invite,
    extern: true,
    name: { de: 'Discord', en: 'Discord' },
    sub: { de: 'Werkstatt hinter der Seite', en: 'The workshop behind the site' },
    icon: ICON.discord,
  },
  {
    key: 'support',
    path: '/support.html',
    name: { de: 'Unterstützen', en: 'Support' },
    sub: { de: 'Server & Domain mitfinanzieren', en: 'Help pay for server & domain' },
    pre: ['/support.html'],
    icon: ICON.support,
  },
];

/** Rechtliches: nur im Fuss. */
export const RECHT: ZielQuelle[] = [
  { key: 'impressum', path: '/impressum.html', name: { de: 'Impressum', en: 'Legal Notice' }, sub: { de: '', en: '' }, pre: ['/impressum.html'] },
  { key: 'datenschutz', path: '/datenschutz.html', name: { de: 'Datenschutz', en: 'Privacy' }, sub: { de: '', en: '' }, pre: ['/datenschutz.html'] },
];

/* ---------- Helfer: lokalisiert, Vorschau-Ziele nur im Vorschau-Bau ---------- */

export interface Ziel {
  key: string;
  /** fertige Adresse in der Sprache der Seite (extern: unveraendert) */
  href: string;
  /** Basisform ohne /de (zum Vergleichen mit dem Pfad der Seite) */
  path: string;
  name: string;
  /** Name fuer die waagrechte Leiste (Kurzform, sonst der Name) */
  kurz: string;
  sub: string;
  extern: boolean;
  vorschau: boolean;
  icon?: string;
  bild?: string;
  such?: string;
}

export interface Bereich {
  key: string;
  name: string;
  kurz: string;
  /** Adresse der Einstiegsseite (erste Seite) */
  href: string;
  seiten: Ziel[];
}

const mitHangar = (vorschau?: boolean) => vorschau ?? HAS_HANGAR;

function lokal(z: ZielQuelle, lang: Locale): Ziel {
  return {
    key: z.key,
    href: z.extern ? z.path : href(z.path, lang),
    path: z.path,
    name: z.name[lang],
    kurz: (z.kurz ?? z.name)[lang],
    sub: z.sub[lang],
    extern: !!z.extern,
    vorschau: !!z.vorschau,
    icon: z.icon,
    bild: z.bild,
    such: z.such,
  };
}

/** Die Bereiche in der Sprache der Seite. `vorschau` ueberschreibt den
 *  Hangar-Schalter nur fuer Tests; Seiten lassen ihn weg. */
export function bereiche(lang: Locale, vorschau?: boolean): Bereich[] {
  const hangar = mitHangar(vorschau);
  return BEREICHE.map((b) => {
    const seiten = b.seiten.filter((s) => hangar || !s.vorschau).map((s) => lokal(s, lang));
    return { key: b.key, name: b.name[lang], kurz: (b.kurz ?? b.name)[lang], href: seiten[0].href, seiten };
  });
}

/** Konto und Service in der Sprache der Seite. */
export function dienste(lang: Locale): Ziel[] {
  return DIENSTE.map((z) => lokal(z, lang));
}

/** Impressum und Datenschutz in der Sprache der Seite. */
export function recht(lang: Locale): Ziel[] {
  return RECHT.map((z) => lokal(z, lang));
}

const ALLE: ZielQuelle[] = [...BEREICHE.flatMap((b) => b.seiten), ...DIENSTE, ...RECHT];

/** Ein Ziel nach Schluessel, z. B. ziel('refinery', 'de').name === 'Refinery'.
 *  Fuer Seiten, die ein Ziel beim Namen nennen (Begriffsliste). Ein
 *  unbekannter Schluessel bricht den Bau, statt still einen Platzhalter zu
 *  drucken. Vorschau-Ziele liefert es immer: wer sie nennt, fragt selbst
 *  HAS_HANGAR (Regel in CLAUDE.md). */
export function ziel(key: string, lang: Locale): Ziel {
  const z = ALLE.find((x) => x.key === key);
  if (!z) throw new Error(`bereiche.ts: kein Ziel mit dem Schluessel "${key}"`);
  return lokal(z, lang);
}

const ohneDe = (pathname: string) =>
  pathname === '/de.html' || pathname === '/de' || pathname === '/de/' ? '/index.html'
  : pathname.startsWith('/de/') ? pathname.slice(3) : pathname;

/** Zu welchem Bereich und welcher Seite gehoert dieser Pfad (DE oder EN)?
 *  Der laengste passende Pfad-Anfang gewinnt: /topics/mining.html gehoert zu
 *  Mining, nicht zum Archiv, obwohl beide /topics/ kennen. Startseite,
 *  Konto, Service: kein Bereich (null). */
export function bereichVon(pathname: string): { bereich: string; seite: string } | null {
  const p = ohneDe(pathname);
  let best: { bereich: string; seite: string; len: number } | null = null;
  for (const b of BEREICHE)
    for (const s of b.seiten)
      for (const pre of s.pre ?? [])
        if (p.startsWith(pre) && (!best || pre.length > best.len)) best = { bereich: b.key, seite: s.key, len: pre.length };
  return best ? { bereich: best.bereich, seite: best.seite } : null;
}

/** Die Ziele fuer die Werkzeug-Eintraege der Suche: jede Seite mit
 *  Suchwoertern, in Leistenreihenfolge, ohne Sprungmarken und (live) ohne
 *  Vorschau-Ziele. */
export function suchZiele(lang: Locale, vorschau?: boolean): Ziel[] {
  return bereiche(lang, vorschau).flatMap((b) => b.seiten).filter((s) => s.such && !s.path.includes('#'));
}

/* ---------- Brotkrumen (UX-Audit A3) ---------- */

export interface Krume {
  label: string;
  /** Adresse in der Sprache der Seite; fehlt = aktuelle Seite */
  href?: string;
}

const HEIMAT = new Set(['/index.html', '/']);

/** Die Spur einer Seite nach der Bereichsliste, OHNE die Startseite (die
 *  setzt jeder Rahmen selbst davor: als Logo sichtbar, als erste Krume im
 *  Datenblock fuer Google).
 *
 *  Warum hier und nicht in jeder Seite: die Seiten reichen ihre Krumen aus
 *  ihrer Geschichte durch. Werkzeuge hingen unter einem Patch („Archiv ›
 *  Alpha 4.10.3 › Crafting“), die Startseite hiess auf Schiffs- und
 *  Missionsseiten „Archiv“, Service und Recht standen unter „Archiv“ (IA B4).
 *  Statt ~100 Aufrufer anzufassen, ordnet diese Funktion jede Spur am Baum
 *  der Bereichsliste: Bereich › Seite des Bereichs › was die Seite selbst
 *  darunter nennt (Kategorie, Patch, Name). Gehoert der Pfad zu keinem
 *  Bereich (Feedback, Impressum, Konto), bleibt die Spur der Seite, nur ohne
 *  Startseiten-Krumen. Keine URL aendert sich.
 *
 *  `seite` sind die Krumen, die die Seite uebergibt; ihre href duerfen
 *  lokalisiert (/de/…) oder in Basisform sein. Die letzte Krume ohne href
 *  ist die Seite selbst und behaelt ihren Namen, ausser die Seite IST ein
 *  Ziel der Liste: dann traegt sie den Namen aus der Begriffsliste. */
export function krumen(pathname: string, seite: Krume[], lang: Locale): Krume[] {
  const p = ohneDe(pathname);
  const basis = (h?: string) => (h ? ohneDe(h.split(/[?#]/)[0]) : undefined);
  // Adresse in der Sprache der Seite, Abfrage und Sprungmarke bleiben.
  const lok = (h: string) => (h.startsWith('/de/') || h === '/de.html' || /^https?:/.test(h) ? h : href(h, lang));
  const istHeim = (k: Krume) => {
    const h = basis(k.href);
    return h !== undefined && (HEIMAT.has(h) || h === '/de.html');
  };
  const eigene = seite.filter((k) => !istHeim(k));
  const letzte = eigene.length && !eigene[eigene.length - 1].href ? eigene[eigene.length - 1] : null;
  const mitte = letzte ? eigene.slice(0, -1) : eigene;

  const wo = bereichVon(p);
  if (!wo) {
    // Service und Recht sind kein Archiv: deren Seiten nannten es als Eltern.
    const rest = mitte.filter((k) => basis(k.href) !== '/archiv.html').map((k) => ({ label: k.label, href: k.href ? lok(k.href) : undefined }));
    const z = ALLE.find((x) => !x.extern && x.path === p);
    return letzte ? [...rest, z ? { label: z.name[lang] } : letzte] : rest;
  }
  const b = BEREICHE.find((x) => x.key === wo.bereich)!;
  const sichtbar = b.seiten.filter((s) => mitHangar() || !s.vorschau);
  const einstieg = sichtbar[0];
  const ziel_ = b.seiten.find((s) => s.key === wo.seite)!;
  const out: Krume[] = [];
  if (p === einstieg.path) return [{ label: einstieg.name[lang] }];
  out.push({ label: b.name[lang], href: href(einstieg.path, lang) });
  if (ziel_.key !== einstieg.key) {
    if (p === ziel_.path) return [...out, { label: ziel_.name[lang] }];
    out.push({ label: ziel_.name[lang], href: href(ziel_.path, lang) });
  }
  // Was die Seite darunter nennt: alles, was nicht schon als Bereich, Seite
  // oder Archiv dasteht (die Werkzeuge nannten ihr Patch als Elternteil —
  // das faellt weg, Patches haengen nur im Patch-Archiv).
  const schon = new Set([einstieg.path, ziel_.path, '/archiv.html']);
  const imArchiv = b.key === 'archiv';
  for (const k of mitte) {
    const h = basis(k.href);
    if (h && schon.has(h)) continue;
    if (!imArchiv && h?.startsWith('/patches/')) continue;
    out.push({ label: k.label, href: k.href ? lok(k.href) : undefined });
  }
  out.push(letzte ?? { label: ziel_.name[lang] });
  return out;
}

/**
 * Startseite (UX-Audit A5): die Kacheln unter „Werkzeuge“, nach Nachfrage
 * geordnet (Umami, Besuche je Seitenart im November 2026: Item-Blaetter
 * vor Bauplaenen vor Missionen vor Schiffen, dann Precision Jump und
 * Mining). Das Patch-Archiv war die grosse Leitkachel und steht jetzt in
 * der kleinen Reihe; Precision Jump kam dazu. `groesse` ist das Raster der
 * Startseite: xl zwei Zeilen hoch, w halbe Breite, t ein Drittel.
 */
const START: ReadonlyArray<readonly [string, 'xl' | 'w' | 't']> = [
  ['finder', 'xl'],
  ['crafting', 'w'],
  ['missionen', 'w'],
  ['schiffe', 't'],
  ['sprung', 't'],
  ['mining', 't'],
  ['refinery', 't'],
  ['wikelo', 't'],
  ['archiv', 't'],
];

export interface Kachel extends Ziel {
  groesse: 'xl' | 'w' | 't';
}

/** Die Kacheln der Startseite in der Sprache der Seite. */
export function startKacheln(lang: Locale): Kachel[] {
  return START.map(([key, groesse]) => ({ ...ziel(key, lang), groesse }));
}

/** Was nicht als Kachel dasteht, in der Reihenfolge der Bereiche — die Zeile
 *  unter den Kacheln. Vorschau-Seiten nur im Vorschau-Bau (bereiche()). */
export function startWeitere(lang: Locale, vorschau?: boolean): Ziel[] {
  const kachel = new Set(START.map(([key]) => key));
  return bereiche(lang, vorschau).flatMap((b) => b.seiten).filter((z) => !kachel.has(z.key));
}
