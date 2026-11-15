// Quellen einer Halle (scripts/lib/hall-quellen.mjs): welche Datei im
// Rohordner eine Halle ist, und wann ein gebautes Modell noch frisch ist.
// Anlass: CodeRabbit an PR #371, 14.11.2026. Der Bau der Hallen läuft nur
// dort, wo die Spieldateien liegen; dieser Test prüft seine beiden Fragen an
// den Ordner ohne sie, und dass der Build sie wirklich stellt.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { istHallenModell, HALL_BEILAGEN_GLB, NEBEN_EINGABEN, HALL_EINGABEN, juengerAls, hallBestand, eingabenVorher, bestandPasst } from '../../scripts/lib/hall-quellen.mjs';

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
    for (const x of ['info.json', 'ruhe.json', 'decals.glb', 'schrift.glb']) assert.ok(HALL_EINGABEN.includes(x), `${x} fehlt unter den Eingaben`);
    for (const x of NEBEN_EINGABEN) assert.ok(HALL_EINGABEN.includes(x), `${x} gilt für die Halle nicht mehr`);
    assert.equal(new Set(HALL_EINGABEN).size, HALL_EINGABEN.length);
    // Aufzug und Werkhalle haben diese Beilagen nicht
    for (const x of ['info.json', 'ruhe.json', 'decals.glb', 'schrift.glb']) assert.equal(NEBEN_EINGABEN.includes(x), false);
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

  test('eine gelöschte Beilage macht die Halle alt, auch wenn alle Änderungszeiten „frisch“ sagen', () => {
    // der Ordner der Large-Halle beim letzten Bau, wie hallBestand ihn sieht
    const da = new Set(['lights-src.txt', 'matfix.json', 'layers.json', 'tor.json', 'info.json', 'decals.glb', 'schrift.glb']);
    const damals = hallBestand((x) => da.has(x));
    assert.deepEqual(damals, ['lights-src.txt', 'matfix.json', 'layers.json', 'tor.json', 'info.json', 'decals.glb', 'schrift.glb'], 'in der Reihenfolge von HALL_EINGABEN, ohne entities.json');
    const neu = { eingaben: damals }, alt = { aufkleber: { netze: 148 }, schriftVoll: { teilnetze: 5 } };
    assert.equal(bestandPasst(neu, damals), true);
    assert.equal(bestandPasst(alt, damals), true);
    // die Aufkleber werden gelöscht: Die Zeiten der übrigen Dateien ändern sich nicht
    da.delete('decals.glb');
    const heute = hallBestand((x) => da.has(x));
    assert.equal(juengerAls(['out.glb'], heute.map((x) => `halle.${x}`), (p) => (p === 'out.glb' ? 200 : 100)), true, 'die Zeiten allein sagen frisch');
    assert.equal(bestandPasst(neu, heute), false, 'Eintrag mit genauer Liste');
    assert.equal(bestandPasst(alt, heute), false, 'älterer Eintrag: Das Manifest nennt Aufkleber, also gab es die Datei');
    // eine Beilage kommt dazu (aus einer Sicherung, mit alter Änderungszeit): nur die genaue Liste merkt es
    da.add('decals.glb'); da.add('entities.json');
    const mehr = hallBestand((x) => da.has(x));
    assert.equal(bestandPasst(neu, mehr), false);
    assert.equal(bestandPasst(alt, mehr), true, 'ein älterer Eintrag weiß nicht, was sonst da war');
  });

  test('was der letzte Bau gelesen hat: die eigene Liste, sonst nur, was das Manifest beweist', () => {
    assert.deepEqual(eingabenVorher({ eingaben: ['info.json'] , aufkleber: {} }), { genau: true, liste: ['info.json'] });
    assert.deepEqual(eingabenVorher({ aufkleber: { netze: 1 } }), { genau: false, liste: ['decals.glb'] });
    assert.deepEqual(eingabenVorher({ schriftVoll: { teilnetze: 5 }, aufkleber: { netze: 1 } }), { genau: false, liste: ['decals.glb', 'schrift.glb'] });
    assert.deepEqual(eingabenVorher({ bytes: 1 }), { genau: false, liste: [] });
    assert.deepEqual(eingabenVorher(undefined), { genau: false, liste: [] });
    // eine Halle ohne Beilagen (die gestreckte) bleibt frisch, ein erster Bau ohne Eintrag wird hier nicht aufgehalten
    assert.equal(bestandPasst({ bytes: 1 }, ['lights-src.txt', 'matfix.json']), true);
    assert.equal(bestandPasst(undefined, []), true);
    assert.equal(bestandPasst({ eingaben: [] }, []), true);
  });

  test('der Eintrag der Large-Halle im Manifest beweist ihre Beilagen', () => {
    const m = JSON.parse(readFileSync(new URL('../../src/data/hangar-assets.json', import.meta.url), 'utf8')).hall['util-lrgtop'];
    const v = eingabenVorher(m);
    for (const x of ['decals.glb', 'schrift.glb']) assert.ok(v.liste.includes(x), `der Eintrag nennt ${x} weder selbst noch mittelbar: Eine gelöschte Datei fiele nicht auf`);
  });

  test('der Build fragt alles: Modelle über istHallenModell, Frische über Eingaben, Bahnen des Aufzugs und Bestand der Beilagen', () => {
    const bau = readFileSync(new URL('../../scripts/build-hangar-assets.mjs', import.meta.url), 'utf8');
    assert.match(bau, /readdirSync\(dir\)\.filter\(\(x\) => \(kind === 'hall' \? istHallenModell\(x\) : x\.toLowerCase\(\)\.endsWith\('\.glb'\)\)\)/, 'die Schleife der Hallen nimmt wieder jede .glb');
    assert.match(bau, /\(kind === 'hall' \? HALL_EINGABEN : NEBEN_EINGABEN\)\.map\(\(x\) => fileURLToPath\(new URL\(`\$\{name\}\.\$\{x\}`, dir\)\)\)/, 'die Beilagen der Halle zählen nicht mehr als Eingaben');
    assert.match(bau, /const aufzugOut = kind === 'hall' && prev\[slot\]\?\.\[name\]\?\.aufzug\?\.json \? fileURLToPath\(new URL\(`hall\/\$\{name\}\.aufzug\.json`, OUT\)\) : null;/, 'die Liste der Aufzugsbahnen zählt nicht mehr zum Bau');
    assert.match(bau, /&& \(!aufzugOut \|\| juengerAls\(\[aufzugOut\], \[inPath, \.\.\.side\], zeit\)\)/, 'eine fehlende oder alte Liste der Aufzugsbahnen löst keinen Bau mehr aus');
    assert.match(bau, /const bestand = kind === 'hall' \? hallBestand\(\(x\) => existsSync\(fileURLToPath\(new URL\(`\$\{name\}\.\$\{x\}`, dir\)\)\)\) : null;/, 'der Build sieht nicht mehr nach, welche Beilagen da sind');
    assert.match(bau, /&& \(!bestand \|\| bestandPasst\(prev\[slot\]\?\.\[name\], bestand\)\)/, 'eine gelöschte Beilage löst keinen Bau mehr aus');
    assert.match(bau, /if \(bestand\) r\.eingaben = bestand;/, 'der Bau notiert nicht mehr, was er neben dem Modell gelesen hat');
  });
});
