// Suchindex des Missions-Browsers — ausgelagert aus dem Karten-Markup.
//
// data-search trug pro Karte ~500 Zeichen Suchtext (Blueprint-Namen, Orte,
// Titel-Varianten …), die nirgends sichtbar sind: ~0,7 MB in JEDEM Index-HTML
// (×2 Sprachen, HTML ist no-cache). Als eigene JSON-Datei wird der Index vom
// Browser 1 Tag gecacht (nginx: *.json) und via ?v=<generated> versioniert —
// missions-app.js lädt ihn einmal und sucht bis dahin über den sichtbaren
// Kartentext. Der Index ist sprachneutral (searchText nutzt die Mission-
// Rohnamen, keine UI-Übersetzungen) — EN- und DE-Seite teilen diese Datei.
//
// Belohnungen (UX-Audit F5): der Blueprint-Pool der Mission steht in
// searchText nur mit Maschinennamen („klwe_pistol_energy_01_black02"), also
// fand „Greatsword" 0 der 12 Missionen, die einen Greatsword-Bauplan
// abwerfen. Hier kommen die lesbaren Bauplan-Namen dazu und die Namen der
// Items, die sie herstellen (englisch und deutsch, wo es einen gibt) — als
// Wortmenge ohne Dubletten, sonst wuechse der Index um das Mehrfache.
import type { APIRoute } from 'astro';
import { missions, searchText } from '../lib/missions';
import { blueprintsByMission, itemForBlueprint } from '../lib/crafting';

function belohnungsWoerter(slug: string): string {
  const w = new Set<string>();
  for (const b of blueprintsByMission.get(slug) ?? []) {
    const it = itemForBlueprint(b);
    for (const n of [b.name, it?.name, it?.game?.nameDe])
      for (const x of String(n ?? '').toLowerCase().split(/[\s"„“”(),/]+/)) if (x.length > 1) w.add(x);
  }
  return [...w].join(' ');
}

export const GET: APIRoute = () => {
  const index: Record<string, string> = {};
  for (const m of missions) index[m.slug] = [searchText(m), belohnungsWoerter(m.slug)].filter(Boolean).join(' ');
  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
