// patch-spine.mjs — welche Patch-Seiten ein Fahrzeug nennen (das "Patch-Rückgrat").
//
// WARUM HIER und nicht mehr in datamine-vehicles.mjs: bis 08.10.2026 schrieb
// der Datenlauf `patches[]` in vehicles.json. Der Lauf braucht Data.p4k — und
// Patch-Seiten landen oft NACH ihm. Dann fehlte der Verweis Schiffsseite ->
// Patch-Seite still, bis jemand den Datenlauf wiederholte (Sabre Raven EX,
// 07.10.2026). Jetzt rechnet der Build die Verknüpfung aus dem Dateibestand
// unter src/data/patches/; eine neue Patch-Seite verlinkt beim nächsten Build.
//
// Benutzt von src/lib/patchSpine.ts (Seiten) und scripts/verify-patch-ships.mjs
// (Wächter) — eine Regel, zwei Leser.
//
// Join-Schlüssel ist der Anzeigename ohne Herstellerwort, kleingeschrieben,
// ohne Anführungszeichen — unverändert aus dem früheren Wiki-Sync-Skript (D-19).

export const SPINE_MAKERS = ['rsi', 'drake', 'aegis', 'anvil', 'mirai', 'gatac', 'argo', 'misc', 'origin', 'crusader', 'esperia', 'kruger', 'banu', 'aopoa', 'vanduul'];

export function stripSpine(name) {
  let n = (name || '').toLowerCase().replace(/["„“”‚‘’']/g, '').replace(/\s+/g, ' ').trim();
  for (const m of SPINE_MAKERS) if (n.startsWith(m + ' ')) n = n.slice(m.length + 1);
  return n;
}

// Variante -> Basis: Patch-Schiffe, deren exakte Variante der Katalog nicht
// führt — der Basis-Eintrag trägt den Verweis stellvertretend.
export const SPINE_ALIAS = { 'atls ikti': 'atls' };

/** "4.10.0" vor "4.9.0" wäre Textordnung — hier zählt die Versionsfolge. */
const byVersion = (a, b) => {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
};

/**
 * @param {{ version: string, ships?: { name: string }[] }[]} patches  Inhalt von src/data/patches/*.json
 * @returns {(vehicleName: string) => string[]}  Versionen, älteste zuerst
 */
export function buildPatchSpine(patches) {
  const spine = new Map();
  for (const p of patches) {
    for (const s of p.ships ?? []) {
      const k = stripSpine(s.name);
      if (!spine.has(k)) spine.set(k, new Set());
      spine.get(k).add(p.version);
    }
  }
  for (const [from, to] of Object.entries(SPINE_ALIAS)) {
    if (!spine.has(from)) continue;
    if (!spine.has(to)) spine.set(to, new Set());
    for (const v of spine.get(from)) spine.get(to).add(v);
  }
  return (vehicleName) => {
    const k = stripSpine(vehicleName);
    return spine.has(k) ? [...spine.get(k)].sort(byVersion) : [];
  };
}
