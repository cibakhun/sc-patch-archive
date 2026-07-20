// ═════════════════════════════════════════════════════════════════════════
//  build.mjs — applies blueprint.mjs to a Discord server, idempotently.
//
//    npm run validate   → offline. Checks the blueprint end-to-end (cross-refs,
//                         permission names, print the plan). No token needed.
//    npm run build      → logs in with DISCORD_TOKEN and builds/updates the
//                         server. Safe to run repeatedly: it edits what exists
//                         and creates what's missing, never duplicating.
//
//  The bot must be in exactly one server (or set GUILD_ID in .env) and have the
//  Administrator permission. See README.md.
// ═════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as bp from './blueprint.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VALIDATE = process.argv.includes('--validate');

// ── tiny logger ────────────────────────────────────────────────────────────
const clr = (c, s) => `\x1b[${c}m${s}\x1b[0m`;
const log = (s) => console.log(s);
const step = (s) => console.log(clr('36;1', `\n▸ ${s}`));
const ok = (s) => console.log(clr('32', `  ✓ ${s}`));
const chg = (s) => console.log(clr('90', `  ~ ${s}`));
const add = (s) => console.log(clr('32', `  + ${s}`));
const warn = (s) => console.log(clr('33', `  ! ${s}`));
const fail = (s) => { console.error(clr('31;1', `\n✗ ${s}\n`)); process.exit(1); };

