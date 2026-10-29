// ═══════════════════════════════════════════════════════════════════════════
//  retention.mjs — wie lange der Bot Aktivitaetsdaten ehemaliger Mitglieder
//  behaelt (XP, Nachrichten- und Sprachzaehler, Fehlerbericht-Sperren).
//
//  Austritt  -> Zeile bekommt left_at (GuildMemberRemove), faellt von der
//               Bestenliste. Wiedereintritt vor Fristende nimmt die Marke
//               zurueck (GuildMemberAdd) -- wer aus Versehen geht, verliert
//               seinen Rang nicht.
//  Frist     -> LEAVER_RETENTION_DAYS, Vorgabe 30 Tage, hoechstens 365
//               (groessere Werte werden auf 365 gekappt). 0 = am naechsten
//               taeglichen Lauf loeschen.
//  Taeglich  -> 1. Abgleich mit der echten Mitgliederliste: wer waehrend
//                  einer Bot-Pause gegangen oder zurueckgekommen ist, wird
//                  nachgetragen. Haengt der Abruf, entfaellt dieser
//                  Schritt fuer die Gilde, und geloescht wird dort an dem
//                  Tag auch nicht: wer waehrend einer Pause zurueckkam,
//                  traegt noch seine Marke. Markiert wird nie auf Verdacht.
//                  Zeilen aus Gilden, in denen der Bot nicht mehr ist,
//                  laufen in dieselbe Frist (die Heim-Gilde nie). Kommt
//                  der Bot zurueck, nimmt er genau diese Marken wieder
//                  weg (GuildCreate und jeder taegliche Lauf), ohne die
//                  Mitgliederliste zu brauchen.
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
// meta-Schluessel je Gilde: wann markOrphanedGuilds ihre Zeilen vorgemerkt hat.
const BOT_WEG = 'bot_left_at';

