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

// Tunnel-Vorschau nur auf ausdrückliche Ansage und nur für die gebaute Seite.
// `astro dev` lässt immer nur localhost und IP-Adressen zu (Vite-Standard),
// auch mit VB_TUNNEL — der Dev-Server liefert den ganzen Quellbaum aus und
// gehört nie hinter einen Tunnel. `astro preview` (liefert nur dist/) lässt
// die Tunnel-Hosts erst mit VB_TUNNEL=1 zu; ohne bekommt eine Tunnel-URL 403:
//   PowerShell:  npm.cmd run build; $env:VB_TUNNEL = '1'; npm.cmd run preview
export const TUNNEL_HOSTS = ['.loca.lt', '.trycloudflare.com'];
const TUNNEL = /^(1|true)$/i.test(process.env.VB_TUNNEL ?? '');

// Vites Host-Schutz sieht nur den Host-Header. Schreibt ein Tunnel ihn auf
// localhost um (etwa cloudflared --http-host-header localhost), käme
// `astro dev` trotzdem nach außen. Deshalb weist der Dev-Server zusätzlich
// jede Anfrage ab, die eine Weiterleitungs-Kopfzeile trägt. Ein Browser setzt
// keine davon von sich aus; Proxys und die meisten Tunnel setzen sie
// (cloudflared immer Cf-Connecting-IP und Cf-Ray). Ein Tunnel, der gar nichts
// anfügt UND den Host umschreibt, käme weiter durch — die Regel bleibt:
// nie einen Tunnel auf den Dev-Port. `astro preview` ist davon nicht
// betroffen (das Plugin gilt nur für den Dev-Server).
export const PROXY_HEADERS = ['forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-real-ip', 'cf-connecting-ip', 'cf-ray'];
/** @param {Record<string, unknown> | undefined} headers */
export function viaProxy(headers) {
  return PROXY_HEADERS.some((h) => headers?.[h] !== undefined);
}

/** @returns {import('vite').Plugin} */
export function devLocalOnly() {
  return {
    name: 'vb-dev-local-only',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!viaProxy(req.headers)) return next();
        res.statusCode = 403;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(
          '403 Forbidden\n' +
            'astro dev ist nur lokal erreichbar. Geteilt wird die gebaute Seite: npm run build, VB_TUNNEL=1 setzen, npm run preview.\n' +
            'astro dev is local only. Share the built site instead: npm run build, set VB_TUNNEL=1, npm run preview.\n',
        );
      });
    },
  };
}

// Vites Dev-Server bietet `/__open-in-editor` ohne Anmeldung an; der Endpunkt
// startet auf dem Rechner einen Editor-Prozess. Dieses Projekt braucht ihn
// nicht (es fehlen nur die „im Editor öffnen"-Links im Fehler-Overlay und in
// der Dev-Toolbar, Apps Audit und Inspect).
// Middlewares, die ein Plugin direkt in configureServer einhängt, laufen vor
// Vites eigenen — der Riegel antwortet also zuerst. `LAUNCH_EDITOR=none` wäre
// kein Ersatz: der Wert wird nur zum Namen des gestarteten Programms.
// Geprüft in tests/e2e/dev-server.test.js.
/** @param {string | undefined} url */
export function isOpenInEditor(url) {
  let p = String(url ?? '');
  const cut = p.search(/[?#]/);
  if (cut !== -1) p = p.slice(0, cut);
  try {
    p = decodeURIComponent(p);
  } catch {
    // kaputte %-Folge: roh weiterprüfen
  }
  // includes statt startsWith: fängt auch die Absolutform
  // (`GET http://host/__open-in-editor`), die connect ebenfalls zuordnet.
  // `\` wie `/`: connect zerlegt die Absolutform mit url.parse, und das macht
  // aus `\` vor dem `?` einen `/`. Node 22 lehnt solche Anfragen heute schon
  // mit 400 ab; der Riegel soll davon aber nicht abhängen.
  return p.replace(/\\/g, '/').toLowerCase().includes('/__open-in-editor');
}

/** @returns {import('vite').Plugin} */
export function blockOpenInEditor() {
  return {
    name: 'vb-block-open-in-editor',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!isOpenInEditor(req.url)) return next();
        res.statusCode = 403;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('403 Forbidden\n');
      });
    },
  };
}

export default defineConfig({
  site: 'https://verse-base.com',
  build: { format: 'file' },
  // i18n: EN ist Default und liegt PRÄFIXLOS auf der Wurzel (Standardsprache).
  // DE-Seiten leben explizit unter src/pages/de/ -> /de/… (harmoniert mit
  // format:'file'; kein Auto-Fallback-Routing, das die .html-URLs verbiegt).
  i18n: {
    defaultLocale: 'en',
    locales: ['de', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  // Tunnel-Hosts (loca.lt/cloudflared), nur `astro preview` mit VB_TUNNEL
  // (siehe oben). Astro-Level `server` (seit 5.4) gilt für `astro dev` UND
  // `astro preview` — die frühere vite.server-Variante griff nur im
  // Dev-Server (preview: 403). Als Funktion bekommt es den Befehl mit
  // (`dev` oder `preview`) und unterscheidet die beiden.
  server: ({ command }) => ({
    allowedHosts: TUNNEL && command === 'preview' ? TUNNEL_HOSTS : [],
  }),
  vite: {
    plugins: [blockOpenInEditor(), devLocalOnly()],
  },
});
