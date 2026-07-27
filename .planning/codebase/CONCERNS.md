# Codebase Concerns

**Analysis Date:** 2026-07-27

Scope: full repo (Astro static site, bilingual DE/EN), excluding `dist/`, `node_modules/`, `.claude/`.
Two concern classes dominate and are treated as the spine of this document:

- **Class A — bilingual page-pair drift.** Every page exists twice as a hand-maintained file
  (`src/pages/X.astro` and `src/pages/de/X.astro`). There is no shared shell that guarantees the
  two stay identical apart from language. Redesigns land on one side only.
- **Class B — decorative overlays and stacked opacity over text.** A fixed, site-wide overlay
  plus per-component opacity gates sit on top of body copy. Individual layers look mild; they
  multiply.

---

## Tech Debt

### Class A — bilingual page pairs drift apart

**Root cause:** the DE and EN page for a route share only the inner components
(e.g. `src/components/PrecisionJumpApp.astro`). Head, palette, inline `<style>`, prose, page
chrome and stylesheet links are duplicated by hand in both files. Nothing in the build compares
them. 67 EN/DE page pairs are maintained this way under `src/pages/` vs `src/pages/de/`.

**A1 — `precision-jump.astro`: EN rebuilt, DE left on the old layout (confirmed)**
- Files: `src/pages/precision-jump.astro` (147 lines) vs `src/pages/de/precision-jump.astro` (93 lines)
- Evidence — present in EN only, 45 CSS lines and their markup have no DE counterpart:
  - the whole "Abbildung 1" ring figure: frontmatter computation `DENSITY_H` / `scaleX` / `figure`
    (`src/pages/precision-jump.astro:21-45`) and the `.ring*` rule block (lines 92-108)
  - compact title area — `.alm` padding `clamp(1.2rem,3vw,2rem)` (EN line 77) vs
    `clamp(2.5rem,7vw,5rem)` (DE line 43); `.alm__title` `clamp(1.7rem,3.4vw,2.4rem)` (EN line 82)
    vs `clamp(2.2rem,5.5vw,3.8rem)` (DE line 48)
  - explanatory prose moved *below* the tool into `.alm__foot` (EN lines 86-90, 133-141); DE still
    carries it *above* the tool inside `<header>` in `.alm__body` (DE lines 51-53, 67-79)
- Impact: a German visitor gets the pre-redesign page — big hero, tool pushed below the fold, no
  ring figure — while `hreflang` claims the pages are equivalent (`translated={true}` on both).
- Fix approach: port the EN shell to DE, translating only the prose. Better: move title area,
  ring figure and foot text into a `PrecisionJumpPage.astro` component that takes `lang`, so the
  two route files shrink to head + component call.

**A2 — DE auth pages never load the shared account stylesheet (same class, different route)**
- Files: `src/pages/de/account/login.astro`, `.../register.astro`, `.../reset.astro`,
  `.../update-password.astro`
- Evidence: the EN files link both stylesheets —
  `src/pages/account/login.astro:16-17` has `/assets/detail.css` **and** `/assets/account.css`,
  with the inline style reduced to the comment *"Palette lebt jetzt in /assets/account.css
  (geteilt, entdoppelt)"* (line 19). The DE mirrors link only `/assets/detail.css`
  (`src/pages/de/account/login.astro:16`) and still carry the extracted palette as a stale inline
  copy (`:root{...--accent:#2dd4ff...}` at lines 19-21).
- `src/pages/de/account/index.astro` *does* link `account.css` — so the DE account section is
  internally inconsistent too.
- Impact: every rule that lives only in `assets/account.css` (e.g. the `.acx-input`,
  `.acx-modal`, `.acx-upload`, `.acx-tabs-nav` treatments) is missing on the four German auth
  screens. The palette on those pages is a frozen fork: editing `assets/account.css` silently
  changes EN sign-in and leaves DE sign-in behind.
- Fix approach: add the `account.css` link (hashed, see D1) to the four DE files and delete the
  inline `:root` blocks.

**A3 — EN-only pages with no DE counterpart**
- `src/pages/404.astro` — German visitors hitting a bad URL get an English 404.
- `src/pages/account/preview.astro` — 1404-line design-lab page, no DE mirror, still shipped.
- Fix approach: mirror 404 under `src/pages/de/`; delete `account/preview.astro` (see F2).

