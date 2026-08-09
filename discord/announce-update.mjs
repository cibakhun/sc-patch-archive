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
const REFS = ['suggestions', 'support'];

const BODY = {
  en: {
    author: 'VerseBase · Site update',
    title: '🛠 Big update — now live',
    description:
      'The largest batch of changes so far just went live on **verse-base.com**. ' +
      'Most of it is about finding the right thing faster.',
    fieldsTitle: "What's new",
    fields:
      '🔧 **Crafting** — every one of the 1,594 blueprints now shows size and grade, ' +
      'and you can filter by them\n' +
      '🚀 **Ships** — filter by role and by component slot size, so "what actually ' +
      'fits this hardpoint" is one click\n' +
      '🔎 **Item Finder** — items that share a name now show their variants. ' +
      'Several names cover more than one size in game; you get the right one now\n' +
      '✨ **Everywhere** — typography, motion and readability got a pass across the site\n' +
      '↩️ **Plus** — smaller quality-of-life fixes: filter and result panels scroll on ' +
      'their own, a Back button that returns you where you actually came from (search ' +
      'and scroll position intact), and a short "what is this for" on every tool',
    nextTitle: 'Something look wrong?',
    next: 'Tell me — {suggestions} and {support} are wide open. Wrong numbers are the ' +
      'kind of bug I most want to hear about.',
    footer: 'o7 · Krisz',
  },
  de: {
    author: 'VerseBase · Seiten-Update',
    title: '🛠 Großes Update — jetzt live',
    description:
      'Das bisher größte Update ist auf **verse-base.com** live. ' +
      'Das meiste davon dreht sich darum, das Richtige schneller zu finden.',
    fieldsTitle: 'Was neu ist',
    fields:
      '🔧 **Crafting** — alle 1.594 Baupläne zeigen jetzt Größe und Grade, ' +
      'und du kannst danach filtern\n' +
      '🚀 **Schiffe** — Filter nach Rolle und nach Steckplatz-Größe: „was passt wirklich ' +
      'in diesen Hardpoint" ist einen Klick weit\n' +
      '🔎 **Item-Finder** — Items mit gleichem Namen zeigen jetzt ihre Ausführungen. ' +
      'Etliche Namen stehen im Spiel für mehrere Größen; du bekommst jetzt die richtige\n' +
      '✨ **Überall** — Typografie, Bewegung und Lesbarkeit site-weit überarbeitet\n' +
      '↩️ **Dazu** — viele kleinere Verbesserungen: Filter- und Ergebnislisten scrollen ' +
      'für sich, ein „Zurück"-Knopf bringt dich wirklich dahin zurück, wo du herkamst ' +
      '(Suche und Scrollposition bleiben stehen), und jedes Werkzeug erklärt kurz, wofür ' +
      'es da ist',
    nextTitle: 'Sieht was falsch aus?',
    next: 'Sag Bescheid — {suggestions} und {support} stehen offen. Falsche Zahlen sind ' +
      'genau die Sorte Fehler, von der ich am liebsten höre.',
    footer: 'o7 · Krisz',
  },
};

const PING_LINE = 'Site update · Seiten-Update 🛠';

function buildEmbed(locale, mentions) {
  const b = BODY[locale];
  const next = b.next.replace(/\{(\w+)\}/g, (m, k) => mentions[k] || `#${k}`);
  return new EmbedBuilder()
    .setColor(ACCENT)
    .setAuthor({ name: b.author })
    .setTitle(b.title)
    .setDescription(b.description)
    .addFields({ name: b.fieldsTitle, value: b.fields }, { name: b.nextTitle, value: next })
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
