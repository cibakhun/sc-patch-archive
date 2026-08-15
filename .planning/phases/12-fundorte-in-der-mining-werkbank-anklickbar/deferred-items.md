# Deferred Items — Phase 12

Out-of-scope discoveries surfaced while executing 12-03, logged per the
Scope Boundary rule (not fixed, not part of `files_modified`).

## 1. `scripts/browser-smoke.mjs` — `vb.help.seen` dismissal is a no-op for every tool

**Found during:** 12-03 Task 3, while calibrating `scripts/probes/mining-locview-messung.mjs`.

**Issue:** `browser-smoke.mjs`'s `hellmodusSetzen()` writes
`localStorage.setItem('vb.help.seen', '{"all":1}')` to suppress the
first-visit auto-open of `<details class="tool-help">` sections before
measuring. `assets/tool-help.js` reads that value as `seen[id]`, keyed by
each tool's `data-tool-id` (e.g. `"mining"`, `"itemfinder"`) — never by a
collective `"all"` key. `seen["all"]` therefore never matches any real
`id`, so `!seen[id]` stays `true` and the panel opens anyway. This has been
true since the dismissal line was written; `browser-smoke.mjs`'s own six
assertions (JS errors, bad responses, CSP, leit-element visibility,
horizontal overflow, interaction probes) never depend on the help panel's
open/closed state, so the no-op went unnoticed.

**Confirmed via:** `scripts/probes/mining-locview-messung.mjs` reproduced
the real symptom this masks — a Playwright `locator.click()` on the
mining tile pin timed out because the wrongly-left-open
`.tool-help__body` (`position:absolute`, `z-index:14`) overlapped the
tile grid and intercepted the click. Fixed in the new probe by keying the
dismissal correctly: `localStorage.setItem('vb.help.seen',
JSON.stringify({ mining: 1 }))`.

**Why not fixed here:** `scripts/browser-smoke.mjs` is not in this plan's
`files_modified`, and none of its own six assertions are affected by the
open panel — no observable regression to `browser-smoke.mjs` itself.
Fixing it would touch a file this phase does not own.

**Suggested fix (for whoever picks this up):** key the dismissal per
`data-tool-id`, or iterate `document.querySelectorAll('details.tool-help')`
and build the `seen` object from their `data-tool-id` attributes before
writing it — mirrors what `assets/tool-help.js` itself does at
`openOnFirstVisit()`.
