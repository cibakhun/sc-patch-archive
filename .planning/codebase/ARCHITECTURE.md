<!-- refreshed: 2026-07-27 -->
# Architecture

**Analysis Date:** 2026-07-27

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│              OFFLINE DATA PIPELINE (npm scripts)             │
├──────────────────┬──────────────────┬───────────────────────┤
│  datamine-*.mjs  │   sync-*.mjs     │    fetch-*.mjs        │
│  (local Data.p4k)│ (FleetYards/Wiki)│   (UEX / fonts)       │
│  `scripts/`      │  `scripts/`      │   `scripts/`          │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│         COMMITTED DATA SNAPSHOTS (single source of truth)    │
│  `src/data/*.json` (small, schema-validated)                 │
│  `assets/*.json`   (large, fetched by the browser)           │
└────────┬───────────────────────────────────┬────────────────┘
         │ astro:content collections         │ raw JSON import
         ▼                                   ▼
┌─────────────────────────────────────────────────────────────┐
│                 BUILD-TIME RENDER (Astro 5, SSG)             │
│  `src/content.config.ts` → zod-validated collections         │
│  `src/lib/*.ts`  domain helpers (join/format/derive)         │
│  `src/i18n/*.ts` string catalogs + locale path math          │
│  `src/components/*.astro` shared UI, `lang` prop             │
│  `src/layouts/Layout.astro` single document shell            │
│  `src/pages/**`  EN at root · DE under `de/`                 │
└────────┬───────────────────────────────────┬────────────────┘
         │                                   │
         ▼                                   ▼
┌──────────────────────────────┐  ┌──────────────────────────┐
│  `dist/` static HTML          │  │  Runtime (browser only)  │
│  → Dockerfile → nginx         │  │  `assets/*.js` vanilla   │
│  → Coolify (verse-base.com)   │  │  Supabase (auth/profile) │
└──────────────────────────────┘  └──────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Astro config | Static output, `build.format:'file'` (→ `.html` URLs), i18n locales, canonical `site` | `astro.config.mjs` |
| Site constants | Domain, default descriptions, Supabase + Web3Forms public keys | `src/consts.ts` |
| Content schemas | zod schemas for `patches`, `ships`, `vehicles` collections | `src/content.config.ts` |
| Document shell | `<head>`, SEO/OG/JSON-LD, hreflang, theme bootstrap, fonts | `src/layouts/Layout.astro` |
| Full site chrome | Nav deck, search overlay, breadcrumbs, account-lite | `src/components/SiteNav.astro` |
| Lightweight shell | ~1.5 KB shell for the ~17k mass-generated data pages | `src/components/DataShell.astro` |
| i18n catalog | Recurring UI strings + `localeFromPath` / `pathForLocale` / `href` | `src/i18n/ui.ts` |
| Indexability | The single `NOINDEX_PATHS` source read by both Layout and sitemap | `src/lib/seo.ts` |
| Sitemap inventory | Page/ship/mission/item/crafting inventories with hreflang pairs | `src/lib/sitemap.ts` |
| Asset cache-bust | `sha1` content hash appended to fixed `/assets/*` URLs | `src/lib/assetVersion.ts` |
| Game-file readers | Own `Game2.dcb` (DataCore) and `Data.p4k` parsers in Node | `scripts/lib/datacore.mjs`, `scripts/lib/p4k.mjs` |
| Theme generators | Derive light-mode palettes/overrides from inline dark `:root` blocks | `scripts/build-light-palettes.mjs`, `scripts/build-light-overrides.mjs` |
| Post-build audit | Verifies SEO/a11y/noindex-vs-sitemap consistency of `dist/` | `scripts/audit-site.mjs` |

## Pattern Overview

**Overall:** Build-time-baked static site (SSG) with a separate, manually-triggered offline data pipeline. Islands are plain vanilla-JS files served from `/assets`, not framework components.

