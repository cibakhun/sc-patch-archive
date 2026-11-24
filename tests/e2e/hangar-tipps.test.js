// Die Hinweise der Ersten Schritte im Hangar (assets/hangar-overview.js:
// tipps, legen, hinweisPlatz). Anlass: Sichturteile am Stand 6e984ac8
// (24.11.2026) fanden den ersten Hinweis „1/3“ neben der Schiffsauswahl über
// dem Anfang langer Namen im Hologramm (1600 × 900), über Stern, Vergleich,
// Link und dem Kopf der Ausrüstung (1280 × 720) und über dem Namen der
// Carrack (820 × 900); der zweite deckte bei 1600 × 900 die Ecke der
// Werte-Tafel. Seitdem rückt ein Hinweis entlang seines Knopfs, bis er keine
// Knöpfe der Seite deckt und, wenn es geht, nichts von der Bühne; was dann
// noch darunter läge, weicht ihm.
// Maße unten aus den Aufnahmen dieser Größen (px des Fensters).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hinweisPlatz } from '../../assets/hangar-overview.js';

// Hinweis rechts neben der Leiste der Schiffsauswahl (y 80 bis 300), x fest
const rechts = (x, w, h) => (t) => ({ l: x, t, r: x + w, b: t + h });
// Hinweis über einem Knopf unten, y fest
const oben = (t, w, h) => (l) => ({ l, t, r: l + w, b: t + h });

describe('hinweisPlatz', () => {
  test('1280 × 720: weg von Stern, Vergleich und Link, so nah an der Mitte wie möglich', () => {
    const r = hinweisPlatz({
      lo: 12, hi: 274, mitte: 120, rect: rechts(119, 315, 140),
      hart: [{ l: 115, t: 90, r: 275, b: 125 }],
      weich: [{ l: 120, t: 225, r: 500, b: 590 }],
    });
    assert.equal(r.hart, 0);
    assert.ok(r.p >= 133 && r.p <= 140, `Lage ${r.p}`);
    // Kopf der Ausrüstung bleibt gedeckt: Den Rest räumt die Bühne (setSafe)
    assert.ok(r.weich > 0);
  });

  test('1600 × 900: keine Lage ohne den Namen, dann die nächste zur Mitte ohne Knöpfe', () => {
    const r = hinweisPlatz({
      lo: 12, hi: 274, mitte: 120, rect: rechts(119, 315, 140),
      hart: [{ l: 115, t: 90, r: 260, b: 125 }],
      weich: [{ l: 425, t: 110, r: 1185, b: 300 }, { l: 120, t: 475, r: 520, b: 830 }],
    });
    assert.deepEqual([r.p, r.hart], [136, 0]);
  });

  test('1600 × 900, zweiter Hinweis: rückt links neben die Werte-Tafel', () => {
    const r = hinweisPlatz({
      lo: 711, hi: 1104, mitte: 908, rect: oben(659, 330, 160),
      hart: [{ l: 640, t: 833, r: 1133, b: 883 }],
      weich: [{ l: 1210, t: 455, r: 1590, b: 765 }, { l: 120, t: 290, r: 520, b: 790 }],
    });
    assert.deepEqual([r.hart, r.weich], [0, 0]);
    assert.ok(r.p >= 860 && r.p <= 872, `Lage ${r.p}`);
  });

  test('frei in der Mitte: bleibt mittig', () => {
    const r = hinweisPlatz({ lo: 500, hi: 900, mitte: 665, rect: oben(659, 330, 160), hart: [], weich: [{ l: 1210, t: 455, r: 1590, b: 765 }] });
    assert.deepEqual(r, { p: 665, hart: 0, weich: 0 });
  });

  test('kein Platz ohne Knopf: die Lage, die am wenigsten davon deckt', () => {
    const r = hinweisPlatz({ lo: 0, hi: 100, mitte: 50, rect: rechts(0, 100, 100), hart: [{ l: 0, t: 0, r: 100, b: 60 }], weich: [] });
    // 8 px Luft unter dem Knopf, sonst so nah an der Mitte wie möglich
    assert.deepEqual([r.p, r.hart], [68, 0]);
    const s = hinweisPlatz({ lo: 0, hi: 20, mitte: 10, rect: rechts(0, 100, 100), hart: [{ l: 0, t: 0, r: 100, b: 200 }], weich: [] });
    assert.ok(s.hart > 0 && s.p >= 0 && s.p <= 20);
  });
});

describe('Verdrahtung', () => {
  const seite = readFileSync(new URL('../../assets/hangar-overview.js', import.meta.url), 'utf8');
  const viewer = readFileSync(new URL('../../assets/hangar-viewer.js', import.meta.url), 'utf8');
  const tafeln = readFileSync(new URL('../../assets/hangar-holo3d.js', import.meta.url), 'utf8');

  test('legen fragt hinweisPlatz mit Knöpfen der Seite und Teilen der Bühne, einmal je Lage', () => {
    assert.match(seite, /hinweisPlatz\(\{ lo: [^}]*rect, hart, weich \}\)/);
    assert.match(seite, /halter\.v\.bildTeile\?\.\(\)/);
    assert.match(seite, /if \(lage === gelegt\) return true;/);
    // Knöpfe der Seite gehören zur Lage (kommt die Ablage, legt er sich neu), Teile der Bühne nicht
    assert.match(seite, /const lage = \[[^\]]*\.\.\.hart\.flatMap\(\(q\) => \[q\.l, q\.t, q\.r, q\.b\]\)\]/);
    assert.doesNotMatch(seite, /const lage = \[[^\n]*weich/);
    assert.match(seite, /stageSafe\?\.\(\);\s*return true;\s*\};/);
  });

  test('oben zählt der stehende Hinweis in setSafe wie ein Knopf, unten nicht', () => {
    assert.match(seite, /tipp = \$\('hgx-tipp'\), keep = \[[^\]]*, tipp\]/);
    assert.match(seite, /if \(el === tipp && tipp\.dataset\.platz !== 'ja'\) return null;/);
    assert.match(seite, /<= c\.height \* 0\.45\) box\.dataset\.platz = 'ja';\s*else delete box\.dataset\.platz;/);
  });

  test('die Bühne nennt Name und Tafeln', () => {
    assert.match(viewer, /bildTeile\(\) \{ const n = holo\.rect\(\); return \[\.\.\.\(n \? \[\{ \.\.\.n \}\] : \[\]\), \.\.\.\(stLayer\?\.rects\?\.\(\) \?\? \[\]\)\]; \}/);
    assert.match(tafeln, /rects\(\) \{ return built \? built\.panels\.filter\(\(P\) => P\.group\.visible && P\.rect\)/);
  });
});
