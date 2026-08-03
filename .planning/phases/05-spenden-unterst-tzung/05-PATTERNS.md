# Phase 05: Spenden-Unterstützung ("Unterstützen") - Pattern Map

**Mapped:** 2026-07-31
**Files analyzed:** ~24 new/modified files (pages, components, functions, migrations, chrome edits)
**Analogs found:** 22 / 24

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/pages/support.astro` (EN) | page (thin wrapper) | request-response | `src/pages/feedback.astro` | exact |
| `src/pages/de/support.astro` (DE) | page (thin wrapper) | request-response | `src/pages/de/feedback.astro` | exact |
| thank-you page (EN+DE, path TBD by planner, e.g. `support-thanks.astro`) | page (thin wrapper) | request-response | `src/pages/feedback.astro` (its `.fbx-done` panel) OR `src/pages/account/*` simple pages | role-match |
| `src/components/SupportForm.astro` | component | request-response + form | `src/components/FeedbackForm.astro` | exact |
| `src/components/SupportStrip.astro` | component | static-content | none (new shape) — closest sibling is `Attribution.astro`'s `.attr-nav` link row | role-match |
| moderation UI (`src/pages/account/support-moderation.astro` or a tab, +DE) | page/component | CRUD (admin) | `src/scripts/account-dashboard.ts` (admin-gated tabs) + `Layout.astro`'s `is-admin` mechanism | role-match |
| `supabase/migrations/<ts>_donations.sql` (table + RLS) | migration | CRUD | `supabase/migrations/20260726000000_crafting_entries.sql` | exact (table+RLS shape) |
| donation-row write-guard trigger (in same or separate migration) | migration | event-driven (trigger) | `supabase/migrations/20260722200000_guard_rsi_verified.sql` | exact |
| public wall view (in same migration) | migration | CRUD (read-only view) | `supabase/migrations/20260723000000_public_profile_views.sql` | exact |
| `supabase/functions/create-checkout/index.ts` | service (edge function) | request-response, **no-JWT** | `supabase/functions/verify-rsi/index.ts` | role-match (auth model differs — see trap below) |
| `supabase/functions/stripe-webhook/index.ts` | service (edge function) | event-driven (webhook) | `supabase/functions/verify-rsi/index.ts` (service-role write half only) | partial (no existing webhook-shaped function in repo) |
| `supabase/config.toml` | config | — | none (doesn't exist yet) | no analog |
| `src/consts.ts` (new `SUPPORT` + `SUPPORT_DEMO` block) | config | — | `src/consts.ts` § `FEEDBACK`/`FEEDBACK_DEMO` (same file) | exact |
| `src/components/Attribution.astro` (new footer link) | component (modified) | static-content | itself — insertion point in `.attr-nav` | exact |
| `src/components/SiteNav.astro` (new deck item) | component (modified) | static-content | itself — `deckGroups[id='account'].items` array | exact |
| `src/i18n/ui.ts` (new keys) | i18n catalog (modified) | — | itself — `nav.feedback`/`nav.deck.sub.feedback` rows | exact |
| `src/lib/seo.ts` (`NOINDEX_PATHS` +thank-you) | config (modified) | — | itself | exact |
| `nginx/default.conf` (CSP) | config (modified) | — | itself — existing CSP directive list | exact |
| `src/pages/datenschutz.astro` + DE twin (new section) | page (modified) | static-content | itself — `#feedback` Web3Forms section | exact |
| `src/pages/item-finder.astro` + `de/item-finder.astro` (strip insertion) | page (modified) | static-content | itself — pre-`<Attribution>` insertion point | exact |
| `src/components/topics/crafting.astro` (strip insertion, shared EN+DE body) | component (modified) | static-content | itself — pre-`<Attribution>` insertion point | exact |
| `src/components/topics/mining.astro` (strip insertion, shared EN+DE body) | component (modified) | static-content | itself — pre-`<Attribution>` insertion point | exact |
| `src/pages/refinery.astro` + `de/refinery.astro` (strip insertion) | page (modified) | static-content | itself — pre-`<Attribution>` insertion point | exact |
| `src/pages/precision-jump.astro` + `de/precision-jump.astro` (strip insertion) | page (modified) | static-content | itself — pre-`<Attribution>` insertion point | exact |
| `assets/mobile-ux.css` (§5c extension, vertical variant) | utility (CSS, modified) | — | itself — §5c named-selector block | exact |
| `assets/theme.css` (new §4 support-gold block) | utility (CSS, modified) | — | itself — existing 3-block structure | exact |

## ⚠ Critical finding: the tool-page strip is a 5-INSERTION-POINT change, not a 1-file hook

Verified directly in the files (not assumed):

- **Item Finder**: `src/pages/item-finder.astro` + `src/pages/de/item-finder.astro` are two separate page files, each ending in its own `<Attribution>` call — **2 separate edits**.
- **Crafting** (the actual interactive tool D-08 means, `/topics/crafting.html`, NOT `/crafting.html`): body lives in **one shared** `src/components/topics/crafting.astro`, mounted by both `src/pages/topics/crafting.astro` (EN) and `src/pages/de/topics/crafting.astro` (DE) — **1 edit** covers both languages. (`src/pages/crafting/index.astro` is the blueprint *directory*, built on `DataShell.astro` — a mass-page shell, explicitly excluded by D-08; do not touch it.)
- **Mining** (`/topics/mining.html`): same shared-body pattern as Crafting — body in **one shared** `src/components/topics/mining.astro` — **1 edit** covers both languages.
- **Refinery**: `src/pages/refinery.astro` + `src/pages/de/refinery.astro` are separate page files, each with its own `<Attribution>` — **2 separate edits**.
- **Precision Jump**: `src/pages/precision-jump.astro` + `src/pages/de/precision-jump.astro` are separate page files, each with its own `<Attribution>` — **2 separate edits**.

**Total: 8 insertion points across 8 files** (not 5, not 10) — 3 tool pages are page-per-language (2 edits each = 6), 2 tool pages share one bilingual body component (1 edit each = 2). All 8 insertion points are structurally identical: `<SupportStrip lang="…" />` placed immediately before the page's `<Attribution ...>` call.

## Pattern Assignments

### `src/pages/support.astro` (EN) + `src/pages/de/support.astro` (DE)

**Analog:** `src/pages/feedback.astro` / `src/pages/de/feedback.astro` (thin-wrapper twins, hero + `.sec-head` + mounted shared component)

**Full shape to copy** (`src/pages/feedback.astro:1-64`):
```astro
---
import Layout from '../layouts/Layout.astro';
import SiteNav from '../components/SiteNav.astro';
import Attribution from '../components/Attribution.astro';
import FeedbackForm from '../components/FeedbackForm.astro';
import { versioned } from '../lib/assetVersion';
---
<Layout title={'Feedback | VerseBase'} description={'…'} themeColor="#0f0b06" ogType="article" ogImage="/assets/t-def-1.jpg" translated={true}>
<link slot="head" rel="stylesheet" href={versioned('assets/detail.css', '/assets/detail.css')} />
<style is:inline>
:root{--bg:#0f0b06;…;--accent:#f0a830;…}
/* Hellmodus — erzeugt von scripts/build-light-palettes.mjs. Nicht von Hand ändern. */
:root[data-theme="light"]{…}
.reveal{opacity:1 !important;transform:none !important}
.hero__in{max-width:var(--maxw)}
.fbwrap{max-width:var(--maxw);margin:0 auto;padding:0 clamp(1.25rem,5vw,4rem) 1rem}
.sec-head{max-width:var(--maxw);margin:0 auto 1.8rem;padding:0 clamp(1.25rem,5vw,4rem)}</style>
<a class="skip" href="#main">Skip to content</a>
<div class="cursorglow" aria-hidden="true"></div>
<SiteNav crumbs={[{ label: 'Archive', href: '/archiv.html' }, { label: 'Feedback' }]} hasEn={true} />
<main id="main">
  <section class="hero"> …hero__photo + canvas#stars + hero__in (eyebrow/h1/lead/tags)… </section>
  <div class="sec-head reveal"><span class="num">01</span><h2>…</h2><span class="rule"></span></div>
  <div class="fbwrap"><FeedbackForm lang="en" /></div>