**Key Characteristics:**
- The live site never calls a content API — every fact is baked from a committed snapshot.
- Zero UI framework: interactivity is `<script is:inline>` or a standalone `assets/*.js` file.
- Bilingual by *page duplication*, not by runtime translation: `src/pages/x.astro` (EN) and `src/pages/de/x.astro` (DE) are two files sharing components, libs and i18n catalogs.
- Only two runtime dependencies (`astro`, `@supabase/supabase-js`); everything else is a devDependency used by the pipeline.

## Layers

**Pipeline layer (`scripts/*.mjs`):**
- Purpose: turn game files and third-party APIs into committed JSON snapshots
- Location: `scripts/`, shared readers in `scripts/lib/`
- Contains: `datamine-*` (local `Data.p4k`), `sync-*` (FleetYards / Star Citizen Wiki), `fetch-*` (UEX, fonts), `build-*` (derive/merge/optimize), `verify-*` / `audit-site.mjs` (checks)
- Depends on: a local Star Citizen install for `datamine-*`; network for `sync-*`/`fetch-*`
- Used by: nothing at runtime — output is committed and read by the render layer

**Data layer (`src/data/`, `assets/*.json`):**
- Purpose: single source of truth for all facts
- Location: `src/data/*.json` + `src/data/patches/*.json` (build-time, schema-validated); `assets/*.json` (large, client-fetched, e.g. `universal-items.json`, `crafting-db.json`, `mining-db.json`, `refinery-data.json`)
- Depends on: pipeline layer
- Used by: `src/content.config.ts` collections and direct `import` in `src/lib/*`

**Domain layer (`src/lib/`):**
- Purpose: typed access, joins, derivations and formatting over the snapshots
- Location: `src/lib/`
- Contains: `items.ts`, `crafting.ts`, `missions.ts`, `archive.ts`, `refinery.ts`, `shipExtras.ts`, `shipRenders.ts`, `sitemap.ts`, `seo.ts`, `assetVersion.ts`
- Note: types are declared explicitly rather than inferred from the multi-MB JSON (see the comment in `src/lib/items.ts`) to keep the TS server responsive.

**Presentation layer (`src/components/`, `src/layouts/`):**
- Purpose: one implementation per UI surface, parameterised by `lang`
- Location: `src/components/` (+ `account/`, `dossier/`, `pilot/` subfolders), `src/layouts/Layout.astro`
- Used by: both language page trees

**Route layer (`src/pages/`):**
- Purpose: URL shape and per-page dramaturgy (bespoke inline CSS)
- Location: `src/pages/**` (EN) and `src/pages/de/**` (DE)

**Runtime layer (`assets/*.js`):**
- Purpose: the only code that runs in the browser
- Location: `assets/item-finder-app.js`, `crafting-app.js`, `mining-app.js`, `missions-app.js`, `archive.js`, `detail.js`, `holo-viewer.js`, `account-lite.js`, `a11y.js`
- Depends on: `assets/*.json` fetched at runtime; Supabase for account features

## Data Flow

### Primary request path (static page)

1. `astro build` runs `getCollection()` / `import` of the snapshot (`src/pages/schiffe.astro:16`)
2. `src/lib/*` joins prices, images, i18n text onto the record (`src/lib/shipExtras.ts`)
3. Page renders markup + inline `<style>`; `Layout.astro` adds head/SEO/hreflang
4. `dist/**/*.html` is baked into the nginx image (`Dockerfile`)
5. Browser loads HTML; a small inline script filters/sorts client-side

### Mass data pages (items / blueprints)

1. `src/lib/items.ts` imports `assets/universal-items.json`
2. `src/pages/items/[slug].astro:5` `getStaticPaths()` emits one route per item
3. `src/components/ItemDetail.astro` renders inside `DataShell.astro` (not `SiteNav`) to keep ~17k pages small
4. `src/lib/sitemap.ts` lists the same inventory into `sitemap-items.xml.ts`

### Data refresh path

1. `npm run datamine:items` → `assets/items-gamefiles.json` (gitignored build *input*)
2. `npm run sync:items` (`scripts/build-universal-db.mjs`) merges game data + UEX prices → `assets/universal-items.json` (committed)
3. `npm run build` copies `assets/` → `public/assets/` (`scripts/_sync-assets.mjs`, excluding `*-gamefiles.json`) and rebuilds

