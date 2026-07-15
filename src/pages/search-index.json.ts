// Build-time search index over the data layer — served as a static JSON the
// Ctrl+K overlay lazy-loads on first open. Entry shape (short keys, ~35 KB):
// k = kind, b = badge, t = title, s = snippet, u = url, x = extra keywords
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { missions, repSummary } from '../lib/missions';

export const GET: APIRoute = async () => {
  const patches = (await getCollection('patches')).sort((a, b) =>
    a.data.date.localeCompare(b.data.date)
  );

  type Entry = { k: string; b: string; t: string; s: string; u: string; x: string };
  const out: Entry[] = [];

  for (const p of patches) {
    const d = p.data;
    const purl = `/patches/sc-${p.id}.html`;
    out.push({
      k: 'patch',
      b: `Alpha ${d.version}`,
      t: `Alpha ${d.version} — ${d.codename}`,
      s: d.tagline,
      u: purl,
      x: [d.era, d.dateDisplay, d.wipe ?? '', d.fixesNote ?? ''].join(' ').trim(),
    });
    for (const t of d.topics)
      out.push({
        k: 'thema',
        b: `Alpha ${d.version}`,
        t: t.title,
        s: (d.features.find((f) => f.topicSlug === t.slug)?.desc ?? d.tagline).slice(0, 140),
        u: `/topics/${t.slug}.html`,
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
    // (patch-ship entries superseded by the full vehicle catalog below)
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
      b: v.data.manufacturer ?? v.data.makerCode ?? 'Schiff',
      t: v.data.name,
      s: [v.data.manufacturer, v.data.typeDe, v.data.sizeDe].filter(Boolean).join(' · '),
      u: `/schiffe/${v.id}.html`,
      x: [...v.data.fociDe, ...v.data.patches.map((p) => `alpha ${p}`)].join(' '),
    });

  // mission families (DataCore snapshot) — one entry per mission, not per offer
  for (const m of missions) {
    const rep = repSummary(m)[0];
    // Platzhalter ohne Klammern indizieren: gesucht wird nach "Rank", nicht "{Rank}"
    const title = m.title.replace(/\{([^}]*)\}/g, '$1');
    out.push({
      k: 'mission',
      b: m.typeNames[0] ?? 'Mission',
      t: title,
      s: [
        m.rewardMax ? `${m.rewardMax.toLocaleString('en-US')} aUEC` : null,
        rep?.factionName ?? null,
        m.count > 1 ? `${m.count}×` : null,
      ].filter(Boolean).join(' · '),
      u: `/missionen/${m.slug}.html`,
      x: [...m.giverNames, ...m.factionNames, ...m.localityNames, ...m.typeNames]
        .join(' ').slice(0, 160),
    });
  }

  return new Response(JSON.stringify(out), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
