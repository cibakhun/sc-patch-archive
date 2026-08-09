// ALLES zu Dust Devil aus den Spieldateien + den eigenen Datensätzen.
const LIB = 'file:///G:/Projects/games/Star%20Citizen/sc-patch-archive/.claude/worktrees/website-performance-analysis-72bef1/scripts/lib/';
const REPO = 'G:/Projects/games/Star Citizen/sc-patch-archive/.claude/worktrees/website-performance-analysis-72bef1/';
const { openP4k, DEFAULT_P4K } = await import(LIB + 'p4k.mjs');
const { openDataCore } = await import(LIB + 'datacore.mjs');
const { buildTagIndex } = await import(LIB + 'tags.mjs');
const { readFileSync, writeFileSync } = await import('node:fs');

const out = [];
const P = (s = '') => { out.push(s); console.log(s); };

const p4k = openP4k(DEFAULT_P4K);
const dcb = p4k.read(/^Data[\\/]Game2\.dcb$/i);
const iniEn = p4k.read(/Localization[\\/]english[\\/]global\.ini$/i).toString('utf8');
let iniDe = null;
for (const rx of [/Localization[\\/]german[\\/]global\.ini$/i, /Localization[\\/]german_\(germany\)[\\/]global\.ini$/i]) {
  try { iniDe = p4k.read(rx).toString('utf8'); break; } catch {}
}
p4k.close();
const mk = (ini) => { const m = new Map(); if (!ini) return m; for (const l of ini.split(/\r?\n/)) { const i = l.indexOf('='); if (i > 0) m.set(l.slice(0, i).replace(/^\uFEFF/, '').toLowerCase(), l.slice(i + 1)); } return m; };
const EN = mk(iniEn), DE = mk(iniDe);
const L = (map, k) => { if (!k || typeof k !== 'string' || !k.startsWith('@')) return null; const v = map.get(k.slice(1).toLowerCase()); return v && !/TRANSLATION NOT FOUND|^@|PLACEHOLDER/.test(v) ? v : null; };

const db = openDataCore(dcb);
const TAGS = buildTagIndex(db);

const STEMS = [
  ['srvl_armor_heavy_core_02_01_01', 'Dust Devil Armor Core'],
  ['srvl_armor_heavy_arms_02_01_01', 'Dust Devil Armor Arms'],
  ['srvl_armor_heavy_legs_02_01_01', 'Dust Devil Armor Legs'],
  ['srvl_armor_heavy_core_02_02_01', 'Dust Devil Core Epoque'],
  ['srvl_combat_heavy_arms_02_02_01', 'Dust Devil Arms Epoque'],
  ['srvl_armor_heavy_legs_02_02_01', 'Dust Devil Legs Epoque'],
];
const comp = (arr, key) => { for (const c of arr || []) if (c && c[key] !== undefined) return c[key]; return null; };
const num = (n) => typeof n === 'number' ? Math.round(n * 1000) / 1000 : n;

P('# ALLES zu Dust Devil — aus Data.p4k (Stand 29.07.2026, Patch 4.9)\n');

