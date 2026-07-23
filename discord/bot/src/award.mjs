// ═══════════════════════════════════════════════════════════════════════════
//  award.mjs — the one path that grants XP, detects level-ups, syncs rank
//  roles and posts announcements. Both the message handler and the voice sweep
//  funnel through grantXp() so behavior is identical everywhere.
// ═══════════════════════════════════════════════════════════════════════════
import { EmbedBuilder } from 'discord.js';
import { levelForXp, progress } from './leveling.mjs';
import { rankForLevel, nextRank, prestigeStars, rankBlurb } from './ranks.mjs';
import { resolveLocale, t } from './i18n.mjs';

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
  // The announcement is about this member and pings them → render in THEIR
  // language (their 🇩🇪/🇬🇧 role), the closest we get to per-user for a broadcast.
  const locale = resolveLocale(member);

  if (config.announce.dm) await dmMember(member, guild, afterLevel, rank, rankChanged, locale).catch(() => {});
  if (config.announce.mode === 'off') return;
  if (config.announce.onlyRanks && !rankChanged) return;

  const channel = resolveChannel(guild, config, currentChannel);
  if (!channel) return;

  const embed = buildLevelEmbed({ member, afterLevel, rank, rankChanged, row, locale });
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
  // Fallback: a channel whose name matches announce.channelName (blueprint default
  // is #bot-commands), so level-ups have a sensible home without manual setup.
  if (config.announce.channelName) {
    const c = guild.channels.cache.find((x) => usable(x) && String(x.name || '').includes(config.announce.channelName));
    if (c) return c;
  }
  if (usable(currentChannel)) return currentChannel;
  if (usable(guild.systemChannel)) return guild.systemChannel;
  return null;
}

function buildLevelEmbed({ member, afterLevel, rank, rankChanged, row, locale }) {
  const stars = prestigeStars(row.prestige);
  const nxt = nextRank(afterLevel);
  const embed = new EmbedBuilder()
    .setColor(rank.color)
    .setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL({ size: 128 }) })
    .setFooter({ text: 'VerseBase • rank system' });

  if (rankChanged) {
    embed.setTitle(t(locale, 'levelup.newRankTitle', { ins: rank.insignia, name: rank.name }))
      .setDescription(t(locale, 'levelup.newRankDesc', { user: member, level: afterLevel, name: rank.name, blurb: rankBlurb(rank, locale) }));
  } else {
    embed.setTitle(t(locale, 'levelup.title', { level: afterLevel }))
      .setDescription(t(locale, 'levelup.desc', { user: member, level: afterLevel }));
  }

  const fields = [];
  if (stars) fields.push({ name: t(locale, 'levelup.prestige'), value: stars, inline: true });
  if (nxt) fields.push({ name: t(locale, 'levelup.nextRank'), value: t(locale, 'levelup.nextVal', { ins: nxt.insignia, name: nxt.name, level: nxt.level }), inline: true });
  if (fields.length) embed.addFields(fields);
  return embed;
}

async function dmMember(member, guild, level, rank, rankChanged, locale) {
  const line = rankChanged
    ? t(locale, 'dm.rankChanged', { level, guild: guild.name, ins: rank.insignia, name: rank.name })
    : t(locale, 'dm.level', { level, guild: guild.name });
  await member.send(line);
}
