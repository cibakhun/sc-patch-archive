// ═════════════════════════════════════════════════════════════════════════
//  audit.mjs — READ-ONLY health check of the live VerseBase server.
//
//    npm run audit            → human report
//    npm run audit -- --json <file>   → also dump the raw findings as JSON
//
//  It never writes anything to Discord: it fetches the live guild and diffs it
//  against blueprint.mjs + the bot's rank ladder, then SIMULATES the effective
//  permissions of each member type in every channel (Discord's own overwrite
//  algorithm) so you can see what a newcomer / Prospect / Citizen / mod / the
//  bot can actually do — not just what the overwrite table claims.
//
//  Every finding is one of:
//    ✗ ERROR  — broken; something won't work as intended
//    ! WARN   — drifted from the blueprint or fragile
//    · INFO   — worth knowing, not wrong
// ═════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  Client, GatewayIntentBits, PermissionsBitField, PermissionFlagsBits, ChannelType,
  GuildVerificationLevel, GuildExplicitContentFilter, GuildDefaultMessageNotifications,
  Routes, resolveColor, MessageType,
  AutoModerationRuleTriggerType, AutoModerationActionType, AutoModerationRuleKeywordPresetType,
} from 'discord.js';
import * as bp from './blueprint.mjs';
import { RANKS, PRESTIGE, rankRoleName, rankPermissions, TRUSTED_PERMS } from './bot/src/ranks.mjs';
import { DEFAULT_CONFIG } from './bot/src/config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── env ────────────────────────────────────────────────────────────────────
for (const dir of [__dirname, join(__dirname, '..', '..', '..', '..', 'discord')]) {
  const p = join(dir, '.env');
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim().replace(/^['"]|['"]$/g, '');
    if (!(m[1] in process.env) && v) process.env[m[1]] = v;
  }
}

// ── output ─────────────────────────────────────────────────────────────────
const clr = (c, s) => `\x1b[${c}m${s}\x1b[0m`;
const findings = [];
const section = (s) => console.log(clr('36;1', `\n━━ ${s} ${'━'.repeat(Math.max(0, 60 - s.length))}`));
const err = (area, msg, detail) => { findings.push({ level: 'ERROR', area, msg, detail }); console.log(clr('31;1', `  ✗ ${msg}`)); if (detail) console.log(clr('90', `      ${detail}`)); };
const warn = (area, msg, detail) => { findings.push({ level: 'WARN', area, msg, detail }); console.log(clr('33', `  ! ${msg}`)); if (detail) console.log(clr('90', `      ${detail}`)); };
const info = (area, msg, detail) => { findings.push({ level: 'INFO', area, msg, detail }); console.log(clr('90', `  · ${msg}${detail ? clr('90', ` — ${detail}`) : ''}`)); };
const ok = (msg) => console.log(clr('32', `  ✓ ${msg}`));

// ── permission helpers ─────────────────────────────────────────────────────
const bits = (names) => {
  let b = 0n;
  for (const n of names ?? []) if (PermissionFlagsBits[n] !== undefined) b |= PermissionFlagsBits[n];
  return b;
};
const permNames = (bf) => Object.entries(PermissionFlagsBits).filter(([, v]) => (BigInt(bf) & v) === v && v !== 0n).map(([k]) => k);
const diffPerms = (live, want) => ({
  extra: permNames(BigInt(live) & ~BigInt(want)),
  missing: permNames(BigInt(want) & ~BigInt(live)),
});
const ADMIN = PermissionFlagsBits.Administrator;
const VIEW = PermissionFlagsBits.ViewChannel;

/** Discord's own overwrite resolution for a member holding `roleIds`. */
function effectivePerms(channel, guild, roleIds) {
  let base = guild.roles.everyone.permissions.bitfield;
  for (const id of roleIds) {
    const r = guild.roles.cache.get(id);
    if (r) base |= r.permissions.bitfield;
  }
  if ((base & ADMIN) === ADMIN) return { bitfield: ~0n & PermissionsBitField.All, admin: true };

  const ows = channel.permissionOverwrites?.cache;
  const get = (id) => ows?.get(id);
  const ev = get(guild.roles.everyone.id);
  if (ev) { base &= ~ev.deny.bitfield; base |= ev.allow.bitfield; }
  let deny = 0n, allow = 0n;
  for (const id of roleIds) {
    const o = get(id);
    if (o) { deny |= o.deny.bitfield; allow |= o.allow.bitfield; }
  }
  base &= ~deny; base |= allow;
  return { bitfield: base, admin: false };
}
const can = (eff, perm) => eff.admin || (eff.bitfield & PermissionFlagsBits[perm]) === PermissionFlagsBits[perm];

// ── connect ────────────────────────────────────────────────────────────────
const token = process.env.DISCORD_TOKEN;
if (!token) { console.error('No DISCORD_TOKEN found (discord/.env).'); process.exit(1); }
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
await client.login(token);
await new Promise((res) => { client.once('clientReady', res); client.once('ready', res); });

const oauth = await client.guilds.fetch();
let guild;
if (process.env.GUILD_ID) guild = await client.guilds.fetch(process.env.GUILD_ID);
else if (oauth.size === 1) guild = await client.guilds.fetch(oauth.first().id);
else { console.error('Set GUILD_ID — bot is in ' + oauth.size + ' guilds'); process.exit(1); }

await guild.roles.fetch();
await guild.channels.fetch();
const me = await guild.members.fetchMe();
const botRoleId = me.roles.botRole?.id ?? null;
const everyoneId = guild.roles.everyone.id;
const snowflakeDate = (id) => new Date(Number((BigInt(id) >> 22n) + 1420070400000n)).toISOString().slice(0, 16).replace('T', ' ');

console.log(clr('37;1', `\nVerseBase server audit — ${guild.name} (${guild.id})`));
console.log(clr('90', `bot: ${client.user.tag} · ${guild.memberCount} members · created ${snowflakeDate(guild.id)}`));

// ═══ 1. CONNECTION / IDENTITY ══════════════════════════════════════════════
section('1 · Bot connection & authority');
const app = await client.application.fetch();
info('bot', `logged in as ${client.user.tag} — application "${app.name}" (${app.id}), member-facing name "${me.displayName}"`);
if (app.botPublic) err('bot', 'Public Bot is ON — anyone with the application ID can invite this bot to their own server', 'Developer Portal → Bot → uncheck "Public Bot"');
else ok('Public Bot off (only you can invite it)');
if (oauth.size !== 1) warn('bot', `bot is in ${oauth.size} guilds`, [...oauth.values()].map((g) => g.name).join(', '));
else ok(`bot is in exactly 1 guild`);
if (!me.permissions.has(PermissionFlagsBits.Administrator)) err('bot', 'bot lacks Administrator — builder + rank sync will fail');
else ok('bot has Administrator');
const botRole = botRoleId ? guild.roles.cache.get(botRoleId) : null;
if (botRole) {
  const above = [...guild.roles.cache.values()].filter((r) => r.position > botRole.position && r.id !== everyoneId);
  ok(`bot role "${botRole.name}" at position ${botRole.position} (highest: ${me.roles.highest.name} @ ${me.roles.highest.position})`);
  if (above.length) info('bot', `${above.length} role(s) sit above the bot`, above.map((r) => r.name).join(', '));
}

// ═══ 2. GUILD SETTINGS ═════════════════════════════════════════════════════
section('2 · Server settings');
const chanByName = (n) => [...guild.channels.cache.values()].find((c) => c.name === n);
const wantChan = (key) => {
  const def = bp.categories.flatMap((c) => c.channels).find((c) => c.key === key);
  if (!def) return null;
  const isText = ['text', 'announcement', 'forum'].includes(def.type);
  return chanByName(isText ? def.name.toLowerCase().replace(/\s+/g, '-') : def.name);
};
const cmp = (label, live, want, area = 'guild') => {
  if (String(live) === String(want)) ok(`${label}: ${live}`);
  else warn(area, `${label} is "${live}", blueprint wants "${want}"`);
};
if (guild.name !== bp.guild.name) warn('guild', `server is called "${guild.name}", blueprint.guild.name says "${bp.guild.name}"`, 'build.mjs never applies guild.name — the field is inert, so one of the two is a lie');
else ok(`name: ${guild.name}`);
cmp('verification', GuildVerificationLevel[guild.verificationLevel], bp.community.verification);
cmp('content filter', GuildExplicitContentFilter[guild.explicitContentFilter], bp.community.contentFilter);
cmp('default notifications', GuildDefaultMessageNotifications[guild.defaultMessageNotifications], bp.community.notifications);
cmp('AFK timeout', guild.afkTimeout, bp.guild.afkTimeout);
const pairs = [
  ['rules channel', guild.rulesChannelId, wantChan(bp.community.rulesChannel)],
  ['public updates channel', guild.publicUpdatesChannelId, wantChan(bp.community.updatesChannel)],
  ['system channel', guild.systemChannelId, wantChan(bp.guild.systemChannel)],
  ['AFK channel', guild.afkChannelId, wantChan(bp.guild.afkChannel)],
];
for (const [label, liveId, wantCh] of pairs) {
  if (!wantCh) { err('guild', `${label}: blueprint target channel does not exist on the server`); continue; }
  if (liveId === wantCh.id) ok(`${label}: #${wantCh.name}`);
  else warn('guild', `${label} points at ${liveId ? `#${guild.channels.cache.get(liveId)?.name ?? liveId}` : 'nothing'}, blueprint wants #${wantCh.name}`);
}
if (bp.guild.description && guild.description !== bp.guild.description) warn('guild', 'server description differs from the blueprint', guild.description ?? '(none set)');
else if (bp.guild.description) ok('server description set');
const safetyWant = wantChan(bp.autoMod?.alertChannel);
if (safetyWant && guild.safetyAlertsChannelId !== safetyWant.id) warn('guild', `safety alerts go to ${guild.safetyAlertsChannelId ? '#' + guild.channels.cache.get(guild.safetyAlertsChannelId)?.name : 'nowhere'}, blueprint wants #${safetyWant.name}`);
else if (safetyWant) ok(`safety alerts: #${safetyWant.name}`);
if (!guild.features.includes('COMMUNITY')) err('guild', 'Community mode is OFF — onboarding, welcome screen, announcement channels and stage all depend on it');
else ok('Community mode on');
if (!guild.icon) warn('guild', 'no server icon set');
else ok('server icon set');
info('guild', `features: ${guild.features.join(', ') || '—'}`);
info('guild', `boost tier ${guild.premiumTier} · ${guild.premiumSubscriptionCount ?? 0} boosts · MFA level ${guild.mfaLevel}`);
info('guild', `system channel flags: ${guild.systemChannelFlags.toArray().join(', ') || 'none suppressed (join + boost messages post)'}`);
if (guild.vanityURLCode) info('guild', `vanity URL: ${guild.vanityURLCode}`);

// ═══ 3. ROLES ══════════════════════════════════════════════════════════════
section('3 · Roles');
const liveRole = (name) => [...guild.roles.cache.values()].find((r) => r.name === name && !r.managed);
const roleIdByKey = {};
for (const def of bp.roles) {
  const r = liveRole(def.name);
  if (!r) { err('roles', `missing role: ${def.name}`); continue; }
  roleIdByKey[def.key] = r.id;
  const wantColor = def.color ? resolveColor(def.color) : 0;
  const liveColor = r.colors?.primaryColor ?? r.color;
  const d = diffPerms(r.permissions.bitfield, bits(def.permissions));
  const issues = [];
  if (liveColor !== wantColor) issues.push(`color #${liveColor.toString(16).padStart(6, '0')} ≠ #${wantColor.toString(16).padStart(6, '0')}`);
  if (r.hoist !== !!def.hoist) issues.push(`hoist ${r.hoist} ≠ ${!!def.hoist}`);
  if (r.mentionable !== !!def.mentionable) issues.push(`mentionable ${r.mentionable} ≠ ${!!def.mentionable}`);
  if (d.extra.length) issues.push(`extra perms: ${d.extra.join(', ')}`);
  if (d.missing.length) issues.push(`missing perms: ${d.missing.join(', ')}`);
  if (issues.length) warn('roles', `${def.name}`, issues.join(' · '));
}
if (bp.roles.every((d) => roleIdByKey[d.key])) ok(`all ${bp.roles.length} blueprint roles present`);

// @everyone baseline
const evDiff = diffPerms(guild.roles.everyone.permissions.bitfield, bits(bp.everyonePermissions));
if (evDiff.extra.length || evDiff.missing.length) warn('roles', '@everyone baseline drifted', `extra: ${evDiff.extra.join(', ') || '—'} · missing: ${evDiff.missing.join(', ') || '—'}`);
else ok('@everyone baseline matches blueprint (newcomer gate: no EmbedLinks/AttachFiles)');

// rank ladder
const rankRoleByKey = {};
let rankIssues = 0;
for (const rank of RANKS) {
  const name = rankRoleName(rank);
  const r = liveRole(name);
  if (!r) { err('ranks', `missing rank role: ${name}`); rankIssues++; continue; }
  rankRoleByKey[rank.key] = r.id;
  const d = diffPerms(r.permissions.bitfield, bits(rankPermissions(rank)));
  const liveColor = r.colors?.primaryColor ?? r.color;
  const issues = [];
  if (liveColor !== resolveColor(rank.color)) issues.push(`color off`);
  if (r.hoist) issues.push('hoisted (should not be)');
  if (d.extra.length) issues.push(`extra: ${d.extra.join(', ')}`);
  if (d.missing.length) issues.push(`missing: ${d.missing.join(', ')}`);
  if (issues.length) { warn('ranks', `${name}`, issues.join(' · ')); rankIssues++; }
}
if (!rankIssues) ok(`all ${RANKS.length} rank roles present, coloured and carrying the right gate permissions`);
const prestigeRoles = [...guild.roles.cache.values()].filter((r) => !r.managed && r.name.includes(PRESTIGE.name));
for (const r of prestigeRoles) {
  const d = diffPerms(r.permissions.bitfield, bits(TRUSTED_PERMS));
  if (d.extra.length || d.missing.length || r.hoist) warn('ranks', `prestige role ${r.name}`, `hoist ${r.hoist} · extra ${d.extra.join(',') || '—'} · missing ${d.missing.join(',') || '—'}`);
}
info('roles', `${prestigeRoles.length} prestige role(s) live`, prestigeRoles.map((r) => r.name).join(', ') || '—');

// unexpected roles
const knownNames = new Set([...bp.roles.map((r) => r.name), ...RANKS.map(rankRoleName), ...prestigeRoles.map((r) => r.name)]);
const strays = [...guild.roles.cache.values()].filter((r) => !r.managed && r.id !== everyoneId && !knownNames.has(r.name));
if (strays.length) warn('roles', `${strays.length} role(s) on the server aren't in any source file`, strays.map((r) => `${r.name} (pos ${r.position})`).join(', '));
else ok('no stray hand-made roles');

// hierarchy
section('3b · Role hierarchy (order-roles.mjs target)');
const label = (n) => String(n).replace(/^[^\p{L}\p{N}]+/u, '').trim();
const ORDER = [
  ...bp.roles.filter((r) => r.hoist).map((r) => label(r.name)),
  ...[...RANKS].reverse().map((r) => r.name),
  ...bp.roles.filter((r) => !r.hoist).map((r) => label(r.name)),
];
const used = new Set();
const wantSeq = [];
for (const key of ORDER) {
  const role = [...guild.roles.cache.values()].sort((a, b) => b.position - a.position).find((r) => !used.has(r.id) && !r.managed && r.name.includes(key));
  if (role) { used.add(role.id); wantSeq.push(role); }
}
const liveSeq = [...guild.roles.cache.values()].filter((r) => used.has(r.id)).sort((a, b) => b.position - a.position);
const orderMismatch = wantSeq.findIndex((r, i) => liveSeq[i]?.id !== r.id);
if (orderMismatch === -1) ok(`hierarchy matches the intended order (${wantSeq.length} roles, top → bottom)`);
else {
  warn('roles', `role order diverges at position ${orderMismatch + 1}`, `expected "${wantSeq[orderMismatch]?.name}", found "${liveSeq[orderMismatch]?.name}" — run \`npm run order\``);
  console.log(clr('90', '      want: ' + wantSeq.slice(0, 40).map((r) => r.name).join(' > ')));
  console.log(clr('90', '      live: ' + liveSeq.slice(0, 40).map((r) => r.name).join(' > ')));
}
const managedAbove = [...guild.roles.cache.values()].filter((r) => r.managed && r.position > (botRole?.position ?? 0));
if (managedAbove.length) info('roles', 'managed roles above the bot role', managedAbove.map((r) => r.name).join(', '));

// Who actually holds the staff roles? Enumerating members needs the privileged
// GuildMembers intent, so check the owner (the one member we can always fetch).
const owner = await guild.members.fetch(guild.ownerId).catch(() => null);
if (owner) {
  const staffKeys = ['fleet-command', 'navigators'];
  const ownerStaff = staffKeys.filter((k) => owner.roles.cache.has(roleIdByKey[k]));
  info('roles', `owner ${owner.user.username} holds: ${owner.roles.cache.filter((r) => r.id !== everyoneId).map((r) => r.name).join(', ') || '—'}`);
  if (!ownerStaff.length) warn('roles', 'the server owner holds neither ⭐ Fleet Command nor 🛰 Navigators', 'they rule by ownership anyway, but the staff roles, the private Flight Deck and the AutoMod exemptions may have no members at all');
}

// Ping opt-in roles that anyone can @mention are a broadcast-spam vector. The
// bot can still ping them when they are non-mentionable (it has MentionEveryone).
const pingKeys = ['patch-watch', 'announce-ping', 'event-ping'];
const openPings = pingKeys.map((k) => guild.roles.cache.get(roleIdByKey[k])).filter((r) => r?.mentionable);
if (openPings.length) warn('roles', `${openPings.length} opt-in ping role(s) can be @mentioned by any member`, openPings.map((r) => '@' + r.name).join(', ') + ' — the bot keeps pinging them either way (it has MentionEveryone)');

// ═══ 4. CHANNELS ═══════════════════════════════════════════════════════════
section('4 · Categories & channels');
const TYPE = { text: ChannelType.GuildText, announcement: ChannelType.GuildAnnouncement, voice: ChannelType.GuildVoice, stage: ChannelType.GuildStageVoice, forum: ChannelType.GuildForum };
const TEXTLIKE = new Set(['text', 'announcement', 'forum']);
const expectedName = (name, type) => (TEXTLIKE.has(type) ? name.toLowerCase().replace(/\s+/g, '-') : name);
const seen = new Set();
const chanIdByKey = {};

// expected overwrites, mirroring build.mjs resolveOverwrites()
function rankGateRoleIds(minRankKey) {
  const min = RANKS.find((r) => r.key === minRankKey)?.level;
  const ids = [];
  for (const r of RANKS) if (r.level >= min && rankRoleByKey[r.key]) ids.push(rankRoleByKey[r.key]);
  for (const r of prestigeRoles) if (!ids.includes(r.id)) ids.push(r.id);
  return ids;
}
function expectedOverwrites(spec, { readonly, minRank } = {}) {
  const map = new Map();
  const put = (id, allow = [], deny = []) => {
    if (!id) return;
    if (!map.has(id)) map.set(id, { allow: 0n, deny: 0n });
    const e = map.get(id); e.allow |= bits(allow); e.deny |= bits(deny);
  };
  for (const [k, v] of Object.entries(spec ?? {})) put(k === 'everyone' ? everyoneId : roleIdByKey[k], v.allow, v.deny);
  if (readonly) {
    put(everyoneId, ['ViewChannel', 'ReadMessageHistory', 'AddReactions'], ['SendMessages', 'SendMessagesInThreads', 'CreatePublicThreads', 'CreatePrivateThreads']);
    put(roleIdByKey['navigators'], ['SendMessages', 'SendMessagesInThreads']);
    put(botRoleId, ['ViewChannel', 'SendMessages', 'SendMessagesInThreads', 'EmbedLinks', 'AttachFiles']);
  }
  if (minRank) {
    const grant = ['ViewChannel', 'ReadMessageHistory', 'SendMessages', 'SendMessagesInThreads', 'CreatePublicThreads', 'AddReactions', 'EmbedLinks', 'AttachFiles', 'UseExternalEmojis', 'UseExternalStickers'];
    put(everyoneId, [], ['ViewChannel']);
    for (const id of rankGateRoleIds(minRank)) put(id, grant);
    put(roleIdByKey['navigators'], grant);
    put(botRoleId, grant);
  }
  return map;
}

for (const cat of bp.categories) {
  const category = [...guild.channels.cache.values()].find((c) => c.type === ChannelType.GuildCategory && c.name === cat.name);
  if (!category) { err('channels', `missing category: ${cat.name}`); continue; }
  seen.add(category.id);
  chanIdByKey[cat.key] = category.id;
  console.log(clr('34;1', `  ${cat.name}`));
  // category overwrites
  const wantCat = expectedOverwrites(cat.overwrites);
  for (const [id, wantV] of wantCat) {
    const live = category.permissionOverwrites.cache.get(id);
    const rn = guild.roles.cache.get(id)?.name ?? id;
    if (!live) { err('channels', `${cat.name}: missing overwrite for ${rn}`); continue; }
    const da = diffPerms(live.allow.bitfield, wantV.allow), dd = diffPerms(live.deny.bitfield, wantV.deny);
    if (da.missing.length || dd.missing.length) warn('channels', `${cat.name}: overwrite for ${rn} drifted`, `allow missing ${da.missing.join(',') || '—'} · deny missing ${dd.missing.join(',') || '—'}`);
  }

  for (const ch of cat.channels) {
    const wantN = expectedName(ch.name, ch.type);
    const live = [...guild.channels.cache.values()].find((c) => c.parentId === category.id && c.name === wantN);
    if (!live) { err('channels', `missing channel: ${wantN} (in ${cat.name})`); continue; }
    seen.add(live.id);
    chanIdByKey[ch.key] = live.id;
    const issues = [];
    if (live.type !== TYPE[ch.type]) issues.push(`type ${ChannelType[live.type]} ≠ ${ch.type}`);
    if (ch.topic && TEXTLIKE.has(ch.type) && live.topic !== ch.topic) issues.push('topic differs');
    if (ch.slowmode && live.rateLimitPerUser !== ch.slowmode) issues.push(`slowmode ${live.rateLimitPerUser}s ≠ ${ch.slowmode}s`);
    if (ch.tags) {
      const liveTags = (live.availableTags ?? []).map((t) => t.name);
      if (liveTags.join('|') !== ch.tags.join('|')) issues.push(`forum tags [${liveTags.join(', ') || '—'}] ≠ [${ch.tags.join(', ')}]`);
    }
    if (!ch.slowmode && live.rateLimitPerUser) issues.push(`unexpected slowmode ${live.rateLimitPerUser}s`);

    const explicit = !!ch.overwrites || !!ch.readonly || !!ch.minRank;
    if (explicit) {
      const want = expectedOverwrites(ch.overwrites, { readonly: ch.readonly, minRank: ch.minRank });
      for (const [id, wantV] of want) {
        const lo = live.permissionOverwrites.cache.get(id);
        const rn = guild.roles.cache.get(id)?.name ?? id;
        if (!lo) { issues.push(`no overwrite for ${rn}`); continue; }
        const da = diffPerms(lo.allow.bitfield, wantV.allow), dd = diffPerms(lo.deny.bitfield, wantV.deny);
        if (da.missing.length) issues.push(`${rn} allow missing ${da.missing.join(',')}`);
        if (dd.missing.length) issues.push(`${rn} deny missing ${dd.missing.join(',')}`);
      }
      const strayOw = [...live.permissionOverwrites.cache.values()].filter((o) => !want.has(o.id));
      if (strayOw.length) issues.push(`extra overwrites: ${strayOw.map((o) => guild.roles.cache.get(o.id)?.name ?? guild.members.cache.get(o.id)?.user?.tag ?? o.id).join(', ')}`);
    } else if (cat.private) {
      if (!live.permissionsLocked) issues.push('not synced to its private category');
    } else if (live.permissionOverwrites.cache.size) {
      issues.push(`unexpected overwrites: ${[...live.permissionOverwrites.cache.values()].map((o) => guild.roles.cache.get(o.id)?.name ?? o.id).join(', ')}`);
    }
    if (issues.length) warn('channels', `#${wantN}`, issues.join(' · '));
    else console.log(clr('90', `    ✓ ${wantN}`));
  }
}
const stray = [...guild.channels.cache.values()].filter((c) => !seen.has(c.id));
if (stray.length) warn('channels', `${stray.length} channel(s) on the server aren't in the blueprint`, stray.map((c) => `${c.name} [${ChannelType[c.type]}]`).join(', '));
else ok('no stray channels');

// channel ordering
const liveCatOrder = [...guild.channels.cache.values()].filter((c) => c.type === ChannelType.GuildCategory).sort((a, b) => a.position - b.position).map((c) => c.name);
const wantCatOrder = bp.categories.map((c) => c.name);
if (liveCatOrder.join('|') !== wantCatOrder.join('|')) warn('channels', 'category order differs from the blueprint', `live: ${liveCatOrder.join(' → ')}`);
else ok('category order matches the blueprint');
for (const cat of bp.categories) {
  const catId = chanIdByKey[cat.key];
  const liveOrder = [...guild.channels.cache.values()].filter((c) => c.parentId === catId).sort((a, b) => a.position - b.position).map((c) => c.name);
  const wantOrder = cat.channels.map((c) => expectedName(c.name, c.type)).filter((n) => liveOrder.includes(n));
  // voice/stage sort after text in Discord's UI — compare within each bucket
  const textLive = liveOrder.filter((n) => wantOrder.includes(n));
  if (textLive.join('|') !== wantOrder.join('|')) info('channels', `${cat.name}: channel order differs`, `live: ${textLive.join(', ')}`);
}

// ═══ 5. EFFECTIVE PERMISSIONS (the real test) ══════════════════════════════
section('5 · Effective permissions — what each member type can actually do');
const personas = [
  ['new member', []],
  ['Prospect (lvl 5)', [rankRoleByKey['prospect']].filter(Boolean)],
  ['Citizen (lvl 15)', [rankRoleByKey['citizen']].filter(Boolean)],
  ['Navigator (mod)', [roleIdByKey['navigators']].filter(Boolean)],
  ['bot', [botRoleId].filter(Boolean)],
];
const table = [];
for (const cat of bp.categories) {
  for (const ch of cat.channels) {
    const live = guild.channels.cache.get(chanIdByKey[ch.key]);
    if (!live) continue;
    const row = { channel: expectedName(ch.name, ch.type), kind: ch.type, tags: [ch.readonly && 'readonly', ch.minRank && `≥${ch.minRank}`, cat.private && 'staff'].filter(Boolean).join('+') };
    for (const [who, roleIds] of personas) {
      const eff = effectivePerms(live, guild, roleIds);
      const isVoice = ch.type === 'voice' || ch.type === 'stage';
      row[who] = !can(eff, 'ViewChannel') ? '—' :
        isVoice ? [can(eff, 'Connect') ? 'join' : 'no-join', can(eff, 'Speak') ? 'speak' : 'no-speak'].join('/') :
          [can(eff, 'SendMessages') ? 'post' : 'read-only', can(eff, 'EmbedLinks') && can(eff, 'AttachFiles') ? 'media' : 'no-media'].join('/');
    }
    table.push(row);
  }
}
const pad = (s, n) => String(s).padEnd(n);
console.log(clr('90', `  ${pad('channel', 24)}${pad('flags', 12)}${personas.map(([w]) => pad(w, 20)).join('')}`));
for (const r of table) console.log(`  ${pad(r.channel, 24)}${clr('90', pad(r.tags || '', 12))}${personas.map(([w]) => pad(r[w], 20)).join('')}`);

// sanity assertions on the gate
const gateChecks = [];
for (const cat of bp.categories) for (const ch of cat.channels) {
  const live = guild.channels.cache.get(chanIdByKey[ch.key]);
  if (!live || !TEXTLIKE.has(ch.type)) continue;
  const nw = effectivePerms(live, guild, []);
  const pr = effectivePerms(live, guild, [rankRoleByKey['prospect']].filter(Boolean));
  const name = expectedName(ch.name, ch.type);
  const open = !cat.private && !ch.minRank && !ch.readonly;
  if (open) {
    if (!can(nw, 'SendMessages')) gateChecks.push(`ERR: newcomers cannot post in #${name}`);
    if (can(nw, 'EmbedLinks') || can(nw, 'AttachFiles')) gateChecks.push(`ERR: newcomer gate leaks in #${name} (media allowed at level 0)`);
    if (!can(pr, 'EmbedLinks') || !can(pr, 'AttachFiles')) gateChecks.push(`ERR: Prospect still cannot post media in #${name} — the gate never lifts`);
  }
  if (ch.readonly && can(nw, 'SendMessages')) gateChecks.push(`ERR: #${name} is meant to be read-only but @everyone can post`);
  if (cat.private && can(nw, 'ViewChannel')) gateChecks.push(`ERR: staff channel #${name} is visible to @everyone`);
  if (ch.minRank && can(nw, 'ViewChannel')) gateChecks.push(`ERR: rank-gated #${name} is visible to @everyone`);
  if (ch.minRank) {
    const cz = effectivePerms(live, guild, [rankRoleByKey[ch.minRank]].filter(Boolean));
    if (!can(cz, 'ViewChannel')) gateChecks.push(`ERR: #${name} not visible to its own gate rank (${ch.minRank})`);
    const below = RANKS.find((r) => r.level < RANKS.find((x) => x.key === ch.minRank).level);
    const lo = effectivePerms(live, guild, [rankRoleByKey[below?.key]].filter(Boolean));
    if (below && can(lo, 'ViewChannel')) gateChecks.push(`ERR: #${name} visible below its gate rank`);
  }
  const bot = effectivePerms(live, guild, [botRoleId].filter(Boolean));
  if (!can(bot, 'SendMessages') || !can(bot, 'EmbedLinks')) gateChecks.push(`ERR: the bot cannot post embeds in #${name}`);
}
// Stage channels have two rules of their own: a moderator needs all three of
// ManageChannels + MuteMembers + MoveMembers *in that channel*, and anyone with
// Speak can put themselves on stage instead of raising a hand.
const STAGE_PERMS = ['ManageChannels', 'MuteMembers', 'MoveMembers'];
for (const cat of bp.categories) for (const ch of cat.channels) {
  if (ch.type !== 'stage') continue;
  const live = guild.channels.cache.get(chanIdByKey[ch.key]);
  if (!live) continue;
  const mod = effectivePerms(live, guild, [roleIdByKey['navigators']].filter(Boolean));
  const missing = STAGE_PERMS.filter((p) => !can(mod, p));
  if (missing.length) gateChecks.push(`ERR: 🛰 Navigators cannot moderate ${ch.name} — missing ${missing.join(', ')} (Discord needs all of ${STAGE_PERMS.join(' + ')})`);
  const aud = effectivePerms(live, guild, []);
  if (can(aud, 'Speak')) gateChecks.push(`ERR: anyone can put themselves on stage in ${ch.name} — @everyone still has Speak`);
  if (!can(aud, 'RequestToSpeak')) gateChecks.push(`ERR: the audience cannot raise a hand in ${ch.name} — @everyone lacks RequestToSpeak`);
}

console.log('');
if (gateChecks.length) gateChecks.forEach((g) => err('perms', g));
else ok('newcomer gate, read-only channels, staff privacy, the rank gate and the stage rules all resolve correctly');

// ═══ 6. AUTOMOD ════════════════════════════════════════════════════════════
section('6 · AutoMod');
let liveRules = new Map();
try {
  const rules = await guild.autoModerationRules.fetch();
  liveRules = new Map([...rules.values()].map((r) => [r.name, r]));
} catch (e) { err('automod', `cannot read AutoMod rules: ${e.message}`); }
const TRIG = { Spam: AutoModerationRuleTriggerType.Spam, MentionSpam: AutoModerationRuleTriggerType.MentionSpam, Keyword: AutoModerationRuleTriggerType.Keyword, KeywordPreset: AutoModerationRuleTriggerType.KeywordPreset };
for (const want of bp.autoMod.rules) {
  const live = liveRules.get(want.name);
  if (!live) { err('automod', `missing rule: ${want.name}`); continue; }
  const issues = [];
  if (!live.enabled) issues.push('DISABLED');
  if (live.triggerType !== TRIG[want.trigger]) issues.push('trigger type differs');
  if (want.mentionLimit && live.triggerMetadata.mentionTotalLimit !== want.mentionLimit) issues.push(`mention limit ${live.triggerMetadata.mentionTotalLimit} ≠ ${want.mentionLimit}`);
  if (want.regexPatterns && JSON.stringify(live.triggerMetadata.regexPatterns) !== JSON.stringify(want.regexPatterns)) issues.push('regex differs');
  if (want.presets) {
    const wantP = want.presets.map((p) => AutoModerationRuleKeywordPresetType[p]);
    if (JSON.stringify([...live.triggerMetadata.presets].sort()) !== JSON.stringify(wantP.sort())) issues.push('presets differ');
  }
  const hasBlock = live.actions.some((a) => a.type === AutoModerationActionType.BlockMessage);
  const alertTo = live.actions.find((a) => a.type === AutoModerationActionType.SendAlertMessage)?.metadata?.channelId;
  if (want.block && !hasBlock) issues.push('no block action');
  if (want.alert && !alertTo) issues.push('no alert action');
  if (want.alert && alertTo && alertTo !== chanIdByKey[bp.autoMod.alertChannel]) issues.push(`alerts go to #${guild.channels.cache.get(alertTo)?.name ?? alertTo}`);
  const wantExempt = bp.autoMod.exemptRoles.map((k) => roleIdByKey[k]).filter(Boolean).sort();
  if (JSON.stringify([...live.exemptRoles.keys()].sort()) !== JSON.stringify(wantExempt)) issues.push(`exempt roles: ${[...live.exemptRoles.values()].map((r) => r.name).join(',') || '—'}`);
  const wantExCh = (want.exemptChannels ?? []).map((k) => chanIdByKey[k]).filter(Boolean).sort();
  if (JSON.stringify([...live.exemptChannels.keys()].sort()) !== JSON.stringify(wantExCh)) issues.push(`exempt channels: ${[...live.exemptChannels.values()].map((c) => '#' + c.name).join(',') || '—'}`);
  if (issues.length) warn('automod', want.name, issues.join(' · '));
  else ok(`${want.name}`);
}
const extraRules = [...liveRules.keys()].filter((n) => !bp.autoMod.rules.some((r) => r.name === n));
if (extraRules.length) info('automod', 'extra rules not in the blueprint', extraRules.join(', '));

// ═══ 7. ONBOARDING + WELCOME SCREEN ════════════════════════════════════════
section('7 · Onboarding & welcome screen');
let onboarding = null;
try {
  onboarding = await client.rest.get(Routes.guildOnboarding(guild.id));
} catch (e) { err('onboarding', `cannot read onboarding: ${e.message}`); }
if (onboarding) {
  if (!onboarding.enabled) err('onboarding', 'onboarding is DISABLED — new members never get the role picker');
  else ok(`onboarding enabled (mode ${onboarding.mode === 1 ? 'advanced' : 'default'})`);
  const wantDefaults = bp.onboarding.defaultChannels.map((k) => chanIdByKey[k]).filter(Boolean);
  const missDef = wantDefaults.filter((id) => !onboarding.default_channel_ids.includes(id));
  const extraDef = onboarding.default_channel_ids.filter((id) => !wantDefaults.includes(id));
  if (missDef.length) warn('onboarding', `${missDef.length} blueprint default channel(s) missing`, missDef.map((i) => '#' + (guild.channels.cache.get(i)?.name ?? i)).join(', '));
  if (extraDef.length) info('onboarding', `${extraDef.length} extra default channel(s)`, extraDef.map((i) => '#' + (guild.channels.cache.get(i)?.name ?? i)).join(', '));
  if (!missDef.length && !extraDef.length) ok(`${wantDefaults.length} default channels match`);
  if (onboarding.prompts.length !== bp.onboarding.prompts.length) warn('onboarding', `${onboarding.prompts.length} prompts live, blueprint has ${bp.onboarding.prompts.length}`);
  for (const [i, wantP] of bp.onboarding.prompts.entries()) {
    const liveP = onboarding.prompts[i];
    if (!liveP) { err('onboarding', `prompt ${i + 1} missing: ${wantP.title}`); continue; }
    const issues = [];
    if (liveP.title !== wantP.title) issues.push(`title "${liveP.title}"`);
    if (liveP.single_select !== (wantP.type === 'single')) issues.push('single-select flag differs');
    if (!liveP.in_onboarding) issues.push('not shown in onboarding');
    if (liveP.options.length !== wantP.options.length) issues.push(`${liveP.options.length} options ≠ ${wantP.options.length}`);
    for (const [j, wo] of wantP.options.entries()) {
      const lo = liveP.options[j];
      if (!lo) { issues.push(`option "${wo.title}" missing`); continue; }
      if (lo.title !== wo.title) issues.push(`option ${j + 1} title "${lo.title}"`);
      const wantRoles = (wo.roles ?? []).map((k) => roleIdByKey[k]).filter(Boolean);
      const wantChans = (wo.channels ?? []).map((k) => chanIdByKey[k]).filter(Boolean);
      if (JSON.stringify([...lo.role_ids].sort()) !== JSON.stringify([...wantRoles].sort())) issues.push(`"${wo.title}" grants ${lo.role_ids.map((r) => guild.roles.cache.get(r)?.name ?? 'DELETED-ROLE').join(',') || 'no role'}`);
      if (JSON.stringify([...lo.channel_ids].sort()) !== JSON.stringify([...wantChans].sort())) issues.push(`"${wo.title}" opens ${lo.channel_ids.map((c) => '#' + (guild.channels.cache.get(c)?.name ?? 'DELETED')).join(',') || 'no channel'}`);
    }
    if (issues.length) warn('onboarding', `prompt "${wantP.title}"`, issues.join(' · '));
    else ok(`prompt "${wantP.title}" (${wantP.options.length} options)`);
  }
}
try {
  const ws = await guild.fetchWelcomeScreen();
  if (ws.description !== bp.welcomeScreen.description) warn('welcome', 'description differs', ws.description);
  const liveWs = [...ws.welcomeChannels.values()];
  const wantWs = bp.welcomeScreen.channels;
  if (liveWs.length !== wantWs.length) warn('welcome', `${liveWs.length} channels ≠ ${wantWs.length}`);
  for (const [i, w] of wantWs.entries()) {
    const l = liveWs[i];
    if (!l) { warn('welcome', `missing entry ${w.channel}`); continue; }
    if (l.channelId !== chanIdByKey[w.channel]) warn('welcome', `entry ${i + 1} points at #${guild.channels.cache.get(l.channelId)?.name ?? l.channelId}, want #${w.channel}`);
    else if (l.description !== w.description) warn('welcome', `entry #${w.channel} description differs`, l.description);
  }
  ok(`welcome screen live (${liveWs.length} channels)`);
} catch (e) { err('welcome', `welcome screen unreadable/disabled: ${e.message}`); }

// ═══ 8. EMOJI, COMMANDS, INTEGRATIONS ══════════════════════════════════════
section('8 · Emoji, slash commands & integrations');
await guild.emojis.fetch();
let logoMap = {};
for (const p of [join(__dirname, '..', 'src', 'data', 'manufacturer-logos.json'), join(__dirname, '..', '..', '..', '..', 'src', 'data', 'manufacturer-logos.json')]) {
  if (existsSync(p)) { logoMap = JSON.parse(readFileSync(p, 'utf8')); break; }
}
const slug = (name) => { const s = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32); return s.length >= 2 ? s : `mfr_${s}`; };
const wantEmoji = Object.keys(logoMap).map(slug);
const missingEmoji = wantEmoji.filter((e) => !guild.emojis.cache.some((x) => x.name === e));
if (!wantEmoji.length) info('emoji', 'manufacturer-logos.json not found locally — skipped');
else if (missingEmoji.length) warn('emoji', `${missingEmoji.length}/${wantEmoji.length} manufacturer emoji missing`, missingEmoji.join(', '));
else ok(`all ${wantEmoji.length} manufacturer emoji uploaded`);
const extraEmoji = [...guild.emojis.cache.values()].filter((e) => !wantEmoji.includes(e.name));
if (extraEmoji.length) info('emoji', `${extraEmoji.length} other emoji`, extraEmoji.map((e) => e.name).join(', '));

const guildCmds = await guild.commands.fetch();
const globalCmds = await client.application.commands.fetch();
info('commands', `${guildCmds.size} guild command(s)`, [...guildCmds.values()].map((c) => '/' + c.name).join(' '));
const foreign = [...globalCmds.values()].filter((c) => !guildCmds.some((g) => g.name === c.name));
if (foreign.length) err('commands', `${foreign.length} GLOBAL command(s) from another project are registered on this application — every member sees them in this server's slash-command picker`, foreign.map((c) => '/' + c.name).join(' '));
else if (globalCmds.size) warn('commands', `${globalCmds.size} global command(s) duplicate the guild commands`, [...globalCmds.values()].map((c) => '/' + c.name).join(' '));
else ok('no foreign or duplicate global commands');
try {
  const integrations = await guild.fetchIntegrations();
  info('integrations', `${integrations.size} integration(s)`, [...integrations.values()].map((i) => `${i.name} [${i.type}]`).join(', '));
} catch (e) { info('integrations', `unreadable: ${e.message}`); }
try {
  const invites = await guild.invites.fetch();
  const perm = [...invites.values()].filter((i) => i.maxAge === 0 && i.maxUses === 0);
  info('invites', `${invites.size} invite(s), ${perm.length} permanent`, [...invites.values()].map((i) => `${i.code}→#${i.channel?.name} uses:${i.uses}${i.maxAge ? ` expires:${i.maxAge}s` : ''}`).join(', ') || '—');
  if (!invites.size) warn('invites', 'no invite link exists — nobody can join unless you make one');
} catch (e) { info('invites', `unreadable: ${e.message}`); }

// ═══ 9. SEED POSTS + PATCH FEED ════════════════════════════════════════════
section('9 · Pinned seed posts & patch feed');
for (const key of Object.keys(bp.seed)) {
  const ch = guild.channels.cache.get(chanIdByKey[key]);
  if (!ch) { err('seed', `channel for seed "${key}" not found`); continue; }
  try {
    const pinned = await ch.messages.fetchPinned();
    const mine = [...pinned.values()].filter((m) => m.author.id === client.user.id);
    // Pins from a previous bot identity: blank ghosts Discord left behind when
    // the old application went away. The builder can't replace them (different
    // author), so they sit next to the real seed post until swept.
    const orphaned = [...pinned.values()].filter((m) => m.author.bot && m.author.id !== client.user.id);
    if (orphaned.length) err('seed', `#${ch.name}: ${orphaned.length} pinned post(s) from a removed bot`, 'run `node clean-orphaned-messages.mjs` (dry run) to review');
    const wantTitle = bp.seed[key][0]?.title;
    if (!mine.length) err('seed', `#${ch.name}: no pinned seed post`);
    else if (mine.length > 1) warn('seed', `#${ch.name}: ${mine.length} pinned bot posts (duplicates)`);
    else {
      const t = mine[0].embeds[0]?.title;
      if (t !== wantTitle) warn('seed', `#${ch.name}: pinned post title "${t}" ≠ blueprint "${wantTitle}"`);
      else ok(`#${ch.name} seeded (updated ${snowflakeDate(mine[0].id)})`);
    }
  } catch (e) { warn('seed', `#${ch.name}: cannot read pins — ${e.message}`); }
}
// "X pinned a message to this channel" system notices sit right under the seed
// posts in the otherwise pristine read-only channels.
const pinNotices = [];
for (const key of Object.keys(bp.seed)) {
  const ch = guild.channels.cache.get(chanIdByKey[key]);
  if (!ch) continue;
  const msgs = await ch.messages.fetch({ limit: 20 }).catch(() => null);
  const n = msgs ? [...msgs.values()].filter((m) => m.type === MessageType.ChannelPinnedMessage).length : 0;
  if (n) pinNotices.push(`#${ch.name}${n > 1 ? ` ×${n}` : ''}`);
}
if (pinNotices.length) info('seed', `${pinNotices.length} channel(s) carry a "pinned a message" system notice under the seed post`, pinNotices.join(', '));

const patchCh = guild.channels.cache.get(chanIdByKey['patch-notes']);
if (patchCh) {
  const msgs = await patchCh.messages.fetch({ limit: 20 }).catch(() => null);
  if (msgs) {
    const posts = [...msgs.values()].filter((m) => m.author.id === client.user.id && !m.pinned && m.type === MessageType.Default);
    info('patch-feed', `${posts.length} patch post(s) in #${patchCh.name}`, posts.map((m) => `${m.embeds[0]?.title ?? '?'} (${m.embeds.length} embeds, ${snowflakeDate(m.id)})`).join(' | ') || '—');
    const dupTitles = posts.map((m) => m.embeds[0]?.title).filter((t, i, a) => t && a.indexOf(t) !== i);
    if (dupTitles.length) warn('patch-feed', 'duplicate patch posts', [...new Set(dupTitles)].join(', '));
    for (const m of posts) if (m.embeds.length < 2) warn('patch-feed', `post "${m.embeds[0]?.title}" has only ${m.embeds.length} embed — bilingual post should have 2 (EN + DE)`);
  }
}

// ═══ 10. CROSS-FILE COHERENCE (offline) ════════════════════════════════════
section('10 · Bot ↔ blueprint coherence');
const noXpMarked = bp.categories.flatMap((c) => c.channels).filter((c) => c.noXp).map((c) => c.name);
for (const n of DEFAULT_CONFIG.noXpChannelNames) {
  if (!noXpMarked.some((x) => x.includes(n))) warn('coherence', `bot noXpChannelNames has "${n}" with no blueprint channel`);
}
for (const n of noXpMarked) {
  if (!DEFAULT_CONFIG.noXpChannelNames.some((x) => n.includes(x))) warn('coherence', `blueprint marks "${n}" noXp but the bot will still grant XP there`);
}
// name-matching hazards: the bot resolves channels/roles by substring
const allNames = [...guild.channels.cache.values()].map((c) => c.name);
for (const n of DEFAULT_CONFIG.noXpChannelNames) {
  const hits = allNames.filter((x) => x.includes(n));
  if (hits.length > 1) warn('coherence', `"${n}" (no-XP name match) matches ${hits.length} channels`, hits.join(', '));
}
const annHits = allNames.filter((x) => x.includes(DEFAULT_CONFIG.announce.channelName));
if (!annHits.length) err('coherence', `level-up announce channel "${DEFAULT_CONFIG.announce.channelName}" does not exist`);
else ok(`level-up announcements land in #${annHits[0]}${annHits.length > 1 ? ` (⚠ ${annHits.length} matches)` : ''}`);
const patchHits = allNames.filter((x) => /patch-notes/i.test(x));
if (patchHits.length !== 1) warn('coherence', `patch-watch matches ${patchHits.length} channels for /patch-notes/i`, patchHits.join(', '));
else ok(`patch feed target: #${patchHits[0]}`);
const pingRole = [...guild.roles.cache.values()].filter((r) => /patch\s*pings/i.test(r.name));
if (pingRole.length !== 1) warn('coherence', `patch-watch matches ${pingRole.length} roles for /patch pings/i`);
else ok(`patch ping role: ${pingRole[0].name}`);
const langRoles = [...guild.roles.cache.values()].filter((r) => /deutsch|english/i.test(r.name));
info('coherence', `language roles the bot reads: ${langRoles.map((r) => r.name).join(', ') || 'NONE'}`);
const afkCh = guild.channels.cache.get(guild.afkChannelId);
if (afkCh) ok(`voice XP skips the AFK channel (${afkCh.name})`);

// ═══ SUMMARY ═══════════════════════════════════════════════════════════════
const counts = findings.reduce((a, f) => ({ ...a, [f.level]: (a[f.level] ?? 0) + 1 }), {});
section('Summary');
console.log(`  ${clr('31;1', (counts.ERROR ?? 0) + ' errors')} · ${clr('33', (counts.WARN ?? 0) + ' warnings')} · ${clr('90', (counts.INFO ?? 0) + ' notes')}`);
const jsonIdx = process.argv.indexOf('--json');
if (jsonIdx !== -1 && process.argv[jsonIdx + 1]) {
  writeFileSync(process.argv[jsonIdx + 1], JSON.stringify({ guild: { name: guild.name, id: guild.id, members: guild.memberCount, features: guild.features }, findings, table }, null, 2));
  console.log(clr('90', `  findings written to ${process.argv[jsonIdx + 1]}`));
}
await client.destroy();
process.exit(0);
