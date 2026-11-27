// Was die Suche der Items-Werkbank als Filter erkennt (Krisz 27.11.2026:
// „können wir bei items dieses smart search was wir bei den schiffen schon
// haben in der hangar?“). Dieselbe Form wie das Vokabular des Schiffsfinders
// (vocab() in src/lib/hangar/finder.ts): je Art eine Liste {k, w}, die Woerter
// klein und in beiden Sprachen, damit „helmet“ auch auf der deutschen Seite
// greift. Erkannt wird mit erkenne() aus assets/smart-suche.js; Hersteller
// baut der Client aus dem Katalog dazu (assets/items-werkbank.js).
//
// Arten:
//   kat   Kategorie (Blatt der Leiste); k ist der Name, c die Kategorien
//         dahinter (Rucksäcke stehen bei Rüstung und bei Kleidung)
//   grp   Gruppe der Leiste (Wurzel der Kategorie)
//   art   Fundart wie im Filter: buy, loot, exclusive
//   pk    Panzerungsklasse: Light, Medium, Heavy, SuperHeavy
//   sel   Seltenheit: Common … Legendary
//   sys   Sternsystem, in dem man es kaufen oder finden kann
import { kategorieBaum } from './itemKategorien';

export interface SuchEintrag { readonly k: string; readonly w: readonly string[]; readonly c?: readonly string[] }
export interface ItemsSuchVokabular {
  readonly kat: readonly SuchEintrag[];
  readonly grp: readonly SuchEintrag[];
  readonly art: readonly SuchEintrag[];
  readonly pk: readonly SuchEintrag[];
  readonly sel: readonly SuchEintrag[];
  readonly sys: readonly SuchEintrag[];
}

const klein = (s: string) => s.toLowerCase().trim();
const uniq = (xs: readonly string[]) => [...new Set(xs.map(klein).filter(Boolean).flatMap((w) => umschrift(w)))];

/**
 * Einzahl zu einem Namen in Mehrzahl, grob und nur fuer ein einzelnes Wort:
 * „Helme“ -> helm, „Raketen“ -> rakete, „Lackierungen“ -> lackierung,
 * „Batteries“ -> battery, „Torpedoes“ -> torpedo. Kuerzer als vier Zeichen
 * bleibt weg („Hats“ -> nicht „hat“), Namen aus mehreren Woertern bleiben,
 * wie sie sind; Umlaut-Mehrzahl („Rucksäcke“) steht in KATEGORIE_WORTE.
 */
export function einzahl(name: string, lang: 'de' | 'en'): string[] {
  const n = klein(name);
  if (!n || /\s/.test(n)) return [];
  let e = '';
  if (lang === 'en') {
    if (n.endsWith('ies')) e = `${n.slice(0, -3)}y`;
    else if (/(?:o|s|x|ch|sh)es$/.test(n)) e = n.slice(0, -2);
    else if (n.endsWith('s') && !/(?:ss|us|is|as)$/.test(n)) e = n.slice(0, -1);
  } else if (n.endsWith('ungen')) e = n.slice(0, -2);
  else if (/[^e]en$/.test(n) || n.endsWith('ien')) e = n.slice(0, -1);
  else if (/[^e]e$/.test(n) || n.endsWith('os')) e = n.slice(0, -1);
  return e.length >= 4 && e !== n ? [e] : [];
}

