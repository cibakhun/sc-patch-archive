// Quellen einer Halle im Rohordner (hall/ unter dem Quellordner des Builds).
//
// Neben dem Modell <halle>.glb legt der Extraktor Beilagen ab, die der Build
// mit dem Modell liest: Maße und Palette (<halle>.info.json), die Teilnetze
// der Aufkleber (<halle>.decals.glb) und die Schrift der vollen Stufe
// (<halle>.schrift.glb). Zwei davon enden selbst auf .glb.
//
// Zwei Fragen stellt der Build an diesen Ordner, und beide gingen an den
// Beilagen vorbei (CodeRabbit an PR #371, 14.11.2026):
//   1. Welche Datei ist eine Halle? Jede .glb galt als eine. Ein Lauf ohne
//      --only hätte <halle>.decals.glb und <halle>.schrift.glb als eigene
//      Hallen gebaut und ins Manifest geschrieben.
//   2. Ist das gebaute Modell noch frisch? Gezählt wurden nur Lampenprotokoll,
//      Materialnachtrag und die Listen des Exports. Neue Aufkleber, neue
//      Schrift oder eine neue Palette allein ließen die alte Halle stehen, und
//      eine gelöschte Liste der Aufzugsbahnen wurde nicht neu geschrieben.
// Die Antworten stehen hier, damit sie ohne die Spieldateien prüfbar sind
// (tests/e2e/hall-quellen.test.js); scripts/build-hangar-assets.mjs fragt sie.

// Beilagen, die selbst ein glTF sind: <halle>.<beilage>.glb
export const HALL_BEILAGEN_GLB = ['decals', 'schrift'];

/** Ist die Datei im Rohordner das Modell einer Halle? Die Beilagen sind keine. @param {string} datei */
export const istHallenModell = (datei) => /\.glb$/i.test(datei) && !new RegExp(`\\.(?:${HALL_BEILAGEN_GLB.join('|')})\\.glb$`, 'i').test(datei);

// Was der Build neben dem Modell einer Halle liest (Endung hinter „<halle>.“).
// Die ersten fünf gelten ebenso für Aufzug und Werkhalle.
export const NEBEN_EINGABEN = ['lights-src.txt', 'matfix.json', 'entities.json', 'layers.json', 'tor.json'];
export const HALL_EINGABEN = [...NEBEN_EINGABEN, 'info.json', ...HALL_BEILAGEN_GLB.map((b) => `${b}.glb`)];

/**
 * Ist jede Ausgabe da und jünger als jede Eingabe?
 * @param {string[]} ausgaben
 * @param {string[]} eingaben fehlende zählen nicht
 * @param {(pfad: string) => number|null} zeit Änderungszeit in ms, null ohne Datei
 */
export function juengerAls(ausgaben, eingaben, zeit) {
  const ein = eingaben.map(zeit).filter((t) => t != null);
  return ausgaben.every((a) => { const t = zeit(a); return t != null && ein.every((e) => t > e); });
}
