// Querwege des Schiffsdatenblatts (UX-Audit 24.11.2026, Paket E, Punkt E5).
//
// Prueft die beiden Bausteine, aus denen ShipDetail.astro die neuen Zeilen
// und Links baut, gegen die echten Daten:
//   - src/lib/shipFacts.ts: Mining-Laser stehen als eigene Zeile und zaehlen
//     nicht als Waffen; Gegenmassnahmen-Werfer tragen ihre Namen.
//   - src/lib/shipQuerwege.ts: Fahrzeug-Itemblatt, Wikelo-Belohnung, Auftraege.
// Die Zahlen sind Untergrenzen (Sperrklinken), gemessen am 24.11.2026; ein
// Datenlauf, der einen Join bricht, faellt hier auf statt still Links zu
// verlieren.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

async function bundle(entries) {
  const { buildSync } = await import('esbuild');
  const src = entries.map((e) => `export * from ${JSON.stringify(path.resolve(e))};`).join('\n');
  const out = buildSync({
    stdin: { contents: src, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'schiff-querwege-'));
  const file = path.join(dir, 'mod.mjs');
  fs.writeFileSync(file, out.outputFiles[0].text);
  return import(pathToFileURL(file).href);
}

const M = await bundle(['src/lib/shipFacts.ts', 'src/lib/shipQuerwege.ts', 'src/lib/itemLinks.ts', 'src/lib/wikeloShips.ts']);
const VEHICLES = JSON.parse(fs.readFileSync(path.resolve('src/data/vehicles.json'), 'utf8')).vehicles;
const schiff = (id) => {
  const d = VEHICLES.find((v) => v.id === id);
  assert.ok(d, `Schiff ${id} fehlt in vehicles.json`);
  return d;
};
const zeile = (rows, key) => rows.find((r) => r.key === key);
const stat = (stats, label) => stats.find((s) => s.label === label);

describe('Mining-Laser sind keine Waffen (TF F10/V15)', () => {
  test('Prospector: Laser in eigener Zeile, Pilotenwaffen ohne ihn', () => {
    const rows = M.buildArmament(schiff('misc-prospector'), 'de');
    const pilot = zeile(rows, 'pilot');
    const mining = zeile(rows, 'mining');
    assert.ok(mining, 'keine Mining-Zeile');
    assert.equal(mining.label, 'Mining-Laser');
    assert.deepEqual(mining.lines.map((l) => [l.count, l.size, l.name]), [[1, 1, 'Arbor MH1 Mining Laser']]);
    assert.equal(pilot.meta, '2 Waffen');
    assert.ok(!pilot.lines.some((l) => /mining/i.test(l.name ?? '')), 'Laser steht noch bei den Waffen');
    assert.ok(pilot.lines.every((l) => l.name), 'die Gegenprobe der Waffengroessen geht ohne den Laser nicht mehr auf');
    const stats = M.buildArmStats(schiff('misc-prospector'), 'de');
    assert.equal(stat(stats, 'Waffen-Hardpoints').n, 2);
    assert.equal(stat(stats, 'Mining-Laser').n, 1);
  });

  test('MOLE: der Laser-Turm zieht mit seinen Stationen in die Mining-Zeile', () => {
    const d = schiff('argo-mole');
    const rows = M.buildArmament(d, 'en');
    const mining = zeile(rows, 'mining');
    assert.equal(mining.label, 'Mining lasers');
    assert.match(mining.meta, /^\d+ stations?$/);
    assert.ok(mining.lines.some((l) => /Arbor MH2 Mining Laser/.test(l.name ?? '')));
    assert.ok(!rows.some((r) => r.key === 'turret' && r.lines.some((l) => /mining/i.test(l.name ?? ''))));
    const stats = M.buildArmStats(d, 'en');
    assert.equal(stat(stats, 'Weapon hardpoints').n, 2, 'nur die zwei Badger zaehlen als Waffen');
    assert.ok(stat(stats, 'Mining lasers').n >= 1);
    assert.equal(stat(stats, 'Turret stations'), undefined, 'Laser-Tuerme zaehlen nicht als Turmstationen');
  });

  test('Kampfschiffe bleiben unberuehrt, und kein Laser steht mehr bei den Waffen', () => {
    const g = M.buildArmament(schiff('aegs-gladius'), 'de');
    assert.equal(zeile(g, 'mining'), undefined);
    assert.equal(zeile(g, 'pilot').meta, '3 Waffen');
    let mitLaser = 0;
    for (const d of VEHICLES) {
      const rows = M.buildArmament(d, 'de');
      if (zeile(rows, 'mining')) mitLaser++;
      for (const r of rows) {
        if (r.key === 'mining') continue;
        assert.ok(!r.lines.some((l) => /mining laser/i.test(l.name ?? '')), `${d.id}: Laser in Zeile ${r.key}`);
      }
    }
    assert.ok(mitLaser >= 8, `nur ${mitLaser} Schiffe mit Mining-Zeile (Klinke 8)`);
  });
});

describe('Gegenmassnahmen-Werfer mit Namen (IA C5)', () => {
  test('Gladius nennt Koeder- und Rauschwerfer, beide mit Item-Seite', () => {
    const cm = zeile(M.buildArmament(schiff('aegs-gladius'), 'de'), 'cm');
    const namen = cm.lines.map((l) => l.name).sort();
    assert.deepEqual(namen, ['Aegis Gladius - Decoy Launcher', 'Aegis Gladius - Noise Launcher']);
    for (const l of cm.lines) assert.ok(M.itemForPart(l.name, l.size), `${l.name} ohne Item-Seite`);
  });

  test('ueber alle Schiffe: genug Werfer verlinkbar', () => {
    let zeilen = 0, verlinkt = 0;
    for (const d of VEHICLES) {
      const cm = zeile(M.buildArmament(d, 'en'), 'cm');
      if (!cm) continue;
      for (const l of cm.lines) {
        zeilen++;
        if (M.itemForPart(l.name, l.size)) verlinkt++;
      }
    }
    assert.ok(zeilen >= 300, `nur ${zeilen} Werfer-Zeilen (Klinke 300)`);
    assert.ok(verlinkt >= 280, `nur ${verlinkt} davon mit Item-Seite (Klinke 280)`);
  });
});

describe('Querwege zu Item, Wikelo und Auftrag (D9, IA V6)', () => {
  test('Fahrzeug-Itemblatt: Gladius, und fast jedes Schiff hat eins', () => {
    assert.deepEqual(M.fahrzeugItem('Gladius'), { name: 'Gladius', path: '/items/gladius.html' });
    const mit = VEHICLES.filter((v) => M.fahrzeugItem(v.name)).length;
    assert.ok(mit >= 170, `nur ${mit} Schiffe mit Fahrzeug-Itemblatt (Klinke 170)`);
    assert.equal(M.fahrzeugItem('Gibt es nicht 9000'), null);
  });

  test('jedes Wikelo-Schiff kennt den Namen seiner Belohnung', () => {
    const wk = VEHICLES.filter((v) => M.beiWikelo(v.id));
    assert.ok(wk.length >= 10, `nur ${wk.length} Wikelo-Schiffe`);
    const ohne = wk.filter((v) => !M.wikeloBelohnung(v.id)).map((v) => v.id);
    assert.deepEqual(ohne, []);
  });

  test('Auftraege nur bei gleichem Titel', () => {
    assert.deepEqual(M.schiffsAuftraege('ATLS Orange Line').map((a) => a.slug), ['atls-orange-line']);
    assert.deepEqual(M.schiffsAuftraege('Gladius'), []);
  });
});
