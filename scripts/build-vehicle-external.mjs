// build-vehicle-external.mjs — friert die Fremddaten des Fahrzeug-Katalogs
// EINMALIG aus dem heutigen Wiki-Snapshot ein, BEVOR dieser Snapshot in Plan 05
// getauscht wird (D-17). Zwei Dinge landen in EINER Datei, weil sie zusammengehören
// ("was das Spiel nicht sagt"):
//
//   1. Zehn Felder je Fahrzeug, deren Quellenlosigkeit belegt ist (Plan 01/02):
//      msrpUSD, pledgeUrl, lengthM, widthM, heightM (D-06 — RSI-Store/publizierte
//      Maße), image (Plan 02, Gruppe C.11 — fotografisches Material, keine
//      Engine-Textur), crewMax (D-11/D-17 — beide Extraktionswege Sackgassen),
//      statusEn/statusDe (Plan 02, Gruppe C.8 — keine Ableitung unterscheidet die
//      Javelin strukturell), fociDe (Plan 02, Gruppe C.9 — roleEn/roleDe deckt nur
//      79/223 Fahrzeuge exakt, andere Taxonomie, kein Ersatz).
//      Diese Liste ist NICHT hier erfunden — sie kommt aus
//      `scratch/01.4-feldurteile.md`, Abschnitt "Für Plan 03". Kommt Plan 02 künftig
//      auf eine kürzere Liste, schrumpft diese Datei mit ihr.
//   2. Vier ganze Fahrzeug-Datensätze (ATLS-Varianten, D-13), die im DataCore KEIN
//      /spaceships/- oder /groundvehicles/-Record besitzen (s. Kopfkommentar unten,
//      Abschnitt ATLS) — komplett aus dem Wiki-Snapshot übernommen, mit
//      Herkunftsangabe, statt sie kommentarlos aus dem Katalog verschwinden zu
//      lassen.
//
// EINMAL-LAUF, kein Pipeline-Schritt: nach dem Tausch in Plan 05 IST
// src/data/vehicles.json der Spieldaten-Katalog und trägt diese zehn Felder nur
// noch aus dieser Datei hier — ein zweiter Lauf ohne Riegel würde die Datei aus
// sich selbst neu erzeugen und dabei jede spätere Handpflege (z. B. korrigierte
// Bild-URLs) stillschweigend verlieren. Deshalb: `--force` ist Pflicht, wenn die
// Zieldatei schon existiert.
//
// Aufruf: node scripts/build-vehicle-external.mjs [--force]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WIKI = resolve(__dirname, '..', 'src', 'data', 'vehicles.json');
const GAME = resolve(__dirname, '..', 'src', 'data', 'vehicles-gamefiles.json');
const OUT = resolve(__dirname, '..', 'src', 'data', 'vehicle-external.json');
const argv = process.argv.slice(2);
const FORCE = argv.includes('--force');

if (existsSync(OUT) && !FORCE) {
  console.error(
    `✗ ${OUT} existiert bereits. Dieses Skript läuft genau einmal sinnvoll (s. Kopfkommentar) —`
    + ' ein Lauf ohne --force würde nach dem Tausch (Plan 05) die Datei aus sich selbst neu'
    + ' erzeugen und jede spätere Handpflege verlieren. Erneuter Lauf nur mit --force.',
  );
  process.exit(1);
}

const wiki = JSON.parse(readFileSync(WIKI, 'utf8'));
// Zeitkritischer Wächter (D-17): diese Datei ergibt nur Sinn, solange
// src/data/vehicles.json noch der unveränderte Wiki-Snapshot ist — danach ist die
// Quelle für crewMax/image/... unwiederbringlich weg.
if (wiki.fetchedAt !== '2026-07-18') {
  console.error(
    `✗ ${WIKI} ist nicht mehr der Wiki-Stand vom 18.07.2026 (fetchedAt=${wiki.fetchedAt}).`
    + ' Die Einfrier-Quelle ist weg — dieser Lauf würde bereits getauschte Werte "einfrieren".',
  );
  process.exit(1);
}
const game = existsSync(GAME) ? JSON.parse(readFileSync(GAME, 'utf8')) : { vehicles: [] };
const gameById = new Map(game.vehicles.map((v) => [v.id, v]));

