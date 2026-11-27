// smart-suche.js — der Suchkern hinter dem Schiffsfinder im Hangar und der
// Suche der Items-Werkbank. Beim Import keine Seiteneffekte: reine
// Funktionen, die in node (tests/e2e/smart-suche.test.js), im Hangar
// (assets/hangar-overview.js, statischer Import) und in der Werkbank
// (assets/items-werkbank.js, import() mit Versionsadresse) dasselbe tun.
//
// Was eine Seite erkennt, bringt sie selbst mit: ihr Vokabular (Art,
// Schluessel, Woerter beider Sprachen) und ihre Muster fuer Zahlen mit
// Einheit. Hier stehen nur Faltung, Tippfehler-Abstand, das Erkennen und die
// Guete eines freien Worts.

/**
 * Klein, ohne Akzente, ß als ss, Apostrophe weg; dieselbe Faltung wie fold()
 * in src/lib/hangar/finder.ts, mit der data-q gebaut ist (verify-hangar [19]).
 *   fold('  Großer  JÄGER ') === 'grosser jager'
 * @param {unknown} s
 */
export function fold(s) {
  return String(s ?? '').toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`´]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Tippfehler-Abstand (Levenshtein mit Vertauschung benachbarter Zeichen). Er
 * bricht ab, sobald er max sicher uebersteigt, und liefert dann max + 1.
 *   editDistance('prospektor', 'prospector') === 1
 * @param {string} a @param {string} b @param {number} [max]
 */
export function editDistance(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let low = i;
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (prev2 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < low) low = v;
    }
    if (low > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return Math.min(prev[b.length], max + 1);
}

/** Wie viele Tippfehler ein Wort dieser Laenge haben darf. */
export const slack = (n) => (n >= 8 ? 2 : n >= 4 ? 1 : 0);

/**
 * Eine Zahl mit Einheit: „2,5 mio“ -> 2500000, „10k“ -> 10000.
 * @param {string|number} n @param {string} [unit]
 */
export const menge = (n, unit) => Number(String(n).replace(',', '.')) * (/^(k|tsd)/.test(unit ?? '') ? 1e3 : /^(m|mio|mil)/.test(unit ?? '') ? 1e6 : 1);

/**
 * Muster „unter 2 mio“, „bis 10k“, „max 500“: eine Preisobergrenze (Art
 * 'price'). ohneEinheit sagt, welche Einheit eine nackte Zahl meint: im
 * Hangar Millionen unter 1000 (kein Schiff kostet unter 1000 aUEC), bei
 * Items die Zahl selbst.
 * @param {(n: string) => string} [ohneEinheit]
 * @returns {Muster}
 */
export function preisMuster(ohneEinheit = () => '') {
  return {
    kind: 'price',
    re: /\s(?:unter|bis|max|maximal|under|below|<=?)\s*(\d+(?:[.,]\d+)?)\s*(k|tsd|m|mio|millionen|million|mil)?\s*(?:auec)?(?=\s)/g,
    key: (n, u) => menge(n, u ?? ohneEinheit(n)),
  };
}

/**
 * Liest eine Suche. Zuerst die Muster (Zahlen mit Einheit), dann die Wendungen
 * des Vokabulars, laengere vor kuerzeren („schwerer jäger“ vor „jäger“), in
 * der Reihenfolge der Arten. Jeder Treffer behaelt seinen Text (t, gefaltet),
 * damit die Seite ihn als Chip zeigen und wieder aus der Suche nehmen kann.
 * Was uebrig bleibt, sind freie Woerter; Spitznamen (vocab.nick) werden dabei
 * zum Wort, das sie meinen.
 *   erkenne('pyro helm', { sys: [{ k: 'pyro', w: ['pyro'] }] }, ['sys'])
 *   -> { hits: [{ kind: 'sys', key: 'pyro', t: 'pyro' }], words: ['helm'] }
 * @param {string} q
 * @param {Record<string, any>} vocab  je Art eine Liste {k, w: string[]}; dazu nick
 * @param {readonly string[]} arten  welche Arten des Vokabulars zaehlen, in dieser Folge
 * @param {readonly Muster[]} [muster]
 * @returns {{ hits: Treffer[], words: string[] }}
 *
 * @typedef {{ kind: string, re: RegExp, key: (...g: string[]) => unknown }} Muster
 * @typedef {{ kind: string, key: any, t: string }} Treffer
 */
export function erkenne(q, vocab, arten, muster = []) {
  let s = ` ${fold(q)} `;
  /** @type {Treffer[]} */
  const hits = [];
  for (const m of muster) {
    s = s.replace(m.re, (/** @type {string} */ ganz, /** @type {string[]} */ ...g) => {
      hits.push({ kind: m.kind, key: m.key(...g), t: ganz.trim() });
      return ' ';
    });
  }
  const phrases = [];
  for (const kind of arten) for (const e of vocab[kind] ?? []) for (const w of e.w) phrases.push({ kind, key: e.k, w: fold(w) });
  phrases.sort((a, b) => b.w.length - a.w.length);
  for (const p of phrases) {
    const at = p.w ? s.indexOf(` ${p.w} `) : -1;
    if (at < 0) continue;
    if (!hits.some((h) => h.kind === p.kind && h.key === p.key)) hits.push({ kind: p.kind, key: p.key, t: p.w });
    s = `${s.slice(0, at)} ${s.slice(at + p.w.length + 1)}`;
  }
  const words = s.split(' ').filter(Boolean).map((w) => fold(vocab.nick?.[w] ?? w));
  return { hits, words };
}

/**
 * Trifft ein freies Wort einen Eintrag, und wie gut? Die Felder kommen in
 * der Folge ihres Gewichts, jedes mit seinen Punkten fuer ganzes Wort,
 * Wortanfang und Tippfehler (Teilstueck: Wortanfang minus 20). voll ist der
 * ganze Text fuer den Rest: ab drei Zeichen zaehlt dort auch ein Teilstueck
 * (40). 0 = nein. Tippfehler zaehlen nur mit typos.
 *   wortWert('cutlass', [[['cutlass', 'black'], 100, 80, 35]], 'cutlass black', false) === 100
 * @param {string} w
 * @param {ReadonlyArray<readonly [readonly string[], number, number, number]>} felder
 * @param {string} voll
 * @param {boolean} [typos]
 */
export function wortWert(w, felder, voll, typos = true) {
  let best = 0;
  const k = slack(w.length);
  for (const [list, whole, start, typo] of felder) {
    for (const x of list) {
      if (x === w) best = Math.max(best, whole);
      else if (x.startsWith(w)) best = Math.max(best, start);
      else if (w.length >= 3 && x.includes(w)) best = Math.max(best, start - 20);
      else if (typos && k && Math.min(editDistance(w, x, k), editDistance(w, x.slice(0, w.length), k)) <= k) best = Math.max(best, typo);
    }
  }
  if (!best && w.length >= 3 && voll.includes(w)) best = 40;
  return best;
}

/**
 * Nimmt einen erkannten Begriff aus der Suche, im Wortlaut des Besuchers:
 * gesucht wird die Wortfolge, deren Faltung der Begriff ist.
 *   ohneBegriff('Pyro  Helme', 'pyro') === 'Helme'
 * @param {string} q @param {string} t
 */
export function ohneBegriff(q, t) {
  const raw = String(q ?? '').split(/\s+/).filter(Boolean);
  const want = t.split(' ').length;
  for (let i = 0; i + want <= raw.length; i++) {
    if (fold(raw.slice(i, i + want).join(' ')) === t) return [...raw.slice(0, i), ...raw.slice(i + want)].join(' ');
  }
  return fold(q).replace(t, ' ').replace(/\s+/g, ' ').trim();
}
