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

// Rank NAMES are stylized proper nouns and stay one language (the Discord role
// is shared and can't be per-user); the flavor `blurb` is localized (blurbDe).
export const RANKS = [
  { level: 0,   key: 'drifter',         name: 'Drifter',         color: '#9aa4b2', insignia: '🌑', blurb: 'Just drifted into the ’verse. Welcome aboard.',       blurbDe: 'Gerade ins ’Verse getrieben. Willkommen an Bord.' },
  { level: 5,   key: 'prospect',        name: 'Prospect',        color: '#b0794a', insignia: '⛏️', blurb: 'Found your footing. The frontier is listening.',        blurbDe: 'Fuß gefasst. Die Frontier hört zu.' },
  { level: 10,  key: 'rookie',          name: 'Rookie Pilot',    color: '#3ba55d', insignia: '🛰️', blurb: 'Cleared for launch. First stripes earned.',            blurbDe: 'Startfreigabe erteilt. Erste Streifen verdient.' },
  { level: 15,  key: 'citizen',         name: 'Citizen',         color: '#2dd4ff', insignia: '⬡',  blurb: 'Recognized across the community. A true regular.',     blurbDe: 'In der Community anerkannt. Ein echter Stammgast.' },
  { level: 20,  key: 'wayfarer',        name: 'Wayfarer',        color: '#2fbfa4', insignia: '🧭', blurb: 'Charts your own course. Known in every port.',         blurbDe: 'Steuert den eigenen Kurs. In jedem Hafen bekannt.' },
  { level: 30,  key: 'journeyman',      name: 'Journeyman',      color: '#6ea8ff', insignia: '🚀', blurb: 'Seasoned hands. People come to you for answers.',       blurbDe: 'Erfahrene Hände. Man kommt zu dir für Antworten.' },
  { level: 40,  key: 'veteran',         name: 'Veteran',         color: '#a78bfa', insignia: '🎖️', blurb: 'Battle-tested across the Alpha 4 era.',                blurbDe: 'Kampferprobt durch die gesamte Alpha-4-Ära.' },
  { level: 50,  key: 'ace',             name: 'Ace',             color: '#f5a524', insignia: '⭐', blurb: 'Top of your field. The name carries weight.',           blurbDe: 'Spitze deines Fachs. Der Name hat Gewicht.' },
  { level: 65,  key: 'vanguard',        name: 'Vanguard',        color: '#ff5e1a', insignia: '🔥', blurb: 'Front of the pack. A pillar of the crew.',             blurbDe: 'An der Spitze. Eine Säule der Crew.' },
  { level: 80,  key: 'pathfinder',      name: 'Pathfinder',      color: '#e5484d', insignia: '🗺️', blurb: 'Blazes the trails others follow.',                     blurbDe: 'Bahnt die Wege, denen andere folgen.' },
  { level: 90,  key: 'trailblazer',     name: 'Trailblazer',     color: '#d4af37', insignia: '🏆', blurb: 'Elite. A living landmark of the server.',              blurbDe: 'Elite. Ein lebendes Wahrzeichen des Servers.' },
  { level: 100, key: 'frontier-legend', name: 'Frontier Legend', color: '#ffd479', insignia: '👑', blurb: 'The summit. Legends are written about you.',           blurbDe: 'Der Gipfel. Über dich werden Legenden geschrieben.' },
];

// Prestige — unlocked at config.prestige.atLevel. Each prestige resets the
// level but grants a permanent star, a display role, and an XP bonus.
export const PRESTIGE = {
  key: 'ascended',
  name: 'Ascended',
  color: '#ff73fa',
  star: '✦',
};

// ── Newcomer anti-spam gate ────────────────────────────────────────────────
// The server blueprint removes EmbedLinks + AttachFiles from @everyone, so brand-
// new / throwaway accounts can chat but can't post link embeds, images or files.
// Rank roles from Prospect (level 5) up carry those two permissions back — the bot
// stamps them onto each rank role it provisions (see roles.mjs), and prestige
// (✦ Ascended) roles carry them too (a prestiged member is level 0 but trusted).
// Keep TRUSTED_PERMS in sync with the blueprint's everyonePermissions.
export const TRUSTED_LEVEL = 5;                      // first rank that lifts the gate (Prospect)
export const TRUSTED_PERMS = ['EmbedLinks', 'AttachFiles'];

/** The guild permissions a rank role should carry (lifts the newcomer gate). */
export function rankPermissions(rank) {
  return rank.level >= TRUSTED_LEVEL ? [...TRUSTED_PERMS] : [];
}

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

/** The localized flavor blurb for a rank. */
export function rankBlurb(rank, locale) {
  return locale === 'de' ? (rank.blurbDe || rank.blurb) : rank.blurb;
}
