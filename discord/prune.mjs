// ═════════════════════════════════════════════════════════════════════════
//  prune.mjs — what's on the live server that the blueprint no longer wants.
//
//  `build.mjs` only ever CREATES and RECONCILES; it never removes anything.
//  That's the right default (a stray channel is not worth an accidental
//  deletion), but it means slimming the blueprint leaves the dropped channels
//  and roles sitting on the live server forever. This is the other half.
//
//  DRY RUN BY DEFAULT. Plain `node prune.mjs` connects read-only, prints the
//  plan and changes nothing. Read the plan first — that's the whole point.
//
//    node prune.mjs                 # dry run: what would go, and how alive it is
//    node prune.mjs --archive       # hide orphaned channels, keep every message
//    node prune.mjs --delete        # actually remove them (irreversible)
//    node prune.mjs --drop-archive  # also list/remove what's IN the archive
//    node prune.mjs --channels      # limit the run to channels
//    node prune.mjs --roles         # limit the run to roles
//
//  --archive hides channels from MEMBERS, but an admin keeps seeing them:
//  Administrator overrides the ViewChannel deny, so the sidebar stays exactly as
//  long for the owner. Once the dry run has shown the archive holds nothing,
//  `--drop-archive --delete` is what actually makes the server look short.
//
//  --archive is the reversible option and usually the right first move: the
//  channel is moved into a private "🗄 ARCHIVE" category that @everyone can't
//  see. History survives, the sidebar gets quiet, and you can drag anything
//  back if the decision was wrong. --delete is for when you're sure.
//
//  NEVER TOUCHED, in any mode:
//    · anything named in blueprint.mjs
//    · the 12 rank roles + any ✦ prestige role (the bot owns those)
//    · managed roles (bot/integration roles) and @everyone
//    · roles positioned above the bot (Discord refuses those anyway)
//    · the archive category itself
// ═════════════════════════════════════════════════════════════════════════
import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from 'discord.js';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as bp from './blueprint.mjs';
import { allRankRoleNames, PRESTIGE } from './bot/src/ranks.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
}
if (!process.env.DISCORD_TOKEN || !process.env.GUILD_ID) {
  console.error('✗ Need DISCORD_TOKEN and GUILD_ID — set them in discord/.env or the environment.');
  process.exit(1);
}

const argv = new Set(process.argv.slice(2));
const MODE = argv.has('--delete') ? 'delete' : argv.has('--archive') ? 'archive' : 'dry';
// --archive hides channels from members, but an admin still sees the archive
// category (Administrator overrides the ViewChannel deny), so the sidebar stays
// just as long for the one person looking at it most. --drop-archive is the
// second step: empty the archive for good, once you've seen it holds nothing.
const DROP_ARCHIVE = argv.has('--drop-archive');
const doChannels = !argv.has('--roles');
const doRoles = !argv.has('--channels');
const ARCHIVE_CAT = '🗄 ARCHIVE';

const c = { dim: '\x1b[2m', red: '\x1b[31m', yellow: '\x1b[33m', green: '\x1b[32m', cyan: '\x1b[36m', bold: '\x1b[1m', off: '\x1b[0m' };
const say = (...a) => console.log(...a);
const head = (t) => say(`\n${c.bold}${c.cyan}── ${t} ${'─'.repeat(Math.max(0, 60 - t.length))}${c.off}`);
const date = (ts) => new Date(ts).toISOString().slice(0, 10);

// ── What the blueprint wants ───────────────────────────────────────────────
const wantChannels = new Set(bp.categories.flatMap((cat) => cat.channels.map((ch) => ch.name)));
const wantCategories = new Set(bp.categories.map((cat) => cat.name));
const wantRoles = new Set(bp.roles.map((r) => r.name));
// The bot creates and owns these; they're not in the blueprint by design.
// NOTE: it must be allRankRoleNames() — RANKS[].name is the BARE name ("Drifter"),
// while the live role carries its insignia ("🌑 Drifter"). Matching on the bare
// name protects nothing and offers the whole rank ladder up for deletion.
const rankRoleNames = new Set(allRankRoleNames());
const isBotOwnedRole = (name) =>
  rankRoleNames.has(name) || name.includes(PRESTIGE.star) || name.includes(PRESTIGE.name);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
