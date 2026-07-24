// Titel, Meta-Description und Einleitungssatz der Item-/Blueprint-Seiten.
//
// Alles wird aus den Daten GEBAUT, nie erfunden: gibt es keinen Preis, taucht
// auch kein Preis im Text auf; gibt es keinen Hersteller, faellt der Halbsatz
// weg. Die Saetze sind bewusst faktisch und kurz — sie sollen die Frage
// beantworten, mit der jemand kommt ("was kostet das, wo kriege ich das"),
// nicht Fliesstext simulieren.

import type { Locale } from '../i18n/ui';
import { itemT, categoryLabel } from '../i18n/itemText';
import {
  ITEM_PATCH, auec, clip, db, displayName, leafCategory, minPrice, maxPrice,
  num, rootCategory, sortedObtain, type Item,
} from './items';
import { primaryStat } from './itemStats';
import type { BlueprintEntry } from './crafting';
import { craftTime, resourceNames } from './crafting';

/* ---------- Items ---------- */

export interface ItemSeo {
  title: string;
  description: string;
  /** Einleitungssatz auf der Seite (H1-Untertitel) */
  lead: string;
}

/** Wie kommt man an das Item? Steuert Titel-Variante und Einleitung. */
export function acquisition(i: Item): 'buy' | 'loot' | 'none' {
  if (minPrice(i) != null) return 'buy';
  if (i.obtain.length || i.guide) return 'loot';
  return 'none';
}

/** "Ballistic Cannon" — die Gattung laut Spieldaten, sonst die Kategorie. */
function kindOf(i: Item): string {
  const g = i.game;
  if (g?.gameType) return g.subType && g.subType !== g.gameType ? `${g.subType} ${g.gameType}` : g.gameType;
  return leafCategory(i.category);
}

/** "a"/"an" nach Anlaut — nur EN; Deutsch umgeht Artikel ueber Nominalphrasen. */
const an = (s: string) => (/^[aeiou]/i.test(s) ? 'an' : 'a');

/** "1 known location" / "3 known locations" — Singular ist kein Sonderfall, sondern die Regel bei Loot. */
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Einordnungssatz. EN als ganzer Satz mit Artikel, DE als Nominalphrase:
 * "ist eine Rakete" braucht das grammatische Geschlecht des Gattungsworts, und
 * das steht in den Spieldaten nicht — geraten wird hier nichts.
 */
function classification(i: Item, lang: Locale, patch: string): string {
  const kind = kindOf(i);
  const mfr = i.game?.manufacturer;
  const name = displayName(i, lang);
  if (lang === 'de') {
    return mfr
      ? `${name} — ${kind} von ${mfr}, Star Citizen Alpha ${patch}.`
      : `${name} — ${kind}, Star Citizen Alpha ${patch}.`;
  }
  const phrase = mfr ? `${mfr} ${kind}` : kind;
  return `The ${name} is ${an(phrase)} ${phrase} in Star Citizen Alpha ${patch}.`;
}

export function itemSeo(i: Item, lang: Locale): ItemSeo {
  const t = itemT(lang);
  const name = displayName(i, lang);
  const mode = acquisition(i);
  const lo = minPrice(i);
  const hi = maxPrice(i);
  const vendors = i.obtain.filter((o) => o.price != null).length;
  const cheapest = sortedObtain(i).find((o) => o.price != null);
  const stat = primaryStat(i, lang);

  const title =
    lang === 'de'
      ? mode === 'buy'
        ? `${name} — Preis & Kauforte | Star Citizen ${ITEM_PATCH} | VerseBase`
        : mode === 'loot'
          ? `${name} — Fundorte & Werte | Star Citizen ${ITEM_PATCH} | VerseBase`
          : `${name} — Werte & Daten | Star Citizen ${ITEM_PATCH} | VerseBase`
      : mode === 'buy'
        ? `${name} — Price & Where to Buy | Star Citizen ${ITEM_PATCH} | VerseBase`
        : mode === 'loot'
          ? `${name} — Where to Find It & Stats | Star Citizen ${ITEM_PATCH} | VerseBase`
          : `${name} — Stats & Data | Star Citizen ${ITEM_PATCH} | VerseBase`;

  const parts: string[] = [];
  if (lang === 'de') {
    if (mode === 'buy' && lo != null && cheapest)
      parts.push(
        `${name} kostet in Star Citizen ${ITEM_PATCH} ab ${auec(lo, lang)} — günstigster Kaufort: ${cheapest.loc}.`
      );
    else if (mode === 'loot')
      parts.push(
        `${name}: ${plural(i.obtain.length, 'bekannter Fundort', 'bekannte Fundorte')} in Star Citizen ${ITEM_PATCH}.`
      );
    else parts.push(`${name} — ${kindOf(i)} in Star Citizen ${ITEM_PATCH}.`);
    if (vendors > 1) parts.push(`${vendors} Verkaufsstellen im Vergleich.`);
    if (stat) parts.push(`${stat[0]}: ${stat[1]}.`);
    parts.push(`Stand ${db.pricesAsOf}.`);
  } else {
    if (mode === 'buy' && lo != null && cheapest)
      parts.push(
        `${name} costs from ${auec(lo, lang)} in Star Citizen ${ITEM_PATCH} — cheapest at ${cheapest.loc}.`
      );
    else if (mode === 'loot')
      parts.push(
        `${name}: ${plural(i.obtain.length, 'known location', 'known locations')} in Star Citizen ${ITEM_PATCH}.`
      );
    else parts.push(`${name} — ${kindOf(i)} in Star Citizen ${ITEM_PATCH}.`);
    if (vendors > 1) parts.push(`${vendors} vendors compared.`);
    if (stat) parts.push(`${stat[0]}: ${stat[1]}.`);
    parts.push(`As of ${db.pricesAsOf}.`);
  }

  /* Einleitung auf der Seite — darf laenger sein als die Meta-Description und
     nennt die Preisspanne, weil genau die den Vergleich ausmacht. */
  const leadBits: string[] = [classification(i, lang, ITEM_PATCH)];
  if (lang === 'de') {
    if (mode === 'buy' && lo != null && cheapest) {
      leadBits.push(
        hi != null && hi !== lo
          ? `Der Preis liegt zwischen ${auec(lo, lang)} und ${auec(hi, lang)}; am günstigsten bei ${cheapest.loc}.`
          : `Der Kaufpreis liegt bei ${auec(lo, lang)} (${cheapest.loc}).`
      );
    } else if (mode === 'loot') {
      // genderlose Nominalphrase: das Geschlecht des Item-Namens steht nirgends
      leadBits.push(
        `Nicht käuflich — bekannt ${i.obtain.length === 1 ? 'ist' : 'sind'} ${plural(i.obtain.length, 'Fundort', 'Fundorte')}.`
      );
    } else {
      leadBits.push(t('noPurchase'));
    }
  } else {
    if (mode === 'buy' && lo != null && cheapest) {
      leadBits.push(
        hi != null && hi !== lo
          ? `Prices range from ${auec(lo, lang)} to ${auec(hi, lang)}, cheapest at ${cheapest.loc}.`
          : `It sells for ${auec(lo, lang)} (${cheapest.loc}).`
      );
    } else if (mode === 'loot') {
      leadBits.push(
        `It cannot be bought — ${plural(i.obtain.length, 'known location is', 'known locations are')} listed below.`
      );
    } else {
      leadBits.push(t('noPurchase'));
    }
  }

  return {
    title,
    description: clip(parts.join(' '), 158),
    lead: leadBits.join(' '),
  };
}

