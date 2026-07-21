/* ============================================================
   sync-style-blocks.mjs

   Jede Seite existiert zweimal: src/pages/x.astro (EN) und
   src/pages/de/x.astro (DE). Bei den meisten Paaren ist der
   <style is:inline>-Block bytegleich — unterschiedlich sind nur
   die Texte. Beim Hell-/Dunkel-Umbau müsste sonst jede CSS-
   Änderung doppelt von Hand gemacht werden.

   ACHTUNG, und deshalb dieses Skript statt eines pauschalen
   Kopierens: 11 der 60 Paare haben BEWUSST unterschiedliches CSS
   (deutsche Wörter sind länger, ein paar Breiten und content:""-
   Texte weichen ab). Die dürfen nicht überschrieben werden.

   Maßstab ist deshalb der Stand in git HEAD, nicht der aktuelle:
   nur Paare, die VOR dem Umbau schon identisch waren, gelten als
   gekoppelt und werden übertragen. Alle anderen werden gemeldet
   und bleiben unangetastet.

       node scripts/sync-style-blocks.mjs --check   nur berichten
       node scripts/sync-style-blocks.mjs           übertragen
   ============================================================ */

import { readFile, writeFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const STYLE = /<style\s+is:inline>([\s\S]*?)<\/style>/;
const GENERATED = /[ \t]*\/\* Hellmodus[^*]*\*\/\s*:root\[data-theme="light"\]\{[^}]*\}\n?/g;

const norm = (s) => s.replace(GENERATED, '').replace(/\r\n/g, '\n').trim();

async function atHead(file) {
  try {
    const { stdout } = await run('git', ['show', `HEAD:${file}`], { maxBuffer: 64 * 1024 * 1024 });
    const m = STYLE.exec(stdout);
    return m ? norm(m[1]) : null;
  } catch {
    return null; // Datei ist neu -> kein Maßstab
  }
}

const CHECK = process.argv.includes('--check');

const files = [];
for await (const f of glob('src/pages/**/*.astro')) files.push(f.replace(/\\/g, '/'));

const pairs = files
  .filter((f) => !f.includes('/pages/de/'))
  .map((en) => ({ en, de: en.replace('/pages/', '/pages/de/') }))
  .filter((p) => files.includes(p.de));

let linked = 0, upToDate = 0, synced = 0, independent = 0, noBlock = 0;
const independentList = [];

for (const { en, de } of pairs) {
  const [headEn, headDe] = await Promise.all([atHead(en), atHead(de)]);
  if (headEn === null || headDe === null) { noBlock++; continue; }

  if (headEn !== headDe) {
    independent++;
    independentList.push(en);
    continue; // bewusst unterschiedlich -> nie automatisch überschreiben
  }
  linked++;

  const [srcEn, srcDe] = await Promise.all([readFile(en, 'utf8'), readFile(de, 'utf8')]);
  const mEn = STYLE.exec(srcEn), mDe = STYLE.exec(srcDe);
  if (!mEn || !mDe) { noBlock++; continue; }
  if (norm(mEn[1]) === norm(mDe[1])) { upToDate++; continue; }

  if (CHECK) {
    console.log(`  zu übertragen: ${en} -> ${de}`);
    synced++;
    continue;
  }

  // EN-Block übernehmen, aber den in DE erzeugten Hellmodus-Block behalten.
  const deGen = (mDe[1].match(GENERATED) || []).join('');
  const body = deGen ? mEn[1].replace(GENERATED, () => deGen) : mEn[1];
  await writeFile(de, srcDe.slice(0, mDe.index) + `<style is:inline>${body}</style>` + srcDe.slice(mDe.index + mDe[0].length));
  synced++;
}

console.log(
  `\nsync-style-blocks: ${pairs.length} Paare — ${linked} gekoppelt ` +
    `(${upToDate} schon gleich, ${synced} ${CHECK ? 'zu übertragen' : 'übertragen'}), ` +
    `${independent} eigenständig${noBlock ? `, ${noBlock} ohne Stilblock` : ''}`
);

if (independentList.length) {
  console.log('\nEigenständiges DE-CSS — hier muss jede Änderung von Hand doppelt gemacht werden:');
  for (const f of independentList) console.log('  ' + f);
}
