// Bildadresse als CSS-Wert `url("…")` — fuer style.backgroundImage und
// Custom Properties, wenn die Adresse aus einem Profil kommt (banner_url
// schreibt der Besitzer selbst, die Pilotenseite zeigt sie jedem Besucher).
//
// Vorher stand dort `url('${url}')`: ein Apostroph oder eine Klammer in der
// Adresse beendete den CSS-String, und der Rest wurde als weitere
// Hintergrundebene gelesen, etwa ein zweites Bild von einem fremden Host. Die
// Datenbank laesst seit 20261030140000_profile_columns_checked.sql nur noch
// eigene Bilder zu; diese Funktion ist die zweite Linie fuer Altwerte und fuer
// alles, was je an der Regel vorbeikommt.
//
// Regeln: nur https oder dieselbe Origin mit demselben Schema (relative
// Motive wie /assets/t-pyro-2.jpg, lokal auch http), nichts anderes
// (javascript:, data:, blob:, http fremder Hosts), und keine Zugangsdaten in
// der Adresse. Auch Bilder aus Bau-Daten (Schiffsbilder des Wikis) laufen
// hier durch: die Funktion haelt den Wert im CSS-String, sie prueft keine
// Herkunft. Welche Hosts ein Bild liefern duerfen, sagt die CSP (img-src).
// Die Adresse geht in doppelten Anfuehrungszeichen
// hinein, und alles, was einen CSS-String beenden oder umbrechen kann (" \
// und Steuerzeichen), ist als CSS-Hex-Escape geschrieben. Der WHATWG-Parser
// kodiert " im Pfad, in Query und Fragment schon selbst, im Host aber nicht.
// Ergebnis: der fertige Wert oder null (dann bleibt der Hintergrund, wie er
// ist).
export function cssUrl(raw: unknown, base: string = globalThis.location?.href ?? 'https://verse-base.com/'): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let u: URL;
  try {
    u = new URL(raw.trim(), base);
  } catch {
    return null;
  }
  const own = new URL(base);
  // blob:https://eigene-origin/… meldet dieselbe origin, ist aber kein Bild
  // von dort: das Schema muss selbst stimmen.
  if (u.protocol !== 'https:' && !(u.protocol === own.protocol && u.origin === own.origin)) return null;
  if (u.username || u.password) return null;
  const quoted = u.href.replace(/["\\\x00-\x1f\x7f]/g, (c) => '\\' + c.charCodeAt(0).toString(16) + ' ');
  return `url("${quoted}")`;
}
