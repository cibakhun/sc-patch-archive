// Wertnamen und Pfadglieder des Craftings in der Sprache der Seite.
// ---------------------------------------------------------------------------
// Sprachregel (docs/sprachregel.md): Eigennamen aus dem Spiel bleiben
// englisch wie im Client, Wertnamen, Bedienwoerter und Gattungen stehen in
// der Sprache der Seite. Die Spieldaten liefern beide Sorten englisch; bis
// 24.11.2026 standen sie so auch auf den deutschen Seiten („Recoil
// Smoothness“ in der Qualitaetstabelle von 170 Bauplaenen, „VEHICLEGEAR /
// WEAPONS / BALLISTIC / CANNON“ im Kopf des Rezepts der Werkbank; UX-Audit,
// Heuristik B02).
//
// Bewusst englisch bleiben die Bauteil-Plaetze (FRAME, BARREL, …): So
// heissen die Felder im Fabricator des Spiels, Spieler finden sie dort
// unter diesem Namen wieder.
//
// verify:sprache Regel 13 prueft, dass kein Schluessel dieser Tabelle als
// ganze Textstelle auf einer deutschen Seite steht; tests/e2e/
// sprachregel.test.js, dass jeder Wert und jedes Pfadglied der Crafting-
// Daten hier einen Eintrag hat.

import type { Locale } from './ui';

/** Qualitaets-Wert (englisch, wie in den Daten) -> deutscher Wertname. */
export const WERTNAMEN_DE: Readonly<Record<string, string>> = {
  'Max Temp': 'Max. Temperatur',
  'Min Temp': 'Min. Temperatur',
  'Damage Mitigation': 'Schadensreduktion',
  'Integrity': 'Integrität',
  'Impact Force': 'Aufprallwucht',
  'Recoil Smoothness': 'Rückstoßglättung',
  'Recoil Handling': 'Rückstoßkontrolle',
  'Recoil Kick': 'Rückstoßstärke',
  'Coolant Rating': 'Kühlleistung',
  'Power Pips': 'Energiestufen',
  'Fire Rate': 'Feuerrate',
  'Max. Shield Strength': 'Max. Schildstärke',
  'Min. Assist Distance': 'Min. Zielhilfe-Distanz',
  'Max. Assist Distance': 'Max. Zielhilfe-Distanz',
  'Quantum Speed': 'Quantum-Geschwindigkeit',
  'Quantum Fuel Burn': 'Quantum-Treibstoffverbrauch',
  'Laser Power': 'Laserleistung',
  'Full Strength Dist.': 'Distanz volle Stärke',
  'Max. Distance': 'Max. Distanz',
  'Radius': 'Radius',
  'Speed': 'Geschwindigkeit',
  'Beam Force': 'Strahlkraft',
  'Max. Volume': 'Max. Volumen',
  'Efficiency': 'Effizienz',
  'Radiation Dissipation': 'Strahlungsabbau',
};

/**
 * Glied des Kategoriepfads eines Bauplans ("Vehiclegear / Weapons / …")
 * -> deutsche Gattung. Herstellerneutrale Gattungen werden uebersetzt;
 * Spielbegriffe, die auch im deutschen Client englisch stehen (Laser,
 * Gatling, SMG, LMG), behalten ihren Namen.
 */
export const PFADGLIEDER_DE: Readonly<Record<string, string>> = {
  Armour: 'Rüstung',
  Vehiclegear: 'Schiffskomponenten',
  Combat: 'Kampf',
  Medium: 'Mittel',
  Heavy: 'Schwer',
  Weapons: 'Waffen',
  Light: 'Leicht',
  Engineer: 'Techniker',
  Hunter: 'Jäger',
  Stealth: 'Tarnung',
  Cooler: 'Kühler',
  Powerplant: 'Generator',
  Shield: 'Schild',
  Radar: 'Radar',
  Ballistic: 'Ballistisch',
  Quantumdrive: 'Quantumantrieb',
  Laser: 'Laser',
  Cannon: 'Kanone',
  Ammo: 'Munition',
  Pistol: 'Pistole',
  Rifle: 'Gewehr',
  Sniper: 'Scharfschützengewehr',
  SMG: 'SMG',
  Miner: 'Bergbau',
  Shotgun: 'Schrotflinte',
  Repeater: 'Repetierer',
  Undersuit: 'Unteranzug',
  Flightsuit: 'Fliegeranzug',
  Size1: 'Größe 1',
  Size2: 'Größe 2',
  Size3: 'Größe 3',
  Size4: 'Größe 4',
  Mininglaser: 'Mining-Laser',
  LMG: 'LMG',
  Explorer: 'Erkunder',
  Tractorbeam: 'Traktorstrahl',
  Environment: 'Umwelt',
  Gatling: 'Gatling',
  Cosmonaut: 'Kosmonaut',
  Distortion: 'Distortion',
  Refuelling: 'Betankung',
  Nozzle: 'Düse',
  Medic: 'Sanitäter',
  Scatter: 'Streukanone',
  Salvage: 'Bergung',
  Salvager: 'Bergung',
  Electron: 'Elektron',
  Missionitems: 'Missionsgegenstände',
  Massdriver: 'Massebeschleuniger',
  Plasma: 'Plasma',
  Radiation: 'Strahlung',
  Racer: 'Rennfahrer',
};

/**
 * Klassen der Bauteile (Ton-Chip der Crafting-Karten: „Military", „Civilian"
 * …), wie sie im Hangar schon deutsch stehen (cls.* in hangarText.ts).
 * Waffenarten (Ballistic, Laser, Distortion, Electron) kommen aus
 * PFADGLIEDER_DE.
 */
export const KLASSEN_DE: Readonly<Record<string, string>> = {
  Military: 'Militär',
  Civilian: 'Zivil',
  Industrial: 'Industrie',
  Competition: 'Wettkampf',
  Stealth: 'Tarnung',
};

/** Wertname in der Sprache der Seite; Unbekanntes bleibt, wie es kommt. */
export function wertname(stat: string, lang: Locale): string {
  return lang === 'de' ? WERTNAMEN_DE[stat] ?? stat : stat;
}

/** Kategoriepfad eines Bauplans in der Sprache der Seite ("A / B / C"). */
export function pfadname(pfad: string, lang: Locale): string {
  if (lang !== 'de') return pfad;
  return pfad.split(' / ').map((g) => PFADGLIEDER_DE[g] ?? g).join(' / ');
}

/** Gattung (Klasse oder Pfadglied) in der Sprache der Seite; Unbekanntes bleibt stehen. */
export function gattung(name: string, lang: Locale): string {
  if (lang !== 'de') return name;
  return KLASSEN_DE[name] ?? PFADGLIEDER_DE[name] ?? name;
}
