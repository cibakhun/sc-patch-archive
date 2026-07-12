// Komponenten-Anreicherung fürs Holo-Detailpanel: verknüpft einen verbauten
// Item-Namen (aus vehicles.json) mit dem Universal-Item-Finder-Katalog
// (assets/universal-items.json) und liefert Kategorie + günstigsten Preis +
// Anzahl Kauforte. Keine erfundenen Stats — nur was der Finder wirklich hat.
//
// Die Map wird EINMAL beim Modul-Load gebaut (nicht pro Seite), gefiltert auf
// Vehiclegear (894 von 9581 Items).
import DB from '../../assets/universal-items.json';

type Obtain = { kind: string; loc: string; price?: number | null };
type Item = { id: string; name: string; category: string; obtain: Obtain[] };

const items = (DB as { items: Item[] }).items;
const norm = (s: string) => s.toLowerCase().replace(/["'`„“”‚‘’]/g, '').replace(/\s+/g, ' ').trim();

const byName = new Map<string, Item>();
for (const it of items) {
  if (!it.category?.startsWith('Vehiclegear')) continue;
  const k = norm(it.name);
  if (!byName.has(k)) byName.set(k, it);
}

export type CompInfo = { cat: string; price: number | null; shops: number; id: string };

/** best-effort Name-Join (exakt normalisiert, dann Präfix-Fallback für Varianten) */
export function itemInfo(name: string | null | undefined): CompInfo | null {
  if (!name) return null;
  let it = byName.get(norm(name));
  if (!it) {
    // "Frost-Star EX" -> "Frost-Star": Trailing-Tokens droppen bis Treffer
    const toks = norm(name).split(' ');
    for (let i = toks.length - 1; i >= 1 && !it; i--) it = byName.get(toks.slice(0, i).join(' '));
  }
  if (!it) return null;
  const priced = it.obtain.filter((o) => o.price != null).map((o) => o.price as number);
  return {
    cat: it.category.replace(/^Vehiclegear \/\s*/, ''),
    price: priced.length ? Math.min(...priced) : null,
    shops: it.obtain.filter((o) => o.kind === 'shop').length,
    id: it.id,
  };
}
