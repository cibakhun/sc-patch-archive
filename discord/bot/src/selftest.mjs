// ═══════════════════════════════════════════════════════════════════════════
//  selftest.mjs — offline verification. No token, no database, no network.
//  Exercises the XP curve, level<->xp round-trips, multipliers, the rank
//  ladder and prestige, config merging, and (if discord.js is installed) the
//  full slash-command tree. Exits non-zero on any failure.
// ═══════════════════════════════════════════════════════════════════════════
import assert from 'node:assert/strict';
import { xpToNext, totalXpForLevel, levelForXp, progress, effectiveMultiplier, applyMultiplier, randomXp } from './leveling.mjs';
import { RANKS, rankForLevel, nextRank, rankRoleName, allRankRoleNames, prestigeStars, rankBlurb, rankPermissions, TRUSTED_PERMS, TRUSTED_LEVEL } from './ranks.mjs';
import { DEFAULT_CONFIG, mergeConfig, isNoXpChannel } from './config.mjs';
import { STRINGS, LOCALES, t as tr, resolveLocale } from './i18n.mjs';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); };
const ta = async (name, fn) => { await fn(); n++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); };

console.log('\n▸ Leveling math');
t('xpToNext(0) = 100 and grows', () => {
  assert.equal(xpToNext(0), 100);
  for (let l = 1; l < 50; l++) assert.ok(xpToNext(l) > xpToNext(l - 1));
});
t('totalXpForLevel base cases', () => {
  assert.equal(totalXpForLevel(0), 0);
  assert.equal(totalXpForLevel(1), 100);
  assert.equal(totalXpForLevel(2), 100 + xpToNext(1));
});
t('levelForXp round-trips for L=0..150', () => {
  for (let L = 0; L <= 150; L++) {
    const base = totalXpForLevel(L);
    assert.equal(levelForXp(base), L, `floor of level ${L}`);
    assert.equal(levelForXp(base + xpToNext(L) - 1), L, `just below ${L + 1}`);
    assert.equal(levelForXp(totalXpForLevel(L + 1)), L + 1, `reach ${L + 1}`);
  }
});
t('levelForXp handles zero/negative', () => {
  assert.equal(levelForXp(0), 0);
  assert.equal(levelForXp(-999), 0);
});
t('progress is consistent', () => {
  const L = 10;
  const p0 = progress(totalXpForLevel(L));
  assert.equal(p0.level, L);
  assert.equal(p0.into, 0);
  assert.equal(p0.remaining, xpToNext(L));
  assert.equal(p0.pct, 0);
  const mid = progress(totalXpForLevel(L) + Math.floor(xpToNext(L) / 2));
  assert.ok(mid.pct > 0.4 && mid.pct < 0.6);
});
t('randomXp stays in range', () => {
  for (let i = 0; i < 500; i++) { const x = randomXp(15, 25); assert.ok(x >= 15 && x <= 25); }
});

console.log('\n▸ Multipliers');
t('defaults give ×1', () => assert.equal(effectiveMultiplier(DEFAULT_CONFIG, { channelId: 'c', roleIds: [] }), 1));
t('booster stacks', () => assert.equal(effectiveMultiplier(DEFAULT_CONFIG, { isBooster: true }), 1.5));
t('global event multiplier', () => {
  const c = mergeConfig(DEFAULT_CONFIG, { multipliers: { global: 2 } });
  assert.equal(effectiveMultiplier(c, {}), 2);
});
t('channel 0 disables', () => {
  const c = mergeConfig(DEFAULT_CONFIG, { multipliers: { channels: { x: 0 } } });
  assert.equal(effectiveMultiplier(c, { channelId: 'x' }), 0);
});
t('highest role multiplier wins', () => {
  const c = mergeConfig(DEFAULT_CONFIG, { multipliers: { roles: { a: 1.2, b: 2 } } });
  assert.equal(effectiveMultiplier(c, { roleIds: ['a', 'b'] }), 2);
});
t('prestige bonus applies', () => {
  assert.equal(effectiveMultiplier(DEFAULT_CONFIG, { prestigeStars: 2 }), 1 + 0.1 * 2);
});
t('applyMultiplier floors & clamps', () => {
  assert.equal(applyMultiplier(20, 1.5), 30);
  assert.equal(applyMultiplier(21, 1.5), 31); // floor(31.5)
  assert.equal(applyMultiplier(10, 0), 0);
});

