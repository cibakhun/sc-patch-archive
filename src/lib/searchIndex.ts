// Build-time Suchindex über die Datenschicht — EINMAL PRO SPRACHE gebaut.
//
// Vorher gab es genau einen Index (deutscher Inhalt, präfixlose URLs). Seit
// Englisch die Standardsprache ist, war das doppelt falsch: die englische
// Seite suchte auf deutschen Texten ("Mehrzweck · Groß"), und die deutschen
// Seiten schickten Treffer auf die (jetzt englischen) Wurzel-URLs.
//
// Jetzt: /search-index.json (EN, Wurzel = Standardsprache) und
// /de/search-index.json (DE, URLs mit /de-Präfix). Beide Endpunkte sind dünne
// Wrapper um diesen Builder; das Overlay lädt den Index seiner Seite über das
// data-index-Attribut. Übersetzt wird nichts Neues — der Builder nutzt die
// vorhandenen Resolver (mergePatchEn/eraLabel für Patches, vType/vSize/vFoci
// für Fahrzeuge) und href() für die URLs.
//
// Eintrag (kurze Keys, ~35 KB): k = kind (stabiler Schlüssel, Anzeige-Label
// mappt das Overlay über data-k-*), b = badge, t = title, s = snippet,
// u = url, x = extra keywords.
import { getCollection } from 'astro:content';
import { href, useTranslations, type Locale } from '../i18n/ui';
import { mergePatchEn, eraLabel } from '../i18n/patchText';
import { vType, vSize, vFoci } from '../i18n/vehicleText';
import { missions, repSummary, uec } from './missions';

export type SearchEntry = { k: string; b: string; t: string; s: string; u: string; x: string };

export async function buildSearchIndex(lang: Locale): Promise<SearchEntry[]> {
  const t = useTranslations(lang);
  const patches = (await getCollection('patches')).sort((a, b) =>
    a.data.date.localeCompare(b.data.date)
  );

  const out: SearchEntry[] = [];

  for (const p of patches) {
    const d = mergePatchEn(p.id, p.data, lang);
    const purl = href(`/patches/sc-${p.id}.html`, lang);
    out.push({
      k: 'patch',
      b: `Alpha ${d.version}`,
      t: `Alpha ${d.version} — ${d.codename}`,
      s: d.tagline,
      u: purl,
      x: [eraLabel(d.era, lang), d.dateDisplay, d.wipe ?? '', d.fixesNote ?? ''].join(' ').trim(),
    });
    for (const tp of d.topics)
      out.push({
        k: 'thema',
        b: `Alpha ${d.version}`,
        t: tp.title,
        s: (d.features.find((f) => f.topicSlug === tp.slug)?.desc ?? d.tagline).slice(0, 140),
        u: href(`/topics/${tp.slug}.html`, lang),
        x: d.codename,
      });
    // features without their own deep-dive page (those are covered by topics)
    for (const f of d.features.filter((f) => !f.topicSlug))
      out.push({
        k: 'feature',
        b: `Alpha ${d.version}`,
        t: f.name,
        s: f.desc.slice(0, 140),
        u: `${purl}#dossier`,
        x: f.system ?? '',
      });
    for (const e of d.events)
      out.push({
        k: 'event',
        b: `Alpha ${d.version}`,
        t: e.name,
        s: e.desc.slice(0, 140),
        u: `${purl}#dossier`,
        x: '',
      });
  }

  // full vehicle catalog (wiki-API snapshot) — canonical ship entries
  const vehicles = await getCollection('vehicles');
  for (const v of vehicles)
    out.push({
      k: 'schiff',
      b: v.data.manufacturer ?? v.data.makerCode ?? t('search.kind.schiff'),
      t: v.data.name,
      s: [v.data.manufacturer, vType(v.data, lang), vSize(v.data, lang)]
        .filter(Boolean)
        .join(' · '),
      u: href(`/schiffe/${v.id}.html`, lang),
      x: [...vFoci(v.data, lang), ...v.data.patches.map((p) => `alpha ${p}`)].join(' '),
    });

  // mission families (DataCore snapshot) — one entry per mission, not per offer.
  // Titel/Typen/Geber sind Spieldaten (englisch) und in beiden Sprachen
  // identisch; lokalisiert werden Zahlenformat und Ziel-URL.
  for (const m of missions) {
    const rep = repSummary(m)[0];
    // Platzhalter ohne Klammern indizieren: gesucht wird nach "Rank", nicht "{Rank}"
    const title = m.title.replace(/\{([^}]*)\}/g, '$1');
    out.push({
      k: 'mission',
      b: m.typeNames[0] ?? 'Mission',
      t: title,
      s: [
        m.rewardMax ? `${uec(m.rewardMax, lang)} aUEC` : null,
        rep?.factionName ?? null,
        m.count > 1 ? `${m.count}×` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      u: href(`/missionen/${m.slug}.html`, lang),
      x: [...m.giverNames, ...m.factionNames, ...m.localityNames, ...m.typeNames]
        .join(' ')
        .slice(0, 160),
    });
  }

  return out;
}
