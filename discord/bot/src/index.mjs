// ═══════════════════════════════════════════════════════════════════════════
//  index.mjs — the always-on bot. Wires the gateway client to the XP engine,
//  the voice sweep, role provisioning and the slash-command handlers.
//
//  Intents: Guilds, GuildMessages, GuildVoiceStates — non-privileged, plus
//  ONE privileged intent since Phase 14 Plan 07: GuildMembers, purpose-bound
//  to the Testpilot role mirror (D-08/D-17/D-25) — see the comment at the
//  Client construction below. Presence and MessageContent stay OFF (we
//  never read message content, only that a message happened).
// ═══════════════════════════════════════════════════════════════════════════
import { Client, GatewayIntentBits, Events, ActivityType } from 'discord.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.mjs';
import { RankRoles } from './roles.mjs';
import { grantXp } from './award.mjs';
import { startVoiceSweep } from './voice.mjs';
import { startPatchWatch } from './patch-watch.mjs';
import { registerRoleSync } from './role-sync.mjs';
import { reconcileRoles } from './role-reconcile.mjs';
import * as commands from './commands.mjs';
import { ensureEmoji } from './emoji.mjs';
import { ensureAvatar } from './avatar.mjs';
import { loadEnv, getSupabaseConfig } from './env.mjs';
import { effectiveMultiplier, applyMultiplier, randomXp } from './leveling.mjs';
import { isNoXpChannel } from './config.mjs';
import { resolveLocale, t } from './i18n.mjs';

const here = dirname(fileURLToPath(import.meta.url));
loadEnv();

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('✗ DISCORD_TOKEN missing. Copy .env.example → .env and set it.');
  process.exit(1);
}
const DB_PATH = process.env.DB_PATH || join(here, '..', 'data', 'leveling.db');

const db = openDb(DB_PATH);
const roles = new RankRoles();
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    // GuildMembers: PRIVILEGED intent (Discord Developer Portal → Bot →
    // Privileged Gateway Intents → Server Members Intent, enabled 18.08.2026
    // for Phase 14 Plan 07). Purpose-bound to the Testpilot role mirror
    // (D-08/D-17/D-25): guildMemberUpdate/Add/Remove for role-sync.mjs and
    // the full member list for role-reconcile.mjs's startup reconcile. The
    // full member list is NEVER printed/posted anywhere — only used to
    // resolve "tester" role membership. Presence and MessageContent stay
    // OFF (see discord/README.md and COVERAGE.md — both are reasoned
    // opt-outs; a second privileged intent would widen data collection
    // without benefit).
    GatewayIntentBits.GuildMembers,
  ],
});
const supabase = getSupabaseConfig();
const ctx = { client, db, roles, supabase };
const cooldowns = new Map(); // `${guildId}:${userId}` -> epoch ms

if (!supabase) {
  console.warn('  ! SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY fehlen -- Testpilot-Rollenspiegelung inaktiv. Raenge/XP/Sprache/Patch-Wache laufen unveraendert weiter.');
}

// ── Testpilot role mirror (D-08/D-17/D-25) ──────────────────────────────────
// Registered here, alongside the other top-level event listeners below —
// NOT gated behind ClientReady, same style as MessageCreate/InteractionCreate.
registerRoleSync(ctx);

