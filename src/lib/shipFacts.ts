// Fact/armament builders for the ship data sheets. Lives in a plain TS
// module: the Astro frontmatter compiler chokes on larger logic blocks
// inlined in the page ("Unexpected export" during export-hoisting) — and a
// module is the better home for it anyway.
// Stufe 2: locale-aware — Labels über t(), Freitext über vehicleText-Resolver,
// Zahlenformat pro Locale. `key` erlaubt sprachunabhängiges Filtern.
import type { CollectionEntry } from 'astro:content';
import { useTranslations, type Locale, DEFAULT_LOCALE } from '../i18n/ui';
import { vType, vSize, vStatus, vFoci, vTurret } from '../i18n/vehicleText';
import { resolveGuns } from './weaponSizes';

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
/* Bewaffnung — das Waffen-Hardpoint-Panel.                                  */
/*                                                                           */
/* Grundsatz: EINE Zeile je Waffenart, überall dieselbe Grammatik            */
/*   [S5] ×4  CF-557 Galdereen Repeater                                      */
/* also Größe + Stückzahl + Name zusammen statt einer Reihe nackter Zahlen,  */
/* die man abzählen und selbst dem Namen darunter zuordnen muss.             */
/*                                                                           */
/* Die Größe je Waffe liefert weaponSizes.ts (Rückrechnung aus dem           */
/* Snapshot). Wo das nicht eindeutig geht, fällt die Zeile ehrlich auf die   */
/* aggregierten Größen ohne Namen zurück — geraten wird nichts.              */
/* ------------------------------------------------------------------------ */
export type ArmLine = {
  /** Größe der montierten Waffe / des Werfers (null = unbekannt) */
  size: number | null;
  /** max. Größe des Hardpoints, wenn eindeutig zuordenbar (Pilotwaffen) */
  mount: number | null;
  count: number;
  /** null in der Fallback-Darstellung (Größe bekannt, Zuordnung nicht) */
  name: string | null;
};
export type ArmRow = {
  key: 'pilot' | 'turret' | 'missile' | 'cm';
  label: string;
  meta?: string;
  lines: ArmLine[];
  /** Namensliste, wenn sie den Zeilen nicht zuzuordnen war */
  note?: string;
  value?: string;
  /** stable flag: Raketenreihe (steuert die goldene Einfärbung) */
  gold?: boolean;
};
/** Kopfzeile des Panels: die Antwort auf "was hat das Schiff überhaupt?" */
export type ArmStat = { n: number; label: string; range?: string; gold?: boolean };

/** expand an aggregated [{size,count}] list into a flat per-item size array */
const expandSizes = (list: { size: number; count: number }[] | undefined): number[] => {
  const out: number[] = [];
  for (const { size, count } of list ?? []) for (let i = 0; i < count; i++) out.push(size);
  return out;
};

const countOf = (l: readonly { count: number }[] | undefined) =>
  (l ?? []).reduce((n, x) => n + x.count, 0);

/** "S3" bzw. "S3 – S5" */
const sizeRange = (sizes: readonly number[]): string | undefined => {
  if (!sizes.length) return undefined;
  const lo = Math.min(...sizes), hi = Math.max(...sizes);
  return lo === hi ? `S${lo}` : `S${lo} – S${hi}`;
};

/** aggregierte Größen -> namenlose Zeilen (Fallback, wenn Name↔Größe unklar) */
const sizeLines = (agg: { size: number; count: number }[] | undefined): ArmLine[] =>
  [...(agg ?? [])]
    .sort((a, b) => b.size - a.size)
    .map((s) => ({ size: s.size, mount: null, count: s.count, name: null }));

/**
 * Zeilen einer Waffengruppe: nach Größe absteigend, mit Namen — oder, wenn die
 * Zuordnung Name↔Größe nicht sauber aufgeht, die aggregierten Größen ohne
 * Namen (`exact: false`); die Namen wandern dann in die Bestückungs-Zeile.
 */
const gunLines = (
  weapons: readonly { name: string; count: number }[] | undefined,
  agg: { size: number; count: number }[] | undefined
): { lines: ArmLine[]; exact: boolean } => {
  const { lines, exact } = resolveGuns(weapons, agg);
  return {
    exact,
    lines: exact
      ? lines
          .map((g) => ({ size: g.size, mount: null, count: g.count, name: g.name }))
          .sort((a, b) => (b.size ?? 0) - (a.size ?? 0))
      : sizeLines(agg),
  };
};

/**
 * Hardpoint-Maximalgrößen den Waffenzeilen zuordnen: größte Waffe in den
 * größten Hardpoint. Nur wenn die Stückzahlen passen und jede Waffe auch in
 * ihren Hardpoint passt — sonst zählt die Hardpoint-Liste etwas anderes
 * (z. B. Pilot-Turm-Waffen) und `mount` bleibt null statt zu lügen.
 * Bekommen die Waffen einer Zeile unterschiedliche Hardpoints, bleibt sie
 * ebenfalls leer: eine Zeile kann nur eine eindeutige Aussage tragen.
 */
