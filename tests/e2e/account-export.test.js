// "Meine Daten herunterladen" (src/lib/account-export.ts): welche Tabellen in
// die Datei kommen, dass jede Abfrage ausdruecklich auf das eigene Konto
// filtert, dass seitenweise gelesen wird und dass ein Fehler den Rest nicht
// verhindert.
//
// account-export.ts hat keine Importe und laeuft hier unveraendert gegen
// einen nachgebauten supabase-js-Client, der jede Abfrage protokolliert.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildAccountExport, exportFileName, EXPORT_SPECS, EXPORT_BUCKETS, PAGE, EXPORT_FORMAT,
} from '../../src/lib/account-export.ts';

const UID = '11111111-1111-4111-8111-111111111111';

/** Client mit Zeilen je Tabelle; jede Abfrage landet in calls. */
function fakeClient(rowsByTable = {}, opts = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      return {
        select(cols) {
          const call = { table, cols, filters: [] };
          calls.push(call);
          const filtered = {
            order(col, o) {
              call.order = [col, o && o.ascending];
              return {
                range(a, b) {
                  call.range = [a, b];
                  if (opts.failTable === table) return Promise.resolve({ data: null, error: { message: 'kaputt' } });
                  const all = rowsByTable[table] || [];
                  // opts.cap: der Server liefert hoechstens so viele Zeilen je Antwort (max_rows).
                  const end = opts.cap ? Math.min(b + 1, a + opts.cap) : b + 1;
                  return Promise.resolve({ data: all.slice(a, end), error: null });
                },
              };
            },
          };
          return {
            eq(col, val) { call.filters.push(['eq', col, val]); return filtered; },
            or(f) { call.filters.push(['or', f]); return filtered; },
          };
        },
      };
    },
    storage: {
      from(bucket) {
        return {
          async list(prefix, o) {
            calls.push({ bucket, prefix, offset: o.offset });
            if (opts.failBucket === bucket) return { data: null, error: { message: 'list kaputt' } };
            return { data: bucket === 'avatars' ? [{ name: 'avatar', id: 'o1', metadata: { size: 10 } }] : [], error: null };
          },
        };
      },
    },
  };
}

test('die Datei deckt alle Tabellen mit Kontobezug und beide Buckets ab', async () => {
  const keys = EXPORT_SPECS.map((s) => s.key);
  for (const k of ['profile', 'favorites', 'crafting_entries', 'refinery_jobs', 'mining_sig_presets',
    'friends', 'friend_requests', 'direct_messages_sent', 'direct_messages_received',
    'hangar_layouts', 'discord_role_state', 'user_roles']) {
    assert.ok(keys.includes(k), `fehlt: ${k}`);
  }
  assert.deepEqual([...EXPORT_BUCKETS], ['avatars', 'banners']);

  const c = fakeClient({ profiles: [{ id: UID, bio: 'b' }], favorites: [{ id: 1 }, { id: 2 }] });
  const out = await buildAccountExport(c, { id: UID, email: 'a@example.test' }, new Date('2026-10-30T12:00:00Z'));
  assert.equal(out.format, EXPORT_FORMAT);
  assert.equal(out.exported_at, '2026-10-30T12:00:00.000Z');
  assert.deepEqual(out.account, { id: UID, email: 'a@example.test' });
  assert.deepEqual(Object.keys(out.tables).sort(), [...keys].sort());
  assert.deepEqual(out.tables.profile, [{ id: UID, bio: 'b' }]);
  assert.equal(out.tables.favorites.length, 2);
  assert.deepEqual(out.storage.avatars, [{ path: `${UID}/avatar`, name: 'avatar', id: 'o1', metadata: { size: 10 } }]);
  assert.deepEqual(out.storage.banners, []);
  assert.equal(out.errors, undefined);
});

