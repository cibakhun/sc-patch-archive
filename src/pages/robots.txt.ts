// robots.txt as an endpoint so the sitemap URL follows SITE.url — the one
// constant to change on deploy day (Coolify/milasstho.de).
import type { APIRoute } from 'astro';
import { SITE } from '../consts';
import { IS_STAGING } from '../lib/seo';

export const GET: APIRoute = () => {
  const base = SITE.url.replace(/\/$/, '');
  // Vorschau-Build: komplett sperren und KEINE Sitemap bewerben. Zusammen mit
  // dem <meta robots> aus dem Layout sind das zwei unabhaengige Signale —
  // faellt eines aus, greift das andere.
  const body = IS_STAGING
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
