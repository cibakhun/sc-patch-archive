// ereignisse.mjs — die freigegebene Liste der Messereignisse (Umami).
//
// Freigabe: Krisz, 06.11.2026 11:48 („Beides wie empfohlen", Plan
// „VerseBase: Produktphase Vernetzung, Messung, Datenvertrauen", Abschnitt
// Messung). Acht Ereignisse, jedes Feld nur mit festen Werten: kein
// Suchbegriff, keine Item-Kennung, kein Name, keine Zahl aus einer Rechnung.
// Das neunte, wert-melden (Klick auf „Falschen Wert melden“ einer
// Detailseite, nur die Seitenart), kam mit dem Vorschlag Datenvertrauen
// (Schritt C2), freigegeben 06.11.2026 11:47 („Wie empfohlen").
//
// Diese Datei ist das SOLL. assets/ereignisse.js traegt dieselbe Liste als
// Ist (es laeuft im Browser und kann nichts importieren); verify:zaehler [7]
// fuehrt die ausgelieferte Datei aus und reisst, sobald die beiden
// auseinanderlaufen oder ein Ereignis etwas anderes schickt als hier steht.
// Wer ein Ereignis, Feld oder einen Wert ergaenzt, aendert beide Dateien und
// den Satz in der Datenschutzerklaerung (#umami) — und fragt vorher Krisz.

export const SEITEN = ['item', 'blueprint', 'schiff', 'mission', 'werkzeug', 'sonst'];
export const DETAIL = ['item', 'blueprint', 'schiff', 'mission'];
export const WERKZEUGE = [
  'finder', 'missionen', 'crafting', 'fracturing', 'refinery', 'mining', 'sprung', 'wikelo', 'schiffe', 'archiv', 'evolution',
];
// Gleiche Arten wie SEARCH_KINDS in src/lib/searchUi.ts.
export const TREFFER = ['werkzeug', 'schiff', 'mission', 'patch', 'thema', 'feature', 'event', 'item', 'bauplan'];
export const PLAETZE = ['1-3', '4-10', '11+'];
// Namen der Filter (data-ev-filter an den Bedienelementen der Werkzeuge),
// nie ihr Wert.
export const FILTER = [
  'suche', 'sortierung', 'kategorie', 'groesse', 'verfuegbarkeit', 'gewicht', 'seltenheit', 'ansicht',
  'typ', 'auftraggeber', 'fraktion', 'gilde', 'ort', 'bauplan', 'legal',
  'hersteller', 'karriere', 'rolle', 'signatur', 'merkmal', 'komponente', 'komponentengroesse',
  'ressource', 'qualitaet', 'system', 'brechbar',
];
export const KONTO = ['anmelden', 'registrieren'];
export const VON = [...DETAIL, 'sonst', ...WERKZEUGE];

export const EREIGNISSE = {
  'suche-offen': { seite: SEITEN },
  'suche-treffer': { art: TREFFER, platz: PLAETZE },
  'weiter-werkzeug': { seite: DETAIL, werkzeug: WERKZEUGE },
  'weiter-detail': { seite: DETAIL, ziel: DETAIL },
  filter: { werkzeug: WERKZEUGE, filter: FILTER },
  rechnung: { werkzeug: WERKZEUGE },
  'kopieren-teilen': { werkzeug: WERKZEUGE },
  'anmeldung-einstieg': { von: VON, ziel: KONTO },
  'wert-melden': { seite: DETAIL },
};

// Seiten der Werkzeuge (ohne /de-Vorsatz) -> Wert im Feld werkzeug. Dieselben
// Ziele wie die Werkzeug-Eintraege der Suche (toolEntries in
// src/lib/searchIndex.ts); der Hangar fehlt mit Absicht.
export const WERKZEUG_SEITEN = {
  '/item-finder.html': 'finder',
  '/missionen.html': 'missionen',
  '/topics/crafting.html': 'crafting',
  '/fracturing.html': 'fracturing',
  '/refinery.html': 'refinery',
  '/topics/mining.html': 'mining',
  '/precision-jump.html': 'sprung',
  '/topics/wikelo-emporium.html': 'wikelo',
  '/schiffe.html': 'schiffe',
  '/archiv.html': 'archiv',
  '/evolution.html': 'evolution',
};

// Nur diese Ereignisse gehen je Seitenaufruf hoechstens einmal raus.
export const EINMAL = ['suche-offen', 'filter', 'rechnung'];
