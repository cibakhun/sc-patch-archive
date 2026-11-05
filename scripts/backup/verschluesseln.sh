#!/usr/bin/env bash
# ============================================================
# verschluesseln.sh — packt eine Sicherung und verschluesselt sie mit age.
# Ablauf und Schluessel: docs/betrieb/datenbank-backup.md
#
#   VB_AGE_EMPFAENGER="age1… [age1…]" \
#     scripts/backup/verschluesseln.sh <sicherung> <ziel.tar.gz.age>
#
# Nur der OEFFENTLICHE Schluessel des Betreibers kommt hierher. Den privaten
# gibt es nur beim Betreiber; wer das Archiv findet, kann es nicht lesen.
#
# PROBE OHNE DEN PRIVATEN SCHLUESSEL: Das Archiv wird zusaetzlich an einen
# Wegwerf-Schluessel verschluesselt, der nur in diesem Lauf existiert. Mit
# ihm wird das fertige Archiv sofort wieder entschluesselt und mit dem
# Klartext verglichen (sha256). Danach wird der Wegwerf-Schluessel geloescht;
# lesbar bleibt das Archiv nur fuer die Empfaenger aus VB_AGE_EMPFAENGER.
# So beweist jeder Lauf, dass genau das verifizierte Archiv verschluesselt
# vorliegt, ohne dass der private Schluessel je in CI liegt.
# ============================================================
set -euo pipefail

QUELLE="$(cd "${1:?Sicherungsordner fehlt}" && pwd)"
ZIEL="${2:?Zieldatei fehlt}"
[ -f "$QUELLE/manifest.json" ] || { echo "FEHLER: $QUELLE/manifest.json fehlt — erst sichern.sh" >&2; exit 1; }
command -v age >/dev/null && command -v age-keygen >/dev/null || { echo "FEHLER: age fehlt" >&2; exit 1; }

empfaenger=()
anzahl=0
for e in ${VB_AGE_EMPFAENGER:-}; do
  [[ "$e" =~ ^age1[02-9ac-hj-np-z]{58}$ ]] || { echo "FEHLER: kein age-Empfaenger: ${e:0:12}…" >&2; exit 1; }
  empfaenger+=(-r "$e")
  anzahl=$((anzahl + 1))
done
[ "${#empfaenger[@]}" -gt 0 ] || { echo "FEHLER: VB_AGE_EMPFAENGER leer — ohne Empfaenger kein Archiv" >&2; exit 1; }
[ ! -e "$ZIEL" ] || { echo "FEHLER: $ZIEL gibt es schon — nichts wird ueberschrieben" >&2; exit 1; }

ARBEIT="$(mktemp -d)"
# Bricht ein Schritt ab, verschwindet auch das (dann ungepruefte) Archiv:
# liegen bleibt nur, was die Probe unten bestanden hat.
aufraeumen() {
  local rc=$?
  rm -rf "$ARBEIT"
  [ "$rc" = 0 ] || rm -f "$ZIEL" "$ZIEL.sha256"
}
trap aufraeumen EXIT
umask 077

# reproduzierbares tar: feste Reihenfolge, Besitzer und Zeit
tar --sort=name --owner=0 --group=0 --numeric-owner --mtime='@0' \
    -C "$QUELLE" -cf - . | gzip -n -9 > "$ARBEIT/klar.tar.gz"
klar_sha="$(sha256sum "$ARBEIT/klar.tar.gz" | cut -d' ' -f1)"

age-keygen -o "$ARBEIT/wegwerf.key" 2>/dev/null
wegwerf="$(age-keygen -y "$ARBEIT/wegwerf.key")"
age "${empfaenger[@]}" -r "$wegwerf" -o "$ZIEL" "$ARBEIT/klar.tar.gz"

probe_sha="$(age -d -i "$ARBEIT/wegwerf.key" "$ZIEL" | sha256sum | cut -d' ' -f1)"
rm -f "$ARBEIT/wegwerf.key" "$ARBEIT/klar.tar.gz"
[ "$probe_sha" = "$klar_sha" ] || { echo "FEHLER: entschluesseltes Archiv weicht ab ($probe_sha statt $klar_sha)" >&2; exit 1; }

head -c 22 "$ZIEL" | grep -q '^age-encryption.org/v1' || { echo "FEHLER: $ZIEL hat keinen age-Kopf" >&2; exit 1; }
age_sha="$(sha256sum "$ZIEL" | cut -d' ' -f1)"
printf '%s  %s\n' "$age_sha" "$(basename "$ZIEL")" > "$ZIEL.sha256"
printf '%s  %s\n' "$klar_sha" "klartext.tar.gz" >> "$ZIEL.sha256"

echo "  $(basename "$ZIEL"): $(wc -c < "$ZIEL") Bytes, ${anzahl} Empfaenger (+1 Wegwerf-Schluessel, geloescht)"
echo "  Probe: mit dem Wegwerf-Schluessel entschluesselt, sha256 gleich dem Klartext ($klar_sha)"
