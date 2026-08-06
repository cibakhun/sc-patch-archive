// Vehicle text resolution DE/EN (Stufe 2).
// Freitext-Daten (Beschreibung, Foci) + Enum-Felder (Größe/Status/Typ) pro
// Locale. EN-Beschreibungen kommen seit 01.4-05 direkt aus `descriptionEn`
// (CIGs Originaltext, Data.p4k) — die frühere Rückübersetzungsdatei ist
// entfernt (D-07).
import type { CollectionEntry } from 'astro:content';
import vehicleRoles from '../data/vehicle-roles.json';
import type { Locale } from './ui';

type VehicleData = CollectionEntry<'vehicles'>['data'];

type RoleEntry = {
  careerDe: string | null;
  careerEn: string | null;
  roleKey: string | null;
  roleDe: string | null;
  roleEn: string | null;
  families: string[];
  sig?: { ir: number | null; em: number | null; cs: number | null };
  feat?: string[];
  size?: number | null;
  subType?: string | null;
};
const ROLES = (vehicleRoles as { vehicles: Record<string, RoleEntry> }).vehicles;

// sizeDe (6 Werte) -> EN
const SIZE_EN: Record<string, string> = {
  Klein: 'Small',
  Mittel: 'Medium',
  'Groß': 'Large',
  Kapitalklasse: 'Capital',
  Beiboot: 'Snub',
  Fahrzeug: 'Vehicle',
};

// statusDe (2 Werte) -> EN (saubere Groß-/Kleinschreibung; statusEn ist lowercase)
const STATUS_EN: Record<string, string> = {
  Flugbereit: 'Flight Ready',
  'Im Konzept': 'In Concept',
};

// typeEn ist bereits englisch, aber lowercase -> Anzeige-Form
const TYPE_EN: Record<string, string> = {
  combat: 'Combat',
  competition: 'Racing',
  exploration: 'Exploration',
  ground: 'Ground',
  industrial: 'Industrial',
  multi: 'Multi-Role',
  support: 'Support',
  transport: 'Transport',
};

// turrets[].label (3 Werte) -> EN. Der Sync erzeugt die Labels deutsch, das
// Datenblatt zeigt sie aber in beiden Sprachen (Bewaffnung).
const TURRET_EN: Record<string, string> = {
  'Bemannte Türme': 'Manned turrets',
  'Ferngesteuerte Türme': 'Remote turrets',
  'Punktverteidigung (PDC)': 'Point defense (PDC)',
};

// Rollenschlüssel ohne deutsche CIG-Fassung (D-13, ROLE-07). 17 Einträge,
// Erhebungsstand 02.08.2026 (05-02-PLAN.md <interfaces>). Wortlaut folgt CIGs
// eigener Wortwahl, wie sie in aufgelösten Labels sichtbar ist. Nur DE — die
// englische Fassung liefert CIG in jedem der 17 Fälle bereits selbst.
const ROLE_DE_GAPFILL: Record<string, string> = {
  antiair: 'Flugabwehr',
  item_ShipFocus_HeavyGunship: 'Schweres Kanonenschiff',
  lighttank: 'Leichter Panzer',
  heavyfighterbomber: 'Schwerer Jäger / Bomber',
  starterlightfighter: 'Starter / Leichter Jäger',
  generalist: 'Generalist',
  lightfreight_mediumfighter: 'Leichter Frachter / Mittlerer Jäger',
  antivehicle: 'Panzerabwehr',
  startermining: 'Starter / Leichtes Bergbauschiff',
  heavydropship: 'Schweres Truppenschiff',
  lightrefueling: 'Leichtes Tankschiff',
  mediumsalvage: 'Mittleres Bergungsschiff',
  heavytank: 'Schwerer Panzer',
  modular: 'Modular',
  startersalvage: 'Starter / Leichtes Bergungsschiff',
  recovery: 'Bergungs- und Rettungsschiff',
  snubcarrier: 'Annexträger',
};

