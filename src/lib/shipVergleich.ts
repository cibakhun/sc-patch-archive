// shipVergleich.ts — die Daten des Schiffsvergleichs auf der Schiffsliste
// (UX-Audit 24.11.2026, Paket E, Punkt E7; Befund TF B08/V19: live gab es
// keinen Vergleich, nur im Hangar der Vorschau).
//
// Entscheidung E1 (Krisz 24.11.2026): je Aufgabe EINE Quelle fuer Daten und
// Logik, der Hangar ist eine Oberflaeche darauf. Deshalb entsteht hier keine
// zweite Liste der Kennwerte:
//   - Abschnitte und ihre Folge aus COMPARE (src/lib/hangar/bay.ts),
//   - jede Zahlenzeile mit Einheit, Genauigkeit und Richtung von "besser"
//     aus STATS (src/lib/hangar/catalog.ts), gerundet mit statValue,
//   - die Beschriftungen aus hangarText.
// Kommt im Hangar ein Kennwert oder Abschnitt dazu, zeigt ihn der Vergleich
// der Schiffsliste beim naechsten Bau mit. Bewaffnung und Systeme kommen aus
// denselben Bausteinen wie das Schiffsdatenblatt (buildArmament und die
// Komponentenlisten), damit der Vergleich zeigt, was das Blatt zeigt —
// Mining-Laser also in eigener Zeile, wie dort (E5).
//
// Nur Bauzeit: die Seite holt das Ergebnis als /schiffe-vergleich.json bzw.
// /de/schiffe-vergleich.json, sobald jemand vergleicht.
import type { CollectionEntry } from 'astro:content';
import { useTranslations, type Locale } from '../i18n/ui';
import { hangarT } from '../i18n/hangarText';
import { vRoleCig, vSize, vSizeClass, sizeClassLabel } from '../i18n/vehicleText';
import { COMPARE, type GroupKey } from './hangar/bay';
import { STAT, statValue, type StatKey } from './hangar/catalog';
import { buildArmament, type ArmRow } from './shipFacts';

type VehicleData = CollectionEntry<'vehicles'>['data'];

/** Eine Zeile der Tabelle: Wort (Fokus, Groesse), Zahl (aus STATS) oder Teileliste. */
export type Zeile =
  | { art: 'text'; key: 'role' | 'size'; label: string }
  | { art: 'zahl'; key: StatKey; label: string; unit: string; digits: 0 | 1; better: 1 | -1 | 0 }
  | { art: 'teile'; key: TeilGruppe; label: string };
export type Abschnitt = { key: string; label: string; zeilen: Zeile[] };

/** [Anzahl, Groesse ("S3" oder ""), Name] — wie eine Zeile im Datenblatt. */
export type Teil = [number, string, string];
export type Schiff = {
  name: string;
  maker: string;
  href: string;
  text: Partial<Record<'role' | 'size', string>>;
  zahl: Partial<Record<StatKey, number>>;
  teile: Partial<Record<TeilGruppe, Teil[]>>;
};
export type Vergleich = { abschnitte: Abschnitt[]; schiffe: Record<string, Schiff> };

/*
 * Gruppen der Bewaffnung und Systeme. Die Schluessel sind die des Hangars
 * (COMPARE.groups), dazu 'mining' gleich hinter den Pilotenwaffen: das
 * Datenblatt fuehrt Mining-Laser seit E5 getrennt.
 */
export type TeilGruppe = GroupKey | 'mining';

/** Turmzeilen des Datenblatts tragen den deutschen Turmtyp der Daten als Bezeichnung. */
const TURM: Readonly<Record<string, TeilGruppe>> = {
  'Bemannte Türme': 'manned',
  'Ferngesteuerte Türme': 'remote',
  'Punktverteidigung (PDC)': 'pdc',
};
const KOMPONENTEN: Readonly<Partial<Record<TeilGruppe, keyof VehicleData['components']>>> = {
  power: 'powerPlants',
  cooler: 'coolers',
  shield: 'shields',
  quantum: 'quantumDrives',
  radar: 'radars',
};

const groesse = (s: number | null | undefined): string => (s != null ? `S${s}` : '');

