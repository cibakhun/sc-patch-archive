// Jedes Wort der Layout-Werkstatt im Hangar, beide Sprachen, eine Datei.
// Gelesen nur beim Bauen: LayoutWorkshop.astro druckt die festen Texte und
// legt die Vorlagen als data-* an #hgl-msg ab, die assets/hangar-layouts.js
// fuellt. audit:site und verify:sync sehen so jedes Wort, das ein Besucher
// liest. Wie hangarText.ts faellt ein fehlender Schluessel nicht still auf
// Englisch zurueck: assertParity() wirft beim Laden, und `astro build` reisst.
//
// Die Namen der Gruppen, Klassen und Einheiten kommen aus hangarText.ts:
// Werkstatt und Ausstattungs-Tabs sprechen dieselben Woerter.

import type { Locale } from './ui';

const DE = {
  'title': 'Layout-Werkstatt',
  'pane.label': 'Tafel rechts',
  'pane.layout': 'Layout',
  'pane.ship': 'Schiffsdaten',
  'name.label': 'Name des Layouts',
  'name.placeholder': '{ship} · Mein Layout',
  'name.dice': 'Zufälligen Namen würfeln',
  'name.fun': 'Glaskanone|Stachelschwein|Nachtschicht|Kometenjäger|Schildkröte|Langstrecke|Brecheisen|Funkenregen|Vollgas|Geisterfahrt|Eiserne Lunge|Sternenstaub|Kaffeefahrt|Bienenstock|Donnerkeil|Leisetreter',
  'view.saved': 'Meine Layouts',
  'cat.label': 'Kategorie',
  'cat.paint': 'Lackierung',
  'grp.paint': 'Lackierungen',
  'paint.stock': 'Serienlack',
  'paint.pattern': 'Vorschau ohne Muster',
  'state.stock': 'Serienausstattung',
  'state.changed.one': '{n} Slot geändert',
  'state.changed.other': '{n} Slots geändert',
  'state.unsaved': 'nicht gespeichert',
  'state.saved': 'gespeichert',
  'shared': 'Ein geteiltes Layout. Speichern, um es zu behalten.',
  'slot.swap': '{slot} tauschen',
  'slot.stock': 'Serie',
  'slot.fitted': 'Eingebaut',
  'slot.was': 'Serie: {name}',
  'slot.revert': 'Zurück auf Serie',
  'slot.unknown': 'Unbekanntes Bauteil',
  'rack.label': 'Halterung',
  'pick.search': 'Bauteil suchen …',
  'pick.searchLabel': 'Passende Bauteile durchsuchen',
  'pick.empty': 'Kein Bauteil passt zu dieser Suche.',
  'pick.count.one': '{n} passendes Bauteil',
  'pick.count.other': '{n} passende Bauteile',
  'pick.price': 'ab {n} aUEC',
  'pick.noshop': 'nicht im Laden',
  'dt.p': 'Ballistisch',
  'dt.e': 'Energie',
  'dt.d': 'Verzerrung',
  'trk.i': 'Infrarot',
  'trk.e': 'Elektromagnetisch',
  'trk.c': 'Radarquerschnitt',
  'act.save': 'Speichern',
  'act.share': 'Link teilen',
  'act.reset': 'Alles auf Serie',
  'msg.saved': 'Gespeichert. Du findest es unter „Meine Layouts“.',
  'msg.copied': 'Link kopiert. Ab damit zur Crew!',
  'msg.copyFallback': 'Link markiert: mit Strg+C kopieren.',
  'msg.reset': 'Alles wieder in Serie.',
  'msg.fitted': '{item} eingebaut.',
  'msg.deleted': '„{name}“ gelöscht.',
  'msg.undo': 'Rückgängig',
  'msg.dropped.one': '{n} Bauteil aus dem Link passt nicht mehr und steht wieder in Serie.',
  'msg.dropped.other': '{n} Bauteile aus dem Link passen nicht mehr und stehen wieder in Serie.',
  'msg.full': 'Der Speicher dieses Browsers ist voll oder gesperrt. Teile das Layout als Link, dann geht es nicht verloren.',
  'saved.empty': 'Noch keine Layouts. Bau eins und speichere es: es bleibt in diesem Browser.',
  'saved.here': 'Dieses Schiff',
  'saved.open': 'Öffnen',
  'saved.share': 'Teilen',
  'saved.delete': 'Löschen',
  'saved.deleteLabel': '„{name}“ löschen',
  'saved.stock': 'Serie',
  'note': 'Gegenmaßnahmen und Tanks sind im Spiel fest verbaut. Gespeichert wird in diesem Browser.',
  'loading': 'Bauteile werden geladen …',
  'failed': 'Die Bauteile konnten nicht geladen werden.',
  'retry': 'Erneut versuchen',
  'noslots': 'Dieses Schiff hat keine tauschbaren Bauteile.',
  'sum.label': 'Kampfwerte dieses Layouts',
  'sum.fire': 'Feuerkraft',
  'sum.ord': 'Raketen',
  'sum.shield': 'Schild',
  'sum.note': 'Balken: Anteil am Bestwert, den die Slots fassen. Strich: Serie.',
  'slot.rank': 'Platz {r} von {n} passenden Bauteilen',
} as const;

