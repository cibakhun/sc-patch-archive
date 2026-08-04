// ═══════════════════════════════════════════════════════════════════════════
//  avatar.mjs — give the bot its face on first boot.
//
//  Only fires when the bot has NO custom avatar (a fresh application, e.g. after
//  the migration in ../../README.md), so a restart loop can never burn through
//  Discord's avatar rate limit. Changing the picture later is a deliberate
//  `npm run avatar:apply` in ../../ — this is just the floor.
//
//  Image: AVATAR_PATH env, ../assets/verse-bot-avatar.png in the Docker image,
//  or the builder's ../../assets/verse-bot-avatar.png in a repo checkout.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const CANDIDATES = [
  process.env.AVATAR_PATH,
  join(here, '..', 'assets', 'verse-bot-avatar.png'),        // bundled into the image
  join(here, '..', '..', 'assets', 'verse-bot-avatar.png'),  // repo checkout (discord/assets)
].filter(Boolean);

/** Sets the bot's avatar if it has none yet. Safe to call on every startup. */
export async function ensureAvatar(client) {
  if (client.user.avatar) return;

  const file = CANDIDATES.find((p) => existsSync(p));
  if (!file) {
    console.warn('[avatar] no custom avatar and no verse-bot-avatar.png bundled — run `npm run avatar` in discord/');
    return;
  }
  try {
    await client.user.setAvatar(readFileSync(file));
    console.log('  · avatar set (bot had none)');
  } catch (e) {
    console.warn(`  ! avatar: ${e.message}`);
  }
}
