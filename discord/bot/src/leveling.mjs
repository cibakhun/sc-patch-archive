// ═══════════════════════════════════════════════════════════════════════════
//  leveling.mjs — the XP curve and all level math (pure, testable, no I/O).
//
//  Curve: the well-known Mee6-style quadratic. xpToNext(L) is the XP needed to
//  go from level L to L+1. It grows smoothly so early levels are quick and high
//  levels are a real grind.
// ═══════════════════════════════════════════════════════════════════════════

/** XP required to advance FROM `level` to `level + 1`. */
export function xpToNext(level) {
  return 5 * level * level + 50 * level + 100;
}

/** Cumulative XP required to REACH `level` from zero. */
export function totalXpForLevel(level) {
  let total = 0;
  for (let i = 0; i < level; i++) total += xpToNext(i);
  return total;
}

/** The level a member is at for a given lifetime `totalXp`. */
export function levelForXp(totalXp) {
  if (totalXp <= 0) return 0;
  let level = 0;
  let acc = 0;
  let need = xpToNext(0);
  while (totalXp >= acc + need) {
    acc += need;
    level += 1;
    need = xpToNext(level);
  }
  return level;
}

/** Progress breakdown within the current level. */
export function progress(totalXp) {
  const level = levelForXp(totalXp);
  const base = totalXpForLevel(level);
  const needed = xpToNext(level);
  const into = totalXp - base;
  return {
    level,
    into,                       // XP earned into the current level
    needed,                     // XP span of the current level
    remaining: needed - into,   // XP left until next level
    pct: needed > 0 ? into / needed : 0,
    totalXp,
  };
}

/** Inclusive random integer in [min, max]. */
export function randomXp(min, max) {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.floor(lo + Math.random() * (hi - lo + 1));
}

/**
 * Effective XP multiplier for a grant, given the merged config and context.
 * Factors stack multiplicatively. A channel factor of 0 disables XP entirely.
 */
export function effectiveMultiplier(config, { channelId, roleIds = [], isBooster = false, prestigeStars = 0 } = {}) {
  const m = config.multipliers || {};
  let factor = m.global ?? 1;

  if (isBooster) factor *= m.booster ?? 1;

  // Highest matching role multiplier wins (they don't stack with each other).
  let roleFactor = 1;
  for (const rid of roleIds) {
    const rf = m.roles?.[rid];
    if (typeof rf === 'number') roleFactor = Math.max(roleFactor, rf);
  }
  factor *= roleFactor;

  // Per-channel factor (0 disables).
  if (channelId != null && m.channels && Object.prototype.hasOwnProperty.call(m.channels, channelId)) {
    factor *= m.channels[channelId];
  }

  // Permanent prestige bonus.
  if (prestigeStars > 0) {
    factor *= 1 + (config.prestige?.bonusPerStar ?? 0) * prestigeStars;
  }

  return factor;
}

/** Round a raw XP amount by a multiplier, floored, never negative. */
export function applyMultiplier(baseXp, multiplier) {
  return Math.max(0, Math.floor(baseXp * multiplier));
}
