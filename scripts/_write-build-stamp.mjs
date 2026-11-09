/* ============================================================
   _write-build-stamp.mjs — das Artefakt traegt seine Herkunft.

   Schreibt dist/build.json:
     { "sha": "<Commit>", "kurz": "<7 Zeichen>", "staging": true|false,
       "supabase": { "ziel": "live"|"vorschau", "ref": "<Projekt-Ref>" },
       "gebautAm": "<ISO>" }
   und denselben Inhalt Byte fuer Byte noch einmal als dist/build.txt.

   WARUM ZWEIMAL (08.11.2026): Cloudflare antwortet dem GitHub-Runner
   seit mindestens 01.11. auf staging UND live mit 403 fuer HTML, .json
   und Pfade ohne Endung; .css, .js, .woff2 und robots.txt kommen durch.
   Das passt zu Cloudflares Liste statischer Dateien, in der .txt steht,
   .json nicht. Der Warte-Schritt der Deploy-Laeufe meldete deshalb nur
   noch "NICHT geprueft". build.txt ist derselbe Stempel unter einer
   Endung, die Cloudflare durchlaesst; check-deployed.mjs liest ihn, wenn
   build.json gesperrt ist. build.json bleibt der Hauptweg (D-07,
   check:staging vom Entwicklungsrechner aus).

   `supabase` nennt das Projekt, das dieser Bau anspricht
   (scripts/lib/supabase-ziel.mjs). verify:supabase-ziel prueft dist/
   dagegen, check:staging kann es von aussen ablesen.

   WARUM ES DEN GIBT: Bis heute liess sich von aussen NICHT feststellen, ob
   die ausgelieferte Seite den neuen Stand zeigt — es sei denn, die
   Aenderung war sichtbar. Bei Werkzeug-, Tor- oder Datenaenderungen sieht
   die Seite identisch aus, und "CI gruen" ist keine Antwort:

     · 08.08.2026 (cf58c76): jeder staging-Build riss, staging lieferte
       knapp vier Stunden still den Vortagsstand aus. Aufgefallen ist es
       erst, als sich eine Sichtpruefung ueber alte Inhalte wunderte.
     · Coolify hing an anderem Tag 20 Minuten nach gruenem CI in der
       Warteschlange.

   Mit dieser Datei beantwortet `npm run check:staging` die Frage in einer
   Sekunde. Konzept: docs/maschinelle-validierung.md, Baustein B11.

   ⚠ Die Kennung kommt als ARGUMENT herein, NICHT aus git: der
   Build-Container hat weder git noch ein Repository (das Dockerfile
   kopiert den Quelltext hinein). Genau daran ist cf58c76 gestorben. Die
   Workflows reichen ${{ github.sha }} als Docker-ARG durch; lokal steht
   dort "dev".

     node scripts/_write-build-stamp.mjs
   ============================================================ */
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zielImBau } from './lib/supabase-ziel.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
if (!existsSync(DIST)) mkdirSync(DIST, { recursive: true });

const sha = (process.env.GIT_SHA || '').trim() || 'dev';
const ziel = zielImBau();
const stempel = {
  sha,
  kurz: sha === 'dev' ? 'dev' : sha.slice(0, 7),
  staging: process.env.STAGING === '1',
  supabase: { ziel: ziel.ziel, ref: ziel.ref },
  gebautAm: new Date().toISOString(),
};

const text = JSON.stringify(stempel, null, 2) + '\n';
writeFileSync(resolve(DIST, 'build.json'), text);
writeFileSync(resolve(DIST, 'build.txt'), text);
console.log(`build.json + build.txt: ${stempel.kurz}${stempel.staging ? ' (Vorschau)' : ''} · Supabase ${ziel.ziel} (${ziel.ref}) · ${stempel.gebautAm}`);