await client.login(process.env.DISCORD_TOKEN);
await new Promise((r) => { client.once('clientReady', r); client.once('ready', r); });
const guild = await client.guilds.fetch(process.env.GUILD_ID);
await guild.channels.fetch();
await guild.roles.fetch();
const me = await guild.members.fetchMe();
const botTop = me.roles.highest.position;

say(`${c.bold}VerseBase · prune${c.off}  —  ${guild.name}  ·  mode: ${MODE === 'dry' ? `${c.green}DRY RUN (nothing is changed)${c.off}` : MODE === 'archive' ? `${c.yellow}ARCHIVE${c.off}` : `${c.red}DELETE${c.off}`}`);
say(`${c.dim}Blueprint wants ${wantChannels.size} channels in ${wantCategories.size} categories, ${wantRoles.size} roles (+${rankRoleNames.size} bot-owned rank roles).${c.off}`);

// ── Channels ───────────────────────────────────────────────────────────────
const orphanChannels = [];
const orphanCategories = [];
if (doChannels) {
  for (const ch of guild.channels.cache.values()) {
    // Threads live in the channel cache too. They are content INSIDE a channel,
    // never orphans in their own right — a forum's seed post would otherwise be
    // treated as a channel the blueprint doesn't want.
    if (ch.isThread?.()) continue;
    if (ch.name === ARCHIVE_CAT || ch.parent?.name === ARCHIVE_CAT) continue;
    if (ch.type === ChannelType.GuildCategory) {
      if (!wantCategories.has(ch.name)) orphanCategories.push(ch);
    } else if (!wantChannels.has(ch.name)) {
      orphanChannels.push(ch);
    }
  }

  head(`Channels the blueprint no longer has (${orphanChannels.length})`);
  if (!orphanChannels.length) say(`${c.dim}  none — the live server matches the blueprint.${c.off}`);
  for (const ch of orphanChannels.sort((a, b) => (a.parent?.name ?? '').localeCompare(b.parent?.name ?? '') || a.rawPosition - b.rawPosition)) {
    // Last message = the only cheap "is this alive?" signal the API gives us.
    // Order matters: in discord.js v14 a voice channel IS text-based (voice text
    // chat), so it has to be matched before the generic text branch, and a forum
    // is NOT text-based, so it needs its own.
    let activity = '';
    if (ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice) {
      activity = `${ch.members?.size ?? 0} connected now`;
    } else if (ch.type === ChannelType.GuildForum) {
      try {
        const act = await ch.threads.fetchActive();
        activity = `${act.threads.size} active thread(s)`;
      } catch { activity = 'threads unreadable'; }
    } else if (ch.isTextBased?.()) {
      try {
        const last = await ch.messages.fetch({ limit: 1 });
        const m = last.first();
        activity = m ? `last post ${date(m.createdTimestamp)}` : 'empty';
      } catch { activity = 'unreadable'; }
    }
    const kind = ChannelType[ch.type].replace('Guild', '').toLowerCase();
    say(`  ${c.yellow}#${ch.name}${c.off} ${c.dim}(${kind}, in "${ch.parent?.name ?? 'no category'}", created ${date(ch.createdTimestamp)}${activity ? `, ${activity}` : ''})${c.off}`);
  }

  head(`Categories the blueprint no longer has (${orphanCategories.length})`);
  if (!orphanCategories.length) say(`${c.dim}  none.${c.off}`);
  for (const cat of orphanCategories) {
    const survivors = [...guild.channels.cache.values()].filter((x) => x.parentId === cat.id && wantChannels.has(x.name));
    say(`  ${c.yellow}${cat.name}${c.off} ${c.dim}(created ${date(cat.createdTimestamp)})${c.off}`
      + (survivors.length ? `\n    ${c.green}↳ ${survivors.length} channel(s) here are KEPT and get moved by the next build: ${survivors.map((s) => '#' + s.name).join(', ')}${c.off}` : ''));
  }
}

