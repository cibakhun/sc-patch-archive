// Verweis auf die Patch-Seite eines Datenstands — aber nur, wenn es sie GIBT.
//
// ANLASS (27.08.2026, 4.10-Datenlauf): zwei Stellen leiteten ihr Patch-Label
// aus den Daten ab und bauten daraus einen Verweis auf `/patches/sc-<x>-<y>-0.html`.
// Das Label folgt einem Datenlauf automatisch — die Patch-Seiten nicht: sie sind
// handgeschriebene .astro-Dateien unter src/pages/patches/, und die neueste ist
// sc-4-9-0.astro. Nach dem Lauf auf 4.10 zeigte der Verweis der Crafting-
// Themenseite ins Leere; `npm run verify` meldete zwei tote Verweise
// (dist/topics/crafting.html und dist/de/topics/crafting.html -> sc-4-10-0.html).
//
// Der Fehler war nicht die Ableitung, sondern die stille Annahme dahinter:
// "zu jedem Datenstand existiert eine Archivseite". Sie gilt nur, solange
// jemand die Patchseite schreibt — und das ist Inhaltsarbeit, die kein
// Datamine-Lauf miterledigt (Register id 51).
//
// Diese Schicht macht die Annahme pruefbar: sie liest den TATSAECHLICHEN
// Dateibestand und gibt `null` zurueck, wenn die Seite fehlt. Wer sie benutzt,
// muss den Fall behandeln — das Label bleibt dann stehen, nur ohne Verweis.

import type { Locale } from '../i18n/ui';
import { href } from '../i18n/ui';

/**
 * Die Namen aller vorhandenen Patch-Seiten, ohne Endung ("sc-4-9-0", …).
 * `import.meta.glob` wird von Vite zur Bauzeit aufgeloest — kein Dateisystem-
 * Zugriff zur Laufzeit, und der Bestand kann nicht veralten, weil er nicht
 * gepflegt, sondern gelesen wird.
 */
export const patchPageSlugs: ReadonlySet<string> = new Set(
  Object.keys(import.meta.glob('../pages/patches/*.astro')).map(
    (p) => p.split('/').pop()!.replace(/\.astro$/, ''),
  ),
);

/** "4.10" -> "sc-4-10-0" */
export const patchPageSlug = (patch: string) => `sc-${patch.replace(/\./g, '-')}-0`;

/**
 * Verweis auf die Patch-Seite — oder `null`, wenn es sie nicht gibt.
 * Aufrufer rendern das Label dann als reinen Text.
 */
export function patchPageHref(patch: string, lang: Locale): string | null {
  const slug = patchPageSlug(patch);
  return patchPageSlugs.has(slug) ? href(`/patches/${slug}.html`, lang) : null;
}
