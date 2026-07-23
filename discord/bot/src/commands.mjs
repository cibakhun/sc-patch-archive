// ═══════════════════════════════════════════════════════════════════════════
//  commands.mjs — slash command definitions + handlers.
//
//    /rank [user]        — rank card (image or embed)
//    /leaderboard [page] — paginated top list with medals + buttons
//    /ranks              — the full ladder, your position highlighted
//    /prestige           — prestige at max level
//    /rank-admin …       — Manage-Server-gated XP / level / config controls
//
//  Every reply renders in the caller's language (their 🇩🇪/🇬🇧 role → i18n).
//  Command names/descriptions also carry German localizations for the picker.
// ═══════════════════════════════════════════════════════════════════════════
import {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType,
} from 'discord.js';
import { buildRankCard } from './card.mjs';
import { levelForXp, progress } from './leveling.mjs';
import { RANKS, rankForLevel, nextRank, rankIndex, prestigeStars } from './ranks.mjs';
import { buildDataCommandData, executeData, isDataCommand, handleAutocomplete as dataAutocomplete } from './data-commands.mjs';
import { resolveLocale, t } from './i18n.mjs';

const fmt = (n, loc) => Math.round(n).toLocaleString(loc === 'de' ? 'de-DE' : 'en-US');
const BRAND = 0x2dd4ff;

// localized label for an announce mode token
const modeLabel = (locale, mode) => t(locale, mode === 'channel' ? 'admin.modeChannel' : mode === 'current' ? 'admin.modeCurrent' : 'admin.modeOff');

