/* ZUSAMMENGEKLEBTE MASCHINENBEZEICHNER IM SICHTBAREN TEXT.
   „CountermeasureLauncher WeaponDefensive" — CamelCase gehoert in
   Datenfelder, nicht in einen Satz, den ein Leser liest. Gemessen wird der
   ausgelieferte Bestand: jedes Wort mit einem Grossbuchstaben MITTEN drin,
   das nicht in einer Ausnahmeliste steht.

   node .planning/sketches/tools/mess-camelcase-text.mjs                  */
import { readdirSync, readFileSync, statSync } from 'node:fs';

/* Echte Namen mit Binnenversalie — die sind kein Befund. */
const ERLAUBT = /^(VerseBase|GrimHEX|McDonald|MicroTech|microTech|CryAstro|DeMarco|MacFlac|LeBlanc|O'Neill|RSI|CIG|UEC|aUEC|SCU|HP|DPS|EM|IR|CO2|iOS|JavaScript|GitHub|YouTube|PayPal|DataCore)$/;

const funde = {};
let seiten = 0;
const lauf = (d) => {
  for (const e of readdirSync(d)) {
    const p = d + '/' + e;
    if (statSync(p).isDirectory()) { if (!/^(_astro|assets|vendor|downloads)$/.test(e)) lauf(p); continue; }
    if (!e.endsWith('.html')) continue;
    const s = readFileSync(p, 'utf8');
    seiten++;
    /* Sichtbarer Text und Meta-Description — beides liest ein Mensch. */
    const stellen = [];
    for (const m of s.matchAll(/<meta name="description" content="([^"]*)"/g)) stellen.push(['description', m[1]]);
    const koerper = s.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ');
    for (const m of koerper.matchAll(/>([^<>{}]{12,})</g)) stellen.push(['text', m[1]]);
    for (const [art, txt] of stellen) {
      for (const w of txt.split(/[\s,.;:()\[\]"'—–/]+/)) {
        /* Binnenversalie: Kleinbuchstabe direkt vor Grossbuchstabe. */
        if (!/[a-zäöüß][A-ZÄÖÜ]/.test(w)) continue;
        if (ERLAUBT.test(w)) continue;
        if (w.length > 40) continue;
        const k = w + '  [' + art + ']';
        (funde[k] ||= new Set()).add(p);
      }
    }
  }
};
lauf('dist');

const e = Object.entries(funde).sort((a, b) => b[1].size - a[1].size);
console.log('Seiten durchsucht: ' + seiten);
console.log('Zusammengeklebte Bezeichner im Lesetext: ' + e.length + ' verschiedene');
for (const [k, v] of e.slice(0, 30))
  console.log('  ' + String(v.size).padStart(6) + ' Seiten  ' + k + '\n           (' + [...v][0] + ')');
