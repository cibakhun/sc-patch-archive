// ═══════════════════════════════════════════════════════════════════════════
//  role-sync.mjs — spiegelt Mitgliedschaft in der Rolle "Test Pilots" nach
//  public.discord_role_state (D-08, D-17, D-25 — Phase 14 Plan 07).
//
//  Registriert DREI Ereignisse, nicht eines:
//    - GuildMemberUpdate — der Kern. Schreibt NUR, wenn sich die
//      Zugehoerigkeit zur Rolle "tester" tatsaechlich GEAENDERT hat. Jede
//      andere Rollenaenderung (Rang, Sprache, Ping-Abo) feuert dasselbe
//      Ereignis und darf KEINEN Schreibzugriff ausloesen.
//    - GuildMemberAdd — Wiedereintritt/Rollen-Wiederherstellung mit der
//      Rolle bereits vorhanden. Ohne diesen Zweig kaeme der Zustand erst
//      beim naechsten Bot-Start an (siehe role-reconcile.mjs).
//    - GuildMemberRemove — ein Austritt darf NIE einen gueltigen Ausweis
//      zuruecklassen. Wird IMMER auf is_tester=false gesetzt, unabhaengig
//      vom zwischengespeicherten Rollenstand des ausgetretenen Mitglieds.
//
//  Ausdruecklich KEIN Slash-Befehl als Vergabeweg (D-17) -- die Rolle darf
//  auf beliebigem Weg vergeben werden (Rechtsklick genuegt), die
//  Folgehandlungen haengen am Ereignis, nicht an einem exklusiven Befehl.
//
//  Geschrieben wird ueber site-db.mjs (setTester) auf public.discord_role_state,
//  gefiltert auf discord_user_id -- NUR is_tester und updated_at. user_id,
//  discord_user_id und last_staging_seen setzt der Trigger aus Plan 02
//  (sync_discord_identity) bzw. das Torurteil (gate_verdict). Trifft der
//  PATCH keine Zeile (Discord-Konto noch nicht mit der Website verknuepft),
//  ist das der NORMALFALL, kein Fehler -- protokolliert und weiter, exakt
//  die Regel aus patch-watch.mjs: nie als erledigt verbuchen, was nicht
//  geschehen ist, aber auch nicht daran scheitern.
//
//  Jeder Netzfehler wird protokolliert und verschluckt -- ein Supabase-
//  Ausfall darf den Bot nicht in eine Absturzschleife schicken. Der Bot
//  verliert dann nur die Fortschreibung; role-reconcile.mjs holt sie beim
//  naechsten Start nach (D-25).
//
//  NUR die Heim-Gilde zaehlt (home-guild.mjs): jedes Ereignis aus einer
//  anderen Gilde wird verworfen, bevor irgendetwas geschrieben wird, und die
//  Rolle wird ueber ihre ID verglichen, nicht ueber ihren Namen. Nur solange
//  keine ID festgehalten ist, entzieht der Name -- vergeben wird darueber nie.
// ═══════════════════════════════════════════════════════════════════════════
import { Events } from 'discord.js';
import * as bp from '../../blueprint.mjs';
import { isHomeGuild } from './home-guild.mjs';

/** Rollenname aus dem Blueprint-Schluessel "tester" -- nur noch fuer das
 * einmalige Auffinden der Rolle beim Start (home-guild.mjs), danach zaehlt
 * allein die ID. Schuetzt vor Drift zwischen Bot und discord/build.mjs. */
export const TESTER_ROLE_NAME = bp.roles.find((r) => r.key === 'tester')?.name;

/** Traegt das Mitglied die Testpilot-Rolle der Heim-Gilde? Ohne bekannte
 * Rollen-ID ist die Antwort immer nein -- der Aufrufer schreibt dann nichts. */
export function hasTesterRole(member, roleId) {
  if (!roleId || !member?.roles?.cache) return false;
  return member.roles.cache.has(roleId);
}

/** Traegt das Mitglied irgendeine Rolle mit dem Testpilot-Namen? Nur fuer
 * den Entzug, solange keine Rollen-ID festgehalten ist -- vergeben wird
 * darueber nie. */
