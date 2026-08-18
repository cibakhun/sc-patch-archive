// ═══════════════════════════════════════════════════════════════════════════
//  role-reconcile.mjs — Vollabgleich des Rollenspiegels beim Bot-Start
//  (D-25 — Phase 14 Plan 07).
//
//  Laeuft EINMAL in der ClientReady-Sequenz, neben roles.ensure(guild), und
//  danach NICHT wieder. Er ist die Reparatur fuer die Luecke, die jeder
//  Bot-Ausfall hinterlaesst: Rollenwechsel waehrend der Abwesenheit kennt
//  kein Ereignis mehr (role-sync.mjs feuert nur, waehrend der Bot laeuft).
//
//  Ablauf: alle Mitglieder der Gilde laden (guild.members.fetch(), jetzt mit
//  dem GuildMembers-Intent moeglich -- mit demselben Zeitgeber-Wettlauf wie
//  discord/prune.mjs:149-165, damit ein haengender Abruf den Start nicht
//  blockiert), die Traeger der Rolle "tester" als Menge bilden, den
//  aktuellen Stand aus public.discord_role_state lesen und die Differenz in
//  BEIDE Richtungen schreiben:
//    - traegt die Rolle, Spiegel sagt false -> true
//    - Spiegel sagt true, Rolle fehlt        -> false
//  Eine einseitige Angleichung liesse genau die gefaehrliche Richtung offen
//  -- einen gueltigen Ausweis ohne Rolle (T-14-42).
//
//  Scheitert der Abgleich (Supabase weg, Mitgliederabruf haengt), wird er
//  protokolliert und uebersprungen; der Bot startet trotzdem. Er ist eine
//  Reparatur, keine Startbedingung (T-14-46).
// ═══════════════════════════════════════════════════════════════════════════
import { TESTER_ROLE_NAME, writeIsTester } from './role-sync.mjs';

const FETCH_TIMEOUT_MS = 10_000;

async function fetchMirrorRows(supabase) {
  const res = await fetch(
    `${supabase.url}/rest/v1/discord_role_state?select=discord_user_id,is_tester&discord_user_id=not.is.null`,
    {
      headers: {
        apikey: supabase.key,
        Authorization: `Bearer ${supabase.key}`,
      },
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Supabase-GET fehlgeschlagen (${res.status}): ${detail}`);
  }
  return res.json();
}

/**
 * Vollabgleich fuer EINE Gilde. Wirft nie -- jeder Fehlerfall wird
 * protokolliert und die Funktion kehrt zurueck, damit die ClientReady-
 * Sequenz unbeeintraechtigt weiterlaeuft.
 */
export async function reconcileRoles(ctx, guild) {
  const { supabase } = ctx;

  if (!supabase) {
    console.log('  · Rollenabgleich uebersprungen -- SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY fehlen, Spiegelung inaktiv.');
    return;
  }
  if (!TESTER_ROLE_NAME) {
    console.warn('  ! Rollenabgleich uebersprungen -- Rolle "tester" nicht im Blueprint gefunden.');
    return;
  }

  const role = guild.roles.cache.find((r) => r.name === TESTER_ROLE_NAME && !r.managed);
  if (!role) {
    console.warn(`  ! Rollenabgleich uebersprungen -- Rolle "${TESTER_ROLE_NAME}" existiert nicht auf ${guild.name}.`);
    return;
  }

  let members;
  try {
    members = await Promise.race([
      guild.members.fetch(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Zeitueberschreitung nach 10s')), FETCH_TIMEOUT_MS)),
    ]);
  } catch (e) {
    console.warn(`  ! Rollenabgleich uebersprungen -- Mitgliederabruf in ${guild.name}: ${e.message}`);
    return;
  }

  const holderIds = new Set(
    [...members.values()].filter((m) => m.roles.cache.has(role.id)).map((m) => m.id),
  );

  let mirrorRows;
  try {
    mirrorRows = await fetchMirrorRows(supabase);
  } catch (e) {
    console.warn(`  ! Rollenabgleich uebersprungen -- Spiegel-Lesezugriff: ${e.message}`);
    return;
  }

  let changes = 0;
  for (const row of mirrorRows) {
    const shouldBeTester = holderIds.has(row.discord_user_id);
    if (shouldBeTester === row.is_tester) continue; // bereits deckungsgleich
    const { written } = await writeIsTester(supabase, row.discord_user_id, shouldBeTester);
    if (written) changes += 1;
  }

  // Selbstauskunft -- ohne diese Zeile ist ein leerlaufender Abgleich von
  // einem echten nicht zu unterscheiden (dieselbe Regel wie fuer die
  // Schienen-A-Tore der Website, CLAUDE.md § 4).
  console.log(`  · Rollenabgleich: ${members.size} Mitglieder gelesen, ${holderIds.size} Traeger, ${changes} Aenderungen geschrieben.`);
}
