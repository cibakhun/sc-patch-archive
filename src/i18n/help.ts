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

    // -- Crafting --
    'crafting.title': 'Wie funktioniert die Crafting-Datenbank?',
    'crafting.purpose':
      'Zeigt zu jedem Blueprint die Zutaten, die Craft-Zeit und woher er stammt — dazu ein Rechner, der ausrechnet, welche Items sich am besten zerlegen lassen.',
    'crafting.step1': 'Suchbegriff eingeben oder nach Kategorie und Ressource filtern.',
    'crafting.step2': 'Nur Blueprints mit Missions-Quelle oder im eigenen Besitz anzeigen.',
    'crafting.step3': 'Ergebnisse sortieren oder zwischen Raster und Liste wechseln.',
    'crafting.step4': 'Blueprints im Planer sammeln für die gemeinsame Einkaufsliste.',
    'crafting.ctl.filter': 'Öffnet die Filterleiste auf schmalen Bildschirmen.',
    'crafting.ctl.search': 'Freitextsuche über Blueprint-Namen und Ressourcen.',
    'crafting.ctl.sort': 'Legt die Sortierung der Ergebnisse fest.',
    'crafting.ctl.view': 'Wechselt zwischen Raster- und Listenansicht.',
    'crafting.ctl.planner': 'Öffnet den Planer mit der gesammelten Einkaufsliste.',
    'crafting.ctl.category': 'Schränkt auf eine oder mehrere Kategorien ein.',
    'crafting.ctl.resource': 'Schränkt auf eine oder mehrere Ressourcen ein.',
    'crafting.ctl.flags': 'Zeigt nur Blueprints mit Missions-Quelle oder im eigenen Besitz.',

    // -- Mining --
    'mining.title': 'Wie funktioniert die Mining-Datenbank?',
    'mining.purpose':
      'Zeigt zu jedem Mineral, wo es vorkommt, mit welcher Fund-Chance und ob es raffiniert werden muss.',
    'mining.step1': 'Suchbegriff eingeben oder nach System, Methode und Typ filtern.',
    'mining.step2': 'Nur raffinierbare Erze oder nur Hand-Edelsteine anzeigen.',
    'mining.step3': 'Ergebnisse sortieren oder zwischen Raster und Liste wechseln.',
    'mining.step4': 'Fundorte nach Himmelskörper öffnen, um den ganzen Mineral-Mix dort zu sehen.',
    'mining.ctl.filter': 'Öffnet die Filterleiste auf schmalen Bildschirmen.',
    'mining.ctl.search': 'Freitextsuche über Mineral-Namen und Fundorte.',
    'mining.ctl.sort': 'Legt die Sortierung der Ergebnisse fest.',
    'mining.ctl.view': 'Wechselt zwischen Raster- und Listenansicht.',
    'mining.ctl.loc': 'Öffnet die Fundorte nach Himmelskörper.',
    'mining.ctl.system': 'Schränkt auf ein oder mehrere Systeme ein.',
    'mining.ctl.method': 'Schränkt auf Schiff-, Hand- oder ROC-Mining ein.',
    'mining.ctl.type': 'Schränkt auf einen Mineraltyp ein.',
    'mining.ctl.flags': 'Zeigt nur raffinierbare Erze oder nur Hand-Edelsteine.',

    // -- Refinery-Finder --
    'refineryfinder.title': 'Wie funktioniert der Refinery-Finder?',
    'refineryfinder.purpose':
      'Zeigt zu jedem Erz die Raffinerie mit dem höchsten Yield-Bonus, dazu die volle Matrix aller Stationen.',
    'refineryfinder.step1': 'Erz-Namen eingeben, um die beste Station sofort zu sehen.',
    'refineryfinder.step2': 'Zur vollen Matrix wechseln für alle Erze und Stationen auf einen Blick.',
    'refineryfinder.step3': 'Nach System filtern, um nur erreichbare Stationen zu sehen.',
    'refineryfinder.step4': 'Auf eine Station oder einen Chip zeigen, um den vollen Namen zu sehen.',
    'refineryfinder.ctl.search': 'Freitextsuche über Erz-Namen.',
    'refineryfinder.ctl.view': 'Wechselt zwischen Liste und voller Matrix.',
    'refineryfinder.ctl.system': 'Schränkt die Stationen auf ein System ein.',

    // -- Patch-Archiv --
    'archive.title': 'Wie funktioniert das Patch-Archiv?',
    'archive.purpose':
      'Verzeichnet alle Alpha-Versionen als Zeitleiste, gegliedert in Ären, mit Suche über Namen und Themen.',
    'archive.step1': 'Suchbegriff eingeben oder eine Ära in der Leiste anklicken.',
    'archive.step2': 'Nach Major- oder Point-Releases filtern.',
    'archive.step3': 'Auf der Zeitleiste zu einem Patch scrollen oder springen.',
    'archive.step4': 'Auf eine Karte klicken für die volle Patch-Seite mit allen Themen.',
    'archive.ctl.era': 'Zeigt, welche Ära gerade im Sichtfeld ist.',
    'archive.ctl.search': 'Freitextsuche über Versionsnummer, Codename und Themen.',
    'archive.ctl.chips': 'Schränkt die Zeitleiste auf Major- oder Point-Releases ein.',
    'archive.ctl.count': 'Zählt, wie viele Patches die aktuelle Auswahl zeigt.',

    // -- Missionen --
    'missions.title': 'Wie funktioniert die Missionsdatenbank?',
    'missions.purpose':
      'Zeigt alle Missionsangebote mit Belohnung, Reputation, Auftraggeber und Ort — gebündelt zu Missionen.',
    'missions.step1': 'Suchbegriff eingeben oder nach Typ, Auftraggeber, Fraktion, Gilde oder Ort filtern.',
    'missions.step2': 'Nur Missionen mit Blueprints oder nach Rechtslage einschränken.',
    'missions.step3': 'Ergebnisse sortieren nach Name, Belohnung oder Anzahl der Angebote.',
    'missions.step4': 'Auf eine Karte klicken für Details, Belohnung und Reputation.',
    'missions.ctl.search': 'Freitextsuche über Titel, Auftraggeber, Fraktion und Ort.',
    'missions.ctl.select': 'Schränkt die Liste auf einen Wert dieser Auswahlliste ein.',
    'missions.ctl.blueprint': 'Zeigt nur Missionen, die Blueprints abwerfen können.',
    'missions.ctl.legal': 'Schränkt auf legale oder illegale Missionen ein.',
    'missions.ctl.sort': 'Legt die Sortierung der Ergebnisse fest.',

    // -- Rüstungssets --
    'armorsets.title': 'Wie funktioniert die Rüstungs-Sets-Seite?',
    'armorsets.purpose':
      'Zeigt zu jedem Rüstungs-Set alle Teile nach Hersteller, mit Kennzahlen zu Sets und Vollständigkeit.',
    'armorsets.step1': 'Zu einem Hersteller springen oder die Seite durchscrollen.',
    'armorsets.step2': 'Jedes Set zeigt seine Teile nach Körperzone gegliedert.',
    'armorsets.step3': 'Ein unterstrichener Teilname führt zum Item-Datenblatt.',
    'armorsets.step4': 'Die Kennzahlen oben zeigen Gesamtzahl, Teile und vollständige Sets.',
    'armorsets.ctl.keys': 'Zählt Sets, Teile, vollständige Sets und den Datenstand.',
    'armorsets.ctl.jump': 'Springt direkt zu den Sets eines Herstellers.',

    // -- Wikelo's Emporium --
    'wikelo.title': "Wie funktioniert Wikelo's Emporium?",
    'wikelo.purpose':
      'Zeigt alle Tauschgeschäfte des Banu-Händlers: was zu liefern ist und was es dafür gibt.',
    'wikelo.step1': 'Nach Kategorie filtern — Schiffe, Waffen, Rüstung oder Sonstiges.',
    'wikelo.step2': 'Jede Karte zeigt links, was verlangt wird, rechts, was es gibt.',
    'wikelo.step3': 'Unterstrichene Gegenstände zeigen ihre Bezugsquellen beim Anklicken.',
    'wikelo.step4': 'Weiter unten stehen die drei Stationen und der Patch-Verlauf.',
    'wikelo.ctl.filter': 'Schränkt die Handelskarten auf eine Kategorie ein.',
    'wikelo.ctl.grid': 'Das Raster aller Handelsgeschäfte des aktuellen Filters.',

    // -- Schiffe --
    'ships.title': 'Wie funktioniert der Schiffskatalog?',
    'ships.purpose':
      'Zeigt alle Schiffe und Fahrzeuge mit Werten, Bauteilen und beiden Preisen — Pledge und Ingame.',
    'ships.step1': 'Suchbegriff eingeben oder einen Schnellzugriff-Chip anklicken.',
    'ships.step2': 'Nach Hersteller, Beruf, Rolle, Größe, Signatur, Merkmal oder Bauteil filtern.',
    'ships.step3': 'Ergebnisse nach Name, Preis, Fracht oder Crew sortieren.',
    'ships.step4': 'Auf eine Karte klicken für das volle Datenblatt.',
    'ships.ctl.search': 'Freitextsuche über Schiffs- und Herstellernamen.',
    'ships.ctl.select': 'Schränkt die Flotte auf einen Wert dieser Auswahlliste ein.',
    'ships.ctl.sort': 'Legt die Sortierung der Ergebnisse fest.',

    // -- Precision Jump --
    'precisionjump.title': 'Wie funktioniert der Precision-Jump-Rechner?',
    'precisionjump.purpose':
      'Berechnet, wo der Quantenflug zwischen zwei Ankern zu unterbrechen ist, um im gewünschten Aaron-Halo-Band anzukommen.',
    'precisionjump.step1': 'Startort wählen.',
    'precisionjump.step2': 'Ziel-QT-Marker wählen.',
    'precisionjump.step3': 'Das gewünschte Halo-Band wählen.',
    'precisionjump.step4': 'Den angezeigten Auslösewert im Spiel ablesen und dort abbrechen.',
    'precisionjump.ctl.route': 'Legt Startort und Ziel-QT-Marker der Route fest.',
    'precisionjump.ctl.swap': 'Tauscht Startort und Ziel.',
    'precisionjump.ctl.band': 'Wählt das Aaron-Halo-Band, das die Route treffen soll.',
    'precisionjump.ctl.reset': 'Setzt die Route auf die Standardwerte zurück.',
    'precisionjump.ctl.table': 'Klappt eine Tabelle mit weiteren Werten auf.',
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

    // -- Crafting --
    'crafting.title': 'How does the crafting database work?',
    'crafting.purpose':
      'Shows every blueprint’s ingredients, craft time and source — plus a calculator that works out which items are most efficient to dismantle.',
    'crafting.step1': 'Type a search term or filter by category and resource.',
    'crafting.step2': 'Show only blueprints with a mission source or already owned.',
    'crafting.step3': 'Sort the results or switch between grid and list view.',
    'crafting.step4': 'Collect blueprints in the planner for a shared shopping list.',
    'crafting.ctl.filter': 'Opens the filter sidebar on narrow screens.',
    'crafting.ctl.search': 'Free-text search across blueprint names and resources.',
    'crafting.ctl.sort': 'Sets the sort order of the results.',
    'crafting.ctl.view': 'Switches between grid and list view.',
    'crafting.ctl.planner': 'Opens the planner with the collected shopping list.',
    'crafting.ctl.category': 'Narrows down to one or more categories.',
    'crafting.ctl.resource': 'Narrows down to one or more resources.',
    'crafting.ctl.flags': 'Shows only blueprints with a mission source or already owned.',

    // -- Mining --
    'mining.title': 'How does the mining database work?',
    'mining.purpose':
      'Shows every mineral’s locations, find chance and whether it needs refining.',
    'mining.step1': 'Type a search term or filter by system, method and type.',
    'mining.step2': 'Show only refinable ores or only hand gems.',
    'mining.step3': 'Sort the results or switch between grid and list view.',
    'mining.step4': 'Open locations by celestial body to see the full mineral mix there.',
    'mining.ctl.filter': 'Opens the filter sidebar on narrow screens.',
    'mining.ctl.search': 'Free-text search across mineral names and locations.',
    'mining.ctl.sort': 'Sets the sort order of the results.',
    'mining.ctl.view': 'Switches between grid and list view.',
    'mining.ctl.loc': 'Opens locations grouped by celestial body.',
    'mining.ctl.system': 'Narrows down to one or more systems.',
    'mining.ctl.method': 'Narrows down to ship, hand or ROC mining.',
    'mining.ctl.type': 'Narrows down to a mineral type.',
    'mining.ctl.flags': 'Shows only refinable ores or only hand gems.',

    // -- Refinery Finder --
    'refineryfinder.title': 'How does the Refinery Finder work?',
    'refineryfinder.purpose':
      'Shows the refinery with the highest yield bonus for every ore, plus the full matrix of all stations.',
    'refineryfinder.step1': 'Type an ore name to see the best station instantly.',
    'refineryfinder.step2': 'Switch to the full matrix for every ore and station at a glance.',
    'refineryfinder.step3': 'Filter by system to see only reachable stations.',
    'refineryfinder.step4': 'Hover a station or chip to see its full name.',
    'refineryfinder.ctl.search': 'Free-text search across ore names.',
    'refineryfinder.ctl.view': 'Switches between list and full matrix.',
    'refineryfinder.ctl.system': 'Narrows the stations down to a system.',

    // -- Patch Archive --
    'archive.title': 'How does the patch archive work?',
    'archive.purpose':
      'Lists every alpha release as a timeline, grouped into eras, with search across names and topics.',
    'archive.step1': 'Type a search term or click an era in the bar.',
    'archive.step2': 'Filter down to major or point releases.',
    'archive.step3': 'Scroll or jump to a patch on the timeline.',
    'archive.step4': 'Click a card for the full patch page with all its topics.',
    'archive.ctl.era': 'Shows which era is currently in view.',
    'archive.ctl.search': 'Free-text search across version number, codename and topics.',
    'archive.ctl.chips': 'Narrows the timeline down to major or point releases.',
    'archive.ctl.count': 'Counts how many patches the current selection shows.',

    // -- Missions --
    'missions.title': 'How does the mission database work?',
    'missions.purpose':
      'Shows every mission offer with reward, reputation, contractor and location — grouped into missions.',
    'missions.step1': 'Type a search term or filter by type, contractor, faction, guild or location.',
    'missions.step2': 'Narrow down to missions with blueprints or by legality.',
    'missions.step3': 'Sort the results by name, reward or number of offers.',
    'missions.step4': 'Click a card for details, reward and reputation.',
    'missions.ctl.search': 'Free-text search across title, contractor, faction and location.',
    'missions.ctl.select': 'Narrows the list down to a value from this dropdown.',
    'missions.ctl.blueprint': 'Shows only missions that can drop blueprints.',
    'missions.ctl.legal': 'Narrows down to lawful or unlawful missions.',
    'missions.ctl.sort': 'Sets the sort order of the results.',

    // -- Armor Sets --
    'armorsets.title': 'How does the armor sets page work?',
    'armorsets.purpose':
      'Shows every armor set’s parts grouped by manufacturer, with key figures on sets and completeness.',
    'armorsets.step1': 'Jump to a manufacturer or scroll through the page.',
    'armorsets.step2': 'Each set shows its parts grouped by body slot.',
    'armorsets.step3': 'An underlined part name links to its item page.',
    'armorsets.step4': 'The figures at the top show total count, parts and complete sets.',
    'armorsets.ctl.keys': 'Counts sets, parts, complete sets and the data date.',
    'armorsets.ctl.jump': 'Jumps straight to a manufacturer’s sets.',

    // -- Wikelo's Emporium --
    'wikelo.title': "How does Wikelo's Emporium work?",
    'wikelo.purpose':
      'Shows every trade the Banu merchant offers: what to deliver and what it pays out.',
    'wikelo.step1': 'Filter by category — ships, weapons, armor or misc.',
    'wikelo.step2': 'Each card shows what is requested on the left, what it pays on the right.',
    'wikelo.step3': 'Click an underlined item to see where to get it.',
    'wikelo.step4': 'Further down are the three stations and the patch history.',
    'wikelo.ctl.filter': 'Narrows the trade cards down to a category.',
    'wikelo.ctl.grid': 'The grid of all trades in the current filter.',

    // -- Ships --
    'ships.title': 'How does the ship catalog work?',
    'ships.purpose':
      'Shows every ship and vehicle with stats, components and both prices — pledge and in-game.',
    'ships.step1': 'Type a search term or click a quick-access chip.',
    'ships.step2': 'Filter by manufacturer, career, role, size, signature, feature or component.',
    'ships.step3': 'Sort the results by name, price, cargo or crew.',
    'ships.step4': 'Click a card for the full data sheet.',
    'ships.ctl.search': 'Free-text search across ship and manufacturer names.',
    'ships.ctl.select': 'Narrows the fleet down to a value from this dropdown.',
    'ships.ctl.sort': 'Sets the sort order of the results.',

    // -- Precision Jump --
    'precisionjump.title': 'How does the Precision Jump calculator work?',
    'precisionjump.purpose':
      'Works out where to cut quantum travel between two anchors to land in the Aaron Halo band you want.',
    'precisionjump.step1': 'Pick a departure point.',
    'precisionjump.step2': 'Pick a destination QT marker.',
    'precisionjump.step3': 'Pick the Halo band you want to hit.',
    'precisionjump.step4': 'Read the displayed trigger value in game and cut the drive there.',
    'precisionjump.ctl.route': 'Sets the departure point and destination QT marker for the route.',
    'precisionjump.ctl.swap': 'Swaps departure point and destination.',
    'precisionjump.ctl.band': 'Picks the Aaron Halo band the route should hit.',
    'precisionjump.ctl.reset': 'Resets the route to its default values.',
    'precisionjump.ctl.table': 'Expands a table with further values.',
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
