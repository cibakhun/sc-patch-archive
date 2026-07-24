// Teil-Sitemap: Schiffs-Datenblaetter.
import type { APIRoute } from 'astro';
import { XML_HEADERS, shipPages, urlsetXml } from '../lib/sitemap';

export const GET: APIRoute = async () =>
  new Response(urlsetXml(await shipPages()), { headers: XML_HEADERS });
