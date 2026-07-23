// One-shot: order ALL custom roles into the intended hierarchy, just below the
// bot's own (managed) role. Matches roles by a text key (emoji-agnostic).
// Safe/reversible; a failed attempt changes nothing. Prints the exact error.
import { Client, GatewayIntentBits } from 'discord.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as bp from './blueprint.mjs';
import { RANKS } from './bot/src/ranks.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
for (const line of readFileSync(join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}

// Emoji-agnostic label for a role name ("⭐ Fleet Command" → "Fleet Command").
const label = (name) => String(name).replace(/^[^\p{L}\p{N}]+/u, '').trim();

// Desired order, TOP → bottom, derived from the single sources of truth so it can
// never drift from the actual roles: hoisted staff roles (blueprint) → ranks
// high→low (the bot's ladder) → everything else in blueprint order (playstyles,
// pings, language, pronouns). Prestige (✦ Ascended) roles are hoisted and
// self-manage, so they're intentionally left where they are.
const staff = bp.roles.filter((r) => r.hoist).map((r) => label(r.name));
const rest = bp.roles.filter((r) => !r.hoist).map((r) => label(r.name));
const ranks = [...RANKS].reverse().map((r) => r.name);
const ORDER = [...staff, ...ranks, ...rest];

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
await client.login(process.env.DISCORD_TOKEN);
await new Promise((resolve) => { client.once('clientReady', resolve); client.once('ready', resolve); });
const guild = await client.guilds.fetch(process.env.GUILD_ID);
await guild.roles.fetch();
const me = await guild.members.fetchMe();
const botTop = me.roles.highest.position;

// Match each key to a role by name inclusion, no double-use.
const used = new Set();
const matched = [];
for (const key of ORDER) {
  const role = [...guild.roles.cache.values()].find((r) => !used.has(r.id) && !r.managed && r.name.includes(key));
  if (role) { used.add(role.id); matched.push({ key, role }); }
  else console.log('  ! no role matched key:', key);
}

// Bulk setPositions is broken (50013) on this API; move roles ONE AT A TIME.
// Top → bottom with strictly-decreasing absolute targets: already-placed roles
// (all above the current target) are never disturbed, so a single pass converges.
console.log(`Bot top = ${botTop}. Placing ${matched.length} roles at ${botTop - 1}..${botTop - matched.length}, one by one.`);
let ok = 0;
for (let i = 0; i < matched.length; i++) {
  try { await matched[i].role.setPosition(botTop - 1 - i); ok++; }
  catch (e) { console.log(`  ! ${matched[i].role.name}: ${e.code} ${e.message}`); }
}
console.log(`Moved ${ok}/${matched.length} roles.`);

// Verify: re-fetch and print the resulting order high → low.
await guild.roles.fetch();
console.log('--- resulting order (high → low) ---');
for (const r of [...guild.roles.cache.values()].sort((a, b) => b.position - a.position)) {
  console.log(String(r.position).padStart(3), r.managed ? '[M]' : '   ', `"${r.name}"`);
}

await client.destroy();
process.exit(0);
