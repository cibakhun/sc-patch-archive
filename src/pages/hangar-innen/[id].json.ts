// Lampen und Einstiegspunkte eines begehbaren Innenraums —
// /hangar-innen/<id>.json, eine Datei je Schiff für beide Sprachen. Der
// Viewer lädt sie erst beim Einsteigen (opts.interior, HangarApp.astro); im
// Manifest stehen sie für alle Schiffe zusammen (PC-Lauf Hangar-Innenleben,
// .planning/notes/hangar-innenleben.md), mit der Seite wären sie zu schwer.
import type { APIRoute, GetStaticPaths } from 'astro';
import hangarAssets from '../../data/hangar-assets.json';

type Inner = { v?: string; lights?: unknown[]; spots?: unknown[] };
const interior = (hangarAssets as unknown as { interior?: Record<string, Inner> }).interior ?? {};

export const getStaticPaths: GetStaticPaths = () => Object.keys(interior).map((id) => ({ params: { id } }));

export const GET: APIRoute = ({ params }) => {
  const i = interior[String(params.id)];
  return new Response(JSON.stringify({ v: i?.v ?? null, lights: i?.lights ?? [], spots: i?.spots ?? [] }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
