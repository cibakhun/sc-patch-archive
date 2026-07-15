// Dynamic sitemap over the whole archive — DE + EN, with hreflang alternates.
//
// URLs werden aus den TATSÄCHLICHEN Seiten-Dateien entdeckt (import.meta.glob),
// nicht mehr aus einer Teil-Liste. So landen neue Seiten (Tools wie item-finder,
// downloads, feedback UND ihre DE-Pendants unter /de/) automatisch in der
// Sitemap, ohne diese Datei anzufassen. Einzige dynamische Route ist das
// Schiffs-Datenblatt (/schiffe/[slug]); dessen URLs kommen aus dem Vehicles-
// Snapshot (EN, präfixlos) bzw. der /de/-Spiegelroute (DE).
//
// hreflang: für jede Seite mit Übersetzungs-Pendant geben wir <xhtml:link
// rel="alternate">-Paare (de, en, x-default) aus — das Sitemap-Signal, das
// Google für zweisprachige Sites bevorzugt. Seiten ohne Pendant werden allein
// gelistet (kein Alternate -> keine beworbene 404-URL).
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE } from '../consts';
import vehiclesSnapshot from '../data/vehicles.json';
import { db as missionsDb, missions } from '../lib/missions';

// Alle statischen Seiten-Dateien. Dynamische [slug]-Routen und 404 werden in
// fileToUrl() ausgefiltert; .ts-Endpunkte (diese Datei, robots, search-index)
// matchen den .astro-Glob ohnehin nicht.
const PAGE_FILES = import.meta.glob('./**/*.astro');

/** Datei-Glob-Key -> ausgelieferte URL (build.format:'file'); null = überspringen. */
function fileToUrl(file: string): string | null {
  if (file.includes('[')) return null; // dynamische Route -> via Collection
  const rel = file.replace(/^\.\//, '').replace(/\.astro$/, '');
  if (rel === '404') return null; // noindex, gehört nicht in die Sitemap
  if (rel === 'index') return '/index.html'; // EN-Startseite (Standardsprache)
  if (rel === 'de/index') return '/de.html'; // DE-Startseite (format:'file')
  return '/' + rel + '.html';
}

/** DE-Pendant eines EN-Pfads (spiegelt i18n/pathForLocale, ohne Import-Zyklus). */
function toDe(enUrl: string): string {
  return enUrl === '/index.html' ? '/de.html' : '/de' + enUrl;
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
  setMod('/missionen.html', missionsDb.meta.generated);
  for (const m of missions) setMod(`/missionen/${m.slug}.html`, missionsDb.meta.generated);

  // --- URL-Inventar: statische Seiten aus den Globs + dynamische Schiffe ---
  const enUrls: string[] = [];
  const deSet = new Set<string>(); // existierende DE-URLs (für hreflang-Pairing)
  for (const file of Object.keys(PAGE_FILES)) {
    const url = fileToUrl(file);
    if (!url) continue;
    if (url === '/de.html' || url.startsWith('/de/')) deSet.add(url);
    else enUrls.push(url);
  }
  for (const v of vehicles) {
    enUrls.push(`/schiffe/${v.id}.html`);
    deSet.add(`/de/schiffe/${v.id}.html`);
  }
  // Missions-Detailseiten sind ebenfalls [slug]-Routen und fallen deshalb aus
  // dem PAGE_FILES-Glob — hier von Hand nachziehen (wie bei den Schiffen).
  for (const m of missions) {
    enUrls.push(`/missionen/${m.slug}.html`);
    deSet.add(`/de/missionen/${m.slug}.html`);
  }

  // --- Einträge bauen: EN mit Alternates, DE direkt dahinter --------------
  type Entry = { loc: string; mod?: string; alt?: { de: string; en: string } };
  const entries: Entry[] = [];
  const emitted = new Set<string>();
  for (const en of enUrls) {
    if (emitted.has(en)) continue;
    const de = toDe(en);
    const alt = deSet.has(de) ? { de, en } : undefined;
    entries.push({ loc: en, mod: lastmod.get(en), alt });
    emitted.add(en);
    if (alt && !emitted.has(de)) {
      entries.push({ loc: de, mod: lastmod.get(en), alt });
      emitted.add(de);
    }
  }
  // Etwaige DE-Seiten ohne EN-Pendant der Vollständigkeit halber allein listen.
  for (const de of deSet) {
    if (emitted.has(de)) continue;
    entries.push({ loc: de });
    emitted.add(de);
  }

  // '/index.html' -> '/': die Startseite trägt canonical '/'; loc und hreflang
  // müssen dieselbe URL nennen, sonst widersprechen sich die Signale.
  const abs = (p: string) => base + (p === '/index.html' ? '/' : p);
  const altXml = (a?: { de: string; en: string }) =>
    a
      ? `<xhtml:link rel="alternate" hreflang="de" href="${abs(a.de)}"/>` +
        `<xhtml:link rel="alternate" hreflang="en" href="${abs(a.en)}"/>` +
        `<xhtml:link rel="alternate" hreflang="x-default" href="${abs(a.en)}"/>`
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
