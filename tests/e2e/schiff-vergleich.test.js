// Schiffsvergleich auf der Schiffsliste (UX-Audit 24.11.2026, Paket E, E7;
// Befund TF B08: live gab es keinen Vergleich).
//
// Zwei Teile:
//   - assets/schiff-vergleich.js: Auswahl in der Adresse, Markieren mit
//     Obergrenze, Basis, Abweichung und Zeilen ohne Wert. Der Controller hat
//     beim Import keine Seiteneffekte, die reinen Funktionen laufen in node.
//   - src/lib/shipVergleich.ts gegen die echten Daten: jedes Schiff, jede
//     Zahlenzeile aus dem einen Kennwert-Verzeichnis (keine zweite Liste),
//     Mining-Laser getrennt wie im Datenblatt, kein Turm faellt heraus.
// Die Zahlen sind Untergrenzen (Sperrklinken), gemessen am 24.11.2026.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  MAX_COMPARE, leseVergleich, schreibeVergleich, umschalten, alsBasis, figureText, compareCell, zeileHatWert, teilKopf,
} from '../../assets/schiff-vergleich.js';

async function bundle(entries) {
  const { buildSync } = await import('esbuild');
  const src = entries.map((e) => `export * from ${JSON.stringify(path.resolve(e))};`).join('\n');
  const out = buildSync({
    stdin: { contents: src, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'schiff-vergleich-'));
  const file = path.join(dir, 'mod.mjs');
  fs.writeFileSync(file, out.outputFiles[0].text);
  return import(pathToFileURL(file).href);
}

describe('Vergleich: Auswahl und Adresse', () => {
  const ids = new Set(['aegs-gladius', 'anvl-arrow', 'drak-cutlass-black', 'misc-prospector']);

  test('cmp aus der Adresse: nur bekannte, ohne Doppel, hoechstens drei; offen erst ab zwei', () => {
    assert.equal(MAX_COMPARE, 3);
    assert.deepEqual(leseVergleich('?cmp=aegs-gladius,anvl-arrow&view=compare', ids), { cmp: ['aegs-gladius', 'anvl-arrow'], offen: true });
    assert.deepEqual(leseVergleich('?cmp=aegs-gladius,gibts-nicht,aegs-gladius', ids), { cmp: ['aegs-gladius'], offen: false });
    assert.deepEqual(leseVergleich('?cmp=aegs-gladius&view=compare', ids), { cmp: ['aegs-gladius'], offen: false });
    assert.deepEqual(leseVergleich('?cmp=aegs-gladius,anvl-arrow,drak-cutlass-black,misc-prospector', ids).cmp.length, 3);
    assert.deepEqual(leseVergleich('', ids), { cmp: [], offen: false });
  });

  test('schreiben laesst die Filter der Liste stehen und raeumt leer auf', () => {
    assert.equal(schreibeVergleich('?maker=Anvil', ['a', 'b'], true), '?maker=Anvil&cmp=a%2Cb&view=compare');
    assert.equal(schreibeVergleich('?maker=Anvil&cmp=a%2Cb&view=compare', ['a'], true), '?maker=Anvil&cmp=a');
    assert.equal(schreibeVergleich('?cmp=a&view=compare', [], false), '');
    assert.equal(schreibeVergleich('?sort=game-asc&cmp=a%2Cb&view=compare', ['a', 'b'], false), '?sort=game-asc&cmp=a%2Cb');
    // Hin und zurueck ergibt dieselbe Auswahl.
    const ids2 = new Set(['a', 'b']);
    assert.deepEqual(leseVergleich(schreibeVergleich('?q=x', ['b', 'a'], true), ids2), { cmp: ['b', 'a'], offen: true });
  });

  test('markieren bis drei, dann voll; Basis rueckt nach vorn', () => {
    assert.deepEqual(umschalten([], 'a'), { cmp: ['a'], voll: false });
    assert.deepEqual(umschalten(['a', 'b'], 'a'), { cmp: ['b'], voll: false });
    assert.deepEqual(umschalten(['a', 'b', 'c'], 'd'), { cmp: ['a', 'b', 'c'], voll: true });
    assert.deepEqual(umschalten(['a', 'b', 'c'], 'b'), { cmp: ['a', 'c'], voll: false });
    assert.deepEqual(alsBasis(['a', 'b', 'c'], 'c'), ['c', 'a', 'b']);
    assert.deepEqual(alsBasis(['a', 'b'], 'x'), ['a', 'b']);
  });
});

describe('Vergleich: Werte und Abweichung', () => {
  test('Zahl mit Einheit und Genauigkeit der Zeile, unbekannt ist der Strich', () => {
    assert.equal(figureText(29760, { digits: 0, unit: 'HP' }, 'de-DE'), '29.760 HP');
    assert.equal(figureText(1944.54, { digits: 1, unit: 'DPS' }, 'en-US'), '1,944.5 DPS');
    assert.equal(figureText(1, { digits: 0, unit: '' }, 'de-DE'), '1');
    assert.equal(figureText(null, { digits: 0, unit: 'm' }, 'de-DE'), '–');
    assert.equal(figureText(0, { digits: 0, unit: 'SCU' }, 'de-DE'), '0 SCU', 'eine echte 0 bleibt 0');
  });

  test('Abweichung nach der Richtung von "besser"', () => {
    const speed = { digits: 0, unit: 'm/s', better: 1 };
    assert.deepEqual(compareCell(1150, 1193, speed, 'en-US'), { value: '1,150 m/s', delta: '-43 m/s', tone: 'down' });
    assert.deepEqual(compareCell(2010960, 2262330, { digits: 0, unit: 'aUEC', better: -1 }, 'en-US'), { value: '2,010,960 aUEC', delta: '-251,370 aUEC', tone: 'up' });
    assert.deepEqual(compareCell(37.5, 21, { digits: 1, unit: 'm', better: 0 }, 'de-DE'), { value: '37,5 m', delta: '+16,5 m', tone: 'flat' });
    assert.deepEqual(compareCell(5, 5, speed, 'de-DE'), { value: '5 m/s', delta: null, tone: null });
    assert.deepEqual(compareCell(5, null, speed, 'de-DE'), { value: '5 m/s', delta: null, tone: null }, 'Basis selbst ohne Abweichung');
    assert.deepEqual(compareCell(null, 5, speed, 'de-DE'), { value: '–', delta: null, tone: null });
  });

  test('Zeilen ohne jeden Wert fallen weg, Teile lesen sich wie im Datenblatt', () => {
    const a = { text: { role: 'Leichter Jäger' }, zahl: { scm: 226, cargo: 0 }, teile: { pilot: [[2, 'S3', 'X']] } };
    const b = { text: {}, zahl: { scm: 200 }, teile: {} };
    assert.equal(zeileHatWert({ art: 'text', key: 'role' }, [a, b]), true);
    assert.equal(zeileHatWert({ art: 'text', key: 'size' }, [a, b]), false);
    assert.equal(zeileHatWert({ art: 'zahl', key: 'cargo' }, [a, b]), true, 'Fracht 0 ist ein Wert');
    assert.equal(zeileHatWert({ art: 'zahl', key: 'tdps' }, [a, b]), false);
    assert.equal(zeileHatWert({ art: 'teile', key: 'mining' }, [a, b]), false);
    assert.equal(teilKopf([2, 'S3', 'CF-337 Panther Repeater']), '2× S3');
    assert.equal(teilKopf([1, '', 'Ohne Groesse']), '1×');
    assert.equal(teilKopf([0, '', 'Notiz']), '');
  });
});

describe('Vergleich: Daten aus dem einen Kennwert-Verzeichnis', async () => {
  const M = await bundle(['src/lib/shipVergleich.ts', 'src/lib/hangar/bay.ts', 'src/lib/hangar/catalog.ts', 'src/lib/shipFacts.ts']);
  const raw = JSON.parse(fs.readFileSync(path.resolve('src/data/vehicles.json'), 'utf8')).vehicles;
  // Die Schema-Vorgaben des Inhaltsschemas, wie catalog.ts sie nachtraegt.
  const entries = raw.map((v) => ({
    id: v.id,
    data: { roleEn: null, roleDe: null, sizeClass: null, descriptionEn: null, crewMax: null, msrpUSD: null,
      fixedWeaponMounts: [], fixedWeaponSizes: [], turretWeapons: [], pledgeUrl: null, image: null, massKg: null, ...v },
  }));
  const de = M.vergleichJson(entries, 'de');
  const en = M.vergleichJson(entries, 'en');

  test('jedes Schiff in beiden Sprachen, mit Kopf und Weg zum Datenblatt', () => {
    assert.ok(Object.keys(de.schiffe).length >= 230, `nur ${Object.keys(de.schiffe).length} Schiffe (Klinke 230)`);
    assert.deepEqual(Object.keys(en.schiffe), Object.keys(de.schiffe));
    assert.equal(de.schiffe['aegs-gladius'].href, '/de/schiffe/aegs-gladius.html');
    assert.equal(en.schiffe['aegs-gladius'].href, '/schiffe/aegs-gladius.html');
    for (const [id, s] of Object.entries(de.schiffe)) assert.ok(s.name && s.href.endsWith(`/${id}.html`), id);
  });

  test('Abschnitte und Zahlenzeilen sind genau die des Hangar-Vergleichs (COMPARE, STATS)', () => {
    assert.deepEqual(de.abschnitte.map((a) => a.key), M.COMPARE.map((c) => c.key));
    for (const sec of M.COMPARE) {
      const a = de.abschnitte.find((x) => x.key === sec.key);
      assert.deepEqual(a.zeilen.filter((z) => z.art === 'zahl').map((z) => z.key), [...sec.stats], sec.key);
      for (const z of a.zeilen.filter((x) => x.art === 'zahl')) {
        const s = M.STAT[z.key];
        assert.deepEqual([z.unit, z.digits, z.better], [s.unit, s.digits, s.better], z.key);
      }
      for (const g of sec.groups) assert.ok(a.zeilen.some((z) => z.art === 'teile' && z.key === g), `${sec.key}: Gruppe ${g} fehlt`);
    }
    const labels = de.abschnitte.flatMap((a) => a.zeilen.map((z) => z.label));
    assert.ok(labels.every(Boolean), 'Zeile ohne Beschriftung');
    assert.notDeepEqual(labels, en.abschnitte.flatMap((a) => a.zeilen.map((z) => z.label)), 'EN gleich DE');
  });

  test('Gladius: Zahlen wie im Verzeichnis gerundet, Teile wie im Datenblatt', () => {
    const g = de.schiffe['aegs-gladius'];
    assert.equal(g.zahl.len, 21);
    assert.equal(g.zahl.scm, 226);
    assert.equal(g.zahl.dps, 1944.5);
    assert.equal(g.zahl.cargo, 0, 'Fracht 0 bleibt stehen');
    assert.equal(g.zahl.tdps, undefined, 'unbekannt faellt weg');
    assert.equal(g.text.role, 'Leichter Jäger');
    assert.deepEqual(g.teile.pilot, [[1, 'S3', 'Mantis GT-220 Gatling'], [2, 'S3', 'CF-337 Panther Repeater']]);
    assert.ok(g.teile.cm.some((t) => /Decoy Launcher/.test(t[2])));
    assert.ok(g.teile.power?.length && g.teile.shield?.length);
  });

  test('Mining-Laser in eigener Gruppe, nie bei den Pilotenwaffen', () => {
    const p = de.schiffe['misc-prospector'];
    assert.deepEqual(p.teile.mining, [[1, 'S1', 'Arbor MH1 Mining Laser']]);
    assert.ok(!p.teile.pilot.some((t) => /mining/i.test(t[2])));
    const mole = en.schiffe['argo-mole'];
    assert.ok(mole.teile.mining?.length, 'MOLE ohne Mining-Gruppe');
    assert.equal(mole.teile.manned, undefined, 'Laser-Tuerme stehen nicht bei den Tuermen');
    let mit = 0;
    for (const s of Object.values(de.schiffe)) {
      if (s.teile.mining) mit++;
      for (const [g, list] of Object.entries(s.teile)) {
        if (g === 'mining') continue;
        assert.ok(!list.some((t) => /mining laser/i.test(t[2])), `${s.name}: Laser in ${g}`);
      }
    }
    assert.ok(mit >= 8, `nur ${mit} Schiffe mit Mining-Gruppe (Klinke 8)`);
  });

  test('ohne saubere Zuordnung: Groessenzeilen bleiben, die Namensnotiz kommt dazu (wie im Datenblatt)', () => {
    let gesehen = 0;
    for (const e of entries) {
      for (const r of M.buildArmament(e.data, 'de')) {
        if (r.key !== 'pilot' || !r.note || !r.lines.length) continue;
        const list = de.schiffe[e.id].teile.pilot;
        assert.equal(list.length, r.lines.length + 1, `${e.id}: ${list.length} statt ${r.lines.length}+1 Zeilen`);
        assert.ok(list.slice(0, -1).every((t) => t[0] > 0 && t[1]), `${e.id}: Groessenzeile ohne Anzahl oder Groesse`);
        assert.deepEqual(list.at(-1), [0, '', r.note], `${e.id}: Notiz fehlt am Ende`);
        gesehen++;
      }
    }
    assert.ok(gesehen >= 1, 'kein Schiff mit Namensnotiz gefunden (Probe leer)');
    console.log(`  Pilotenwaffen mit Namensnotiz: ${gesehen} Schiffe`);
  });

  test('kein Turm faellt heraus: jede Turmzeile des Datenblatts landet in einer Gruppe', () => {
    let tuerme = 0;
    for (const e of entries) {
      const zeilen = M.buildArmament(e.data, 'en').filter((r) => r.key === 'turret');
      const erwartet = zeilen.reduce((n, r) => n + r.lines.length + (r.note ? 1 : 0), 0);
      const s = en.schiffe[e.id];
      const da = ['manned', 'remote', 'pdc'].reduce((n, g) => n + (s.teile[g]?.length ?? 0), 0);
      assert.equal(da, erwartet, `${e.id}: ${da} von ${erwartet} Turmzeilen im Vergleich`);
      tuerme += zeilen.length;
    }
    assert.ok(tuerme >= 100, `nur ${tuerme} Turmzeilen geprueft (Klinke 100)`);
  });
});