export function retentionDays(env = process.env) {
  const raw = (env.LEAVER_RETENTION_DAYS ?? '').trim();
  if (raw === '') return 30;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return 30;
  return Math.min(n, 365);
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

/**
 * Zeilen aus Gilden, in denen der Bot nicht mehr ist, laufen in dieselbe
 * Frist. Die Heim-Gilde nie: fehlt sie, ist der Bot dort eher versehentlich
 * draussen oder der Zugang falsch, und ihre Raenge sollen das ueberstehen.
 * Rein (kein Discord-Aufruf), damit selftest.mjs es pruefen kann.
 */
export function markOrphanedGuilds(db, presentIds, homeId, now = Date.now()) {
  if (!presentIds.size) return 0; // in keiner Gilde: eher falscher Zugang als Abschied
  let marked = 0;
  for (const g of db.openGuilds()) {
    if (g === homeId || presentIds.has(g)) continue;
    // Ein Zeitstempel je Gilde, damit restoreGuild genau diese Marken
    // wiederfindet -- auch fuer Zeilen, die erst spaeter vorgemerkt werden.
    // Den alten nur, solange noch eine Zeile ihn traegt: nach dem Loeschen
    // bekaeme eine spaetere Abwesenheit sonst die laengst abgelaufene Frist.
    const alt = Number(db.getMeta(g, BOT_WEG));
    const ts = alt && db.knownUsers(g).some((r) => r.left_at === alt) ? alt : now;
    const n = db.markGuildLeft(g, ts);
    if (n) db.setMeta(g, BOT_WEG, ts);
    marked += n;
  }
  return marked;
}

/**
 * Der Bot ist wieder in der Gilde: nimmt die Marken von markOrphanedGuilds
 * zurueck. Wer vorher selbst gegangen ist, behaelt seine eigene Marke; wer
 * waehrend der Abwesenheit ging, traegt der naechste Abgleich nach.
 * Rein (kein Discord-Aufruf), damit selftest.mjs es pruefen kann.
 */
export function restoreGuild(db, guildId) {
  const ts = db.getMeta(guildId, BOT_WEG);
  if (ts == null) return 0;
  const n = db.clearGuildMark(guildId, Number(ts));
  db.setMeta(guildId, BOT_WEG, null);
  return n;
}

export async function runRetention(ctx, now = Date.now(), env = process.env) {
  const days = retentionDays(env);
  let seen = 0, marked = 0, cleared = 0, restored = 0;
  const ausgelassen = new Set();
  // Zuerst: Gilden, in die der Bot zurueckgekehrt ist, auch waehrend einer
  // Pause (dann feuert kein GuildCreate, die Gilde ist beim Start einfach da).
  // Vor dem Abgleich, damit der danach markiert, wer wirklich fehlt.
  const amAnfang = new Set(ctx.client.guilds.cache.keys());
  for (const id of amAnfang) restored += restoreGuild(ctx.db, id);
  for (const guild of ctx.client.guilds.cache.values()) {
    let members, timer;
    try {
      members = await Promise.race([
        guild.members.fetch(),
        new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('Zeitueberschreitung')), FETCH_TIMEOUT_MS); }),
      ]).finally(() => clearTimeout(timer));
    } catch (e) {
      ausgelassen.add(guild.id);
      console.warn(`  ! Datenfrist: Mitgliederabruf in ${guild.name} fehlgeschlagen (${e.message}) -- Abgleich dort ausgelassen.`);
      continue;
    }
    // Eine unvollstaendige Liste wuerde Anwesende als ausgetreten markieren.
    // Lieber einen Tag auslassen als falsch markieren.
    if (guild.memberCount && members.size < guild.memberCount * 0.9) {
      ausgelassen.add(guild.id);
      console.warn(`  ! Datenfrist: nur ${members.size} von ${guild.memberCount} Mitgliedern in ${guild.name} geladen -- Abgleich dort ausgelassen.`);
      continue;
    }
    const r = reconcileLeavers(ctx.db, guild.id, new Set(members.keys()), now);
    seen += r.seen; marked += r.marked; cleared += r.cleared;
  }
  // guilds.cache fuehrt nach READY jede Gilde, auch voruebergehend nicht
  // verfuegbare -- fehlt eine, wurde der Bot dort entfernt (auch waehrend
  // einer Pause, ohne GuildDelete). Wer erst waehrend dieses Laufs ging,
  // ist im naechsten dran: der Abgleich oben hat dort Austritte mit
  // demselben `now` markiert, und restoreGuild darf die nie mit zuruecknehmen.
  const orphaned = markOrphanedGuilds(ctx.db, new Set([...amAnfang, ...ctx.client.guilds.cache.keys()]), ctx.home?.id, now);
  marked += orphaned;
  const purged = ctx.db.purgeExpired(now - days * DAY_MS, now - LOCK_DAYS * DAY_MS, ausgelassen);
  console.log(`  · Datenfrist (${days} Tage): ${seen} Zeilen abgeglichen, ${marked} als ausgetreten markiert${orphaned ? ` (davon ${orphaned} aus Gilden ohne Bot)` : ''}, ${cleared} zurueckgekehrt${restored ? `, ${restored} nach Rueckkehr des Bots zurueckgeholt` : ''}, ${purged.users} Ehemalige und ${purged.locks} alte Sperren geloescht${ausgelassen.size ? `, ${ausgelassen.size} Gilde(n) ausgelassen (dort nichts geloescht)` : ''}.`);
}

export function registerRetention(ctx) {
  ctx.client.on(Events.GuildMemberRemove, (member) => {
    try { ctx.db.markLeft(member.guild.id, member.id); } catch (e) { console.warn(`[retention] markLeft: ${e.message}`); }
  });
  ctx.client.on(Events.GuildMemberAdd, (member) => {
    try { ctx.db.clearLeft(member.guild.id, member.id); } catch (e) { console.warn(`[retention] clearLeft: ${e.message}`); }
  });
  // Bot wieder aufgenommen: die Mitglieder dort sind nicht neu, also kommt
  // kein GuildMemberAdd -- die Marken aus seiner Abwesenheit hier zuruecknehmen.
  // Eine Rueckkehr waehrend eines Neuverbindens meldet discord.js als
  // GuildAvailable statt GuildCreate; ohne Marke tut restoreGuild nichts.
  const zurueck = (guild) => {
    try {
      const n = restoreGuild(ctx.db, guild.id);
      if (n) console.log(`  · Datenfrist: ${n} Zeilen in ${guild.name} zurueckgeholt (Bot wieder aufgenommen).`);
    } catch (e) { console.warn(`[retention] restoreGuild: ${e.message}`); }
  };
  ctx.client.on(Events.GuildCreate, zurueck);
  ctx.client.on(Events.GuildAvailable, zurueck);
}

export function startRetention(ctx) {
  const tick = () => runRetention(ctx).catch((e) => console.warn(`  ! Datenfrist: ${e.message}`));
  tick();
  const t = setInterval(tick, DAY_MS);
  t.unref?.();
  return t;
}
