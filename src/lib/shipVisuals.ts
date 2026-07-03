// Visual builders for the ship data sheets: dimension footprint, cargo cubes,
// fuel/speed/agility/defense gauges (catalog percentiles), quantum chips and
// insurance timers. Plain TS module — page frontmatter stays thin.
import type { CollectionEntry } from 'astro:content';
import { useTranslations, type Locale, DEFAULT_LOCALE } from '../i18n/ui';

type VehicleData = CollectionEntry<'vehicles'>['data'];
const nfL = (n: number, loc: string, d = 0) =>
  n.toLocaleString(loc, { minimumFractionDigits: 0, maximumFractionDigits: d });

export type Gauge = { label: string; value: string; pct: number };
export type DimViz = {
  l: number; w: number; h: number;
  footWidthPct: number;   // footprint width relative to panel (length vs catalog max)
  footAspect: string;     // css aspect-ratio "L / W"
  bars: Gauge[];          // Länge/Breite/Höhe vs catalog max
};
export type CargoViz = { scu: number; ore: number | null; cubes: number; cubeVal: number };
export type Visuals = {
  dims: DimViz | null;
  cargo: CargoViz | null;
  fuel: Gauge[];
  speeds: Gauge[];
  agility: Gauge[];
  firepower: Gauge[];
  defense: Gauge[];
  quantum: { label: string; value: string }[];
  insurance: { label: string; value: string; gold?: boolean }[];
};

function pctRank(sorted: number[], x: number): number {
  if (sorted.length === 0) return 0;
  let lo = 0, hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= x) lo = mid + 1;
    else hi = mid;
  }
  return Math.round((lo / sorted.length) * 100);
}
const pos = (x: number | null | undefined): x is number => x != null && x > 0;

type Cache = {
  maxL: number;
  scm: number[]; boost: number[]; vmax: number[];
  h2: number[]; qt: number[];
  pitch: number[]; yaw: number[]; roll: number[];
  hull: number[]; shield: number[];
  pdps: number[]; tdps: number[];
};
let cache: Cache | null = null;
function ensure(all: { data: VehicleData }[]): Cache {
  if (cache) return cache;
  const col = (get: (d: VehicleData) => number | null | undefined) =>
    all.map((v) => get(v.data)).filter(pos).sort((a, b) => a - b);
  cache = {
    maxL: Math.max(...all.map((v) => v.data.lengthM ?? 0), 1),
    scm: col((d) => d.scmSpeed), boost: col((d) => d.boostForward), vmax: col((d) => d.maxSpeed),
    h2: col((d) => d.h2Fuel), qt: col((d) => d.qtFuel),
    pitch: col((d) => d.pitch), yaw: col((d) => d.yaw), roll: col((d) => d.roll),
    hull: col((d) => d.hullHp), shield: col((d) => d.shieldHp),
    pdps: col((d) => d.pilotDps), tdps: col((d) => d.turretDps),
  };
  return cache;
}

const fmtMin = (m: number, loc: string) =>
  m >= 60 ? `${Math.floor(m / 60)} h ${nfL(Math.round(m % 60), loc)} min` : `${nfL(Math.round(m), loc)} min`;

