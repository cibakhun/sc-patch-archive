import { readdirSync, readFileSync } from 'node:fs';
const lang = {};
for (const d of ['topics', 'patches']) {
  for (const f of readdirSync('dist/' + d)) {
    if (!f.endsWith('.html')) continue;
    const s = readFileSync('dist/' + d + '/' + f, 'utf8');
    const m = s.match(/<h1[^>]*>([\s\S]{0,400}?)<\/h1>/);
    if (!m) continue;
    const txt = m[1].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, ' ').trim();
    for (const w of txt.split(' ')) if (w.length > (lang[d] ? lang[d].w.length : 0)) lang[d] = { w, f, txt: txt.slice(0, 50) };
  }
}
for (const [d, v] of Object.entries(lang)) console.log('  ' + d + ': laengstes Wort „' + v.w + '" (' + v.w.length + ' Zeichen)  in ' + v.f);
