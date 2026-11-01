# Fuenf Sonden des Abschlusslaufs nacheinander, Kurzbericht je Sonde.
#
# Bis zum 01.11.2026 stand hier ein fester Worktree-Pfad eines einzelnen
# Rechners, und `| tail` verschluckte den Rueckgabewert jeder Sonde: eine
# abgestuerzte Sonde sah aus wie eine saubere.
set -uo pipefail
cd "$(dirname "$0")/../../.." || exit 1

fehler=0
melde() {
  if [ "$1" -ne 0 ]; then
    echo "  ABGEBROCHEN (Rueckgabewert $1)"
    fehler=$((fehler + 1))
  fi
}

echo "### 1. Ueberschrift unter der Kante (784 Seiten x 4 Aufloesungen)"
PAGES_FILE=pages-massiv.json VP_LIST=844x390,932x430,320x568,390x844 PORT_NR=4311 node .planning/sketches/tools/probe-h1-sichtbar.mjs 2>&1 | tail -28
melde "${PIPESTATUS[0]}"
echo
echo "### 2. Wortbruch in Ueberschriften (784 x 3)"
PAGES_FILE=pages-massiv.json VP_LIST=320x568,360x640,390x844 PORT_NR=4312 node .planning/sketches/tools/mess-wortbruch.mjs 2>&1 | tail -22
melde "${PIPESTATUS[0]}"
echo
echo "### 3. Abgeschnittene Auswahlfelder (784 x 3)"
PAGES_FILE=pages-massiv.json VP_LIST=320x568,390x844,844x390 PORT_NR=4313 node .planning/sketches/tools/probe-abgeschnittenes-feld.mjs 2>&1 | tail -18
melde "${PIPESTATUS[0]}"
echo
echo "### 4. Ellipsen, die wirklich greifen (784 x 2)"
PAGES_FILE=pages-massiv.json VP_LIST=320x568,360x640 PORT_NR=4314 node .planning/sketches/tools/mess-ellipse.mjs 2>&1 | tail -18
melde "${PIPESTATUS[0]}"
echo
echo "### 5. Tabfallen"
VP_LIST=320x568,390x844 node .planning/sketches/tools/mess-tabfalle.mjs /missionen.html /schiffe.html /crafting.html /topics/crafting.html /topics/mining.html /items.html /archiv.html /index.html /de/missionen.html /de.html /armor-sets.html /evolution.html 2>&1 | tail -26
melde "${PIPESTATUS[0]}"

if [ "$fehler" -ne 0 ]; then
  echo
  echo "$fehler von 5 Sonden abgebrochen"
  exit 1
fi
