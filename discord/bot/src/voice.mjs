// ═══════════════════════════════════════════════════════════════════════════
//  voice.mjs — periodic voice-XP sweep.
//
//  Every SWEEP_SEC the bot scans occupied voice channels and grants XP to
//  eligible members (not AFK, not alone, not self-muted/deafened — all per
//  config). Stateless across restarts: it simply reads live voice states, so
//  there's nothing to lose if the process bounces.
// ═══════════════════════════════════════════════════════════════════════════
import { ChannelType } from 'discord.js';
import { DEFAULT_CONFIG, isNoXpChannel } from './config.mjs';
import { effectiveMultiplier, applyMultiplier } from './leveling.mjs';
import { grantXp } from './award.mjs';

export function startVoiceSweep(ctx) {
  const SWEEP_SEC = DEFAULT_CONFIG.voice.sweepSec;

  const tick = async () => {
    for (const guild of ctx.client.guilds.cache.values()) {
      let config;
      try { config = ctx.db.getConfig(guild.id); } catch { continue; }

      const perTick = config.voice.perMinute * (SWEEP_SEC / 60);

      for (const channel of guild.channels.cache.values()) {
        if (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice) continue;
        if (config.voice.ignoreAfk && channel.id === guild.afkChannelId) continue;
        if (isNoXpChannel(channel, config)) continue;

        const humans = channel.members.filter((m) => !m.user.bot);
        if (config.voice.requireOthers && humans.size < 2) continue;

        for (const member of humans.values()) {
          const vs = member.voice;
          if (config.voice.ignoreMutedDeafened && (vs.selfMute || vs.selfDeaf)) continue;

          const row = ctx.db.getUser(guild.id, member.id);
          const mult = effectiveMultiplier(config, {
            channelId: channel.id,
            roleIds: [...member.roles.cache.keys()],
            isBooster: !!member.premiumSince,
            prestigeStars: row.prestige,
          });
          const gained = applyMultiplier(perTick, mult);
          await grantXp(ctx, { member, guild, amount: gained, stats: { voiceSeconds: SWEEP_SEC } });
        }
      }
    }
  };

  const timer = setInterval(() => {
    tick().catch((e) => console.warn('[voice] sweep error:', e.message));
  }, SWEEP_SEC * 1000);
  timer.unref?.();
  return timer;
}
