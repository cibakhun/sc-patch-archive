# Codebase Structure

**Analysis Date:** 2026-07-27

## Directory Layout

```
sc-patch-archive/
├── astro.config.mjs        # static SSG, build.format:'file', i18n locales
├── package.json            # build + ~35 pipeline scripts
├── Dockerfile              # CI builds dist/, nginx image ships it
├── nginx/default.conf      # security headers, cache policy, 404
├── .github/workflows/      # build.yml, deploy-image.yml, deploy-bot-image.yml
├── src/
│   ├── consts.ts           # SITE, FEEDBACK, SUPABASE public config
│   ├── content.config.ts   # zod collections: patches, ships, vehicles
│   ├── env.d.ts
│   ├── layouts/            # Layout.astro — the only document shell
│   ├── components/         # shared, lang-parameterised UI
│   │   ├── account/        # auth + dashboard surfaces
│   │   ├── dossier/        # patch/topic rendering + Article JSON-LD
│   │   └── pilot/          # public profile page body
│   ├── data/               # committed build-time snapshots (JSON + patches/)
│   ├── i18n/               # ui.ts catalog + per-domain text helpers
│   ├── lib/                # typed domain helpers over the snapshots
│   ├── scripts/            # TS bundled into pages (account-dashboard.ts)
│   └── pages/              # EN routes at root, DE routes under de/
├── assets/                 # CANONICAL media, runtime JS, large JSON
├── public/                 # favicon, holo/, onepager/, vendor/, downloads/
│   └── assets/             # GENERATED mirror of assets/ (gitignored)
├── scripts/                # datamine / sync / fetch / build / verify jobs
│   └── lib/                # p4k.mjs, datacore.mjs, tags.mjs, theme-color.mjs
├── tests/e2e/              # node:test DOM-mock behaviour tests
├── docs/                   # deep-dive notes on datamining findings
└── dist/                   # build output (gitignored)
```

## Directory Purposes

**`src/pages/`:**
- Purpose: URL shape and per-page dramaturgy
- Contains: `.astro` routes plus `.ts` endpoints (`sitemap*.xml.ts`, `robots.txt.ts`, `search-index.json.ts`, `missions-search.json.ts`)
- Key files: `src/pages/index.astro`, `src/pages/de/index.astro`, `src/pages/sitemap.xml.ts`
- Sub-trees: `patches/` (one file per released version), `topics/` (deep dives, slug = `<version>-<topic>`), `schiffe/`, `items/`, `crafting/`, `missionen/`, `account/`

**`src/pages/de/`:**
- Purpose: the German mirror of every translated route
- Contains: a 1:1 file counterpart for each EN page (`schiffe.astro`, `items/[slug].astro`, `patches/sc-4-9-0.astro`, …)
- Note: **directory names stay identical between locales** — only the `/de` prefix differs. The DE homepage builds to `/de.html` because of `build.format:'file'`.

**`src/components/`:**
- Purpose: the single implementation of each UI surface, shared by both language shells
- Contains: page-body components (`ShipDetail`, `ItemDetail`, `MissionDetail`, `PatchArchive`, `CraftingApp`, `MiningApp`, `RefineryFinder`), chrome (`SiteNav`, `DataShell`, `SearchOverlay`, `LangSwitcher`, `ThemeToggle`), and grouped folders `account/`, `dossier/`, `pilot/`
- Key files: `DataShell.astro` (mass-page shell), `SiteNav.astro` (full chrome)

**`src/lib/`:**
- Purpose: typed reads, joins and derivations over the snapshots
- Key files: `items.ts`, `crafting.ts`, `missions.ts`, `archive.ts`, `seo.ts`, `sitemap.ts`, `assetVersion.ts`, `supabase.ts`

**`src/i18n/`:**
- Purpose: recurring UI strings and locale path arithmetic
- Key files: `ui.ts` (`DEFAULT_LOCALE='en'`, `LOCALES`, `useTranslations`, `href`, `pathForLocale`, `localeFromPath`), `itemText.ts`, `patchText.ts`, `vehicleText.ts`

**`src/data/`:**
- Purpose: small committed snapshots consumed at build time
- Contains: `ships.json`, `vehicles.json`, `missions.json`, `holo-*.json`, `ship-*.json`, `patches/4-x-y.json` (one per version), `precision-jump.ts`

**`assets/`:**
- Purpose: the canonical, committed media + runtime layer
- Contains: runtime islands (`item-finder-app.js`, `crafting-app.js`, `mining-app.js`, `missions-app.js`, `archive.js`, `detail.js`, `holo-viewer.js`, `account-lite.js`, `a11y.js`), shared CSS (`theme.css`, `data-page.css`, `detail.css`, `account.css`, `archive.css`, `a11y.css`, `fonts.css`), self-hosted `fonts/`, imagery (`img-*.jpg`, `t-*.jpg`, `loops/`, `manufacturers/`), and client-fetched JSON (`universal-items.json`, `crafting-db.json`, `mining-db.json`, `refinery-data.json`)
- Excluded from delivery: `*-gamefiles.json` — gitignored build *inputs*

**`scripts/`:**
- Purpose: the offline data pipeline
- Naming groups: `datamine-*` (local `Data.p4k`/DataCore), `sync-*` (FleetYards, SC Wiki), `fetch-*` (UEX, fonts), `build-*` (derive, merge, optimize), `verify-*` + `audit-site.mjs` (checks), `_`-prefixed internals (`_sync-assets.mjs`, `_verify.mjs`)
- Key files: `scripts/lib/p4k.mjs`, `scripts/lib/datacore.mjs` (own `Game2.dcb` parser), `scripts/lib/theme-color.mjs` (imported by `Layout.astro`), `scripts/supabase-schema.sql`

