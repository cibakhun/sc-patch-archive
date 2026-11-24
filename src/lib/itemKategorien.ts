// Kategorien des Item-Katalogs fuer die Items-Werkbank: Anzeigenamen in
// beiden Sprachen, Zeichen und Farbe je Gruppe.
//
// Anlass (Krisz 24.11.2026): Items-Verzeichnis und Item Finder werden eine
// Seite, und die soll „eine richtig geile neuen Standart“ setzen. Bis dahin
// standen die Kategorien auf deutschen Seiten englisch da („Armour /
// Helmets“), im Verzeichnis wie im Finder. Hier steht jede Kategorie einmal
// mit Namen in beiden Sprachen; die Daten selbst bleiben englisch.
//
// Fehlt eine Kategorie (neuer Datenlauf), steht ihr Rohname aus den Daten
// da, nichts bricht. Die Zeichen kommen aus den Spielfeldern (Kategoriepfad,
// bei Handwaffen ohne Unterkategorie die Groesse des Spiels), nie aus dem
// Anzeigenamen; gleiche Regel wie wbGlyphKey in werkbankGlyphs.ts.
import type { Locale } from '../i18n/ui';
import { categoryLabel } from '../i18n/itemText';
import { categories, categorySlug, roots, type CategoryNode, type Item } from './items';

type Namen = { de: string; en: string };

