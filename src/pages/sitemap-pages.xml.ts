// Teil-Sitemap: redaktionelle und statische Seiten (Patches, Themen, Tools).
import type { APIRoute } from 'astro';
import { XML_HEADERS, corePages, urlsetXml } from '../lib/sitemap';

export const GET: APIRoute = async () =>
  new Response(urlsetXml(await corePages()), { headers: XML_HEADERS });
