// ═════════════════════════════════════════════════════════════════════════
//  tester-revoke.mjs — Entzug der Rolle "Test Pilots" bei allen (oder allen
//  ausser den ausdruecklich verschonten) heutigen Traegern (D-16, Phase 14).
//
//  Teilt sich die Rollen-/Mitgliederaufloesung mit tester-dry-run.mjs
//  (resolveRoleAndHolders) statt sie ein zweites Mal zu tippen -- zwei Kopien
//  liefen sonst irgendwann auseinander, und das eine Skript entzoege, was das
//  andere nie angezeigt hat.
//
//  ZWEI STUFEN, nach der Hausregel fuer zerstoerische Handlungen
//  (Betreiberentscheidung 15.08.2026, Phase 10: "Zerstoerische Handlungen
//  brauchen zwei Klicks, der zweite traegt Worte"):
//
//    node tester-revoke.mjs                              # Vorschau: druckt die Liste, aendert NICHTS
//    node tester-revoke.mjs --dry-run                     # dasselbe, ausdruecklich benannt
//    node tester-revoke.mjs --rolle-wirklich-entziehen     # entzieht wirklich, bei allen Traegern
//    node tester-revoke.mjs --rolle-wirklich-entziehen --behalten <id-oder-name>   # wiederholbar, verschont
//
//  Kein `-y`, kein `--force` -- das Bestaetigungsargument ist ein
//  ausgeschriebenes Wort, absichtlich unbequem zu tippen.
//
//  Jeder Entzug traegt einen Audit-Grund, der in Discords Pruefprotokoll
//  landet und die Frage beantwortet, die Betroffene stellen werden. Ablauf
//  sequentiell (nicht parallel) -- Ratenbegrenzungen werden von discord.js
//  selbst abgewartet, nicht unterlaufen.
// ═════════════════════════════════════════════════════════════════════════
import { Client, GatewayIntentBits } from 'discord.js';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveRoleAndHolders } from './tester-dry-run.mjs';
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
// Ohne --rolle-wirklich-entziehen (und ebenso mit --dry-run) ist JEDER Aufruf
// die Vorschau. Das Bestaetigungsargument ist das einzige, was CONFIRM auf
// true setzt -- ein Tippfehler im Aufruf kann also nie handeln.
const CONFIRM = argv.includes('--rolle-wirklich-entziehen');
const KEEP = argv.reduce((acc, a, i) => (a === '--behalten' && argv[i + 1] ? [...acc, argv[i + 1]] : acc), []);

const sortMembers = (list) =>
  [...list].sort((a, b) => (a.displayName || a.user.username).localeCompare(b.displayName || b.user.username));

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN);
  await new Promise((r) => { client.once('clientReady', r); client.once('ready', r); });

  const { guild, role, members, holders, error } = await resolveRoleAndHolders(client, {});

  say(`${c.bold}VerseBase · Testpilot-Entzug${c.off}  —  ${guild.name}  ·  mode: ${CONFIRM ? `${c.red}ENTZUG${c.off}` : `${c.green}VORSCHAU (nichts wird veraendert)${c.off}`}`);

  const defaultRoleName = bp.roles.find((r) => r.key === 'tester')?.name;
  if (!role) {
    say(`  ${c.red}✗ Keine Rolle namens "${defaultRoleName}" auf diesem Server -- nichts zu tun.${c.off}`);
    await client.destroy();
    process.exit(1);
  }
  if (error || !members) {
    say(`  ${c.red}✗ Mitgliederliste nicht feststellbar -- ${error}. Kein Entzug ohne verlaessliche Liste.${c.off}`);
    await client.destroy();
    process.exit(1);
  }

  const keepSet = new Set(KEEP.map((k) => k.toLowerCase()));
  const isKept = (m) => keepSet.has(m.id) || keepSet.has(m.user.username.toLowerCase()) || keepSet.has((m.displayName || '').toLowerCase());

  const sorted = sortMembers(holders);

  head(`Traeger der Rolle "${role.name}" (${sorted.length})`);
  if (!sorted.length) say(`  ${c.dim}(niemand -- nichts zu entziehen)${c.off}`);
  for (const m of sorted) {
    const kept = isKept(m);
    say(`  ${kept ? c.green : c.yellow}${m.displayName}${c.off} ${c.dim}(@${m.user.username}, ${m.id})${c.off}${kept ? ` ${c.green}← verschont${c.off}` : ''}`);
  }

  if (KEEP.length) {
    head('Ausdruecklich verschont');
    for (const k of KEEP) say(`  ${c.green}${k}${c.off}`);
  }

  if (!CONFIRM) {
    head('Nichts wurde veraendert');
    const wouldRemove = sorted.filter((m) => !isKept(m)).length;
    say(`  ${wouldRemove} Traeger wuerden entzogen (von ${sorted.length} insgesamt, ${sorted.length - wouldRemove} verschont).`);
    say(`  ${c.dim}Zum wirklichen Entziehen:${c.off}  node tester-revoke.mjs --rolle-wirklich-entziehen${KEEP.map((k) => ` --behalten "${k}"`).join('')}`);
    await client.destroy();
    process.exit(0);
  }

  head('Entzug');
  let removed = 0, kept = 0, failed = 0;
  for (const m of sorted) {
    if (isKept(m)) { kept++; say(`  ${c.green}–${c.off} ${m.displayName} ${c.dim}verschont${c.off}`); continue; }
    try {
      await m.roles.remove(role.id, 'Phase 14: Rolle wird ab jetzt vergeben, nicht selbst genommen (D-16)');
      removed++;
      say(`  ${c.green}✓${c.off} ${m.displayName} -- entzogen`);
    } catch (e) {
      failed++;
      say(`  ${c.red}✗${c.off} ${m.displayName} -- fehlgeschlagen: ${e.message}`);
    }
  }

  head('Bilanz');
  say(`  ${removed} von ${sorted.length} entzogen, ${kept} verschont, ${failed} fehlgeschlagen.`);
  await client.destroy();
  process.exit(failed ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(`✗ ${e.message}`); process.exit(1); });
}
