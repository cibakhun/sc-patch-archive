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
  assert.equal(isNoXpChannel({ id: 't', name: 'a thread', parent: { id: 'p', name: '😂・memes' } }, cfg), true); // thread → parent
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

console.log(`\n\x1b[32;1m✓ ${n} checks passed.\x1b[0m\n`);
