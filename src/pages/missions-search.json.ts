// Suchindex des Missions-Browsers. Gebaut wird er in src/lib/missionsSuche.ts,
// wo auch die URL mit Inhaltshash entsteht, die MissionsApp.astro einsetzt.
import type { APIRoute } from 'astro';
import { missionsSuchJson } from '../lib/missionsSuche';

export const GET: APIRoute = () =>
  new Response(missionsSuchJson, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
