// Vehicle-Textauflösung für alle Sprachen.
// DEUTSCH ist die Quelle (vehicles.json). Freitext (Beschreibung) liegt je
// Sprache in einem eigenen Overlay — src/data/vehicles-en.json,
// src/data/vehicles-hu.json — weil vehicles.json per API-Sync neu erzeugt wird
// und inline-Felder überschreiben würde. Foci/Größe/Status/Typ/Turm sind
// Aufzählungen -> feste Maps je Sprache, Schlüssel = deutscher Quellwert.
import type { CollectionEntry } from 'astro:content';
import vehiclesEn from '../data/vehicles-en.json';
import vehiclesHu from '../data/vehicles-hu.json';
import type { Locale } from './ui';

type VehicleData = CollectionEntry<'vehicles'>['data'];

type DescMap = Record<string, string>;
const descOf = (m: unknown) => (m as { descriptions: DescMap }).descriptions;

/** Beschreibungs-Overlay je Sprache. 'de' fehlt — Deutsch IST die Quelle. */
const DESC: Partial<Record<Locale, DescMap>> = {
  en: descOf(vehiclesEn),
  hu: descOf(vehiclesHu),
};

// sizeDe (6 Werte) -> Übersetzung
const SIZE: Partial<Record<Locale, Record<string, string>>> = {
  en: {
    Klein: 'Small',
    Mittel: 'Medium',
    'Groß': 'Large',
    Kapitalklasse: 'Capital',
    Beiboot: 'Snub',
    Fahrzeug: 'Vehicle',
  },
  hu: {
    Klein: 'Kicsi',
    Mittel: 'Közepes',
    'Groß': 'Nagy',
    Kapitalklasse: 'Kapitális',
    Beiboot: 'Snub',
    Fahrzeug: 'Jármű',
  },
};

// statusDe (2 Werte) -> Übersetzung (saubere Groß-/Kleinschreibung; statusEn ist lowercase)
const STATUS: Partial<Record<Locale, Record<string, string>>> = {
  en: { Flugbereit: 'Flight Ready', 'Im Konzept': 'In Concept' },
  hu: { Flugbereit: 'Repülésre kész', 'Im Konzept': 'Koncepció fázisban' },
};

