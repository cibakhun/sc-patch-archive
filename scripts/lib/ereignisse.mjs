// ereignisse.mjs — die freigegebene Liste der Messereignisse (Umami).
//
// Freigabe: Krisz, 06.11.2026 11:48 („Beides wie empfohlen", Plan
// „VerseBase: Produktphase Vernetzung, Messung, Datenvertrauen", Abschnitt
// Messung). Fuenfzehn Ereignisse, jedes Feld nur mit festen Werten: kein
// Suchbegriff, keine Item-Kennung, kein Name, keine Zahl aus einer Rechnung.
// Acht davon aus dieser Freigabe; das neunte, wert-melden (Klick auf
// „Falschen Wert melden“ einer Detailseite, nur die Seitenart), kam mit dem
// Vorschlag Datenvertrauen (Schritt C2), freigegeben 06.11.2026 11:47
// („Wie empfohlen"). Das zehnte, extern (Klick auf einen Link zu einer
// anderen Website oder auf den Bezahlknopf der Unterstuetzen-Seite, nur die
// Art des Ziels und die Seitenart), kam am 11.11.2026 dazu: Klicks nach
// draussen (Discord beitreten, Spende, Wiki, UEX) waren bis dahin gar nicht
// messbar. Freigabe: Krisz, 11.11.2026 11:10 UTC („Erst extern-Event, dann
// live"). Am selben Tag (11:11 UTC, „Mehr Events auf der Seite selbst") die
// Bedienung auf der Seite: treffer-offen (Eintrag aus der Trefferliste eines
// Werkzeugs geoeffnet), merken (Schiff zur Flotte, Bauplan in den Planer,
// Raffinerie-Auftrag gestartet), video (Video gestartet), bilder (Bilder
// geoeffnet) und hilfe („Wie funktioniert …?" bzw. „Elemente erklaeren").
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
// Ziele nach draussen: nur die Art, nie Adresse oder Pfad. „spende“ deckt
// PayPal.me und den Stripe-Knopf (<button data-ev-extern="spende">, seine
// Zieladresse entsteht erst beim Klick).
export const EXTERN = ['discord', 'spende', 'wiki', 'uex', 'rsi', 'fleetyards', 'youtube', 'sonst'];
// Host (ohne www.) -> Ziel. Alle anderen Hosts zaehlen als „sonst“. Nur Hosts,
// auf die der gebaute Stand wirklich verlinkt: verify:zaehler [7] reisst bei
// einem Eintrag ohne Link (Zombie). Bewusst NICHT hier: discord.com und
// paypal.com — dorthin zeigen nur die Datenschutz-Links der Anbieter.
export const EXTERN_HOSTS = {
  'discord.gg': 'discord',
  'paypal.me': 'spende',
  'starcitizen.tools': 'wiki',
  'uexcorp.space': 'uex',
  'robertsspaceindustries.com': 'rsi',
  'fleetyards.net': 'fleetyards',
  'youtube.com': 'youtube',
};
export const VON = [...DETAIL, 'sonst', ...WERKZEUGE];
export const MERKEN = ['flotte', 'planer', 'auftrag'];
// Hilfe gibt es auch ausserhalb der Werkzeugseiten (Ruestungs-Sets, Werkbank,
// Hangar im Vorschau-Bau): dort heisst das Werkzeug „sonst“.
export const HILFE_WZ = [...WERKZEUGE, 'sonst'];
export const HILFE_ART = ['anleitung', 'elemente'];

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
  extern: { seite: SEITEN, ziel: EXTERN },
  'treffer-offen': { werkzeug: WERKZEUGE },
  merken: { was: MERKEN },
  video: { seite: SEITEN },
  bilder: { seite: SEITEN },
  hilfe: { werkzeug: HILFE_WZ, art: HILFE_ART },
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