console.log('\n▸ Rank ladder');
t('ranks ascend, keys/colors valid & unique', () => {
  const keys = new Set(); const names = new Set();
  let last = -1;
  for (const r of RANKS) {
    assert.ok(r.level > last, `levels ascend at ${r.key}`); last = r.level;
    assert.ok(/^#[0-9a-fA-F]{6}$/.test(r.color), `hex color ${r.key}`);
    assert.ok(!keys.has(r.key)); keys.add(r.key);
    assert.ok(!names.has(r.name)); names.add(r.name);
    assert.ok(r.insignia && r.blurb);
  }
});
t('rankForLevel picks correct tier', () => {
  assert.equal(rankForLevel(0).key, 'drifter');
  assert.equal(rankForLevel(4).key, 'drifter');
  assert.equal(rankForLevel(5).key, 'prospect');
  assert.equal(rankForLevel(15).key, 'citizen');
  assert.equal(rankForLevel(100).key, 'frontier-legend');
  assert.equal(rankForLevel(9999).key, 'frontier-legend');
});
t('nextRank works and maxes out', () => {
  assert.equal(nextRank(0).key, 'prospect');
  assert.equal(nextRank(14).key, 'citizen');
  assert.equal(nextRank(100), null);
});
t('role names carry insignia and are unique', () => {
  const names = allRankRoleNames();
  assert.equal(names.length, RANKS.length);
  assert.equal(new Set(names).size, RANKS.length);
  assert.ok(rankRoleName(RANKS[3]).includes(RANKS[3].name));
});
t('prestige stars render', () => {
  assert.equal(prestigeStars(0), '');
  assert.equal(prestigeStars(3).length, 3);
});

console.log('\n▸ Newcomer gate & no-XP');
t('rankPermissions gates below Prospect, trusts at/above', () => {
  const drifter = RANKS.find((r) => r.key === 'drifter');
  const prospect = RANKS.find((r) => r.key === 'prospect');
  assert.deepEqual(rankPermissions(drifter), []);
  assert.deepEqual(rankPermissions(prospect), TRUSTED_PERMS);
  assert.equal(TRUSTED_LEVEL, prospect.level);
  assert.ok(TRUSTED_PERMS.includes('EmbedLinks') && TRUSTED_PERMS.includes('AttachFiles'));
  for (const r of RANKS) assert.equal(rankPermissions(r).length, r.level >= TRUSTED_LEVEL ? TRUSTED_PERMS.length : 0, `rank ${r.key}`);
});
t('config carries the no-XP name list + announce channel name', () => {
  assert.ok(Array.isArray(DEFAULT_CONFIG.noXpChannelNames));
  assert.ok(DEFAULT_CONFIG.noXpChannelNames.includes('bot-commands'));
  assert.equal(typeof DEFAULT_CONFIG.announce.channelName, 'string');
});
t('isNoXpChannel matches id, name, and thread parent', () => {
  const cfg = mergeConfig(DEFAULT_CONFIG, { noXpChannels: ['id-123'] });
  assert.equal(isNoXpChannel({ id: 'id-123', name: '💬・general' }, cfg), true);   // by admin id
  assert.equal(isNoXpChannel({ id: 'x', name: '🤖・bot-commands' }, cfg), true);   // by blueprint name
  assert.equal(isNoXpChannel({ id: 'x', name: '💬・general' }, cfg), false);        // neither
  assert.equal(isNoXpChannel({ id: 't', name: 'a thread', parent: { id: 'p', name: '🤖・bot-commands' } }, cfg), true); // thread → parent
  assert.equal(isNoXpChannel({ id: 't', name: 'a thread', parentId: 'id-123' }, cfg), true);
  assert.equal(isNoXpChannel(null, cfg), false);
});

console.log('\n▸ Config');
t('mergeConfig deep-merges, arrays replace', () => {
  const c = mergeConfig(DEFAULT_CONFIG, { text: { min: 5 }, noXpChannels: ['a'] });
  assert.equal(c.text.min, 5);
  assert.equal(c.text.max, DEFAULT_CONFIG.text.max); // untouched
  assert.deepEqual(c.noXpChannels, ['a']);
  assert.equal(DEFAULT_CONFIG.text.min, 15); // original not mutated
});
t('defaults are sane', () => {
  assert.ok(DEFAULT_CONFIG.text.min <= DEFAULT_CONFIG.text.max);
  assert.ok(DEFAULT_CONFIG.prestige.atLevel > 0);
});

console.log('\n▸ i18n (EN / DE)');
const flatKeys = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) =>
  (v && typeof v === 'object' && !Array.isArray(v)) ? flatKeys(v, `${prefix}${k}.`) : [`${prefix}${k}`]);
