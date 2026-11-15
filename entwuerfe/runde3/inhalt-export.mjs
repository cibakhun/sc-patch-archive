// Schreibt patchInhalt('de'|'en') aus src/lib/patch-4-10-3/inhalt.ts als JSON fuer die
// statischen Entwuerfe dieser Runde. astro:content wird durch die Patch-Dateien ersetzt.
// Aufruf aus dem Repo-Wurzelordner: node entwuerfe/runde3/inhalt-export.mjs
import { build } from 'esbuild';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const OUT = join(ROOT, 'entwuerfe/runde3');
const astroContent = {
  name: 'astro-content',
  setup(b) {
    b.onResolve({ filter: /^astro:content$/ }, () => ({ path: 'astro-content', namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => {
      const dir = join(ROOT, 'src/data/patches');
      const eintraege = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => ({ id: f.replace(/\.json$/, ''), data: JSON.parse(readFileSync(join(dir, f), 'utf8')) }));
      const fahrzeuge = JSON.parse(readFileSync(join(ROOT, 'src/data/vehicles.json'), 'utf8')).vehicles.map((v) => ({ id: v.id, data: v }));
      const S = { patches: eintraege, vehicles: fahrzeuge };
      return { contents: `const S = ${JSON.stringify(S)}; export async function getCollection(n, f) { const E = S[n]; if (!E) throw new Error('unbekannte Sammlung ' + n); return f ? E.filter(f) : E; }`, loader: 'js' };
    });
  },
};
const ziel = join(OUT, '.inhalt.bundle.mjs');
await build({ entryPoints: [resolve(ROOT, 'src/lib/patch-4-10-3/inhalt.ts')], bundle: true, platform: 'node', format: 'esm', outfile: ziel, plugins: [astroContent], loader: { '.json': 'json' }, define: { __VB_HANGAR__: 'true' }, logLevel: 'warning' });
const { patchInhalt } = await import(pathToFileURL(ziel).href);
for (const lang of ['de', 'en']) {
  const inhalt = await patchInhalt(lang);
  writeFileSync(join(OUT, `inhalt-${lang}.json`), JSON.stringify(inhalt, null, 1));
  console.log(`inhalt-${lang}.json: ${Object.keys(inhalt).length} Felder, ${inhalt.bilder.length} Bilder`);
}
