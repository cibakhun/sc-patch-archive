// Dynamic sitemap over the whole archive — replaces the 38-URL static file
// from the website-improvements branch (the site has 260+ pages since the
// ships DB). Built from the data layer, so new patches/ships appear on the
// next sync+build without touching this file.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE } from '../consts';
import vehiclesSnapshot from '../data/vehicles.json';

export const GET: APIRoute = async () => {
  const base = SITE.url.replace(/\/$/, '');
  const patches = await getCollection('patches');
  const vehicles = await getCollection('vehicles');

  type Entry = { path: string; lastmod?: string };
  const entries: Entry[] = [];

  const latestPatch = patches.map((p) => p.data.date).sort().at(-1);
  entries.push({ path: '/index.html', lastmod: latestPatch });
  entries.push({ path: '/evolution.html', lastmod: latestPatch });
  entries.push({ path: '/schiffe.html', lastmod: vehiclesSnapshot.fetchedAt });

  for (const p of patches) {
    entries.push({ path: `/patches/sc-${p.id}.html`, lastmod: p.data.date });
    for (const t of p.data.topics)
      entries.push({ path: `/topics/${t.slug}.html`, lastmod: p.data.date });
  }
  for (const v of vehicles)
    entries.push({ path: `/schiffe/${v.id}.html`, lastmod: vehiclesSnapshot.fetchedAt });

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries
      .map(
        (e) =>
          `  <url><loc>${base}${e.path}</loc>` +
          (e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : '') +
          `</url>`
      )
      .join('\n') +
    `\n</urlset>\n`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
