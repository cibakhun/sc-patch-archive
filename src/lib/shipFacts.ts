// Fact/armament builders for the ship data sheets. Lives in a plain TS
// module: the Astro frontmatter compiler chokes on larger logic blocks
// inlined in the page ("Unexpected export" during export-hoisting) — and a
// module is the better home for it anyway.
import type { CollectionEntry } from 'astro:content';

type VehicleData = CollectionEntry<'vehicles'>['data'];
export type Fact = { label: string; value: string };
export type FactGroup = { title: string; facts: Fact[] };

const num = (x: number | null, unit = ''): string =>
  x != null
    ? `${x.toLocaleString('de-DE', {
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

export function buildFacts(d: VehicleData): Fact[] {
  const facts: Fact[] = [
    { label: 'Hersteller', value: d.manufacturer ?? '—' },
    { label: 'Typ', value: [d.typeDe, ...d.fociDe].filter(Boolean).join(' · ') || '—' },
    { label: 'Größe', value: d.sizeDe ?? '—' },
    { label: 'Besatzung', value: crewFmt(d) },
    { label: 'Fracht', value: d.cargoSCU != null ? `${d.cargoSCU} SCU` : '—' },
  ];
  if (d.oreSCU) facts.push({ label: 'Erz-Kapazität', value: `${d.oreSCU} SCU` });
  facts.push(
    { label: 'Preis (Pledge)', value: d.msrpUSD != null ? `$${d.msrpUSD}` : '—' },
    {
      label: 'Maße L×B×H',
      value: d.lengthM ? `${num(d.lengthM)} × ${num(d.widthM)} × ${num(d.heightM)} m` : '—',
    },
    { label: 'Status', value: d.statusDe ?? '—' }
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
};

const PAYLOAD_DE: Record<string, string> = {
  'WeaponGun.Gun': 'Geschütz',
  'MissileLauncher.MissileRack': 'Raketenwerfer',
  'BombLauncher.BombRack': 'Bombenschacht',
};

export function buildArmament(d: VehicleData): ArmRow[] {
  const rows: ArmRow[] = [];

  if (d.fixedWeapons.length) {
    rows.push({
      label: 'Pilot · fest',
      meta: `${d.fixedWeapons.reduce((n, w) => n + w.count, 0)} Waffen`,
      chips: [],
      items: d.fixedWeapons.map((w) => `${w.count}× ${w.name}`).join(' · '),
      value: d.pilotDps ? `${num(d.pilotDps)} DPS` : undefined,
    });
  }

  for (const t of d.turrets) {
    const items = t.weapons.length
      ? t.weapons.map((w) => `${w.count}× ${w.name}`).join(' · ')
      : t.payloadTypes.map((p) => PAYLOAD_DE[p] ?? p).join(' · ') || undefined;
    rows.push({
      label: t.label,
      meta: `${t.stations} ${t.stations === 1 ? 'Station' : 'Stationen'}`,
      chips: t.sizes.map((s) => ({ label: `S${s.size}`, count: s.count })),
      items,
      value: t.dps ? `${num(t.dps)} DPS` : undefined,
    });
  }

  if (d.missileRacks.length || d.missileCount) {
    // aggregate rack chips by size — separate rack types of the same class
    // stay distinguishable via the item list next to them
    const bySize = new Map<number, number>();
    for (const r of d.missileRacks)
      if (r.size != null) bySize.set(r.size, (bySize.get(r.size) ?? 0) + r.count);
    rows.push({
      label: 'Raketen',
      chips: [...bySize.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([size, count]) => ({ label: `S${size}`, count })),
      items: d.missileRacks.map((r) => `${r.count}× ${r.name}`).join(' · ') || undefined,
      value: d.missileCount ? `${num(d.missileCount)} Stück` : undefined,
    });
  }

  if (d.cmLaunchers) {
    rows.push({ label: 'Gegenmaßnahmen', chips: [], value: `${d.cmLaunchers}× Werfer` });
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

export function buildGroups(d: VehicleData): FactGroup[] {
  const def: Fact[] = [];
  if (d.hullHp) def.push({ label: 'Hülle', value: `${num(d.hullHp)} HP` });
  if (d.shieldHp) def.push({ label: 'Schilde', value: `${num(d.shieldHp)} HP` });
  if (d.components.shields.length)
    def.push({ label: 'Schildgeneratoren', value: compFmt(d.components.shields) });

  const drv: Fact[] = [];
  if (d.scmSpeed)
    drv.push({ label: 'SCM / Max', value: `${num(d.scmSpeed)} / ${num(d.maxSpeed)} m/s` });
  if (d.boostForward) drv.push({ label: 'Boost vorwärts', value: `${num(d.boostForward)} m/s` });
  if (d.pitch)
    drv.push({
      label: 'Pitch / Yaw / Roll',
      value: `${num(d.pitch)} / ${num(d.yaw)} / ${num(d.roll)} °/s`,
    });
  // fuel is SCU-denominated in the game files since the resource-network
  // rework (the API's own frontend computes fuel routes in SCU)
  if (d.h2Fuel) drv.push({ label: 'Wasserstoff-Tank', value: `${num(d.h2Fuel)} SCU` });

  const qt: Fact[] = [];
  if (d.qtSpeedMs) qt.push({ label: 'Quantum-Speed', value: `${num(d.qtSpeedMs / 1e6)} Mm/s` });
  if (d.qtRangeM)
    qt.push({ label: 'Reichweite', value: `${num(Math.round(d.qtRangeM / 1e9))} Gm` });
  if (d.qtSpoolS) qt.push({ label: 'Spool-Zeit', value: `${num(d.qtSpoolS)} s` });
  if (d.components.quantumDrives.length)
    qt.push({ label: 'Antrieb', value: compFmt(d.components.quantumDrives) });
  if (d.qtFuel) qt.push({ label: 'Quantum-Treibstoff', value: `${num(d.qtFuel)} SCU` });

  const core: Fact[] = [];
  if (d.components.powerPlants.length)
    core.push({ label: 'Generatoren', value: compFmt(d.components.powerPlants) });
  if (d.components.coolers.length)
    core.push({ label: 'Kühler', value: compFmt(d.components.coolers) });
  if (d.components.radars.length)
    core.push({ label: 'Radar', value: compFmt(d.components.radars) });

  const ins: Fact[] = [];
  if (d.insClaimMin) ins.push({ label: 'Claim-Zeit', value: `${num(d.insClaimMin)} min` });
  if (d.insExpediteMin) ins.push({ label: 'Expedite', value: `${num(d.insExpediteMin)} min` });
  if (d.insExpediteCost)
    ins.push({ label: 'Expedite-Kosten', value: `${num(d.insExpediteCost)} aUEC` });

  return [
    { title: 'Verteidigung', facts: def },
    { title: 'Flug & Antrieb', facts: drv },
    { title: 'Quantum', facts: qt },
    { title: 'Kernkomponenten', facts: core },
    { title: 'Versicherung', facts: ins },
  ].filter((g) => g.facts.length > 0);
}
