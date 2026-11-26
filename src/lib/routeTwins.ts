// Gibt es diese Seite auch in der anderen Sprache?
// ---------------------------------------------------------------------------
// Der Sprachumschalter muss das wissen, sonst zeigt er ins Leere. Bisher trug
// jede Seite die Antwort als Prop (`hasEn`) — und zwar nur fuer EINE Richtung:
// von DE nach EN. Die Gegenrichtung galt pauschal als vorhanden, weil DE
// „vollstaendig" war. Genau dort ist es dann aufgefallen: /account/preview.html
// hatte kein DE-Pendant, der Umschalter zeigte trotzdem auf /de/account/
// preview.html, und `_verify` faerbte sich rot.
//
// Statt eine zweite Flagge einzufuehren, die man an ~118 Aufrufstellen wieder
// falsch setzen kann, leiten wir die Antwort aus der Routenliste ab. Vite
// liefert die Dateiliste zur BAUZEIT (`import.meta.glob` mit `eager: false`
// laedt nichts, wir nutzen nur die Schluessel) — also kein Laufzeit-Kosten und
// keine Pflege.
//
// GRENZE, bewusst: Bei dynamischen Routen (`[slug].astro`) weiss die Datei-
// liste nur, dass es die ROUTE gibt, nicht ob `getStaticPaths` genau diesen
// Slug erzeugt. Beide Sprachbaeume speisen sich aus derselben Datenquelle,
// weshalb das in der Praxis deckungsgleich ist; die verbleibende Luecke deckt
// `scripts/_verify.mjs` ueber das fertige dist/ ab — die Pruefung, die den
// urspruenglichen Fehler gefunden hat.

import { LOCALES, type Locale } from '../i18n/ui';
import { HANGAR_ON } from './hangarFlag';
import { HANGAR_ROUTES } from '../../scripts/lib/hangar-switch.mjs';
import { VORSCHAU_PATCH_ROUTES } from '../../scripts/lib/vorschau-patches.mjs';

/** Alle Seiten-Dateien, absolut ab Projektwurzel ("/src/pages/de/archiv.astro"). */
const PAGE_FILES = Object.keys(
  import.meta.glob('/src/pages/**/*.astro', { eager: false }),
);

/**
 * Seiten, die NICHT unter src/pages/ liegen, sondern beim Bauen eingehaengt
 * werden: der Hangar und die Patch-Seiten vor der Abnahme, beide nur im
 * Vorschau-Bau (astro.config.mjs). Die Dateiliste oben kennt sie nicht.
 *
 * ANLASS (24.11.2026, UX-Audit Task-Flows T9): genau deshalb fuehrte DE/EN auf
 * /patches/sc-4-10-3, der Chronik 4.10.3, im Hangar und im Advanced Loadout
 * auf die Startseite der anderen Sprache, obwohl das Gegenstueck im selben Bau
 * stand. Die Muster kommen aus denselben Listen, aus denen astro.config.mjs
 * die Routen einhaengt, und zaehlen nur, wenn dieser Bau sie einhaengt
 * (HANGAR_ON = derselbe Schalter). Endpunkte (.json) sind keine Seiten.
 * verify:sprachweiche prueft das Ergebnis am fertigen dist/.
 */
const INJECTED_PAGES: string[] = HANGAR_ON
  ? [...HANGAR_ROUTES, ...VORSCHAU_PATCH_ROUTES]
      .filter((r: { entrypoint: string }) => r.entrypoint.endsWith('.astro'))
      .map((r: { pattern: string }) => r.pattern)
  : [];

/** Dateipfad unter src/pages -> Routenmuster ("/de/schiffe/[slug]"). */
function fileToRoute(file: string): string {
  const route = file.replace(/^\/src\/pages/, '').replace(/\.astro$/, '');
  // "…/index" ist die Seite des Verzeichnisses selbst: /de/index -> /de
  return route.endsWith('/index') ? route.slice(0, -'/index'.length) : route;
}

/**
 * Routenmuster -> Regex auf die ausgelieferte URL.
 * `build.format: 'file'` legt jede Seite als .html-Datei ab:
 *   /src/pages/index.astro            -> /index.html  (auch "/")
 *   /src/pages/de/index.astro         -> /de.html
 *   /src/pages/schiffe.astro          -> /schiffe.html
 *   /src/pages/de/schiffe/[slug].astro-> /de/schiffe/<irgendwas>.html
 *   eingehaengt '/de/hangar-bay/[id]' -> /de/hangar-bay/<irgendwas>.html
 */
function toMatcher(route: string): RegExp {
  const body = route
    .split('/')
    .map((seg) =>
      seg.startsWith('[...') ? '.+'
      : seg.startsWith('[') ? '[^/]+'
      : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    )
    .join('/');
  // Die Startseite ist sowohl "/" als auch "/index.html".
  return body === '' ? /^\/(index\.html)?$/ : new RegExp(`^${body}\\.html$`);
}

const MATCHERS = [...PAGE_FILES.map(fileToRoute), ...INJECTED_PAGES].map(toMatcher);

/** Wird dieser URL-Pfad von irgendeiner Seiten-Route bedient? */
export function routeExists(pathname: string): boolean {
  const clean = pathname.split('#')[0].split('?')[0];
  return MATCHERS.some((re) => re.test(clean));
}

/**
 * Existiert diese Seite in der Zielsprache? `pathForLocale` liefert den Pfad,
 * den der Umschalter ansteuern wuerde — hier wird geprueft, ob er trifft.
 */
export function twinExists(
  pathname: string,
  target: Locale,
  pathForLocale: (p: string, l: Locale) => string,
): boolean {
  return routeExists(pathForLocale(pathname, target));
}

export { LOCALES };
