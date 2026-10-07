// Jedes Wort der Hangar-Ausstattung, beide Sprachen, eine Datei. Gelesen nur
// beim Bauen: ShipBay.astro und BayDocument.astro drucken diese Texte, der
// Browser bekommt sie als fertiges Markup. So sehen audit:site (Herkunftswoerter,
// Platzhalter) und verify:sync (DE/EN-Geruest) jedes Wort, das ein Besucher
// liest, auch die der 454 Buchtdokumente.
//
// Anders als ui.ts faellt ein fehlender Schluessel NICHT still auf Englisch
// zurueck: assertParity() laeuft beim Laden des Moduls und wirft, damit reisst
// `astro build` (Vorbild help.ts). Die Zeilen in den Details eines Bauteils
// kommen NICHT von hier, sondern aus itemStats.statRows(): dieselbe Zahl liest
// sich im Item Finder und im Hangar gleich.

import type { Locale } from './ui';

const DE = {
  // Gruppen der Ausstattungs-Tabs
  'grp.pilot': 'Pilotenwaffen',
  'grp.manned': 'Bemannte Türme',
  'grp.remote': 'Ferngesteuerte Türme',
  'grp.pdc': 'Punktverteidigung',
  'grp.missile': 'Raketen',
  'grp.bomb': 'Bomben',
  'grp.cm': 'Gegenmaßnahmen',
  'grp.power': 'Generatoren',
  'grp.cooler': 'Kühler',
  'grp.shield': 'Schildgeneratoren',
  'grp.quantum': 'Quantum-Antrieb',
  'grp.radar': 'Radar',
  'grp.fuel': 'Treibstoff',
  'grp.ore': 'Erzbehälter',
  // Bauteile ohne lokalisierten Namen (49 Einträge im Bestand)
  'kind.gun': 'Waffe',
  'kind.mannedTurret': 'Turmwaffe',
  'kind.remoteTurret': 'Turmwaffe',
  'kind.pdcTurret': 'Punktverteidigung',
  'kind.missile': 'Rakete',
  'kind.bomb': 'Bombe',
  'kind.cm': 'Täuschkörperwerfer',
  'kind.power': 'Generator',
  'kind.cooler': 'Kühler',
  'kind.shield': 'Schildgenerator',
  'kind.quantum': 'Quantum-Antrieb',
  'kind.radar': 'Radar',
  'kind.h2tank': 'Wasserstofftank',
  'kind.qttank': 'Quantumtank',
  'kind.orepod': 'Erzbehälter',
  // Kennwerte: Überblick, Sortierung, Vergleich (Reihenfolge in catalog.ts)
  'stat.scm': 'SCM-Geschwindigkeit',
  'stat.max': 'Höchstgeschwindigkeit',
  'stat.hull': 'Rumpf',
  'stat.shield': 'Schild',
  'stat.dps': 'Feuerkraft Pilot',
  'stat.cargo': 'Fracht',
  'stat.crew': 'Besatzung',
  'stat.len': 'Länge',
  'stat.missiles': 'Raketen',
  'stat.qtSpeed': 'Quantum-Geschwindigkeit',
  'stat.qtRange': 'Quantum-Reichweite',
  'stat.h2': 'Wasserstoff',
  'stat.price': 'Preis im Verse',
  // Einheiten am Kennwert einer Zeile
  'unit.damage': 'Schaden',
  'unit.charges': 'Ladungen',
  'unit.power': 'Leistung',
  'unit.cooling': 'Kühlung',
  'unit.sensitivity': 'Empfindlichkeit',
  'unit.each': 'je Stück',
  'overview.note': 'Balken: Rang unter allen Schiffen mit diesem Wert.',
  'panel.sheet': 'Zum Datenblatt',
  'slot.finder': 'Alternativen im Item Finder',
  'slot.page': 'Item-Seite',
  'cargo.hold': 'Frachtraum',
  'cargo.ore': 'Erzkapazität',
  // Definierte Leerzustände: ein Tab ist nie zufällig leer
  'empty.noLoadout': 'Für dieses Fahrzeug ist keine Ausstattung bekannt.',
  'empty.weapons': 'Keine Waffen verbaut.',
  'empty.systems': 'Keine Systeme bekannt.',
  'empty.cargo': 'Kein Frachtraum.',
  // Kopf der Buchtdokumente
  'doc.title': '{name}: Ausstattung im Hangar | VerseBase',
  'doc.description': '{ship} im 3D-Hangar: Waffen, Systeme und Fracht je Hardpoint, mit den Serienteilen und ihren Kennwerten.',
  'doc.open': 'Im 3D-Hangar öffnen',
  // Hangarseite: Tabs, Aktionen, Werkzeuge, Dock
  'tab.overview': 'Überblick',
  'tab.weapons': 'Waffen',
  'tab.systems': 'Systeme',
  'tab.cargo': 'Fracht',
  'panel.label': 'Kennwerte und Ausstattung',
  'panel.tabs': 'Bereiche',
  'act.group': 'Aktionen',
  'act.copy': 'Link kopieren',
  'act.copyField': 'Link zum Kopieren',
  'act.reset': 'Ansicht zurücksetzen',
  'act.hint': 'Ziehen zum Drehen, Mausrad zum Zoomen, Pfeiltasten wechseln das Schiff',
  'dock.label': 'Schiffsauswahl',
  'dock.search': 'Schiff oder Hersteller…',
  'dock.searchLabel': 'Suche',
  'dock.type': 'Rolle',
  'dock.typeAll': 'Alle Rollen',
  'dock.maker': 'Hersteller',
  'dock.makerAll': 'Alle Hersteller',
  'dock.prev': 'Vorheriges Schiff',
  'dock.next': 'Nächstes Schiff',
  'dock.empty': 'Kein Schiff passt zu diesem Filter.',
  'bay.failed': 'Die Ausstattung dieses Schiffs konnte nicht geladen werden.',
  'bay.retry': 'Erneut versuchen',
  'model.failed': 'Das 3D-Modell dieses Schiffs konnte nicht geladen werden. Die Werte stehen trotzdem bereit.',
  // Vorlagen, die der Controller fuellt (Mehrzahl ueber Intl.PluralRules)
  'msg.count.one': '{n} Schiff',
  'msg.count.other': '{n} Schiffe',
  'msg.copy.ok': 'Link kopiert.',
  'msg.copy.fallback': 'Link markiert: mit Strg+C kopieren.',
} as const;

