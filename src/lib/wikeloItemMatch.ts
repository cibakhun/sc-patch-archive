// wikeloItemMatch.ts — Build-Zeit-Matching der Wikelo-Trade-Namen gegen die
// Item-DB (assets/universal-items.json): liefert den kanonischen Item-Namen
// oder null. Damit markieren die Wikelo-Seiten Material-/Belohnungs-Namen schon
// im SSR-Markup als klickbar (data-item) — die Item-Finder-Brücke braucht dann
// clientseitig keine DB, um die Links anzuzeigen.
//
// Die Quelle (wikelotrades.com) schreibt Mengen-Präfixe ("50× …"), Zusätze
// ("Argo ATLS", "SCU Copper", "Antium Armor Arms") und zwei Begriffe anders als
// die Spieldateien ("Iraddiated", "Quantanium") — die Kandidaten-Regeln hier
// normalisieren das. Dieselbe Logik clientseitig: assets/item-finder-app.js
// (wikeloCandidates) — beide zusammen ändern.
import DB from '../../assets/universal-items.json';

// Warum hier KEIN Schluessel-Join moeglich ist (Stand 07.08.2026):
// die Quelle wikelotrades.com fuehrt ausschliesslich von Hand getippte
// Anzeigenamen — es gibt auf ihrer Seite keine Id, an der man festmachen
// koennte. Der Namensabgleich ist deshalb nicht Bequemlichkeit, sondern das
// Einzige, was diese Quelle hergibt.
//
// Tragfaehig ist er nur, solange der Item-Katalog je Name genau einen Eintrag
// hat. Das ist heute so (gemessen: 9168 Items, 0 doppelte Namen) — allerdings
// nicht, weil es keine gleichnamigen Items gaebe, sondern weil
// `datamine-items.mjs` sie vorher zusammenfasst. Die Mehrdeutigkeit ist also
// nur unsichtbar, nicht weg. Ein Treffer hier heisst darum: "so heisst genau
// ein Katalogeintrag" — nicht "so heisst genau ein Item im Spiel".
//
// Die Pruefung unten haelt das fest. Schlaegt sie an, ist der Katalog
// mehrdeutig geworden, und dann darf hier NICHT der erste Treffer gewinnen.
const CANON = new Map<string, string>();
const mehrdeutig: string[] = [];
for (const it of (DB as { items: { name: string }[] }).items) {
  const k = it.name.toLowerCase();
  if (CANON.has(k)) mehrdeutig.push(it.name);
  CANON.set(k, it.name);
}
if (mehrdeutig.length) {
  throw new Error(
    `wikeloItemMatch: der Item-Katalog fuehrt ${mehrdeutig.length} doppelte Namen — ein Namenstreffer waere geraten. ` +
    `Betroffen: ${mehrdeutig.slice(0, 10).join(', ')}${mehrdeutig.length > 10 ? ' …' : ''}. ` +
    `Wikelo liefert keine Ids; der Abgleich muss dann mehrdeutige Namen unverlinkt lassen statt zu waehlen.`,
  );
}
const ALL_NAMES: string[] = [...CANON.values()];

// "50× MG Scrip" → "MG Scrip"
const stripQty = (s: string) => String(s || '').replace(/^\s*[\d.,]+\s*[x×]\s*/i, '').trim();

function candidates(raw: string): string[] {
  const n = stripQty(raw)
    .replace(/^iraddiated\b/i, 'Irradiated')     // Tippfehler der Quelle
    .replace(/\bquantanium\b/i, 'Quantainium');  // Spieldatei-Schreibweise
  const out = new Set<string>([n]);
  out.add(n.replace(/^SCU\s+/i, ''));            // "SCU Copper" → "Copper"
  out.add(n.replace(/^Argo\s+/i, ''));           // "Argo ATLS" → "ATLS"
  out.add(n.replace(/\bArmor\s+/i, ''));         // "Antium Armor Arms" → "Antium Arms"
  for (const c of [...out]) if (/s$/i.test(c)) out.add(c.slice(0, -1)); // "Yormandi Eyes" → "… Eye"
  return [...out];
}

export function matchItemName(raw: string): string | null {
  const cands = candidates(raw);
  for (const c of cands) {
    const hit = CANON.get(c.toLowerCase());
    if (hit) return hit;
  }
  // Eindeutiger Suffix-Treffer (Hersteller-Präfix in der DB):
  // "Starlancer MAX" → "MISC Starlancer MAX", "Fortune" → "Drake Fortune"
  for (const c of cands) {
    const sfx = ' ' + c.toLowerCase();
    const hits = ALL_NAMES.filter((n) => n.toLowerCase().endsWith(sfx));
    if (hits.length === 1) return hits[0];
  }
  return null;
}
