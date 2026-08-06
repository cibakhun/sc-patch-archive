// Werkzeug-Hilfe — EIGENER Katalog, bewusst getrennt von src/i18n/ui.ts.
// ---------------------------------------------------------------------------
// Zweck: Zweck- und Bedienungstexte fuer die elf Werkzeuge (Phase
// 01.2-werkzeuge-erklaeren), in zwei Stufen:
//   Stufe 1 — <werkzeug>.title / .purpose / .step1..step5 (Zweck-Abschnitt)
//   Stufe 2 — <werkzeug>.ctl.<art> (ein Satz je Bedienelement-ART)
// Dazu drei gemeinsame Bedientexte (ui.elements/.elementsOff/.bubbleLabel).
//
// Vorbild fuer Aufbau und Kopfkommentar: src/i18n/itemText.ts — eigenes
// i18n-Modul neben ui.ts, weil ui.ts mit 841 Zeilen schon gross genug ist
// (CONTEXT.md, Claude's Discretion).
//
// UNTERSCHIED zu useTranslations() aus ui.ts: dort faellt t() bei einem
// fehlenden Schluessel sichtbar auf Englisch zurueck (ui.ts:11/794) — genau
// das ist bei Hilfetexten verboten (DOC-04). useHelp() hier wirft deshalb
// stattdessen, und assertHelpParity() bricht bereits den Build ab, bevor
// eine Seite ueberhaupt gerendert wird.
//
// Tonfall (D-04/D-06): anredefrei, kein Du, kein Sie, erklaert die SEITE,
// nicht das Spiel. Kein Hinweis auf die Herkunft der Daten — durchgesetzt
// von `npm run audit:site`.
import type { Locale } from './ui';

/**
 * Schluessel, deren Wert in DE und EN ABSICHTLICH byte-gleich ist (z. B. ein
 * Eigenname). assertHelpParity() akzeptiert Gleichheit NUR fuer Schluessel in
 * dieser Liste — sonst gilt Gleichheit als vergessene Uebersetzung. Aktuell
 * leer; kuenftige Plaene tragen hier ein, was sie bewusst gleich lassen.
 */
const SAME_IN_BOTH = new Set<string>([]);

export const HELP = {
  de: {
    // -- Gemeinsame Bedientexte (alle elf Werkzeuge) --
    'ui.elements': 'Elemente erklären',
    'ui.elementsOff': 'Erklärung beenden',
    'ui.bubbleLabel': 'Erklärung',

    // -- Item Finder --
    'itemfinder.title': 'Wie funktioniert der Item Finder?',
    'itemfinder.purpose':
      'Durchsucht alle Gegenstände des Spiels und zeigt zu jedem Größe, Werte und Bezugsquellen.',
    'itemfinder.step1': 'Suchbegriff eingeben oder Filter in der Seitenleiste wählen.',
    'itemfinder.step2': 'Nach Fundart, Größe, Panzerungsklasse oder Seltenheit einschränken.',
    'itemfinder.step3': 'Ergebnisse sortieren oder zwischen Einzelteilen und Sets wechseln.',
    'itemfinder.step4': 'Auf eine Karte klicken für Details, Werte und Fundorte.',
    'itemfinder.ctl.search': 'Freitextsuche über Namen und Beschreibung.',
    'itemfinder.ctl.kind': 'Schränkt auf eine Fundart ein, etwa kaufbar, Loot oder nur Katalog.',
    'itemfinder.ctl.size': 'Schränkt auf eine Größenklasse ein.',
    'itemfinder.ctl.weight': 'Schränkt auf eine Panzerungsklasse ein.',
    'itemfinder.ctl.rarity': 'Schränkt auf eine Seltenheitsstufe ein.',
    'itemfinder.ctl.category': 'Wählt eine Kategorie aus der Liste.',
    'itemfinder.ctl.view': 'Wechselt zwischen Einzelteilen und vollständigen Sets.',
    'itemfinder.ctl.sort': 'Legt die Sortierung der Ergebnisse fest.',
  },
  en: {
    // -- Shared control copy (all eleven tools) --
    'ui.elements': 'Explain elements',
    'ui.elementsOff': 'Stop explaining',
    'ui.bubbleLabel': 'Explanation',

    // -- Item Finder --
    'itemfinder.title': 'How does the Item Finder work?',
    'itemfinder.purpose':
      'Searches every item in the game and shows size, stats and where to get it for each one.',
    'itemfinder.step1': 'Type a search term or pick filters in the sidebar.',
    'itemfinder.step2': 'Narrow down by availability, size, armor class or rarity.',
    'itemfinder.step3': 'Sort the results or switch between individual pieces and sets.',
    'itemfinder.step4': 'Click a card for details, stats and where to find it.',
    'itemfinder.ctl.search': 'Free-text search across name and description.',
    'itemfinder.ctl.kind': 'Narrows down to an availability type, such as purchasable, loot or catalog only.',
    'itemfinder.ctl.size': 'Narrows down to a size class.',
    'itemfinder.ctl.weight': 'Narrows down to an armor class.',
    'itemfinder.ctl.rarity': 'Narrows down to a rarity tier.',
    'itemfinder.ctl.category': 'Picks a category from the list.',
    'itemfinder.ctl.view': 'Switches between individual pieces and complete sets.',
    'itemfinder.ctl.sort': 'Sets the sort order of the results.',
  },
} as const;

