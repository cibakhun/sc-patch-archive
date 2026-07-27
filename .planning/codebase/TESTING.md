# Testing Patterns

**Analysis Date:** 2026-07-27

## Test Framework

**Runner:**
- Node's built-in test runner (`node:test`) — Node 22, no external framework.
- Config: none. The only wiring is the npm script in `package.json:45`.

**Assertion Library:**
- `node:assert` (strict style: `assert.strictEqual`, `assert.match`, `assert.ok`).

**Run Commands:**
```bash
npm run test:e2e     # node --test tests/e2e/**/*.test.js   (all tests)
npm run build        # REQUIRED first — layout.test.js reads dist/
npm run verify       # scripts/_verify.mjs   — link/asset integrity over dist/
npm run audit:site   # scripts/audit-site.mjs — site-wide publish audit over dist/
```
There is no watch mode and no coverage command.

## Test File Organization

**Location:** a single separate tree, `tests/e2e/`. Tests are NOT co-located
with source.

**Naming:** `<subject>.test.js`. Helpers live in `tests/e2e/helpers/`.

**Structure:**
```
tests/
└── e2e/
    ├── behavior.test.js         # item-finder interaction tests against the real script
    ├── db.test.js               # data integrity of assets/universal-items.json
    ├── layout.test.js           # built HTML in dist/ (DE+EN, nav wiring, no dev-speak)
    ├── account-hidden.test.js   # CSS/markup regression guard
    └── helpers/
        └── dom-mock.js          # hand-written MockElement/MockDocument + vm sandbox
```

## Test Structure

**Suite Organization** (`tests/e2e/behavior.test.js:75`):
```javascript
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { setupMockDOM } from './helpers/dom-mock.js';

describe('Laden & Grundzustand', () => {
  let dom;
  beforeEach(async () => {
    dom = await setupMockDOM({ db: makeDb(), craft: CRAFT_FIXTURE });
    await dom.runScript(path.resolve('assets/item-finder-app.js'));
    await dom.wait(10);
  });

  test('1. Alle Fixture-Items werden gerendert', () => {
    assert.strictEqual(cards(dom).length, 6);
  });
});
```

**Patterns:**
- **Test names are German and numbered** (`'1. …'`, `'2. …'`) continuing across
  `describe` blocks in the same file — keep the numbering when adding tests.
- Setup via `beforeEach` building a fresh mock DOM; no teardown needed (the vm
  sandbox is discarded per test).
- Small file-local query helpers instead of a testing-library
  (`cards(dom)`, `cardTitles(dom)` in `behavior.test.js:68`).
- Assertion messages carry the offending value: `` assert.ok(items.length > 8000, `nur ${items.length} Items`) ``.

## Mocking

**Framework:** none — a hand-rolled DOM in `tests/e2e/helpers/dom-mock.js`
(`MockElement` class with `classList`, `setAttribute`, `appendChild`,
`querySelector`, entity encode/decode mirroring real browser behaviour), executed
via `node:vm`.

**Pattern:**
```javascript
// The CANONICAL script is executed, never a copy or a re-implementation.
const dom = await setupMockDOM({ db: makeDb(), craft: CRAFT_FIXTURE });
await dom.runScript(path.resolve('assets/item-finder-app.js'));
await dom.wait(10);              // let the app's async init settle
dom.elements['uif-search-input'].value = 'alpha';
```

**What to Mock:**
- The browser (`document`, `window`, element APIs) — via `dom-mock.js`.
- The data payloads the client app fetches (`db`, `craft` fixtures passed to
  `setupMockDOM`).

**What NOT to Mock:**
- The application script itself. `assets/item-finder-app.js` is loaded from disk
  so the test always exercises the shipped code.
- The real data file. `tests/e2e/db.test.js` validates the actual
  `assets/universal-items.json`, not a fixture.
- The build output. `tests/e2e/layout.test.js` reads real files from `dist/`.

## Fixtures and Factories

**Test Data** — factory functions inside the test file, no shared fixture dir:
```javascript
function makeDb(fillerCount = 0) {
  const items = [ /* 6 hand-picked items in the REAL schema (obtain[]) */ ];
  for (let i = 1; i <= fillerCount; i++) items.push({ id: `zz-filler-${…}`, … });
  return { generator: 'scripts/build-universal-db.mjs', generatedAt: '2026-07-09',
           counts: { items: items.length, … }, items };
}
```
Fixtures deliberately include adversarial rows — e.g. `'Weird "Quoted" & Co'` for
escaping, `zz-filler-###` for pagination. The `fillerCount` parameter is the
factory knob for pagination tests. Fixtures must match the production schema
exactly (header fields `generator`/`generatedAt`/`counts` included).

**Location:** `tests/e2e/behavior.test.js` (top of file), alongside
`CRAFT_FIXTURE`.

## Coverage

**Requirements:** none enforced; no coverage tooling configured.

**View Coverage:**
```bash
node --test --experimental-test-coverage tests/e2e/**/*.test.js   # ad hoc, not wired up
```

**Practical coverage shape:** the four test files cover the item-finder client
app, the item database, built HTML, and one CSS regression. `src/lib/*.ts`,
`src/components/*.astro` and the `scripts/*.mjs` pipeline have no unit tests —
they are covered indirectly by `npm run verify` and `npm run audit:site` over
`dist/`, which is the project's real safety net.

## Test Types

**Unit Tests:** effectively none — no isolated tests of `src/lib` modules.

**Integration / behaviour tests:** `tests/e2e/behavior.test.js` — the real client
app driven through a mock DOM against fixture data.

**Data-contract tests:** `tests/e2e/db.test.js` — provenance header, count
consistency, minimum volume (>8000 items, >2000 sourced), unique slug-shaped ids,
no fabricated values, no placeholders.

**Build-output tests:** `tests/e2e/layout.test.js` — asserts DE (`dist/de/…`) and
EN (`dist/…`) pages exist, embed the right `window.__UIF` config (`"lang":"de"`),
carry every DOM anchor id the app needs, use honest copy, and contain no
developer-speak.

**Regression guards:** `tests/e2e/account-hidden.test.js` — regex-asserts both
the CSS (`.dsr [hidden] { display:none !important }`) and the markup
(`id="ovVerified" … hidden`), plus a third test proving the guard is still
*necessary*. Copy this three-part shape (symptom, fix, proof-the-fix-is-needed)
for new CSS/markup regressions.

**E2E in a browser:** not used.

## Common Patterns

**Async testing:**
```javascript
beforeEach(async () => {
  dom = await setupMockDOM({ db: makeDb() });
  await dom.runScript(scriptPath);
  await dom.wait(10);   // explicit settle instead of polling
});
```

**Asserting rendered HTML from dist/:**
```javascript
const deHtml = fs.readFileSync(path.resolve('dist/de/item-finder.html'), 'utf8');
assert.match(deHtml, /src=["'][^"']*item-finder-app\.js["']/i);
for (const id of ['uif-app', 'uif-search-input', …]) {
  assert.ok(deHtml.includes(`id="${id}"`), `fehlender Anker #${id}`);
}
```

**Negative assertions (dev-speak / leaks):**
```javascript
assert.ok(!/run the dataminer/i.test(deHtml));
```

## CI

`.github/workflows/build.yml` runs `npm ci` → data syncs (`continue-on-error`) →
`npm run build` → `node scripts/_verify.mjs`, and uploads `dist/` as an artifact.
`npm run test:e2e` and `npm run audit:site` are **not** in CI — run them locally
before shipping.

---

*Testing analysis: 2026-07-27*
