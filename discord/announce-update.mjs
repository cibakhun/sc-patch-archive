// ═══════════════════════════════════════════════════════════════════════════
//  announce-update.mjs — post a site update to #announcements.
//
//  Same shape as announce-milestone.mjs, and for the same reason: a broadcast
//  reaches one channel, so it can't be rendered per-user like the bot's slash
//  replies. ONE message carrying TWO single-language embeds — English first,
//  German second — plus a single ping to the opt-in @📢 Announcement Pings
//  role. Nobody has to read a language they didn't pick.
//
//  Idempotent: refuses to post twice for the same update (it scans recent
//  history for its own embed title). Re-runnable, so a failed attempt costs
//  nothing.
//
//  ⚠ Keine Herkunftsangaben zu den Spieldaten im Text — dieselbe Regel wie
//    site-weit (audit:site erzwingt sie dort als FEHLER).
//
//  Usage, from the /discord folder:
//     node announce-update.mjs --dry-run     # resolve + preview, send nothing
//     node announce-update.mjs               # post it
//     node announce-update.mjs --edit        # rewrite the live post in place
//     node announce-update.mjs --force       # post a second copy anyway
// ═══════════════════════════════════════════════════════════════════════════
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
}
if (!process.env.DISCORD_TOKEN) {
  console.error('✗ No DISCORD_TOKEN — set it in discord/.env or the environment.');
  process.exit(1);
}

const DRY = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const EDIT = process.argv.includes('--edit');

const ACCENT = 0x2dd4ff; // --accent, the site's signature cyan
// 17.08.2026: #suggestions und #support sind zu #feedback verschmolzen
// (blueprint.mjs, cat-build). Stuende hier noch der alte Name, faende die
// Aufloesung unten keinen Kanal und schriebe stumm den Klartext „#suggestions"
// in die Ankuendigung — ein toter Verweis, der wie ein Link aussieht.
const REFS = ['feedback'];

/* ⚠ BODY wird je Ankuendigung UEBERSCHRIEBEN, nicht ergaenzt — die
   Doppelpost-Sperre unten vergleicht BODY.en.title gegen die letzten 50
   Nachrichten, ein neuer Titel ergibt also einen neuen Beitrag. Der Wortlaut
   der vorherigen Ankuendigung (Crafting/Schiffe/Item-Finder, 08/2026) steht
   in der Git-Historie dieser Datei.
   ⚠ Keine Herkunftsangaben zu den Spieldaten — dieselbe Regel wie site-weit. */
const BODY = {
  en: {
    author: 'VerseBase · Site update',
    title: '📱 Better on small screens',
    description:
      'A pass over every screen size, phone to desktop, portrait and landscape — ' +
      'cut-off filters, oversized headers, broken German line breaks and raw ' +
      'technical labels are fixed.',
    nextTitle: 'Found something?',
    next:
      "Not everything is caught yet. If something looks wrong or doesn't work — " +
      'on any device — tell me in {feedback}. A screenshot with your screen size ' +
      'helps most.',
    footer: 'o7 · Krisz',
  },
  de: {
    author: 'VerseBase · Seiten-Update',
    title: '📱 Besser auf kleinen Bildschirmen',
    description:
      'Ein Durchgang über alle Bildschirmgrößen, Handy bis Desktop, hoch und quer — ' +
      'abgeschnittene Filter, zu große Kopfleisten, kaputte deutsche Umbrüche und ' +
      'rohe technische Bezeichnungen sind repariert.',
    nextTitle: 'Was gefunden?',
    next:
      'Erwischt ist damit noch nicht alles. Wenn etwas falsch aussieht oder nicht ' +
      'funktioniert — auf welchem Gerät auch immer — sag Bescheid in {feedback}. ' +
      'Ein Screenshot mit deiner Bildschirmgröße hilft am meisten.',
    footer: 'o7 · Krisz',
  },
};

const PING_LINE = 'Site update · Seiten-Update 📱';

