/* ============================================================
   supabase-ziel.mjs — welches Supabase-Projekt ein Bau anspricht.

   Die EINE Tabelle fuer Projekt-Ref und Publishable Key. Ein Bau mit
   STAGING=1 spricht das Ziel "vorschau" an, jeder andere "live" — derselbe
   Schalter, der schon Hangar, noindex und das Tor entscheidet.

   Gelesen von:
     astro.config.mjs              Vite-define __VB_SUPABASE__ -> src/consts.ts,
                                   damit Seiten UND Client-Bundles dasselbe
                                   Ziel sehen (process.env gibt es im Browser
                                   nicht; Vorbild __VB_HANGAR__)
     scripts/_sync-assets.mjs      Kopf von public/assets/account-lite.js
     scripts/_write-build-stamp.mjs dist/build.json traegt das Ziel
     scripts/_write-csp-hashes.mjs dist/_csp/supabase*.conf -> nginx-CSP
     scripts/verify-supabase-ziel.mjs, scripts/audit-csp.mjs (Tore)

   STAND 04.11.2026: beide Ziele zeigen auf dasselbe Projekt verse-base.
   Das ist Phase 3 des Plans "Supabase-Trennung Staging/Production": der
   Bau KANN ab jetzt je Ziel ein anderes Projekt ansprechen, tut es aber
   noch nicht — an der ausgelieferten Seite aendert sich nichts. Erst wenn
   das Vorschau-Projekt steht, das Schema dort eingespielt ist und Discord-
   Login, Bot und Stripe-Testmodus dafuer eingerichtet sind (Phasen 4 bis 6),
   kommen hier dessen Ref und Key unter `vorschau` hin. Vorher umgestellt,
   meldet sich auf staging niemand mehr an.

   Der Publishable Key ist OEFFENTLICH (dafuer gemacht, im Browser zu
   stehen); Daten schuetzt Row Level Security. Ein geheimer Schluessel
   (Secret- oder Service-Key) gehoert NIE hierher — tests/e2e/config.test.js
   und verify:supabase-ziel reissen dann.

   Kein Netz, kein git, kein Kindprozess.
   ============================================================ */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const SUPABASE_ZIELE = Object.freeze({
  live: Object.freeze({
    ref: 'trgjhmbnodoarnfmlcqx',
    publishableKey: 'sb_publishable_AN3O0va6kEsCmHr6zDcwRQ_8sT68W3J',
  }),
  // Phase 4: Ref und Key des eigenen Vorschau-Projekts. Bis dahin bewusst
  // gleich live (siehe Kopf).
  vorschau: Object.freeze({
    ref: 'trgjhmbnodoarnfmlcqx',
    publishableKey: 'sb_publishable_AN3O0va6kEsCmHr6zDcwRQ_8sT68W3J',
  }),
});

/** Projekt-Refs sind 20 Kleinbuchstaben/Ziffern (so vergibt Supabase sie). */
export const REF_MUSTER = /^[a-z0-9]{20}$/;

/** Name des Ziels fuer eine Umgebung: STAGING=1 -> "vorschau", sonst "live". */
export const zielName = (env = process.env) => (env?.STAGING === '1' ? 'vorschau' : 'live');

/**
 * Vollstaendiges Ziel: Name, Ref, URL, Publishable Key und der
 * localStorage-Schluessel der supabase-js-Sitzung (an den Ref gebunden).
 */
export function supabaseZiel(name) {
  const z = Object.hasOwn(SUPABASE_ZIELE, name) ? SUPABASE_ZIELE[name] : null;
  if (!z) throw new Error(`Supabase-Ziel "${name}" unbekannt (bekannt: ${Object.keys(SUPABASE_ZIELE).join(', ')})`);
  if (!REF_MUSTER.test(z.ref)) throw new Error(`Supabase-Ziel "${name}": Ref "${z.ref}" hat nicht die Form von 20 Kleinbuchstaben/Ziffern`);
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(z.publishableKey))
    throw new Error(`Supabase-Ziel "${name}": publishableKey ist kein Publishable Key (sb_publishable_…)`);
  return {
    ziel: name,
    ref: z.ref,
    url: `https://${z.ref}.supabase.co`,
    publishableKey: z.publishableKey,
    storageKey: `sb-${z.ref}-auth-token`,
  };
}

/** Das Ziel, das ein Bau in dieser Umgebung anspricht. */
export const zielImBau = (env = process.env) => supabaseZiel(zielName(env));

/**
 * Das Ziel, das ein fertiges dist/ laut seinem Stempel (dist/build.json)
 * anspricht — gegen das Artefakt, nicht gegen die Umgebung des Prueflaufs.
 * null, wenn der Stempel fehlt oder kein Ziel nennt.
 */
export function zielImArtefakt(distDir = 'dist') {
  const p = join(distDir, 'build.json');
  if (!existsSync(p)) return null;
  let stempel;
  try { stempel = JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
  const s = stempel?.supabase;
  if (!s || typeof s.ziel !== 'string' || typeof s.ref !== 'string') return null;
  return { ziel: s.ziel, ref: s.ref, staging: stempel.staging === true };
}

/* ---------- Kopf von account-lite.js ---------- */
// assets/account-lite.js ist bewusst SDK- und importfrei und laeuft auf
// jeder Seite. Sein Kopf traegt die drei Werte als Literale (Quelle: live);
// _sync-assets.mjs setzt beim Kopieren nach public/assets das Ziel des
// Baus ein. Jede Zeile muss GENAU einmal vorkommen — sonst reisst der Bau,
// statt still ein halb umgestelltes Skript auszuliefern.
export const LITE_ZEILEN = [
  ['SB_URL', (z) => z.url],
  ['SB_KEY', (z) => z.publishableKey],
  ['STORE', (z) => z.storageKey],
];

/** account-lite.js-Quelltext mit den Werten von `ziel`. Wirft bei Abweichung. */
export function liteMitZiel(quelltext, ziel) {
  let out = quelltext;
  for (const [name, wert] of LITE_ZEILEN) {
    // \r? : unter Windows checkt git die Datei mit CRLF aus.
    const re = new RegExp(`^([ \\t]*var ${name} = )'[^'\\r\\n]*';(\\r?)$`, 'gm');
    const treffer = out.match(re) ?? [];
    if (treffer.length !== 1)
      throw new Error(`account-lite.js: "var ${name} = '…';" steht ${treffer.length}× im Kopf, erwartet genau 1×`);
    out = out.replace(re, (_, kopf, cr) => `${kopf}'${wert(ziel)}';${cr}`);
  }
  return out;
}

/* ---------- Supabase-Host in der CSP ---------- */
// Die Kopfzeile in nginx/default.conf nennt den Host nicht woertlich, sondern
// ueber zwei Maps, die wie die Inline-Hashes eine Datei aus dist/_csp/ lesen.
// So passt die Richtlinie immer zu dem Projekt, das die Seiten dieses Baus
// ansprechen. https:// deckt nach CSP3 kein wss:// ab, deshalb zwei Werte
// (Realtime-Websocket des Chats).
export const CSP_SUPABASE = [
  { variable: 'vb_supabase', datei: 'supabase.conf', wert: (z) => z.url },
  { variable: 'vb_supabase_ws', datei: 'supabase-ws.conf', wert: (z) => z.url.replace(/^https:/, 'wss:') },
];
