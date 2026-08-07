// Wächter für die Waffengrößen im Fahrzeug-Katalog.
//
// WARUM ES DEN GIBT: Anzeigenamen sind in Star Citizen nicht eindeutig. Vier
// verschiedene Items heißen "Revenant Gatling" (S3/S4/S6/S4), drei "Tarantula
// GT-870 Mark 3 Cannon" (S3/S7/S8). Jede Pipeline-Stufe, die einen Namen als
// Schlüssel benutzt, kann darum stillschweigend die falsche Größe einsetzen —
// genau das ist passiert und stand auf 15 Schiffen im Datenblatt.
//
// STAND 01.4-05 (der Tausch, D-19): vorher las dieser Wächter `fixedWeaponSizes`/
// `fixedWeaponMounts` und joint je Waffe über den ANZEIGENAMEN gegen das
// Stock-Loadout — beide Felder stammten aus der Wiki-Kette. Nach dem Tausch
// trägt jeder Eintrag in `fixedWeapons[]`/`turretWeapons[]` seine Größe UND
// seine Item-Klasse (`cls`, dieselbe Kennung wie in ship-loadouts.json) direkt
// — der Wächter joint jetzt über `cls`, nicht mehr über den Anzeigenamen.
//
// Er prüft dabei drei Dinge:
//   1. Größe je Waffe (Pilot UND Turm, Join über cls) == Größe im Loadout
//      desselben Schiffs
//   2. fixedWeaponSizes ist wirklich die Summe der IM LOADOUT verbauten
//      Pilotwaffen-Größen (nicht gegen den Katalog selbst — sonst verglich die
//      Prüfung eine aus fixedWeapons GERECHNETE Zahl mit sich selbst und wäre
//      tautologisch grün)
//   3. keine Pilotwaffe ist größer als der größte Hardpoint des Schiffs
//      (physikalisch unmöglich — schlägt an, bevor jemand die Zahl glaubt)
//
// SELBSTPRÜFUNG (D-19): ohne eine sichtbare Zahl "wie viele Einträge wurden
// wirklich geprüft" ist ein Wächter, der nach einem Schemawechsel leere Felder
// liest, von einem echten nicht zu unterscheiden — beide melden "grün". Dieser
// Wächter druckt deshalb IMMER die Zahl der geprüften Schiffe/Waffeneinträge.
//
// Aufruf: node scripts/verify-weapon-sizes.mjs [--quiet]
import { readFile } from 'node:fs/promises';

const QUIET = process.argv.includes('--quiet');
const rd = async (p) => JSON.parse(await readFile(new URL(p, import.meta.url), 'utf8'));
const snapshot = await rd('../src/data/vehicles.json');
const loadouts = await rd('../src/data/ship-loadouts.json');

// Wahrheit je Schiff, aus dem Stock-Loadout (ship-loadouts.json):
//  - byCls:     Item-Klasse -> Menge der dort tatsächlich verbauten Größen
//               (Pilot UND Turm zusammen — der Join-Schlüssel für Prüfung 1)
//  - pilotFlat: die flache Liste der NUR-Pilotwaffen-Größen, ausgerollt nach
//               Stückzahl — die Referenz für Prüfung 2 (NICHT der Katalog
//               selbst, s. Kopfkommentar)
const truthByShip = new Map();
for (const [ship, ports] of Object.entries(loadouts.ships ?? {})) {
  const byCls = new Map();
  const pilotFlat = [];
  for (const items of Object.values(ports)) {
    for (const it of items) {
      if (it.cat !== 'weapon' || it.size == null || !it.cls) continue;
      if (!byCls.has(it.cls)) byCls.set(it.cls, new Set());
      byCls.get(it.cls).add(it.size);
      if (it.carrier !== 'turret') for (let i = 0; i < it.count; i++) pilotFlat.push(it.size);
    }
  }
  truthByShip.set(ship, { byCls, pilotFlat });
}

const expand = (l) => { const o = []; for (const { size, count } of l ?? []) for (let i = 0; i < count; i++) o.push(size); return o; };
const errors = [];
const warnings = [];
let checkedShips = 0, checkedGuns = 0, unresolved = 0;
// Prüfung 3 (Waffe zu groß fürs Hardpoint, 01.4-06 Gap 2): fixedWeaponMounts
// kam bis 01.4-05 aus der Wiki-API (168/227 Schiffe) und wird seit dem Tausch
// aus der Implementierungs-XML gelesen (aktuell 160/227, Fund+Teilfix
// 01.4-06: 56 WeaponGun-Ports trugen "maxsize" statt "maxSize" — die
// Groß-/Kleinschreibung war nicht case-insensitiv gelesen). Der verbleibende
// Rest ist zu einem Teil ECHT nicht vorhanden (Türme haben keine
// Rumpf-Hardpoints, Prüfung 3 gilt nur für feste Bugwaffen) — aber Prüfung 3
// selbst lief seit dem Tausch STILL LEER für jedes Schiff ohne Mount-Daten,
// ohne das zu sagen. Ab hier zählt und druckt der Wächter das mit, UND bricht
// ab, wenn die Lücke wächst — sonst wiederholt sich genau der stille
// Deckungsverlust, den diese Prüfung eigentlich verhindern soll.
let hardpointChecked = 0, hardpointSkipped = 0;
// Baseline nach 01.4-06 (case-insensitiver maxSize-Fix): 94 geprüft / 81
// übersprungen von 175 Schiffen mit festen Bugwaffen. Diese Schranke ist
// bewusst der GEMESSENE Ist-Stand, nicht eine Wunschzahl — wächst sie, ist das
// ein neuer, unbenannter Rückschritt wie der, den diese Lücke schließt.
const MAX_HARDPOINT_SKIP = 81;

