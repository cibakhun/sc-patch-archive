// Spielwerte eines Items in anzeigbare Label/Wert-Paare uebersetzen.
//
// Spiegelt bewusst 1:1 die Logik in assets/item-finder-app.js (specChips /
// statEntries / primaryStat): dasselbe Item muss im Finder-Modal und auf seiner
// Detailseite dieselben Zeilen mit denselben Woertern zeigen. Die Woerter selbst
// kommen aus i18n/itemText.ts — beide Seiten ziehen aus demselben Katalog.
//
// Grundregel wie ueberall auf der Seite: nur ausgeben, was in den Spieldaten
// steht. Kein Wert wird geschaetzt, gerundet-erfunden oder aus anderen
// abgeleitet, und leere Felder bleiben leer statt "0" oder "—" zu behaupten.

import type { Locale } from '../i18n/ui';
import { itemT } from '../i18n/itemText';
import { hasGradeSemantics, num, type DamageMap, type Item, type ItemStats } from './items';

export type Row = [label: string, value: string];

const DMG_ORDER = ['physical', 'energy', 'distortion', 'thermal', 'biochemical', 'stun'] as const;

function dmgLabel(k: (typeof DMG_ORDER)[number], lang: Locale): string {
  const t = itemT(lang);
  switch (k) {
    case 'physical': return t('dmgPhysical');
    case 'energy': return t('dmgEnergy');
    case 'distortion': return t('dmgDistortion');
    case 'thermal': return t('dmgThermal');
    case 'biochemical': return t('dmgBio');
    case 'stun': return t('dmgStun');
  }
}

/** "2.332,8 Physisch · 12,5 Thermisch" */
export function formatDamage(d: DamageMap, lang: Locale): string {
  const parts: string[] = [];
  for (const k of DMG_ORDER) {
    const v = d[k];
    if (v && v > 0) parts.push(`${num(v, lang)} ${dmgLabel(k, lang)}`);
  }
  return parts.join(' · ');
}

/**
 * Widerstaende stehen als Schadens-MULTIPLIKATOR in den Daten (0.8 = 20 %
 * weniger Schaden). Angezeigt wird die Reduktion, weil genau die im Spiel-UI
 * steht — sonst liest man 0,8 als "80 % Schutz".
 */
export function formatResist(r: DamageMap, lang: Locale): string | null {
  const t = itemT(lang);
  const keys = DMG_ORDER.filter((k) => k !== 'stun' && r[k] != null);
  if (!keys.length) return null;
  const pct = (k: (typeof DMG_ORDER)[number]) => `${Math.round((1 - (r[k] as number)) * 100)}%`;
  const uniform = keys.every((k) => r[k] === r[keys[0]]);
  if (uniform) return `${t('resistAll')} ${pct(keys[0])}`;
  return keys.map((k) => `${dmgLabel(k, lang)} ${pct(k)}`).join(' · ');
}

/** Kopf-Chips: Hersteller / Groesse / Grade / Klasse / Volumen. */
export function specChips(i: Item, lang: Locale): Row[] {
  const g = i.game;
  if (!g) return [];
  const t = itemT(lang);
  const eq = hasGradeSemantics(i);
  const out: Row[] = [];
  if (g.manufacturer) out.push([t('specMfr'), g.manufacturer]);
  if (eq && g.size != null) out.push([t('specSize'), `S${g.size}`]);
  if (eq && g.grade) out.push([t('specGrade'), g.grade]);
  if (g.class) out.push([t('specClass'), g.class]);
  if (g.volumeScu) out.push([t('specVolume'), `${g.volumeScu} SCU`]);
  return out;
}

