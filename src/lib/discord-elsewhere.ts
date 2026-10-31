// Anderes Discord-Konto, ohne sich bei Discord abzumelden (31.10.2026).
//
// Discord nimmt beim Anmelden immer das Konto, das in DIESEM Browser bei
// discord.com angemeldet ist. Eine Kontoauswahl lässt sich von außen nicht
// erzwingen (Discord kennt nur prompt=consent|none). Wer zwei Konten hat und
// das angemeldete nicht abmelden kann (Arbeitskonto mit Sperren), kam bisher
// nicht mit dem anderen herein. Ein privates Fenster hat keine
// Discord-Anmeldung, dort fragt Discord nach Name und Passwort.
//
// Der Weg:
//  1. Im ersten Fenster entsteht die Anmeldung wie sonst (PKCE). Der
//     Verifier bleibt in DIESEM Browser, nur der Link geht ins private
//     Fenster.
//  2. Dort meldet man sich bei Discord mit dem anderen Konto an. Der
//     Rücksprung landet im privaten Fenster und kann den code nicht einlösen
//     (kein Verifier). Die Seite zeigt ihn als Rücklink zum Kopieren.
//  3. Zurück im ersten Fenster: einfügen. Die Seite prüft, dass der Link auf
//     sie selbst zeigt, und öffnet ihn. Dort löst der Verifier den code ein,
//     und man ist im ersten Fenster mit dem anderen Discord-Konto
//     angemeldet. Das bisherige bleibt überall angemeldet.
// Der code allein ist wertlos: ohne den Verifier aus Schritt 1 löst ihn
// niemand ein, auch nicht, wer den Rücklink sieht.
//
// gate.astro (bundlerfrei) trägt dieselben Regeln als Kopie;
// tests/e2e/discord-elsewhere.test.js hält beide gleich.

/** Was ein Rücksprung als code trägt (GoTrue: UUID). */
export const CODE_RE = /^[A-Za-z0-9-]{1,128}$/;
/** Kennung einer Anmeldung der Torseite (gate.astro, FLOW_RE). */
export const FLOW_RE = /^[A-Za-z0-9_-]{16}$/;

/**
 * Rücklink fürs erste Fenster: dieselbe Seite, nur next, f und code.
 * '' ohne brauchbaren code oder mit kaputter Kennung.
 */
export function returnLink(href: string): string {
  let u: URL;
  try { u = new URL(href); } catch { return ''; }
  const code = u.searchParams.get('code') || '';
  if (!CODE_RE.test(code)) return '';
  const f = u.searchParams.get('f');
  if (f !== null && !FLOW_RE.test(f)) return '';
  const q = new URLSearchParams();
  for (const k of ['next', 'f', 'code']) {
    const v = u.searchParams.get(k);
    if (v !== null) q.set(k, v);
  }
  return u.origin + u.pathname + '?' + q.toString();
}

/**
 * Eingefügter Text -> relative Adresse dieser Seite zum Öffnen, oder ''
 * (nicht unser Rücklink: andere Seite, anderer Ursprung, kein code).
 */
export function acceptReturn(text: string, here: string): string {
  const t = String(text || '').trim();
  if (!t || t.length > 2048 || /\s/.test(t)) return '';
  let u: URL;
  let h: URL;
  try { u = new URL(t); h = new URL(here); } catch { return ''; }
  if (u.origin !== h.origin || u.pathname !== h.pathname) return '';
  const back = returnLink(u.href);
  return back ? back.slice(u.origin.length) : '';
}

const touch = (ua: string) => /Android|iPhone|iPad|Mobile/i.test(ua);
const mac = (ua: string) => /Macintosh|Mac OS X/.test(ua) && !touch(ua);

/** Tasten fürs private Fenster in diesem Browser; leer auf Telefon und Tablet. */
export function privateKeys(ua: string, lang: 'de' | 'en'): string[] {
  if (touch(ua)) return [];
  const m = mac(ua);
  return [m ? '⌘' : lang === 'de' ? 'Strg' : 'Ctrl', m || lang === 'de' ? '⇧' : 'Shift', /Firefox\//.test(ua) ? 'P' : 'N'];
}

/** Tasten zum Einfügen; leer auf Telefon und Tablet. */
export function pasteKeys(ua: string, lang: 'de' | 'en'): string[] {
  if (touch(ua)) return [];
  return [mac(ua) ? '⌘' : lang === 'de' ? 'Strg' : 'Ctrl', 'V'];
}
