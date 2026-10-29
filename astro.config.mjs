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
  return p.toLowerCase().includes('/__open-in-editor');
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
    plugins: [blockOpenInEditor()],
  },
});
