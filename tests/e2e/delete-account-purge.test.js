// Kontoloeschung raeumt die hochgeladenen Profilbilder ab, bevor das Konto
// geht (supabase/functions/delete-account/purge.ts).
//
// purge.ts hat keine Importe und laeuft hier unveraendert (Node entfernt die
// Typen beim Laden, ab 22.18 ohne Schalter) gegen einen nachgebauten
// Storage-Client. Dazu zwei Quelltext-Zusicherungen an index.ts: das
// Aufraeumen steht VOR deleteUser, und ein Fehlschlag beendet die Anfrage,
// bevor das Konto geloescht wird.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { purgeUserFiles, USER_BUCKETS, PAGE } from '../../supabase/functions/delete-account/purge.ts';

const UID = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

/** Storage mit Objekten je Bucket; list/remove wie die Storage-API. */
function fakeStorage(objects, faults = {}) {
  const buckets = new Map(USER_BUCKETS.map((b) => [b, new Set(objects[b] || [])]));
  const calls = [];
  const api = {
    from(name) {
      const set = buckets.get(name) || new Set();
      return {
        async list(prefix, opts = {}) {
          calls.push({ op: 'list', bucket: name, prefix, offset: opts.offset || 0 });
          if (faults.list === name) return { data: null, error: { message: 'list kaputt' } };
          const base = prefix ? prefix + '/' : '';
          const seen = new Map();
          for (const p of set) {
            if (!p.startsWith(base)) continue;
            const rest = p.slice(base.length);
            const slash = rest.indexOf('/');
            if (slash === -1) seen.set(rest, { name: rest, id: 'obj-' + p });
            else seen.set(rest.slice(0, slash), { name: rest.slice(0, slash), id: null });
          }
          const all = [...seen.values()].sort((a, b) => (a.name < b.name ? -1 : 1));
          const off = opts.offset || 0;
          return { data: all.slice(off, off + (opts.limit || 100)), error: null };
        },
        async remove(paths) {
          calls.push({ op: 'remove', bucket: name, paths: [...paths] });
          if (faults.remove === name) return { data: null, error: { message: 'remove kaputt' } };
          for (const p of paths) if (!(faults.keep && faults.keep === p)) set.delete(p);
          return { data: paths.map((p) => ({ name: p })), error: null };
        },
      };
    },
  };
  return { api, buckets, calls };
}

test('entfernt Avatar und Banner des Kontos, fremde Ordner bleiben', async () => {
  const s = fakeStorage({
    avatars: [`${UID}/avatar`, `${OTHER}/avatar`],
    banners: [`${UID}/banner`, `${OTHER}/banner`],
  });
  const r = await purgeUserFiles(s.api, UID);
  assert.deepEqual(r, { ok: true, removed: 2 });
  assert.deepEqual([...s.buckets.get('avatars')], [`${OTHER}/avatar`]);
  assert.deepEqual([...s.buckets.get('banners')], [`${OTHER}/banner`]);
  for (const c of s.calls.filter((c) => c.op === 'remove')) {
    assert.ok(c.paths.every((p) => p.startsWith(UID + '/')), `nur der eigene Ordner: ${c.paths}`);
  }
});

test('ohne Uploads: kein remove, Ergebnis ok', async () => {
  const s = fakeStorage({ avatars: [`${OTHER}/avatar`] });
  const r = await purgeUserFiles(s.api, UID);
  assert.deepEqual(r, { ok: true, removed: 0 });
  assert.equal(s.calls.filter((c) => c.op === 'remove').length, 0);
  assert.deepEqual(
    s.calls.map((c) => c.bucket),
    ['avatars', 'banners', 'avatars', 'banners'],
    'beide Buckets werden angesehen und nach dem Entfernen noch einmal geprueft'
  );
});

test('Unterordner und mehr als eine Seite werden vollstaendig erfasst', async () => {
  const many = Array.from({ length: PAGE + 5 }, (_, i) => `${UID}/alt/${String(i).padStart(5, '0')}`);
  const s = fakeStorage({ avatars: [`${UID}/avatar`, ...many] });
  const r = await purgeUserFiles(s.api, UID);
  assert.deepEqual(r, { ok: true, removed: PAGE + 6 });
  assert.equal(s.buckets.get('avatars').size, 0);
  assert.ok(s.calls.some((c) => c.op === 'list' && c.offset === PAGE), 'zweite Seite gelesen');
  assert.ok(s.calls.filter((c) => c.op === 'remove').every((c) => c.paths.length <= PAGE));
});

test('scheitert das Auflisten, meldet purge den Fehler und entfernt nichts', async () => {
  const s = fakeStorage({ avatars: [`${UID}/avatar`], banners: [`${UID}/banner`] }, { list: 'banners' });
  const r = await purgeUserFiles(s.api, UID);
  assert.deepEqual([r.ok, r.bucket, r.stage], [false, 'banners', 'list']);
  assert.equal(s.calls.filter((c) => c.op === 'remove').length, 0, 'auch im ersten Bucket nichts entfernt');
  assert.equal(s.buckets.get('avatars').size, 1);
});

test('scheitert das Entfernen, meldet purge den Fehler', async () => {
  const s = fakeStorage({ avatars: [`${UID}/avatar`] }, { remove: 'avatars' });
  const r = await purgeUserFiles(s.api, UID);
  assert.deepEqual([r.ok, r.bucket, r.stage], [false, 'avatars', 'remove']);
});

test('bleibt trotz erfolgreicher Antwort etwas liegen, gilt das als Fehler', async () => {
  const s = fakeStorage({ banners: [`${UID}/banner`] }, { keep: `${UID}/banner` });
  const r = await purgeUserFiles(s.api, UID);
  assert.deepEqual([r.ok, r.bucket, r.stage], [false, 'banners', 'verify']);
});

test('eine Konto-ID, die keine UUID ist, raeumt nichts ab', async () => {
  const s = fakeStorage({ avatars: [`${UID}/avatar`] });
  for (const bad of ['', '..', '*', `${UID}/x`]) {
    const r = await purgeUserFiles(s.api, bad);
    assert.equal(r.ok, false, JSON.stringify(bad));
  }
  assert.equal(s.calls.length, 0);
});

test('index.ts: erst aufraeumen, dann loeschen; ein Fehlschlag loescht das Konto nicht', () => {
  const src = fs.readFileSync(path.resolve('supabase/functions/delete-account/index.ts'), 'utf8');
  const purgeAt = src.indexOf('purgeUserFiles(admin.storage, user.id)');
  const deleteAt = src.indexOf('admin.auth.admin.deleteUser(user.id)');
  assert.ok(purgeAt > 0, 'purgeUserFiles wird mit dem Service-Client und der eigenen ID aufgerufen');
  assert.ok(deleteAt > purgeAt, 'deleteUser steht hinter dem Aufraeumen');
  const between = src.slice(purgeAt, deleteAt);
  assert.match(between, /if \(!purge\.ok\)[\s\S]*?status: 500/, 'Fehlschlag endet mit 500 vor deleteUser');
  assert.doesNotMatch(src, /supabase-js@2['"]/, 'supabase-js ist auf eine genaue Version gepinnt');
});
