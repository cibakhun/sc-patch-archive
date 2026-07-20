// ═══════════════════════════════════════════════════════════════════════════
//  data-commands.mjs — the "Flight Computer": /ship /price /item /patch.
//
//  Reads the bundled game-data snapshot (data.mjs) and answers in rich embeds
//  with autocomplete and links back to verse-base.com. Same data that builds
//  the site — nothing invented.
// ═══════════════════════════════════════════════════════════════════════════
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import {
  SITE, findShip, suggestShips, findCommodity, suggestCommodities,
  findItem, suggestItems, latestPatch, findPatch, allPatches, counts,
} from './data.mjs';
import { emojiFor } from './emoji.mjs';

const C = { ship: 0x2dd4ff, price: 0xa78bfa, item: 0x2fbfa4, patch: 0xd4af37 };
const fmt = (n) => (n == null ? null : Number(n).toLocaleString('en-US'));
const linkRow = (...pairs) => new ActionRowBuilder().addComponents(
  ...pairs.filter(Boolean).map(([label, url]) => new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url)),
);
const notFound = (i, q, suggestions) => i.reply({
  content: suggestions.length
    ? `No exact match for **${q}**. Did you mean: ${suggestions.map((s) => `\`${s}\``).join(' · ')}?`
    : `Nothing found for **${q}**.`,
  ephemeral: true,
});

// ── command registration ────────────────────────────────────────────────────
export function buildDataCommandData() {
  return [
    new SlashCommandBuilder().setName('ship').setDescription('Ship data sheet from verse-base.com').setDMPermission(false)
      .addStringOption((o) => o.setName('name').setDescription('Ship name').setRequired(true).setAutocomplete(true))
      .toJSON(),
    new SlashCommandBuilder().setName('price').setDescription('Live commodity price & best sell location').setDMPermission(false)
      .addStringOption((o) => o.setName('commodity').setDescription('Commodity name').setRequired(true).setAutocomplete(true))
      .toJSON(),
    new SlashCommandBuilder().setName('item').setDescription('Where to buy an item, and for how much').setDMPermission(false)
      .addStringOption((o) => o.setName('name').setDescription('Item name').setRequired(true).setAutocomplete(true))
      .toJSON(),
    new SlashCommandBuilder().setName('patch').setDescription('Star Citizen patch summary').setDMPermission(false)
      .addStringOption((o) => o.setName('version').setDescription('Version (default: latest)').setRequired(false).setAutocomplete(true))
      .toJSON(),
  ];
}

export function isDataCommand(name) {
  return ['ship', 'price', 'item', 'patch'].includes(name);
}

// ── dispatch ──────────────────────────────────────────────────────────────────
export async function executeData(ctx, i) {
  switch (i.commandName) {
    case 'ship': return cmdShip(i);
    case 'price': return cmdPrice(i);
    case 'item': return cmdItem(i);
    case 'patch': return cmdPatch(i);
  }
}

// ── autocomplete ────────────────────────────────────────────────────────────
export async function handleAutocomplete(i) {
  const q = i.options.getFocused() || '';
  let choices = [];
  if (i.commandName === 'ship') {
    choices = suggestShips(q, 25).map((s) => ({ name: `${s.name}${s.makerCode ? ` · ${s.makerCode}` : ''}`.slice(0, 100), value: s.name.slice(0, 100) }));
  } else if (i.commandName === 'price') {
    choices = suggestCommodities(q, 25).map((c) => ({ name: `${c.name}${c.code ? ` (${c.code})` : ''}`.slice(0, 100), value: c.name.slice(0, 100) }));
  } else if (i.commandName === 'item') {
    choices = suggestItems(q, 25).map((x) => ({ name: x.name.slice(0, 100), value: x.name.slice(0, 100) }));
  } else if (i.commandName === 'patch') {
    choices = allPatches().slice(0, 25).map((p) => ({ name: `${p.version} — ${p.codename}`.slice(0, 100), value: p.version }));
  }
  await i.respond(choices.slice(0, 25)).catch(() => {});
}

// ── /ship ─────────────────────────────────────────────────────────────────────
async function cmdShip(i) {
  const q = i.options.getString('name');
  const s = findShip(q);
  if (!s) return notFound(i, q, suggestShips(q).map((x) => x.name));

  const embed = new EmbedBuilder()
    .setColor(C.ship)
    .setAuthor({ name: `Ship · ${s.manufacturer || 'Unknown'}` })
    .setTitle(s.name)
    .setFooter({ text: 'VerseBase • game-accurate data sheet' });

  const f = [];
  if (s.classification || s.type) f.push({ name: 'Type', value: s.classification || s.type, inline: true });
  if (s.size) f.push({ name: 'Size', value: s.size, inline: true });
  if (s.status) f.push({ name: 'Status', value: s.status, inline: true });
  if (s.crewMin != null || s.crewMax != null) f.push({ name: 'Crew', value: s.crewMin === s.crewMax ? `${s.crewMin}` : `${s.crewMin ?? '?'}–${s.crewMax ?? '?'}`, inline: true });
  if (s.cargoSCU != null) f.push({ name: 'Cargo', value: `${fmt(s.cargoSCU)} SCU`, inline: true });
  if (s.lengthM != null) f.push({ name: 'Length', value: `${fmt(s.lengthM)} m`, inline: true });
  if (s.priceUSD != null) f.push({ name: 'Pledge', value: `$${fmt(s.priceUSD)}`, inline: true });
  if (s.focus) f.push({ name: 'Focus', value: s.focus, inline: false });
  if (f.length) embed.addFields(f);

  const em = emojiFor(i.guild, s.manufacturer);
  if (em) embed.setThumbnail(em.imageURL({ size: 128 }));

  await i.reply({ embeds: [embed], components: [linkRow(['Open on verse-base.com ↗', `${SITE}/schiffe.html`])] });
}

// ── /price ────────────────────────────────────────────────────────────────────
async function cmdPrice(i) {
  const q = i.options.getString('commodity');
  const c = findCommodity(q);
  if (!c) return notFound(i, q, suggestCommodities(q).map((x) => x.name));

  const embed = new EmbedBuilder()
    .setColor(C.price)
    .setAuthor({ name: `Commodity · UEX${c.is_mineral ? ' · mineral' : ''}` })
    .setTitle(`${c.name}${c.code ? `  ·  ${c.code}` : ''}`)
    .setFooter({ text: 'VerseBase • prices from UEX' });

  const f = [];
  if (c.sell != null) f.push({ name: 'Best sell', value: `**${fmt(c.sell)}** aUEC/unit`, inline: true });
  if (c.buy != null) f.push({ name: 'Buy', value: `${fmt(c.buy)} aUEC/unit`, inline: true });
  if (c.kind) f.push({ name: 'Kind', value: c.kind, inline: true });
  if (c.sellLoc) f.push({ name: 'Best sell location', value: c.sellLoc, inline: false });
  if (f.length) embed.addFields(f);

  const buttons = [['Open in Item Finder ↗', `${SITE}/item-finder.html`]];
  if (c.wiki) buttons.push(['Wiki ↗', c.wiki]);
  await i.reply({ embeds: [embed], components: [linkRow(...buttons)] });
}

// ── /item ─────────────────────────────────────────────────────────────────────
async function cmdItem(i) {
  const q = i.options.getString('name');
  const it = findItem(q);
  if (!it) return notFound(i, q, suggestItems(q).map((x) => x.name));

  const rows = (it.rows || []).slice().sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9)).slice(0, 6);
  const list = rows.length
    ? rows.map((r) => `\`${fmt(r.price)} aUEC\` — ${r.loc}`).join('\n')
    : 'No known sale locations.';

  const embed = new EmbedBuilder()
    .setColor(C.item)
    .setAuthor({ name: it.category || 'Item · UEX' })
    .setTitle(it.name)
    .addFields({ name: 'Where to buy', value: list.slice(0, 1024) })
    .setFooter({ text: `VerseBase • ${it.rows?.length || 0} location(s)` });

  await i.reply({ embeds: [embed], components: [linkRow(['Open in Item Finder ↗', `${SITE}/item-finder.html`])] });
}

