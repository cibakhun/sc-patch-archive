// Maschinenbezeichner in lesbaren Text.
//
// ⚠⚠ ANLASS (gemessen 31.08.2026): rohe CamelCase-Werte standen im
// sichtbaren Text UND in Meta-Descriptions. Auf einer deutschen Item-Seite:
//
//     „Aegis Hammerhead: Störsignalwerfer — CountermeasureLauncher
//      WeaponDefensive von Aegis Dynamics"
//
// Gezaehlt im ausgelieferten Bestand: „WeaponPersonal" allein auf 718
// Seiten, davon 492 in der Meta-Description — also in dem Text, den
// Suchmaschinen zitieren. Dazu 205 Missionsseiten mit
// „FactionReputationScope" in einer Tabellenzelle.
//
// Getrennt wird, nicht uebersetzt: das Vokabular von Star Citizen ist auch
// im deutschen Sprachgebrauch englisch, und eine Uebersetzung waere
// geraten, wo die Daten keine hergeben.

/**
 * Namen, die die reine Trennung NICHT richtig hinbekommt. Jeder Eintrag
 * steht hier mit Grund:
 *
 *   - Die `Weapon*`-Familie steht in den Daten verkehrt herum:
 *     „WeaponPersonal" ist eine persoenliche Waffe, nicht eine „Waffe
 *     persoenlich".
 *   - `MobiGlas` ist ein Eigenname und schreibt sich „mobiGlas".
 */
const SONDERFALL: Record<string, string> = {
  WeaponPersonal: 'Personal Weapon',
  WeaponAttachment: 'Weapon Attachment',
  WeaponGun: 'Gun',
  WeaponDefensive: 'Defensive Weapon',
  WeaponMining: 'Mining Weapon',
  MobiGlas: 'mobiGlas',
};

/**
 * „CountermeasureLauncher" → „Countermeasure Launcher".
 * „SalvageModifier_TractorBeam" → „Salvage Modifier Tractor Beam".
 */
export function lesbarerBezeichner(s: string): string {
  if (SONDERFALL[s]) return SONDERFALL[s];
  return s
    /* Unterstriche sind in diesen Werten ein Trenner, kein Zeichen. */
    .replace(/_/g, ' ')
    /* Binnenversalie auftrennen — aber nicht innerhalb einer Abkuerzung:
       aus „QDrive" soll nicht „Q Drive" werden. */
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Ruf-Bereiche der Missionen. Ein Teil der Werte traegt den Namen der
 * DATENSTRUKTUR statt einer Aussage — „FactionReputationScope" (205
 * Missionen) und „MissionProviderReputationScope_Battaglia" (4). Die
 * Tabellenspalte heisst bereits „Bereich"; der Struktur-Ballast wird
 * deshalb abgeschnitten, damit stehen bleibt, was den Fall unterscheidet:
 *
 *     FactionReputationScope                    -> Faction
 *     MissionProviderReputationScope_Battaglia  -> Battaglia
 *     NPC_Fired                                 -> NPC Fired
 *     Racing_ShipTimeTrial                      -> Racing Ship Time Trial
 *
 * ⚠ Das ist eine Kuerzung, keine Erfindung: es bleibt dasselbe Datum,
 * nur ohne den Teil, der auf jeder Zeile identisch waere.
 */
export function lesbarerRufBereich(s: string): string {
  const m = s.match(/^(.*?)(?:MissionProvider)?ReputationScope(?:_(.+))?$/);
  if (m) {
    const rest = (m[2] || m[1] || '').trim();
    if (rest) return lesbarerBezeichner(rest);
  }
  return lesbarerBezeichner(s);
}
