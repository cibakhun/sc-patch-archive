/* ============================================================
   vorschau-patches.mjs — Patch-Seiten, die nur der Vorschau-Bau traegt.

   ANLASS (15.11.2026): Krisz will die 4.10.3-Seite neu gestaltet sehen,
   bevor sie live geht; die Daten des Patches gehen schon live. Der Patch
   bleibt im Bestand (Startseite und Archiv nennen ihn als aktuellen), nur
   seine Seite und jeder Verweis darauf fehlen live.

     STAGING=1  Seiten eingehaengt (astro.config.mjs, vorschauPatchRoutes)
     sonst      keine Seiten, keine Links (patchSeiteHref in src/lib/patchPages.ts)

   verify:vorschau-patches prueft beides am Artefakt. Ist die Seite
   abgenommen, faellt der Patch hier heraus und seine Seite zieht nach
   src/pages/patches/ zurueck.
   ============================================================ */

/** Patches, deren Seite nur der Vorschau-Bau traegt (ids wie in src/data/patches/). */
export const VORSCHAU_PATCHES = ['4-10-3'];

/** Die Routen: Muster und Datei. Bewusst NICHT unter src/pages/. */
export const VORSCHAU_PATCH_ROUTES = VORSCHAU_PATCHES.flatMap((id) => [
  { pattern: `/patches/sc-${id}`, entrypoint: `./src/vorschau-patches/sc-${id}.astro` },
  { pattern: `/de/patches/sc-${id}`, entrypoint: `./src/vorschau-patches/de/sc-${id}.astro` },
]);

/** Was der Vorschau-Bau tragen muss und der Live-Bau nicht tragen darf (relativ zu dist/). */
export const VORSCHAU_PATCH_DIST_FILES = VORSCHAU_PATCHES.flatMap((id) => [`patches/sc-${id}.html`, `de/patches/sc-${id}.html`]);

const ALTERNATIVE = VORSCHAU_PATCHES.map((id) => `sc-${id}`).join('|');

/** Der Pfad einer dieser Seiten, in HTML (href) wie in Daten-Dateien (Suchregister). */
export const VORSCHAU_PATCH_PFAD = new RegExp(`\\/(?:de\\/)?patches\\/(?:${ALTERNATIVE})\\.html`);
