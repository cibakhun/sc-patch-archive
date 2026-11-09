// Zweiter Teil des Suchindex (EN) — /search-index-more.json: Items und
// Blueprints. Builder und Begruendung: buildSearchIndexMore in
// src/lib/searchIndex.ts; das DE-Pendant liegt unter /de/search-index-more.json.
import type { APIRoute } from 'astro';
import { buildSearchIndexMore } from '../lib/searchIndex';

export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await buildSearchIndexMore('en')), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
