// ═══════════════════════════════════════════════════════════════════════════
//  site-db.mjs — der EINE Weg, auf dem der Bot in die Datenbank der Website
//  schreibt (public.discord_role_state). role-sync.mjs, role-reconcile.mjs
//  und rank-sync.mjs kennen nur diese drei Aufrufe:
//
//    listLinked({ discordUserId? })   -> Zeilen verbundener Konten
//    setTester(discordUserId, bool)   -> { updated }
//    setStats(discordUserId, patch)   -> { updated }
//
//  Zwei Wege dahinter:
//
//    function  (Vorgabe, sobald BOT_ROLE_SYNC_SECRET gesetzt ist)
//              POST an die Edge Function bot-role-sync mit eigenem Geheimnis.
//              Die Function kann genau diese drei Dinge und sonst nichts —
//              der Bot haelt keinen Schluessel, der an RLS vorbeikommt.
//    legacy    PostgREST mit SUPABASE_SERVICE_ROLE_KEY. Nur noch als
//              Uebergang, bis die Function live ist: der Schluessel umgeht
//              RLS auf der ganzen Datenbank. Jeder Start warnt.
//
//  Rueckfall von function auf legacy NUR, wenn die Function sagt, dass es
//  sie (noch) nicht gibt (404) oder dass ihr das Geheimnis fehlt
//  (503 not_configured) — und nur, wenn ein Uebergangsschluessel da ist.
//  Ein 401 (falsches Geheimnis) faellt NICHT zurueck: das ist eine
//  Fehlkonfiguration und soll laut scheitern, nicht still weiterlaufen.
//  Warum ueberhaupt ein Rueckfall: faellt der Spiegel aus, wirkt ein
//  Rollenentzug nicht mehr auf der Website — die gefaehrliche Richtung.
//
//  Wirft bei Fehlern; die Aufrufer protokollieren und verschlucken (siehe
//  role-sync.mjs). Kein Aufruf ohne Zeitgrenze.
// ═══════════════════════════════════════════════════════════════════════════

/** Spalten, die rank-sync.mjs spiegelt (Kontoseite). */
export const STATS_FIELDS = ['in_guild', 'level', 'xp', 'total_xp', 'prestige', 'rank_key', 'messages', 'voice_seconds', 'server_rank', 'server_members'];

const TIMEOUT_MS = 10_000;
const PAGE = 1000;
const SNOWFLAKE = /^\d{17,20}$/;

function assertId(id) {
  if (!SNOWFLAKE.test(String(id ?? ''))) throw new Error(`keine Discord-ID: "${id}"`);
}

/** Nur die erlaubten Felder, damit kein Aufrufer versehentlich mehr schreibt. */
function cleanStats(patch) {
  const out = {};
  for (const k of STATS_FIELDS) if (k in (patch || {})) out[k] = patch[k];
  return out;
}

class FunctionMissing extends Error {}

function functionBackend({ url, secret }, fetchImpl) {
  async function call(body) {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await res.text().catch(() => '');
    if (res.status === 404 || (res.status === 503 && /not_configured/.test(text))) {
      throw new FunctionMissing(`bot-role-sync antwortet ${res.status} ${text.slice(0, 120)}`);
    }
    if (!res.ok) throw new Error(`bot-role-sync ${res.status}: ${text.slice(0, 200)}`);
    try { return JSON.parse(text); } catch { throw new Error(`bot-role-sync: Antwort ist kein JSON (${text.slice(0, 80)})`); }
  }
  return {
    mode: 'function',
    async listLinked({ discordUserId } = {}) {
      if (discordUserId) assertId(discordUserId);
      const out = await call(discordUserId ? { op: 'list', discord_user_id: String(discordUserId) } : { op: 'list' });
      if (!Array.isArray(out?.rows)) throw new Error('bot-role-sync list: kein rows-Feld');
      return out.rows;
    },
    async setTester(discordUserId, isTester) {
      assertId(discordUserId);
      const out = await call({ op: 'set', discord_user_id: String(discordUserId), is_tester: !!isTester });
      return { updated: Number(out?.updated) || 0 };
    },
    async setStats(discordUserId, patch) {
      assertId(discordUserId);
      const clean = cleanStats(patch);
      if (!Object.keys(clean).length) return { updated: 0 };
      const out = await call({ op: 'stats', discord_user_id: String(discordUserId), patch: clean });
      return { updated: Number(out?.updated) || 0 };
    },
  };
}