test('jede Abfrage filtert ausdruecklich auf das eigene Konto', async () => {
  const c = fakeClient();
  await buildAccountExport(c, { id: UID });
  const q = c.calls.filter((x) => x.table);
  assert.equal(q.length, EXPORT_SPECS.length);
  for (const call of q) {
    assert.equal(call.filters.length, 1, `${call.table}: genau ein Filter`);
    const f = call.filters[0];
    if (f[0] === 'eq') assert.equal(f[2], UID, call.table);
    else assert.match(f[1], new RegExp(`^\\w+\\.eq\\.${UID},\\w+\\.eq\\.${UID}$`), call.table);
  }
  const byKey = Object.fromEntries(EXPORT_SPECS.map((s, i) => [s.key, q[i]]));
  assert.deepEqual(byKey.direct_messages_sent.filters[0], ['eq', 'sender_id', UID]);
  assert.deepEqual(byKey.direct_messages_received.filters[0], ['eq', 'receiver_id', UID]);
  assert.deepEqual(byKey.friend_requests.filters[0], ['or', `sender_id.eq.${UID},receiver_id.eq.${UID}`]);
  for (const s of c.calls.filter((x) => x.bucket)) assert.equal(s.prefix, UID, 'nur der eigene Ordner');
});

test('liest seitenweise, bis eine Seite leer ist', async () => {
  const many = Array.from({ length: PAGE + 3 }, (_, i) => ({ id: i }));
  const c = fakeClient({ direct_messages: many });
  const out = await buildAccountExport(c, { id: UID });
  assert.equal(out.tables.direct_messages_sent.length, PAGE + 3);
  const pages = c.calls.filter((x) => x.table === 'direct_messages' && x.filters[0][1] === 'sender_id');
  assert.deepEqual(pages.map((p) => p.range), [[0, PAGE - 1], [PAGE, 2 * PAGE - 1], [PAGE + 3, 2 * PAGE + 2]]);
  assert.ok(pages.every((p) => p.order[0] === 'id' && p.order[1] === true), 'stabile Sortierung');
});

test('kappt der Server die Antworten unter PAGE, fehlt trotzdem keine Zeile', async () => {
  const many = Array.from({ length: 1234 }, (_, i) => ({ id: i }));
  const c = fakeClient({ direct_messages: many }, { cap: 500 });
  const out = await buildAccountExport(c, { id: UID });
  assert.equal(out.tables.direct_messages_sent.length, 1234);
  assert.deepEqual(out.tables.direct_messages_sent.map((r) => r.id), many.map((r) => r.id));
  assert.equal(out.errors, undefined);
});

test('ein Fehler landet unter errors, der Rest kommt trotzdem', async () => {
  const c = fakeClient({ favorites: [{ id: 1 }] }, { failTable: 'friends', failBucket: 'banners' });
  const out = await buildAccountExport(c, { id: UID });
  assert.deepEqual(out.errors, { friends: 'kaputt', 'storage.banners': 'list kaputt' });
  assert.equal(out.tables.favorites.length, 1);
  assert.equal(out.storage.avatars.length, 1);
});

test('eine Konto-ID, die keine UUID ist, fragt nichts ab', async () => {
  const c = fakeClient();
  await assert.rejects(buildAccountExport(c, { id: 'x),id.neq.0' }));
  assert.equal(c.calls.length, 0);
});

test('Dateiname je Sprache', () => {
  const d = new Date('2026-10-30T23:59:00Z');
  assert.equal(exportFileName('de', d), 'verse-base-daten-2026-10-30.json');
  assert.equal(exportFileName('en', d), 'verse-base-data-2026-10-30.json');
});

test('Dashboard: Knopf "Meine Daten" im Bereich Sicherheit, Handler ruft buildAccountExport', () => {
  const astro = fs.readFileSync(path.resolve('src/components/account/AccountDashboard.astro'), 'utf8');
  assert.match(astro, /dl: 'Als Datei laden'/);
  assert.match(astro, /dl: 'Download file'/);
  assert.match(astro, /id="secExport"/);
  const sec = fs.readFileSync(path.resolve('src/scripts/account-security.ts'), 'utf8');
  assert.match(sec, /\$\('secExport'\)/);
  assert.match(sec, /buildAccountExport\(/);
  assert.doesNotMatch(sec, /\.select\('\*'\)/, 'der Export liest nur ueber account-export.ts (ausdrueckliche Eigentuemer-Filter)');
});
