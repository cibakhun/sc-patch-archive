// ═══════════════════════════════════════════════════════════════════════════
//  config.mjs — every tunable of the rank system, with sane defaults.
//
//  These are the DEFAULTS. Anything an admin changes via /rank-config is stored
//  per-guild in the database and merged on top of these at runtime
//  (see db.getConfig). Nothing here needs editing to run the bot.
// ═══════════════════════════════════════════════════════════════════════════

export const DEFAULT_CONFIG = {
  // ── Text XP ────────────────────────────────────────────────────────────
  text: {
    min: 15,            // min XP per eligible message
    max: 25,            // max XP per eligible message
    cooldownSec: 60,    // per-user anti-spam window; only one message earns XP per window
  },

  // ── Voice XP ───────────────────────────────────────────────────────────
  voice: {
    perMinute: 10,          // XP awarded per full minute in voice
    sweepSec: 60,           // how often the voice sweep runs (also the grant granularity)
    requireOthers: true,    // must be ≥2 non-bot members in the channel to earn
    ignoreMutedDeafened: true, // self-muted or self-deafened members earn nothing
    ignoreAfk: true,        // the guild AFK channel earns nothing
  },

  // ── Multipliers (stack multiplicatively) ───────────────────────────────
  multipliers: {
    global: 1.0,      // server-wide event switch (e.g. 2.0 = double-XP weekend)
    booster: 1.5,     // extra factor for Nitro server boosters
    roles: {},        // { roleId: factor } — highest matching role wins
    channels: {},     // { channelId: factor } — 0 disables XP in that channel
  },

  // Channels where NO XP is earned at all (e.g. bot-commands, spam).
  noXpChannels: [],

  // ── Level-up announcements ─────────────────────────────────────────────
  announce: {
    mode: 'channel',   // 'channel' (fixed), 'current' (where they leveled), 'off'
    channelId: null,   // used when mode === 'channel'
    dm: false,         // also DM the member on rank-up
    onlyRanks: false,  // true = only announce when the named RANK changes, not every level
    pingUser: true,    // mention the user in the announcement
  },

  // ── Rank roles ─────────────────────────────────────────────────────────
  rankRoles: {
    enabled: true,
    mode: 'highest',   // 'highest' = keep only the current rank role; 'stack' = keep all earned
  },

  // ── Prestige ───────────────────────────────────────────────────────────
  prestige: {
    enabled: true,
    atLevel: 100,        // level required to prestige
    bonusPerStar: 0.10,  // permanent +10% XP per prestige star
    maxStars: 5,
  },

  // ── Leaderboard ────────────────────────────────────────────────────────
  leaderboard: {
    pageSize: 10,
  },

  // ── Rank card ──────────────────────────────────────────────────────────
  card: {
    image: true,   // render a PNG card if @napi-rs/canvas is available; else embed
  },
};

// Deep-merge stored overrides on top of defaults (arrays & scalars replace,
// plain objects merge). Small and dependency-free.
export function mergeConfig(base, override) {
  if (override == null) return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(override)) {
    const b = out[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && b && typeof b === 'object' && !Array.isArray(b)) {
      out[k] = mergeConfig(b, v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
