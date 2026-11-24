// Hersteller der Rüstungs-Sets (Heuristik-Befund P85): Kurzformen aus dem
// Set-Tag und „Unknown" am Item duerfen keine eigenen Gruppen bilden.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { setHersteller, SET_HERSTELLER } from '../../scripts/lib/armor-sets.mjs';

test('Kurzformen aus dem Set-Tag werden zum Anzeigenamen', () => {
  assert.strictEqual(setHersteller('CCsConversions'), "CC's Conversions");
  assert.strictEqual(setHersteller('RSI'), 'Roberts Space Industries');
  assert.strictEqual(setHersteller(' Clark Defense Systems '), 'Clark Defense Systems');
});

test('„Unknown“ und leere Werte sind kein Hersteller', () => {
  for (const x of ['Unknown', 'unknown', '', '  ', null, undefined]) assert.strictEqual(setHersteller(x), null, String(x));
});

test('Im Datenstand traegt nach der Regel kein Hersteller zwei Namen', () => {
  const db = JSON.parse(readFileSync('assets/universal-items.json', 'utf8'));
  const namen = new Set(db.sets.map((s) => setHersteller(s.manufacturer)).filter(Boolean));
  for (const kurz of Object.keys(SET_HERSTELLER)) assert.ok(!namen.has(kurz), `${kurz} steht noch als eigener Hersteller`);
  // Gleicher Name bis auf Satzzeichen und Leerraum = derselbe Hersteller.
  const schluessel = new Map();
  for (const n of namen) {
    const k = n.toLowerCase().replace(/[^a-z0-9]/g, '');
    assert.ok(!schluessel.has(k), `${n} und ${schluessel.get(k)} sind derselbe Hersteller`);
    schluessel.set(k, n);
  }
});

test('„Unknown“ am Item versperrt den Hersteller aus dem Set-Tag nicht', async () => {
  const { resolveArmorSets } = await import('../../scripts/lib/armor-sets.mjs');
  const teil = (name, gameType, manufacturer) => ({
    key: name, name, gameType, file: 'ohne_stamm', manufacturer,
    tagPaths: ['Armor.FPS.Set.RSI.Beispiel'],
  });
  const nurUnknown = resolveArmorSets([teil('Beispiel Helmet', 'Char_Armor_Helmet', 'Unknown'), teil('Beispiel Arms', 'Char_Armor_Arms', 'Unknown')], new Map());
  assert.strictEqual(nurUnknown.sets.length, 1);
  assert.strictEqual(nurUnknown.sets[0].manufacturer, 'Roberts Space Industries');
  // Ein echter Hersteller am Item behaelt den Vorrang vor dem Tag.
  const gemischt = resolveArmorSets([teil('Beispiel Helmet', 'Char_Armor_Helmet', 'Clark Defense Systems'), teil('Beispiel Arms', 'Char_Armor_Arms', 'Unknown'), teil('Beispiel Legs', 'Char_Armor_Legs', 'Unknown')], new Map());
  assert.strictEqual(gemischt.sets[0].manufacturer, 'Clark Defense Systems');
});

test('Rueckfall nimmt den Tag des eigenen Clusters, nicht den haeufigsten der Gruppe', async () => {
  const { resolveArmorSets } = await import('../../scripts/lib/armor-sets.mjs');
  // Ein Dateistamm (beispiel_helmet_01 …), zwei Namen mit eigenen Tags, alle „Unknown“.
  const teil = (name, slot, nr, tag) => ({
    key: name, name, gameType: 'Char_Armor_' + slot, file: `beispiel_${slot.toLowerCase()}_01_0${nr}`, manufacturer: 'Unknown',
    tagPaths: [tag],
  });
  const r = resolveArmorSets([
    teil('Alpha Helmet', 'Helmet', 1, 'Armor.FPS.Set.RSI.Alpha'),
    teil('Alpha Arms', 'Arms', 2, 'Armor.FPS.Set.RSI.Alpha'),
    teil('Alpha Legs', 'Legs', 3, 'Armor.FPS.Set.RSI.Alpha'),
    teil('Beta Helmet', 'Helmet', 4, 'Armor.FPS.Set.CCsConversions.Beta'),
    teil('Beta Arms', 'Arms', 5, 'Armor.FPS.Set.CCsConversions.Beta'),
  ], new Map());
  const nach = Object.fromEntries(r.sets.map((x) => [x.name, x.manufacturer]));
  assert.strictEqual(nach.Alpha, 'Roberts Space Industries');
  assert.strictEqual(nach.Beta, "CC's Conversions");
});
