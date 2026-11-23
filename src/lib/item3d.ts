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
import DATA from '../data/item-3d.json';
import { HAS_HANGAR } from './seo';

type Eintrag = [datei: string, kb: number];
const items = (DATA as { items: Record<string, Eintrag> }).items;

const basisRoh =
  (typeof process !== 'undefined' && process.env?.ITEM3D_BASE) || (DATA as { base: string }).base;
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
  return e ? { url: ITEM3D_BASE + e[0], kb: e[1] } : null;
}

/** Wie viele Items ein Modell haben (für Selbstauskünfte). */
export const ITEM3D_ANZAHL = Object.keys(items).length;