// ── command registration payload ──────────────────────────────────────────
export function buildCommandData() {
  const admin = new SlashCommandBuilder()
    .setName('rank-admin')
    .setDescription('Manage the rank system (Manage Server only)')
    .setDescriptionLocalizations({ de: 'Rang-System verwalten (nur „Server verwalten“)' })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
    .setDMPermission(false)
    .addSubcommandGroup((g) => g.setName('xp').setDescription('Adjust member XP')
      .addSubcommand((s) => s.setName('give').setDescription('Add XP to a member')
        .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
        .addIntegerOption((o) => o.setName('amount').setDescription('XP to add').setRequired(true)))
      .addSubcommand((s) => s.setName('set').setDescription('Set a member’s XP')
        .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
        .addIntegerOption((o) => o.setName('amount').setDescription('New XP total').setRequired(true).setMinValue(0)))
      .addSubcommand((s) => s.setName('level').setDescription('Set a member’s level')
        .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
        .addIntegerOption((o) => o.setName('level').setDescription('New level').setRequired(true).setMinValue(0)))
      .addSubcommand((s) => s.setName('reset').setDescription('Reset a member to zero')
        .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))))
    .addSubcommandGroup((g) => g.setName('announce').setDescription('Level-up announcements')
      .addSubcommand((s) => s.setName('mode').setDescription('Where level-ups are announced')
        .addStringOption((o) => o.setName('mode').setDescription('Mode').setRequired(true)
          .addChoices({ name: 'Fixed channel', value: 'channel' }, { name: 'Where they leveled', value: 'current' }, { name: 'Off', value: 'off' })))
      .addSubcommand((s) => s.setName('channel').setDescription('Set the fixed announcement channel')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true)))
      .addSubcommand((s) => s.setName('only-ranks').setDescription('Only announce on rank change')
        .addBooleanOption((o) => o.setName('enabled').setDescription('On/off').setRequired(true)))
      .addSubcommand((s) => s.setName('dm').setDescription('Also DM members on rank-up')
        .addBooleanOption((o) => o.setName('enabled').setDescription('On/off').setRequired(true))))
    .addSubcommandGroup((g) => g.setName('multiplier').setDescription('XP multipliers')
      .addSubcommand((s) => s.setName('global').setDescription('Server-wide multiplier (event boost)')
        .addNumberOption((o) => o.setName('value').setDescription('e.g. 2 = double XP').setRequired(true).setMinValue(0).setMaxValue(10)))
      .addSubcommand((s) => s.setName('booster').setDescription('Extra multiplier for server boosters')
        .addNumberOption((o) => o.setName('value').setDescription('e.g. 1.5').setRequired(true).setMinValue(0).setMaxValue(10)))
      .addSubcommand((s) => s.setName('role').setDescription('Multiplier for a role')
        .addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true))
        .addNumberOption((o) => o.setName('value').setDescription('1 = none; 0 removes').setRequired(true).setMinValue(0).setMaxValue(10)))
      .addSubcommand((s) => s.setName('channel').setDescription('Multiplier for a channel (0 disables XP)')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel').setRequired(true))
        .addNumberOption((o) => o.setName('value').setDescription('e.g. 1.5; 0 disables').setRequired(true).setMinValue(0).setMaxValue(10))))
    .addSubcommandGroup((g) => g.setName('noxp').setDescription('Channels that earn no XP')
      .addSubcommand((s) => s.setName('add').setDescription('Add a no-XP channel')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel').setRequired(true)))
      .addSubcommand((s) => s.setName('remove').setDescription('Remove a no-XP channel')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel').setRequired(true))))
    .addSubcommand((s) => s.setName('text-xp').setDescription('Text XP amounts')
      .addIntegerOption((o) => o.setName('min').setDescription('Min per message').setMinValue(0))
      .addIntegerOption((o) => o.setName('max').setDescription('Max per message').setMinValue(0))
      .addIntegerOption((o) => o.setName('cooldown').setDescription('Cooldown seconds').setMinValue(0)))
    .addSubcommand((s) => s.setName('voice-xp').setDescription('Voice XP per minute')
      .addIntegerOption((o) => o.setName('per-minute').setDescription('XP per minute').setRequired(true).setMinValue(0)))
    .addSubcommand((s) => s.setName('view').setDescription('Show the current configuration'));

  return [
    new SlashCommandBuilder().setName('rank').setDescription('Show your rank card')
      .setDescriptionLocalizations({ de: 'Zeige deine Rang-Karte' })
      .addUserOption((o) => o.setName('user').setDescription('Whose rank to show').setDescriptionLocalizations({ de: 'Wessen Rang anzeigen' }))
      .setDMPermission(false).toJSON(),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Server XP leaderboard')
      .setDescriptionLocalizations({ de: 'Server-XP-Bestenliste' })
      .addIntegerOption((o) => o.setName('page').setDescription('Page').setDescriptionLocalizations({ de: 'Seite' }).setMinValue(1))
      .setDMPermission(false).toJSON(),
    new SlashCommandBuilder().setName('ranks').setDescription('Show the full rank ladder')
      .setDescriptionLocalizations({ de: 'Zeige die komplette Rang-Leiter' })
      .setDMPermission(false).toJSON(),
    new SlashCommandBuilder().setName('prestige').setDescription('Prestige when you reach the max level')
      .setDescriptionLocalizations({ de: 'Prestige, sobald du das Maximallevel erreichst' })
      .setDMPermission(false).toJSON(),
    ...buildDataCommandData(),
    admin.toJSON(),
  ];
}

// ── dispatch ────────────────────────────────────────────────────────────────
export async function execute(ctx, i) {
  if (isDataCommand(i.commandName)) return executeData(ctx, i);
  switch (i.commandName) {
    case 'rank': return cmdRank(ctx, i);
    case 'leaderboard': return cmdLeaderboard(ctx, i);
    case 'ranks': return cmdRanks(ctx, i);
    case 'prestige': return cmdPrestige(ctx, i);
    case 'rank-admin': return cmdAdmin(ctx, i);
  }
}

export async function handleButton(ctx, i) {
  if (!i.customId.startsWith('lb:')) return;
  const page = parseInt(i.customId.slice(3), 10) || 1;
  const locale = resolveLocale(i.member, i.locale);
  const payload = await renderLeaderboard(ctx, i.guild, page, locale);
  await i.update(payload).catch(() => {});
}

export async function handleAutocomplete(ctx, i) {
  return dataAutocomplete(i);
}

// ── /rank ────────────────────────────────────────────────────────────────────
async function cmdRank(ctx, i) {
  await i.deferReply();
  const locale = resolveLocale(i.member, i.locale);
  const user = i.options.getUser('user') ?? i.user;
  const member = await i.guild.members.fetch(user.id).catch(() => null);
  if (!member) return i.editReply(t(locale, 'common.notHere'));
  const row = ctx.db.getUser(i.guild.id, user.id);
  const position = ctx.db.position(i.guild.id, user.id);
  const total = ctx.db.count(i.guild.id);
  const payload = await buildRankCard(ctx, { member, row, position, totalUsers: total, locale });
  await i.editReply(payload);
}

// ── /leaderboard ─────────────────────────────────────────────────────────────
async function cmdLeaderboard(ctx, i) {
  await i.deferReply();
  const locale = resolveLocale(i.member, i.locale);
  const page = i.options.getInteger('page') ?? 1;
  const payload = await renderLeaderboard(ctx, i.guild, page, locale);
  await i.editReply(payload);
}

async function renderLeaderboard(ctx, guild, page, locale) {
  const config = ctx.db.getConfig(guild.id);
  const size = config.leaderboard.pageSize;
  const total = ctx.db.count(guild.id);
  const pages = Math.max(1, Math.ceil(total / size));
  page = Math.min(Math.max(1, page), pages);
  const rows = ctx.db.leaderboard(guild.id, size, (page - 1) * size);

  const lines = [];
  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx];
    const pos = (page - 1) * size + idx + 1;
    const level = levelForXp(r.xp);
    const rank = rankForLevel(level);
    const medal = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `\`#${String(pos).padStart(2, ' ')}\``;
    const member = guild.members.cache.get(r.user_id) || await guild.members.fetch(r.user_id).catch(() => null);
    const name = member ? member.displayName : `User ${r.user_id.slice(0, 6)}`;
    const stars = r.prestige ? ' ' + prestigeStars(r.prestige) : '';
    lines.push(`${medal}  **${name}**${stars}\n ${rank.insignia} ${rank.name} · Lv **${level}** · ${fmt(r.xp, locale)} XP`);
  }

  const embed = new EmbedBuilder()
    .setColor(BRAND)
    .setAuthor({ name: t(locale, 'lb.title', { guild: guild.name }), iconURL: guild.iconURL() ?? undefined })
    .setDescription(lines.length ? lines.join('\n') : t(locale, 'lb.empty'))
    .setFooter({ text: t(locale, 'lb.footer', { page, pages, total }) });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`lb:${page - 1}`).setLabel(t(locale, 'lb.prev')).setStyle(ButtonStyle.Secondary).setDisabled(page <= 1),
    new ButtonBuilder().setCustomId(`lb:${page + 1}`).setLabel(t(locale, 'lb.next')).setStyle(ButtonStyle.Secondary).setDisabled(page >= pages),
  );
  return { embeds: [embed], components: total > size ? [row] : [] };
}