// Familien-Slug -> Beschriftung (D-05). 18 Einträge, Erhebungsstand
// 02.08.2026 (05-02-PLAN.md <interfaces>).
const FAMILY_LABELS: Record<string, { de: string; en: string }> = {
  jaeger: { de: 'Jäger', en: 'Fighters' },
  frachttransport: { de: 'Frachttransport', en: 'Cargo Hauling' },
  erkundung: { de: 'Erkundung', en: 'Exploration' },
  passagiere: { de: 'Passagiere', en: 'Passenger' },
  rennen: { de: 'Rennen', en: 'Racing' },
  einsteiger: { de: 'Einsteiger', en: 'Starter' },
  bodenkampf: { de: 'Bodenkampf', en: 'Ground Combat' },
  kanonenschiff: { de: 'Kanonenschiff', en: 'Gunship' },
  medizin: { de: 'Medizin', en: 'Medical' },
  bomber: { de: 'Bomber', en: 'Bomber' },
  truppentransport: { de: 'Truppentransport', en: 'Troop Transport' },
  bergung: { de: 'Bergung', en: 'Salvage' },
  abriegelung: { de: 'Abriegelung', en: 'Interdiction' },
  bergbau: { de: 'Bergbau', en: 'Mining' },
  grosskampfschiff: { de: 'Großkampfschiff', en: 'Capital' },
  'daten-wissenschaft': { de: 'Daten & Wissenschaft', en: 'Data & Science' },
  betankung: { de: 'Betankung', en: 'Refueling' },
  mehrzweck: { de: 'Mehrzweck', en: 'Multi-Role' },
};

// D-07: CIG-eigene HUD-Begriffe für die drei Signaturpositionen (aus
// global.ini: hud_scanning_info_ir_signature / _em_signature / _cs_signature).
// D-08: das Wort "Tarnung"/"Stealth" taucht hier bewusst NICHT auf — die
// CIG-Rolle (Tarnjäger, Tarnbomber) trägt dieses Wort bereits, die Zahlen
// heißen nach dem, was gemessen ist.
export const SIG_LABELS: Record<'ir' | 'em' | 'cs', { de: string; en: string }> = {
  ir: { de: 'IR-Signatur', en: 'IR Signature' },
  em: { de: 'EM-Signatur', en: 'EM Signature' },
  cs: { de: 'RQ-Signatur', en: 'CS Signature' },
};

// D-07 Filterstufen (Claude's Discretion aus 05-CONTEXT.md: Stufen statt
// Schieber, bei 16 Schiffen trägt ein Schieber nichts). D-08: benannt nach der
// gemessenen Größe, nicht nach einer Fähigkeit.
export const SIG_STEPS: { value: string; de: string; en: string }[] = [
  { value: '1', de: 'Abgesenkte Signatur', en: 'Reduced signature' },
  { value: '0.8', de: 'Stark abgesenkt', en: 'Strongly reduced' },
];

// D-09: Merkmalsleiste — nur die beiden Merkmale, die nachweislich etwas
// aussieben, das die Rolle nicht schon aussiebt (Frachtraum 102, Bodenfahrzeug
// 37). "Bewaffnet" ist keine Kennung hier (siehe datamine-vehicle-roles.mjs).
export const FEAT_LABELS: Record<'cargo' | 'ground', { de: string; en: string }> = {
  cargo: { de: 'Frachtraum', en: 'Cargo hold' },
  ground: { de: 'Bodenfahrzeug', en: 'Ground vehicle' },
};

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Typ-Anzeige (z. B. Holo-Chip / Datenblatt) */
export function vType(d: VehicleData, lang: Locale): string | null {
  if (lang === 'en') return d.typeEn ? TYPE_EN[d.typeEn] ?? cap(d.typeEn) : null;
  return d.typeDe ?? null;
}
/** Größe-Anzeige */
export function vSize(d: VehicleData, lang: Locale): string | null {
  if (lang === 'en') return d.sizeDe ? SIZE_EN[d.sizeDe] ?? d.sizeDe : null;
  return d.sizeDe ?? null;
}
/** Status-Anzeige */
export function vStatus(d: VehicleData, lang: Locale): string | null {
  if (lang === 'en') return d.statusDe ? STATUS_EN[d.statusDe] ?? d.statusEn ?? null : d.statusEn ?? null;
  return d.statusDe ?? null;
}
/** Turm-Bezeichnung (Bewaffnung) */
export function vTurret(label: string, lang: Locale): string {
  return lang === 'en' ? TURRET_EN[label] ?? label : label;
}
/**
 * Fokus-Tags (Liste). Bis 01.4-05 aus `fociDe` (Wiki-Fremddatei) plus einer
 * 65 Zeilen langen FOCI_EN-Handübersetzung gelesen — der Spieldaten-Katalog
 * liefert `roleEn`/`roleDe` jetzt direkt aus CIGs eigener Localization, beide
 * Sprachen nativ. Die Handtabelle entfällt damit (und mit ihr die Gefahr,
 * dass eine neue Rolle unübersetzt durchrutscht) — der Rückfall bleibt
 * `fociDe` (weiterhin eingefroren, D-18) nur für die vier ATLS-Einträge, bei
 * denen `roleEn`/`roleDe` in der Fremddatei fehlt.
 */
