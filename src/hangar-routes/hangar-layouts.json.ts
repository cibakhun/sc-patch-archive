// Daten der Layout-Werkstatt im Hangar — /hangar-layouts.json, EINE Datei fuer
// beide Sprachen. Inhalt und Format: src/lib/hangar/layouts.ts. Die Seite
// laedt sie erst, wenn jemand die Werkstatt oeffnet.
import type { APIRoute } from 'astro';
import { layoutJson } from '../lib/hangar/layouts';

export const GET: APIRoute = () =>
  new Response(layoutJson(), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
