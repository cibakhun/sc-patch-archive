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
  noXpChannels: [],          // admin-added channel IDs (via /rank-admin noxp)

  // No-XP channels matched by NAME, resolved live so the always-on bot mirrors
  // the server blueprint (channels marked `noXp: true`) without any manual setup.
  // A channel counts if its name CONTAINS any of these — "🤖・bot-commands"
  // matches "bot-commands". Threads inherit their parent's status.
  noXpChannelNames: ['bot-commands', 'memes', 'off-topic'],

  // ── Level-up announcements ─────────────────────────────────────────────
  announce: {
    mode: 'channel',   // 'channel' (fixed), 'current' (where they leveled), 'off'
    channelId: null,   // used when mode === 'channel'; an admin-set ID always wins
    channelName: 'bot-commands', // fallback when no channelId: post level-ups to the
                                 // channel whose name contains this (keeps bot noise in one place)
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

/**
 * True if a channel earns NO XP — by admin-added ID (noXpChannels) or by the
 * blueprint's name list (noXpChannelNames). Threads inherit their parent's
 * status. Dependency-free so the selftest can exercise it offline.
 */
export function isNoXpChannel(channel, config) {
  if (!channel) return false;
  const ids = config.noXpChannels || [];
  const names = config.noXpChannelNames || [];
  const hit = (c) => !!c && (ids.includes(c.id) || names.some((n) => String(c.name || '').includes(n)));
  if (hit(channel)) return true;
  if (hit(channel.parent)) return true;                 // thread → parent channel
  if (channel.parentId && ids.includes(channel.parentId)) return true;
  return false;
}

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
