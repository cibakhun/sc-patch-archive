# Phase 4: Sprachparität absichern - Research

**Researched:** 2026-08-08
**Domain:** Build-time structural-parity verification for a bilingual static Astro site (Node.js `verify-*.mjs` gate scripts)
**Confidence:** HIGH — every quantitative claim in this document was produced by running a throwaway probe against a real `npm run build` of this exact worktree, not estimated or assumed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01: Der Maßstab ist ein STRUKTUR-FINGERABDRUCK.** Aus jeder gebauten Seite wird die
  Gerüstform gezogen — Abfolge der Element-Typen und Klassen, **ohne Textinhalte** — und die
  beiden Fingerabdrücke müssen übereinstimmen. Das fängt fehlende Abschnitte, vertauschte
  Reihenfolge und einseitige Umbauten, und verträgt zugleich unterschiedlich lange Übersetzungen,
  weil Text nicht eingeht. Bewusst nicht gewählt: reine Zählungen (übersehen vertauschte
  Reihenfolge) und Fingerabdruck-plus-Stil (zu viele Fehlalarme, wo Unterschiede gewollt sind).
- **D-02: Das Tor gilt für ALLE 69 Paare**, nicht nur für die in diesem Meilenstein angefassten.
  Die Roadmap formuliert enger, aber der Meilenstein hat inzwischen fast alle angefasst — und ein
  Tor, das nur eine Teilmenge bewacht, lädt die Restmenge zum Auseinanderdriften ein. Eine
  gepflegte Ausnahmeliste würde außerdem niemand pflegen.
- **D-03: Erst beheben, dann scharf.** Was der erste Lauf an echten Unterschieden findet, wird in
  dieser Phase behoben; danach hängt das Tor blockierend im Dockerfile. Bewusst nicht gewählt:
  eine Sperrklinke wie in Phase 2, die den Ist-Stand einfriert — hier soll der Bestand sauber
  sein, nicht nur eingefroren. — **Reversibility:** reversible — der Umfang der Behebung hängt vom
  ersten Messergebnis ab; fällt er unerwartet groß aus, ist das ein Befund für den Betreiber.
- **D-04: THEME-02 bekommt einen eigenen Wächter.** „Kein generierter
  `:root[data-theme='light']`-Block wird von Hand verändert" ist eine andere Art von Parität als
  der Seitenvergleich, gehört aber zu dieser Phase. Der Wächter muss erkennen, ob der Block noch
  dem entspricht, was `npm run theme` erzeugen würde.

### Claude's Discretion

- Wie der Fingerabdruck genau gebildet wird (Element-Typen, Klassen, Verschachtelungstiefe,
  Reihenfolge) und wie er normalisiert wird
- Welche Unterschiede als legitim gelten und deshalb aus dem Vergleich fallen — die Liste muss
  begründet und benannt sein, nicht stillschweigend
- Ob der THEME-02-Wächter eigenständig läuft oder Teil desselben Skripts wird
- Ob die vier bestehenden Paarvergleiche unverändert bleiben oder auf den neuen Fingerabdruck
  aufsetzen — sie dürfen dabei nicht schwächer werden

### Deferred Ideas (OUT OF SCOPE)

- **SYNC-04 — die vollständige Zusammenführung aller Seitenpaare zu je EINEM Körper.** Steht in
  `REQUIREMENTS.md` § Out of Scope, ausdrücklich nach v2 verschoben. Wäre die eigentliche Lösung
  der Ursache; diese Phase baut den Wächter, nicht den Umbau.
- Übersetzungsqualität und Wortwahl prüfen — anderer Gegenstand, andere Werkzeuge.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SYNC-01 | Jede Änderung an einer Startseiten-/Layout-Datei trifft EN und DE im selben Schritt | Not directly machine-checkable (a process/discipline requirement); the SYNC-02 gate is the mechanical backstop that catches violations after the fact. No new tooling beyond the gate itself is needed for SYNC-01 — see § Common Pitfalls (Dockerfile placement) for how the gate gets teeth. |
| SYNC-02 | Ein Prüfschritt belegt für die geänderten Seitenpaare, dass Struktur und Stil deckungsgleich sind | § Standard Stack, § Architecture Patterns, § The Decisive Measurement — full design for `verify-sync.mjs`, backed by a real measurement against `dist/` |
| THEME-02 | Kein generierter `:root[data-theme="light"]`-Block wird von Hand verändert; Hellwerte entstehen über `npm run theme` | § THEME-02 Watcher Design — full design for `verify-theme-gen.mjs`, backed by a real (and then reverted) execution of `npm run theme` against this worktree |
</phase_requirements>

## Summary

This phase adds a fifth `verify-*.mjs` gate to a codebase that already has four (`verify-fx`,
`verify-help`, `verify-typo-motion`, `verify-layers`), all following the exact same shape:
read the **built** `dist/`, apply a handful of Soll/Ist assertions, exit 1 on failure, run in the
Dockerfile chain (not in `npm run build` itself). The new gate does the same thing for DOM
structure instead of a single feature's markers.

**The decisive question was answered by running the probe, not estimating it.** Against a fresh
`npm run build` of this worktree, there are **8,678 built EN/DE HTML pairs** (not 69 — the 69
source `.astro` pairs include dynamic route templates that each expand into many built pages:
missions, items, patches, topics). Of those 8,678 pairs:

- **6,966 (80.3%) are byte-identical** under a tag+class structural fingerprint. No exclusions
  needed.
- **1,627 (18.75%) differ for exactly one reason**: `LangSwitcher.astro` renders its two locale
  slots in a fixed array order, so the "current language" badge and the "other language" link
  swap DOM positions between the EN and DE build of the same page. This is not drift — it is
  mechanically identical on every affected page (verified by reading the component source) — and
  it must be excluded from the ordered comparison, or the gate is unusable from day one.
- **~85 pairs (~1%) have other, genuine, individually-explainable differences** — three of which
  are confirmed-deliberate design choices (a German-only downloadable resource, a
  German-law-mandated Impressum section, and a documented onepager exception), and one of which
  (78 item detail pages missing an English game description) is a real data gap that needs an
  operator decision, not a silent exclusion.

