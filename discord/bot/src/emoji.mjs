// ═══════════════════════════════════════════════════════════════════════════
//  emoji.mjs — upload the game-sourced manufacturer logos as server emoji and
//  look them up for embeds. Idempotent: only creates what's missing.
//
//  Logo images: LOGO_DIR env, or the repo's assets/manufacturers in dev.
//  The mapping (name → file) comes from manufacturer-logos.json via data.mjs.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { manufacturers } from './data.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const LOGO_DIR = process.env.LOGO_DIR || join(here, '..', '..', '..', 'assets', 'manufacturers');

/** Emoji-safe slug (2–32 chars, [a-z0-9_]). */
export function slug(name) {
  const s = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32);
  return s.length >= 2 ? s : `mfr_${s}`;
}

/** Create any missing manufacturer emoji. Safe to call on every startup. */
export async function ensureEmoji(guild) {
  const logos = manufacturers();
  const entries = Object.entries(logos);
  if (!entries.length) return;

  let me;
  try { me = await guild.members.fetchMe(); } catch { return; }
  const canManage = me.permissions.has('Administrator') || me.permissions.has('ManageGuildExpressions') || me.permissions.has('ManageEmojisAndStickers');
  if (!canManage) { console.warn(`[emoji] missing emoji permission in ${guild.name}`); return; }

  await guild.emojis.fetch().catch(() => {});
  let created = 0;
  for (const [name, meta] of entries) {
    const en = slug(name);
    if (guild.emojis.cache.some((e) => e.name === en)) continue;
    const file = join(LOGO_DIR, meta.file);
    if (!existsSync(file)) continue;
    try { await guild.emojis.create({ attachment: readFileSync(file), name: en }); created++; }
    catch (e) { console.warn(`[emoji] ${en}: ${e.message}`); }
  }
  if (created) console.log(`  · ${created} manufacturer emoji uploaded in ${guild.name}`);
}

/** The GuildEmoji for a manufacturer name, or null. */
export function emojiFor(guild, manufacturer) {
  if (!guild || !manufacturer) return null;
  const en = slug(manufacturer);
  return guild.emojis.cache.find((e) => e.name === en) || null;
}
