// Kategorie-Ordnung des Item-Katalogs (UX-Audit IA B6/V7, Krisz 24.11.2026:
// „Ja, 301 auf die neue Kategorie“).
//
// Zwei Schritte, beide nur fuer die AUSGABE von build-universal-db.mjs und
// fuer den Nachzug am committeten Bestand (scripts/kategorien-nachziehen.mjs):
//
// 1. sonstigesEinordnen(name): Katalog-Eintraege ohne Spieldaten, die
//    inferCategory() nicht einordnen konnte, landeten als „Other“ auf zwoelf
//    Listenseiten (1.199 Items, ein Achtel des Katalogs): Sitze neben
//    Plueschtieren, Frisuren neben Schiffsgeschuetzen. Hier werden sie nach
//    dem eingeordnet, was ihr Name eindeutig sagt; jede Regel nennt ihr Ziel.
//    Was keine Regel trifft, bleibt „Other“. Ziele sind, wo es sie gibt, die
//    Kategorien, unter denen das Spiel gleichartige Items selbst fuehrt
//    (Moebel unter „Other / Decorations“, Aktionsfiguren unter „Other /
//    Flair“, Artefakt-Bruchstuecke und Barren unter „Utility /
//    Miscellaneous“).
//
// 2. kategorieAngleichen(cat, name): Kategorien aus Fremdquellen, die neben
//    der Slot-Ordnung der Ruestung stehen („Armour / Torso“ neben „Armour /
//    Core“, „Armour / Engineer / Light“ fuer einen Helm), bekommen den Slot,
//    den ihr Name traegt. Je eine Liste mit einem einzigen Item entfaellt.
//
// Wegfallende Listenseiten leiten per 301 auf ihre neue Kategorie
// (nginx/umzuege.conf, verify:redirects [6]).

