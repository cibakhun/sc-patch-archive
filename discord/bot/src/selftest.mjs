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
      return [{ ...gespeichert }];
    },
    async setStats(id, patch) { writes.push({ id, patch }); return { updated: 1 }; },
  };
  const ctx = { home: { id: HOME }, db: fakeDb, siteDb };
  rows[A] = rows.a;
  // Gespeichert ist der aktuelle Stand mit EINEM abweichenden Feld.
  let gespeichert = { discord_user_id: A, ...rankSnapshot(fakeDb, HOME, A, true), level: 11 };
  await ta('rank mirror: only the home guild is read or written', async () => {
    await pushRank(ctx, guildOf('555555555555555555'), A);
    assert.equal(lists.length, 0, 'a foreign guild never reaches the site');
    await pushRank(ctx, guildOf(HOME), A);
    assert.equal(lists.length, 1);
    assert.equal(writes[0].id, A);
    assert.deepEqual(writes[0].patch, { level: 12 }, 'only the changed field is sent');
    gespeichert = { discord_user_id: A, ...rankSnapshot(fakeDb, HOME, A, true) };
    await pushRank(ctx, guildOf(HOME), A);
    assert.equal(writes.length, 1, 'an unchanged row is not written again');
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
    t('a deleted pinned role is replaced once a new one is found', () => {
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
    await ta('losing the last tester-named role revokes even while the mirror is off', async () => {
      const handlers = {};
      const writes = [];
      const ctx = {
        client: { on: (ev, fn) => { handlers[ev] = fn; } },
        home: { id: A },
        mirror: { roleId: null }, // Rolle doppelt -> Spiegel aus
        siteDb: { setTester: async (id, v) => { writes.push([id, v]); return { updated: 1 }; } },
      };
      registerRoleSync(ctx);
      const U = '999999999999999999', R1 = '555555555555555555', R2 = '666666666666666666';
      const m = (gid, ...rs) => ({ id: U, guild: { id: gid }, roles: { cache: new Map(rs) } });
      const loud = console.log; console.log = () => {};
      try {
        await handlers.guildMemberUpdate(m(A, role(R1, 'Test Pilots'), role(R2, 'Test Pilots')), m(A, role(R2, 'Test Pilots')));
        await handlers.guildMemberUpdate(m(A), m(A, role(R1, 'Test Pilots')));
        await handlers.guildMemberUpdate(m(B, role(R1, 'Test Pilots')), m(B));
        await handlers.guildMemberUpdate(m(A, role(R1, 'Test Pilots')), m(A));
      } finally { console.log = loud; }
      assert.deepEqual(writes, [[U, false]], 'never grants while off, keeps one of two, ignores foreign guilds, revokes the last');
    });
    const { reconcileRoles } = await import('./role-reconcile.mjs');
    await ta('a deleted tester role without a replacement revokes every pass; one never found leaves them', async () => {
      const U = '999999999999999999';
      const g = { id: '444444444444444444', name: 'G', roles: { cache: new Map([role(A, 'Test Pilots')]) } };
      g.members = { fetch: async () => new Map([[U, { id: U, roles: { cache: { has: (id) => id === A && g.roles.cache.has(A) } } }]]) };
      const writes = [];
      const siteDb = { listLinked: async () => [{ discord_user_id: U, is_tester: true }], setTester: async (id, v) => { writes.push([id, v]); return { updated: 1 }; } };
      const quiet = console.warn; const loud = console.log; console.warn = () => {}; console.log = () => {};
      try {
        const ctx = { home: { id: g.id }, siteDb, mirror: { roleId: null } };
        await reconcileRoles(ctx, g);
        assert.deepEqual(writes, [], 'holder of the pinned role keeps the pass');
        g.roles.cache.delete(A);
        await reconcileRoles(ctx, g);
        assert.deepEqual(writes, [[U, false]], 'deleted role: nobody can hold it, the pass goes');
        writes.length = 0;
        await reconcileRoles({ home: { id: g.id }, siteDb, mirror: { roleId: null } }, g);
        assert.deepEqual(writes, [], 'never found at start: passes stay untouched');
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
  await ta('function list reads page by page via offset', async () => {
    calls.length = 0;
    const page = JSON.stringify({ rows: Array.from({ length: 1000 }, (_, i) => ({ discord_user_id: String(i) })) });
    const { db } = createSiteDb({ ...base, BOT_ROLE_SYNC_SECRET: 's' }, { fetchImpl: fake([{ status: 200, body: page }, { status: 200, body: '{"rows":[{"discord_user_id":"x"}]}' }]) });
    const rows = await db.listLinked();
    assert.equal(rows.length, 1001);
    assert.deepEqual(JSON.parse(calls[0].init.body), { op: 'list' }, 'first page without offset');
    assert.deepEqual(JSON.parse(calls[1].init.body), { op: 'list', offset: 1000 });
  });
  await ta('a function without offset keeps the first page and says so', async () => {
    calls.length = 0;
    const said = [];
    const page = JSON.stringify({ rows: Array.from({ length: 1000 }, (_, i) => ({ discord_user_id: String(i) })) });
    const { db } = createSiteDb(
      { ...base, BOT_ROLE_SYNC_SECRET: 's' },
      { fetchImpl: fake([{ status: 200, body: page }, { status: 400, body: '{"error":"unknown_field"}' }]), log: (m) => said.push(m) },
    );
    assert.equal((await db.listLinked()).length, 1000);
    assert.match(said.join('\n'), /offset/);
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
  const { reconcileLeavers, retentionDays, markOrphanedGuilds, restoreGuild, runRetention, registerRetention } = await import('./retention.mjs');
  const { Events } = await import('discord.js');
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
  t('rows of a server without the bot run into the deadline, home never', () => {
    d.addXp('g2', 'p', 50); d.addXp('home', 'h', 70);
    assert.equal(markOrphanedGuilds(d, new Set(), 'home', now), 0, 'no server at all: wrong token, not a departure');
    assert.equal(markOrphanedGuilds(d, new Set([G]), 'home', now), 1);
    assert.equal(d.count('g2'), 0);
    assert.equal(d.count('home'), 1, 'home guild is never marked by absence');
    assert.equal(d.count(G), 2);
    assert.equal(d.purgeExpired(now, 0).users, 1);
    assert.equal(d.getUser('g2', 'p').xp, 0);
  });
  d.addXp('g3', 'a', 10); d.addXp('g3', 'b', 20); d.addXp('g3', 'self', 30);
  d.markLeft('g3', 'self', now - 2 * DAY);
  t('a server the bot rejoins gets its rows back, an own departure keeps its mark', () => {
    assert.equal(markOrphanedGuilds(d, new Set([G]), 'home', now), 2);
    assert.equal(d.count('g3'), 0);
    const on = {};
    registerRetention({ db: d, client: { on: (ev, fn) => { on[ev] = fn; } } });
    assert.equal(on[Events.GuildAvailable], on[Events.GuildCreate], 'a return during a reconnect arrives as GuildAvailable');
    on[Events.GuildCreate]({ id: 'g3', name: 'g3' });
    assert.equal(d.count('g3'), 2, 'the bot is invited back: its absence marks go');
    assert.equal(d.position('g3', 'self'), null, 'someone who left on their own stays marked');
    assert.equal(restoreGuild(d, 'g3'), 0, 'a second restore changes nothing');
  });
  // Rueckkehr waehrend einer Pause: kein GuildCreate, die Gilde ist beim
  // naechsten taeglichen Lauf einfach im Cache.
  // Der Mitgliederabruf dort scheitert: zurueckgeholt wird trotzdem, sonst
  // liefen Anwesende in die Frist einer Gilde, in der der Bot wieder ist.
  markOrphanedGuilds(d, new Set([G]), 'home', now);
  const gilde = (id, ids) => [id, { id, name: id, memberCount: ids?.length, members: { fetch: async () => {
    if (!ids) throw new Error('offline');
    return new Map(ids.map((u) => [u, {}]));
  } } }];
  // Frist ausdruecklich 30 Tage, unabhaengig vom LEAVER_RETENTION_DAYS der Umgebung.
  const lauf = (g3) => runRetention({ db: d, home: { id: 'home' }, client: { guilds: { cache: new Map([gilde(G, ['stay', 'back']), gilde('g3', g3)]) } } }, now + DAY, {});
  await lauf(null);
  const nachAbruffehler = { a: d.position('g3', 'a'), b: d.position('g3', 'b'), marke: d.getMeta('g3', 'bot_left_at') };
  await lauf(['a']);
  t('the daily run restores a server the bot came back to, even when its member fetch fails', () => {
    assert.deepEqual(nachAbruffehler, { a: 2, b: 1, marke: null }, 'both rows back on the board without a member list');
    assert.equal(d.position('g3', 'a'), 1);
    assert.equal(d.position('g3', 'b'), null, 'gone during the absence: marked by the next reconcile');
    assert.equal(d.getUser('g3', 'b').xp, 20, 'marked, not deleted');
  });
  // Eigene Datenbanken: Zeitstempel, Reihenfolge und Gildengrenzen der
  // Abwesenheitsmarken, unabhaengig vom Zustand oben.
  {
    const e = openDb(':memory:'), H = { id: 'home' }, T0 = 200 * DAY;
    const only = new Set(['home']);
    e.addXp('gR', 'a', 1); markOrphanedGuilds(e, only, 'home', T0);
    e.addXp('gR', 'late', 1);
    const spaeter = markOrphanedGuilds(e, only, 'home', T0 + DAY);
    e.addXp('gA', 'x', 1); e.addXp('gB', 'y', 1); markOrphanedGuilds(e, only, 'home', T0);
    e.addXp('gS', 'old', 1); markOrphanedGuilds(e, only, 'home', T0);
    e.purgeExpired(T0, 0); // auch gR/gA/gB: alles mit T0 ist abgelaufen -- deshalb erst danach pruefen
    t('one absence keeps one timestamp; a purged one does not lend its deadline to the next', () => {
      assert.equal(spaeter, 1);
      assert.equal(e.getUser('gS', 'old').xp, 0);
      e.addXp('gS', 'new', 1);
      assert.equal(markOrphanedGuilds(e, only, 'home', T0 + 100 * DAY), 1);
      assert.equal(e.getMeta('gS', 'bot_left_at'), String(T0 + 100 * DAY), 'a fresh absence starts its own deadline');
      assert.equal(e.purgeExpired(T0 + 99 * DAY, 0).users, 0, 'the new row is not already expired');
    });
    const f = openDb(':memory:');
    f.addXp('gR', 'a', 1); markOrphanedGuilds(f, only, 'home', T0);
    f.addXp('gR', 'late', 1); markOrphanedGuilds(f, only, 'home', T0 + DAY);
    f.addXp('gA', 'x', 1); f.addXp('gB', 'y', 1); markOrphanedGuilds(f, only, 'home', T0 + 2 * DAY);
    t('restore takes back every row of that absence and only in that server', () => {
      assert.equal(f.getMeta('gR', 'bot_left_at'), String(T0));
      assert.equal(restoreGuild(f, 'gR'), 2, 'rows marked later in the same absence come back too');
      assert.equal(restoreGuild(f, 'gA'), 1);
      assert.equal(f.count('gB'), 0, 'same timestamp, other server: stays marked');
    });
    f.close();
    // Reihenfolge: zuruecknehmen VOR dem Abgleich, sonst kaeme wer waehrend
    // der Abwesenheit ging zurueck auf die Bestenliste.
    const r = openDb(':memory:');
    r.addXp('g4', 'a', 1); r.addXp('g4', 'b', 1); markOrphanedGuilds(r, only, 'home', T0);
    await runRetention({ db: r, home: H, client: { guilds: { cache: new Map([gilde('g4', ['a'])]) } } }, T0 + DAY, {});
    const reihenfolge = { a: r.position('g4', 'a'), b: r.position('g4', 'b') };
    // Gilde verschwindet waehrend des Laufs (Abruf einer anderen Gilde laeuft noch).
    r.addXp('g5', 'left', 1); r.addXp('g5', 'stay', 1); r.addXp('g6', 'z', 1);
    const cache = new Map([gilde('g5', ['stay'])]);
    cache.set('g6', { id: 'g6', name: 'g6', memberCount: 1, members: { fetch: async () => { cache.delete('g5'); return new Map([['z', {}]]); } } });
    await runRetention({ db: r, home: H, client: { guilds: { cache } } }, T0 + 2 * DAY, {});
    const nachLauf = { meta: r.getMeta('g5', 'bot_left_at'), stay: r.position('g5', 'stay') };
    await runRetention({ db: r, home: H, client: { guilds: { cache } } }, T0 + 3 * DAY, {});
    t('the daily run restores before it reconciles, and never folds this run\'s departures into an absence', () => {
      assert.deepEqual(reihenfolge, { a: 1, b: null }, 'gone during the absence stays off the board');
      assert.deepEqual(nachLauf, { meta: null, stay: 1 }, 'removed mid-run: marked on the next run, not with this run\'s timestamp');
      assert.equal(r.getMeta('g5', 'bot_left_at'), String(T0 + 3 * DAY));
      assert.equal(restoreGuild(r, 'g5'), 1);
      assert.equal(r.position('g5', 'left'), null, 'their own departure keeps its mark');
    });
    // Zurueck waehrend einer Bot-Pause, und am Fristtag scheitert der Abruf:
    // geloescht wird dort dann nicht.
    const z = openDb(':memory:');
    z.addXp('home', 'U', 900); z.markBugXp('thr-U', 'home', 'U'); z.markLeft('home', 'U', T0);
    const heim = (ids) => ({ db: z, home: H, client: { guilds: { cache: new Map([gilde('home', ids)]) } } });
    await runRetention(heim(null), T0 + 31 * DAY, {});
    const nachFehlschlag = { xp: z.getUser('home', 'U').xp, sperre: z.hasBugXp('thr-U') };
    await runRetention(heim(['U']), T0 + 32 * DAY, {});
    t('no deletion in a server whose member check failed that day', () => {
      assert.deepEqual(nachFehlschlag, { xp: 900, sperre: true }, 'a member who came back while the bot was down keeps their data');
      assert.equal(z.position('home', 'U'), 1, 'the next working check clears the mark');
    });
    z.close();
    // 0 Tage heisst: am naechsten taeglichen Lauf, nicht im selben.
    const n = openDb(':memory:');
    n.addXp('home', 'frueher', 1); n.markLeft('home', 'frueher', T0 - 1);
    n.addXp('home', 'jetzt', 1); n.addXp('gW', 'w', 1);
    const null0 = (t) => runRetention({ db: n, home: H, client: { guilds: { cache: new Map([gilde('home', [])]) } } }, t, { LEAVER_RETENTION_DAYS: '0' });
    await null0(T0);
    const erster = { frueher: n.getUser('home', 'frueher').xp, jetzt: n.getUser('home', 'jetzt').xp, w: n.getUser('gW', 'w').xp };
    await null0(T0 + DAY);
    t('with 0 days a row marked by this run goes at the next run, not in the same one', () => {
      assert.deepEqual(erster, { frueher: 0, jetzt: 1, w: 1 }, 'marked earlier: gone; marked by this run (reconcile, server without the bot): kept');
      assert.equal(n.getUser('home', 'jetzt').xp, 0);
      assert.equal(n.getUser('gW', 'w').xp, 0);
    });
    n.close();
    // Heim-Gilde fehlt im Cache (Bot dort versehentlich draussen) oder der
    // Bot ist in keiner Gilde: dort prueft heute niemand, also kein Loeschen.
    const h = openDb(':memory:');
    h.addXp('home', 'U', 900); h.markLeft('home', 'U', T0);
    h.addXp('gX', 'x', 5); h.markLeft('gX', 'x', T0);
    const ohneHeim = (cache) => runRetention({ db: h, home: H, client: { guilds: { cache } } }, T0 + 31 * DAY, {});
    await ohneHeim(new Map());
    const leer = { U: h.getUser('home', 'U').xp, x: h.getUser('gX', 'x').xp };
    await ohneHeim(new Map([gilde('gY', [])]));
    t('no deletion in a home server the bot is not in, nor anywhere while it is in no server', () => {
      assert.deepEqual(leer, { U: 900, x: 5 }, 'in no server at all: nothing is deleted');
      assert.equal(h.getUser('home', 'U').xp, 900, 'home missing from the cache keeps its rows');
      assert.equal(h.getUser('gX', 'x').xp, 0, 'a server without the bot still runs into the deadline');
    });
    h.close();
    // Heim-Gilden-ID ungueltig (Tippfehler in HOME_GUILD_ID): ohne sie ist
    // die Heim-Gilde nicht von einer fremden zu unterscheiden.
    const k = openDb(':memory:');
    k.addXp('home', 'U', 900);
    await runRetention({ db: k, home: { id: null }, client: { guilds: { cache: new Map([gilde('gY', [])]) } } }, T0, {});
    await runRetention({ db: k, home: { id: null }, client: { guilds: { cache: new Map([gilde('gY', [])]) } } }, T0 + 31 * DAY, {});
    t('without a valid home server ID no server counts as left by the bot', () => {
      assert.equal(k.getUser('home', 'U').xp, 900);
      assert.equal(k.position('home', 'U'), 1, 'not even marked');
      assert.equal(markOrphanedGuilds(k, new Set(['gY']), null, T0), 0);
    });
    k.close();
    // Discord bremst den vollen Mitgliederabruf (einer je Gilde und 30 s):
    // einmal abwarten, dann gilt der Abgleich; ein zweites Mal nicht.
    const q = openDb(':memory:');
    q.addXp('home', 'weg', 1); q.addXp('home', 'da', 1);
    const gebremst = (mal) => {
      let n = 0;
      return { id: 'home', name: 'home', memberCount: 1, members: { fetch: async () => {
        if (n++ < mal) throw Object.assign(new Error('Request with opcode 8 was rate limited.'), { name: 'GatewayRateLimitError', data: { retry_after: 2.5 } });
        return new Map([['da', {}]]);
      } } };
    };
    const gewartet = [];
    const bremse = (g) => runRetention({ db: q, home: H, client: { guilds: { cache: new Map([['home', g]]) } } }, T0, {}, async (ms) => { gewartet.push(ms); });
    await bremse(gebremst(2));
    const zweimal = { weg: q.position('home', 'weg'), gewartet: [...gewartet] };
    await bremse(gebremst(1));
    t('a rate-limited member fetch waits once as told and then counts', () => {
      assert.deepEqual(zweimal, { weg: 1, gewartet: [3500] }, 'limited twice: skipped, nobody marked on suspicion');
      assert.deepEqual(gewartet, [3500, 3500]);
      assert.equal(q.position('home', 'weg'), null, 'limited once: the reconcile ran and marked the leaver');
      assert.equal(q.position('home', 'da'), 1);
    });
    q.close();
    r.close(); e.close();
  }
  t('LEAVER_RETENTION_DAYS: default 30, 0 allowed, capped at 365, junk ignored', () => {
    assert.equal(retentionDays({}), 30);
    assert.equal(retentionDays({ LEAVER_RETENTION_DAYS: '0' }), 0);
    assert.equal(retentionDays({ LEAVER_RETENTION_DAYS: '365' }), 365);
    assert.equal(retentionDays({ LEAVER_RETENTION_DAYS: '400' }), 365, 'above the cap keeps longer, never falls back to 30');
    assert.equal(retentionDays({ LEAVER_RETENTION_DAYS: '-3' }), 30);
    assert.equal(retentionDays({ LEAVER_RETENTION_DAYS: '30.5' }), 30);
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
  // Fehlende Daten fangen die Zweige oben ab (latestPatch/findShip -> null);
  // was hier ankommt, ist ein echter Fehlschlag und soll den Lauf reissen.
  if (e.code === 'ERR_MODULE_NOT_FOUND') console.log('  · skipped (run `npm install`)');
  else throw e;
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
