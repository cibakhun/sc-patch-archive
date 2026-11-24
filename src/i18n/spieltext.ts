// Spieltext auf der Seite der anderen Sprache kennzeichnen.
// ---------------------------------------------------------------------------
// Sprachregel (docs/sprachregel.md): Texte aus dem Spiel (Beschreibungen,
// Auftragstexte, Herstellertexte) stehen in der Sprache der Seite, wo das
// Spiel sie in dieser Sprache liefert. Sonst bleiben sie englisch, aber nie
// unmarkiert: lang="en" sagt Vorlesern, Uebersetzern und Suchmaschinen, dass
// hier eine andere Sprache beginnt. verify:sprache Regel 12 prueft das an
// jedem Absatz der gebauten Seiten.

import type { Locale } from './ui';

/** lang-Attribut fuer einen Text: nur wenn er nicht in der Sprache der Seite steht. */
export function fremdLang(seite: Locale, text: Locale | null | undefined): Locale | undefined {
  return text && text !== seite ? text : undefined;
}

/**
 * Sprache der Auftragstexte. Die Missionsdaten tragen nur den englischen Text
 * (src/data/missions.json: desc, kein descDe); kommt eine deutsche Fassung
 * dazu, wird das hier eine Funktion je Mission.
 */
export const MISSIONSTEXT_LANG: Locale = 'en';
