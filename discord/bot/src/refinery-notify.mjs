// ═══════════════════════════════════════════════════════════════════════════
//  refinery-notify.mjs — Privatnachricht, wenn ein Raffinerie-Auftrag fertig
//  ist (Refinery-Tracker auf verse-base.com, Schalter "Discord").
//
//  Jede Minute: site-db.refineryDue() liefert die faelligen Auftraege (die
//  Datenbank entscheidet, wer will und wer Discord verbunden hat, siehe
//  Migration 20261030180000). Je Auftrag eine DM, danach refinerySent() mit
//  den IDs. Als gemeldet gilt auch, wer keine DMs annimmt oder Discord nicht
//  mehr kennt (50007, 10013): sonst kaeme derselbe Auftrag jede Minute
//  wieder. Jeder andere Fehler laesst den Auftrag offen, der naechste Lauf
//  versucht es erneut; nach 24 Stunden faellt er aus der Liste.
//
//  Der Bot sieht dabei nur discord_user_id, Station, Methode, Erze und die
//  Sprache, nie die Konto-ID. Ohne Website-Zugang (siteDb null) inaktiv.
// ═══════════════════════════════════════════════════════════════════════════
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, escapeMarkdown } from 'discord.js';
import { t } from './i18n.mjs';
import { SITE } from './data.mjs';

const INTERVALL_MS = 60 * 1000;
const COLOR = 0xe6b25c; // Gold der Refinery-Kachel auf der Kontoseite
const GIVE_UP = new Set([50007, 10013]); // Cannot send messages to this user / Unknown User

const clip = (s, n) => {
  const v = String(s ?? '').trim();
  return v.length > n ? v.slice(0, n - 1) + '…' : v;
};
const plain = (s, n) => escapeMarkdown(clip(s, n));

/** Die Nachricht zu einer Zeile aus refinery_discord_due. Rein, selftest prueft sie. */
export function refineryMessage(row) {
  const lang = row.lang === 'de' ? 'de' : 'en';
  const url = `${SITE}${lang === 'de' ? '/de' : ''}/refinery.html#tracker`;
  const items = Array.isArray(row.items) ? row.items.slice(0, 10) : [];
  const fmt = (n) => Number(n).toLocaleString(lang === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 2 });
  const ores = items
    .filter((it) => it && typeof it.ore === 'string')
    .map((it) => {
      const scu = Number(it.yieldScu) > 0 ? it.yieldScu : it.rawScu;
      return Number.isFinite(Number(scu)) && Number(scu) > 0 ? `${plain(it.ore, 40)} · ${fmt(scu)} SCU` : plain(it.ore, 40);
    });
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(t(lang, 'dm.refineryTitle'))
    .setDescription(t(lang, 'dm.refineryBody', { station: plain(row.station, 80), method: plain(row.method, 60) }))
    .setURL(url)
    .setFooter({ text: t(lang, 'dm.refineryFooter') });
  if (ores.length) embed.addFields({ name: t(lang, 'dm.refineryOres'), value: ores.join('\n').slice(0, 1024) });
  const ready = Date.parse(row.ready_at);
  if (Number.isFinite(ready)) embed.setTimestamp(ready);
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(t(lang, 'dm.refineryOpen')).setURL(url),
  );
  return { embeds: [embed], components: [row1] };
}

// Gesendet, aber noch nicht als gemeldet bestaetigt: scheitert das Markieren,
// bekommt niemand dieselbe DM jede Minute, solange der Prozess laeuft.
const unbestaetigt = new Set();

/** Ein Lauf. Gibt die Zahl gesendeter DMs zurueck. Wirft nie. */
export async function notifyRefinery(ctx, { log = console.warn } = {}) {
  const { siteDb, client } = ctx;
  if (!siteDb?.refineryDue) return 0;
  let rows;
  try { rows = await siteDb.refineryDue(); }
  catch (e) { log(`  ! Raffinerie-DMs: Lesen fehlgeschlagen: ${e.message}`); return 0; }
  if (!rows.length) return 0;

  const done = [];
  let sent = 0;
  for (const row of rows) {
    if (unbestaetigt.has(row.job_id)) { done.push(row.job_id); continue; }
    try {
      const user = await client.users.fetch(row.discord_user_id);
      await user.send(refineryMessage(row));
      done.push(row.job_id);
      unbestaetigt.add(row.job_id);
      sent += 1;
    } catch (e) {
      if (GIVE_UP.has(e?.code)) done.push(row.job_id);
      else log(`  ! Raffinerie-DM fuer Auftrag ${row.job_id}: ${e.message}`);
    }
  }
  if (done.length) {
    try { await siteDb.refinerySent(done); for (const id of done) unbestaetigt.delete(id); }
    catch (e) { log(`  ! Raffinerie-DMs: Markieren fehlgeschlagen (${done.length} Auftraege gehen beim naechsten Lauf erneut raus): ${e.message}`); }
  }
  console.log(`  · Raffinerie-DMs: ${rows.length} faellig, ${sent} gesendet, ${done.length - sent} ohne neue DM als gemeldet markiert.`);
  return sent;
}

let laeuft = false;

export function startRefineryNotify(ctx) {
  if (!ctx.siteDb) return;
  const tick = async () => {
    if (laeuft) return;
    laeuft = true;
    try { await notifyRefinery(ctx); } finally { laeuft = false; }
  };
  tick();
  setInterval(tick, INTERVALL_MS);
}
