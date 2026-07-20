// Precision Jump — Aaron-Halo-Routendaten (Stanton).
// ---------------------------------------------------------------------------
// Reine Referenzdaten für den Aaron-Halo-Routenrechner: die Ring-Bänder des
// Gürtels (Radien vom System-Ursprung) und die QT-Anker (Planeten-, Mond-,
// Lagrange- und Stations-Zentren als Stanton-Weltkoordinaten in Metern).
//
// Herkunft (transparent, drei Ebenen):
//  1. Aaron-Halo-HÜLLE (Innen-/Mittel-/Außenkante + vertikale Dicke) = GAME-
//     SOURCED aus Data.p4k 4.9 (aaronhalo.socpak) via scripts/datamine-aaron-halo.mjs
//     -> assets/aaron-halo-gamefiles.json. Siehe AH_GAME_ENVELOPE.
//  2. Die feinen 10 Dichtebänder = cstone.space-Community-Vermessung (~Patch 3.16).
//     Sie liegen INNERHALB der game-sourced Hülle (validiert), sind aber selbst
//     kein sauberer Spielwert -> Ehrlichkeitsmarker im UI.
//  3. QT-Anker-Koordinaten (Planeten/Monde/Lagrange) = GAME-SOURCED aus Data.p4k
//     4.9 (stantonsystem.socpak OOC_*-Platzierungen). Jordesseys Einsendung war
//     die Vorlage und deckt sich fast überall auf den Meter; einzelne Punkte
//     (z. B. MIC-L5) korrigiert der Spielwert. Stations-Aliase lösen weiterhin
//     bewusst auf das (game-sourced) Planetenzentrum auf.
// Alle Werte sind PATCH-VOLATIL — im Spiel gegenprüfen.
//
// Geometrie-Kern (Strahl-Kugel-Schnitt) lebt bewusst NUR im Client-JS der
// Komponente — der Server rendert Auswahl/Tabellen, der Client rechnet live.
import halo from '../../assets/aaron-halo-gamefiles.json';
import anchorsData from '../../assets/stanton-anchors-gamefiles.json';

export type DensityClass = 'low' | 'medium-low' | 'medium' | 'high';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface BandInfo {
  name: string;
  /** Radius der Spitzendichte vom Stanton-Ursprung, in km */
  peakDensityRadiusKm: number;
  innerRadiusKm: number;
  outerRadiusKm: number;
  densityClass: DensityClass;
}

/** Ein flach serialisierbarer Anker-Datensatz (SSR → Client via JSON). */
export interface AnchorRecord {
  id: string;
  key: string;
  group: 'Orbital Station Aliases' | 'Major Planets' | 'Moons' | 'Lagrange Centres';
  displayName: string;
  type: 'planet' | 'moon' | 'lagrange' | 'station alias';
  canonicalName: string;
  point: Vec3;
}

// -- Aaron-Halo-Bänder (10 Dichtebänder, Spitzendichte-Radius in km) ----------
export const AH_BAND_INFO: Record<string, BandInfo> = {
  band1: { name: 'Band 1', peakDensityRadiusKm: 19_702_000, innerRadiusKm: 19_673_000, outerRadiusKm: 19_715_000, densityClass: 'low' },
  band2: { name: 'Band 2', peakDensityRadiusKm: 19_857_000, innerRadiusKm: 19_815_000, outerRadiusKm: 19_914_000, densityClass: 'medium-low' },
  band3: { name: 'Band 3', peakDensityRadiusKm: 19_995_000, innerRadiusKm: 19_914_000, outerRadiusKm: 20_071_000, densityClass: 'medium' },
  band4: { name: 'Band 4', peakDensityRadiusKm: 20_168_000, innerRadiusKm: 20_129_000, outerRadiusKm: 20_230_000, densityClass: 'medium-low' },
  band5: { name: 'Band 5', peakDensityRadiusKm: 20_320_000, innerRadiusKm: 20_230_000, outerRadiusKm: 20_407_000, densityClass: 'high' },
  band6: { name: 'Band 6', peakDensityRadiusKm: 20_447_000, innerRadiusKm: 20_407_000, outerRadiusKm: 20_514_000, densityClass: 'medium' },
  band7: { name: 'Band 7', peakDensityRadiusKm: 20_662_000, innerRadiusKm: 20_514_000, outerRadiusKm: 20_750_000, densityClass: 'medium' },
  band8: { name: 'Band 8', peakDensityRadiusKm: 20_881_000, innerRadiusKm: 20_793_000, outerRadiusKm: 20_968_000, densityClass: 'low' },
  band9: { name: 'Band 9', peakDensityRadiusKm: 21_082_000, innerRadiusKm: 21_046_000, outerRadiusKm: 21_132_000, densityClass: 'low' },
  band10: { name: 'Band 10', peakDensityRadiusKm: 21_207_000, innerRadiusKm: 21_159_000, outerRadiusKm: 21_299_000, densityClass: 'medium' },
};

