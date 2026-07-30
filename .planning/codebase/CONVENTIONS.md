# Coding Conventions

**Analysis Date:** 2026-07-27

## Language of the Code Itself

**Source comments are predominantly GERMAN — that is the house convention.**
Write new comments in German unless you are editing a file whose existing header
is English. Examples: `src/lib/seo.ts`, `src/lib/assetVersion.ts`,
`src/i18n/ui.ts`, `assets/item-finder-app.js`, `scripts/audit-site.mjs`.
A few older shells are English (`src/layouts/Layout.astro`, `scripts/_verify.mjs`);
match the file you are in, default to German for new files.

**Comment content convention:** headers explain *why*, including the bug that
caused the code to exist. See `src/lib/assetVersion.ts` (documents the observed
`cf-cache-status: HIT, age: 6213`) and `src/lib/seo.ts` (documents the
noindex/sitemap contradiction). Keep this — comments are the project's memory.

**UI text is never hardcoded German or English in shared chrome.** Recurring
strings live in the catalog `src/i18n/ui.ts` (flat dot-keys, `t()` falls back to
EN visibly instead of crashing). Bespoke page prose lives in the page, once per
locale (`src/pages/x.astro` = EN, `src/pages/de/x.astro` = DE).

## Naming Patterns

**Files:**
- Astro components: `PascalCase.astro` — `src/components/ItemDetail.astro`
- TS library modules: `camelCase.ts` — `src/lib/assetVersion.ts`, `src/lib/itemStats.ts`
- Pages: lowercase-kebab, EN path is the base form — `src/pages/item-finder.astro`,
  DE twin at `src/pages/de/item-finder.astro`
- Node build/mining scripts: `kebab-case.mjs` — `scripts/build-universal-db.mjs`.
  Verb prefixes are meaningful: `datamine-*` (extract from Data.p4k/DataCore),
  `build-*` (derive a JSON/asset), `sync-*` (fetch external API), `fetch-uex-*`,
  `verify-*` / `audit-*` (gates). Leading underscore = internal/always-run
  (`scripts/_verify.mjs`, `scripts/_sync-assets.mjs`).
- Static client apps: `kebab-case.js` in `assets/` — `assets/item-finder-app.js`
- Tests: `*.test.js` under `tests/e2e/`

**Functions:** `camelCase` (`toBaseForm`, `versioned`, `stripHiddenSubtrees`).
Short local helpers are fine and common (`esc`, `tr`, `rel`, `walk`).

**Variables:** `camelCase`. Module-level constants are `SCREAMING_SNAKE`
(`NOINDEX_PATHS`, `DEFAULT_LOCALE`, `RARITY_ORDER`, `LIGHT_RULES`).

**Types:** `PascalCase` (`Locale`, `Props`). Astro component props are declared
as a local `interface Props` above the destructure — see
`src/layouts/Layout.astro:12`.

**CSS classes:** short page-scoped prefixes, not BEM-strict.
`uif-*` (item finder), `uf-*` (item-finder page chrome), `dp-*` (data page),
`ph__chip` / `hero__in` (double-underscore element parts). New page = new prefix.

## Code Style

**Formatting:**
- No Prettier, ESLint, Biome or EditorConfig exists — style is by imitation.
- 2-space indent, single quotes, semicolons in `.ts`/`.mjs`/`.astro` frontmatter.
- Inline `<style>` CSS inside `.astro` is written DENSE (one rule per line, no
  spaces after `:`/`;`) on purpose — see `src/pages/item-finder.astro:16-36`.
  Keep that density; the theme generators parse these blocks.

**Type checking:** `tsconfig.json` extends `astro/tsconfigs/strict`, includes
`**/*`, excludes `dist`. No `any` escape hatches in `src/lib`.

**Module system:** ESM everywhere (`"type": "module"`). Node scripts use
top-level `await` and `node:`-prefixed builtins (`node:fs/promises`, `node:path`,
`node:crypto`). Client scripts in `assets/*.js` are the exception: ES5-style
IIFE with `var`, no modules, no build step — they are served verbatim.

## Styling & Theme Rules (load-bearing)

**Token layer:** `assets/theme.css` is loaded by `src/layouts/Layout.astro` on
EVERY page, before page CSS. It holds three token groups and no layout rules:
1. base tokens (`--bg`, `--surface`, `--text`, `--accent`) — fallbacks only,
2. effect tokens (`--veil`, `--vignette`, `--shadow-*`, `--chrome-*`) — use these
   instead of hardcoded black/white, otherwise light mode breaks,
3. media tokens (`--scrim-*`, `--on-media*`, `--title-*`) — deliberately dark in
   BOTH modes, because they sit over photos.

**Per-page palette rule:** every page carries its own inline `<style is:inline>`
block that opens with a `:root{…}` dark palette (its identity), immediately
followed by a GENERATED `:root[data-theme="light"]{…}` twin carrying the comment
`Hellmodus — erzeugt von scripts/build-light-palettes.mjs. Nicht von Hand ändern.`
Specificity `(0,2,0)` beats the page `:root` `(0,1,0)`, so no dark value is ever
edited for light mode.

