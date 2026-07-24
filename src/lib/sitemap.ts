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

export interface Entry {
  loc: string;
  mod?: string;
  alt?: { de: string; en: string };
}

export const BASE = SITE.url.replace(/\/$/, '');

/** DE-Pendant eines EN-Pfads (spiegelt i18n/pathForLocale, ohne Import-Zyklus). */
export function toDe(enUrl: string): string {
  return enUrl === '/index.html' ? '/de.html' : '/de' + enUrl;
}

/** '/index.html' -> '/': die Startseite traegt canonical '/'. */
const abs = (p: string) => BASE + (p === '/index.html' ? '/' : p);

/** EN-Seite + DE-Pendant als verknuepftes Paar. */
function pair(en: string, mod?: string): Entry[] {
  const alt = { de: toDe(en), en };
  return [
    { loc: en, mod, alt },
    { loc: alt.de, mod, alt },
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
  if (rel === 'de/index') return '/de.html'; // DE-Startseite (format:'file')
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
  setMod(craftHubPath, craftDb.snapshot_date);
  setMod('/missionen.html', missionsDb.meta.generated);
  for (const p of patches) {
    setMod(`/patches/sc-${p.id}.html`, p.data.date);
    for (const t of p.data.topics) setMod(`/topics/${t.slug}.html`, p.data.date);
  }

  const enUrls: string[] = [];
  const deSet = new Set<string>();
  for (const file of Object.keys(PAGE_FILES)) {
    const url = fileToUrl(file);
    if (!url) continue;
    if (url === '/de.html' || url.startsWith('/de/')) deSet.add(url);
    else enUrls.push(url);
  }

  const out: Entry[] = [];
  const emitted = new Set<string>();
  for (const en of enUrls) {
    if (emitted.has(en)) continue;
    const de = toDe(en);
    const alt = deSet.has(de) ? { de, en } : undefined;
    out.push({ loc: en, mod: lastmod.get(en), alt });
    emitted.add(en);
    if (alt && !emitted.has(de)) {
      out.push({ loc: de, mod: lastmod.get(en), alt });
      emitted.add(de);
    }
  }
  // Etwaige DE-Seiten ohne EN-Pendant der Vollstaendigkeit halber allein listen.
  for (const de of deSet) {
    if (emitted.has(de)) continue;
    out.push({ loc: de });
    emitted.add(de);
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

const altXml = (a?: { de: string; en: string }) =>
  a
    ? `<xhtml:link rel="alternate" hreflang="de" href="${abs(a.de)}"/>` +
      `<xhtml:link rel="alternate" hreflang="en" href="${abs(a.en)}"/>` +
      `<xhtml:link rel="alternate" hreflang="x-default" href="${abs(a.en)}"/>`
    : '';

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