export function buildVisuals(all: { data: VehicleData }[], d: VehicleData, lang: Locale = DEFAULT_LOCALE): Visuals {
  const c = ensure(all);
  const t = useTranslations(lang);
  const loc = lang === 'en' ? 'en-US' : 'de-DE';
  const nf = (n: number, dec = 0) => nfL(n, loc, dec);
  const g = (label: string, x: number | null | undefined, sorted: number[], fmt: (n: number) => string): Gauge | null =>
    pos(x) ? { label, value: fmt(x), pct: Math.max(3, pctRank(sorted, x)) } : null;
  const gs = (xs: (Gauge | null)[]) => xs.filter((x): x is Gauge => x != null);

  let dims: DimViz | null = null;
  if (pos(d.lengthM) && pos(d.widthM) && pos(d.heightM)) {
    const scale = (x: number) => Math.max(4, Math.round((x / c.maxL) * 100));
    dims = {
      l: d.lengthM, w: d.widthM, h: d.heightM,
      footWidthPct: Math.min(100, Math.max(16, Math.round((d.lengthM / c.maxL) * 100 * 1.6))),
      footAspect: `${d.lengthM} / ${Math.max(d.widthM, d.lengthM * 0.14)}`,
      bars: [
        { label: t('gauge.length'), value: `${nf(d.lengthM, 1)} m`, pct: scale(d.lengthM) },
        { label: t('gauge.width'), value: `${nf(d.widthM, 1)} m`, pct: scale(d.widthM) },
        { label: t('gauge.height'), value: `${nf(d.heightM, 1)} m`, pct: scale(d.heightM) },
      ],
    };
  }

  let cargo: CargoViz | null = null;
  if (pos(d.cargoSCU)) {
    let cubeVal = 1;
    for (const v of [1, 2, 4, 8, 16, 32, 64, 128]) {
      cubeVal = v;
      if (d.cargoSCU / v <= 24) break;
    }
    cargo = {
      scu: d.cargoSCU,
      ore: pos(d.oreSCU) ? d.oreSCU : null,
      cubes: Math.max(1, Math.ceil(d.cargoSCU / cubeVal)),
      cubeVal,
    };
  }

  return {
    dims,
    cargo,
    fuel: gs([
      g(t('gauge.h2'), d.h2Fuel, c.h2, (n) => `${nf(n, 1)} SCU`),
      g(t('gauge.qtank'), d.qtFuel, c.qt, (n) => `${nf(n, 1)} SCU`),
    ]),
    speeds: gs([
      g(t('gauge.scm'), d.scmSpeed, c.scm, (n) => `${nf(n)} m/s`),
      g(t('gauge.boost'), d.boostForward, c.boost, (n) => `${nf(n)} m/s`),
      g(t('gauge.max'), d.maxSpeed, c.vmax, (n) => `${nf(n)} m/s`),
    ]),
    agility: gs([
      g(t('gauge.pitch'), d.pitch, c.pitch, (n) => `${nf(n, 1)} °/s`),
      g(t('gauge.yaw'), d.yaw, c.yaw, (n) => `${nf(n, 1)} °/s`),
      g(t('gauge.roll'), d.roll, c.roll, (n) => `${nf(n, 1)} °/s`),
    ]),
    firepower: gs([
      g(t('gauge.pilotDps'), d.pilotDps, c.pdps, (n) => `${nf(n, 1)} DPS`),
      g(t('gauge.turretDps'), d.turretDps, c.tdps, (n) => `${nf(n, 1)} DPS`),
    ]),
    defense: gs([
      g(t('gauge.hull'), d.hullHp, c.hull, (n) => `${nf(n)} HP`),
      g(t('gauge.shields'), d.shieldHp, c.shield, (n) => `${nf(n)} HP`),
    ]),
    quantum: [
      pos(d.qtSpeedMs) ? { label: t('gauge.qspeed'), value: `${nf(d.qtSpeedMs / 1000)} km/s` } : null,
      pos(d.qtRangeM) ? { label: t('gauge.range'), value: `${nf(d.qtRangeM / 1e9)} Gm` } : null,
      pos(d.qtSpoolS) ? { label: t('gauge.spool'), value: `${nf(d.qtSpoolS)} s` } : null,
      pos(d.qtFuel) ? { label: t('gauge.qfuel'), value: `${nf(d.qtFuel, 1)} SCU` } : null,
    ].filter((x): x is { label: string; value: string } => x != null),
    insurance: [
      pos(d.insClaimMin) ? { label: t('gauge.claim'), value: fmtMin(d.insClaimMin, loc) } : null,
      pos(d.insExpediteMin) ? { label: t('gauge.expressTime'), value: fmtMin(d.insExpediteMin, loc) } : null,
      pos(d.insExpediteCost) ? { label: t('gauge.expressCost'), value: `${nf(d.insExpediteCost)} aUEC`, gold: true } : null,
    ].filter((x): x is { label: string; value: string; gold?: boolean } => x != null),
  };
}
