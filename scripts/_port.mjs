// Porter: wraps each existing self-contained HTML page into a thin Astro page
// that uses the shared Layout, keeping the bespoke inline CSS/JS BYTE-VERBATIM
// (<style is:inline> / <script is:inline>). Handles two page shapes:
//   • patch pages  -> fully inline <style> + inline <script>, own footer
//   • topic pages  -> external detail.css/js links + inline palette <style>
//   • index        -> inline, footer replaced by shared <Attribution/>
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';

const rd = (p) => readFile(p, 'utf8');

// Make every asset/route reference root-absolute & unambiguous.
function rewrite(s) {
  return s
    .replace(/\.\.\/assets\//g, '/assets/')
    .replace(/\.\.\/topics\//g, '/topics/')
    .replace(/\.\.\/patches\//g, '/patches/')
    .replace(/\.\.\/index\.html/g, '/index.html')
    .replace(/(["'(])assets\//g, '$1/assets/')
    .replace(/(["'(])patches\//g, '$1/patches/')
    .replace(/(["'(])topics\//g, '$1/topics/')
    .replace(/href="(sc-[0-9a-z.\-]+\.html)"/gi, 'href="/patches/$1"');
}

function parse(html) {
  const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
  let body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? '';
  const style = head.match(/<style>([\s\S]*?)<\/style>/i)?.[1] ?? '';
  // local stylesheet links (drop the google-fonts one — Layout provides fonts)
  const links = [...head.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/gi)]
    .map((m) => m[0])
    .filter((l) => /href="[^"]*assets\//.test(l));
  // inline (attribute-less) script lives at the end of the body
  const inlineScript = body.match(/<script>([\s\S]*?)<\/script>/i)?.[1] ?? '';
  body = body.replace(/<script>[\s\S]*?<\/script>/i, '').trim();
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? '';
  const desc =
    html.match(/<meta name="description" content="([^"]*)"/i)?.[1] ?? '';
  const bg = html.match(/--bg:\s*(#[0-9a-fA-F]{3,8})/)?.[1] ?? '#05070d';
  return { style, links, inlineScript, body, title, desc, bg };
}

function finishBody(body) {
  // keep external scripts exactly as-is (don't let Astro bundle them)
  return rewrite(body).replace(/<script\s+src=/gi, '<script is:inline src=');
}

function emit({ depth, title, desc, bg, footer, links, style, body, inlineScript }) {
  const imp = '../'.repeat(depth);
  const head = links
    .map((l) => rewrite(l).replace('<link ', '<link slot="head" '))
    .join('\n');
  const sc = inlineScript.trim()
    ? `\n<script is:inline>\n${inlineScript}\n</script>`
    : '';
  return `---
import Layout from '${imp}layouts/Layout.astro';
---
<Layout title={${JSON.stringify(title)}} description={${JSON.stringify(desc)}} themeColor=${JSON.stringify(bg)}${footer ? ' footer={true}' : ''}>
${head ? head + '\n' : ''}<style is:inline>
${rewrite(style)}
</style>
${finishBody(body)}${sc}
</Layout>
`;
}

await mkdir('src/pages/patches', { recursive: true });
await mkdir('src/pages/topics', { recursive: true });

let n = 0;

// ---- index ----
{
  const p = parse(await rd('index.html'));
  const body = p.body.replace(/<footer[\s\S]*?<\/footer>/i, '').trim(); // -> <Attribution/>
  await writeFile(
    'src/pages/index.astro',
    emit({ depth: 1, ...p, body, footer: true })
  );
  n++;
}

// ---- patches/*.html & topics/*.html ----
for (const dir of ['patches', 'topics']) {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.html'));
  for (const f of files) {
    const p = parse(await rd(`${dir}/${f}`));
    const out = emit({ depth: 2, ...p, footer: false });
    await writeFile(`src/pages/${dir}/${f.replace(/\.html$/, '.astro')}`, out);
    n++;
  }
}

console.log(`ported ${n} pages`);
