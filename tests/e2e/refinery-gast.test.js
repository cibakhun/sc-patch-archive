// Refinery-Tracker ohne Konto (UX-Audit 24.11.2026, Paket G11): die Ablage
// im Browser (src/lib/refineryGast.ts) und wie die Seite sie benutzt
// (src/components/account/RefineryDashboard.astro).
//
// refineryGast.ts hat nur Typ-Importe und laeuft hier unveraendert (Node
// entfernt die Typen beim Laden) gegen einen nachgebauten Speicher.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  GAST_KEY, GAST_MAX, gastAuftrag, ladeGast, speichereGast, naechsteGastId, hatGastAuftraege, kontoZeile, nimmGast, zurueckLegen,
} from '../../src/lib/refineryGast.ts';
import { accountKeys } from '../../src/lib/account-cleanup.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');

/** Speicher mit dem Storage-Ausschnitt, den refineryGast.ts braucht. */
function store(entries = {}, { sperre = false } = {}) {
  const m = new Map(Object.entries(entries));
  return {
    map: m,
    getItem(k) { return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { if (sperre) throw new Error('QuotaExceededError'); m.set(k, String(v)); },
    removeItem(k) { m.delete(k); },
  };
}

const T0 = '2026-11-24T12:00:00.000Z';
const auftrag = (id, extra = {}) => ({
  id,
  station: 'ARC-L1 Wide Forest Station',
  method: 'Dinyx Solventation',
  items: [{ ore: 'Quantainium', rawScu: 32, yieldScu: 24.5 }],
  input_scu: 32,
  yield_scu: 24.5,
  cost: 4200,
  est_value: 120000,
  sold_value: null,
  started_at: T0,
  ready_at: '2026-11-24T14:30:00.000Z',
  collected_at: null,
  status: 'active',
  note: null,
  created_at: T0,
  ...extra,
});

test('Ablage: speichern und laden geben dieselben Auftraege zurueck', () => {
  const s = store();
  const jobs = [auftrag(1), auftrag(2, { status: 'done', collected_at: '2026-11-24T15:00:00.000Z', sold_value: 130000 })];
  assert.equal(speichereGast(s, jobs), true);
  assert.deepEqual(ladeGast(s), jobs);
  assert.equal(hatGastAuftraege(s), true);
  assert.equal(JSON.parse(s.map.get(GAST_KEY)).v, 1);
});

test('Ablage: leer, fehlend oder kaputt ergibt eine leere Liste', () => {
  assert.deepEqual(ladeGast(store()), []);
  assert.deepEqual(ladeGast(store({ [GAST_KEY]: '{kaputt' })), []);
  assert.deepEqual(ladeGast(store({ [GAST_KEY]: '[1,2]' })), []);
  assert.deepEqual(ladeGast(null), []);
  assert.equal(hatGastAuftraege(store()), false);
});

test('Ablage: leere Liste entfernt den Schluessel', () => {
  const s = store({ [GAST_KEY]: JSON.stringify({ v: 1, jobs: [auftrag(1)] }) });
  assert.equal(speichereGast(s, []), true);
  assert.equal(s.map.has(GAST_KEY), false);
});

test('Ablage: gesperrter Speicher meldet false statt zu werfen', () => {
  assert.equal(speichereGast(store({}, { sperre: true }), [auftrag(1)]), false);
  assert.equal(speichereGast(null, [auftrag(1)]), false);
});

test('Pruefung: Eintraege, die das Konto ablehnen wuerde, fallen weg', () => {
  const kaputt = [
    auftrag(0),                                   // keine gueltige Kennung
    auftrag(3, { station: '<b>x</b>' }),          // spitze Klammern
    auftrag(4, { method: 'x'.repeat(61) }),       // zu lang
    auftrag(5, { status: 'laeuft' }),             // unbekannter Status
    auftrag(6, { ready_at: 'morgen' }),           // keine Zeit
    auftrag(7, { items: 'Quantainium' }),         // kein Array
    auftrag(8, { items: Array.from({ length: 31 }, () => ({ ore: 'Agricium', rawScu: 1, yieldScu: 1 })) }),
    auftrag(9, { items: [{ ore: ['Agricium'] }] }), // Erz kein Text
    auftrag(1),                                   // gueltig
    auftrag(1),                                   // doppelte Kennung
  ];
  const s = store({ [GAST_KEY]: JSON.stringify({ v: 1, jobs: kaputt }) });
  assert.deepEqual(ladeGast(s).map((j) => j.id), [1]);
});

test('Pruefung: negative oder unlesbare Betraege werden 0 bzw. null, Notiz ueber 500 Zeichen faellt weg', () => {
  const j = gastAuftrag(auftrag(1, { cost: -5, est_value: 'viel', yield_scu: '24.5', note: 'n'.repeat(501), collected_at: T0 }));
  assert.equal(j.cost, 0);
  assert.equal(j.est_value, null);
  assert.equal(j.yield_scu, 24.5);
  assert.equal(j.note, null);
  assert.equal(j.collected_at, null, 'laufender Auftrag hat keine Abholzeit');
});

test('Obergrenze: ueber GAST_MAX fallen die am laengsten abgeholten weg, laufende nie', () => {
  const jobs = [];
  for (let i = 1; i <= GAST_MAX; i++) {
    jobs.push(auftrag(i, { status: 'done', collected_at: new Date(Date.parse(T0) + i * 60000).toISOString() }));
  }
  jobs.push(auftrag(GAST_MAX + 1), auftrag(GAST_MAX + 2));
  const s = store();
  assert.equal(speichereGast(s, jobs), true);
  const ids = ladeGast(s).map((j) => j.id);
  assert.equal(ids.length, GAST_MAX);
  assert.equal(ids.includes(1) || ids.includes(2), false, 'die zwei aeltesten abgeholten fehlen');
  assert.equal(ids.includes(GAST_MAX + 1) && ids.includes(GAST_MAX + 2), true, 'laufende bleiben');
});

test('Kennung: naechste freie Zahl nach der groessten', () => {
  assert.equal(naechsteGastId([]), 1);
  assert.equal(naechsteGastId([{ id: 3 }, { id: 7 }, { id: 2 }]), 8);
});

test('Uebernahme ins Konto: Zeile ohne id, user_id und created_at, sonst vollstaendig', () => {
  const z = kontoZeile(auftrag(4, { status: 'done', collected_at: T0, sold_value: 99, note: 'Lauf 2' }));
  assert.equal('id' in z || 'user_id' in z || 'created_at' in z, false);
  assert.deepEqual(Object.keys(z).sort(), [
    'collected_at', 'cost', 'est_value', 'input_scu', 'items', 'method', 'note', 'ready_at', 'sold_value', 'started_at', 'station', 'status', 'yield_scu',
  ]);
  assert.equal(z.sold_value, 99);
  assert.deepEqual(z.items, [{ ore: 'Quantainium', rawScu: 32, yieldScu: 24.5 }]);
});

test('Uebernahme ins Konto: erst nehmen, dann schreiben; ein zweiter Tab findet nichts mehr', () => {
  const s = store({ [GAST_KEY]: JSON.stringify({ v: 1, jobs: [auftrag(1), auftrag(2)] }) });
  const erster = nimmGast(s);
  assert.equal(erster.length, 2);
  assert.equal(s.map.has(GAST_KEY), false);
  assert.deepEqual(nimmGast(s), [], 'zweiter Tab legt nichts doppelt an');
});

test('Uebernahme gescheitert: zurueckLegen behaelt, was inzwischen dazukam, mit neuen Kennungen', () => {
  const s = store();
  const mit = [auftrag(1), auftrag(2)];
  speichereGast(s, [auftrag(1, { note: 'neu in anderem Tab' })]);
  zurueckLegen(s, mit);
  const jetzt = ladeGast(s);
  assert.deepEqual(jetzt.map((j) => j.id), [1, 2, 3]);
  assert.equal(jetzt[0].note, 'neu in anderem Tab');
});

test('Abmelden raeumt die Gast-Ablage nicht weg (kein Kontospiegel)', () => {
  const { local } = accountKeys('11111111-1111-4111-8111-111111111111', 'signout');
  assert.equal(local.includes(GAST_KEY), false);
  assert.equal(GAST_KEY.startsWith('vb.fleet.v1.') || GAST_KEY.startsWith('craft.state.v2.') || GAST_KEY.startsWith('vb.layouts.v1.') || GAST_KEY.startsWith('vb_profile_'), false);
});

test('Seite: Gast-Tracker statt Schloss, Gast-Riegel kennt die Ablage, Formular schreibt fuer Gaeste lokal', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/components/account/RefineryDashboard.astro'), 'utf8');
  assert.equal(src.includes('id="rfd-out"'), false, 'das Schloss fuer Gaeste ist weg');
  assert.match(src, /id="rfd-gast"/);
  assert.match(src, /localStorage\.getItem\('vb\.refinery\.v1'\)/, 'Gast-Riegel liest dieselbe Ablage');
  assert.equal(GAST_KEY, 'vb.refinery.v1');
  assert.match(src, /if \(!data\.session\) \{ startGast\(\); return; \}/);
  assert.match(src, /await uebernimmGast\(\);\s*\n\s*const \{ data: rows/, 'Uebernahme vor dem Laden der Kontoauftraege');
  // Jede Schreibstelle ins Konto steht hinter !gast oder in der Uebernahme.
  const schreib = [...src.matchAll(/supabase\.from\('refinery_jobs'\)\.(insert|update|delete)/g)].length;
  assert.equal(schreib, 5, 'collect, del, update, Formular, Uebernahme');
  assert.equal((src.match(/if \(!gast\) \{\n\s*const \{ error \} = await supabase\.from\('refinery_jobs'\)/g) || []).length, 3);
});
