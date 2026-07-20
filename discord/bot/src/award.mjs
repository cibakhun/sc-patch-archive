// ═══════════════════════════════════════════════════════════════════════════
//  award.mjs — the one path that grants XP, detects level-ups, syncs rank
//  roles and posts announcements. Both the message handler and the voice sweep
//  funnel through grantXp() so behavior is identical everywhere.
// ═══════════════════════════════════════════════════════════════════════════
import { EmbedBuilder } from 'discord.js';
import { levelForXp, progress } from './leveling.mjs';
import { rankForLevel, nextRank, prestigeStars } from './ranks.mjs';

/**
 * Grant XP to a member and handle any resulting level-up.
 * ctx = { client, db, roles }
 */
export async function grantXp(ctx, { member, guild, amount = 0, stats = {}, currentChannel = null }) {
  const before = ctx.db.getUser(guild.id, member.id);
  const beforeLevel = levelForXp(before.xp);

  let row;
  if (amount > 0) {
    row = ctx.db.addXp(guild.id, member.id, amount, stats);
  } else {
    ctx.db.addStats(guild.id, member.id, stats);
    row = ctx.db.getUser(guild.id, member.id);
  }

  const afterLevel = levelForXp(row.xp);
  if (afterLevel > beforeLevel) {
    await onLevelUp(ctx, { member, guild, beforeLevel, afterLevel, row, currentChannel });
  }
  return { row, beforeLevel, afterLevel, leveledUp: afterLevel > beforeLevel };
}

async function onLevelUp(ctx, { member, guild, beforeLevel, afterLevel, row, currentChannel }) {
  const config = ctx.db.getConfig(guild.id);
  const prevRank = rankForLevel(beforeLevel);
  const rank = await ctx.roles.sync(member, afterLevel, row.prestige, config);
  const rankChanged = rank.key !== prevRank.key;

  if (config.announce.dm) await dmMember(member, guild, afterLevel, rank, rankChanged).catch(() => {});
  if (config.announce.mode === 'off') return;
  if (config.announce.onlyRanks && !rankChanged) return;

  const channel = resolveChannel(guild, config, currentChannel);
  if (!channel) return;

  const embed = buildLevelEmbed({ member, afterLevel, rank, rankChanged, row });
  await channel.send({
    content: config.announce.pingUser ? `<@${member.id}>` : undefined,
    embeds: [embed],
    allowedMentions: { users: config.announce.pingUser ? [member.id] : [] },
  }).catch(() => {});
}

function resolveChannel(guild, config, currentChannel) {
  const usable = (c) => c && typeof c.isTextBased === 'function' && c.isTextBased() && !c.isVoiceBased?.();
  if (config.announce.mode === 'current' && usable(currentChannel)) return currentChannel;
  if (config.announce.channelId) {
    const c = guild.channels.cache.get(config.announce.channelId);
    if (usable(c)) return c;
  }
  if (usable(currentChannel)) return currentChannel;
  if (usable(guild.systemChannel)) return guild.systemChannel;
  return null;
}

function buildLevelEmbed({ member, afterLevel, rank, rankChanged, row }) {
  const stars = prestigeStars(row.prestige);
  const nxt = nextRank(afterLevel);
  const embed = new EmbedBuilder()
    .setColor(rank.color)
    .setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL({ size: 128 }) })
    .setFooter({ text: 'VerseBase • rank system' });

  if (rankChanged) {
    embed.setTitle(`${rank.insignia}  New rank — ${rank.name}`)
      .setDescription(`${member} hit **Level ${afterLevel}** and earned the **${rank.name}** rank.\n_${rank.blurb}_`);
  } else {
    embed.setTitle(`⬡  Level ${afterLevel}`)
      .setDescription(`${member} leveled up to **Level ${afterLevel}**.`);
  }

  const fields = [];
  if (stars) fields.push({ name: 'Prestige', value: stars, inline: true });
  if (nxt) fields.push({ name: 'Next rank', value: `${nxt.insignia} ${nxt.name} · Lv ${nxt.level}`, inline: true });
  if (fields.length) embed.addFields(fields);
  return embed;
}

async function dmMember(member, guild, level, rank, rankChanged) {
  const line = rankChanged
    ? `You reached **Level ${level}** in **${guild.name}** and earned the **${rank.insignia} ${rank.name}** rank! 🎉`
    : `You reached **Level ${level}** in **${guild.name}**.`;
  await member.send(line);
}
