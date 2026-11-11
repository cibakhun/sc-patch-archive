// Symbole der Crafting-Werkbank (Prototyp, nur Vorschau-Bau): ein Zeichen je
// Bauteilart, eigene Linienzeichnungen im 24er-Raster (Strich 1.6, runde
// Enden). Krisz 11.11.2026: „jetzt möchte ich dass du mal das design auf dem
// höchsten niveou bringst“, „also grafik ui animations etc“.
//
// Eine Quelle fuer alles: die Zeichen stehen hier als SVG-Innenleben,
// wbGlyphCss() macht daraus CSS-Masken (data:-Adressen, die CSP erlaubt
// img-src data:). Karten, Rezeptkopf und Planer tragen nur data-g="<art>",
// keine 1.6 SVGs im Markup. Farbe kommt aus der Flaeche (background).
//
// Die Art kommt aus Spielfeldern, nie aus dem Anzeigenamen: Kategoriepfad des
// Rezepts (Weapons / Pistol, Vehiclegear / Shield ...), bei Ruestung die
// Kategorie des Items aus dem Katalog (Armour / Helmets, / Core, / Arms ...).
import type { Blueprint } from './crafting';

export const WB_GLYPHS: Record<string, string> = {
  // Ruestung
  helm: '<path d="M6 14v-3a6 6 0 0 1 12 0v3"/><path d="M6 14l1.6 5.5h8.8L18 14"/><path d="M8.6 11h6.8l-.9 3.2H9.5z"/>',
  core: '<path d="M8.5 4 12 5.6 15.5 4l3.5 3-2 3.2V20H7v-9.8L5 7z"/><path d="M12 5.6V11"/><path d="M9.5 14.5h5"/>',
  arms: '<path d="M8 16.5V7.6a3.6 3.6 0 0 1 7.2 0v3.9l1.8-1.6a1.4 1.4 0 0 1 2 2l-3.8 4.6"/><path d="M8 16.5h7.2V20.2H8z"/><path d="M11.6 7.8v3.4"/>',
  legs: '<path d="M7.5 4h9l-.4 7.5.9 8.5h-3.4L12.5 9.5h-1L10.4 20H7l.9-8.5z"/><path d="M8.1 13.5H11"/><path d="M13 13.5h2.9"/>',
  pack: '<path d="M7 9a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z"/><path d="M10 6V5a2 2 0 0 1 4 0v1"/><path d="M9.5 13h5v3.5h-5z"/>',
  suit: '<circle cx="12" cy="5.6" r="2.3"/><path d="M6.5 20v-6.5a4 4 0 0 1 4-4h3a4 4 0 0 1 4 4V20"/><path d="M9.8 20v-5.5"/><path d="M14.2 20v-5.5"/>',
  // Handwaffen
  pistol: '<path d="M3.5 7.5H18V11H3.5z"/><path d="M6.3 11 5 18.5h4.2l1.3-4.5"/><path d="M14.5 11v1.6a1.9 1.9 0 0 1-1.9 1.9h-2.1"/>',
  rifle: '<path d="M2.5 9.5 7 10v3l-4.5 1.5z"/><path d="M7 9.5h8.5V13H7z"/><path d="M15.5 11.2h6"/><path d="M10.8 13l-.7 5h2.8l.5-5"/><path d="M8.4 13l-.6 3"/>',
  smg: '<path d="M5.5 8H15v4H5.5z"/><path d="M15 10h4.5"/><path d="M9 12v7.5h2.6V12"/><path d="M13.2 12l.7 3.8"/><path d="M5.5 9.5H2.8"/><path d="M2.8 8v3.4"/>',
  shotgun: '<path d="M2.5 10.8 7.5 9.5v3.8l-5 1.7z"/><path d="M7.5 9.5h14v1.8h-14"/><path d="M11 13.3h6.5"/><path d="M11 11.3v2M17.5 11.3v2"/><path d="M8.3 13.3l-.7 3"/>',
  sniper: '<path d="M2.5 11.2 7 10.5v3l-4.5 1.7z"/><path d="M7 10.5h7v3H7z"/><path d="M14 11.8h8"/><path d="M8 7.8h6.5"/><path d="M9.5 7.8v2.7"/><path d="M13 7.8v2.7"/><path d="M17.5 11.8l-1.3 5"/><path d="M17.5 11.8l1.5 5"/>',
  lmg: '<path d="M2.5 10 6.5 9.5v4l-4 1z"/><path d="M6.5 9H15v4H6.5z"/><path d="M15 11h6.5"/><path d="M8.5 13H13v4.5H8.5z"/><path d="M18.5 11l-1.3 5.5"/><path d="M18.5 11l1.6 5.5"/>',
  weapon: '<circle cx="12" cy="12" r="6.2"/><path d="M12 3v4.2M12 16.8V21M3 12h4.2M16.8 12H21"/><circle cx="12" cy="12" r=".9" fill="#000" stroke="none"/>',
  // Munition
  mag: '<path d="M6.5 20v-9.5c0-2.3 1.2-4.4 2.5-6 1.3 1.6 2.5 3.7 2.5 6V20z"/><path d="M6.5 16h5"/><path d="M13.5 20v-7c0-1.9.9-3.6 2-5 1.1 1.4 2 3.1 2 5v7z"/><path d="M13.5 17h4"/>',
  // Schiffskomponenten
  gun: '<path d="M3 10.5h3.8L8.3 9H15v6H8.3l-1.5-1.5H3z"/><path d="M15 10.5h6v3h-6"/><path d="M21 9.3v5.4"/><path d="M9.8 15v2.6h3.9V15"/><path d="M7.5 19.8H16"/>',
  shield: '<path d="M12 3.5 5.5 6v5.5c0 4.2 2.7 7.4 6.5 9 3.8-1.6 6.5-4.8 6.5-9V6z"/><path d="M12 7.4 8.8 8.6v2.9c0 2.1 1.3 3.8 3.2 4.7 1.9-.9 3.2-2.6 3.2-4.7V8.6z"/>',
  cooler: '<path d="M12 3.5v17"/><path d="M4.6 7.75l14.8 8.5"/><path d="M19.4 7.75 4.6 16.25"/><path d="M9.8 5 12 7l2.2-2"/><path d="M9.8 19 12 17l2.2 2"/>',
  power: '<path d="M12 3 19.8 7.5v9L12 21l-7.8-4.5v-9z"/><path d="M13 7.5 9.2 12.7h2.9l-1 3.8 3.9-5.3h-3z"/>',
  quantum: '<circle cx="12" cy="12" r="1.8"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(-32 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(32 12 12)"/>',
  radar: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.2"/><path d="M12 12l6-6"/><circle cx="8.3" cy="14.6" r=".9" fill="#000" stroke="none"/>',
  mining: '<path d="M16.5 7.5 5 19"/><path d="M10 5.2c3.3.3 5.5 1.3 6.9 2.7s2.4 3.6 2.7 6.9"/>',
  tractor: '<path d="M6 4v8.5a6 6 0 0 0 12 0V4h-3.6v8.5a2.4 2.4 0 0 1-4.8 0V4z"/><path d="M6 7.6h3.6"/><path d="M14.4 7.6H18"/>',
  salvage: '<path d="M9.5 4.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5h3.5"/><path d="M14.5 4.5H18A1.5 1.5 0 0 1 19.5 6v12a1.5 1.5 0 0 1-1.5 1.5h-3.5"/><path d="M12 6v2M12 11v2M12 16v2"/>',
  fuel: '<path d="M12 3.5c3.2 4 5.5 6.8 5.5 10a5.5 5.5 0 0 1-11 0c0-3.2 2.3-6 5.5-10z"/><path d="M9.3 14.2a2.7 2.7 0 0 0 2.7 2.7"/>',
  module: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4"/><path d="M12 12v8"/>',
  // Rest (Missionsgegenstaende): das Bauplan-Zeichen der Seite
  bp: '<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><circle cx="9.5" cy="9.5" r="2.5"/><path d="M9.5 5.4v1.6M9.5 11.5v1.6M5.4 9.5H7M12 9.5h1.6"/><path d="M6.5 17h11M15.5 5.5v6"/>',
};