**State Management:**
- Build-time: module-scope constants in `src/lib/*` (imported JSON is effectively a frozen singleton).
- Runtime: `localStorage` (`vb.theme`), `sessionStorage` (`vb_user_role`), and Supabase tables (favorites, crafting entries, refinery jobs) guarded by RLS.

## Key Abstractions

**Content collection:**
- Purpose: schema-validated fact register; "Dossier uniform, Kino individuell" — data is validated centrally, presentation is bespoke per page
- Examples: `src/content.config.ts` (`patches`, `ships`, `vehicles`)
- Pattern: `glob()` loader for `src/data/patches/*.json`, `file()` loader with a parser for the ship/vehicle snapshots

**Locale-aware page pair:**
- Purpose: two page files, one component/lib/i18n body
- Examples: `src/pages/schiffe.astro` ↔ `src/pages/de/schiffe.astro`, `src/pages/items/[slug].astro` ↔ `src/pages/de/items/[slug].astro`
- Pattern: page declares `const lang = 'en'`, imports the same component and passes `lang`; the "base form" of any path is the EN path

**Shell component:**
- Purpose: two tiers of chrome, chosen by page cardinality
- Examples: `src/components/SiteNav.astro` (rich, ~37 KB/page) vs `src/components/DataShell.astro` (~1.5 KB, no JS)

**Versioned asset href:**
- Purpose: defeat the 1-day nginx/Cloudflare cache on fixed `/assets/*` URLs
- Examples: `src/lib/assetVersion.ts` `versioned()`, inline equivalents in `ItemFinderApp.astro`, `SiteNav.astro`, `PatchArchive.astro`

## Entry Points

**`npm run dev` / `npm run build`:**
- Location: `package.json:7-8`
- Triggers: developer or CI
- Responsibilities: `_sync-assets.mjs` → `build-fav-thumbs.mjs` → `build-thumbs.mjs` → `build-downloads.mjs` → `astro build`

**Homepages:**
- Location: `src/pages/index.astro` (→ `/`), `src/pages/de/index.astro` (→ `/de.html`)

**Endpoints (build-time generated files):**
- `src/pages/sitemap.xml.ts` + `sitemap-{pages,ships,missions,items,crafting}.xml.ts`
- `src/pages/robots.txt.ts`
- `src/pages/search-index.json.ts` and `src/pages/de/search-index.json.ts` (per-locale index)
- `src/pages/missions-search.json.ts`

**Deployment:**
- Location: `Dockerfile`, `.github/workflows/deploy-image.yml`, `nginx/default.conf`
- Responsibilities: build in CI, ship a prebuilt nginx image to Coolify

## Architectural Constraints

- **No runtime backend:** the site is static HTML behind nginx. Server-side logic is only possible as a Supabase Edge Function, never as a hosting-platform function.
- **Root-relative links:** all internal links are `/patches/…`, `/assets/…`. The site only works when deployed at a domain root; changing target means editing `SITE.url` in `src/consts.ts` *and* `site` in `astro.config.mjs`.
- **`build.format: 'file'`:** every route ends in `.html`; the DE homepage is `/de.html`, not `/de/`. Path math in `src/i18n/ui.ts` and `src/lib/sitemap.ts` encodes this.
- **Light-mode generators only see inline `<style>`:** `scripts/build-light-palettes.mjs` and `build-light-overrides.mjs` scan `:root` blocks inside `.astro` files. Palettes moved into a standalone `assets/*.css` must be hand-maintained (documented in `DataShell.astro`).
- **Global state:** module-scope JSON imports in `src/lib/*` and the memo `Map` in `src/lib/assetVersion.ts` are process singletons — safe because snapshots do not change during a build.
- **Circular imports:** deliberately avoided between `src/lib/seo.ts` and `src/i18n/ui.ts`; `seo.ts` re-implements its own path normalisation rather than importing (see its header comment). `src/lib/sitemap.ts` follows the same rule with `toDe()`.
- **`assets/` is canonical, `public/assets/` is generated:** `public/assets/` is gitignored and rebuilt by `scripts/_sync-assets.mjs` on every dev/build. Never edit files under `public/assets/`.

