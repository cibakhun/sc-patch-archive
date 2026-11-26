// Crew-Aufruf (src/lib/crew.ts): Beginn aus „Heute/Morgen + Uhrzeit“,
// Zeitangabe der Karte und welche Aufrufe noch auf der Seite stehen.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as nodeModule from 'node:module';

async function loadTs(rel) {
  const src = fs.readFileSync(path.resolve(rel), 'utf8');
  let js;
  if (typeof nodeModule.stripTypeScriptTypes === 'function') {
    js = nodeModule.stripTypeScriptTypes(src);
  } else {
    const { transformSync } = await import('esbuild');
    js = transformSync(src, { loader: 'ts', format: 'esm' }).code;
  }
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
}

const crew = await loadTs('src/lib/crew.ts');
const at = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi, 0, 0);

describe('Crew-Aufruf: Rechnen', () => {
  test('Beginn aus Tag und Uhrzeit, in Ortszeit', () => {
    const now = at(2026, 11, 24, 18, 5);
    assert.equal(crew.crewStart(0, '20:00', now).getTime(), at(2026, 11, 24, 20, 0).getTime());
    assert.equal(crew.crewStart(1, '20:00', now).getTime(), at(2026, 11, 25, 20, 0).getTime());
    // „heute 01:00“ um 18 Uhr ist morgen gemeint, 18:00 (5 min her) noch heute.
    assert.equal(crew.crewStart(0, '01:00', now).getTime(), at(2026, 11, 25, 1, 0).getTime());
    assert.equal(crew.crewStart(0, '18:00', now).getTime(), at(2026, 11, 24, 18, 0).getTime());
    for (const bad of ['', '24:00', '12:60', '8', 'x:y', '20:00:00']) assert.equal(crew.crewStart(0, bad, now), null, bad);
  });

  test('Vorschlag: nächste halbe Stunde, mindestens 20 Minuten hin', () => {
    assert.deepEqual(crew.crewDefaultTime(at(2026, 11, 24, 18, 5)), { day: 0, hhmm: '18:30' });
    assert.deepEqual(crew.crewDefaultTime(at(2026, 11, 24, 18, 15)), { day: 0, hhmm: '19:00' });
    assert.deepEqual(crew.crewDefaultTime(at(2026, 11, 24, 23, 50)), { day: 1, hhmm: '00:30' });
  });

  test('Zeitangabe der Karte', () => {
    const now = at(2026, 11, 24, 18, 5);
    const iso = (d) => d.toISOString();
    assert.equal(crew.crewWhen(iso(at(2026, 11, 24, 20, 0)), 'de', now), 'heute 20:00');
    assert.equal(crew.crewWhen(iso(at(2026, 11, 25, 18, 30)), 'de', now), 'morgen 18:30');
    assert.equal(crew.crewWhen(iso(at(2026, 11, 25, 18, 30)), 'en', now), 'tomorrow 18:30');
    assert.equal(crew.crewWhen(iso(at(2026, 11, 24, 17, 50)), 'de', now), 'läuft seit 17:50');
    assert.match(crew.crewWhen(iso(at(2026, 11, 26, 20, 0)), 'de', now), /26.*20:00$/);
    assert.equal(crew.crewWhen('kaputt', 'de', now), '');
  });

  test('offene Aufrufe: eine Stunde nach Beginn weg, nach Beginn sortiert', () => {
    const now = at(2026, 11, 24, 18, 0);
    const row = (id, d) => ({ id, owner_id: 'a', activity: 'mining', starts_at: d.toISOString(), slots: 2, note: null });
    const rows = [row(1, at(2026, 11, 24, 20, 0)), row(2, at(2026, 11, 24, 16, 59)), row(3, at(2026, 11, 24, 17, 30)), row(4, at(2026, 11, 24, 19, 0))];
    assert.deepEqual(crew.openCrewCalls(rows, now).map((r) => r.id), [3, 4, 1]);
  });

  test('Tätigkeiten: dieselbe Liste wie die Datenbank, beide Sprachen', () => {
    const sql = fs.readFileSync('supabase/migrations/20261124110000_crew_aufruf.sql', 'utf8');
    const m = sql.match(/activity in\s*\(([^)]*)\)/);
    assert.ok(m, 'check der Tätigkeiten nicht gefunden');
    const db = [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]);
    assert.deepEqual([...crew.CREW_ACTIVITIES], db);
    for (const l of ['de', 'en']) for (const a of db) assert.ok(crew.CREW_LABELS[l][a], `${l}/${a}`);
    assert.match(sql, new RegExp(`slots between 1 and ${crew.CREW_MAX_SLOTS}\\b`));
    assert.equal(crew.activityLabel('kaputt', 'de'), 'Sonstiges');
  });

  // Die jüngste Fassung einer Funktion zählt: die letzte Migration, die sie anlegt.
  const letzteFassung = (name) => {
    const ordner = 'supabase/migrations';
    const dateien = fs.readdirSync(ordner).filter((n) => n.endsWith('.sql')).sort();
    let rumpf = null;
    for (const n of dateien) {
      const sql = fs.readFileSync(path.join(ordner, n), 'utf8');
      const m = sql.match(new RegExp(`create or replace function public\\.${name}\\(\\)[\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$`));
      if (m) rumpf = m[1];
    }
    assert.ok(rumpf, `${name} nicht gefunden`);
    return rumpf;
  };

  test('Wächter: Sperre vor dem Zählen, Sichtbarkeit vor den Zustandsprüfungen', () => {
    const aufruf = letzteFassung('crew_calls_guard');
    const sperre = aufruf.indexOf('pg_advisory_xact_lock');
    assert.ok(sperre > 0, 'crew_calls_guard sperrt nicht');
    assert.ok(sperre < aufruf.indexOf('count(*)'), 'crew_calls_guard zählt vor der Sperre');

    const zusage = letzteFassung('crew_call_members_guard');
    const sicht = zusage.indexOf('are_friends');
    assert.ok(sicht > 0, 'crew_call_members_guard prüft die Sichtbarkeit nicht');
    for (const spaeter of ['for update', 'Aufruf ist vorbei', 'Crew ist voll']) {
      assert.ok(sicht < zusage.indexOf(spaeter), `Sichtbarkeit erst nach „${spaeter}“`);
    }
  });
});
