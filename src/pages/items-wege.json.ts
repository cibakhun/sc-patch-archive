// Was das Item-Datenblatt beantwortet, fuer die Items-Werkbank (EN).
// Rechnung und Aufbau: src/lib/itemsWerkbankWege.ts.
import type { APIRoute } from 'astro';
import { itemsWege } from '../lib/itemsWerkbankWege';

export const GET: APIRoute = async () =>
  new Response((await itemsWege('en')).json, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