/** Alle darstellbaren Werte des Items, in der Reihenfolge des Finder-Modals. */
export function statEntries(i: Item, lang: Locale): Row[] {
  const s: ItemStats | undefined = i.game?.stats;
  if (!s) return [];
  const t = itemT(lang);
  const n = (v: number) => num(v, lang);
  const out: Row[] = [];

  if (s.damage) {
    const d = formatDamage(s.damage, lang);
    if (d) out.push([t('statDamage'), d]);
  }
  if (s.blastRadius) out.push([t('statBlast'), `${n(s.blastRadius)} m`]);
  if (s.fireRate) out.push([t('statFireRate'), `${n(s.fireRate)} ${t('unitRpm')}`]);
  if (s.dps) out.push([t('statDps'), n(s.dps)]);
  if (s.magazine) out.push([t('statMagazine'), n(s.magazine)]);
  if (s.shieldHp) out.push([t('statShieldHp'), n(s.shieldHp)]);
  if (s.regen) out.push([t('statRegen'), `${n(s.regen)}/s`]);
  if (s.driveSpeed) out.push([t('statQtSpeed'), `${n(Math.round(s.driveSpeed / 1e6))} Mm/s`]);
  if (s.cooldown) out.push([t('statCooldown'), `${n(s.cooldown)} s`]);
  if (s.coolingRate) out.push([t('statCooling'), n(s.coolingRate)]);
  if (s.powerOutput) out.push([t('statPower'), n(s.powerOutput)]);
  if (s.fuelCapacity) out.push([t('statFuel'), n(s.fuelCapacity)]);
  if (s.sensitivity) out.push([t('statSensitivity'), n(s.sensitivity)]);
  if (s.jammerRange) out.push([t('statJammer'), `${n(s.jammerRange)} m`]);
  if (s.empRadius) out.push([t('statEmpRadius'), `${n(s.empRadius)} m`]);
  if (s.distortionDamage) out.push([t('statDistortion'), n(s.distortionDamage)]);
  if (s.chargeTime) out.push([t('statCharge'), `${n(s.chargeTime)} s`]);
  if (s.resist) {
    const r = formatResist(s.resist, lang);
    if (r) out.push([t('statResist'), r]);
  }
  if (s.tempMin != null && s.tempMax != null)
    out.push([t('statTemp'), `${s.tempMin} / ${s.tempMax} °C`]);
  if (s.radiation) out.push([t('statRadiation'), `${n(s.radiation)} REM`]);
  // oxygen steht nur in Helm-/Anzug-Daten und beantwortet dort die haeufigste
  // Frage ("wie lange haelt der Helm?"). Das Finder-Modal zeigt es (noch) nicht.
  if (s.oxygen) out.push([t('statOxygen'), `${n(s.oxygen)} s`]);
  if (s.ndr) out.push([t('statNdr'), n(s.ndr)]);
  if (s.effects && s.effects.length) out.push([t('statEffects'), s.effects.join(', ')]);
  if (s.storageScu) out.push([t('statStorage'), `${s.storageScu} SCU`]);
  if (s.lifetime) out.push([t('statLifetime'), `${n(s.lifetime)} s`]);
  if (s.health) out.push([t('statHealth'), n(s.health)]);
  return out;
}

/** Schluessel-Wert fuer Karten-Badge und Meta-Description. */
export function primaryStat(i: Item, lang: Locale): Row | null {
  const s = i.game?.stats;
  if (!s) return null;
  const t = itemT(lang);
  const n = (v: number) => num(v, lang);
  if (s.dps) return [t('statDps'), `${n(s.dps)} DPS`];
  if (s.shieldHp) return [t('statShieldHp'), `${n(s.shieldHp)} HP`];
  if (s.driveSpeed) return [t('statQtSpeed'), `${n(Math.round(s.driveSpeed / 1e6))} Mm/s`];
  if (s.coolingRate) return [t('statCooling'), n(s.coolingRate)];
  if (s.powerOutput) return [t('statPower'), n(s.powerOutput)];
  if (s.jammerRange) return [t('statJammer'), `${n(s.jammerRange)} m`];
  if (s.empRadius) return [t('statEmpRadius'), `${n(s.empRadius)} m`];
  if (s.fuelCapacity) return [t('statFuel'), n(s.fuelCapacity)];
  if (s.damage) {
    let tot = 0;
    for (const k of DMG_ORDER) tot += s.damage[k] ?? 0;
    if (tot > 0) return [t('statDamage'), n(Math.round(tot * 10) / 10)];
  }
  if (s.resist?.physical != null)
    return [t('statResist'), `${Math.round((1 - s.resist.physical) * 100)}%`];
  if (s.ndr) return [t('statNdr'), `${n(s.ndr)} NDR`];
  if (s.sensitivity) return [t('statSensitivity'), n(s.sensitivity)];
  if (s.storageScu) return [t('statStorage'), `${s.storageScu} SCU`];
  if (s.health) return [t('statHealth'), `${n(s.health)} HP`];
  return null;
}
