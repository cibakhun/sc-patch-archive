// Vehicle text resolution DE/EN (Stufe 2).
// Freitext-Daten (Beschreibung, Foci) + Enum-Felder (Größe/Status/Typ) pro
// Locale. EN-Beschreibungen liegen sync-sicher in src/data/vehicles-en.json
// (vehicles.json wird per API-Sync neu erzeugt und würde inline-Felder
// überschreiben). Foci/Größe/Status/Typ sind Aufzählungen -> feste Maps.
import type { CollectionEntry } from 'astro:content';
import vehiclesEn from '../data/vehicles-en.json';
import type { Locale } from './ui';

type VehicleData = CollectionEntry<'vehicles'>['data'];

const EN_DESC = (vehiclesEn as { descriptions: Record<string, string> }).descriptions;

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
/** Freitext-Beschreibung (EN mit DE-Fallback, solange unübersetzt) */
export function vDesc(d: VehicleData, lang: Locale): string | null {
  if (lang === 'en') return EN_DESC[d.id] ?? d.descriptionDe ?? null;
  return d.descriptionDe ?? null;
}