**Primary recommendation:** Build `scripts/verify-sync.mjs` using the ordered
`tag.class` sequence over `dist/**/*.html` (no sorting, no depth-tracking — both were tested and
added zero signal over the simplest definition). Special-case the `.langsw` subtree as an
order-insensitive multiset comparison (not a page-wide exclusion). Maintain a small, named
exclusion registry (same pattern as `scripts/lib/layer-registry.mjs`'s `EXCLUSIONS`) for the
three confirmed-deliberate cases, and escalate the item-description gap to the operator as a
`checkpoint:human-verify` before deciding fix-vs-exclude. Extract the pairing logic — duplicated
verbatim three times already — into `scripts/lib/page-pairs.mjs`. Build `verify-theme-gen.mjs` as
a **separate** script that runs the three `npm run theme` generators for real (safe, because it
runs post-build in the disposable Dockerfile build stage) and diffs whitespace-normalized output
against the pre-run content — a literal diff produces false positives due to a real,
demonstrated non-idempotency bug in the generators (see § THEME-02 Watcher Design).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| EN/DE structural-fingerprint comparison | Build tooling (Node script, Dockerfile gate) | — | Pure static-analysis over build output; no runtime component, no browser code |
| Language-switcher order normalization | Build tooling (comparison logic) | Source (`LangSwitcher.astro`, informs the exclusion rule but is not changed) | The asymmetry is a rendering property of a shared component; the gate must model it, not "fix" it (it is not a bug) |
| THEME-02 generator-drift watcher | Build tooling (Node script, Dockerfile gate) | Source (`scripts/build-light-palettes.mjs` / `tokenize-theme-colors.mjs` / `build-light-overrides.mjs`, read but not permanently mutated) | Same tier as the other four `verify-*.mjs` gates; operates on `src/**/*.astro`, the one dist-independent gate in this family (precedent: `verify-typo-motion.mjs` assertion 6 already reads source, not just `dist/`) |
| Pairing logic (`EN file <-> DE file`) | Build tooling (shared lib module) | — | Currently duplicated verbatim in three existing gates; this phase is the natural point to extract it, since a fourth (soon fifth) copy would be the fourth error surface |

## Standard Stack

No new runtime dependencies. This phase is pure Node.js (`fs`, `path`, plain regex/string
processing), matching every existing `verify-*.mjs` script exactly. `sharp` (already a
dependency, used by `verify-layers.mjs`) is not needed here — there is no pixel/image work.

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins (`node:fs`, `node:path`) | Node 22 (per `Dockerfile` `FROM node:22-alpine`) | Read `dist/**/*.html`, read/write `src/**/*.astro` | Every one of the four existing `verify-*.mjs` gates uses only built-ins; there is no reason to diverge |

### Supporting

None needed.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled regex tag tokenizer (this doc's approach, matches project convention) | An HTML parser package (`node-html-parser`, `parse5`, `linkedom`) | A real parser would be more robust against malformed HTML, but this codebase's four existing gates all use `readFileSync` + regex/string ops over `dist/**/*.html`, never a parser dependency. Introducing one here would be the only `verify-*.mjs` script with an external dependency, breaking the established pattern for no measured benefit — the probe below shows a ~150-line regex tokenizer already produces clean, actionable signal over the real 8,678-pair corpus. |

**Installation:** none — no new packages.

**Version verification:** N/A, no packages to verify.

## Package Legitimacy Audit

**N/A — this phase installs no external packages.** All tooling is plain Node.js built-ins,
consistent with the four existing `verify-*.mjs` scripts (`verify-fx.mjs`, `verify-help.mjs`,
`verify-typo-motion.mjs`, `verify-layers.mjs`), none of which have external dependencies either.
`sharp` is already a project dependency (used by `verify-layers.mjs`) and is not needed for this
phase's scope.

## The Decisive Measurement

This section documents the probe that was built and run against a real `npm run build` of this
worktree (build completed 2026-08-08, produced 17,361 files under `dist/`). The probe source is
not part of the deliverable — it is a throwaway research script — but every number below is real
output, not an estimate.

### Pairing (reused verbatim from `verify-fx.mjs` assertion 6)

```
EN files total: 8683
Pairs found: 8678
Unpaired EN files: 5 -> dist/404.html, dist/downloads/onepager-contested-zones.html,
  dist/downloads/onepager-storm-breaker.html, dist/onepager/contested-zones/index.html,
  dist/onepager/storm-breaker/index.html
```

- `dist/404.html` is the one confirmed-unpaired page (matches CONTEXT.md's measured state: 70 EN
  `.astro` files under `src/pages/`, 69 DE under `src/pages/de/`, 404 the only gap — verified
  independently: `find src/pages -maxdepth 4 -iname "*.astro" ! -path "*/de/*"` → 70,
  `find src/pages/de -iname "*.astro"` → 69).
- The other 4 unpaired files are **not Astro page pairs at all** — they are static files copied
  verbatim from `public/downloads/` and `public/onepager/` (a German-only downloadable resource,
  see § Legitimate Differences below). The existing pairing logic already skips them silently
  (no DE counterpart found → not counted as a pair), which is correct behavior, not a bug to fix.
- **8,678 ≠ 69.** The 69 CONTEXT.md refers to are hand-maintained **source** `.astro` file pairs.
  Several of those are dynamic route templates (`src/pages/items/[id].astro`,
  `src/pages/missionen/[slug].astro`, `src/pages/patches/[slug].astro`, `src/pages/topics/[slug]`
  equivalents) that each expand into hundreds of built pages. **D-02's "all 69 pairs" is correctly
  enforced by gating all 8,678 built pairs** — this is exactly what the three existing gates
  already do (their own header comments call this "8.678 gebaute Seitenpaare"), and the new gate
  should follow the identical precedent rather than trying to operate at the source-file level.

### Fingerprint definition comparison

Five candidate definitions were computed over all 8,678 pairs:

```
  flatSorted     pairs-with-diff: 1712/8678   total-mismatches: 13159   max: 19
  flatOrdered    pairs-with-diff: 1712/8678   total-mismatches: 13159   max: 19
  depthAware     pairs-with-diff: 1712/8678   total-mismatches: 13159   max: 19
  tagOnly        pairs-with-diff: 1712/8678   total-mismatches: 6639    max: 15
  bag(multiset)  pairs-with-diff: 81/8678     total-mismatches: 103     max: 11
```

**Finding: sorting classes, preserving author order, and tracking nesting depth are all
equivalent in this codebase.** `flatSorted` (classes alphabetized), `flatOrdered` (classes as
literally authored), and `depthAware` (position tag also encodes nesting depth) produced
**identical** pair-level and mismatch-level results. This is because Astro's templates emit
classes in a deterministic order every build — there is no case in the corpus where the same
tag+class-set appears at a different nesting depth on one side only. **Recommendation: use the
simplest definition** — `tagName + '.' + classAttributeValue` exactly as authored, no sorting, no
depth tracking. Depth-tracking and class-sorting are extra implementation complexity that this
measurement shows buys nothing.

**Finding: `tagOnly` is strictly weaker and must not be used alone.** It undercounts by ~50%
because it cannot see class-level swaps at the same tag position (e.g., two `<span>` elements
that trade classes) — but D-01 explicitly requires "Element-Typen **und** Klassen", so tag-only
comparison does not satisfy the locked decision.

**Finding: `bag`(multiset) is the REJECTED alternative, and the measurement shows exactly why
D-01 rejected it.** A pure count-based comparison collapses 1,712 differing pairs down to just 81
— it makes the langsw reordering (see below) invisible "for free", but at the cost of also making
invisible any redesign that moves a whole section elsewhere in the page without changing element
counts. D-01's own rationale ("reine Zählungen ... übersehen vertauschte Reihenfolge") is
empirically confirmed: order-sensitive comparison is necessary, which is precisely why the
exclusion-list work below is required — an order-insensitive fingerprint would not have needed
one.

### The single dominant "difference": `LangSwitcher.astro`'s fixed-locale-order rendering

Histogram of the `flatSorted` mismatch count across all 8,678 pairs:

```
  diff=0: 6966 pairs
  diff=1: 78 pairs
  diff=4: 4 pairs
  diff=8: 1627 pairs
  diff=11: 1 pairs
  diff=19: 2 pairs
```

1,627 of the 1,712 differing pairs (95%) show **exactly** the same mismatch magnitude, 8. Manual
inspection (`dist/feedback.html` vs `dist/de/feedback.html`, then confirmed on several more)
traced this to `src/components/LangSwitcher.astro`:

```astro
{LOCALES.map((l, i) => (
  <>
    {i > 0 && <span class="langsw__sep" aria-hidden="true">/</span>}
    {l === lang ? (
      <span class="langsw__cur" lang={l} aria-current="true">{LOCALE_SHORT[l]}</span>
    ) : (
      <a class="langsw__opt" href={targetFor(l)} lang={l} hreflang={l} aria-label={LOCALE_LABEL[l]}>{LOCALE_SHORT[l]}</a>
    )}
  </>
))}
```

`LOCALES` is iterated in a **fixed** order regardless of the current page's language. Which slot
renders `<span class="langsw__cur">` versus `<a class="langsw__opt">` depends on which locale
matches the *current* page — so the EN build of a page renders `[span.cur, span.sep, a.opt]` at
that DOM position, and the DE build of the **same page** renders `[a.opt, span.sep, span.cur]`.
Tag types and classes both change position. This is not a bug — it is what a "current language
first, then the alternative" widget necessarily does when built at compile time from a
locale-invariant array — but it is a real, order-sensitive structural difference that appears
**twice per page** (the header topbar instance and the mobile "deck" menu instance, hence
mismatch-of-8 = two langsw instances × [2 EN-only + 2 DE-only] elements each).

**This single, mechanically-understood pattern accounts for 1,627 of 1,712 differing pairs
(95%).** Without excluding it, the gate would fail on virtually every page pair on day one.

**Recommendation:** do not exclude `.langsw` from the fingerprint entirely (that would hide a
real regression, e.g. a broken `hreflang` or a missing locale). Instead, special-case it: verify
the `.langsw` subtree exists the same number of times on both sides and carries the same
**multiset** of child classes (`{cur:1, opt:1, sep:1}` per instance for a 2-locale site), but
exclude its children from the page's ordered sequence before running the strict positional
comparison on everything else.

### Residual differences after the langsw exclusion (~85 pairs, ~1%)

The four remaining histogram buckets (`diff=1`, `diff=4`, `diff=11`, `diff=19`) were inspected
individually — each resolves to a specific, explainable, named cause:

**1. 78 pairs, `diff=1`/`bag=1` — item detail pages, e.g. `dist/items/hardy-boots.html`.** DE has
one extra `<p class="dp-desc">` that EN lacks. Traced to `src/components/ItemDetail.astro:143`:
`{desc && <p class="dp-desc">{desc}</p>}` — the paragraph only renders when a description string
exists for that locale. Direct inspection of `assets/universal-items.json` for `hardy-boots`
confirms the item record has `game.descDe` (a full German description) but **no English
description field at all**. This is a genuine upstream data gap (CIG's own extracted game data
has no English flavor text for these ~78 items), not a template or authoring bug. Verified on 6
of the 78 items — all consistently DE-has-it/EN-lacks-it, never the reverse.
**This needs an explicit operator decision, not a silent exclusion**: either (a) name it as an
accepted, data-driven asymmetry (same category as "pages where only one language deliberately
shows something", already anticipated in CONTEXT.md's known-false-positive list) and exclude
`.dp-desc` presence-only mismatches by rule, or (b) treat it as a data-completeness finding
belonging with Phase 1.3's DATA-* work and file it as a follow-up outside this phase's scope.
Recommend flagging as `checkpoint:human-verify` in the plan rather than deciding silently either
way — this is exactly the kind of "unexplained exclusion is a blind gate" case CONTEXT warns
about.

**2. 2 pairs, `diff=19`/`bag=11` — `topics/4-0-0-contested-zones.html`,
`topics/4-2-0-storm-breaker.html`.** DE has one extra `<section class="opl-wrap reveal">`
(`OnepagerLink` component: an `<a>` + 2 `<span>`s) that EN lacks, plus an SVG icon inside it
(explaining the `svg`/`path` count differences in the bag diff). Traced to
`src/components/topics/4-0-0-contested-zones.astro:178-186`, which carries an explicit source
comment: *"Den Onepager gibt es nur auf Deutsch (public/onepager/) — die EN-Seite verlinkte ihn
deshalb noch nie und soll das auch nicht anfangen."* This is a **confirmed, deliberate,
already-documented** design decision (the `{de && <OnepagerLink .../>}` conditional). It also
explains 2 of the 5 dist-level "unpaired" files from the pairing step above
(`public/downloads/onepager-*.html`, `public/onepager/*/index.html` — the standalone one-page
guides themselves, which correctly have no DE-labeled counterpart because there's only one
language of them). **Recommend a named exclusion**: `OnepagerLink`/`.opl-wrap` may legitimately
appear on the DE side only, on exactly these two topic pages.

**3. 1 pair, `diff=11`/`bag=3` — `impressum.html`.** DE carries one extra `<h2>`+`<p>` pair (and
one fewer `<p class="dp-muted">`, likely from adjacent list restructuring). Direct extraction of
all `<h2>` text confirms DE has an extra heading with no EN equivalent:
`"Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV"` (German Medienstaatsvertrag
"responsible person" disclosure — a legally mandated section under German media law with no
requirement, and typically no direct equivalent, in an English-language notice aimed at an
international audience). **Recommend a named exclusion**: the `§ 18 MStV` responsibility section
in `impressum.astro` is DE-only by German legal requirement, not drift. (This surfaces alongside
CONCERNS.md's separate note that `impressum.astro`/`datenschutz.astro` "still carry unfilled
`[TODO]` placeholders" — that finding is orthogonal to structural parity and is not in this
phase's scope per CONTEXT's boundary, but is worth flagging to the operator since it touches the
same file.)

**4. 4 pairs, `diff=4` — `missionen.html`, `schiffe.html`, `topics/crafting.html`,
`missionen/rank-cargo-haul-emptymission.html`.** Manual re-inspection of `missionen.html` with an
exact (non-approximated) alignment algorithm found the **same** langsw pattern (2 instances × 4
elements = 8 total unmatched elements), not a distinct 4-element difference. The `diff=4` reported
by the batch probe for these specific pairs is a **measurement artifact of the probe's own
performance shortcut**, not a real second pattern: the probe fell back to a cheap position-wise
approximation (rather than full LCS alignment) for pages over 4,000 tokens to avoid O(n²) memory
blowup, and that approximation undercounts when swapped elements happen to realign without
cascading. **This is a limitation of the throwaway research probe, not of the recommended design**
— the actual gate should either (a) run the langsw-subtree exclusion *before* the sequence
comparison (which shrinks the remaining sequence enough that exact LCS is affordable even on the
largest pages), or (b) use a linear-time positional diff once the excluded subtrees are already
stripped out, since after exclusion there should be zero legitimate reordering left to align
against. **Recommend the plan's tracer wave explicitly re-verify these 4 pairs** once the langsw
exclusion is implemented, to confirm they reduce to `diff=0` and are not a fifth undiscovered
pattern.

### Bottom line for D-03 ("fix first, then sharpen")

The "first run" the operator asked for turned up:
- **Zero pages requiring an actual page-structure fix.** Every residual difference is either (a)
  the langsw pattern (needs a comparison-logic exclusion, not a page fix), (b) a confirmed
  deliberate design choice (needs a named, documented exclusion), or (c) a data-completeness gap
  belonging to a different phase's scope (needs an operator decision, not a code fix here).
- **The scope of "fix" work for this phase is therefore small-to-none** at the page-content level.
  The bulk of the implementation work is in the comparison tool itself (the exclusion registry),
  not in editing `.astro` pages. This is good news relative to D-03's stated risk ("fällt er
  unerwartet groß aus, ist das ein Befund für den Betreiber") — report to the operator that the
  residue is small and almost entirely explainable, with one item (the 78-item description gap)
  needing an explicit decision.

## Architecture Patterns

### System Architecture Diagram

```
   npm run build
        |
        v
   dist/**/*.html  (8,678 EN/DE pairs, plus a handful of unpaired static files)
        |
        |  [1] pairing: scripts/lib/page-pairs.mjs (NEW, extracted from verify-fx.mjs)
        |      walk dist/*.html -> match EN path to DE path (dist/de/** or dist/de.html)
        |      guard: < 60 pairs found => pairing itself is broken, abort loud
        v
   for each pair (EN html, DE html):
        |
        |  [2] tokenize: strip <script>/<style> inner text + comments,
        |      walk tags in document order, capture (tagName, class attr, depth)
        v
   EN tag-sequence            DE tag-sequence
        |                           |
        |  [3] normalize: strip .langsw subtree from the ordered sequence;
        |      collect its children separately as a per-instance multiset
        v                           v
   EN sequence (langsw-free)  DE sequence (langsw-free)
        |                           |
        +----------> [4] compare: ordered tag.class sequences must be IDENTICAL
        |                          .langsw multisets must match per instance
        |                          (both after applying named EXCLUSIONS registry
        |                           entries: OnepagerLink-DE-only, Impressum-MStV,
        |                           any operator-approved item-desc rule)
        v
   [5] Soll/Ist report, exit 1 on any unexplained mismatch
        |
        v
   Dockerfile RUN chain (after verify:layers, before image is produced)
```

### Recommended Project Structure

```
scripts/
├── verify-sync.mjs           # NEW — SYNC-01/02 gate (npm run verify:sync)
├── verify-theme-gen.mjs      # NEW — THEME-02 gate (npm run verify:theme)
├── lib/
│   ├── page-pairs.mjs        # NEW — extracted pairing logic (see below)
│   └── sync-exclusions.mjs   # NEW — named EXCLUSIONS registry, same shape as layer-registry.mjs
├── verify-fx.mjs             # UNCHANGED except importing page-pairs.mjs instead of its inline copy
├── verify-help.mjs           # UNCHANGED except importing page-pairs.mjs instead of its inline copy
├── verify-typo-motion.mjs    # UNCHANGED except importing page-pairs.mjs instead of its inline copy
└── verify-layers.mjs         # UNCHANGED (no pairing logic — LAYER-01/02 doesn't compare EN/DE pairs)
```

### Pattern 1: Extract the duplicated pairing logic (Claude's Discretion item, answered)

**What:** `verify-fx.mjs` (assertion 6), `verify-help.mjs` (assertion 3), and
`verify-typo-motion.mjs` (assertion 5) each contain the **identical** ~15-line block:

```javascript
// Source: scripts/verify-fx.mjs assertion 6 (identical in verify-help.mjs, verify-typo-motion.mjs)
const set = new Set(htmlFiles);
const enFiles = htmlFiles.filter((f) => !f.startsWith('dist/de/') && f !== 'dist/de.html');
let pairs = 0;
const mismatches = [];
for (const f of enFiles) {
  const rel = f.slice('dist/'.length);
  const dePath = rel === 'index.html' ? 'dist/de.html' : 'dist/de/' + rel;
  if (!set.has(dePath)) continue;
  pairs++;
  // ... per-pair comparison specific to each script ...
}
if (pairs < 60) fail(`Zu wenige Seitenpaare gefunden (${pairs} < 60) — Paarungslogik pruefen`);
```

**When to use:** Any new gate that needs EN/DE built-page pairs (this phase's `verify-sync.mjs`
is the fourth consumer).

**Recommendation:** Extract into `scripts/lib/page-pairs.mjs` exporting a single function, e.g.
`findPagePairs(htmlFiles)` returning `{ pairs: [[enPath, dePath], ...], enOnlyFiles: [...] }`, with
the "< 60 pairs" guard as a second exported helper (`assertMinimumPairs(pairs, fail)`) so callers
keep their own `fail()`/`console.error` style. **Migrate all three existing gates to import from
it** (CONTEXT's discretion question — "dürfen dabei nicht schwächer werden" — extraction with
identical logic cannot weaken them; it is the same code, moved). Do **not** also share the
comparison logic (marker counting vs. structural fingerprint vs. token counting) — only the
pairing step is duplicated, the comparisons are each gate's own concern.

### Pattern 2: Registry-driven named exclusions (reuse of `verify-layers.mjs`'s proven shape)

**What:** `scripts/lib/layer-registry.mjs` already exports an `EXCLUSIONS` array with `id`,
rationale text, and a matcher (`selectorFamilies` in that file's case). `verify-layers.mjs`'s
"Vollständigkeitswächter" (assertion 5) fails if it finds a matching pattern in the built output
that has **no** registry or exclusion entry — turning "did we forget to name a case" into a hard
build failure instead of a silent gap.

**When to use:** For `verify-sync.mjs`'s exclusion list (langsw multiset rule, OnepagerLink-DE,
Impressum-MStV, and whatever the operator decides for the item-description gap).

**Example:**
```javascript
// Source: pattern adapted from scripts/lib/layer-registry.mjs EXCLUSIONS
export const EXCLUSIONS = [
  {
    id: 'X-langsw-order',
    rationale:
      'LangSwitcher.astro renders LOCALES in a fixed array order; which slot is "current" ' +
      'vs "other" depends on the page\'s own language, so DOM order legitimately differs. ' +
      'Verified as a multiset (not sequence) match instead: {cur:1, opt:1, sep:1} per instance.',
    selector: '.langsw',
    mode: 'multiset-children',
  },
  {
    id: 'X-onepager-de-only',
    rationale:
      'src/components/topics/4-0-0-contested-zones.astro and 4-2-0-storm-breaker.astro ' +
      'intentionally gate <OnepagerLink> behind {de && ...} — the standalone guide only ' +
      'exists in German (public/onepager/). Source comment confirms this is deliberate.',
    pages: ['topics/4-0-0-contested-zones', 'topics/4-2-0-storm-breaker'],
    allowExtra: { side: 'de', selector: '.opl-wrap' },
  },
  {
    id: 'X-impressum-mstv',
    rationale:
      'impressum.astro DE carries a "§ 18 Abs. 2 MStV" responsibility section required by ' +
      'German media law with no EN equivalent expected. Verified via <h2> text extraction.',
    pages: ['impressum'],
    allowExtra: { side: 'de', selector: 'h2' }, // + its following <p>, see plan for exact matcher
  },
  // X-item-desc-gap: PENDING — do not add until the operator has decided fix-vs-exclude
  // for the 78 items missing an English game description (see RESEARCH.md § Residual differences).
];
```

### Anti-Patterns to Avoid

- **Folding the new gate into `npm run verify` (`scripts/_verify.mjs`) or `audit:site`
  (`scripts/audit-site.mjs`).** The ROADMAP's own draft phrasing for plan 04-02 says "in `npm run
  verify` bzw. `audit:site` einhängen" — but this contradicts the established pattern.
  `_verify.mjs` is a link/asset-integrity checker (`href`/`src`/`url()` resolution);
  `audit-site.mjs` is SEO/a11y (confirmed by CONCERNS.md: "the audit script family covers
  SEO/a11y, not pair parity"). All four existing structural/behavioral gates (`verify:fx`,
  `verify:help`, `verify:typo`, `verify:layers`) are **standalone npm scripts**, wired directly
  into the `Dockerfile` `RUN` chain, not merged into either of those two. Follow that precedent:
  `npm run verify:sync` and `npm run verify:theme` as their own scripts, appended to the same
  Dockerfile `RUN` line.
- **Excluding `.langsw` from the fingerprint entirely (page-wide skip)** instead of doing the
  narrower multiset check. A full skip would also hide a genuinely broken language switcher (e.g.
  a missing `hreflang`, or one locale silently vanishing) — the multiset check keeps that
  detection while removing only the known reordering.
- **A generic "allow any difference under selector X" exclusion without a documented rationale
  string.** CONTEXT is explicit: "eine stillschweigende Ausnahme ist dasselbe wie ein blindes
  Tor." Every entry needs the same treatment `layer-registry.mjs`'s `EXCLUSIONS` already models.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| EN/DE built-page pairing | A fourth copy of the pairing loop | `scripts/lib/page-pairs.mjs` (extracted from the existing three copies) | Identical logic already proven correct three times; a fourth hand-typed copy is a fourth place a future edit can silently diverge from the other three |
| Sequence alignment / diffing for the negative-control proof | A hand-rolled diff printer | The existing `diffArrays`-style LCS approach is fine for the gate's own *report* output, but keep it bounded (see § Common Pitfalls — large-page performance) | Full generality (handling insert/delete/move) is not needed; the gate only needs equal/not-equal plus a short, human-readable location of the first divergence |

**Key insight:** almost nothing here needs new machinery. The four existing gates already
demonstrate the exact shape needed (read `dist/`, cache file contents once, assert, Soll/Ist
print, single exit code). The actual work is in getting the **exclusion list right**, not in
tooling novelty.

## Common Pitfalls

### Pitfall 1: A literal byte-diff of the THEME-02 generator output produces false positives

**What goes wrong:** Running `npm run theme` (all three generators) for real against this
worktree and then diffing against the pre-run state shows **67 files changed, 395 insertions(+),
337 deletions(-)** with default git settings (`core.autocrlf=true`, confirmed via
`git config --get core.autocrlf`) — even though **no palette value actually changed**. Every
diff inspected (`index.astro`, `impressum.astro`, `feedback.astro`, `precision-jump.astro`, and
several `topics/*.astro`) was a single **extra blank line** inserted after the generated marker
comment, or a reordering of two adjacent comment/rule lines with no semantic difference.

**Why it happens:** `build-light-palettes.mjs` (and separately `build-light-overrides.mjs`) strip
their own previous output via regex before re-inserting it, but the strip pattern and the
re-insert template are not perfectly symmetric — running the generator twice in a row is not
fully idempotent at the whitespace level, even though it is idempotent at the semantic (CSS
value) level.

**How to avoid:** The THEME-02 watcher must **not** do a literal byte-diff of "before generator
run" vs "after generator run". It must normalize whitespace (collapse multiple blank lines to
one, trim trailing whitespace per line, normalize `\r\n` to `\n`) before comparing, and ideally
compare only the content **inside** each generated marker block (`/* Hellmodus — erzeugt von
scripts/build-light-palettes.mjs... */` through the matching `:root[data-theme="light"]{...}`,
and separately the `/* Hell-Entsprechungen — erzeugt von scripts/build-light-overrides.mjs...
*/` block), not the whole file.

**Warning signs:** If a first implementation of `verify-theme-gen.mjs` reports every single
`.astro` file with a palette block as "hand-edited" on a totally clean tree, this is why — it's
comparing raw bytes including the generator's own whitespace non-determinism, not real content.

### Pitfall 2: `assets/theme.css`'s own `:root[data-theme="light"]` block is NOT actually
regenerated by any of the three `npm run theme` scripts, despite its header comment

**What goes wrong:** `assets/theme.css` (line 41) states in its own header comment: *"Erzeugt von
scripts/build-light-palettes.mjs."* But `build-light-palettes.mjs`, `tokenize-theme-colors.mjs`,
and `build-light-overrides.mjs` **all** glob only `src/**/*.astro` (confirmed by reading all
three scripts' `glob(...)` calls) — none of them touch `assets/*.css` at all. Running
`build-light-palettes.mjs --dry` against this worktree confirms it: it reports changes to 64
files, all under `src/`, and never mentions `assets/theme.css`.

**Why it happens:** `assets/theme.css`'s `:root[data-theme="light"]` block (lines 117–162) is the
**fallback** palette (documented in its own comment as "abgeleitet aus der dunklen
Rückfallpalette in `detail.css`") — it appears to have been derived once, by hand, using the same
color-derivation rules the generator uses (`LIGHT_RULES` in `scripts/lib/theme-color.mjs`), but
it is not wired into the automated pipeline that regenerates page-level blocks.

**How to avoid:** Scope THEME-02's watcher explicitly to `src/**/*.astro` (matching what the
generators actually touch), and **flag this documentation/reality mismatch as an open item for
the plan** rather than silently either (a) pretending `theme.css`'s block is covered, or
(b) extending the generator's glob to include it (a real code change, out of this research
document's authority, and a decision the plan should make explicitly with the operator, since it
changes what `npm run theme` does going forward).

### Pitfall 3: Running the theme generators for real mutates the working tree — safe in the
Dockerfile build stage, destructive on a developer's machine

**What goes wrong:** `build-light-palettes.mjs`, `tokenize-theme-colors.mjs`, and
`build-light-overrides.mjs` all write files in place (no `--dry` flag by default). Running them
for real to compare "would the generator produce this?" mutates `src/**/*.astro` immediately.

**Why it happens:** These are one-shot codemod-style scripts, not idempotent read-only checks —
by design (they're meant to be run by a developer after editing a palette, then reviewed via
`git diff`).

**How to avoid:** This is safe **only** inside the disposable Dockerfile build stage, where
`COPY . .` produces a container-local checkout that is discarded after the image is built —
mutating it has no effect on the developer's actual repository (confirmed: `verify:sync` and
`verify:theme` both run **after** `npm run build` in the `RUN` chain, so `dist/` is already
produced from the untouched source before this check runs; mutating `src/` afterward cannot
retroactively change `dist/`). If the plan also wants this runnable locally via `npm run
verify:theme` for a developer's own sanity check, the script must either (a) copy the target
files to a scratch temp directory first and run the generators there, or (b) capture full file
content in memory before running, run for real, compare, and then **write the original content
back** (self-revert) regardless of pass/fail. Do not ship a script that silently leaves a
developer's working tree modified.

### Pitfall 4: CRLF normalization matters for THEME-02's comparison, but not for the SYNC
structural-fingerprint gate

**What goes wrong:** The project's own documented trap ("a stray `\r` already caused a mass edit
to delete a `</style>` while the build still went green") applies specifically to **line-wise**
regex processing. The `verify-theme-gen.mjs` design above does line-wise whitespace
normalization, so it must apply the documented `\r\n?` normalization before any line-based
comparison.

**How to avoid double-applying caution where it doesn't matter:** The `verify-sync.mjs` tag
tokenizer (this phase's primary deliverable) is **not** line-based — it walks `<tag attr="...">`
patterns with `\s`/`[^<>]` character classes that match `\r` correctly either way, exactly like
the existing `verify-fx.mjs`/`verify-help.mjs`/`verify-typo-motion.mjs` tokenizers (all of which
already operate on raw `dist/**/*.html` text without any CRLF-specific handling and have not hit
this bug — confirmed by reading all four existing scripts, none normalize line endings). Confirm
in the plan that the CRLF caution is scoped to THEME-02's line-wise diff, not misapplied to the
SYNC gate's tag scanner.

### Pitfall 5: The Negativkontrolle (Success Criterion 2) needs to be actually executed, not just
asserted in prose

**What goes wrong:** CONTEXT's own "Specific Ideas" section states plainly: *"Drei Tore dieses
Projekts wurden so bewiesen; das eine, das niemand geprüft hatte, war blind."* — three of the
four existing gates were proven at some point (during their own phase's execution) by
deliberately breaking something and confirming the gate catches it; one was not, and that gap is
exactly why this diligence is being called out now.

**How to avoid:** The plan must include an explicit step (in the tracer wave) that: (1) takes a
clean built `dist/` that currently passes `verify:sync`, (2) makes a small, deliberate structural
break in a **scratch copy** (e.g. delete one element from one DE page, or reorder two sections),
(3) runs `verify:sync` again and confirms it now exits 1 with a clear message pointing at the
broken pair, (4) discards the scratch copy. Document this run (command + output) in the plan's
SUMMARY, the same way prior phases' negative controls are apparently expected to be documented
(CONTEXT frames this as a pattern already established elsewhere in the project, even though the
specific prior SUMMARY files documenting it were not in this research's required reading list).

### Pitfall 6: Large pages make naive LCS-based sequence alignment expensive

**What goes wrong:** `missionen.html` alone tokenizes to 33,242 elements; a full O(n·m)
LCS/edit-distance table at that size is ~1.1 billion cells — far too slow/memory-heavy to run
per-pair across 8,678 pairs in a Dockerfile gate.

**Why it happens:** A structural fingerprint that needs to say not just "different" but "here is
where" for a human-readable failure message naturally wants an alignment algorithm, and the
naive one is quadratic.

**How to avoid:** Apply the `.langsw`-subtree exclusion (and the other named exclusions) **before**
running any alignment — this dramatically shrinks the remaining sequence and removes the only
source of legitimate reordering found in this measurement. After exclusion, an exact-match
"are these two arrays identical" check (linear time, `O(n)`) is sufficient for the pass/fail
verdict; a full alignment is only needed for the failure-message diagnostics, and can be run
lazily (only on the specific pair that failed the fast check), keeping the gate fast on the
common (passing) path.

## Code Examples

### Reused pairing logic (verbatim from the existing three gates)

```javascript
// Source: scripts/verify-fx.mjs (identical in verify-help.mjs, verify-typo-motion.mjs)
const set = new Set(htmlFiles);
const enFiles = htmlFiles.filter((f) => !f.startsWith('dist/de/') && f !== 'dist/de.html');
let pairs = 0;
for (const f of enFiles) {
  const rel = f.slice('dist/'.length);
  const dePath = rel === 'index.html' ? 'dist/de.html' : 'dist/de/' + rel;
  if (!set.has(dePath)) continue;
  pairs++;
}
if (pairs < 60) fail(`Zu wenige Seitenpaare gefunden (${pairs} < 60) — Paarungslogik pruefen`);
```

### Tag+class tokenizer that produced the measurement above (starting point for `verify-sync.mjs`)

```javascript
// Research probe — strips script/style bodies and comments, walks tags in
// document order, captures tag name + literal class attribute value.
function tokenize(html) {
  let s = html.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, '$1$3');
  s = s.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, '$1$3');
  const tags = [];
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^<>]*?)?)\/?>/g;
  let m;
  while ((m = tagRe.exec(s))) {
    if (m[0].startsWith('</')) continue;
    const name = m[1].toLowerCase();
    const attrs = m[2] || '';
    const classMatch = /\bclass\s*=\s*"([^"]*)"/i.exec(attrs) || /\bclass\s*=\s*'([^']*)'/i.exec(attrs);
    const classes = classMatch ? classMatch[1].trim().split(/\s+/).filter(Boolean) : [];
    tags.push(`${name}.${classes.join('.')}`); // literal order, no sorting — see measurement above
  }
  return tags;
}
```

### `LangSwitcher.astro`'s render (the source of the dominant "difference")

```astro
// Source: src/components/LangSwitcher.astro:48-59
<div class="langsw" role="group" aria-label={t('nav.langSwitch')}>
  {LOCALES.map((l, i) => (
    <>
      {i > 0 && <span class="langsw__sep" aria-hidden="true">/</span>}
      {l === lang ? (
        <span class="langsw__cur" lang={l} aria-current="true">{LOCALE_SHORT[l]}</span>
      ) : (
        <a class="langsw__opt" href={targetFor(l)} lang={l} hreflang={l} aria-label={LOCALE_LABEL[l]}>{LOCALE_SHORT[l]}</a>
      )}
    </>
  ))}
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| No EN/DE structural comparison at all (A4 in CONCERNS.md: "There is no check that a DE page and its EN base load the same stylesheets or declare the same selectors") | Four narrow, feature-specific pair comparisons already exist (`verify:fx`, `verify:help`, `verify:typo` assertion 5) | Phases 1.1, 1.2, 2 (each added its own narrow parity assertion as part of that phase's own gate) | Proves the "compare EN/DE built pairs, fail on mismatch, Dockerfile-gated" pattern works at scale (8,678 pairs) three times already — this phase generalizes it rather than inventing a new mechanism |

**Deprecated/outdated:** CONCERNS.md's own proposed fix approach for A4 ("compares the set of
`<link rel="stylesheet">` hrefs and the set of CSS selectors inside `<style is:inline>`") predates
D-01's locked decision and is superseded by the structural-fingerprint approach — do not resurrect
it; D-01 already weighed and rejected "Fingerabdruck-plus-Stil" for false-positive risk, and this
research's measurement (§ blind spot below) explains concretely why.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The operator will decide to exclude (not fix) the 78-item English-description gap, since backfilling missing CIG description text is a data-completeness task outside this phase's declared scope ("NICHT in dieser Phase: Übersetzungsqualität, Wortwahl, Textlängen") | § Residual differences, bucket 1 | If the operator instead wants it fixed here, the plan needs an additional data task (or a template change to suppress `dp-desc` symmetrically) rather than a pure comparison-tool exclusion — moderate scope change, but the exact 78 affected items are already enumerable from this research's probe output |
| A2 | Extending `build-light-palettes.mjs`'s glob to also cover `assets/theme.css` is out of this phase's scope, and the header-comment/reality mismatch in `theme.css` should only be flagged, not fixed, here | § Pitfall 2 | If the plan decides THEME-02 must also cover `theme.css`'s own block, that requires either a source code change to the generator (larger scope than "add a watcher") or a separate, narrower dedicated check just for that one file — worth a quick discuss-phase confirmation if not already settled |

## Open Questions

1. **Does the operator want the 78-item English-description gap fixed or excluded?**
   - What we know: 78 item detail pages have a German `game.descDe` field but no English
     equivalent, causing a genuine, data-driven structural asymmetry (`<p class="dp-desc">`
     present in DE only). Verified via direct database inspection.
   - What's unclear: whether this counts as "structure" (in scope, needs symmetric suppression or
     backfill) or "translation completeness" (explicitly out of scope per CONTEXT.md's domain
     boundary).
   - Recommendation: surface as a `checkpoint:human-verify` early in the plan, with the exact list
     of 78 affected item slugs available from this research's probe output on request.

