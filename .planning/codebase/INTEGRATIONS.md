# External Integrations

**Analysis Date:** 2026-07-27

Architectural rule (`astro.config.mjs` header comment): **all game data is baked at build time; the live site never calls a data API.** External data APIs therefore appear only in `scripts/` (build/sync tooling), never in shipped page code. The only runtime integrations in the browser are Supabase (accounts) and Web3Forms (feedback).

## APIs & External Services

**Build-time data sources (`scripts/`, run manually or via the Build workflow):**
- Star Citizen Wiki API (`https://api.star-citizen.wiki`) - residual client only
  - Clients: `scripts/verify-item-prices.mjs`
  - Auth: none (public)
  - **01.4-05:** the vehicle-catalog client (`scripts/sync-vehicles.mjs`) and the
    weapon-size enrichment client (`scripts/enrich-weapon-sizes.mjs`) are both
    deleted (D-16). `src/data/vehicles.json` now comes from the project's own
    `Data.p4k` extraction (`scripts/datamine-vehicles.mjs`, local-only, cannot
    run in CI); the Wiki API is no longer an integration for the vehicle
    catalog.
- FleetYards API (`https://api.fleetyards.net`) - Ship specs, 3D/paints/variants extras
  - Clients: `scripts/sync-ships.mjs`, `scripts/sync-fleetyards-extras.mjs`
  - Auth: none (public)
- UEX Corp API (`https://api.uexcorp.space`) - In-game item prices and commodity prices
  - Clients: `scripts/sync-prices.mjs`, `scripts/fetch-uex-item-prices.mjs`, `scripts/fetch-uex-commodities.mjs`, `scripts/verify-item-prices.mjs`
  - Auth: none (public); attribution to UEX is kept in the UI
- scmdb (`https://scmdb.net`) - Residual reference for mining/gear/location cross-checks
  - Clients: `scripts/datamine-mining.mjs`, `scripts/datamine-gear.mjs`, `scripts/datamine-locations.mjs`, `scripts/freeze-mining-constants.mjs`
- RSI / Roberts Space Industries (`https://robertsspaceindustries.com`) - Comm-Link patch-notes URLs and citizen profile pages
  - Clients: `scripts/datamine-crafting.mjs`, and at runtime `supabase/functions/verify-rsi/index.ts`
- Google Fonts (`https://fonts.googleapis.com`) - One-off download only; fonts are self-hosted afterwards in `assets/fonts/*.woff2` (`scripts/fetch-fonts.mjs`)

**Local game files (not an API, but the primary data source):**
- Star Citizen `Data.p4k` via `scripts/lib/p4k.mjs` and `Game2.dcb` via `scripts/lib/datacore.mjs`
- Driven by `npm run datamine:*` scripts; output lands in `src/data/*.json` and is committed as a last-good snapshot

**Runtime (browser) services:**
- Supabase (`https://trgjhmbnodoarnfmlcqx.supabase.co`) - Accounts, profiles, favorites, crafting ownership, refinery jobs
  - SDK/Client: `@supabase/supabase-js` bundled only on `/account/` pages (`src/lib/supabase.ts`); every other page uses the SDK-free `assets/account-lite.js`
  - Auth: publishable key in `src/consts.ts` (`SUPABASE.publishableKey`) — public by design, protection is Row Level Security
- Web3Forms (`https://api.web3forms.com/submit`) - Feedback form delivery without a backend
  - Client: `src/components/FeedbackForm.astro` posts the access key from `src/consts.ts` (`FEEDBACK.web3formsKey`)
  - Demo-mode guard: `FEEDBACK_DEMO` in `src/consts.ts`

## Data Storage

**Databases:**
- Supabase Postgres (project `trgjhmbnodoarnfmlcqx`, AWS eu-central-1 / Frankfurt)
  - Connection: `SUPABASE.url` in `src/consts.ts`; session stored in `localStorage` under `sb-trgjhmbnodoarnfmlcqx-auth-token`
  - Client: `supabase-js` v2, `flowType: 'implicit'` (so email confirm/recovery links work across devices)
  - Schema: `scripts/supabase-schema.sql` (`friends`, `friend_requests`, `user_roles`) plus `supabase/migrations/`:
    - `20260722200000_guard_rsi_verified.sql` — trigger blocking client writes to `profiles.rsi_verified`
    - `20260723000000_public_profile_views.sql` — views `public_profiles`, `public_favorites`
    - `20260723010000_profiles_extended_columns.sql`
    - `20260725000000_add_last_seen_presence.sql`, `20260725000100_social_profiles_presence.sql`, `20260725110000_presence_two_signal.sql` — presence + `social_profiles` view
    - `20260726000000_crafting_entries.sql` — table `crafting_entries` with per-user RLS select/insert/update/delete policies
- SQLite (Discord bot only) - `better-sqlite3` in `discord/bot/src/db.mjs`, file path from `DB_PATH`, persisted on a Coolify volume (`/app/data`)

**File Storage:**
- No object storage. All media is committed in `assets/` and mirrored to `public/assets/` by `scripts/_sync-assets.mjs`; derived thumbnails come from `scripts/build-thumbs.mjs` and `scripts/build-fav-thumbs.mjs`. Holo meshes live in `public/holo/*.glb`.

