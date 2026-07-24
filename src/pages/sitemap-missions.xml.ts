// Teil-Sitemap: Missions-Datenblaetter.
import type { APIRoute } from 'astro';
import { XML_HEADERS, missionPages, urlsetXml } from '../lib/sitemap';

export const GET: APIRoute = async () =>
  new Response(urlsetXml(missionPages()), { headers: XML_HEADERS });
