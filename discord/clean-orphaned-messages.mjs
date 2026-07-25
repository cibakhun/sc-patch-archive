// ═════════════════════════════════════════════════════════════════════════
//  clean-orphaned-messages.mjs — remove blank ghost messages left behind by a
//  previous bot identity (after swapping the Discord application).
//
//    node clean-orphaned-messages.mjs            # DRY RUN — only lists them
//    node clean-orphaned-messages.mjs --delete   # actually removes them
//
//  When an application is deleted, Discord strips the embeds off every message
//  it ever sent. Its seed posts stay pinned but render as empty messages, and
//  the builder can't edit or replace them (different author), so a re-run just
//  posts a second copy alongside. This clears the corpses.
//
//  The filter is deliberately paranoid — a message must be ALL of:
//    · written by a bot, and not by the bot running this script
//    · written by an account that is no longer in the server
//    · a normal post or slash-command reply — never a system message
//    · not webhook-delivered
//    · completely empty: no text, no embeds, no attachments, no stickers,
//      no components, no poll
//  and the guild's public-updates channel is skipped outright. Discord's own
//  "Community Updates" and "automod" accounts look exactly like orphaned bots
//  (bot, not a member, no readable content) and must never be swept.
//  Pass `--author <id>` to narrow it to one specific previous application.
// ═════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, GatewayIntentBits, MessageType } from 'discord.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
}
if (!process.env.DISCORD_TOKEN) {
  console.error('✗ No DISCORD_TOKEN — set it in discord/.env or the environment.');
  process.exit(1);
}

const DELETE = process.argv.includes('--delete');
const AUTHOR = process.argv[process.argv.indexOf('--author') + 1]?.match(/^\d+$/)
  ? process.argv[process.argv.indexOf('--author') + 1] : null;
const clr = (c, s) => `\x1b[${c}m${s}\x1b[0m`;

// Only a bot's own output — never a system notice (join, pin, AutoMod alert…).
const SWEEPABLE = new Set([MessageType.Default, MessageType.ChatInputCommand, MessageType.ContextMenuCommand]);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
await client.login(process.env.DISCORD_TOKEN);
await new Promise((r) => { client.once('clientReady', r); client.once('ready', r); });

const guild = await client.guilds.fetch(process.env.GUILD_ID || (await client.guilds.fetch()).first().id);
await guild.channels.fetch();

const isEmpty = (m) =>
  !(m.content || '').trim() &&
  !m.embeds.length &&
  !m.attachments.size &&
  !m.stickers.size &&
  !(m.components?.length) &&
  !m.poll;

// Cache "is this author still in the server?" — one lookup per author.
const present = new Map();
const stillHere = async (id) => {
  if (!present.has(id)) present.set(id, !!(await guild.members.fetch(id).catch(() => null)));
  return present.get(id);
};

console.log(clr('37;1', `\nOrphaned-message sweep — ${guild.name}`));
console.log(clr('90', DELETE ? 'MODE: delete' : 'MODE: dry run (pass --delete to actually remove)'));

const found = [];
for (const ch of [...guild.channels.cache.values()].sort((a, b) => a.rawPosition - b.rawPosition)) {
  if (!ch.isTextBased?.() || ch.isVoiceBased?.()) continue;
  // Discord posts its own admin/safety notices here — hands off.
  if (ch.id === guild.publicUpdatesChannelId) continue;
  const msgs = await ch.messages.fetch({ limit: 100 }).catch(() => null);
  if (!msgs) continue;
  for (const m of msgs.values()) {
    if (!m.author.bot || m.author.id === client.user.id) continue;
    if (AUTHOR && m.author.id !== AUTHOR) continue;
    // Webhook-delivered messages are somebody else's channel (Discord's own
    // "Community Updates" arrives this way). Slash-command replies also carry a
    // webhookId — allow those only when --author named this exact application,
    // so relaxing the guard can't reach anything but the app you asked for.
    if (m.webhookId && !(AUTHOR && m.webhookId === AUTHOR)) continue;
    if (!SWEEPABLE.has(m.type)) continue;         // system messages stay
    if (!isEmpty(m)) continue;
    if (await stillHere(m.author.id)) continue;   // a bot that's still here owns its messages
    found.push({ ch, m });
  }
}

if (!found.length) {
  console.log(clr('32', '\n✓ Nothing orphaned — every message has an author that is still here, or content.\n'));
  await client.destroy();
  process.exit(0);
}

let lastCh = null;
for (const { ch, m } of found) {
  if (ch.id !== lastCh) { console.log(clr('34;1', `\n  #${ch.name}`)); lastCh = ch.id; }
  const when = new Date(Number((BigInt(m.id) >> 22n) + 1420070400000n)).toISOString().slice(0, 16).replace('T', ' ');
  console.log(`    ${when}  ${MessageType[m.type].padEnd(18)} ${m.pinned ? clr('33', 'pinned') : '      '}  by ${m.author.username}`);
}
console.log(clr('37;1', `\n  ${found.length} blank message(s) from ${present.size > 0 ? [...new Set(found.map((f) => f.m.author.username))].join(', ') : '?'}`));

if (!DELETE) {
  console.log(clr('33', '\n  Dry run — nothing was removed. Re-run with --delete to remove them.\n'));
  await client.destroy();
  process.exit(0);
}

let gone = 0;
for (const { m } of found) {
  try { await m.delete(); gone++; }
  catch (e) { console.log(clr('31', `    ! ${m.id}: ${e.message}`)); }
}
console.log(clr('32;1', `\n✓ Removed ${gone}/${found.length} message(s).\n`));
await client.destroy();
process.exit(0);
