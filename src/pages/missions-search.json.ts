// Suchindex des Missions-Browsers — ausgelagert aus dem Karten-Markup.
//
// data-search trug pro Karte ~500 Zeichen Suchtext (Blueprint-Namen, Orte,
// Titel-Varianten …), die nirgends sichtbar sind: ~0,7 MB in JEDEM Index-HTML
// (×2 Sprachen, HTML ist no-cache). Als eigene JSON-Datei wird der Index vom
// Browser 1 Tag gecacht (nginx: *.json) und via ?v=<generated> versioniert —
// missions-app.js lädt ihn einmal und sucht bis dahin über den sichtbaren
// Kartentext. Der Index ist sprachneutral (searchText nutzt die Mission-
// Rohnamen, keine UI-Übersetzungen) — EN- und DE-Seite teilen diese Datei.
import type { APIRoute } from 'astro';
import { missions, searchText } from '../lib/missions';

export const GET: APIRoute = () => {
  const index: Record<string, string> = {};
  for (const m of missions) index[m.slug] = searchText(m);
  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
