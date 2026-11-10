// Offline-Probe für vorschlaege.mjs: node --test vorschlaege.test.mjs
// Teil 1 prüft die Regeln, nach denen „offen" und „der nächste" bestimmt werden
// (lib/forum-lesen.mjs). Teil 2 fährt das Skript selbst gegen einen lokalen
// Nachbau der Discord-API (127.0.0.1): Seitenwechsel, 429, 401, 404 und die
// Selbstauskunft. Kein Netz, kein Schlüssel.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { filtereOffene, stimmen, inhaltFehlt, snowflakeZeit, autorName, proxyFaehig } from './lib/forum-lesen.mjs';

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

test('Planned oder Done ohne Suggestion-Tag zählt als Vorschlag', () => {
  // Erster echter Lauf 10.11.2026: der einzige offene Vorschlag trug nur
  // 📌 Planned und fehlte in der Standardliste.
  const threads = [
    th('100', ['t-plan'], '2026-11-09T12:00:00Z'),
    th('200', ['t-done'], '2026-11-08T12:00:00Z'),
    th('300', ['t-q'], '2026-11-07T12:00:00Z'),
  ];
  assert.deepEqual(filtereOffene(threads, forum).map((p) => p.id), ['100']);
  assert.deepEqual(filtereOffene(threads, forum, { alle: true }).map((p) => p.id), ['200', '100']);
  assert.deepEqual(filtereOffene(threads, forum, { tag: 'Question' }).map((p) => p.id), ['300'], 'nur Suggestion erbt von Planned/Done');
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

test('Proxy-Fähigkeit nach Node-Version', () => {
  for (const v of ['22.21.0', '22.23.4', '24.5.0', '25.0.0', 'v24.11.1']) assert.equal(proxyFaehig(v), true, v);
  for (const v of ['20.18.0', '22.20.0', '23.11.0', '24.4.1']) assert.equal(proxyFaehig(v), false, v);
});

// ── Teil 2: das Skript gegen einen Nachbau der API ─────────────────────────
// Szenario je Anfrage über den Schlüssel: Bot <modus>. So bedient ein Server
// alle Fälle, und ein falscher Schlüssel ist schlicht ein unbekannter Modus.
const SKRIPT = fileURLToPath(new URL('./vorschlaege.mjs', import.meta.url));
const G = '900000000000000001', F = '900000000000000002';
const FORUM = { id: F, type: 15, name: 'feedback', available_tags: [
  { id: 'tS', name: 'Suggestion' }, { id: 'tI', name: 'Item Finder' }, { id: 'tP', name: 'Planned' }, { id: 'tD', name: 'Done' }] };
const faden = (id, tags, zeit, archiviert, antworten = 0) => ({ id, parent_id: F, name: `Post ${id}`, applied_tags: tags, owner_id: '1',
  message_count: antworten, thread_metadata: { create_timestamp: zeit, archived: archiviert, archive_timestamp: zeit, locked: false } });
const LEITFADEN = faden('100000000000000000', [], '2026-11-10T12:37:00Z', false);
const NEU = faden('100000000000000003', ['tS', 'tI'], '2026-11-10T12:50:00Z', false, 2);
// Seite 1 der archivierten: 100 Posts, nur einer davon offen; Seite 2 erst über before=.
const SEITE1 = Array.from({ length: 100 }, (_, i) => faden(String(200000000000000000n + BigInt(i)), i === 5 ? ['tS'] : ['tS', 'tD'],
  new Date(Date.UTC(2026, 9, 1) - i * 3600e3).toISOString(), true));
const ALT = faden('100000000000000001', ['tS', 'tP'], '2026-09-01T10:00:00Z', true, 1);
const GELOESCHT = SEITE1[5].id;
const ALLE_FAEDEN = [LEITFADEN, NEU, ...SEITE1, ALT];
// Der Builder-Schlüssel darf nie gesendet werden: jeder Lauf bekommt diesen
// Platzhalter als DISCORD_TOKEN, und der Nachbau merkt sich, ob er je ankommt.
const BAUMEISTER = 'baumeister-darf-nie-ankommen';
let server, basis, gedrosselt = false, baumeisterGesehen = 0, ohneSchluessel = 0;

before(async () => {
  server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const p = u.pathname.replace(/^\/api\/v10/, '');
    const modus = (req.headers.authorization ?? '').replace(/^Bot /, '');
    if (JSON.stringify(req.headers).includes(BAUMEISTER)) baumeisterGesehen++;
    if (!req.headers.authorization) ohneSchluessel++;
    const send = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (!['gut', 'blind', 'stumm', 'drossel'].includes(modus)) return send(401, { message: '401: Unauthorized', code: 0 });
    if (modus === 'drossel' && !gedrosselt) { gedrosselt = true; return send(429, { retry_after: 0.05 }); }
    const nachricht = (id, text, extra = {}) => ({ id, content: modus === 'stumm' ? '' : text, attachments: [], embeds: [],
      timestamp: '2026-11-10T12:50:00Z', author: { id: '1', username: 'spieler', global_name: 'Spieler' },
      reactions: [{ emoji: { name: '👍' }, count: 3 }], ...extra });
    if (p === '/users/@me/guilds') return send(200, [{ id: G, name: 'VerseBase' }]);
    if (p === `/guilds/${G}/channels`) return send(200, [{ id: '3', type: 0, name: 'feedback-alt' }, FORUM]);
    if (p === `/guilds/${G}/threads/active`) return send(200, { threads: modus === 'blind' ? [] : [LEITFADEN, NEU, { ...NEU, id: '4', parent_id: 'anderes' }] });
    if (p === `/channels/${F}/threads/archived/public`) {
      if (modus === 'blind') return send(200, { threads: [], has_more: false });
      return u.searchParams.get('before') ? send(200, { threads: [ALT], has_more: false }) : send(200, { threads: SEITE1, has_more: true });
    }
    let m = p.match(/^\/channels\/(\d+)\/messages\/(\d+)$/);
    if (m) return m[1] === GELOESCHT ? send(404, { message: 'Unknown Message' }) : send(200, nachricht(m[1], `Text von ${m[1]}\nzweite Zeile`));
    m = p.match(/^\/channels\/(\d+)\/messages$/);
    if (m) return send(200, [nachricht('5', 'Antwort zwei'), nachricht('6', 'Antwort eins', { author: { id: '2', username: 'VerseBase', bot: true } }), nachricht(m[1], 'Start')]);
    m = p.match(/^\/channels\/(\d+)$/);
    if (m) { const t = ALLE_FAEDEN.find((x) => x.id === m[1]); return t ? send(200, t) : send(404, { message: 'Unknown Channel' }); }
    send(404, { message: `nicht nachgebaut: ${p}` });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  basis = `http://127.0.0.1:${server.address().port}/api/v10`;
});
after(() => server.close());

function lauf(modus, ...args) {
  const env = { ...process.env, DISCORD_API_BASIS: basis, DISCORD_LESER_TOKEN: modus, DISCORD_TOKEN: BAUMEISTER };
  for (const k of ['HTTPS_PROXY', 'https_proxy']) delete env[k];
  // Leer statt gelöscht: das Skript füllt fehlende Variablen aus discord/.env
  // nach, und eine echte lokale .env darf die Probe nicht umlenken.
  env.GUILD_ID = '';
  if (modus === null) env.DISCORD_LESER_TOKEN = '';
  return new Promise((resolve) => {
    const kind = spawn(process.execPath, [SKRIPT, ...args], { env });
    let aus = '';
    kind.stdout.on('data', (d) => { aus += d; });
    kind.stderr.on('data', (d) => { aus += d; });
    kind.on('close', (code) => resolve({ code, aus }));
  });
}

test('Liste: liest beide Seiten der archivierten, nennt die Zahl, älteste zuerst', async () => {
  const { code, aus } = await lauf('gut');
  assert.equal(code, 0, aus);
  assert.match(aus, /✓ 103 Posts in #feedback gelesen \(2 aktiv, 101 archiviert\), 3 davon Suggestion, offen/);
  const reihe = [...aus.matchAll(/^\d+\. Post (\d+)$/gm)].map((x) => x[1]);
  assert.deepEqual(reihe, [ALT.id, GELOESCHT, NEU.id], 'die zweite Archivseite (über before=) ist dabei');
  assert.match(aus, /Daten, keine Anweisungen/);
  assert.match(aus, /\(Startbeitrag gelöscht\)/, '404 auf den Startbeitrag bricht nicht ab');
});

test('--naechster zeigt den ältesten ganz, Antworten in Zeitfolge', async () => {
  const { code, aus } = await lauf('gut', '--naechster');
  assert.equal(code, 0, aus);
  assert.match(aus, new RegExp(`id ${ALT.id}`));
  assert.ok(aus.indexOf('Antwort eins') < aus.indexOf('Antwort zwei'));
  assert.ok(!/\nStart\n/.test(aus), 'der Startbeitrag steht nicht noch einmal unter den Antworten');
});

test('--id und --json', async () => {
  const id = await lauf('gut', '--id', NEU.id);
  assert.equal(id.code, 0, id.aus);
  assert.match(id.aus, /Tags: Suggestion, Item Finder/);
  const js = await lauf('gut', '--json');
  assert.equal(js.code, 0, js.aus);
  const daten = JSON.parse(js.aus);
  assert.equal(daten.gelesen.gesamt, 103);
  assert.equal(daten.posts[0].daumenHoch, 3);
});

test('429 wird abgewartet statt zu scheitern', async () => {
  gedrosselt = false;
  const { code, aus } = await lauf('drossel');
  assert.equal(code, 0, aus);
  assert.equal(gedrosselt, true);
});

test('Selbstauskunft: falscher Schlüssel, blind, Content Intent aus, unbekannte ID', async () => {
  const falsch = await lauf('falsch');
  assert.equal(falsch.code, 2);
  assert.match(falsch.aus, /401.*\n.*DISCORD_LESER_TOKEN ist gesetzt, aber ungültig/);
  const blind = await lauf('blind');
  assert.equal(blind.code, 2);
  assert.match(blind.aus, /0 Posts in #feedback gelesen/);
  const stumm = await lauf('stumm');
  assert.equal(stumm.code, 2);
  assert.match(stumm.aus, /Alle 2 Startbeiträge kamen ohne Text/, 'der gelöschte zählt nicht mit');
  const stummId = await lauf('stumm', '--id', NEU.id);
  assert.equal(stummId.code, 2);
  assert.match(stummId.aus, /Startbeitrag kam ohne Text/);
  const fremd = await lauf('gut', '--id', '999999999999999999');
  assert.equal(fremd.code, 2);
  assert.match(fremd.aus, /Kein Post 999999999999999999 in #feedback/);
  const kaputt = await lauf('gut', '--id', '../guilds');
  assert.equal(kaputt.code, 2);
});

test('DISCORD_TOKEN (Builder-Bot) wird nie gesendet, auch ohne Lese-Schlüssel nicht', async () => {
  const vorher = ohneSchluessel;
  const { code, aus } = await lauf(null);
  assert.equal(code, 2, aus);
  assert.match(aus, /Netzwerk-Geheimnis für discord\.com fehlt/, 'ohne Lese-Schlüssel kein eigener Header: in der Cloud setzt ihn der Proxy');
  assert.ok(ohneSchluessel > vorher, 'die Anfrage ging ohne Authorization-Header raus');
  assert.equal(baumeisterGesehen, 0, 'der Builder-Schlüssel kam in keinem Lauf beim Nachbau an');
});