function holdsTesterName(member) {
  if (!TESTER_ROLE_NAME || !member?.roles?.cache) return false;
  return [...member.roles.cache.values()].some((r) => r.name === TESTER_ROLE_NAME && !r.managed);
}

/** Darf ein Ereignis dieses Mitglieds den Spiegel beruehren? */
function mirrorable(ctx, member) {
  return !!ctx.mirror?.roleId && isHomeGuild(ctx, member?.guild);
}

/**
 * Schreibt is_tester fuer EIN Discord-Konto. Gibt `{ written: boolean }`
 * zurueck -- `written: false` heisst entweder "kein verknuepftes Konto
 * getroffen" (Normalfall) oder "Fehler protokolliert, verschluckt"
 * (Netz/Supabase weg). Wird nie geworfen.
 */
export async function writeIsTester(siteDb, discordUserId, isTester) {
  if (!siteDb) return { written: false }; // Spiegelung inaktiv -- bereits beim Start gemeldet
  if (!discordUserId) return { written: false };

  try {
    const { updated } = await siteDb.setTester(discordUserId, isTester);
    if (!updated) {
      // Normalfall: dieses Discord-Konto ist (noch) mit keinem verse-base.com-Konto
      // verknuepft. Kein Insert -- die Zeile entsteht erst ueber
      // sync_discord_identity() (Plan 02), wenn sich jemand per Discord anmeldet.
      console.log(`[role-sync] ${discordUserId}: kein verknuepftes Konto -- Normalfall, kein Fehler.`);
      return { written: false };
    }
    console.log(`[role-sync] ${discordUserId}: is_tester=${isTester} geschrieben.`);
    return { written: true };
  } catch (e) {
    console.warn(`[role-sync] Schreiben fuer Discord-Nutzer ${discordUserId} fehlgeschlagen: ${e.message}`);
    return { written: false };
  }
}

export function registerRoleSync(ctx) {
  const { client } = ctx;

  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    if (!isHomeGuild(ctx, newMember?.guild)) return; // fremde Gilde
    if (!ctx.mirror?.roleId) {
      // Spiegel aus (Rolle doppelt, falsche ID): nie vergeben, aber Entzug
      // wirkt -- wer die letzte Rolle mit dem Testpilot-Namen verliert, kann
      // kein Testpilot mehr sein. Wie bei GuildMemberRemove unten.
      if (holdsTesterName(oldMember) && !holdsTesterName(newMember)) await writeIsTester(ctx.siteDb, newMember.id, false);
      return;
    }
    const before = hasTesterRole(oldMember, ctx.mirror.roleId);
    const after = hasTesterRole(newMember, ctx.mirror.roleId);
    if (before === after) return; // andere Rollenaenderung (Rang/Sprache/Ping) -- kein Tester-Wechsel
    await writeIsTester(ctx.siteDb, newMember.id, after);
  });

  client.on(Events.GuildMemberAdd, async (member) => {
    // Normalfall: neue Mitglieder tragen die Rolle nicht. Nur bei
    // Wiedereintritt mit wiederhergestellter Rolle gibt es etwas zu tun --
    // ohne diesen Zweig kaeme der Zustand erst beim naechsten Start an.
    if (!mirrorable(ctx, member)) return;
    if (!hasTesterRole(member, ctx.mirror.roleId)) return;
    await writeIsTester(ctx.siteDb, member.id, true);
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    // Unabhaengig vom (ggf. unvollstaendigen) zwischengespeicherten
    // Rollenstand IMMER auf false setzen -- ein Austritt aus der HEIM-Gilde
    // darf nie einen gueltigen Ausweis zuruecklassen (T-14-42). Ein Austritt
    // aus einer fremden Gilde aendert nichts. Bewusst OHNE Rollen-ID: auch
    // wenn der Spiegel gerade aus ist (Rolle doppelt, falsche ID), muss der
    // Entzug wirken -- false zu schreiben ist hier immer richtig.
    if (!isHomeGuild(ctx, member?.guild)) return;
    await writeIsTester(ctx.siteDb, member.id, false);
  });
}