function teileAusZeile(r: ArmRow): Teil[] {
  const out: Teil[] = r.lines.map((l) => [l.count, groesse(l.size), l.name ?? '']);
  // Ohne saubere Zuordnung (Namen und Groessen gehen nicht auf) zeigt das
  // Datenblatt die Groessenzeilen ohne Namen und darunter die Namen als
  // Notiz; der Vergleich ebenso, die Notiz als eigene Zeile.
  if (r.note) out.push([0, '', r.note]);
  return out;
}

/** Bewaffnung und Systeme eines Schiffs, je Gruppe. */
export function teileVon(d: VehicleData, lang: Locale): Partial<Record<TeilGruppe, Teil[]>> {
  const out: Partial<Record<TeilGruppe, Teil[]>> = {};
  const add = (g: TeilGruppe, list: Teil[]) => {
    if (list.length) out[g] = [...(out[g] ?? []), ...list];
  };
  // Turmzeilen dem Turmtyp nach trennen wie im Hangar. Die Zuordnung braucht
  // den Typ der Daten; den traegt die deutsche Fassung als Bezeichnung, die
  // englische nur uebersetzt.
  const rows = buildArmament(d, lang);
  const deTuerme = (lang === 'de' ? rows : buildArmament(d, 'de')).filter((r) => r.key === 'turret');
  let ti = 0;
  for (const r of rows) {
    if (r.key !== 'turret') add(r.key, teileAusZeile(r));
    else {
      const g = TURM[deTuerme[ti++]?.label ?? ''];
      if (g) add(g, teileAusZeile(r));
    }
  }
  for (const [g, k] of Object.entries(KOMPONENTEN) as [TeilGruppe, keyof VehicleData['components']][]) {
    const list = (d.components?.[k] ?? []) as { name: string; size: number | null; count: number }[];
    add(g, list.map((c) => [c.count, groesse(c.size), c.name]));
  }
  return out;
}

/** Die Abschnitte in der Folge des Hangar-Vergleichs, beschriftet. */
export function abschnitte(lang: Locale): Abschnitt[] {
  const h = hangarT(lang);
  const t = useTranslations(lang);
  return COMPARE.map((sec) => {
    const zeilen: Zeile[] = [
      ...sec.text.map((k): Zeile => ({ art: 'text', key: k, label: h(k === 'role' ? 'cmp.role' : 'ov.size') })),
      ...sec.stats.map((k): Zeile => {
        const s = STAT[k];
        return { art: 'zahl', key: k, label: h(`stat.${k}`), unit: s.unit, digits: s.digits, better: s.better };
      }),
    ];
    for (const g of sec.groups) {
      zeilen.push({ art: 'teile', key: g, label: h(`grp.${g}`) });
      if (g === 'pilot') zeilen.push({ art: 'teile', key: 'mining', label: t('arm.mining') });
    }
    return { key: sec.key, label: h(`cmp.sec.${sec.key}`), zeilen };
  });
}

/** Ein Schiff: Kopf, Wortzeilen, Zahlen (ohne unbekannte) und Teile. */
export function schiffVon(id: string, d: VehicleData, lang: Locale, href: string): Schiff {
  const zahl: Partial<Record<StatKey, number>> = {};
  for (const sec of COMPARE) {
    for (const k of sec.stats) {
      const v = statValue(k, STAT[k].read(d, id));
      if (v != null) zahl[k] = v;
    }
  }
  const size = vSizeClass(id);
  const text: Schiff['text'] = {};
  const role = vRoleCig(id, d, lang);
  const sz = size != null ? sizeClassLabel(size, lang) : vSize(d, lang);
  if (role) text.role = role;
  if (sz) text.size = sz;
  return { name: d.name, maker: d.manufacturer ?? '', href, text, zahl, teile: teileVon(d, lang) };
}

/** Der ganze Vergleich einer Sprache, fuer die JSON-Datei. */
export function vergleichJson(entries: readonly { id: string; data: VehicleData }[], lang: Locale): Vergleich {
  const schiffe: Record<string, Schiff> = {};
  for (const e of entries) {
    const href = lang === 'de' ? `/de/schiffe/${e.id}.html` : `/schiffe/${e.id}.html`;
    schiffe[e.id] = schiffVon(e.id, e.data, lang, href);
  }
  return { abschnitte: abschnitte(lang), schiffe };
}