client.once(Events.ClientReady, async (c) => {
  console.log(`✓ ${c.user.tag} online — ${c.guilds.cache.size} guild(s)`);
  await ensureAvatar(c).catch(() => {});
  // The line under the bot's name in the member list — permanently visible and,
  // until now, permanently blank. Points at the thing the whole server is for.
  try {
    c.user.setPresence({ status: 'online', activities: [{ name: 'verse-base.com', type: ActivityType.Watching }] });
  } catch (e) { console.warn(`  ! presence: ${e.message}`); }
  const cmdData = commands.buildCommandData();
  for (const guild of c.guilds.cache.values()) {
    try { await guild.commands.set(cmdData); console.log(`  · ${cmdData.length} slash commands registered in ${guild.name}`); }
    catch (e) { console.warn(`  ! command registration in ${guild.name}: ${e.message}`); }
    try { await roles.ensure(guild); console.log(`  · rank roles ready in ${guild.name}`); }
    catch (e) { console.warn(`  ! roles in ${guild.name}: ${e.message}`); }
    try { await ensureEmoji(guild); } catch (e) { console.warn(`  ! emoji in ${guild.name}: ${e.message}`); }
    // Vollabgleich des Testpilot-Rollenspiegels (D-25) — laeuft EINMAL beim
    // Start, neben roles.ensure(guild). reconcileRoles() wirft nie (siehe
    // Kommentarblock dort); der try/catch hier ist defensive Verdopplung,
    // damit ein unerwarteter Fehler die ClientReady-Sequenz nicht abbricht.
    try { await reconcileRoles(ctx, guild); } catch (e) { console.warn(`  ! Rollenabgleich in ${guild.name}: ${e.message}`); }
  }
  if (c.guilds.cache.size === 0) console.log('  · not in any server yet — invite the bot; commands register automatically on join.');
  startVoiceSweep(ctx);
  startPatchWatch(ctx);
  console.log('  · voice XP sweep + patch watch started — bot is live.');
});

client.on(Events.GuildCreate, async (guild) => {
  try { await guild.commands.set(commands.buildCommandData()); } catch { /* ignore */ }
  roles.ensure(guild).catch(() => {});
  ensureEmoji(guild).catch(() => {});
  console.log(`+ joined ${guild.name} — commands + rank roles set up.`);
});

// ── Text XP ─────────────────────────────────────────────────────────────────
client.on(Events.MessageCreate, async (message) => {
  if (!message.inGuild() || message.author.bot || message.webhookId || message.system) return;

  const config = db.getConfig(message.guildId);
  if (isNoXpChannel(message.channel, config)) return;

  const member = message.member ?? await message.guild.members.fetch(message.author.id).catch(() => null);
  if (!member) return;

  const key = `${message.guildId}:${message.author.id}`;
  const now = Date.now();
  if (now - (cooldowns.get(key) ?? 0) < config.text.cooldownSec * 1000) {
    db.addStats(message.guildId, message.author.id, { messages: 1 }); // still count the message
    return;
  }
  cooldowns.set(key, now);

  const row = db.getUser(message.guildId, message.author.id);
  const base = randomXp(config.text.min, config.text.max);
  const mult = effectiveMultiplier(config, {
    channelId: message.channelId,
    roleIds: [...member.roles.cache.keys()],
    isBooster: !!member.premiumSince,
    prestigeStars: row.prestige,
  });
  const amount = applyMultiplier(base, mult);
  await grantXp(ctx, { member, guild: message.guild, amount, stats: { messages: 1 }, currentChannel: message.channel });
});

// ── Interactions ──────────────────────────────────────────────────────────────
client.on(Events.InteractionCreate, async (i) => {
  try {
    if (i.isChatInputCommand()) await commands.execute(ctx, i);
    else if (i.isButton()) await commands.handleButton(ctx, i);
    else if (i.isAutocomplete()) await commands.handleAutocomplete(ctx, i);
  } catch (e) {
    console.error('[interaction]', e);
    if (i.isAutocomplete?.()) return;
    const locale = resolveLocale(i.member, i.locale);
    const payload = { content: t(locale, 'err.generic'), ephemeral: true };
    if (i.deferred || i.replied) i.followUp(payload).catch(() => {});
    else i.reply(payload).catch(() => {});
  }
});

// ── Lifecycle ─────────────────────────────────────────────────────────────────
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log('\nShutting down…');
    try { db.close(); } catch { /* ignore */ }
    client.destroy();
    process.exit(0);
  });
}

client.login(token).catch((e) => {
  console.error('✗ Login failed:', e.message);
  process.exit(1);
});
