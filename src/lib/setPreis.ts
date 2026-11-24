// Gesamtpreis eines Ruestungs-Sets (Task-Flow D05, UX-Audit 24.11.2026):
// „Wenn ich einen Helm habe, will ich die passenden Teile und ihre Preise
// finden.“ Bisher stand der Preis nur am einzelnen Teil; ob ein Set als Ganzes
// kaeuflich ist und was es kostet, musste man sich zusammenklicken.
//
// Gerechnet wird ueber die vier Kernteile (Helm, Oberkoerper, Arme, Beine),
// dieselben, an denen die Seite „komplett“ misst. Je Kernteil zaehlt die
// guenstigste Variante mit Ladenpreis; deshalb heisst die Zahl „ab“.
// Kernteile ohne Ladenpreis (Beute, Belohnung, unbekannt) werden benannt,
// nicht still weggelassen.
//
// Dazu der guenstigste Laden, der jedes Kernteil des Sets fuehrt (in
// irgendeiner Variante): „wo bekomme ich alles an einem Ort“, der zweite Teil
// desselben Befunds.
import { setItemsBySlot, type Item, type Obtain } from './items';

export const KERN_SLOTS = ['Helmet', 'Torso', 'Arms', 'Legs'] as const;

export interface SetPreis {
  /** Kernteile, die das Set hat, in Tragereihenfolge. */
  teile: string[];
  /** Davon ohne Ladenpreis. */
  ohnePreis: string[];
  /** Summe der guenstigsten Variante je Kernteil mit Ladenpreis, sonst null. */
  ab: number | null;
  /** Guenstigster Laden mit allen Kernteilen (nur bei zwei und mehr Teilen, alle mit Preis). */
  ort: { loc: string; summe: number; weitere: number } | null;
}

const ladenPreise = (i: Item) =>
  (i.obtain ?? []).filter((o): o is Obtain & { price: number } => o.kind === 'shop' && typeof o.price === 'number' && o.price > 0);

const cache = new Map<string, SetPreis>();

export function setPreis(id: string): SetPreis {
  const hit = cache.get(id);
  if (hit) return hit;
  const teile: string[] = [];
  const ohnePreis: string[] = [];
  let ab = 0;
  // Laden -> guenstigster Preis je Kernteil dort
  const laeden = new Map<string, Map<string, number>>();
  for (const [slot, list] of setItemsBySlot(id)) {
    if (!(KERN_SLOTS as readonly string[]).includes(slot)) continue;
    teile.push(slot);
    let min = Infinity;
    for (const i of list) {
      for (const o of ladenPreise(i)) {
        if (o.price < min) min = o.price;
        const l = laeden.get(o.loc) ?? new Map<string, number>();
        if (!laeden.has(o.loc)) laeden.set(o.loc, l);
        if (o.price < (l.get(slot) ?? Infinity)) l.set(slot, o.price);
      }
    }
    if (min === Infinity) ohnePreis.push(slot);
    else ab += min;
  }
  const mitPreis = teile.length - ohnePreis.length;
  let ort: SetPreis['ort'] = null;
  if (teile.length >= 2 && !ohnePreis.length) {
    const voll = [...laeden.entries()]
      .filter(([, l]) => l.size === teile.length)
      .map(([loc, l]) => ({ loc, summe: [...l.values()].reduce((a, b) => a + b, 0) }))
      .sort((a, b) => a.summe - b.summe || a.loc.localeCompare(b.loc, 'en'));
    if (voll.length) ort = { ...voll[0], weitere: voll.length - 1 };
  }
  const out: SetPreis = { teile, ohnePreis, ab: mitPreis ? ab : null, ort };
  cache.set(id, out);
  return out;
}
