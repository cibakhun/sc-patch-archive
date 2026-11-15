// Kontoseiten im Terminal der Halle (15.11.2026).
//
// Das Terminal (assets/hangar-terminal.js) zeigt Seiten in einem Rahmen auf
// dem Monitor des Leitstands und setzt data-vb-terminal an ihr <html>, sobald
// ihr Dokument steht. Anmelden und Registrieren laufen dort im Rahmen, mit
// einer Ausnahme: Discord laesst sich nicht rahmen. Wer im Terminal „Mit
// Discord …“ waehlt, bekommt ein kleines Fenster; die Halle bleibt geladen.
//
// Der Weg:
//  1. Die gerahmte Seite oeffnet das Fenster sofort beim Klick (spaeter haelt
//     der Browser es fuer ungebeten), trennt es von sich (opener) und schickt
//     es zu Discord. Der Ruecksprung zeigt auf die Anmeldeseite mit der Marke
//     ?fenster=1.
//  2. Die Anmeldeseite im Fenster loest den code ein (der Verifier liegt im
//     gemeinsamen Speicher dieses Browsers), fragt wie jede Anmeldung den
//     zweiten Faktor und schliesst sich. Bricht jemand den Code ab, meldet
//     sie ab: Keine Sitzung ohne Code bleibt liegen.
//  3. Die gerahmte Seite hoert, dass im Speicher eine Sitzung entstanden ist
//     (storage), und geht weiter, sobald diese keinen Code mehr schuldet. Sie
//     fragt den Code nicht selbst: Sonst staenden zwei Fragen nebeneinander,
//     und ein Abbruch der einen meldete die andere mit ab. Derselbe Hoerer
//     folgt einer Anmeldung in einem anderen Tab, etwa wenn der Browser das
//     kleine Fenster nicht zugelassen hat.
//
// Bewusst ohne Importe: tests/e2e/im-terminal.test.js laedt diese Datei direkt.

/** Marke in der Adresse der Anmeldeseite, die im kleinen Fenster steht */
export const FENSTER_PARAM = 'fenster';
/** Name des kleinen Fensters: Ein zweiter Klick nimmt dasselbe, statt ein weiteres zu oeffnen */
export const FENSTER_NAME = 'vb-anmeldung';
/** Form des kleinen Fensters (Discord braucht etwa diese Flaeche) */
export const FENSTER_FORM = 'popup,width=520,height=780';
/** Speicherschluessel, unter dem supabase-js die Sitzung ablegt (nicht der code_verifier daneben) */
export const SITZUNG_KEY = /^sb-[a-z0-9]+-auth-token$/;

/** Steht diese Seite im Fenster des Terminals? Erst beim Gebrauch fragen: Das Merkmal kommt vom Elternfenster. */
export function imTerminal(win: Window = window): boolean {
  try {
    return win.self !== win.top && win.document.documentElement.hasAttribute('data-vb-terminal');
  } catch {
    return false;
  }
}

/** Steht diese Anmeldeseite im kleinen Fenster (search: location.search)? */
export function imFenster(search: string): boolean {
  return new URLSearchParams(search).get(FENSTER_PARAM) === '1';
}

/**
 * Adresse der Anmeldeseite fuer den Ruecksprung ins kleine Fenster: derselbe
 * Ursprung, nur der Pfad, dazu die Marke. '' fuer einen Pfad, der nicht auf
 * diesem Ursprung bleibt.
 */
export function fensterZiel(origin: string, loginPath: string): string {
  let u: URL;
  try { u = new URL(loginPath, origin); } catch { return ''; }
  if (u.origin !== origin) return '';
  return `${u.origin}${u.pathname}?${FENSTER_PARAM}=1`;
}

/** Meldet dieses storage-Ereignis eine Sitzung, die eben entstanden ist? */
export function sitzungKam(e: { key: string | null; newValue: string | null }): boolean {
  return !!e.newValue && SITZUNG_KEY.test(e.key || '');
}
