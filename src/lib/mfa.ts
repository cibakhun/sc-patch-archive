// Zweiter Faktor (TOTP, Authenticator-App) fuer Supabase-Sitzungen.
//
// Gemeinsame Helfer fuer die Anmeldeseite, das Konto und "Passwort
// zuruecksetzen". Supabase traegt die Stufe einer Sitzung als Claim `aal` in
// das signierte JWT: 'aal1' nach Passwort, Discord oder Mail-Link, 'aal2'
// nach dem Code. Hat ein Konto einen bestaetigten Faktor, verlangt die Seite
// den Code nach jeder Anmeldung; die Datenbank verlangt aal2 fuer die
// Admin-Rechte (supabase/migrations/20261030142000_admin_second_factor.sql).
//
// Bewusst ohne Laufzeit-Importe (nur Typen): tests/e2e/mfa.test.js laedt
// diese Datei direkt und reicht einen nachgebauten Client herein.
import type { SupabaseClient } from '@supabase/supabase-js';

type Client = Pick<SupabaseClient, 'auth'>;

export interface TotpFactor {
  id: string;
  friendly_name?: string | null;
  created_at?: string;
  status?: string;
}

/** Ergebnis eines Code-Versuchs. */
export type CodeResult = 'ok' | 'wrong' | 'rate' | 'none' | 'error';

/** Aussteller im Authenticator: "VerseBase (adresse@…)". */
export const MFA_ISSUER = 'VerseBase';

/** Sechs Ziffern aus einer Eingabe; Leerzeichen und Bindestriche duerfen dazwischen stehen. */
export function normalizeCode(raw: string): string | null {
  const d = String(raw || '').replace(/[\s-]/g, '');
  return /^\d{6}$/.test(d) ? d : null;
}

const errCode = (e: unknown): string => String((e as { code?: string } | null)?.code || '');
const errStatus = (e: unknown): number => Number((e as { status?: number } | null)?.status || 0);

/** Zu viele Versuche (GoTrue-Drosselung)? */
export const isRateLimited = (e: unknown): boolean =>
  errStatus(e) === 429 || errCode(e).includes('rate_limit');

/** Verlangt GoTrue fuer diese Aktion eine Sitzung mit Code? */
export const needsAal2Error = (e: unknown): boolean => errCode(e) === 'insufficient_aal';

/**
 * Muss diese Sitzung den Code noch nachreichen? `fresh` fragt die Faktoren
 * beim Server nach (getUser) statt aus der gespeicherten Sitzung — noetig,
 * wenn der Faktor auf einem anderen Geraet eingerichtet worden sein kann.
 */
export async function needsCode(client: Client, fresh = false): Promise<boolean> {
  try {
    let jwt: string | undefined;
    if (fresh) {
      const { data } = await client.auth.getSession();
      jwt = data.session?.access_token;
      if (!jwt) return false;
    }
    const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel(jwt);
    if (error || !data) return false;
    return data.nextLevel === 'aal2' && data.currentLevel !== 'aal2';
  } catch {
    return false;
  }
}

/** Ist diese Sitzung schon mit Code angemeldet? */
export async function hasAal2(client: Client): Promise<boolean> {
  try {
    const { data } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    return !!data && data.currentLevel === 'aal2';
  } catch {
    return false;
  }
}

/** Alle TOTP-Faktoren des Kontos (bestaetigte und angefangene). */
export async function totpFactors(client: Client): Promise<{ verified: TotpFactor[]; pending: TotpFactor[] } | null> {
  try {
    const { data, error } = await client.auth.mfa.listFactors();
    if (error || !data) return null;
    const all = (data.all || []).filter((f) => f.factor_type === 'totp');
    return {
      verified: all.filter((f) => f.status === 'verified'),
      pending: all.filter((f) => f.status !== 'verified'),
    };
  } catch {
    return null;
  }
}

/**
 * Prueft den Code gegen jeden bestaetigten TOTP-Faktor, bis einer passt
 * (zwei Geraete = zwei Faktoren mit eigenem Schluessel; welches Geraet der
 * Nutzer gerade in der Hand hat, weiss die Seite nicht). Bei Erfolg hat
 * supabase-js die Sitzung schon auf aal2 gehoben und gespeichert.
 */
export async function verifyCode(client: Client, code: string): Promise<CodeResult> {
  const fs = await totpFactors(client);
  if (!fs) return 'error';
  if (!fs.verified.length) return 'none';
  let result: CodeResult = 'wrong';
  for (const f of fs.verified) {
    try {
      const { error } = await client.auth.mfa.challengeAndVerify({ factorId: f.id, code });
      if (!error) return 'ok';
      if (isRateLimited(error)) return 'rate';
      const st = errStatus(error);
      // 400/422 (mfa_verification_failed, mfa_challenge_expired …): falscher
      // Code fuer DIESEN Faktor, also den naechsten versuchen.
      if (!(st === 400 || st === 422 || errCode(error).startsWith('mfa_'))) result = 'error';
    } catch {
      result = 'error';
    }
  }
  return result;
}

