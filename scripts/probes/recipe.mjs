const LIB = 'file:///G:/Projects/games/Star%20Citizen/sc-patch-archive/.claude/worktrees/website-performance-analysis-72bef1/scripts/lib/';
const { openP4k, DEFAULT_P4K } = await import(LIB + 'p4k.mjs');
const { openDataCore } = await import(LIB + 'datacore.mjs');

const p4k = openP4k(DEFAULT_P4K);
const dcb = p4k.read(/^Data[\\/]Game2\.dcb$/i);
const iniEn = p4k.read(/Localization[\\/]english[\\/]global\.ini$/i).toString('utf8');
p4k.close();
const EN = new Map();
for (const l of iniEn.split(/\r?\n/)) { const i = l.indexOf('='); if (i > 0) EN.set(l.slice(0, i).replace(/^\uFEFF/, '').toLowerCase(), l.slice(i + 1)); }
const L = (k) => { if (typeof k !== 'string' || !k.startsWith('@')) return k; const v = EN.get(k.slice(1).toLowerCase()); return (v && !/PLACEHOLDER|EMPTY/.test(v)) ? v : null; };

const db = openDataCore(dcb);
const PARTS = [['Core', 'srvl_armor_heavy_core_02_01_01'], ['Arms', 'srvl_armor_heavy_arms_02_01_01'], ['Legs', 'srvl_armor_heavy_legs_02_01_01']];

for (const [label, stem] of PARTS) {
  const rec = db.records.find(r => r.name === 'CraftingBlueprintRecord.BP_CRAFT_' + stem);
  console.log('\n' + '#'.repeat(64));
  console.log('# Dust Devil Armor ' + label);
  console.log('#'.repeat(64));
  const b = db.readRecord(rec, { readRef: false }).blueprint;
  console.log('Kategorie :', b.category?.name);
  for (const [ti, tier] of (b.tiers || []).entries()) {
    const c = tier?.recipe?.costs;
    if (!c) continue;
    const t = c.craftTime || {};
    console.log(`\n-- Stufe ${ti + 1} | Herstellzeit: ${t.days || 0}d ${t.hours || 0}h ${t.minutes || 0}m ${t.seconds || 0}s`);
    const walk = (node, depth) => {
      if (!node) return;
      const pad = '  '.repeat(depth);
      const nm = L(node.nameInfo?.displayName) || node.nameInfo?.debugName;
      if (node.resource) {
        const q = node.quantity?.standardCargoUnits;
        console.log(`${pad}• ${node.resource.name.replace('ResourceType.', '')}` + (q != null ? `  ${q.toFixed(3)} SCU` : ''));
        return;
      }
      if (nm) console.log(`${pad}[${nm}]` + (node.count != null ? `  (wähle ${node.count})` : ''));
      for (const o of node.options || []) walk(o, depth + 1);
      // Qualitätswirkung
      for (const ctx of node.context || []) {
        for (const m of ctx?.gameplayPropertyModifiers?.gameplayPropertyModifiers || []) {
          const p = m.gameplayPropertyRecord?.name?.replace('CraftingGameplayPropertyDef.', '');
          for (const v of m.valueRanges || []) { if (!v) continue; console.log(`${pad}   → wirkt auf ${p}: ×${v.modifierAtStart?.toFixed(2)} … ×${v.modifierAtEnd?.toFixed(2)} (Qualität ${v.startQuality}–${v.endQuality})`); }
        }
      }
    };
    for (const key of ['mandatoryCost', 'optionalCost', 'optionalCosts']) if (c[key]) walk(c[key], 0);
  }
}
