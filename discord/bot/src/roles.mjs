// ═══════════════════════════════════════════════════════════════════════════
//  roles.mjs — self-provisioning rank/prestige roles + per-member sync.
//
//  On startup the bot creates any missing rank roles (idempotent by name,
//  colored to match the ladder, ordered just below the bot's own role). On
//  level-up it swaps a member to their current rank role (or stacks, per
//  config) and grants the prestige role for their star count.
// ═══════════════════════════════════════════════════════════════════════════
import { resolveColor } from 'discord.js';
import { RANKS, PRESTIGE, rankForLevel, rankRoleName, prestigeRoleName } from './ranks.mjs';

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
          role = await guild.roles.create({ name, ...roleColorOptions(rank.color), hoist: false, mentionable: false, permissions: [], reason: 'VerseBase rank role' });
        } catch (e) {
          console.warn(`[roles] could not create ${name}: ${e.message}`);
        }
      } else if (role && canManage) {
        await applyRoleColor(role, rank.color);
      }
      if (role) map.set(rank.key, role.id);
    }

    // Best-effort: order the rank roles just under the bot's highest role.
    if (canManage) {
      try {
        const top = (await guild.members.fetchMe()).roles.highest.position;
        let pos = Math.max(1, top - 1);
        const positions = [];
        for (const rank of RANKS) {
          const id = map.get(rank.key);
          if (id) { positions.push({ role: id, position: pos }); pos = Math.max(1, pos - 1); }
        }
        if (positions.length) await guild.roles.setPositions(positions);
      } catch { /* cosmetic */ }
    }

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
      role = await guild.roles.create({ name, ...roleColorOptions(PRESTIGE.color), hoist: true, mentionable: false, permissions: [], reason: 'VerseBase prestige role' }).catch(() => null);
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
