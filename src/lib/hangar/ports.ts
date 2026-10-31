// Serienausstattung je Port, verbunden mit den 3D-Hardpoints UEBER DEN
// PORTNAMEN, im glTF-Modellraum, den /holo/<id>.glb und /hangar/ships/<id>.glb
// teilen (Messung in .planning/notes/hangar-naht.md). Derselbe Join laeuft
// inline in ShipDetail.astro; ihn hierher zu ziehen ist bewusst vertagt.
// Achsregel (toGltf, hullBox) und Auffaechern (fanOut) liest das Hologramm des
// Datenblatts von hier.
//
// Bestand am 07.10.2026: 3.621 Ports auf 223 Schiffen tragen 3.642 Eintraege,
// 3.389 Ports haben einen Bone. 13 Ports tragen 2 bis 4 Items; sie bleiben ein
// Port mit einem Punkt (ein Marker), ihre Items werden in bay.ts zu Zeilen.

import shipLoadouts from '../../data/ship-loadouts.json';
import shipHardpoints from '../../data/ship-hardpoints.json';

declare const portBrand: unique symbol;
/** Portname in Kleinschreibung, z. B. 'hardpoint_gun_nose'. Patch-stabil, deshalb auch der URL-Schluessel hp=. */
export type PortName = string & { readonly [portBrand]: true };

/** glTF-Modellraum der .glb, Meter: Bug bei -Z, oben +Y. */
export type Vec3 = readonly [x: number, y: number, z: number];

export type LoadoutCat =
  | 'weapon' | 'missile' | 'countermeasure'
  | 'power' | 'shield' | 'cooler' | 'quantum' | 'radar'
  | 'h2fueltank' | 'qtfueltank' | 'orepod';

/** Ein Blatt-Item, wie ship-loadouts.json es fuehrt. name ist null bei 49 unlokalisierten Teilen. */
export interface StockItem {
  readonly name: string | null;
  readonly size: number | null;
  readonly cat: LoadoutCat;
  readonly cls: string;
  readonly count: number;
  readonly carrier?: 'turret';
  readonly turretKind?: 'manned' | 'remote' | 'pdc';
}

export interface Port {
  readonly name: PortName;
  readonly items: readonly StockItem[];
  /** null, wenn kein Bone diesen Portnamen traegt (232 von 3.621 Ports). */
  readonly p: Vec3 | null;
}

export interface ShipGeometry {
  readonly ports: readonly Port[];
  /** Rumpf-AABB (hp.hull, sonst hp.bbox) nach dem Achstausch, je Achse min/max. */
  readonly box: readonly [min: Vec3, max: Vec3] | null;
  /** Mitte der Box: die Markerschicht projiziert sie, um Marker hinter dem Rumpf zu dimmen. */
  readonly center: Vec3 | null;
}

export type Cry = readonly [number, number, number];
type ShipHp = { bbox: [Cry, Cry]; hull?: [Cry, Cry] | null; hp: { n: string; p: Cry }[] };

const LOADOUTS = (shipLoadouts as unknown as { ships: Record<string, Record<string, StockItem[]>> }).ships;
const HARDPOINTS = (shipHardpoints as unknown as { ships: Record<string, ShipHp> }).ships;

/** CryEngine schiffslokal (x Steuerbord, y Bug, z oben) nach glTF (x, z, -y). Die eine Achsregel. */
export function toGltf(p: Cry): Vec3 {
  return [p[0], p[2], -p[1]];
}

/** Eine CryEngine-AABB im glTF-Raum, je Achse min/max, ungerundet. */
export function hullBox(aabb: readonly [Cry, Cry]): readonly [Vec3, Vec3] {
  const a = toGltf(aabb[0]);
  const b = toGltf(aabb[1]);
  return [
    [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
    [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])],
  ];
}

const r2 = (x: number) => Math.round(x * 100) / 100;
const roundVec = (p: Vec3): Vec3 => [r2(p[0]), r2(p[1]), r2(p[2])];

/**
 * Alle Loadout-Ports des Schiffs in Loadout-Reihenfolge, je mit Markerpunkt.
 * Schiffe ohne Loadout (die vier ATLS) liefern ports: [].
 *
 * Mehrere Ports auf EINEM Bone-Punkt (Maschinenraum, Hammerhead 7x) faechern
 * auf einen kleinen Ring auf (fanOut), sonst laegen die Marker deckungsgleich
 * uebereinander.
 */
export function shipGeometry(id: string): ShipGeometry {
  const hp = HARDPOINTS[id];
  const stock = LOADOUTS[id] ?? {};
  const bones = new Map((hp?.hp ?? []).map((h) => [h.n.toLowerCase(), h.p]));
  const aabb = hp ? (hp.hull ?? hp.bbox) : null;
  const hull = aabb ? hullBox(aabb) : null;
  const box: readonly [Vec3, Vec3] | null = hull ? [roundVec(hull[0]), roundVec(hull[1])] : null;
  const center: Vec3 | null = box ? roundVec([(box[0][0] + box[1][0]) / 2, (box[0][1] + box[1][1]) / 2, (box[0][2] + box[1][2]) / 2]) : null;

  const points = Object.keys(stock).map((name) => {
    const b = bones.get(name);
    return b ? toGltf(b) : null;
  });
  if (hull) fanOut(points, hull);

  const ports: Port[] = Object.entries(stock).map(([name, items], i) => ({
    name: name as PortName,
    items,
    p: points[i] ? roundVec(points[i] as Vec3) : null,
  }));
  return { ports, box, center };
}

/**
 * Ring mit leichter Wendel um den gemeinsamen Punkt, Radius an die Huelle
 * gekoppelt. Ersetzt die Punkte, die mit einem anderen auf zwei Stellen
 * genau zusammenfallen, durch neue Arrays; alle anderen bleiben dieselben.
 * Hangar und Datenblatt-Hologramm faechern damit gleich auf.
 * @param box die ungerundete Huelle aus hullBox
 */
export function fanOut(points: (Vec3 | null)[], box: readonly [Vec3, Vec3]): void {
  const span = Math.max(box[1][0] - box[0][0], box[1][1] - box[0][1], box[1][2] - box[0][2]);
  const r = Math.min(2.2, Math.max(0.35, span * 0.02));
  const groups = new Map<string, number[]>();
  points.forEach((p, i) => {
    if (!p) return;
    const k = roundVec(p).join(',');
    const g = groups.get(k);
    if (g) g.push(i); else groups.set(k, [i]);
  });
  for (const idx of groups.values()) {
    if (idx.length < 2) continue;
    const c = points[idx[0]] as Vec3;
    idx.forEach((pi, i) => {
      const a = (i / idx.length) * Math.PI * 2;
      points[pi] = [c[0] + Math.cos(a) * r, c[1] + (i - (idx.length - 1) / 2) * r * 0.3, c[2] + Math.sin(a) * r];
    });
  }
}
