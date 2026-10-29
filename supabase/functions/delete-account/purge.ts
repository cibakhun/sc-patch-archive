// Hochgeladene Profilbilder eines Kontos entfernen, bevor das Konto geht.
//
// Die Buckets avatars und banners sind oeffentlich lesbar. Supabase loescht
// beim Entfernen eines auth.users-Eintrags keine Storage-Objekte mit, und
// storage.objects haengt an keinem Fremdschluessel auf auth.users. Ohne
// diesen Schritt blieben die Bilder nach "Konto loeschen" unter ihrer
// bisherigen URL abrufbar, obwohl die Datenschutzerklaerung die Entfernung
// aller zugehoerigen Daten zusagt.
//
// Absichtlich ohne Importe: die Datei laeuft in der Edge Function (Deno) und
// unveraendert in tests/e2e/delete-account-purge.test.js (Node), dort gegen
// einen nachgebauten Storage-Client.
//
// Ablauf: in beiden Buckets alles unter "<uid>/" auflisten (seitenweise,
// Unterordner eingeschlossen), erst danach entfernen, dann noch einmal
// auflisten. Scheitert ein Schritt oder steht danach noch etwas dort, gilt
// das als Fehler: die Function bricht dann ab, BEVOR sie das Konto loescht.
// Ein Konto, das noch da ist, kann man erneut loeschen; Bilder eines
// geloeschten Kontos findet niemand mehr ueber die Oberflaeche.

export const USER_BUCKETS = ['avatars', 'banners'] as const;

/** Seitengroesse fuer list() und remove(); die Storage-API erlaubt 1000. */
export const PAGE = 1000;
/** Tiefer schachtelt die Seite nie (sie schreibt <uid>/avatar und <uid>/banner). */
const MAX_DEPTH = 3;

export interface StorageEntry {
  name: string;
  /** null bei einem Ordner (Praefix), sonst die Objekt-ID. */
  id: string | null;
}
interface StorageError {
  message?: string;
}
export interface BucketApi {
  list(
    path?: string,
    options?: { limit?: number; offset?: number; sortBy?: { column: string; order: string } },
  ): Promise<{ data: StorageEntry[] | null; error: StorageError | null }>;
  remove(paths: string[]): Promise<{ data: unknown; error: StorageError | null }>;
}
export interface StorageApi {
  from(bucket: string): BucketApi;
}

export type PurgeResult =
  | { ok: true; removed: number }
  | { ok: false; bucket: string; stage: 'list' | 'remove' | 'verify'; message: string };

const UID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Alle Objektpfade unter prefix; liefert einen Fehlertext oder null. */
async function collect(bucket: BucketApi, prefix: string, depth: number, out: string[]): Promise<string | null> {
  for (let offset = 0; ; offset += PAGE) {
    let res: Awaited<ReturnType<BucketApi['list']>>;
    try {
      res = await bucket.list(prefix, { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
    } catch (e) {
      return e instanceof Error ? e.message : 'list_failed';
    }
    if (res.error) return res.error.message || 'list_failed';
    const rows = res.data ?? [];
    for (const entry of rows) {
      const path = `${prefix}/${entry.name}`;
      if (entry.id === null) {
        if (depth >= MAX_DEPTH) return `zu tief verschachtelt: ${path}`;
        const err = await collect(bucket, path, depth + 1, out);
        if (err) return err;
      } else {
        out.push(path);
      }
    }
    if (rows.length < PAGE) return null;
  }
}

/**
 * Entfernt alle Objekte unter "<uid>/" in avatars und banners. Braucht einen
 * Client mit Service-Schluessel (die Storage-Policies erlauben Loeschen sonst
 * nur dem Kontoinhaber selbst, und der soll hier nicht vorausgesetzt werden).
 */
export async function purgeUserFiles(storage: StorageApi, uid: string): Promise<PurgeResult> {
  if (!UID_RE.test(uid)) return { ok: false, bucket: '-', stage: 'list', message: 'ungueltige Konto-ID' };

  // 1. Erst alles auflisten: scheitert das in einem Bucket, ist noch nichts weg.
  const found: Array<{ name: string; bucket: BucketApi; paths: string[] }> = [];
  for (const name of USER_BUCKETS) {
    const bucket = storage.from(name);
    const paths: string[] = [];
    const listErr = await collect(bucket, uid, 0, paths);
    if (listErr) return { ok: false, bucket: name, stage: 'list', message: listErr };
    found.push({ name, bucket, paths });
  }

  // 2. Entfernen, seitenweise.
  let removed = 0;
  for (const { name, bucket, paths } of found) {
    for (let i = 0; i < paths.length; i += PAGE) {
      let res: Awaited<ReturnType<BucketApi['remove']>>;
      try {
        res = await bucket.remove(paths.slice(i, i + PAGE));
      } catch (e) {
        return { ok: false, bucket: name, stage: 'remove', message: e instanceof Error ? e.message : 'remove_failed' };
      }
      if (res.error) return { ok: false, bucket: name, stage: 'remove', message: res.error.message || 'remove_failed' };
    }
    removed += paths.length;
  }

  // 3. Gegenprobe: unter <uid>/ darf nichts mehr stehen.
  for (const { name, bucket, paths } of found) {
    if (!paths.length) continue;
    const left: string[] = [];
    const verifyErr = await collect(bucket, uid, 0, left);
    if (verifyErr) return { ok: false, bucket: name, stage: 'verify', message: verifyErr };
    if (left.length) return { ok: false, bucket: name, stage: 'verify', message: `${left.length} Objekt(e) noch vorhanden` };
  }
  return { ok: true, removed };
}
