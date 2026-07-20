// ═══════════════════════════════════════════════════════════════════════════
//  db.mjs — SQLite persistence (better-sqlite3, synchronous + WAL).
//
//  One file, three concerns: per-user XP/level/prestige/stats, per-guild config
//  overrides (stored as one JSON blob, merged over DEFAULT_CONFIG on read), and
//  the leaderboard/position queries. Prepared statements are created once.
// ═══════════════════════════════════════════════════════════════════════════
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_CONFIG, mergeConfig } from './config.mjs';
import { totalXpForLevel } from './leveling.mjs';

export function openDb(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      guild_id      TEXT    NOT NULL,
      user_id       TEXT    NOT NULL,
      xp            INTEGER NOT NULL DEFAULT 0,   -- XP in the current prestige run
      prestige      INTEGER NOT NULL DEFAULT 0,   -- prestige stars
      total_xp      INTEGER NOT NULL DEFAULT 0,   -- lifetime XP, never reset
      messages      INTEGER NOT NULL DEFAULT 0,
      voice_seconds INTEGER NOT NULL DEFAULT 0,
      updated_at    INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (guild_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_users_board ON users (guild_id, prestige DESC, xp DESC);

    CREATE TABLE IF NOT EXISTS guild_config (
      guild_id TEXT PRIMARY KEY,
      json     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meta (
      guild_id TEXT NOT NULL,
      key      TEXT NOT NULL,
      value    TEXT,
      PRIMARY KEY (guild_id, key)
    );
  `);

  const S = {
    get:         db.prepare('SELECT * FROM users WHERE guild_id=? AND user_id=?'),
    bump:        db.prepare(`INSERT INTO users (guild_id,user_id,xp,total_xp,messages,voice_seconds,updated_at)
                             VALUES (@g,@u,@xp,@txp,@msg,@vs,@ts)
                             ON CONFLICT(guild_id,user_id) DO UPDATE SET
                               xp=xp+@xp, total_xp=total_xp+@txp,
                               messages=messages+@msg, voice_seconds=voice_seconds+@vs,
                               updated_at=@ts`),
    setXp:       db.prepare(`INSERT INTO users (guild_id,user_id,xp,total_xp,updated_at)
                             VALUES (@g,@u,@xp,@xp,@ts)
                             ON CONFLICT(guild_id,user_id) DO UPDATE SET xp=@xp, updated_at=@ts`),
    setPrestige: db.prepare('UPDATE users SET prestige=@prestige, xp=@xp, updated_at=@ts WHERE guild_id=@g AND user_id=@u'),
    del:         db.prepare('DELETE FROM users WHERE guild_id=? AND user_id=?'),
    board:       db.prepare('SELECT * FROM users WHERE guild_id=? ORDER BY prestige DESC, xp DESC LIMIT ? OFFSET ?'),
    ahead:       db.prepare('SELECT COUNT(*) AS n FROM users WHERE guild_id=@g AND (prestige > @p OR (prestige=@p AND xp > @x))'),
    count:       db.prepare('SELECT COUNT(*) AS n FROM users WHERE guild_id=?'),
    getCfg:      db.prepare('SELECT json FROM guild_config WHERE guild_id=?'),
    setCfg:      db.prepare(`INSERT INTO guild_config (guild_id,json) VALUES (?,?)
                             ON CONFLICT(guild_id) DO UPDATE SET json=excluded.json`),
    getMeta:     db.prepare('SELECT value FROM meta WHERE guild_id=? AND key=?'),
    setMeta:     db.prepare(`INSERT INTO meta (guild_id,key,value) VALUES (?,?,?)
                             ON CONFLICT(guild_id,key) DO UPDATE SET value=excluded.value`),
  };

  const zero = (g, u) => ({ guild_id: g, user_id: u, xp: 0, prestige: 0, total_xp: 0, messages: 0, voice_seconds: 0, updated_at: 0 });

  return {
    raw: db,

    getUser(g, u) {
      return S.get.get(g, u) || zero(g, u);
    },

    /** Add XP (and optionally message/voice stats). Returns the updated row. */
    addXp(g, u, xp, { messages = 0, voiceSeconds = 0 } = {}) {
      S.bump.run({ g, u, xp, txp: xp, msg: messages, vs: voiceSeconds, ts: Date.now() });
      return S.get.get(g, u);
    },

    /** Bump stats without granting XP (e.g. a message during cooldown). */
    addStats(g, u, { messages = 0, voiceSeconds = 0 } = {}) {
      S.bump.run({ g, u, xp: 0, txp: 0, msg: messages, vs: voiceSeconds, ts: Date.now() });
    },

    /** Admin: hard-set current-run XP. */
    setXp(g, u, xp) {
      S.setXp.run({ g, u, xp: Math.max(0, Math.floor(xp)), ts: Date.now() });
      return S.get.get(g, u);
    },

    /** Admin: set level (converts to the XP floor of that level). */
    setLevel(g, u, level) {
      return this.setXp(g, u, totalXpForLevel(Math.max(0, Math.floor(level))));
    },

    /** Set prestige stars and reset current-run XP. */
    setPrestige(g, u, prestige, xp = 0) {
      this.addStats(g, u, {}); // ensure the row exists
      S.setPrestige.run({ g, u, prestige, xp, ts: Date.now() });
      return S.get.get(g, u);
    },

    reset(g, u) {
      S.del.run(g, u);
    },

    leaderboard(g, limit, offset = 0) {
      return S.board.all(g, limit, offset);
    },

    /** 1-based position on the leaderboard, or null if the user has no row. */
    position(g, u) {
      const row = S.get.get(g, u);
      if (!row) return null;
      return S.ahead.get({ g, p: row.prestige, x: row.xp }).n + 1;
    },

    count(g) {
      return S.count.get(g).n;
    },

    /** Merged, ready-to-use config for a guild. */
    getConfig(g) {
      const row = S.getCfg.get(g);
      return mergeConfig(DEFAULT_CONFIG, row ? JSON.parse(row.json) : null);
    },

    /** Just the stored override object (for editing via /rank-config). */
    getConfigOverride(g) {
      const row = S.getCfg.get(g);
      return row ? JSON.parse(row.json) : {};
    },

    setConfig(g, override) {
      S.setCfg.run(g, JSON.stringify(override));
    },

    getMeta(g, key) {
      const r = S.getMeta.get(g, key);
      return r ? r.value : null;
    },

    setMeta(g, key, value) {
      S.setMeta.run(g, key, value == null ? null : String(value));
    },

    close() {
      db.close();
    },
  };
}
