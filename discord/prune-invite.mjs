// ═════════════════════════════════════════════════════════════════════════
//  prune-invite.mjs — Einladungen listen und einzeln zurückziehen.
//
//  WARUM: Der Name auf der Beitrittsseite („X hat dich eingeladen") ist der
//  ERSTELLER der Einladung — nicht der Server, nicht der Bot. Die Einladung
//  eaXhkf8d3Y stammt von der alten Test-Application `test5`; die App ist
//  gelöscht, ihr Name klebt aber weiter an der Einladung und stand damit vor
//  jedem, der von verse-base.com kam. Der Name lässt sich nicht ändern — nur
//  eine neue Einladung anlegen und die alte zurückziehen.
//
//  TROCKENLAUF IST DIE VORGABE. `node prune-invite.mjs` verbindet nur lesend,
//  listet alle Einladungen mit Ersteller und Alter, und ändert nichts.
//
//    node prune-invite.mjs                        # alle listen (ändert nichts)
//    node prune-invite.mjs --code ABC123          # zeigt, was --delete träfe
//    node prune-invite.mjs --code ABC123 --delete # zieht sie zurück
//
//  ⚠ SPERRE: Die Einladung, die auf der WEBSITE steht (DISCORD.invite in
//  src/consts.ts), wird NIE gelöscht — auch nicht mit --delete. Sonst wäre der
//  Link im Fuß jeder Seite tot. Die richtige Reihenfolge ist:
//    1. neue Einladung anlegen (im Discord-Client, damit DEIN Name dransteht)
//    2. src/consts.ts auf den neuen Code umstellen + ausliefern
//    3. erst dann die alte hier zurückziehen
//  Die Sperre erzwingt genau diese Reihenfolge.
//
//  Zurückziehen ist endgültig: wer den alten Link anklickt, sieht danach
//  „Ungültige Einladung". Mitglieder, die bereits beigetreten sind, bleiben
//  unberührt — eine Einladung ist nur eine Tür, kein Band zum Server.
// ═════════════════════════════════════════════════════════════════════════
import { Client, GatewayIntentBits } from 'discord.js';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { siteInviteCode } from './site-invite.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
}
if (!process.env.DISCORD_TOKEN || !process.env.GUILD_ID) {
  console.error('✗ Braucht DISCORD_TOKEN und GUILD_ID — in discord/.env oder der Umgebung setzen.');
  process.exit(1);
}

const argv = process.argv.slice(2);
const val = (n) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : null);
const CODE = val('--code');
const DELETE = argv.includes('--delete');
const SITE = siteInviteCode();

// ⚠ Einladungen haben KEINE Snowflake-ID — anders als Kanaele, Rollen und
// Nachrichten, wo audit.mjs das Datum aus der ID rechnet. Ihr Bezeichner ist
// der Code selbst, und das Anlegedatum kommt als eigenes Feld. Der erste
// Trockenlauf ist genau daran gestorben (BigInt(undefined)).
const stamp = (inv) => (inv.createdAt ? inv.createdAt.toISOString().slice(0, 10) : '—');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
await client.login(process.env.DISCORD_TOKEN);
const guild = await client.guilds.fetch(process.env.GUILD_ID);
const invites = await guild.invites.fetch();

console.log(`\nServer: ${guild.name}`);
console.log(`Website verlinkt: ${SITE ? `discord.gg/${SITE}` : '— (src/consts.ts nicht lesbar)'}\n`);

if (!invites.size) {
  console.log('Keine Einladungen vorhanden.');
  await client.destroy();
  process.exit(0);
}

console.log('Vorhandene Einladungen:');
for (const i of invites.values()) {
  const marks = [
    i.code === SITE ? 'AUF DER WEBSITE' : null,
    i.maxAge === 0 && i.maxUses === 0 ? 'permanent' : `läuft ab (${i.maxAge}s)`,
  ].filter(Boolean);
  console.log(`  ${i.code}`);
  console.log(`    Ersteller  ${i.inviter?.username ?? '—'}${i.inviter?.bot ? ' (Bot/App)' : ''}`);
  console.log(`    Ziel       #${i.channel?.name ?? '?'}`);
  console.log(`    Angelegt   ${stamp(i)} · ${i.uses} Nutzung(en)`);
  console.log(`    ${marks.join(' · ')}`);
}

if (!CODE) {
  console.log('\nNichts geändert (kein --code angegeben).');
  console.log('Zum Zurückziehen:  node prune-invite.mjs --code <code> --delete');
  await client.destroy();
  process.exit(0);
}

const target = invites.get(CODE) ?? [...invites.values()].find((i) => i.code === CODE);
if (!target) {
  console.error(`\n✗ Keine Einladung mit dem Code "${CODE}" auf diesem Server.`);
  await client.destroy();
  process.exit(1);
}

// ── Die Sperre ────────────────────────────────────────────────────────────
if (SITE && target.code === SITE) {
  console.error(`\n✗ ABGELEHNT: ${CODE} ist die Einladung, die auf der Website steht.`);
  console.error('  Sie zu löschen würde den Link im Fuß JEDER Seite töten.');
  console.error('  Erst DISCORD.invite in src/consts.ts auf die neue Einladung umstellen');
  console.error('  und ausliefern — danach lässt sich diese hier zurückziehen.');
  await client.destroy();
  process.exit(1);
}

if (!DELETE) {
  console.log(`\nTROCKENLAUF — mit --delete würde zurückgezogen:`);
  console.log(`  ${target.code} (von ${target.inviter?.username ?? '—'}, ${target.uses} Nutzung(en), → #${target.channel?.name})`);
  console.log('\nNichts geändert. Zum Ausführen dieselbe Zeile mit --delete.');
  await client.destroy();
  process.exit(0);
}

await target.delete('VerseBase: alte Einladung mit fremdem Ersteller-Namen zurückgezogen');
console.log(`\n✓ Zurückgezogen: ${target.code} (war von ${target.inviter?.username ?? '—'})`);
console.log('  Wer diesen Link noch irgendwo hat, sieht ab jetzt „Ungültige Einladung".');
console.log('  Bereits beigetretene Mitglieder sind unberührt.');
await client.destroy();
