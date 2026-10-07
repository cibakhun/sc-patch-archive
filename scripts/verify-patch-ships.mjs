// verify-patch-ships.mjs — Patch-Seiten <-> Fahrzeug-Katalog <-> ausgelieferte Schiffsseiten.
//
// WARUM: Das Patch-Rückgrat (welche Patch-Seiten ein Schiff nennen) rechnet
// seit 08.10.2026 der Build aus src/data/patches/*.json (scripts/lib/
// patch-spine.mjs), nicht mehr der Datenlauf. Zwei Dinge können dabei still
// schiefgehen, und beide fing vorher niemand:
//   1. Eine Patch-Seite nennt ein Schiff, das der Katalog nicht führt — dann
//      verlinkt nichts. So stand die S-65 Stingray auf der 4.10.0-Seite, während
//      sie im Katalog fehlte (der Katalog nahm neue Schiffe nicht auf).
//   2. Der Build rendert den Verweis nicht, obwohl die Verknüpfung besteht.
//
// URTEIL (docs/maschinelle-validierung.md § 4, Grundsatz 3):
//   WARNUNG  ein Patch-Schiff ohne Katalog-Treffer und ohne benannte Ausnahme —
//            ein Schiff darf angekündigt sein, bevor es im Spiel ist.
//   FEHLER   nur, wo die Handlungsanweisung immer richtig ist: eine verknüpfte
//            Schiffsseite in dist/ trägt den Verweis nicht (Build reparieren),
//            eine Ausnahme hat ihren Anlass verloren (löschen), oder der Bestand
//            liegt unter der Klinke.
//
// Schiene A: liest nur src/data/ und dist/ — kein git, kein Netz, keine Data.p4k.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPatchSpine, stripSpine, SPINE_ALIAS } from './lib/patch-spine.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));

// Klinken, Messlauf 08.10.2026: 25 Schiffseinträge auf 21 Patch-Seiten, 22
// verknüpfte Fahrzeuge. Nur nach oben verschieben, nach unten nur per Commit
// mit Ursache (Grundsatz 5).
const MIN_PATCH_SHIPS = 25;
const MIN_LINKED = 22;

// Patch-Schiffe ohne Katalog-Treffer, mit Anlass. Schlüssel = stripSpine(name).
const NAMED = {
  'idris': 'Familienname — der Katalog führt die Varianten Idris-M und Idris-P (4.1.0)',
  'apollo': 'Familienname — der Katalog führt die Varianten Apollo Medivac und Apollo Triage (4.3.1)',
  'command module': 'Drake Command Module (4.8.0) — nicht im Katalog; verify:vehicle-gap führt es als offene Einordnung',
};

const errors = [];
const warnings = [];

/* ---------- Bestand ---------- */
const patches = readdirSync(resolve(ROOT, 'src/data/patches'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => rd(`src/data/patches/${f}`));
const vehicles = rd('src/data/vehicles.json').vehicles;
const catalogKeys = new Set(vehicles.map((v) => stripSpine(v.name)));
const spineFor = buildPatchSpine(patches);

/* ---------- 1) Patch-Schiff -> Katalog ---------- */
let patchShips = 0;
const namedHits = new Set();
for (const p of patches) {
  for (const s of p.ships ?? []) {
    patchShips++;
    const k = stripSpine(s.name);
    if (catalogKeys.has(k) || catalogKeys.has(SPINE_ALIAS[k])) continue;
    if (NAMED[k]) { namedHits.add(k); continue; }
    warnings.push(`${p.version}: "${s.name}" steht auf der Patch-Seite, trifft aber keinen Katalogeintrag — Name abgleichen oder Schiff aufnehmen (node scripts/extract-hardpoints.mjs --add <id>)`);
  }
}
for (const k of Object.keys(NAMED)) {
  if (namedHits.has(k)) continue;
  errors.push(`Ausnahme "${k}" greift nicht mehr (Zombie) — trifft inzwischen den Katalog oder steht auf keiner Patch-Seite mehr; Ausnahme löschen`);
}

/* ---------- 2) Verknüpfung -> ausgeliefertes HTML ---------- */
const linked = vehicles.map((v) => ({ id: v.id, versions: spineFor(v.name) })).filter((v) => v.versions.length);
let pagesChecked = 0;
const DIST = resolve(ROOT, 'dist');
if (!existsSync(DIST)) {
  errors.push('dist/ fehlt — erst npm run build, dieses Tor prüft das gebaute Artefakt');
} else {
  for (const v of linked) {
    for (const [prefix, page] of [['', `schiffe/${v.id}.html`], ['/de', `de/schiffe/${v.id}.html`]]) {
      const file = resolve(DIST, page);
      if (!existsSync(file)) { errors.push(`${page} fehlt im Build`); continue; }
      pagesChecked++;
      const html = readFileSync(file, 'utf8');
      for (const ver of v.versions) {
        const href = `${prefix}/patches/sc-${ver.replace(/\./g, '-')}.html`;
        if (!html.includes(`href="${href}"`)) errors.push(`${page}: Verweis auf ${href} fehlt, obwohl die Patch-Seite ${ver} das Schiff nennt`);
      }
    }
  }
}

if (patchShips < MIN_PATCH_SHIPS) errors.push(`nur ${patchShips} Schiffseinträge auf den Patch-Seiten, Klinke ${MIN_PATCH_SHIPS}`);
if (linked.length < MIN_LINKED) errors.push(`nur ${linked.length} verknüpfte Fahrzeuge, Klinke ${MIN_LINKED}`);

/* ---------- Selbstauskunft ---------- */
console.log('\n=== verify:patch-ships — Patch-Seiten, Katalog, Schiffsseiten ===');
console.log('Artefakt: src/data/patches/*.json + src/data/vehicles.json + dist/');
console.log(`Patch-Seiten: ${patches.length}, Schiffseinträge: ${patchShips} (Klinke ${MIN_PATCH_SHIPS})`);
console.log(`  benannte Ausnahmen: ${namedHits.size}, ohne Katalog-Treffer: ${warnings.length}`);
console.log(`Verknüpfte Fahrzeuge: ${linked.length} (Klinke ${MIN_LINKED}), geprüfte Schiffsseiten in dist/: ${pagesChecked}`);
for (const w of warnings) console.log(`WARNUNG: ${w}`);
for (const e of errors) console.error(`FEHLER: ${e}`);
console.log(`\nFEHLER: ${errors.length} | WARNUNGEN: ${warnings.length}`);
process.exit(errors.length ? 1 : 0);
