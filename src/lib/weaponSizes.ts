// Waffengröße je Waffenname — global aus dem Fahrzeug-Snapshot gelöst.
//
// STAND 01.4-05 (der Tausch): der Spieldaten-Katalog trägt die Größe direkt an
// jeder Waffe (`fixedWeapons[].size`/`turretWeapons[].size`) — die frühere
// Wiki-Kette (Sync- und Anreicherungs-Skript), die Name<->Größe erst über ein
// Gleichungssystem zurückrechnen musste, ist gelöscht (D-16). Diese Datei baut
// jetzt nur noch eine einfache Name->Größe-Tabelle aus den bereits vollständigen
// Werten; die Fixpunkt-Iteration entfällt. Der exportierte Vertrag
// (`resolveGuns()` mit dem `exact`-Kennzeichen, `gunSize()`) bleibt UNVERÄNDERT,
// damit ShipDetail.astro/shipFacts.ts unverändert weiterlaufen — nur die
// Herkunft der Zuordnung wechselt.
//
// WARUM ÜBERHAUPT EINE NAME->GRÖSSE-TABELLE, wenn jede Waffe ihre Größe schon
// selbst trägt? Weil `resolveGuns()` heute mit `{name,count}`-Paaren aufgerufen
// wird (aus der Astro-Content-Collection, die `size` am Waffen-Eintrag NICHT
// zwingend führt) — die Tabelle bleibt der stabile Vertrag zwischen Rohdaten
// (dieser Datei, liest vehicles.json direkt ohne Schema) und Aufrufer.
//
// EHRLICHKEIT: Geraten wird nichts. Derselbe Anzeigename kann auf
// verschiedenen Schiffen unterschiedliche Größen tragen (vier Items heißen
// „Revenant Gatling" in vier Größen — display-name-not-a-key) — ein Name, der
// zwei widersprüchliche Größen liefert, gilt als nicht global auflösbar
// (`AMBIGUOUS`) und die Anzeige fällt auf die aggregierte Darstellung zurück.
import vehiclesSnapshot from '../data/vehicles.json';

type SizeCount = { size: number; count: number };
type NameCount = { name: string; count: number };
type WeaponEntry = { name: string; size?: number | null; count: number };

/** Größen-Multiset einer [{size,count}]-Liste als Map size -> count */
const pool = (sizes: readonly SizeCount[]): Map<number, number> => {
  const m = new Map<number, number>();
  for (const { size, count } of sizes) m.set(size, (m.get(size) ?? 0) + count);
  return m;
};

// ---------- Name -> Größe, direkt aus dem Katalog ----------
const SIZE = new Map<string, number>();
/** Namen, die auf verschiedenen Schiffen widersprüchliche Größen tragen -> unbrauchbar */
const AMBIGUOUS = new Set<string>();

const learn = (name: string, size: number): void => {
  const had = SIZE.get(name);
  if (had != null) {
    if (had !== size) AMBIGUOUS.add(name); // Widerspruch: Name fällt komplett raus
    return;
  }
  SIZE.set(name, size);
};

for (const v of (vehiclesSnapshot as { vehicles: any[] }).vehicles) {
  for (const w of (v.fixedWeapons ?? []) as WeaponEntry[]) if (w.name && w.size != null) learn(w.name, w.size);
  for (const w of (v.turretWeapons ?? []) as WeaponEntry[]) if (w.name && w.size != null) learn(w.name, w.size);
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
