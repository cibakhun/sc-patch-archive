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
