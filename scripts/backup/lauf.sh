#!/usr/bin/env bash
# ============================================================
# lauf.sh — ein ganzer Backup-Lauf: sichern, Wiederherstellungsprobe,
# verschluesseln, Bericht. Ablauf: docs/betrieb/datenbank-backup.md
#
#   VB_DB_URL=… VB_STORAGE_URL=… VB_AGE_EMPFAENGER=… \
#     scripts/backup/lauf.sh <arbeitsordner>
#
# Ergebnis in <arbeitsordner>/aus/ (nur das darf den Rechner verlassen):
#   verse-base-<zeit>.tar.gz.age        die verschluesselte Sicherung
#   verse-base-<zeit>.tar.gz.age.sha256 Pruefsummen (Archiv, Klartext-tar)
#   bericht.md / bericht.json           Zaehlungen und Versionen, keine Daten
# Der Klartext liegt nur waehrend des Laufs in <arbeitsordner>/klar und wird
# am Ende geloescht (VB_BEHALTEN=1 laesst ihn liegen — nur fuer die Sonde).
#
# Ein Fehler in irgendeinem Schritt beendet den Lauf mit Exit != 0 und es
# entsteht KEIN Archiv. Ein Archiv gibt es also nur, wenn die Probe bestanden
# hat.
# ============================================================
set -euo pipefail
HIER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HIER/../.." && pwd)"

ARBEIT="${1:?Arbeitsordner fehlt}"
mkdir -p "$ARBEIT"
ARBEIT="$(cd "$ARBEIT" && pwd)"
umask 077
KLAR="$ARBEIT/klar"
PROBE="$ARBEIT/probe"
AUS="$ARBEIT/aus"
rm -rf "$KLAR" "$PROBE" "$AUS"
mkdir -p "$AUS"
STEMPEL="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIV="$AUS/verse-base-$STEMPEL.tar.gz.age"
T0=$(date +%s)

loeschen() { [ "${VB_BEHALTEN:-}" = 1 ] || rm -rf "$KLAR" "$PROBE"; }
trap loeschen EXIT

echo "═══ 1/3 Sichern ═══"
"$HIER/sichern.sh" "$KLAR"
echo
echo "═══ 2/3 Wiederherstellungsprobe (abgeschottet) ═══"
"$HIER/wiederherstellen-probe.sh" "$KLAR" "$PROBE"
echo
echo "═══ 3/3 Verschluesseln ═══"
"$HIER/verschluesseln.sh" "$KLAR" "$ARCHIV"

# Bericht: nur Zaehlungen, Versionen, Pruefsummen — keine Zeile Nutzerdaten.
SUPA="$(cd "${TMPDIR:-/tmp}" && "${SUPABASE_BIN:-supabase}" --version 2>/dev/null | head -1)" \
DAUER=$(( $(date +%s) - T0 )) ARCHIV="$ARCHIV" KLAR="$KLAR" AUS="$AUS" STEMPEL="$STEMPEL" \
node -e '
  const fs = require("fs"), path = require("path");
  const m = JSON.parse(fs.readFileSync(path.join(process.env.KLAR, "manifest.json"), "utf8"));
  const sha = fs.readFileSync(process.env.ARCHIV + ".sha256", "utf8").trim().split("\n").map((l) => l.split(/\s+/)[0]);
  const tab = Object.entries(m.tabellen);
  const b = {
    zeit: process.env.STEMPEL, dauer_s: Number(process.env.DAUER), archiv: path.basename(process.env.ARCHIV),
    archiv_bytes: fs.statSync(process.env.ARCHIV).size, archiv_sha256: sha[0], klartext_sha256: sha[1],
    supabase_cli: process.env.SUPA, quelle: m.quelle, storage: m.storage,
    tabellen: tab.length, zeilen: tab.reduce((a, [, t]) => a + t.zeilen, 0),
    zeilen_je_tabelle: Object.fromEntries(tab.filter(([, t]) => t.zeilen > 0).map(([n, t]) => [n, t.zeilen])),
    probe: "bestanden",
  };
  fs.writeFileSync(path.join(process.env.AUS, "bericht.json"), JSON.stringify(b, null, 2) + "\n");
  const z = [
    `## ${process.env.VB_BERICHT_TITEL || "Live-Backup"} ${b.zeit}`, "",
    `**Probe-Wiederherstellung bestanden** · ${b.tabellen} Tabellen · ${b.zeilen} Zeilen · ${b.storage.dateien} Storage-Dateien (${b.storage.bytes} Bytes) · ${b.dauer_s} s`, "",
    `- Archiv: \`${b.archiv}\` (${b.archiv_bytes} Bytes, age)`,
    `- sha256 Archiv: \`${b.archiv_sha256}\``,
    `- sha256 Klartext-tar: \`${b.klartext_sha256}\``,
    `- Quelle: Postgres ${b.quelle.server_version}, ${b.quelle.migrationen} Migrationen bis ${b.quelle.letzte_migration}, Auth-Stand ${b.quelle.auth_stand}, Storage-Stand ${b.quelle.storage_stand}`,
    `- ${b.supabase_cli ? "Supabase-CLI " + b.supabase_cli : "Supabase-CLI ?"}`, "",
    "| Tabelle | Zeilen |", "|---|---:|",
    ...Object.entries(b.zeilen_je_tabelle).map(([n, v]) => `| ${n} | ${v} |`), "",
  ];
  fs.writeFileSync(path.join(process.env.AUS, "bericht.md"), z.join("\n"));
  console.log(`\nLauf fertig: ${b.archiv} (${b.archiv_bytes} Bytes), Probe bestanden, ${b.dauer_s} s`);
'
