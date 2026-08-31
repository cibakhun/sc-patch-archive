/* DAS GRUNDMUSTER DES AUFLOESUNGS-DURCHGANGS, statisch gesucht.

   `font-size: clamp(3.4rem, 14vw, 11rem)` liest sich wie „waechst mit dem
   Fenster". Tatsaechlich greift auf JEDEM Telefon der UNTERE Anschlag:
   14vw sind bei 320 px nur 44,8 px, also gewinnt 3.4rem = 61,2 px. Die
   Formel ist dort keine Formel mehr, sondern eine feste Zahl — und zwar
   die groesste der drei.

   Am 31.08.2026 war das viermal die Ursache eines sichtbaren Bruchs
   (Themen-Titel, Schiffs-Buehne, Missions-Titel, One-Pager-Titel).

   Gemeldet wird jede Formel, deren unterer Anschlag bei 320 px Fenster
   groesser ist als ihre mittlere Komponente — dort ist die Skalierung
   ausser Kraft. Das ist eine KANDIDATENLISTE, kein Fehlerbericht: bei
   kleinen Schriften ist ein fester Boden genau richtig. Ab welcher Groesse
   es weh tut, entscheidet das Auge.

   NACHGESCHLAGEN 31.08.2026, die sechs groessten Schrift-Kandidaten:
     .node__ver-ghost  90px   Geister-Versionsnummer im Zeitstrahl
     .sstep .sn        63px   Schrittnummer der Scrolly-Sektion
     .pp-error__code   61px   Fehlercode „404"
     .era__glyph       54px   Aera-Zeichen
     .tele__n          49px   Zahl im Zeitstrahl
   Alles ZAHLEN oder Einzelzeichen — dort ist ein fester Boden genau
   richtig, es gibt nichts zu brechen. Diese Liste ersetzt also NICHT die
   dynamische Messung (mess-wortbruch.mjs), sie ergaenzt sie: sie sagt, WO
   die Skalierung ausgehebelt ist, nicht ob es weh tut.

   node .planning/sketches/tools/suche-clamp-anschlag.mjs [grenze-in-px]  */
import { readdirSync, readFileSync, statSync } from 'node:fs';

const FENSTER = Number(process.env.FENSTER || 320);
const GRENZE = Number(process.argv[2] || 28);     /* ab dieser Schriftgroesse hinsehen */
const REM = 18;                                    /* Basis dieses Projekts, gemessen */

const dateien = [];
const lauf = (d) => {
  for (const e of readdirSync(d)) {
    const p = d + '/' + e;
    /* ⚠ public/assets/ wird beim Build aus assets/ ERZEUGT und ist
       gitignoriert — mitzuscannen verdoppelt jeden Fund. */
    if (statSync(p).isDirectory()) { if (!/node_modules|\.git|dist/.test(e) && p !== 'public/assets') lauf(p); continue; }
    if (/\.(astro|css|html)$/.test(e)) dateien.push(p);
  }
};
lauf('src'); lauf('assets'); lauf('public');

const inPx = (w) => {
  const m = w.trim().match(/^([0-9.]+)(rem|px|em|vw|vh|%)$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (m[2] === 'px') return n;
  if (m[2] === 'rem' || m[2] === 'em') return n * REM;
  if (m[2] === 'vw') return (n / 100) * FENSTER;
  return null;                                      /* vh/% haengen von der Hoehe ab */
};

const funde = [];
for (const f of dateien) {
  const s = readFileSync(f, 'utf8');
  for (const m of s.matchAll(/([a-z-]+)\s*:\s*clamp\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)) {
    const prop = m[1];
    if (!/font-size|height|min-height|width/.test(prop)) continue;
    const teile = m[2].split(/,(?![^(]*\))/).map((x) => x.trim());
    if (teile.length !== 3) continue;
    const unten = inPx(teile[0]), mitte = inPx(teile[1]);
    if (unten === null || mitte === null) continue;
    if (unten <= mitte) continue;                   /* Skalierung greift, alles gut */
    if (prop === 'font-size' && unten < GRENZE) continue;
    const zeile = s.slice(0, m.index).split('\n').length;
    funde.push({ f, zeile, prop, formel: 'clamp(' + m[2] + ')', unten: Math.round(unten), mitte: Math.round(mitte) });
  }
}

funde.sort((a, b) => (b.unten - b.mitte) - (a.unten - a.mitte));
console.log(`Bei ${FENSTER} px Fenster: ${funde.length} clamp-Formeln, deren unterer Anschlag die Skalierung aushebelt`);
console.log(`(nur font-size/height/width; font-size erst ab ${GRENZE} px, kleine Schriften brauchen ihren Boden)\n`);
for (const x of funde.slice(0, 30))
  console.log(`  ${String(x.unten).padStart(4)}px statt ${String(x.mitte).padStart(4)}px  ${x.prop.padEnd(11)} ${x.f}:${x.zeile}\n        ${x.formel.slice(0, 78)}`);
