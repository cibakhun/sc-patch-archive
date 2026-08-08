# Phase 3: Überlagerungen entstapeln - Research

**Researched:** 2026-08-08
**Domain:** CSS layer/stacking-context restructuring + programmatic WCAG contrast measurement on a hand-written, bundler-free Astro static site
**Confidence:** MEDIUM-HIGH (all claims verified by direct codebase reading and manual reasoning against actual source; no external tooling was available this session — see `<user_constraints>`/config note below)

> **No web-search tooling was used.** `.planning/config.json` has `brave_search`, `exa_search`,
> `tavily_search`, `firecrawl`, `ref_search`, `perplexity`, `jina` all `false`. This phase is pure
> platform-CSS/JS (IntersectionObserver, `mask-image`, alpha compositing, WCAG contrast math) —
> nothing here needs a third-party library lookup. Every finding below was produced by reading the
> actual files in this repo (tagged `[VERIFIED: local codebase]`) or by reasoning from well-known
> web-platform spec behavior that was NOT re-fetched this session (tagged `[ASSUMED]` per the
> provenance rule, even where confidence is high).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01: Die Ambiente-Schicht wird RÄUMLICH BEGRENZT, nicht nur gedimmt.** CRT-Zeilen nur noch
  über Bild- und Hero-Bereichen; die Vignette endet vor der Textspalte. Begründung des
  Betreibers: Dämpfen verdünnt das Problem, Begrenzen behebt es — und der Effekt bleibt dort
  erhalten, wo er gestalterisch gemeint war. — **Reversibility:** costly — `body::after` ist eine
  einzige globale Regel; sie in bereichsgebundene Regeln zu zerlegen berührt die Struktur, nicht
  nur einen Wert.
- **D-02: `.sstep` bekommt BEIDES** — der Standardzustand wird undurchsichtig (die Animation
  blendet höchstens *von* voller Deckkraft weg statt zu ihr hin), UND `.sstep` kommt in die
  `prefers-reduced-motion`-Regel, in der heute nur `.reveal` steht. Damit sind der Ohne-JS-Fall
  und der Reduzierte-Bewegung-Fall beide zu.
- **D-03: Bei `.reveal` wird die URSACHE behoben**, nicht das Symptom verwaltet: die
  Sichtbarkeitsschwelle so ändern, dass auch sehr hohe Elemente auslösen (z. B. `rootMargin`
  statt `threshold`), danach die **21 defensiven `!important`-Overrides entfernen**. Eine Lösung
  an einer Stelle statt an 21 — und künftige Seiten erben sie.
- **D-04: Maßstab ist WCAG AA** — 4,5:1 für Fließtext, 3:1 für große Schrift, **in beiden
  Farbmodi**. Nicht nur messen und dokumentieren: der Wert ist eine Zielmarke, die erreicht
  werden muss.

### Claude's Discretion

- Wie „Bild-/Hero-Bereich" und „Textspalte" technisch abgegrenzt werden (eigene Klassen,
  Container-Query, `:has()`, eigene Pseudo-Elemente je Bereich)
- Ob `--ambient-opacity` zusätzlich sinkt, solange die räumliche Begrenzung die Hauptarbeit tut
- Welcher Mechanismus die `.reveal`-Schwelle ersetzt
- Welche Textstellen als „betroffen" gelten und damit gemessen werden müssen — die Auswahl muss
  begründet und vollständig sein, nicht stichprobenhaft
- Ob die Kontrastmessung ein bleibendes Prüfskript wird oder eine einmalige Erhebung

### Deferred Ideas (OUT OF SCOPE)

- `#embers` (`mix-blend-mode:screen`) und `#stars` grundsätzlich überarbeiten — sie stehen in der
  Class-B-Tabelle, laufen aber seit Phase 1.1 nur noch auf ausdrücklichen Wunsch. Ihre Wirkung
  über Text ist damit ein Sonderfall, kein Regelfall.
- Die Scrim-Werte (`--scrim-1` bis `--scrim-4`) als eigene Skala vereinheitlichen — wäre die
  logische Fortsetzung von Phase 2, ist hier aber nicht verlangt.

### Phase Boundary (verbatim)

Der Class-B-Befund aus `.planning/codebase/CONCERNS.md` wird abgetragen: Text steht nicht mehr
hinter mehr als einer dekorativen Deckkraftschicht, und für jede betroffene Stelle liegt ein
**gemessener** Kontrastwert für Hell- und Dunkelmodus vor. Ausdrücklich NICHT in dieser Phase:
Farbpalette, Bildmotive, Layout und Typografie. Die Ambiente-Effekte selbst (Partikel, Ken Burns,
Parallaxe) sind unberührt — nur Schichten über **Text**.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LAYER-01 | Die in `CONCERNS.md` als Class B verzeichneten dekorativen Überlagerungen über Text sind abgetragen | § D-01 mechanism (mask + scoped scanline), § `.sstep`/`.reveal` fixes, § file inventory below |
| LAYER-02 | Text über Bildmotiven erreicht in beiden Farbmodi einen belegten Kontrastwert | § "The contrast measurement must be real" — compositing methodology, `sharp` pixel sampling, reuse of `scripts/lib/theme-color.mjs` |
| THEME-02 (constraint, not delivered here) | Kein generierter `:root[data-theme="light"]`-Block wird von Hand verändert | § Pitfall: `assets/theme.css` is generated — any new light-mode token this phase needs must go through `npm run theme`, not a hand edit |
| SYNC-01 (constraint, not delivered here) | Jede Änderung an Startseiten-/Layout-Dateien trifft EN+DE im selben Schritt | § Verification gate design reuses the EN/DE pairing logic from `verify-typo-motion.mjs`/`verify-fx.mjs`; every file this phase touches already exists as one shared DE+EN body (post Phase-1.x consolidation) or as an EN/DE pair — see inventory |
</phase_requirements>

## Summary

This phase is pure CSS/JS platform-mechanics work on an existing, hand-written, bundler-free
Astro codebase. There is nothing to install and nothing to look up externally — the risk is
entirely in getting the **stacking/compositing model right** and in **not missing files that
carry independent copies of the same rules**.

Three concrete, load-bearing findings change the shape of the plan versus a naive reading of
CONCERNS.md:

1. **CONCERNS' "38 patch pages" is stale.** Since the Phase-1.x body consolidation, there are
   **19** patch bodies (`src/components/patches/sc-*.astro`), each serving both DE and EN. Good
   news for scope, but each of those 19 files carries its **own complete inline copy** of the
   `body::after` rule and all archetype CSS (`.hero`, `.band`, `.split__media`, …) inside
   `<style is:inline>` — they do **not** link `assets/detail.css`. Any change to the shared
   archetype rules must be applied identically in `assets/detail.css` **and** in all 19 patch
   files, or the two systems drift (exactly the Class-A failure mode CONCERNS warns about).