export type LayoutKey = keyof typeof DE;

const EN: Readonly<Record<LayoutKey, string>> = {
  'title': 'Loadout workshop',
  'pane.label': 'Side panel',
  'pane.layout': 'Loadout',
  'pane.ship': 'Ship data',
  'name.label': 'Loadout name',
  'name.placeholder': '{ship} · My loadout',
  'name.dice': 'Roll a random name',
  'name.fun': 'Glass Cannon|Porcupine|Night Shift|Comet Chaser|Turtle|Long Haul|Crowbar|Spark Shower|Full Throttle|Ghost Run|Iron Lung|Stardust|Joyride|Beehive|Thunderbolt|Tiptoe',
  'view.saved': 'My loadouts',
  'cat.label': 'Category',
  'cat.paint': 'Paint',
  'grp.paint': 'Paints',
  'paint.stock': 'Stock paint',
  'paint.pattern': 'Preview without pattern',
  'state.stock': 'Stock loadout',
  'state.changed.one': '{n} slot changed',
  'state.changed.other': '{n} slots changed',
  'state.unsaved': 'not saved',
  'state.saved': 'saved',
  'shared': 'A shared loadout. Save it to keep it.',
  'slot.swap': 'Swap {slot}',
  'slot.stock': 'Stock',
  'slot.fitted': 'Fitted',
  'slot.was': 'Stock: {name}',
  'slot.revert': 'Back to stock',
  'slot.unknown': 'Unknown component',
  'rack.label': 'Rack',
  'pick.search': 'Search components …',
  'pick.searchLabel': 'Search matching components',
  'pick.empty': 'No component matches this search.',
  'pick.count.one': '{n} matching component',
  'pick.count.other': '{n} matching components',
  'pick.price': 'from {n} aUEC',
  'pick.noshop': 'not sold in shops',
  'dt.p': 'Ballistic',
  'dt.e': 'Energy',
  'dt.d': 'Distortion',
  'trk.i': 'Infrared',
  'trk.e': 'Electromagnetic',
  'trk.c': 'Cross section',
  'act.save': 'Save',
  'act.share': 'Share link',
  'act.reset': 'All stock',
  'msg.saved': 'Saved. You’ll find it under “My loadouts”.',
  'msg.copied': 'Link copied. Off to the crew with it!',
  'msg.copyFallback': 'Link selected: press Ctrl+C to copy.',
  'msg.reset': 'Everything back to stock.',
  'msg.fitted': '{item} fitted.',
  'msg.deleted': '“{name}” deleted.',
  'msg.undo': 'Undo',
  'msg.dropped.one': '{n} component from the link no longer fits and is back to stock.',
  'msg.dropped.other': '{n} components from the link no longer fit and are back to stock.',
  'msg.full': 'This browser’s storage is full or blocked. Share the loadout as a link so it isn’t lost.',
  'saved.empty': 'No loadouts yet. Build one and save it: it stays in this browser.',
  'saved.here': 'This ship',
  'saved.open': 'Open',
  'saved.share': 'Share',
  'saved.delete': 'Delete',
  'saved.deleteLabel': 'Delete “{name}”',
  'saved.stock': 'Stock',
  'note': 'Countermeasures and fuel tanks are fixed in the game. Loadouts are saved in this browser.',
  'loading': 'Loading components …',
  'failed': 'The components could not be loaded.',
  'retry': 'Try again',
  'noslots': 'This ship has no swappable components.',
  'sum.label': 'Combat readout of this loadout',
  'sum.fire': 'Firepower',
  'sum.ord': 'Missiles',
  'sum.shield': 'Shields',
  'sum.note': 'Bar: share of the best value these slots can hold. Tick: stock.',
  'slot.rank': 'Rank {r} of {n} fitting components',
};

const LAYOUT_UI: Readonly<Record<Locale, Readonly<Record<LayoutKey, string>>>> = { de: DE, en: EN };

function assertParity(): void {
  const keys = Object.keys(DE) as LayoutKey[];
  const enKeys = new Set(Object.keys(EN));
  const bad: string[] = [];
  for (const k of keys) {
    if (!enKeys.has(k)) bad.push(`${k}: fehlt in EN`);
    if (!DE[k].trim() || !EN[k]?.trim()) bad.push(`${k}: leer`);
    if (DE[k] === EN[k]) bad.push(`${k}: DE gleich EN`);
  }
  for (const k of enKeys) if (!(k in DE)) bad.push(`${k}: fehlt in DE`);
  if (bad.length) throw new Error(`layoutText: ${bad.join(' · ')}`);
}
assertParity();

/** layoutT('de')('pane.ship') === 'Schiffsdaten'; Platzhalter bleiben fuer den Client stehen. */
export function layoutT(lang: Locale): (key: LayoutKey) => string {
  const dict = LAYOUT_UI[lang];
  return (key) => dict[key];
}