**A4 — no guard against future drift**
- There is no check that a DE page and its EN base load the same stylesheets or declare the same
  selectors. The audit script family (`npm run audit`) covers SEO/a11y, not pair parity.
- Fix approach: add a pair-parity check that, for each `src/pages/de/**/*.astro`, compares the set
  of `<link rel="stylesheet">` hrefs and the set of CSS selectors inside `<style is:inline>`
  against the EN base file, and fails the build on a mismatch. Both signals found A1 and A2
  reliably in this audit and produced no false positives on the 63 clean pairs.

### Copy-pasted page chrome instead of a shared shell

- 38 patch pages (`src/pages/patches/sc-*.astro` and `src/pages/de/patches/sc-*.astro`) each inline
  their own byte-identical copy of the overlay/skip-link/cursor-glow block — e.g.
  `src/pages/patches/sc-4-0-0.astro:38-42`, mirrored in all 37 others.
- Same for the light-mode palette comment block *"erzeugt von scripts/build-light-palettes.mjs"* —
  repeated per page rather than per theme.
- Impact: any chrome change is a 38-file edit; this is the mechanism that produced A1/A2.
- Fix approach: a `PatchPage.astro` layout owning skip link, `.cursorglow` and palette; pages pass
  only their accent tokens and content.

---

## Known Bugs

**B1 — `body::after` overlay is redefined per page with a hardcoded opacity, defeating the token**
- Token: `assets/theme.css:83` `--ambient-opacity: 0.5` (dark) and `assets/theme.css:135`
  `--ambient-opacity: 0.4` (light).
- Correct consumer: `assets/detail.css:48` uses `opacity:var(--ambient-opacity)`.
- Broken consumers: all 38 patch pages redeclare the same `body::after` with a literal
  `opacity:.5`, e.g. `src/pages/patches/sc-4-9-0.astro:42`, `src/pages/de/patches/sc-4-0-0.astro:41`.
  Because these inline blocks come after the linked `detail.css`, the literal wins.
- Impact: light mode on every patch page runs the ambient layer at 0.5 instead of the intended
  0.4, and any future tuning of `--ambient-opacity` is a no-op on the 38 highest-traffic pages.
- Fix: replace the literal with `var(--ambient-opacity)`, or delete the inline rule entirely once
  `detail.css` is linked (it always is on those pages).

**B2 — `.alm__page` / `.alm__marg` rules in the EN precision-jump page target markup that does not exist**
- `src/pages/precision-jump.astro:114-118` styles `.alm__page` and `.alm__marg` inside a
  `@media(max-width:1000px)` block. Neither class appears anywhere in the file's markup
  (the two-column "Marginalspalte" layout described in the header comment at lines 5-9 was not
  built).
- Impact: dead CSS plus a header comment that documents a layout the page does not have — the next
  editor will trust the comment.

---

## Security Considerations

**Legal pages still carry unfilled placeholders**
- `src/pages/impressum.astro:3`, `src/pages/de/impressum.astro:2`,
  `src/pages/datenschutz.astro:4`, `src/pages/de/datenschutz.astro:4` all state that `[TODO]`
  fields must be filled before publishing.
- Risk: German Impressumspflicht (§ 5 DDG / § 18 MStV) — an incomplete Impressum on a publicly
  reachable site is an abmahnfähiger Mangel.
- Current mitigation: none visible in code.
- Recommendation: verify the rendered pages against the checklist and remove the TODO notes, or
  make the build fail while a placeholder is present.

**Design-lab page shipped to production**
- `src/pages/account/preview.astro` (1404 lines) is a design experiment with no DE mirror and no
  link from the nav, yet it builds to a public URL.
- Recommendation: delete it, or gate it behind the build (`import.meta.env.DEV`).

---

## Performance Bottlenecks

**Unhashed links to the largest shared assets**
- `src/lib/assetVersion.ts` exists specifically to append a sha1 content hash (`?v=<sha1-8>`),
  and is used correctly for `archive.css` (`src/pages/archiv.astro:30`), `crafting-app.js`,
  `item-finder-app.js`, `account-lite.js`, `account.css` on `src/pages/account/index.astro:15`.