// typeEn ist bereits englisch, aber lowercase -> Anzeige-Form je Sprache
const TYPE: Partial<Record<Locale, Record<string, string>>> = {
  en: {
    combat: 'Combat',
    competition: 'Racing',
    exploration: 'Exploration',
    ground: 'Ground',
    industrial: 'Industrial',
    multi: 'Multi-Role',
    support: 'Support',
    transport: 'Transport',
  },
  hu: {
    combat: 'Harci',
    competition: 'Versenyzés',
    exploration: 'Felfedezés',
    ground: 'Földi',
    industrial: 'Ipari',
    multi: 'Többcélú',
    support: 'Támogatás',
    transport: 'Szállítás',
  },
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

// fociDe -> HU. Gleiche Schlüssel wie FOCI_EN (deutscher Quellwert).
const FOCI_HU: Record<string, string> = {
  Abriegelung: 'Elfogás',
  Abrieglung: 'Elfogás',
  Ambulance: 'Mentő',
  Angriff: 'Támadás',
  'Anti-Air': 'Légelhárítás',
  'Aufklärung': 'Felderítés',
  'Beiboot Jäger': 'Snub-vadászgép',
  Bergbau: 'Bányászat',
  Bergung: 'Salvage',
  Berichterstattung: 'Tudósítás',
  Bomber: 'Bombázó',
  'Cargo Loader': 'Rakománytöltő',
  'Einfache Bergung': 'Egyszerű salvage',
  'Einfache Forschung': 'Egyszerű kutatás',
  Einsteiger: 'Kezdő',
  Erkundung: 'Felfedezés',
  Forschungsreisen: 'Expedíció',
  Fracht: 'Rakomány',
  Fregatte: 'Fregatt',
  Freight: 'Teherszállítás',
  Gefecht: 'Harc',
  Generalist: 'Többcélú',
  'Großbergung': 'Nehéz salvage',
  'Heavy Dropship': 'Nehéz dropship',
  'Heavy Refueling': 'Nehéz üzemanyagtöltés',
  Industrie: 'Ipar',
  'Kampfunterstützung': 'Harctámogatás',
  Kanonenboot: 'Ágyúnaszád',
  Komfort: 'Komfort',
  Korvette: 'Korvett',
  Landungsschiff: 'Dropship',
  'Leichter Frachter': 'Könnyű teherhajó',
  'Leichter Jäger': 'Könnyű vadászgép',
  'Light Refueler': 'Könnyű üzemanyagtöltő',
  Luftabwehr: 'Légvédelem',
  'Luxus-Reisen': 'Luxusutazás',
  'Luxus-Transport': 'Luxusszállítás',
  'Medium Freighter': 'Közepes teherhajó',
  'Medium Hauler': 'Közepes szállító',
  'Medium Salvage': 'Közepes salvage',
  Medizin: 'Orvoslás',
  'Militär': 'Katonai',
  'Militärischer Transport': 'Katonai szállítás',
  'Mittlerer Datentransport': 'Közepes adatszállítás',
  'Mittlerer Frachter': 'Közepes teherhajó',
  'Mittlerer Frachttransport': 'Közepes rakományszállítás',
  'Mittlerer Jäger': 'Közepes vadászgép',
  Passagier: 'Utasszállítás',
  Patrol: 'Járőrözés',
  Pfadfinder: 'Útkereső',
  Prospektierung: 'Prospektálás',
  Reisen: 'Utazás',
  Rennsport: 'Versenyzés',
  Salvage: 'Salvage',
  'Schwerer Bomber': 'Nehéz bombázó',
  'Schwerer Jäger': 'Nehéz vadászgép',
  'Schweres Kanonenboot': 'Nehéz ágyúnaszád',
  Schwertransport: 'Nehéz szállítás',
  'Snub Carrier': 'Snub-hordozó',
  Tarnkappenbomber: 'Lopakodó bombázó',
  'Tarnkappenjäger': 'Lopakodó vadászgép',
  Tarnung: 'Lopakodás',
  Transport: 'Szállítás',
  Transporter: 'Szállítóhajó',
  'Zerstörer': 'Romboló',
};

const FOCI: Partial<Record<Locale, Record<string, string>>> = { en: FOCI_EN, hu: FOCI_HU };

// turrets[].label (3 Werte) -> Übersetzung. Der Sync erzeugt die Labels deutsch,
// das Datenblatt zeigt sie aber in jeder Sprache (Bewaffnung).
const TURRET: Partial<Record<Locale, Record<string, string>>> = {
  en: {
    'Bemannte Türme': 'Manned turrets',
    'Ferngesteuerte Türme': 'Remote turrets',
    'Punktverteidigung (PDC)': 'Point defense (PDC)',
  },
  hu: {
    'Bemannte Türme': 'Kezelt lövegtornyok',
    'Ferngesteuerte Türme': 'Távvezérelt lövegtornyok',
    'Punktverteidigung (PDC)': 'Pontvédelem (PDC)',
  },
};

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Typ-Anzeige (z. B. Holo-Chip / Datenblatt) */
export function vType(d: VehicleData, lang: Locale): string | null {
  // typeDe ist die Quelle; typeEn ist der (lowercase) Enum-Schlüssel.
  if (lang === 'de') return d.typeDe ?? null;
  if (!d.typeEn) return d.typeDe ?? null;
  return TYPE[lang]?.[d.typeEn] ?? cap(d.typeEn);
}
/** Größe-Anzeige */
export function vSize(d: VehicleData, lang: Locale): string | null {
  if (!d.sizeDe) return null;
  if (lang === 'de') return d.sizeDe;
  return SIZE[lang]?.[d.sizeDe] ?? d.sizeDe;
}
/** Status-Anzeige */
export function vStatus(d: VehicleData, lang: Locale): string | null {
  if (lang === 'de') return d.statusDe ?? null;
  if (!d.statusDe) return d.statusEn ?? null;
  return STATUS[lang]?.[d.statusDe] ?? d.statusEn ?? null;
}
/** Turm-Bezeichnung (Bewaffnung) */
export function vTurret(label: string, lang: Locale): string {
  return TURRET[lang]?.[label] ?? label;
}
/** Fokus-Tags (Liste) */
export function vFoci(d: VehicleData, lang: Locale): string[] {
  const map = FOCI[lang];
  if (!map) return d.fociDe ?? [];
  return (d.fociDe ?? []).map((f) => map[f] ?? f);
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
 * Freitext-Beschreibung in der Zielsprache, mit DE-Fallback: fehlt ein Eintrag
 * im Overlay, steht dort weiter Deutsch — sichtbar, aber nie leer.
 */
export function vDesc(d: VehicleData, lang: Locale): string | null {
  return DESC[lang]?.[d.id] ?? d.descriptionDe ?? null;
}
