// ═══════════════════════════════════════════════════════════════════════════
//  chat-notify.mjs — Privatnachricht, wenn auf verse-base.com eine Chat-
//  Nachricht ungelesen liegen bleibt (Konto, „Freunde & Social“, Schalter
//  „Discord-Nachricht bei neuen Nachrichten“).
//
//  Jede Minute: site-db.chatDue() liefert je Paar (Empfaenger, Absender)
//  hoechstens einen faelligen Hinweis. Die Datenbank entscheidet, wer will,
//  wer Discord verbunden hat, wer gerade nicht auf der Seite ist und dass ein
//  Paar hoechstens alle 30 Minuten einen Hinweis bekommt (Migration
//  20261124100000). Je Zeile eine DM, danach chatSent() mit den msg_id.
//  Als gemeldet gilt auch, wer keine DMs annimmt oder Discord nicht mehr
//  kennt (50007, 10013). Jeder andere Fehler laesst den Hinweis offen.
//
//  Der Bot sieht dabei nur discord_user_id, Sprache, Name und Handle des
//  Absenders und die Zahl der Nachrichten, nie eine Konto-ID und nie den
//  Text. Ohne Website-Zugang (siteDb null) inaktiv. Solange die Datenbank
//  oder die Function den Weg noch nicht kennt, scheitert jeder Lauf gleich:
//  das steht einmal im Protokoll, nicht jede Minute.
// ═══════════════════════════════════════════════════════════════════════════
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, escapeMarkdown } from 'discord.js';
import { t } from './i18n.mjs';
import { SITE } from './data.mjs';

const INTERVALL_MS = 60 * 1000;
const COLOR = 0x2dd4ff; // Akzent der Freundesleiste auf der Kontoseite
const GIVE_UP = new Set([50007, 10013]); // Cannot send messages to this user / Unknown User
const HANDLE_RE = /^[a-z0-9_]{3,24}$/;

const clip = (s, n) => {
  const v = String(s ?? '').trim();
  return v.length > n ? v.slice(0, n - 1) + '…' : v;
};

/** Die Nachricht zu einer Zeile aus chat_discord_due. Rein, selftest prueft sie. */
export function chatMessage(row) {
  const lang = row.lang === 'de' ? 'de' : 'en';
  const handle = HANDLE_RE.test(String(row.sender_handle ?? '')) ? row.sender_handle : '';
  // Der Link oeffnet den Chat mit diesem Freund (?chat=@handle); ohne Handle
  // die Freundesliste.
  const url = `${SITE}${lang === 'de' ? '/de' : ''}/account.html${handle ? '?chat=%40' + handle : ''}#friends`;
  const name = escapeMarkdown(clip(row.sender_name || (handle ? '@' + handle : '?'), 40));
  const n = Number.isSafeInteger(row.unread) && row.unread > 1 ? row.unread : 1;
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(t(lang, 'dm.chatTitle'))
    .setDescription(n > 1 ? t(lang, 'dm.chatBodyN', { name, n }) : t(lang, 'dm.chatBody', { name }))
    .setURL(url)
    .setFooter({ text: t(lang, 'dm.chatFooter') });
  const last = Date.parse(row.last_at);
  if (Number.isFinite(last)) embed.setTimestamp(last);
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(t(lang, 'dm.chatOpen')).setURL(url),
  );
  return { embeds: [embed], components: [row1] };
}

// Erledigt, aber noch nicht als gemeldet bestaetigt. Jeder Lauf holt das
// zuerst nach und fragt erst danach neu: kaeme fuer dasselbe Paar inzwischen
// eine neuere Nachricht dazu, haette sie eine andere ID, und ohne Vermerk in
// der Datenbank ginge vor Ablauf der 30 Minuten eine zweite DM hinaus.
const unbestaetigt = new Set();
let letzterFehler = '';

/** Ein Lauf. Gibt die Zahl gesendeter DMs zurueck. Wirft nie. */
export async function notifyChat(ctx, { log = console.warn } = {}) {
  const { siteDb, client } = ctx;
  if (!siteDb?.chatDue) return 0;
  if (unbestaetigt.size) {
    const offen = [...unbestaetigt];
    try {
      for (let i = 0; i < offen.length; i += 100) await siteDb.chatSent(offen.slice(i, i + 100));
      unbestaetigt.clear();
    } catch (e) {
      log(`  ! Chat-DMs: ${offen.length} Hinweise noch nicht als gemeldet bestaetigt, kein neuer Versand: ${e.message}`);
      return 0;
    }
  }
  let rows;
  try { rows = await siteDb.chatDue(); }
  catch (e) {
    if (e.message !== letzterFehler) log(`  ! Chat-DMs: Lesen fehlgeschlagen (weitere gleiche Fehler still): ${e.message}`);
    letzterFehler = e.message;
    return 0;
  }
  letzterFehler = '';
  if (!rows.length) return 0;

  const done = [];
  let sent = 0;
  for (const row of rows) {
    try {
      const user = await client.users.fetch(row.discord_user_id);
      await user.send(chatMessage(row));
      done.push(row.msg_id);
      sent += 1;
    } catch (e) {
      if (GIVE_UP.has(e?.code)) done.push(row.msg_id);
      else log(`  ! Chat-DM fuer Nachricht ${row.msg_id}: ${e.message}`);
    }
  }
  if (done.length) {
    try { await siteDb.chatSent(done); }
    catch (e) {
      for (const id of done) unbestaetigt.add(id);
      log(`  ! Chat-DMs: Markieren fehlgeschlagen (${done.length} Hinweise, der naechste Lauf bestaetigt sie zuerst): ${e.message}`);
    }
  }
  console.log(`  · Chat-DMs: ${rows.length} faellig, ${sent} gesendet, ${done.length - sent} ohne neue DM als gemeldet markiert.`);
  return sent;
}

let laeuft = false;

export function startChatNotify(ctx) {
  if (!ctx.siteDb) return;
  const tick = async () => {
    if (laeuft) return;
    laeuft = true;
    try { await notifyChat(ctx); } finally { laeuft = false; }
  };
  tick();
  setInterval(tick, INTERVALL_MS);
}
