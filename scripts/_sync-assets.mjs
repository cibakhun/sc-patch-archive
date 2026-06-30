// Mirror the canonical /assets into /public/assets so Astro serves them at
// /assets/* — runs before dev/build. Keeps a single source of truth for the
// media (the committed /assets) and keeps the 15 MB duplicate OUT of git
// (public/assets is gitignored). At the final cutover, assets will MOVE into
// public/ permanently and this script + the gitignore entry go away.
import { cp } from 'node:fs/promises';

await cp('assets', 'public/assets', { recursive: true });
console.log('synced assets -> public/assets');