2. **Should `assets/theme.css`'s own fallback `:root[data-theme="light"]` block be brought under
   the same generator/watcher umbrella, given its header comment already (incorrectly) claims it
   is?**
   - What we know: no script currently regenerates it; the claim in its own header comment is
     currently false.
   - What's unclear: whether fixing the comment (cheap, no behavior change) or extending the
     generator (real behavior change, needs its own testing) is preferred, or whether THEME-02's
     scope was always meant to be per-page blocks only.
   - Recommendation: the plan should make this explicit rather than silently picking one; a
     one-line comment correction is nearly free if the generator extension is deemed out of scope.

3. **The 4 pages that showed `diff=4` under the research probe's approximate algorithm
   (`missionen.html`, `schiffe.html`, `topics/crafting.html`,
   `missionen/rank-cargo-haul-emptymission.html`) — do they reduce cleanly to `diff=0` once the
   real gate applies the langsw exclusion with exact (not approximated) comparison?**
   - What we know: manual re-check of `missionen.html` with an exact algorithm found the same
     langsw-only pattern as everywhere else, suggesting yes.
   - What's unclear: this was only manually re-verified for one of the four.
   - Recommendation: the plan's tracer wave should explicitly re-run all four once the real gate
     exists, before declaring the residual difference count final.