t('EN and DE have identical key sets', () => {
  const en = new Set(flatKeys(STRINGS.en));
  const de = new Set(flatKeys(STRINGS.de));
  for (const k of en) assert.ok(de.has(k), `DE missing key "${k}"`);
  for (const k of de) assert.ok(en.has(k), `EN missing key "${k}"`);
  assert.equal(LOCALES.length, 2);
});
t('resolveLocale: role wins → client locale → English default', () => {
  const member = (roleName) => ({ roles: { cache: new Map([['r', { name: roleName }]]) } });
  assert.equal(resolveLocale(member('🇩🇪 Deutsch'), 'en-US'), 'de'); // role beats client
  assert.equal(resolveLocale(member('🇬🇧 English'), 'de'), 'en');
  assert.equal(resolveLocale(null, 'de'), 'de');     // client locale
  assert.equal(resolveLocale(null, 'en-US'), 'en');
  assert.equal(resolveLocale(null, null), 'en');     // default
});
t('t() interpolates, falls back to EN, then to the key', () => {
  assert.equal(tr('en', 'common.notFoundNone', { q: 'X' }), 'Nothing found for **X**.');
  assert.equal(tr('de', 'common.notFoundNone', { q: 'X' }), 'Nichts gefunden für **X**.');
  assert.equal(tr('xx', 'common.on'), 'on');          // unknown locale → EN
  assert.equal(tr('en', 'no.such.key'), 'no.such.key'); // missing → key visible
});
t('every rank has a German blurb', () => {
  for (const r of RANKS) {
    assert.ok(r.blurbDe && r.blurbDe !== r.blurb, `blurbDe for ${r.key}`);
    assert.equal(rankBlurb(r, 'de'), r.blurbDe);
    assert.equal(rankBlurb(r, 'en'), r.blurb);
  }
});

