// ═══════════════════════════════════════════════════════════════════════════
//  ranks.mjs — the VerseBase rank ladder (data + resolution helpers).
//
//  A deep, Star-Citizen-flavored progression. Each milestone LEVEL unlocks a
//  named rank with a colored role (colors mirror the site/tool palette), an
//  insignia, and a short flavor line. Roles are self-provisioned by the bot on
//  startup, so this file is the single source of truth for the whole ladder.
//
//  Edit freely: reorder, retune levels, add tiers. `rankForLevel` always picks
//  the highest rank whose threshold is met.
// ═══════════════════════════════════════════════════════════════════════════

export const RANKS = [
  { level: 0,   key: 'drifter',         name: 'Drifter',         color: '#9aa4b2', insignia: '🌑', blurb: 'Just drifted into the ’verse. Welcome aboard.' },
  { level: 5,   key: 'prospect',        name: 'Prospect',        color: '#b0794a', insignia: '⛏️', blurb: 'Found your footing. The frontier is listening.' },
  { level: 10,  key: 'rookie',          name: 'Rookie Pilot',    color: '#3ba55d', insignia: '🛰️', blurb: 'Cleared for launch. First stripes earned.' },
  { level: 15,  key: 'citizen',         name: 'Citizen',         color: '#2dd4ff', insignia: '⬡',  blurb: 'Recognized across the community. A true regular.' },
  { level: 20,  key: 'wayfarer',        name: 'Wayfarer',        color: '#2fbfa4', insignia: '🧭', blurb: 'Charts your own course. Known in every port.' },
  { level: 30,  key: 'journeyman',      name: 'Journeyman',      color: '#6ea8ff', insignia: '🚀', blurb: 'Seasoned hands. People come to you for answers.' },
  { level: 40,  key: 'veteran',         name: 'Veteran',         color: '#a78bfa', insignia: '🎖️', blurb: 'Battle-tested across the Alpha 4 era.' },
  { level: 50,  key: 'ace',             name: 'Ace',             color: '#f5a524', insignia: '⭐', blurb: 'Top of your field. The name carries weight.' },
  { level: 65,  key: 'vanguard',        name: 'Vanguard',        color: '#ff5e1a', insignia: '🔥', blurb: 'Front of the pack. A pillar of the crew.' },
  { level: 80,  key: 'pathfinder',      name: 'Pathfinder',      color: '#e5484d', insignia: '🗺️', blurb: 'Blazes the trails others follow.' },
  { level: 90,  key: 'trailblazer',     name: 'Trailblazer',     color: '#d4af37', insignia: '🏆', blurb: 'Elite. A living landmark of the server.' },
  { level: 100, key: 'frontier-legend', name: 'Frontier Legend', color: '#ffd479', insignia: '👑', blurb: 'The summit. Legends are written about you.' },
];

// Prestige — unlocked at config.prestige.atLevel. Each prestige resets the
// level but grants a permanent star, a display role, and an XP bonus.
export const PRESTIGE = {
  key: 'ascended',
  name: 'Ascended',
  color: '#ff73fa',
  star: '✦',
};

/** The rank object for a given level (highest threshold met). */
export function rankForLevel(level) {
  let current = RANKS[0];
  for (const rank of RANKS) {
    if (level >= rank.level) current = rank;
    else break;
  }
  return current;
}

/** The next rank a member is working toward, or null if maxed. */
export function nextRank(level) {
  for (const rank of RANKS) {
    if (rank.level > level) return rank;
  }
  return null;
}

/** Index of a rank in the ladder (for "rank 4 of 12" style display). */
export function rankIndex(rank) {
  return RANKS.findIndex((r) => r.key === rank.key);
}

/** The Discord role name for a rank (insignia + name), matching server style. */
export function rankRoleName(rank) {
  return `${rank.insignia} ${rank.name}`;
}

/** The Discord role name for a prestige tier. */
export function prestigeRoleName(stars) {
  return `${PRESTIGE.star.repeat(Math.max(1, stars))} ${PRESTIGE.name}`;
}

/** Every rank role name the bot manages (used when swapping to keep only one). */
export function allRankRoleNames() {
  return RANKS.map(rankRoleName);
}

/** A compact star string for prestige display, e.g. "✦✦✦". */
export function prestigeStars(stars) {
  return stars > 0 ? PRESTIGE.star.repeat(stars) : '';
}