for (const v of snapshot.vehicles) {
  const pilotGuns = v.fixedWeapons ?? [];
  const turretGuns = v.turretWeapons ?? [];
  if (!pilotGuns.length && !turretGuns.length) continue;
  checkedShips++;
  const truth = truthByShip.get(v.id);

  // 1) je Waffe (Pilot + Turm) gegen das Loadout — Join über cls, NICHT über
  //    den Anzeigenamen (display-name-not-a-key)
  const checkGroup = (list, label) => {
    const flat = [];
    for (const w of list) {
      checkedGuns++;
      if (w.size == null) { unresolved++; continue; }
      for (let i = 0; i < w.count; i++) flat.push(w.size);
      if (!w.cls) {
        warnings.push(`${v.name}: "${w.name}" (${label}, S${w.size}) trägt kein cls — Join unmöglich`);
        continue;
      }
      const real = truth?.byCls.get(w.cls);
      if (!real) {
        warnings.push(`${v.name}: "${w.name}" (${w.cls}, S${w.size}) steht nicht im Stock-Loadout`);
      } else if (!real.has(w.size)) {
        errors.push(`${v.name}: "${w.name}" (${w.cls}) ist S${w.size}, im Spiel S${[...real].sort().join('/S')}`);
      }
    }
    return flat;
  };
  const pilotFlat = checkGroup(pilotGuns, 'Pilot');
  checkGroup(turretGuns, 'Turm');

  // 2) Aggregat == Summe der Loadout-Wahrheit (NICHT des Katalogs selbst)
  if (truth) {
    const agg = expand(v.fixedWeaponSizes).sort((a, b) => a - b).join(',');
    const own = truth.pilotFlat.slice().sort((a, b) => a - b).join(',');
    if (agg !== own) errors.push(`${v.name}: fixedWeaponSizes [${agg}] != Loadout-Wahrheit [${own}]`);
  }

  // 3) Pilotwaffe größer als ihr Hardpoint — nur für Schiffe mit festen
  //    Bugwaffen relevant (Türme haben keine Rumpf-Hardpoints, s. o.)
  if (pilotFlat.length) {
    const hp = expand(v.fixedWeaponMounts).sort((a, b) => b - a);
    const gs = pilotFlat.slice().sort((a, b) => b - a);
    if (hp.length && hp.length === gs.length) {
      hardpointChecked++;
      if (gs.some((s, i) => s > hp[i]))
        errors.push(`${v.name}: Waffen [${gs}] passen nicht in die Hardpoints [${hp}]`);
    } else {
      hardpointSkipped++;
    }
  }
}

if (!QUIET) {
  console.log(`geprüft: ${checkedShips} bewaffnete Schiffe · ${checkedGuns} Waffeneinträge`);
  if (unresolved) console.log(`ohne Größe (ehrlich leer): ${unresolved}`);
  console.log(`Prüfung 3 (Waffe zu groß fürs Hardpoint): ${hardpointChecked} geprüft, ${hardpointSkipped} ohne Hardpoint-Daten übersprungen (von ${hardpointChecked + hardpointSkipped} Schiffen mit festen Bugwaffen)`);
  for (const w of warnings) console.log(`  Hinweis: ${w}`);
}
if (errors.length) {
  console.error(`\n✗ ${errors.length} Waffengrößen widersprechen den Spieldaten:`);
  for (const e of errors) console.error(`   ${e}`);
  console.error('\n  -> npm run datamine:loadouts && npm run datamine:vehicles');
  process.exit(1);
}
// Wächter gegen den STILLEN Rückgang (01.4-06, Gap 2): Prüfung 3 selbst kann
// nicht "falsch" werden, wenn ihr die Vergleichsdaten fehlen — sie wird nur
// leiser. Wächst hardpointSkipped über die gemessene Baseline, ist das der
// exakte Fehlermodus, den diese Phase beseitigen sollte (ein Wächter, der
// weniger prüft, ohne es zu sagen) — hier bricht der Lauf deshalb ab, statt
// grün zu melden.
if (hardpointSkipped > MAX_HARDPOINT_SKIP) {
  console.error(`\n✗ Prüfung 3 übersprang ${hardpointSkipped} Schiffe ohne Hardpoint-Daten — mehr als die bekannte Baseline (${MAX_HARDPOINT_SKIP}).`);
  console.error('  Das ist ein stiller Deckungsverlust, kein grüner Zustand — bitte Ursache klären, bevor der Wert hier angehoben wird.');
  process.exit(1);
}
if (!QUIET) console.log('✓ alle Waffengrößen decken sich mit den Spieldaten');