// Optional: exercise the real SQLite layer if better-sqlite3 is installed.
console.log('\n▸ Persistence (SQLite)');
try {
  const { openDb } = await import('./db.mjs');
  const { mkdtempSync, rmSync } = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const dir = mkdtempSync(path.join(os.tmpdir(), 'vb-rank-'));
  const db = openDb(path.join(dir, 'test.db'));

  t('addXp accumulates xp + stats', () => {
    db.addXp('g', 'u1', 100, { messages: 1 });
    const row = db.getUser('g', 'u1');
    assert.equal(row.xp, 100);
    assert.equal(row.total_xp, 100);
    assert.equal(row.messages, 1);
    assert.equal(levelForXp(row.xp), 1);
  });
  t('leaderboard orders by xp', () => {
    db.addXp('g', 'u2', 500);
    db.addXp('g', 'u3', 250);
    const board = db.leaderboard('g', 10);
    assert.deepEqual(board.map((r) => r.user_id), ['u2', 'u3', 'u1']);
  });
  t('position is 1-based', () => {
    assert.equal(db.position('g', 'u2'), 1);
    assert.equal(db.position('g', 'u1'), 3);
  });
  t('prestige resets xp but keeps lifetime + outranks', () => {
    db.setPrestige('g', 'u1', 1, 0);
    const row = db.getUser('g', 'u1');
    assert.equal(row.prestige, 1);
    assert.equal(row.xp, 0);
    assert.equal(row.total_xp, 100); // lifetime preserved
    assert.equal(db.leaderboard('g', 10)[0].user_id, 'u1'); // prestige outranks
  });
  t('config override persists + merges over defaults', () => {
    db.setConfig('g', { text: { min: 99 } });
    const c = db.getConfig('g');
    assert.equal(c.text.min, 99);
    assert.equal(c.text.max, DEFAULT_CONFIG.text.max);
  });
  t('setLevel + count', () => {
    db.setLevel('g', 'u4', 5);
    assert.equal(levelForXp(db.getUser('g', 'u4').xp), 5);
    assert.equal(db.count('g'), 4);
  });

  db.close();
  rmSync(dir, { recursive: true, force: true });
} catch (e) {
  if (e.code === 'ERR_MODULE_NOT_FOUND') console.log('  · skipped (run `npm install` for better-sqlite3)');
  else throw e;
}

// The boot-time avatar fallback — pure node builtins, so it always runs here.
console.log('\n▸ Avatar (first-boot fallback)');
{
  const { ensureAvatar } = await import('./avatar.mjs');
  const fakeClient = (avatar) => {
    const calls = [];
    return { calls, user: { avatar, setAvatar: async (buf) => { calls.push(buf); } } };
  };
  await (async () => {
    const c = fakeClient('a1b2c3');
    await ensureAvatar(c);
    t('leaves an existing avatar alone (never burns the rate limit)', () => assert.equal(c.calls.length, 0));
  })();
  await (async () => {
    const c = fakeClient(null);
    await ensureAvatar(c);
    t('sets a PNG when the bot has none', () => {
      assert.equal(c.calls.length, 1, 'setAvatar called once');
      assert.equal(c.calls[0].subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'sent a PNG');
    });
  })();
}

// Optional: validate the slash-command tree if discord.js is present.
console.log('\n▸ Slash commands');
try {
  const { buildCommandData } = await import('./commands.mjs');
  const data = buildCommandData();
  t('command tree builds', () => {
    assert.equal(data.length, 9);
    const names = data.map((d) => d.name).sort();
    assert.deepEqual(names, ['item', 'leaderboard', 'patch', 'price', 'rank', 'rank-admin', 'ranks', 'prestige', 'ship'].sort());
    const admin = data.find((d) => d.name === 'rank-admin');
    assert.ok(admin.options.length >= 5, 'admin has groups + subcommands');
  });
} catch (e) {
  if (e.code === 'ERR_MODULE_NOT_FOUND') console.log('  · skipped (run `npm install` to validate the command tree)');
  else throw e;
}

