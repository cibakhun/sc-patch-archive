// Text der Preiszeile eines Ruestungs-Sets (Task-Flow D05), an EINER Stelle:
// SetPreisZeile.astro setzt ihn auf Set-Seite und Item-Datenblatt, die
// Items-Werkbank bekommt denselben Text ueber /items-wege.json
// (src/lib/itemsWerkbankWege.ts). So kann die Werkbank nicht anders rechnen
// oder anders formulieren als das Blatt; verify:werkbank-items haelt beide
// gegeneinander.
import type { Locale } from '../i18n/ui';
import { itemT, itemLabel, fill, obtainLabel } from '../i18n/itemText';
import { auec } from './items';
import { setPreis } from './setPreis';

export interface SetPreisText {
  /** Zahl der Kernteile; 0 = das Set hat keins, dann steht keine Zeile da. */
  teile: number;
  /** Fett gesetzter Kopf: „Komplett ab …“, „3 von 4 Teilen ab …“ oder „kein Ladenpreis“. */
  kopf: string;
  /** Fehlende Ladenpreise benannt, sonst null. */
  ohne: string | null;
  /** Guenstigster Laden mit allen Teilen, sonst null. */
  ort: string | null;
  /** Kein Teil hat einen Ladenpreis (die Zeile steht gedaempft). */
  leer: boolean;
  /** Hinweis beim Darueberfahren, sonst null. */
  titel: string | null;
}

export function setPreisText(id: string, lang: Locale): SetPreisText {
  const t = itemT(lang);
  const p = setPreis(id);
  const slotName = (s: string) => itemLabel(lang, 'slot' + s, s);
  const m = p.teile.length;
  const n = m - p.ohnePreis.length;
  const preis = p.ab != null ? auec(p.ab, lang) : '';
  const kopf = p.ab == null
    ? t('setPreisKeiner')
    : p.ohnePreis.length
      ? fill(t('setPreisTeil'), { n, m, preis })
      : m === 4
        ? fill(t('setPreisKomplett'), { preis })
        : m === 1
          ? fill(t('setPreisEins'), { preis })
          : fill(t('setPreisAlle'), { m, preis });
  const ohne = p.ab != null && p.ohnePreis.length
    ? fill(t('setPreisOhne'), { teile: p.ohnePreis.map(slotName).join(', ') })
    : null;
  const ort = p.ort
    ? fill(t(p.ohnePreis.length ? 'setPreisOrtTeil' : 'setPreisOrt'), { n, laden: obtainLabel({ kind: 'shop', loc: p.ort.loc }, lang), preis: auec(p.ort.summe, lang) })
      + (p.ort.weitere === 1 ? ` (${t('setPreisOrtEiner')})` : p.ort.weitere > 1 ? ` (${fill(t('setPreisOrtMehr'), { n: p.ort.weitere })})` : '')
    : null;
  return { teile: m, kopf, ohne, ort, leer: p.ab == null, titel: p.ab != null ? t('setPreisHinweis') : null };
}