/* ------------------------------------------------------------------------ */
/* Block 1: die zehn belegt quellenlosen Felder, je Fahrzeug                 */
/* ------------------------------------------------------------------------ */
// Reihenfolge/Herkunft s. Kopfkommentar. `crewMax` hat eine Sonderregel (D-17,
// unten): eine rückläufige Spanne (crewMax < crewSize) wird NICHT übernommen.
const FIELDS = ['msrpUSD', 'pledgeUrl', 'lengthM', 'widthM', 'heightM', 'image', 'crewMax', 'statusEn', 'statusDe', 'fociDe'];

const vehicles = {};
const fieldCounts = Object.fromEntries(FIELDS.map((f) => [f, 0]));
const backwardsCrew = [];
let skippedEmpty = 0;

for (const w of wiki.vehicles) {
  const rec = {};
  for (const f of FIELDS) {
    let v = w[f];
    if (v == null) continue;
    if (Array.isArray(v) && !v.length) continue;
    if (f === 'crewMax') {
      // D-17: die Wiki führt mindestens einen kaputten Wert (600i Touring:
      // crewMax 3 bei crewMin 5 — eine Spanne, die rückwärts läuft, wäre auf dem
      // Datenblatt sichtbarer Unsinn). Wo das spielseitige crewSize (== crewMin,
      // belegt 223/223 identisch) GRÖSSER ist als der einzufrierende crewMax,
      // wird der Wert ausgelassen statt stillschweigend übernommen.
      const g = gameById.get(w.id);
      if (g && g.crew != null && v < g.crew) {
        backwardsCrew.push(`${w.name} (${w.id}): crewMax ${v} < crewSize ${g.crew}`);
        continue;
      }
    }
    rec[f] = v;
    fieldCounts[f]++;
  }
  if (Object.keys(rec).length === 0) { skippedEmpty++; continue; }
  vehicles[w.id] = rec;
}

/* ------------------------------------------------------------------------ */
/* Block 2: ATLS — erst nachsehen, dann übernehmen (D-13)                    */
/* ------------------------------------------------------------------------ */
// Die vier Kennungen stehen in src/data/ship-hardpoints.json (Modell + Hologramm
// vorhanden), fallen aber im DataCore durch den Filter auf
// /spaceships/[^/]+\.xml$ bzw. /groundvehicles/[^/]+\.xml$, den
// datamine-vehicles.mjs für ALLE anderen 223 Fahrzeuge verwendet.
//
// NACHGESEHEN (scratch/probe-atls.mjs, scratch/probe-atls2.mjs, gegen Changelist
// 12326004): der ARGO ATLS ist im DataCore kein `/spaceships/`- oder
// `/groundvehicles/`-Fahrzeug, sondern eine tragbare Arbeitseinheit
// ("Power Suit") mit eigener Entity-Taxonomie:
//   - Character.Character_ARGO_ATLS            (libs/foundry/records/character/powersuits/character_argo_atls.xml)
//   - Character.Character_ARGO_ATLS_GEO        (…/character_argo_atls_geo.xml)
//   - Character.Character_ARGO_ATLS_GEO_IKTI   (…/character_argo_atls_geo_ikti.xml)
//   - EntityClassDefinition.ARGO_ATLS_GEO_Collector_Grad01 (libs/foundry/records/actor/actors/argo_atls_geo_collector_grad01.xml)
//   - EntityClassDefinition.ARGO_ATLS_GEO_Collector_Grad03 (…/argo_atls_geo_collector_grad03.xml)
// Alle liegen unter `character/powersuits/` bzw. `actor/actors/` — STRUKTURELL
// eine andere Entity-Klasse als die VehicleComponentParams-tragenden
// `/spaceships/`- und `/groundvehicles/`-Records, die `buildVehicle()` liest (kein
// `VehicleComponentParams`, keine Implementierungs-XML mit Part-Trefferpunkten,
// kein Flugcontroller). Den Pfadfilter zu erweitern würde NICHT dieselbe
// Extraktion liefern, sondern eine andersartige (Character-Rig statt
// Fahrzeug-Implementierung) — das ist eine strukturelle Erweiterung, keine
// Filterkorrektur, und bleibt außerhalb der Abbruchgrenze dieses Plans.
// ERGEBNIS: belegbar nicht als Fahrzeug-Entity extrahierbar → Übernahme aus dem
// Wiki-Snapshot, wie der Plan es für den Fall vorsieht, dass die Suche scheitert.
const ATLS_IDS = ['argo-atls', 'argo-atls-geo', 'argo-atls-geo-collector-grad01', 'argo-atls-geo-collector-grad03'];
const ATLS_SEARCH_NOTE = 'DataCore-Suche (scratch/probe-atls.mjs, scratch/probe-atls2.mjs, Changelist 12326004): '
  + 'ARGO ATLS ist im DataCore ein "Power Suit" (Character.Character_ARGO_ATLS[...] unter '
  + 'character/powersuits/, Grad01/Grad03 unter actor/actors/) — keine /spaceships/- oder '
  + '/groundvehicles/-Entity mit VehicleComponentParams. Filtererweiterung wäre eine andere '
  + 'Extraktionsart, keine Filterkorrektur — belegbar nicht mit buildVehicle() extrahierbar.';

