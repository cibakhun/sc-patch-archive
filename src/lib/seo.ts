// Indexierbarkeit an EINER Stelle.
//
// Vorher stand die Entscheidung „gehört diese Seite in den Index?" zweimal im
// Code und die beiden Stellen widersprachen sich: die Seite setzte
// `noindex={true}` am Layout, die Sitemap entdeckte sie per Glob trotzdem und
// bewarb sie. Google meldet das als „Übermittelte URL als ‚noindex' markiert"
// — die Seite wird nicht indexiert UND die Sitemap gilt als fehlerhaft.
//
// Diese Liste ist die einzige Quelle: das Layout macht daraus <meta robots>,
// die Sitemap lässt genau diese URLs weg. audit-site.mjs prüft nach dem Bauen,
// dass beide Signale übereinstimmen — eine neue Seite kann also nicht
// unbemerkt auseinanderlaufen.
//
// BEWUSST OHNE IMPORTS: sitemap.xml.ts meidet den Import von i18n/ui (Zyklus),
// darum bringt dieses Modul seine Pfad-Normalisierung selbst mit.

/**
 * Basisform (= EN-Pfad) eines Pfads. Spiegelt i18n/ui#toBaseForm; DE lebt unter
 * /de/…, die Startseite heißt in beiden Sprachen '/index.html'.
 */
function toBaseForm(pathname: string): string {
  if (pathname === '/de' || pathname === '/de.html') return '/index.html';
  if (pathname.startsWith('/de/')) pathname = pathname.slice(3);
  if (pathname === '' || pathname === '/') return '/index.html';
  return pathname;
}

/**
 * Seiten, die NICHT in den Suchindex gehören — jeweils als Basisform (EN-Pfad);
 * das DE-Pendant unter /de/… ist automatisch mit gemeint.
 *
 * Aufgenommen wird nur, was für Suchende keinen Wert hat:
 *   - Kontobereich: persönliche Ansicht bzw. reine Hilfsseiten hinter einem
 *     Mail-Link. (Anmelden/Registrieren bleiben BEWUSST indexierbar.)
 *   - /refinery.html: Werkzeug, das ohne Login nichts anzeigt.
 *   - /pilot.html: öffentliche Profilseite, deren Inhalt erst clientseitig aus
 *     Supabase kommt. Für Crawler ist sie eine leere Hülle mit generischem
 *     Titel — indexiert würde sie als „soft 404" gewertet. Zusätzlich verlinkt
 *     sie niemand intern (der Handle-Link entsteht erst im Dashboard-JS).
 */
export const NOINDEX_PATHS: ReadonlySet<string> = new Set([
  '/account.html',
  '/account/preview.html',
  '/account/reset.html',
  '/account/update-password.html',
  '/refinery.html',
  '/pilot.html',
]);

/**
 * Vorschau-Build (Staging). Wird von .github/workflows/deploy-staging.yml
 * gesetzt und macht die GANZE Seite unindexierbar.
 *
 * Warum das hier steht und nicht im Layout: Indexierbarkeit hat genau eine
 * Quelle, und audit-site.mjs prueft nach dem Bauen, dass <meta robots> und
 * Sitemap uebereinstimmen. Eine zweite, oeffentlich erreichbare Kopie der
 * Site waere sonst Duplicate Content gegen die eigene Domain.
 *
 * `process.env` statt `import.meta.env`: dieses Modul laeuft ausschliesslich
 * zur Bauzeit (Layout-Frontmatter, sitemap.xml.ts, robots.txt.ts), und die
 * Variable soll NICHT ins Client-Bundle wandern.
 */
export const IS_STAGING: boolean =
  typeof process !== 'undefined' && process.env?.STAGING === '1';

/** true, wenn dieser Pfad (DE oder EN) auf noindex stehen soll. */
export function isNoindex(pathname: string): boolean {
  if (IS_STAGING) return true;
  return NOINDEX_PATHS.has(toBaseForm(pathname));
}
