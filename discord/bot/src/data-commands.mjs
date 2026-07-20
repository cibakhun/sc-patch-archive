// ═══════════════════════════════════════════════════════════════════════════
//  data-commands.mjs — the "Flight Computer": /ship /price /item /patch.
//
//  Reads the bundled game-data snapshot (data.mjs) and answers in rich embeds
//  with autocomplete and links back to verse-base.com. Same data that builds
//  the site — nothing invented. Every reply is rendered in the caller's
//  language (their 🇬🇧/🇩🇪 role → i18n locale); commodity/item names, kinds and
//  sale locations stay UEX-canonical in both languages.
// ═══════════════════════════════════════════════════════════════════════════
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import {
  SITE, findShip, suggestShips, findCommodity, suggestCommodities,
  findItem, suggestItems, latestPatch, findPatch, allPatches, counts,
  localizedShip, localizedPatch,
} from './data.mjs';
import { resolveLocale, t } from './i18n.mjs';
import { emojiFor } from './emoji.mjs';

const C = { ship: 0x2dd4ff, price: 0xa78bfa, item: 0x2fbfa4, patch: 0xd4af37 };
const fmt = (n) => (n == null ? null : Number(n).toLocaleString('en-US'));
const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : s);
const linkRow = (...pairs) => new ActionRowBuilder().addComponents(
  ...pairs.filter(Boolean).map(([label, url]) => new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url)),
);
const notFound = (i, q, suggestions, locale) => i.reply({
  content: suggestions.length
    ? t(locale, 'common.notFoundSuggest', { q, list: suggestions.map((s) => `\`${s}\``).join(' · ') })
    : t(locale, 'common.notFoundNone', { q }),
  ephemeral: true,
});

// ── command registration ────────────────────────────────────────────────────
// German name/description localizations surface in the slash-command picker for
// members whose Discord client is set to German.
export function buildDataCommandData() {
  return [
    new SlashCommandBuilder().setName('ship').setDescription('Ship data sheet from verse-base.com')
      .setDescriptionLocalizations({ de: 'Schiff-Datenblatt von verse-base.com' }).setDMPermission(false)
      .addStringOption((o) => o.setName('name').setDescription('Ship name').setDescriptionLocalizations({ de: 'Schiffsname' }).setRequired(true).setAutocomplete(true))
      .toJSON(),
    new SlashCommandBuilder().setName('price').setDescription('Live commodity price & best sell location')
      .setDescriptionLocalizations({ de: 'Live-Warenpreis & bester Verkaufsort' }).setDMPermission(false)
      .addStringOption((o) => o.setName('commodity').setDescription('Commodity name').setDescriptionLocalizations({ de: 'Warenname' }).setRequired(true).setAutocomplete(true))
      .toJSON(),
    new SlashCommandBuilder().setName('item').setDescription('Where to buy an item, and for how much')
      .setDescriptionLocalizations({ de: 'Wo man einen Gegenstand kauft, und für wie viel' }).setDMPermission(false)
      .addStringOption((o) => o.setName('name').setDescription('Item name').setDescriptionLocalizations({ de: 'Gegenstandsname' }).setRequired(true).setAutocomplete(true))
      .toJSON(),
    new SlashCommandBuilder().setName('patch').setDescription('Star Citizen patch summary')
      .setDescriptionLocalizations({ de: 'Star-Citizen-Patch-Zusammenfassung' }).setDMPermission(false)
      .addStringOption((o) => o.setName('version').setDescription('Version (default: latest)').setDescriptionLocalizations({ de: 'Version (Standard: neueste)' }).setRequired(false).setAutocomplete(true))
      .toJSON(),
  ];
}

export function isDataCommand(name) {
  return ['ship', 'price', 'item', 'patch'].includes(name);
}

