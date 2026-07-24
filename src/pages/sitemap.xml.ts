// Sitemap-INDEX — die eine URL, die in robots.txt und der Search Console steht.
// Die eigentlichen URL-Listen liegen in fuenf Teil-Sitemaps (siehe lib/sitemap).
import type { APIRoute } from 'astro';
import { db as itemsDb } from '../lib/items';
import { craftDb } from '../lib/crafting';
import { db as missionsDb } from '../lib/missions';
import { XML_HEADERS, sitemapIndexXml } from '../lib/sitemap';
import vehiclesSnapshot from '../data/vehicles.json';

export const GET: APIRoute = async () =>
  new Response(
    sitemapIndexXml([
      { path: '/sitemap-pages.xml' },
      { path: '/sitemap-ships.xml', mod: vehiclesSnapshot.fetchedAt },
      { path: '/sitemap-missions.xml', mod: missionsDb.meta.generated },
      { path: '/sitemap-items.xml', mod: itemsDb.generatedAt },
      { path: '/sitemap-crafting.xml', mod: craftDb.snapshot_date },
    ]),
    { headers: XML_HEADERS }
  );
