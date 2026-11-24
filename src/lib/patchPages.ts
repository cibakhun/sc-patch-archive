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
import { HANGAR_ON } from './hangarFlag';
import { fassung } from './fassung';
import { VORSCHAU_PATCHES } from '../../scripts/lib/vorschau-patches.mjs';

const VORSCHAU_SLUGS: readonly string[] = VORSCHAU_PATCHES.map((id: string) => `sc-${id}`);

/**
 * Die Namen aller Patch-Seiten, die dieser Bau traegt, ohne Endung ("sc-4-9-0", …).
 * `import.meta.glob` wird von Vite zur Bauzeit aufgeloest — kein Dateisystem-
 * Zugriff zur Laufzeit, und der Bestand kann nicht veralten, weil er nicht
 * gepflegt, sondern gelesen wird. Seiten aus VORSCHAU_PATCHES zaehlen nur im
 * Vorschau-Bau.
 */
export const patchPageSlugs: ReadonlySet<string> = new Set([
  ...Object.keys(import.meta.glob('../pages/patches/*.astro')).map(
    (p) => p.split('/').pop()!.replace(/\.astro$/, ''),
  ),
  ...(HANGAR_ON ? VORSCHAU_SLUGS : []),
]);

/**
 * Ob dieser Bau den Patch ("4.10.3") als Patch fuehrt. Live fehlen Patches aus
 * VORSCHAU_PATCHES ganz; fuer die Sammlung erledigt das src/content.config.ts,
 * wer src/data/patches/ selbst einliest, filtert hiermit.
 */
export function patchImBestand(version: string): boolean {
  return HANGAR_ON || !VORSCHAU_PATCHES.includes(version.replace(/\./g, '-'));
}

/** Der neueste Patch, den dieser Bau fuehrt ("4.10.2"), gelesen aus den Dateinamen unter src/data/patches/. */
export const NEUESTER_PATCH: string = Object.keys(import.meta.glob('../data/patches/*.json'))
  .map((p) => p.split('/').pop()!.replace(/\.json$/, '').replace(/-/g, '.'))
  .filter(patchImBestand)
  .sort((a, b) => {
    const x = a.split('.').map(Number), y = b.split('.').map(Number);
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  })
  .at(-1)!;

/** Verweis auf die Seite eines Patches aus dem Bestand (id wie "4-10-3") — oder `null`, wenn dieser Bau sie nicht traegt. */
export function patchSeiteHref(id: string, lang: Locale): string | null {
  return patchPageSlugs.has(`sc-${id}`) ? href(`/patches/sc-${id}.html`, lang) : null;
}

/**
 * Patch-Label aus der Kennung einer Datendatei, in jeder ihrer Formen:
 * "4.10.2-live.12881860", "PUBLIC-4.10.2-12881860", "sc-alpha-4.10.2@12881860"
 * -> "4.10.2" (Krisz 15.11.2026: Titel nennen die volle Fassung des Datenstands).
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
  return fassung(kennung, 'patchFromKennung');
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

/**
 * Verweis auf die Patch-Seite der VOLLEN Fassung einer Kennung
 * ("4.10.2-live.12881860" -> sc-4-10-2, Label "Alpha 4.10.2"). Fehlt diese
 * Seite, die Hauptfassung (sc-4-10-0, Label "Alpha 4.10"); fehlt auch die,
 * `null` — Aufrufer zeigen dann nur das Label oder nichts.
 *
 * ANLASS (Bestandsaufnahme C, 06.11.2026): Item-Seiten, Item Finder und
 * Crafting nannten „Alpha 4.10" und fuehrten auf die Seite 4.10.0, waehrend
 * ihre Werte aus 4.10.2 stammen und die Seite 4.10.2 existiert.
 */
export function patchLinkFromKennung(
  kennung: string | null | undefined,
  lang: Locale,
): { version: string; label: string; href: string | null } {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(kennung ?? '');
  if (!m) throw new Error(`patchLinkFromKennung: Kennung "${kennung}" traegt keine Fassung X.Y.Z`);
  const voll = `${m[1]}.${m[2]}.${m[3]}`;
  const vollSlug = `sc-${m[1]}-${m[2]}-${m[3]}`;
  if (patchPageSlugs.has(vollSlug)) return { version: voll, label: `Alpha ${voll}`, href: href(`/patches/${vollSlug}.html`, lang) };
  if (VORSCHAU_SLUGS.includes(vollSlug)) return { version: voll, label: `Alpha ${voll}`, href: null };
  const haupt = `${m[1]}.${m[2]}`;
  return { version: haupt, label: `Alpha ${haupt}`, href: patchPageHref(haupt, lang) };
}

/**
 * Anker einer Zeile der Evolution-Matrix ("Combat & Waffen" -> "sys-combat-waffen").
 *
 * ANLASS (UX-Audit H3, 24.11.2026): die Evolution hatte einen einzigen
 * Inhaltslink, und die Patchseiten nannten das System jeder Neuerung nur als
 * Etikett. Seitdem fuehrt das Etikett im Dossier zur Zeile seines Systems.
 * Die Namen sind je Sprache verschieden (mergePatchEn), Dossier und Matrix
 * einer Sprache lesen aber dieselben — der Anker passt deshalb innerhalb
 * einer Sprache immer.
 */
export function systemAnker(system: string): string {
  const slug = system
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `sys-${slug}`;
}

/** Anker einer Zelle der Matrix: System × Patch ("sys-mining--4-1-0"). */
export const zellenAnker = (system: string, version: string): string =>
  `${systemAnker(system)}--${version.replace(/\./g, '-')}`;

/** Verweis in die Evolution auf die Zelle eines Systems in einem Patch. */
export const evolutionHref = (system: string, version: string, lang: Locale): string =>
  `${href('/evolution.html', lang)}#${zellenAnker(system, version)}`;
