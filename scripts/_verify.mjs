// Link/asset integrity check over the built dist/: every local reference
// (href/src/url()/data-img/data-lb) must resolve to a file that exists.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p.replace(/\\/g, '/'));
  }
  return out;
}

const all = await walk('dist');
const set = new Set(all);
const exists = (rel) => set.has('dist' + rel);

const htmls = all.filter((p) => p.endsWith('.html'));
const refRe =
  /(?:href|src)="(\/[^"#?]+)"|url\((['"]?)(\/[^'")]+)\2\)|data-(?:img|lb)="(?:img:)?(\/[^"]+)"/g;

const missing = [];
let checked = 0;
for (const f of htmls) {
  let html = await readFile(f, 'utf8');
  html = html.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  for (const m of html.matchAll(refRe)) {
    const ref = m[1] || m[3] || m[4];
    if (!ref || ref.startsWith('//') || ref.startsWith('http')) continue;
    const clean = ref.split('#')[0].split('?')[0];
    if (!/\.(html|jpe?g|png|svg|webp|css|js|gif|ico)$/i.test(clean)) continue;
    checked++;
    if (!exists(clean)) missing.push(`${f}  ->  ${clean}`);
  }
}

console.log(`pages: ${htmls.length}`);
console.log(`local refs checked: ${checked}`);
if (missing.length) {
  console.log(`MISSING (${missing.length}):`);
  console.log([...new Set(missing)].slice(0, 50).join('\n'));
  process.exitCode = 1;
} else {
  console.log('ALL LOCAL REFERENCES RESOLVE ✓');
}
