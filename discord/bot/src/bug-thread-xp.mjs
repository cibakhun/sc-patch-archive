// ═══════════════════════════════════════════════════════════════════════════
//  bug-thread-xp.mjs — XP-Bonus fuer jeden Fehlerbericht-Thread in
//  #bug-reports, GENAU EINMAL (D-21, Phase 14 Plan 11).
//
//  Ein Forumsbeitrag in Discord IST ein Thread -- Events.ThreadCreate feuert
//  also genau einmal je Fehlerbericht, unabhaengig davon, wie viele
//  Nachrichten danach im selben Thread geschrieben werden. Deshalb haengt
//  der Bonus am THREAD, nicht an der Nachricht -- Geplauder im Thread bringt
//  kein zusaetzliches XP, der Bonus ist damit nicht durch Vielschreiben zu
//  erschleichen (D-21).
//
//  Bonusbetrag: 50 XP. Herleitung aus der bestehenden Skala in config.mjs/
//  leveling.mjs -- eine Zahl ohne Begruendung ist die naechste, die jemand
//  grundlos aendert:
//    - eine gewoehnliche Nachricht bringt 15-25 XP (config.mjs text.min/max)
//      -- 50 ist spuerbar mehr (2-3x), ohne die Skala zu sprengen
//    - Level 0 -> 1 braucht 100 XP (leveling.mjs xpToNext(0)) -- 50 ist genau
//      die Haelfte, also deutlich weniger als eine Stufe, kein geschenkter
//      Aufstieg allein durch einen Fehlerbericht
//
//  Ausdruecklich NICHT gebaut (D-21, mit Begruendung im Kontext verworfen):
//    - ein dauerhafter XP-Multiplikator fuer die Rolle "tester" -- das
//      belohnte Anwesenheit (die Rolle TRAGEN) statt Arbeit (einen Fehler
//      MELDEN)
//    - eine einmalige XP-Gutschrift bei der Ernennung zum Testpiloten -- sie
//      waere danach wirkungslos und belohnte den Moment der Ernennung statt
//      der wiederholten Handlung, um die es D-21 tatsaechlich geht
//
//  Der Bonus haengt NICHT an der Rolle "tester" -- wer einen Fehler meldet,
//  bekommt ihn, unabhaengig davon, ob er die Testpilot-Rolle traegt. Das ist
//  der Perk, WEGEN dem man die Rolle bekommen KANN, nicht einer, den man
//  DAFUER braucht. D-21 nennt keine Rollenbedingung; eine hinzuerfundene
//  waere eine stille Verschaerfung.
//
//  Sperre gegen doppelte Vergabe: bug_xp_threads(thread_id PRIMARY KEY) in
//  db.mjs. Der Primaerschluessel IST die Sperre -- ein zweiter Versuch fuer
//  denselben Thread ist kein Sonderfall im Code, sondern eine Zusicherung
//  der Datenbank. grantXp() laeuft VOR dem Eintrag in bug_xp_threads, damit
//  ein Fehlschlag beim Vergeben nicht als vergeben verbucht wird -- dieselbe
//  Regel wie in patch-watch.mjs: nie als erledigt verbuchen, was nicht
//  geschehen ist.
// ═══════════════════════════════════════════════════════════════════════════
import { Events } from 'discord.js';
import { grantXp } from './award.mjs';

const BUG_XP_AMOUNT = 50;

/** Elternkanal ueber das Namensmuster gefunden, nicht ueber eine fest
 * eingetragene ID -- dasselbe Vorgehen wie patch-watch.mjs beim
 * Patch-Kanal (`/patch-notes/i`). */
const isBugReportsThread = (thread) => /bug-reports/i.test(thread.parent?.name || '');

async function grantBugThreadXp(ctx, thread, owner) {
  await grantXp(ctx, {
    member: owner,
    guild: thread.guild,
    amount: BUG_XP_AMOUNT,
    stats: { bugReports: 1 },
    currentChannel: thread,
  });
  // ERST NACH dem Vergeben eintragen -- ein Fehlschlag oben darf nie als
  // vergeben verbucht werden.
  ctx.db.markBugXp(thread.id, thread.guildId, owner.id);
  console.log(`[bug-thread-xp] ${BUG_XP_AMOUNT} XP an ${owner.id} fuer Thread "${thread.name}" (${thread.id}).`);
}

export function registerBugThreadXp(ctx) {
  const { client, db } = ctx;

  client.on(Events.ThreadCreate, async (thread, newlyCreated) => {
    try {
      // 1. Elternkanal ist das Forum bug-reports.
      if (!isBugReportsThread(thread)) return;

      // 2. Nur ein WIRKLICH neuer Thread -- sonst wuerde ein Bot-Neustart
      // (der bestehende Threads aus dem Cache nachlaedt) alte Threads
      // erneut belohnen.
      if (!newlyCreated) return;

      // 3. Der Ersteller ist ein Mensch, kein Bot.
      const ownerId = thread.ownerId;
      if (!ownerId) return;
      const owner = await thread.guild.members.fetch(ownerId).catch(() => null);
      if (!owner || owner.user.bot) return;

      // 4. Noch nichts fuer diese Thread-ID vergeben. Diese Pruefung ist nur
      // die fruehe Abkuerzung -- der Primaerschluessel in bug_xp_threads
      // (db.mjs) ist die eigentliche Sperre.
      if (db.hasBugXp(thread.id)) return;

      await grantBugThreadXp(ctx, thread, owner);
    } catch (e) {
      console.warn(`[bug-thread-xp] Fehler bei Thread ${thread?.id}: ${e.message}`);
    }
  });
}
