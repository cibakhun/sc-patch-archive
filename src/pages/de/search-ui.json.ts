// Texte und Index-Adressen der Suche fuer die schlanken Datenseiten (DE).
// assets/data-search.js holt die Datei beim ersten Antippen des Suchknopfs
// und baut daraus das Overlay wie SearchOverlay.astro. Quelle: src/lib/searchUi.ts.
import type { APIRoute } from 'astro';
import { searchUiJson } from '../../lib/searchUi';

export const GET: APIRoute = () =>
  new Response(JSON.stringify(searchUiJson('de')), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
