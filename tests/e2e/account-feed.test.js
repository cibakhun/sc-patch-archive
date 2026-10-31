// Konto-Übersicht, „Letzte Aktivität": Quellen mischen (src/lib/activityFeed.ts)
// und je Refinery-Auftrag nur den neuesten Stand zeigen (src/lib/refineryJobs.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeFeed } from '../../src/lib/activityFeed.ts';
import { latestJobEvent } from '../../src/lib/refineryJobs.ts';

const it = (name, ts) => ({ html: name, ts });

test('mergeFeed: neueste zuerst, höchstens max', () => {
  const out = mergeFeed({ a: [it('a1', 1), it('a3', 3)], b: [it('b2', 2)] }, 5, 2);
  assert.deepEqual(out.map((x) => x.html), ['a3', 'b2']);
});

test('mergeFeed: eine fleißige Quelle drückt die anderen nicht hinaus', () => {
  const ref = Array.from({ length: 10 }, (_, i) => it('ref' + i, 100 + i));
  const out = mergeFeed({ ref, fav: [it('fav', 5)], friend: [it('friend', 1)] }, 4, 12);
  assert.equal(out.filter((x) => x.html.startsWith('ref')).length, 4);
  assert.deepEqual(out.slice(0, 4).map((x) => x.html), ['ref9', 'ref8', 'ref7', 'ref6']);
  assert.deepEqual(out.slice(4).map((x) => x.html), ['fav', 'friend']);
});

test('mergeFeed: Einträge ohne Zeit landen hinten, Eingabe bleibt unverändert', () => {
  const src = { a: [it('ohne', 0), it('mit', 7)] };
  assert.deepEqual(mergeFeed(src, 4, 12).map((x) => x.html), ['mit', 'ohne']);
  assert.deepEqual(src.a.map((x) => x.html), ['ohne', 'mit']);
});

const NOW = Date.parse('2026-10-30T12:00:00Z');
const at = (h) => new Date(NOW + h * 3600e3).toISOString();

test('latestJobEvent: abgeholt schlägt fertig schlägt gestartet', () => {
  assert.deepEqual(latestJobEvent({ status: 'done', started_at: at(-9), ready_at: at(-5), collected_at: at(-4) }, NOW), { kind: 'collected', ts: NOW - 4 * 3600e3 });
  assert.deepEqual(latestJobEvent({ status: 'active', started_at: at(-9), ready_at: at(-1) }, NOW), { kind: 'ready', ts: NOW - 3600e3 });
  assert.deepEqual(latestJobEvent({ status: 'active', started_at: at(-2), ready_at: at(3) }, NOW), { kind: 'started', ts: NOW - 2 * 3600e3 });
});

test('latestJobEvent: erledigt ohne Abholzeit zählt als gestartet', () => {
  assert.equal(latestJobEvent({ status: 'done', started_at: at(-9), ready_at: at(-5), collected_at: null }, NOW).kind, 'started');
});
