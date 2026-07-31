# Phase 5: Spenden-Unterstützung ("Support") — Research

**Researched:** 2026-07-31
**Domain:** Static Astro site + Supabase Edge Functions + Stripe Checkout (hosted) + Ko-fi link
**Confidence:** MEDIUM — the trust-boundary question (the phase's hardest problem) is now answered with HIGH confidence from official Supabase docs; the Stripe webhook/metadata design is a reasoned synthesis of several official-doc facts (MEDIUM) and should get a human-verify pass once test keys exist (D-05 already defers full end-to-end proof to the user).

## Summary

The phase's central risk — "how can an anonymous visitor and a signature-only webhook call a Supabase Edge Function when the project's other three functions all require a session JWT?" — has a concrete, low-risk answer: **`verify_jwt` is a per-function `config.toml` setting**, the repo currently has **no `supabase/config.toml`** at all (confirmed: `ls supabase/config.toml` → not found), and creating one with only the two new functions listed leaves `register`, `delete-account`, and `verify-rsi` on their default (`verify_jwt = true`) behaviour unchanged. `create-checkout-session` gets `verify_jwt = false` so anonymous callers can reach it; `stripe-webhook` also gets `verify_jwt = false` because Stripe never sends a Supabase JWT — it authenticates purely via the `Stripe-Signature` header, checked inside the function with `stripe.webhooks.constructEventAsync` against the raw request body.

A second, load-bearing fact: this project's publishable key (`sb_publishable_AN3O0va6kEsCmHr6zDcwRQ_8sT68W3J`) is a **new-format key, not a JWT**. Supabase's own docs state plainly that new-format keys "are not JWTs" and are rejected if sent as a Bearer token — they only work in the `apikey` header. This does not block the plan: the browser call to `create-checkout-session` needs the `apikey` header (present) but does **not** need an `Authorization` header when `verify_jwt = false`, because the gateway only demands `Authorization` when the JWT check is switched on. `verify-rsi`'s behaviour is unaffected by introducing `config.toml`, because Supabase's documented default for any function *not* listed is unchanged (`verify_jwt = true`).

Payment-side, Stripe Checkout (hosted redirect, no Stripe.js) is the right fit for D-01: the Edge Function creates the session server-side with `mode: 'payment'` or `mode: 'subscription'` and `line_items[].price_data` (dynamic amount, no pre-created Stripe Price needed), returns `session.url`, and the browser does a plain top-level navigation there — which means, contrary to the initial assumption in the research brief, **the hosted-redirect flow needs no CSP change at all** (no `frame-src`, no `script-src`, no `form-action` entry — a `location.href` redirect is not governed by CSP). The webhook is the only place secrets and truth live: it verifies the signature, and only it writes to `public.donations`, following the exact "trigger blocks client writes" pattern already in this repo (`guard_rsi_verified.sql`) and the exact "narrow public view" pattern already in this repo (`public_profile_views.sql`).

**Primary recommendation:** create `supabase/config.toml` with `[functions.create-checkout-session] verify_jwt = false` and `[functions.stripe-webhook] verify_jwt = false` only (leave the three existing functions unlisted); build both new functions in the `Deno.serve` + `npm:stripe@^22` style (not the legacy `esm.sh` + `deno.land/std@0.168.0` style `verify-rsi` uses — that style is stale, see State of the Art); dedupe webhook writes on `stripe_event_id` (unique constraint, `on conflict do nothing`); never call `subscription_data.metadata` for renewal data — carry display name/consent purely via top-level Checkout Session `metadata`, and for renewal invoices look the display info back up from the `recurring_initial` row already in `public.donations` via `stripe_subscription_id`, because Stripe metadata does **not** auto-propagate from a Subscription to its Invoices.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Amount/frequency selection UI, consent checkbox, display-name field | Browser / Client | — | Static Astro page, no SSR exists on this project (nginx serves prebuilt HTML) |
| Checkout session creation (amount validated, Stripe secret key used) | API / Backend (Supabase Edge Function) | — | The only place the Stripe secret key may exist; DON-05/DON-06 |
| Payment collection UI | External (Stripe-hosted `checkout.stripe.com`) | — | D-01: hosted Checkout, not self-built card fields — Stripe owns PCI scope entirely |
| Payment confirmation / truth of what was paid | API / Backend (Supabase Edge Function, webhook) | Database | Only a signed Stripe event may write a donation row (DON-07) |
| Donation rows, moderation state | Database / Storage (Supabase Postgres) | — | RLS + trigger enforce "only service role writes" |
| Public progress aggregate + supporter wall | Database / Storage (public views) | Browser (client-side fetch, no supabase-js) | Mirrors `account-lite.js`/`public_profile_views.sql` pattern — thin client, RLS-protected views |
| Moderation UI (approve/reject) | Browser / Client (admin session) + Database (RLS scoped to admin) | — | UI-SPEC §7 mandates reuse of the existing `.is-admin` / `user_roles` gate, not a second mechanism |
| CDN / Static | Cloudflare (proxy only) | — | DNS/TLS/proxy only; no edge compute used here (confirmed: no Cloudflare Pages project exists) |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `stripe` (npm, imported as `npm:stripe@^22` inside the Deno Edge Function) | `22.4.0` confirmed on npm registry, published 2026-07-29 `[VERIFIED: npm registry — npm view stripe version]` | Official Stripe SDK: Checkout Session creation, webhook signature verification | Official first-party SDK; Supabase's own Stripe-webhook example (`supabase/supabase` repo, `examples/edge-functions/…/stripe-webhooks/index.ts`) imports it the same way `[CITED: github.com/supabase/supabase — examples/edge-functions/supabase/functions/stripe-webhooks/index.ts]` |
| Deno built-in `Deno.serve` | Deno runtime built-in (no version to pin) | HTTP entrypoint for both new Edge Functions | Current Supabase guidance: the `deno.land/std@0.168.0` `serve()` import that `verify-rsi/index.ts` uses is the OLD pattern; `Deno.serve()` is now the documented entrypoint `[CITED: multiple Supabase community/blog sources cross-referencing docs — see State of the Art]` |
| `@supabase/supabase-js@2` (via `esm.sh`, service-role client only, inside the two new Edge Functions) | `2.x` — same major version already pinned in `verify-rsi/index.ts` | Writing donation rows with the service role key | Matches the exact import already used in this repo (`https://esm.sh/@supabase/supabase-js@2`) — `[VERIFIED: codebase — supabase/functions/verify-rsi/index.ts:25]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Stripe CLI (`stripe`) | latest (not installed in this dev environment — confirmed via `command -v stripe`) | Local/CI testing of the webhook via `stripe listen --forward-to` and `stripe trigger` | Operator's setup step, not a repo dependency — see Environment Availability |
| Supabase CLI (`supabase`) | latest (not installed in this dev environment — confirmed via `command -v supabase`) | Deploying the two new Edge Functions, applying the new migration, and — critically — the mechanism that actually reads/writes `config.toml`'s `verify_jwt` setting on deploy | Required once, either on a dev machine or added to a CI step (there is currently **no** GitHub Actions workflow that deploys Edge Functions — `verify-rsi` was deployed out-of-band) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Stripe's dynamic `price_data` per session (chosen) | Pre-created fixed Stripe Prices (3€/5€/10€/25€ × one-time/monthly = 8 Price objects) + a "custom amount" Price for the free-input field | Fixed Prices are slightly more idiomatic Stripe and show cleaner line-item names in the Dashboard, but require maintaining 8+ Price IDs in `src/consts.ts` and re-creating them if amounts change (D-13 wants the goal, not necessarily the presets, to stay in `consts.ts` — either preset amounts or full `price_data` flexibility works; `price_data` is simpler because D-03's free-input field needs *arbitrary* amounts anyway, so presets would need `price_data` regardless) |
| `Deno.serve` + `npm:stripe` (recommended) | `esm.sh` Stripe import (`https://esm.sh/stripe@…?target=deno`), matching `verify-rsi`'s `esm.sh`/`deno.land/std` style exactly | Matching house style has value (CONVENTIONS.md "style is by imitation"), but Supabase's own current official example (the authoritative source for "how do I do Stripe on Supabase Edge Functions today") uses `npm:stripe` + `Deno.serve` — following the stale style would mean deliberately choosing an outdated pattern for brand-new code; recommend `npm:stripe` + `Deno.serve`, and flag `verify-rsi`'s `esm.sh`/`deno.land/std` style as due for a future refresh (not in scope here) |
| DB-lookup for renewal display info (recommended) | Extra Stripe API call per renewal (`stripe.subscriptions.retrieve(invoice.subscription)`) to read `subscription_data.metadata` | The API-call approach works too, but costs a network round-trip per renewal webhook and a second Stripe secret-key use path to reason about; the DB lookup (join on `stripe_subscription_id` against the already-inserted `recurring_initial` row) is cheaper, has no extra failure mode, and keeps "the donations table is the single source of truth" — recommended |

**Installation:** No `npm install` — Deno Edge Functions resolve `npm:` and `esm.sh` imports at deploy/run time, nothing goes into the site's own `package.json`. `src/consts.ts` gets a new `STRIPE` / `SUPPORT_DEMO` block (no package).

**Version verification:** `npm view stripe version` → `22.4.0`, `npm view stripe time.modified` → `2026-07-29T23:38:17.675Z` `[VERIFIED: npm registry]`. Supabase's own webhook example imports `npm:stripe@^22`, matching the current major.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `stripe` | npm | latest *version* published 2 days before this research (2026-07-29); the package itself is one of the oldest, most widely-used SDKs on npm | 15,458,204/week | `github.com/stripe/stripe-node` (official Stripe org) | `SUS` (gate reason: `too-new`) | **Approved, false positive noted.** The gate's "too-new" signal fires on the most recent *patch release date*, not package age — Stripe ships patch releases very frequently. 15.4M weekly downloads + the official `stripe/stripe-node` GitHub org make this an unambiguous false positive. Per protocol, still flag: **planner must add a `checkpoint:human-verify` before the operator runs `supabase functions deploy` with this dependency**, even though the substance of this audit is "approve." |

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** `stripe` (false positive — see disposition above; recommend the human-verify checkpoint be a fast rubber-stamp, not a blocker).

*No other new packages are introduced by this phase — `@supabase/supabase-js` is already vetted and in use in this repo.*

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DON-01 | Besucher wählt Betrag + Häufigkeit, landet auf Stripe-gehosteter Checkout-Seite | § Stripe Checkout (create-checkout-session design), § Code Examples |
| DON-02 | Spenden funktioniert ohne Konto | § The Trust Boundary — `verify_jwt = false` + `apikey`-only auth for `create-checkout-session` |
| DON-03 | Ko-fi als zweiter, sichtbar nachgeordneter Weg | Out of deep research scope — plain `<a href>` link, no API integration in this phase (Ko-fi webhook explicitly deferred); § Site Integration notes it needs NO CSP entry |
| DON-04 | Dankesseite bestätigt Erfolg; Abbruch führt ohne Fehler zurück | § Common Pitfalls — "webhook lag vs. success redirect"; `success_url`/`cancel_url`/`{CHECKOUT_SESSION_ID}` |
| DON-05 | Checkout-Sitzung entsteht serverseitig, Secret Key nie ausgeliefert | § The Trust Boundary, § Supabase Data Layer (secrets live only in function secrets) |
| DON-06 | Betrag serverseitig gegen Ober-/Untergrenze geprüft | § Code Examples — `create-checkout-session` amount validation |
| DON-07 | Spendenzeilen nur vom Webhook, kein Client-Schreibrecht, keine Dubletten | § Supabase Data Layer — trigger pattern (`guard_rsi_verified.sql` analogue) + `stripe_event_id` unique constraint |
| DON-08 | Öffentlich lesbar nur ausgewählte Felder, nie E-Mail/Zahlungs-ID/Kunden-ID | § Supabase Data Layer — public view pattern (`public_profile_views.sql` analogue); **see flagged tension with D-16 below** |
| DON-09 | Ohne Schlüssel: sichtbarer Demo-Modus, keine behaupteten Zahlen | § Honesty Constraint / Demo Mode |
| DON-10 | Eigene Seite DE/EN, Ziel + Wand aus echten Zahlungsdaten | UI-SPEC (already approved) covers the frontend contract; this document covers the data it reads |
| DON-11 | Site-weiter Zugang ohne Kopfleisten-Überladung | UI-SPEC §6 covers this; § Site Integration notes CSP impact (none) |
| DON-12 | Nennung nur nach Zustimmung, Vorgabe anonym, Anzeigename entschärft | § Supabase Data Layer — sanitization + consent flag; § Common Pitfalls — XSS via wall rendering |
| DON-13 | CSP kennt Stripe vor Go-Live, `audit:csp` bleibt grün | § Site Integration — CSP finding (redirect flow needs no new entries) |
| DON-14 | Datenschutzerklärung nennt Stripe/Ko-fi als Empfänger | § Setup Guide references the existing `datenschutz.astro` §Web3Forms as the pattern to copy |
</phase_requirements>

## The Trust Boundary — Answering the Single Most Important Question

### How `verify_jwt` is disabled per function, and which mechanism persists

Supabase Edge Functions support **two** ways to turn off the platform's JWT gate:

1. **`supabase/config.toml`, per function** (the persistent, deploy-time mechanism):
   ```toml
   [functions.create-checkout-session]
   verify_jwt = false

   [functions.stripe-webhook]
   verify_jwt = false
   ```
   `[CITED: supabase.com/docs/guides/local-development/cli/config]` — the reference confirms `verify_jwt` is a documented key under `[functions.<name>]`, alongside `enabled`, `import_map`, `entrypoint`, `static_files`. **This setting persists across every future `supabase functions deploy`** because it lives in a committed file, not a one-time flag.

2. **`supabase functions deploy <name> --no-verify-jwt`** (the CLI-flag / local-dev mechanism): this is a **transient** flag. It affects the deploy invocation (or `supabase functions serve` locally) but is not recorded anywhere durable — the next plain `supabase functions deploy <name>` (e.g. from a future CI run or a teammate's machine) silently reverts to the JWT-required default. `[CITED: supabase.com/docs/guides/functions/function-configuration]` explicitly frames `config.toml` as the持续 setting; a GitHub issue (`supabase/cli#4059`, "Edge function JWT verification settings ignored during function updates") documents real breakage from relying on the flag instead of the file `[CITED: github.com/supabase/cli/issues/4059]`.

   **Conclusion: use `config.toml`, not `--no-verify-jwt`.** This project has no CI step that deploys functions yet (confirmed: no `supabase` references in `.github/workflows/`), so relying on a developer remembering a CLI flag on every future manual deploy is exactly the kind of drift this repo's own conventions warn against (`CONVENTIONS.md` § Single-source-of-truth rule).

### The repo has no `config.toml` today — what a minimal one needs

Confirmed: `ls supabase/config.toml` → *No such file or directory*. Today, both new functions would default to `verify_jwt = true` if deployed as-is, which breaks DON-02 outright (anonymous checkout) and would make the Stripe webhook literally unreachable by Stripe (Stripe cannot supply an `Authorization: Bearer <jwt>` header).

A minimal `supabase/config.toml` that changes **nothing** for the three existing functions:

```toml
# supabase/config.toml
# Projekt-ID nur für lokale CLI-Nutzung (Docker-Container-Namensgebung),
# NICHT die Projekt-Referenz trgjhmbnodoarnfmlcqx — die kommt über
# `supabase link` bzw. `--project-ref` beim Deploy.
project_id = "verse-base"

# register, delete-account, verify-rsi sind hier bewusst NICHT aufgeführt —
# unangefuehrte Functions behalten den Supabase-Standard (verify_jwt = true).
[functions.create-checkout-session]
verify_jwt = false

[functions.stripe-webhook]
verify_jwt = false
```

`[CITED: supabase.com/docs/guides/local-development/cli/config]` confirms unlisted functions keep the documented default (`verify_jwt = true`), so `verify-rsi` is unaffected by this file's introduction. **One open item flagged LOW confidence:** whether `project_id` is strictly mandatory for `supabase functions deploy` to succeed when only using the CLI for deploys (not the local dev stack) is not explicitly stated in the fetched docs page — the safe move is to include it (cost is zero) rather than omit it and risk a deploy-time failure; this is worth a quick `supabase functions deploy --dry-run`-equivalent smoke check by the operator during setup (see § Environment Availability).

### What still protects `create-checkout-session` once `verify_jwt = false`

With the platform-level JWT check off, **the gateway still requires the `apikey` header** (accepting `sb_publishable_…` or `sb_secret_…`) — this is a separate check from `verify_jwt` and is not bypassed by turning JWT verification off `[CITED: supabase.com/docs/guides/functions/auth-headers]`. Beyond that, the function is genuinely public: **anyone with the project's publishable key (which is meant to be public, and is already printed in `src/consts.ts`) can call `create-checkout-session`.**

**Concrete abuse risk and mitigation, sized to this project's scale:**
- **Risk:** a script could hammer `create-checkout-session` to create many Stripe Checkout Sessions. Each call to Stripe's API costs nothing to *create* (no charge happens until a human actually pays on the hosted page), but it does consume Stripe API rate limits and could, in volume, look like abuse to Stripe's own fraud systems.
- **Mitigation appropriate at this scale (personal-project, low-traffic site):**
  1. **Server-side amount clamping (DON-06)** — reject anything outside 1–500 € before calling Stripe at all; this is the only mitigation that is *load-bearing* for correctness, not just abuse-resistance.
  2. **CORS restricted to the site's own origin** (`Access-Control-Allow-Origin: https://verse-base.com` instead of `verify-rsi`'s current `*`) — this doesn't stop a direct `curl`, but it does stop the most common abuse vector (a third-party page embedding a fetch to this endpoint) and costs nothing to add. Recommend narrowing this for the two new functions even though `verify-rsi` uses `*`.
  3. **Do not add a rate limiter for this phase** — Supabase Edge Functions have no built-in per-IP rate limit primitive, and hand-rolling one (e.g. a Postgres table counting requests) is exactly the kind of custom-security-code that is disproportionate for a project whose entire donation goal is €120. **Recommendation: accept the residual risk, monitor Stripe's Dashboard for anomalies manually.** This is a judgment call, not a locked decision — flagged for the planner and, if the operator disagrees at review time, revisit.
- **`stripe-webhook` has a stronger, sufficient protection model:** signature verification against `STRIPE_WEBHOOK_SIGNING_SECRET` (a secret only Stripe and this function know) is cryptographically equivalent to authentication — an attacker without that secret cannot forge a valid event, full stop. This is the standard, Stripe-recommended trust model for webhooks and needs no additional layer `[CITED: supabase.com/docs/guides/functions/auth]`.

### Anonymous browser call — exact headers

```js
// Muster wie account-lite.js: fetch statt supabase-js, Publishable Key im
// apikey-Header. KEIN Authorization-Header nötig — verify_jwt ist für diese
// Function aus, und ein sb_publishable_-Key ist ohnehin KEIN JWT (er würde
// im Authorization-Header abgelehnt, siehe Recherche oben).
fetch('https://trgjhmbnodoarnfmlcqx.supabase.co/functions/v1/create-checkout-session', {
  method: 'POST',
  headers: {
    'apikey': SUPABASE.publishableKey,       // erforderlich: Gateway prüft ihn immer
    'Content-Type': 'application/json',
    // Falls ein Nutzer angemeldet ist (D-19): Authorization mitschicken, damit
    // die Function die user_id aus dem JWT lesen kann (NIE aus dem Body,
    // gleiches Muster wie verify-rsi/index.ts).
    ...(session ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
  },
  body: JSON.stringify({ amount_cents, frequency, display_name, show_name, message }),
});
```

`sb_publishable_…` **does** work in the `apikey` header — that is its designed purpose (it is a drop-in replacement for the legacy anon key precisely for `apikey`-header use) `[CITED: supabase.com/docs/guides/getting-started/migrating-to-new-api-keys]`. It does **not** work in `Authorization` (rejected — "not a JWT") — this only matters for the optional signed-in path, where the real user session JWT goes in `Authorization`, never the publishable key.

### `verify-rsi` regression check

`verify-rsi` is not listed in the new `config.toml`, so per the documented default-preservation behaviour it keeps `verify_jwt = true` exactly as today. No code change to `verify-rsi/index.ts` is implied by this phase. **Confidence: HIGH** — this is the one part of the trust-boundary question backed by an explicit "unlisted functions keep the default" statement in the fetched official reference, not an inference.

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────┐
                         │   Browser (/support.html)   │
                         │  amount picker · consent ·  │
                         │  display name · message     │
                         └───────────┬─────────────────┘
                                     │ fetch, apikey header only
                                     │ (Authorization only if signed in)
                                     ▼
                    ┌────────────────────────────────────┐
                    │ Supabase Edge Function              │
                    │ create-checkout-session             │
                    │ verify_jwt = false                  │
                    │  1. validate amount (1–500 EUR)     │
                    │  2. read Stripe secret from env      │
                    │  3. stripe.checkout.sessions.create  │
                    │     (price_data, metadata, success/  │
                    │      cancel URL)                     │
                    │  4. return { url }                   │
                    └───────────┬──────────────────────────┘
                                │ 302-equivalent: browser does
                                │ window.location.href = url
                                ▼
                    ┌────────────────────────────────┐
                    │  checkout.stripe.com (hosted)   │  ← Stripe owns PCI scope
                    │  card entry, 3DS if needed      │     entirely; no CSP entry
                    └───────────┬──────────────────────┘     needed for this hop
                                │ on success: redirect to
                                │ success_url?session_id=…
                                │ on cancel:  redirect to cancel_url
                                ▼
                    ┌────────────────────────────────┐
                    │ /support/thank-you.html          │  reads NOTHING from
                    │ (or /support.html?done=1)        │  Stripe directly —
                    │ generic "thanks" — does NOT wait │  webhook is the only
                    │ on the DB row to render success  │  writer of truth
                    └──────────────────────────────────┘

   (independent, async path — Stripe → our webhook, NOT through the browser)
                    ┌────────────────────────────────────┐
   Stripe servers ─▶│ Supabase Edge Function              │
   Stripe-Signature │ stripe-webhook                      │
   header only,     │ verify_jwt = false                  │
   no Supabase      │  1. req.text() — RAW body, before   │
   credentials       │     any JSON.parse                  │
                     │  2. stripe.webhooks.constructEventAsync(
                     │     body, sig, WEBHOOK_SECRET, undefined, cryptoProvider)
                     │  3. on signature failure → 400, done │
                     │  4. dedupe on stripe_event_id (unique)│
                     │  5. service-role insert into          │
                     │     public.donations                  │
                     └───────────┬────────────────────────────┘
                                 ▼
                    ┌────────────────────────────────┐
                    │ Postgres: public.donations       │  RLS: no client
                    │ (trigger blocks non-service-role │  INSERT/UPDATE at all;
                    │  writes — guard_rsi_verified      │  admin SELECT/UPDATE
                    │  pattern)                         │  scoped via user_roles
                    └───────────┬────────────────────────┘
                                ▼
              ┌─────────────────────────────────────┐
              │ public.donation_wall (view)           │  anon/authenticated SELECT
              │ public.donation_progress (view, 1 row │  only — never the base
              │ aggregate SUM)                        │  table, never amount per row
              └───────────────┬────────────────────────┘
                               ▼
                    Browser (/support.html), plain fetch
                    (no supabase-js bundle — same pattern
                    as account-lite.js), renders wall + bar
```

### Recommended Project Structure

```
supabase/
├── config.toml                                  # NEW — see § Trust Boundary
├── functions/
│   ├── verify-rsi/               (existing, untouched)
│   ├── create-checkout-session/
│   │   └── index.ts                             # NEW
│   └── stripe-webhook/
│       └── index.ts                             # NEW
└── migrations/
    └── 20260731000000_donations.sql             # NEW — table, trigger, views, RLS

src/
├── consts.ts                                    # + STRIPE, KOFI, SUPPORT_DEMO, SUPPORT_GOAL_CENTS
├── components/
│   ├── SupportForm.astro                        # amount picker + consent + wall + bar (per UI-SPEC)
│   └── SupportStrip.astro                        # tool-page strip (per UI-SPEC)
├── pages/
│   ├── support.astro / de/support.astro          # per UI-SPEC
│   └── account/support-moderation.astro (+ de)   # per UI-SPEC §7
assets/
└── support-app.js                                # client fetch of donation_wall/donation_progress views + Checkout call — ES5 IIFE, no bundler, per house style
```

### Pattern 1: Server-side amount validation before ever calling Stripe

**What:** the Edge Function is the ONLY place that turns a client-supplied number into an actual charge amount; it clamps/rejects before constructing `price_data`.
**When to use:** always, per DON-06 — a manipulated client must not be able to force an arbitrary amount.
**Example:**
```typescript
// supabase/functions/create-checkout-session/index.ts (Ausschnitt)
// Betragsgrenzen serverseitig — der Client-Wert ist nur eine Vorschlag,
// niemals die Wahrheit. 1–500 € deckt sich mit dem Client-Hinweis
// "Bitte einen Betrag zwischen 1 € und 500 € eingeben" (UI-SPEC).
const MIN_CENTS = 100;    // 1,00 €
const MAX_CENTS = 50000;  // 500,00 €

const amountCents = Math.round(Number(body.amount_cents));
if (!Number.isInteger(amountCents) || amountCents < MIN_CENTS || amountCents > MAX_CENTS) {
  return new Response(JSON.stringify({ error: 'invalid_amount' }), { status: 400, headers: corsHeaders });
}
```
Stripe's own floor for a EUR Checkout line item is €0,50 `[CITED: docs.stripe.com/api/checkout/sessions/create — general Stripe minimum-charge-amount guidance]`, so the project's 1 € floor already has headroom above Stripe's hard minimum.

### Pattern 2: Checkout Session creation — one-time vs. subscription, both with `price_data`

**What:** dynamic per-session pricing without pre-created Stripe Price objects.
**When to use:** any time the amount is chosen by the payer rather than fixed by the merchant (true here for all four presets + free input, per D-03).
**Example:**
```typescript
// supabase/functions/create-checkout-session/index.ts (Ausschnitt)
// Quelle: docs.stripe.com/api/checkout/sessions/create (price_data-Form,
// dynamisch statt vorab angelegter Price-Objekte — passend zum freien
// Betrag aus D-03).
import Stripe from 'npm:stripe@^22';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2026-06-20', // an die tatsächlich verwendete SDK-Version anpassen
});

