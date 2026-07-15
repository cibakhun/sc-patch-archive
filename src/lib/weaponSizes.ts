// Waffengröße je Waffenname — global aus dem Fahrzeug-Snapshot gelöst.
//
// WARUM DAS NÖTIG IST: sync/enrich-weapon-sizes.mjs löst die Größe jeder
// montierten Waffe über den WeaponGun-Katalog auf (Name -> Größe) und
// aggregiert sie dann zu `fixedWeaponSizes: [{size,count}]`. Dabei geht die
// Zuordnung Name <-> Größe verloren: aus "2× Shredder, 1× M6A" + "S3×2, S4×1"
// ist ohne Zusatzwissen nicht ablesbar, welche Waffe welche Größe hat. Genau
// diese Zuordnung braucht das Datenblatt aber, um pro Waffe eine Zeile
// ("[S4] ×1 M6A Cannon") statt eines Zahlenhaufens zu zeigen.
//
// Statt eines zweiten Netzwerk-Syncs wird die Zuordnung hier aus dem Snapshot
// selbst zurückgerechnet: jeder Waffenname hat GENAU EINE Größe, also bilden
// alle Schiffe zusammen ein Gleichungssystem. Schiffe mit nur einer Waffenart
// liefern die Größe direkt, der Rest folgt per Ausschluss (Fixpunkt-Iteration).
// Türme liefern zusätzliche Gleichungen (sizes[] + weapons[] je Turm).
//
// Die Tabelle wird EINMAL beim Modul-Load gebaut (wie holoItems.ts) und hält
// sich nach künftigen Syncs selbst aktuell — kein gepflegtes Mapping im Repo.
//
// EHRLICHKEIT: Geraten wird nichts. Bleibt ein Name unauflösbar (echte
// Mehrdeutigkeit) oder widerspricht das Ergebnis den Snapshot-Zahlen eines
// Schiffs, meldet resolveGuns() das (`exact: false`) und die Anzeige fällt auf
// die aggregierte Darstellung zurück.
import vehiclesSnapshot from '../data/vehicles.json';

type SizeCount = { size: number; count: number };
type NameCount = { name: string; count: number };
type Group = { names: NameCount[]; sizes: SizeCount[] };

const total = <T extends { count: number }>(l: readonly T[]): number =>
  l.reduce((n, x) => n + x.count, 0);

/** Größen-Multiset einer [{size,count}]-Liste als Map size -> count */
const pool = (sizes: readonly SizeCount[]): Map<number, number> => {
  const m = new Map<number, number>();
  for (const { size, count } of sizes) m.set(size, (m.get(size) ?? 0) + count);
  return m;
};

// ---------- Gleichungen sammeln ----------
// Nur Gruppen, bei denen Waffen- und Größenliste dieselbe Stückzahl haben —
// sonst ist die Größenliste unvollständig (kommt bei Türmen vor) und die
// Gleichung wäre falsch.
const groups: Group[] = [];
for (const v of (vehiclesSnapshot as { vehicles: any[] }).vehicles) {
  const fw: NameCount[] = v.fixedWeapons ?? [];
  const fs: SizeCount[] = v.fixedWeaponSizes ?? [];
  if (fw.length && fs.length && total(fw) === total(fs)) groups.push({ names: fw, sizes: fs });
  for (const tr of v.turrets ?? []) {
    const tw: NameCount[] = tr.weapons ?? [];
    const ts: SizeCount[] = tr.sizes ?? [];
    if (tw.length && ts.length && total(tw) === total(ts)) groups.push({ names: tw, sizes: ts });
  }
}

// ---------- Fixpunkt-Iteration ----------
const SIZE = new Map<string, number>();
/** Namen, für die zwei Gleichungen unterschiedliche Größen fordern -> unbrauchbar */
const AMBIGUOUS = new Set<string>();

const learn = (name: string, size: number): boolean => {
  const had = SIZE.get(name);
  if (had != null) {
    if (had !== size) AMBIGUOUS.add(name); // Widerspruch: Name fällt komplett raus
    return false;
  }
  SIZE.set(name, size);
  return true;
};

for (let pass = 0; pass < 12; pass++) {
  let changed = false;
  for (const g of groups) {
    // bekannte Namen aus dem Größen-Pool abziehen; übrig bleibt, was die
    // noch unbekannten Namen unter sich aufteilen müssen
    const rest = pool(g.sizes);
    const unknown: NameCount[] = [];
    let broken = false;
    for (const w of g.names) {
      const s = SIZE.get(w.name);
      if (s == null) { unknown.push(w); continue; }
      const have = rest.get(s) ?? 0;
      if (have < w.count) { broken = true; break; } // Gleichung inkonsistent -> überspringen
      rest.set(s, have - w.count);
    }
    if (broken || !unknown.length) continue;
    const open = [...rest.entries()].filter(([, c]) => c > 0);
    if (!open.length) continue;

    // (a) nur noch EINE Größe übrig, die genau aufgeht -> alle Unbekannten haben sie
    if (open.length === 1 && open[0][1] === total(unknown)) {
      for (const u of unknown) if (learn(u.name, open[0][0])) changed = true;
      continue;
    }
    // (b) eine Stückzahl, die auf genau EINE offene Größe und genau EINEN
    //     unbekannten Namen passt -> eindeutig zuordenbar
    for (const [size, c] of open) {
      if (open.filter(([, c2]) => c2 === c).length !== 1) continue;
      const fits = unknown.filter((u) => u.count === c);
      if (fits.length === 1 && learn(fits[0].name, size)) changed = true;
    }
  }
  if (!changed) break;
}
for (const n of AMBIGUOUS) SIZE.delete(n);

/** Größenklasse einer Waffe, oder null wenn nicht eindeutig auflösbar */
export function gunSize(name: string | null | undefined): number | null {
  return name ? SIZE.get(name) ?? null : null;
}

export type GunLine = { name: string; count: number; size: number | null };

/**
 * Montierte Waffen mit ihrer Größenklasse — eine Zeile je Waffenart.
 *
 * `exact` ist nur true, wenn jede Waffe aufgelöst ist UND die aufgelösten
 * Größen die Aggregat-Liste des Schiffs exakt reproduzieren. Andernfalls
 * widerspricht die Auflösung den Snapshot-Daten (oder ist unvollständig) und
 * der Aufrufer zeigt statt der Zeilen die aggregierten Größen.
 */
export function resolveGuns(
  weapons: readonly NameCount[] | undefined,
  aggregate: readonly SizeCount[] | undefined
): { lines: GunLine[]; exact: boolean } {
  const lines: GunLine[] = (weapons ?? []).map((w) => ({
    name: w.name,
    count: w.count,
    size: gunSize(w.name),
  }));
  if (!lines.length || !aggregate?.length || lines.some((l) => l.size == null))
    return { lines, exact: false };
  // Gegenprobe: ergeben die aufgelösten Größen genau das gelieferte Aggregat?
  const mine = pool(lines.map((l) => ({ size: l.size as number, count: l.count })));
  const theirs = pool(aggregate);
  const exact =
    mine.size === theirs.size && [...mine].every(([s, c]) => theirs.get(s) === c);
  return { lines, exact };
}
