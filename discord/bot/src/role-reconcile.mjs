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

// ═══════════════════════════════════════════════════════════════════════════
//  Periodischer Nachlauf (CR-01, Code-Review 18.08.2026 der Phase 14).
//
//  Luecke, die der einmalige Start-Vollabgleich oben NICHT schliesst: ein
//  Discord-Mitglied bekommt die Rolle "Test Pilots" -- role-sync.mjs feuert
//  GuildMemberUpdate, aber der PATCH auf discord_role_state trifft NULL
//  Zeilen, weil dieses Discord-Konto noch nie mit einem verse-base.com-Konto
//  verknuepft wurde (Normalfall, siehe role-sync.mjs). Verknuepft sich dieser
//  Nutzer DANACH zum ersten Mal (dem von D-01 favorisierten Weg folgend),
//  legt sync_discord_identity() (Migration 20260818000000) die Zeile NEU an
//  -- is_tester bekommt dabei den Tabellen-Default `false`, weil eine reine
//  SQL-Funktion Discord nicht fragen kann, ob die Rolle tatsaechlich vorliegt.
//  Ohne einen weiteren Nachlauf bliebe dieser (fuer D-01 der NORMALFALL, kein
//  Randfall) Nutzer bis zum naechsten Bot-Neustart faelschlich ausgesperrt.
//
//  ⚠ D-08 ("ein Rollenentzug wirkt sofort beim naechsten Aufruf") bleibt
//  UNVERAENDERT der GuildMemberUpdate-Pfad in role-sync.mjs -- der schreibt
//  weiterhin in Millisekunden, sobald ein Konto einmal verknuepft ist.
//  Dieser periodische Pass schliesst NUR die Erstverknuepfungs-Luecke oben;
//  er ist eine ZUSAETZLICHE Reparatur, kein Ersatz fuer den Ereignis-Pfad --
//  wer den Ereignis-Pfad spaeter zugunsten dieses Passes "wegoptimiert",
//  verletzt D-08 (Entzug wuerde dann erst nach bis zu INTERVALL_MS wirken).
//
//  INTERVALL_MS: 2 Minuten. Der Server traegt ~5 Mitglieder -- ein GET auf
//  discord_role_state plus hoechstens eine Handvoll PATCHes je Durchlauf
//  sind kein spuerbarer Aufwand (dieselbe reconcileRoles()-Funktion wie beim
//  Start, kein zweiter Code-Pfad). Kurz genug, dass "Rolle geben, dann
//  verknuepfen" fuer einen Menschen wie ein kurzes Warten wirkt.
const INTERVALL_MS = 2 * 60 * 1000;
let laeuftBereits = false;

/**
 * Startet den periodischen Nachlauf fuer ALLE Gilden des Clients. Der erste
 * Tick feuert erst NACH einem vollen Intervall -- der Start-Vollabgleich in
 * ClientReady (index.mjs) ist gerade erst gelaufen; ein sofortiger zweiter
 * Durchlauf waere ein Abgleich-Sturm beim Boot ohne Nutzen. `laeuftBereits`
 * verhindert, dass ein langsamer Durchlauf sich selbst ueberholt, falls
 * INTERVALL_MS je kuerzer als eine reale Laufzeit wird.
 */
export function startPeriodicReconcile(ctx) {
  setInterval(async () => {
    if (laeuftBereits) {
      console.warn('  ! periodischer Rollenabgleich uebersprungen -- vorheriger Durchlauf laeuft noch.');
      return;
    }
    laeuftBereits = true;
    try {
      for (const guild of ctx.client.guilds.cache.values()) {
        try { await reconcileRoles(ctx, guild); }
        catch (e) { console.warn(`  ! periodischer Rollenabgleich in ${guild.name}: ${e.message}`); }
      }
    } finally {
      laeuftBereits = false;
    }
  }, INTERVALL_MS);
}