const isMonthly = body.frequency === 'monthly';

const session = await stripe.checkout.sessions.create({
  mode: isMonthly ? 'subscription' : 'payment',
  line_items: [{
    price_data: {
      currency: 'eur',
      unit_amount: amountCents,
      product_data: { name: 'VerseBase Unterstützung' },
      // 'recurring' NUR im subscription-Modus setzen — im payment-Modus
      // lehnt Stripe das Feld ab.
      ...(isMonthly ? { recurring: { interval: 'month' } } : {}),
    },
    quantity: 1,
  }],
  // Nachvollziehbarkeit fuer den Webhook — siehe § Metadata-Transport unten.
  metadata: {
    display_name: sanitizedDisplayName,   // bereits entschärft, siehe D-20
    show_name: String(body.show_name === true),
    message: sanitizedMessage ?? '',
    user_id: session?.user?.id ?? '',
  },
  success_url: `${SITE.url}/support/thank-you.html?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${SITE.url}/support.html`,
});

return new Response(JSON.stringify({ url: session.url }), { headers: corsHeaders });
```
`{CHECKOUT_SESSION_ID}` is a literal template string Stripe substitutes after payment — never construct it yourself `[CITED: docs.stripe.com/api/checkout/sessions/create]`.

### Pattern 3: Webhook — raw body, async signature verification, and which events to trust

**What:** the ONLY code path allowed to write `public.donations`.
**When to use:** DON-07.
**Example:**
```typescript
// supabase/functions/stripe-webhook/index.ts (Ausschnitt)
// Deno-Edge-Laufzeit: Crypto ist asynchron, darum constructEventAsync statt
// constructEvent (sonst: "SubtleCryptoProvider cannot be used in a
// synchronous context"). Quelle: docs.stripe.com Webhook-Signaturprüfung +
// Supabase-eigenes Beispiel (examples/edge-functions/…/stripe-webhooks).
import Stripe from 'npm:stripe@^22';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const cryptoProvider = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req) => {
  // WICHTIG: req.text() VOR jedem JSON.parse — die Signatur wird über die
  // exakten Rohbytes berechnet; ein zwischengeschalteter JSON.parse+
  // JSON.stringify-Roundtrip veraendert Whitespace/Feldreihenfolge und
  // laesst die Prüfung fehlschlagen.
  const body = await req.text();
  const signature = req.headers.get('Stripe-Signature');

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET')!,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    // Ungültige Signatur = Fälschungsversuch oder falsches Secret — 400,
    // keine Persistierung. Das ist die gesamte Absicherung dieser Function.
    return new Response(`Webhook-Signatur ungültig: ${err.message}`, { status: 400 });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Ereignis-Auswahl — siehe § "Welche Events" unten für die vollständige
  // Begründung. Kurzfassung: checkout.session.completed deckt Einmal- UND
  // die ERSTE Monatszahlung ab (Session-Metadaten sind dort vollständig);
  // invoice.paid mit billing_reason='subscription_cycle' deckt NUR
  // Folgezahlungen ab (dort fehlen die Metadaten, siehe Nachschlage-Muster).
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    await admin.from('donations').upsert({
      stripe_event_id: event.id,               // Idempotenz-Schlüssel
      stripe_session_id: session.id,
      stripe_subscription_id: session.subscription as string ?? null,
      stripe_customer_id: session.customer as string ?? null,
      amount_cents: session.amount_total,
      currency: session.currency,
      kind: session.mode === 'subscription' ? 'recurring_initial' : 'one_time',
      display_name: session.metadata?.display_name || null,
      show_name: session.metadata?.show_name === 'true',
      message: session.metadata?.message || null,
      message_status: session.metadata?.message ? 'pending' : 'none',
      user_id: session.metadata?.user_id || null,
      customer_email: session.customer_details?.email ?? null,
    }, { onConflict: 'stripe_event_id', ignoreDuplicates: true });
  }

  if (event.type === 'invoice.paid') {
    const invoice = event.data.object as Stripe.Invoice;
    if (invoice.billing_reason === 'subscription_cycle') {
      // Folgezahlung: Metadaten NICHT auf der Invoice vorhanden (Stripe
      // propagiert Metadaten nicht automatisch, siehe Recherche-Notiz unten)
      // — beim eigenen recurring_initial-Datensatz nachschlagen statt
      // erneut die Stripe-API zu fragen.
      const { data: initial } = await admin
        .from('donations')
        .select('display_name, show_name, user_id')
        .eq('stripe_subscription_id', invoice.subscription)
        .eq('kind', 'recurring_initial')
        .single();

      await admin.from('donations').upsert({
        stripe_event_id: event.id,
        stripe_subscription_id: invoice.subscription as string,
        stripe_customer_id: invoice.customer as string,
        amount_cents: invoice.amount_paid,
        currency: invoice.currency,
        kind: 'recurring_renewal',
        display_name: initial?.display_name ?? null,
        show_name: initial?.show_name ?? false,
        user_id: initial?.user_id ?? null,
        message: null,
        message_status: 'none',
      }, { onConflict: 'stripe_event_id', ignoreDuplicates: true });
    }
    // billing_reason === 'subscription_create' wird bewusst IGNORIERT — die
    // erste Zahlung ist bereits über checkout.session.completed erfasst;
    // beide Events fuer denselben Erstbeitrag zu verarbeiten würde ihn
    // doppelt zählen.
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
```

**Which events must be handled, precisely:** `checkout.session.completed` (both modes — carries full session metadata) **plus** `invoice.paid` filtered to `billing_reason === 'subscription_cycle'` (renewals only). **Do not** also handle `invoice.paid` with `billing_reason === 'subscription_create'` — Stripe fires both `checkout.session.completed` and an `invoice.paid` for that same first subscription payment; handling both would double-count the first month `[CITED: reasoned from docs.stripe.com/billing/subscriptions/webhooks + docs.stripe.com/payments/checkout/how-checkout-works — Stripe's own docs describe billing_reason semantics but do not spell out this exact double-count risk in one place, so mark this specific claim MEDIUM confidence and worth a manual re-check once the operator is testing in Stripe test mode]`.

**Metadata does not propagate to renewal invoices** — confirmed via Stripe community/support sources cross-referencing the API reference: "metadata does not propagate between objects except in specific cases"; `subscription_data.metadata` puts data on the Subscription object, not automatically on future Invoices `[CITED: support.stripe.com/questions/using-metadata-with-checkout-sessions + docs.stripe.com/api/subscriptions/object]`. This is why the recommended design looks the display info back up in `public.donations` instead of relying on Stripe to carry it forward.

### Anti-Patterns to Avoid

- **Using `--no-verify-jwt` instead of `config.toml`:** works once, silently reverts on the next plain deploy. See § Trust Boundary.
- **Reading `req.json()` before signature verification in the webhook:** destroys the raw-byte guarantee signature verification depends on. Always `req.text()` first.
- **Trusting `checkout.session.completed` alone for subscriptions and *also* trusting every `invoice.paid`:** double-counts the first payment. Filter on `billing_reason`.
- **Rendering wall names/messages via `innerHTML`:** this repo's existing client scripts use two safe patterns — `element.textContent = value` (simplest, used in `account-lite.js`) or a local `esc()` HTML-escaping helper before building an HTML string (used in `mining-app.js`, `crafting-app.js`, `detail.js`, `archive.js`, `item-finder-app.js`, `wikelo-bridge.js`). The support wall must use one of these — never insert Supabase-sourced `display_name`/`message` into `innerHTML` unescaped, even though D-20 already sanitizes server-side (defense in depth; a future admin-approved message with clever unicode should not become a new class of bug).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Card payment collection, PCI compliance | Custom card-number form + client-side tokenization | Stripe Checkout (hosted) — already the locked decision D-01 | Confirmed by design, not just recommended: self-built card fields would put PCI scope on this project |
| Webhook signature verification | Manual HMAC-SHA256 comparison of the `Stripe-Signature` header | `stripe.webhooks.constructEventAsync` | Timing-safe comparison, tolerance-window handling, and multi-secret rotation support are already implemented and tested in the official SDK; a hand-rolled comparison is a classic timing-attack / off-by-one source of bugs |
| Idempotency / duplicate-delivery protection | A custom "have I seen this before" cache (Redis, in-memory Map, etc. — none of which exist in this project's architecture anyway) | A `unique` Postgres constraint on `stripe_event_id` + `upsert(..., { onConflict, ignoreDuplicates: true })` | Atomic insert-or-ignore at the database level closes the race window that a check-then-insert approach in application code cannot |
| Rate limiting the public checkout endpoint | A custom per-IP counter table/middleware | Nothing, for this phase (see § Trust Boundary — accept the residual risk at this scale) | Disproportionate engineering for a €120 goal on a low-traffic personal site; revisit only if abuse is actually observed |
| Display-name sanitization | Nothing custom beyond a length cap + character allowlist (this genuinely is simple enough to hand-write, unlike the items above) | A small regex allowlist (letters, numbers, common punctuation, no `<`/`>`/control chars), applied server-side in `create-checkout-session` before it ever reaches Stripe metadata, PLUS `textContent`/`esc()` on render (defense in depth) | D-20 explicitly scopes this narrowly ("Länge, Zeichenvorrat, kein Markup") — a dependency here (e.g. a sanitization library) would be over-engineering for a single-field, well-understood constraint |

**Key insight:** almost everything hard about this phase is *trust-boundary plumbing* (who can call what, with which header, and who's allowed to write), not payment logic — Stripe and Supabase already solved the payment logic.

## Supabase Data Layer

### Table shape

```sql
-- supabase/migrations/20260731000000_donations.sql (Entwurf für den Planer)
--
-- Spendenzeilen entstehen AUSSCHLIESSLICH im stripe-webhook (DON-07). Das
-- Muster ist identisch zu guard_rsi_verified.sql: RLS UND ein Trigger, nicht
-- nur RLS — RLS kennt keine spaltenweisen Regeln, und ein Trigger bleibt
-- auch dann wirksam, wenn künftig aus Versehen eine zu großzügige Policy
-- entsteht.
create table if not exists public.donations (
  id                      uuid primary key default gen_random_uuid(),
  created_at              timestamptz not null default now(),
  stripe_event_id         text not null unique,     -- Idempotenz (DON-07)
  stripe_session_id       text,
  stripe_subscription_id  text,
  stripe_customer_id      text,
  amount_cents            integer not null check (amount_cents > 0),
  currency                text not null default 'eur',
  kind                    text not null check (kind in ('one_time','recurring_initial','recurring_renewal')),
  display_name            text check (char_length(display_name) <= 60),
  show_name               boolean not null default false,   -- D-17 Zustimmung
  message                 text check (char_length(message) <= 500),
  message_status          text not null default 'none' check (message_status in ('pending','approved','rejected','none')),
  user_id                 uuid references auth.users(id) on delete set null,  -- D-19, optional
  customer_email          text                                -- NIE öffentlich, DON-08
);

comment on table public.donations is
  'Spendenzeilen — ausschliesslich vom stripe-webhook geschrieben (service_role). Siehe guard_donations_writes().';

alter table public.donations enable row level security;

-- Kein Client-Schreibrecht: absichtlich KEINE insert/update-Policy fuer
-- anon/authenticated. Zusaetzlich ein Trigger als zweite Verteidigungslinie
-- (identisches Muster zu guard_rsi_verified.sql) — falls künftig aus
-- Versehen eine zu offene Policy entsteht, greift der Trigger trotzdem.
create or replace function public.guard_donations_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  if caller_role = 'service_role' then
    return new;
  end if;
  -- Admin darf NUR message_status aendern (Moderation) — alle anderen
  -- Spalten bleiben unveraendert, auch fuer Admins.
  if tg_op = 'UPDATE' and exists (
    select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    if new.amount_cents is distinct from old.amount_cents
       or new.stripe_event_id is distinct from old.stripe_event_id
       or new.stripe_session_id is distinct from old.stripe_session_id
       or new.stripe_subscription_id is distinct from old.stripe_subscription_id
       or new.stripe_customer_id is distinct from old.stripe_customer_id
       or new.customer_email is distinct from old.customer_email
       or new.user_id is distinct from old.user_id
    then
      raise exception 'Admins duerfen nur message_status/message aendern (Moderation)'
        using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;
  raise exception 'donations: nur der Webhook (service_role) darf schreiben'
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists trg_guard_donations_writes on public.donations;
create trigger trg_guard_donations_writes
  before insert or update on public.donations
  for each row execute function public.guard_donations_writes();

-- Admin-Zugriff fuer die Moderationsoberflaeche (UI-SPEC §7): direkte
-- RLS-Policy auf der Basistabelle, NICHT die öffentliche View — Freigabe
-- braucht die volle Nachricht inkl. unfreigegebener Zeilen.
create policy donations_admin_select on public.donations
  for select using (exists (
    select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'
  ));

create policy donations_admin_update on public.donations
  for update using (exists (
    select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'
  ));

-- ------------------------------------------------------------------------
-- Öffentliche Ansichten — Muster identisch zu public_profile_views.sql:
-- View statt RLS-Policy auf der Basistabelle, weil RLS zeilen- nicht
-- spaltenbasiert ist. anon/authenticated bekommen SELECT NUR hierauf.
-- ------------------------------------------------------------------------

-- Wand: Name/Datum/freigegebene Nachricht. NIE amount_cents, NIE Stripe-IDs,
-- NIE customer_email. (Zur Spannung mit DON-08 s. "Assumptions Log" unten —
-- hier wird D-16/D-17/UI-SPEC gefolgt: kein Betrag, niemals.)
create or replace view public.donation_wall
with (security_barrier = true) as
select
  d.id,
  d.created_at,
  case when d.show_name then d.display_name else null end as display_name,
  d.show_name,
  p.handle as linked_handle,          -- D-19: verknüpftes Profil
  case when d.message_status = 'approved' then d.message else null end as message
from public.donations d
left join public.profiles p on p.id = d.user_id and p.handle is not null;

-- Fortschritt: EIN aggregierter Datensatz, keine Einzelbeträge lesbar.
create or replace view public.donation_progress
with (security_barrier = true) as
select
  coalesce(sum(amount_cents), 0)::bigint as total_cents,
  count(*)::int as supporter_count
from public.donations;

grant select on public.donation_wall to anon, authenticated;
grant select on public.donation_progress to anon, authenticated;
```

### RLS policy summary

| Role | `public.donations` (base table) | `public.donation_wall` | `public.donation_progress` |
|------|----------------------------------|-------------------------|------------------------------|
| `anon` | no access (RLS enabled, no matching policy) | `SELECT` (view grant) | `SELECT` (view grant) |
| `authenticated` (non-admin) | no access | `SELECT` | `SELECT` |
| `authenticated` (admin, via `user_roles`) | `SELECT` all rows, `UPDATE` restricted to `message_status`/`message` by trigger | `SELECT` | `SELECT` |
| `service_role` (webhook only) | full `INSERT`/`UPDATE` | n/a (bypasses RLS entirely) | n/a |

### Moderation gate — reuse, don't duplicate

The existing admin gate is `.is-admin` on `<html>`, populated client-side by `account-lite.js` reading `user_roles` and cached in `sessionStorage` (`Layout.astro:119-129`, `account-lite.js:200-244`). **That client-side class is a UI convenience only — it is not, and must not be treated as, a security boundary** (a visitor could set the class in devtools). The actual security boundary for the moderation surface is the `donations_admin_select`/`donations_admin_update` RLS policies above, which re-check `user_roles` server-side on every query via Postgres, independent of anything the client claims. UI-SPEC §7 already specifies this correctly ("service-role-equivalent access via RLS policy scoped to the admin's user id") — this research confirms the concrete policy shape.

### The DON-08 / D-16 tension — flagged for the planner

`REQUIREMENTS.md` DON-08 lists **"Anzeigename, Betrag, Datum, Nachricht"** as the whitelist of fields that MAY be public. `CONTEXT.md` D-16 is explicit and detailed: **"Pro Unterstützer stehen Name und Datum, kein Betrag."** UI-SPEC's Extended Contract §5 goes further, calling the no-amount rule "a hard content rule... enforced by the query/view shape." These two documents disagree on whether amount is public-eligible. **This research follows D-16/UI-SPEC** (no `amount_cents` in `donation_wall`, only in the aggregate `donation_progress`) because CONTEXT.md is the later, more specific, discussion-derived artifact and the UI-SPEC that was checker-verified against it already assumes no per-supporter amount exists anywhere in the public data path. Flagged in the Assumptions Log below — if the planner or a later reviewer reads DON-08 literally, this is the discrepancy to resolve (recommend: treat DON-08's "Betrag" as satisfied by the aggregate progress view, not a per-row field).

## Site Integration

### CSP — the actual finding (not what the research brief assumed)

The research brief asked "what CSP directives need Stripe hosts, and does the redirect flow need less than an embedded Stripe.js flow." The answer for the **locked, D-01 hosted-Checkout-redirect design: none at all.**

Reasoning, grounded in how `scripts/audit-csp.mjs` actually measures the policy (read in full): it walks the **built HTML/JS** looking for `<script src>`, `<iframe src>`, `<img src>`, inline-script URL literals, and known runtime capabilities (Blob workers, WASM). A `fetch()` call to `https://trgjhmbnodoarnfmlcqx.supabase.co/functions/v1/create-checkout-session` is already covered by the existing `connect-src` entry for that exact host (`nginx/default.conf` line 121: `connect-src 'self' blob: https://trgjhmbnodoarnfmlcqx.supabase.co https://api.web3forms.com https://cloudflareinsights.com`) — no new connect-src host needed. The subsequent `window.location.href = session.url` (or equivalently `<a href>` to the returned URL) is a **top-level browser navigation**, not a fetch, not a frame embed, not a form submission — CSP's `connect-src`, `frame-src`, `script-src`, and `form-action` directives do not govern top-level navigations at all (only `navigate-to`, which is not in this policy and has weak browser support regardless). Ko-fi (D-02) is the same story: a plain `<a href="https://ko-fi.com/…">` link is an ordinary navigation, ungoverned by CSP.

**Conclusion: `npm run audit:csp` should stay green with zero new entries for this phase**, *provided* the implementation strictly follows hosted-Checkout-redirect (no Stripe.js `<script src="https://js.stripe.com/...">`, no embedded Checkout iframe). **If a future phase ever adds Stripe.js** (e.g. for Payment Element / embedded Checkout instead of the hosted page), the entries would be: `script-src https://js.stripe.com`, `frame-src https://js.stripe.com https://hooks.stripe.com`, `connect-src https://api.stripe.com` — noted here for completeness, but **out of scope for this phase's locked D-01 design.**

`form-action` (currently `'self' https://api.web3forms.com`) needs **no new entry** — nothing on `/support.html` is a native HTML `<form method="post" action="...">` submission to a third party; the amount-picker form (per UI-SPEC's native-radio-under-label technique) submits via JS `fetch()` to the same-origin-equivalent Supabase function, not a browser-native form POST to Stripe.

**One thing to verify at build time, not guess:** run `npm run audit:csp` after implementation exactly as the codebase's own rule demands (`nginx/default.conf`'s own comment block: "die Liste... gemessen... nicht geraten"). This research's "no CSP change needed" conclusion is a reasoned prediction from reading the audit script's logic, not a substitute for actually running it — flag as a verification step, not a foregone conclusion.

### Datenschutzerklärung (DON-14)

`src/pages/datenschutz.astro` already has the exact pattern to copy for the new Stripe/Ko-fi section — see the existing `## Feedback form (Web3Forms)` section (lines 109-134): names the service, lists exactly what data crosses to them, cites the legal basis (Art. 6 (1) GDPR), links the third party's own privacy policy, and notes when the connection is actually established. The Stripe/Ko-fi section should mirror this structure: what Stripe sees (payment details, email if provided, IP address via their hosted page), what Ko-fi sees (nothing from this site — it's an outbound link only, the visitor interacts with Ko-fi's own site entirely), and links to `stripe.com/privacy` and `ko-fi.com/privacy`. **This is prose/legal-content work for the planner/executor, not a technical research question** — flagged here only to confirm the pattern exists and where.

## Honesty Constraint — Demo Mode (D-05/D-09/D-15)

Extending the exact `FEEDBACK_DEMO` pattern already in `src/consts.ts`:

```typescript
// src/consts.ts — Ausschnitt, Muster identisch zu FEEDBACK_DEMO
export const STRIPE = {
  // Publishable Key ist NICHT geheim (analog SUPABASE.publishableKey) — er
  // identifiziert nur den Zahlungsempfänger, autorisiert nichts. Solange der
  // Platzhalter steht, laeuft die Seite im Demo-Modus.
  publishableKey: 'REPLACE_WITH_YOUR_STRIPE_PUBLISHABLE_KEY',
} as const;

export const KOFI = {
  // Ko-fi-Nutzername — sobald gesetzt, erscheint die nachgeordnete Zeile
  // "Lieber über Ko-fi? →" (D-02). Kein Schlüssel, nur ein Handle.
  username: '',
} as const;

export const SUPPORT = {
  goalCents: 12000, // 120,00 € (D-13) — hier änderbar, kein Deploy nötig ausser Rebuild
} as const;

/** true, solange kein echter Stripe-Publishable-Key hinterlegt ist. */
export const SUPPORT_DEMO = STRIPE.publishableKey === 'REPLACE_WITH_YOUR_STRIPE_PUBLISHABLE_KEY';

/** true, solange kein Ko-fi-Name hinterlegt ist — unabhaengiges Flag von SUPPORT_DEMO. */
export const KOFI_HIDDEN = KOFI.username === '';
```

**What must degrade, concretely:**
- `SUPPORT_DEMO === true` → the amount picker still renders and validates, the CTA click shows the same `.spt-demo` confirmation flow `FeedbackForm.astro`'s `showDone()` already establishes (no network call to `create-checkout-session` at all — or the call happens but the Edge Function itself should also refuse to create a real session if `STRIPE_SECRET_KEY` is unset, as defense in depth for the case where the demo flag and the actual secret drift out of sync).
- The **progress bar is entirely absent from the DOM**, not zeroed (D-15, UI-SPEC §2/§4) — this must be a structural "don't render the node" decision in the component, not a CSS `display:none`, so that `npm run audit:site`'s a11y checks don't find a `role="progressbar"` with no real backing data.
- The **supporter wall still renders even in demo mode** — it reads real historical rows from `donation_progress`/`donation_wall` independent of whether Stripe keys exist yet (a webhook could theoretically have already recorded rows from a prior brief test, or — more realistically for this project — there simply are none yet and the "empty wall" copy applies). This is explicitly **not** gated by `SUPPORT_DEMO`, only by whether the table has rows.
- The **`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SIGNING_SECRET` env vars are absent from Supabase function secrets** until the operator sets them — the Edge Function should fail closed (return a clear "not configured" error, not a 500 stack trace) if invoked with no secret set, matching this repo's "runtime code degrades silently with a documented fallback" convention (`CONVENTIONS.md` § Error Handling).

## Common Pitfalls

### Pitfall 1: Webhook lag vs. success redirect

**What goes wrong:** the browser is redirected to `success_url` by Stripe as soon as Checkout completes, but the webhook delivery (async, server-to-server) can arrive seconds later — sometimes noticeably later under retry conditions. If the thank-you page tries to read the just-created donation row from `donation_wall`/`donation_progress` to confirm success, it may find nothing yet.
**Why it happens:** Stripe's redirect and Stripe's webhook are two independent, unsynchronized delivery paths.
**How to avoid:** the thank-you page's "success" message should be driven by the **presence of `?session_id=...` in the URL** (which only exists if Stripe actually completed the redirect after payment) — not by polling the database for a row to appear. This matches DON-04 exactly ("Nach der Zahlung landet der Spender auf einer Dankesseite, die den Erfolg bestätigt") without requiring the DB row to exist yet. The progress bar and wall, elsewhere on the site, will simply update on their next natural page load once the webhook has landed — this is honest (D-15: no fabricated numbers) and requires no special-casing.
**Warning signs:** a thank-you page that shows an error or a stuck spinner when the webhook is slow.

### Pitfall 2: `req.json()` before signature verification

**What goes wrong:** signature verification fails silently or unpredictably.
**Why it happens:** `constructEventAsync` verifies the signature against the *exact raw bytes* of the body; any parse/re-serialize round-trip changes whitespace and key order, invalidating the signature.
**How to avoid:** always `const body = await req.text()` first, pass that raw string to `constructEventAsync`, and only `JSON.parse` (or use the already-parsed `event.data.object`) after verification succeeds.
**Warning signs:** webhook returns 400 for every event, even ones sent by genuine Stripe test triggers.

### Pitfall 3: Double-counting the first subscription payment

Covered in detail under § Architecture Patterns, Pattern 3 — worth repeating as a standalone pitfall because it is easy to get subtly wrong (handling `invoice.paid` unconditionally instead of filtering `billing_reason`) and the failure mode (an inflated progress bar / duplicate wall entry) directly violates D-12's "keine gepflegte Zahl, keine Schätzung" promise.

### Pitfall 4: CORS wildcard copied from `verify-rsi`

**What goes wrong:** `verify-rsi/index.ts` uses `'Access-Control-Allow-Origin': '*'`. Copying that verbatim into `create-checkout-session` (a function that is intentionally callable without any auth) widens the abuse surface described in § Trust Boundary — any third-party page could embed a fetch to it.
**How to avoid:** scope the two new functions' CORS to `https://verse-base.com` (and, if local dev against the deployed function is needed, add `localhost` explicitly rather than `*`).

### Pitfall 5: `config.toml` silently changing existing function behaviour

**What goes wrong:** if a future edit to `config.toml` accidentally adds a `[functions.verify-rsi]` block (e.g. copy-paste from the two new entries) without `verify_jwt = true` explicit, or a stray top-level default override, `verify-rsi` could unintentionally lose its JWT requirement.
**How to avoid:** keep `verify-rsi`, `register`, `delete-account` entirely unlisted in `config.toml` (the documented default already protects them) rather than listing them with `verify_jwt = true` — fewer lines that could be edited wrong later. Add a one-line comment in the file itself (as drafted above) stating this is deliberate.

## Code Examples

See § Architecture Patterns, Patterns 1–3, for the three load-bearing snippets (amount validation, Checkout Session creation, webhook signature verification + event filtering). All are original synthesis grounded in the cited official docs, not verbatim copies — they use this repo's German-comment convention and `verify-rsi`'s CORS-header/service-role-client structure where those patterns still apply.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'` (used by `verify-rsi/index.ts`) | `Deno.serve((req) => { ... })` — native, no import needed | Deno's std `http/server` module has been superseded by the native `Deno.serve` API for some time; Supabase's own current documentation and example code use `Deno.serve` `[CITED: cross-referenced community/blog sources describing the Supabase-recommended pattern — MEDIUM confidence, as the specific "std@0.168.0 is deprecated" claim was not confirmed by fetching a single canonical Supabase deprecation notice in this session]` | The two **new** functions should use `Deno.serve`; `verify-rsi`'s older style is out of scope to change in this phase (don't touch working code unrelated to the phase boundary) but is worth flagging for a future cleanup |
| `esm.sh` imports for third-party npm packages in Deno | `npm:` specifiers (e.g. `npm:stripe@^22`) | Deno gained native npm compatibility; Supabase's official Stripe example now uses `npm:stripe` | Recommend `npm:stripe@^22` for the two new functions over `esm.sh/stripe` |
| Legacy JWT-based `anon`/`service_role` keys | New prefixed keys (`sb_publishable_…`/`sb_secret_…`) | Supabase's 2025-2026 API key migration (this project has already adopted the new publishable key — confirmed in `src/consts.ts`) | Directly load-bearing for this phase's trust-boundary design, covered in full above |
| Fixed Stripe Price objects per amount | `price_data` inline in `line_items` for dynamic/customer-chosen amounts | Long-standing Stripe capability, not a recent change, but worth noting because older tutorials default to fixed Prices | Simpler for this project's "any amount 1-500€" requirement — no Price object management |

**Deprecated/outdated:** `deno.land/std@0.168.0/http/server.ts` `serve()` — still functions (Deno maintains backward compatibility), but is not what current Supabase examples show; new code in this phase should not extend the pattern further, though `verify-rsi` itself is out of scope to migrate here.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `verify-rsi` unaffected by adding `config.toml` (unlisted functions keep default `verify_jwt = true`) | § Trust Boundary | HIGH confidence, well-cited — low risk, but if wrong it would silently open `verify-rsi` to anonymous calls; worth a one-time manual check (`curl` the deployed `verify-rsi` endpoint with no Authorization header after this phase ships — expect 401) |
| A2 | `checkout.session.completed` (both modes) + `invoice.paid` filtered to `billing_reason === 'subscription_cycle'` is the complete, non-duplicating event set for DON-07/D-12's "no fabricated/duplicated numbers" promise | § Architecture Patterns, Pattern 3 | If wrong, either the first month or a renewal month could be missed (bar/wall under-count) or double-counted (over-count) — directly violates the "Never fabricate data" house rule; **recommend a `checkpoint:human-verify` task once test-mode Stripe keys exist, specifically testing a subscription through one full renewal cycle (Stripe test clocks can simulate this without waiting a month)** |
| A3 | `project_id` is required at the top of `supabase/config.toml` even for a deploy-only (no local dev stack) use case | § Trust Boundary | LOW risk — worst case is a deploy-time error caught immediately, not a silent security gap; cheap to include regardless |
| A4 | `deno.land/std@0.168.0/http/server.ts` is meaningfully "stale" vs. `Deno.serve` | § State of the Art | LOW risk either way — both work; this only affects which style new code imitates, not correctness |
| A5 | D-16 (no per-supporter amount, ever) should override DON-08's literal "Betrag" wording in the public-view design | § Supabase Data Layer | MEDIUM — if the planner/operator actually wants amounts shown per-supporter (contradicting D-16/UI-SPEC), the view shape in this research would need to change; flagged explicitly rather than silently picked |
| A6 | "Linking a VerseBase profile" (D-19) implies consent to show the handle, independent of the separate anonymous-default checkbox (D-17) | § Supabase Data Layer | LOW-MEDIUM — reasonable reading of the two decisions together, but not explicitly stated in CONTEXT.md; the planner should treat this as a discretion point to confirm, not a locked fact |
| A7 | No abuse mitigation beyond amount-clamping + CORS-narrowing is proportionate for `create-checkout-session` at this project's scale | § Trust Boundary | LOW — a judgment call about proportionality, not a factual claim; revisit if abuse is actually observed post-launch |

**If this table is empty:** N/A — see rows above.

## Open Questions

1. **Does `supabase functions deploy` require `project_id` in `config.toml` when the file's only purpose is per-function settings?**
   - What we know: `project_id` is documented as a required top-level key in the general CLI config reference.
   - What's unclear: whether omitting it (or setting an arbitrary placeholder) actually breaks a deploy-only workflow that never touches the local Docker dev stack.
   - Recommendation: include it (cost is zero, as drafted in § Trust Boundary); if the operator hits a deploy error referencing `project_id`, that confirms the requirement — not a blocker either way.

2. **Exact Stripe API version to pin (`apiVersion` in the SDK constructor).**
   - What we know: `npm:stripe@^22` is the current major version (22.4.0 confirmed on the registry).
   - What's unclear: the exact API version string changes frequently (Stripe ships dated API versions); this research did not fetch the single current dated version string, since it would already be stale by the time this phase executes.
   - Recommendation: let the planner/executor either omit `apiVersion` (SDK default = the version the secret key's account is pinned to) or read whatever the SDK's own `Stripe.js` default constant resolves to at implementation time — do not hardcode a guessed date string into the research.

3. **Does Ko-fi need any DB/webhook interaction in this phase at all?**
   - What we know: explicitly deferred (`05-CONTEXT.md` § Deferred Ideas — "Ko-fi-Webhook... in dieser Phase bewusst nicht gebaut").
   - What's unclear: nothing — this is settled, listed here only to confirm no Ko-fi API research was needed or done for this phase, consistent with the deferral.
   - Recommendation: none needed; the planner should not add any Ko-fi backend work.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI (`supabase`) | Deploying the two new Edge Functions + applying the new migration + the mechanism that reads `config.toml` | ✗ (not found in this dev environment) | — | Install via `npm install -g supabase` or `npx supabase@latest ...` on whichever machine performs the deploy (no CI workflow currently automates this — see below) |
| Deno | Local testing of Edge Function code before deploy (optional — Supabase CLI bundles a Deno runtime for `supabase functions serve`) | ✗ (not found) | — | Not strictly required if deploying straight via the Supabase CLI's bundled runtime; install separately only if local `deno test`/`deno run` iteration is wanted |
| Stripe CLI (`stripe`) | `stripe listen --forward-to` (local webhook testing) and `stripe trigger` (synthetic test events) | ✗ (not found) | — | Use the Stripe Dashboard's "Send test webhook" feature against the deployed function URL instead — works without any local install, at the cost of a slower edit-test loop |
| Node.js / npm | Already required by the rest of the site's build; unrelated to this phase's new server code but used to run `npm run audit:csp` etc. after implementation | ✓ | Node v22.18.0, npm 10.9.3 | — |
| GitHub Actions deploy step for Edge Functions | Keeping `config.toml`'s settings and function code in sync with what's actually live, going forward | ✗ (no such workflow exists — confirmed: no `supabase` references anywhere in `.github/workflows/`) | — | Manual `supabase functions deploy` from a dev machine for this phase is acceptable (matches how `verify-rsi` was deployed); adding an automated deploy step is a reasonable follow-up but is not required to satisfy this phase's success criteria |

**Missing dependencies with no fallback:** none — every missing tool has a workable fallback for this phase's scope.

**Missing dependencies with fallback:** Supabase CLI (install on demand), Stripe CLI (use Dashboard test-webhook UI instead), automated deploy (manual deploy is acceptable for now).

## Setup Guide Content (for the operator, D-05)

This is the content D-05 requires the phase to produce — a step-by-step the operator follows once real accounts exist. Recommend the planner turn this into a dedicated doc (e.g. `docs/support-setup.md` or a section in the phase's own artifacts) rather than inline code comments, since it's operational, not code:

1. **Create the Stripe account** at `stripe.com` (business/individual type — operator's own choice, out of scope for this research per the D-21 tax-framing note already in CONTEXT.md).
2. **Get the test-mode keys**: Stripe Dashboard → Developers → API keys (test mode toggle on). Copy the **Publishable key** (`pk_test_...`) into `src/consts.ts` `STRIPE.publishableKey` — this is safe to commit (same publicness contract as `SUPABASE.publishableKey`). Copy the **Secret key** (`sk_test_...`) — this goes ONLY into Supabase function secrets, never a file in this repo: `supabase secrets set STRIPE_SECRET_KEY=sk_test_...`.
3. **Create the webhook endpoint**: Stripe Dashboard → Developers → Webhooks → Add endpoint. URL: `https://trgjhmbnodoarnfmlcqx.supabase.co/functions/v1/stripe-webhook`. Events to send: `checkout.session.completed`, `invoice.paid` (select these two explicitly — no need for "all events"). After creation, Stripe reveals the **Signing secret** (`whsec_...`) — set it via `supabase secrets set STRIPE_WEBHOOK_SIGNING_SECRET=whsec_...`. This value never appears in the repo either.
4. **Deploy the two functions**: `supabase functions deploy create-checkout-session --project-ref trgjhmbnodoarnfmlcqx` and the same for `stripe-webhook` (requires the Supabase CLI — see § Environment Availability; requires `supabase login` / an access token once).
5. **Test end-to-end in test mode**: use card `4242 4242 4242 4242`, any future expiry, any 3-digit CVC — this is Stripe's standard always-succeeds test card `[VERIFIED: docs.stripe.com/testing]`. Confirm the row appears in `public.donations` (readable via the Supabase Dashboard table editor with the operator's own project access, or the moderation UI once built) and that the wall/bar update on `/support.html`.
6. **Ko-fi**: create an account at `ko-fi.com`, set `src/consts.ts` `KOFI.username` to the chosen handle — this alone makes the subordinate "Lieber über Ko-fi? →" line appear (per D-05: "Ko-fi bleibt ausgeblendet, solange kein Name hinterlegt ist").
7. **Go live**: switch Stripe Dashboard out of test mode, generate live keys, repeat steps 2-3 with live values, redeploy. Update `datenschutz.astro`/`de/datenschutz.astro` (DON-14) **before** flipping `STRIPE.publishableKey` away from the placeholder in production, not after.

*(Roadmap Success Criterion 1 — "eine echte Zahlung im Stripe-Testmodus läuft vollständig durch" — cannot be demonstrated by Claude per D-05; this setup guide is what makes that demonstration possible once the operator completes steps 1-3, and the actual proof happens at `/gsd-verify-work` time.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | Partial — the moderation UI (admin-only) relies on the existing Supabase Auth session; the donation flow itself is intentionally unauthenticated (DON-02) | Existing Supabase Auth (unchanged); no new auth mechanism introduced |
| V3 Session Management | No new session state — donation flow is stateless per-request; optional signed-in linkage reuses the existing `supabase-js` session | Existing session handling (unchanged) |
| V4 Access Control | Yes — this is the phase's core concern | RLS policies + trigger (§ Supabase Data Layer) scoped by `user_roles`; `verify_jwt`/`apikey` gateway checks (§ Trust Boundary) |
| V5 Input Validation | Yes | Server-side amount clamping (Pattern 1); display-name/message sanitization (D-20, § Don't Hand-Roll) |
| V6 Cryptography | Yes, but entirely delegated | Stripe's own webhook HMAC signature verification via `constructEventAsync` — never hand-rolled (§ Don't Hand-Roll) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Forged webhook event (attacker POSTs a fake `checkout.session.completed` to fabricate a donation row) | Spoofing | Signature verification against `STRIPE_WEBHOOK_SIGNING_SECRET` (§ Architecture Patterns, Pattern 3) — the ENTIRE defense for this endpoint |
| Client-supplied amount tampering (a modified fetch body claims a €1 charge is €1000, or vice versa, or negative) | Tampering | Server-side amount clamp before calling Stripe (Pattern 1) — Stripe itself also independently validates the amount it's told, but this repo's own control is the load-bearing one for DON-06 |
| Replayed/duplicated webhook delivery inflating the progress bar | Tampering (data integrity) / Repudiation | `stripe_event_id` unique constraint + atomic `upsert ... ignoreDuplicates` (§ Don't Hand-Roll) |
| Stored XSS via a display name or an approved message rendered on the public wall | Tampering / Elevation of Privilege (via script injection) | Server-side sanitization (D-20) + client-side `textContent`/`esc()` rendering (§ Common Pitfalls, Anti-Patterns) — two independent layers |
| Information disclosure of `customer_email`/Stripe IDs/individual amounts via an overly-broad public view or RLS policy | Information Disclosure | Narrow public views selecting only whitelisted columns (§ Supabase Data Layer), modeled on the existing `public_profile_views.sql` pattern |
| Public `create-checkout-session` used as a DoS/cost-generation vector | Denial of Service | Accepted residual risk at this project's scale (§ Trust Boundary) — CORS narrowing as a light mitigation, no rate limiter built |

## Sources

### Primary (HIGH confidence)
- `supabase.com/docs/guides/functions/auth-headers` — gateway `apikey`/`Authorization` header behaviour, new-key rejection in `Authorization`
- `supabase.com/docs/guides/functions/function-configuration` — `verify_jwt` per-function `config.toml` syntax and default behaviour
- `supabase.com/docs/guides/functions/auth` — securing anonymous/webhook functions, `verify_jwt = false` implications
- `supabase.com/docs/local-development/cli/config` — full `[functions.<name>]` key reference
- `docs.stripe.com/api/checkout/sessions/create` — Checkout Session parameters, `price_data`, `{CHECKOUT_SESSION_ID}` template
- `docs.stripe.com/testing` — test card numbers
- npm registry (`npm view stripe version` / `time.modified`) — package version/publish-date verification

### Secondary (MEDIUM confidence)
- `github.com/supabase/supabase` (`examples/edge-functions/supabase/functions/stripe-webhooks/index.ts`) — official example: `npm:stripe`, `req.text()`, `constructEventAsync`, `cryptoProvider`
- `github.com/supabase/cli/issues/4059` — `--no-verify-jwt` flag reliability issue, cross-checked against the `config.toml` persistence claim
- `support.stripe.com/questions/using-metadata-with-checkout-sessions` + `docs.stripe.com/api/subscriptions/object` — metadata non-propagation to invoices (WebSearch-surfaced, quoting Stripe's own support/API-reference content)
- `docs.stripe.com/billing/subscriptions/webhooks` + `docs.stripe.com/payments/checkout/how-checkout-works` — `billing_reason` semantics, reasoned synthesis for the double-count avoidance design (flagged MEDIUM, not HIGH, per A2 above)
- Codebase: `supabase/functions/verify-rsi/index.ts`, `supabase/migrations/20260722200000_guard_rsi_verified.sql`, `supabase/migrations/20260723000000_public_profile_views.sql`, `supabase/migrations/20260726000000_crafting_entries.sql`, `nginx/default.conf`, `scripts/audit-csp.mjs`, `src/consts.ts`, `src/layouts/Layout.astro`, `assets/account-lite.js`, `scripts/supabase-schema.sql` — all read directly this session `[VERIFIED: codebase]`

### Tertiary (LOW confidence)
- Community sources on `Deno.serve` vs. `deno.land/std@0.168.0` deprecation timing (blog posts, DEV Community articles) — the direction is consistent across sources but no single canonical Supabase deprecation notice was fetched; treat the *recommendation* (use `Deno.serve` for new code) as solid, the *exact deprecation date/mechanism* as unconfirmed

## Metadata

**Confidence breakdown:**
- Trust boundary (`verify_jwt`, `apikey`, publishable-key-is-not-a-JWT): HIGH — multiple official Supabase docs pages fetched directly and cross-consistent
- Stripe Checkout Session creation (amounts, modes, `price_data`): HIGH — official Stripe API reference fetched directly
- Webhook signature verification mechanics: HIGH — official Stripe docs + Supabase's own official example agree
- Webhook event selection / double-count avoidance / metadata-to-renewal design: MEDIUM — reasoned synthesis of several confirmed facts, not a single authoritative "do exactly this" source; explicitly flagged for a human-verify checkpoint once test keys exist
- CSP impact of hosted-redirect Checkout: MEDIUM-HIGH — grounded in reading this repo's own `audit-csp.mjs` logic directly (which directive it checks and how), not just general Stripe/CSP knowledge; the "should stay green" claim should still be confirmed by actually running the audit post-implementation
- Data layer (table/RLS/views): HIGH for the *pattern* (directly copying two already-proven in-repo migrations), MEDIUM for the specific column list (own synthesis against DON-07/08/12 and the flagged D-16 tension)

**Research date:** 2026-07-31
**Valid until:** ~30 days for the Supabase/Stripe API mechanics (stable, well-documented platforms); the specific `stripe` npm version pin (`22.4.0`) will drift faster (Stripe ships patch releases often) — re-verify with `npm view stripe version` at implementation time rather than trusting this document's pinned number literally.
