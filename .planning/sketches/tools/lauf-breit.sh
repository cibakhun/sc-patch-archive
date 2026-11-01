# Vier Sonden des Breitbild-Durchgangs nacheinander, Kurzbericht je Sonde.
#
# Bis zum 01.11.2026 stand hier ein fester Worktree-Pfad eines einzelnen
# Rechners, und `2>/dev/null | tail` verschluckte beides: die einzige
# Fehlerausgabe und den Rueckgabewert jeder Sonde. Eine abgestuerzte Sonde sah
# damit aus wie eine saubere.
set -uo pipefail
cd "$(dirname "$0")/../../.." || exit 1

fehler=0
melde() {
  if [ "$1" -ne 0 ]; then
    echo "  ABGEBROCHEN (Rueckgabewert $1)"
    fehler=$((fehler + 1))
  fi
}

echo "### 1. Ueberschrift unter der Kante (784 Seiten x 3)"
PAGES_FILE=pages-massiv.json VP_LIST=844x390,932x430,320x568 PORT_NR=4291 node .planning/sketches/tools/probe-h1-sichtbar.mjs 2>&1 | tail -40
melde "${PIPESTATUS[0]}"
echo
echo "### 2. Wortbruch in Ueberschriften (784 Seiten x 3)"
PAGES_FILE=pages-massiv.json VP_LIST=320x568,360x640,390x844 PORT_NR=4292 node .planning/sketches/tools/mess-wortbruch.mjs 2>&1 | tail -25
melde "${PIPESTATUS[0]}"
echo
echo "### 3. Abgeschnittene Felder (784 Seiten x 3)"
PAGES_FILE=pages-massiv.json VP_LIST=320x568,390x844,844x390 PORT_NR=4293 node .planning/sketches/tools/probe-abgeschnittenes-feld.mjs 2>&1 | tail -20
melde "${PIPESTATUS[0]}"
echo
echo "### 4. Sprachpaar-CSS"
node .planning/sketches/tools/probe-sprachpaar-css.mjs 2>&1 | tail -6
melde "${PIPESTATUS[0]}"

if [ "$fehler" -ne 0 ]; then
  echo
  echo "$fehler von 4 Sonden abgebrochen"
  exit 1
fi
