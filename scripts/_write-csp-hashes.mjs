/* ============================================================
   _write-csp-hashes.mjs — letzter Schritt von `npm run build`.

   Rechnet aus dem FERTIGEN dist/ die sha256 aller ausgefuehrten Inline-
   Skripte und Inline-Handler und legt sie als include-Dateien fuer nginx
   unter dist/_csp/ ab (Maps $vb_script_inline_1..3 und $vb_script_attr in
   nginx/default.conf). Das Dockerfile kopiert dist/ nach
   /usr/share/nginx/html — die Dateien kommen ohne eigene COPY-Zeile genau
   dorthin, wo nginx sie sucht, und gehoeren immer zu genau diesem Bau.

   Warum am Ende des Baus und nicht von Hand: 18.000 Seiten, rund 60
   verschiedene Inline-Skripte, und jede Textaenderung an einem davon
   aendert seinen Hash. Eine gepflegte Liste waere nach dem naechsten
   Commit falsch, und ein falscher Hash bricht nicht beim Deploy, sondern
   still im Browser des Besuchers.

   Die Dateien:
     script-src-1..3.conf  je eine Zeile `csp "'sha256-…' …";` — drei
                           Bloecke, weil nginx keinen Parameter ab 4 KB
                           liest. Passt es nicht mehr in drei, reisst der
                           Bau (Ursache: zu viele verschiedene Inline-
                           Skripte; das groesste gehoert dann in eine Datei
                           unter assets/).
     script-src-attr.conf  `'none'`, wenn der Bau keinen Inline-Handler mehr
                           traegt, sonst `'unsafe-hashes'` plus genau deren
                           Hashes. Ob ein Handler sein DARF, entscheidet
                           audit:csp (benannte Ausnahmen), nicht dieser
                           Schritt — er beschreibt nur, was gebaut wurde.

   Kein Netz, kein git, kein Kindprozess.
     node scripts/_write-csp-hashes.mjs
   ============================================================ */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  zerlege, bloecke, CSP_ORDNER, SKRIPT_BLOECKE, skriptDatei, ATTR_DATEI, MAP_SCHLUESSEL,
} from './lib/csp-inline.mjs';

const DIST = 'dist';
if (!existsSync(DIST)) { console.error('_write-csp-hashes: dist/ fehlt — erst astro build.'); process.exit(1); }

const seiten = [];
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === CSP_ORDNER && dir === DIST) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) seiten.push(p);
  }
})(DIST);
seiten.sort();

const skriptHashes = new Map();   // hash -> Anzahl
const handlerHashes = new Map();
let skripte = 0;
for (const s of seiten) {
  const { skripte: sk, handler } = zerlege(readFileSync(s, 'utf8'));
  for (const x of sk) if (x.hash) { skripte++; skriptHashes.set(x.hash, (skriptHashes.get(x.hash) ?? 0) + 1); }
  for (const h of handler) handlerHashes.set(h.hash, (handlerHashes.get(h.hash) ?? 0) + 1);
}

const sortiert = [...skriptHashes.keys()].sort();
const teile = bloecke(sortiert);
if (teile.length > SKRIPT_BLOECKE) {
  console.error(
    `_write-csp-hashes: ${sortiert.length} verschiedene Inline-Skripte brauchen ${teile.length} Bloecke, nginx/default.conf hat ${SKRIPT_BLOECKE}. ` +
      'Ein Inline-Skript, das je Seite anders aussieht (eingebettete Daten), gehoert in einen <script type="application/json">-Block oder in eine Datei unter assets/.',
  );
  process.exit(1);
}
const attr = handlerHashes.size ? ["'unsafe-hashes'", ...[...handlerHashes.keys()].sort()].join(' ') : "'none'";
if (bloecke([attr]).length !== 1) { console.error('_write-csp-hashes: die Handler-Hashes passen nicht in eine nginx-Zeile'); process.exit(1); }

const kopf = (was) =>
  `# Erzeugt von scripts/_write-csp-hashes.mjs beim Bau — nicht von Hand aendern.\n# ${was}\n`;
mkdirSync(join(DIST, CSP_ORDNER), { recursive: true });
for (let i = 1; i <= SKRIPT_BLOECKE; i++) {
  const wert = teile[i - 1] ?? '';
  writeFileSync(
    join(DIST, CSP_ORDNER, skriptDatei(i)),
    kopf(`script-src, Block ${i} von ${SKRIPT_BLOECKE}: ${wert ? wert.split(' ').length : 0} Hash(es)`) + `${MAP_SCHLUESSEL} "${wert}";\n`,
  );
}
writeFileSync(
  join(DIST, CSP_ORDNER, ATTR_DATEI),
  kopf(`script-src-attr: ${handlerHashes.size} Inline-Handler-Fassung(en)`) + `${MAP_SCHLUESSEL} "${attr}";\n`,
);

const handlerGesamt = [...handlerHashes.values()].reduce((a, b) => a + b, 0);
console.log(
  `_write-csp-hashes: ${seiten.length} Seiten, ${skripte} ausgefuehrte Inline-Skripte, ${sortiert.length} verschiedene ` +
    `(${teile.length} von ${SKRIPT_BLOECKE} Bloecken), ${handlerGesamt} Inline-Handler in ${handlerHashes.size} Fassung(en) -> ${DIST}/${CSP_ORDNER}/`,
);
