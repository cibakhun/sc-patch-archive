// Frische Anmeldung vor dem Löschen.
//
// Ein Konto zu löschen ist nicht umkehrbar. Ein gültiges JWT allein reicht
// dafür nicht: es kann aus einem Refresh-Token stammen, das Stunden alt ist
// und auf einem fremden Gerät liegt. Das Dashboard bestätigt vorher mit dem
// Passwort oder einer neuen Discord-Anmeldung; danach trägt das Token im
// Anspruch amr einen Eintrag, dessen Zeitpunkt jünger als das Fenster ist.
// Ein aufgefrischtes Token behält die Zeitpunkte der ursprünglichen
// Anmeldung, wird also nicht von selbst wieder frisch.
//
// Gelesen wird nur die Nutzlast. Die Signatur ist zu diesem Zeitpunkt schon
// geprüft (verify_jwt=true am Eingang und getUser() in index.ts).
//
// Absichtlich ohne Importe: läuft in der Edge Function (Deno) und
// unverändert in tests/e2e/delete-account-fresh.test.js (Node).

/** Sekunden; dasselbe Fenster wie im Dashboard (reauthWindow). */
export const REAUTH_WINDOW = 600;

export function signedInRecently(jwt: string, nowSec: number, windowSec: number = REAUTH_WINDOW): boolean {
  try {
    const part = jwt.split('.')[1];
    if (!part) return false;
    const b = part.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(b + '='.repeat((4 - (b.length % 4)) % 4)));
    if (!Array.isArray(claims?.amr)) return false;
    return claims.amr.some((m: { timestamp?: unknown }) => {
      const t = Number(m?.timestamp);
      return Number.isFinite(t) && t <= nowSec + 60 && nowSec - t < windowSec;
    });
  } catch {
    return false;
  }
}
