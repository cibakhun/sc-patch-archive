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
   src/pages/patches/ zurueck. 4.10.3 ist abgenommen (26.11.2026): ihre
   Chronik steht unter src/pages/patches/sc-4-10-3.astro, die alte
   Vorschau-Adresse 4-10-3-film leitet per 301 dorthin (nginx/umzuege.conf).
   ============================================================ */

/** Patches, deren Seite nur der Vorschau-Bau traegt (ids wie in src/data/patches/). */
export const VORSCHAU_PATCHES = [];

/** Weitere Seiten, die nur der Vorschau-Bau traegt, mit noindex und in keiner Sitemap; nie verlinkt von einer Live-Seite. */
const VORSCHAU_SEITEN = [];

/** Die Routen: Muster und Datei. Bewusst NICHT unter src/pages/. */
export const VORSCHAU_PATCH_ROUTES = [...VORSCHAU_PATCHES.map((id) => `sc-${id}`), ...VORSCHAU_SEITEN].flatMap((name) => [
  { pattern: `/patches/${name}`, entrypoint: `./src/vorschau-patches/${name}.astro` },
  { pattern: `/de/patches/${name}`, entrypoint: `./src/vorschau-patches/de/${name}.astro` },
]);

/** Die weiteren Vorschauseiten (relativ zu dist/): im Vorschau-Bau noindex und in keiner Sitemap. */
export const VORSCHAU_SEITEN_DIST_FILES = VORSCHAU_SEITEN.flatMap((name) => [`patches/${name}.html`, `de/patches/${name}.html`]);

/** Was der Vorschau-Bau tragen muss und der Live-Bau nicht tragen darf (relativ zu dist/). */
export const VORSCHAU_PATCH_DIST_FILES = [
  ...VORSCHAU_PATCHES.flatMap((id) => [`patches/sc-${id}.html`, `de/patches/sc-${id}.html`]),
  ...VORSCHAU_SEITEN_DIST_FILES,
];

const ALTERNATIVE = [...VORSCHAU_PATCHES.map((id) => `sc-${id}`), ...VORSCHAU_SEITEN].join('|');

/** Der Pfad einer dieser Seiten, in HTML (href) wie in Daten-Dateien (Suchregister). */
export const VORSCHAU_PATCH_PFAD = new RegExp(`\\/(?:de\\/)?patches\\/(?:${ALTERNATIVE})\\.html`);
