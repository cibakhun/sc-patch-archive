/* ============================================================
   vorschau-seiten.mjs — Prototypen, die nur der Vorschau-Bau traegt.

   ANLASS (09.11.2026, Skizze 016): Krisz will die neue Crafting-Werkbank
   (Liste, Rezept und Planer nebeneinander) erst als funktionsfaehigen
   Prototyp auf staging ausprobieren, bevor das Crafting umgebaut wird.
   Bis zu seiner Abnahme darf sie nicht live gehen.

   Dieselbe Regel wie der Hangar (hangarImBau: STAGING=1, Begruendung in
   hangar-switch.mjs), aber eine eigene Liste: der Prototyp ist kein Teil
   des Hangars und faellt nach der Abnahme hier wieder heraus.

     STAGING=1  Seiten eingehaengt (astro.config.mjs, vorschauRoutes)
     sonst      keine Seiten, keine Links (HAS_WERKBANK in src/lib/seo.ts)

   verify:hangar-schalter prueft beides am Artefakt ([4] und [5]).
   ============================================================ */

/** Die Routen: Muster und Datei. Bewusst NICHT unter src/pages/. */
export const VORSCHAU_ROUTES = [
  { pattern: '/topics/crafting-werkbank', entrypoint: './src/vorschau-routes/crafting-werkbank.astro' },
  { pattern: '/de/topics/crafting-werkbank', entrypoint: './src/vorschau-routes/de/crafting-werkbank.astro' },
];

/** Was der Vorschau-Bau tragen muss und der Live-Bau nicht tragen darf (relativ zu dist/). */
export const VORSCHAU_DIST_FILES = ['topics/crafting-werkbank.html', 'de/topics/crafting-werkbank.html'];

/** Ein Link auf eine dieser Seiten (Linkpruefung im Live-Bau). */
export const VORSCHAU_HREF = /href=["'](?:https:\/\/verse-base\.com)?\/(?:de\/)?topics\/crafting-werkbank\.html/;

/** Der blosse Pfad, fuer Daten ohne href (Suchregister: Feld c aus
 *  craftEntryPath). Live darf auch dort kein Weg zum Prototyp stehen. */
export const VORSCHAU_PFAD = /\/(?:de\/)?topics\/crafting-werkbank\.html/;