// ── dispatch ──────────────────────────────────────────────────────────────────
export async function executeData(ctx, i) {
  const locale = resolveLocale(i.member, i.locale);
  switch (i.commandName) {
    case 'ship': return cmdShip(i, locale);
    case 'price': return cmdPrice(i, locale);
    case 'item': return cmdItem(i, locale);
    case 'patch': return cmdPatch(i, locale);
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
async function cmdShip(i, locale) {
  const q = i.options.getString('name');
  const raw = findShip(q);
  if (!raw) return notFound(i, q, suggestShips(q).map((x) => x.name), locale);
  const s = localizedShip(raw, locale);

  const embed = new EmbedBuilder()
    .setColor(C.ship)
    .setAuthor({ name: t(locale, 'ship.author', { mfr: s.manufacturer || t(locale, 'ship.unknown') }) })
    .setTitle(s.name)
    .setFooter({ text: t(locale, 'ship.footer') });

  const f = [];
  if (s.type) f.push({ name: t(locale, 'ship.type'), value: cap(s.type), inline: true });
  if (s.size) f.push({ name: t(locale, 'ship.size'), value: s.size, inline: true });
  if (s.status) f.push({ name: t(locale, 'ship.status'), value: cap(s.status), inline: true });
  if (s.crewMin != null || s.crewMax != null) f.push({ name: t(locale, 'ship.crew'), value: s.crewMin === s.crewMax ? `${s.crewMin}` : `${s.crewMin ?? '?'}–${s.crewMax ?? '?'}`, inline: true });
  if (s.cargoSCU != null) f.push({ name: t(locale, 'ship.cargo'), value: `${fmt(s.cargoSCU)} SCU`, inline: true });
  if (s.lengthM != null) f.push({ name: t(locale, 'ship.length'), value: `${fmt(s.lengthM)} m`, inline: true });
  if (s.priceUSD != null) f.push({ name: t(locale, 'ship.pledge'), value: `$${fmt(s.priceUSD)}`, inline: true });
  if (s.focus) f.push({ name: t(locale, 'ship.focus'), value: s.focus, inline: false });
  if (f.length) embed.addFields(f);

  const em = emojiFor(i.guild, s.manufacturer);
  if (em) embed.setThumbnail(em.imageURL({ size: 128 }));

  await i.reply({ embeds: [embed], components: [linkRow([t(locale, 'ship.open'), `${SITE}/schiffe.html`])] });
}

// ── /price ────────────────────────────────────────────────────────────────────
async function cmdPrice(i, locale) {
  const q = i.options.getString('commodity');
  const c = findCommodity(q);
  if (!c) return notFound(i, q, suggestCommodities(q).map((x) => x.name), locale);

  const embed = new EmbedBuilder()
    .setColor(C.price)
    .setAuthor({ name: t(locale, 'price.author', { mineral: c.is_mineral ? t(locale, 'price.mineral') : '' }) })
    .setTitle(`${c.name}${c.code ? `  ·  ${c.code}` : ''}`)
    .setFooter({ text: t(locale, 'price.footer') });

  const f = [];
  if (c.sell != null) f.push({ name: t(locale, 'price.bestSell'), value: `**${fmt(c.sell)}** ${t(locale, 'price.perUnit')}`, inline: true });
  if (c.buy != null) f.push({ name: t(locale, 'price.buy'), value: `${fmt(c.buy)} ${t(locale, 'price.perUnit')}`, inline: true });
  if (c.kind) f.push({ name: t(locale, 'price.kind'), value: c.kind, inline: true });
  if (c.sellLoc) f.push({ name: t(locale, 'price.sellLoc'), value: c.sellLoc, inline: false });
  if (f.length) embed.addFields(f);

  const buttons = [[t(locale, 'price.openFinder'), `${SITE}/item-finder.html`]];
  if (c.wiki) buttons.push([t(locale, 'price.wiki'), c.wiki]);
  await i.reply({ embeds: [embed], components: [linkRow(...buttons)] });
}

// ── /item ─────────────────────────────────────────────────────────────────────
async function cmdItem(i, locale) {
  const q = i.options.getString('name');
  const it = findItem(q);
  if (!it) return notFound(i, q, suggestItems(q).map((x) => x.name), locale);

  const rows = (it.rows || []).slice().sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9)).slice(0, 6);
  const list = rows.length
    ? rows.map((r) => `\`${fmt(r.price)} aUEC\` — ${r.loc}`).join('\n')
    : t(locale, 'item.noLoc');

  const embed = new EmbedBuilder()
    .setColor(C.item)
    .setAuthor({ name: it.category || t(locale, 'item.author') })
    .setTitle(it.name)
    .addFields({ name: t(locale, 'item.whereBuy'), value: list.slice(0, 1024) })
    .setFooter({ text: t(locale, 'item.footer', { n: it.rows?.length || 0 }) });

  await i.reply({ embeds: [embed], components: [linkRow([t(locale, 'item.openFinder'), `${SITE}/item-finder.html`])] });
}

// ── /patch ────────────────────────────────────────────────────────────────────
function bullets(arr, n = 6) {
  return (arr || [])
    .map((x) => (typeof x === 'string' ? x : (x.title || x.name || x.headline || x.text)))
    .filter(Boolean)
    .slice(0, n)
    .map((t2) => `• ${t2}`)
    .join('\n');
}

/** Build a patch embed in a specific language (used by /patch and patch-watch). */
export function buildPatchEmbed(raw, locale = 'en', { image = true } = {}) {
  const p = localizedPatch(raw, locale);
  const embed = new EmbedBuilder()
    .setColor(C.patch)
    .setAuthor({ name: p.era ? t(locale, 'patch.authorEra', { era: p.era }) : t(locale, 'patch.author') })
    .setTitle(`${p.version} — ${p.codename}`)
    .setFooter({ text: t(locale, 'patch.footer') });

  if (p.dateDisplay || p.date) embed.addFields({ name: t(locale, 'patch.released'), value: String(p.dateDisplay || p.date), inline: true });
  if (p.type) embed.addFields({ name: t(locale, 'patch.type'), value: String(p.type), inline: true });
  const desc = p.summary || p.tagline;
  if (desc) embed.setDescription(String(desc).slice(0, 600));
  const facts = bullets(p.keyFacts, 6);
  if (facts) embed.addFields({ name: t(locale, 'patch.keyFacts'), value: facts.slice(0, 1024) });
  const feats = bullets(p.features, 6);
  if (feats) embed.addFields({ name: t(locale, 'patch.highlights'), value: feats.slice(0, 1024) });
  if (p.wipe) embed.addFields({ name: t(locale, 'patch.wipe'), value: String(p.wipe).slice(0, 200) });
  if (image && p.heroImage) embed.setImage(p.heroImage.startsWith('http') ? p.heroImage : `${SITE}${p.heroImage}`);
  return embed;
}

export function patchButtons(raw, locale = 'en') {
  const buttons = [[t(locale, 'patch.archive'), `${SITE}/archiv.html`]];
  if (raw.notesUrl) buttons.push([t(locale, 'patch.official'), raw.notesUrl]);
  return linkRow(...buttons);
}

async function cmdPatch(i, locale) {
  const v = i.options.getString('version');
  const p = v ? findPatch(v) : latestPatch();
  if (!p) return notFound(i, v || 'latest', allPatches().slice(0, 6).map((x) => x.version), locale);
  await i.reply({ embeds: [buildPatchEmbed(p, locale)], components: [patchButtons(p, locale)] });
}

export const dataCounts = counts;
