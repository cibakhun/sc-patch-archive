// Daten des Schiffsvergleichs (EN). assets/schiff-vergleich.js holt die Datei,
// sobald auf der Schiffsliste zwei Schiffe verglichen werden. Quelle:
// src/lib/shipVergleich.ts.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { vergleichJson } from '../lib/shipVergleich';

export const GET: APIRoute = async () =>
  new Response(JSON.stringify(vergleichJson(await getCollection('vehicles'), 'en')), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
