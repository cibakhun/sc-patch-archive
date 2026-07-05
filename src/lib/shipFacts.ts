// Fact/armament builders for the ship data sheets. Lives in a plain TS
// module: the Astro frontmatter compiler chokes on larger logic blocks
// inlined in the page ("Unexpected export" during export-hoisting) — and a
// module is the better home for it anyway.
// Stufe 2: locale-aware — Labels über t(), Freitext über vehicleText-Resolver,
// Zahlenformat pro Locale. `key` erlaubt sprachunabhängiges Filtern.
import type { CollectionEntry } from 'astro:content';
import { useTranslations, type Locale, DEFAULT_LOCALE } from '../i18n/ui';
import { vType, vSize, vStatus, vFoci } from '../i18n/vehicleText';

type VehicleData = CollectionEntry<'vehicles'>['data'];
export type Fact = { label: string; value: string; key?: string };
export type FactGroup = { title: string; facts: Fact[] };

const numLoc = (lang: Locale) => (lang === 'en' ? 'en-US' : 'de-DE');

const num = (x: number | null, loc: string, unit = ''): string =>
  x != null
    ? `${x.toLocaleString(loc, {
        minimumFractionDigits: 0,
        maximumFractionDigits: Number.isInteger(x) ? 0 : 1,
      })}${unit}`
    : '—';

export function crewFmt(d: VehicleData): string {
  if (d.crewMin == null && d.crewMax == null) return '—';
  if (d.crewMin != null && d.crewMax != null && d.crewMax !== d.crewMin)
    return `${d.crewMin}–${d.crewMax}`;
  return `${d.crewMin ?? d.crewMax}`;
}

export function buildFacts(d: VehicleData, lang: Locale = DEFAULT_LOCALE): Fact[] {
  const t = useTranslations(lang);
  const loc = numLoc(lang);
  const facts: Fact[] = [
    { key: 'manufacturer', label: t('data.manufacturer'), value: d.manufacturer ?? '—' },
    { key: 'type', label: t('data.type'), value: [vType(d, lang), ...vFoci(d, lang)].filter(Boolean).join(' · ') || '—' },
    { key: 'size', label: t('data.size'), value: vSize(d, lang) ?? '—' },
    { key: 'crew', label: t('data.crew'), value: crewFmt(d) },
    { key: 'cargo', label: t('data.cargo'), value: d.cargoSCU != null ? `${d.cargoSCU} SCU` : '—' },
  ];
  if (d.oreSCU) facts.push({ key: 'ore', label: t('data.ore'), value: `${d.oreSCU} SCU` });
  facts.push(
    { key: 'pledge', label: t('data.pledge'), value: d.msrpUSD != null ? `$${d.msrpUSD}` : '—' },
    {
      key: 'dims',
      label: t('data.dims'),
      value: d.lengthM ? `${num(d.lengthM, loc)} × ${num(d.widthM, loc)} × ${num(d.heightM, loc)} m` : '—',
    },
    { key: 'status', label: t('data.status'), value: vStatus(d, lang) ?? '—' }
  );
  return facts;
}

/* ------------------------------------------------------------------------ */
/* Bewaffnung — the weapon-hardpoint panel. Size-class chips per category    */
/* plus the equipped loadout. Sizes come from turret mounts and racks; the   */
/* game files' list view carries no per-mount size for pilot-fixed guns, so  */
/* those stay name/DPS-only instead of getting a fabricated S-class.         */
/* ------------------------------------------------------------------------ */
export type ArmChip = { label: string; count: number };
export type ArmRow = {
  label: string;
  meta?: string;
  chips: ArmChip[];
  items?: string;
  value?: string;
  /** stable flag: this row is the missiles row (drives the gold styling) */
  gold?: boolean;
};

const payloadMap = (t: ReturnType<typeof useTranslations>): Record<string, string> => ({
  'WeaponGun.Gun': t('payload.gun'),
  'MissileLauncher.MissileRack': t('payload.missile'),
  'BombLauncher.BombRack': t('payload.bomb'),
});

