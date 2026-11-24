// Missionen im ersten Register der Kopfsuche (UX-Audit Paket B5 mit Paket F).
//
// Eine Zeile je Mission, nicht je Angebot. Der Name kommt aus derselben
// Titelableitung wie die Missionsseite (src/lib/missionTitel.ts ueber
// missionName): lesbar, ohne Vorlagen-Klammern. Gleichnamige Missionen
// unterscheidet der Zusatz („Hydrogen · 1 Abholort, 2 Ziele") vorn in der
// Unterzeile, wie in der Liste verwandter Missionen (MissionDetail.astro).
// Vorher stand hier „ReputationRank Hauler Needed for Direct CargoGradeToken
// Shipment" dreimal untereinander, ohne Unterschied.
//
// Titel, Typen und Geber sind Spieldaten (englisch) und in beiden Sprachen
// gleich; lokalisiert werden Zusatz, Zahlenformat und Ziel-URL. Die Vorlage
// und der Zusatz beider Sprachen bleiben Suchwoerter (x, nie angezeigt):
// „rank" und „abholort" finden weiter.
//
// Geprueft in tests/e2e/suche-treffer.test.js (keine Klammern, Name wie auf
// der Seite, gleich lautende Zeilen unter einer Klinke).
import { href, type Locale } from '../i18n/ui';
import { missions, missionName, missionSuchwoerter, missionZusatz, repSummary, uec } from './missions';
import type { SearchEntry } from './searchIndex';

/**
 * Suchwoerter ohne Wiederholung: jedes Wort einmal (Gross/Klein egal), und
 * keines, das schon im Titel steht. Das Overlay sucht Wort fuer Wort; eine
 * Wiederholung findet nichts Neues und kostet nur Bytes im ersten Register.
 */
export function einmalWoerter(text: string, titel: string): string {
  const gesehen = new Set(titel.toLowerCase().split(/\s+/));
  const raus: string[] = [];
  for (const w of text.split(/\s+/)) {
    const k = w.toLowerCase();
    if (!w || gesehen.has(k)) continue;
    gesehen.add(k);
    raus.push(w);
  }
  return raus.join(' ');
}

export function missionEintraege(lang: Locale): SearchEntry[] {
  return missions.map((m) => {
    const rep = repSummary(m)[0];
    const name = missionName(m);
    // Der Titel steht schon in t; aus den Suchwoertern nur der Rest.
    const such = missionSuchwoerter(m);
    const suchRest = such.startsWith(name.titel) ? such.slice(name.titel.length) : such;
    return {
      k: 'mission',
      b: m.typeNames[0] ?? 'Mission',
      t: name.titel,
      s: [
        missionZusatz(m, lang) || null,
        m.rewardMax ? `${uec(m.rewardMax, lang)} aUEC` : null,
        rep?.factionName ?? null,
        m.count > 1 ? `${m.count}×` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      u: href(`/missionen/${m.slug}.html`, lang),
      x: einmalWoerter([suchRest, ...m.giverNames, ...m.factionNames, ...m.localityNames, ...m.typeNames].join(' '), name.titel).slice(0, 200),
    };
  });
}