for (const [stem, label] of STEMS) {
  const rec = db.records.find(r => r.name === 'EntityClassDefinition.' + stem);
  P('\n' + '='.repeat(78));
  P('## ' + label + '   [' + stem + ']');
  P('='.repeat(78));
  if (!rec) { P('   KEIN Record gefunden.'); continue; }
  P('Datei: ' + rec.fileName);

  const shallow = db.readRecord(rec, { readRef: false });
  const full = db.readRecord(rec, { readRef: true });
  const C = full.Components || [];

  // Namen / Beschreibung
  const disp = comp(C, 'Display') ?? {};
  const dn = comp(C, 'displayName');
  P('\n### Namen');
  P('  EN : ' + (L(EN, `@item_Name_${stem}`) ?? '—'));
  P('  DE : ' + (L(DE, `@item_Name_${stem}`) ?? '— (keine dt. Übersetzung)'));
  const descEn = L(EN, `@item_Desc_${stem}`) ?? L(EN, `@item_Description_${stem}`);
  if (descEn) P('  Beschreibung EN: ' + descEn.replace(/\\n/g, ' ').slice(0, 300));
  const descDe = L(DE, `@item_Desc_${stem}`) ?? L(DE, `@item_Description_${stem}`);
  P('  Beschreibung DE: ' + (descDe ? descDe.replace(/\\n/g, ' ').slice(0, 300) : '— (fehlt)'));

  // Kernwerte
  const att = comp(C, 'AttachDef') ?? {};
  const phys = comp(C, 'PhysType') ?? {};
  P('\n### Kernwerte');
  P('  Masse        : ' + num(phys.Mass) + ' kg');
  P('  Größe / Grade: ' + att.Size + ' / ' + att.Grade);
  P('  Typ          : ' + (att.Type ?? '?') + ' / ' + (att.SubType ?? '?'));
  P('  Hersteller   : ' + (att.Manufacturer?.name ?? att.Manufacturer?.__ref ?? '—'));

  // Widerstände
  const dr = comp(C, 'damageResistance');
  P('\n### Schadenswiderstände (Multiplikator; niedriger = besser)');
  if (dr?.damageResistance) {
    for (const [k, v] of Object.entries(dr.damageResistance)) {
      if (v && typeof v === 'object' && 'Multiplier' in v) P('  ' + k.replace('Resistance', '').padEnd(14) + ': ×' + num(v.Multiplier));
    }
    P('  Nahkampf ignoriert: ' + dr.damageResistance.IgnoreMeleeDamage);
  }
  const ifr = comp(C, 'impactForceResistance');
  if (ifr) P('  Aufprallkraft : ×' + num(ifr.impactForceResistance ?? ifr));

  const tr = comp(C, 'TemperatureResistance');
  if (tr) P('\n### Temperatur\n  Aushaltbar: ' + tr.MinResistance + ' °C bis ' + tr.MaxResistance + ' °C');
  const rr = comp(C, 'RadiationResistance');
  if (rr) P('\n### Strahlung\n  Kapazität: ' + num(rr.MaximumRadiationCapacity) + ' | Abbaurate: ' + num(rr.RadiationDissipationRate) + '/s');

  // Bewegung + geschützte Körperteile
  const wmm = comp(C, 'wearMovementMultipliers');
  if (wmm) { P('\n### Bewegungseinfluss'); for (const [k, v] of Object.entries(wmm)) if (typeof v === 'number') P('  ' + k.padEnd(22) + ': ×' + num(v)); }
  const pbp = comp(C, 'protectedBodyParts');
  if (pbp) P('\n### Geschützte Körperteile\n  ' + JSON.stringify(pbp).slice(0, 300));

  // Stauraum
  const cp = comp(C, 'containerParams');
  if (cp) {
    const cap = JSON.stringify(cp).match(/"(?:capacity|microSCU|centiSCU|SCU)":\s*[\d.]+/g);
    P('\n### Stauraum\n  ' + (cap ? cap.join(' | ') : JSON.stringify(cp).slice(0, 260)));
  }

  // Anbauplätze (Taschen)
  const ports = comp(C, 'Ports');
  if (Array.isArray(ports) && ports.length) {
    P('\n### Anbauplätze (' + ports.length + ')');
    for (const pt of ports.slice(0, 12)) P('  - ' + (pt?.Name ?? '?') + '  (Size ' + (pt?.MinSize ?? '?') + '–' + (pt?.MaxSize ?? '?') + ')');
  }

  // Tags
  const paths = TAGS.pathsOf(shallow.tags) || [];
  P('\n### Tags (' + paths.length + ')');
  for (const t of paths) P('  · ' + t);
}

// ---------- Crafting ----------
P('\n\n' + '='.repeat(78));
P('## CRAFTING-BLUEPRINTS');
P('='.repeat(78));
for (const [stem, label] of STEMS) {
  const bp = db.records.find(r => r.name === 'CraftingBlueprintRecord.BP_CRAFT_' + stem);
  if (!bp) { P('\n' + label + ': kein Blueprint'); continue; }
  P('\n### ' + label);
  P('  Datei: ' + bp.fileName);
  const b = db.readRecord(bp, { readRef: true });
  const s = JSON.stringify(b);
  const mats = s.match(/"(?:resourceReference|itemReference|name)":"([^"]{4,60})"/g) || [];
  const times = s.match(/"(?:craftingTime|duration|timeSeconds)":\s*[\d.]+/g) || [];
  P('  Rohgröße: ' + s.length + ' Zeichen');
  P('  Zeitfelder: ' + (times.length ? times.join(', ') : '—'));
  P('  Referenzen (erste 20): ');
  for (const m of [...new Set(mats)].slice(0, 20)) P('     ' + m);
}

// ---------- Loot ----------
P('\n\n' + '='.repeat(78));
P('## LOOT-TABELLEN / -ARCHETYPEN');
P('='.repeat(78));
const lootRecs = db.records.filter(r => /^Loot(Archetype|Table)|LootArchetype|LootTable/i.test(r.name || ''));
P('Loot-Records gesamt: ' + lootRecs.length);
const stemRx = new RegExp(STEMS.map(s => s[0]).join('|'), 'i');
const lootHits = [];
for (const r of lootRecs) {
  try { const s = JSON.stringify(db.readRecord(r, { readRef: true })); if (stemRx.test(s)) lootHits.push(r.name); } catch {}
}
P('Direkte Treffer (Item namentlich in der Tabelle): ' + lootHits.length);
for (const n of lootHits.slice(0, 30)) P('   · ' + n);

// ---------- Eigene Daten ----------
P('\n\n' + '='.repeat(78));
P('## EIGENE DATENSÄTZE (was die Seite heute hat)');
P('='.repeat(78));
const uni = JSON.parse(readFileSync(REPO + 'assets/universal-items.json', 'utf8'));
const items = Array.isArray(uni) ? uni : (uni.items || Object.values(uni));
const prices = JSON.parse(readFileSync(REPO + 'src/data/item-prices.json', 'utf8'));
for (const [, label] of STEMS) {
  const it = items.find(i => i.name === label);
  P('\n### ' + label);
  if (!it) { P('  nicht im Katalog'); continue; }
  P('  obtain: ' + JSON.stringify(it.obtain || []).slice(0, 400));
  const pk = JSON.stringify(prices).includes(label) ? 'ja' : 'nein';
  P('  in item-prices.json: ' + pk);
}

writeFileSync('DUSTDEVIL-ALLES.md', out.join('\n'));
console.log('\n\n>>> geschrieben: DUSTDEVIL-ALLES.md');
