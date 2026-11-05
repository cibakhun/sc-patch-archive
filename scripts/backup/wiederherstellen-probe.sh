#!/usr/bin/env bash
# ============================================================
# wiederherstellen-probe.sh — spielt eine Sicherung in einen frischen,
# abgeschotteten Supabase-Stack zurueck und vergleicht ihn mit der Quelle.
# Ablauf und Hintergrund: docs/betrieb/datenbank-backup.md
#
#   scripts/backup/wiederherstellen-probe.sh <sicherung> [<probe-ordner>]
#
# ABGESCHOTTET: der Stack ist ein lokaler `supabase start` (Datenbank,
# Auth, Storage, Gateway) ohne Migrationen, mit den oeffentlich bekannten
# Entwicklungsschluesseln der CLI. Er kennt keinen Live-Schluessel, keine
# Discord-App, kein Stripe, kein SMTP, und er wird am Ende geloescht. Es
# gibt keinen Weg von hier nach Live: die Probe bekommt nur die Dateien.
#
# SCHRITTE (dieselben wie bei einer echten Wiederherstellung):
#   1. vorbereitung.sql, roles.sql, schema.sql, zusatz.sql,
#      history_schema.sql, data.sql, history_data.sql
#      — eine Transaktion, Abbruch beim ersten Fehler
#   2. Katalog und erneuter Dump der Probe
#   3. verify-backup.mjs vergleich: Objekt fuer Objekt, Recht fuer Recht,
#      Zeile fuer Zeile gegen die Quelle
#   4. Storage-Dateien hochladen und mit gleicher sha256 zurueckholen
#   5. (nur Sonde) Anmeldung mit einem Probe-Konto: VB_PROBE_ANMELDUNG=
#      "<mail>:<passwort>" — zeigt, dass Passwort-Hashes wieder tragen
#
# VB_STACK_BEHALTEN=1 laesst den Stack danach laufen, um einzelne Zeilen
# daraus zu lesen (Teil-Wiederherstellung, docs/betrieb/datenbank-backup.md).
# ============================================================
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/gemeinsam.sh"

QUELLE="$(cd "${1:?Sicherungsordner fehlt}" && pwd)"
PROBE="${2:-$(mktemp -d)}"
mkdir -p "$PROBE"
PROBE="$(cd "$PROBE" && pwd)"
STACK="$(mktemp -d)"
SKRIPTE="$(mktemp -d)"
NAME="vb-probe-$$"

aufraeumen() {
  if [ "${VB_STACK_BEHALTEN:-}" = 1 ]; then
    echo
    echo "Stack bleibt laufen (VB_STACK_BEHALTEN=1): ${DB_URL:-?}"
    echo "  stoppen: $SUPABASE_BIN stop --no-backup --workdir $STACK"
    rm -rf "$SKRIPTE"
    return
  fi
  "$SUPABASE_BIN" stop --no-backup --workdir "$STACK" >/dev/null 2>&1 || true
  rm -rf "$STACK" "$SKRIPTE"
}
trap aufraeumen EXIT

schritt "Abgeschotteter Stack ($NAME)"
( cd "$STACK" && "$SUPABASE_BIN" init --force > "$PROBE/init.log" 2>&1 ) \
  || { tail -20 "$PROBE/init.log" >&2; fehler "supabase init schlug fehl"; }
# eigener Name und eigene Ports (553xx), damit ein Quell-Stack daneben laufen kann
sed -i -E "s/^project_id = .*/project_id = \"$NAME\"/; s/^(port|shadow_port) = 543/\1 = 553/" "$STACK/supabase/config.toml"
mkdir -p "$STACK/supabase/migrations"
"$SUPABASE_BIN" start --workdir "$STACK" \
  -x realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor,postgrest > "$PROBE/stack.log" 2>&1 \
  || { tail -30 "$PROBE/stack.log" >&2; fehler "Stack startet nicht"; }
eval "$("$SUPABASE_BIN" status --workdir "$STACK" -o env 2>/dev/null | grep -E '^(DB_URL|API_URL|SERVICE_ROLE_KEY|ANON_KEY)=')"
case "$DB_URL" in *127.0.0.1:553*) ;; *) fehler "Probe-Datenbank ist nicht der lokale Stack ($DB_URL)";; esac
echo "  $API_URL, Datenbank 127.0.0.1:553xx"
verbindung_setzen "$DB_URL"

schritt "Wiederherstellen (eine Transaktion)"
cat "$REPO/scripts/backup/vorbereitung.sql" \
    "$QUELLE/roles.sql" "$QUELLE/schema.sql" "$QUELLE/zusatz.sql" \
    "$QUELLE/history_schema.sql" "$QUELLE/data.sql" "$QUELLE/history_data.sql" \
  | pg --single-transaction > "$PROBE/restore.log" 2>&1 \
  || { grep -m5 -E 'ERROR|FATAL' "$PROBE/restore.log" >&2 || tail -5 "$PROBE/restore.log" >&2; fehler "Wiederherstellung abgebrochen"; }
echo "  ohne Fehler durchgelaufen"

schritt "Katalog und erneuter Dump der Probe"
pg < "$REPO/scripts/backup/katalog.sql" > "$PROBE/katalog.json"
cli_skript "$SKRIPTE/data.sh" --use-copy --data-only -x storage.buckets_vectors -x storage.vector_indexes
cli_skript "$SKRIPTE/history_data.sh" --use-copy --data-only --schema supabase_migrations
im_image "$SKRIPTE/data.sh" > "$PROBE/data.sql"
im_image "$SKRIPTE/history_data.sh" > "$PROBE/history_data.sql"
echo "  data.sql $(wc -c < "$PROBE/data.sql") Bytes"

schritt "Vergleich mit der Quelle"
node "$REPO/scripts/verify-backup.mjs" vergleich "$QUELLE" "$PROBE"

# Erst NACH dem Vergleich: das Hochladen schreibt storage.objects neu
# (Zeitstempel, eTag, Version), so wie bei jeder echten Wiederherstellung.
schritt "Storage-Dateien"
VB_ZIEL_SCHLUESSEL="$SERVICE_ROLE_KEY" node "$REPO/scripts/backup/dateien.mjs" hochladen "$QUELLE" "$API_URL"

if [ -n "${VB_PROBE_ANMELDUNG:-}" ]; then
  schritt "Anmeldung mit Probe-Konto"
  mail="${VB_PROBE_ANMELDUNG%%:*}"; pw="${VB_PROBE_ANMELDUNG#*:}"
  code="$(MAIL="$mail" PW="$pw" node -e 'process.stdout.write(JSON.stringify({email:process.env.MAIL,password:process.env.PW}))' \
    | curl -sS -o "$PROBE/anmeldung.json" -w '%{http_code}' -X POST "$API_URL/auth/v1/token?grant_type=password" \
        -H "apikey: $ANON_KEY" -H 'content-type: application/json' --data-binary @-)"
  [ "$code" = 200 ] && grep -q '"access_token"' "$PROBE/anmeldung.json" || fehler "Anmeldung nach Wiederherstellung: HTTP $code"
  rm -f "$PROBE/anmeldung.json"
  echo "  $mail meldet sich am wiederhergestellten Auth-Dienst an (HTTP 200)"
fi

echo
echo "Wiederherstellungsprobe: bestanden"