- But the site-wide files are linked raw, with no version at all:
  - `src/layouts/Layout.astro:194` `/assets/fonts.css`
  - `src/layouts/Layout.astro:198` `/assets/theme.css`
  - `/assets/detail.css` and `/assets/detail.js` on every page
    (e.g. `src/pages/precision-jump.astro:55` and `:146`, `src/pages/feedback.astro:18`,
    `src/pages/downloads.astro:93`, `src/components/MissionDetail.astro:143`)
  - `/assets/account.css` on the four EN auth pages
    (`src/pages/account/login.astro:17` and siblings)
- `/assets/*` is served with `max-age=86400`, so a change to `theme.css` or `detail.css` — the two
  files that control the whole visual system — reaches returning visitors up to a day late, and
  CDN-late beyond that. This is the exact failure mode already recorded for `data-page.css`.
- Fix: route these through `assetVersion.ts` like the other assets.

**Manual counter cache-bust (same trap, unfixed)**
- `src/components/MissionsApp.astro:249` `/assets/missions-app.js?v=2` and
  `src/components/MiningApp.astro:211/215` `?v=<snapshot_date>-c5` still use hand-maintained
  suffixes. Any edit without bumping the counter ships stale JS.

---

## Fragile Areas

### Class B — decorative overlays and stacked opacity over text

Layers currently stacked over page content, from the top down:

| Layer | Defined at | Effect over text |
|-------|-----------|------------------|
| `body::after` — vignette + CRT scanlines, `z-index:9000`, `opacity:.5` | `assets/detail.css:48`; tokens `assets/theme.css:81-83` | Global. `--vignette: rgba(0,0,0,0.62)` darkens the page edges; `--scanline: rgba(0,0,0,0.14)` lays a 1-in-3-pixel black grid over every glyph |
| `.cursorglow` — accent radial, `z-index:8800` | `assets/detail.css:49`, plus 38 inline copies | Accent wash follows the pointer across body copy |
| `#embers` — `mix-blend-mode:screen; opacity:.85` | `assets/detail.css:286` | Screen blend lightens text on pages that use it |
| `#stars` — `opacity:.5` inside the hero | `assets/detail.css:94` | Behind hero text, adds noise under the title |
| `.sstep` — text held at `opacity:.5` until JS adds `.active` | `assets/detail.css:315-316` | Scrollytelling body copy on 34 pages |

**B-1 — the site-wide ambient overlay is the biggest single contrast tax (confirmed)**
- `assets/theme.css:83` `--ambient-opacity: 0.5`; consumed by `assets/detail.css:48` as a
  `position:fixed; inset:0; z-index:9000` layer above *all* content on *every* page.
- The scanline component is a repeating black band at 0.14 alpha covering one of every three
  device pixels; the vignette reaches 0.62 alpha black at the corners, exactly where the nav,
  breadcrumbs and footer text sit. Both are multiplied by the 0.5 ambient opacity, then compound
  with per-page scrims (`--scrim-4: rgba(0,0,0,0.58)`, `assets/theme.css:163`).
- Impact: measured contrast for `--muted` text (`#9aa6bd`) degrades most near page edges — the
  region occupied by chrome and captions, i.e. the smallest type on the page.
- Fix approach: drop `--ambient-opacity` substantially (0.5 → ~0.2), or scope `body::after` so the
  scanline half applies only to media/hero regions and the vignette stops before the text column.
  Verify with a contrast pass rather than by eye — the layer is subtle per-pixel and severe in
  aggregate.

**B-2 — `.sstep` leaves body copy at 50 % opacity when JS does not run**
- `assets/detail.css:315` sets `.sstep{opacity:.5}`; only `.sstep.active` (line 316) restores it,
  and `.active` is applied exclusively by the scroll handler in `assets/detail.js:133`.
- 34 pages use `.sstep`. Without JS — or if the observer misses — that copy renders at 0.5 opacity
  *under* the 0.5 ambient overlay.
- The `prefers-reduced-motion` escape at `assets/detail.css:333` covers `.reveal` but **not**
  `.sstep`.
- Fix: add `.sstep` to the reduced-motion rule and make the default state opaque, animating
  *away* from full opacity instead of toward it.

