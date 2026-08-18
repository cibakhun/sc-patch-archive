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
//  Geschrieben wird per PostgREST-PATCH auf public.discord_role_state,
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
// ═══════════════════════════════════════════════════════════════════════════
import { Events } from 'discord.js';
import * as bp from '../../blueprint.mjs';

/** Live-Rollenname aus dem Blueprint-Schluessel "tester" -- keine fest
 * eingetragene ID/Name im Quelltext, schuetzt vor Drift (dasselbe Muster
 * wie discord/tester-dry-run.mjs). */
export const TESTER_ROLE_NAME = bp.roles.find((r) => r.key === 'tester')?.name;

function hasTesterRole(member) {
  if (!TESTER_ROLE_NAME || !member?.roles?.cache) return false;
  return [...member.roles.cache.values()].some((r) => r.name === TESTER_ROLE_NAME && !r.managed);
}

/**
 * Schreibt is_tester fuer EIN Discord-Konto per PostgREST-PATCH. Gibt
 * `{ written: boolean }` zurueck -- `written: false` heisst entweder "kein
 * verknuepftes Konto getroffen" (Normalfall) oder "Fehler protokolliert,
 * verschluckt" (Netz/Supabase weg). Wird nie geworfen.
 */
export async function writeIsTester(supabase, discordUserId, isTester) {
  if (!supabase) return { written: false }; // Spiegelung inaktiv -- bereits beim Start gemeldet
  if (!discordUserId) return { written: false };

  try {
    const res = await fetch(
      `${supabase.url}/rest/v1/discord_role_state?discord_user_id=eq.${encodeURIComponent(discordUserId)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: supabase.key,
          Authorization: `Bearer ${supabase.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ is_tester: isTester, updated_at: new Date().toISOString() }),
      },
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.warn(`[role-sync] Supabase-PATCH fehlgeschlagen (${res.status}) fuer Discord-Nutzer ${discordUserId}: ${detail}`);
      return { written: false };
    }

    const rows = await res.json().catch(() => []);
    if (!rows.length) {
      // Normalfall: dieses Discord-Konto ist (noch) mit keinem verse-base.com-Konto
      // verknuepft. Kein Insert -- die Zeile entsteht erst ueber
      // sync_discord_identity() (Plan 02), wenn sich jemand per Discord anmeldet.
      console.log(`[role-sync] ${discordUserId}: kein verknuepftes Konto -- Normalfall, kein Fehler.`);
      return { written: false };
    }

    console.log(`[role-sync] ${discordUserId}: is_tester=${isTester} geschrieben.`);
    return { written: true };
  } catch (e) {
    console.warn(`[role-sync] Netzfehler beim Schreiben fuer Discord-Nutzer ${discordUserId}: ${e.message}`);
    return { written: false };
  }
}

export function registerRoleSync(ctx) {
  const { client, supabase } = ctx;

  if (!TESTER_ROLE_NAME) {
    console.warn('[role-sync] Rolle "tester" nicht im Blueprint gefunden -- Rollenspiegelung inaktiv.');
    return;
  }

  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    const before = hasTesterRole(oldMember);
    const after = hasTesterRole(newMember);
    if (before === after) return; // andere Rollenaenderung (Rang/Sprache/Ping) -- kein Tester-Wechsel
    await writeIsTester(supabase, newMember.id, after);
  });

  client.on(Events.GuildMemberAdd, async (member) => {
    // Normalfall: neue Mitglieder tragen die Rolle nicht. Nur bei
    // Wiedereintritt mit wiederhergestellter Rolle gibt es etwas zu tun --
    // ohne diesen Zweig kaeme der Zustand erst beim naechsten Start an.
    if (!hasTesterRole(member)) return;
    await writeIsTester(supabase, member.id, true);
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    // Unabhaengig vom (ggf. unvollstaendigen) zwischengespeicherten
    // Rollenstand IMMER auf false setzen -- ein Austritt darf nie einen
    // gueltigen Ausweis zuruecklassen (T-14-42).
    await writeIsTester(supabase, member.id, false);
  });
}
