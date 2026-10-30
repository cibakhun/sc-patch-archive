// ═══════════════════════════════════════════════════════════════════════════
//  badge-sync.mjs — das Abzeichen "Profil komplett" als Discord-Rolle
//  (30.10.2026). Wer Discord mit einem vollständigen VerseBase-Profil
//  verbunden hat, trägt die Rolle; wird das Profil wieder lückenhaft oder
//  Discord getrennt, fällt sie beim nächsten Abgleich weg.
//
//  "Vollständig" entscheidet die Datenbank (public.profile_is_complete, Sicht
//  discord_profile_badges), nicht der Bot -- so zeigen Site und Discord nie
//  verschiedene Stände. Läuft im Fünf-Minuten-Takt des Rangspiegels
//  (rank-sync.mjs), nur auf der Heim-Gilde, gelesen über site-db.mjs
//  (listBadges). Wirft nie.
// ═══════════════════════════════════════════════════════════════════════════
import { resolveColor } from 'discord.js';
import * as bp from '../../blueprint.mjs';
import { isHomeGuild } from './home-guild.mjs';

const BADGE = bp.roles.find((r) => r.key === 'profile-complete');

/**
 * Wer die Rolle bekommt und wer sie verliert. Rein (selftest.mjs).
 * `rows` aus discord_profile_badges, `holders` = IDs der heutigen Träger,
 * `members` = IDs aller Servermitglieder.
 */
export function badgeDiff(rows, holders, members) {
  const want = new Set(rows.filter((r) => r.profile_complete === true).map((r) => r.discord_user_id));
  return {
    add: [...want].filter((id) => members.has(id) && !holders.has(id)),
    remove: [...holders].filter((id) => !want.has(id)),
  };
}

async function ensureRole(guild) {
  const found = guild.roles.cache.find((r) => r.name === BADGE.name && !r.managed);
  if (found) return found;
  return guild.roles.create({
    name: BADGE.name,
    colors: { primaryColor: resolveColor(BADGE.color) },
    hoist: false,
    mentionable: false,
    permissions: [],
    reason: 'VerseBase Abzeichen Profil komplett',
  });
}

export async function syncProfileBadges(ctx, guild) {
  const { siteDb } = ctx;
  if (!siteDb || !BADGE || !isHomeGuild(ctx, guild)) return;
  try {
    const rows = await siteDb.listBadges();
    const role = await ensureRole(guild);
    const members = await guild.members.fetch();
    const holders = new Set(role.members.map((m) => m.id));
    const { add, remove } = badgeDiff(rows, holders, new Set(members.keys()));
    for (const id of add) await members.get(id).roles.add(role, 'Profil komplett');
    for (const id of remove) await members.get(id)?.roles.remove(role, 'Profil nicht mehr komplett');
    console.log(`  · Abzeichen ${guild.name}: ${rows.length} verbundene Konten, ${holders.size} Träger, +${add.length} −${remove.length}.`);
  } catch (e) {
    console.warn(`  ! Abzeichen ${guild.name}: ${e.message}`);
  }
}
