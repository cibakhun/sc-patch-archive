// Ungarischer Suchindex — /hu/search-index.json.
// Gleicher Builder wie /search-index.json, nur lang='hu': ungarische Snippets
// (Typ/Größe/Foci, Patch-Texte) und URLs mit /hu-Präfix, damit die Suche auf
// ungarischen Seiten nicht auf die englischen Wurzel-Seiten hinausführt.
import type { APIRoute } from 'astro';
import { buildSearchIndex } from '../../lib/searchIndex';

export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await buildSearchIndex('hu')), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
