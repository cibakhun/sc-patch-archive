# Technology Stack

**Analysis Date:** 2026-07-27

## Languages

**Primary:**
- TypeScript (strict, via `astro/tsconfigs/strict` in `tsconfig.json`) - Site logic in `src/lib/*.ts`, `src/consts.ts`, page frontmatter
- Astro component language (`.astro`) - All pages/components under `src/pages/`, `src/components/`, `src/layouts/`
- JavaScript ESM (`.mjs`) - Entire build/datamine toolchain in `scripts/`, Discord tooling in `discord/`

**Secondary:**
- Browser JS (plain, no bundler) - Hand-written runtime assets in `assets/*.js` (mirrored to `public/assets/` by `scripts/_sync-assets.mjs`), e.g. `assets/account-lite.js`, `assets/crafting-app.js`, `assets/archive.js`
- CSS (hand-written, no preprocessor) - `assets/*.css` (`assets/theme.css`, `assets/account.css`, `assets/data-page.css`)
- SQL (PostgreSQL) - `supabase/migrations/*.sql`, `scripts/supabase-schema.sql`
- TypeScript for Deno - `supabase/functions/verify-rsi/index.ts` (Supabase Edge Function runtime)
- Nginx config - `nginx/default.conf`

## Runtime

**Environment:**
- Node.js 22 for build (`Dockerfile` base `node:22-alpine`, CI `actions/setup-node@v4` node-version 22)
- Node.js >= 20.9 for the Discord bot (`discord/bot/package.json` engines), >= 20.6 for the server builder (`discord/package.json`)
- Deno (Supabase-managed) for the Edge Function
- nginx:alpine serves the built static site at runtime — there is no Node process in production for the website

**Package Manager:**
- npm (`npm ci` in `Dockerfile` and `.github/workflows/build.yml`)
- Lockfile: present (`package-lock.json`; also `discord/package-lock.json`, `discord/bot/package-lock.json`)

## Frameworks

**Core:**
- Astro ^5.0.0 - Static site generator; `output` is default static, `build.format: 'file'` so routes emit real `.html` files (`astro.config.mjs`)
- Astro Content Collections - Typed patch data layer with Zod schemas (`src/content.config.ts`, loaders `glob`/`file` over `src/data/patches`)
- Astro i18n - `defaultLocale: 'en'`, locales `['de','en']`, `prefixDefaultLocale: false` (EN at root, DE under `/de/`)

**Testing:**
- Node.js built-in test runner - `npm run test:e2e` → `node --test tests/e2e/**/*.test.js`
- Custom DOM stub, no framework - `tests/e2e/helpers/dom-mock.js`
- Custom integrity/audit scripts - `scripts/_verify.mjs` (`npm run verify`), `scripts/audit-site.mjs` (`npm run audit:site`), `scripts/verify-mining.mjs`, `scripts/verify-item-prices.mjs`

**Build/Dev:**
- Pre-build asset pipeline chained into `dev`/`build`: `scripts/_sync-assets.mjs` → `scripts/build-fav-thumbs.mjs` → `scripts/build-thumbs.mjs` → `scripts/build-downloads.mjs` → `astro build`
- Docker multi-stage build (`Dockerfile`) — build in CI, serve with nginx
- GitHub Actions (`.github/workflows/build.yml`, `deploy-image.yml`, `deploy-bot-image.yml`)

## Key Dependencies

**Critical:**
- `astro` ^5.0.0 - The site itself
- `@supabase/supabase-js` ^2.110.7 - Only runtime dependency shipped to browsers, bundled **only** on `/account/` pages (`src/lib/supabase.ts`); all other pages use the SDK-free `assets/account-lite.js` (~4 KB)