console.log('\n▸ Rank mirror (Kontoseite)');
{
  const { rankSnapshot, changedFields } = await import('./rank-sync.mjs');
  const rows = { a: { xp: totalXpForLevel(12) + 5, prestige: 0, total_xp: 9000, messages: 40, voice_seconds: 600, updated_at: 1 } };
  const fakeDb = {
    getUser: (g, u) => rows[u] || { xp: 0, prestige: 0, total_xp: 0, messages: 0, voice_seconds: 0, updated_at: 0 },
    position: (g, u) => (rows[u] ? 1 : null),
    count: () => 7,
  };
  t('snapshot carries level, rank and board position', () => {
    const s = rankSnapshot(fakeDb, 'g', 'a', true);
    assert.equal(s.level, 12);
    assert.equal(s.rank_key, rankForLevel(12).key);
    assert.equal(s.server_rank, 1);
    assert.equal(s.server_members, 7);
    assert.equal(s.in_guild, true);
  });
  t('unknown member: level 0, no board position', () => {
    const s = rankSnapshot(fakeDb, 'g', 'nobody', false);
    assert.equal(s.level, 0);
    assert.equal(s.rank_key, RANKS[0].key);
    assert.equal(s.server_rank, null);
  });
  t('only changed fields are written; unknown membership never overwrites', () => {
    const s = rankSnapshot(fakeDb, 'g', 'a', null);
    const stored = { ...s, in_guild: true };
    assert.deepEqual(changedFields(stored, s), {});
    assert.deepEqual(changedFields({ ...stored, level: 11 }, s), { level: 12 });
    assert.deepEqual(changedFields({}, { ...s, in_guild: false }).in_guild, false);
  });
  const { pushRank } = await import('./rank-sync.mjs');
  const HOME = '333333333333333333', A = '444444444444444444';
  const guildOf = (id) => ({ id, name: id, members: { cache: new Map([[A, {}]]), fetch: async () => { throw { code: 10007 }; } } });
  let aktiv = 0, hoechstens = 0;
  const lists = [], writes = [];
  const siteDb = {
    async listLinked(q) {
      lists.push(q); aktiv++; hoechstens = Math.max(hoechstens, aktiv);
      await new Promise((r) => setTimeout(r, 15));
      aktiv--;
      return [{ discord_user_id: A, level: 0 }];
    },
    async setStats(id, patch) { writes.push({ id, patch }); return { updated: 1 }; },
  };
  const ctx = { home: { id: HOME }, db: fakeDb, siteDb };
  rows[A] = rows.a;
  await ta('rank mirror: only the home guild is read or written', async () => {
    await pushRank(ctx, guildOf('555555555555555555'), A);
    assert.equal(lists.length, 0, 'a foreign guild never reaches the site');
    await pushRank(ctx, guildOf(HOME), A);
    assert.equal(lists.length, 1);
    assert.equal(writes[0].id, A);
    assert.equal(writes[0].patch.level, 12, 'only the changed level is sent');
  });
  await ta('rank mirror: two level-ups in a row never overlap', async () => {
    lists.length = 0; hoechstens = 0;
    await Promise.all([pushRank(ctx, guildOf(HOME), A), pushRank(ctx, guildOf(HOME), A)]);
    assert.equal(lists.length, 2);
    assert.equal(hoechstens, 1, 'second sync started before the first finished');
  });
}

