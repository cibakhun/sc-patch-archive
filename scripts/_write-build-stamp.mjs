/* ============================================================
   _write-build-stamp.mjs — das Artefakt traegt seine Herkunft.

   Schreibt dist/build.json:
     { "sha": "<Commit>", "kurz": "<7 Zeichen>", "staging": true|false,
       "gebautAm": "<ISO>" }

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

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
if (!existsSync(DIST)) mkdirSync(DIST, { recursive: true });

const sha = (process.env.GIT_SHA || '').trim() || 'dev';
const stempel = {
  sha,
  kurz: sha === 'dev' ? 'dev' : sha.slice(0, 7),
  staging: process.env.STAGING === '1',
  gebautAm: new Date().toISOString(),
};

writeFileSync(resolve(DIST, 'build.json'), JSON.stringify(stempel, null, 2) + '\n');
console.log(`build.json: ${stempel.kurz}${stempel.staging ? ' (Vorschau)' : ''} · ${stempel.gebautAm}`);