function assignMounts(lines: ArmLine[], mounts: { size: number; count: number }[] | undefined): void {
  const hp = expandSizes(mounts).sort((a, b) => b - a);
  const guns = lines.flatMap((l, i) =>
    Array.from({ length: l.count }, () => ({ i, s: l.size ?? -1 }))
  );
  if (!hp.length || hp.length !== guns.length || guns.some((g) => g.s < 0)) return;
  guns.sort((a, b) => b.s - a.s);
  if (!guns.every((g, k) => g.s <= hp[k])) return; // nicht plausibel -> nichts zeigen
  const per = new Map<number, Set<number>>();
  guns.forEach((g, k) => {
    const set = per.get(g.i) ?? new Set<number>();
    set.add(hp[k]);
    per.set(g.i, set);
  });
  for (const [i, set] of per) if (set.size === 1) lines[i].mount = [...set][0];
}

const payloadMap = (t: ReturnType<typeof useTranslations>): Record<string, string> => ({
  'WeaponGun.Gun': t('payload.gun'),
  'MissileLauncher.MissileRack': t('payload.missile'),
  'BombLauncher.BombRack': t('payload.bomb'),
});

const namesNote = (l: readonly { name: string; count: number }[]): string =>
  l.map((w) => `${w.count}× ${w.name}`).join(' · ');

export function buildArmament(d: VehicleData, lang: Locale = DEFAULT_LOCALE): ArmRow[] {
  const t = useTranslations(lang);
  const loc = numLoc(lang);
  const PAYLOAD = payloadMap(t);
  const rows: ArmRow[] = [];

  if (d.fixedWeapons.length) {
    // Name -> Größe zurückrechnen; nur bei sauberer Gegenprobe je Waffe zeigen
    const { lines, exact } = gunLines(d.fixedWeapons, d.fixedWeaponSizes);
    assignMounts(lines, d.fixedWeaponMounts);
    rows.push({
      key: 'pilot',
      label: t('arm.pilotFixed'),
      meta: `${countOf(d.fixedWeapons)} ${t('arm.weapons')}`,
      lines,
      note: exact ? undefined : namesNote(d.fixedWeapons),
      value: d.pilotDps ? `${num(d.pilotDps, loc)} DPS` : undefined,
    });
  }

  for (const tr of d.turrets) {
    const { lines, exact } = gunLines(tr.weapons, tr.sizes);
    // Waffen pro Station — nur wenn es aufgeht, sonst ist die Turmliste
    // unvollständig und die Rechnung wäre erfunden
    const guns = countOf(tr.sizes);
    const perStation =
      guns && tr.stations && guns % tr.stations === 0 && guns !== tr.stations
        ? `${guns / tr.stations} ${t('arm.perStation')}`
        : undefined;
    const stations = `${tr.stations} ${tr.stations === 1 ? t('arm.station') : t('arm.stations')}`;
    rows.push({
      key: 'turret',
      label: vTurret(tr.label, lang),
      meta: [stations, perStation].filter(Boolean).join(' · '),
      lines,
      note: exact
        ? undefined
        : tr.weapons.length
          ? namesNote(tr.weapons)
          : tr.payloadTypes.map((p) => PAYLOAD[p] ?? p).join(' · ') || undefined,
      value: tr.dps ? `${num(tr.dps, loc)} DPS` : undefined,
    });
  }

  if (d.missileRacks.length || d.missileCount) {
    // Werfer tragen ihre Größe direkt im Snapshot -> Zeilen ohne Rückrechnung
    const lines: ArmLine[] = d.missileRacks
      .map((r) => ({ size: r.size, mount: null, count: r.count, name: r.name }))
      .sort((a, b) => (b.size ?? 0) - (a.size ?? 0));
    rows.push({
      key: 'missile',
      label: t('arm.missiles'),
      gold: true,
      meta: lines.length ? `${countOf(d.missileRacks)} ${t('arm.racks')}` : undefined,
      lines,
      value: d.missileCount ? `${num(d.missileCount, loc)} ${t('arm.count')}` : undefined,
    });
  }

  if (d.cmLaunchers) {
    rows.push({
      key: 'cm',
      label: t('arm.countermeasures'),
      lines: [],
      value: `${d.cmLaunchers}× ${t('arm.launchers')}`,
    });
  }

  return rows;
}

/**
 * Kopfzahlen des Panels — beantwortet "welche Waffen-Hardpoints hat das
 * Schiff?" ohne dass man Kästchen zählen muss.
 */
export function buildArmStats(d: VehicleData, lang: Locale = DEFAULT_LOCALE): ArmStat[] {
  const t = useTranslations(lang);
  const stats: ArmStat[] = [];
  // Gezählt werden die Aufhängungen selbst (Pilot + Turm), nicht die Waffen:
  // bei einzelnen Türmen listen die Quelldaten weniger Waffen als Mounts.
  const gunSizes = [
    ...expandSizes(d.fixedWeaponSizes),
    ...d.turrets.flatMap((tr) => expandSizes(tr.sizes)),
  ];
  if (gunSizes.length)
    stats.push({ n: gunSizes.length, label: t('arm.stat.guns'), range: sizeRange(gunSizes) });
  const rackCount = countOf(d.missileRacks);
  if (rackCount)
    stats.push({
      n: rackCount,
      label: t('arm.stat.racks'),
      range: sizeRange(expandSizes(d.missileRacks.filter((r) => r.size != null) as { size: number; count: number }[])),
      gold: true,
    });
  if (d.turrets.length)
    stats.push({ n: d.turrets.reduce((n, tr) => n + tr.stations, 0), label: t('arm.stat.stations') });
  if (d.cmLaunchers) stats.push({ n: d.cmLaunchers, label: t('arm.stat.cm') });
  return stats;
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