/** Unterkategorien (voller Kategoriepfad aus den Daten). */
const BLATT: Record<string, Namen> = {
  'Armour / Arms': { de: 'Arme', en: 'Arms' },
  'Armour / Backpacks': { de: 'Rucksäcke', en: 'Backpacks' },
  'Armour / Core': { de: 'Oberkörper', en: 'Core' },
  'Armour / Engineer / Light': { de: 'Ingenieur · Leicht', en: 'Engineer · Light' },
  'Armour / Helmets': { de: 'Helme', en: 'Helmets' },
  'Armour / Legs': { de: 'Beine', en: 'Legs' },
  'Armour / Torso': { de: 'Torso', en: 'Torso' },
  'Armour / Undersuits': { de: 'Unteranzüge', en: 'Undersuits' },
  'Attachment / Barrel': { de: 'Läufe', en: 'Barrels' },
  'Attachment / BottomAttachment': { de: 'Unterlauf', en: 'Underbarrel' },
  'Attachment / IronSight': { de: 'Visiere', en: 'Sights' },
  'Attachment / Magazine': { de: 'Magazine', en: 'Magazines' },
  'Attachment / Missile': { de: 'Lenkflugkörper', en: 'Missile' },
  'Attachment / Utility': { de: 'Zubehör', en: 'Utility' },
  'Clothing / Backpacks': { de: 'Rucksäcke', en: 'Backpacks' },
  'Clothing / Footwear': { de: 'Schuhe', en: 'Footwear' },
  'Clothing / Gloves': { de: 'Handschuhe', en: 'Gloves' },
  'Clothing / Hats': { de: 'Kopfbedeckungen', en: 'Hats' },
  'Clothing / Jackets': { de: 'Jacken', en: 'Jackets' },
  'Clothing / Legwear': { de: 'Hosen', en: 'Legwear' },
  'Clothing / Shirts': { de: 'Oberteile', en: 'Shirts' },
  'Other / Decorations': { de: 'Dekoration', en: 'Decorations' },
  'Other / Flair': { de: 'Flair', en: 'Flair' },
  'Utility / Batteries': { de: 'Batterien', en: 'Batteries' },
  'Utility / Consumables': { de: 'Verbrauchsgüter', en: 'Consumables' },
  'Utility / Containers': { de: 'Behälter', en: 'Containers' },
  'Utility / Drinks': { de: 'Getränke', en: 'Drinks' },
  'Utility / Foods': { de: 'Essen', en: 'Food' },
  'Utility / Gadgets': { de: 'Gadgets', en: 'Gadgets' },
  'Utility / Mining Tools': { de: 'Bergbauwerkzeug', en: 'Mining tools' },
  'Utility / Miscellaneous': { de: 'Verschiedenes', en: 'Miscellaneous' },
  'Utility / mobiGlas': { de: 'mobiGlas', en: 'mobiGlas' },
  'Vehiclegear / Container': { de: 'Frachtbehälter', en: 'Containers' },
  'Vehiclegear / Cooler': { de: 'Kühler', en: 'Coolers' },
  'Vehiclegear / Countermeasures': { de: 'Gegenmaßnahmen', en: 'Countermeasures' },
  'Vehiclegear / EMP': { de: 'EMP', en: 'EMP' },
  'Vehiclegear / External Fuel Tank': { de: 'Außentanks', en: 'External fuel tanks' },
  'Vehiclegear / Fabricator': { de: 'Fabrikator', en: 'Fabricator' },
  'Vehiclegear / Flight Blade': { de: 'Flight Blades', en: 'Flight blades' },
  'Vehiclegear / Hydrogen Fuel Tank': { de: 'Wasserstofftanks', en: 'Hydrogen fuel tanks' },
  'Vehiclegear / Jump Module': { de: 'Sprungmodule', en: 'Jump modules' },
  'Vehiclegear / Life Support': { de: 'Lebenserhaltung', en: 'Life support' },
  'Vehiclegear / Liveries': { de: 'Lackierungen', en: 'Liveries' },
  'Vehiclegear / Mining Module': { de: 'Bergbaumodule', en: 'Mining modules' },
  'Vehiclegear / Module': { de: 'Module', en: 'Modules' },
  'Vehiclegear / Powerplant': { de: 'Kraftwerke', en: 'Power plants' },
  'Vehiclegear / Quantum Fuel Tank': { de: 'Quantumtanks', en: 'Quantum fuel tanks' },
  'Vehiclegear / Quantum Interdiction': { de: 'Quantum-Abfangen', en: 'Quantum interdiction' },
  'Vehiclegear / Quantumdrive': { de: 'Quantumantriebe', en: 'Quantum drives' },
  'Vehiclegear / Radar': { de: 'Radar', en: 'Radar' },
  'Vehiclegear / Refuelling / Nozzle': { de: 'Betankung · Düsen', en: 'Refuelling · Nozzles' },
  'Vehiclegear / Salvage': { de: 'Bergung', en: 'Salvage' },
  'Vehiclegear / Shield': { de: 'Schilde', en: 'Shields' },
  'Vehiclegear / Tool Arm': { de: 'Werkzeugarme', en: 'Tool arms' },
  'Vehiclegear / Tractor Beam': { de: 'Traktorstrahlen', en: 'Tractor beams' },
  'Vehiclegear / Weapons / Ballistic / Scatter': { de: 'Ballistisch · Streuung', en: 'Ballistic · Scatter' },
  'Vehiclegear / Weapons / Bomb Racks': { de: 'Bombenhalter', en: 'Bomb racks' },
  'Vehiclegear / Weapons / Bombs': { de: 'Bomben', en: 'Bombs' },
  'Vehiclegear / Weapons / Guns': { de: 'Geschütze', en: 'Guns' },
  'Vehiclegear / Weapons / Missile Racks': { de: 'Raketenhalter', en: 'Missile racks' },
  'Vehiclegear / Weapons / Missiles': { de: 'Lenkraketen', en: 'Missiles' },
  'Vehiclegear / Weapons / Rockets': { de: 'Raketen', en: 'Rockets' },
  'Vehiclegear / Weapons / Torpedoes': { de: 'Torpedos', en: 'Torpedoes' },
  'Vehiclegear / Weapons / Turrets': { de: 'Geschütztürme', en: 'Turrets' },
  'Weapons / Grenades': { de: 'Granaten', en: 'Grenades' },
  'Weapons / Melee': { de: 'Nahkampf', en: 'Melee' },
  'Weapons / SMG': { de: 'Maschinenpistolen', en: 'SMGs' },
};

/** Items, die nur die Gruppe tragen („Weapons“ ohne Unterkategorie). */
const OHNE_UNTER: Namen = { de: 'Allgemein', en: 'General' };

