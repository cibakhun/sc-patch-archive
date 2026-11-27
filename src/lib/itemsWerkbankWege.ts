// Was das Item-Datenblatt beantwortet, fuer die Items-Werkbank (/items.html).
//
// Krisz 27.11.2026: „Da steht wieder ganz fett Datenblatt öffnen. Aber wofür
// sollte ein User den Datenblatt öffnen?“ Nach der Regel „nur Werkbänke für
// Menschen“ (26.11.2026) fuehrt kein Weg mehr aus der Werkbank aufs Blatt.
// Was bisher nur das Blatt wusste (Bericht „Datenblätter und Werkbänke“,
// Item-Teil: 6 Fragen gar nicht, 6 teilweise), steht deshalb hier, aus
// denselben Funktionen wie auf dem Blatt gerechnet:
//
//   sys   Ort einer Bezugszeile -> Sternsystem (shopSystem), fuer „Kaufen
//         nach System“ mit Filter und die Kaufen-Karte je System
//   i     je Item des Katalogs (gleiche Reihenfolge wie
//         assets/universal-items.json, null = nichts zu sagen):
//           h   1 = es gibt einen Bauplan (recipeForItem)
//           m   Missionen, die ihn geben: [Zahl, [Titel, Zusatz] …], die
//               ersten drei wie in „So bekommst du es“ (missionsWege)
//           hw  Wikelo-Tausche, die den Bauplan geben
//           w   Wikelo-Tausche, die das Item geben; wm die, die es verlangen
//           s   ab Werk: [[Schiffsname, 1 = Raumschiff / 0 = Fahrzeug] …]
//           sp  schiffsgebundenes Teil: Schiffsnamen (nur ohne s)
//           f   1 = der Bruchrechner kennt das Teil
//           v   1 = Fahrzeug-Item, seine Werte stehen beim Schiff
//           r   aehnliche Items (relatedItems) als Positionen im Katalog
//           z   gleichnamige Items: [[Position, Name mit Zusatz] …], zs der
//               eigene Zusatz
//   sets  Set-Id -> [Kopf, fehlende Teile | null, Laden | null, 1 = leer,
//         Hinweis | null] (setPreisText, dieselbe Zeile wie auf dem Blatt)
//
// Positionen statt Ids: 9.462 Items mal bis zu zwoelf Nachbarn waeren als Ids
// rund 1,5 MB, als Positionen ein Viertel. Werkbank und Bau lesen dieselbe
// Datei (assets/universal-items.json), die Reihenfolge ist also dieselbe;
// verify:werkbank-items prueft jede Antwort gegen das gebaute Blatt.
import { createHash } from 'node:crypto';
import type { Locale } from '../i18n/ui';
import { armorSets, items, pageItemIds, relatedItems, type Item } from './items';
import { recipeForItem } from './crafting';
import { missionsWege } from './bezugswege';
import { inFracturingCalc, schiffeZumTeil, shopSystem, stockShips, wikeloBlueprintTrades, wikeloTrades } from './itemLinks';
import { shipIdForVehicleItem } from './vehicleItems';
import { itemZusatz, itemZwillinge } from './itemSeo';
import { setPreisText } from './setPreisText';

/** So viele Missionstitel stehen offen in der Karte, wie auf dem Blatt. */
export const MISSIONEN_OFFEN = 3;

type Eintrag = {
  h?: 1; m?: [number, ...[string, string][]]; hw?: number;
  w?: number; wm?: number;
  s?: [string, 0 | 1][]; sp?: string[];
  f?: 1; v?: 1;
  r?: number[]; z?: [number, string][]; zs?: string;
};

export interface ItemsWege {
  sys: Record<string, string>;
  i: (Eintrag | null)[];
  sets: Record<string, [string, string | null, string | null, 0 | 1, string | null]>;
}

const stelle = new Map<string, number>(items.map((it, i) => [it.id, i]));

async function eintrag(it: Item, lang: Locale): Promise<Eintrag | null> {
  const e: Eintrag = {};
  const bp = recipeForItem(it);
  if (bp) {
    e.h = 1;
    const ms = missionsWege(bp, lang);
    if (ms.length) {
      e.m = [ms.length, ...ms.slice(0, MISSIONEN_OFFEN).map((m): [string, string] => (m.seite ? [m.titel, m.zusatz] : [m.label, '']))];
    }
    const hw = wikeloBlueprintTrades(bp.name);
    if (hw > 0) e.hw = hw;
  }
  const wk = wikeloTrades(it);
  if (wk?.reward) e.w = wk.reward;
  if (wk?.material) e.wm = wk.material;
  const s = stockShips(it);
  if (s.length) e.s = s.map((x) => [x.name, x.spaceship ? 1 : 0]);
  else {
    const sp = schiffeZumTeil(it);
    if (sp.length) e.sp = sp.map((x) => x.name);
  }
  if (inFracturingCalc(it)) e.f = 1;
  if (await shipIdForVehicleItem(it)) e.v = 1;
  if (pageItemIds.has(it.id)) {
    const r = relatedItems(it, 12).map((x) => stelle.get(x.id)).filter((n): n is number => n != null);
    if (r.length) e.r = r;
    const z = itemZwillinge(it, lang)
      .map((x): [number, string] | null => {
        const n = stelle.get(x.item.id);
        return n == null ? null : [n, x.label];
      })
      .filter((x): x is [number, string] => !!x);
    if (z.length) {
      e.z = z;
      const zs = itemZusatz(it, lang);
      if (zs) e.zs = zs;
    }
  }
  return Object.keys(e).length ? e : null;
}

async function baue(lang: Locale): Promise<ItemsWege> {
  const sys: Record<string, string> = {};
  for (const it of items) {
    for (const o of it.obtain) {
      // Wie zeilenSysteme() in bezugswege.ts: jede Zeile ausser Exklusiv
      // bekommt ihr System ueber den Ort (bestaetigte Fundorte nennen es
      // selbst, die stehen in `wo`).
      if (o.kind === 'exclusive' || o.wo || o.loc in sys) continue;
      const s = shopSystem(o.loc);
      if (s) sys[o.loc] = s;
    }
  }
  const i: (Eintrag | null)[] = [];
  for (const it of items) i.push(await eintrag(it, lang));
  const sets: ItemsWege['sets'] = {};
  for (const st of armorSets) {
    const z = setPreisText(st.id, lang);
    if (z.teile > 0) sets[st.id] = [z.kopf, z.ohne, z.ort, z.leer ? 1 : 0, z.titel];
  }
  return { sys, i, sets };
}

const fertig = new Map<Locale, Promise<{ json: string; url: string }>>();

/**
 * Inhalt und Adresse von /items-wege.json bzw. /de/items-wege.json. Die
 * Adresse traegt einen Hash ueber genau diesen Inhalt (wie der Missions-
 * Suchindex): neuer Inhalt, neue Adresse, kein Tag alter Cache.
 */
export function itemsWege(lang: Locale): Promise<{ json: string; url: string }> {
  let p = fertig.get(lang);
  if (!p) {
    p = baue(lang).then((d) => {
      const json = JSON.stringify(d);
      const hash = createHash('sha1').update(json).digest('hex').slice(0, 10);
      return { json, url: `${lang === 'de' ? '/de' : ''}/items-wege.json?v=${hash}` };
    });
    fertig.set(lang, p);
  }
  return p;
}
