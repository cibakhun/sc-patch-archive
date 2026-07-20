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

const CHECK_MS = 30 * 60 * 1000;

const findPatchChannel = (guild) =>
  guild.channels.cache.find((c) => c.isTextBased?.() && !c.isVoiceBased?.() && /patch-notes/i.test(c.name));
const findPatchRole = (guild) =>
  guild.roles.cache.find((r) => /patch\s*pings/i.test(r.name));

async function check(ctx) {
  reload(); // pick up freshly-committed data without a restart
  const p = latestPatch();
  if (!p) return;

  for (const guild of ctx.client.guilds.cache.values()) {
    const last = ctx.db.getMeta(guild.id, 'lastPatch');
    if (last === p.version) continue;

    const channel = findPatchChannel(guild);
    if (!channel) { ctx.db.setMeta(guild.id, 'lastPatch', p.version); continue; }

    const role = findPatchRole(guild);
    const isNew = last != null; // false on first run → no ping
    try {
      await channel.send({
        content: isNew && role ? `<@&${role.id}> — a new patch just dropped` : undefined,
        embeds: [buildPatchEmbed(p)],
        components: [patchButtons(p)],
        allowedMentions: { roles: isNew && role ? [role.id] : [] },
      });
      ctx.db.setMeta(guild.id, 'lastPatch', p.version);
      console.log(`  · posted patch ${p.version} to #${channel.name} in ${guild.name}`);
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
