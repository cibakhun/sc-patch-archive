// Precision Jump — Aaron-Halo-Routendaten (Stanton).
// ---------------------------------------------------------------------------
// Reine Referenzdaten für den Aaron-Halo-Routenrechner: die Ring-Bänder des
// Gürtels (Radien vom System-Ursprung) und die QT-Anker (Planeten-, Mond-,
// Lagrange- und Stations-Zentren als Stanton-Weltkoordinaten in Metern).
//
// Herkunft: Community-Vermessung (cstone.space) für die Halo-Band-Höhen; die
// Anker-Koordinaten sind die kanonischen Stanton-Zentren. Werkzeug und Rohdaten
// stammen aus einer Open-Source-Einsendung von „Jordessey". Die Werte sind
// PATCH-VOLATIL — im Spiel gegenprüfen (s. AH_BAND_METADATA.status).
//
// Geometrie-Kern (Strahl-Kugel-Schnitt) lebt bewusst NUR im Client-JS der
// Komponente — der Server rendert Auswahl/Tabellen, der Client rechnet live.

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

// -- Lagrange-Container-Zentren (Stanton-Weltkoordinaten, Meter) --------------
export const LAGRANGE_CENTRES: Record<string, { name: string; parent: string } & Vec3> = {
  hurL1: { name: 'HUR-L1', parent: 'hurston', x: 11565411328, y: 0, z: 0 },
  hurL2: { name: 'HUR-L2', parent: 'hurston', x: 14135502848, y: 0, z: 0 },
  hurL3: { name: 'HUR-L3', parent: 'hurston', x: -12850457600, y: -1123.422729, z: 0 },
  hurL4: { name: 'HUR-L4', parent: 'hurston', x: 6425228288, y: 11128823808, z: 0 },
  hurL5: { name: 'HUR-L5', parent: 'hurston', x: 6425227776, y: -11128823808, z: 0 },

  cruL1: { name: 'CRU-L1', parent: 'crusader', x: -17065957376, y: -2398464000, z: 0 },
  cruL2: { name: 'CRU-L2', parent: 'crusader', x: -20858376485, y: -2931474402, z: 0 },
  cruL3: { name: 'CRU-L3', parent: 'crusader', x: 18962164826, y: 2664965040, z: 0 },
  cruL4: { name: 'CRU-L4', parent: 'crusader', x: -7173168640, y: -17754204160, z: 0 },
  cruL5: { name: 'CRU-L5', parent: 'crusader', x: -11789008988, y: 15089246107, z: 0 },

  arcL1: { name: 'ARC-L1', parent: 'arcCorp', x: 16729134637, y: -19937006925, z: 8076.625 },
  arcL2: { name: 'ARC-L2', parent: 'arcCorp', x: 20446718503, y: -24367450991, z: 8076.625 },
  arcL3: { name: 'ARC-L3', parent: 'arcCorp', x: -25043446884, y: 14458841788, z: 8076.625 },
  arcL4: { name: 'ARC-L4', parent: 'arcCorp', x: 28478354916, y: 5021502483, z: 8076.625 },
  arcL5: { name: 'ARC-L5', parent: 'arcCorp', x: -9890422516, y: -27173732225, z: 8076.625 },

  micL1: { name: 'MIC-L1', parent: 'microTech', x: 20215824238, y: 33467065007, z: 0 },
  micL2: { name: 'MIC-L2', parent: 'microTech', x: 24708827153, y: 40905202459, z: 0 },
  micL3: { name: 'MIC-L3', parent: 'microTech', x: -22457170265, y: -37187612395, z: 0 },
  micL4: { name: 'MIC-L4', parent: 'microTech', x: -20971933230, y: 38045504032, z: 0 },
  micL5: { name: 'MIC-L5', parent: 'microTech', x: 43434842423.47, y: -859863968.2, z: 0 },
};

// -- Körper-Zentren: Planeten + ihre Monde ------------------------------------
export const BODY_CENTRES: Record<
  string,
  { name: string; type: 'planet' | 'moon'; parent?: string } & Vec3
> = {
  hurston: { name: 'Hurston', type: 'planet', x: 12850457093, y: 0, z: 0 },
  arial: { name: 'Arial', type: 'moon', parent: 'hurston', x: 12892673308, y: -31476128, z: 0 },
  aberdeen: { name: 'Aberdeen', type: 'moon', parent: 'hurston', x: 12905757636, y: 40955550, z: 0 },
  magda: { name: 'Magda', type: 'moon', parent: 'hurston', x: 12792686359, y: -74464581, z: 0 },
  ita: { name: 'Ita', type: 'moon', parent: 'hurston', x: 12830194716, y: 114913608, z: 0 },

  crusader: { name: 'Crusader', type: 'planet', x: -18962176000, y: -2664960000, z: 0 },
  cellin: { name: 'Cellin', type: 'moon', parent: 'crusader', x: -18987611119, y: -2709009661, z: 0 },
  daymar: { name: 'Daymar', type: 'moon', parent: 'crusader', x: -18930539540, y: -2610158765, z: 0 },
  yela: { name: 'Yela', type: 'moon', parent: 'crusader', x: -19022916799, y: -2613996152, z: 0 },

  arcCorp: { name: 'ArcCorp', type: 'planet', x: 18587664740, y: -22151916920, z: 0 },
  lyria: { name: 'Lyria', type: 'moon', parent: 'arcCorp', x: 18703607170, y: -22121650134, z: 0 },
  wala: { name: 'Wala', type: 'moon', parent: 'arcCorp', x: 18379649310, y: -22000466768, z: 0 },

  microTech: { name: 'microTech', type: 'planet', x: 22462085252, y: 37185744964, z: 0 },
  calliope: { name: 'Calliope', type: 'moon', parent: 'microTech', x: 22398369308, y: 37168840679, z: 0 },
  clio: { name: 'Clio', type: 'moon', parent: 'microTech', x: 22476728212, y: 37091020112, z: 0 },
  euterpe: { name: 'Euterpe', type: 'moon', parent: 'microTech', x: 22488109736, y: 37081123565, z: 0 },
};

export const AH_BAND_METADATA = {
  name: 'Aaron Halo',
  system: 'Stanton',
  units: 'km',
  radiusOrigin: 'Stanton system origin',
  /** nominale halbe Ringdicke senkrecht zur Ebene, km */
  verticalHalfThicknessKm: 5_000,
  /** Community-Vermessung, deren Patch-Stand die Band-Höhen tragen */
  sourceSurveyVersion: '3.16.1-LIVE',
  status: 'community-survey-data' as const,
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
