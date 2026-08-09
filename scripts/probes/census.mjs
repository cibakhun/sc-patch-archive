// Bestandsaufnahme: Welche Entitätsklassen und Komponententypen gibt es — und was steckt drin?
const LIB = 'file:///G:/Projects/games/Star%20Citizen/sc-patch-archive/.claude/worktrees/website-performance-analysis-72bef1/scripts/lib/';
const { openP4k, DEFAULT_P4K } = await import(LIB + 'p4k.mjs');
const { openDataCore } = await import(LIB + 'datacore.mjs');
const { writeFileSync } = await import('node:fs');

const t0 = Date.now();
const p4k = openP4k(DEFAULT_P4K);
const dcb = p4k.read(/^Data[\\/]Game2\.dcb$/i);
p4k.close();
const db = openDataCore(dcb);
console.error(`DataCore offen nach ${((Date.now() - t0) / 1000).toFixed(1)}s — ${db.records.length} Records`);

// ---- 1) Record-Typen (Präfix vor dem ersten Punkt) ----
const byType = new Map();
for (const r of db.records) {
  const t = (r.name || '?').split('.')[0];
  byType.set(t, (byType.get(t) || 0) + 1);
}

// ---- 2) Entitäten nach Pfad-Kategorie ----
const CATS = [
  ['Items / SCItem', /entities[\\/]scitem[\\/]/i],
  ['Schiffe & Fahrzeuge', /entities[\\/](spaceships|vehicles|ships)[\\/]/i],
  ['Actors / NPCs', /actor[\\/]actors/i],
  ['Crafting-Blueprints', /crafting[\\/]blueprints/i],
  ['Missionen', /missions?[\\/]/i],
  ['Shops / Läden', /shop|retail|kiosk/i],
  ['Loot', /loot/i],
];
const ents = db.records.filter(r => /^EntityClassDefinition\./.test(r.name || ''));
console.error(`EntityClassDefinition-Records: ${ents.length}`);

// ---- 3) Komponenten-Zählung über SCItems (flach gelesen) ----
const items = ents.filter(r => /entities[\\/]scitem[\\/]/i.test(r.fileName || ''));
console.error(`SCItem-Entitäten: ${items.length} — zähle Komponenten (flach)…`);

const compCount = new Map();   // Komponentenschlüssel -> Anzahl Items
const compFields = new Map();  // Komponentenschlüssel -> Set der Blattfelder
const subCat = new Map();      // Unterordner unter scitem/ -> Anzahl
let done = 0, failed = 0;
const tScan = Date.now();

const leafNames = (node, into, depth = 0) => {
  if (!node || depth > 3) return;
  if (Array.isArray(node)) { for (const v of node.slice(0, 3)) leafNames(v, into, depth + 1); return; }
  if (typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node)) {
    if (v === null || typeof v !== 'object') into.add(k);
    else leafNames(v, into, depth + 1);
  }
};

for (const r of items) {
  const sub = (r.fileName || '').replace(/\\/g, '/').split('entities/scitem/')[1]?.split('/').slice(0, 2).join('/') || '?';
  subCat.set(sub, (subCat.get(sub) || 0) + 1);
  let o;
  try { o = db.readRecord(r, { readRef: false }); } catch { failed++; continue; }
  for (const c of o?.Components || []) {
    if (!c) continue;
    for (const key of Object.keys(c)) {
      compCount.set(key, (compCount.get(key) || 0) + 1);
      if (!compFields.has(key)) compFields.set(key, new Set());
      const s = compFields.get(key);
      if (s.size < 40) leafNames(c[key], s);
    }
  }
  if (++done % 1000 === 0) console.error(`   ${done}/${items.length} …`);
}
const scanS = ((Date.now() - tScan) / 1000).toFixed(1);

// ---- Ausgabe ----
const out = [];
const P = (s = '') => out.push(s);
P('# Bestandsaufnahme Spieldaten — Data.p4k, Patch 4.9 (29.07.2026)');
P(`\nRecords gesamt: **${db.records.length}** · EntityClassDefinition: **${ents.length}** · davon SCItem: **${items.length}**`);
P(`Flach-Scan: ${scanS}s, Lesefehler: ${failed}`);

P('\n## 1) Record-Typen (Top 40 von ' + byType.size + ')');
P('\n| Typ | Anzahl |\n|---|---|');
for (const [t, n] of [...byType].sort((a, b) => b[1] - a[1]).slice(0, 40)) P(`| ${t} | ${n} |`);

P('\n## 2) Entitäten nach Kategorie');
P('\n| Kategorie | Records |\n|---|---|');
for (const [label, rx] of CATS) P(`| ${label} | ${db.records.filter(r => rx.test(r.fileName || '')).length} |`);

P('\n## 3) SCItem-Unterkategorien (Top 30)');
P('\n| Pfad unter scitem/ | Items |\n|---|---|');
for (const [s, n] of [...subCat].sort((a, b) => b[1] - a[1]).slice(0, 30)) P(`| ${s} | ${n} |`);

P('\n## 4) Komponententypen über alle SCItems — die Extraktor-Liste');
P(`\n**${compCount.size} verschiedene Komponententypen.** Abdeckung = Anteil der ${items.length} Items, die sie tragen.`);
P('\n| # | Komponente | Items | Abdeckung | Felder (Auszug) |\n|---|---|---|---|---|');
let i = 0;
for (const [k, n] of [...compCount].sort((a, b) => b[1] - a[1])) {
  const f = [...(compFields.get(k) || [])].slice(0, 8).join(', ');
  P(`| ${++i} | \`${k}\` | ${n} | ${(n / items.length * 100).toFixed(1)} % | ${f} |`);
}

writeFileSync('BESTANDSAUFNAHME.md', out.join('\n'));
console.error('\n>>> BESTANDSAUFNAHME.md geschrieben (' + out.length + ' Zeilen)');
console.log(out.slice(0, 120).join('\n'));