**B-3 — `.reveal` hides content by default; 24 pages already work around it**
- `assets/detail.css:278` `.reveal{opacity:0}`; `.in` is added only by the IntersectionObserver at
  `assets/detail.js:13-14` with `threshold:.12`.
- 24 page files ship a defensive override `.reveal{opacity:1 !important;transform:none !important}`.
  The reason is documented in `src/pages/topics/wikelo-emporium.astro`: a very tall card column
  never reaches the 12 % visibility threshold on mobile, so the content *"would stay opacity:0
  forever"*.
- Impact: the remaining ~40 pages still gate their content behind JS + a threshold that is known
  to be unreachable for tall elements. This is a content-disappears bug waiting for the next tall
  section.
- Fix: switch the threshold to `0` with a root margin, or invert the pattern so content is visible
  by default and the animation is additive. Then delete the 24 overrides.

**B-4 — blend modes over text**
- `mix-blend-mode:screen` / `overlay` on `assets/archive.css:190,1150,1165`,
  `src/components/SiteNav.astro:860,1036`, `src/components/account/ProfileCard.astro:349`,
  `src/components/pilot/PilotPage.astro:416`, `assets/account-dossier.css:144`.
- Blend modes make the resulting contrast depend on whatever happens to be behind the element, so
  no static contrast check covers them. `assets/account-dossier.css:21` already had to zero
  `--scanline` because the CRT lines *"schlagen auf dem hellen Hero-Namen als Glitch durch"* —
  evidence this class of effect has already broken legibility once and was patched locally rather
  than at the source.

### Large single files

`src/components/ShipDetail.astro` (2135), `assets/archive.css` (1796),
`src/components/SiteNav.astro` (1574), `src/scripts/account-dashboard.ts` (1546),
`assets/crafting-app.js` (1448), `src/pages/account/preview.astro` (1404),
`src/components/PrecisionJumpApp.astro` (1265). Changes here are hard to review and are the files
most likely to be edited on one language side only.

---

## Scaling Limits

**Page-pair maintenance cost grows linearly with routes**
- Current: 67 hand-maintained EN/DE `.astro` pairs plus 38 patch pages with duplicated chrome.
- Limit: every new route adds two files that must be kept identical by human diligence. Two
  drifts (A1, A2) already exist across 5 files.
- Scaling path: shared page components taking `lang`, as already done for `PrecisionJumpApp`,
  `AccountShell`, `AuthLogin`, `CraftingApp` — the route file should be head + one component.

---

## Dependencies at Risk

Not detected as a concern in this pass — the risk profile of this repo is duplication and
presentation, not third-party packages.

---

## Missing Critical Features

**No parity gate between language trees** — see A4. Without it, every drift found here can recur
silently on the next redesign.

**No contrast verification for stacked layers** — the overlay/blend stack (B-1…B-4) is invisible
to token-level review because each layer is individually mild.

---

## Test Coverage Gaps

**Bilingual parity**
- What is not tested: that `src/pages/de/**` and `src/pages/**` load the same stylesheets, declare
  the same CSS selectors and render the same section structure.
- Risk: language-specific regressions ship unnoticed; A1 shipped and survived a redesign.
- Priority: **High** — cheap to add, catches the dominant defect class.

**Rendered contrast**
- What is not tested: effective contrast of body/`--muted` text with `body::after`, per-page
  scrims and `.sstep`/`.reveal` opacity applied.
- Files: `assets/theme.css`, `assets/detail.css`, and the 38 patch pages.
- Risk: legibility degrades incrementally with each new decorative layer.
- Priority: **High**.

**No-JS / observer-failure rendering**
- What is not tested: what a page looks like when `assets/detail.js` does not execute.
- Risk: `.reveal` (opacity 0) and `.sstep` (opacity .5) hide or dim primary content on ~74 pages.
- Priority: **Medium** — mitigated ad hoc on 24 pages, unmitigated elsewhere.

**Token-vs-literal drift**
- What is not tested: that pages consume `--ambient-opacity`, `--vignette`, `--scanline` rather
  than hardcoding values. 38 pages currently hardcode (B1).
- Priority: **Medium**.

---

*Concerns audit: 2026-07-27*
