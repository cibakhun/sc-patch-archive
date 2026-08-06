// ═══════════════════════════════════════════════════════════════════════════
//  announce-milestone.mjs — post a community milestone to #announcements.
//
//  A broadcast reaches one channel, so it can't be rendered per-user the way
//  the bot's slash-command replies are. Same answer as the patch feed
//  (bot/src/patch-watch.mjs): ONE message carrying TWO single-language embeds
//  — English first, German second — plus a single ping to @📢 Announcement
//  Pings, the opt-in role. Nobody has to read a language they didn't pick.
//
//  Idempotent: refuses to post twice for the same milestone (it scans the
//  channel's recent history for its own embed title). Re-runnable, so a failed
//  attempt costs nothing.
//
//  Usage, from the /discord folder:
//     node announce-milestone.mjs --dry-run     # resolve + preview, send nothing
//     node announce-milestone.mjs               # post it
//     node announce-milestone.mjs --edit        # rewrite the live post in place
//     node announce-milestone.mjs --force       # post a second copy anyway
//     … --image <path>                          # attach a picture to the English
//                                               # embed (Discord allows adding an
//                                               # attachment on edit, so this
//                                               # works with --edit too)
// ═══════════════════════════════════════════════════════════════════════════
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// .env is optional — a git worktree has none, so the vars may come from the
// environment instead.
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
// --image <path>: shown inside the English embed only. The German embed skips it,
// the same way the patch feed carries the hero image exactly once.
const IMAGE = (() => {
  const i = process.argv.indexOf('--image');
  if (i === -1) return null;
  const p = process.argv[i + 1];
  if (!p || p.startsWith('--')) { console.error('✗ --image needs a file path.'); process.exit(1); }
  if (!existsSync(p)) { console.error(`✗ --image: no such file — ${p}`); process.exit(1); }
  return p;
})();
const IMAGE_NAME = IMAGE ? `milestone${IMAGE.slice(IMAGE.lastIndexOf('.'))}` : null;

// ── the milestone ───────────────────────────────────────────────────────────
// The English embed title doubles as the idempotency marker — a re-run
// recognises its own past post by it, so nothing machine-readable has to show
// up in the footer where members would see it.
const ACCENT = 0x2dd4ff; // --accent, the site's signature cyan

// Channels referenced in the body, by blueprint key → resolved to real mentions.
const REFS = ['suggestions', 'support'];

const BODY = {
  en: {
    author: 'VerseBase · Community milestone',
    title: '🎉 200 pilots — thank you',
    description:
      'verse-base.com just crossed **200 unique visitors**.\n\n' +
      'A few weeks ago this was a patch archive and two calculators. Since then ' +
      '200 of you have come through — and **38 came back** for more. That second ' +
      'number is the one I\'m proudest of.',
    fieldsTitle: 'What you\'ve been flying with',
    fields:
      '🩹 The patch archive & evolution timeline\n' +
      '⛏ 💰 🔧 Mining, trading & crafting databases — deep, current, cross-linked\n' +
      '🚀 227 ships with 3D holo viewers and full data sheets\n' +
      '🔎 5,086 items and 1,594 blueprints in the Item Finder\n' +
      '🧭 Jordessey\'s Aaron Halo jump calculator\n' +
      '🤖 And Verse-Bot right here — `/ship` `/price` `/item` `/patch`',
    nextTitle: 'Next stop: 500',
    next: 'If a tool helped you, tell a wingman. If something\'s missing, {suggestions} and {support} are wide open.',
    footer: 'o7 · Krisz',
  },
  de: {
    author: 'VerseBase · Community-Meilenstein',
    title: '🎉 200 Piloten — danke',
    description:
      'verse-base.com hat gerade **200 einzelne Besucher** geknackt.\n\n' +
      'Vor ein paar Wochen war das ein Patch-Archiv und zwei Rechner. Seitdem ' +
      'waren 200 von euch da, **38 sind wiedergekommen** — auf die zweite Zahl ' +
      'bin ich am meisten stolz.',
    fieldsTitle: 'Was ihr genutzt habt',
    fields:
      '🩹 Das Patch-Archiv & die Evolutions-Zeitleiste\n' +
      '⛏ 💰 🔧 Bergbau-, Handels- & Handwerks-Datenbanken — tief, aktuell, verlinkt\n' +
      '🚀 227 Schiffe mit 3D-Holo-Viewer und vollen Datenblättern\n' +
      '🔎 5.086 Items und 1.594 Baupläne im Item-Finder\n' +
      '🧭 Jordesseys Aaron-Halo-Sprungrechner\n' +
      '🤖 Und Verse-Bot direkt hier — `/ship` `/price` `/item` `/patch`',
    nextTitle: 'Nächstes Ziel: 500',
    next: 'Wenn dir ein Tool geholfen hat, erzähl\'s einem Wingman. Wenn was fehlt: {suggestions} und {support} stehen offen.',
    footer: 'o7 · Krisz',
  },
};

// Ping line. The only place both languages share a line — it's four words.
const PING_LINE = '200 pilots · 200 Piloten 🎉';

function buildEmbed(locale, mentions, { image = false } = {}) {
  const b = BODY[locale];
  const next = b.next.replace(/\{(\w+)\}/g, (m, k) => mentions[k] || `#${k}`);
  const embed = new EmbedBuilder()
    .setColor(ACCENT)
    .setAuthor({ name: b.author })
    .setTitle(b.title)
    .setDescription(b.description)
    .addFields(
      { name: b.fieldsTitle, value: b.fields },
      { name: b.nextTitle, value: next },
    )
    .setFooter({ text: b.footer });
  if (image && IMAGE_NAME) embed.setImage(`attachment://${IMAGE_NAME}`);
  return embed;
}

// ── connect ─────────────────────────────────────────────────────────────────
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

// ── idempotency ─────────────────────────────────────────────────────────────
const recent = await channel.messages.fetch({ limit: 50 }).catch(() => null);
const already = recent && [...recent.values()].find(
  (m) => m.author?.id === client.user.id && m.embeds?.some((e) => e.title === BODY.en.title),
);
const payload = {
  content: role ? `<@&${role.id}> — ${PING_LINE}` : PING_LINE,
  embeds: [buildEmbed('en', mentions, { image: true }), buildEmbed('de', mentions)],
  allowedMentions: { roles: role ? [role.id] : [] },
};
if (IMAGE) payload.files = [{ attachment: IMAGE, name: IMAGE_NAME }];

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

// Editing keeps the original timestamp, reactions and pin — and re-pings
// nobody, since Discord only notifies on the first send.
if (EDIT) {
  // `attachments: []` drops any picture from a previous edit, so re-running with
  // a different --image replaces it instead of stacking a second copy.
  await already.edit({
    content: payload.content,
    embeds: payload.embeds,
    attachments: [],
    ...(payload.files ? { files: payload.files } : {}),
  });
  console.log(`\n✓ Edited in place${IMAGE ? ' (with image)' : ''}: ${already.url}`);
  await client.destroy();
  process.exit(0);
}

const sent = await channel.send(payload);
console.log(`\n✓ Posted to #${channel.name}: ${sent.url}`);

// #announcements is an announcement channel — publish so servers following it
// get the milestone too. Best-effort; a plain text channel just can't crosspost.
if (sent.crosspostable) {
  await sent.crosspost().then(() => console.log('✓ Published to following servers.'))
    .catch((e) => console.warn(`! Publish failed: ${e.message}`));
}

await client.destroy();