console.log('\n▸ Heim-Gilde und Testpilot-Rolle');
{
  const { resolveHomeGuild, isHomeGuild, resolveTesterRole } = await import('./home-guild.mjs');
  const A = '111111111111111111', B = '222222222222222222';
  t('HOME_GUILD_ID wins, GUILD_ID next, site-invite last', () => {
    assert.equal(resolveHomeGuild({ HOME_GUILD_ID: A, GUILD_ID: A }).id, A);
    const both = resolveHomeGuild({ HOME_GUILD_ID: A, GUILD_ID: B });
    assert.equal(both.id, A);
    assert.ok(both.warning, 'divergent GUILD_ID is reported');
    assert.equal(resolveHomeGuild({ GUILD_ID: B }).id, B);
    const fallback = resolveHomeGuild({});
    assert.match(fallback.id, /^\d{17,20}$/);
    assert.equal(fallback.source, 'discord/site-invite.mjs');
  });
  t('a set but invalid id fails closed instead of falling through', () => {
    assert.equal(resolveHomeGuild({ HOME_GUILD_ID: 'nope', GUILD_ID: B }).id, null);
    assert.equal(resolveHomeGuild({ GUILD_ID: '12' }).id, null);
  });
  t('isHomeGuild accepts only the home id', () => {
    const ctx = { home: { id: A } };
    assert.equal(isHomeGuild(ctx, { id: A }), true);
    assert.equal(isHomeGuild(ctx, { id: B }), false);
    assert.equal(isHomeGuild({ home: { id: null } }, { id: A }), false);
  });
  const role = (id, name, managed = false) => [id, { id, name, managed }];
  const guild = (...rs) => ({ name: 'G', roles: { cache: new Map(rs) } });
  t('tester role: one name hit pins its id, two hits fail closed', () => {
    assert.equal(resolveTesterRole(guild(role(A, 'Test Pilots')), 'Test Pilots', {}).id, A);
    assert.equal(resolveTesterRole(guild(role(A, 'Test Pilots'), role(B, 'Test Pilots')), 'Test Pilots', {}).id, null);
    assert.equal(resolveTesterRole(guild(role(A, 'Test Pilots', true)), 'Test Pilots', {}).id, null, 'managed roles never count');
    assert.equal(resolveTesterRole(guild(), 'Test Pilots', {}).id, null);
  });
  t('TESTER_ROLE_ID beats the name and must exist', () => {
    const g = guild(role(A, 'Test Pilots'), role(B, 'Test Pilots'));
    assert.equal(resolveTesterRole(g, 'Test Pilots', { TESTER_ROLE_ID: B }).id, B);
    assert.equal(resolveTesterRole(g, 'Test Pilots', { TESTER_ROLE_ID: '333333333333333333' }).id, null);
  });
  t('the @everyone role (id = server id) is never the tester role', () => {
    const G = '444444444444444444';
    const g = { id: G, name: 'G', roles: { cache: new Map([role(G, '@everyone'), role(A, 'Test Pilots')]) } };
    const r = resolveTesterRole(g, 'Test Pilots', { TESTER_ROLE_ID: G });
    assert.equal(r.id, null);
    assert.match(r.error, /@everyone/);
  });

  try {
    const { pinTesterRole } = await import('./role-reconcile.mjs');
    const { registerRoleSync } = await import('./role-sync.mjs');
    t('a deleted pinned role is looked up again instead of staying pinned', () => {
      const g = guild(role(A, 'Test Pilots'));
      const ctx = { mirror: { roleId: null } };
      const quiet = console.warn; const loud = console.log; console.warn = () => {}; console.log = () => {};
      try {
        assert.equal(pinTesterRole(ctx, g), A);
        g.roles.cache.delete(A);
        g.roles.cache.set(B, { id: B, name: 'Test Pilots', managed: false });
        assert.equal(pinTesterRole(ctx, g), B);
      } finally { console.warn = quiet; console.log = loud; }
    });
    await ta('leaving the home guild revokes the pass even while the mirror is off', async () => {
      const handlers = {};
      const writes = [];
      const ctx = {
        client: { on: (ev, fn) => { handlers[ev] = fn; } },
        home: { id: A },
        mirror: { roleId: null }, // z. B. Rolle doppelt vorhanden -> Spiegel aus
        siteDb: { setTester: async (id, v) => { writes.push([id, v]); return { updated: 1 }; } },
      };
      registerRoleSync(ctx);
      const loud = console.log; console.log = () => {};
      try {
        await handlers.guildMemberRemove({ id: '999999999999999999', guild: { id: A } });
        await handlers.guildMemberRemove({ id: '888888888888888888', guild: { id: B } });
      } finally { console.log = loud; }
      assert.deepEqual(writes, [['999999999999999999', false]], 'home guild revokes, a foreign guild writes nothing');
    });
  } catch (e) {
    if (e.code === 'ERR_MODULE_NOT_FOUND') console.log('  · skipped (run `npm install` for discord.js)');
    else throw e;
  }
}

