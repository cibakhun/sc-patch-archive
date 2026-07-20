// ═══════════════════════════════════════════════════════════════════════════
//  patch-watch.mjs — auto-post new Star Citizen patches to #patch-notes.
//
//  Every 30 min it compares the latest patch in the data to the last one it
//  posted (stored per-guild in the DB). On a genuinely new version it posts the
//  summary and pings @Patch Pings. The very first post (fresh DB) goes up
//  WITHOUT a ping, so nobody gets an alert just because the bot started.
// ═══════════════════════════════════════════════════════════════════════════
import { latestPatch, reload } from './data.mjs';
import { buildPatchEmbed, patchButtons } from './data-commands.mjs';
import { t } from './i18n.mjs';

const CHECK_MS = 30 * 60 * 1000;
// Post-format tag. Bump this to force a one-time, silent re-post of the current
// patch in the new format (used for the English-only → bilingual cutover).
const POST_FMT = 'bi1';

const findPatchChannel = (guild) =>
  guild.channels.cache.find((c) => c.isTextBased?.() && !c.isVoiceBased?.() && /patch-notes/i.test(c.name));
const findPatchRole = (guild) =>
  guild.roles.cache.find((r) => /patch\s*pings/i.test(r.name));

// Delete the bot's OWN, non-pinned posts whose embed title is this exact version
// — used once to replace the pre-bilingual English-only card. Never touches the
// pinned seed post or any other patch. Best-effort; never throws.
async function purgeOwnPatchPosts(channel, botId, version) {
  try {
    const msgs = await channel.messages.fetch({ limit: 50 });
    const mine = [...msgs.values()].filter((m) =>
      m.author?.id === botId && !m.pinned &&
      m.embeds?.[0]?.title && m.embeds[0].title.startsWith(String(version)));
    for (const m of mine) await m.delete().catch(() => {});
    return mine.length;
  } catch { return 0; }
}

async function check(ctx) {
  reload(); // pick up freshly-committed data without a restart
  const p = latestPatch();
  if (!p) return;

  for (const guild of ctx.client.guilds.cache.values()) {
    const last = ctx.db.getMeta(guild.id, 'lastPatch');
    const fmt = ctx.db.getMeta(guild.id, 'lastPatchFmt');
    // Same version already posted but in an older format → re-post once, silently.
    const cutover = last === p.version && fmt !== POST_FMT;
    if (last === p.version && !cutover) continue;

    const channel = findPatchChannel(guild);
    if (!channel) { ctx.db.setMeta(guild.id, 'lastPatch', p.version); ctx.db.setMeta(guild.id, 'lastPatchFmt', POST_FMT); continue; }

    const role = findPatchRole(guild);
    const isNew = last != null && !cutover; // genuine new patch → ping; cutover → silent

    if (cutover) {
      const n = await purgeOwnPatchPosts(channel, ctx.client.user.id, p.version);
      if (n) console.log(`  · replaced ${n} old English patch post(s) for ${p.version} in ${guild.name}`);
    }
    try {
      // Broadcast to one channel → can't be per-user, so post both languages:
      // an English embed and a German embed (image only once), bilingual ping.
      await channel.send({
        content: isNew && role ? `<@&${role.id}> — ${t('en', 'patch.newDrop')} · ${t('de', 'patch.newDrop')}` : undefined,
        embeds: [buildPatchEmbed(p, 'en'), buildPatchEmbed(p, 'de', { image: false })],
        components: [patchButtons(p, 'en')],
        allowedMentions: { roles: isNew && role ? [role.id] : [] },
      });
      ctx.db.setMeta(guild.id, 'lastPatch', p.version);
      ctx.db.setMeta(guild.id, 'lastPatchFmt', POST_FMT);
      console.log(`  · posted patch ${p.version} to #${channel.name} in ${guild.name}${cutover ? ' (bilingual cutover)' : ''}`);
    } catch (e) {
      console.warn(`[patch] post failed in ${guild.name}: ${e.message}`);
    }
  }
}

export function startPatchWatch(ctx) {
  check(ctx).catch((e) => console.warn('[patch] initial check:', e.message));
  const t = setInterval(() => check(ctx).catch((e) => console.warn('[patch] check:', e.message)), CHECK_MS);
  t.unref?.();
  return t;
}
