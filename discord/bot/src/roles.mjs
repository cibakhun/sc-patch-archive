// ═══════════════════════════════════════════════════════════════════════════
//  roles.mjs — self-provisioning rank/prestige roles + per-member sync.
//
//  On startup the bot creates any missing rank roles (idempotent by name,
//  colored to match the ladder, ordered just below the bot's own role). On
//  level-up it swaps a member to their current rank role (or stacks, per
//  config) and grants the prestige role for their star count.
// ═══════════════════════════════════════════════════════════════════════════
import { resolveColor, PermissionsBitField } from 'discord.js';
import { RANKS, PRESTIGE, rankForLevel, rankRoleName, prestigeRoleName, rankPermissions, TRUSTED_PERMS } from './ranks.mjs';

// discord.js ≥14.18 moved solid role color from `color` to `colors.primaryColor`
// (and Role#setColor → setColors). These helpers use the new API when present
// and fall back to the old one, so the bot works across versions without warnings.
function roleColorOptions(hex) {
  return { colors: { primaryColor: resolveColor(hex) } };
}
async function applyRoleColor(role, hex) {
  const target = resolveColor(hex);
  const current = role.colors?.primaryColor ?? role.color;
  if (current === target) return;
  try {
    if (typeof role.setColors === 'function') await role.setColors({ primaryColor: target });
    else await role.setColor(target);
  } catch { /* ignore */ }
}

// Keep a role's guild permissions in sync (used for the newcomer-gate lift). Only
// writes when they actually differ, so it's cheap to call on every startup.
async function applyRolePerms(role, permNames) {
  const target = PermissionsBitField.resolve(permNames.length ? permNames : 0n);
  const current = role.permissions?.bitfield ?? 0n;
  if (current === target) return;
  try { await role.setPermissions(target, 'VerseBase rank permissions'); } catch { /* ignore */ }
}

export class RankRoles {
  constructor() {
    this.byGuild = new Map(); // guildId -> Map(rankKey -> roleId)
    this.warned = new Set();
  }

  /** Create/verify all rank roles for a guild. Safe to call repeatedly. */
  async ensure(guild) {
    const map = new Map();
    await guild.roles.fetch();
    const me = await guild.members.fetchMe();
    const canManage = me.permissions.has('ManageRoles');
    if (!canManage && !this.warned.has(guild.id)) {
      console.warn(`[roles] Missing "Manage Roles" in ${guild.name} — rank roles can't be created/assigned.`);
      this.warned.add(guild.id);
    }

    for (const rank of RANKS) {
      const name = rankRoleName(rank);
      let role = guild.roles.cache.find((r) => r.name === name && !r.managed);
      if (!role && canManage) {
        try {
          role = await guild.roles.create({ name, ...roleColorOptions(rank.color), hoist: false, mentionable: false, permissions: rankPermissions(rank), reason: 'VerseBase rank role' });
        } catch (e) {
          console.warn(`[roles] could not create ${name}: ${e.message}`);
        }
      } else if (role && canManage) {
        await applyRoleColor(role, rank.color);
        await applyRolePerms(role, rankPermissions(rank));
      }
      if (role) map.set(rank.key, role.id);
    }

    // Prestige (✦ Ascended) roles carry the newcomer-gate lift too — a prestiged
    // member drops to level 0 but has plainly earned link/image posting.
    if (canManage) {
      for (const role of guild.roles.cache.values()) {
        if (!role.managed && role.name.includes(PRESTIGE.name)) await applyRolePerms(role, TRUSTED_PERMS);
      }
    }

    // Positioning is NOT done here: a previous version bulk-reordered the rank
    // roles on every startup (ascending, ignoring Team roles) using the same
    // `guild.roles.setPositions` call that's unreliable on this API — it fought
    // with and repeatedly scrambled the hierarchy `npm run order` (order-roles.mjs)
    // sets up. Ordering is that script's sole job now; run it after roles change.

    this.byGuild.set(guild.id, map);
    return map;
  }

  map(guildId) {
    return this.byGuild.get(guildId);
  }

  /** Find-or-create the prestige role for a given star count. */
  async ensurePrestige(guild, stars) {
    const name = prestigeRoleName(stars);
    let role = guild.roles.cache.find((r) => r.name === name && !r.managed);
    if (!role) {
      role = await guild.roles.create({ name, ...roleColorOptions(PRESTIGE.color), hoist: true, mentionable: false, permissions: TRUSTED_PERMS, reason: 'VerseBase prestige role' }).catch(() => null);
    }
    return role;
  }

  /**
   * Sync a member's rank (and prestige) roles to match their level.
   * Returns the resolved rank object.
   */
  async sync(member, level, prestige, config) {
    if (!config.rankRoles.enabled) return rankForLevel(level);

    let map = this.byGuild.get(member.guild.id);
    if (!map) map = await this.ensure(member.guild);

    const rank = rankForLevel(level);
    const targetId = map.get(rank.key);
    const managed = new Set(map.values());
    const toAdd = [];
    const toRemove = [];

    if (targetId) {
      if (!member.roles.cache.has(targetId)) toAdd.push(targetId);
      if (config.rankRoles.mode === 'highest') {
        for (const rid of member.roles.cache.keys()) {
          if (managed.has(rid) && rid !== targetId) toRemove.push(rid);
        }
      }
    }

    // Prestige role (grant current tier, strip older tiers).
    if (config.prestige.enabled && prestige > 0) {
      const prole = await this.ensurePrestige(member.guild, prestige);
      if (prole) {
        if (!member.roles.cache.has(prole.id)) toAdd.push(prole.id);
        const suffix = ` ${PRESTIGE.name}`;
        for (const r of member.roles.cache.values()) {
          if (r.id !== prole.id && r.name.endsWith(suffix)) toRemove.push(r.id);
        }
      }
    }

    try {
      if (toAdd.length) await member.roles.add(toAdd, 'VerseBase rank sync');
      if (toRemove.length) await member.roles.remove(toRemove, 'VerseBase rank sync');
    } catch (e) {
      if (!this.warned.has(member.guild.id + ':hier')) {
        console.warn(`[roles] role sync failed in ${member.guild.name} (check role hierarchy / permissions): ${e.message}`);
        this.warned.add(member.guild.id + ':hier');
      }
    }
    return rank;
  }
}
