// Sitemap-Bausteine — geteilt von /sitemap.xml (Index) und den Teil-Sitemaps.
//
// Warum aufgeteilt: mit den Item- und Blueprint-Seiten waechst das Inventar von
// ~1.600 auf ~17.000 URLs. Eine einzelne Datei waere mehrere MB gross, und die
// Search Console koennte pro Bereich nicht mehr sagen, WAS indexiert ist. Ein
// Sitemap-Index mit fuenf Teilen (Seiten, Schiffe, Missionen, Items, Crafting)
// zeigt genau das — und /sitemap.xml bleibt die eine URL in robots.txt.
//
// hreflang: jede Seite mit Uebersetzungs-Pendant traegt <xhtml:link
// rel="alternate">-Paare. Seiten ohne Pendant werden allein gelistet (kein
// Alternate -> keine beworbene 404-URL).

import { getCollection } from 'astro:content';
import { SITE } from '../consts';
import { isNoindex } from './seo';
import vehiclesSnapshot from '../data/vehicles.json';
import { db as missionsDb, missions } from './missions';
import { categories, categoryPath, db as itemsDb, itemPath, itemsHubPath, pageCount, pageItems } from './items';
import {
  blueprintPath, blueprints, craftCategories, craftCategoryPath, craftDb, craftHubPath, craftPageCount,
} from './crafting';

/** hreflang-Code -> absolute URL. Enthaelt immer alle vorhandenen Sprachen. */
export type Alt = Record<string, string>;

export interface Entry {
  loc: string;
  mod?: string;
  alt?: Alt;
}

export const BASE = SITE.url.replace(/\/$/, '');

/**
 * Pfad-Praefixe der uebersetzten Sprachen — Spiegel von i18n/ui#LOCALE_PREFIX
 * (EN ist Standardsprache und praefixlos). Bewusst dupliziert: sitemap.xml.ts
 * meidet den Import von i18n/ui (Zyklus ueber astro:content).
 */
export const TRANSLATED = [
  { lang: 'de', prefix: '/de' },
  { lang: 'hu', prefix: '/hu' },
] as const;

/** Pendant eines EN-Pfads in einer uebersetzten Sprache (spiegelt pathForLocale). */
export function toLang(enUrl: string, prefix: string): string {
  return enUrl === '/index.html' ? `${prefix}.html` : prefix + enUrl;
}

/** Rueckwaerts-kompatibler Kurzname fuer das DE-Pendant. */
export const toDe = (enUrl: string): string => toLang(enUrl, '/de');

/** '/index.html' -> '/': die Startseite traegt canonical '/'. */
const abs = (p: string) => BASE + (p === '/index.html' ? '/' : p);

/** hreflang-Karte eines EN-Pfads ueber ALLE Sprachen. */
function altFor(en: string): Alt {
  const alt: Alt = { en };
  for (const { lang, prefix } of TRANSLATED) alt[lang] = toLang(en, prefix);
  return alt;
}

/** EN-Seite + alle uebersetzten Pendants als verknuepfte Gruppe. */
function pair(en: string, mod?: string): Entry[] {
  const alt = altFor(en);
  return [
    { loc: en, mod, alt },
    ...TRANSLATED.map(({ lang }) => ({ loc: alt[lang], mod, alt })),
  ];
}

/* ---------- Teil-Inventare ---------- */

// Alle statischen Seiten-Dateien. Dynamische [slug]-Routen und 404 werden in
// fileToUrl() ausgefiltert; .ts-Endpunkte matchen den .astro-Glob ohnehin nicht.
const PAGE_FILES = import.meta.glob('../pages/**/*.astro');

