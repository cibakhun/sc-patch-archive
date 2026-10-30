// Supabase Edge Function `bot-role-sync`
//
// Die einzige Tuer des Discord-Bots in die Datenbank. Vorher hielt der Bot den
// service_role-Schluessel und schrieb per PostgREST direkt in
// public.discord_role_state — wer den Bot-Host kompromittierte, hatte damit
// Vollzugriff auf ALLE Tabellen, an RLS vorbei. Jetzt haelt der Bot nur noch
// ein eigenes Geheimnis, und dieses Geheimnis kann genau diese Dinge:
//
//   {"op":"list"[, "discord_user_id":"…"][, "offset":n]}
//       -> 200 {"rows":[{discord_user_id, is_tester, in_guild, level, xp,
//          total_xp, prestige, rank_key, messages, voice_seconds,
//          server_rank, server_members}, …]}
//          nur Zeilen mit discord_user_id, nur diese Spalten — keine user_id.
//          Seitenweise: hoechstens PAGE Zeilen, sortiert nach discord_user_id,
//          ab offset (Ganzzahl >= 0, Vorgabe 0). Weniger als PAGE Zeilen =
//          letzte Seite.
//   {"op":"badges"[, "offset":n]}
//       -> 200 {"rows":[{discord_user_id, profile_complete}, …]}
//          aus der Sicht discord_profile_badges (Abzeichen "Profil komplett"),
//          seitenweise wie list.
//   {"op":"set","discord_user_id":"…","is_tester":true|false}
//       -> 200 {"updated":n}   setzt is_tester und updated_at.
//   {"op":"stats","discord_user_id":"…","patch":{…}}
//       -> 200 {"updated":n}   setzt die erlaubten Rang-Felder und stats_at.
//   {"op":"refinery_due"}
//       -> 200 {"rows":[{job_id, discord_user_id, lang, station, method,
//          items, ready_at}, …]}   faellige Raffinerie-Meldungen (hoechstens
//          50), aus public.refinery_discord_due — keine user_id.
//   {"op":"refinery_sent","ids":[n, …]}
//       -> 200 {"updated":n}   markiert 1-100 Auftraege als gemeldet.
//
// set und stats sind reine UPDATEs per discord_user_id, nie INSERT: die Zeile
// legt die Datenbank selbst an, wenn ein Konto Discord verknuepft. 0 Zeilen
// ist der Normalfall (kein verknuepftes Konto), kein Fehler.
//
// WARUM verify_jwt = false: der Bot hat keine Supabase-Sitzung. Geprueft wird
// HIER, ueber `Authorization: Bearer <BOT_ROLE_SYNC_SECRET>`, zeitkonstant.
// Fehlt das Geheimnis in der Function (oder ist es kuerzer als 32 Zeichen),
// antwortet sie 503 — geschlossen, nie offen. Der Bot faellt dann auf seinen
// alten Weg zurueck, damit ein Rollenentzug nie ausfaellt.
//
// Antworten: 401 falsches/fehlendes Geheimnis, 405 kein POST, 400 alles, was
// nicht exakt einer der Formen oben entspricht (unbekannte Schluessel, falsche
// Typen, leeres patch, Rumpf ueber 2 KB), 500 Datenbankfehler (nur im Log
// beschriftet). Kein CORS: reine Server-zu-Server-Schnittstelle.
// Die beiden refinery-Ops lesen und schreiben nur ueber die zwei
// security-definer-Funktionen der Migration 20261030180000; die Function
// selbst fasst refinery_jobs nicht an.
//
// Version fest gepinnt wie in stripe-webhook und delete-account (vorher @2,
// also jeweils die neueste 2.x zum Zeitpunkt des Deploys).
import { createClient } from 'jsr:@supabase/supabase-js@2.118.0';

const MAX_BODY = 2048;
const PAGE = 1000;
const DISCORD_ID_RE = /^\d{17,20}$/;
const RANK_KEY_RE = /^[a-z0-9-]{1,32}$/;
const INT4_MAX = 2147483647;
const LIST_COLUMNS =
  'discord_user_id,is_tester,in_guild,level,xp,total_xp,prestige,rank_key,messages,voice_seconds,server_rank,server_members';

type Check = (v: unknown) => boolean;
const nonNegInt = (max: number): Check => (v) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max;
const STATS_FIELDS: Record<string, Check> = {
  in_guild: (v) => typeof v === 'boolean',
  level: nonNegInt(INT4_MAX),
  xp: nonNegInt(INT4_MAX),
  total_xp: nonNegInt(Number.MAX_SAFE_INTEGER),
  prestige: nonNegInt(INT4_MAX),
  messages: nonNegInt(INT4_MAX),
  voice_seconds: nonNegInt(INT4_MAX),
  server_members: nonNegInt(INT4_MAX),
  server_rank: (v) => v === null || (nonNegInt(INT4_MAX)(v) && (v as number) >= 1),
  rank_key: (v) => typeof v === 'string' && RANK_KEY_RE.test(v),
};

const HEADERS = { 'Content-Type': 'application/json' };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: HEADERS });

