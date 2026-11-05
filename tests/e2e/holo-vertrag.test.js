// Vertrag zwischen der Schiffsseite und dem 3D-Holo.
//
// ANLASS (Gesamtaudit 05.11.2026): ShipDetail.astro ruft am Viewer
// setMasskette() und setHindernis() auf, aber nur hinter einer Abfrage
// (`if (v.setMasskette) …`). Auf live lag seit dem 27.08.2026 noch der
// zurueckgesetzte assets/holo-viewer.js (39ea5b1a), waehrend ShipDetail.astro
// mit jedem Live-Merge auf den staging-Stand kam. Die Abfrage machte aus dem
// fehlenden Gegenstueck kein Fehlerbild, sondern Stille: auf allen
// Schiffsseiten von verse-base.com fehlte die Masskette (Laenge/Hoehe an der
// Silhouette), das Schiff stand klein in der Buehnenmitte, und kein Tor, kein
// Rauchtest und keine Konsole meldete etwas. Gemessen am 05.11.2026: die
// ausgelieferte holo-viewer.js der Live-Seite hat 929 Zeilen und kein
// setMasskette, die von staging 1.712.
//
// Der Test haelt beide Dateien gegeneinander: jede Viewer-Methode, die die
// Seite aufruft (auch hinter einer Abfrage), muss der Viewer liefern. Er liest
// nur Quelltext und laeuft damit auf Schiene A — auf JEDEM Zweig, also auch im
// Dockerfile des Live-Images.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const lies = (p) => readFileSync(resolve(ROOT, p), 'utf8');

/** Methoden des Objekts, das initHolo() zurueckgibt (Kurzschreibweise
 *  `  name(…) {` auf der ersten Ebene des return-Blocks). */
export function viewerMethoden(quelle) {
  const start = quelle.search(/^ {2}return \{$/m);
  if (start < 0) return new Set();
  const rest = quelle.slice(start).split('\n');
  const namen = new Set();
  for (const zeile of rest.slice(1)) {
    if (/^ {2}\};?$/.test(zeile)) break;
    const m = /^ {4}([A-Za-z_$][\w$]*)\s*\(/.exec(zeile);
    if (m) namen.add(m[1]);
  }
  return namen;
}

/** Viewer-Methoden, die die Seite aufruft oder abfragt: `viewer.setX`,
 *  `v.setX`, dazu select/metrics/dispose. Andere Eigenschaften (v.id …)
 *  gehoeren nicht zum Viewer. */
export function seitenAufrufe(quelle) {
  const namen = new Set();
  for (const m of quelle.matchAll(/\b(?:viewer|v)\.(set[A-Z]\w*|select|metrics|dispose)\b/g)) namen.add(m[1]);
  return namen;
}

test('holo-vertrag: der Viewer liefert jede Methode, die die Schiffsseite ruft', () => {
  const viewer = viewerMethoden(lies('assets/holo-viewer.js'));
  const seite = seitenAufrufe(lies('src/components/ShipDetail.astro'));
  // Selbstauskunft und Klinke: ein Leerlauf (Muster passt nicht mehr) darf
  // nicht wie Gruen aussehen.
  assert.ok(viewer.size >= 3, `nur ${viewer.size} Viewer-Methoden erkannt — Muster pruefen`);
  assert.ok(seite.size >= 3, `nur ${seite.size} Aufrufe in ShipDetail.astro erkannt — Muster pruefen`);
  const fehlen = [...seite].filter((n) => !viewer.has(n));
  assert.deepEqual(
    fehlen,
    [],
    `ShipDetail.astro ruft ${fehlen.join(', ')}, assets/holo-viewer.js liefert es nicht. ` +
      'Steht hier ein alter Viewer (Rueckbau 39ea5b1a auf main)? Dann den Viewer von staging uebernehmen.',
  );
});

test('holo-vertrag: die Muster erkennen den Fall vom 05.11.2026', () => {
  // Der Viewer-Stand von main (vor dem Audit): ohne setHindernis und setMasskette.
  const alt = [
    'export async function initHolo(container, cfg) {',
    '  return {',
    '    setFilter(groups) {',
    '    },',
    '    select(i) {',
    '    },',
    '    setLabels(on) {',
    '    },',
    '    dispose() {',
    '    },',
    '  };',
    '}',
  ].join('\n');
  const seite = 'if (v.setHindernis && x) v.setHindernis(p); if (v.setMasskette) v.setMasskette(m); viewer.setFilter([g]);';
  const fehlen = [...seitenAufrufe(seite)].filter((n) => !viewerMethoden(alt).has(n));
  assert.deepEqual(fehlen.sort(), ['setHindernis', 'setMasskette']);
});