// -- Orbitalstationen: nutzen bewusst das Zentrum ihres Mutterplaneten --------
// (kleiner Endpunkt-Fehler gegen eine einfache, wiederholbare Routen-Bibliothek)
export const ORBITAL_STATION_ANCHORS: Record<
  string,
  { name: string; canonicalAnchor: keyof typeof BODY_CENTRES; note: string }
> = {
  everusHarbor: { name: 'Everus Harbor', canonicalAnchor: 'hurston', note: 'Uses Hurston centre' },
  seraphimStation: { name: 'Seraphim Station', canonicalAnchor: 'crusader', note: 'Uses Crusader centre' },
  baijiniPoint: { name: 'Baijini Point', canonicalAnchor: 'arcCorp', note: 'Uses ArcCorp centre' },
  portTressler: { name: 'Port Tressler', canonicalAnchor: 'microTech', note: 'Uses microTech centre' },
};

// -- Körper- + Lagrange-Zentren: GAME-SOURCED aus Data.p4k 4.9 ----------------
// (stantonsystem.socpak OOC_*-Container-Platzierungen, via
//  scripts/datamine-stanton-anchors.mjs -> assets/stanton-anchors-gamefiles.json).
// Weltkoordinaten in Metern, volle Präzision aus den Spieldateien.
type BodyRec = { name: string; type: 'planet' | 'moon'; parent?: string } & Vec3;
type LagRec = { name: string; parent: string } & Vec3;
export const BODY_CENTRES = anchorsData.bodies as unknown as Record<string, BodyRec>;
export const LAGRANGE_CENTRES = anchorsData.lagrange as unknown as Record<string, LagRec>;

/**
 * Game-sourced Aaron-Halo-Hülle aus Data.p4k 4.9 (aaronhalo.socpak): die echten
 * radialen Kanten + vertikale Dicke des Rings, wie das Spiel sie definiert. Die
 * feinen 10 Dichtebänder (cstone-Vermessung) liegen innerhalb dieser Grenzen.
 */
export const AH_GAME_ENVELOPE = {
  innerEdgeKm: halo.innerEdgeKm,
  middleKm: halo.middleKm,
  outerEdgeKm: halo.outerEdgeKm,
  verticalHalfThicknessKm: halo.verticalHalfThicknessKm,
  source: 'Data.p4k 4.9 · aaronhalo.socpak',
} as const;

export const AH_BAND_METADATA = {
  name: 'Aaron Halo',
  system: 'Stanton',
  units: 'km',
  radiusOrigin: 'Stanton system origin',
  /** vertikale Halbdicke des Rings — GAME-SOURCED (aaronhalo.socpak, ±5.000 km) */
  verticalHalfThicknessKm: halo.verticalHalfThicknessKm,
  /** die 10 feinen Dichtebänder: cstone.space-Community-Vermessung */
  bandSurveySource: 'cstone.space (~3.16)',
  /** die Ring-Hülle (Kanten + Dicke): game-sourced */
  envelopeSource: 'Data.p4k 4.9',
  status: 'game-envelope + community-density-bands' as const,
} as const;

/**
 * Alle QT-Anker als flache Liste — Planeten, Monde, Lagrange-Zentren und
 * Stations-Aliase (die auf ihr Planetenzentrum auflösen). Wird server­seitig
 * für Auswahl + Tabellen genutzt und als JSON an den Client gereicht, damit die
 * Live-Neuberechnung dieselben Datensätze verwendet.
 */
export function buildAnchorRecords(): AnchorRecord[] {
  const records: AnchorRecord[] = [];

  for (const [key, value] of Object.entries(BODY_CENTRES)) {
    records.push({
      id: `body:${key}`,
      key,
      group: value.type === 'planet' ? 'Major Planets' : 'Moons',
      displayName: value.name,
      type: value.type,
      canonicalName: value.name,
      point: { x: value.x, y: value.y, z: value.z },
    });
  }

  for (const [key, value] of Object.entries(LAGRANGE_CENTRES)) {
    records.push({
      id: `lagrange:${key}`,
      key,
      group: 'Lagrange Centres',
      displayName: value.name,
      type: 'lagrange',
      canonicalName: value.name,
      point: { x: value.x, y: value.y, z: value.z },
    });
  }

  for (const [key, value] of Object.entries(ORBITAL_STATION_ANCHORS)) {
    const anchor = BODY_CENTRES[value.canonicalAnchor];
    records.push({
      id: `station:${key}`,
      key,
      group: 'Orbital Station Aliases',
      displayName: value.name,
      type: 'station alias',
      canonicalName: anchor.name,
      point: { x: anchor.x, y: anchor.y, z: anchor.z },
    });
  }

  return records;
}

/** Abgeleitete Band-Kennzahlen (Breite, geometrische Mitte, Randabstände). */
export function getBandMetrics(band: BandInfo) {
  return {
    widthKm: band.outerRadiusKm - band.innerRadiusKm,
    geometricCentreRadiusKm: (band.innerRadiusKm + band.outerRadiusKm) / 2,
    distanceFromInnerToPeakKm: band.peakDensityRadiusKm - band.innerRadiusKm,
    distanceFromPeakToOuterKm: band.outerRadiusKm - band.peakDensityRadiusKm,
  };
}
