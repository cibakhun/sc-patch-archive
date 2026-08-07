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
import { hasGradeSemantics, hasMeaningfulGrade, num, type DamageMap, type Item, type ItemStats } from './items';

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

/**
 * Groessen eines Items. Meist genau eine — hinter manchen Anzeigenamen stecken
 * aber mehrere Spiel-Items unterschiedlicher Groesse ("Revenant Gatling" gibt es
 * als S3, S4 und S6). Die tragen `sizes`; sich eine davon auszusuchen waere
 * geraten.
 */
export function itemSizes(i: Item): number[] {
  const g = i.game;
  if (!g) return [];
  if (g.sizes?.length) return g.sizes;
  return g.size != null ? [g.size] : [];
}

/** "S4" bzw. "S3 / S4 / S6" — oder null, wenn keine Groesse bekannt ist. */
export function sizeLabel(i: Item): string | null {
  const s = itemSizes(i);
  return s.length ? s.map((n) => `S${n}`).join(' / ') : null;
}

/** Kopf-Chips: Hersteller / Groesse / Grade / Klasse / Volumen. */
export function specChips(i: Item, lang: Locale): Row[] {
  const g = i.game;
  if (!g) return [];
  const t = itemT(lang);
  const eq = hasGradeSemantics(i);
  const size = sizeLabel(i);
  const out: Row[] = [];
  if (g.manufacturer) out.push([t('specMfr'), g.manufacturer]);
  if (eq && size) out.push([t('specSize'), size]);
  // Grade gilt je Ausfuehrung — bei mehreren steht er in der Variantenliste.
  // Und nur dort, wo er im Spiel etwas unterscheidet: bei Waffen, Ruestung,
  // Munition und Werkzeugen traegt AttachDef.Grade den Vorgabewert 1 -> "A".
  if (g.grade && !g.variants && hasMeaningfulGrade(i)) out.push([t('specGrade'), g.grade]);
  if (g.class) out.push([t('specClass'), g.class]);
  if (g.volumeScu) out.push([t('specVolume'), `${g.volumeScu} SCU`]);
  return out;
}

/**
 * Kopfzeile einer Ausfuehrung: "S4 · Apocalypse Arms · Grade A".
 *
 * Das Item wird mitgegeben, weil der Grade nur bei den Bauteilarten etwas
 * aussagt, bei denen er im Spiel streut (siehe `hasMeaningfulGrade`). Bei
 * Waffen — und das sind fast alle Items mit mehreren Ausfuehrungen — steht dort
 * ausnahmslos "A"; als Unterscheidungsmerkmal zwischen den Ausfuehrungen taugt
 * er dann gerade nicht.
 */
export function variantHead(i: Item, v: { size: number; manufacturer: string | null; grade: string | null }, lang: Locale): string {
  const t = itemT(lang);
  const grade = v.grade && hasMeaningfulGrade(i) ? v.grade : null;
  return [`S${v.size}`, v.manufacturer, grade ? `${t('specGrade')} ${grade}` : null]
    .filter(Boolean)
    .join(' · ');
}

/** Alle darstellbaren Werte des Items, in der Reihenfolge des Finder-Modals. */
export function statEntries(i: Item, lang: Locale): Row[] {
  return statRows(i.game?.stats, lang);
}

/** Wie statEntries, aber direkt auf einem Wertesatz — fuer die Varianten. */
export function statRows(s: ItemStats | null | undefined, lang: Locale): Row[] {
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
