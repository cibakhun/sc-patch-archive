// Kategorie-Ordnung des Item-Katalogs (UX-Audit IA B6/V7, Krisz 24.11.2026):
// „Other“ nach Art aufgeteilt, Ruestung aus Fremdkategorien in ihre Slots.
// Regeln: scripts/lib/kategorie-ordnung.mjs.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { SONSTIGES_REGELN, sonstigesEinordnen, kategorieAngleichen, kategorieFuer } from '../../scripts/lib/kategorie-ordnung.mjs';

const db = JSON.parse(readFileSync('assets/universal-items.json', 'utf8'));

test('Namen landen in der Kategorie, die ihre Art nennt', () => {
  const faelle = {
    'Aurora Mk I Big Benny Livery': 'Vehiclegear / Liveries',
    'Behring Flares x 16': 'Vehiclegear / Countermeasures',
    'Size 3 Vehicle Weapon Ammuniton': 'Ammo',
    "'WAR' Neutron Cannon": 'Vehiclegear / Weapons / Guns',
    'Vendetta BSTR HMG': 'Vehiclegear / Weapons / Guns',
    'Talon Quad Rack': 'Vehiclegear / Weapons / Missile Racks',
    'Aegis Double Platform': 'Vehiclegear / Weapons / Turrets',
    'Tumbril Cyclone EMP Device': 'Vehiclegear / EMP',
    'SafeTow S3-Q Towing Beam': 'Vehiclegear / Tractor Beam',
    'SECO Shield Small (Pirate)': 'Vehiclegear / Shield',
    'Aegis Avenger Ejection Seat': 'Vehiclegear / Seats',
    'Salvaged Skull 4 SCU Container': 'Vehiclegear / Container',
    "'CAST' Weapons Control": 'Vehiclegear / Ship Systems',
    'Aegis Antaeus Main Engine': 'Vehiclegear / Thrusters',
    'Ace Interceptor Flight Suit': 'Armour / Undersuits',
    'Bastion Arms': 'Armour / Arms',
    'Bastion Legs': 'Armour / Legs',
    'Bastion Core': 'Armour / Core',
    'Artisan Apron': 'Clothing',
    'Shutter Flashbang': 'Weapons / Grenades',
    'Stor*All Big Box Model A': 'Utility / Containers',
    'Crypt Keycard': 'Utility / Keycards',
    'DCHS-01 Executive Access Protocols Comp-Board': 'Utility / Keycards',
    'Black Bean Ramian': 'Utility / Foods',
    'Pips A20 (5 aUEC)': 'Utility / Foods',
    'Gin & Tonic': 'Utility / Drinks',
    'Government Cartography Agency Medal (Worn)': 'Utility / Miscellaneous',
    'Anvil Accent Chair': 'Other / Decorations',
    'Bed': 'Other / Decorations',
    '2942 Bond Plaque': 'Other / Flair',
    'Crusader Black Bishop': 'Other / Flair',
    'Skin 03': 'Other / Appearance',
    'Blonde': 'Other / Appearance',
    'Ballet Bun': 'Other / Appearance',
  };
  for (const [name, soll] of Object.entries(faelle)) assert.strictEqual(sonstigesEinordnen(name), soll, name);
});

test('Gegenbeispiele: was nicht eindeutig ist, bleibt „Other“ oder geht an die engere Regel', () => {
  // Erste passende Regel gewinnt: Stuhl ist Moebel, kein Schiffssitz; die
  // Box heisst „Model A“ und ist trotzdem Aufbewahrung, kein Modell.
  assert.strictEqual(sonstigesEinordnen("Salvaged Polaris Captain's Chair"), 'Other / Decorations');
  assert.strictEqual(sonstigesEinordnen('Stor*All Big Box Model A'), 'Utility / Containers');
  // Mehrdeutig: Stirnlampe ist keine Leuchte, „Display“ kein Zierstueck.
  for (const n of ['Headhunter Head Lamp', 'Generic Horizontal Display', 'viVid Display']) assert.strictEqual(sonstigesEinordnen(n), 'Other', n);
  // Serien- und Farbnamen ohne Art bleiben, wo sie sind.
  for (const n of ['Goldenrod', 'Marigold', 'Aegis Avenger', 'COMMS', '', null]) assert.strictEqual(sonstigesEinordnen(n), 'Other', String(n));
  // Ein Persoenlicher Schild ist kein Schiffsschild.
  assert.notStrictEqual(sonstigesEinordnen('FSK-8 Soloshield'), 'Vehiclegear / Shield');
  // Eine Beschreibung statt eines Namens bleibt stehen, auch wenn „Suit“ darin vorkommt.
  assert.strictEqual(sonstigesEinordnen('The Microid Battle Suit is designed out of interlocking hardened composite technology to provide you maximum protection against everything.'), 'Other');
});