// ── /patch ────────────────────────────────────────────────────────────────────
function bullets(arr, n = 6) {
  return (arr || [])
    .map((x) => (typeof x === 'string' ? x : (x.title || x.name || x.headline || x.text)))
    .filter(Boolean)
    .slice(0, n)
    .map((t) => `• ${t}`)
    .join('\n');
}

export function buildPatchEmbed(p) {
  const embed = new EmbedBuilder()
    .setColor(C.patch)
    .setAuthor({ name: `Patch${p.era ? ` · ${p.era} era` : ''}` })
    .setTitle(`${p.version} — ${p.codename}`)
    .setFooter({ text: 'VerseBase • patch archive' });

  if (p.dateDisplay || p.date) embed.addFields({ name: 'Released', value: String(p.dateDisplay || p.date), inline: true });
  if (p.type) embed.addFields({ name: 'Type', value: String(p.type), inline: true });
  const desc = p.summary || p.tagline;
  if (desc) embed.setDescription(String(desc).slice(0, 600));
  const facts = bullets(p.keyFacts, 6);
  if (facts) embed.addFields({ name: 'Key facts', value: facts.slice(0, 1024) });
  const feats = bullets(p.features, 6);
  if (feats) embed.addFields({ name: 'Highlights', value: feats.slice(0, 1024) });
  if (p.wipe) embed.addFields({ name: 'Wipe', value: String(p.wipe).slice(0, 200) });
  if (p.heroImage) embed.setImage(p.heroImage.startsWith('http') ? p.heroImage : `${SITE}${p.heroImage}`);
  return embed;
}

export function patchButtons(p) {
  const buttons = [['Patch archive ↗', `${SITE}/archiv.html`]];
  if (p.notesUrl) buttons.push(['Official notes ↗', p.notesUrl]);
  return linkRow(...buttons);
}

async function cmdPatch(i) {
  const v = i.options.getString('version');
  const p = v ? findPatch(v) : latestPatch();
  if (!p) return notFound(i, v || 'latest', allPatches().slice(0, 6).map((x) => x.version));
  await i.reply({ embeds: [buildPatchEmbed(p)], components: [patchButtons(p)] });
}

export const dataCounts = counts;