/** Dazu die Schreibweise ohne Umlaut-Zeichen: „rüstung“ auch als „ruestung“. */
const umschrift = (w: string) => [w, w.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')];

// Woerter, die eine Gruppe meint, ausser ihrem Namen. „Sonstiges“ fehlt mit
// Absicht: „other“ ist ein Allerweltswort.
const GRUPPE_WORTE: Readonly<Record<string, readonly string[]>> = {
  Armour: ['rüstung', 'rüstungen', 'armor', 'armour', 'panzerung'],
  Vehiclegear: ['schiffskomponente', 'schiffsteile', 'ship component', 'ship parts'],
  Clothing: ['kleidung', 'clothing', 'clothes'],
  Weapons: ['waffe', 'waffen', 'weapon', 'weapons'],
  Utility: ['werkzeug', 'werkzeuge', 'tools', 'tool'],
  Commodity: ['handelsware', 'commodity'],
  Vehicle: ['fahrzeug', 'vehicle'],
  Attachment: ['aufsatz', 'waffenaufsatz', 'waffenaufsätze', 'attachment'],
  Ammo: ['ammunition'],
};
const OHNE_GRUPPE = new Set(['Other']);

// Woerter je Kategorie ausser Namen und Einzahl (Umlaut in der Mehrzahl,
// gaengige Kurzformen).
const KATEGORIE_WORTE: Readonly<Record<string, readonly string[]>> = {
  'Armour / Backpacks': ['rucksack'],
  'Clothing / Backpacks': ['rucksack'],
  'Armour / Undersuits': ['unteranzug'],
  'Armour / Core': ['torso', 'brustpanzer'],
  'Attachment / Barrel': ['lauf'],
  'Vehiclegear / Weapons / Turrets': ['geschützturm'],
  'Vehiclegear / Quantumdrive': ['quantenantrieb', 'quantum drive'],
  'Vehiclegear / Powerplant': ['power plant'],
  'Vehiclegear / Flight Blade': ['flight blade'],
};

const ART = [
  { k: 'buy', w: ['kaufen', 'kaufbar', 'kauf', 'shop', 'shops', 'buy', 'buyable', 'purchasable', 'store'] },
  { k: 'loot', w: ['loot', 'lootbar', 'lootable', 'looten', 'beute', 'fundort', 'fundorte'] },
  { k: 'exclusive', w: ['exklusiv', 'exclusive'] },
];
const PANZERUNG = [
  { k: 'Light', w: ['leicht', 'leichte', 'leichter', 'light'] },
  { k: 'Medium', w: ['mittel', 'mittlere', 'mittlerer', 'medium'] },
  { k: 'Heavy', w: ['schwer', 'schwere', 'schwerer', 'heavy'] },
  { k: 'SuperHeavy', w: ['superheavy', 'super heavy', 'sehr schwer'] },
];
const SELTENHEIT = [
  { k: 'Common', w: ['gewöhnlich', 'common'] },
  { k: 'Uncommon', w: ['ungewöhnlich', 'uncommon'] },
  { k: 'Rare', w: ['selten', 'rare'] },
  { k: 'Epic', w: ['episch', 'epic'] },
  { k: 'Legendary', w: ['legendär', 'legendary'] },
];
const SYSTEME = [
  { k: 'stanton', w: ['stanton'] },
  { k: 'pyro', w: ['pyro'] },
  { k: 'nyx', w: ['nyx'] },
];

/** Das Vokabular fuer die Werkbank, gleich fuer beide Sprachen. */
export function itemsSuchVokabular(): ItemsSuchVokabular {
  const de = kategorieBaum('de');
  const en = kategorieBaum('en');
  const enName = new Map<string, string>();
  for (const g of en) for (const b of g.blaetter) enName.set(b.cat, b.name);

  const grp = de.filter((g) => !OHNE_GRUPPE.has(g.root)).map((g) => {
    const e = en.find((x) => x.root === g.root);
    return { k: g.root, w: uniq([g.name, e?.name ?? '', ...(GRUPPE_WORTE[g.root] ?? [])]) };
  });

  // Je Wort die Kategorien, die es meint. „Allgemein“ (Items einer Gruppe
  // ohne Unterkategorie) ist kein Suchwort.
  const proWort = new Map<string, Set<string>>();
  const name = new Map<string, string>();
  for (const g of de) {
    for (const b of g.blaetter) {
      if (b.cat === g.root) continue;
      const nameEn = enName.get(b.cat) ?? '';
      const worte = uniq([b.name, nameEn, ...einzahl(b.name, 'de'), ...einzahl(nameEn, 'en'), ...(KATEGORIE_WORTE[b.cat] ?? [])]);
      for (const w of worte) {
        if (!proWort.has(w)) proWort.set(w, new Set());
        proWort.get(w)!.add(b.cat);
      }
      name.set(b.cat, b.name);
    }
  }
  // Ein Eintrag je Menge von Kategorien, damit ein Wort genau eine Bedeutung hat.
  const proMenge = new Map<string, { c: string[]; w: string[] }>();
  for (const [w, cats] of proWort) {
    const c = [...cats].sort();
    const key = c.join('|');
    if (!proMenge.has(key)) proMenge.set(key, { c, w: [] });
    proMenge.get(key)!.w.push(w);
  }
  const kat = [...proMenge.values()].map((e) => ({ k: e.c.join('|'), w: e.w, c: e.c }));

  return { kat, grp, art: ART, pk: PANZERUNG, sel: SELTENHEIT, sys: SYSTEME };
}
