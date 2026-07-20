// register-commands.mjs — push the slash commands to Discord.
//   GUILD_ID set  → registers to that guild (appears instantly)
//   GUILD_ID unset → registers globally (~1h to propagate)
import { REST, Routes } from 'discord.js';
import { buildCommandData } from './commands.mjs';
import { loadEnv, deriveClientId } from './env.mjs';

loadEnv();

const token = process.env.DISCORD_TOKEN;
if (!token) { console.error('✗ DISCORD_TOKEN missing.'); process.exit(1); }

const clientId = process.env.CLIENT_ID || deriveClientId(token);
if (!clientId) { console.error('✗ CLIENT_ID missing and could not be derived from token.'); process.exit(1); }

const guildId = process.env.GUILD_ID;
const body = buildCommandData();
const rest = new REST().setToken(token);

try {
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
    console.log(`✓ Registered ${body.length} commands to guild ${guildId} — available instantly.`);
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body });
    console.log(`✓ Registered ${body.length} global commands — allow up to ~1h to appear.`);
  }
} catch (e) {
  console.error('✗ Registration failed:', e.message || e);
  process.exit(1);
}
