// ═══════════════════════════════════════════════════════════════════════════
//  rank-sync.mjs — spiegelt Level, Rang und XP der Mitglieder, die Discord mit
//  ihrem VerseBase-Konto verbunden haben, nach public.discord_role_state
//  (Kontoseite, 29.10.2026). Die Kontoseite zeigt daraus Rang und
//  Fortschritt, die Pilotenseite und die Freundesliste Level und Rang.
//
//  Gleiches Muster wie role-sync.mjs / role-reconcile.mjs:
//    - Gelesen wird nur, wer in discord_role_state steht (verbunden hat).
//      Alle anderen Mitglieder verlassen den Bot nie.
//    - Geschrieben wird ueber site-db.mjs (setStats) per discord_user_id,
//      NUR wenn sich etwas geaendert hat -- ein ruhiger Server erzeugt
//      keine Writes.
//    - NUR die Heim-Gilde (home-guild.mjs): jeder weitere Server schriebe
//      sonst seine eigenen Zahlen in dieselbe Zeile.
//    - Jeder Netzfehler wird protokolliert und verschluckt; der naechste
//      Durchlauf holt nach. Der Bot laeuft ohne Supabase unveraendert.
//
//  Zeitpunkte: einmal beim Start, dann alle 5 Minuten, und sofort fuer ein
//  Mitglied, das gerade aufgestiegen ist (award.mjs -> pushRank).
// ═══════════════════════════════════════════════════════════════════════════
import { levelForXp } from './leveling.mjs';
import { rankForLevel } from './ranks.mjs';
import { isHomeGuild } from './home-guild.mjs';
import { STATS_FIELDS as FIELDS } from './site-db.mjs';

/**
 * Der Stand eines Mitglieds, wie er in discord_role_state steht. Rein --
 * kein Netz, nur die lokale Datenbank (selftest.mjs prueft das).
 * `inGuild` = true/false, oder null, wenn unbekannt (dann zaehlt nur XP).
 */
export function rankSnapshot(db, guildId, discordId, inGuild) {
  const row = db.getUser(guildId, discordId);
  const level = levelForXp(row.xp);
  return {
    in_guild: inGuild,
    level,
    xp: row.xp,
    total_xp: row.total_xp,
    prestige: row.prestige,
    rank_key: rankForLevel(level).key,
    messages: row.messages,
    voice_seconds: row.voice_seconds,
    server_rank: db.position(guildId, discordId),   // null ohne eigene Zeile
    server_members: db.count(guildId),
  };
}

/** Welche Felder sich gegenueber der gespeicherten Zeile geaendert haben. */
export function changedFields(stored, snap) {
  const out = {};
  for (const k of FIELDS) {
    if (snap[k] === null && k === 'in_guild') continue; // unbekannt: nicht ueberschreiben
    const a = stored?.[k] ?? null;
    const b = snap[k] ?? null;
    if (String(a) !== String(b)) out[k] = b;
  }
  return out;
}

/** true/false, ob die ID Mitglied ist; null, wenn Discord gerade nicht antwortet. */
async function memberState(guild, id) {
  if (guild.members.cache.has(id)) return true;
  try {
    await guild.members.fetch(id);
    return true;
  } catch (e) {
    return e?.code === 10007 || e?.code === 10013 ? false : null; // Unknown Member / Unknown User
  }
}

/**
 * Abgleich fuer eine Gilde. `onlyId` begrenzt auf ein Mitglied (nach einem
 * Aufstieg). Wirft nie.
 */
export async function syncRanks(ctx, guild, onlyId = null) {
  const { siteDb, db } = ctx;
  if (!siteDb || !isHomeGuild(ctx, guild)) return;
  let rows;
  try { rows = await siteDb.listLinked(onlyId ? { discordUserId: onlyId } : {}); }
  catch (e) { console.warn(`  ! Rangspiegel: Lesen fehlgeschlagen: ${e.message}`); return; }

  let written = 0;
  for (const stored of rows) {
    const id = stored.discord_user_id;
    if (!id) continue;
    const snap = rankSnapshot(db, guild.id, id, await memberState(guild, id));
    const patch = changedFields(stored, snap);
    if (!Object.keys(patch).length) continue;
    try { const { updated } = await siteDb.setStats(id, patch); if (updated) written += 1; }
    catch (e) { console.warn(`  ! Rangspiegel: Schreiben fuer ${id} fehlgeschlagen: ${e.message}`); }
  }
  // Selbstauskunft: ohne diese Zeile sieht ein leerlaufender Spiegel aus wie ein echter.
  if (!onlyId) console.log(`  · Rangspiegel ${guild.name}: ${rows.length} verbundene Konten gelesen, ${written} geschrieben.`);
}

/** Sofort-Abgleich fuer ein Mitglied (nach Level-Aufstieg). Wirft nie. */
export function pushRank(ctx, guild, discordId) {
  if (!isHomeGuild(ctx, guild)) return;
  syncRanks(ctx, guild, discordId).catch(() => {});
}

const INTERVALL_MS = 5 * 60 * 1000;
let laeuft = false;

export function startRankSync(ctx) {
  if (!ctx.siteDb) return;
  const tick = async () => {
    if (laeuft) return;
    laeuft = true;
    try {
      // Ein Bot, ein Server: nur die Heim-Gilde.
      const guild = ctx.client.guilds.cache.get(ctx.home?.id);
      if (guild) await syncRanks(ctx, guild);
    } finally { laeuft = false; }
  };
  tick();
  setInterval(tick, INTERVALL_MS);
}
