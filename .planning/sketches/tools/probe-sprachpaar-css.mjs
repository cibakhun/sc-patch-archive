/* HAT DIE DEUTSCHE FASSUNG DIESELBEN MEDIA-QUERIES WIE DIE ENGLISCHE?
   ⚠⚠ Wiederkehrender Fehler dieses Projekts: Seiten-CSS ist je Sprache
   dupliziert (src/pages/x.astro UND src/pages/de/x.astro sind zwei eigene
   Quellen), und `verify:sync` vergleicht nur das Skelett — nicht das CSS.
   Am 30.08.2026 fehlte `.tools{position:static}` in der DE-Fassung von
   /downloads; am 31.08.2026 blieben die Tastenkappen auf /de.html stehen,
   nachdem /index.html schon repariert war. Beide Male hat es erst die
   NACHMESSUNG gefunden, kein Tor.

   Gemessen wird am ARTEFAKT (dist/), nicht an der Quelle: was zählt, ist
   was ausgeliefert wird. Verglichen werden nur die inline <style>-Blöcke —
   die gebündelten _astro-Dateien sind für beide Sprachen dieselbe Datei
   und können gar nicht abweichen.

   ⚠ Diese Datei enthält bewusst KEINEN doppelten Backslash: der Heredoc
   der Git-Bash frisst ihn, und das Skript stirbt am Syntaxfehler.

   node .planning/sketches/tools/probe-sprachpaar-css.mjs                  */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';

const mq = (html) => {
  const s = new Set();
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g))
    for (const q of m[1].matchAll(/@media[^{]+/g))
      s.add(q[0].replace(/@media\s*/, '').replace(/\s+/g, ' ').trim());
  return s;
};

const seiten = [];
const lauf = (d) => {
  for (const e of readdirSync(d)) {
    const p = d + '/' + e;
    if (statSync(p).isDirectory()) { if (!/^(_astro|assets|vendor|downloads|de)$/.test(e)) lauf(p); continue; }
    if (e.endsWith('.html')) seiten.push(p);
  }
};
lauf('dist');

let paare = 0, schief = 0;
const muster = {};
for (const en of seiten) {
  const rel = en.slice('dist'.length);
  const de = 'dist/de' + rel;
  if (!existsSync(de)) continue;
  paare++;
  const a = mq(readFileSync(en, 'utf8')), b = mq(readFileSync(de, 'utf8'));
  const nurEN = [...a].filter((x) => !b.has(x));
  const nurDE = [...b].filter((x) => !a.has(x));
  if (!nurEN.length && !nurDE.length) continue;
  schief++;
  const k = nurEN.map((x) => 'nur EN: ' + x).concat(nurDE.map((x) => 'nur DE: ' + x)).join(' | ');
  (muster[k] ||= []).push(rel);
}
console.log('Seitenpaare geprüft: ' + paare);
console.log('Paare mit abweichenden Media-Queries: ' + schief + '  (' + Object.keys(muster).length + ' Muster)');
for (const [k, v] of Object.entries(muster).sort((x, y) => y[1].length - x[1].length).slice(0, 20))
  console.log('  ' + String(v.length).padStart(5) + ' Seiten  ' + k + '\n           (' + v.slice(0, 2).join('  ') + ')');
