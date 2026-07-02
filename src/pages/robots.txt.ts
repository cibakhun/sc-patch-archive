// robots.txt as an endpoint so the sitemap URL follows SITE.url — the one
// constant to change on deploy day (Coolify/milasstho.de).
import type { APIRoute } from 'astro';
import { SITE } from '../consts';

export const GET: APIRoute = () => {
  const base = SITE.url.replace(/\/$/, '');
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
