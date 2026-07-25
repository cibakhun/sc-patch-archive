// Mirror the canonical /assets into /public/assets so Astro serves them at
// /assets/* — runs before dev/build. Keeps a single source of truth for the
// media (the committed /assets) and keeps the 15 MB duplicate OUT of git
// (public/assets is gitignored). At the final cutover, assets will MOVE into
// public/ permanently and this script + the gitignore entry go away.
//
// AUSGENOMMEN: die `*-gamefiles.json`. Das sind reine Build-EINGABEN aus der
// lokalen Data.p4k (gitignored, siehe .gitignore) — sie werden von den
// build-*-Skripten gelesen und in die ausgelieferten JSONs eingearbeitet;
// zur Laufzeit laedt sie niemand. Mitkopiert waeren es ~9 MB toter Payload in
// dist, und weil sie in CI gar nicht existieren, saehe die lokale Vorschau
// anders aus als die Produktion.
import { cp } from 'node:fs/promises';

const IS_BUILD_INPUT = /-gamefiles\.json$/i;

await cp('assets', 'public/assets', {
  recursive: true,
  filter: (src) => !IS_BUILD_INPUT.test(src),
});
console.log('synced assets -> public/assets (ohne *-gamefiles.json)');
