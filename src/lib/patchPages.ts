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

/**
 * Patch-Label aus der Kennung einer Datendatei, in jeder ihrer Formen:
 * "4.10.2-live.12881860", "PUBLIC-4.10.2-12881860", "sc-alpha-4.10.2@12881860"
 * -> "4.10".
 *
 * ANLASS (03.11.2026): Mining-Datenbank und Wikelo nannten in Titel und
 * Vorschau "Star Citizen 4.9" bzw. "4.1", der Item Finder "Patch 4.9" —
 * von Hand geschriebene Literale, waehrend alle Daten auf 4.10.2 standen.
 * Ein Datenlauf hebt die Datei, nicht das Literal. Deshalb gibt es hier
 * bewusst KEIN Rueckfall-Literal: fehlt die Fassung, bricht der Bau laut ab,
 * statt still einen alten Stand zu behaupten. (verify:datastand sichert
 * ohnehin zu, dass jede Kennung vorhanden ist; verify:patch-angaben prueft,
 * was die gebauten Seiten daraus machen.)
 */
export function patchFromKennung(kennung: string | null | undefined): string {
  const m = /(\d+)\.(\d+)\.\d+/.exec(kennung ?? '');
  if (!m) throw new Error(`patchFromKennung: Kennung "${kennung}" traegt keine Fassung X.Y.Z`);
  return `${m[1]}.${m[2]}`;
}

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
