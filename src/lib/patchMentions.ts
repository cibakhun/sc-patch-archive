// Rückrichtung der Feature-Links in src/data/patches/*.json: Jede Item-,
// Bauplan- oder Missionsseite, auf die eine Patch-Seite verlinkt, zeigt diese
// Patch-Seite. Gelesen wird der Dateibestand zur Bauzeit, wie beim
// Patch-Rückgrat der Schiffe (src/lib/patchSpine.ts).

type PatchFile = { version: string; codename: string; features?: { links?: { href: string }[] }[] };

import { patchPageSlugs } from './patchPages';

/** `page`: null, wenn dieser Bau die Patch-Seite nicht traegt. */
export type PatchMention = { version: string; codename: string; page: string | null };

const files = import.meta.glob<PatchFile>('../data/patches/*.json', { eager: true, import: 'default' });

const byVersion = (a: PatchMention, b: PatchMention) => {
  const x = a.version.split('.').map(Number);
  const y = b.version.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
};

const mentions = new Map<string, PatchMention[]>();
for (const p of Object.values(files)) {
  const slug = `sc-${p.version.replace(/\./g, '-')}`;
  const page = patchPageSlugs.has(slug) ? `/patches/${slug}.html` : null;
  for (const f of p.features ?? []) {
    for (const l of f.links ?? []) {
      if (!l.href.startsWith('/')) continue;
      const path = l.href.split('#')[0];
      const list = mentions.get(path) ?? [];
      if (!list.some((m) => m.version === p.version)) list.push({ version: p.version, codename: p.codename, page });
      mentions.set(path, list);
    }
  }
}
for (const list of mentions.values()) list.sort(byVersion);

/** Patch-Seiten, die auf diese Seite verlinken, älteste zuerst. `path` ohne Sprachpräfix, z. B. "/items/goliath.html". */
export const patchesMentioning = (path: string): PatchMention[] => mentions.get(path) ?? [];
