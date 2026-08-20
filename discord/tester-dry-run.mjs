// ═════════════════════════════════════════════════════════════════════════
//  tester-dry-run.mjs — wer traegt heute die Rolle "Test Pilots", und wie
//  viele sind es (D-16, Phase 14).
//
//  Ein BERICHT, kein Pruefer: kein process.exit(1) bei einem Befund (weder
//  bei vielen Traegern noch bei einer unbekannten Rolle), kein Eintrag in
//  scripts/lib/gate-registry.mjs -- diese Registry bewacht scripts/, nicht
//  discord/, aus demselben Grund wie discord/prune.mjs und discord/audit.mjs.
//
//  Liest die vollstaendige Mitgliederliste ueber die REST-Route
//  GET /guilds/{id}/members (discord.js: guild.members.list()). Das ist ein
//  EINMALIGER REST-Abruf, kein Gateway-Abo -- funktioniert deshalb OHNE das
//  privilegierte GuildMembers-Intent (siehe 14-RESEARCH.md, Open Question 5).
//  Damit haengt dieser Trockenlauf nicht an Plan 14-07 (Intent-Aktivierung).
//
//  Trotzdem ein Wettlauf gegen einen Zeitgeber, nach dem Muster von
//  prune.mjs:149-165: ein Bericht, der bei Nichterreichbarkeit "0 Traeger"
//  meldet, waere die gefaehrlichste aller Antworten -- er saehe wie ein
//  erledigtes Aufraeumen aus. Im Fehlerfall meldet dieses Skript stattdessen
//  ausdruecklich "nicht feststellbar".
//
//  `resolveRoleAndHolders()` wird von tester-revoke.mjs wiederverwendet, statt
//  ein zweites Mal getippt zu werden -- zwei Kopien liefen sonst irgendwann
//  auseinander, und das eine Skript entzoege, was das andere nie angezeigt
//  hat.
//
//  Aufruf, aus dem discord/-Ordner:
//     node tester-dry-run.mjs               # Bericht ueber die Rolle "Test Pilots"
//     node tester-dry-run.mjs --rolle <Name> # Bericht ueber eine andere Rolle (Test/Diagnose)
// ═════════════════════════════════════════════════════════════════════════
import { Client, GatewayIntentBits } from 'discord.js';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as bp from './blueprint.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
}
if (!process.env.DISCORD_TOKEN) {
  console.error('✗ Kein DISCORD_TOKEN -- in discord/.env oder der Umgebung setzen.');
  process.exit(1);
}

const c = { dim: '\x1b[2m', red: '\x1b[31m', yellow: '\x1b[33m', green: '\x1b[32m', cyan: '\x1b[36m', bold: '\x1b[1m', off: '\x1b[0m' };
const say = (...a) => console.log(...a);
const head = (t) => say(`\n${c.bold}${c.cyan}── ${t} ${'─'.repeat(Math.max(0, 60 - t.length))}${c.off}`);

const argv = process.argv.slice(2);
const roleFlagIdx = argv.indexOf('--rolle');
const overrideRoleName = roleFlagIdx !== -1 ? argv[roleFlagIdx + 1] : null;
const defaultRoleName = bp.roles.find((r) => r.key === 'tester')?.name;

/**
 * Loest Gilde und Rolle auf und holt die vollstaendige Mitgliederliste per
 * REST (GET /guilds/{id}/members, seitenweise ueber `after`). Funktioniert
 * OHNE das privilegierte GuildMembers-Intent, weil es ein einmaliger
 * REST-Abruf ist, kein Gateway-Cache-Abo.
 *
 * Gibt { guild, role, members, holders, error } zurueck. `role` ist
 * `undefined`, wenn keine live Rolle mit dem gesuchten Namen existiert.
 * `members`/`holders` sind `null` und `error` ist gesetzt, wenn der Abruf
 * gegen den 10-Sekunden-Zeitgeber verlor -- niemals wird in diesem Fall eine
 * erfundene Zahl zurueckgegeben.
 */
