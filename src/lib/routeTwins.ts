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

/** Alle Seiten-Dateien, absolut ab Projektwurzel ("/src/pages/de/archiv.astro"). */
const PAGE_FILES = Object.keys(
  import.meta.glob('/src/pages/**/*.astro', { eager: false }),
);

/**
 * Dateipfad -> Regex auf die ausgelieferte URL.
 * `build.format: 'file'` legt jede Seite als .html-Datei ab:
 *   /src/pages/index.astro            -> /index.html  (auch "/")
 *   /src/pages/de/index.astro         -> /de.html
 *   /src/pages/schiffe.astro          -> /schiffe.html
 *   /src/pages/de/schiffe/[slug].astro-> /de/schiffe/<irgendwas>.html
 */
function toMatcher(file: string): RegExp {
  let route = file.replace(/^\/src\/pages/, '').replace(/\.astro$/, '');
  // "…/index" ist die Seite des Verzeichnisses selbst: /de/index -> /de
  if (route.endsWith('/index')) route = route.slice(0, -'/index'.length);
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

const MATCHERS = PAGE_FILES.map(toMatcher);

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