export function buildArmament(d: VehicleData, lang: Locale = DEFAULT_LOCALE): ArmRow[] {
  const t = useTranslations(lang);
  const loc = numLoc(lang);
  const PAYLOAD = payloadMap(t);
  const rows: ArmRow[] = [];

  if (d.fixedWeapons.length) {
    rows.push({
      label: t('arm.pilotFixed'),
      meta: `${d.fixedWeapons.reduce((n, w) => n + w.count, 0)} ${t('arm.weapons')}`,
      // hardpoint size classes from the detail endpoint (enrich-weapon-sizes)
      chips: (d.fixedWeaponMounts ?? []).map((m) => ({ label: `S${m.size}`, count: m.count })),
      items: d.fixedWeapons.map((w) => `${w.count}× ${w.name}`).join(' · '),
      value: d.pilotDps ? `${num(d.pilotDps, loc)} DPS` : undefined,
    });
  }

  for (const tr of d.turrets) {
    const items = tr.weapons.length
      ? tr.weapons.map((w) => `${w.count}× ${w.name}`).join(' · ')
      : tr.payloadTypes.map((p) => PAYLOAD[p] ?? p).join(' · ') || undefined;
    rows.push({
      label: tr.label,
      meta: `${tr.stations} ${tr.stations === 1 ? t('arm.station') : t('arm.stations')}`,
      chips: tr.sizes.map((s) => ({ label: `S${s.size}`, count: s.count })),
      items,
      value: tr.dps ? `${num(tr.dps, loc)} DPS` : undefined,
    });
  }

  if (d.missileRacks.length || d.missileCount) {
    // aggregate rack chips by size — separate rack types of the same class
    // stay distinguishable via the item list next to them
    const bySize = new Map<number, number>();
    for (const r of d.missileRacks)
      if (r.size != null) bySize.set(r.size, (bySize.get(r.size) ?? 0) + r.count);
    rows.push({
      label: t('arm.missiles'),
      gold: true,
      chips: [...bySize.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([size, count]) => ({ label: `S${size}`, count })),
      items: d.missileRacks.map((r) => `${r.count}× ${r.name}`).join(' · ') || undefined,
      value: d.missileCount ? `${num(d.missileCount, loc)} ${t('arm.count')}` : undefined,
    });
  }

  if (d.cmLaunchers) {
    rows.push({ label: t('arm.countermeasures'), chips: [], value: `${d.cmLaunchers}× ${t('arm.launchers')}` });
  }

  return rows;
}

/** "2× Stellate (S4)" — equipped component list for a fact value */
const compFmt = (list: { name: string; size: number | null; count: number }[]): string =>
  list
    .map(
      (c) =>
        `${c.count > 1 ? `${c.count}× ` : ''}${c.name}${c.size != null ? ` (S${c.size})` : ''}`
    )
    .join(' · ');

export function buildGroups(d: VehicleData, lang: Locale = DEFAULT_LOCALE): FactGroup[] {
  const t = useTranslations(lang);
  const loc = numLoc(lang);
  const n = (x: number | null, unit = '') => num(x, loc, unit);
  const def: Fact[] = [];
  if (d.hullHp) def.push({ label: t('gauge.hull'), value: `${n(d.hullHp)} HP` });
  if (d.shieldHp) def.push({ label: t('gauge.shields'), value: `${n(d.shieldHp)} HP` });
  if (d.components.shields.length)
    def.push({ label: t('ship.slot.shields'), value: compFmt(d.components.shields) });

  const drv: Fact[] = [];
  if (d.scmSpeed)
    drv.push({ label: 'SCM / Max', value: `${n(d.scmSpeed)} / ${n(d.maxSpeed)} m/s` });
  if (d.boostForward) drv.push({ label: t('gauge.boost'), value: `${n(d.boostForward)} m/s` });
  if (d.pitch)
    drv.push({
      label: 'Pitch / Yaw / Roll',
      value: `${n(d.pitch)} / ${n(d.yaw)} / ${n(d.roll)} °/s`,
    });
  if (d.h2Fuel) drv.push({ label: t('gauge.h2'), value: `${n(d.h2Fuel)} SCU` });

  const qt: Fact[] = [];
  if (d.qtSpeedMs) qt.push({ label: t('gauge.qspeed'), value: `${n(d.qtSpeedMs / 1e6)} Mm/s` });
  if (d.qtRangeM)
    qt.push({ label: t('gauge.range'), value: `${n(Math.round(d.qtRangeM / 1e9))} Gm` });
  if (d.qtSpoolS) qt.push({ label: t('gauge.spool'), value: `${n(d.qtSpoolS)} s` });
  if (d.components.quantumDrives.length)
    qt.push({ label: t('ship.slot.quantum'), value: compFmt(d.components.quantumDrives) });
  if (d.qtFuel) qt.push({ label: t('gauge.qfuel'), value: `${n(d.qtFuel)} SCU` });

  const core: Fact[] = [];
  if (d.components.powerPlants.length)
    core.push({ label: t('ship.slot.generators'), value: compFmt(d.components.powerPlants) });
  if (d.components.coolers.length)
    core.push({ label: t('ship.slot.coolers'), value: compFmt(d.components.coolers) });
  if (d.components.radars.length)
    core.push({ label: t('ship.slot.radar'), value: compFmt(d.components.radars) });

  const ins: Fact[] = [];
  if (d.insClaimMin) ins.push({ label: t('gauge.claim'), value: `${n(d.insClaimMin)} min` });
  if (d.insExpediteMin) ins.push({ label: t('gauge.expressTime'), value: `${n(d.insExpediteMin)} min` });
  if (d.insExpediteCost)
    ins.push({ label: t('gauge.expressCost'), value: `${n(d.insExpediteCost)} aUEC` });

  return [
    { title: t('metric.defense'), facts: def },
    { title: t('ship.flight.title'), facts: drv },
    { title: 'Quantum', facts: qt },
    { title: t('ship.comp.title'), facts: core },
    { title: t('ship.ins.title'), facts: ins },
  ].filter((g) => g.facts.length > 0);
}
