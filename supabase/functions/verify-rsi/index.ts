// Supabase Edge Function 'verify-rsi' — die EINZIGE serverseitige Komponente
// der RSI-Verifizierung.
//
// Warum Edge Function: verse-base.com ist eine statische Site (Astro-Build in
// Docker, ausgeliefert per nginx auf Coolify; Cloudflare macht nur DNS/Proxy/
// TLS davor). Serverseitiger Code kann nur hier laufen, analog zu
// 'delete-account' und 'register'. Browser-Aufrufe auf robertsspaceindustries.com
// blockiert dort Cloudflare (CORS/Bot-Schutz), daher der Abruf von hier aus.
//
// Die Logik steht in handler.js (reines JavaScript, ohne Deno-Abhaengigkeit,
// geprueft von tests/e2e/verify-rsi.test.js). Diese Datei reicht nur Umgebung,
// fetch und Log hinein. Keine Fremdbibliothek: Sitzung und RPCs laufen ueber
// fetch gegen /auth/v1 und /rest/v1, wie supabase-js es auch taete.
//
// Aufrufe (supabase.functions.invoke haengt das Session-JWT an; das Gateway
// verlangt es, verify_jwt = true ist der Standard, siehe supabase/config.toml):
//   { action: 'challenge', rsi_handle }  -> { rsi_handle, code, confirmed, expires_at }
//   { action: 'verify', rsi_handle? }    -> { verified, persisted, rsi_handle, revoked?, cached? }
//   { rsi_handle, rsi_code }             -> altes Dashboard (main bis zum naechsten
//                                           Release), siehe RSI_LEGACY_FLOW
//
// Datenbank: Migration 20261030120000_rsi_challenge.sql (private.rsi_challenges,
// private.rsi_attempts, public.rsi_rate_ok/rsi_challenge_issue/rsi_challenge_get/
// rsi_challenge_result, nur service_role). Sie muss VOR diesem Deploy live sein,
// sonst antwortet jede Anfrage mit 500 (Abzeichen nimmt die Function dabei keine).
//
// DEPLOY-HINWEIS
//   * Dateien: index.ts und handler.js (beide!), Einstieg index.ts,
//     verify_jwt = true (wie live v5; die Function steht bewusst nicht in
//     supabase/config.toml).
//   * Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY stellt
//     Supabase selbst. RSI_LEGACY_FLOW=1 setzen, solange main noch das alte
//     Dashboard ausliefert (Code aus dem Browser); entfernen, sobald main das
//     neue Dashboard hat. Ohne den Schalter bekommt das alte Dashboard bei einer
//     ERSTpruefung 409 und zeigt "Server nicht erreichbar"; Nachpruefungen
//     schon verifizierter Konten laufen in beiden Faellen.

import { createHandler } from './handler.js';

Deno.serve(
  createHandler({
    env: (name: string) => Deno.env.get(name),
    fetch: (input: string, init?: RequestInit) => fetch(input, init),
    log: (...args: unknown[]) => console.error(...args),
  }),
);