function buildEmbed(locale, mentions) {
  const b = BODY[locale];
  const next = b.next.replace(/\{(\w+)\}/g, (m, k) => mentions[k] || `#${k}`);
  /* ⚠ Der Punkte-Block ist OPTIONAL (seit 01.09.2026). Eine Ankuendigung, die
     nur zwei Saetze lang ist, braucht keine Aufzaehlung — und addFields wirft,
     wenn name/value leer sind. Fehlt fieldsTitle, steht nur der Abschluss. */
  const felder = [];
  if (b.fieldsTitle && b.fields) felder.push({ name: b.fieldsTitle, value: b.fields });
  felder.push({ name: b.nextTitle, value: next });
  return new EmbedBuilder()
    .setColor(ACCENT)
    .setAuthor({ name: b.author })
    .setTitle(b.title)
    .setDescription(b.description)
    .addFields(...felder)
    .setFooter({ text: b.footer });
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
await client.login(process.env.DISCORD_TOKEN);
await new Promise((resolve) => { client.once('clientReady', resolve); client.once('ready', resolve); });

const guild = process.env.GUILD_ID
  ? await client.guilds.fetch(process.env.GUILD_ID)
  : client.guilds.cache.first();
if (!guild) { console.error('✗ Bot is in no guild.'); process.exit(1); }
await guild.channels.fetch();
await guild.roles.fetch();
console.log(`Guild: ${guild.name}`);

const channel = guild.channels.cache.find(
  (c) => c.isTextBased?.() && !c.isVoiceBased?.() && /announcements/i.test(c.name) && !/community/i.test(c.name),
);
if (!channel) { console.error('✗ No #announcements channel found.'); process.exit(1); }

const role = guild.roles.cache.find((r) => /announcement\s*pings/i.test(r.name));
if (!role) console.warn('! No "📢 Announcement Pings" role — posting without a ping.');

const mentions = {};
for (const key of REFS) {
  const ch = guild.channels.cache.find((c) => c.isTextBased?.() && new RegExp(key, 'i').test(c.name));
  mentions[key] = ch ? `<#${ch.id}>` : `#${key}`;
  if (!ch) console.warn(`! No #${key} channel — falling back to plain text.`);
}

console.log(`Channel: #${channel.name}`);
console.log(`Ping:    ${role ? `@${role.name}` : '(none)'}`);
console.log(`Refs:    ${REFS.map((k) => `${k} → ${mentions[k]}`).join(', ')}`);

const recent = await channel.messages.fetch({ limit: 50 }).catch(() => null);
const already = recent && [...recent.values()].find(
  (m) => m.author?.id === client.user.id && m.embeds?.some((e) => e.title === BODY.en.title),
);
const payload = {
  content: role ? `<@&${role.id}> — ${PING_LINE}` : PING_LINE,
  embeds: [buildEmbed('en', mentions), buildEmbed('de', mentions)],
  allowedMentions: { roles: role ? [role.id] : [] },
};

if (already && !FORCE && !EDIT) {
  console.log(`\n✓ Already posted (${already.url}). Nothing to do.`);
  console.log('  --edit rewrites it in place · --force posts a second copy.');
  await client.destroy();
  process.exit(0);
}
if (EDIT && !already) {
  console.error('\n✗ --edit given, but no existing post found in the last 50 messages.');
  await client.destroy();
  process.exit(1);
}

if (DRY) {
  console.log('\n── DRY RUN — nothing sent ──────────────────────────────────');
  console.log(payload.content);
  for (const e of payload.embeds) {
    const d = e.toJSON();
    console.log(`\n[${d.author.name}]\n${d.title}\n\n${d.description}`);
    for (const f of d.fields) console.log(`\n${f.name}\n${f.value}`);
    console.log(`\n— ${d.footer.text}`);
  }
  console.log(`\n(${EDIT ? `would EDIT ${already?.url}` : 'would POST a new message'})`);
  await client.destroy();
  process.exit(0);
}

if (EDIT) {
  await already.edit({ content: payload.content, embeds: payload.embeds, attachments: [] });
  console.log(`\n✓ Edited in place: ${already.url}`);
  await client.destroy();
  process.exit(0);
}

const sent = await channel.send(payload);
console.log(`\n✓ Posted to #${channel.name}: ${sent.url}`);

if (sent.crosspostable) {
  await sent.crosspost().then(() => console.log('✓ Published to following servers.'))
    .catch((e) => console.warn(`! Publish failed: ${e.message}`));
}

await client.destroy();
