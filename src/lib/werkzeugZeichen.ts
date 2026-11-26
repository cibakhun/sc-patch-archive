// Zeichen des Werkzeug-Standards (Items-Werkbank, 24.11.2026): eine
// Linienzeichnung je Art im 24er-Raster, Strich 1.6, runde Enden. Die
// Zeichen der Crafting-Werkbank (werkbankGlyphs.ts) werden mitgenommen, nicht
// kopiert; hier kommen die Arten dazu, die es nur im Item-Katalog gibt
// (Kleidung, Fahrzeuge, Aufsaetze, Verbrauch, Schiffswaffen ...).
//
// Wie dort: das Markup traegt nur data-g="<art>", die Zeichnung kommt als
// CSS-Maske (data:-Adresse, CSP erlaubt img-src data:), die Farbe aus der
// Flaeche dahinter. Bedienzeichen stehen als --i-<name> an der Werkbank.
import { WB_GLYPHS, WB_ICONS } from './werkbankGlyphs';

const NEU: Record<string, string> = {
  // Aufsaetze
  barrel: '<path d="M3 10h12.5v4H3z"/><path d="M15.5 9h2.5v6h-2.5"/><path d="M18 10.5h3v3h-3"/><path d="M7 10v4M10.5 10v4"/>',
  grip: '<path d="M4 7h16v3H4z"/><path d="M7 7v3M10 7v3M13 7v3M16 7v3"/><path d="M10.5 10l-.9 9.5h4.2L13 10"/>',
  scope: '<path d="M3 9.5h3v5H3zM18 9.5h3v5h-3z"/><path d="M6 10.5h12v3H6z"/><path d="M10 13.5v3.5h4v-3.5"/>',
  clip: '<path d="M8.5 3.5h6v5l1.5 11.5H10L8.5 8.5z"/><path d="M8.5 8.5h6"/><path d="M11 12.5h3.3M11.5 16h3.3"/>',
  // Schiffswaffen
  missile: '<path d="M3.5 12 6 9.5h11.5L21 12l-3.5 2.5H6z"/><path d="M6 9.5 4.5 6.5M6 14.5l-1.5 3"/><path d="M14.5 9.5v5"/>',
  torpedo: '<path d="M3 12 5.5 8.5h12a3.5 3.5 0 0 1 0 7h-12z"/><path d="M5.5 8.5 4 6M5.5 15.5 4 18"/><path d="M9.5 8.5v7M13.5 8.5v7"/>',
  bomb: '<path d="M12 3.5c2.5 1.6 3.5 4.2 3.5 7.5v4.5h-7V11c0-3.3 1-5.9 3.5-7.5z"/><path d="M8.5 15.5 7 19.5h10l-1.5-4"/><path d="M12 15.5v4"/>',
  rack: '<path d="M3.5 5.5h17"/><path d="M7 5.5v3M17 5.5v3"/><path d="M5 8.5h4v9l-2 2.5-2-2.5zM15 8.5h4v9l-2 2.5-2-2.5z"/>',
  turret: '<path d="M4.5 19h15"/><path d="M6.5 19v-3.5a5.5 5.5 0 0 1 11 0V19"/><path d="M13 10.8 20 6.5M14.6 12.8 21 9"/>',
  flare: '<circle cx="12" cy="12" r="2.6"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3M6 6l2.1 2.1M15.9 15.9 18 18M18 6l-2.1 2.1M8.1 15.9 6 18"/>',
  emp: '<circle cx="12" cy="12" r="8.5"/><path d="M13 6.5 9 12.5h3.5L11 17.5l4-6h-3.5z"/>',
  // Schiffsteile
  blade: '<path d="M3.5 16.5 18 5.5c1.6-1 3 .4 2 2L9.5 20.5z"/><path d="M8 15l3 2"/>',
  life: '<path d="M12 20.5c-4.5-2-7-5.4-7-9.5 0-3 1.2-5.3 3-7 2.2 2 4 4.7 4 8 0-3.3 1.8-6 4-8 1.8 1.7 3 4 3 7 0 4.1-2.5 7.5-7 9.5z"/><path d="M12 12v8.5"/>',
  livery: '<rect x="4" y="3.5" width="14" height="5" rx="1.2"/><path d="M18 6h2v5.5h-8V14"/><path d="M10.8 14h2.4v6.5h-2.4z"/>',
  arm: '<path d="M4 20.5h7"/><path d="M7.5 20.5v-4l4-6.5"/><circle cx="11.5" cy="9.5" r="1.6"/><path d="M12.8 8.5 17.5 5"/><path d="M17.5 5l2.5 1.5M17.5 5l.5-2.5"/>',
  fabr: WB_ICONS.fab,
  seat: '<path d="M7.5 3.5H11l-1 9h6a2 2 0 0 1 2 2V16H7z"/><path d="M12 16v4.5M8.5 20.5h7"/>',
  thruster: '<path d="M9 3.5h6v3H9z"/><path d="M10 6.5c0 3-3 5.5-3 9h10c0-3.5-3-6-3-9"/><path d="M9.5 18v1.8M12 18v2.8M14.5 18v1.8"/>',
  // Zugang und Aussehen
  card: '<rect x="3.5" y="6" width="17" height="12" rx="1.8"/><rect x="6.5" y="9" width="4" height="3.2" rx=".6"/><path d="M6.5 15h7M15.5 9.5h2"/>',
  face: '<circle cx="12" cy="9" r="5"/><path d="M7.2 7.8c2.4.4 4.8-.4 6.3-2.6 1 1.3 2.3 2.1 3.8 2.4"/><path d="M5 20.5c.7-3.3 3.6-5.5 7-5.5s6.3 2.2 7 5.5"/>',
  plate: '<path d="M4 7.5 12 4l8 3.5"/><path d="M4 7.5v5L12 16l8-3.5v-5"/><path d="M4 12.5v4L12 20l8-3.5v-4"/>',
  ship: '<path d="M12 3 14.5 9.5 21 13v2.5l-6.5-1.5-1.5 6.5h-2L9.5 14 3 15.5V13l6.5-3.5z"/>',
  chip: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/><rect x="9.5" y="9.5" width="5" height="5" rx=".6"/><path d="M9.5 6.5V4M14.5 6.5V4M9.5 20v-2.5M14.5 20v-2.5M6.5 9.5H4M6.5 14.5H4M20 9.5h-2.5M20 14.5h-2.5"/>',
  // Kleidung
  shirt: '<path d="M9 4 4 6.5l1.8 4 2.2-1V20h8V9.5l2.2 1 1.8-4L15 4a3 3 0 0 1-6 0z"/>',
  jacket: '<path d="M9 3.5 4.5 6l-1 7 2.5.7v6.8h12v-6.8l2.5-.7-1-7L15 3.5"/><path d="M9 3.5 12 7l3-3.5"/><path d="M12 7v13.5"/><path d="M8.3 13h1.6M14.1 13h1.6"/>',
  pants: '<path d="M6.5 3.5h11l1 16.5h-4.5L12 10l-2 10H5.5z"/><path d="M6.5 6.5h11"/>',
  shoe: '<path d="M7 4h5v8l6 2a2.5 2.5 0 0 1 1.7 2.4V19H4.5L5 16l2-1.5z"/><path d="M4.7 17h15"/>',
  glove: '<path d="M8 20v-4.5L5.3 12a1.4 1.4 0 0 1 2.2-1.7L9 12V6a1.5 1.5 0 0 1 3 0v5V5a1.5 1.5 0 0 1 3 0v6V7a1.5 1.5 0 0 1 3 0v7.5L16.5 20z"/><path d="M8 17.2h9.2"/>',
  hat: '<path d="M5 15a7 7 0 0 1 14 0"/><path d="M3 15h18v1.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5z"/><path d="M12 8V6.3"/>',
  // Verbrauch und Werkzeug
  gadget: '<rect x="7" y="3.5" width="10" height="17" rx="2"/><path d="M10 7h4"/><circle cx="12" cy="14" r="2.5"/>',
  battery: '<rect x="4" y="7.5" width="14.5" height="9" rx="1.5"/><path d="M18.5 10.5H20v3h-1.5"/><path d="M11.8 9.5 9.8 12.3h3l-2 2.7"/>',
  medpen: '<path d="M16 3.5l4.5 4.5"/><path d="M18.2 5.8 8.5 15.5l-3-3 9.7-9.7"/><path d="M7 14 3.5 20.5 10 17"/><path d="M11 10l2 2"/>',
  crate: '<rect x="3.5" y="6" width="17" height="13" rx="1"/><path d="M3.5 10h17"/><path d="M10 6v4M14 6v4"/><path d="M10 13.5h4"/>',
  drink: '<path d="M6 8h10l-1.2 11.5H7.2z"/><path d="M16 10h1.5a2.4 2.4 0 0 1 0 4.8h-1.9"/><path d="M9 3.5c0 1 1 1 1 2.5M12.5 3.5c0 1 1 1 1 2.5"/>',
  food: '<path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0z"/><path d="M8.5 20h7"/><path d="M13.5 9 18 4.5M16 10l4.5-4.5"/>',
  mobi: '<rect x="6.5" y="7" width="11" height="10" rx="2"/><path d="M9 7l.8-3.5h4.4L15 7M9 17l.8 3.5h4.4L15 17"/><path d="M9.5 12h5"/>',
  grenade: '<circle cx="11" cy="14" r="6"/><path d="M9 8.6V6.5h4v2.1"/><path d="M13 6.5 16.5 5"/><path d="M16.5 5a2 2 0 1 1 1 3.7"/>',
  knife: '<path d="M4 20l5-5"/><path d="M9 15 19.5 4.5c.5 3.5-1 7-4 9.5l-2.5 2"/><path d="M7.5 13.5l3 3"/>',
  grid4: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  deko: '<path d="M12 3.5l1.8 5 5 1.8-5 1.8-1.8 5-1.8-5-5-1.8 5-1.8z"/><path d="M18 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
};

