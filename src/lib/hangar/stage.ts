// Die Naht auf Seitenebene zwischen der Szene (HangarApp.astro, Sache der
// Szenen-Sitzung) und der Oberflaeche (HangarPage.astro und ihr Controller).
// Die Szene serialisiert EINE StageConfig nach
//   <script type="application/json" id="hg-stage">
// und rendert die drei Elemente, die der Controller per Id ansteuert. Das ist
// der ganze Vertrag; fuer Menschen steht er in .planning/notes/hangar-naht.md,
// gegen dist/ prueft ihn verify:hangar.
//
// Die Modellpolitik bleibt bei der Szene: welche Schiffe Werkslack tragen,
// welche zurueckgehalten sind (HOLD), welche Halle und Crew laden. Die
// Oberflaeche baut nie selbst eine Modell-URL, sie fragt models[id].

import type { ShipId } from './catalog';

export interface StageConfig {
  /** versioned('assets/hangar-viewer.js', …) */
  readonly viewer: string;
  /** Wird unverändert in initHangar(container, { reduceMotion, ...opts }) gespreizt: neue Szenen-Optionen brauchen keine Oberflaechen-Aenderung. */
  readonly opts: { readonly hall?: { url: string; room: unknown } | null; readonly crew?: { url: string } | null } & Readonly<Record<string, unknown>>;
  /** Je Id aus HANGAR_IDS: [Geometrie-glb, Werkslack-glb oder null, Herstellerkuerzel fuer show()]. */
  readonly models: Readonly<Record<ShipId, readonly [glb: string, tex: string | null, maker: string]>>;
}

/** Ids, die der Controller liest; die Szene rendert alle in section.hg-stage. */
export const STAGE_IDS = { canvas: 'hg-canvas', load: 'hg-load', fallback: 'hg-fallback', config: 'hg-stage' } as const;

/**
 * Ereignis auf section.hg-stage, sobald initHangar aufgeloest hat, detail = die
 * Viewer-API. Szenenseitige Skripte (etwa ein kuenftiger Hallenschalter) hoeren
 * darauf, statt den Viewer ein zweites Mal zu importieren.
 */
export const VIEWER_EVENT = 'hangar:viewer';
