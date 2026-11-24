// Titel, Meta-Description und Einleitungssatz der Item-/Blueprint-Seiten.
//
// Alles wird aus den Daten GEBAUT, nie erfunden: gibt es keinen Preis, taucht
// auch kein Preis im Text auf; gibt es keinen Hersteller, faellt der Halbsatz
// weg. Die Saetze sind bewusst faktisch und kurz — sie sollen die Frage
// beantworten, mit der jemand kommt ("was kostet das, wo kriege ich das"),
// nicht Fliesstext simulieren.

import type { Locale } from '../i18n/ui';
import { fill, itemT, categoryLabel } from '../i18n/itemText';
import {
  ITEM_PATCH, auec, clip, db, displayName, minPrice, maxPrice,
  num, pageItems, rootCategory, sortedObtain, type Item,
} from './items';
import { primaryStat } from './itemStats';
import { lesbarerBezeichner } from './lesbar';
import type { BlueprintEntry } from './crafting';
import { blueprints, craftTime, itemForBlueprint, resourceNames } from './crafting';
import { bwT } from '../i18n/bezugswegeText';
import { datumLang } from './datenstand';
import { kategorieTitel } from './itemKategorien';

/* ---------- Gleichnamige Seiten (UX-Audit D7) ---------- */

// Zwei Seiten, ein Name: in der Suche, im Browser-Tab und im Suchergebnis
// sah man nicht, welche welche ist. Gemessen 24.11.2026: 11 Bauplan-Namen
// doppelt (Adresse „-2"), 4 deutsche Item-Namen doppelt, dazu Item-Paare, bei
// denen eines die Preise und das andere die Spielwerte traegt. Die Adressen
// bleiben (keine Weiterleitung ohne Krisz' Ja); jede Seite bekommt einen
// Zusatz, der sie unterscheidet, und verlinkt ihren Zwilling.
const namensSchluessel = (s: string) => s.toLowerCase().replace(/["'`„“”‚‘’]/g, '').replace(/\s+/g, ' ').trim();

function gruppiere<T>(liste: readonly T[], name: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of liste) {
    const k = namensSchluessel(name(x));
    const g = m.get(k);
    if (g) g.push(x);
    else m.set(k, [x]);
  }
  return m;
}

const itemGruppen = new Map<Locale, Map<string, Item[]>>();
const itemGruppe = (i: Item, lang: Locale): Item[] => {
  let m = itemGruppen.get(lang);
  if (!m) itemGruppen.set(lang, (m = gruppiere(pageItems, (x) => displayName(x, lang))));
  return m.get(namensSchluessel(displayName(i, lang))) ?? [i];
};

const hatWerte = (i: Item) => !!i.game && (!!i.game.stats && Object.keys(i.game.stats).length > 0 || !!i.game.variants?.length);
const hatPreise = (i: Item) => minPrice(i) != null;

/** Was dieses Item von seinen gleichnamigen unterscheidet — oder null. */
export function itemZusatz(i: Item, lang: Locale): string | null {
  const g = itemGruppe(i, lang);
  if (g.length < 2) return null;
  const t = bwT(lang);
  // Deutscher Name doppelt, englischer verschieden: der englische trennt.
  if (lang === 'de' && new Set(g.map((x) => namensSchluessel(x.name))).size === g.length) return i.name;
  // Katalogpaare: eines traegt Preise, das andere die Spielwerte.
  const art = (x: Item) => (hatPreise(x) && !hatWerte(x) ? 'preise' : hatWerte(x) && !hatPreise(x) ? 'werte' : '');
  const arten = g.map(art);
  if (arten.every(Boolean) && new Set(arten).size === g.length) return t(art(i) === 'preise' ? 'twinPrices' : 'twinStats');
  return fill(t('twinVariant'), { n: String(g.indexOf(i) + 1) });
}

/** Anzeigename mit Zusatz: „Lynx Legs (mit Preisen)", deutsch doppelt „Lynx-Beine (Dunkelgrün) / Lynx Arms Dark Green". */
export function itemNameMitZusatz(i: Item, lang: Locale): string {
  const name = displayName(i, lang);
  const zusatz = itemZusatz(i, lang);
  return !zusatz ? name : zusatz === i.name ? `${name} / ${zusatz}` : `${name} (${zusatz})`;
}

/** Die anderen Item-Seiten mit demselben Namen, je mit Namen samt Zusatz. */
export function itemZwillinge(i: Item, lang: Locale): { item: Item; label: string }[] {
  return itemGruppe(i, lang).filter((x) => x !== i).map((x) => ({ item: x, label: itemNameMitZusatz(x, lang) }));
}

const bauplanGruppen = gruppiere(blueprints, (b) => b.name);
const bauplanGruppe = (b: BlueprintEntry) => bauplanGruppen.get(namensSchluessel(b.name)) ?? [b];

/** Was diesen Bauplan von seinen gleichnamigen unterscheidet — oder null. */
export function bauplanZusatz(b: BlueprintEntry, lang: Locale): string | null {
  const g = bauplanGruppe(b);
  if (g.length < 2) return null;
  // 1. Groesse der Ausfuehrung, die er herstellt (BroadSpec S2 / S3).
  const groesse = (x: BlueprintEntry) => itemForBlueprint(x)?.game?.variants?.find((v) => v.guid === x.entity_guid)?.size ?? null;
  const gs = g.map(groesse);
  if (gs.every((n) => n != null) && new Set(gs).size === g.length) return `S${groesse(b)}`;
  // 2. Masse des Ergebnisses (Serac 10.000 kg / 14.000 kg). Verglichen wird
  //    die angezeigte Beschriftung: num() rundet auf drei Nachkommastellen,
  //    1,0001 und 1,0002 kg hiessen sonst beide „1 kg“ (Review #434).
  const ms = g.map((x) => x.item_stats?.mass_kg ?? null);
  if (ms.every((n) => n != null)) {
    const labels = ms.map((n) => `${num(n!, lang)} kg`);
    if (new Set(labels).size === g.length) return labels[g.indexOf(b)];
  }
  // 3. Die Spieldaten unterscheiden sie nur intern.
  return fill(bwT(lang)('twinVariant'), { n: String(g.indexOf(b) + 1) });
}

/** Die anderen Bauplaene mit demselben Namen, je mit ihrem Zusatz. */
export function bauplanZwillinge(b: BlueprintEntry, lang: Locale): { bp: BlueprintEntry; zusatz: string }[] {
  return bauplanGruppe(b).filter((x) => x !== b).map((x) => ({ bp: x, zusatz: bauplanZusatz(x, lang) ?? '' }));
}

/* ---------- Items ---------- */

export interface ItemSeo {
  title: string;
  description: string;
  /** Einleitungssatz auf der Seite (H1-Untertitel) */
  lead: string;
}

/** Wie kommt man an das Item? Steuert Titel-Variante und Einleitung. */
export function acquisition(i: Item): 'buy' | 'loot' | 'exclusive' | 'none' {
  if (minPrice(i) != null) return 'buy';
  // Eine `exclusive`-Zeile ist KEIN Fundort — sie sagt gerade, dass es keinen
  // gibt (Promo, Concierge, Twitch-Drop). Sonst stuende "1 bekannter Fundort"
  // ueber einem Item, das nachweislich nirgends droppt.
  if (i.obtain.some((o) => o.kind === 'loot') || i.guide) return 'loot';
  if (i.obtain.length) return 'exclusive';
  return 'none';
}

/** Traegt das Item einen lesbaren Spieltyp (Weapon, Cooler …)? Sonst gilt die Kategorie. */
const ausSpieltyp = (i: Item) => !!i.game?.gameType && !/^Char_/.test(i.game.gameType);

/**
 * "Ballistic Cannon" — die Gattung laut Spieldaten, sonst die Kategorie mit
 * ihrem lesbaren Namen in der Sprache der Seite („Helme“, „Underbarrel“), wie
 * in Liste und Krumen; bis 24.11.2026 stand hier der Datenschluessel
 * („Helmets“ auf /de/, „BottomAttachment“).
 */
function kindOf(i: Item, lang: Locale): string {
  const g = i.game;
  // `Char_Armor_Torso` & Co. sind INTERNE Typnamen und gehoeren nicht in eine
  // Meta-Description. Fuer sie steht die lesbare Kategorie („Oberkörper“/„Core“) da.
  if (g?.gameType && ausSpieltyp(i)) {
    const typ = lesbarerBezeichner(g.gameType);
    const unter = g.subType && g.subType !== g.gameType ? lesbarerBezeichner(g.subType) : '';
    /* Doppelung vermeiden: „Missile Rack Missile Launcher" liest sich
       schlechter als „Missile Rack". Traegt der Untertyp das Hauptwort des
       Typs schon, steht er allein. */
    if (unter && typ.split(' ').every((w) => unter.includes(w))) return unter;
    return unter ? `${unter} ${typ}` : typ;
  }
  return kategorieTitel(i.category, lang);
}

/**
 * "The <Name>" — ausser der Name traegt den Artikel schon ("The Butcher
 * Helmet"). Anlass 04.11.2026: "The The Butcher Helmet is a …" auf drei
 * Item-Seiten und einer Blueprint-Seite (verify:sprache, Regel 5).
 */
const theName = (name: string) => (/^the\s/i.test(name) ? name : `The ${name}`);

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
  const kind = kindOf(i, lang);
  const mfr = i.game?.manufacturer;
  const name = displayName(i, lang);
  if (lang === 'de') {
    return mfr
      ? `${name} — ${kind} von ${mfr}, Star Citizen Alpha ${patch}.`
      : `${name} — ${kind}, Star Citizen Alpha ${patch}.`;
  }
  /* Kommt die Art aus der Kategorie, ist sie oft ein Plural ("Legs", "Arms",
     "Helmets") oder ein Sammelwort ("Footwear"), und "is a Clark Defense
     Systems Legs" ist kein Englisch (Audit 04.11.2026: 2.597 der 5.369
     EN-Item-Seiten). Dann nennt der Satz die Kategorie als Kategorie, im
     Wortlaut von Krisz (04.11.2026): "an item by <Hersteller> in the <Art>
     category", der Patch wie im Satz der Spieltypen mit "in" angeschlossen
     (Review: nach einem Komma stand er grammatisch lose). Die Spieltypen
     (Weapon, Cooler, Shield) sind Einzahl und bleiben im Satz. */
  if (!ausSpieltyp(i)) {
    const von = mfr ? ` by ${mfr}` : '';
    return `${theName(name)} is an item${von} in the ${kind} category in Star Citizen Alpha ${patch}.`;
  }
  const phrase = mfr ? `${mfr} ${kind}` : kind;
  return `${theName(name)} is ${an(phrase)} ${phrase} in Star Citizen Alpha ${patch}.`;
}

