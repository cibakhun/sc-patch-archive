/* ============================================================
   vorschau-seiten.mjs — Prototypen, die nur der Vorschau-Bau traegt.

   ANLASS (24.11.2026): Krisz will Items und Item Finder als eine Seite,
   „von der Funktion her zusammen bauen zu 1“, und dabei einen neuen
   Standard fuer die Seite setzen, mindestens so gut wie die Crafting-
   Werkbank. Bis zu seiner Abnahme steht die Items-Werkbank an einer
   eigenen Adresse und geht nicht live; /items.html und /item-finder.html
   bleiben bis dahin, wie sie sind.

   Dasselbe Vorgehen wie bei der Crafting-Werkbank (09.11. bis 13.11.2026,
   damals ebenfalls hier und in verify:hangar-schalter [4]/[5]): dieselbe
   Regel wie der Hangar (hangarImBau: STAGING=1, Begruendung in
   hangar-switch.mjs), aber eine eigene Liste, die nach der Abnahme wieder
   herausfaellt.

     STAGING=1  Seiten eingehaengt (astro.config.mjs, vorschauRoutes)
     sonst      keine Seiten, keine Links (HAS_ITEMS_WERKBANK in src/lib/seo.ts)

   verify:hangar-schalter prueft beides am Artefakt ([4] und [5]).
   ============================================================ */

/** Die Routen: Muster und Datei. Bewusst NICHT unter src/pages/. */
export const VORSCHAU_ROUTES = [
  { pattern: '/items-werkbank', entrypoint: './src/vorschau-routes/items-werkbank.astro' },
  { pattern: '/de/items-werkbank', entrypoint: './src/vorschau-routes/de/items-werkbank.astro' },
];

/** Was der Vorschau-Bau tragen muss und der Live-Bau nicht tragen darf (relativ zu dist/). */
export const VORSCHAU_DIST_FILES = ['items-werkbank.html', 'de/items-werkbank.html'];

/** Die bisherigen Seiten, die im Vorschau-Bau zum Prototyp fuehren ([5]). */
export const VORSCHAU_WEGE = ['items.html', 'de/items.html', 'item-finder.html', 'de/item-finder.html'];

/** Ein Link auf eine dieser Seiten (Linkpruefung im Live-Bau). */
export const VORSCHAU_HREF = /href=["'](?:https:\/\/verse-base\.com)?\/(?:de\/)?items-werkbank\.html/;

/** Der blosse Pfad, fuer Daten ohne href (Suchregister). Live darf auch
 *  dort kein Weg zum Prototyp stehen. */
export const VORSCHAU_PFAD = /\/(?:de\/)?items-werkbank\.html/;