console.log('\n▸ Website-Spiegel (site-db)');
{
  const { createSiteDb } = await import('./site-db.mjs');
  const ID = '123456789012345678';
  const calls = [];
  const fake = (responses) => async (url, init) => {
    calls.push({ url, init });
    const r = responses.shift();
    return { ok: r.status < 300, status: r.status, text: async () => r.body, json: async () => JSON.parse(r.body) };
  };
  const base = { SUPABASE_URL: 'https://x.supabase.co' };
  t('no secret, no key: mirror inactive', () => {
    assert.equal(createSiteDb({}).db, null);
  });
  await ta('secret set: function is used, key stays unused', async () => {
    calls.length = 0;
    const { db } = createSiteDb({ ...base, BOT_ROLE_SYNC_SECRET: 's3cret' }, { fetchImpl: fake([{ status: 200, body: '{"updated":1}' }]) });
    assert.equal(db.mode, 'function');
    const r = await db.setTester(ID, true);
    assert.equal(r.updated, 1);
    assert.equal(calls[0].url, 'https://x.supabase.co/functions/v1/bot-role-sync');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer s3cret');
    assert.deepEqual(JSON.parse(calls[0].init.body), { op: 'set', discord_user_id: ID, is_tester: true });
  });
  await ta('function missing (404) falls back to the legacy key once per call', async () => {
    calls.length = 0;
    const { db } = createSiteDb(
      { ...base, BOT_ROLE_SYNC_SECRET: 's', SUPABASE_SERVICE_ROLE_KEY: 'k' },
      { fetchImpl: fake([{ status: 404, body: 'not found' }, { status: 200, body: '[{"discord_user_id":"x"}]' }]), log: () => {} },
    );
    const r = await db.setTester(ID, false);
    assert.equal(r.updated, 1);
    assert.match(calls[1].url, /\/rest\/v1\/discord_role_state\?discord_user_id=eq\./);
  });
  await ta('wrong secret (401) does NOT fall back', async () => {
    const { db } = createSiteDb(
      { ...base, BOT_ROLE_SYNC_SECRET: 's', SUPABASE_SERVICE_ROLE_KEY: 'k' },
      { fetchImpl: fake([{ status: 401, body: 'unauthorized' }]), log: () => {} },
    );
    await assert.rejects(() => db.setTester(ID, true), /401/);
  });
  await ta('stats only carries whitelisted fields', async () => {
    calls.length = 0;
    const { db } = createSiteDb({ ...base, BOT_ROLE_SYNC_SECRET: 's' }, { fetchImpl: fake([{ status: 200, body: '{"updated":1}' }]) });
    await db.setStats(ID, { level: 3, is_tester: true, user_id: 'evil' });
    assert.deepEqual(JSON.parse(calls[0].init.body).patch, { level: 3 });
  });
  await ta('ids that are not Discord snowflakes are refused before any request', async () => {
    calls.length = 0;
    const { db } = createSiteDb({ ...base, BOT_ROLE_SYNC_SECRET: 's' }, { fetchImpl: fake([]) });
    await assert.rejects(() => db.setTester('1 or 1=1', true), /Discord-ID/);
    assert.equal(calls.length, 0);
  });
  await ta('legacy list reads page by page past the 1000-row cap', async () => {
    calls.length = 0;
    const page = JSON.stringify(Array.from({ length: 1000 }, (_, i) => ({ discord_user_id: String(i) })));
    const { db } = createSiteDb(
      { ...base, SUPABASE_SERVICE_ROLE_KEY: 'k' },
      { fetchImpl: fake([{ status: 200, body: page }, { status: 200, body: '[{"discord_user_id":"x"}]' }]), log: () => {} },
    );
    const rows = await db.listLinked();
    assert.equal(rows.length, 1001);
    assert.equal(calls.length, 2);
    assert.match(calls[1].url, /&limit=1000&offset=1000$/);
  });
}