## Security Domain

This phase adds build-time-only Node.js verification scripts with no runtime component, no user
input, no network access, and no authentication/session/crypto surface. `security_enforcement`
is `true` in `.planning/config.json`, so this section is included per policy, but the honest
finding is that almost no ASVS category applies.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No auth surface touched |
| V3 Session Management | No | No session surface touched |
| V4 Access Control | No | No access-control surface touched |
| V5 Input Validation | No (build-time only) | The scripts read files from the repository's own `dist/`/`src/` tree at build time; there is no external/user-controlled input. Not a validation surface in the ASVS sense. |
| V6 Cryptography | No | No cryptography involved |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| N/A | — | This phase's code runs only inside the Dockerfile build stage (a disposable, non-networked container) against files already present in the repository checkout. There is no attacker-controlled input path into these scripts. |

## Sources

### Primary (HIGH confidence — verified in this session against the real codebase)

- Direct execution: `npm run build` (this worktree, 2026-08-08) producing 17,361 files under
  `dist/`
- Direct execution: a throwaway Node probe tokenizing all 8,678 `dist/**/*.html` EN/DE pairs and
  computing 5 candidate structural-fingerprint definitions
- Direct execution: `npm run theme` for real against this worktree, followed by `git diff` /
  `git checkout --` to inspect and then fully revert the result (working tree confirmed clean
  afterward via `git status --short`)
