// Items in 3D (Krisz 22.11.2026): Rüstungsteile als drehbares Modell auf der
// Item-Seite und am Blueprint. Nur im Vorschau-Bau (HAS_HANGAR), aus demselben
// Grund wie der Hangar: es sind echte Spielmodelle, und ob die öffentlich
// ausgeliefert werden dürfen, ist offen (scripts/lib/hangar-switch.mjs).
//
// Die Modelle liegen NICHT im Repo und nicht in dist/, sondern im eigenen
// Speicher bei Cloudflare (R2, Domain items.verse-base.com; Krisz' Wahl vom
// 22.11.2026: ein Patch baut alles neu, und jede Neuauflage ließe die
// Git-Geschichte um Gigabytes wachsen). src/data/item-3d.json nennt je Item
// die Modelldatei; ihr Name trägt den Inhalt als Kennung, darum darf der
// Browser sie für immer zwischenspeichern. Texturen liegen daneben unter t/
// und werden von Farbvarianten geteilt.
//
// ITEM3D_BASE (nur Bauzeit) zeigt die Seiten zum Ausprobieren auf eine andere
// Ablage, etwa einen lokalen Ordner unter dist/.
import { createHash } from 'node:crypto';
import DATA from '../data/item-3d.json';
import { HAS_HANGAR } from './seo';

// Je Item [Datei, KB]. JSON-Importe kennen keine Tupel, darum ohne Umwandlung
// gelesen und beim Zugriff in die erwarteten Typen gebracht; die Form selbst
// prueft verify:item3d [2] am gebauten Stand.
const items: Record<string, readonly (string | number)[]> = DATA.items;

const basisRoh =
  (typeof process !== 'undefined' && process.env?.ITEM3D_BASE) || DATA.base;
/** Wurzel der Ablage, immer mit / am Ende. */
export const ITEM3D_BASE = basisRoh.endsWith('/') ? basisRoh : `${basisRoh}/`;

export interface Item3d {
  /** Volle Adresse der .glb-Datei. */
  url: string;
  /** Größe der Modelldatei samt eigener Texturen in KB (geteilte mitgezählt). */
  kb: number;
}

/** Das 3D-Modell eines Items, oder null (kein Modell, oder Live-Bau). */
export function item3dFor(id: string | null | undefined): Item3d | null {
  if (!HAS_HANGAR || !id) return null;
  const e = items[id];
  return e ? { url: ITEM3D_BASE + String(e[0]), kb: Number(e[1]) } : null;
}

/** Wie viele Items ein Modell haben (für Selbstauskünfte). */
export const ITEM3D_ANZAHL = Object.keys(items).length;

/** Die ganze Liste für die Items-Werkbank, die ihr Modell erst kennt, wenn
 *  man ein Item wählt: Ablage dieses Baus und je Item [Datei, KB], wie in
 *  src/data/item-3d.json. Ausgeliefert als /hangar-item3d.json, nur im
 *  Vorschau-Bau (src/hangar-routes/, scripts/lib/hangar-switch.mjs). */
export const ITEM3D_LISTE_JSON = JSON.stringify({ base: ITEM3D_BASE, items });

/** Adresse der Liste mit Inhaltskennung (darf lange im Zwischenspeicher
 *  bleiben), oder null im Live-Bau: dort gibt es keine Liste. */
export const ITEM3D_LISTE_URL: string | null = HAS_HANGAR
  ? `/hangar-item3d.json?v=${createHash('sha1').update(ITEM3D_LISTE_JSON).digest('hex').slice(0, 8)}`
  : null;
