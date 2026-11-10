// Offline-Probe für lib/forum-lesen.mjs: node --test vorschlaege.test.mjs
// Prüft die Regeln, nach denen vorschlaege.mjs „offen" und „der nächste" bestimmt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filtereOffene, stimmen, inhaltFehlt, snowflakeZeit, autorName } from './lib/forum-lesen.mjs';

const forum = {
  id: 'F',
  available_tags: [
    { id: 't-sug', name: 'Suggestion' }, { id: 't-q', name: 'Question' },
    { id: 't-plan', name: 'Planned' }, { id: 't-done', name: 'Done' },
  ],
};
const th = (id, tags, zeit, meta = {}) => ({
  id, parent_id: 'F', name: `Post ${id}`, applied_tags: tags, owner_id: 'u' + id, message_count: 3,
  thread_metadata: { create_timestamp: zeit, archived: false, locked: false, ...meta },
});

test('offen = Suggestion, nicht Done, nicht gesperrt; älteste zuerst', () => {
  const threads = [
    th('300', ['t-sug'], '2026-11-10T12:00:00Z'),
    th('100', ['t-sug', 't-plan'], '2026-11-09T12:00:00Z'),
    th('200', ['t-sug', 't-done'], '2026-11-08T12:00:00Z'),
    th('400', ['t-q'], '2026-11-07T12:00:00Z'),
    th('500', ['t-sug'], '2026-11-06T12:00:00Z', { locked: true }),
    { ...th('600', ['t-sug'], '2026-11-05T12:00:00Z'), parent_id: 'ANDERES' },
  ];
  const offen = filtereOffene(threads, forum);
  assert.deepEqual(offen.map((p) => p.id), ['100', '300']);
  assert.equal(offen[0].geplant, true, 'Planned bleibt offen, ist aber markiert');
  assert.equal(offen[0].antworten, 3, 'message_count zählt den Startbeitrag nicht mit');
});

test('aktive und archivierte Liste doppelt: jeder Post nur einmal', () => {
  const a = th('100', ['t-sug'], '2026-11-09T12:00:00Z');
  const b = th('100', ['t-sug'], '2026-11-09T12:00:00Z', { archived: true });
  assert.equal(filtereOffene([a, b], forum).length, 1);
});

test('--alle nimmt Done und gesperrte mit, --tag alle jeden Post', () => {
  const threads = [
    th('100', ['t-sug', 't-done'], '2026-11-09T12:00:00Z'),
    th('200', ['t-q'], '2026-11-08T12:00:00Z'),
    th('300', ['t-sug'], '2026-11-07T12:00:00Z', { locked: true }),
  ];
  assert.deepEqual(filtereOffene(threads, forum, { alle: true }).map((p) => p.id), ['300', '100']);
  assert.deepEqual(filtereOffene(threads, forum, { tag: null }).map((p) => p.id), ['200']);
});

test('ohne create_timestamp trägt die Snowflake die Zeit', () => {
  // 175928847299117063 ist das Beispiel aus der Discord-Doku: 2016-04-30 11:18:25.796 UTC
  assert.equal(snowflakeZeit('175928847299117063').toISOString(), '2016-04-30T11:18:25.796Z');
  const alt = { id: '175928847299117063', parent_id: 'F', name: 'alt', applied_tags: ['t-sug'], thread_metadata: {} };
  assert.equal(filtereOffene([alt], forum)[0].erstellt.toISOString(), '2016-04-30T11:18:25.796Z');
});

test('Stimmen, Autor und fehlender Inhalt', () => {
  assert.deepEqual(stimmen({ reactions: [{ emoji: { name: '👍' }, count: 4 }, { emoji: { name: '👎' }, count: 1 }] }), { hoch: 4, runter: 1 });
  assert.deepEqual(stimmen({}), { hoch: 0, runter: 0 });
  assert.equal(autorName({ username: 'a', global_name: 'Alpha' }), 'Alpha');
  assert.equal(autorName({ username: 'a', global_name: null }), 'a');
  assert.equal(inhaltFehlt({ content: '', attachments: [], embeds: [] }), true, 'leerer Text ohne Anhang = Intent fehlt');
  assert.equal(inhaltFehlt({ content: '', attachments: [{ url: 'x' }] }), false, 'nur Bild ist ein echter Post');
  assert.equal(inhaltFehlt(null), false, 'gelöschter Startbeitrag ist kein Intent-Problem');
});