export type HangarKey = keyof typeof DE;

const EN: Readonly<Record<HangarKey, string>> = {
  'grp.pilot': 'Pilot weapons',
  'grp.manned': 'Manned turrets',
  'grp.remote': 'Remote turrets',
  'grp.pdc': 'Point defense',
  'grp.missile': 'Missiles',
  'grp.bomb': 'Bombs',
  'grp.cm': 'Countermeasures',
  'grp.power': 'Power plants',
  'grp.cooler': 'Coolers',
  'grp.shield': 'Shield generators',
  'grp.quantum': 'Quantum drive',
  'grp.radar': 'Radar',
  'grp.fuel': 'Fuel',
  'grp.ore': 'Ore pods',
  'kind.gun': 'Weapon',
  'kind.mannedTurret': 'Turret weapon',
  'kind.remoteTurret': 'Turret weapon',
  'kind.pdcTurret': 'Point defense',
  'kind.missile': 'Missile',
  'kind.bomb': 'Bomb',
  'kind.cm': 'Countermeasure launcher',
  'kind.power': 'Power plant',
  'kind.cooler': 'Cooler',
  'kind.shield': 'Shield generator',
  'kind.quantum': 'Quantum drive',
  'kind.radar': 'Radar',
  'kind.h2tank': 'Hydrogen tank',
  'kind.qttank': 'Quantum fuel tank',
  'kind.orepod': 'Ore pod',
  'stat.scm': 'SCM speed',
  'stat.max': 'Max speed',
  'stat.hull': 'Hull',
  'stat.shield': 'Shield',
  'stat.dps': 'Pilot firepower',
  'stat.cargo': 'Cargo',
  'stat.crew': 'Crew',
  'stat.len': 'Length',
  'stat.missiles': 'Missiles',
  'stat.qtSpeed': 'Quantum speed',
  'stat.qtRange': 'Quantum range',
  'stat.h2': 'Hydrogen fuel',
  'stat.price': 'In-game price',
  'unit.damage': 'damage',
  'unit.charges': 'charges',
  'unit.power': 'power',
  'unit.cooling': 'cooling',
  'unit.sensitivity': 'sensitivity',
  'unit.each': 'each',
  'overview.note': 'Bars: rank among all ships with this figure.',
  'panel.sheet': 'Open data sheet',
  'slot.finder': 'Alternatives in the Item Finder',
  'slot.page': 'Item page',
  'cargo.hold': 'Cargo hold',
  'cargo.ore': 'Ore capacity',
  'empty.noLoadout': 'No loadout is known for this vehicle.',
  'empty.weapons': 'No weapons fitted.',
  'empty.systems': 'No systems known.',
  'empty.cargo': 'No cargo hold.',
  'doc.title': '{name} loadout in the hangar | VerseBase',
  'doc.description': '{ship} in the 3D hangar: weapons, systems and cargo per hardpoint with the stock items and their key figures.',
  'doc.open': 'Open in the 3D hangar',
  'tab.overview': 'Overview',
  'tab.weapons': 'Weapons',
  'tab.systems': 'Systems',
  'tab.cargo': 'Cargo',
  'panel.label': 'Figures and loadout',
  'panel.tabs': 'Sections',
  'act.group': 'Actions',
  'act.copy': 'Copy link',
  'act.copyField': 'Link to copy',
  'act.reset': 'Reset view',
  'act.hint': 'Drag to rotate, scroll to zoom, arrow keys switch ships',
  'dock.label': 'Ship selection',
  'dock.search': 'Ship or manufacturer…',
  'dock.searchLabel': 'Search',
  'dock.type': 'Role',
  'dock.typeAll': 'All roles',
  'dock.maker': 'Manufacturer',
  'dock.makerAll': 'All manufacturers',
  'dock.prev': 'Previous ship',
  'dock.next': 'Next ship',
  'dock.empty': 'No ship matches this filter.',
  'bay.failed': 'The loadout of this ship could not be loaded.',
  'bay.retry': 'Try again',
  'model.failed': 'The 3D model of this ship could not be loaded. The figures are still available.',
  'msg.count.one': '{n} ship',
  'msg.count.other': '{n} ships',
  'msg.copy.ok': 'Link copied.',
  'msg.copy.fallback': 'Link selected: press Ctrl+C to copy.',
};

