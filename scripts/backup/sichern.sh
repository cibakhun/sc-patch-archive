#!/usr/bin/env bash
# ============================================================
# sichern.sh — zieht eine vollstaendige Sicherung einer Supabase-Datenbank.
# Ablauf und Wiederherstellung: docs/betrieb/datenbank-backup.md
#
#   VB_DB_URL=postgresql://vb_backup.<ref>:<pw>@<pooler>:5432/postgres \
#   VB_STORAGE_URL=https://<ref>.supabase.co \
#     scripts/backup/sichern.sh <ordner>
#
# Liest nur. Schreibt in <ordner>:
#   roles.sql, schema.sql, data.sql      offizielles Verfahren der Supabase-CLI
#   zusatz.sql                           was die CLI auslaesst (auth/storage-
#                                        Trigger, Storage-Policies, Realtime)
#   history_schema.sql, history_data.sql Migrationshistorie
#   katalog.json                         Objekte, Rechte, Zeilenzahlen der Quelle
#   storage/<bucket>/<name>, storage.json die Dateien aus Supabase Storage
#   manifest.json                        Pruefsummen und Zaehlungen (verify-backup)
#
# Umgebung (optional): VB_ERWARTETE_REF (Projektref, die im Benutzernamen
# stehen muss), VB_KLINKE_KONTEN / VB_KLINKE_TABELLEN (Untergrenzen),
# VB_PG_IMAGE, SUPABASE_BIN.
# ============================================================
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/gemeinsam.sh"

ZIEL="${1:?Zielordner fehlt}"
mkdir -p "$ZIEL"
ZIEL="$(cd "$ZIEL" && pwd)"
SKRIPTE="$(mktemp -d)"
trap 'rm -rf "$SKRIPTE"' EXIT

verbindung_setzen "${VB_DB_URL:-}"
echo "Quelle: $URL_OHNE_PASSWORT (sslmode=$PGSSLMODE)"
if [ -n "${VB_ERWARTETE_REF:-}" ]; then
  case "$PGUSER" in
    *."$VB_ERWARTETE_REF") ;;
    *) fehler "Benutzer $PGUSER gehoert nicht zum Projekt $VB_ERWARTETE_REF — falsche Datenbank?" ;;
  esac
fi

schritt "Verbindung und Rolle"
info="$(pg -c "select current_user || ' ' || current_setting('server_version') || ' ro=' || current_setting('default_transaction_read_only')")"
echo "  $info"

schritt "Skripte der Supabase-CLI ($("$SUPABASE_BIN" --version 2>/dev/null | head -1))"
cli_skript "$SKRIPTE/roles.sh" --role-only
cli_skript "$SKRIPTE/schema.sh"
cli_skript "$SKRIPTE/data.sh" --use-copy --data-only -x storage.buckets_vectors -x storage.vector_indexes
cli_skript "$SKRIPTE/history_schema.sh" --schema supabase_migrations
cli_skript "$SKRIPTE/history_data.sh" --use-copy --data-only --schema supabase_migrations
echo "  5 Skripte, je ohne SET ROLE"

schritt "Katalog der Quelle (vor dem Dump)"
pg < "$REPO/scripts/backup/katalog.sql" > "$ZIEL/katalog.json"
node -e 'const k=require(process.argv[1]); const o=k.objekte||{}; console.log(`  ${Object.keys(o).length} Kategorien, ${Object.values(o).reduce((a,l)=>a+l.length,0)} Objekte, ${Object.keys(k.zeilen||{}).length} Tabellen, Postgres ${k.server_version}, ${k.migrationen} Migrationen bis ${k.letzte_migration}`)' "$ZIEL/katalog.json"

schritt "Dump"
for teil in roles schema data history_schema history_data; do
  im_image "$SKRIPTE/$teil.sh" > "$ZIEL/$teil.sql"
  printf '  %-15s %10s Bytes\n' "$teil.sql" "$(wc -c < "$ZIEL/$teil.sql")"
done

schritt "Zusaetze (auth/storage, Realtime)"
pg < "$REPO/scripts/backup/zusatz.sql" > "$ZIEL/zusatz.sql"
echo "  $(grep -c -E '^(CREATE|ALTER|DO) ' "$ZIEL/zusatz.sql" || true) Anweisungen"

schritt "Storage-Dateien"
pg -c "select coalesce(json_agg(json_build_object('bucket', o.bucket_id, 'name', o.name, 'size', (o.metadata->>'size')::bigint, 'mime', o.metadata->>'mimetype', 'public', b.public) order by o.bucket_id, o.name), '[]') from storage.objects o join storage.buckets b on b.id = o.bucket_id" > "$ZIEL/storage-liste.json"
node "$REPO/scripts/backup/dateien.mjs" holen "$ZIEL" "${VB_STORAGE_URL:?VB_STORAGE_URL fehlt}"

schritt "Manifest"
node "$REPO/scripts/verify-backup.mjs" inhalt "$ZIEL"