/** Datei-Glob-Key -> ausgelieferte URL (build.format:'file'); null = ueberspringen. */
function fileToUrl(file: string): string | null {
  if (file.includes('[')) return null; // dynamische Route -> via Collection
  const rel = file.replace(/^\.\.\/pages\//, '').replace(/\.astro$/, '');
  if (rel === '404') return null; // noindex, gehoert nicht in die Sitemap
  if (rel === 'index') return '/index.html'; // EN-Startseite (Standardsprache)
  // Startseite einer uebersetzten Sprache: src/pages/de/index.astro -> /de.html
  // (format:'file'), NICHT /de/index.html.
  for (const { prefix } of TRANSLATED)
    if (rel === `${prefix.slice(1)}/index`) return `${prefix}.html`;
  // Unterverzeichnis-Index: src/pages/items/index.astro -> Route /items -> /items.html
  const url = rel.endsWith('/index')
    ? '/' + rel.slice(0, -'/index'.length) + '.html'
    : '/' + rel + '.html';
  // Seiten auf noindex gehoeren nicht in die Sitemap: beides zusammen meldet
  // Google als „Uebermittelte URL als ‚noindex' markiert". Layout.astro und
  // diese Liste lesen aus derselben Quelle (lib/seo#NOINDEX_PATHS), damit die
  // beiden Signale nicht auseinanderlaufen. Betrifft /account.html,
  // /refinery.html, /pilot.html und die Konto-Unterseiten.
  return isNoindex(url) ? null : url;
}

/** Redaktionelle Seiten: alles Statische aus dem Glob, mit lastmod aus den Patches. */
export async function corePages(): Promise<Entry[]> {
  const patches = await getCollection('patches');
  const latestPatch = patches.map((p) => p.data.date).sort().at(-1);

  const lastmod = new Map<string, string>();
  const setMod = (p: string, d?: string) => {
    if (d) lastmod.set(p, d);
  };
  setMod('/index.html', latestPatch);
  setMod('/archiv.html', latestPatch);
  setMod('/evolution.html', latestPatch);
  setMod('/schiffe.html', vehiclesSnapshot.fetchedAt);
  setMod('/item-finder.html', itemsDb.pricesAsOf);
  setMod(itemsHubPath, itemsDb.pricesAsOf);
  // Set-Verzeichnis haengt an den Spieldaten, nicht an den UEX-Preisen
  setMod('/armor-sets.html', itemsDb.generatedAt);
  setMod(craftHubPath, craftDb.snapshot_date);
  setMod('/missionen.html', missionsDb.meta.generated);
  for (const p of patches) {
    setMod(`/patches/sc-${p.id}.html`, p.data.date);
    for (const t of p.data.topics) setMod(`/topics/${t.slug}.html`, p.data.date);
  }

  // Seiten nach Sprache einsortieren: praefixlose gehoeren zur Standardsprache,
  // alles unter /<praefix>/… (bzw. /<praefix>.html) zur jeweiligen Uebersetzung.
  const enUrls: string[] = [];
  const byLang = new Map<string, Set<string>>(TRANSLATED.map((t) => [t.lang, new Set<string>()]));
  for (const file of Object.keys(PAGE_FILES)) {
    const url = fileToUrl(file);
    if (!url) continue;
    const owner = TRANSLATED.find(
      ({ prefix }) => url === `${prefix}.html` || url.startsWith(`${prefix}/`)
    );
    if (owner) byLang.get(owner.lang)!.add(url);
    else enUrls.push(url);
  }

  const out: Entry[] = [];
  const emitted = new Set<string>();
  for (const en of enUrls) {
    if (emitted.has(en)) continue;
    // hreflang nur fuer Sprachen, die diese Seite WIRKLICH haben — sonst
    // bewirbt die Sitemap eine 404-URL.
    const alt: Alt = { en };
    for (const { lang, prefix } of TRANSLATED) {
      const u = toLang(en, prefix);
      if (byLang.get(lang)!.has(u)) alt[lang] = u;
    }
    const hasAlt = Object.keys(alt).length > 1;
    out.push({ loc: en, mod: lastmod.get(en), alt: hasAlt ? alt : undefined });
    emitted.add(en);
    if (!hasAlt) continue;
    for (const { lang } of TRANSLATED) {
      const u = alt[lang];
      if (!u || emitted.has(u)) continue;
      out.push({ loc: u, mod: lastmod.get(en), alt });
      emitted.add(u);
    }
  }
  // Etwaige uebersetzte Seiten ohne EN-Pendant der Vollstaendigkeit halber
  // allein listen (ohne Alternates).
  for (const urls of byLang.values())
    for (const u of urls) {
      if (emitted.has(u)) continue;
      out.push({ loc: u });
      emitted.add(u);
    }
  return out;
}

export async function shipPages(): Promise<Entry[]> {
  const vehicles = await getCollection('vehicles');
  return vehicles.flatMap((v) => pair(`/schiffe/${v.id}.html`, vehiclesSnapshot.fetchedAt));
}

export function missionPages(): Entry[] {
  return missions.flatMap((m) => pair(`/missionen/${m.slug}.html`, missionsDb.meta.generated));
}

export function itemDetailPages(): Entry[] {
  const mod = itemsDb.generatedAt;
  const out = pageItems.flatMap((i) => pair(itemPath(i), mod));
  for (const c of categories)
    for (let p = 1; p <= pageCount(c); p++) out.push(...pair(categoryPath(c, p), mod));
  return out;
}

export function craftingDetailPages(): Entry[] {
  const mod = craftDb.snapshot_date;
  const out = blueprints.flatMap((b) => pair(blueprintPath(b), mod));
  for (const c of craftCategories)
    for (let p = 1; p <= craftPageCount(c); p++) out.push(...pair(craftCategoryPath(c, p), mod));
  return out;
}

/* ---------- XML ---------- */

// Reihenfolge stabil halten (alphabetisch, x-default zuletzt) — sonst rauscht
// jeder Build die Sitemap-Diffs voll.
const altXml = (a?: Alt) => {
  if (!a) return '';
  const langs = Object.keys(a).sort();
  return (
    langs.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${abs(a[l])}"/>`).join('') +
    (a.en ? `<xhtml:link rel="alternate" hreflang="x-default" href="${abs(a.en)}"/>` : '')
  );
};

export function urlsetXml(entries: Entry[]): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    entries
      .map(
        (e) =>
          `  <url><loc>${abs(e.loc)}</loc>` +
          (e.mod ? `<lastmod>${e.mod}</lastmod>` : '') +
          altXml(e.alt) +
          `</url>`
      )
      .join('\n') +
    `\n</urlset>\n`
  );
}

export function sitemapIndexXml(parts: { path: string; mod?: string }[]): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    parts
      .map(
        (p) =>
          `  <sitemap><loc>${BASE}${p.path}</loc>` +
          (p.mod ? `<lastmod>${p.mod}</lastmod>` : '') +
          `</sitemap>`
      )
      .join('\n') +
    `\n</sitemapindex>\n`
  );
}

export const XML_HEADERS = { 'Content-Type': 'application/xml; charset=utf-8' };
