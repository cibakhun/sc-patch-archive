// Dynamic sitemap over the whole archive — DE + EN, with hreflang alternates.
//
// URLs werden aus den TATSÄCHLICHEN Seiten-Dateien entdeckt (import.meta.glob),
// nicht mehr aus einer Teil-Liste. So landen neue Seiten (Tools wie item-finder,
// downloads, feedback UND ihre EN-Pendants unter /en/) automatisch in der
// Sitemap, ohne diese Datei anzufassen. Einzige dynamische Route ist das
// Schiffs-Datenblatt (/schiffe/[slug]); dessen URLs kommen aus dem Vehicles-
// Snapshot (DE) bzw. der /en/-Spiegelroute (EN).
//
// hreflang: für jede Seite mit Übersetzungs-Pendant geben wir <xhtml:link
// rel="alternate">-Paare (de, en, x-default) aus — das Sitemap-Signal, das
// Google für zweisprachige Sites bevorzugt. Seiten ohne Pendant werden allein
// gelistet (kein Alternate -> keine beworbene 404-URL).
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE } from '../consts';
import vehiclesSnapshot from '../data/vehicles.json';

// Alle statischen Seiten-Dateien. Dynamische [slug]-Routen und 404 werden in
// fileToUrl() ausgefiltert; .ts-Endpunkte (diese Datei, robots, search-index)
// matchen den .astro-Glob ohnehin nicht.
const PAGE_FILES = import.meta.glob('./**/*.astro');

/** Datei-Glob-Key -> ausgelieferte URL (build.format:'file'); null = überspringen. */
function fileToUrl(file: string): string | null {
  if (file.includes('[')) return null; // dynamische Route -> via Collection
  const rel = file.replace(/^\.\//, '').replace(/\.astro$/, '');
  if (rel === '404') return null; // noindex, gehört nicht in die Sitemap
  if (rel === 'index') return '/index.html'; // DE-Startseite
  if (rel === 'en/index') return '/en.html'; // EN-Startseite (format:'file')
  return '/' + rel + '.html';
}

/** EN-Pendant eines DE-Pfads (spiegelt i18n/pathForLocale, ohne Import-Zyklus). */
function toEn(deUrl: string): string {
  return deUrl === '/index.html' ? '/en.html' : '/en' + deUrl;
}

export const GET: APIRoute = async () => {
  const base = SITE.url.replace(/\/$/, '');
  const patches = await getCollection('patches');
  const vehicles = await getCollection('vehicles');

  // --- lastmod je DE-Pfad (EN erbt das Datum des Pendants) ----------------
  const latestPatch = patches.map((p) => p.data.date).sort().at(-1);
  const lastmod = new Map<string, string>();
  const setMod = (p: string, d?: string) => {
    if (d) lastmod.set(p, d);
  };
  setMod('/index.html', latestPatch);
  setMod('/archiv.html', latestPatch);
  setMod('/evolution.html', latestPatch);
  setMod('/schiffe.html', vehiclesSnapshot.fetchedAt);
  for (const p of patches) {
    setMod(`/patches/sc-${p.id}.html`, p.data.date);
    for (const t of p.data.topics) setMod(`/topics/${t.slug}.html`, p.data.date);
  }
  for (const v of vehicles) setMod(`/schiffe/${v.id}.html`, vehiclesSnapshot.fetchedAt);

  // --- URL-Inventar: statische Seiten aus den Globs + dynamische Schiffe ---
  const deUrls: string[] = [];
  const enSet = new Set<string>(); // existierende EN-URLs (für hreflang-Pairing)
  for (const file of Object.keys(PAGE_FILES)) {
    const url = fileToUrl(file);
    if (!url) continue;
    if (url === '/en.html' || url.startsWith('/en/')) enSet.add(url);
    else deUrls.push(url);
  }
  for (const v of vehicles) {
    deUrls.push(`/schiffe/${v.id}.html`);
    enSet.add(`/en/schiffe/${v.id}.html`);
  }

  // --- Einträge bauen: DE mit Alternates, EN direkt dahinter --------------
  type Entry = { loc: string; mod?: string; alt?: { de: string; en: string } };
  const entries: Entry[] = [];
  const emitted = new Set<string>();
  for (const de of deUrls) {
    if (emitted.has(de)) continue;
    const en = toEn(de);
    const alt = enSet.has(en) ? { de, en } : undefined;
    entries.push({ loc: de, mod: lastmod.get(de), alt });
    emitted.add(de);
    if (alt && !emitted.has(en)) {
      entries.push({ loc: en, mod: lastmod.get(de), alt });
      emitted.add(en);
    }
  }
  // Etwaige EN-Seiten ohne DE-Pendant der Vollständigkeit halber allein listen.
  for (const en of enSet) {
    if (emitted.has(en)) continue;
    entries.push({ loc: en });
    emitted.add(en);
  }

  const abs = (p: string) => base + p;
  const altXml = (a?: { de: string; en: string }) =>
    a
      ? `<xhtml:link rel="alternate" hreflang="de" href="${abs(a.de)}"/>` +
        `<xhtml:link rel="alternate" hreflang="en" href="${abs(a.en)}"/>` +
        `<xhtml:link rel="alternate" hreflang="x-default" href="${abs(a.de)}"/>`
      : '';

  const xml =
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
    `\n</urlset>\n`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