/** Anzeigename einer Gruppe (Wurzel), z. B. „Rüstung“. */
export function gruppenName(root: string, lang: Locale): string {
  return categoryLabel(root, lang);
}

/** Anzeigename einer Kategorie ohne die Gruppe, z. B. „Helme“. */
export function blattName(cat: string, lang: Locale): string {
  const n = BLATT[cat];
  if (n) return n[lang];
  const teile = (cat || '').split('/').map((s) => s.trim()).filter(Boolean);
  if (teile.length <= 1) return OHNE_UNTER[lang];
  return teile.slice(1).join(' · ');
}

/** Hat die Kategorie einen gepflegten Namen? (Gegenprobe fuer die Pruefung.) */
export const blattGepflegt = (cat: string) => cat in BLATT || !cat.includes('/');

/* ---------- Zeichen und Farbe ---------- */

/** Zeichen je Kategorie (Schluessel aus werkzeugZeichen.ts). */
export const ZEICHEN_BLATT: Record<string, string> = {
  'Armour / Arms': 'arms', 'Armour / Backpacks': 'pack', 'Armour / Core': 'core',
  'Armour / Engineer / Light': 'core', 'Armour / Helmets': 'helm', 'Armour / Legs': 'legs',
  'Armour / Torso': 'core', 'Armour / Undersuits': 'suit',
  'Attachment / Barrel': 'barrel', 'Attachment / BottomAttachment': 'grip', 'Attachment / IronSight': 'scope',
  'Attachment / Magazine': 'clip', 'Attachment / Missile': 'missile', 'Attachment / Utility': 'gadget',
  'Clothing / Backpacks': 'pack', 'Clothing / Footwear': 'shoe', 'Clothing / Gloves': 'glove',
  'Clothing / Hats': 'hat', 'Clothing / Jackets': 'jacket', 'Clothing / Legwear': 'pants', 'Clothing / Shirts': 'shirt',
  'Other / Decorations': 'deko', 'Other / Flair': 'deko',
  'Utility / Batteries': 'battery', 'Utility / Consumables': 'medpen', 'Utility / Containers': 'crate',
  'Utility / Drinks': 'drink', 'Utility / Foods': 'food', 'Utility / Gadgets': 'gadget',
  'Utility / Mining Tools': 'mining', 'Utility / Miscellaneous': 'gadget', 'Utility / mobiGlas': 'mobi',
  'Vehiclegear / Container': 'crate', 'Vehiclegear / Cooler': 'cooler', 'Vehiclegear / Countermeasures': 'flare',
  'Vehiclegear / EMP': 'emp', 'Vehiclegear / External Fuel Tank': 'fuel', 'Vehiclegear / Fabricator': 'fabr',
  'Vehiclegear / Flight Blade': 'blade', 'Vehiclegear / Hydrogen Fuel Tank': 'fuel', 'Vehiclegear / Jump Module': 'quantum',
  'Vehiclegear / Life Support': 'life', 'Vehiclegear / Liveries': 'livery', 'Vehiclegear / Mining Module': 'mining',
  'Vehiclegear / Module': 'module', 'Vehiclegear / Powerplant': 'power', 'Vehiclegear / Quantum Fuel Tank': 'fuel',
  'Vehiclegear / Quantum Interdiction': 'radar', 'Vehiclegear / Quantumdrive': 'quantum', 'Vehiclegear / Radar': 'radar',
  'Vehiclegear / Refuelling / Nozzle': 'fuel', 'Vehiclegear / Salvage': 'salvage', 'Vehiclegear / Shield': 'shield',
  'Vehiclegear / Tool Arm': 'arm', 'Vehiclegear / Tractor Beam': 'tractor',
  'Vehiclegear / Weapons / Ballistic / Scatter': 'gun', 'Vehiclegear / Weapons / Bomb Racks': 'rack',
  'Vehiclegear / Weapons / Bombs': 'bomb', 'Vehiclegear / Weapons / Guns': 'gun',
  'Vehiclegear / Weapons / Missile Racks': 'rack', 'Vehiclegear / Weapons / Missiles': 'missile',
  'Vehiclegear / Weapons / Rockets': 'missile', 'Vehiclegear / Weapons / Torpedoes': 'torpedo',
  'Vehiclegear / Weapons / Turrets': 'turret',
  'Weapons / Grenades': 'grenade', 'Weapons / Melee': 'knife', 'Weapons / SMG': 'smg',
};
export const ZEICHEN_GRUPPE: Record<string, string> = {
  Armour: 'helm', Clothing: 'shirt', Weapons: 'rifle', Vehiclegear: 'module', Vehicle: 'ship',
  Utility: 'gadget', Ammo: 'mag', Attachment: 'scope', Commodity: 'crate', Other: 'chip',
};