**Infrastructure (devDependencies — build-time only):**
- `three` ^0.185.1 - 3D holo viewer / mesh handling
- `@gltf-transform/core|extensions|functions` ^4.4.1 - GLB pipeline for `public/holo/*.glb` (`scripts/build-holo-meshes.mjs`)
- `draco3d` ^1.5.7, `meshoptimizer` ^1.2.0 - Mesh compression for holo meshes
- `discord.js` ^14.16.3 - Discord server builder (`discord/`) and always-on bot (`discord/bot/`)
- `better-sqlite3` ^11.8.1 - Bot XP/rank store (`discord/bot/src/db.mjs`)
- `@napi-rs/canvas` ^0.1.65 (optional) - Rank card image rendering (`discord/bot/src/card.mjs`)

**Notable: zero-dependency in-house tooling**
- `scripts/lib/p4k.mjs` - Node-native Star Citizen `Data.p4k` reader (Zip64 + zstd via `node:zlib` `zstdDecompressSync` + AES via `node:crypto`)
- `scripts/lib/datacore.mjs` - Node-native `Game2.dcb` parser; replaces external unp4k/unforge tooling
- `discord/bot/src/env.mjs` - Hand-rolled `.env` loader (no `dotenv`)

## Configuration

**Environment:**
- The website ships **no runtime secrets**. Public identifiers are checked into `src/consts.ts`: Supabase project URL + publishable key, Web3Forms access key. No `.env` file exists in the repo.
- Build-time / tooling env vars (all optional, developer-machine scoped):
  - `SC_P4K` - Path to `Data.p4k` (`scripts/lib/p4k.mjs`, default `F:/Games/Star Citizen/StarCitizen/LIVE/Data.p4k`)
  - `SC_STARBREAKER` - StarBreaker CLI path (`scripts/extract-hardpoints-assembled.mjs`)
  - `SNAP_DATE`, `LOGO_SHEET`, `HOLO_NOSE` - Snapshot/extraction overrides
- Discord tooling env (loaded from an untracked `discord/.env`): `DISCORD_TOKEN`, `GUILD_ID`, `CLIENT_ID`, `DB_PATH`, `DATA_DIR`, `LOGO_DIR`, `CARD_FONT_DIR`
- Supabase Edge Function env (platform-injected): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- CI secrets: `COOLIFY_DEPLOY_WEBHOOK`, `COOLIFY_BOT_DEPLOY_WEBHOOK`, `COOLIFY_API_TOKEN`, `GITHUB_TOKEN`

**Build:**
- `astro.config.mjs` - site URL `https://verse-base.com`, `build.format: 'file'`, i18n, `server.allowedHosts` for tunnel previews (`.loca.lt`, `.trycloudflare.com`)
- `tsconfig.json` - extends `astro/tsconfigs/strict`, excludes `dist`
- `Dockerfile` / `.dockerignore` - build image
- `nginx/default.conf` - security headers (HSTS, nosniff, Referrer-Policy), content-type-based `Cache-Control` map, `/en/` → root 301s, `format:'file'` directory redirects (`/de`, `/account`, `/items`, `/crafting`), `/pilot/<handle>` rewrite, real 404. Validated at image build (`RUN nginx -t`).

## Platform Requirements

**Development:**
- Node 22 + npm
- Windows host in practice (paths and defaults assume it; PowerShell preferred over Git Bash per project notes)
- Optional for datamining: an installed Star Citizen client (`Data.p4k`) and, for assembled hardpoints, the StarBreaker CLI. Without them the datamine scripts are skipped — the site builds from committed snapshots in `src/data/*.json`.

**Production:**
- Docker image `ghcr.io/cibakhun/sc-patch-archive:latest` (nginx serving `/usr/share/nginx/html`), deployed on Coolify (Hetzner), fronted by Cloudflare for DNS/TLS/proxy
- Discord bot as a separate always-on image `ghcr.io/cibakhun/verse-base-rank-bot:latest` on Coolify with a persistent volume for the SQLite DB
- Supabase (project `trgjhmbnodoarnfmlcqx`, AWS eu-central-1 / Frankfurt) for auth, Postgres and Edge Functions

---

*Stack analysis: 2026-07-27*
