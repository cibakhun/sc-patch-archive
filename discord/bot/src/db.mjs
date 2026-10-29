// ═══════════════════════════════════════════════════════════════════════════
//  db.mjs — SQLite persistence (better-sqlite3, synchronous + WAL).
//
//  One file, three concerns: per-user XP/level/prestige/stats, per-guild config
//  overrides (stored as one JSON blob, merged over DEFAULT_CONFIG on read), and
//  the leaderboard/position queries. Prepared statements are created once.
//
//  Aufbewahrung (retention.mjs): verlaesst jemand den Server, bekommt seine
//  Zeile ein left_at. Nach der Frist (LEAVER_RETENTION_DAYS) loescht der
//  taegliche Lauf sie samt Fehlerbericht-Sperren; ein Wiedereintritt vor
//  Fristende nimmt die Marke zurueck, der Rang bleibt dann erhalten.
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

    -- Einmal-je-Thread-Sperre fuer den Fehlerbericht-XP-Bonus (D-21, Phase 14
    -- Plan 11). thread_id ist der Primaerschluessel und IST die Sperre -- ein
    -- zweiter Versuch fuer denselben Thread schlaegt auf der Eindeutigkeit
    -- auf, kein Sonderfall im Aufrufer-Code noetig. Siehe bug-thread-xp.mjs.
    CREATE TABLE IF NOT EXISTS bug_xp_threads (
      thread_id  TEXT    PRIMARY KEY,
      guild_id   TEXT    NOT NULL,
      user_id    TEXT    NOT NULL,
      granted_at INTEGER NOT NULL
    );
  `);

  // Bestandsdatenbanken vor der Aufbewahrungsfrist kennen left_at noch nicht.
  // ALTER TABLE ADD COLUMN ist in SQLite billig und laesst alle Zeilen auf NULL.
  const userCols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  if (!userCols.includes('left_at')) db.exec('ALTER TABLE users ADD COLUMN left_at INTEGER');

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
    // Ausgetretene (left_at gesetzt) stehen waehrend der Frist nicht mehr auf
    // der Bestenliste und zaehlen nicht mit.
    board:       db.prepare('SELECT * FROM users WHERE guild_id=? AND left_at IS NULL ORDER BY prestige DESC, xp DESC LIMIT ? OFFSET ?'),
    ahead:       db.prepare('SELECT COUNT(*) AS n FROM users WHERE guild_id=@g AND left_at IS NULL AND (prestige > @p OR (prestige=@p AND xp > @x))'),
    count:       db.prepare('SELECT COUNT(*) AS n FROM users WHERE guild_id=? AND left_at IS NULL'),
    getCfg:      db.prepare('SELECT json FROM guild_config WHERE guild_id=?'),
    setCfg:      db.prepare(`INSERT INTO guild_config (guild_id,json) VALUES (?,?)
                             ON CONFLICT(guild_id) DO UPDATE SET json=excluded.json`),
    getMeta:     db.prepare('SELECT value FROM meta WHERE guild_id=? AND key=?'),
    setMeta:     db.prepare(`INSERT INTO meta (guild_id,key,value) VALUES (?,?,?)
                             ON CONFLICT(guild_id,key) DO UPDATE SET value=excluded.value`),
    getBugXp:    db.prepare('SELECT 1 FROM bug_xp_threads WHERE thread_id=?'),
    setBugXp:    db.prepare('INSERT INTO bug_xp_threads (thread_id,guild_id,user_id,granted_at) VALUES (?,?,?,?)'),
    markLeft:    db.prepare('UPDATE users SET left_at=@ts WHERE guild_id=@g AND user_id=@u AND left_at IS NULL'),
    clearLeft:   db.prepare('UPDATE users SET left_at=NULL WHERE guild_id=? AND user_id=? AND left_at IS NOT NULL'),
    members:     db.prepare('SELECT user_id, left_at FROM users WHERE guild_id=?'),
    openGuilds:  db.prepare('SELECT DISTINCT guild_id FROM users WHERE left_at IS NULL'),
    markGuild:   db.prepare('UPDATE users SET left_at=@ts WHERE guild_id=@g AND left_at IS NULL'),
    clearGuild:  db.prepare('UPDATE users SET left_at=NULL WHERE guild_id=@g AND left_at=@ts'),
    expired:     db.prepare('SELECT guild_id, user_id FROM users WHERE left_at IS NOT NULL AND left_at <= ?'),
    delBugXpOf:  db.prepare('DELETE FROM bug_xp_threads WHERE guild_id=? AND user_id=?'),
    delBugXpOld: db.prepare('DELETE FROM bug_xp_threads WHERE granted_at <= ?'),
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
      if (!row || row.left_at != null) return null;
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

    /** "schon vergeben?" -- die Einmal-je-Thread-Sperre fuer den
     * Fehlerbericht-XP-Bonus (D-21). Der eigentliche Schutz ist der
     * Primaerschluessel auf thread_id; dies ist die lesende Vorabpruefung. */
    hasBugXp(threadId) {
      return !!S.getBugXp.get(threadId);
    },

    /** "als vergeben eintragen" -- wird vom Aufrufer ERST NACH einem
     * erfolgreichen grantXp() aufgerufen (siehe bug-thread-xp.mjs). */
    markBugXp(threadId, guildId, userId) {
      S.setBugXp.run(threadId, guildId, userId, Date.now());
    },

    /** Austritt vormerken (Frist laeuft ab jetzt). Nur wer eine Zeile hat. */
    markLeft(g, u, ts = Date.now()) {
      return S.markLeft.run({ g, u, ts }).changes;
    },

    /** Wiedereintritt vor Fristende: Marke weg, Rang bleibt. */
    clearLeft(g, u) {
      return S.clearLeft.run(g, u).changes;
    },

    /** Alle Nutzerzeilen einer Gilde mit ihrer Austrittsmarke (oder null). */
    knownUsers(g) {
      return S.members.all(g);
    },

    /** Gilden mit mindestens einer noch nicht vorgemerkten Zeile. */
    openGuilds() {
      return S.openGuilds.all().map((r) => r.guild_id);
    },

    /** Alle offenen Zeilen einer Gilde vormerken (Bot nicht mehr dort). */
    markGuildLeft(g, ts = Date.now()) {
      return S.markGuild.run({ g, ts }).changes;
    },

    /** Nimmt genau die Marken mit Zeitstempel `ts` zurueck (Bot wieder da). */
    clearGuildMark(g, ts) {
      return S.clearGuild.run({ g, ts }).changes;
    },

    /**
     * Loescht alles, was die Frist ueberschritten hat: Zeilen ausgetretener
     * Mitglieder (Austritt vor `leftBefore`) samt ihren Fehlerbericht-
     * Sperren, und Sperren, die aelter als `locksBefore` sind (die Sperre
     * braucht es nur, solange ThreadCreate fuer denselben Thread noch
     * einmal feuern koennte). Eine Transaktion. Zeilen loescht es nur in
     * Gilden, fuer die `inGuild(id)` zustimmt: anderswo konnte heute niemand
     * pruefen, ob ein Vorgemerkter inzwischen zurueck ist. Die Sperren laufen
     * ueberall nach Alter.
     */
    purgeExpired(leftBefore, locksBefore, inGuild = () => true) {
      return db.transaction(() => {
        const rows = S.expired.all(leftBefore).filter((r) => inGuild(r.guild_id));
        for (const r of rows) {
          S.del.run(r.guild_id, r.user_id);
          S.delBugXpOf.run(r.guild_id, r.user_id);
        }
        const locks = S.delBugXpOld.run(locksBefore).changes;
        return { users: rows.length, locks };
      })();
    },

    close() {
      db.close();
    },
  };
}
