// Zweiter Teil des deutschen Suchindex — /de/search-index-more.json: Items und
// Blueprints mit deutschen Item-Namen und /de-URLs. Builder:
// buildSearchIndexMore in src/lib/searchIndex.ts.
import type { APIRoute } from 'astro';
import { buildSearchIndexMore } from '../../lib/searchIndex';

export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await buildSearchIndexMore('de')), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
