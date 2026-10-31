// "Meine Daten herunterladen": alles, was das eigene Konto in der Datenbank
// und im Speicher hat, als eine JSON-Datei (Art. 15 und 20 DSGVO).
//
// Gelesen wird mit der Sitzung des Nutzers, also unter RLS: jede Tabelle gibt
// ohnehin nur die eigenen Zeilen heraus (bzw. bei Freunden, Anfragen und
// Nachrichten die, an denen das Konto beteiligt ist). Die Filter hier sind
// trotzdem ausdruecklich gesetzt, damit eine spaeter gelockerte Policy nicht
// fremde Zeilen in die Datei spuelt. Keine Edge Function noetig.
//
// Ohne Importe, damit tests/e2e/account-export.test.js die Datei unveraendert
// gegen einen nachgebauten Client laden kann.

export const EXPORT_FORMAT = 'verse-base-account-export';
export const EXPORT_VERSION = 1;
/** PostgREST liefert hoechstens so viele Zeilen je Anfrage (Supabase: max-rows). */
export const PAGE = 1000;
/** Obergrenze je Tabelle, damit eine kaputte Antwort keine Endlosschleife baut. */
export const MAX_ROWS = 50_000;

type Own = { col: string } | { any: [string, string] };
export interface ExportSpec {
  /** Schluessel in der Datei. */
  key: string;
  table: string;
  own: Own;
  /** Stabile Sortierung fuers seitenweise Lesen (Primaerschluessel). */
  order: string;
}

export const EXPORT_SPECS: readonly ExportSpec[] = [
  { key: 'profile', table: 'profiles', own: { col: 'id' }, order: 'id' },
  { key: 'user_roles', table: 'user_roles', own: { col: 'user_id' }, order: 'user_id' },
  { key: 'favorites', table: 'favorites', own: { col: 'user_id' }, order: 'id' },
  { key: 'crafting_entries', table: 'crafting_entries', own: { col: 'user_id' }, order: 'slug' },
  { key: 'refinery_jobs', table: 'refinery_jobs', own: { col: 'user_id' }, order: 'id' },
  { key: 'notification_settings', table: 'notification_settings', own: { col: 'user_id' }, order: 'user_id' },
  { key: 'mining_sig_presets', table: 'mining_sig_presets', own: { col: 'user_id' }, order: 'name' },
  { key: 'hangar_layouts', table: 'hangar_layouts', own: { col: 'user_id' }, order: 'id' },
  { key: 'friends', table: 'friends', own: { any: ['user_id', 'friend_id'] }, order: 'id' },
  { key: 'friend_requests', table: 'friend_requests', own: { any: ['sender_id', 'receiver_id'] }, order: 'id' },
  { key: 'direct_messages_sent', table: 'direct_messages', own: { col: 'sender_id' }, order: 'id' },
  { key: 'direct_messages_received', table: 'direct_messages', own: { col: 'receiver_id' }, order: 'id' },
  { key: 'discord_role_state', table: 'discord_role_state', own: { col: 'user_id' }, order: 'user_id' },
];

export const EXPORT_BUCKETS = ['avatars', 'banners'] as const;

// Nur die Teile von supabase-js, die hier gebraucht werden, in der
// Reihenfolge, in der sie aufgerufen werden: filtern, sortieren, Seite.
interface QueryResult { data: unknown[] | null; error: { message?: string } | null }
interface Ordered { range(from: number, to: number): PromiseLike<QueryResult> }
interface Filtered { order(col: string, opts?: { ascending?: boolean }): Ordered }
interface Filterable {
  eq(col: string, val: string): Filtered;
  or(filter: string): Filtered;
}
interface ListResult { data: unknown[] | null; error: { message?: string } | null }
export interface ExportClient {
  from(table: string): { select(cols: string): Filterable };
  storage: {
    from(bucket: string): {
      list(path?: string, opts?: { limit?: number; offset?: number }): Promise<ListResult>;
    };
  };
}