/** Erste passende Regel gewinnt; `re` laeuft gegen den Anzeigenamen. */
export const SONSTIGES_REGELN = [
  // Ein Name, der in Wahrheit eine Beschreibung ist, bleibt, wo er ist.
  { re: /^.{120,}$/, kategorie: 'Other', anlass: 'Beschreibung statt Name' },
  // Mehrdeutig: Bildschirm im Schiff oder Zierstueck, Stirnlampe statt Leuchte.
  { re: /^(Generic Horizontal Display|viVid Display|Headhunter Head Lamp)$/, kategorie: 'Other', anlass: 'mehrdeutig' },

  // --- Schiffe und Schiffsteile ohne Werte ---
  { re: /\bLivery\b/i, kategorie: 'Vehiclegear / Liveries', anlass: 'Lackierung' },
  { re: /\b(Flares|Noise) x \d+\b/, kategorie: 'Vehiclegear / Countermeasures', anlass: 'Taeuschkoerper' },
  { re: /\bVehicle Weapon Ammuni(?:ti|t)on\b/i, kategorie: 'Ammo', anlass: 'Schiffsmunition' },
  { re: /\b(Repeater|Cannon|HMG|Gatling|Scattergun)\b/, kategorie: 'Vehiclegear / Weapons / Guns', anlass: 'Schiffsgeschuetz' },
  { re: /\b(Quad|Twin) Rack$/, kategorie: 'Vehiclegear / Weapons / Missile Racks', anlass: 'Raketenhalter' },
  { re: /\b(Single|Double|Triple|Quad) Platform$|\bMount( Size \d+)?$/, kategorie: 'Vehiclegear / Weapons / Turrets', anlass: 'Waffenhalterung' },
  { re: /\bEMP Device\b/, kategorie: 'Vehiclegear / EMP', anlass: 'EMP' },
  { re: /\bTractor$|\bTowing Beam\b/, kategorie: 'Vehiclegear / Tractor Beam', anlass: 'Traktorstrahl' },
  { re: /^(?!.*\bSoloshield\b).+\bShield( (Small|Medium|Large))?( \(\w+\))?$/, kategorie: 'Vehiclegear / Shield', anlass: 'Schildgenerator' },
  { re: /\bSeat( (Blue|Red))?$/, kategorie: 'Vehiclegear / Seats', anlass: 'Schiffssitz' },
  { re: /\b\d+ SCU Container$/, kategorie: 'Vehiclegear / Container', anlass: 'Frachtbehaelter' },
  {
    re: /\b(ADS( Computer)?|CPU|Motherboard|Targeting Computer|Weapons? Control|Avionics System|Cockpit Audio|Landing System|External Lights|Exterior Lights|Engine Light|Self Destruct( Long)?|Target Selection Device|Signature Reduction Device|Engineering Control Station|Gravity Plate|Intakes)$/,
    kategorie: 'Vehiclegear / Ship Systems', anlass: 'Schiffssystem',
  },
  { re: /\b(Engine|Propulsion|Propulsor|Thrusters)\b/, kategorie: 'Vehiclegear / Thrusters', anlass: 'Triebwerk' },

  // --- Ruestung und Kleidung ---
  { re: /\bFlight Suit\b/, kategorie: 'Armour / Undersuits', anlass: 'Fliegeranzug' },
  { re: /\bArms\b(?!.*\b(Core|Legs)\b)/, kategorie: 'Armour / Arms', anlass: 'Ruestungsarme' },
  { re: /\bLegs\b/, kategorie: 'Armour / Legs', anlass: 'Ruestungsbeine' },
  { re: /\bCore\b/, kategorie: 'Armour / Core', anlass: 'Ruestungsoberkoerper' },
  { re: /\b(Goggles|Apron|Monocle)\b/, kategorie: 'Clothing', anlass: 'Kleidung' },
  { re: /\bFlashbang$/, kategorie: 'Weapons / Grenades', anlass: 'Blendgranate' },
  { re: /^Stor\*All\b/, kategorie: 'Utility / Containers', anlass: 'Aufbewahrung' },

  // --- Zugang und Missionsgegenstaende ---
  { re: /\b(Keycard|Access Card|Inverter Code|Encryption Key|Comp-Board)\b/, kategorie: 'Utility / Keycards', anlass: 'Zugang' },

  // --- Essen und Trinken ---
  // „(Slice)“ endet auf eine Klammer: dahinter gibt es keine Wortgrenze.
  { re: /\b(Ramian|Noodles|Ration pack|Combat Ration)\b|\bPizza \(Slice\)/i, kategorie: 'Utility / Foods', anlass: 'Essen' },
  { re: /^Pips \w+ \(\d+ aUEC\)$/, kategorie: 'Utility / Foods', anlass: 'Knabberzeug' },
  { re: /\((3|5) aUEC\)$|^Gin & Tonic$|\(Pint\)$/, kategorie: 'Utility / Drinks', anlass: 'Getraenk' },

  // --- Wie das Spiel: Bruchstuecke, Barren, Orden unter „Utility / Miscellaneous“ ---
  { re: /\b(Artifact Fragment|Ingot|Medal|Service Marker)\b/, kategorie: 'Utility / Miscellaneous', anlass: 'Fundstueck' },

  // --- Wie das Spiel: Moebel unter „Other / Decorations“ ---
  {
    re: /\b(Bed|Chair|Stool|Nightstand|Table|Loveseat|Couch|Cot|Footlocker|Locker( \d)?|Storage Chest|Liquor Cabinet|Workbench|Safe|Weapon (Display )?Rack|Vending Machine|Throne|Trophy Case|Plant Shelf)$/,
    kategorie: 'Other / Decorations', anlass: 'Moebel',
  },

  // --- Wie das Spiel: Sammel- und Ziergegenstaende unter „Other / Flair“ ---
  {
    re: /\b(Poster|Plushie|Model|Models?|Model Box|Miniature|Trophy|Plaque|Coin|Display Case|Statue|Figurine|Action Figure|Replica|Plant|Planter|Plant Pot|Skull|Holographic Flag|Mini-Flag|Sign|Hologram|Lamp|Neon Light|Painting|Sculpture|Bust|Spaceglobe|Die|Schematics?|Badge|Display|Kiddie Ride|Jukebox|Fish Tank|Holiday Tree|Holiday Wreath|Calendar|Charm|Lantern Display|Specimen Tank|Puzzle|Bath Float|Mascot Costume|Teddy Bear|Sextant|Cookie Jar|Towel|Chance Cube|Dashbot|Collection|Bear|Fish)\b/,
    kategorie: 'Other / Flair', anlass: 'Zierstueck',
  },
  { re: /\b(Bishop|King|Knight|Pawn|Queen|Rook)$/, kategorie: 'Other / Flair', anlass: 'Schachfigur' },

  // --- Charakter: Frisuren, Haar- und Hautfarben ---
  { re: /^Skin \d+$/, kategorie: 'Other / Appearance', anlass: 'Hautton' },
  {
    re: /^((Light|Medium|Dark) )?(Black|Blonde|Blue|Brown|Crimson|Green|Grey|Orange|Pink|Purple|Red|Teal|Violet|White|Yellow|Hazel|Amber)(\/(Black|Red))?$/,
    kategorie: 'Other / Appearance', anlass: 'Haar- oder Augenfarbe',
  },
  {
    re: /\b(Bangs|Bedhead|Bun|Cut|Mohawk|Undercut|Pixie|Bob|Fade|Taper|Side Part|Ponytail|Pompadour|Slicked Back|Topknot|Braids|Twists|Buzz|Shaved|Spiked|Combed Back|Brushed (Up|Forward)|Swept Back|Fringe Up|Comb Over|Caesar|Clipped)$/,
    kategorie: 'Other / Appearance', anlass: 'Frisur',
  },
];

/** Kategorie fuer einen Katalog-Eintrag, den inferCategory() nicht einordnen konnte. */
export function sonstigesEinordnen(name) {
  const n = String(name || '').trim();
  for (const r of SONSTIGES_REGELN) if (r.re.test(n)) return r.kategorie;
  return 'Other';
}

/** Slots der Ruestung, wie datamine-items.mjs sie aus dem Spieltyp ableitet. */
const RUESTUNG_SLOTS = new Set(['Armour', 'Armour / Helmets', 'Armour / Core', 'Armour / Arms', 'Armour / Legs', 'Armour / Backpacks', 'Armour / Undersuits']);
const SLOT_WORT = [
  [/\bHelmet\b/, 'Armour / Helmets'],
  [/\b(Core|Torso)\b/, 'Armour / Core'],
  [/\bArms\b/, 'Armour / Arms'],
  [/\bLegs\b/, 'Armour / Legs'],
  [/\bBackpack\b/, 'Armour / Backpacks'],
  [/\bUndersuit\b/, 'Armour / Undersuits'],
];

/** Ruestungs-Kategorie ausserhalb der Slot-Ordnung -> Slot aus dem Namen (sonst unveraendert). */
export function kategorieAngleichen(cat, name) {
  if (!cat || !/^Armour \//.test(cat) || RUESTUNG_SLOTS.has(cat)) return cat;
  for (const [re, slot] of SLOT_WORT) if (re.test(name || '')) return slot;
  return cat;
}

/** Endgueltige Kategorie eines Katalog-Items fuer die Ausgabe. */
export function kategorieFuer(cat, name) {
  if (!cat || cat === 'Other') return sonstigesEinordnen(name);
  return kategorieAngleichen(cat, name);
}