/* ---------- Kategorie-Listen ---------- */

export function categorySeo(
  cat: string,
  count: number,
  page: number,
  pages: number,
  lang: Locale
): { title: string; description: string } {
  const leaf = leafCategory(cat);
  const root = rootCategory(cat);
  const label = leaf === root ? leaf : `${leaf} (${categoryLabel(root, lang)})`;
  // Ab Seite 2 traegt der Titel die Seitenzahl STATT der Gesamtzahl: sonst
  // behaupten zehn URLs dieselbe Menge und sehen in der Trefferliste gleich aus.
  const pageSuffix = page > 1 ? (lang === 'de' ? ` — Seite ${page}/${pages}` : ` — page ${page}/${pages}`) : '';
  const countPart = page > 1 ? '' : lang === 'de' ? ` — alle ${num(count, lang)} Items` : ` — all ${num(count, lang)} items`;
  return lang === 'de'
    ? {
        title: `${label}${countPart}${pageSuffix} | Star Citizen ${ITEM_PATCH} | VerseBase`,
        description: clip(
          `Alle ${num(count, lang)} ${leaf}-Items in Star Citizen ${ITEM_PATCH} mit Kaufpreis, Verkaufsstelle und Spielwerten. Stand ${db.pricesAsOf}.`,
          158
        ),
      }
    : {
        title: `${label}${countPart}${pageSuffix} | Star Citizen ${ITEM_PATCH} | VerseBase`,
        description: clip(
          `All ${num(count, lang)} ${leaf} items in Star Citizen ${ITEM_PATCH} with buy price, vendor location and game stats. As of ${db.pricesAsOf}.`,
          158
        ),
      };
}

/* ---------- Blueprints ---------- */

export function blueprintSeo(
  b: BlueprintEntry,
  lang: Locale,
  patch: string,
  snapshot: string
): ItemSeo {
  const res = resourceNames(b);
  const time = craftTime(b.craft_time_seconds, lang);
  const mis = b.missions?.length ?? 0;

  const title =
    lang === 'de'
      ? `${b.name} — Blueprint, Zutaten & Craft-Zeit | Star Citizen ${patch} | VerseBase`
      : `${b.name} — Blueprint, Ingredients & Craft Time | Star Citizen ${patch} | VerseBase`;

  const description =
    lang === 'de'
      ? clip(
          `${b.name} craften in Star Citizen ${patch}: ${b.ingredients.length} Zutaten-Slots (${res.slice(0, 3).join(', ')}), Craft-Zeit ${time}${mis ? `, ${mis} Missionen droppen den Blueprint` : ''}. Stand ${snapshot}.`,
          158
        )
      : clip(
          `Craft ${b.name} in Star Citizen ${patch}: ${b.ingredients.length} ingredient slots (${res.slice(0, 3).join(', ')}), craft time ${time}${mis ? `, dropped by ${mis} missions` : ''}. As of ${snapshot}.`,
          158
        );

  const lead =
    lang === 'de'
      ? `Der Blueprint ${b.name} (${b.category}) braucht ${b.ingredients.length} Zutaten-Slots und ${time} Craft-Zeit.${mis ? ` ${mis} Missionen können ihn droppen.` : ''}`
      : `The ${b.name} blueprint (${b.category}) needs ${b.ingredients.length} ingredient slots and ${time} of craft time.${mis ? ` ${mis} missions can drop it.` : ''}`;

  return { title, description, lead };
}
