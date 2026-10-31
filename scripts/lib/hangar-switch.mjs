/* ============================================================
   hangar-switch.mjs — der Hangar gehoert nur in den Vorschau-Bau.

   ANLASS (31.10.2026): Krisz hat entschieden, dass live alles von
   staging bekommt AUSSER dem Hangar. Der Hangar zeigt echte Spielmodelle
   und -texturen; ob die oeffentlich ausgeliefert werden duerfen, ist
   offen (Nutzungsrechte, 07.10.2026). staging und main tragen deshalb
   denselben Code, und dieser Schalter entscheidet beim Bauen:

     STAGING=1  (Vorschau, deploy-staging.yml, CI)  Hangar komplett
     sonst      (Live, deploy-image.yml)            kein Hangar:
                · keine Hangar-Seiten (die Routen werden nur im
                  Vorschau-Bau eingehaengt, astro.config.mjs),
                · keine Modelle, Bilder und Hangar-Skripte in dist/
                  (scripts/_hangar-switch.mjs raeumt sie nach dem Bau weg),
                · keine Links dorthin (HAS_HANGAR in src/lib/seo.ts).

   Das Tor verify:hangar-schalter prueft das am Artefakt in beide
   Richtungen; die Hangar-Tore laufen nur gegen den Vorschau-Bau
   (Registry-Feld `nurMitHangar`).

   Dieselbe Regel steht als HAS_HANGAR in src/lib/seo.ts (Bauzeit der
   Seiten); tests/e2e/hangar-switch.test.js haelt beide gleich.
   ============================================================ */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** true, wenn dieser Bau den Hangar enthaelt. */
export const hangarImBau = (env = process.env) => env?.STAGING === '1';

/** Die Hangar-Routen: Muster und Datei (relativ zum Projektordner). Liegen
 *  bewusst NICHT unter src/pages/, sonst baute Astro sie immer. */
export const HANGAR_ROUTES = [
  { pattern: '/hangar', entrypoint: './src/hangar-routes/hangar.astro' },
  { pattern: '/de/hangar', entrypoint: './src/hangar-routes/de/hangar.astro' },
  { pattern: '/hangar-loadout', entrypoint: './src/hangar-routes/hangar-loadout.astro' },
  { pattern: '/de/hangar-loadout', entrypoint: './src/hangar-routes/de/hangar-loadout.astro' },
  { pattern: '/hangar-bay/[id]', entrypoint: './src/hangar-routes/hangar-bay/[id].astro' },
  { pattern: '/de/hangar-bay/[id]', entrypoint: './src/hangar-routes/de/hangar-bay/[id].astro' },
  { pattern: '/hangar-innen/[id].json', entrypoint: './src/hangar-routes/hangar-innen/[id].json.ts' },
  { pattern: '/hangar-layouts.json', entrypoint: './src/hangar-routes/hangar-layouts.json.ts' },
];

/** Was im Live-Bau nicht in dist/ stehen darf, relativ zu dist/. Ordner
 *  enden auf '/'; `assets/hangar-*.js` sind die Skripte, die nur die
 *  Hangar-Seiten laden. */
export const HANGAR_DIST_DIRS = ['hangar/', 'hangar-bay/', 'de/hangar-bay/', 'hangar-innen/'];
export const HANGAR_DIST_FILES = /^(?:de\/)?hangar(?:-loadout)?\.html$|^hangar-layouts\.json$|^assets\/hangar-[\w-]+\.js$/;

/** true, wenn das GEBAUTE Artefakt den Hangar traegt (dist/build.json
 *  staging !== false). Fehlt oder bricht der Stempel, gilt der Hangar als
 *  da — der strengere Fall: dann laufen alle Hangar-Pruefungen. Tore, die
 *  im Live-Bau weniger verlangen, fragen hier und nirgends sonst. */
export function hangarImArtefakt(distDir = 'dist') {
  try {
    return JSON.parse(readFileSync(join(distDir, 'build.json'), 'utf8')).staging !== false;
  } catch {
    return true;
  }
}

/** Ein Link auf eine Hangar-Seite (fuer die Linkpruefung im Live-Bau). */
export const HANGAR_HREF = /(?:href|action)=["'](?:https:\/\/verse-base\.com)?\/(?:de\/)?hangar(?:-loadout|-bay\/[^"']*)?\.html/;
