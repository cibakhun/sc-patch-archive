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
    title: '⛏ Mining rebuilt — now live',
    description:
      'The mining section on **verse-base.com** has been rebuilt from the ground up. ' +
      'One bench instead of a pile of tables: pick an ore, and where to find it, ' +
      'what it is worth refining and what else sits in that rock are all right there.',
    fieldsTitle: "What's new",
    fields:
      '⛏ **Mining workbench** — all 37 ores at a glance with their scan signature, ' +
      'their locations sorted by how much you actually get, and the refineries that ' +
      'squeeze the most out of them\n' +
      '📍 **Locations you can open** — click a location and see everything that occurs ' +
      'there, with its odds. Every location has its own link now, so you can share one\n' +
      '📌 **Pin lists and presets** — pin ores and locations while you plan; with an ' +
      'account you can save a named set and call it back on any device\n' +
      '🪟 **Put the lists in their own window** — a real, free-floating window you can ' +
      'drag anywhere. In Chrome, Edge and Opera it stays on top of everything else, ' +
      'so it works on a second screen next to the game (borderless windowed)\n' +
      '💥 **Fracturing calculator** — its own page: will that rock break with your gear\n' +
      '✅ **Corrected numbers** — location lists were cut short and mass shares were ' +
      'added up wrongly. Both are fixed, so what you see now is the full picture',
    nextTitle: 'Something look wrong?',
    next: 'Tell me — {feedback} is wide open. Wrong numbers are the ' +
      'kind of bug I most want to hear about.',
    footer: 'o7 · Krisz',
  },
  de: {
    author: 'VerseBase · Seiten-Update',
    title: '⛏ Mining neu gebaut — jetzt live',
    description:
      'Der Mining-Bereich auf **verse-base.com** ist von Grund auf neu gebaut. ' +
      'Eine Werkbank statt eines Stapels Tabellen: Erz anklicken, und wo es liegt, ' +
      'was es beim Raffinieren bringt und was sonst noch im Stein steckt, steht daneben.',
    fieldsTitle: 'Was neu ist',
    fields:
      '⛏ **Mining-Werkbank** — alle 37 Erze auf einen Blick mit ihrer Scan-Signatur, ' +
      'ihre Fundorte sortiert danach, was wirklich herauskommt, und die Stationen, ' +
      'die am meisten daraus holen\n' +
      '📍 **Fundorte zum Aufklappen** — Fundort anklicken und sehen, was dort alles ' +
      'vorkommt, mit Chance. Jeder Fundort hat jetzt einen eigenen Link zum Teilen\n' +
      '📌 **Merklisten und Presets** — Erze und Fundorte beim Planen anheften; mit ' +
      'Konto lässt sich eine benannte Zusammenstellung speichern und auf jedem Gerät ' +
      'wieder aufrufen\n' +
      '🪟 **Die Listen in ein eigenes Fenster** — ein echtes, frei verschiebbares ' +
      'Fenster. In Chrome, Edge und Opera bleibt es über allem anderen liegen, taugt ' +
      'also für den zweiten Bildschirm neben dem Spiel (randloser Fenstermodus)\n' +
      '💥 **Fracturing-Rechner** — eigene Seite: bricht der Brocken mit deiner Ausrüstung\n' +
      '✅ **Korrigierte Zahlen** — Fundortlisten waren abgeschnitten und Massenanteile ' +
      'falsch aufsummiert. Beides behoben, du siehst jetzt das vollständige Bild',
    nextTitle: 'Sieht was falsch aus?',
    next: 'Sag Bescheid — {feedback} steht offen. Falsche Zahlen sind ' +
      'genau die Sorte Fehler, von der ich am liebsten höre.',
    footer: 'o7 · Krisz',
  },
};

const PING_LINE = 'Mining update · Mining-Update ⛏';

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
