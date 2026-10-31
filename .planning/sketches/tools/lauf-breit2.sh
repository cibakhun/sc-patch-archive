cd "G:/Projects/games/Star Citizen/sc-patch-archive/.claude/worktrees/kurze-einfache-berichte-e15d3e"
echo "### Ueberschrift unter der Kante (784 x 4)"
PAGES_FILE=pages-massiv.json VP_LIST=844x390,932x430,320x568,390x844 PORT_NR=4301 node .planning/sketches/tools/probe-h1-sichtbar.mjs 2>&1 | tail -30
echo
echo "### Wortbruch (784 x 3)"
PAGES_FILE=pages-massiv.json VP_LIST=320x568,360x640,390x844 PORT_NR=4302 node .planning/sketches/tools/mess-wortbruch.mjs 2>&1 | tail -25
echo
echo "### Ellipsen, die greifen (784 x 2)"
PAGES_FILE=pages-massiv.json VP_LIST=320x568,360x640 PORT_NR=4303 node .planning/sketches/tools/mess-ellipse.mjs 2>&1 | tail -20
echo
echo "### Tabfallen (Stichprobe)"
VP_LIST=320x568,390x844 node .planning/sketches/tools/mess-tabfalle.mjs /missionen.html /schiffe.html /crafting.html /topics/crafting.html /topics/mining.html /items.html /archiv.html /index.html /de/missionen.html /de.html 2>&1 | tail -22
