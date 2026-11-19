// Sprachdatei des Spiels (Data/Localization/<sprache>/global.ini) als Map
// Schluessel (klein) -> Text.
//
// 13.612 Schluessel der englischen Fassung (4.10.3) heissen "<key>,P=Text".
// Die Verweise im Spiel ("@key") nennen das Suffix nie, also gehoert der Text
// zum Schluessel ohne ",P". Wer es mitnimmt, verliert still Missionstitel,
// Itemnamen und Beschreibungen. Kein Schluessel steht mit und ohne Suffix in
// der Datei, die Reihenfolge entscheidet also nichts.
export function parseGlobalIni(text, { trim = false } = {}) {
  const m = new Map();
  if (!text) return m;
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i <= 0) continue;
    const key = line.slice(0, i).replace(/^﻿/, '').trim().toLowerCase().replace(/,p$/, '');
    const val = line.slice(i + 1);
    m.set(key, trim ? val.trim() : val);
  }
  return m;
}
