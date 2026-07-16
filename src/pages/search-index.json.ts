// Suchindex der Standardsprache (EN) — /search-index.json.
// Inhalt + URL-Formung: src/lib/searchIndex.ts (EIN Builder für beide
// Sprachen; das DE-Pendant liegt unter /de/search-index.json). Das Overlay
// lädt den Index seiner Seite über das data-index-Attribut.
import type { APIRoute } from 'astro';
import { buildSearchIndex } from '../lib/searchIndex';

export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await buildSearchIndex('en')), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