**Caching:**
- No cache service. HTTP caching only, defined in `nginx/default.conf`: HTML `no-cache`, images/video/fonts 30d, CSS/JS/JSON 1d, `/_astro/` and `/holo/` 1y (content-hashed URLs). Hand-linked assets get a sha1 content hash as `?v=` (`src/lib/assetVersion.ts`).

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (email/password with confirmation mails)
  - Implementation: `src/lib/supabase.ts` (`persistSession`, `autoRefreshToken`, `detectSessionInUrl`)
  - Lightweight session read on non-account pages: `assets/account-lite.js` reads the supabase-js session out of `localStorage` and exposes `window.VBAccount`
  - Registration goes through a Supabase Edge Function `register` rather than the built-in mailer
  - Role gating via the `user_roles` table (`admin`, `beta`)
- RSI account linking: Edge Function `verify-rsi` (`supabase/functions/verify-rsi/index.ts`) does a server-to-server GET on the RSI citizen page, checks for the user's code in the bio, takes the user id from the session JWT (never the body), and persists with the service role.

## Monitoring & Observability

**Error Tracking:**
- None

**Logs:**
- nginx access/error logs on the container; GitHub Actions logs for builds; `console` output from bot and scripts

## CI/CD & Deployment

**Hosting:**
- Site: Docker image on Coolify (Hetzner), nginx origin behind Cloudflare (DNS/TLS/proxy only, Bot Fight Mode on). **No Cloudflare Pages project exists** — server-side code must be a Supabase Edge Function, not a Pages Function.
- Bot: separate Coolify service from `ghcr.io/cibakhun/verse-base-rank-bot`

**CI Pipeline:**
- `.github/workflows/deploy-image.yml` - on push to `main`: build+push `ghcr.io/cibakhun/sc-patch-archive:{latest,sha}`, then trigger the Coolify deploy webhook
- `.github/workflows/deploy-bot-image.yml` - path-filtered (`discord/bot/**`, `src/data/**`, `assets/manufacturers/**`) build+push of the bot image, separate Coolify webhook
- `.github/workflows/build.yml` - manual "Build button": runs `sync:ships`, `sync:prices`, `sync:extras` (each `continue-on-error: true` → last-good-snapshot principle; the vehicle catalog is NOT part of this workflow since 01.4-05 — it needs the local `Data.p4k`), commits refreshed `src/data`, builds, runs `scripts/_verify.mjs`, uploads `dist` as an artifact

## Environment Configuration

**Required env vars:**
- Website build: none (public keys are committed in `src/consts.ts`)
- Datamining (optional, local): `SC_P4K`, `SC_STARBREAKER`, `SNAP_DATE`, `LOGO_SHEET`, `HOLO_NOSE`
- Discord (`discord/.env`, untracked): `DISCORD_TOKEN`, `GUILD_ID`, `CLIENT_ID`, `DB_PATH`, `DATA_DIR`, `LOGO_DIR`, `CARD_FONT_DIR`
- Supabase Edge Functions (platform-injected): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

**Secrets location:**
- GitHub repository secrets: `COOLIFY_DEPLOY_WEBHOOK`, `COOLIFY_BOT_DEPLOY_WEBHOOK`, `COOLIFY_API_TOKEN` (plus the automatic `GITHUB_TOKEN`)
- Supabase dashboard for function secrets and the service-role key
- Coolify service env for the Discord bot token
- No `.env` file is committed anywhere in the repo

## Webhooks & Callbacks

**Incoming:**
- None on the site (static nginx, no server-side endpoints). Supabase Edge Functions are the only HTTP endpoints under project control.

  **Korrigiert 03.08.2026** — die frühere Fassung behauptete pauschal, alle drei
  Functions verlangten ein Session-JWT. Gegen die lebende Anlage geprüft
  (`list_edge_functions`) stimmt das nicht, und der Irrtum wäre teuer geworden:

  | Function | `verify_jwt` | warum |
  |---|---|---|
  | `register` | **false** | wer sich gerade anmeldet, hat noch keine Sitzung |
  | `delete-account` | true | |
  | `verify-rsi` | true | |
  | `create-checkout-session` | false | Spenden ohne Konto (Phase 5) |
  | `stripe-webhook` | false | Stripe authentifiziert sich per Signatur |

  Seit Phase 5 gibt es `supabase/config.toml`. **Sobald diese Datei existiert,
  bekommen dort NICHT aufgeführte Functions beim Deploy den Standard `true`.**
  Deshalb steht `register` ausdrücklich darin — ohne den Eintrag würde ein
  `supabase functions deploy register` die Kontoanmeldung stillschweigend
  abschalten. `tests/e2e/support-trust.test.js` hält die Aufteilung fest.
- Discord gateway connection (not a webhook) in `discord/bot/src/index.mjs`

**Outgoing:**
- Coolify redeploy webhooks from both deploy workflows (Bearer `COOLIFY_API_TOKEN`)
- Discord patch auto-post from the bot (`discord/bot/src/patch-watch.mjs`) reading site JSON
- IndexNow key file served at `public/497de34e….txt` for search-engine ping submissions

---

*Integration audit: 2026-07-27*
