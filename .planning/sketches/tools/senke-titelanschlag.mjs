/* Die Hero-Titel der Themenseiten tragen `clamp(<rem>, <vw>, <rem>)`. Der
   UNTERE Anschlag (~3.4rem = 61,2 px) greift auf jedem Telefon und ist
   dort zu gross: bei 320 px Fensterbreite stehen 274 px zur Verfuegung,
   „XenoThreat" braucht 371 und „Engineering" 368. Mit
   `overflow-wrap:break-word` bricht der Browser dann MITTEN IM WORT —
   „Contest / ed Zones" ist am 31.08.2026 im Auflösungsbogen aufgefallen.

   Die vw-Komponente derselben Formel waere bereits richtig (14vw = 44,8 px
   bei 320). Es genuegt also, den unteren Anschlag so weit zu senken, dass
   er auf Telefonen nicht mehr bindet. Oberhalb von ~437 px aendert sich
   dadurch NICHTS — dort war schon vorher die vw-Komponente die groessere.  */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const dir = 'src/components/topics';
let n = 0;
for (const f of readdirSync(dir)) {
  if (!f.endsWith('.astro')) continue;
  const p = dir + '/' + f;
  const s = readFileSync(p, 'utf8');
  const neu = s.replace(/(\.hero h1\{font-size:clamp\()([0-9.]+)rem/g, (m, a, x) => {
    if (Number(x) <= 2.1) return m;
    n++;
    return a + '2.1rem';
  });
  if (neu !== s) { writeFileSync(p, neu, 'utf8'); console.log('  ' + f + '  angepasst'); }
}
console.log('Anschlaege gesenkt: ' + n);