// ── Roles ──────────────────────────────────────────────────────────────────
// Member counts need the privileged Server Members intent, which this bot
// deliberately doesn't have. Printing "0 members" without it would be a lie, so
// try once and simply say so when it isn't available.
let memberCounts = null;
if (doRoles) {
  // Without the intent this can sit waiting for a chunk that never arrives, so
  // race it — a dry run should never look like it hung.
  try {
    await Promise.race([
      guild.members.fetch(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10_000)),
    ]);
    memberCounts = true;
  } catch {
    memberCounts = false;
  }
}

const liveRoleNames = new Set([...guild.roles.cache.values()].map((r) => r.name));
const ladderFound = [...rankRoleNames].filter((n) => liveRoleNames.has(n)).length;

const orphanRoles = [];
if (doRoles) {
  for (const r of guild.roles.cache.values()) {
    if (r.id === guild.id) continue;                 // @everyone
    if (r.managed) continue;                          // bot/integration roles
    if (wantRoles.has(r.name) || isBotOwnedRole(r.name)) continue;
    orphanRoles.push(r);
  }

  head(`Roles the blueprint no longer has (${orphanRoles.length})`);
  // Negative control. The rank-role protection is name matching, and name
  // matching is precisely what failed here once (bare "Drifter" vs live
  // "🌑 Drifter"), which offered the entire ladder up for deletion. So prove the
  // ladder actually resolves against live roles before anything destructive runs.
  if (ladderFound !== rankRoleNames.size) {
    say(`  ${c.red}✗ SAFETY STOP — only ${ladderFound}/${rankRoleNames.size} rank roles matched a live role.${c.off}`);
    say(`  ${c.red}  The name matching that protects them is broken, so this list can't be trusted.${c.off}`);
    say(`  ${c.dim}  Roles will be skipped. Fix allRankRoleNames() vs the live names first.${c.off}`);
  } else {
    say(`  ${c.dim}  (safety check: all ${ladderFound} rank roles resolved and are protected)${c.off}`);
  }
  if (!orphanRoles.length) say(`${c.dim}  none.${c.off}`);
  if (orphanRoles.length && memberCounts === false) {
    say(`${c.dim}  (member counts unavailable — the bot has no Server Members intent, by design)${c.off}`);
  }
  for (const r of orphanRoles.sort((a, b) => b.position - a.position)) {
    const above = r.position >= botTop;
    const who = memberCounts ? `, ${r.members.size} member(s)` : '';
    say(`  ${c.yellow}${r.name}${c.off} ${c.dim}(position ${r.position}, created ${date(r.createdTimestamp)}${who})${c.off}`
      + (above ? ` ${c.red}← above the bot, Discord will refuse${c.off}` : ''));
  }
}

// ── The archive itself ─────────────────────────────────────────────────────
const archived = [];
if (DROP_ARCHIVE) {
  const cat = guild.channels.cache.find((x) => x.type === ChannelType.GuildCategory && x.name === ARCHIVE_CAT);
  const kids = cat ? [...guild.channels.cache.values()].filter((x) => x.parentId === cat.id && !x.isThread?.()) : [];
  if (cat) archived.push(...kids, cat);

  head(`Archive contents — would be deleted for good (${archived.length})`);
  if (!cat) say(`${c.dim}  no "${ARCHIVE_CAT}" category on this server.${c.off}`);
  for (const ch of kids) {
    let note = 'empty';
    if (ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice) note = 'voice';
    else if (ch.type === ChannelType.GuildForum) {
      try { const a = await ch.threads.fetchActive(); const b = await ch.threads.fetchArchived().catch(() => ({ threads: new Map() }));
        const n = a.threads.size + b.threads.size; note = n ? `${c.red}${n} thread(s) — CONTENT${c.off}` : 'no threads'; } catch { note = 'threads unreadable'; }
    } else if (ch.isTextBased?.()) {
      try { const last = await ch.messages.fetch({ limit: 1 }); const m = last.first();
        note = m ? `${c.red}last post ${date(m.createdTimestamp)} — CONTENT${c.off}` : 'empty'; } catch { note = 'unreadable'; }
    }
    say(`  ${c.yellow}#${ch.name}${c.off} ${c.dim}(${note})${c.off}`);
  }
  if (cat) say(`  ${c.yellow}${ARCHIVE_CAT}${c.off} ${c.dim}(the category itself)${c.off}`);
}

