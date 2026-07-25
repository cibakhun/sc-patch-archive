// Tag-Index fuer den DataCore (Game2.dcb).
//
// Die Spieldaten fuehren eine eigene Tag-Datenbank: ~18.800 `Tag`-Records, die
// ueber `children` einen echten Baum bilden (66 Wurzeln, u. a. Armor, Clothing,
// LootGeneration, Item, Global). Jedes Item zeigt per `EntityClassDefinition.tags[]`
// auf Knoten dieses Baums.
//
// Der Record-NAME ist nur eine GUID (`Tag.00ead468-…`) — die lesbare Bezeichnung
// steht im Feld `tagName`. Erst der Pfad von der Wurzel her macht einen Tag
// eindeutig: `Medium` allein kommt in mehreren Zweigen vor, `Armor.FPS.Type.Medium`
// nicht. Deshalb arbeitet alles hier mit Pfaden, nie mit blossen Namen.
//
// Kosten: einmaliger Aufbau ueber alle Tag-Records (~0,4 s), danach O(1)-Lookups.

/**
 * Baut den Tag-Index.
 * @param {object} db - geoeffneter DataCore (scripts/lib/datacore.mjs)
 * @returns {{ pathOf(guid: string): string|null, nameOf(guid: string): string|null,
 *             pathsOf(tags: any[]): string[], count: number }}
 */
export function buildTagIndex(db) {
  const isTag = (r) => db.structs[r.structIndex]?.name === 'Tag';
  const name = new Map();     // guid -> tagName
  const children = new Map(); // guid -> [guid]
  for (const r of db.records) {
    if (!isTag(r)) continue;
    let o;
    try { o = db.readRecord(r, { maxDepth: 2 }); } catch { continue; }
    name.set(r.id, o?.tagName ?? '');
    children.set(r.id, (o?.children || []).map((c) => c?.__ref).filter(Boolean));
  }
  const parent = new Map();
  for (const [g, kids] of children) for (const k of kids) parent.set(k, g);

  // Pfade memoisieren: dieselben Tags werden zehntausendfach aufgeloest.
  const pathCache = new Map();
  function pathOf(guid) {
    if (!name.has(guid)) return null;
    const hit = pathCache.get(guid);
    if (hit !== undefined) return hit;
    const chain = [];
    for (let cur = guid, guard = 0; cur !== undefined && guard < 32; guard++) {
      chain.push(name.get(cur) ?? '?');
      cur = parent.get(cur);
    }
    const p = chain.reverse().join('.');
    pathCache.set(guid, p);
    return p;
  }

  return {
    pathOf,
    nameOf: (g) => name.get(g) ?? null,
    /** `EntityClassDefinition.tags[]` -> Liste voller Tag-Pfade (Null-Eintraege fallen weg). */
    pathsOf: (tags) => (tags || []).filter((t) => t && t.__ref).map((t) => pathOf(t.__ref)).filter(Boolean),
    count: name.size,
  };
}

/** Blatt eines Pfades unterhalb von `prefix` — `Armor.FPS.Type.Heavy` + `Armor.FPS.Type.` -> `Heavy`. */
export function leafUnder(paths, prefix) {
  const hit = paths.find((p) => p.startsWith(prefix));
  return hit ? hit.slice(prefix.length) || null : null;
}