export function itemSeo(i: Item, lang: Locale): ItemSeo {
  const t = itemT(lang);
  const name = displayName(i, lang);
  // Im Titel steht der Zusatz, damit gleichnamige Seiten unterscheidbar sind (D7).
  const titelName = itemNameMitZusatz(i, lang);
  const mode = acquisition(i);
  const lo = minPrice(i);
  const hi = maxPrice(i);
  const vendors = i.obtain.filter((o) => o.price != null).length;
  const cheapest = sortedObtain(i).find((o) => o.price != null);
  const stat = primaryStat(i, lang);

  const title =
    lang === 'de'
      ? mode === 'buy'
        ? `${titelName} — Preis & Kauforte | Star Citizen ${ITEM_PATCH} | VerseBase`
        : mode === 'loot'
          ? `${titelName} — Fundorte & Werte | Star Citizen ${ITEM_PATCH} | VerseBase`
          : `${titelName} — Werte & Daten | Star Citizen ${ITEM_PATCH} | VerseBase`
      : mode === 'buy'
        ? `${titelName} — Price & Where to Buy | Star Citizen ${ITEM_PATCH} | VerseBase`
        : mode === 'loot'
          ? `${titelName} — Where to Find It & Stats | Star Citizen ${ITEM_PATCH} | VerseBase`
          : `${titelName} — Stats & Data | Star Citizen ${ITEM_PATCH} | VerseBase`;

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
    else parts.push(`${name} — ${kindOf(i, lang)} in Star Citizen ${ITEM_PATCH}.`);
    if (vendors > 1) parts.push(`${vendors} Verkaufsstellen im Vergleich.`);
    if (stat) parts.push(`${stat[0]}: ${stat[1]}.`);
    parts.push(`Stand ${datumLang(db.pricesAsOf, lang)}.`);
  } else {
    if (mode === 'buy' && lo != null && cheapest)
      parts.push(
        `${name} costs from ${auec(lo, lang)} in Star Citizen ${ITEM_PATCH} — cheapest at ${cheapest.loc}.`
      );
    else if (mode === 'loot')
      parts.push(
        `${name}: ${plural(i.obtain.length, 'known location', 'known locations')} in Star Citizen ${ITEM_PATCH}.`
      );
    else parts.push(`${name} — ${kindOf(i, lang)} in Star Citizen ${ITEM_PATCH}.`);
    if (vendors > 1) parts.push(`${vendors} vendors compared.`);
    if (stat) parts.push(`${stat[0]}: ${stat[1]}.`);
    parts.push(`As of ${datumLang(db.pricesAsOf, lang)}.`);
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
  // Lesbarer Name wie auf der Seite („Helme (Rüstung)“), nicht der
  // Datenschluessel; die Adresse bleibt der Schluessel.
  const root = rootCategory(cat);
  const leaf = kategorieTitel(cat, lang);
  const label = cat === root ? leaf : `${leaf} (${categoryLabel(root, lang)})`;
  // Ab Seite 2 traegt der Titel die Seitenzahl STATT der Gesamtzahl: sonst
  // behaupten zehn URLs dieselbe Menge und sehen in der Trefferliste gleich aus.
  const pageSuffix = page > 1 ? (lang === 'de' ? ` — Seite ${page}/${pages}` : ` — page ${page}/${pages}`) : '';
  const countPart = page > 1 ? '' : lang === 'de' ? ` — alle ${num(count, lang)} Items` : ` — all ${num(count, lang)} items`;
  return lang === 'de'
    ? {
        title: `${label}${countPart}${pageSuffix} | Star Citizen ${ITEM_PATCH} | VerseBase`,
        description: clip(
          `Alle ${num(count, lang)} Items der Kategorie ${leaf} in Star Citizen ${ITEM_PATCH} mit Kaufpreis, Verkaufsstelle und Spielwerten. Stand ${datumLang(db.pricesAsOf, lang)}.`,
          158
        ),
      }
    : {
        title: `${label}${countPart}${pageSuffix} | Star Citizen ${ITEM_PATCH} | VerseBase`,
        description: clip(
          `All ${num(count, lang)} items in ${leaf} in Star Citizen ${ITEM_PATCH} with buy price, vendor location and game stats. As of ${datumLang(db.pricesAsOf, lang)}.`,
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

  const zusatz = bauplanZusatz(b, lang);
  const titelName = zusatz ? `${b.name} (${zusatz})` : b.name;
  const title =
    lang === 'de'
      ? `${titelName} — Blueprint, Zutaten & Craft-Zeit | Star Citizen ${patch} | VerseBase`
      : `${titelName} — Blueprint, Ingredients & Craft Time | Star Citizen ${patch} | VerseBase`;

  const description =
    lang === 'de'
      ? clip(
          `${b.name} craften in Star Citizen ${patch}: ${b.ingredients.length} Zutaten-Slots (${res.slice(0, 3).join(', ')}), Craft-Zeit ${time}${mis ? `, ${mis} Missionen droppen den Blueprint` : ''}. Stand ${datumLang(snapshot, lang)}.`,
          158
        )
      : clip(
          `Craft ${b.name} in Star Citizen ${patch}: ${b.ingredients.length} ingredient slots (${res.slice(0, 3).join(', ')}), craft time ${time}${mis ? `, dropped by ${mis} missions` : ''}. As of ${datumLang(snapshot, lang)}.`,
          158
        );

  const lead =
    lang === 'de'
      ? `Der Blueprint ${b.name} (${b.category}) braucht ${b.ingredients.length} Zutaten-Slots und ${time} Craft-Zeit.${mis ? ` ${mis} Missionen können ihn droppen.` : ''}`
      : `${theName(b.name)} blueprint (${b.category}) needs ${b.ingredients.length} ingredient slots and ${time} of craft time.${mis ? ` ${mis} missions can drop it.` : ''}`;

  return { title, description, lead };
}
