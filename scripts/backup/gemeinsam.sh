# shellcheck shell=bash
# ============================================================
# gemeinsam.sh — Hilfen fuer sichern.sh und wiederherstellen-probe.sh.
# Wird per `source` geladen, laeuft nicht allein.
#
# Alles, was mit Postgres spricht, laeuft im Image supabase/postgres (das
# Image, mit dem auch die Supabase-CLI ihre Dumps macht): pg_dump und psql
# passen dann immer zur Serverversion, egal was auf dem Rechner liegt.
# ============================================================

# Image fuer pg_dump/psql. Vorgabe: dieselbe Version wie Live (17.6.1.147,
# gemessen 04.11.2026), per Digest angeheftet.
: "${VB_PG_IMAGE:=supabase/postgres:17.6.1.147@sha256:ac581882596ed0e46937ea6dd53a627d09f53e005d7264c2082a7ff7b62eaaca}"
: "${SUPABASE_BIN:=supabase}"

HIER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HIER/../.." && pwd)"

fehler() { echo "FEHLER: $*" >&2; exit 1; }
schritt() { echo; echo "── $* ──"; }

# Zerlegt eine Postgres-URL in PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE.
# Das Passwort geht nie auf stdout; URL_OHNE_PASSWORT ist zum Anzeigen da.
verbindung_setzen() {
  local url="$1"
  [ -n "$url" ] || fehler "keine Datenbank-URL"
  local zeilen
  zeilen="$(VB_URL="$url" node -e '
    const u = new URL(process.env.VB_URL);
    if (!/^postgres(ql)?:$/.test(u.protocol)) { console.error("keine postgres-URL"); process.exit(1); }
    const q = (s) => "\x27" + String(s).replace(/\x27/g, "\x27\\\x27\x27") + "\x27";
    const out = {
      PGHOST: u.hostname, PGPORT: u.port || "5432", PGUSER: decodeURIComponent(u.username),
      PGPASSWORD: decodeURIComponent(u.password), PGDATABASE: (u.pathname || "/postgres").slice(1) || "postgres",
      PGSSLMODE: u.searchParams.get("sslmode") || (/^(127\.0\.0\.1|localhost)$/.test(u.hostname) ? "disable" : "require"),
    };
    const ohne = new URL(u.href); ohne.password = ""; ohne.search = "";
    out.URL_OHNE_PASSWORT = ohne.href;
    for (const [k, v] of Object.entries(out)) console.log(`${k}=${q(v)}`);
  ')" || fehler "Datenbank-URL nicht lesbar"
  eval "$zeilen"
  export PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE PGSSLMODE
  [ -n "$PGUSER" ] || fehler "Datenbank-URL ohne Benutzer"
}

# psql im Postgres-Image; SQL kommt ueber stdin.
pg() {
  docker run --rm -i --network host \
    -e PGHOST -e PGPORT -e PGUSER -e PGPASSWORD -e PGDATABASE -e PGSSLMODE \
    --entrypoint psql "$VB_PG_IMAGE" -X -At -q -v ON_ERROR_STOP=1 "$@"
}

# Fuehrt ein Skript (Datei) im Postgres-Image aus; stdout = Dump.
im_image() {
  local skript="$1"
  docker run --rm -i --network host \
    -e PGHOST -e PGPORT -e PGUSER -e PGPASSWORD -e PGDATABASE -e PGSSLMODE \
    --entrypoint bash "$VB_PG_IMAGE" -s < "$skript"
}

# Holt das pg_dump-Skript der Supabase-CLI (--dry-run, ohne Passwort) und
# nimmt genau zwei Dinge heraus:
#   * die export-Zeilen (Verbindung kommt aus unserer Umgebung),
#   * `--role "postgres"`: die CLI wechselt sonst per SET ROLE auf postgres,
#     und das darf die Nur-Lese-Rolle vb_backup nicht (sie soll es auch nie
#     duerfen, sonst koennte sie schreiben).
# Alles andere (ausgeschlossene Schemas, sed-Filter) bleibt Wort fuer Wort
# das offizielle Verfahren. Aendert die CLI ihr Format, reisst es hier.
cli_skript() {
  local ziel="$1"; shift
  local roh="$ziel.roh"
  # ausserhalb des Repos aufrufen: die CLI legt im Arbeitsordner supabase/.temp an
  ( cd "${TMPDIR:-/tmp}" && "$SUPABASE_BIN" db dump --db-url "$URL_OHNE_PASSWORT" --dry-run "$@" ) > "$roh" 2> "$roh.err" \
    || { tail -20 "$roh.err" >&2; fehler "supabase db dump --dry-run $* schlug fehl"; }
  grep -Eq '^(pg_dump|pg_dumpall) \\$' "$roh" || fehler "CLI-Skript ($*) ohne pg_dump-Aufruf — Format geaendert?"
  grep -Eq '^    --role "postgres" \\$' "$roh" || fehler "CLI-Skript ($*) ohne --role-Zeile — Format geaendert, Filter pruefen"
  sed -E '/^export PG[A-Z]+=/d; /^    --role "postgres" \\$/d' "$roh" > "$ziel"
  ! grep -Eq -- '--role[ =]' "$ziel" || fehler "CLI-Skript ($*) enthaelt nach dem Filtern noch --role"
  rm -f "$roh" "$roh.err"
}

sha256() { sha256sum "$1" | cut -d' ' -f1; }