/** Alle Arten: die der Crafting-Werkbank und die neuen. */
export const WZ_ZEICHEN: Record<string, string> = { ...WB_GLYPHS, ...NEU };

/** Bedienzeichen: die der Werkbank und was der Katalog braucht. */
export const WZ_BEDIEN: Record<string, string> = {
  ...WB_ICONS,
  sheet: '<path d="M6.5 3.5h7.5l4 4v13H6.5z"/><path d="M14 3.5v4h4"/><path d="M9.5 12h5M9.5 15.5h5"/>',
  shop: '<path d="M4 9.5 5.5 4.5h13L20 9.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5.5 11.5V20h13v-8.5"/><path d="M10 20v-4.5h4V20"/>',
  loot: '<path d="M3.5 9.5h17v10h-17z"/><path d="M3.5 9.5 6 4.5h12l2.5 5"/><path d="M10 13h4"/>',
  tag: '<path d="M3.5 12.5v-8h8l9 9-8 8z"/><circle cx="7.8" cy="8.8" r="1.4"/>',
  layers: '<path d="M12 4l8.5 4.5L12 13 3.5 8.5z"/><path d="M3.5 12.5 12 17l8.5-4.5"/>',
  gem: '<path d="M7 4h10l3.5 5L12 20.5 3.5 9z"/><path d="M3.5 9h17M9.5 4 12 9l2.5-5M12 9v11.5"/>',
  ship: NEU.ship,
  grid4: NEU.grid4,
  // Erze: Verweis auf die Mining-Seite (Kartenzeile und Haupthandlung im Datenblatt).
  mining: WB_GLYPHS.mining,
};

