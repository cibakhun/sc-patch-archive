// Mini-Timer der Refinery-Kachel in der Konto-Übersicht (src/lib/refineryJobs.ts)
// und die Zahlen an den Reitern links: dort steht nur, was wartet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { jobTimers, fmtCountdown, stationShort } from '../../src/lib/refineryJobs.ts';

const NOW = Date.parse('2026-10-30T12:00:00Z');
const job = (startH, readyH, status = 'active') => ({
  status,
  started_at: new Date(NOW + startH * 3600e3).toISOString(),
  ready_at: new Date(NOW + readyH * 3600e3).toISOString(),
});

test('jobTimers: nur laufende, nach Fertigzeit, fertige zuerst', () => {
  const t = jobTimers([job(-1, 3), job(-4, -1), job(-2, 2), job(-9, -8, 'done')], NOW);
  assert.equal(t.length, 3);
  assert.deepEqual(t.map((x) => x.ready), [true, false, false]);
  assert.deepEqual(t.map((x) => x.left / 3600e3), [0, 2, 3]);
});

test('jobTimers: Fortschritt von Start bis Fertig, begrenzt auf 0–100', () => {
  const [half] = jobTimers([job(-2, 2)], NOW);
  assert.equal(half.pct, 50);
  const [done] = jobTimers([job(-4, -1)], NOW);
  assert.equal(done.pct, 100);
  const [future] = jobTimers([job(1, 3)], NOW);
  assert.equal(future.pct, 0);
  const [broken] = jobTimers([job(2, 2)], NOW);
  assert.equal(broken.pct, 0);
});

test('jobTimers: Auftrag ohne gültige Fertigzeit fällt raus', () => {
  assert.equal(jobTimers([{ status: 'active', started_at: 'x', ready_at: 'kaputt' }], NOW).length, 0);
});

test('fmtCountdown: Stunden:Minuten:Sekunden, Tage davor', () => {
  assert.equal(fmtCountdown(3725), '01:02:05');
  assert.equal(fmtCountdown(90061), '1d 01:01:01');
  assert.equal(fmtCountdown(-5), '00:00:00');
});

test('stationShort: Lagrange-Stationen beim Kürzel, sonst der Name', () => {
  assert.equal(stationShort('ARC-L1 Wide Forest Station'), 'ARC-L1');
  assert.equal(stationShort('MIC-L5 Modern Icarus Station'), 'MIC-L5');
  assert.equal(stationShort('Pyro Gateway (Nyx)'), 'Pyro Gateway (Nyx)');
  assert.equal(stationShort('Ruin Station'), 'Ruin Station');
});

test('Reiter links: keine reinen Anzahlen, nur der Hinweis bei Freunde', () => {
  const src = fs.readFileSync(path.resolve('src/components/account/AccountDashboard.astro'), 'utf8');
  const tabs = src.match(/<button type="button" class="tab"[^\n]*<\/button>/g) || [];
  assert.ok(tabs.length >= 5, `Reiter gefunden: ${tabs.length}`);
  const badges = tabs.flatMap((t) => t.match(/<span class="badge[^"]*" id="[^"]+"/g) || []);
  assert.deepEqual(badges, ['<span class="badge badge--chat" id="navFriendsNew"']);
});
