/* ============================================================
   vorschau-patches.mjs — Patch-Seiten, die nur der Vorschau-Bau traegt.

   ANLASS (15.11.2026): Krisz will die 4.10.3-Seite neu gestaltet sehen,
   bevor sie live geht; live gehen nur die Daten des Patches („ich sagte es
   soll nur datenbank live geh"). Live fehlt der Patch deshalb ganz als
   Patch: keine Seite, kein Archiv-Eintrag, keine Karte „Aktuell", kein
   Abzeichen. Stand-Angaben der Datenseiten nennen weiter die Spielversion,
   aus der ihre Werte stammen.

     STAGING=1  Patch und Seiten da (astro.config.mjs, vorschauPatchRoutes)
     sonst      Patch-Datei aus dem Bestand genommen (src/content.config.ts,
                patchImBestand in src/lib/patchPages.ts), keine Seiten

   verify:vorschau-patches prueft beides am Artefakt. Ist die Seite
   abgenommen, faellt der Patch hier heraus und seine Seite zieht nach
   src/pages/patches/ zurueck.
   ============================================================ */

/** Patches, deren Seite nur der Vorschau-Bau traegt (ids wie in src/data/patches/). */
export const VORSCHAU_PATCHES = ['4-10-3'];

/** Die Patch-Dateien unter src/data/patches/, die der Live-Bau nicht einliest. */
export const VORSCHAU_PATCH_DATEIEN = VORSCHAU_PATCHES.map((id) => `${id}.json`);
/**
 * Weitere Seiten, die nur der Vorschau-Bau traegt: die Chronik zu 4.10.3
 * (src/components/patch-chronik/Chronik.astro, Route 4-10-3-film). Mit noindex
 * und in keiner Sitemap; nie verlinkt von einer Live-Seite.
 */
const VORSCHAU_SEITEN = ['4-10-3-film'];

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
