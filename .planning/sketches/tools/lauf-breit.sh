cd "G:/Projects/games/Star Citizen/sc-patch-archive/.claude/worktrees/kurze-einfache-berichte-e15d3e"
echo "### 1. Ueberschrift unter der Kante (784 Seiten x 3)"
PAGES_FILE=pages-massiv.json VP_LIST=844x390,932x430,320x568 PORT_NR=4291 node .planning/sketches/tools/probe-h1-sichtbar.mjs 2>/dev/null | tail -40
echo
echo "### 2. Wortbruch in Ueberschriften (784 Seiten x 3)"
PAGES_FILE=pages-massiv.json VP_LIST=320x568,360x640,390x844 PORT_NR=4292 node .planning/sketches/tools/mess-wortbruch.mjs 2>/dev/null | tail -25
echo
echo "### 3. Abgeschnittene Felder (784 Seiten x 3)"
PAGES_FILE=pages-massiv.json VP_LIST=320x568,390x844,844x390 PORT_NR=4293 node .planning/sketches/tools/probe-abgeschnittenes-feld.mjs 2>/dev/null | tail -20
echo
echo "### 4. Sprachpaar-CSS"
node .planning/sketches/tools/probe-sprachpaar-css.mjs 2>&1 | tail -6
