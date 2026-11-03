// ═══════════════════════════════════════════════════════════════════════════
//  announce-milestone.mjs — post a community milestone to #announcements.
//
//  A broadcast reaches one channel, so it can't be rendered per-user the way
//  the bot's slash-command replies are. Same answer as the patch feed
//  (bot/src/patch-watch.mjs): ONE message carrying TWO single-language embeds
//  — English first, German second — plus the pings in PINGS below, all of them
//  in the message content, since a role mention inside an embed notifies
//  nobody. Nobody has to read a language they didn't pick.
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
import { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
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
// 17.08.2026: #suggestions und #support sind zu #feedback verschmolzen
// (blueprint.mjs, cat-build) — derselbe Grund wie in announce-update.mjs.
const REFS = ['feedback'];

const BODY = {
  en: {
    author: 'VerseBase · Community milestone',
    title: '🎉 10,000 visitors — thank you',
    description:
      'verse-base.com just passed **10,000 visitors**.\n\n' +
      'When it crossed 200 a few months ago, this was a patch archive and two ' +
      'calculators. It is now 231 ships, 1,617 blueprints, a mining bench and a ' +
      'refinery — and what I hear most often is that people keep it open on a ' +
      'second screen while the game runs. That is exactly what it is for.\n\n' +
      'To mark it, the two pages that had fallen furthest behind are **rebuilt ' +
      'and live**.',
    fieldsTitle: 'Rebuilt for the occasion',
    fields:
      '👤 **Your account** — the overview is a cockpit: every tool with its ' +
      'current state, and one history across all of them\n' +
      '🪪 **Profile in tabs, pilot page beside it** — edit on the left, watch ' +
      'your public pilot page change on the right. Rank, hangar and showcase included\n' +
      '🔐 **Security at a glance** — a “3 of 4” shield up top, two-factor with any ' +
      'authenticator app (just scan the QR code), every session and connected ' +
      'account in one place\n' +
      '👥 **Friends** — invite someone with your own link, chat in the sidebar\n' +
      '⚗️ **Refinery** — yield for all 20 refineries per ore, 26 refinable ores, ' +
      'the 9 methods, and what each ore is worth\n' +
      '⏱ **Tracker with a countdown** — your orders with time left and value, a ' +
      'mini timer in your account, and a ping when one finishes — on the site or ' +
      'via Discord, your choice',
    thanksTitle: 'A special o7 to our Test Pilots',
    thanks:
      'You poked at every rough edge before anyone else saw it and reported the ' +
      'bugs that would have hit everyone — a good chunk of the polish in this ' +
      'update is down to you.',
    nextTitle: 'Next stop: 25,000',
    next:
      'If a tool helped you, tell a wingman. And if something looks wrong or ' +
      'does not work, {feedback} is wide open — that is where most of this came from.',
    footer: 'o7 · Krisz',
  },
  de: {
    author: 'VerseBase · Community-Meilenstein',
    title: '🎉 10.000 Besucher — danke',
    description:
      'verse-base.com hat gerade die **10.000 Besucher** geknackt.\n\n' +
      'Vor ein paar Monaten, als wir die 200 erreicht haben, war das hier ein ' +
      'Patch-Archiv und zwei Rechner. Heute sind\'s 231 Schiffe, 1.617 Baupläne, ' +
      'eine Mining-Werkbank und eine Raffinerie — und was ich am häufigsten höre: ' +
      'Ihr habt die Seite auf dem zweiten Bildschirm offen, während ihr zockt. ' +
      'Genau dafür ist sie gedacht.\n\n' +
      'Zum Anlass haben wir die zwei Seiten, die am meisten hinterherhingen, ' +
      'komplett neu gebaut — und sie sind **live**.',
    fieldsTitle: 'Frisch neu gebaut',
    fields:
      '👤 **Dein Konto** — die Übersicht ist jetzt ein echtes Cockpit: alle Tools ' +
      'mit ihrem aktuellen Stand und ein gemeinsamer Verlauf über alles\n' +
      '🪪 **Profil in Reitern, Pilotenseite direkt daneben** — links bearbeiten, ' +
      'rechts in Echtzeit zusehen, wie sich deine öffentliche Pilotenseite ' +
      'verändert. Mit Rang, Hangar und Schaufenster\n' +
      '🔐 **Sicherheit auf einen Blick** — oben ein „3 von 4"-Schild, Zwei-Faktor ' +
      'mit jeder Authenticator-App (einfach den QR-Code scannen), und alle ' +
      'Sitzungen und verbundenen Konten an einem Ort\n' +
      '👥 **Freunde** — per eigenem Link einladen und direkt in der Seitenleiste chatten\n' +
      '⚗️ **Raffinerie** — Ertrag aller 20 Raffinerien pro Erz, 26 raffinierbare ' +
      'Erze, die 9 Methoden und was jedes Erz einbringt\n' +
      '⏱ **Auftrags-Tracker mit Countdown** — alle Aufträge mit Restzeit und Wert, ' +
      'ein Mini-Timer direkt im Konto und eine Benachrichtigung, sobald einer ' +
      'fertig ist — auf der Seite oder per Discord, ganz wie du magst',
    thanksTitle: 'Ein besonderes o7 an unsere Test Pilots',
    thanks:
      'Ihr habt jede raue Kante angefasst, bevor sie jemand anders zu sehen ' +
      'bekam, und die Bugs gemeldet, die sonst alle erwischt hätten — ein guter ' +
      'Teil vom Feinschliff in diesem Update geht auf euch zurück.',
    nextTitle: 'Nächstes Ziel: 25.000',
    next:
      'Wenn dir eins der Tools weitergeholfen hat, erzähl\'s einem Wingman. Und ' +
      'wenn irgendwas falsch aussieht oder hakt — {feedback} ist offen. Von da ' +
      'kam das meiste hier überhaupt erst.',
    footer: 'o7 · Krisz',
  },
};

// Ping line. The only place both languages share a line — it's four words.
const PING_LINE = '10,000 visitors · 10.000 Besucher 🎉';

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
      { name: b.thanksTitle, value: b.thanks },
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

// Roles the message pings, in the order they appear in the content line.
// Both are mentionable:false by blueprint (roles[], "Notification opt-ins"), so
// only MentionEveryone reaches them — and Discord renders a mention it won't
// allow as inert text WITHOUT an error. So the permission is checked below and
// a dead ping aborts the run instead of shipping a post that looks right.
const PINGS = [
  { label: '📢 Announcement Pings', match: /announcement\s*pings/i },
  { label: '🧪 Test Pilots', match: /test\s*pilots/i },
];
const pingRoles = [];
for (const p of PINGS) {
  const r = guild.roles.cache.find((x) => p.match.test(x.name));
  if (r) pingRoles.push(r);
  else console.warn(`! No "${p.label}" role — posting without that ping.`);
}

const me = await guild.members.fetchMe().catch(() => null);
const canMentionAll = Boolean(channel.permissionsFor(me)?.has(PermissionFlagsBits.MentionEveryone));

const mentions = {};
for (const key of REFS) {
  const ch = guild.channels.cache.find((c) => c.isTextBased?.() && new RegExp(key, 'i').test(c.name));
  mentions[key] = ch ? `<#${ch.id}>` : `#${key}`;
  if (!ch) console.warn(`! No #${key} channel — falling back to plain text.`);
}

console.log(`Channel: #${channel.name}`);
console.log(`Refs:    ${REFS.map((k) => `${k} → ${mentions[k]}`).join(', ')}`);
console.log(`Bot:     ${me?.user.tag ?? '?'} · MentionEveryone in #${channel.name}: ${canMentionAll ? 'yes' : 'NO'}`);
let totLos = 0;
for (const r of pingRoles) {
  const wirdPingen = r.mentionable || canMentionAll;
  if (!wirdPingen) totLos++;
  console.log(`Ping:    @${r.name}  id ${r.id}  mentionable=${r.mentionable}  pings: ${wirdPingen ? 'yes' : 'NO — inert text'}`);
}
if (totLos) {
  console.error(`\n✗ ${totLos} Rolle(n) würden als Klartext erscheinen, nicht als Ping. Abbruch.`);
  await client.destroy();
  process.exit(1);
}

// Discord's own limits. An overlong field is a 400 at send time, which on a
// milestone post means the ping is spent and the retry is a second message.
const GRENZEN = { author: 256, title: 256, description: 4096, fieldsTitle: 256, fields: 1024, thanksTitle: 256, thanks: 1024, nextTitle: 256, next: 1024, footer: 2048 };
let zuLang = 0;
for (const [loc, b] of Object.entries(BODY)) {
  for (const [feld, max] of Object.entries(GRENZEN)) {
    const n = (b[feld] ?? '').length;
    if (n > max) { zuLang++; console.error(`✗ ${loc}.${feld} ${n} / ${max}`); }
  }
}
const laengste = Math.max(...Object.values(BODY).map((b) => b.fields.length));
console.log(`Felder:  ${Object.keys(GRENZEN).length * 2} geprüft, längstes ${laengste} / 1024`);
if (zuLang) { console.error(`\n✗ ${zuLang} Feld(er) über der Grenze. Abbruch.`); await client.destroy(); process.exit(1); }

// ── idempotency ─────────────────────────────────────────────────────────────
const recent = await channel.messages.fetch({ limit: 50 }).catch(() => null);
const already = recent && [...recent.values()].find(
  (m) => m.author?.id === client.user.id && m.embeds?.some((e) => e.title === BODY.en.title),
);
const payload = {
  content: pingRoles.length
    ? `${pingRoles.map((r) => `<@&${r.id}>`).join(' ')} — ${PING_LINE}`
    : PING_LINE,
  embeds: [buildEmbed('en', mentions, { image: true }), buildEmbed('de', mentions)],
  // parse: [] turns off @everyone and every mention Discord would otherwise
  // find in the text; the roles list is then the whole allowlist. A channel
  // mention in the body is unaffected — it isn't a notification.
  allowedMentions: { parse: [], roles: pingRoles.map((r) => r.id) },
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
