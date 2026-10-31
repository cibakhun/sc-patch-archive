/* Der Hero-Titel der Themenseiten rechnet nur in vw. Auf einem quer
   gehaltenen Telefon (932x430) ergibt 13vw eine Schriftgroesse von 121 px
   — auf einem 430 px hohen Bildschirm. „Tactical Strike Groups" brauchte
   dort drei Zeilen, und die dritte („Groups") lag unter der Fensterkante.
   Gemessen und im Bild bestaetigt am 31.08.2026.

   Deshalb bekommt der Titel bei flachen Fenstern eine HOEHEN-Grenze.
   12vh sind bei 430 px 51,6 px und bei 390 px 46,8 px; oberhalb von
   560 px Fensterhoehe aendert sich nichts.                                */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const dir = 'src/components/topics';
const REGEL = [
  '',
  '/* ⚠ GEMESSEN 31.08.2026 — QUERFORMAT: die Formel oben rechnet nur in vw.',
  '   Bei 932x430 ergab das 121 px Schrift auf 430 px Bildschirm, und die',
  '   letzte Titelzeile lag unter der Kante („Tactical Strike Gro…").',
  '   Ueber 560 px Fensterhoehe aendert diese Regel nichts. */',
  '@media(max-height:560px){.hero h1{font-size:12vh}}',
].join('\n');
let n = 0;
for (const f of readdirSync(dir)) {
  if (!f.endsWith('.astro')) continue;
  const p = dir + '/' + f;
  const s = readFileSync(p, 'utf8');
  if (s.includes('max-height:560px){.hero h1')) continue;
  const m = s.match(/\.hero h1\{font-size:clamp\([^}]*\}/);
  if (!m) { console.log('  ' + f + '  KEINE .hero h1-Regel — uebersprungen'); continue; }
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  writeFileSync(p, s.replace(m[0], m[0] + REGEL.split('\n').join(eol)), 'utf8');
  n++;
}
console.log('Hoehendeckel gesetzt: ' + n);