// Bedienzeichen (keine Bauteilart): als CSS-Variable --i-<name> an .cdb--wb.
export const WB_ICONS: Record<string, string> = {
  clock: '<circle cx="12" cy="12" r="8.2"/><path d="M12 7.5V12l3 2"/>',
  parts: '<path d="M12 3.5 19 7.5v9l-7 4-7-4v-9z"/><path d="M5 7.5l7 4 7-4"/><path d="M12 11.5v9"/>',
  mission: '<path d="M12 3.5 20.5 12 12 20.5 3.5 12z"/><circle cx="12" cy="12" r="2.2"/>',
  star: '<path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  filter: '<path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h12M20 17h0"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="17" r="2"/>',
  search: '<circle cx="11" cy="11" r="6.2"/><path d="M20 20l-4.4-4.4"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/>',
  list: '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.9"/><path d="M12 16.8v.2"/>',
  arrow: '<path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5"/>',
  pick: '<path d="M12 20.5s6.2-5.9 6.2-10.6a6.2 6.2 0 0 0-12.4 0c0 4.7 6.2 10.6 6.2 10.6z"/><circle cx="12" cy="9.9" r="2.2"/>',
  chev: '<path d="M6 9l6 6 6-6"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.5h9.2L17.5 7M10 10.5v6M14 10.5v6"/>',
  fab: '<path d="M4 20V10l5 3V10l5 3V5h6v15z"/><path d="M8 16.5h2M13 16.5h2"/>',
  tier: '<path d="M12 4.5 20 8.5l-8 4-8-4z"/><path d="M4 12.5l8 4 8-4"/><path d="M4 16.5l8 4 8-4"/>',
  back: '<path d="M19 12H5M10.5 6.5 5 12l5.5 5.5"/>',
};
// Gefuellte und kraeftigere Fassungen (eigene Strichstaerke bzw. Fuellung).
const WB_ICONS_SONDER: Record<string, [string, number, boolean]> = {
  starf: [WB_ICONS.star, 1.8, true],
  check3: [WB_ICONS.check, 3, false],
};

