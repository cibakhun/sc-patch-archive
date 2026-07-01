// Build-time search index over the data layer — served as a static JSON the
// Ctrl+K overlay lazy-loads on first open. Entry shape (short keys, ~35 KB):
// k = kind, b = badge, t = title, s = snippet, u = url, x = extra keywords
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

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
    for (const s of d.ships)
      out.push({
        k: 'schiff',
        b: `Alpha ${d.version}`,
        t: s.name,
        s: `${s.manufacturer} · ${s.role}${s.status ? ` · ${s.status}` : ''}`,
        u: `${purl}#dossier`,
        x: s.manufacturer,
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

  return new Response(JSON.stringify(out), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
