// Teil-Sitemap: Item-Datenblaetter + Kategorie-Listen.
import type { APIRoute } from 'astro';
import { XML_HEADERS, itemDetailPages, urlsetXml } from '../lib/sitemap';

export const GET: APIRoute = async () =>
  new Response(urlsetXml(itemDetailPages()), { headers: XML_HEADERS });