// ── /ranks ───────────────────────────────────────────────────────────────────
async function cmdRanks(ctx, i) {
  const locale = resolveLocale(i.member, i.locale);
  const row = ctx.db.getUser(i.guild.id, i.user.id);
  const myLevel = levelForXp(row.xp);
  const myRank = rankForLevel(myLevel);
  const lines = RANKS.map((r) => {
    const here = r.key === myRank.key ? ` ⟵ **${t(locale, 'ladder.you')}**` : '';
    return `${r.insignia} **${r.name}** · Lv ${r.level}+${here}`;
  });
  const nxt = nextRank(myLevel);
  const embed = new EmbedBuilder()
    .setColor(myRank.color)
    .setTitle(t(locale, 'ladder.title'))
    .setDescription(lines.join('\n'))
    .addFields(
      { name: t(locale, 'ladder.youField'), value: `${t(locale, 'ladder.youValue', { ins: myRank.insignia, name: myRank.name, level: myLevel })}${row.prestige ? ' · ' + prestigeStars(row.prestige) : ''}`, inline: false },
      ...(nxt ? [{ name: t(locale, 'ladder.nextRank'), value: `${nxt.insignia} ${nxt.name} ${t(locale, 'ladder.atLevel', { level: nxt.level })}`, inline: false }] : []),
    )
    .setFooter({ text: t(locale, 'ladder.footer') });
  await i.reply({ embeds: [embed] });
}

// ── /prestige ────────────────────────────────────────────────────────────────
async function cmdPrestige(ctx, i) {
  const locale = resolveLocale(i.member, i.locale);
  const config = ctx.db.getConfig(i.guild.id);
  if (!config.prestige.enabled) return i.reply({ content: t(locale, 'prestige.disabled'), ephemeral: true });
  const row = ctx.db.getUser(i.guild.id, i.user.id);
  const level = levelForXp(row.xp);
  if (level < config.prestige.atLevel) {
    return i.reply({ content: t(locale, 'prestige.tooLow', { atLevel: config.prestige.atLevel, level }), ephemeral: true });
  }
  if (row.prestige >= config.prestige.maxStars) {
    return i.reply({ content: t(locale, 'prestige.maxed', { stars: prestigeStars(row.prestige) }), ephemeral: true });
  }
  const stars = row.prestige + 1;
  ctx.db.setPrestige(i.guild.id, i.user.id, stars, 0);
  const member = await i.guild.members.fetch(i.user.id).catch(() => null);
  if (member) await ctx.roles.sync(member, 0, stars, config);
  const embed = new EmbedBuilder()
    .setColor(0xff73fa)
    .setTitle(t(locale, 'prestige.title', { stars }))
    .setDescription(t(locale, 'prestige.desc', { user: i.user, stars: prestigeStars(stars), pct: Math.round(config.prestige.bonusPerStar * stars * 100) }))
    .setFooter({ text: 'VerseBase • rank system' });
  await i.reply({ embeds: [embed] });
}

