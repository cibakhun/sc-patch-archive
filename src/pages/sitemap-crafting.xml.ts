// Teil-Sitemap: Blueprint-Seiten + Blueprint-Kategorien.
import type { APIRoute } from 'astro';
import { XML_HEADERS, craftingDetailPages, urlsetXml } from '../lib/sitemap';

export const GET: APIRoute = async () =>
  new Response(urlsetXml(craftingDetailPages()), { headers: XML_HEADERS });
