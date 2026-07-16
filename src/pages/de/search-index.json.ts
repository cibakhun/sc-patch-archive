// Deutscher Suchindex — /de/search-index.json.
// Gleicher Builder wie /search-index.json, nur lang='de': deutsche Snippets
// (Typ/Größe/Foci, Patch-Texte) und URLs mit /de-Präfix, damit die Suche auf
// deutschen Seiten nicht auf die englischen Wurzel-Seiten hinausführt.
import type { APIRoute } from 'astro';
import { buildSearchIndex } from '../../lib/searchIndex';

export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await buildSearchIndex('de')), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
