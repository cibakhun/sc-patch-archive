// ═══════════════════════════════════════════════════════════════════════════
//  retention.mjs — wie lange der Bot Aktivitaetsdaten ehemaliger Mitglieder
//  behaelt (XP, Nachrichten- und Sprachzaehler, Fehlerbericht-Sperren).
//
//  Austritt  -> Zeile bekommt left_at (GuildMemberRemove), faellt von der
//               Bestenliste. Wiedereintritt vor Fristende nimmt die Marke
//               zurueck (GuildMemberAdd) -- wer aus Versehen geht, verliert
//               seinen Rang nicht.
//  Frist     -> LEAVER_RETENTION_DAYS, Vorgabe 30 Tage. 0 = am naechsten
//               taeglichen Lauf loeschen.
//  Taeglich  -> 1. Abgleich mit der echten Mitgliederliste: wer waehrend
//                  einer Bot-Pause gegangen oder zurueckgekommen ist, wird
//                  nachgetragen. Haengt der Abruf, entfaellt nur dieser
//                  Schritt; markiert wird nie auf Verdacht.
//               2. Loeschen, was die Frist ueberschritten hat, samt den
//                  Fehlerbericht-Sperren dieser Nutzer. Sperren aelter als
//                  LOCK_DAYS fallen ebenfalls weg (siehe db.purgeExpired).
//  Selbstauskunft: jeder Lauf druckt, wie viele Zeilen er gesehen, markiert
//  und geloescht hat -- ein leerlaufender Lauf soll sich von einem echten
//  unterscheiden lassen.
// ═══════════════════════════════════════════════════════════════════════════
import { Events } from 'discord.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const LOCK_DAYS = 30;
const FETCH_TIMEOUT_MS = 15_000;

export function retentionDays(env = process.env) {
  const raw = (env.LEAVER_RETENTION_DAYS ?? '').trim();
  if (raw === '') return 30;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 365 ? n : 30;
}

/**
 * Gleicht die Austrittsmarken einer Gilde mit der Mitgliederliste ab.
 * Rein (kein Discord-Aufruf), damit selftest.mjs es pruefen kann.
 */
export function reconcileLeavers(db, guildId, memberIds, now = Date.now()) {
  let marked = 0, cleared = 0, seen = 0;
  for (const { user_id: u, left_at: left } of db.knownUsers(guildId)) {
    seen++;
    const present = memberIds.has(u);
    if (present && left != null) cleared += db.clearLeft(guildId, u);
    if (!present && left == null) marked += db.markLeft(guildId, u, now);
  }
  return { seen, marked, cleared };
}

export async function runRetention(ctx, now = Date.now()) {
  const days = retentionDays();
  let seen = 0, marked = 0, cleared = 0, skipped = 0;
  for (const guild of ctx.client.guilds.cache.values()) {
    let members;
    try {
      members = await Promise.race([
        guild.members.fetch(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Zeitueberschreitung')), FETCH_TIMEOUT_MS)),
      ]);
    } catch (e) {
      skipped++;
      console.warn(`  ! Datenfrist: Mitgliederabruf in ${guild.name} fehlgeschlagen (${e.message}) -- Abgleich dort ausgelassen.`);
      continue;
    }
    // Eine unvollstaendige Liste wuerde Anwesende als ausgetreten markieren.
    // Lieber einen Tag auslassen als falsch markieren.
    if (guild.memberCount && members.size < guild.memberCount * 0.9) {
      skipped++;
      console.warn(`  ! Datenfrist: nur ${members.size} von ${guild.memberCount} Mitgliedern in ${guild.name} geladen -- Abgleich dort ausgelassen.`);
      continue;
    }
    const r = reconcileLeavers(ctx.db, guild.id, new Set(members.keys()), now);
    seen += r.seen; marked += r.marked; cleared += r.cleared;
  }
  const purged = ctx.db.purgeExpired(now - days * DAY_MS, now - LOCK_DAYS * DAY_MS);
  console.log(`  · Datenfrist (${days} Tage): ${seen} Zeilen abgeglichen, ${marked} als ausgetreten markiert, ${cleared} zurueckgekehrt, ${purged.users} Ehemalige und ${purged.locks} alte Sperren geloescht${skipped ? `, ${skipped} Gilde(n) ausgelassen` : ''}.`);
}

export function registerRetention(ctx) {
  ctx.client.on(Events.GuildMemberRemove, (member) => {
    try { ctx.db.markLeft(member.guild.id, member.id); } catch (e) { console.warn(`[retention] markLeft: ${e.message}`); }
  });
  ctx.client.on(Events.GuildMemberAdd, (member) => {
    try { ctx.db.clearLeft(member.guild.id, member.id); } catch (e) { console.warn(`[retention] clearLeft: ${e.message}`); }
  });
}

export function startRetention(ctx) {
  const tick = () => runRetention(ctx).catch((e) => console.warn(`  ! Datenfrist: ${e.message}`));
  tick();
  const t = setInterval(tick, DAY_MS);
  t.unref?.();
  return t;
}
