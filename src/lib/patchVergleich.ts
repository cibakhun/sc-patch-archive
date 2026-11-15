/* ============================================================
   patchVergleich.ts — liest, was scripts/patch-vergleich.mjs je Patch
   als Aenderung festgehalten hat, und loest jede Zeile auf die Seite auf,
   die es heute dazu gibt.

   Nur fuer den Seitenbau (Frontmatter): Items, Bauplaene und Auftraege
   landen sonst im Client-Bundle.
   ============================================================ */
import type { Locale } from '../i18n/ui';
import VEHICLES from '../data/vehicles.json';
import UEBERSICHT from '../data/patch-vergleich/uebersicht.json';
import { items, pageItemIds } from './items';
import { blueprints, blueprintPath } from './crafting';
import { missionBySlug } from './missions';

/* ---------- Typen ---------- */

export type Kind = 'ship' | 'price' | 'item' | 'blueprint' | 'mission';
export type Change = 'new' | 'renamed' | 'changed' | 'removed';
export type Wert = number | string | boolean | string[] | null;

export type FeldAenderung = { feld: string; vorher: Wert; nachher: Wert };
export type FeldWert = { feld: string; wert: Wert };
export type Angebot = { preis: number; haendler: string; ort: string; system: string };

type Datensatz = { kind: Exclude<Kind, 'price'>; id: string; slug?: string; name: string };
type Kaufangebot = { kind: 'price'; id: string; slug: string; name: string };
export type Eintrag =
  | (Datensatz & { change: 'new'; werte: FeldWert[] })
  | (Datensatz & { change: 'renamed'; nameVorher: string; slugVorher?: string; felder: FeldAenderung[] })
  | (Datensatz & { change: 'changed'; felder: FeldAenderung[] })
  | (Datensatz & { change: 'removed' })
  | (Kaufangebot & { change: 'new'; angebote: Angebot[] })
  | (Kaufangebot & { change: 'removed' });

export type Stand = {
  version: string;
  /** git-Ref, aus dem der Stand gelesen wurde (z. B. 74f9a2ee^), oder Arbeitsbaum */
  ref: string;
  commit: string;
  ungesichert?: string[];
  /** Changelist je Datei */
  cl: Partial<Record<'vehicles' | 'items' | 'crafting' | 'missions', string>>;
  preiseVom: string;
};
export type Zaehler = Record<Kind, Record<Change, number>>;
export type Bestand = Record<Kind | 'itemKatalog', { vorher: number; nachher: number }>;

export type PatchVergleich = {
  schema: 1;
  von: Stand;
  nach: Stand;
  bestand: Bestand;
  zaehler: Zaehler;
  /** Beschriftung je Feld, nur fuer die Felder, die in diesem Paar verglichen wurden */
  felder: Record<Exclude<Kind, 'price'>, Record<string, Record<Locale, string>>>;
  ausnahmen: { kind: Kind; feld: string; ids: string[]; anlass: string }[];
  eintraege: Eintrag[];
};

export type UebersichtZeile = { von: string; nach: string; datei: string; bestand: Bestand; zaehler: Zaehler };

/* ---------- Laden ---------- */

const DATEIEN = import.meta.glob<PatchVergleich>('../data/patch-vergleich/*__*.json', { eager: true, import: 'default' });
const nachDatei = new Map(Object.entries(DATEIEN).map(([pfad, v]) => [pfad.split('/').pop()!, v]));

/** Je Paar die Zaehler, aelteste zuerst. */
export const uebersicht: UebersichtZeile[] = (UEBERSICHT as { paare: UebersichtZeile[] }).paare;

export function patchVergleich(von: string, nach: string): PatchVergleich | null {
  return nachDatei.get(`${von}__${nach}.json`) ?? null;
}

/** Der Vergleich, der zur Patchseite `version` fuehrt (sein Vorgaenger -> version). */
export function vergleichZu(version: string): PatchVergleich | null {
  const zeile = uebersicht.find((z) => z.nach === version);
  return zeile ? nachDatei.get(zeile.datei) ?? null : null;
}

export function feldLabel(v: PatchVergleich, kind: Exclude<Kind, 'price'>, feld: string, lang: Locale): string {
  return v.felder[kind]?.[feld]?.[lang] ?? feld;
}

/* ---------- Seiten ---------- */

const schiffIds = new Set((VEHICLES as { vehicles: { id: string }[] }).vehicles.map((v) => v.id));
const itemNachGuid = new Map<string, string>();
for (const i of items) {
  if (i.game?.guid) itemNachGuid.set(i.game.guid, i.id);
  for (const a of i.game?.guidAliases ?? []) if (!itemNachGuid.has(a)) itemNachGuid.set(a, i.id);
}
const bauplanNachGuid = new Map<string, (typeof blueprints)[number]>();
for (const b of blueprints) if (b.entity_guid && !bauplanNachGuid.has(b.entity_guid)) bauplanNachGuid.set(b.entity_guid, b);

/**
 * Basisform des Seitenpfads (/items/x.html), wenn es die Seite heute gibt;
 * null fuer Entferntes und fuer alles ohne eigene Seite. Items und
 * Bauplaene gehen ueber ihre guid, weil Slugs mit dem Namen wandern.
 */
export function seite(e: Eintrag): string | null {
  if (e.change === 'removed') return null;
  switch (e.kind) {
    case 'ship':
    case 'price':
      return schiffIds.has(e.id) ? `/schiffe/${e.id}.html` : null;
    case 'item': {
      const id = itemNachGuid.get(e.id);
      return id && pageItemIds.has(id) ? `/items/${id}.html` : null;
    }
    case 'blueprint': {
      const b = bauplanNachGuid.get(e.id.split('#')[0]);
      return b ? blueprintPath(b) : null;
    }
    case 'mission':
      return e.slug && missionBySlug.has(e.slug) ? `/missionen/${e.slug}.html` : null;
  }
}
