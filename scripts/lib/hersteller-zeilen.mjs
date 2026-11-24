// hersteller-zeilen.mjs — eine Feuerrate je Waffe (UX-Audit Paket D3, 24.11.2026).
//
// Die Spielbeschreibung einer Waffe beginnt mit einem Herstellerkopf
// ("Battery Size: 35 / Rate Of Fire: 500 rpm / Effective Range: 50 m"). Die
// Zahlen darin pflegt das Spiel von Hand, und sie hinken den Spielwerten
// hinterher: die Karna feuert laut ihren Waffenwerten 600 Schuss/min, ihr
// Kopf sagt 500, die A03 225 gegen 120. Gemessen am 24.11.2026 in
// assets/universal-items.json: 227 von 328 Items mit beiden Angaben weichen
// bei der Feuerrate ab, 27 von 332 beim Magazin. Item-Blatt, Item Finder und
// jede weitere Oberflaeche zeigen den gemessenen Wert als Kennzahl UND den
// Kopf im Beschreibungstext — zwei verschiedene Feuerraten auf einer Seite.
//
// Regel: Steht ein Wert als gemessene Kennzahl im Katalog (game.stats oder
// eine Ausfuehrung in game.variants), faellt die gleichnamige Kopfzeile aus
// der Beschreibung. Die uebrigen Kopfzeilen (Reichweite, Aufsaetze …) haben
// keinen gemessenen Gegenwert und bleiben. Gilt in der gemeinsamen
// Datenquelle, damit jede Oberflaeche dieselbe eine Zahl zeigt:
// build-universal-db.mjs wendet die Regel beim Bau an,
// verify:bezugswege [5] prueft, dass der Katalog auf ihrem Stand ist.
//
// Keine Abhaengigkeiten, kein Netz: laeuft im Datenlauf und im Tor.

/** Kopfzeilen, die einen gemessenen Wert doppeln: Kennzahl -> Zeilenmuster. */
export const DOPPELTE_KOPFZEILEN = [
  { wert: 'fireRate', muster: /^\s*(?:Rate of Fire|Feuerrate)\s*:/i },
  { wert: 'magazine', muster: /^\s*(?:Magazine Size|Battery Size|Magazingr(?:ö|oe)(?:ß|ss)e|Batteriegr(?:ö|oe)(?:ß|ss)e)\s*:/i },
];

/** Steht dieser Wert als Kennzahl am Item (oben oder in einer Ausfuehrung)? */
export function gemessen(game, wert) {
  if (!game) return false;
  if (game.stats && game.stats[wert]) return true;
  return Array.isArray(game.variants) && game.variants.some((v) => v && v.stats && v.stats[wert]);
}

/** Die Regeln, die fuer dieses Item greifen. */
const regelnFuer = (game) => DOPPELTE_KOPFZEILEN.filter((r) => gemessen(game, r.wert));

/** Beschreibung ohne die Kopfzeilen, die eine Kennzahl doppeln. */
export function ohneDoppelteZeilen(text, game) {
  if (typeof text !== 'string' || !text) return text;
  const regeln = regelnFuer(game);
  if (!regeln.length) return text;
  const zeilen = text.split('\n');
  const rest = zeilen.filter((z) => !regeln.some((r) => r.muster.test(z)));
  if (rest.length === zeilen.length) return text;
  // Fiel der ganze Kopf weg, beginnt der Text sonst mit Leerzeilen.
  return rest.join('\n').replace(/^\s*\n/, '').replace(/\n{3,}/g, '\n\n');
}

/** Kopfzeilen dieses Items, die noch eine Kennzahl doppeln (fuer das Tor). */
export function doppelteZeilen(game) {
  const out = [];
  if (!game) return out;
  const regeln = regelnFuer(game);
  if (!regeln.length) return out;
  for (const feld of ['desc', 'descDe']) {
    const text = game[feld];
    if (typeof text !== 'string') continue;
    for (const z of text.split('\n')) if (regeln.some((r) => r.muster.test(z))) out.push({ feld, zeile: z.trim() });
  }
  return out;
}

/** Wendet die Regel auf einen ganzen Katalog an (Kopie oder Original). */
export function wendeHerstellerRegelAn(db) {
  let items = 0;
  let zeilen = 0;
  for (const it of db.items ?? []) {
    const g = it.game;
    if (!g) continue;
    const vorher = doppelteZeilen(g).length;
    if (!vorher) continue;
    for (const feld of ['desc', 'descDe']) if (typeof g[feld] === 'string') g[feld] = ohneDoppelteZeilen(g[feld], g);
    items++;
    zeilen += vorher;
  }
  return { items, zeilen };
}
