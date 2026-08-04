// Waffengröße je montierter Waffe.
//
// ERSTE WAHL ist die Größe, die enrich-weapon-sizes.mjs aus dem Stock-Loadout
// der Spieldateien direkt an die Waffe schreibt (`fixedWeapons[].size`). Die ist
// je Schiff aufgelöst und damit die einzige belastbare Quelle: Anzeigenamen sind
// im Spiel NICHT eindeutig — vier verschiedene Items heißen "Revenant Gatling"
// (S3, S4, S6, S4). Jede Auflösung, die den Namen als Schlüssel benutzt, rät.
//
// FALLBACK ist die frühere Rückrechnung aus den aggregierten Größen, für
// Waffen ohne eigenes `size` (z. B. ein Snapshot vor dem Enrich-Pass). Sie
// behandelt jeden Namen als global eindeutig — für die paar Waffen, die im
// Loadout des Schiffs nicht auftauchen, ist das die beste verfügbare Aussage,
// und ein Widerspruch fliegt über `AMBIGUOUS` sowieso raus.
//
// EHRLICHKEIT: Geraten wird nichts. Bleibt eine Waffe unauflösbar, meldet
// resolveGuns() das (`exact: false`) und die Anzeige fällt auf die aggregierte
// Darstellung ohne Namen zurück.
import vehiclesSnapshot from '../data/vehicles.json';

type SizeCount = { size: number; count: number };
/** `size` gesetzt = aus dem Stock-Loadout der Spieldateien, je Schiff aufgelöst */
type NameCount = { name: string; count: number; size?: number | null };
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
// Gleichung wäre falsch. Pilotwaffen mit eigener Größe brauchen keine
// Gleichung mehr; sie liefern stattdessen unten die harten Fakten.
const groups: Group[] = [];
const known: NameCount[] = [];
for (const v of (vehiclesSnapshot as { vehicles: any[] }).vehicles) {
  const fw: NameCount[] = v.fixedWeapons ?? [];
  const fs: SizeCount[] = v.fixedWeaponSizes ?? [];
  if (fw.some((w) => w.size != null)) known.push(...fw);
  else if (fw.length && fs.length && total(fw) === total(fs)) groups.push({ names: fw, sizes: fs });
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

// Erst die harten Fakten aus den Spieldaten einspeisen. Das macht die Tabelle
// nicht nur genauer, sondern vor allem ehrlicher: taucht derselbe Name auf zwei
// Schiffen in zwei Größen auf, landet er in AMBIGUOUS und der Fallback
// antwortet für ihn gar nicht mehr — statt eine der beiden Größen zu raten.
for (const w of known) if (w.size != null) learn(w.name, w.size);

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
 * Trägt die Waffe ihre Größe selbst (aus dem Stock-Loadout der Spieldateien),
 * ist die Zuordnung Name<->Größe bereits bekannt und `exact` ist true — auch
 * wenn einzelne Waffen ohne Größe bleiben; die Zeile zeigt dann "?" statt einer
 * erfundenen Zahl. Eine Gegenprobe gegen das Aggregat wäre hier zirkulär, denn
 * das Aggregat ist genau aus diesen Größen gebildet.
 *
 * Nur im Fallback (zurückgerechnete Größen) gilt weiter: `exact` ist true, wenn
 * jede Waffe aufgelöst ist UND die Größen das Aggregat exakt reproduzieren.
 * Sonst zeigt der Aufrufer die aggregierten Größen ohne Namen.
 */
export function resolveGuns(
  weapons: readonly NameCount[] | undefined,
  aggregate: readonly SizeCount[] | undefined
): { lines: GunLine[]; exact: boolean } {
  const fromGame = (weapons ?? []).some((w) => w.size != null);
  const lines: GunLine[] = (weapons ?? []).map((w) => ({
    name: w.name,
    count: w.count,
    size: fromGame ? w.size ?? null : gunSize(w.name),
  }));
  if (fromGame) return { lines, exact: lines.length > 0 };
  if (!lines.length || !aggregate?.length || lines.some((l) => l.size == null))
    return { lines, exact: false };
  // Gegenprobe: ergeben die aufgelösten Größen genau das gelieferte Aggregat?
  const mine = pool(lines.map((l) => ({ size: l.size as number, count: l.count })));
  const theirs = pool(aggregate);
  const exact =
    mine.size === theirs.size && [...mine].every(([s, c]) => theirs.get(s) === c);
  return { lines, exact };
}