/**
 * SVG des QR-Codes als Bildadresse (img-src erlaubt data:). supabase-js
 * liefert `data:image/svg+xml;utf-8,<svg …>` unkodiert; ein `#` im SVG
 * beendete die Adresse dort, darum neu kodiert. Dazu ein weisser Grund als
 * erstes Element: Kamera-Apps lesen dunkle Module auf dunklem Grund
 * (Dunkelmodus der Seite) schlecht. Als <img> fuehrt ein SVG kein Skript aus.
 */
export function qrImageSrc(qr: string): string {
  let svg = String(qr || '').replace(/^data:image\/svg\+xml[^,]*,/, '').trim();
  if (/^%3C/i.test(svg)) { try { svg = decodeURIComponent(svg); } catch { return ''; } }
  const open = /^(<\?xml[\s\S]*?\?>\s*)?<svg\b[^>]*>/.exec(svg);
  if (!open) return '';
  svg = svg.slice(0, open[0].length) + '<rect width="100%" height="100%" fill="white"/>' + svg.slice(open[0].length);
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/** Geheimnis in Vierergruppen, zum Abtippen. */
export const groupSecret = (s: string): string => String(s || '').replace(/\s+/g, '').replace(/(.{4})(?=.)/g, '$1 ');

/** Freier Name fuer einen neuen Faktor (Supabase verlangt eindeutige Namen je Konto). */
export function uniqueFactorName(wish: string, taken: Array<string | null | undefined>, fallback: string): string {
  const used = new Set(taken.map((t) => String(t || '').trim().toLowerCase()));
  const base = (String(wish || '').trim() || fallback).slice(0, 40);
  if (!used.has(base.toLowerCase())) return base;
  for (let i = 2; i < 100; i++) {
    const n = `${base.slice(0, 36)} ${i}`;
    if (!used.has(n.toLowerCase())) return n;
  }
  return `${base.slice(0, 30)} ${Date.now() % 100000}`;
}

export type EnrollStart =
  | { ok: true; id: string; qr: string; secret: string; uri: string }
  | { ok: false; reason: 'aal' | 'limit' | 'disabled' | 'rate' | 'error' };

/**
 * Neuen TOTP-Faktor anlegen. Angefangene, nie bestaetigte Faktoren werden
 * vorher entfernt (sie zaehlen sonst gegen die Hoechstzahl und blockieren
 * ihren Namen).
 */
export async function startEnroll(client: Client, wish: string, fallbackName: string): Promise<EnrollStart> {
  const fs = await totpFactors(client);
  if (!fs) return { ok: false, reason: 'error' };
  for (const f of fs.pending) {
    try { await client.auth.mfa.unenroll({ factorId: f.id }); } catch { /* bleibt liegen, Name weicht aus */ }
  }
  const name = uniqueFactorName(wish, [...fs.verified, ...fs.pending].map((f) => f.friendly_name), fallbackName);
  try {
    const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: name, issuer: MFA_ISSUER });
    if (error || !data || data.type !== 'totp') {
      const c = errCode(error);
      return {
        ok: false,
        reason: c === 'insufficient_aal' ? 'aal'
          : c === 'too_many_enrolled_mfa_factors' ? 'limit'
          : c === 'mfa_totp_enroll_not_enabled' ? 'disabled'
          : isRateLimited(error) ? 'rate' : 'error',
      };
    }
    return { ok: true, id: data.id, qr: qrImageSrc(data.totp.qr_code), secret: data.totp.secret, uri: data.totp.uri };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/** Ersten Code des neuen Faktors pruefen; danach ist er bestaetigt und die Sitzung aal2. */
export async function finishEnroll(client: Client, factorId: string, code: string): Promise<CodeResult> {
  try {
    const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code });
    if (!error) return 'ok';
    if (isRateLimited(error)) return 'rate';
    const st = errStatus(error);
    return st === 400 || st === 422 || errCode(error).startsWith('mfa_') ? 'wrong' : 'error';
  } catch {
    return 'error';
  }
}

/** Faktor entfernen. Einen bestaetigten entfernt Supabase nur aus einer aal2-Sitzung. */
export async function removeFactor(client: Client, factorId: string): Promise<'ok' | 'aal' | 'error'> {
  try {
    const { error } = await client.auth.mfa.unenroll({ factorId });
    if (!error) return 'ok';
    return needsAal2Error(error) ? 'aal' : 'error';
  } catch {
    return 'error';
  }
}
