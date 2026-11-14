// Quellen einer Halle (scripts/lib/hall-quellen.mjs): welche Datei im
// Rohordner eine Halle ist, und wann ein gebautes Modell noch frisch ist.
// Anlass: CodeRabbit an PR #371, 14.11.2026. Der Bau der Hallen läuft nur
// dort, wo die Spieldateien liegen; dieser Test prüft seine beiden Fragen an
// den Ordner ohne sie, und dass der Build sie wirklich stellt.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { istHallenModell, HALL_BEILAGEN_GLB, NEBEN_EINGABEN, HALL_EINGABEN, juengerAls } from '../../scripts/lib/hall-quellen.mjs';

// Der Rohordner, wie der Extraktor ihn für die Large-Halle hinterlässt
const ORDNER = [
  'revelyork-single.glb', 'revelyork-single-lod1.glb', 'revelyork-single.info.json', 'revelyork-single.lights-src.txt',
  'util-lrgtop.glb', 'util-lrgtop.decals.glb', 'util-lrgtop.decals.json', 'util-lrgtop.schrift.glb',
  'util-lrgtop.info.json', 'util-lrgtop.lights-src.txt', 'util-lrgtop.entities.json', 'UTIL-XLTOP.GLB', 'util-xltop.DECALS.GLB',
];

describe('Quellen einer Halle', () => {
  test('nur die Modelle sind Hallen, die Beilagen des Extraktors nicht', () => {
    assert.deepEqual(ORDNER.filter(istHallenModell), ['revelyork-single.glb', 'revelyork-single-lod1.glb', 'util-lrgtop.glb', 'UTIL-XLTOP.GLB']);
    for (const b of HALL_BEILAGEN_GLB) assert.equal(istHallenModell(`util-lrgtop.${b}.glb`), false, `${b}.glb ist eine Beilage`);
    // nur die Endung zählt: Eine Halle darf das Wort im Namen tragen
    assert.equal(istHallenModell('schrift-halle.glb'), true);
    assert.equal(istHallenModell('decals.glb'), true);
  });

  test('jede Beilage, die der Build mitliest, zählt als Eingabe der Halle', () => {
    for (const x of ['info.json', 'decals.glb', 'schrift.glb']) assert.ok(HALL_EINGABEN.includes(x), `${x} fehlt unter den Eingaben`);
    for (const x of NEBEN_EINGABEN) assert.ok(HALL_EINGABEN.includes(x), `${x} gilt für die Halle nicht mehr`);
    assert.equal(new Set(HALL_EINGABEN).size, HALL_EINGABEN.length);
    // Aufzug und Werkhalle haben diese Beilagen nicht
    for (const x of ['info.json', 'decals.glb', 'schrift.glb']) assert.equal(NEBEN_EINGABEN.includes(x), false);
  });

  test('frisch ist nur, was da ist und jünger als jede vorhandene Eingabe', () => {
    const t = { 'halle.glb': 100, 'halle.decals.glb': 90, 'halle.info.json': 95, 'out.glb': 200, 'out.aufzug.json': 201 };
    const zeit = (p) => t[p] ?? null;
    const ein = ['halle.glb', 'halle.decals.glb', 'halle.info.json', 'halle.schrift.glb'];
    assert.equal(juengerAls(['out.glb', 'out.aufzug.json'], ein, zeit), true, 'eine fehlende Eingabe zählt nicht');
    assert.equal(juengerAls(['out.glb', 'gibt-es-nicht.json'], ein, zeit), false, 'eine fehlende Ausgabe ist nie frisch');
    t['halle.decals.glb'] = 300;
    assert.equal(juengerAls(['out.glb', 'out.aufzug.json'], ein, zeit), false, 'neue Aufkleber allein machen die Halle alt');
    t['halle.decals.glb'] = 200;
    assert.equal(juengerAls(['out.glb'], ein, zeit), false, 'gleich alt ist nicht jünger');
    assert.equal(juengerAls([], ein, zeit), true);
  });

  test('der Build fragt beides: Modelle über istHallenModell, Frische über die Eingaben der Halle und die Bahnen des Aufzugs', () => {
    const bau = readFileSync(new URL('../../scripts/build-hangar-assets.mjs', import.meta.url), 'utf8');
    assert.match(bau, /readdirSync\(dir\)\.filter\(\(x\) => \(kind === 'hall' \? istHallenModell\(x\) : x\.toLowerCase\(\)\.endsWith\('\.glb'\)\)\)/, 'die Schleife der Hallen nimmt wieder jede .glb');
    assert.match(bau, /\(kind === 'hall' \? HALL_EINGABEN : NEBEN_EINGABEN\)\.map\(\(x\) => fileURLToPath\(new URL\(`\$\{name\}\.\$\{x\}`, dir\)\)\)/, 'die Beilagen der Halle zählen nicht mehr als Eingaben');
    assert.match(bau, /const aufzugOut = kind === 'hall' && prev\[slot\]\?\.\[name\]\?\.aufzug\?\.json \? fileURLToPath\(new URL\(`hall\/\$\{name\}\.aufzug\.json`, OUT\)\) : null;/, 'die Liste der Aufzugsbahnen zählt nicht mehr zum Bau');
    assert.match(bau, /&& \(!aufzugOut \|\| juengerAls\(\[aufzugOut\], \[inPath, \.\.\.side\], zeit\)\)/, 'eine fehlende oder alte Liste der Aufzugsbahnen löst keinen Bau mehr aus');
  });
});
