# Vier Sonden des zweiten Breitbild-Durchgangs, Kurzbericht je Sonde.
#
# Bis zum 01.11.2026 stand hier ein fester Worktree-Pfad eines einzelnen
# Rechners, und `| tail` verschluckte den Rueckgabewert jeder Sonde: eine
# abgestuerzte Sonde sah aus wie eine saubere. cubic hat das an den beiden
# Geschwisterskripten gemeldet; hier stand dieselbe Zeile.
set -uo pipefail
cd "$(dirname "$0")/../../.." || exit 1

fehler=0
melde() {
  if [ "$1" -ne 0 ]; then
    echo "  ABGEBROCHEN (Rueckgabewert $1)"
    fehler=$((fehler + 1))
  fi
}

echo "### Ueberschrift unter der Kante (784 x 4)"
PAGES_FILE=pages-massiv.json VP_LIST=844x390,932x430,320x568,390x844 PORT_NR=4301 node .planning/sketches/tools/probe-h1-sichtbar.mjs 2>&1 | tail -30
melde "${PIPESTATUS[0]}"
echo
echo "### Wortbruch (784 x 3)"
PAGES_FILE=pages-massiv.json VP_LIST=320x568,360x640,390x844 PORT_NR=4302 node .planning/sketches/tools/mess-wortbruch.mjs 2>&1 | tail -25
melde "${PIPESTATUS[0]}"
echo
echo "### Ellipsen, die greifen (784 x 2)"
PAGES_FILE=pages-massiv.json VP_LIST=320x568,360x640 PORT_NR=4303 node .planning/sketches/tools/mess-ellipse.mjs 2>&1 | tail -20
melde "${PIPESTATUS[0]}"
echo
echo "### Tabfallen (Stichprobe)"
VP_LIST=320x568,390x844 node .planning/sketches/tools/mess-tabfalle.mjs /missionen.html /schiffe.html /crafting.html /topics/crafting.html /topics/mining.html /items.html /archiv.html /index.html /de/missionen.html /de.html 2>&1 | tail -22
melde "${PIPESTATUS[0]}"

if [ "$fehler" -ne 0 ]; then
  echo
  echo "$fehler von 4 Sonden abgebrochen"
  exit 1
fi
