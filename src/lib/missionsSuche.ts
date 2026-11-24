// Suchindex des Missions-Browsers (/missions-search.json) — an einer Stelle
// gebaut, damit Datei und URL-Version aus demselben Inhalt kommen.
//
// data-search trug pro Karte ~500 Zeichen Suchtext (Blueprint-Namen, Orte,
// Titel-Varianten …), die nirgends sichtbar sind: ~0,7 MB in JEDEM Index-HTML
// (×2 Sprachen, HTML ist no-cache). Als eigene JSON-Datei wird der Index vom
// Browser 1 Tag gecacht (nginx: *.json) — missions-app.js laedt ihn einmal und
// sucht bis dahin ueber den sichtbaren Kartentext. Der Index ist sprachneutral
// (searchText nutzt die Mission-Rohnamen, keine UI-Uebersetzungen) — EN- und
// DE-Seite teilen diese Datei.
//
// Belohnungen (UX-Audit F5): der Blueprint-Pool der Mission steht in
// searchText nur mit Maschinennamen („klwe_pistol_energy_01_black02"), also
// fand „Greatsword" 0 der 12 Missionen, die einen Greatsword-Bauplan
// abwerfen. Hier kommen die lesbaren Bauplan-Namen dazu und die Namen der
// Items, die sie herstellen (englisch und deutsch, wo es einen gibt) — als
// Wortmenge ohne Dubletten, sonst wuechse der Index um das Mehrfache.
//
// Version: Hash ueber genau den ausgelieferten Inhalt. Vorher trug die URL
// den DB-Stand (?v=<generated>); als der Index die Belohnungswoerter bekam,
// blieb der DB-Stand gleich, und ein wiederkehrender Besucher haette einen
// Tag lang den alten Index aus dem Cache gesucht.
import { createHash } from 'node:crypto';
import { missions, searchText } from './missions';
import { blueprintsByMission, itemForBlueprint } from './crafting';

function belohnungsWoerter(slug: string): string {
  const w = new Set<string>();
  for (const b of blueprintsByMission.get(slug) ?? []) {
    const it = itemForBlueprint(b);
    for (const n of [b.name, it?.name, it?.game?.nameDe])
      for (const x of String(n ?? '').toLowerCase().split(/[\s"„“”(),/]+/)) if (x.length > 1) w.add(x);
  }
  return [...w].join(' ');
}

const index: Record<string, string> = {};
for (const m of missions) index[m.slug] = [searchText(m), belohnungsWoerter(m.slug)].filter(Boolean).join(' ');

/** Der ausgelieferte Inhalt von /missions-search.json. */
export const missionsSuchJson: string = JSON.stringify(index);

/** URL des Index mit Inhaltshash: neuer Inhalt, neue URL, kein Tag alter Cache. */
export const missionsSuchUrl = `/missions-search.json?v=${createHash('sha1').update(missionsSuchJson).digest('hex').slice(0, 10)}`;