// ── .env loader (no dependency; reads ./ .env next to this file) ────────────
function loadEnv() {
  const p = join(__dirname, '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}

// discord.js is optional for --validate, required for a real build.
let DJS = null;
try { DJS = await import('discord.js'); } catch { /* handled below */ }

const CHANNEL_TYPES = ['text', 'announcement', 'voice', 'stage', 'forum'];

// Fallback permission-name set for offline validation without discord.js.
const FALLBACK_PERMS = new Set([
  'CreateInstantInvite', 'KickMembers', 'BanMembers', 'Administrator', 'ManageChannels',
  'ManageGuild', 'AddReactions', 'ViewAuditLog', 'PrioritySpeaker', 'Stream', 'ViewChannel',
  'SendMessages', 'SendTTSMessages', 'ManageMessages', 'EmbedLinks', 'AttachFiles',
  'ReadMessageHistory', 'MentionEveryone', 'UseExternalEmojis', 'ViewGuildInsights',
  'Connect', 'Speak', 'MuteMembers', 'DeafenMembers', 'MoveMembers', 'UseVAD',
  'ChangeNickname', 'ManageNicknames', 'ManageRoles', 'ManageWebhooks',
  'ManageGuildExpressions', 'ManageEmojisAndStickers', 'UseApplicationCommands',
  'RequestToSpeak', 'ManageEvents', 'ManageThreads', 'CreatePublicThreads',
  'CreatePrivateThreads', 'UseExternalStickers', 'SendMessagesInThreads',
  'UseEmbeddedActivities', 'ModerateMembers', 'CreateEvents', 'CreateGuildExpressions',
  'SendVoiceMessages', 'SendPolls', 'UseExternalApps',
]);

// ═══════════════════════════════ VALIDATE ═════════════════════════════════
function validate() {
  step('Validating blueprint (offline)');
  const errors = [];
  const warns = [];
  const knownPerms = DJS ? new Set(Object.keys(DJS.PermissionFlagsBits)) : FALLBACK_PERMS;

  // Unique keys / names
  const roleKeys = new Set();
  const roleNames = new Set();
  for (const r of bp.roles) {
    if (roleKeys.has(r.key)) errors.push(`Duplicate role key: ${r.key}`);
    if (roleNames.has(r.name)) errors.push(`Duplicate role name: ${r.name}`);
    roleKeys.add(r.key); roleNames.add(r.name);
    for (const p of r.permissions ?? []) if (!knownPerms.has(p)) warns.push(`Role ${r.key}: unknown permission "${p}"`);
  }
  for (const p of bp.everyonePermissions ?? []) if (!knownPerms.has(p)) warns.push(`@everyone: unknown permission "${p}"`);

  const chanKeys = new Set();
  for (const cat of bp.categories) {
    if (chanKeys.has(cat.key)) errors.push(`Duplicate channel/category key: ${cat.key}`);
    chanKeys.add(cat.key);
    for (const k of Object.keys(cat.overwrites ?? {})) {
      if (k !== 'everyone' && !roleKeys.has(k)) errors.push(`Category ${cat.key}: overwrite → unknown role "${k}"`);
    }
    for (const ch of cat.channels) {
      if (chanKeys.has(ch.key)) errors.push(`Duplicate channel key: ${ch.key}`);
      chanKeys.add(ch.key);
      if (!CHANNEL_TYPES.includes(ch.type)) errors.push(`Channel ${ch.key}: bad type "${ch.type}"`);
      for (const k of Object.keys(ch.overwrites ?? {})) {
        if (k !== 'everyone' && !roleKeys.has(k)) errors.push(`Channel ${ch.key}: overwrite → unknown role "${k}"`);
      }
    }
  }

  const need = (kind, set, key, ctx) => { if (!set.has(key)) errors.push(`${ctx} → unknown ${kind} "${key}"`); };
  need('channel', chanKeys, bp.guild.systemChannel, 'guild.systemChannel');
  need('channel', chanKeys, bp.guild.afkChannel, 'guild.afkChannel');
  need('channel', chanKeys, bp.community.rulesChannel, 'community.rulesChannel');
  need('channel', chanKeys, bp.community.updatesChannel, 'community.updatesChannel');
  for (const c of bp.welcomeScreen.channels) need('channel', chanKeys, c.channel, 'welcomeScreen');
  for (const k of bp.onboarding.defaultChannels) need('channel', chanKeys, k, 'onboarding.defaultChannels');
  for (const p of bp.onboarding.prompts) for (const o of p.options) {
    for (const r of o.roles ?? []) need('role', roleKeys, r, `onboarding "${p.title}"`);
    for (const c of o.channels ?? []) need('channel', chanKeys, c, `onboarding "${p.title}"`);
  }
  for (const k of Object.keys(bp.seed)) need('channel', chanKeys, k, 'seed');

  // Plan tree
  step('Plan');
  log(clr('37;1', `  Server: ${bp.guild.name}`));
  log(clr('37;1', `  Roles (${bp.roles.length}):`));
  for (const r of bp.roles) log(`    ${r.color ? clr('90', '●') : '○'} ${r.name}${r.hoist ? clr('90', '  (hoisted)') : ''}`);
  log(clr('37;1', `\n  Channels:`));
  let txt = 0, vc = 0;
  for (const cat of bp.categories) {
    log(`    ${clr('34;1', cat.name)}${cat.private ? clr('33', '  🔒') : ''}`);
    for (const ch of cat.channels) {
      const icon = ch.type === 'voice' ? '🔊' : ch.type === 'stage' ? '📻' : ch.type === 'forum' ? '🗂' : ch.readonly ? '🔒' : '#';
      if (ch.type === 'voice' || ch.type === 'stage') vc++; else txt++;
      log(`      ${icon} ${ch.name}`);
    }
  }
  log(clr('90', `\n  ${txt} text · ${vc} voice/stage · ${bp.onboarding.prompts.length} onboarding prompts · ${Object.keys(bp.seed).length} seeded channels`));

  if (warns.length) { step('Warnings'); warns.forEach(warn); }
  if (errors.length) { step('Errors'); errors.forEach((e) => console.log(clr('31', `  ✗ ${e}`))); fail(`${errors.length} error(s). Fix the blueprint and re-run.`); }
  console.log(clr('32;1', `\n✓ Blueprint is valid${warns.length ? ` (${warns.length} warning(s))` : ''}.`));
  if (!DJS) warn('discord.js not installed yet — permission names checked against a built-in list. Run `npm install` before `npm run build`.');
}

// ═══════════════════════════════ BUILD ════════════════════════════════════
async function build() {
  const {
    Client, GatewayIntentBits, PermissionsBitField, PermissionFlagsBits, ChannelType,
    GuildVerificationLevel, GuildExplicitContentFilter, GuildDefaultMessageNotifications,
    EmbedBuilder, Routes, OverwriteType, resolveColor,
  } = DJS;

  const token = process.env.DISCORD_TOKEN;
  if (!token || token === 'paste-your-bot-token-here') {
    fail('No bot token. Copy .env.example → .env and set DISCORD_TOKEN (see README).');
  }

  const TYPE = {
    text: ChannelType.GuildText, announcement: ChannelType.GuildAnnouncement,
    voice: ChannelType.GuildVoice, stage: ChannelType.GuildStageVoice, forum: ChannelType.GuildForum,
  };
  const TEXTLIKE = new Set(['text', 'announcement', 'forum']);

  const perms = (names) => {
    const b = new PermissionsBitField();
    for (const n of names ?? []) {
      if (PermissionFlagsBits[n] !== undefined) b.add(PermissionFlagsBits[n]);
      else warn(`Unknown permission "${n}" — skipped`);
    }
    return b;
  };

  step('Connecting to Discord');
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  try {
    await client.login(token);
  } catch (e) {
    fail('Login failed — is the token correct and un-revoked?  ' + e.message);
  }
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('gateway ready timeout')), 30000);
    const done = () => { clearTimeout(t); resolve(); };
    client.once('clientReady', done);
    client.once('ready', done);
  }).catch((e) => fail(e.message));
  ok(`Logged in as ${client.user.tag}`);

  // Resolve target guild
  const oauth = await client.guilds.fetch();
  let guild;
  if (process.env.GUILD_ID) {
    guild = await client.guilds.fetch(process.env.GUILD_ID).catch(() => null);
    if (!guild) fail(`The bot is not in a server with GUILD_ID=${process.env.GUILD_ID}. Invite it first (README).`);
  } else if (oauth.size === 1) {
    guild = await client.guilds.fetch(oauth.first().id);
  } else if (oauth.size === 0) {
    fail('The bot isn’t in any server yet. Invite it with the admin URL in the README, then re-run.');
  } else {
    fail('The bot is in multiple servers — set GUILD_ID in .env:\n' + [...oauth.values()].map((g) => `    ${g.id}  ${g.name}`).join('\n'));
  }
  ok(`Target server: ${guild.name}  (${guild.id})`);

  const me = await guild.members.fetchMe();
  if (!me.permissions.has(PermissionFlagsBits.Administrator)) {
    fail('The bot needs Administrator. Re-invite it with the admin URL (README) or grant its role Administrator.');
  }

  const everyoneId = guild.roles.everyone.id;

  // ── Roles ────────────────────────────────────────────────────────────────
  step('Roles');
  await guild.roles.fetch();
  const roleId = {};
  for (const def of bp.roles) {
    const data = {
      name: def.name, hoist: !!def.hoist, mentionable: !!def.mentionable,
      colors: { primaryColor: def.color ? resolveColor(def.color) : 0 },
      permissions: perms(def.permissions), reason: def.reason ?? 'VerseBase setup',
    };
    const existing = guild.roles.cache.find((r) => r.name === def.name && !r.managed);
    let role;
    if (existing) { role = await existing.edit(data); chg(`role ${def.name}`); }
    else { role = await guild.roles.create(data); add(`role ${def.name}`); }
    roleId[def.key] = role.id;
  }
  await guild.roles.everyone.setPermissions(perms(bp.everyonePermissions), 'VerseBase baseline');
  chg('@everyone baseline permissions');

  // Role ORDER is applied by a separate step: `npm run order` (order-roles.mjs).
  // Two reasons: (1) Discord's BULK setPositions rejects with "Missing Permissions"
  // even when the bot's role is on top — it must be done one role at a time; and
  // (2) the rank roles are created by the always-on bot, so they only exist to be
  // ordered AFTER the bot has run. Run `npm run order` once the bot is live.
  chg('roles (order via `npm run order`)');

  // ── Overwrite resolver ─────────────────────────────────────────────────────
  const resolveOverwrites = (spec, { readonly } = {}) => {
    const map = new Map();
    const touch = (id) => { if (!map.has(id)) map.set(id, { allow: new PermissionsBitField(), deny: new PermissionsBitField() }); return map.get(id); };
    const put = (id, allow = [], deny = []) => { const e = touch(id); e.allow.add(perms(allow)); e.deny.add(perms(deny)); };
    for (const [k, v] of Object.entries(spec ?? {})) {
      const id = k === 'everyone' ? everyoneId : roleId[k];
      if (!id) { warn(`Overwrite → unknown role "${k}"`); continue; }
      put(id, v.allow, v.deny);
    }
    if (readonly) {
      put(everyoneId, ['ViewChannel', 'ReadMessageHistory', 'AddReactions'],
        ['SendMessages', 'SendMessagesInThreads', 'CreatePublicThreads', 'CreatePrivateThreads']);
      if (roleId['navigators']) put(roleId['navigators'], ['SendMessages', 'SendMessagesInThreads']);
    }
    return [...map.entries()].map(([id, e]) => ({ id, allow: e.allow, deny: e.deny, type: OverwriteType.Role }));
  };
  const expectedName = (name, type) => (TEXTLIKE.has(type) ? name.toLowerCase().replace(/\s+/g, '-') : name);

  // ── Categories & channels ──────────────────────────────────────────────────
  step('Channels');
  await guild.channels.fetch();
  const channelId = {};
  const pendingAnnouncement = [];
  const pendingStage = [];
  for (const cat of bp.categories) {
    const catOw = resolveOverwrites(cat.overwrites);
    let category = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === cat.name);
    if (category) { await category.permissionOverwrites.set(catOw); chg(`category ${cat.name}`); }
    else { category = await guild.channels.create({ name: cat.name, type: ChannelType.GuildCategory, permissionOverwrites: catOw }); add(`category ${cat.name}`); }
    channelId[cat.key] = category.id;

    for (const ch of cat.channels) {
      // Stage channels also need Community — defer until after it's enabled.
      if (ch.type === 'stage' && !guild.features.includes('COMMUNITY')) {
        const existingStage = guild.channels.cache.find((c) => c.parentId === category.id && c.name === ch.name);
        if (existingStage) channelId[ch.key] = existingStage.id;
        else pendingStage.push({ key: ch.key, name: ch.name, parentId: category.id });
        continue;
      }
      const wantName = expectedName(ch.name, ch.type);
      const explicit = !!ch.overwrites || !!ch.readonly;
      const chOw = resolveOverwrites(ch.overwrites, { readonly: ch.readonly });

      const edit = { name: ch.name, parent: category.id };
      if (ch.topic && TEXTLIKE.has(ch.type)) edit.topic = ch.topic;
      if (ch.slowmode && (ch.type === 'text' || ch.type === 'forum')) edit.rateLimitPerUser = ch.slowmode;
      if (ch.nsfw) edit.nsfw = true;

      let channel = guild.channels.cache.find((c) => c.parentId === category.id && c.name === wantName);
      try {
        if (channel) {
          await channel.edit(edit);
          if (cat.private && !explicit) await channel.lockPermissions();
          else if (explicit) await channel.permissionOverwrites.set(chOw);
          chg(`#${wantName}`);
        } else {
          // Announcement channels (type 5) can't be created before the guild is a
          // Community — make them text now, convert once Community is enabled.
          let createType = TYPE[ch.type];
          if (ch.type === 'announcement' && !guild.features.includes('COMMUNITY')) createType = ChannelType.GuildText;
          const create = { ...edit, type: createType, reason: 'VerseBase setup' };
          if (explicit) create.permissionOverwrites = chOw;
          channel = await guild.channels.create(create);
          if (cat.private && !explicit) await channel.lockPermissions();
          add(`#${wantName}`);
        }
      } catch (e) {
        warn(`channel #${wantName} skipped: ${e.message}`);
        continue;
      }
      channelId[ch.key] = channel.id;
      if (ch.type === 'announcement' && channel.type !== ChannelType.GuildAnnouncement) pendingAnnouncement.push(channel.id);
    }
  }

  // ── Community + guild-level settings ───────────────────────────────────────
  step('Community & server settings');
  let communityEnabled = guild.features.includes('COMMUNITY');
  const feats = new Set(guild.features);
  feats.add('COMMUNITY');
  const communityEdit = {
    features: [...feats],
    rulesChannel: channelId[bp.community.rulesChannel],
    publicUpdatesChannel: channelId[bp.community.updatesChannel],
    verificationLevel: GuildVerificationLevel[bp.community.verification],
    explicitContentFilter: GuildExplicitContentFilter[bp.community.contentFilter],
    defaultMessageNotifications: GuildDefaultMessageNotifications[bp.community.notifications],
    systemChannel: channelId[bp.guild.systemChannel],
    afkChannel: channelId[bp.guild.afkChannel],
    afkTimeout: bp.guild.afkTimeout,
    reason: 'VerseBase Community setup',
  };
  try {
    await guild.edit(communityEdit);
    communityEnabled = true;
    ok('Community enabled + rules/updates/system/AFK wired');
  } catch (e) {
    warn(`guild.edit failed (${e.message}); retrying via REST`);
    try {
      await client.rest.patch(Routes.guild(guild.id), {
        body: {
          features: [...feats],
          rules_channel_id: channelId[bp.community.rulesChannel],
          public_updates_channel_id: channelId[bp.community.updatesChannel],
          verification_level: 2, explicit_content_filter: 2, default_message_notifications: 1,
          system_channel_id: channelId[bp.guild.systemChannel],
          afk_channel_id: channelId[bp.guild.afkChannel], afk_timeout: bp.guild.afkTimeout,
        },
      });
      communityEnabled = true;
      ok('Community enabled (via REST)');
    } catch (e2) { warn(`Community enable failed: ${e2.message}. Enable it manually in Server Settings, then re-run for welcome/onboarding.`); }
  }

  // Now that Community is on, convert the queued channels to Announcement.
  if (communityEnabled && pendingAnnouncement.length) {
    let converted = 0;
    for (const id of pendingAnnouncement) {
      const c = guild.channels.cache.get(id);
      if (c && c.type !== ChannelType.GuildAnnouncement) {
        try { await c.edit({ type: ChannelType.GuildAnnouncement }); converted++; }
        catch (e) { warn(`announcement convert failed for #${c.name}: ${e.message}`); }
      }
    }
    if (converted) chg(`${converted} channel(s) set to Announcement`);
  }

  // Create deferred stage channels now that Community is on.
  if (communityEnabled && pendingStage.length) {
    for (const s of pendingStage) {
      try {
        const c = await guild.channels.create({ name: s.name, type: ChannelType.GuildStageVoice, parent: s.parentId, reason: 'VerseBase setup' });
        channelId[s.key] = c.id;
        add(`stage ${s.name}`);
      } catch (e) { warn(`stage ${s.name} skipped: ${e.message}`); }
    }
  }

  // ── Welcome screen ─────────────────────────────────────────────────────────
  step('Welcome screen');
  try {
    await guild.editWelcomeScreen({
      enabled: bp.welcomeScreen.enabled,
      description: bp.welcomeScreen.description,
      welcomeChannels: bp.welcomeScreen.channels.map((c) => ({ channel: channelId[c.channel], description: c.description, emoji: c.emoji })),
    });
    ok('Welcome screen set');
  } catch (e) { warn(`Welcome screen skipped: ${e.message}`); }

  // ── Onboarding ─────────────────────────────────────────────────────────────
  step('Onboarding');
  try {
    let pid = 1, oid = 1;
    const body = {
      enabled: true,
      mode: 0,
      default_channel_ids: bp.onboarding.defaultChannels.map((k) => channelId[k]).filter(Boolean),
      prompts: bp.onboarding.prompts.map((p) => ({
        id: String(pid++),
        type: 0,
        title: p.title,
        single_select: p.type === 'single',
        required: !!p.required,
        in_onboarding: true,
        options: p.options.map((o) => ({
          id: String(oid++),
          title: o.title,
          ...(o.description ? { description: o.description } : {}),
          ...(o.emoji ? { emoji: { name: o.emoji } } : {}),
          role_ids: (o.roles ?? []).map((k) => roleId[k]).filter(Boolean),
          channel_ids: (o.channels ?? []).map((k) => channelId[k]).filter(Boolean),
        })),
      })),
    };
    const route = typeof Routes.guildOnboarding === 'function' ? Routes.guildOnboarding(guild.id) : `/guilds/${guild.id}/onboarding`;
    await client.rest.put(route, { body });
    ok(`Onboarding configured (${body.prompts.length} prompts)`);
  } catch (e) { warn(`Onboarding skipped: ${e.message}. Set it in Server Settings → Onboarding (needs Community on).`); }

  // ── Branding ───────────────────────────────────────────────────────────────
  step('Branding');
  const iconPath = join(__dirname, 'assets', 'verse-base-icon.png');
  if (existsSync(iconPath)) {
    try { await guild.setIcon(readFileSync(iconPath), 'VerseBase icon'); ok('Server icon set'); }
    catch (e) { warn(`Icon skipped: ${e.message}`); }
  } else warn('No icon found — run `npm run icon` first to generate assets/verse-base-icon.png');

  // ── Seed content ───────────────────────────────────────────────────────────
  step('Seed content');
  const subst = (t) => (typeof t === 'string' ? t.replace(/<#([a-z0-9-]+)>/g, (m, k) => (channelId[k] ? `<#${channelId[k]}>` : m)) : t);
  const buildEmbed = (e) => {
    const b = new EmbedBuilder();
    if (e.title) b.setTitle(e.title);
    if (e.description) b.setDescription(subst(e.description));
    b.setColor(e.color ?? bp.C.cyan);
    if (e.fields) b.addFields(e.fields.map((f) => ({ name: f.name, value: subst(f.value), inline: !!f.inline })));
    if (e.footer) b.setFooter({ text: e.footer });
    if (e.url) b.setURL(e.url);
    return b;
  };
  const nameOf = (key) => expectedName(bp.categories.flatMap((c) => c.channels).find((c) => c.key === key)?.name ?? key, 'text');
  for (const [key, embeds] of Object.entries(bp.seed)) {
    const ch = guild.channels.cache.get(channelId[key]);
    if (!ch) { warn(`Seed: channel "${key}" not found`); continue; }
    const built = embeds.map(buildEmbed);

    // The seed post is the bot's PINNED message in the channel. Any other bot
    // messages here (e.g. the rank bot's patch auto-posts in #patch-notes — same
    // application) are never pinned, so this never edits or deletes them. This
    // makes re-seeding automatic: edit the blueprint, run build, done — no
    // manual deletion of old posts.
    let pinned = null;
    try { pinned = await ch.messages.fetchPinned(); } catch { /* ignore */ }
    const mine = pinned ? [...pinned.values()].filter((m) => m.author.id === client.user.id) : [];

    // Fast path: one pinned seed post ↔ one embed → update it in place (no delete).
    if (mine.length === 1 && built.length === 1) {
      try { await mine[0].edit({ embeds: built }); chg(`#${nameOf(key)} (seed updated in place)`); continue; }
      catch (e) { warn(`seed edit failed for ${key}: ${e.message}`); }
    }
    // Otherwise remove the old seed post(s) and re-post fresh.
    for (const m of mine) { await m.delete().catch(() => {}); }
    if (mine.length) chg(`#${nameOf(key)} (removed ${mine.length} old seed post${mine.length > 1 ? 's' : ''})`);
    let first = true;
    for (const e of built) {
      const msg = await ch.send({ embeds: [e] });
      if (first) { await msg.pin().catch(() => {}); first = false; }
    }
    add(`seeded #${nameOf(key)}`);
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  const roleCount = bp.roles.length;
  const chanCount = bp.categories.reduce((n, c) => n + c.channels.length, 0);
  console.log(clr('32;1', `\n✓ VerseBase is built — ${roleCount} roles, ${bp.categories.length} categories, ${chanCount} channels.`));
  log(clr('90', '  Re-run `npm run build` any time after editing blueprint.mjs — it updates in place.'));
  await client.destroy();
  process.exit(0);
}

// ── main ───────────────────────────────────────────────────────────────────
loadEnv();
if (VALIDATE) {
  validate();
} else if (!DJS) {
  fail('discord.js is not installed. Run `npm install` in this folder first.');
} else {
  build().catch((e) => fail(e.stack || e.message));
}
