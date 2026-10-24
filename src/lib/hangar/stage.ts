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
  /** Ergaenzung der leichteren Stufe aus der vollen (Glas, Rohre, Fuellung), nur neben der Moebeldatei */
  readonly patch?: { url: string; bytes?: number } | null;
  /** Aufzugsschacht unter dem Schiffsfeld: Bausatz (glb) und Lampenliste (json), HALL_SHAFT im Viewer; gate: Schachttor (glb) und Bahnen seiner Teile (json), buildGate im Viewer; rand: fester Rand um die Öffnung (glb, json), buildRand im Viewer; sound: Ordner und Version der Geräusche von Plattform und Tor, hangarSound im Viewer */
  readonly lift?: { url: string; json: string; bytes?: number; gate?: { url: string; json: string; bytes?: number } | null; rand?: { url: string; json: string; bytes?: number } | null; sound?: { dir: string; v: string } | null } | null;
  /** Werkstatt: Requisiten (glb), Boden-Decals (boden, eigene Datei fuers Telefon), Anordnung (json), placeWorkshop im Viewer; dienst: Geraetesatz fuer den Wartungsplatz am Schiff (scripts/build-hangar-dienst.mjs), layDienst im Viewer; deko: Satz der Hallendeko (build-hangar-dienst.mjs deko), buildDeko im Viewer */
  readonly workshop?: { url: string; json: string; bytes?: number; boden?: { url: string; bytes?: number } | null; dienst?: { url: string; bytes?: number } | null; deko?: { url: string; bytes?: number } | null } | null;
  /** Werkhalle fuer Bodenfahrzeuge: Garage aus dem Spiel (glb), ihre Masse, Tor und Leuchtkoerper (json), Bühnen (buehne, glb); WERK im Viewer stellt sie hinter die Westnische */
  readonly werk?: { id: string; url: string; json: string; bytes?: number; buehne?: { url: string; bytes?: number } | null } | null;
}

/** Wo ein Fahrzeug in der Szene steht: Schiffe auf dem Feld der Halle, Bodenfahrzeuge (vehicles.json isSpaceship === false) in der Werkhalle. */
export type StageOrt = 'halle' | 'werk';

export interface StageConfig {
  /** versioned('assets/hangar-viewer.js', …) */
  readonly viewer: string;
  /** Wird unverändert in initHangar(container, { reduceMotion, ...opts }) gespreizt: neue Szenen-Optionen brauchen keine Oberflaechen-Aenderung. */
  readonly opts: { readonly hall?: HallConfig | null; readonly crew?: { url: string } | null } & Readonly<Record<string, unknown>>;
  /** Je Id aus HANGAR_IDS: [Geometrie-glb (Hangar-Fassung mit Fahrwerk, sonst Holo), Werkslack-glb oder null, Herstellerkuerzel, Ort] fuer show(). Ort 'werk': Bodenfahrzeug, steht in der Werkhalle hinter der Westnische; 'halle': auf dem Schiffsfeld. */
  readonly models: Readonly<Record<ShipId, readonly [glb: string, tex: string | null, maker: string, ort: StageOrt]>>;
}
