// searchAliases.ts — die Woerter der Spieler, die nicht im Namen stehen.
//
// Anlass (UX-Audit 24.11.2026, Umsetzungsplan Paket B, B2): „hangar",
// „loadout", „werkbank" fanden kein Werkzeug, „karna gewehr" fand nichts,
// weil das Gewehr im Spiel „Karna Rifle" heisst. Die Suche vergleicht
// Zeichenketten; was ein Spieler im Kopf hat, ist oft ein Gattungswort oder
// das deutsche Wort fuer eine Sache mit englischem Namen.
//
// Zwei Tabellen, beide wirken nur auf das unsichtbare Feld x des Registers
// (src/lib/searchIndex.ts). Angezeigt wird nichts davon:
//
//  TOOL_ALIASES  Suchwoerter je Werkzeug- oder Verzeichnisseite, Schluessel ist
//                der Basispfad (ohne /de). Die Werkzeugliste selbst gehoert zur
//                Bereichsliste (Paket A); diese Woerter werden NACH ihr an die
//                Eintraege mit derselben Adresse gehaengt. Ein Pfad ohne
//                Eintrag (etwa der Hangar im Live-Bau) wirkt nicht.
//  GATTUNG       englisches Wort in Name oder Kategorie -> deutsche
//                Gattungswoerter. „Karna Rifle" traegt dann „gewehr" im x, und
//                „karna gewehr" findet es. In BEIDEN Sprachen: wer die englische
//                Seite offen hat und deutsch tippt, soll auch treffen.
//
// Umlaute schreibt die Tabelle normal; das Overlay normalisiert Index und
// Eingabe gleich (Akzente weg, ß -> ss), „Rüstung" und „rustung" treffen
// also beide.

/** Basispfad -> zusaetzliche Suchwoerter (beide Sprachen, nie angezeigt). */
export const TOOL_ALIASES: Record<string, string> = {
  '/item-finder.html': 'gegenstände gegenstand ausrüstung equipment läden laden shops händler kaufen kaufort',
  '/missionen.html': 'aufträge auftrag jobs kopfgeld bounty',
  '/topics/crafting.html': 'werkbank workbench fabricator fabrikator rezept rezepte recipe recipes herstellen herstellung',
  '/fracturing.html': 'brechen bruch zerbrechen laser',
  '/refinery.html': 'raffinerie raffinieren veredeln refining raffinerieauftrag',
  '/topics/mining.html': 'erz erze ore ores rohstoffe abbau abbauen fundorte',
  '/precision-jump.html': 'sprung sprünge jump navigation',
  '/topics/wikelo-emporium.html': 'tausch tauschen',
  '/schiffe.html': 'loadout ausstattung raumschiffe fahrzeuge vehicles',
  '/archiv.html': 'patchnotes patch notes chronik',
  '/evolution.html': 'entwicklung verlauf',
  // Verzeichnisse: die Bereichsliste fuehrt sie seit A1 als Werkzeug.
  '/items.html': 'verzeichnis directory kategorien categories gegenstände',
  '/crafting.html': 'verzeichnis directory blueprints baupläne blaupausen bauplan',
  '/armor-sets.html': 'rüstungssets rüstungs-sets rüstung sets armor armour',
  '/downloads.html': 'karten maps wallpaper onepager herunterladen',
  // Hangar und Advanced Loadout (nur Vorschau-Bau) tragen ihre Suchwoerter in
  // der Bereichsliste selbst, hinter HAS_HANGAR: keine Quelldatei ausserhalb
  // des Schalters nennt eine Hangar-Seite (tests/e2e/hangar-switch.test.js).
};

/**
 * Englisches Wort (Wortgrenze, in Name oder Kategoriepfad) -> deutsche
 * Gattungswoerter. Nur, was im Katalog wirklich vorkommt; jede Zeile wird
 * von tests/e2e/suche-treffer.test.js gegen ein Beispiel gefahren. Was als
 * Teilwort schon trifft, fehlt mit Absicht („helm" steht in „Helmet",
 * „jacke" in „Jacket").
 */
export const GATTUNG: ReadonlyArray<readonly [RegExp, string]> = [
  [/\brifles?\b/i, 'gewehr sturmgewehr'],
  [/\bsniper\b/i, 'scharfschützengewehr scharfschütze'],
  [/\bshotguns?\b/i, 'schrotflinte flinte'],
  [/\bpistols?\b/i, 'pistole'],
  [/\bsmgs?\b/i, 'maschinenpistole'],
  [/\blmgs?\b/i, 'maschinengewehr'],
  [/\bgrenades?\b/i, 'granate'],
  [/\bknife\b|\bknives\b/i, 'messer'],
  [/\barmou?r\b/i, 'rüstung panzerung'],
  [/\bundersuits?\b/i, 'unteranzug'],
  [/\bbackpacks?\b/i, 'rucksack'],
  [/\bcore\b|\btorso\b/i, 'brustpanzer'],
  [/\barms\b/i, 'armschutz'],
  [/\blegs\b/i, 'beinschutz'],
  [/\bgloves?\b/i, 'handschuhe'],
  [/\bfootwear\b|\bboots?\b/i, 'schuhe stiefel'],
  [/\bshirts?\b/i, 'hemd'],
  [/\blegwear\b|\bpants\b/i, 'hose'],
  [/\bhats?\b/i, 'mütze hut'],
  [/\bshields?\b/i, 'schild schutzschild'],
  [/\bcoolers?\b/i, 'kühler'],
  [/\bpower ?plants?\b/i, 'kraftwerk generator'],
  [/\bquantum ?drives?\b/i, 'quantenantrieb'],
  [/\bmissiles?\b/i, 'rakete lenkrakete'],
  [/\brockets?\b/i, 'rakete'],
  [/\bturrets?\b/i, 'geschützturm turm'],
  [/\bguns\b|\bcannons?\b|\brepeaters?\b/i, 'kanone geschütz'],
  [/\bliver(?:y|ies)\b|\bpaints?\b/i, 'lackierung'],
  [/\bmining\b/i, 'bergbau'],
  [/\bsalvage\b/i, 'bergung'],
  [/\btractor beams?\b/i, 'traktorstrahl'],
  [/\bfuel\b/i, 'treibstoff tank'],
  [/\bbatter(?:y|ies)\b/i, 'batterie'],
  [/\bdrinks?\b/i, 'getränk'],
  [/\bfoods?\b/i, 'essen nahrung'],
  [/\bclothing\b/i, 'kleidung'],
  [/\bcontainers?\b/i, 'behälter kiste'],
];

/**
 * Deutsche Gattungswoerter zu einem englischen Text (Name + Kategorie), ohne
 * die, die schon im Text stehen. Leer, wenn nichts passt.
 */
export function gattungsWoerter(text: string): string {
  const klein = text.toLowerCase();
  const out = new Set<string>();
  for (const [re, woerter] of GATTUNG) {
    if (!re.test(text)) continue;
    for (const w of woerter.split(' ')) if (!klein.includes(w)) out.add(w);
  }
  return [...out].join(' ');
}