- Direct file reads: `scripts/verify-fx.mjs`, `scripts/verify-help.mjs`,
  `scripts/verify-typo-motion.mjs`, `scripts/verify-layers.mjs`, `scripts/lib/layer-registry.mjs`,
  `scripts/build-light-palettes.mjs`, `scripts/tokenize-theme-colors.mjs`,
  `scripts/build-light-overrides.mjs`, `assets/theme.css`, `src/components/LangSwitcher.astro`,
  `src/components/ItemDetail.astro`, `src/components/topics/4-0-0-contested-zones.astro`,
  `Dockerfile`, `package.json`, `.planning/config.json`
- Direct data inspection: `assets/universal-items.json` (confirmed `game.descDe` present /
  English equivalent absent for sampled items)

### Secondary (MEDIUM confidence)

- `.planning/codebase/CONCERNS.md` § Class A — background/history on why the phase exists; its
  own numeric measurements are explicitly stale (superseded by CONTEXT.md's 2026-08-08
  measurement, which this research further superseded with the 8,678-pair build-level count)

### Tertiary (LOW confidence)

None — every quantitative claim in this document was verified against a real build in this
session.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, directly matches four existing precedent scripts
- Architecture: HIGH — the design directly extends a proven, four-times-repeated pattern in this
  codebase
- The decisive measurement: HIGH — real numbers from a real build, cross-checked with multiple
  independent inspection methods (source reading, direct data-file inspection, sample verification
  across multiple pairs per category)
- Pitfalls: HIGH — every pitfall documented here was personally triggered and observed in this
  session (the whitespace non-idempotency, the theme.css glob mismatch, the CRLF non-issue for
  tag scanning), not inferred from documentation

**Research date:** 2026-08-08
**Valid until:** Valid as long as `dist/` structure and `LangSwitcher.astro`/`ItemDetail.astro`
are unchanged — re-run the probe if a redesign lands between now and planning. Estimate 14 days
(this is a fast-moving milestone with near-daily phase completions).