export async function resolveRoleAndHolders(client, { roleName } = {}) {
  const oauth = await client.guilds.fetch();
  let guild;
  if (process.env.GUILD_ID) guild = await client.guilds.fetch(process.env.GUILD_ID);
  else if (oauth.size === 1) guild = await client.guilds.fetch(oauth.first().id);
  else throw new Error(`GUILD_ID setzen -- Bot ist in ${oauth.size} Gilden`);

  await guild.roles.fetch();
  const wantName = roleName ?? defaultRoleName;
  if (!wantName) throw new Error('Rolle "tester" nicht im Blueprint gefunden');
  const role = [...guild.roles.cache.values()].find((r) => r.name === wantName && !r.managed);

  let members = null;
  let error = null;
  try {
    members = await Promise.race([
      (async () => {
        const all = [];
        let after;
        for (;;) {
          const page = await guild.members.list({ limit: 1000, after });
          if (!page.size) break;
          all.push(...page.values());
          if (page.size < 1000) break;
          after = page.lastKey();
        }
        return all;
      })(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Zeitueberschreitung nach 10s beim Mitgliederabruf')), 10_000)),
    ]);
  } catch (e) {
    error = e.message;
  }

  const holders = role && members ? members.filter((m) => m.roles.cache.has(role.id)) : [];
  return { guild, role, members, holders, error };
}

const sortMembers = (list) =>
  [...list].sort((a, b) => (a.displayName || a.user.username).localeCompare(b.displayName || b.user.username));

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN);
  await new Promise((r) => { client.once('clientReady', r); client.once('ready', r); });

  const { guild, role, members, holders, error } = await resolveRoleAndHolders(client, { roleName: overrideRoleName });

  say(`${c.bold}VerseBase · Testpilot-Trockenlauf${c.off}  —  ${guild.name}  (D-16)`);

  head('1 · Server und Rolle');
  say(`  Server: ${guild.name} (${guild.id})`);
  if (!role) {
    say(`  ${c.red}✗ Keine Rolle namens "${overrideRoleName ?? defaultRoleName}" auf diesem Server gefunden.${c.off}`);
    say(`  ${c.dim}Keine Zahl -- eine unbekannte Rolle liefert keinen Befund.${c.off}`);
    head('Nichts wurde veraendert');
    say(`  ${c.dim}Dies ist ein Bericht -- es wurde nichts angefasst.${c.off}`);
    await client.destroy();
    process.exit(0);
  }
  say(`  Rolle: "${role.name}" (${role.id})`);

  if (error) {
    head('2 · Mitgliederabruf');
    say(`  ${c.red}✗ Nicht feststellbar -- ${error}${c.off}`);
    say(`  ${c.dim}Kein "0 Traeger" vorgetaeuscht. Erneut versuchen.${c.off}`);
    head('Nichts wurde veraendert');
    say(`  ${c.dim}Dies ist ein Bericht -- es wurde nichts angefasst.${c.off}`);
    await client.destroy();
    process.exit(0);
  }

  head('2 · Abgerufene Mitglieder gesamt');
  say(`  ${members.length}`);

  head(`3 · Traeger der Rolle "${role.name}"`);
  say(`  ${c.bold}${c.yellow}${holders.length} Traeger${c.off}`);
  const sorted = sortMembers(holders);
  if (!sorted.length) say(`  ${c.dim}(niemand)${c.off}`);
  for (const m of sorted) {
    say(`  ${c.yellow}${m.displayName}${c.off} ${c.dim}(@${m.user.username}, ${m.id})${c.off}`);
  }

  head('Nichts wurde veraendert');
  say(`  ${c.dim}Dies ist ein Bericht -- kein Mitglied wurde angefasst.${c.off}`);

  await client.destroy();
  process.exit(0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(`✗ ${e.message}`); process.exit(1); });
}