// ── Act, or don't ──────────────────────────────────────────────────────────
const total = orphanChannels.length + orphanCategories.length + orphanRoles.length + archived.length;
if (MODE === 'dry') {
  head('Nothing was changed');
  say(`  ${total} item(s) would be affected.`);
  say(`  ${c.dim}Reversible — hide the channels, keep every message:${c.off}  node prune.mjs --archive`);
  say(`  ${c.dim}Irreversible — remove them for good:${c.off}             node prune.mjs --delete`);
  say(`  ${c.dim}Either way, run \`npm run build\` afterwards so the survivors land in their new categories.${c.off}`);
  await client.destroy();
  process.exit(0);
}

let done = 0, failed = 0;
const attempt = async (label, fn) => {
  try { await fn(); done++; say(`  ${c.green}✓${c.off} ${label}`); }
  catch (e) { failed++; say(`  ${c.red}✗${c.off} ${label} — ${e.message}`); }
};

if (MODE === 'archive') {
  head('Archiving');
  if (!orphanChannels.length) say(`${c.dim}  nothing to archive.${c.off}`);
  else {
    let cat = guild.channels.cache.find((x) => x.type === ChannelType.GuildCategory && x.name === ARCHIVE_CAT);
    if (!cat) {
      cat = await guild.channels.create({
        name: ARCHIVE_CAT, type: ChannelType.GuildCategory,
        permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }],
        reason: 'VerseBase prune — retired channels, history kept',
      });
      say(`  ${c.green}✓${c.off} created category "${ARCHIVE_CAT}" (hidden from @everyone)`);
    }
    for (const ch of orphanChannels) {
      // Voice/stage rooms have no history worth keeping — archiving them just
      // hides clutter, so they're treated the same as text here.
      await attempt(`#${ch.name} → ${ARCHIVE_CAT}`, async () => {
        await ch.edit({ parent: cat.id, reason: 'VerseBase prune' });
        await ch.lockPermissions();
      });
    }
  }
  // Empty categories can go — their channels have moved out.
  for (const cat of orphanCategories) {
    const left = [...guild.channels.cache.values()].filter((x) => x.parentId === cat.id);
    if (left.length) { say(`  ${c.dim}– kept "${cat.name}" (${left.length} channel(s) still inside)${c.off}`); continue; }
    await attempt(`category "${cat.name}" (empty)`, () => cat.delete('VerseBase prune'));
  }
  say(`\n${c.dim}Roles are left alone by --archive (a hidden role is just a role). Use --delete --roles when you're sure.${c.off}`);
}

if (MODE === 'delete') {
  head('Deleting');
  // Channels first, then the category that held them — Discord refuses to delete
  // a category while it still has children.
  for (const ch of archived) await attempt(`${ch.type === ChannelType.GuildCategory ? 'category ' : '#'}${ch.name}`, () => ch.delete('VerseBase prune — archive dropped'));
  for (const ch of orphanChannels) await attempt(`#${ch.name}`, () => ch.delete('VerseBase prune'));
  for (const cat of orphanCategories) {
    const left = [...guild.channels.cache.values()].filter((x) => x.parentId === cat.id && !orphanChannels.some((o) => o.id === x.id));
    if (left.length) { say(`  ${c.dim}– kept "${cat.name}" (${left.length} kept channel(s) still inside — move them first with \`npm run build\`)${c.off}`); continue; }
    await attempt(`category "${cat.name}"`, () => cat.delete('VerseBase prune'));
  }
  if (orphanRoles.length && ladderFound !== rankRoleNames.size) {
    say(`  ${c.red}✗ roles skipped entirely — the rank-ladder safety check failed (see above).${c.off}`);
  } else {
    for (const r of orphanRoles) {
      if (r.position >= botTop) { say(`  ${c.dim}– skipped "${r.name}" (above the bot)${c.off}`); continue; }
      await attempt(`role "${r.name}"`, () => r.delete('VerseBase prune'));
    }
  }
}

head('Result');
say(`  ${done} done, ${failed} failed.`);
say(`  ${c.dim}Now run \`npm run build\` so surviving channels move into their new categories, then \`npm run order\` and \`npm run audit\`.${c.off}`);
await client.destroy();
process.exit(failed ? 1 : 0);