/** Zeichen einer Gruppe (fuer Leiste und Ueberblick). */
export const gruppenZeichen = (root: string) => ZEICHEN_GRUPPE[root] ?? 'chip';

/**
 * Farbe je Gruppe (--kc an Kachel, Zeichen und Kante). Violett ist die
 * Farbe der Seite (Auswahl) und gehoert der Ruestung, Bernstein den Preisen;
 * die anderen Gruppen haben eigene, gedaempfte Toene.
 */
export const GRUPPEN_FARBE: Record<string, string> = {
  Armour: '#A78BFA', Clothing: '#E58BB7', Weapons: '#FF8266', Vehiclegear: '#4DB2FF', Vehicle: '#37CDB8',
  Utility: '#8FD46E', Ammo: '#DCB440', Attachment: '#F29A5C', Commodity: '#C9A57E', Other: '#9BA2AE',
};

/** Zeichen eines Items: Kategorie, sonst Gruppe; Handwaffen ohne Unterkategorie nach Spielgroesse. */
export function itemZeichen(i: Pick<Item, 'category' | 'game'>): string {
  const z = ZEICHEN_BLATT[i.category];
  if (z) return z;
  const root = (i.category || 'Other').split('/')[0].trim() || 'Other';
  if (root === 'Weapons') {
    const st = i.game?.subType;
    if (st === 'Small') return 'pistol';
    if (st === 'Large') return 'lmg';
  }
  if (root === 'Armour' && !i.game?.subType) return 'plate';
  return gruppenZeichen(root);
}

/* ---------- Baum fuer Leiste und Skript ---------- */

export interface Blatt {
  cat: string;
  slug: string;
  name: string;
  n: number;
  g: string;
}
export interface Gruppe {
  root: string;
  slug: string;
  name: string;
  n: number;
  g: string;
  farbe: string;
  blaetter: Blatt[];
}

/**
 * Gruppen in der Reihenfolge des Verzeichnisses (nach Groesse, „Sonstiges“
 * zuletzt), darin die Kategorien alphabetisch in der Sprache der Seite,
 * „Allgemein“ vorn.
 */
export function kategorieBaum(lang: Locale): Gruppe[] {
  const coll = new Intl.Collator(lang === 'de' ? 'de' : 'en', { sensitivity: 'base' });
  return roots.map((r) => {
    const blaetter = r.nodes.map((c: CategoryNode) => ({
      cat: c.cat,
      slug: c.slug,
      name: blattName(c.cat, lang),
      n: c.items.length,
      g: ZEICHEN_BLATT[c.cat] ?? gruppenZeichen(r.root),
    }));
    blaetter.sort((a, b) => {
      const aw = a.cat === r.root ? 0 : 1;
      const bw = b.cat === r.root ? 0 : 1;
      return aw - bw || coll.compare(a.name, b.name);
    });
    return {
      root: r.root,
      slug: categorySlug(r.root),
      name: gruppenName(r.root, lang),
      n: r.count,
      g: gruppenZeichen(r.root),
      farbe: GRUPPEN_FARBE[r.root] ?? GRUPPEN_FARBE.Other,
      blaetter,
    };
  });
}

/** Zahl der Kategorien insgesamt (Selbstauskunft der Seite). */
export const kategorieZahl = categories.length;
