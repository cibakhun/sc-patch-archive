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

/** Echte Halle, wie initHangar sie liest (API-Kopf von assets/hangar-viewer.js). */
export interface HallConfig {
  /** Schluessel aus hangar-assets.json: waehlt HALL_DROP im Viewer, verify:hangar-hall liest ihn. */
  readonly id: string;
  readonly url: string;
  readonly room: unknown;
  readonly floor?: number;
  readonly bytes?: number;
  readonly lights?: string | null;
  readonly probes?: string | null;
  /** Leichtere Stufe fuers Telefon, nur ohne Moebeldatei */
  readonly lite?: { url: string; bytes?: number } | null;
  /** Moebel als eigene Datei, nur neben der leichteren Stufe als Halle */
  readonly furniture?: { url: string; bytes?: number } | null;
}

export interface StageConfig {
  /** versioned('assets/hangar-viewer.js', …) */
  readonly viewer: string;
  /** Wird unverändert in initHangar(container, { reduceMotion, ...opts }) gespreizt: neue Szenen-Optionen brauchen keine Oberflaechen-Aenderung. */
  readonly opts: { readonly hall?: HallConfig | null; readonly crew?: { url: string } | null } & Readonly<Record<string, unknown>>;
  /** Je Id aus HANGAR_IDS: [Geometrie-glb, Werkslack-glb oder null, Herstellerkuerzel fuer show()]. */
  readonly models: Readonly<Record<ShipId, readonly [glb: string, tex: string | null, maker: string]>>;
}