</main>
<Attribution sources={[]} />
<script is:inline src={versioned('assets/detail.js', '/assets/detail.js')}></script>
</Layout>
```
For `/support.html`: `:root{}` uses the UI-SPEC's declared gold palette (`--accent:#e8a83c` etc., see UI-SPEC.md § "own page palette"), `crumbs` becomes `[{label:'Archive',href:'/archiv.html'},{label:'Support'}]`/`{label:'Unterstützen'}`, mount `<SupportForm lang="en|de" />` instead of `<FeedbackForm>`. Sections follow UI-SPEC § 1 (Hero → 01 Reason → 02 Amount picker → 03 Progress → 04 Wall → Attribution) — 4 `.sec-head` blocks instead of feedback's 1.

**Trap:** after writing the inline `:root{}` block, run `npm run theme` — do NOT hand-write the `:root[data-theme="light"]` twin. Handwritten light blocks are silently discarded on the next generator run.

---

### `src/components/SupportForm.astro`

**Analog:** `src/components/FeedbackForm.astro` (whole-file shape: `Props{lang}`, `COPY` object keyed `de`/`en` in frontmatter, `is:inline` script, dense scoped `<style>`)

**Imports + Props + COPY skeleton** (`FeedbackForm.astro:1-56`):
```astro
---
import { SUPPORT, SUPPORT_DEMO } from '../consts';
interface Props { lang: 'de' | 'en'; }
const { lang } = Astro.props;
const COPY = {
  de: { /* every string from UI-SPEC.md Copywriting Contract, DE column */ },
  en: { /* … EN column */ },
}[lang];
---
```
**Demo-mode banner pattern** (`FeedbackForm.astro:62-64`):
```astro
{SUPPORT_DEMO && (<p class="fbx-demo"><b>{COPY.demoTitle}</b> {COPY.demoBody}</p>)}
```
→ rename class to `.spt-demo` (matches UI-SPEC's `.spt-*` prefix) but copy the exact CSS shape from `.fbx-demo` (`FeedbackForm.astro:144-149`: `border-left:3px solid var(--accent-2)`, `background:color-mix(in srgb, var(--accent-2) 8%, transparent)`) — substitute `var(--accent-2)`→`var(--support-gold)`/`var(--accent)` per UI-SPEC's color table.

**Native-radio-under-styled-label technique** (star rating, `FeedbackForm.astro:92-100` + script `249-283`) is the DIRECT template for the amount-picker radiogroup (UI-SPEC § 3): visually-hidden `<input type="radio">` inside a `<label class="fbx-star">`, `role="radiogroup"` on the wrapper, plain `change` listener updates a live-region span (`#fbRateOut` → equivalent `#sptAmountOut`), `.on` class toggled via JS, not `:checked` CSS sibling selectors.

**Submit/loading/error/done flow** (`FeedbackForm.astro:114-133`, script `285-337`) — direct template for the CTA button state machine: `disabled` + text-swap on submit (`D.sending`), `role="alert" aria-live="assertive"` status paragraph (`.fbx-status`), demo branch returns `showDone()` immediately without a network call, real branch does `fetch().then().catch().finally()` restoring the button. For Stripe Checkout this becomes a `fetch()` to the `create-checkout` edge function returning a `url` to `window.location.assign()`, keeping the same disabled/error/finally shape.

**Done panel** (`FeedbackForm.astro:125-132`, styles `212-230`) — `.fbx-done` → template for `.spt-demo`'s post-click confirmation panel in demo mode (checkmark badge `.fbx-done__mark`, `<h2 tabindex="-1">` focused via `try{…focus()}catch(e){}`, "again" reset button).

**Trap:** `FEEDBACK_DEMO`'s truth check is `FEEDBACK.web3formsKey === 'REPLACE_WITH_…'` — a string-equality sentinel, not a boolean flag. `SUPPORT_DEMO` in `consts.ts` should follow the exact same sentinel-comparison shape (see `src/consts.ts` mapping below), not a separately-hand-toggled boolean that can drift from the actual key value.

---

### `supabase/migrations/<timestamp>_donations.sql`

**Analog A — table + RLS shape:** `supabase/migrations/20260726000000_crafting_entries.sql`
```sql
create table if not exists public.crafting_entries (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  slug       text        not null check (char_length(slug) between 1 and 120),
  …
);
alter table public.crafting_entries enable row level security;
drop policy if exists crafting_entries_select_own on public.crafting_entries;
create policy crafting_entries_select_own on public.crafting_entries
  for select using ((select auth.uid()) = user_id);
```
Donations table differs in one load-bearing way: donations are **anonymous by default** (D-05 — no session required to pay), so `user_id` must be **nullable** (only set when D-19's optional link happens), and there is **no client insert policy at all** — see Analog B. `(select auth.uid())` wrapping is the perf idiom used site-wide for RLS `using`/`with check` clauses; keep it if any policy references `auth.uid()`.

**Analog B — "only the server writes" guard:** `supabase/migrations/20260722200000_guard_rsi_verified.sql`
```sql
create or replace function public.guard_rsi_verified()
returns trigger language plpgsql security definer set search_path = public as $$
declare caller_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  if caller_role = 'service_role' then return new; end if;
  … raise exception 'nur serverseitig' using errcode = 'insufficient_privilege';
end;
$$;
```
This is the DIRECT template for DON-07 ("nur der Webhook schreibt Spendenzeilen"): rather than a column-level guard trigger, the simplest translation is **no INSERT/UPDATE policy for `anon`/`authenticated` at all** on the donations table (RLS default-denies without an explicit policy) — only a `select` policy for the public columns via the view (Analog C), and the two edge functions use the **service-role client**, which bypasses RLS entirely, exactly like `verify-rsi`'s `supabaseAdmin` write. Reserve the guard-trigger technique specifically if a column needs revocable-by-client-but-not-settable-by-client semantics (e.g. a `display_name`/consent pair a supporter edits later); most of DON-07 is covered by "no client write policy" alone.

**Analog C — public view exposing only safe columns:** `supabase/migrations/20260723000000_public_profile_views.sql`
```sql
create or replace view public.public_profiles
with (security_barrier = true) as
select handle, display_name, bio, …  -- NOT rsi_code, NOT email
from public.profiles
where handle is not null;
grant select on public.public_profiles to anon, authenticated;
```
Direct template for the supporter-wall public view: `select display_name_or_anonymous, created_at, linked_handle` — **never select the amount column or payment reference** (D-16, enforced at the view level per UI-SPEC § 5, not hidden in CSS). Also template for an **aggregate** (progress-bar sum): either a second view doing `select sum(amount_cents) as total_cents from donations where status='paid'` granted to `anon`, or a `security definer` function — the view approach matches this file's established idiom more closely.

**Trap:** `search_path` is pinned (`set search_path = ''` in `crafting_entries.sql`'s trigger fn, `set search_path = public` in the guard trigger) per Supabase linter rule 0011 — carry this into any new `plpgsql` function, and DO NOT add an import into `src/lib/seo.ts` when wiring `NOINDEX_PATHS` for the thank-you page (unrelated file, but the "zero imports, cycle avoidance" rule is a hazard the executor may forget while mid-edit on payment-adjacent files).

---

### `supabase/functions/create-checkout/index.ts` and `supabase/functions/stripe-webhook/index.ts`

**Analog:** `supabase/functions/verify-rsi/index.ts` — the ONLY existing edge function, and CONTEXT.md's canonical-refs flag this as **"the first research task"**: its auth model does NOT transfer as-is.

**What transfers directly** (`verify-rsi/index.ts:24-35`):
```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try { … } catch (err: any) { return new Response(JSON.stringify({ error: err.message }), { status: 500 }); }
});
```
CORS block, OPTIONS branch, top-level try/catch-to-500, `Deno.env.get('SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY')`, and the service-role write pattern (`verify-rsi/index.ts:80-92`, `supabaseAdmin.from(...).upsert(...)`) are all directly reusable for the webhook's insert of a paid donation row.

**What does NOT transfer — the trap CONTEXT.md flags:** `verify-rsi` resolves the user from `req.headers.get('Authorization')` and calls `userClient.auth.getUser()` (`verify-rsi/index.ts:69-77`), relying on the Supabase gateway's default requirement of a valid session JWT. Both new functions must accept **anonymous callers with no session** (Stripe redirects/webhooks carry no Supabase JWT, and D-19's optional profile-link is the only case with one). This means:
- `create-checkout` and `stripe-webhook` need `verify_jwt = false` set for their function in `supabase/config.toml` (new file — no analog; standard Supabase CLI project config, the executor should generate it via `supabase init`/`supabase functions new` rather than hand-writing from scratch) — otherwise the platform gateway itself 401s every anonymous call before the function code runs.
- `create-checkout` reads the OPTIONAL session (same `Authorization` header pattern as `verify-rsi`, but treats absence as normal, not an error) only to support D-19's link-if-logged-in case; the payment itself must succeed with no header at all.
- `stripe-webhook` authenticates the CALLER via **Stripe's webhook signature** (`Stripe-Signature` header + the webhook signing secret from Supabase function secrets, per D-06), not via Supabase auth at all — this is a wholly different trust mechanism than anything in `verify-rsi` and has no in-repo analog; implement per Stripe's own Deno-compatible SDK docs, verifying signature before touching the DB.
- The `sb_publishable_…` key noted in `src/consts.ts § SUPABASE` is Supabase's NEW publishable-key format and is explicitly **not a JWT** (per CONTEXT.md) — do not assume `supabase-js` client calls from the (supabase-js-free) support page authenticate the same way `account/`-area calls do.

---

### `src/consts.ts` (new block)

**Analog:** same file, `FEEDBACK` / `FEEDBACK_DEMO` (`src/consts.ts:22-41`) and `SUPABASE` (`:49-54`) — both the header-comment style and the demo-sentinel idiom:
```ts
export const FEEDBACK = {
  web3formsKey: 'ccda7527-…',
  endpoint: 'https://api.web3forms.com/submit',
  subject: 'Neues Feedback · VerseBase',
} as const;
export const FEEDBACK_DEMO = FEEDBACK.web3formsKey === 'REPLACE_WITH_YOUR_WEB3FORMS_ACCESS_KEY';
```
New block should read:
```ts
export const SUPPORT = {
  stripePublishableKey: 'REPLACE_WITH_YOUR_STRIPE_PUBLISHABLE_KEY', // pk_test_… / pk_live_…, public by design
  kofiName: '', // leer = Ko-fi-Zeile bleibt ausgeblendet (D-05)
  goalCents: 12000, // 120 € (D-13)
} as const;
export const SUPPORT_DEMO = SUPPORT.stripePublishableKey === 'REPLACE_WITH_YOUR_STRIPE_PUBLISHABLE_KEY';
export const KOFI_ENABLED = SUPPORT.kofiName !== '';
```
Comment header should carry the same "SETUP:" instructional block style as `FEEDBACK`'s comment (`:22-32`) — this doubles as the "Einrichtungsanleitung" D-05 requires, at least for the constant itself (the fuller guide is a separate doc, per Claude's Discretion in CONTEXT.md).

**Trap:** the real secret (Stripe secret key, webhook signing secret) must NEVER appear here — only the publishable key, matching `SUPABASE.publishableKey`'s "public by design" comment (`:45-48`). D-06 is explicit and CONVENTIONS.md's "Never fabricate data" adjacent rule about honest demo states depends on this sentinel-string being the single source of truth for `SUPPORT_DEMO`.

---

### `src/components/Attribution.astro` (footer line, D-07)

**Analog:** itself — insertion point in `.attr-nav` (`Attribution.astro:22-32`):
```astro
<nav class="attr-nav" aria-label={t('footer.pageNav')}>
  <a href={L('/index.html')}>{t('nav.home')}</a>
  <span aria-hidden="true">·</span>
  …
  <a href={L('/feedback.html')}>{t('footer.feedback')}</a>
</nav>
```
Add `<span aria-hidden="true">·</span><a class="attr-support" href={L('/support.html')}>{t('footer.support')}</a>` after the Feedback link. New i18n key `footer.support`.

**Color override** (D-09 — the ONE deliberate palette break in this component): add a scoped rule after the existing `.site-attr .attr-nav a:hover` block (`Attribution.astro:59-62`):
```css
.site-attr .attr-nav a.attr-support:hover,
.site-attr .attr-nav a.attr-support:active { color: var(--support-gold); }
```
Icon, if UI-SPEC calls for one inline in the footer row, is optional — the existing `.attr-nav` links are plain text, no icons; adding one here would be a new pattern the UI-SPEC doesn't require (footer entry is text-only per D-07/D-21 wording).

**Trap:** the existing `@media (max-width: 820px)` 44px tap-target rule (`:68-82`) targets `.attr-nav a`/`.attr-nav span` generically — the new link inherits it automatically. Do NOT add a parallel mobile rule.

---

### `src/components/SiteNav.astro` (menu entry, D-07)

**Analog:** itself — `deckGroups` array, group `id: 'account'`, Feedback item (`SiteNav.astro:238-245`):
```ts
{
  href: L('/feedback.html'),
  label: t('nav.feedback'),
  media: THUMB('t-def-1'),
  sub: t('nav.deck.sub.feedback'),
  current: current === L('/feedback.html'),
  icon: '<path d="M21 11.5a8.38…"/>',
},
```
Append a Support item with the exact same 6-key shape (`href`, `label`, `media`, `sub`, `current`, `icon`) right after it, closing the `account` group's `items` array (`:246`).

**Color override modifier class** (per UI-SPEC § 6): add a `.snav-deck__row--support` scoped-style modifier targeting only this row's icon/current/hover accent to `var(--support-gold)`, applied via a conditional class on this one item's row markup — locate the existing per-row class application in the `deckGroups.map` render block (`SiteNav.astro:370`+) to find the exact attachment point; do not change the group-wide `.snav-deck__row` rule (the other 3 rows in "Konto & Service" must keep the page's own `--accent`).

**Trap:** `SiteNav.astro` is ~37 KB and deliberately NOT used by mass-generated pages (`DataShell.astro` exists specifically to avoid bundling it there) — confirms D-08's DataShell exclusion is structural, not just a style choice; do not add the strip logic inside `SiteNav.astro` itself.

---

### `src/i18n/ui.ts` (new chrome strings)

**Analog:** itself — existing `nav.feedback` / `nav.deck.sub.feedback` rows exist in BOTH the `de` block (`:71`, `:92`) and the `en` block (`:447`, `:469`) at matching line offsets (~377 lines apart, the file's fixed DE/EN block separation).

New keys needed (from UI-SPEC's Copywriting Contract, chrome-only rows — page-body prose stays in `SupportForm.astro`'s own `COPY` object per CONVENTIONS.md "bespoke page prose lives in the page/component, not the catalog"):
```ts
'nav.support': 'Unterstützen',           // en: 'Support'
'nav.deck.sub.support': 'VerseBase am Laufen halten', // en: 'Keep VerseBase running'
'footer.support': 'Unterstützen',        // en: 'Support'
```
Add each key to BOTH the `de` and `en` blocks at the position matching `nav.feedback`'s relative placement, to keep the file's parallel-block structure intact (a key present in only one block triggers the `t()` EN-fallback warning path, per CONVENTIONS.md § Error Handling).

---

### `src/lib/seo.ts` (`NOINDEX_PATHS`)

**Analog:** itself — the `Set` literal (`seo.ts:41-47`):
```ts
export const NOINDEX_PATHS: ReadonlySet<string> = new Set([
  '/account.html',
  '/account/reset.html',
  '/account/update-password.html',
  '/refinery.html',
  '/pilot.html',
]);
```
Add the thank-you page's EN base-form path (e.g. `'/support-thanks.html'`) — `/support.html` itself must NOT be added (CONTEXT.md is explicit it stays indexable). The comment block above the set (`:29-40`) explains WHY each entry is excluded — extend it with a one-line rationale for the thank-you page (Stripe-redirect landing page, no standalone value for search).

**Trap — reiterated because it is easy to violate under time pressure:** this module is "BEWUSST OHNE IMPORTS" (`:14`) to avoid a cycle with `sitemap.xml.ts`. Adding a single string to the `Set` is safe; importing anything (e.g. a shared constant from `consts.ts`) is not.

---

### Tool-page strip insertion (8 files, see finding above)

**Analog:** the pre-`<Attribution>` insertion point, identical shape in all 5 tool "pages" (3 page-pairs + 2 shared bodies):
```astro
    …last content block…
</main>

<Attribution sources={[…]} />

<script is:inline src={versioned('assets/detail.js', '/assets/detail.js')}></script>
</Layout>
```
Insert `<SupportStrip lang="en" />` (or `lang="de"`) as a new line immediately before `<Attribution …>`, inside `<main>` if `Attribution` is a sibling of `main` (verify per-file — in `item-finder.astro`/`refinery.astro`/`precision-jump.astro`/the two `topics/*.astro` bodies, `Attribution` renders as a sibling AFTER `</main>` closes, so `<SupportStrip>` goes as the last child inside `<main>`, right before its closing tag, matching where each file's own last content block sits).

Exact files + insertion anchors:
| File | Anchor (last line before edit) |
|---|---|
| `src/pages/item-finder.astro` | `<ItemFinderApp lang="en" />` then `</main>` |
| `src/pages/de/item-finder.astro` | `<ItemFinderApp lang="de" />` then `</main>` |
| `src/components/topics/crafting.astro` (EN+DE shared) | `<CraftingApp lang={de?'de':'en'} />` then `</main>` |
| `src/components/topics/mining.astro` (EN+DE shared) | `.sh-grid` ship cards block then `</main>`, note `<RelatedTopics>` + `<Attribution>` come right after — insert strip before `<RelatedTopics>` or after it per UI-SPEC's visual call, but strictly before `<Attribution>` |
| `src/pages/refinery.astro` | `</AccountShell>` then `</main>` |
| `src/pages/de/refinery.astro` | same |
| `src/pages/precision-jump.astro` | `</aside>` (`.alm__foot`) then `</main>` |
| `src/pages/de/precision-jump.astro` | same |

**Trap:** `src/pages/crafting/index.astro` (the blueprint directory, built on `CraftingHub.astro` → `DataShell.astro`) looks like a plausible "Crafting tool page" by name but is explicitly the wrong file — it's a mass-page shell excluded by D-08. The correct Crafting file is `src/components/topics/crafting.astro`, reached at `/topics/crafting.html`.

---

### `src/pages/datenschutz.astro` + `src/pages/de/datenschutz.astro` (D-22)

**Analog:** itself — `#feedback` Web3Forms section (`datenschutz.astro:109-134`):
```astro
<h2 id="feedback">Feedback form (Web3Forms)</h2>
<p>… static site, no backend of its own, delivery handled by the service <strong>Web3Forms</strong> …</p>
<ul><li><strong>message text</strong> (required)</li>…</ul>
<p>The legal basis is your consent … (Art. 6 (1) (a) GDPR). …</p>
<p class="muted">The form service is provided by Web3Forms. … see its privacy policy: <a href="https://web3forms.com/privacy" rel="noopener">web3forms.com/privacy</a>. …</p>
```
Direct template for a new `<h2 id="support">Support (Stripe & Ko-fi)</h2>` section: what's collected (amount, optional email via Stripe, optional display name/consent, optional message), legal basis, processor names + links to their privacy policies (Stripe: stripe.com/privacy, Ko-fi: ko-fi.com/privacy), EU-data-residency caveat if applicable (Stripe processes outside EU — flag honestly like the Web3Forms note does). Placed as a new section following the existing document order (after `#feedback`, before or after `#accounts` per the planner's judgement — both existing sections are voluntary/optional features, same category).

---

### Moderation UI (D-18)

**Analog:** the existing admin-role cache mechanism in `src/layouts/Layout.astro:119-129` (role read from `sessionStorage.getItem('vb_user_role')`, parsed, checked `pr.role==='admin'`) — this is the SOLE existing role-gating mechanism site-wide, populated by `account-lite.js`. Reuse it for gating the moderation surface's visibility; do not invent a second admin check.

**No existing sidebar-tile analog exists** in `src/scripts/account-dashboard.ts` for an admin-only tab (`role` fields found there are the citizen/pilot role picker, unrelated to the `admin`/`user` site role) — this is genuinely new UI within the account shell. Closest structural analog for "a new tile in the mobiGlas sidebar app-shell" is the existing tab/tablist wiring in `account-dashboard.ts:87` (`document.querySelector('[role="tablist"]')`) — follow that tab-registration pattern to add a new admin-only tab, gated by checking `is-admin` on `document.documentElement` (matches Layout's own class-toggle) before rendering the tab button at all.

**Data access:** service-role-equivalent read must go through an RLS policy scoped to `auth.uid()` matching a known admin row (or a `security definer` function checking `profiles.role='admin'`) — NOT the public wall view, which (per Analog C above) only exposes approved/selected columns. This is a new RLS policy with no direct precedent in the three cited migrations; closest shape is `crafting_entries_select_own`'s `using ((select auth.uid()) = user_id)` pattern, generalized to `using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))`.

## Shared Patterns

### Bilingual thin-wrapper + shared component
**Source:** `src/pages/feedback.astro` / `de/feedback.astro` + `src/components/FeedbackForm.astro`
**Apply to:** `support.astro`/`de/support.astro` + `SupportForm.astro`; also the thank-you page pair.
Copy = COPY object keyed by `lang: 'de'|'en'` lives in the shared component's frontmatter, never duplicated per page. This is the direct mitigation for CONCERNS.md Class A drift.

### Demo-mode sentinel
**Source:** `src/consts.ts` § `FEEDBACK_DEMO`
**Apply to:** `SUPPORT_DEMO` (Stripe key placeholder) and a second independent `KOFI_ENABLED` flag (Ko-fi name placeholder) — two SEPARATE sentinels per D-05, not one shared flag.

### Service-role-only write / RLS default-deny
**Source:** `supabase/functions/verify-rsi/index.ts` (service client) + `supabase/migrations/20260722200000_guard_rsi_verified.sql` (guard-trigger technique, used selectively)
**Apply to:** both edge functions' DB writes; the donations table's near-total absence of client write policies.

### Public view exposing only safe columns
**Source:** `supabase/migrations/20260723000000_public_profile_views.sql`
**Apply to:** supporter-wall view (no amount/payment-ref columns) and the goal-progress aggregate.

### Cache-busted hand-linked assets
**Source:** `src/lib/assetVersion.ts` § `versioned()`, used throughout `feedback.astro`/tool pages for `detail.css`/`detail.js`
**Apply to:** any new hand-linked `/assets/*` file this phase introduces (e.g. if `SupportStrip.astro`'s styling grows into its own `assets/support.css`, though inline `<style>` is preferred per the component-shape analog).

### Per-page dark palette + generated light twin
**Source:** every page's inline `<style is:inline>` opening `:root{}` block (see `feedback.astro:22-24`)
**Apply to:** `/support.html`'s own `:root{}` (run `npm run theme` after) — separate and unrelated to the hand-written `--support-gold` token block in `assets/theme.css`, which the generator does NOT see.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `supabase/config.toml` | config | — | No Supabase CLI project config exists yet in this repo; generate via `supabase init`/`supabase functions new`, don't hand-write from a template that doesn't exist here. |
| `supabase/functions/stripe-webhook/index.ts` (signature verification specifically) | service | event-driven | No webhook-signature-verifying function exists in the repo; `verify-rsi` is a synchronous client-invoked function, not a third-party push webhook. Follow Stripe's own Deno SDK docs for signature verification, keep everything else (CORS/error/service-role-write shape) from `verify-rsi`. |
| `src/components/SupportStrip.astro` | component | static-content | New shape — a single-row accent-bordered CTA band has no prior sibling on the site; build per UI-SPEC § 6 directly, informed by `Attribution.astro`'s link-row styling and the `--support-gold` reserved-for list, but there's no existing "band" component to copy structurally. |
| moderation admin-tab registration in `account-dashboard.ts` | script | CRUD (admin) | No admin-only tab exists yet in the account shell; nearest precedent is the generic tablist wiring, not an admin-gated variant of it. |

## Metadata

**Analog search scope:** `src/pages/`, `src/components/`, `src/i18n/`, `src/lib/`, `supabase/migrations/`, `supabase/functions/`, `assets/mobile-ux.css`, `assets/theme.css`, `nginx/default.conf`, `src/scripts/account-dashboard.ts`, `src/layouts/Layout.astro`
**Files scanned:** ~24 (all files this phase touches) + their designated analogs
**Pattern extraction date:** 2026-07-31
