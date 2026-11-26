// Modell-Liste für „In 3D ansehen“ in der Items-Werkbank — /hangar-item3d.json,
// EINE Datei für beide Sprachen. Inhalt: src/lib/item3d.ts (ITEM3D_LISTE_JSON).
// Die Werkbank lädt sie, sobald jemand ein Item wählt; die Item- und
// Blueprint-Seiten brauchen sie nicht, dort steht das Modell am Dialog.
import type { APIRoute } from 'astro';
import { ITEM3D_LISTE_JSON } from '../lib/item3d';

export const GET: APIRoute = () =>
  new Response(ITEM3D_LISTE_JSON, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