async function sha256(input: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)));
}
// Vergleich ueber die Hashes: gleiche Laenge, und jede Stelle wird angesehen.
async function sameSecret(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(given), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const onlyKeys = (o: Record<string, unknown>, allowed: string[]) => Object.keys(o).every((k) => allowed.includes(k));
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });

  const expected = Deno.env.get('BOT_ROLE_SYNC_SECRET') ?? '';
  if (expected.length < 32) {
    console.error('BOT_ROLE_SYNC_SECRET fehlt oder ist kuerzer als 32 Zeichen');
    return reply(503, { error: 'not_configured' });
  }
  const auth = req.headers.get('authorization') ?? '';
  const given = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!(await sameSecret(given, expected))) return reply(401, { error: 'unauthorized' });

  const raw = await req.text();
  if (raw.length > MAX_BODY) return reply(400, { error: 'body_too_large' });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return reply(400, { error: 'invalid_json' });
  }
  if (!isObject(body)) return reply(400, { error: 'invalid_body' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const id = body.discord_user_id;
  const now = new Date().toISOString();

  try {
    if (body.op === 'list') {
      if (!onlyKeys(body, ['op', 'discord_user_id', 'offset'])) return reply(400, { error: 'unknown_field' });
      if (id !== undefined && !(typeof id === 'string' && DISCORD_ID_RE.test(id))) {
        return reply(400, { error: 'invalid_discord_user_id' });
      }
      const offset = body.offset ?? 0;
      if (!nonNegInt(INT4_MAX)(offset)) return reply(400, { error: 'invalid_offset' });
      let q = admin.from('discord_role_state').select(LIST_COLUMNS).not('discord_user_id', 'is', null);
      if (typeof id === 'string') q = q.eq('discord_user_id', id);
      q = q.order('discord_user_id').range(offset as number, (offset as number) + PAGE - 1);
      const { data, error } = await q;
      if (error) throw error;
      return reply(200, { rows: data ?? [] });
    }

    if (body.op === 'badges') {
      if (!onlyKeys(body, ['op', 'offset'])) return reply(400, { error: 'unknown_field' });
      const offset = body.offset ?? 0;
      if (!nonNegInt(INT4_MAX)(offset)) return reply(400, { error: 'invalid_offset' });
      const { data, error } = await admin
        .from('discord_profile_badges')
        .select('discord_user_id,profile_complete')
        .order('discord_user_id')
        .range(offset as number, (offset as number) + PAGE - 1);
      if (error) throw error;
      return reply(200, { rows: data ?? [] });
    }

    if (body.op === 'refinery_due') {
      if (!onlyKeys(body, ['op'])) return reply(400, { error: 'unknown_field' });
      const { data, error } = await admin.rpc('refinery_discord_due', { p_limit: 50 });
      if (error) throw error;
      return reply(200, { rows: data ?? [] });
    }

    if (body.op === 'refinery_sent') {
      if (!onlyKeys(body, ['op', 'ids'])) return reply(400, { error: 'unknown_field' });
      const ids = body.ids;
      if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100 || !ids.every((v) => nonNegInt(Number.MAX_SAFE_INTEGER)(v) && (v as number) >= 1)) {
        return reply(400, { error: 'invalid_ids' });
      }
      const { data, error } = await admin.rpc('refinery_discord_sent', { p_ids: ids });
      if (error) throw error;
      return reply(200, { updated: Number(data) || 0 });
    }

    if (typeof id !== 'string' || !DISCORD_ID_RE.test(id)) return reply(400, { error: 'invalid_discord_user_id' });

    if (body.op === 'set') {
      if (!onlyKeys(body, ['op', 'discord_user_id', 'is_tester'])) return reply(400, { error: 'unknown_field' });
      if (typeof body.is_tester !== 'boolean') return reply(400, { error: 'invalid_is_tester' });
      const { data, error } = await admin
        .from('discord_role_state')
        .update({ is_tester: body.is_tester, updated_at: now })
        .eq('discord_user_id', id)
        .select('discord_user_id');
      if (error) throw error;
      return reply(200, { updated: data?.length ?? 0 });
    }

    if (body.op === 'stats') {
      if (!onlyKeys(body, ['op', 'discord_user_id', 'patch'])) return reply(400, { error: 'unknown_field' });
      const patch = body.patch;
      if (!isObject(patch) || Object.keys(patch).length === 0) return reply(400, { error: 'invalid_patch' });
      for (const [k, v] of Object.entries(patch)) {
        if (!Object.hasOwn(STATS_FIELDS, k)) return reply(400, { error: 'unknown_field', field: k });
        const check = STATS_FIELDS[k];
        if (!check(v)) return reply(400, { error: 'invalid_value', field: k });
      }
      const { data, error } = await admin
        .from('discord_role_state')
        .update({ ...patch, stats_at: now })
        .eq('discord_user_id', id)
        .select('discord_user_id');
      if (error) throw error;
      return reply(200, { updated: data?.length ?? 0 });
    }

    return reply(400, { error: 'unknown_op' });
  } catch (e) {
    console.error('bot-role-sync: Datenbankfehler', e);
    return reply(500, { error: 'db_error' });
  }
});