const svgUrl = (inner: string, sw = 1.6, farbe = '#000', gefuellt = false) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='${gefuellt ? farbe : 'none'}' stroke='${farbe}' stroke-width='${sw}' stroke-linecap='round' stroke-linejoin='round'>${inner.replace(/"/g, "'")}</svg>`,
  ).replace(/%20/g, ' ').replace(/%3D/g, '=').replace(/%3A/g, ':').replace(/%2F/g, '/').replace(/%2C/g, ',')}")`;

/** CSS: --g je Bauteilart (an jedem Element mit data-g), --i-* an .cdb--wb. */
export function wbGlyphCss(): string {
  const arten = Object.entries(WB_GLYPHS).map(([k, v]) => `.cdb--wb [data-g="${k}"]{--g:${svgUrl(v)}}`).join('\n');
  const zeichen = Object.entries(WB_ICONS).map(([k, v]) => `--i-${k}:${svgUrl(v, 1.8)}`).join(';');
  const sonder = Object.entries(WB_ICONS_SONDER).map(([k, [v, sw, voll]]) => `--i-${k}:${svgUrl(v, sw, '#000', voll)}`).join(';');
  // --bi-*: dieselben Zeichen in fester Farbe, fuer background-image (dort
  // laesst sich nichts einfaerben): Pfeil am Auswahlfeld, Plus im leeren Planer.
  const bilder = `--bi-chev:${svgUrl(WB_ICONS.chev, 2, '#9ba2ae')};--bi-plus:${svgUrl(WB_ICONS.plus, 2, '#878e9b')}`;
  const klassen = Object.keys(WB_ICONS).map((k) => `.cdb--wb .wi--${k}{--wi:var(--i-${k})}`).join('\n');
  return `.cdb--wb{${zeichen};${sonder};${bilder}}\n${klassen}\n${arten}`;
}

const WAFFE: Record<string, string> = { Pistol: 'pistol', Rifle: 'rifle', SMG: 'smg', Shotgun: 'shotgun', Sniper: 'sniper', LMG: 'lmg' };
const SCHIFF: Record<string, string> = {
  Cooler: 'cooler', Mininglaser: 'mining', Powerplant: 'power', Quantumdrive: 'quantum', Radar: 'radar',
  Refuelling: 'fuel', Salvage: 'salvage', Shield: 'shield', Tractorbeam: 'tractor', Weapons: 'gun',
};
const RUESTUNG: Record<string, string> = {
  'Armour / Helmets': 'helm', 'Armour / Core': 'core', 'Armour / Arms': 'arms', 'Armour / Legs': 'legs',
  'Armour / Backpacks': 'pack', 'Armour / Undersuits': 'suit',
};

/**
 * Bauteilart eines Rezepts fuer sein Zeichen. `itemKategorie` ist die
 * Kategorie des hergestellten Items aus dem Katalog (nur fuer Ruestung
 * gebraucht: der Rezeptpfad nennt dort Klasse und Gewicht, nicht das Teil).
 * Unbekanntes faellt auf ein allgemeines Zeichen seiner Gruppe zurueck.
 */
export function wbGlyphKey(b: Pick<Blueprint, 'category'>, itemKategorie?: string | null): string {
  const [top = '', sub = ''] = (b.category || '').split('/').map((s) => s.trim());
  if (top === 'Weapons') return WAFFE[sub] ?? 'weapon';
  if (top === 'Ammo') return 'mag';
  if (top === 'Vehiclegear') return SCHIFF[sub] ?? 'module';
  if (top === 'Armour') return RUESTUNG[itemKategorie ?? ''] ?? 'suit';
  return 'bp';
}
