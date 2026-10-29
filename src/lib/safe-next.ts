// Ruecksprungziel aus ?next= — nur Ziele auf DERSELBEN Origin, als relativer
// Pfad samt Query und Fragment. Ohne Importe, damit tests/e2e/auth-url.test.js
// die Datei direkt laden kann. Die Torseite (src/pages/gate.astro) ist SDK-
// und bundlerfrei und traegt dieselbe Regel als Kopie im Inline-Skript.
//
// Gegen die eigene Origin aufloesen und die Origin vergleichen reicht allein
// nicht: geprueft wird zusaetzlich der FERTIGE Pfad, denn nur er geht an
// location.replace(). Er muss mit genau einem "/" beginnen.
export function safeNext(raw: string | null | undefined, origin: string, fallback: string): string {
  if (!raw || raw.charAt(0) !== '/') return fallback;
  try {
    const u = new URL(raw, origin);
    if (u.origin !== origin) return fallback;
    const rel = u.pathname + u.search + u.hash;
    if (rel.charAt(0) !== '/' || rel.charAt(1) === '/' || rel.charAt(1) === '\\') return fallback;
    return rel;
  } catch {
    return fallback;
  }
}
