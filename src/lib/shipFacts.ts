// Fact-list builders for the ship data sheets. Lives in a plain TS module:
// the Astro frontmatter compiler chokes on parts of this ("Unexpected export"
// during export-hoisting) when it is inlined in the page — and a module is
// the better home for it anyway.
import type { CollectionEntry } from 'astro:content';

type VehicleData = CollectionEntry<'vehicles'>['data'];
export type Fact = { label: string; value: string };
export type FactGroup = { title: string; facts: Fact[] };

const num = (x: number | null, unit = ''): string =>
  x != null ? `${Number.isInteger(x) ? x.toLocaleString('de-DE') : x.toFixed(1)}${unit}` : '—';

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

export function buildGroups(d: VehicleData): FactGroup[] {
  const weapons: Fact[] = [];
  if (d.pilotDps) weapons.push({ label: 'Pilot-DPS', value: num(d.pilotDps) });
  for (const w of d.fixedWeapons) {
    weapons.push({
      label: `${w.count}× ${w.name}`,
      value: w.dps != null ? `${num(w.dps)} DPS` : '—',
    });
  }
  if (d.turretsManned) weapons.push({ label: 'Bemannte Türme', value: `${d.turretsManned}` });
  if (d.turretsRemote) weapons.push({ label: 'Remote-Türme', value: `${d.turretsRemote}` });
  if (d.pdcCount) weapons.push({ label: 'PDC', value: `${d.pdcCount}` });

  const def: Fact[] = [];
  if (d.hullHp) def.push({ label: 'Hülle', value: `${num(d.hullHp)} HP` });
  if (d.shieldHp) def.push({ label: 'Schilde', value: `${num(d.shieldHp)} HP` });

  const drv: Fact[] = [];
  if (d.scmSpeed)
    drv.push({ label: 'SCM / Max', value: `${num(d.scmSpeed)} / ${num(d.maxSpeed)} m/s` });
  if (d.boostForward) drv.push({ label: 'Boost vorwärts', value: `${num(d.boostForward)} m/s` });
  if (d.pitch)
    drv.push({
      label: 'Pitch / Yaw / Roll',
      value: `${num(d.pitch)} / ${num(d.yaw)} / ${num(d.roll)} °/s`,
    });
  if (d.h2Fuel) drv.push({ label: 'Wasserstoff-Tank', value: `${num(d.h2Fuel)}` });

  const qt: Fact[] = [];
  if (d.qtSpeedMs) qt.push({ label: 'Quantum-Speed', value: `${num(d.qtSpeedMs / 1e6)} Mm/s` });
  if (d.qtRangeM)
    qt.push({ label: 'Reichweite', value: `${num(Math.round(d.qtRangeM / 1e9))} Gm` });
  if (d.qtSpoolS) qt.push({ label: 'Spool-Zeit', value: `${num(d.qtSpoolS)} s` });
  if (d.qtFuel) qt.push({ label: 'Quantum-Treibstoff', value: `${num(d.qtFuel)}` });

  const ins: Fact[] = [];
  if (d.insClaimMin) ins.push({ label: 'Claim-Zeit', value: `${num(d.insClaimMin)} min` });
  if (d.insExpediteMin) ins.push({ label: 'Expedite', value: `${num(d.insExpediteMin)} min` });
  if (d.insExpediteCost)
    ins.push({ label: 'Expedite-Kosten', value: `${num(d.insExpediteCost)} aUEC` });

  return [
    { title: 'Bewaffnung', facts: weapons },
    { title: 'Verteidigung', facts: def },
    { title: 'Flug & Antrieb', facts: drv },
    { title: 'Quantum', facts: qt },
    { title: 'Versicherung', facts: ins },
  ].filter((g) => g.facts.length > 0);
}
