/* ============================================================
   page-pairs.mjs — EN/DE-Seitenpaarung ueber alle HTML-Dateien unter dist/.

   Bislang DREIFACH kopiert (verify-fx.mjs Zusicherung 6, verify-help.mjs
   Zusicherung 3, verify-typo-motion.mjs Zusicherung 5) — dieser Plan zieht
   sie in EIN Modul, statt eine vierte handgetippte Kopie anzulegen, die
   spaeter still auseinanderlaeuft. Die Regel bleibt WOERTLICH die
   bestehende — dieser Plan aendert das Verhalten der drei Vorgaenger
   NICHT (Plan 02 haengt sie erst auf dieses Modul um):

     EN ist alles, was nicht mit "dist/de/" beginnt und nicht "dist/de.html"
     ist. Der DE-Partner von "dist/index.html" ist "dist/de.html", sonst
     "dist/de/" plus Restpfad. Existiert der Partner nicht, ist die Datei
     KEIN Paar und wird still uebersprungen (nicht gemeldet) — das betrifft
     heute dist/404.html plus vier aus public/downloads/ bzw.
     public/onepager/ kopierte Dateien (04-RESEARCH.md § Pairing).
   ============================================================ */

/**
 * @param {string[]} htmlFiles Absolute/relative dist-Pfade mit "/"-Trennern.
 * @returns {{ pairs: [string, string][], enOnly: string[] }}
 */
export function findPagePairs(htmlFiles) {
  const set = new Set(htmlFiles);
  const enFiles = htmlFiles.filter((f) => !f.startsWith('dist/de/') && f !== 'dist/de.html');
  const pairs = [];
  const enOnly = [];
  for (const f of enFiles) {
    const rel = f.slice('dist/'.length);
    const dePath = rel === 'index.html' ? 'dist/de.html' : 'dist/de/' + rel;
    if (!set.has(dePath)) {
      enOnly.push(f);
      continue;
    }
    pairs.push([f, dePath]);
  }
  return { pairs, enOnly };
}

/**
 * Bricht mit fail() ab, wenn weniger als `min` Paare gefunden wurden — die
 * Sicherung "die Paarung selbst ist kaputt", woertlich aus den drei
 * Vorgaengern uebernommen (Standardwert 60 bewusst unveraendert, siehe
 * Kopfkommentar oben).
 * @param {[string, string][]} pairs
 * @param {(msg: string) => void} fail
 * @param {number} [min]
 */
export function assertMinimumPairs(pairs, fail, min = 60) {
  if (pairs.length < min) {
    fail(`Zu wenige Seitenpaare gefunden (${pairs.length} < ${min}) — Paarungslogik pruefen`);
  }
}
