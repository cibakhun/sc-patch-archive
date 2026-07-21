/* ============================================================
   build-light-palettes.mjs

   Jede Seite trägt ihre Identität in einem inline :root{}-Block
   (Pyro orange, Nyx blaugold, Supply-or-Die rostrot). Dieses
   Skript erzeugt zu jedem dieser Blöcke den hellen Zwilling und
   schreibt ihn direkt darunter:

       :root{--bg:#120f0c;--accent:#ff5a1f;…}          <- unverändert
       :root[data-theme="light"]{--bg:#fbf7f2;…}       <- erzeugt

   Der zweite Block hat höhere Spezifität (0,2,0 gegen 0,1,0) und
   überschreibt damit im Hellmodus die dunklen Werte, ohne dass
   eine einzige bestehende Zeile angefasst wird. Bleibt der Modus
   dunkel, greift er nie — die Seite ist dann bytegleich zu vorher.

   Idempotent: ein bereits erzeugter Block wird ersetzt, nicht
   verdoppelt. Neu ausführen nach jeder Palettenänderung:
       npm run build:light-palettes
   ============================================================ */

import { readFile, writeFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import {
  LIGHT_RULES,
  lightLine,
  lightLineSoft,
  lightGlow,
  parseColor,
  contrast,
} from './lib/theme-color.mjs';

const MARK = 'erzeugt von scripts/build-light-palettes.mjs';

/* Reihenfolge der Ausgabe — Grundflächen, dann Tinte, dann Akzente.
   Nur Tokens, die die Seite selbst setzt, werden ausgegeben; für den
   Rest greifen die Rückfallwerte aus assets/theme.css. */
const ORDER = ['--bg', '--bg-2', '--surface', '--surface-2', '--text', '--muted', '--accent', '--accent-2', '--hot', '--gold', '--ink'];

/* Tokens ohne Farbcharakter — die bleiben, wie sie sind. */
const SKIP = /^--(maxw|font-|radius|dur|ease|shadow-|z-)/;

/** Ein :root{…}-Block -> Map der Token/Wert-Paare (Kommentare raus). */
function parseTokens(body) {
  const out = new Map();
  for (const decl of body.replace(/\/\*[\s\S]*?\*\//g, '').split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const name = decl.slice(0, i).trim();
    if (!name.startsWith('--')) continue;
    out.set(name, decl.slice(i + 1).trim());
  }
  return out;
}

/** Dunkle Tokens -> helle Tokens. */
function deriveLight(tok, warn) {
  const light = new Map();

  for (const name of ORDER) {
    if (!tok.has(name)) continue;
    const rule = LIGHT_RULES[name];
    if (rule) light.set(name, rule(tok.get(name)));
  }

  // --ink ist "Text auf einer Akzentfläche". Im Hellmodus ist der Akzent
  // dunkel, also kippt ink auf Weiß — auch dann, wenn die Seite es gar
  // nicht selbst setzt, aber einen Akzent hat.
  if (tok.has('--accent')) light.set('--ink', '#ffffff');

  // Alles, was ÜBER einem Foto liegt, braucht weiterhin den hellen Akzent —
  // das Motiv bleibt in beiden Modi dunkel. Der Papier-Akzent wäre dort
  // unlesbar. Siehe --accent-media in assets/theme.css.
  if (tok.has('--accent')) light.set('--accent-media', tok.get('--accent'));
  if (tok.has('--accent-2')) light.set('--accent-2-media', tok.get('--accent-2'));

  // Linien und Bloom werden nicht übersetzt, sondern neu gebildet: die
  // dunklen Werte sind halbtransparentes Neon und auf Papier unsichtbar.
  const accentLight = light.get('--accent');
  const textLight = light.get('--text');
  if (tok.has('--line') && accentLight) light.set('--line', lightLine(accentLight));
  if (tok.has('--line-2') && accentLight) light.set('--line-2', lightLine(accentLight, 0.42));
  if (tok.has('--line-soft')) light.set('--line-soft', lightLineSoft(textLight || '#1b1f29'));
  if (tok.has('--glow') && accentLight) light.set('--glow', lightGlow(accentLight));

  // Unbekannte Farb-Tokens melden: die blieben sonst still dunkel und
  // wären im Hellmodus ein unsichtbarer Fehler.
  for (const [name, value] of tok) {
    if (light.has(name) || SKIP.test(name)) continue;
    if (parseColor(value)) warn.push(`${name}: ${value}`);
  }
  return light;
}

/** Kontrollrechnung: Tinte und Akzente gegen die helle Fläche. */
function audit(light, file, problems) {
  const bg = light.get('--bg');
  if (!bg) return;
  for (const [name, min] of [['--text', 7], ['--muted', 4.5], ['--accent', 4.5], ['--accent-2', 4.5], ['--hot', 4.5]]) {
    if (!light.has(name)) continue;
    const r = contrast(light.get(name), bg);
    if (r < min) problems.push(`${file}  ${name} ${light.get(name)} auf ${bg}: ${r.toFixed(2)}:1 (< ${min})`);
  }
}

const serialize = (light, indent) =>
  `${indent}/* Hellmodus — ${MARK}. Nicht von Hand ändern. */\n` +
  `${indent}:root[data-theme="light"]{` +
  [...light].map(([k, v]) => `${k}:${v}`).join(';') +
  `}`;

/* ---------------------------------------------------------- */

const DRY = process.argv.includes('--dry');
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7);

const files = [];
for await (const f of glob('src/**/*.astro')) files.push(f);
files.sort();
const targets = ONLY ? files.filter((f) => f.replace(/\\/g, '/').includes(ONLY)) : files;

let changed = 0;
const unknown = new Map();
const problems = [];

for (const file of targets) {
  const src = await readFile(file, 'utf8');

  // Vorherigen Lauf entfernen, damit das Skript wiederholbar bleibt.
  let text = src.replace(
    new RegExp(`[ \\t]*/\\* Hellmodus[^*]*${MARK.replace(/[.*+?^$()|[\\]\\\\]/g, '\\\\$&')}[^*]*\\*/\\s*:root\\[data-theme="light"\\]\\{[^}]*\\}\\n?`, 'g'),
    ''
  );

  // Alle :root{…}-Blöcke der Seite (ohne die erzeugten).
  const blocks = [...text.matchAll(/(^[ \t]*):root\s*\{([^}]*)\}/gm)];
  if (!blocks.length) continue;

  let offset = 0;
  for (const m of blocks) {
    const [full, indent, body] = m;
    const tok = parseTokens(body);
    if (!tok.has('--bg') && !tok.has('--accent')) continue; // kein Palettenblock

    const warn = [];
    const light = deriveLight(tok, warn);
    if (!light.size) continue;
    for (const w of warn) unknown.set(w, (unknown.get(w) || 0) + 1);
    audit(light, file, problems);

    const insert = '\n' + serialize(light, indent);
    const at = m.index + full.length + offset;
    text = text.slice(0, at) + insert + text.slice(at);
    offset += insert.length;
  }

  if (text !== src) {
    if (DRY) {
      const added = [...text.matchAll(/:root\[data-theme="light"\]\{[^}]*\}/g)].map((x) => x[0]);
      console.log(`\n--- ${file}`);
      for (const a of added) console.log('    ' + a);
    } else {
      await writeFile(file, text);
    }
    changed++;
  }
}

console.log(`\nbuild-light-palettes: ${changed} von ${targets.length} Dateien mit hellem Zwilling versehen${DRY ? ' (Probelauf, nichts geschrieben)' : ''}`);

if (unknown.size) {
  console.log('\nNicht übersetzte Farb-Tokens (bleiben im Hellmodus dunkel — prüfen):');
  for (const [k, n] of [...unknown].sort((a, b) => b[1] - a[1])) console.log(`  ${n}x  ${k}`);
}

if (problems.length) {
  console.log(`\nKontrast unter Ziel (${problems.length}):`);
  for (const p of problems) console.log('  ' + p);
  process.exitCode = 1;
} else {
  console.log('Kontrast: alle abgeleiteten Paletten erreichen ihr Ziel.');
}