export function vFoci(d: VehicleData, lang: Locale): string[] {
  const role = lang === 'en' ? d.roleEn : d.roleDe;
  if (role) return [role];
  return lang === 'en' ? [] : d.fociDe ?? [];
}
/**
 * Spezifisches Rollen-Label (variantenunterscheidend).
 *
 * Der generische Typ (`typeDe`) kennt nur 8 Werte (Gefecht, Industrie …) und
 * ist damit für Varianten nicht unterscheidbar — Talon und Talon Shrike sind
 * beide „Gefecht“. `roleEn`/`roleDe` liegen dagegen für praktisch alle
 * Katalog-Schiffe vor und sind spezifisch (Leichter Jäger, Schwerer Jäger,
 * Bomber, Tarnkappenjäger …). Deshalb ist die Rolle das primäre Label; der
 * Typ bleibt reiner Fallback. Bei den wenigen Varianten, deren Rolle
 * identisch bleibt (z. B. F7C Mk I / Mk II), trägt der Schiffsname die
 * Unterscheidung — er steht überall direkt daneben.
 */
export function vRole(d: VehicleData, lang: Locale): string | null {
  const foci = vFoci(d, lang);
  if (foci.length) return foci.join(' · ');
  return vType(d, lang);
}
/**
 * Exakte CIG-Rolle (D-11) — ersetzt `vRole`/`fociDe` als Kartenbeschriftung.
 * Quelle ist die committete Momentaufnahme aus `vehicle-roles.json`
 * (`scripts/datamine-vehicle-roles.mjs`), nicht die Wiki-Foci: CIGs eigene
 * Klassifikation ist einsprachig sauber, ohne Tippfehler/Dubletten. Fehlt das
 * Fahrzeug in der Momentaufnahme (die 4 ATLS-Einträge, D-03) oder ist das
 * Label in dieser Sprache leer, fällt die Funktion auf `vRole` zurück.
 *
 * Deutsch fehlt CIG-seitig für 17 Rollenschlüssel (D-13, ROLE-07) — dafür
 * greift ZUERST `ROLE_DE_GAPFILL[roleKey]`, erst danach der `vRole`-Rückfall
 * (der über `fociDe` läuft). Ohne diese Reihenfolge rutschte eine der 28
 * betroffenen Schiffskarten englisch auf die deutsche Seite.
 */
export function vRoleCig(id: string, d: VehicleData, lang: Locale): string | null {
  const r = ROLES[id];
  if (r) {
    if (lang === 'de') {
      if (r.roleDe) return r.roleDe;
      if (r.roleKey && ROLE_DE_GAPFILL[r.roleKey]) return ROLE_DE_GAPFILL[r.roleKey];
    } else if (r.roleEn) {
      return r.roleEn;
    }
  }
  return vRole(d, lang);
}
/**
 * Beruf-Anzeige (D-04, `vehicleCareer`). Quelle ist dieselbe Momentaufnahme
 * wie `vRoleCig`; keine eigene Übersetzungstabelle nötig, `careerDe`/`careerEn`
 * stehen dort bereits kanonisch (`CAREER_LABEL` im Datamine-Skript).
 */
