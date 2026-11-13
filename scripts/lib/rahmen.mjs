/* ============================================================
   rahmen.mjs — wer darf die Seite in ein <iframe> setzen?

   Live: niemand. Die Seite rahmt fremde Inhalte (YouTube), wird aber
   selbst nirgends eingebettet; X-Frame-Options DENY und frame-ancestors
   'none' sind dort folgenlos und halten Clickjacking fern.

   Vorschau-Bau: die Seite sich selbst, sonst niemand. ANLASS
   (13.11.2026): Das Terminal im Leitstand des Hangars zeigt die Seiten
   der Website in einem Fenster auf dem Schirm der Halle
   (assets/hangar-terminal.js). Den Hangar gibt es nur im Vorschau-Bau
   (scripts/lib/hangar-switch.mjs), also oeffnet auch nur dieser Bau den
   Rahmen, und nur fuer den eigenen Ursprung: SAMEORIGIN, frame-ancestors
   'self', und 'self' in frame-src, damit die Hangar-Seite das Fenster
   laden darf.

   Die Kopfzeilen in nginx/default.conf nennen die Werte nicht woertlich,
   sondern ueber drei Maps, die wie die Inline-Hashes eine Datei aus
   dist/_csp/ lesen. Der Bau schreibt sie (scripts/_write-csp-hashes.mjs),
   audit:csp prueft sie gegen das Artefakt. RUECKFALL der Maps ist der
   strenge Wert: ohne Datei bleibt die Seite zu.

   Kommt der Hangar eines Tages nach live, faellt die Entscheidung HIER
   (rahmenOffenImBau), nicht in der nginx-Konfiguration.
   ============================================================ */
import { hangarImBau, hangarImArtefakt } from './hangar-switch.mjs';

/** Die drei Stellen: nginx-Variable, Datei unter dist/_csp/, wo sie in den
 *  Kopfzeilen steht, und der Wert zu (Rueckfall der Map) bzw. offen. */
export const RAHMEN = Object.freeze([
  { variable: 'vb_frame_self', datei: 'frame-src.conf', wo: 'frame-src', zu: '', offen: "'self'" },
  { variable: 'vb_frame_ancestors', datei: 'frame-ancestors.conf', wo: 'frame-ancestors', zu: "'none'", offen: "'self'" },
  { variable: 'vb_xfo', datei: 'x-frame-options.conf', wo: 'X-Frame-Options', zu: 'DENY', offen: 'SAMEORIGIN' },
]);

export const rahmenWert = (eintrag, offen) => (offen ? eintrag.offen : eintrag.zu);

/** true, wenn dieser Bau das Rahmen durch die eigene Seite erlaubt. */
export const rahmenOffenImBau = (env = process.env) => hangarImBau(env);

/** Dasselbe Urteil ueber das gebaute Artefakt (dist/build.json). */
export const rahmenOffenImArtefakt = (distDir = 'dist') => hangarImArtefakt(distDir);
