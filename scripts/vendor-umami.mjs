/* ============================================================
   vendor-umami.mjs — erneuert die gepinnte Kopie des Umami-Zaehlers
   unter public/vendor/umami/script.js. Werkzeug, kein Pruefer.

   WARUM ES EINE KOPIE GIBT (29.10.2026): Der Zaehler lief als Skript von
   stats.verse-base.com auf jeder Seite, und die Content-Security-Policy
   musste den Host dafuer in script-src fuehren. Wer den Statistik-Server
   uebernimmt, haette damit ein Skript auf allen Seiten gehabt, neben der
   Sitzung im localStorage. Jetzt laedt die Seite eine gepruefte Kopie vom
   eigenen Ursprung, und stats.verse-base.com nimmt nur noch die Zaehlung
   entgegen (data-host-url, connect-src).

   Gepinnt heisst: die Kopie aendert sich nur, wenn jemand dieses Werkzeug
   bewusst mit einer neuen Fassung laufen laesst. Ein Umami-Update auf dem
   Server aendert an der Seite nichts. scripts/verify-zaehler.mjs prueft
   im gebauten Stand, dass die Datei unveraendert ist (Pruefsumme im Kopf)
   und dass sie in node:vm wirklich an stats.verse-base.com zaehlt.

   ERNEUERN:
     1. Fassung waehlen. Die Kopie muss zur Server-Fassung passen; die
        steht in Umami unter Einstellungen → Ueber (oder im Image-Tag des
        Containers auf dem Statistik-Server).
     2. node scripts/vendor-umami.mjs v3.4.1        (Tag aus GitHub)
     3. git diff public/vendor/umami/script.js lesen — das ist die
        Pruefung. Neue data-Attribute, neue Kopfzeilen, ein anderer
        Endpunkt? Dann Layout.astro bzw. CSP nachziehen.
     4. npm run build && npm run gate (verify:zaehler faehrt die neue
        Kopie in node:vm), danach Commit.

   Was das Werkzeug tut — dasselbe wie Umamis eigener Bau
   (rollup.tracker.config.js), nur ohne Verkleinerung, damit die Kopie
   lesbar bleibt:
     - holt src/tracker/index.ts (aeltere Tags: index.js) des Tags von
       raw.githubusercontent.com und haelt dessen sha256 fest,
     - entfernt die Typen (esbuild, Ziel es2022 wie tsconfig.tracker.json),
     - ersetzt __COLLECT_API_HOST__ durch '' und __COLLECT_API_ENDPOINT__
       durch '/api/send' (die Vorgaben des Umami-Baus),
     - schreibt Kopf (Herkunft, Lizenz, Pruefsummen) und Rumpf.

   Braucht Netz (GitHub) und esbuild aus node_modules — laeuft deshalb
   nur auf dem Entwicklungsrechner, nie im Tor.
   ============================================================ */
import { writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform, version as esbuildVersion } from 'esbuild';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ZIEL = resolve(ROOT, 'public/vendor/umami/script.js');
const TAG = process.argv[2];
if (!/^v\d+\.\d+\.\d+$/.test(TAG ?? '')) {
  console.error('Aufruf: node scripts/vendor-umami.mjs v<major>.<minor>.<patch>   (z. B. v3.4.1)');
  process.exit(2);
}

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const RAW = `https://raw.githubusercontent.com/umami-software/umami/refs/tags/${TAG}`;

async function hole(pfad) {
  const r = await fetch(`${RAW}/${pfad}`);
  return r.ok ? { pfad, text: await r.text() } : null;
}

const quelle = (await hole('src/tracker/index.ts')) ?? (await hole('src/tracker/index.js'));
if (!quelle) { console.error(`${TAG}: weder src/tracker/index.ts noch index.js gefunden`); process.exit(1); }
if (!quelle.text.includes('__COLLECT_API_ENDPOINT__')) {
  console.error(`${TAG}: ${quelle.pfad} traegt den Platzhalter __COLLECT_API_ENDPOINT__ nicht mehr — Umamis Bau hat sich geaendert, erst rollup.tracker.config.js des Tags lesen`);
  process.exit(1);
}

// Erst ersetzen, dann umwandeln — dieselbe Reihenfolge wie Umamis Bau
// (typescript, replace, terser). Umgekehrt faltet esbuild den noch
// wahrheitswertigen Platzhalter in `hostUrl || '__COLLECT_API_HOST__' ||
// currentScript.src…` weg, und der Rueckfall auf den Skriptpfad ginge
// verloren (beim ersten Lauf am 29.10.2026 genau so passiert).
const ersetzt = quelle.text
  .replaceAll('__COLLECT_API_HOST__', '')
  .replaceAll('__COLLECT_API_ENDPOINT__', '/api/send');
const { code: rumpf } = await transform(ersetzt, {
  loader: quelle.pfad.endsWith('.ts') ? 'ts' : 'js',
  target: 'es2022',
  format: 'esm',
  legalComments: 'none',
});
if (/\bexport\b|\bimport\b/.test(rumpf.replace(/\/\/.*$/gm, ''))) {
  console.error('Die Kopie enthaelt nach der Umwandlung noch export/import — als klassisches Skript liefe sie nicht');
  process.exit(1);
}

const kopf = `/* Umami-Zaehler — gepinnte Kopie, NICHT von Hand aendern.
 *
 * Herkunft:   https://github.com/umami-software/umami
 * Fassung:    ${TAG}
 * Datei:      ${quelle.pfad}
 * Quelle-sha256: ${sha256(quelle.text)}
 * Umwandlung: Typen entfernt (esbuild ${esbuildVersion}, Ziel es2022),
 *             __COLLECT_API_HOST__ -> '', __COLLECT_API_ENDPOINT__ -> '/api/send'
 *             (wie rollup.tracker.config.js), nicht verkleinert.
 * Rumpf-sha256: ${sha256(rumpf)}  (ueber LF-Zeilenenden)
 *
 * Erneuern: node scripts/vendor-umami.mjs <tag>, Diff lesen,
 * npm run build && npm run gate (verify:zaehler prueft diese Datei).
 *
 * MIT License — Copyright (c) 2022 Umami Software, Inc. <hello@umami.is>
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions: The above copyright
 * notice and this permission notice shall be included in all copies or
 * substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * --- Ende des Kopfes --- */
`;

mkdirSync(dirname(ZIEL), { recursive: true });
writeFileSync(ZIEL, kopf + rumpf);
console.log(`public/vendor/umami/script.js geschrieben: ${TAG} (${quelle.pfad}), Rumpf ${rumpf.length} Zeichen, Rumpf-sha256 ${sha256(rumpf)}`);
console.log('Jetzt: git diff lesen, dann npm run build && npm run gate.');