const UID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function readTable(client: ExportClient, spec: ExportSpec, uid: string): Promise<{ rows: unknown[]; error?: string }> {
  const rows: unknown[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const base = client.from(spec.table).select('*');
    const q = 'col' in spec.own
      ? base.eq(spec.own.col, uid)
      : base.or(`${spec.own.any[0]}.eq.${uid},${spec.own.any[1]}.eq.${uid}`);
    let res: QueryResult;
    try {
      res = await q.order(spec.order, { ascending: true }).range(from, from + PAGE - 1);
    } catch (e) {
      return { rows, error: e instanceof Error ? e.message : String(e) };
    }
    if (res.error) return { rows, error: res.error.message || 'Abfrage fehlgeschlagen' };
    const page = res.data ?? [];
    rows.push(...page);
    // Erst eine leere Seite heisst "fertig": kappt der Server Antworten
    // unter PAGE (max_rows im Projekt), ist eine kurze Seite nicht die letzte.
    if (page.length === 0) return { rows };
    from += page.length - PAGE;
  }
  return { rows, error: `mehr als ${MAX_ROWS} Zeilen, gekuerzt` };
}

async function readBucket(client: ExportClient, bucket: string, uid: string): Promise<{ files: unknown[]; error?: string }> {
  const files: unknown[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    let res: ListResult;
    try {
      res = await client.storage.from(bucket).list(uid, { limit: PAGE, offset });
    } catch (e) {
      return { files, error: e instanceof Error ? e.message : String(e) };
    }
    if (res.error) return { files, error: res.error.message || 'Auflisten fehlgeschlagen' };
    const page = (res.data ?? []).map((f) => {
      const o = (f || {}) as Record<string, unknown>;
      return { path: `${uid}/${String(o.name ?? '')}`, ...o };
    });
    files.push(...page);
    if (page.length < PAGE) return { files };
  }
  return { files, error: `mehr als ${MAX_ROWS} Dateien, gekuerzt` };
}

export interface AccountExport {
  format: string;
  version: number;
  exported_at: string;
  account: unknown;
  tables: Record<string, unknown[]>;
  storage: Record<string, unknown[]>;
  /** Nur vorhanden, wenn etwas nicht gelesen werden konnte: Teil -> Meldung. */
  errors?: Record<string, string>;
}

/**
 * Stellt die Datei zusammen. user ist das Objekt aus supabase.auth.getUser()
 * (E-Mail, Anlagedatum, verbundene Anmeldewege); es enthaelt keine Tokens.
 * Wirft nur bei einer ungueltigen Konto-ID; jeder andere Fehler landet unter
 * errors, und der Rest wird trotzdem exportiert.
 */
export async function buildAccountExport(
  client: ExportClient,
  user: { id: string } & Record<string, unknown>,
  now: Date = new Date(),
): Promise<AccountExport> {
  const uid = user.id;
  if (!UID_RE.test(uid)) throw new Error('ungueltige Konto-ID');
  const out: AccountExport = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exported_at: now.toISOString(),
    account: user,
    tables: {},
    storage: {},
  };
  const errors: Record<string, string> = {};
  for (const spec of EXPORT_SPECS) {
    const r = await readTable(client, spec, uid);
    out.tables[spec.key] = r.rows;
    if (r.error) errors[spec.key] = r.error;
  }
  for (const b of EXPORT_BUCKETS) {
    const r = await readBucket(client, b, uid);
    out.storage[b] = r.files;
    if (r.error) errors[`storage.${b}`] = r.error;
  }
  if (Object.keys(errors).length) out.errors = errors;
  return out;
}

/** Dateiname, z. B. verse-base-daten-2026-10-30.json */
export function exportFileName(lang: 'de' | 'en', now: Date = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return lang === 'de' ? `verse-base-daten-${day}.json` : `verse-base-data-${day}.json`;
}