export function vCareer(id: string, lang: Locale): string | null {
  const r = ROLES[id];
  if (!r) return null;
  return (lang === 'de' ? r.careerDe : r.careerEn) ?? null;
}
/**
 * Rollenfamilien (D-05/D-06) — ein Fahrzeug kann mehrere Familien tragen
 * (Verbundrollen, z. B. Starter-Frachter = `einsteiger` + `frachttransport`).
 * Gibt `{ slug, label }` je Familie zurück, `label` aus `FAMILY_LABELS`.
 */
export function vRoleFamilies(id: string, lang: Locale): { slug: string; label: string }[] {
  const r = ROLES[id];
  if (!r || !r.families?.length) return [];
  return r.families.map((slug) => ({
    slug,
    label: (lang === 'de' ? FAMILY_LABELS[slug]?.de : FAMILY_LABELS[slug]?.en) ?? slug,
  }));
}
/**
 * Signatur (D-07). `min` ist das Minimum aus IR und EM (die beiden Positionen,
 * die bei allen 16 Trägern gesetzt sind) — das ist zugleich der Filterwert
 * `data-sig`. Fehlt das Bauteil, gilt der Normalwert `1` (keine Absenkung).
 */
export function vSignature(id: string): { ir: number | null; em: number | null; cs: number | null; min: number } {
  const sig = ROLES[id]?.sig;
  if (!sig) return { ir: null, em: null, cs: null, min: 1 };
  const min = Math.min(sig.ir ?? 1, sig.em ?? 1);
  return { ir: sig.ir ?? null, em: sig.em ?? null, cs: sig.cs ?? null, min };
}
/**
 * CIG-Größenklasse (Quick-Task 260802-ose, `AttachDef.Size`, 1–6) — CIGs
 * eigene Hangar-/Landeplatzklasse, NICHT die umgangssprachliche Größe aus
 * `vSize`/`sizeDe` (die weicht gemessen ab, z. B. Reclaimer = Größe 6 trotz
 * Wiki-Größe „Groß"). `null`, wenn das Fahrzeug in der Momentaufnahme fehlt
 * (die 4 ATLS-Einträge, D-03) oder kein AttachDef trägt.
 */
export function vSizeClass(id: string): number | null {
  return ROLES[id]?.size ?? null;
}
/**
 * Beschriftung der Größenklasse. CIG liefert für die Zahlen 1–6 keine Namen
 * (geprüft: global.ini kennt S/M/L nur für Hangars selbst) — deshalb bewusst
 * die nackte Klasse, keine erfundene Kategorie ("S1 = Beiboot" wäre falsch).
 */
export function sizeClassLabel(n: number, lang: Locale): string {
  return lang === 'de' ? `Größe ${n}` : `Size ${n}`;
}
// Die Rohdaten (descriptionEn/descriptionDe) sind bereits an der Quelle
// bereinigt (scripts/datamine-vehicles.mjs, dieselbe Regel) — Kopfzeile
// ("Manufacturer: …\nFocus: …\n\n") abgeschnitten, wörtliche "\n"-Folgen zu
// echten Zeilenumbrüchen gewandelt (Anzeige: ShipDetail.astro .sd__desc,
// white-space:pre-line). Dieselbe Funktion läuft hier NOCH EINMAL als
// Sicherheitsnetz (idempotent — ein bereits sauberer Text bleibt unverändert)
// für Fälle wie die vier ATLS-Einträge, deren Text aus dem alten Wiki-
// Snapshot eingefroren ist und nicht durch den Generator lief.
const DESC_HEADER_RX = /^(?:Manufacturer|Hersteller)\s*:.*?\\n(?:Focus|Fokus)\s*:.*?(?:\\n)+/i;
function cleanDesc(s: string | null | undefined): string | null {
  if (!s) return null;
  const cleaned = s.replace(DESC_HEADER_RX, '').replace(/\\n/g, '\n').trim();
  return cleaned || null;
}
/** Freitext-Beschreibung: CIGs Originaltext (descriptionEn/descriptionDe,
 *  D-07), mit Sprach-Rückfall falls die eine Fassung fehlt. */
export function vDesc(d: VehicleData, lang: Locale): string | null {
  if (lang === 'en') return cleanDesc(d.descriptionEn) ?? cleanDesc(d.descriptionDe);
  return cleanDesc(d.descriptionDe) ?? cleanDesc(d.descriptionEn);
}
