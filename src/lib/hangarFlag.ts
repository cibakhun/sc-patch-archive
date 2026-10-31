// Browserseite von HAS_HANGAR (src/lib/seo.ts): astro.config.mjs setzt
// __VB_HANGAR__ beim Bauen fest ein, im Vorschau-Bau true, live false
// (Begruendung: scripts/lib/hangar-switch.mjs). Ausserhalb des Baus, etwa
// wenn ein Test das Modul mit esbuild buendelt, gilt true: dort verhaelt
// sich alles wie bisher, und ein Test kann false per define setzen.
declare const __VB_HANGAR__: boolean | undefined;

export const HANGAR_ON: boolean = typeof __VB_HANGAR__ === 'boolean' ? __VB_HANGAR__ : true;