## Key File Locations

**Entry Points:**
- `src/pages/index.astro`: EN homepage (`/`)
- `src/pages/de/index.astro`: DE homepage (`/de.html`)
- `package.json:8`: the build chain

**Configuration:**
- `astro.config.mjs`: site URL, `build.format`, i18n, dev `allowedHosts`
- `src/consts.ts`: `SITE`, `FEEDBACK`, `SUPABASE`
- `nginx/default.conf`: headers + cache policy (drives the cache-bust rules)
- `.gitignore`: marks `public/assets/`, `dist/`, `assets/*-gamefiles.json` as generated

**Core Logic:**
- `src/content.config.ts`: schemas for all collection-backed data
- `src/lib/`: domain helpers
- `assets/*.js`: browser runtime

**Testing:**
- `tests/e2e/*.test.js` (node:test, run via `npm run test:e2e`), helpers in `tests/e2e/helpers/dom-mock.js`

## Naming Conventions

**Files:**
- Astro components: `PascalCase.astro` (`ItemDetail.astro`)
- TS modules: `camelCase.ts` (`assetVersion.ts`, `shipRenders.ts`)
- Pipeline scripts: `kebab-case.mjs` with a verb prefix (`datamine-items.mjs`); internals prefixed `_`
- Assets: `kebab-case` with a domain prefix (`img-polaris.jpg`, `t-alien-1.jpg`, `mining-db.json`)
- Patch data + routes: dot-free version slugs — `src/data/patches/4-9-0.json` ↔ `src/pages/patches/sc-4-9-0.astro` ↔ `/patches/sc-4-9-0.html`

**Directories:**
- `src/pages/` route folders are lowercase and identical across locales (`items/`, `crafting/`, `schiffe/`, `missionen/`)
- Component groupings are lowercase (`account/`, `dossier/`, `pilot/`)

**Code:**
- Comments in the German-language voice used throughout `src/` — match the surrounding file.
- Every non-obvious module opens with a "why this exists" header comment; keep that habit.

## Where to Add New Code

**New translated page:**
1. `src/pages/<name>.astro` (EN) — set `const lang = 'en'`, pass `translated={true}` to `Layout`
2. `src/pages/de/<name>.astro` (DE) — same file name, imports go up one extra level (`../../`)
3. Put shared markup in `src/components/<Name>.astro` with a `lang` prop; only the page-specific CSS/hero copy stays in the page
4. Add recurring strings to `src/i18n/ui.ts`, not into the pages
5. If it should not be indexed, add the EN path to `NOINDEX_PATHS` in `src/lib/seo.ts` (never `noindex` on the Layout alone)

**New mass-generated route:**
- Route: `src/pages/<area>/[slug].astro` + `src/pages/de/<area>/[slug].astro`, each a thin `getStaticPaths()` wrapper around a shared component
- Shell: use `src/components/DataShell.astro`, not `SiteNav`
- Inventory: extend `src/lib/sitemap.ts` and add a `sitemap-<area>.xml.ts` part if it is large

**New data source:**
- Extractor: `scripts/datamine-<thing>.mjs` (game files) or `scripts/sync-<thing>.mjs` / `fetch-<thing>.mjs` (external)
- Raw output: `assets/<thing>-gamefiles.json` (gitignored build input)
- Delivered snapshot: `src/data/<thing>.json` if small/build-time, `assets/<thing>.json` if the browser fetches it
- Register an `npm run datamine:<thing>` / `sync:<thing>` script in `package.json`
- Add a zod schema in `src/content.config.ts` if it becomes a collection, otherwise declare explicit types in `src/lib/<thing>.ts`

**New shared component/module:**
- UI: `src/components/` (or the matching subfolder), accept `lang: Locale`
- Logic: `src/lib/<domain>.ts`
- Strings: `src/i18n/`

**New browser behaviour:**
- Small and page-specific → `<script is:inline>` in the page
- Reused or >~2 KB → `assets/<name>.js`, referenced via `versioned()` from `src/lib/assetVersion.ts`

**Tests:**
- `tests/e2e/<area>.test.js` using `tests/e2e/helpers/dom-mock.js`

## Special Directories

**`public/assets/`:**
- Purpose: what Astro actually serves at `/assets/*`
- Generated: Yes — mirrored from `assets/` by `scripts/_sync-assets.mjs` on every dev/build (`*-gamefiles.json` filtered out)
- Committed: No (gitignored). **Never edit here — edit `assets/`.**

**`public/downloads/`:**
- Purpose: self-contained onepager downloads
- Generated: Yes (`scripts/build-downloads.mjs` from `public/onepager/`)
- Committed: No

**`dist/`:**
- Purpose: static build output copied into the nginx image
- Generated: Yes · Committed: No

**`public/holo/`, `public/vendor/`, `public/onepager/`:**
- Purpose: 3D holo meshes, third-party browser libs (three.js), source onepagers
- Generated: `holo/` via `npm run build:holo-meshes` · Committed: Yes

**`assets/*-gamefiles.json`:**
- Purpose: raw DataCore/`Data.p4k` extracts used only as build input
- Generated: Yes (`datamine-*`) · Committed: No — machine-specific and absent in CI

**`docs/`:**
- Purpose: long-form datamining deep dives (`item-finder-datacore-deep-dive.md`, `item-finder-armor-sets-deep-dive.md`, `item-crafting-static-pages.md`)
- Committed: Yes. Root-level `PATCH-DATA.md`, `MINING-DATENQUELLE.md`, `FAKTEN-AUDIT.md` hold source-of-truth notes for the data layer.

---

*Structure analysis: 2026-07-27*