**Therefore:** after touching a page's `:root{}` palette, run `npm run theme`
(`build-light-palettes` → `tokenize-theme-colors` → `build-light-overrides`).
The generators only see inline `<style>` inside `.astro` — a standalone
`assets/*.css` needs its light mode written by hand.

**Cache busting:** assets referenced under a fixed URL (`/assets/*.css|js`) must
go through `versioned()` from `src/lib/assetVersion.ts` (sha1 content hash,
memoized per process). Never hand-increment a `?v=N`.

**Asset canon:** `assets/` is the canonical location; `public/assets/` is a copy
produced by `scripts/_sync-assets.mjs` at the start of `dev` and `build`. Edit
`assets/`, never `public/assets/` or `dist/`.

## Import Organization

**Order in `.astro` frontmatter:**
1. Layout, then components (`../layouts/Layout.astro`, `../components/…`)
2. shared libs (`../consts`, `../i18n/ui`, `../lib/seo`)
3. data JSON (`../../assets/universal-items.json`)

**Path aliases:** none — relative paths only. Cross-boundary imports from `src/`
into `scripts/lib/*.mjs` do happen (`Layout.astro` imports `LIGHT_RULES` from
`scripts/lib/theme-color.mjs`) and are acceptable.

**Cycle discipline:** `src/lib/seo.ts` deliberately has ZERO imports and
re-implements `toBaseForm` because `sitemap.xml.ts` must not import `i18n/ui`
(cycle). Keep that note if you touch it.

## Error Handling

- **Build scripts fail loud:** missing prerequisite → `console.error` +
  `process.exit(2)` (`scripts/audit-site.mjs:14`). Findings → `process.exitCode = 1`
  (`scripts/_verify.mjs:44`), so all output is printed before exiting.
- **Findings are classified**, not just thrown: `errors` (publish-blocking),
  `warns`, `infos` in `scripts/audit-site.mjs:42`. Only `errors` exit non-zero.
- **External APIs are non-fatal:** sync steps in `.github/workflows/build.yml`
  use `continue-on-error: true` — the site rebuilds from the last good snapshot.
  This "last-good snapshot" principle is an architectural rule, not an accident.
- **Runtime code degrades silently with a documented fallback:**
  `try { hash } catch { ver = 'x' }` in `src/lib/assetVersion.ts:32`; a missing
  i18n key falls back to EN rather than crashing.
- **Never fabricate data.** Unknown values are rendered as an honest "catalog
  only" state (`assets/item-finder-app.js` header); `tests/e2e/db.test.js`
  asserts the DB note `Keine fabrizierten Werte`.

## Logging

**Framework:** `console.log` / `console.error` in Node scripts only. No logger.

**Pattern:** scripts print a compact summary (counts first, then findings,
capped: `.slice(0, 50)`) and end with a checkmark line such as
`ALL LOCAL REFERENCES RESOLVE ✓`. Client code logs nothing in production paths.

## Comments

**When to comment:** at the top of every module (purpose + the problem it
solves), and inline wherever a line looks removable but is not — e.g. the VOID
element list in `scripts/audit-site.mjs:64` or the naming clash warning in
`assets/item-finder-app.js:8`. Comments explaining *deliberate omissions* are
expected (`/* … steht bewusst NICHT hier */` in `src/pages/item-finder.astro:64`).

**JSDoc/TSDoc:** used for exported functions and non-obvious props in `src/lib`
and `src/layouts/Layout.astro` (`/** drives <meta theme-color> … */`). Full
`@param` blocks appear where the argument is a path convention
(`src/lib/assetVersion.ts:21`).

## Function Design

**Size:** small pure helpers in `src/lib`; long procedural top-level flow is
accepted in `scripts/*.mjs` (they are one-shot pipelines).

**Parameters:** positional for 1–2 args; options object for more. Astro
components take a typed `Props` interface with defaults in the destructure.

**Return values:** predicates return `boolean` (`isNoindex`), builders return a
string/array; scripts return nothing and set `process.exitCode`.

## Module Design

**Exports:** named exports only, no default exports in `src/lib` / `src/i18n`.
Constants and their predicate are exported together (`NOINDEX_PATHS` +
`isNoindex`) so both the layout and the sitemap consume one source of truth.

**Barrel files:** none. Import the specific module.

**Single-source-of-truth rule:** if a decision is read in two places, it must
live in one module and be enforced by `scripts/audit-site.mjs`. `src/lib/seo.ts`
is the reference implementation of this pattern.

## Gates (run before calling work done)

```bash
npm run build        # syncs assets, thumbs, downloads, then astro build
npm run verify       # scripts/_verify.mjs — every local href/src/url() resolves in dist/
npm run audit:site   # scripts/audit-site.mjs — links, anchors, DE/EN parity, SEO meta,
                     # media repetition, placeholders, mojibake, a11y, page weight
npm run test:e2e     # node --test tests/e2e/**/*.test.js
npm run theme        # after any :root{} palette change
```
`verify` and `audit:site` require a fresh `dist/`. `audit:site` exits 1 only on
FEHLER-class findings; WARNUNGEN do not block.

---

*Convention analysis: 2026-07-27*