const SONDER: Record<string, [string, number, boolean]> = {
  starf: [WB_ICONS.star, 1.8, true],
  check3: [WB_ICONS.check, 3, false],
};

const svgUrl = (inner: string, sw = 1.6, farbe = '#000', gefuellt = false) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='${gefuellt ? farbe : 'none'}' stroke='${farbe}' stroke-width='${sw}' stroke-linecap='round' stroke-linejoin='round'>${inner.replace(/"/g, "'")}</svg>`,
  ).replace(/%20/g, ' ').replace(/%3D/g, '=').replace(/%3A/g, ':').replace(/%2F/g, '/').replace(/%2C/g, ',')}")`;

/**
 * CSS der Zeichen fuer eine Werkbank (Wurzelklasse `scope`): --g je Art an
 * jedem Element mit data-g, --i-<name> an der Wurzel, .wi--<name> setzt --wi.
 */
export function wzZeichenCss(scope = '.wz'): string {
  const arten = Object.entries(WZ_ZEICHEN).map(([k, v]) => `${scope} [data-g="${k}"]{--g:${svgUrl(v)}}`).join('\n');
  const zeichen = Object.entries(WZ_BEDIEN).map(([k, v]) => `--i-${k}:${svgUrl(v, 1.8)}`).join(';');
  const sonder = Object.entries(SONDER).map(([k, [v, sw, voll]]) => `--i-${k}:${svgUrl(v, sw, '#000', voll)}`).join(';');
  const bilder = `--bi-chev:${svgUrl(WB_ICONS.chev, 2, '#9d9cb0')}`;
  const klassen = Object.keys(WZ_BEDIEN).map((k) => `${scope} .wi--${k}{--wi:var(--i-${k})}`).join('\n');
  return `${scope}{${zeichen};${sonder};${bilder}}\n${klassen}\n${arten}`;
}
