// ═══════════════════════════════════════════════════════════════════════════
//  rank-sync.mjs — spiegelt Level, Rang und XP der Mitglieder, die Discord mit
//  ihrem VerseBase-Konto verbunden haben, nach public.discord_role_state
//  (Kontoseite, 29.10.2026). Die Kontoseite zeigt daraus Rang und
//  Fortschritt, die Pilotenseite und die Freundesliste Level und Rang.
//
//  Gleiches Muster wie role-sync.mjs / role-reconcile.mjs:
//    - Gelesen wird nur, wer in discord_role_state steht (verbunden hat).
//      Alle anderen Mitglieder verlassen den Bot nie.
//    - Geschrieben wird per PostgREST-PATCH auf discord_user_id, NUR wenn
//      sich etwas geaendert hat -- ein ruhiger Server erzeugt keine Writes.
//    - Jeder Netzfehler wird protokolliert und verschluckt; der naechste
//      Durchlauf holt nach. Der Bot laeuft ohne Supabase unveraendert.
//
//  Zeitpunkte: einmal beim Start, dann alle 5 Minuten, und sofort fuer ein
//  Mitglied, das gerade aufgestiegen ist (award.mjs -> pushRank).
// ═══════════════════════════════════════════════════════════════════════════
import { levelForXp } from './leveling.mjs';
import { rankForLevel } from './ranks.mjs';

const FIELDS = ['in_guild', 'level', 'xp', 'total_xp', 'prestige', 'rank_key', 'messages', 'voice_seconds', 'server_rank', 'server_members'];

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

function headers(supabase, extra = {}) {
  return { apikey: supabase.key, Authorization: `Bearer ${supabase.key}`, ...extra };
}

async function fetchLinked(supabase, onlyId) {
  const filter = onlyId ? `discord_user_id=eq.${encodeURIComponent(onlyId)}` : 'discord_user_id=not.is.null';
  const res = await fetch(`${supabase.url}/rest/v1/discord_role_state?select=discord_user_id,${FIELDS.join(',')}&${filter}`, { headers: headers(supabase) });
  if (!res.ok) throw new Error(`Supabase-GET ${res.status}: ${await res.text().catch(() => '')}`);
  return res.json();
}

async function writeRow(supabase, discordId, patch) {
  const res = await fetch(`${supabase.url}/rest/v1/discord_role_state?discord_user_id=eq.${encodeURIComponent(discordId)}`, {
    method: 'PATCH',
    headers: headers(supabase, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify({ ...patch, stats_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Supabase-PATCH ${res.status}: ${await res.text().catch(() => '')}`);
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
  const { supabase, db } = ctx;
  if (!supabase) return;
  let rows;
  try { rows = await fetchLinked(supabase, onlyId); }
  catch (e) { console.warn(`  ! Rangspiegel: Lesen fehlgeschlagen: ${e.message}`); return; }

  let written = 0;
  for (const stored of rows) {
    const id = stored.discord_user_id;
    if (!id) continue;
    const snap = rankSnapshot(db, guild.id, id, await memberState(guild, id));
    const patch = changedFields(stored, snap);
    if (!Object.keys(patch).length) continue;
    try { await writeRow(supabase, id, patch); written += 1; }
    catch (e) { console.warn(`  ! Rangspiegel: Schreiben fuer ${id} fehlgeschlagen: ${e.message}`); }
  }
  // Selbstauskunft: ohne diese Zeile sieht ein leerlaufender Spiegel aus wie ein echter.
  if (!onlyId) console.log(`  · Rangspiegel ${guild.name}: ${rows.length} verbundene Konten gelesen, ${written} geschrieben.`);
}

/** Sofort-Abgleich fuer ein Mitglied (nach Level-Aufstieg). Wirft nie. */
export function pushRank(ctx, guild, discordId) {
  if (process.env.GUILD_ID && guild.id !== process.env.GUILD_ID) return;
  syncRanks(ctx, guild, discordId).catch(() => {});
}

const INTERVALL_MS = 5 * 60 * 1000;
let laeuft = false;

export function startRankSync(ctx) {
  if (!ctx.supabase) return;
  const tick = async () => {
    if (laeuft) return;
    laeuft = true;
    try {
      // Ein Bot, ein Server: mit GUILD_ID nur dieser (sonst schriebe jeder
      // weitere Server seine eigenen Zahlen in dieselbe Zeile).
      for (const guild of ctx.client.guilds.cache.values()) {
        if (process.env.GUILD_ID && guild.id !== process.env.GUILD_ID) continue;
        await syncRanks(ctx, guild);
      }
    } finally { laeuft = false; }
  };
  tick();
  setInterval(tick, INTERVALL_MS);
}
