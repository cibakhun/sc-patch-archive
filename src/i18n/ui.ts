// i18n — Fundament (Stufe 1)
// ---------------------------------------------------------------------------
// Zweck: die WIEDERKEHRENDEN UI-Strings (Nav, Suche, Footer, Pager, Labels)
// getrennt vom bespoke Fließtext der Seiten pflegen. Dieser Katalog ist die
// einzige Quelle für Chrome-Text.
//
// Default-Locale = 'de' (bestehende URLs bleiben präfixlos, SEO unverändert).
// 'en' bekommt den /en/-Präfix. Fehlt ein en-Key, fällt t() sichtbar auf de
// zurück statt zu crashen — so kann Stufe 2/3 die Strings inkrementell füllen.
//
// WICHTIG für DE-Identität: die de-Werte müssen exakt den bisherigen
// hartcodierten Strings entsprechen, damit das gerenderte DE-HTML byte-gleich
// bleibt.

export const DEFAULT_LOCALE = 'de' as const;
export const LOCALES = ['de', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABEL: Record<Locale, string> = {
  de: 'Deutsch',
  en: 'English',
};
/** kurzes Kürzel für den Umschalter */
export const LOCALE_SHORT: Record<Locale, string> = { de: 'DE', en: 'EN' };

// html lang / og:locale Werte pro Locale
export const HTML_LANG: Record<Locale, string> = { de: 'de', en: 'en' };
export const OG_LOCALE: Record<Locale, string> = { de: 'de_DE', en: 'en_US' };

// UI-String-Katalog. Flache, punkt-getrennte Keys -> pro Locale ein Wert.
// Nur wiederkehrende Chrome-Strings; KEIN Seiten-Fließtext.
const UI = {
  de: {
    // -- Navigation --
    'nav.ships': 'Schiffe',
    'nav.evolution': 'Evolution',
    'nav.search': 'Suche',
    'nav.search.open': 'Suche öffnen (Strg+K)',
    'nav.search.kbd': 'Strg K',
    'nav.patches': 'Patches',
    'nav.topics': 'Themen',
    'nav.menu': 'Menü',
    'nav.menu.open': 'Menü öffnen',
    'nav.section': 'Navigation',
    'nav.main': 'Hauptnavigation',
    'nav.path': 'Pfad',
    'nav.home': 'Startseite',
    'nav.home.aria': 'SC Archiv — Startseite',
    'nav.allPatches': 'Alle Patches',
    'nav.allTopics': 'Alle Themen',
    'nav.ships.long': 'Schiffe & Fahrzeuge — Datenbank',
    'nav.evolution.long': 'Evolution — Systeme × Patches',
    'nav.langSwitch': 'Sprache wechseln',
    // -- Breadcrumbs --
    'crumbs.archive': 'Archiv',
    'crumbs.ships': 'Schiffe',
    // -- Suche (Overlay) --
    'search.dialog': 'Archiv durchsuchen',
    'search.placeholder': 'Patches, Themen, Schiffe, Features…',
    'search.term': 'Suchbegriff',
    'search.sys': 'Archiv&nbsp;//&nbsp;Suche',
    'search.close': 'Suche schließen',
    'search.results': 'Suchergebnisse',
    'search.pick': 'wählen',
    'search.open': 'öffnen',
    'search.dismiss': 'schließen',
    'search.empty.title': 'Kein Eintrag im Register',
    'search.empty.query': 'Anfrage »%q%« ',
    'search.empty.hint': 'ergab keine Treffer — Version oder Codename versuchen.',
    // -- Pager --
    'pager.older': '← Älter',
    'pager.newer': 'Neuer →',
    'pager.latest': 'Aktuellster Patch',
    'pager.nav': 'Patch-Navigation',
    // -- Skip-Link --
    'skip.toContent': 'Zum Inhalt springen',
    // -- Footer / Attribution --
    'footer.pageNav': 'Seiten-Navigation',
    'footer.sources': 'Quellen',
    'footer.credit': 'SC Patch-Archiv · ein Fan-Projekt',
    'footer.dataAsOf': 'Daten-Stand',
    'footer.disclaimer':
      'Inoffizielles Fan-Projekt zu Dokumentationszwecken. Star Citizen® und alle zugehörigen Marken gehören der Cloud Imperium Rights LLC & Ltd. Keine Verbindung zu oder Förderung durch Cloud Imperium Games. Wiki-Inhalte von starcitizen.tools stehen unter CC-BY-SA 4.0; eingebettete Trailer und Standbilder © Cloud Imperium Games (Fan-Content-Nutzung).',
    // -- Schiff-Datenblatt (Template-Chrome; Daten-Row-Labels aus src/lib -> Stufe 2) --
    'ship.pill': 'DATENBLATT',
    'ship.title.suffix': 'Datenblatt',
    'ship.novisual': 'Kein Visual im Datenbestand',
    'ship.view.img': 'Bild',
    'ship.view.3d': '3D-Holo',
    'ship.view.switch': 'Darstellung wechseln',
    'ship.holo.drag': '3D-Ansicht — ziehen zum Drehen',
    'ship.stage.length': 'Länge',
    'ship.stage.crew': 'Besatzung',
    'ship.stage.cargo': 'Fracht',
    'ship.stage.scm': 'SCM',
    'ship.stage.priceIngame': 'Im Verse ab',
    'ship.stage.pledge': 'Pledge',
    'ship.buy.title': 'Kaufen im Verse',
    'ship.buy.cheapest': 'günstigster Kaufort:',
    'ship.buy.more': 'weitere Kauforte',
    'ship.buy.none': 'Aktuell nicht an Ingame-Terminals kaufbar — nur als Pledge erhältlich.',
    'ship.rent.title': 'Mieten',
    'ship.rent.perDay': '/ Tag',
    'ship.pledge': 'Pledge:',
    'ship.pledge.store': 'RSI Pledge-Store ↗',
    'ship.buy.hint': 'Ingame-Preise: UEX Corp (Community-Daten) · ändern sich mit Patches und Events.',
    'ship.profile.title': 'Leistungsprofil',
    'ship.profile.rank': 'Perzentil im Katalog',
    'ship.profile.hint': 'P100 = Spitzenwert im Katalog, P50 = Mittelfeld — Balkenmitte markiert den Median.',
    'ship.sheet.title': 'Datenblatt',
    'ship.dims.title': 'Maße & Fracht',
    'ship.dims.top': 'Draufsicht · maßstäblich zum größten Schiff im Katalog',
    'ship.dims.cargo': 'Frachtraum',
    'ship.dims.oreExtra': 'zusätzlich Erz',
    'ship.arms.title': 'Bewaffnung',
    'ship.arms.hint': 'Kästchen = Waffenaufhängung, Zahl = Größenklasse. Gold = Raketen/Torpedos.',
    'ship.flight.title': 'Flugleistung',
    'ship.flight.agility': 'Agilität',
    'ship.flight.quantum': 'Quantum-Reise',
    'ship.comp.title': 'Komponenten & Verteidigung',
    'ship.ins.title': 'Versicherung',
    'ship.ins.hint': 'Claim = kostenlose Wiederbeschaffung nach Verlust; Express verkürzt die Wartezeit gegen aUEC.',
    'ship.paints.title': 'Lackierungen',
    'ship.series.title': 'Varianten & Loaner',
    'ship.series.variants': 'Varianten der Baureihe',
    'ship.series.loaners': 'Loaner (bis zur Flugfreigabe)',
    'ship.spine.title': 'Im Patch-Archiv',
    'ship.similar.title': 'Ähnliche Schiffe',
    'ship.similar.noimg': 'KEIN BILD',
    'ship.links.all': '← Alle Schiffe',
    'ship.source': 'Quelle:',
    'ship.source.wikiNote': 'Community-Projekt, Daten aus den Spieldateien',
    'ship.source.gameData': 'Spieldaten',
    'ship.source.image': 'Bild',
    'ship.source.ingame': 'Ingame-Preise',
    'ship.source.extras': '3D-Modell, Lackierungen & Serien-Daten',
    'ship.asof': 'Stand',
  },
  en: {
    // -- Navigation --
    'nav.ships': 'Ships',
    'nav.evolution': 'Evolution',
    'nav.search': 'Search',
    'nav.search.open': 'Open search (Ctrl+K)',
    'nav.search.kbd': 'Ctrl K',
    'nav.patches': 'Patches',
    'nav.topics': 'Topics',
    'nav.menu': 'Menu',
    'nav.menu.open': 'Open menu',
    'nav.section': 'Navigation',
    'nav.main': 'Main navigation',
    'nav.path': 'Path',
    'nav.home': 'Home',
    'nav.home.aria': 'SC Archive — Home',
    'nav.allPatches': 'All patches',
    'nav.allTopics': 'All topics',
    'nav.ships.long': 'Ships & Vehicles — Database',
    'nav.evolution.long': 'Evolution — Systems × Patches',
    'nav.langSwitch': 'Switch language',
    // -- Breadcrumbs --
    'crumbs.archive': 'Archive',
    'crumbs.ships': 'Ships',
    // -- Search (overlay) --
    'search.dialog': 'Search the archive',
    'search.placeholder': 'Patches, topics, ships, features…',
    'search.term': 'Search term',
    'search.sys': 'Archive&nbsp;//&nbsp;Search',
    'search.close': 'Close search',
    'search.results': 'Search results',
    'search.pick': 'select',
    'search.open': 'open',
    'search.dismiss': 'close',
    'search.empty.title': 'No entry in the register',
    'search.empty.query': 'Query “%q%” ',
    'search.empty.hint': 'returned no matches — try a version or codename.',
    // -- Pager --
    'pager.older': '← Older',
    'pager.newer': 'Newer →',
    'pager.latest': 'Latest patch',
    'pager.nav': 'Patch navigation',
    // -- Skip link --
    'skip.toContent': 'Skip to content',
    // -- Footer / Attribution --
    'footer.pageNav': 'Page navigation',
    'footer.sources': 'Sources',
    'footer.credit': 'SC Patch Archive · a fan project',
    'footer.dataAsOf': 'Data as of',
    'footer.disclaimer':
      'Unofficial fan project for documentation purposes. Star Citizen® and all related marks are property of Cloud Imperium Rights LLC & Ltd. Not affiliated with or endorsed by Cloud Imperium Games. Wiki content from starcitizen.tools is licensed under CC-BY-SA 4.0; embedded trailers and stills © Cloud Imperium Games (fan-content use).',
    // -- Ship data sheet (template chrome; data-row labels from src/lib -> Stufe 2) --
    'ship.pill': 'DATA SHEET',
    'ship.title.suffix': 'Data Sheet',
    'ship.novisual': 'No visual in the dataset',
    'ship.view.img': 'Image',
    'ship.view.3d': '3D Holo',
    'ship.view.switch': 'Switch view',
    'ship.holo.drag': '3D view — drag to rotate',
    'ship.stage.length': 'Length',
    'ship.stage.crew': 'Crew',
    'ship.stage.cargo': 'Cargo',
    'ship.stage.scm': 'SCM',
    'ship.stage.priceIngame': 'In the ’verse from',
    'ship.stage.pledge': 'Pledge',
    'ship.buy.title': 'Buy in the ’verse',
    'ship.buy.cheapest': 'cheapest location:',
    'ship.buy.more': 'more locations',
    'ship.buy.none': 'Currently not purchasable at in-game terminals — pledge only.',
    'ship.rent.title': 'Rent',
    'ship.rent.perDay': '/ day',
    'ship.pledge': 'Pledge:',
    'ship.pledge.store': 'RSI Pledge Store ↗',
    'ship.buy.hint': 'In-game prices: UEX Corp (community data) · change with patches and events.',
    'ship.profile.title': 'Performance profile',
    'ship.profile.rank': 'percentile in the catalog',
    'ship.profile.hint': 'P100 = top value in the catalog, P50 = mid-field — the bar’s center marks the median.',
    'ship.sheet.title': 'Data sheet',
    'ship.dims.title': 'Dimensions & Cargo',
    'ship.dims.top': 'Top view · to scale with the largest ship in the catalog',
    'ship.dims.cargo': 'Cargo hold',
    'ship.dims.oreExtra': 'additional ore',
    'ship.arms.title': 'Armament',
    'ship.arms.hint': 'Box = weapon mount, number = size class. Gold = missiles/torpedoes.',
    'ship.flight.title': 'Flight performance',
    'ship.flight.agility': 'Agility',
    'ship.flight.quantum': 'Quantum travel',
    'ship.comp.title': 'Components & Defense',
    'ship.ins.title': 'Insurance',
    'ship.ins.hint': 'Claim = free replacement after loss; Expedite shortens the wait for aUEC.',
    'ship.paints.title': 'Paints',
    'ship.series.title': 'Variants & Loaners',
    'ship.series.variants': 'Variants of the series',
    'ship.series.loaners': 'Loaners (until flight-ready)',
    'ship.spine.title': 'In the patch archive',
    'ship.similar.title': 'Similar ships',
    'ship.similar.noimg': 'NO IMAGE',
    'ship.links.all': '← All ships',
    'ship.source': 'Source:',
    'ship.source.wikiNote': 'community project, data from the game files',
    'ship.source.gameData': 'game data',
    'ship.source.image': 'Image',
    'ship.source.ingame': 'In-game prices',
    'ship.source.extras': '3D model, paints & series data',
    'ship.asof': 'as of',
  },
} as const;

export type UIKey = keyof (typeof UI)['de'];

/** t = useTranslations(lang): sichere Übersetzungsfunktion mit de-Fallback. */
export function useTranslations(lang: Locale) {
  return function t(key: UIKey): string {
    return UI[lang]?.[key] ?? UI[DEFAULT_LOCALE][key] ?? String(key);
  };
}

/** Locale aus dem URL-Pfad ableiten: /en/... -> 'en', sonst 'de'. */
export function localeFromPath(pathname: string): Locale {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : DEFAULT_LOCALE;
}

/**
 * Denselben Seiten-Pfad in die andere Sprache umschreiben (für den Umschalter).
 * de:  /patches/sc-4-8-2.html        <-> en: /en/patches/sc-4-8-2.html
 * de:  /index.html (oder /)          <-> en: /en/index.html
 * Behält also die Seite bei und wechselt nur die Sprache.
 */
export function pathForLocale(pathname: string, target: Locale): string {
  const stripped = pathname.replace(/^\/en(?=\/|$)/, '') || '/';
  if (target === DEFAULT_LOCALE) return stripped;
  return '/en' + (stripped === '/' ? '/index.html' : stripped);
}

/**
 * Locale-bewusster interner Link: nimmt einen DE-Form-Pfad (z. B.
 * "/schiffe/x.html") und präfixt ihn für EN mit /en. DE bleibt unverändert.
 * So bleiben interne Verweise innerhalb der gewählten Sprache.
 */
export function href(path: string, lang: Locale): string {
  if (lang === DEFAULT_LOCALE) return path;
  return '/en' + path;
}