test('Ruestung ausserhalb der Slot-Ordnung bekommt den Slot aus dem Namen', () => {
  assert.strictEqual(kategorieAngleichen('Armour / Engineer / Light', 'Oracle Helmet'), 'Armour / Helmets');
  assert.strictEqual(kategorieAngleichen('Armour / Torso', 'TrueDef-Pro Core White/Silver/Gray'), 'Armour / Core');
  // Slots selbst und alles ausserhalb der Ruestung bleiben unveraendert.
  assert.strictEqual(kategorieAngleichen('Armour / Legs', 'Oracle Helmet'), 'Armour / Legs');
  assert.strictEqual(kategorieAngleichen('Armour', 'Oracle Helmet'), 'Armour');
  assert.strictEqual(kategorieAngleichen('Clothing / Hats', 'Some Helmet'), 'Clothing / Hats');
  // Ohne Slot-Wort im Namen gibt es keinen Grund zu raten.
  assert.strictEqual(kategorieAngleichen('Armour / Engineer / Light', 'Oracle'), 'Armour / Engineer / Light');
  // Eingeordnete Items fasst die „Other“-Regel nicht an.
  assert.strictEqual(kategorieFuer('Utility / Foods', 'Anvil Accent Chair'), 'Utility / Foods');
  assert.strictEqual(kategorieFuer(null, 'Bed'), 'Other / Decorations');
});

test('Der committete Katalog ist nachgezogen (Selbstauskunft)', () => {
  let geprueft = 0;
  const offen = [];
  for (const it of db.items) {
    geprueft++;
    const soll = kategorieFuer(it.category, it.name);
    if (soll !== it.category) offen.push(`${it.name}: ${it.category} -> ${soll}`);
  }
  const rest = db.items.filter((i) => i.category === 'Other').length;
  console.log(`kategorie-ordnung: ${geprueft} Items geprueft, ${offen.length} offen, ${rest} bleiben „Other“`);
  assert.ok(geprueft >= 9_000, `nur ${geprueft} Items im Katalog`);
  assert.deepStrictEqual(offen.slice(0, 10), [], 'node scripts/kategorien-nachziehen.mjs ausfuehren');
  for (const alt of ['Armour / Engineer / Light', 'Armour / Torso']) {
    assert.ok(!db.items.some((i) => i.category === alt), `${alt} traegt wieder Items: Weiterleitung in nginx/umzuege.conf pruefen`);
  }
});

test('Jede Regel hat ihren Anlass und trifft noch etwas im Katalog (Zombie-Waechter)', () => {
  const erste = (n) => SONSTIGES_REGELN.findIndex((r) => r.re.test(String(n || '').trim()));
  const treffer = SONSTIGES_REGELN.map(() => 0);
  for (const it of db.items) {
    const ix = erste(it.name);
    if (ix >= 0 && it.category === SONSTIGES_REGELN[ix].kategorie) treffer[ix]++;
  }
  SONSTIGES_REGELN.forEach((r, ix) => {
    assert.ok(r.anlass && r.anlass.trim(), `Regel ${ix} ohne Anlass`);
    assert.ok(treffer[ix] > 0, `Regel ${ix} (${r.anlass}) trifft nichts mehr im Katalog`);
  });
});