const HANGAR_UI: Readonly<Record<Locale, Readonly<Record<HangarKey, string>>>> = { de: DE, en: EN };

// Gleich lautend in beiden Sprachen ist nur, was ein Eigenname oder ein
// Fachkürzel ist; jeder andere gleiche Wert ist eine vergessene Übersetzung.
const SAME_OK: ReadonlySet<HangarKey> = new Set<HangarKey>(['grp.radar', 'kind.radar']);

function assertParity(): void {
  const keys = Object.keys(DE) as HangarKey[];
  const enKeys = new Set(Object.keys(EN));
  const bad: string[] = [];
  for (const k of keys) {
    if (!enKeys.has(k)) bad.push(`${k}: fehlt in EN`);
    if (!DE[k].trim() || !EN[k]?.trim()) bad.push(`${k}: leer`);
    if (DE[k] === EN[k] && !SAME_OK.has(k)) bad.push(`${k}: DE gleich EN`);
  }
  for (const k of enKeys) if (!(k in DE)) bad.push(`${k}: fehlt in DE`);
  if (bad.length) throw new Error(`hangarText: ${bad.join(' · ')}`);
}
assertParity();

/** hangarT('de')('grp.pilot') === 'Pilotenwaffen'; Platzhalter {name} aus vars. */
export function hangarT(lang: Locale): (key: HangarKey, vars?: Readonly<Record<string, string>>) => string {
  const dict = HANGAR_UI[lang];
  return (key, vars) => {
    const s = dict[key];
    return vars ? s.replace(/\{(\w+)\}/g, (m, v: string) => vars[v] ?? m) : s;
  };
}
