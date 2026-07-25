// Content-Hash fuer Assets mit FESTER URL (/assets/*.css|js).
//
// Warum das noetig ist: nginx gibt CSS/JS unter fester URL `expires 1d` mit
// (nginx/default.conf), Cloudflare cacht entsprechend. Nach einem Deploy
// liefert die Edge deshalb bis zu 24 h die ALTE Datei. Beobachtet am
// box-sizing-Fix fuer .dp-main: Origin frisch, echte URL `cf-cache-status:
// HIT, age: 6213` mit der Vorversion. Ein `?v=<hash>` erzeugt eine neue URL,
// die nicht im Edge-Cache liegt — der Deploy schlaegt sofort durch.
//
// Der Hash wird pro Prozess GEMERKT. DataShell.astro rendert ~17.000 Seiten;
// ohne Memo laege pro Seite ein readFileSync an. Die Datei aendert sich
// waehrend eines Builds nicht, ein Wert pro Prozess reicht also.
//
// Bestehende Aufrufstellen mit derselben Technik, aber inline: SiteNav.astro
// (/assets/account-lite.js) und PatchArchive.astro (/assets/archive.js).
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const memo = new Map<string, string>();

/**
 * Liefert `<pfad>?v=<sha1-8>` fuer eine Datei unterhalb von /assets.
 * @param file Pfad relativ zum Projektwurzelverzeichnis, z. B. 'assets/data-page.css'
 * @param href Oeffentliche URL, z. B. '/assets/data-page.css'
 */
export function versioned(file: string, href: string): string {
  let ver = memo.get(file);
  if (ver === undefined) {
    try {
      ver = createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 8);
    } catch {
      ver = 'x'; // dev-Fallback, wie in SiteNav.astro
    }
    memo.set(file, ver);
  }
  return `${href}?v=${ver}`;
}