const OVERRIDDEN_AT = new Date().toISOString().slice(0, 10);
const overrides = {};
let overrideCount = 0;
for (const id of ATLS_IDS) {
  const w = wiki.vehicles.find((v) => v.id === id);
  if (!w) { console.error(`✗ ATLS-Kennung ${id} nicht im Wiki-Snapshot gefunden — kann nicht übernommen werden`); continue; }
  overrides[id] = {
    ...w,
    herkunft: `uebernommen aus Wiki-Snapshot ${wiki.fetchedAt} (kein DataCore-Record in /spaceships/ oder `
      + `/groundvehicles/ — ${ATLS_SEARCH_NOTE})`,
    overriddenAt: OVERRIDDEN_AT,
  };
  overrideCount++;
}

/* ------------------------------------------------------------------------ */
/* Schreiben                                                                 */
/* ------------------------------------------------------------------------ */
const out = {
  source: `src/data/vehicles.json (Wiki-Snapshot, fetchedAt ${wiki.fetchedAt}) — einmalig eingefroren VOR`
    + ' dem Tausch (D-17, Plan 01.4-03)',
  reason: 'Nur was belegt in keiner Spieldatei zu finden ist (Block "vehicles") ODER strukturell keine'
    + ' Fahrzeug-Entity im DataCore ist (Block "overrides", ATLS). Diese Datei soll schrumpfen, nicht'
    + ' wachsen — s. scratch/01.4-feldurteile.md, Abschnitt "Für Plan 03".',
  generatedAt: OVERRIDDEN_AT,
  fields: FIELDS,
  count: Object.keys(vehicles).length,
  vehicles,
  overrideSearch: ATLS_SEARCH_NOTE,
  overrideCount,
  overrides,
};
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');

console.log(`-> ${OUT} geschrieben`);
console.log(`Fahrzeuge mit mind. 1 eingefrorenem Feld: ${out.count} / ${wiki.vehicles.length} (${skippedEmpty} ohne jeden Wert ausgelassen)`);
console.log('Felder:');
for (const f of FIELDS) console.log(`  ${f.padEnd(12)} ${fieldCounts[f]}`);
console.log(`crewMax als rückläufige Spanne ausgelassen: ${backwardsCrew.length}`);
for (const b of backwardsCrew) console.log(`  - ${b}`);
console.log(`ATLS-Uebernahmen: ${overrideCount}/${ATLS_IDS.length}`);