export type HelpKey = keyof (typeof HELP)['de'];

/**
 * useHelp(lang): strenger Zugriff OHNE Sprachrueckfall (DOC-04). Fehlt der
 * Schluessel in `lang` oder ist er leer, wirft h() — anders als t() aus
 * ui.ts, das in dieser Lage still auf Englisch zurueckfaellt.
 */
export function useHelp(lang: Locale) {
  return function h(key: HelpKey): string {
    const value = HELP[lang]?.[key];
    if (!value) {
      throw new Error(`useHelp: fehlender oder leerer Hilfe-Schluessel "${key}" fuer Sprache "${lang}"`);
    }
    return value;
  };
}

/**
 * assertHelpParity(): laeuft beim Modul-Laden (siehe Aufruf am Dateiende) und
 * damit bei jedem `astro build`. Bricht ab, wenn:
 *   - die Schluesselmengen von DE und EN auseinanderlaufen,
 *   - ein Wert leer oder nur Leerraum ist,
 *   - ein Wert in beiden Sprachen byte-gleich ist, ohne in SAME_IN_BOTH zu
 *     stehen (das waere sonst eine vergessene Uebersetzung, die stumm
 *     durchgeht).
 * Das ist die maschinelle Umsetzung von DOC-04: ein fehlender DE-Schluessel
 * SCHEITERT sichtbar, statt englisch zu rendern.
 */
export function assertHelpParity(): void {
  const deKeys = Object.keys(HELP.de) as HelpKey[];
  const enKeys = Object.keys(HELP.en) as HelpKey[];
  const deSet = new Set<string>(deKeys);
  const enSet = new Set<string>(enKeys);

  const missingInEn = deKeys.filter((k) => !enSet.has(k));
  const missingInDe = enKeys.filter((k) => !deSet.has(k));
  if (missingInEn.length || missingInDe.length) {
    throw new Error(
      `assertHelpParity: Schluesselmengen von DE und EN weichen ab. ` +
        `Fehlt in EN: ${missingInEn.join(', ') || '—'}; fehlt in DE: ${missingInDe.join(', ') || '—'}`
    );
  }

  for (const key of deKeys) {
    const de = HELP.de[key];
    const en = HELP.en[key];
    if (!de || !de.trim()) throw new Error(`assertHelpParity: leerer DE-Wert bei Schluessel "${key}"`);
    if (!en || !en.trim()) throw new Error(`assertHelpParity: leerer EN-Wert bei Schluessel "${key}"`);
    if (de === en && !SAME_IN_BOTH.has(key)) {
      throw new Error(
        `assertHelpParity: "${key}" ist in DE und EN byte-gleich, steht aber nicht in SAME_IN_BOTH — ` +
          `vermutlich eine vergessene Uebersetzung.`
      );
    }
  }
}

assertHelpParity();
