// Vehicle text resolution DE/EN (Stufe 2).
// Freitext-Daten (Beschreibung, Foci) + Enum-Felder (Größe/Status/Typ) pro
// Locale. EN-Beschreibungen liegen sync-sicher in src/data/vehicles-en.json
// (vehicles.json wird per API-Sync neu erzeugt und würde inline-Felder
// überschreiben). Foci/Größe/Status/Typ sind Aufzählungen -> feste Maps.
import type { CollectionEntry } from 'astro:content';
import vehiclesEn from '../data/vehicles-en.json';
import vehicleRoles from '../data/vehicle-roles.json';
import type { Locale } from './ui';

type VehicleData = CollectionEntry<'vehicles'>['data'];

const EN_DESC = (vehiclesEn as { descriptions: Record<string, string> }).descriptions;
type RoleEntry = {
  careerDe: string | null;
  careerEn: string | null;
  roleKey: string | null;
  roleDe: string | null;
  roleEn: string | null;
  families: string[];
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

// fociDe (65 distinct) -> EN. Manche Quellwerte sind schon englisch.
const FOCI_EN: Record<string, string> = {
  Abriegelung: 'Interdiction',
  Abrieglung: 'Interdiction',
  Ambulance: 'Ambulance',
  Angriff: 'Attack',
  'Anti-Air': 'Anti-Air',
  'Aufklärung': 'Reconnaissance',
  'Beiboot Jäger': 'Snub Fighter',
  Bergbau: 'Mining',
  Bergung: 'Salvage',
  Berichterstattung: 'Reporting',
  Bomber: 'Bomber',
  'Cargo Loader': 'Cargo Loader',
  'Einfache Bergung': 'Basic Salvage',
  'Einfache Forschung': 'Basic Research',
  Einsteiger: 'Starter',
  Erkundung: 'Exploration',
  Forschungsreisen: 'Expedition',
  Fracht: 'Cargo',
  Fregatte: 'Frigate',
  Freight: 'Freight',
  Gefecht: 'Combat',
  Generalist: 'Multi-Role',
  'Großbergung': 'Heavy Salvage',
  'Heavy Dropship': 'Heavy Dropship',
  'Heavy Refueling': 'Heavy Refueling',
  Industrie: 'Industrial',
  'Kampfunterstützung': 'Combat Support',
  Kanonenboot: 'Gunboat',
  Komfort: 'Comfort',
  Korvette: 'Corvette',
  Landungsschiff: 'Dropship',
  'Leichter Frachter': 'Light Freighter',
  'Leichter Jäger': 'Light Fighter',
  'Light Refueler': 'Light Refueler',
  Luftabwehr: 'Air Defense',
  'Luxus-Reisen': 'Luxury Travel',
  'Luxus-Transport': 'Luxury Transport',
  'Medium Freighter': 'Medium Freighter',
  'Medium Hauler': 'Medium Hauler',
  'Medium Salvage': 'Medium Salvage',
  Medizin: 'Medical',
  'Militär': 'Military',
  'Militärischer Transport': 'Military Transport',
  'Mittlerer Datentransport': 'Medium Data Transport',
  'Mittlerer Frachter': 'Medium Freighter',
  'Mittlerer Frachttransport': 'Medium Cargo Transport',
  'Mittlerer Jäger': 'Medium Fighter',
  Passagier: 'Passenger',
  Patrol: 'Patrol',
  Pfadfinder: 'Pathfinder',
  Prospektierung: 'Prospecting',
  Reisen: 'Touring',
  Rennsport: 'Racing',
  Salvage: 'Salvage',
  'Schwerer Bomber': 'Heavy Bomber',
  'Schwerer Jäger': 'Heavy Fighter',
  'Schweres Kanonenboot': 'Heavy Gunboat',
  Schwertransport: 'Heavy Transport',
  'Snub Carrier': 'Snub Carrier',
  Tarnkappenbomber: 'Stealth Bomber',
  'Tarnkappenjäger': 'Stealth Fighter',
  Tarnung: 'Stealth',
  Transport: 'Transport',
  Transporter: 'Transporter',
  'Zerstörer': 'Destroyer',
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
/** Fokus-Tags (Liste) */
export function vFoci(d: VehicleData, lang: Locale): string[] {
  if (lang === 'en') return (d.fociDe ?? []).map((f) => FOCI_EN[f] ?? f);
  return d.fociDe ?? [];
}
/**
 * Spezifisches Rollen-Label (variantenunterscheidend).
 *
 * Der generische Typ (`typeDe`) kennt nur 8 Werte (Gefecht, Industrie …) und
 * ist damit für Varianten nicht unterscheidbar — Talon und Talon Shrike sind
 * beide „Gefecht“. Der `foci`-Fokus liegt dagegen für ALLE 226 Katalog-Schiffe
 * vor und ist spezifisch (Leichter Jäger, Schwerer Jäger, Bomber, Tarnkappen-
 * jäger …), 75 statt 8 distinkte Rollen. Deshalb ist der Fokus das primäre
 * Label; der Typ bleibt reiner Fallback. Bei den wenigen Varianten, deren Fokus
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
/** Freitext-Beschreibung (EN mit DE-Fallback, solange unübersetzt) */
export function vDesc(d: VehicleData, lang: Locale): string | null {
  if (lang === 'en') return EN_DESC[d.id] ?? d.descriptionDe ?? null;
  return d.descriptionDe ?? null;
}