function legacyBackend({ url, key }, fetchImpl) {
  const headers = (extra = {}) => ({ apikey: key, Authorization: `Bearer ${key}`, ...extra });
  async function patchRow(discordUserId, body) {
    const res = await fetchImpl(
      `${url}/rest/v1/discord_role_state?discord_user_id=eq.${encodeURIComponent(discordUserId)}&select=discord_user_id`,
      {
        method: 'PATCH',
        headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!res.ok) throw new Error(`Supabase-PATCH ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
    const rows = await res.json().catch(() => []);
    return { updated: Array.isArray(rows) ? rows.length : 0 };
  }
  return {
    mode: 'legacy',
    async listLinked({ discordUserId } = {}) {
      if (discordUserId) assertId(discordUserId);
      const filter = discordUserId ? `discord_user_id=eq.${encodeURIComponent(discordUserId)}` : 'discord_user_id=not.is.null';
      const all = [];
      // Seitenweise: PostgREST liefert hoechstens 1000 Zeilen je Abruf, sonst
      // blieben ab dem tausendsten verbundenen Konto alle stehen.
      for (let offset = 0; ; offset += PAGE) {
        const res = await fetchImpl(
          `${url}/rest/v1/discord_role_state?select=discord_user_id,is_tester,${STATS_FIELDS.join(',')}&${filter}&order=discord_user_id&limit=${PAGE}&offset=${offset}`,
          { headers: headers(), signal: AbortSignal.timeout(TIMEOUT_MS) },
        );
        if (!res.ok) throw new Error(`Supabase-GET ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
        const rows = await res.json();
        if (!Array.isArray(rows)) throw new Error('Supabase-GET: Antwort ist keine Liste');
        all.push(...rows);
        if (rows.length < PAGE) return all;
      }
    },
    async setTester(discordUserId, isTester) {
      assertId(discordUserId);
      return patchRow(discordUserId, { is_tester: !!isTester, updated_at: new Date().toISOString() });
    },
    async setStats(discordUserId, patch) {
      assertId(discordUserId);
      const clean = cleanStats(patch);
      if (!Object.keys(clean).length) return { updated: 0 };
      return patchRow(discordUserId, { ...clean, stats_at: new Date().toISOString() });
    },
  };
}

/** function zuerst, bei "gibt es nicht" einmal legacy fuer DIESEN Aufruf. */
function withFallback(primary, fallback, log) {
  let warned = false;
  const wrap = (name) => async (...args) => {
    try {
      return await primary[name](...args);
    } catch (e) {
      if (!(e instanceof FunctionMissing) || !fallback) throw e;
      if (!warned) {
        log(`  ! Website-Spiegel: ${e.message} — Uebergangsweg mit SUPABASE_SERVICE_ROLE_KEY genommen. Function deployen und Geheimnis setzen.`);
        warned = true;
      }
      return fallback[name](...args);
    }
  };
  return { mode: fallback ? 'function+legacy' : 'function', listLinked: wrap('listLinked'), setTester: wrap('setTester'), setStats: wrap('setStats') };
}

/**
 * Baut den Zugang aus der Umgebung. `null` heisst: Spiegel inaktiv — der Bot
 * laeuft trotzdem (Raenge/XP/Sprache/Patch-Wache unberuehrt).
 * @returns {{ db: object|null, notes: string[] }}
 */
export function createSiteDb(env = process.env, { fetchImpl = globalThis.fetch, log = console.warn } = {}) {
  const notes = [];
  const url = (env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const secret = (env.BOT_ROLE_SYNC_SECRET || '').trim();
  const fnUrl = (env.BOT_ROLE_SYNC_URL || '').trim() || (url ? `${url}/functions/v1/bot-role-sync` : '');

  const legacy = url && key ? legacyBackend({ url, key }, fetchImpl) : null;
  if (secret && !fnUrl) notes.push('BOT_ROLE_SYNC_SECRET ist gesetzt, aber weder SUPABASE_URL noch BOT_ROLE_SYNC_URL — die Function ist nicht erreichbar.');
  if (secret && fnUrl) {
    if (!/^https:\/\//.test(fnUrl)) {
      notes.push(`BOT_ROLE_SYNC_URL muss https sein ("${fnUrl}") — Spiegel inaktiv.`);
      return { db: null, notes };
    }
    if (key) notes.push('SUPABASE_SERVICE_ROLE_KEY ist noch gesetzt — nur noch Rueckfall, bitte aus der Bot-Umgebung entfernen, sobald bot-role-sync live ist.');
    return { db: withFallback(functionBackend({ url: fnUrl, secret }, fetchImpl), legacy, log), notes };
  }
  if (legacy) {
    notes.push('Website-Spiegel laeuft ueber SUPABASE_SERVICE_ROLE_KEY (Uebergang). Ziel: BOT_ROLE_SYNC_SECRET setzen, Schluessel entfernen.');
    return { db: legacy, notes };
  }
  notes.push('Website-Spiegel inaktiv — weder BOT_ROLE_SYNC_SECRET noch SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY gesetzt.');
  return { db: null, notes };
}