console.log('\n▸ Datenfrist (retention)');
try {
  const { openDb } = await import('./db.mjs');
  const { reconcileLeavers, retentionDays } = await import('./retention.mjs');
  const d = openDb(':memory:');
  const G = 'g1', DAY = 86_400_000, now = 100 * DAY;
  d.addXp(G, 'stay', 500); d.addXp(G, 'gone', 900); d.addXp(G, 'back', 300);
  d.markBugXp('thread-gone', G, 'gone');
  t('leavers are marked, returners cleared, present members untouched', () => {
    d.markLeft(G, 'back', now - 5 * DAY);
    const r = reconcileLeavers(d, G, new Set(['stay', 'back']), now - 40 * DAY);
    assert.deepEqual(r, { seen: 3, marked: 1, cleared: 1 });
    assert.equal(d.count(G), 2, 'a leaver drops off the board');
    assert.equal(d.position(G, 'gone'), null);
  });
  t('purge removes expired leavers and their bug locks, keeps the rest', () => {
    const out = d.purgeExpired(now - 30 * DAY, now - 30 * DAY);
    assert.equal(out.users, 1);
    assert.equal(d.getUser(G, 'gone').xp, 0);
    assert.equal(d.hasBugXp('thread-gone'), false);
    assert.equal(d.getUser(G, 'stay').xp, 500);
    assert.equal(d.getUser(G, 'back').xp, 300);
  });
  t('LEAVER_RETENTION_DAYS: default 30, 0 allowed, junk ignored', () => {
    assert.equal(retentionDays({}), 30);
    assert.equal(retentionDays({ LEAVER_RETENTION_DAYS: '0' }), 0);
    assert.equal(retentionDays({ LEAVER_RETENTION_DAYS: '-3' }), 30);
    assert.equal(retentionDays({ LEAVER_RETENTION_DAYS: 'viel' }), 30);
  });
  d.close();
} catch (e) {
  if (e.code === 'ERR_MODULE_NOT_FOUND' || /better-sqlite3|bindings/.test(e.message)) console.log('  · skipped (run `npm install` for better-sqlite3)');
  else throw e;
}

// Bilingual data projections (needs the bundled game-data snapshot present).
console.log('\n▸ Bilingual data');
try {
  const { latestPatch, localizedPatch, findShip, localizedShip } = await import('./data.mjs');
  const p = latestPatch();
  if (p) {
    t('patch English overlay applies (guards the German-leak bug)', () => {
      const en = localizedPatch(p, 'en');
      const de = localizedPatch(p, 'de');
      assert.ok(en.summary && de.summary, 'both summaries present');
      assert.notEqual(en.summary, de.summary, 'EN and DE summaries must differ');
      assert.notEqual(en.dateDisplay, de.dateDisplay, 'dates localize');
    });
  } else {
    console.log('  · no patch data found — skipped patch projection');
  }
  const ship = findShip('Carrack');
  if (ship) {
    t('ship size localizes (Groß ↔ Large)', () => {
      const en = localizedShip(ship, 'en');
      const de = localizedShip(ship, 'de');
      assert.ok(en.size && de.size, 'size present in both');
    });
  } else {
    console.log('  · no ship data found — skipped ship projection');
  }
} catch (e) {
  if (e.code === 'ERR_MODULE_NOT_FOUND') console.log('  · skipped (run `npm install`)');
  else console.log(`  · skipped (${e.message})`);
}

// Sperrklinke fuer den Lauf im Bot-Image (discord/bot/Dockerfile setzt
// SELFTEST_MIN): ein Abschnitt, der dort still "skipped" meldet, weil eine
// Abhaengigkeit fehlt, soll den Bau reissen statt durchzuwinken.
const min = Number(process.env.SELFTEST_MIN || 0);
if (n < min) {
  console.error(`\n\x1b[31;1m✗ nur ${n} Pruefungen gelaufen, erwartet mindestens ${min} — ein Abschnitt wurde uebersprungen.\x1b[0m\n`);
  process.exit(1);
}
console.log(`\n\x1b[32;1m✓ ${n} checks passed.\x1b[0m\n`);