2. **`.reveal`'s threshold bug has a second, independent implementation.** `assets/archive.js`
   (used only by `/archiv`, a completely separate design system from `detail.js`/`detail.css`)
   has its own `.reveal` IntersectionObserver at the same `{threshold:0.12}` — the identical bug,
   in a file the CONTEXT canonical refs do not mention. See Open Questions.
3. **A working alpha-compositing WCAG contrast primitive already exists in this repo**
   (`scripts/lib/theme-color.mjs`, exports `luminance()` and `contrast()`, used today by the
   light-palette generator). It does not yet do alpha blending — but that's a ~10-line addition,
   not a new dependency. Combined with `sharp` (already resolvable from `node_modules`, already
   imported directly in `scripts/build-thumbs.mjs`), a **real**, non-CSS-only contrast
   measurement is buildable entirely from existing project pieces: sample actual hero/band photo
   pixels with `sharp`, alpha-composite scrim → ambient → text on top of that sampled pixel in
   plain JS, then feed the two final opaque colors into the existing `contrast()` function.

**Primary recommendation:** Solve D-01's vignette half with a single `mask-image` addition to the
existing `body::after` rule (keyed off `var(--maxw)`, no restructuring); solve its scanline half by
moving the scanline gradient out of `body::after` entirely and onto a new `::before` pseudo-element
on each media-archetype container (`.hero`, `.band`, `.split__media`, `.scrolly__media`, `.video`,
etc. — all of which currently use `::after` for their scrim, leaving `::before` free); fix `.reveal`
by changing its IntersectionObserver to `threshold:0` (mathematically eliminates the "never fires
for a tall element" failure mode, not just works around it); and build the LAYER-02 contrast gate
on top of the two already-existing local primitives (`theme-color.mjs` + `sharp`) rather than
introducing a browser/screenshot dependency this project does not have.

## Architectural Responsibility Map

This project has no SSR/API/DB tier in production — it is a static Astro build served by nginx.
The 5-tier framework below is adapted accordingly; most capabilities land in "Browser/Client"
(shipped CSS/JS) or a informal "Build tooling" tier (Node scripts that run before `astro build`
and are not part of the runtime request path).

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Vignette spatial masking (`body::after` + `mask-image`) | Browser/Client (CSS) | — | Pure CSS, evaluated per-frame by the browser's compositor; no JS needed |
| Scanline scoping to media containers (new `::before` per archetype) | Browser/Client (CSS) | — | Same — static rule, no runtime cost |
| `.reveal` / `.sstep` visibility gating | Browser/Client (JS: `assets/detail.js`, `assets/archive.js`) | Browser/Client (CSS: `assets/detail.css`, `assets/archive.css`) | IntersectionObserver is a browser API; the CSS default state must be safe independent of whether the JS runs at all |
| Contrast sampling of hero/band photos | Build tooling (Node, `sharp`) | — | Runs at verification time against `public/assets/*.jpg` / built `dist/`, never in the browser — there is no server-side rendering path in this project to do it live |
| WCAG ratio computation | Build tooling (Node, `scripts/lib/theme-color.mjs`) | — | Pure math, already exists, extend in place |
| Verification gate (pass/fail against measured contrast) | Build tooling (Node, new `scripts/verify-layers.mjs` or similar) | CDN/Static (Dockerfile gate, like `verify:typo`/`verify:fx`) | Mirrors the existing `verify:*` family: runs after build, blocks the delivery image, not `npm run build` itself |

## Standard Stack

No new packages. This phase is entirely built from platform CSS/JS plus two pieces already in the
repo.

### Core

| Tool | Version | Purpose | Why Standard (here) |
|------|---------|---------|----------------------|
| `sharp` | `^0.34.0` (resolved transitively via Astro; already used directly in `scripts/build-thumbs.mjs`) [VERIFIED: local codebase — `node_modules/sharp` present, version pinned in `package-lock.json:1916,3893`] | Sample real pixel colors from hero/band JPEGs for the contrast gate | Already resolvable with zero new install; this project already imports it directly for a different script, establishing the pattern |
| `scripts/lib/theme-color.mjs` | in-repo, no version | `parseColor`, `luminance`, `contrast` (WCAG 2.1 formula), already used by `npm run theme` | Reuse instead of hand-rolling WCAG math a second time — avoids the "Don't Hand-Roll" trap for exactly this problem |
| CSS `mask-image` / `-webkit-mask-image` | Platform (no version) [ASSUMED — general web-platform knowledge, not re-verified via docs this session] | Spatially exclude the vignette from the text column without restructuring `body::after` | Native, zero-dependency, degrades to current (unmasked) behavior in unsupported browsers rather than breaking |
| `IntersectionObserver` `threshold`/`rootMargin` | Platform (no version) [ASSUMED] | Replace `.reveal`'s broken `threshold:.12` | Already the mechanism in use; the fix is a parameter change, not a new API |

### Supporting

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `scripts/migrate-typo-motion.mjs` (pattern, not code) | Precedent for a scripted, verifiable mass-edit across many near-duplicate files with before/after counts | If the planner decides to codemod the 19 patch files' inline `body::after`/archetype copies instead of hand-editing each |
| `scripts/verify-typo-motion.mjs` / `verify-fx.mjs` (pattern) | Precedent for a `dist/`-based, multi-location (theme.css + `_astro/*.css` + all `.html`), EN/DE-paired verification gate | Model for the new LAYER-01/LAYER-02 gate |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `sharp` pixel sampling for contrast | Headless-browser screenshot (Playwright/Puppeteer) + pixel read | **Not available in this repo** — `package.json` has no `devDependencies` at all besides 3D asset tooling (`@gltf-transform/*`, `three`, `draco3d`, `meshoptimizer`); adding a full browser automation stack is a much larger footprint than the phase needs, and Windows fork/PATH issues already documented in project memory (`windows-env-fallen.md`, "Browser-Pane viewportH=0 und keine Screenshots") make a headless-browser CI step fragile here |
| Static, per-container `::before` scanline layer | JS-driven `IntersectionObserver` that toggles a scanline class only while a hero is in view | Unnecessary — the scanline is meant to be always-present over media, never conditional; adding JS where CSS alone suffices contradicts "no bundler, hand-written CSS" project style |
| `mask-image` for the vignette boundary | Rewrite `body::after` as `position:absolute` inside every section (fully scoped, no fixed layer at all) | More correct in the abstract, but touches every section on every page (structural, high blast radius); `mask-image` achieves the same visible outcome (vignette absent over the text column) with a single-property addition to an existing rule — evaluate `mask-image` first, fall back to per-section scoping only where a page genuinely doesn't set `--maxw` sensibly |

**Installation:** none — nothing new to install.

## Package Legitimacy Audit

Not applicable. This phase introduces zero new external packages. `sharp` and
`scripts/lib/theme-color.mjs` are both already present and in active use elsewhere in the
codebase (`scripts/build-thumbs.mjs`, `scripts/build-light-palettes.mjs`/`build-light-overrides.mjs`).
The Package Legitimacy Gate protocol is skipped per its own trigger condition ("whenever this
phase installs external packages").

## Architecture Patterns

### System Architecture Diagram

```
                    ┌───────────────────────────────────────────────┐
                    │  BUILD TIME (Node, before astro build/verify)  │
                    │                                                 │
public/assets/*.jpg │  sharp.sample(anchorPoint) ──► RGB pixel        │
(hero/band photos)  │        │                                        │
                    │        ▼                                        │
                    │  compositeOver(scrim, photoRGB)                 │
                    │        │  (new helper, alpha "over" operator)   │
                    │        ▼                                        │
                    │  compositeOver(ambient-vignette-at-this-point,  │
                    │                previous result)                 │
                    │        │                                        │
                    │        ▼                                        │
scripts/lib/        │  theme-color.mjs: contrast(textColor, bgResult) │
theme-color.mjs      │        │                                        │
(existing)           │        ▼                                        │
                    │  scripts/verify-layers.mjs: assert >= 4.5 / 3.0 │
                    │  for every enumerated "Stelle" × {light,dark}   │
                    └────────────────────┬───────────────────────────┘
                                         │ pass/fail, like verify:typo
                                         ▼
                              Dockerfile delivery gate
                              (does NOT block `npm run build`)

                    ┌───────────────────────────────────────────────┐
                    │  RUNTIME (browser, what the visitor sees)      │
                    │                                                 │
body::after          │  z-index:9000, position:fixed, inset:0         │
(vignette only,      │  mask-image: transparent over var(--maxw)      │
scanline removed)    │  column, opaque (vignette-visible) elsewhere   │
                    │                                                 │
.hero::before /      │  z-index between the photo (0) and the text    │
.band::before / etc. │  layer (2): repeating-linear-gradient scanline │
(new, scoped)        │  clipped by the container's own overflow:hidden│
                    │                                                 │
.reveal / .sstep     │  CSS default = fully opaque (safe with no JS)  │
                    │  IntersectionObserver({threshold:0}) upgrades   │
                    │  only the "active"/"in" presentation, never     │
                    │  the baseline visibility                        │
                    └───────────────────────────────────────────────┘
```

### Recommended File Touch-Set (not a folder restructure — this phase edits existing files)

```
assets/
├── theme.css        # --ambient-opacity stays; no new token strictly required (Claude's discretion)
├── detail.css       # body::after: add mask-image, drop scanline gradient from it
│                     # .hero/.band/.split__media/.scrolly__media/.video/.editorial__img/
│                     #   .sticky__media/.gtile: add ::before scanline layer
│                     # .reveal, .sstep: default-opaque + prefers-reduced-motion
├── detail.js        # IntersectionObserver for .reveal: threshold:.12 -> threshold:0 (+ optional rootMargin)
├── archive.css      # .js .reveal / .js .reveal.in — SAME bug pattern (see Open Questions — confirm in/out of scope)
└── archive.js       # .reveal IntersectionObserver at {threshold:0.12} — SAME bug (see Open Questions)

src/components/patches/sc-*.astro   (19 files)   # own inline copy of body::after + all archetypes
                                                  # must receive the SAME mask-image / ::before treatment
src/components/topics/*.astro       (22 files, 21 use `.hero`/`.reveal`/17 use `.sstep`)
src/components/pilot/PilotPage.astro             # bespoke .pp-hero* — NOT one of the 8 shared archetypes,
                                                  # needs its own scanline/vignette-boundary treatment
scripts/lib/theme-color.mjs         # add compositeOver()/flatten() alpha-blend helper
scripts/verify-layers.mjs (new)     # LAYER-01/LAYER-02 gate, modeled on verify-typo-motion.mjs
```

### Pattern 1: Scope the scanline via an unused pseudo-element slot, not a new DOM node

**What:** Every media-archetype container that currently uses `::after` for its scrim gradient
(`hero__photo`, `.band`, `.split__media`, `.scrolly__media`, `.video`) has its `::before` slot
free. Put the scanline `repeating-linear-gradient` there, independently `opacity:var(--ambient-opacity)`-driven, so the scrim (fixed alpha, e.g. `--scrim-4`) and the scanline (global ambient
strength token) stay two separate, independently tunable layers instead of being merged into one
`background` list (which would make `--ambient-opacity` also scale the scrim — wrong).

**When to use:** Any archetype container that (a) already has `position:relative;overflow:hidden`
(all of them do — confirmed by reading `assets/detail.css`) and (b) does not already use
`::before` for something else (confirmed clear for all 8 media archetypes — verified by reading
the full file, no `::before` on `.hero`, `.band`, `.split__media`, `.editorial__img`,
`.sticky__media`, `.gtile`, `.scrolly__media`, `.video`; only `.manifesto::before` exists, and
`.manifesto` has no photo, so it is out of scope for scanlines anyway).

**Example (conceptual, not yet in the codebase):**
```css
/* Source: derived from assets/detail.css:80-92 (existing .hero rules) — this exact
   rule does not exist yet, this is the RESEARCH-recommended addition */
.hero{position:relative; /* already true */}
.hero::before{
  content:"";
  position:absolute; inset:0;
  z-index:1; /* above .hero__photo (z:0), below .hero__in (z:2) */
  pointer-events:none;
  background:repeating-linear-gradient(0deg,var(--scanline) 0 1px,transparent 1px 3px);
  opacity:var(--ambient-opacity);
}
```
Repeat the same `::before` addition for `.band`, `.split__media`, `.scrolly__media`, `.video`
(all currently `::after`-occupied by scrim) and for `.editorial__img`, `.sticky__media`, `.gtile`
(currently pseudo-element-free — either `::before` or `::after` is available there).

**Failure mode:** if a patch or topic body defines a bespoke media container under a name that
doesn't match one of the 8 documented archetype selectors (a real risk — CONCERNS notes 38→19
patch consolidation happened, but each patch is still an intentionally distinct "Design-Welt" and
could contain one-off full-bleed sections), it silently keeps the OLD global-scanline behavior
(assuming the scanline is also removed from `body::after`) or gets NO scanline at all. **The
planner must grep every patch file for `position:absolute;inset:0` + `background-image`/
`background:url(` patterns and cross-check against the 8 known archetype class names before
declaring the scanline migration complete — do not assume the archetype list is exhaustive
without checking.**

### Pattern 2: Mask the vignette by the page's own `--maxw`, not a hardcoded pixel value

**What:** `body::after`'s vignette gradient stays exactly where it is (`position:fixed`,
viewport-wide, still atmospheric over the full-bleed hero/band photos at the true viewport
edges) — but gets a `mask-image` that is fully transparent (i.e., "hide the vignette here") within
the horizontal band occupied by the page's own text column (`var(--maxw)`, already defined by
every page that links `detail.css`, fallback `1180px`), and fully opaque (i.e., "show the
vignette") outside it.

**Why this is the workable option:** every text-bearing container that CONCERNS or CONTEXT calls
out (prose `.lead-p`, `footer .foot-nav`/`.disclaimer`, photo captions `.gtile figcaption`,
`.video .vlbl`, `.src` attribution lines) is wrapped in `.wrap{max-width:var(--maxw)}` or
`max-width:var(--maxw)` directly [VERIFIED: local codebase, `assets/detail.css` lines 59, 265,
270]. A single horizontal mask therefore protects essentially all body text uniformly, without
needing per-component treatment. The site's fixed topbar (`z-index:9100`) already renders
**above** `body::after` (`z-index:9000`) [VERIFIED: `assets/detail.css:51` vs `:48`] — nav and
breadcrumb text (`.back`, `.vpill`) are **already unaffected** by the vignette regardless of any
fix here; CONCERNS' claim that "nav, breadcrumbs … sit exactly where the vignette is darkest" is
only true for footer/caption text, not for the fixed nav.

**Example (conceptual):**
```css
/* Source: derived from assets/detail.css:48 — the mask-image is the only addition */
body::after{
  content:"";position:fixed;inset:0;z-index:9000;pointer-events:none;
  background:radial-gradient(130% 115% at 50% 42%,transparent 54%,var(--vignette) 100%);
  /* scanline gradient REMOVED from here — moved to Pattern 1 */
  opacity:var(--ambient-opacity);
  mask-image:linear-gradient(90deg,
    black, black calc(50% - var(--maxw)/2),
    transparent calc(50% - var(--maxw)/2 + 80px),
    transparent calc(50% + var(--maxw)/2 - 80px),
    black calc(50% + var(--maxw)/2), black);
  -webkit-mask-image:linear-gradient(90deg,
    black, black calc(50% - var(--maxw)/2),
    transparent calc(50% - var(--maxw)/2 + 80px),
    transparent calc(50% + var(--maxw)/2 - 80px),
    black calc(50% + var(--maxw)/2), black);
}
```
(`black` = fully show the masked layer here; `transparent` = fully hide it. The 80px feather
avoids a visible hard edge at the column boundary — tune against the softness the radial
gradient already uses, 46% of its own radius.)

**Failure modes:**
- **Missing `-webkit-` prefix silently breaks Safari/iOS** [ASSUMED — general platform knowledge
  about WebKit's historical CSS Masking prefix requirement, not re-verified via docs this
  session] — both prefixed and unprefixed declarations must ship together; a review that only
  checks the unprefixed property will not catch a Safari-only regression.
- **Pages that never set `--maxw`** fall back to `detail.css`'s own `1180px` default — safe, but
  any page whose actual reading column is wider or narrower than that fallback (e.g. `wrap--wide`
  at `1400px`, used for some archetypes) will get a mask sized for the WRONG column. The planner
  must verify which pages use `.wrap--wide` sections and either widen the mask for those sections
  specifically or accept the vignette reappearing at the edges of a `wrap--wide` block (arguably
  acceptable, since `wrap--wide` sections in this codebase are typically galleries/stat-strips
  without long-form body prose — verify this assumption against the actual archetype usage before
  relying on it).
- **This is scoped to `assets/detail.css`, but the 19 patch bodies inline their own copy of
  `body::after` and do not read `assets/detail.css` at all.** Applying the mask only in
  `detail.css` leaves all 19 patch pages unfixed. The same `mask-image` addition (with each
  patch's own `--maxw`, which may differ per patch theme) must be replicated into all 19 files.

### Pattern 3: Fix `.reveal`'s IntersectionObserver at the root, not per-file

**What goes wrong today:** `assets/detail.js:9` —
`new IntersectionObserver(cb, {threshold:.12})`. `intersectionRatio` is defined as
`visibleArea / targetArea`. For a target whose height exceeds
`viewportHeight / threshold` (here `viewportHeight / 0.12 ≈ 8.3×` the viewport height), the
ratio **can never reach 0.12 at any scroll position**, no matter how the user scrolls — this is
not a flaky timing bug, it is a mathematical ceiling on `intersectionRatio` for elements taller
than roughly 8× the viewport. The documented case (`wikelo-emporium.astro`, comment at line 91-94)
is a 19-card `.wk-tc-grid` column — plausible to exceed that height on a narrow mobile viewport
(≈650px tall) if each card is ≈400-500px, giving a total ≈7,600-9,500px, i.e. exactly in the range
where the 12% threshold becomes unreachable.

**Why `threshold:0` is the correct fix, verified by reasoning through the same code that already
works two lines away:** `assets/detail.js:153`'s scrollytelling observer already uses
`{rootMargin:'-45% 0px -45% 0px', threshold:0}` for `.sstep` — a WORKING precedent in this exact
file. With `threshold:0`, the callback fires the instant `intersectionRatio` becomes greater than
`0`, i.e. on the very first pixel of overlap — a condition that is met for a target of **any**
height once it enters the viewport at all. There is no element-height ceiling with `threshold:0`,
because the ratio's denominator (target area) no longer needs to be approached, only exceeded by a
non-zero numerator.

**Recommended change:**
```js
// assets/detail.js:9 — before:
var io=new IntersectionObserver(function(es){...},{threshold:.12});
// after (mirrors the already-proven .sstep pattern at line 153):
var io=new IntersectionObserver(function(es){...},{rootMargin:'0px 0px -10% 0px',threshold:0});
```
`threshold:0` alone is sufficient to fix the bug; the `rootMargin` is optional polish (fires the
reveal slightly before the element is fully on-screen, matching the existing `.sstep` timing
convention in this codebase for visual consistency between the two effects).

**After this fix, the 21 defensive `!important` overrides become dead code and should be
removed** — the underlying observer can no longer fail to fire, regardless of column height.

**Second implementation of the same bug (see Open Questions):** `assets/archive.js:125-133` has
its own, separate `.reveal` IntersectionObserver at `{threshold:0.12}`, gating `.js .reveal` /
`.js .reveal.in` in `assets/archive.css:1421,1426,1780`. This is a **completely independent
design system** (`/archiv` only) that does not load `detail.css`/`detail.js`. It shares the exact
same mathematical failure mode. CONCERNS.md's Class-B inventory table does not list
`archive.js`/`archive.css` at all, and CONTEXT's re-measured Ist-Zustand table doesn't either —
this may be intentionally out of the phase boundary (CONCERNS' Class B section is specific to
`detail.css`-based pages) or an oversight. Flagged explicitly below in Open Questions; do not
silently expand or silently ignore scope.

### Pattern 4: `.sstep` — opaque-by-default, dim only once JS has proven it can restore

**Current mechanism** (`assets/detail.css:324-325`): `.sstep{opacity:.5;transition:opacity .5s}`,
`.sstep.active{opacity:1}`. `assets/detail.js:148-155` runs `setActive(0)` synchronously on page
load (so step 0 is never stuck dim), then an IntersectionObserver with
`{rootMargin:'-45% 0px -45% 0px',threshold:0}` (this one is already correctly built — not part of
D-03) toggles `.active` as steps scroll through the viewport's center band.

**D-02's requirement, reasoned through:** if the fix is simply
"`.sstep{opacity:1}` + `.sstep:not(.active){opacity:.5}`", every step **except step 0** would
render dimmed from the very first paint (no JS has run yet at CSS-apply time — `.active` is a
class the JS adds, so before JS executes, `:not(.active)` matches everything), reproducing
exactly the no-JS/JS-hasn't-run-yet problem D-02 is trying to close. **`:not(.active)` alone is
not safe as the base rule.**

**Recommended mechanism (Claude's discretion, not locked by CONTEXT beyond the outcome):** keep
`.sstep{opacity:1}` unconditionally as the CSS default (safe for no-JS and for the instant before
`detail.js` runs). Let the JS mark the scrollytelling container as "observer confirmed running"
(e.g. a class added once inside the IntersectionObserver callback, or immediately after
`setActive(0)` succeeds) and scope any dimming of *inactive* steps to that confirmed-running state
— e.g. `.scrolly[data-sstep-live] .sstep:not(.active){opacity:.5}`. This produces the identical
visual result as today once JS is running (active step full, others dimmed — "animates away from
full opacity"), while guaranteeing the CSS-only default is always fully opaque, satisfying D-02's
literal wording ("Standardzustand wird undurchsichtig … blendet höchstens von voller Deckkraft
weg").

**`prefers-reduced-motion` addition (D-02, second half):** `assets/detail.css:342` currently reads
`@media (prefers-reduced-motion:reduce){.reveal{opacity:1;transform:none}*{animation:none!important}}`.
Note that `*{animation:none!important}` does **not** stop CSS `transition`s (a distinct mechanism
from `animation`) — so `.sstep`'s `transition:opacity .5s` (and its child `.sn`/`.active .sn`
`transition:color .5s,text-shadow .5s`) is **not currently silenced** by this rule, meaning the
crossfade still plays today under reduced motion even though CONCERNS/CONTEXT treat `.reveal` as
the only thing covered. Add `.sstep` to the selector list and set `transition:none` explicitly for
both `.sstep` and `.sstep .sn` (opacity alone becoming a no-op once both states are forced to `1`/
accent color is not guaranteed to eliminate the *color*/`text-shadow` transition on `.sn`, since
those still change value even if opacity does not) — verify this by reading both rules together at
plan time, not by assuming `opacity:1` alone silences everything downstream.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WCAG relative-luminance / contrast-ratio formula | A second `luminance()`/`contrast()` implementation for this phase | `scripts/lib/theme-color.mjs` (already exports both, already used by `npm run theme`) | One correct implementation; a second one risks a subtly different rounding/gamma-correction path that disagrees with the generator that produces the light palette in the first place |
| Alpha compositing ("what does this text actually look like once N semi-transparent layers stack") | A from-scratch Porter-Duff implementation, or a full CSS-in-JS renderer | A ~10-line `compositeOver(top, bottom)` helper (`outRGB = topRGB*topAlpha + bottomRGB*(1-topAlpha)`) added next to the existing `theme-color.mjs` primitives | This is the exact missing piece — everything else needed (color parsing, luminance, contrast ratio) already exists; only the "stack N layers down to one opaque color" step is new, and it is a well-known, tiny formula, not a library-worthy problem |
| Sampling real photo colors for contrast math | A headless-browser screenshot pipeline (Playwright/Puppeteer) | `sharp` reading the actual JPEG/WebP file directly and extracting pixel or region-average color at a documented anchor point | This project has zero browser-automation tooling and documented Windows fragility around browser panes/screenshots (project memory: `windows-env-fallen.md`). `sharp` is already present and already used for exactly this kind of "read this image file's pixels" task in `scripts/build-thumbs.mjs` |

**Key insight:** every primitive this phase needs already lives somewhere in this repo under a
different name for a different purpose (WCAG math in the theme generator, image pixel access in
the thumbnail builder). The work is composition, not invention.

## Common Pitfalls

### Pitfall 1: Treating "38 patch pages" (CONCERNS) as current

**What goes wrong:** planning file-touch counts, codemod scope, or verification-gate expectations
against the CONCERNS.md numbers.
**Why it happens:** CONCERNS.md predates the Phase-1.x "EIN Körper" consolidation.
**How to avoid:** this research already re-measured it — **19** files under
`src/components/patches/sc-*.astro`, each serving both languages, each still an inline
`<style is:inline>` copy of the full archetype+`body::after` CSS (they do not link
`assets/detail.css`). Use 19, not 38, and remember they are still independent COPIES (Class-A risk
persists even though the file count halved).
**Warning signs:** a plan that references "38 files" or a verification gate hardcoding "38" as an
expected count (as `verify-fx.mjs` Zusicherung 7 already correctly does — that count is about
`vbfxchange` **events firing**, not file count, and was written post-consolidation, so it is not
itself wrong, but a *new* LAYER gate must not copy an un-verified "38" from CONCERNS by habit).

### Pitfall 2: Assuming one `.reveal` implementation covers the whole site

**What goes wrong:** fixing only `assets/detail.js:9` and declaring D-03 satisfied.
**Why it happens:** the CONTEXT canonical refs name only `assets/detail.js` (Z. 13-14 in the
CONTEXT doc's line numbering, `Z. 9` in the file as read this session — line numbers drift are
themselves a minor pitfall, always re-open the file rather than trusting a cited line number).
**How to avoid:** `assets/archive.js:125-133` has an independent `.reveal` observer with the same
`threshold:0.12` bug, feeding `assets/archive.css:1421/1426/1780`'s `.js .reveal`/`.js .reveal.in`
rules. Confirm with the user/planner whether `/archiv` is in scope for LAYER-01 before deciding —
see Open Questions.
**Warning signs:** a verification gate that only greps `assets/detail.js`/`assets/detail.css` will
report success while `/archiv` still has the bug.

### Pitfall 3: Compositing layers in the wrong order, or skipping the "both foreground and
background pass through the topmost layer" step

**What goes wrong:** computing contrast as `contrast(textColorCSS, backgroundColorCSS)` — i.e.
comparing the *declared* CSS colors, ignoring that `body::after` sits ABOVE the text at
`z-index:9000` and tints **both** the glyph and its surrounding background by the same amount.
Because WCAG's contrast formula `(L1+.05)/(L2+.05)` is **not** linear under a uniform blend toward
a third color, you cannot "blend both sides equally and assume the ratio is preserved" — you must
composite each side (foreground, background) through the full stack independently, then run the
ratio on the two final opaque results.
**Why it happens:** it is the natural (wrong) first instinct, and it is exactly the trap CONTEXT's
`<code_context>` section calls out explicitly ("eine Messung, die nur Vorder- gegen
Hintergrundfarbe im CSS vergleicht, übersieht genau das, worum es in diesem Befund geht").
**How to avoid:** for any measured "Stelle", build the FULL stack for both the glyph color and the
region immediately behind/around it, in the SAME z-order the browser actually paints (bottom to
top: sampled photo pixel → local scrim gradient stop at that position → text color, painted below
`body::after` → `body::after`'s vignette+ambient tint on top of everything, uniformly, since it is
a single fixed full-viewport layer). Then take `contrast()` of the two final results.
**Warning signs:** a measured contrast number that looks suspiciously close to the raw CSS
`--text`/`--bg` token contrast (i.e., the stacking made no difference) — that's a sign the ambient
layer was not actually composited in.

### Pitfall 4: The repeating scanline gradient has a duty cycle — "the" contrast number is ambiguous

**What goes wrong:** treating the scanline as a flat, uniform tint (it is not — it's
`repeating-linear-gradient(0deg,var(--scanline) 0 1px,transparent 1px 3px)`, i.e. it darkens 1 of
every 3 device pixels along the vertical axis and leaves 2 of 3 untouched).
**Why it happens:** it's tempting to average it into a single effective alpha for simplicity.
**How to avoid:** report BOTH numbers and use the conservative one as the pass/fail gate: (a) the
**worst-case** pixel (directly on a scanline row, i.e. scanline alpha fully applied) — use this as
the WCAG AA gate, since it is the stricter, defensible reading; (b) the **row-averaged** value
(scanline duty cycle 1/3) as a secondary, informational number closer to perceived legibility.
WCAG itself has no formal position on sub-pixel periodic patterns — document this explicitly
rather than presenting either number as "the" WCAG-certified value.
**Warning signs:** a measured value that changes materially depending on which single pixel row
was sampled — that's the signal this pitfall is live, not a measurement error.

### Pitfall 5: `mask-image` without `-webkit-` prefix

**What goes wrong:** the vignette-boundary fix works in Chromium/Firefox during review, ships, and
silently fails to mask on Safari/iOS (the full, unmasked vignette reappears there — same as
current behavior, so it looks like "nothing changed" on Safari rather than throwing an error).
**Why it happens:** `mask-image` is unprefixed in Chromium/Firefox but historically needed
`-webkit-mask-image` in WebKit [ASSUMED — not re-verified via docs this session].
**How to avoid:** always ship both declarations together; treat this the same way the codebase
already treats `background-clip: text` (`assets/detail.css:104` sets both `-webkit-background-clip`
and `background-clip` — the SAME prefixing discipline already exists in this file for a different
property, follow the established local convention).
**Warning signs:** a Safari-only visual regression report after this phase ships.

## Code Examples

### Alpha compositing helper (new — does not exist yet, extends `scripts/lib/theme-color.mjs`)

```js
// Source: derived from the standard Porter-Duff "source-over" formula — platform/graphics
// spec knowledge [ASSUMED, not re-verified via docs this session]. To be added alongside the
// existing parseColor/luminance/contrast exports in scripts/lib/theme-color.mjs.
export function compositeOver(top, bottom) {
  // top, bottom: { r, g, b, alpha } in [0,1], as returned by parseColor(). bottom is assumed
  // fully resolved (alpha treated as 1 if this is the bottommost known layer, e.g. a sampled
  // opaque photo pixel).
  const a = top.alpha ?? 1;
  return {
    r: top.r * a + bottom.r * (1 - a),
    g: top.g * a + bottom.g * (1 - a),
    b: top.b * a + bottom.b * (1 - a),
    alpha: 1,
  };
}
```

### Sampling a hero photo pixel with `sharp` (pattern already established in `scripts/build-thumbs.mjs` for a different purpose — resizing, not sampling; this is the natural extension)

```js
// Conceptual — not yet in the codebase. Illustrates using sharp's raw pixel buffer to sample
// an anchor point (e.g. where hero title text bottom-aligns, matching justify-content:flex-end
// on .hero, roughly the bottom-left quadrant of the image).
import sharp from 'sharp';

async function sampleAnchorColor(imagePath, xFrac, yFrac) {
  const img = sharp(imagePath);
  const { width, height } = await img.metadata();
  const x = Math.round(width * xFrac), y = Math.round(height * yFrac);
  const { data } = await img
    .extract({ left: x, top: y, width: 1, height: 1 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { r: data[0] / 255, g: data[1] / 255, b: data[2] / 255, alpha: 1 };
}
```

### Reusing the existing contrast primitive (no change needed to this function)

```js
// Source: scripts/lib/theme-color.mjs:104-113 (already in the repo, verbatim)
export function luminance(c) {
  const { r, g, b } = typeof c === 'string' ? parseColor(c) : c;
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

export function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
```

### `.reveal` IntersectionObserver fix, shown against the actual current line

```js
// Source: assets/detail.js:9 (current, verbatim)
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.12});
// RECOMMENDED replacement — mirrors the already-working pattern at assets/detail.js:153
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{rootMargin:'0px 0px -10% 0px',threshold:0});
```

## State of the Art

Not applicable in the usual sense (no third-party library version drift to track). The one
relevant "old vs current approach" is internal to this project:

| Old Approach | Current/Recommended Approach | When Changed | Impact |
|--------------|-------------------------------|---------------|--------|
| Single global `body::after` carrying vignette + scanline together, unscoped | Vignette stays global but `mask-image`-scoped to exclude the text column; scanline moves to per-media-container `::before` | This phase (D-01) | Text everywhere gets one fewer stacked opacity layer; media retains both effects exactly where they were designed to be seen |
| `.reveal`/`.sstep` visibility gated by JS-only class addition, opacity:0/.5 as the CSS default | CSS default is safe (opaque) independent of JS; JS only adds a presentational enhancement on top | This phase (D-02/D-03) | Removes 21 defensive `!important` overrides and the underlying "content silently never appears" failure class entirely, not just for the currently-known tall-column case |
| Contrast "checked" only by eye / not checked at all | `sharp`-sampled real pixel + full-stack alpha compositing + existing WCAG formula, run as a build-time gate | This phase (D-04, LAYER-02) | Contrast becomes a number that is asserted, not a subjective impression, and self-updates if a hero photo is later swapped (script re-samples the current file each run rather than hardcoding a color derived once) |

**Deprecated/outdated:** treating CONCERNS.md's file counts (38 patch pages, 34 `.sstep` files) as
current — both are pre-consolidation numbers; this research's own re-measurement (19 patch files,
17 `.sstep` content files, 21 `.reveal` `!important` overrides) should be the baseline the planner
uses, and the planner should still re-run these counts once more immediately before finalizing the
plan, since even this session's numbers can drift with concurrent work on other branches.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `mask-image` requires the `-webkit-` prefix for full WebKit/Safari support | Pattern 2, Pitfall 5 | If wrong (i.e. unprefixed alone is now sufficient), shipping both declarations is harmless over-caution — low risk either way, but worth a quick spot-check against a current Safari/iOS version before finalizing the plan |
| A2 | IntersectionObserver `threshold:0` fires on the very first pixel of overlap, with no dependency on target element height | Pattern 3 | This is standard, stable IntersectionObserver spec behavior and is already relied upon by this exact codebase's own `.sstep` observer (`assets/detail.js:153`) — very low risk, but flagged since it was reasoned from spec knowledge, not re-fetched from MDN this session |
| A3 | `.wrap--wide` (1400px) archetype sections do not carry long-form body prose, so a `--maxw`-keyed vignette mask sized for the narrower default column is acceptable to leave slightly vignetted at its own wider edges | Pattern 2 (mask sizing), Failure modes | If a `.wrap--wide` section DOES carry substantial body text at its edges, that text would remain under the (currently existing) unmasked vignette — same as today, not a regression, but also not the improvement LAYER-01 wants for that specific spot. Verify actual `.wrap--wide` usage before relying on this |
| A4 | `assets/archive.js`/`archive.css`'s independent `.reveal` implementation is NOT within this phase's boundary, because CONCERNS.md's Class-B table and CONTEXT's re-measured Ist-Zustand table both omit it | Pattern 3, Open Questions | If wrong (i.e. the operator intends `/archiv` to be covered by LAYER-01 too), the phase ships with a known, documented, but unfixed instance of the exact bug it was created to eliminate |
| A5 | B-4 ("blend modes over text" — `mix-blend-mode` in `archive.css`, `SiteNav.astro`, `ProfileCard.astro`, `PilotPage.astro`, `account-dossier.css`) is out of this phase's scope | Open Questions | CONCERNS.md explicitly lists B-4 under "Class B", but CONTEXT's `<measured_state>` re-survey and `<deferred>` section both omit it entirely (neither confirmed in-scope nor explicitly deferred) — ambiguous, needs a direct answer before planning, not an assumption baked silently into the plan |

**If this table is empty:** n/a — see rows above; all are LOW-to-MEDIUM risk, none block starting the plan, but A4 and A5 should be resolved with the operator before the plan is finalized (they change file-touch scope, not methodology).

## Open Questions

1. **Is `/archiv` (assets/archive.js + assets/archive.css) in scope for LAYER-01?**
   - What we know: it has an independently-implemented `.reveal` gate with the identical
     `threshold:0.12` mathematical bug as `assets/detail.js`. CONCERNS.md's Class-B table doesn't
     list it (Class B there is scoped to `detail.css`-based pages). CONTEXT's own re-measurement
     table also omits it, and it isn't named in `<deferred>` either.
   - What's unclear: whether that's a deliberate scope boundary (Class B was authored specifically
     against the `detail.css` design system) or an oversight in the discuss-phase re-survey.
   - Recommendation: ask the operator directly before planning. If out of scope, note it explicitly
     in the plan's boundary section (not just silently absent) so a future phase/audit doesn't
     re-discover it as a "new" bug. If in scope, add `assets/archive.js`'s observer fix and
     `assets/archive.css`'s `.js .reveal` override inventory to the plan's file-touch list — the
     mechanism (Pattern 3) is identical, the effort is small, but it needs its own line item since
     it is a structurally separate codepath.

2. **Is B-4 (blend-mode-over-text) in scope for LAYER-01?**
   - What we know: CONCERNS.md lists it under "Fragile Areas > Class B" explicitly, alongside
     body::after/.sstep/.reveal. It affects `assets/archive.css` (lines 190, 1150, 1165),
     `src/components/SiteNav.astro` (860, 1036), `src/components/account/ProfileCard.astro` (349),
     `src/components/pilot/PilotPage.astro` (416), `assets/account-dossier.css` (144).
     `assets/account-dossier.css:21` already had to locally zero `--scanline` because CRT lines
     "schlagen auf dem hellen Hero-Namen als Glitch durch" — documented evidence this exact class
     of effect already broke legibility once.
   - What's unclear: CONTEXT's phase boundary says "Text steht nicht mehr hinter mehr als einer
     dekorativen Deckkraftschicht" — a blend mode is arguably a DIFFERENT kind of decorative layer
     than a stacked-opacity one (it changes how colors *combine* rather than adding an opaque/
     translucent layer on top), so it's plausible CONTEXT intentionally narrowed "Deckkraftschicht"
     (opacity layer) to exclude blend modes even though CONCERNS filed them under the same
     "Class B" umbrella heading.
   - Recommendation: confirm explicitly. If out of scope, CONCERNS notes correctly that "no static
     contrast check covers them" — meaning even LAYER-02's contrast gate cannot certify these
     spots, and that limitation should be stated plainly in the plan rather than silently
     understood.

3. **What exact set of "Stellen" (spots) count as "betroffen" for LAYER-02's measurement, per
   CONTEXT's Claude's-Discretion note?**
   - What we know: the requirement is "the selection must be justified and complete, not a
     sample." The clearest, most defensible complete set is: one measurement per {archetype ×
     dark/light} combination that carries the ambient overlay + a scrim + text-on-media
     (`.hero`, `.band`, `.split__media`, `.editorial__img`, `.sticky__media`, `.gtile`,
     `.scrolly__media`, `.video`, plus the two bespoke non-standard heroes: homepage's own
     `.hero__img`/`.hero__scrim` [note: homepage does NOT load `body::after` at all — verified,
     `grep` for `detail.css`/`body::after` in `src/pages/index.astro` returns nothing — so its
     hero is not part of the CONCERNS Class-B "global ambient" complaint, only its own local
     scrim, which is a smaller and different problem] and `PilotPage.astro`'s `.pp-hero*`), each
     evaluated in both `data-theme` states, PLUS at least one representative flat-background
     archetype (`.manifesto`, `.statstrip`) to confirm the non-media text remains unaffected by
     the vignette mask.
   - What's unclear: whether every one of the 19 patch bodies needs its OWN measurement (since
     each uses a different photo and a different accent palette, per-patch numbers could differ
     materially) or whether one representative patch per "mood" (warm/cool, per the existing
     `accentIsWarm()` heuristic in `detail.js`) is sufficient.
   - Recommendation: measure every patch individually for the gate (cheap once the script exists —
     it's a loop over image files), but only requires manual documentation/summary for a
     representative subset in the plan write-up, matching the precedent set by
     `verify-typo-motion.mjs` (machine checks everything, human summary covers representative
     cases).

4. **Should the LAYER-02 contrast gate become a permanent `npm run verify:*` script (Claude's
   Discretion, per CONTEXT), and if so, does it belong in the Dockerfile gate like `verify:typo`/
   `verify:fx`, or should it stay a one-off audit?**
   - What we know: CONTEXT leaves this open explicitly. The existing `verify:*` family's own stated
     rationale for living in the Dockerfile gate (not `npm run build`) is "a failure here doesn't
     break anything visible — the page still builds/loads/works, it just looks like before" — the
     SAME failure mode applies here (a contrast regression doesn't break the build).
   - Recommendation: make it permanent and Dockerfile-gated, following the established precedent
     exactly (`verify:typo`'s own header comment cites `verify:crafting`'s precedent for the same
     reasoning) — a one-off audit provides no protection against a future patch page reintroducing
     the exact defect this phase fixes, and the tooling cost of making it permanent is low once the
     one-off version exists (same script, just wired into `package.json` + Dockerfile like the
     other five `verify:*` gates already are).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| `sharp` | Pixel sampling for LAYER-02 contrast gate | ✓ [VERIFIED: `node_modules/sharp` present; `package-lock.json` pins `^0.34.0` at lines 1916, 3893] | 0.34.x | — |
| `scripts/lib/theme-color.mjs` | WCAG contrast math | ✓ [VERIFIED: file read this session, exports `parseColor`/`luminance`/`contrast`] | in-repo, n/a | — |
| Headless browser (Playwright/Puppeteer) | Would be needed for a rendered-pixel/screenshot-based contrast check | ✗ [VERIFIED: not in `package.json` dependencies or devDependencies; not referenced anywhere in `scripts/` or `tests/`] | — | Use `sharp` + manual alpha-compositing math instead (this is the recommended approach, not a degraded fallback — see Summary) |
| `mask-image` / `-webkit-mask-image` browser support | D-01 vignette boundary | ✓ (platform feature, ships in all evergreen browsers) [ASSUMED — not re-verified via caniuse this session] | n/a | None needed if both prefixed/unprefixed declarations ship together; if an unsupported browser is ever a real concern, the fallback is simply the CURRENT (unmasked, whole-viewport) vignette — a graceful, non-breaking degradation |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:** headless-browser rendering (not needed — `sharp` +
compositing math covers the actual requirement, as argued in Summary/Don't-Hand-Roll).

## Security Domain

`security_enforcement` is enabled in `.planning/config.json` (ASVS level 1), but this phase has no
security-relevant surface: no new user input, no authentication/session change, no new data
storage, no new endpoint. It is a presentational CSS/JS restructuring plus a build-time
verification script that reads local image files it already has filesystem access to.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No auth surface touched |
| V3 Session Management | No | No session surface touched |
| V4 Access Control | No | No access-control surface touched |
| V5 Input Validation | No | The only "input" to the new verify script is local project files (image paths, CSS files) already trusted by every other `verify:*`/`audit:*` script in this repo; no external or user-supplied input |
| V6 Cryptography | No | Not applicable |

### Known Threat Patterns for this stack

None identified that are specific to this phase. The one general hygiene note: the new
`scripts/verify-layers.mjs` should follow the same pattern as the existing `verify-*` family
(fail loudly with `process.exit(1)` if `dist/` is missing, never silently pass) — not a security
control, but a correctness discipline already established and worth continuing.

## Sources

### Primary (HIGH confidence — direct file reads this session)

- `.planning/phases/03-ueberlagerungen-entstapeln/03-CONTEXT.md` — locked decisions, measured state, discretion areas
- `.planning/ROADMAP.md` § Phase 3 — goal, success criteria, plan count
- `.planning/REQUIREMENTS.md` — LAYER-01, LAYER-02, THEME-02, SYNC-01
- `.planning/codebase/CONCERNS.md` § Class B — original finding (with stale counts, corrected above)
- `assets/theme.css`, `assets/detail.css`, `assets/detail.js` — full read
- `assets/archive.js`, `assets/archive.css` (targeted grep) — second `.reveal` implementation
- `scripts/verify-typo-motion.mjs`, `scripts/verify-fx.mjs` — verification-gate precedent pattern
- `scripts/lib/theme-color.mjs` — existing WCAG contrast primitives
- `scripts/build-thumbs.mjs` — existing `sharp` usage pattern
- `src/components/topics/wikelo-emporium.astro` — documented root cause of one `.reveal` override
- `src/components/patches/sc-4-9-0.astro` (+ 18 siblings, `ls`/`grep` verified) — confirmed 19-file inline-copy structure
- `src/pages/index.astro`, `src/pages/de/index.astro` — confirmed homepage does not load `body::after`/`detail.css`
- `src/pages/account/index.astro`, `src/components/pilot/PilotPage.astro`, `src/components/topics/crafting.astro`, `src/components/topics/mining.astro` — hero/media container inventory across page types
- `package.json`, `package-lock.json`, `node_modules/sharp` — dependency availability check
- `.planning/config.json` — `nyquist_validation:false`, `security_enforcement:true`, all web-search providers `false`

### Secondary (MEDIUM confidence)

- None — no external documentation was fetched this session (config disables all search providers, and none was needed given the platform-native nature of the work).

### Tertiary (LOW confidence — flagged `[ASSUMED]` throughout, general web-platform knowledge not re-verified this session)

- `mask-image`/`-webkit-mask-image` browser support and prefix requirements
- `IntersectionObserver` `threshold`/`rootMargin` semantics (though cross-checked against this codebase's own working `.sstep` implementation, which raises confidence well above a bare assumption)
- Porter-Duff "source-over" alpha compositing formula

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nothing new to evaluate; both required primitives (`sharp`, `theme-color.mjs`) verified present and working in this exact repo
- Architecture (D-01 mechanism): MEDIUM-HIGH — the `mask-image` + scoped-`::before` approach is reasoned carefully against the actual CSS in this repo and checks out mechanically, but has not been prototyped/rendered; the planner's first task should be a small tracer proof (one hero, one patch) before committing to the full 19+22-file rollout
- Pitfalls (`.reveal`/`.sstep`): HIGH — verified against actual source line numbers, cross-checked against a working sibling implementation in the same file
- Contrast measurement methodology: MEDIUM — the compositing math is sound and the primitives exist, but the exact anchor-point sampling strategy (which x/y fraction of which images) needs to be finalized against the actual hero images at plan time, not assumed here

**Research date:** 2026-08-08
**Valid until:** ~30 days for the architectural findings (stable, doesn't depend on external ecosystems); the file-count inventories (19 patches, 17 `.sstep`, 21 `.reveal` overrides, 75 `reveal`-referencing files) should be **re-verified immediately before planning**, since this is an actively-worked repo with parallel sessions (per project memory, `repo-hygiene-2026-07.md`) and counts can drift within days.
