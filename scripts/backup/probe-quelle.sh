#!/usr/bin/env bash
# ============================================================
# probe-quelle.sh — baut die ERFUNDENE Quelle fuer die Backup-Sonde.
#
#   scripts/backup/probe-quelle.sh <env-datei>
#
# Ein lokaler Supabase-Stack (Ports 543xx) aus allen Dateien in
# supabase/migrations/ — also so, wie Live nach dem Einspielen des Repos
# aussieht —, dazu drei Konten ueber die Admin-API des lokalen Auth-Dienstes
# (der Trigger on_auth_user_created legt wie live die Profile an), die Zeilen
# aus probe-seed.sql und zwei Bilder in Storage. Die Backup-Rolle vb_backup
# kommt aus ihrer Migration und bekommt hier LOGIN mit einem Zufallspasswort,
# genau wie es der Betreiber auf Live tut.
#
# Schreibt VB_DB_URL, VB_STORAGE_URL, VB_PROBE_ANMELDUNG und QUELL_STACK in
# <env-datei>. Kein echter Datensatz, kein Live-Zugang.
# ============================================================
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/gemeinsam.sh"

ENVDATEI="${1:?env-Datei fehlt}"
STACK="$(mktemp -d)"
( cd "$STACK" && "$SUPABASE_BIN" init --force >/dev/null 2>&1 )
sed -i -E 's/^project_id = .*/project_id = "vb-probe-quelle"/' "$STACK/supabase/config.toml"
mkdir -p "$STACK/supabase/migrations"
cp "$REPO"/supabase/migrations/*.sql "$STACK/supabase/migrations/"

schritt "Quell-Stack aus $(ls "$STACK/supabase/migrations" | wc -l) Migrationen"
"$SUPABASE_BIN" start --workdir "$STACK" \
  -x realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor,postgrest > "$STACK/start.log" 2>&1 \
  || { tail -30 "$STACK/start.log" >&2; fehler "Quell-Stack startet nicht"; }
eval "$("$SUPABASE_BIN" status --workdir "$STACK" -o env 2>/dev/null | grep -E '^(DB_URL|API_URL|SERVICE_ROLE_KEY)=')"
case "$DB_URL" in *127.0.0.1:543*) ;; *) fehler "Quelle ist nicht der lokale Stack ($DB_URL)";; esac
verbindung_setzen "$DB_URL"

schritt "Erfundene Konten, Zeilen, Dateien"
for n in a b c; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API_URL/auth/v1/admin/users" \
    -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H 'content-type: application/json' \
    -d "{\"email\":\"$n@probe.invalid\",\"password\":\"probe-$n-passwort\",\"email_confirm\":true}")"
  [ "$code" = 200 ] || fehler "Probe-Konto $n: HTTP $code"
done
pg < "$REPO/scripts/backup/probe-seed.sql"
uid="$(pg -c "select id from auth.users where email = 'a@probe.invalid'")"
node -e '
  const zlib = require("zlib");
  const png = (w, h, rgb) => {
    const raw = Buffer.concat(Array.from({ length: h }, () => Buffer.from([0, ...Array(w).fill(rgb).flat()])));
    const crcTab = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
    const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTab[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    const ch = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 2, 0, 0, 0], 8);
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ch("IHDR", ihdr), ch("IDAT", zlib.deflateSync(raw)), ch("IEND", Buffer.alloc(0))]);
  };
  require("fs").writeFileSync(process.argv[1] + "/a.png", png(32, 32, [200, 40, 40]));
  require("fs").writeFileSync(process.argv[1] + "/b.png", png(64, 16, [40, 40, 200]));
' "$STACK"
for f in "avatars/$uid/avatar:a.png" "banners/$uid/banner:b.png"; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API_URL/storage/v1/object/${f%%:*}" \
    -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H 'content-type: image/png' \
    --data-binary "@$STACK/${f##*:}")"
  [ "$code" = 200 ] || fehler "Probe-Datei ${f%%:*}: HTTP $code"
done

schritt "Backup-Rolle freischalten (wie der Betreiber auf Live)"
pw="$(node -e 'process.stdout.write(require("crypto").randomBytes(24).toString("hex"))')"
pg -c "alter role vb_backup with login password '$pw'"

{
  echo "VB_DB_URL=postgresql://vb_backup:$pw@127.0.0.1:${PGPORT}/postgres"
  echo "VB_STORAGE_URL=$API_URL"
  echo "VB_PROBE_ANMELDUNG=a@probe.invalid:probe-a-passwort"
  echo "QUELL_STACK=$STACK"
} > "$ENVDATEI"
echo "  3 Konten, $(pg -c 'select count(*) from storage.objects') Dateien, Rolle vb_backup mit LOGIN"