// ── /rank-admin ──────────────────────────────────────────────────────────────
async function cmdAdmin(ctx, i) {
  const locale = resolveLocale(i.member, i.locale);
  if (!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return i.reply({ content: t(locale, 'admin.needPerm'), ephemeral: true });
  }
  const group = i.options.getSubcommandGroup(false);
  const sub = i.options.getSubcommand();
  const mutate = (fn) => { const ov = ctx.db.getConfigOverride(i.guild.id); fn(ov); ctx.db.setConfig(i.guild.id, ov); };
  const ok = (msg) => i.reply({ content: `✅ ${msg}`, ephemeral: true });
  const onoff = (v) => t(locale, v ? 'common.on' : 'common.off');

  // ---- xp group ----
  if (group === 'xp') {
    const user = i.options.getUser('user');
    const member = await i.guild.members.fetch(user.id).catch(() => null);
    if (sub === 'give') {
      const amount = i.options.getInteger('amount');
      const before = ctx.db.getUser(i.guild.id, user.id);
      const beforeLevel = levelForXp(before.xp);
      const updated = ctx.db.addXp(i.guild.id, user.id, Math.max(0, amount));
      if (member) await ctx.roles.sync(member, levelForXp(updated.xp), updated.prestige, ctx.db.getConfig(i.guild.id));
      return ok(t(locale, 'admin.xpGive', { amount: fmt(amount, locale), user, level: levelForXp(updated.xp), before: beforeLevel }));
    }
    if (sub === 'set') {
      const amount = i.options.getInteger('amount');
      const updated = ctx.db.setXp(i.guild.id, user.id, amount);
      if (member) await ctx.roles.sync(member, levelForXp(updated.xp), updated.prestige, ctx.db.getConfig(i.guild.id));
      return ok(t(locale, 'admin.xpSet', { user, amount: fmt(amount, locale), level: levelForXp(updated.xp) }));
    }
    if (sub === 'level') {
      const level = i.options.getInteger('level');
      const updated = ctx.db.setLevel(i.guild.id, user.id, level);
      if (member) await ctx.roles.sync(member, level, updated.prestige, ctx.db.getConfig(i.guild.id));
      return ok(t(locale, 'admin.xpLevel', { user, level }));
    }
    if (sub === 'reset') {
      ctx.db.reset(i.guild.id, user.id);
      if (member) await ctx.roles.sync(member, 0, 0, ctx.db.getConfig(i.guild.id));
      return ok(t(locale, 'admin.xpReset', { user }));
    }
  }

  // ---- announce group ----
  if (group === 'announce') {
    if (sub === 'mode') { const mode = i.options.getString('mode'); mutate((o) => { (o.announce ??= {}).mode = mode; }); return ok(t(locale, 'admin.annMode', { mode: modeLabel(locale, mode) })); }
    if (sub === 'channel') { const ch = i.options.getChannel('channel'); mutate((o) => { (o.announce ??= {}).channelId = ch.id; (o.announce).mode = 'channel'; }); return ok(t(locale, 'admin.annChannel', { ch })); }
    if (sub === 'only-ranks') { const v = i.options.getBoolean('enabled'); mutate((o) => { (o.announce ??= {}).onlyRanks = v; }); return ok(t(locale, 'admin.annOnlyRanks', { v: onoff(v) })); }
    if (sub === 'dm') { const v = i.options.getBoolean('enabled'); mutate((o) => { (o.announce ??= {}).dm = v; }); return ok(t(locale, 'admin.annDm', { v: onoff(v) })); }
  }

  // ---- multiplier group ----
  if (group === 'multiplier') {
    if (sub === 'global') { const v = i.options.getNumber('value'); mutate((o) => { (o.multipliers ??= {}).global = v; }); return ok(t(locale, 'admin.multGlobal', { v })); }
    if (sub === 'booster') { const v = i.options.getNumber('value'); mutate((o) => { (o.multipliers ??= {}).booster = v; }); return ok(t(locale, 'admin.multBooster', { v })); }
    if (sub === 'role') {
      const role = i.options.getRole('role'); const v = i.options.getNumber('value');
      mutate((o) => { const m = (o.multipliers ??= {}); const r = (m.roles ??= {}); if (v === 1 || v === 0) delete r[role.id]; if (v !== 1 && v !== 0) r[role.id] = v; });
      return ok(v === 1 || v === 0 ? t(locale, 'admin.multRoleClear', { role }) : t(locale, 'admin.multRole', { role, v }));
    }
    if (sub === 'channel') {
      const ch = i.options.getChannel('channel'); const v = i.options.getNumber('value');
      mutate((o) => { const m = (o.multipliers ??= {}); const c = (m.channels ??= {}); c[ch.id] = v; });
      return ok(t(locale, 'admin.multChannel', { ch, v, disabled: v === 0 ? t(locale, 'admin.xpDisabled') : '' }));
    }
  }

  // ---- noxp group ----
  if (group === 'noxp') {
    const ch = i.options.getChannel('channel');
    const cur = new Set(ctx.db.getConfig(i.guild.id).noXpChannels);
    if (sub === 'add') cur.add(ch.id); else cur.delete(ch.id);
    mutate((o) => { o.noXpChannels = [...cur]; });
    return ok(t(locale, sub === 'add' ? 'admin.noxpAdd' : 'admin.noxpRemove', { ch }));
  }

  // ---- standalone subs ----
  if (sub === 'text-xp') {
    const min = i.options.getInteger('min'); const max = i.options.getInteger('max'); const cd = i.options.getInteger('cooldown');
    mutate((o) => { const tt = (o.text ??= {}); if (min != null) tt.min = min; if (max != null) tt.max = max; if (cd != null) tt.cooldownSec = cd; });
    const c = ctx.db.getConfig(i.guild.id).text;
    return ok(t(locale, 'admin.textXp', { min: c.min, max: c.max, cd: c.cooldownSec }));
  }
  if (sub === 'voice-xp') {
    const v = i.options.getInteger('per-minute');
    mutate((o) => { (o.voice ??= {}).perMinute = v; });
    return ok(t(locale, 'admin.voiceXp', { v }));
  }
  if (sub === 'view') {
    const c = ctx.db.getConfig(i.guild.id);
    const chan = c.announce.channelId ? `<#${c.announce.channelId}>` : t(locale, 'common.dash');
    const embed = new EmbedBuilder()
      .setColor(BRAND)
      .setTitle(t(locale, 'admin.viewTitle'))
      .addFields(
        { name: t(locale, 'admin.vTextXp'), value: t(locale, 'admin.vTextXpVal', { min: c.text.min, max: c.text.max, cd: c.text.cooldownSec }), inline: false },
        { name: t(locale, 'admin.vVoiceXp'), value: t(locale, 'admin.vVoiceXpVal', { perMin: c.voice.perMinute, req: onoff(c.voice.requireOthers) }), inline: false },
        { name: t(locale, 'admin.vMultipliers'), value: t(locale, 'admin.vMultVal', { global: c.multipliers.global, booster: c.multipliers.booster, roles: Object.keys(c.multipliers.roles).length, channels: Object.keys(c.multipliers.channels).length }), inline: false },
        { name: t(locale, 'admin.vAnnounce'), value: t(locale, 'admin.vAnnVal', { mode: modeLabel(locale, c.announce.mode), channel: chan, onlyRanks: onoff(c.announce.onlyRanks), dm: onoff(c.announce.dm) }), inline: false },
        { name: t(locale, 'admin.vNoXp'), value: [...c.noXpChannels.map((id) => `<#${id}>`), ...(c.noXpChannelNames || []).map((n) => `\`${n}\``)].join(' ') || t(locale, 'common.dash'), inline: false },
        { name: t(locale, 'admin.vPrestige'), value: t(locale, 'admin.vPrestigeVal', { atLevel: c.prestige.atLevel, pct: Math.round(c.prestige.bonusPerStar * 100), max: c.prestige.maxStars }), inline: false },
      )
      .setFooter({ text: 'VerseBase • rank system' });
    return i.reply({ embeds: [embed], ephemeral: true });
  }

  return i.reply({ content: t(locale, 'admin.unknown'), ephemeral: true });
}
