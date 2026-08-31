cd "G:/Projects/games/Star Citizen/sc-patch-archive/.claude/worktrees/kurze-einfache-berichte-e15d3e"
echo "### 1. Ueberschrift unter der Kante (784 Seiten x 4 Aufloesungen)"
PAGES_FILE=pages-massiv.json VP_LIST=844x390,932x430,320x568,390x844 PORT_NR=4311 node .planning/sketches/tools/probe-h1-sichtbar.mjs 2>&1 | tail -28
echo
echo "### 2. Wortbruch in Ueberschriften (784 x 3)"
PAGES_FILE=pages-massiv.json VP_LIST=320x568,360x640,390x844 PORT_NR=4312 node .planning/sketches/tools/mess-wortbruch.mjs 2>&1 | tail -22
echo
echo "### 3. Abgeschnittene Auswahlfelder (784 x 3)"
PAGES_FILE=pages-massiv.json VP_LIST=320x568,390x844,844x390 PORT_NR=4313 node .planning/sketches/tools/probe-abgeschnittenes-feld.mjs 2>&1 | tail -18
echo
echo "### 4. Ellipsen, die wirklich greifen (784 x 2)"
PAGES_FILE=pages-massiv.json VP_LIST=320x568,360x640 PORT_NR=4314 node .planning/sketches/tools/mess-ellipse.mjs 2>&1 | tail -18
echo
echo "### 5. Tabfallen"
VP_LIST=320x568,390x844 node .planning/sketches/tools/mess-tabfalle.mjs /missionen.html /schiffe.html /crafting.html /topics/crafting.html /topics/mining.html /items.html /archiv.html /index.html /de/missionen.html /de.html /armor-sets.html /evolution.html 2>&1 | tail -26
