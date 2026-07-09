// @ts-check
import { defineConfig } from 'astro/config';

// All-in-One SC site — static, hand-built.
// Data is baked at BUILD time (Phase 1+); the live site never calls an API
// (no runtime keys, no rate limits, free static hosting).
//
// build.format:'file' preserves the existing URL shape:
//   src/pages/patches/sc-4-8-2.astro  ->  /patches/sc-4-8-2.html
//
// Deploy target still open (user picked manual build). If this ends up on a
// GitHub Pages *project* path, add: base: '/sc-patch-archive'
// Cloudflare Pages (recommended in the blueprint) serves at root -> no base needed.
export default defineConfig({
  site: 'https://cibakhun.github.io',
  build: { format: 'file' },
  // i18n: DE ist Default und bleibt PRÄFIXLOS (bestehende URLs/SEO unverändert).
  // EN-Seiten leben explizit unter src/pages/en/ -> /en/… (harmoniert mit
  // format:'file'; kein Auto-Fallback-Routing, das die .html-URLs verbiegt).
  i18n: {
    defaultLocale: 'de',
    locales: ['de', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  // Tunnel-Hosts (loca.lt/cloudflared). Astro-Level `server.allowedHosts`
  // (seit 5.4) gilt für `astro dev` UND `astro preview` — die frühere
  // vite.server-Variante griff nur im Dev-Server (preview: 403).
  server: {
    allowedHosts: ['.loca.lt', '.trycloudflare.com'],
  },
});