## Anti-Patterns

### Editing generated CSS blocks by hand

**What happens:** Someone edits the `:root[data-theme="light"]{…}` block or the `/* Hell-Entsprechungen */` rules inside a page's inline `<style>`.
**Why it's wrong:** `npm run theme` regenerates those blocks from the dark palette and silently discards the edit.
**Do this instead:** change the dark values and re-run `npm run theme`; see the marker comments in `src/pages/schiffe.astro`.

### Linking a fixed `/assets/*.css|js` URL without a content hash

**What happens:** A page writes `<link href="/assets/foo.css?v=3">` with a hand-incremented number, or no query at all.
**Why it's wrong:** nginx serves `/assets/*` with a 1-day expiry and Cloudflare caches it; returning visitors get old CSS/JS against new HTML for up to 24 h. This has shipped as a live bug more than once.
**Do this instead:** use `versioned('assets/foo.css', '/assets/foo.css')` from `src/lib/assetVersion.ts`.

### Wrapping a mass-generated page in `SiteNav`

**What happens:** A new `[slug]` route uses `Layout` + `SiteNav` like the hand-built pages do.
**Why it's wrong:** `SiteNav` plus the search overlay is ~37 KB per page; across ~17k generated pages that is hundreds of MB of `dist/` output.
**Do this instead:** use `src/components/DataShell.astro`, as `src/components/ItemDetail.astro` does.

### Setting `noindex` only on the page

**What happens:** A page passes `noindex={true}` to `Layout` but the sitemap still globs it in.
**Why it's wrong:** Google reports "Submitted URL marked 'noindex'" and treats the sitemap as faulty.
**Do this instead:** add the EN base path to `NOINDEX_PATHS` in `src/lib/seo.ts` — Layout and sitemap both read it, and `scripts/audit-site.mjs` enforces agreement.

### Committing a build input

**What happens:** `assets/*-gamefiles.json` (raw DataCore extracts) get committed or copied into `public/`.
**Why it's wrong:** ~9 MB of dead payload in `dist/`, and they do not exist in CI — so local preview would diverge from production.
**Do this instead:** keep them gitignored; `scripts/_sync-assets.mjs` already filters them out.

## Error Handling

**Strategy:** fail loudly at build time, degrade honestly at runtime.

**Patterns:**
- zod schemas in `src/content.config.ts` abort the build on a malformed snapshot.
- Helper lookups return `null`/`undefined` and pages render an em-dash (`'—'`) rather than a guess — "no invented values" is an explicit project rule, backed by `unverified` flags in the patch schema.
- Filesystem reads that only affect cache-busting swallow the error and fall back to `'x'` (`src/lib/assetVersion.ts:33`).
- Runtime image failures fall back inline (`onerror="this.style.display='none'"` in `src/pages/schiffe.astro`).
- `scripts/verify-*.mjs` and `scripts/audit-site.mjs` are post-hoc gates over the pipeline output and `dist/`.

## Cross-Cutting Concerns

**Logging:** `console.log` in pipeline scripts only; no client-side logging framework.
**Validation:** zod (via `astro:content`) for collections; ad-hoc guards elsewhere (e.g. the `HEX` regex in `Layout.astro:93` before injecting a colour into an inline script).
**Authentication:** client-side Supabase. Full `supabase-js` is bundled **only** on `/account/` pages; every other page loads the slim `assets/account-lite.js`. Data access is protected by Row Level Security, not by the publishable key. Privileged writes (e.g. `profiles.rsi_verified`) are locked behind DB triggers and Edge Functions.
**Theming:** dark is the default and the only mode for non-admins; the pre-paint inline script in `Layout.astro` sets `data-theme` before first paint.
**SEO:** canonical + hreflang + JSON-LD centralised in `Layout.astro`; article-level LD in `src/components/dossier/PatchSeo.astro` and `TopicSeo.astro`.

---

*Architecture analysis: 2026-07-27*
