# Passalong

A UK marketplace for pre-loved fashion and more – buy, sell, chat, make offers, pay with Buyer Protection, ship with prepaid labels, and resolve problems through a guided dispute flow.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS 4, PostgreSQL + Prisma 7, Better Auth, Stripe Connect, Supabase (storage + realtime), Shippo, Resend and Upstash.

> **Status:** feature-complete for a test launch, running locally with 101 unit/integration tests and 29 end-to-end/accessibility tests passing.
> **Not yet live:** it needs your accounts and keys (see [Deploying](#deploying)). Stripe stays in **test mode** until you explicitly approve going live. All legal pages are **drafts for a solicitor to review**.

---

## Contents

1. [Features](#features)
2. [Tech stack and why](#tech-stack-and-why)
3. [Running locally](#running-locally)
4. [Testing](#testing)
5. [Project structure](#project-structure)
6. [How money moves](#how-money-moves)
7. [Deploying](#deploying)
8. [Custom domain](#custom-domain)
9. [Environment variables](#environment-variables)
10. [Going live checklist](#going-live-checklist)
11. [Known limitations and TODOs](#known-limitations-and-todos)
12. [Launch decisions](#launch-decisions)

---

## Features

| Area | What's built | Needs keys to work for real |
| --- | --- | --- |
| Accounts | Email + password sign-up, email verification, password reset, Google & Apple sign-in, profiles (photo, bio, location, ratings, followers, last active, response time), holiday mode, settings (notifications, privacy, addresses, payouts, tax, bundles), data export and account deletion | Resend (email), Google/Apple OAuth |
| Listings | Up to 20 photos with drag-and-drop **and** keyboard/button reordering, category tree, brand list + custom brands, sizes, condition, colours, material, parcel size, drafts, edit, reserve for a buyer, hide, mark sold, delete | Supabase storage (local disk in dev) |
| Promotion | Bump an item, wardrobe spotlight, bundle discounts | Stripe |
| Browse & search | Personalised home feed, full-text search with trigram matching and autocomplete, filters (category, brand, size, condition, colour, material, price), 4 sorts, saved searches with alerts, favourites with price-drop alerts, wardrobe pages, similar items | – |
| Buying | Buy now, offers/counter-offers/accept/decline/withdraw, bundles from one seller, Buyer Protection fee, card/Apple Pay/Google Pay via Stripe Payment Element, held funds, auto-release 2 days after delivery, wallet (pending/available), withdrawals, refunds, partial refunds, cancellations | Stripe |
| Shipping | Parcel size → price, prepaid labels after payment, collection booking where supported, tracking for both parties with notifications, in-person handover with 6-digit code, manual tracking fallback | Shippo |
| Messaging | Per-item chat, real-time updates, offers/order events in chat, photo attachments, block/report from chat, off-platform payment warnings | Supabase Realtime (falls back to polling) |
| Notifications | In-app, email and web push, switchable per type and channel | Resend, VAPID keys |
| Reviews | Two-way reviews, automatic positive feedback after buyer confirmation | – |
| Disputes | Report within 2 days (not as described, damaged, missing, counterfeit), evidence upload, return label, partial refund offers, escalation, support decisions | Stripe, Shippo |
| Trust & safety | Report listings/users/messages, moderation queue (approve, remove, warn, suspend, ban), prohibited keyword + category checks, rate limiting, spam detection, fraud signals (new account + high value, many reports, payment failures, chargebacks, off-platform), ID verification via Stripe Connect | Upstash (optional) |
| Admin | Dashboard with sign-ups/listings/orders/GMV/fee revenue charts, search/manage users, listings, orders, payouts, disputes, notices, tickets; manage categories, brands, sizes, parcel prices, prohibited terms, all fees and policies; full audit log; tax report export | – |
| Help & legal | Searchable help centre, contact form, terms, privacy, cookies (with consent banner + consent records), Buyer Protection terms, prohibited items, catalogue rules, accessibility statement, illegal content notice form (DSA / Online Safety Act), seller income records & HMRC/DAC7 report | – (lawyer review needed) |
| Quality | Mobile-first, WCAG 2.2 AA (axe-tested), CSP and security headers, server-side validation everywhere, verified Stripe webhooks, no card data stored, sitemap, robots, JSON-LD for products/profiles/articles | – |

## Tech stack and why

| Choice | Reason |
| --- | --- |
| **Next.js 16 + React 19** | Server rendering for speed and SEO; server actions keep validation on the server. |
| **PostgreSQL + Prisma 7** | Relational data (orders, ledger) needs transactions. Trigram (`pg_trgm`) search avoids running a separate search service at launch. |
| **Better Auth** (instead of Auth.js) | First-class email/password with verification, reset, account linking, bans/suspensions and rate limiting – Auth.js discourages credentials auth. |
| **Supabase** | One account for managed Postgres (London), file storage and realtime. Vercel can't hold websockets open, so a managed realtime service is required. |
| **Stripe Connect** (separate charges & transfers) | The buyer pays the platform; money is held until the order completes, then credited to the seller's wallet. Stripe handles seller KYC (ID verification) and bank payouts. |
| **Shippo** behind a carrier adapter | One API for multiple UK carriers. The adapter (`src/lib/carriers`) lets you add/swap carriers (e.g. direct Evri/InPost APIs) without touching the order flow. |
| **Resend** | Simple transactional email; templates are plain, accessible HTML. |
| **Upstash Redis** (optional) | Fast global rate limiting. Without it, rate limits use Postgres. |

## Running locally

### Prerequisites

- **Node.js 22 LTS** and **Git**. (On this PC they were installed as portable copies in `%USERPROFILE%\tools` because the Windows installer needed an admin prompt. Either install them normally, or add them to `PATH` in each terminal:
  `$env:PATH="$env:USERPROFILE\tools\node-v22.23.3-win-x64;$env:USERPROFILE\tools\mingit\cmd;$env:PATH"`)
- No Docker needed – a real Postgres server runs from `node_modules` via `embedded-postgres`.

### First run

```bash
npm install
cp .env.example .env          # then generate secrets – see below
npm run db:local              # terminal 1: starts Postgres on port 5433 (leave running)
npx prisma migrate deploy     # terminal 2
npm run db:seed               # catalogue + 12 sample members + 50 listings
npm run dev                   # http://localhost:3000
```

Generate local secrets for `.env`:

```bash
node -e "console.log('BETTER_AUTH_SECRET='+require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log('DATA_ENCRYPTION_KEY='+require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log('CRON_SECRET='+require('crypto').randomBytes(24).toString('hex'))"
```

**Sample accounts** (all use the test password `passalong-demo-pass`): `admin@passalong.test` (admin), `moderator@passalong.test`, `amelia@passalong.test`, `raj@passalong.test`, `priya@passalong.test` and more in `prisma/seed-data/sample.ts`.

**Emails in development** aren't sent – they're written to `./.emails/*.json` (open the file to get verification and reset links). Uploaded photos go to `./.uploads`.

### Useful scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run db:local` | Local Postgres (port 5433) |
| `npm run db:migrate` | Create & apply a migration after editing `prisma/schema.prisma` |
| `npm run db:seed` | Seed catalogue (+ sample data outside production) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Unit + integration tests |
| `npm run test:e2e` | Playwright end-to-end + accessibility tests |

## Testing

- **Unit tests** (`tests/unit`): fees, bundle maths, money parsing, prohibited-term matching, off-platform message detection, safe redirects.
- **Integration tests** (`tests/integration`) run against a real Postgres database (`passalong_test`): payments and orders (checkout, payment webhook idempotency, race-condition refunds, bundles, offers, release, withdrawals, refunds, cancellations, webhook signature verification), offers, messaging, disputes and returns, reviews, listings and moderation, admin permissions, GDPR erasure/export.
  Stripe's API is replaced by an in-memory fake, but webhook signatures are checked with the real Stripe library.
- **End-to-end** (`tests/e2e`): sign-up → email confirmation → onboarding; password reset; seller lists an item with a photo → buyer searches, messages, makes an offer → seller accepts → buyer checks out at the offer price. If Stripe test keys are set, it also pays with Stripe's test card.
- **Accessibility**: axe-core scans of key pages on desktop and a phone viewport, against WCAG 2.2 AA rules.

CI (`.github/workflows/ci.yml`) runs lint, type check, unit/integration tests, a production build and the e2e/a11y suite on every push and pull request.

## Project structure

```
prisma/                 schema, migrations, seed (+ seed-data: catalogue, sample, help)
src/app/                routes (pages, server actions, API routes, webhooks, cron)
  (auth)/               sign-up, login, verify, reset
  admin/                admin dashboard + server actions
  api/webhooks/         stripe, shippo
  api/cron/run-all      every scheduled job (called by Vercel Cron)
src/components/         UI (design system lives in src/app/globals.css)
src/lib/                domain logic – orders, offers, wallet, payouts, shipping, disputes,
                        reviews, moderation, fraud, enforcement, notifications, search …
src/content/legal.ts    legal page drafts
tests/                  unit, integration, e2e
```

## How money moves

1. Buyer pays the **total** (item + postage + Buyer Protection) to the platform's Stripe account. The order is only marked paid when Stripe's signed webhook confirms it.
2. The seller's earnings are recorded as **pending** in an append-only ledger (`LedgerEntry`); balances are always computed from the ledger.
3. When the buyer confirms, or 2 days after delivery with no problem reported, earnings move to **available**.
4. A seller withdraws: we transfer from the platform balance to their Stripe connected account and trigger a payout to their bank. Stripe verifies the seller's identity before their first withdrawal.
5. Refunds come out of held (pending) earnings; disputes freeze release until resolved.

## Deploying

You need these accounts (all have free tiers to start, except Apple). **Never paste keys into chat or commit them** – put them in Vercel's environment variables.

### 1. GitHub
Create an empty repository and push:
```bash
git remote add origin https://github.com/<you>/passalong.git
git push -u origin main
```

### 2. Supabase (database, storage, realtime)
1. Create a project in the **London (eu-west-2)** region.
2. *Project Settings → Database → Connection string*: copy the **Transaction pooler** URL (port 6543) → `DATABASE_URL` (add `?pgbouncer=true`), and the **direct** URL (port 5432) → `DIRECT_DATABASE_URL`.
3. *Database → Extensions*: enable `pg_trgm` (the first migration also tries to).
4. *Storage*: create a **public** bucket `listing-photos` and a **private** bucket `private-uploads`.
5. *Project Settings → API*: copy the URL → `NEXT_PUBLIC_SUPABASE_URL`, the anon key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`, the service role key → `SUPABASE_SERVICE_ROLE_KEY` (server only!). Set `LOCAL_UPLOADS=false`.
6. From your machine, run migrations and seed the catalogue (no sample users):
   ```bash
   DATABASE_URL="<direct url>" npx prisma migrate deploy
   DATABASE_URL="<direct url>" SEED_SAMPLE=false NODE_ENV=production npx prisma db seed
   ```

### 3. Stripe (test mode)
1. Create an account, stay in **Test mode**, then *Connect → Get started* and choose a **platform/marketplace** with **Express** accounts in the UK.
2. *Developers → API keys*: `STRIPE_SECRET_KEY` (sk_test_…) and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (pk_test_…).
3. *Developers → Webhooks*: add an endpoint `https://<your-domain>/api/webhooks/stripe` for events
   `payment_intent.succeeded`, `payment_intent.payment_failed`, `refund.created`, `refund.updated`, `charge.dispute.created` → signing secret = `STRIPE_WEBHOOK_SECRET`.
4. Add a second endpoint for **Connected accounts** with `account.updated`, `payout.paid`, `payout.failed` → `STRIPE_CONNECT_WEBHOOK_SECRET`.
5. *Settings → Payment methods*: enable cards, Apple Pay and Google Pay. For Apple Pay, register your domain under *Payment method domains*.
6. Local webhook testing: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

### 4. Resend (email)
Add and verify your sending domain (DNS records), create an API key → `RESEND_API_KEY`, set `EMAIL_FROM` and `SUPPORT_EMAIL`.

### 5. Shippo (labels & tracking)
Create a test API key → `SHIPPO_API_KEY`. Connect the UK carriers you want (e.g. Evri, InPost, Royal Mail, DPD) in the Shippo dashboard. Add a tracking webhook to `https://<your-domain>/api/webhooks/shippo?token=<SHIPPO_WEBHOOK_SECRET>` (choose any long random secret).

### 6. Optional services
- **Upstash Redis** → `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- **Web push**: `npx web-push generate-vapid-keys` → `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.
- **Google sign-in**: Google Cloud Console → OAuth client (Web) with redirect URI `https://<your-domain>/api/auth/callback/google` → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- **Apple sign-in** (needs a paid Apple Developer account): Services ID + key; redirect `https://<your-domain>/api/auth/callback/apple`; generate the client secret JWT → `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`.

### 7. Vercel
1. *Add New → Project* → import the GitHub repo (framework: Next.js; region is pinned to London by `vercel.json`).
2. Add every variable from [Environment variables](#environment-variables) for **Production** (and Preview, with test keys).
3. Deploy. Vercel Cron calls `/api/cron/run-all` every 15 minutes with `Authorization: Bearer $CRON_SECRET` (set `CRON_SECRET` in Vercel – it's sent automatically). Sub-hourly crons need a Vercel **Pro** plan; on Hobby, change the schedule in `vercel.json` to daily.
4. Make yourself an admin: sign up on the live site, then in Supabase's SQL editor run
   `update "user" set role = 'admin' where email = 'you@example.com';`

## Custom domain

1. Buy the domain (e.g. `passalong.co.uk` – first check it's available and run a UK IPO trademark search on the name).
2. Vercel → Project → *Settings → Domains* → add `passalong.co.uk` and `www.passalong.co.uk`; follow the DNS instructions (an `A` record to Vercel for the apex, `CNAME` for `www`). HTTPS is automatic.
3. Set `NEXT_PUBLIC_SITE_URL=https://passalong.co.uk` and redeploy.
4. Update the domain in: Stripe webhooks + Apple Pay domains, Shippo webhook, Google/Apple OAuth redirect URIs, Resend sending domain.
5. Submit `https://passalong.co.uk/sitemap.xml` in Google Search Console.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | ✅ | Public URL, no trailing slash |
| `DATABASE_URL` | ✅ | Postgres (pooled) |
| `DIRECT_DATABASE_URL` | ✅ prod | Direct Postgres URL for migrations |
| `BETTER_AUTH_SECRET` | ✅ | Session signing secret (32+ random bytes) |
| `DATA_ENCRYPTION_KEY` | ✅ | 32-byte base64 key encrypting tax IDs |
| `CRON_SECRET` | ✅ | Authenticates Vercel Cron |
| `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ for payments | Stripe API keys (test mode) |
| `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET` | ✅ for payments | Webhook signing secrets |
| `STRIPE_LIVE_MODE_APPROVED` | – | Must be `true` before `sk_live_` keys are accepted |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | ✅ prod | Storage + realtime |
| `SUPABASE_PUBLIC_BUCKET`, `SUPABASE_PRIVATE_BUCKET` | – | Bucket names (defaults `listing-photos`, `private-uploads`) |
| `LOCAL_UPLOADS` | – | `true` = store uploads on local disk (dev only) |
| `RESEND_API_KEY`, `EMAIL_FROM`, `SUPPORT_EMAIL` | ✅ prod | Email |
| `SHIPPO_API_KEY`, `SHIPPO_WEBHOOK_SECRET` | for labels | Shipping |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | – | Web push |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | – | Rate limiting |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | – | Google sign-in |
| `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`, `APPLE_APP_BUNDLE_IDENTIFIER` | – | Apple sign-in |

Integrations without keys show a clear “not set up yet” state rather than pretending to work.

## Going live checklist

- [ ] Solicitor reviews every page under `/legal` (they're marked DRAFT) and fills the `[PLACEHOLDERS]` (company name/number/address, ICO number).
- [ ] Register with the **ICO** (data protection fee).
- [ ] Register with **HMRC** as a reporting platform operator (Reporting Rules for Digital Platforms) and confirm the report format (`/admin/tax`).
- [ ] Confirm with Stripe that your Connect setup (held funds, separate charges & transfers) is approved for your business model.
- [ ] Decide trader-seller handling (business sellers have extra consumer-law obligations).
- [ ] Independent accessibility audit; record results in the accessibility statement.
- [ ] Load test search and the home feed with realistic data volumes.
- [ ] Switch Stripe to live keys **only after you approve it**, and set `STRIPE_LIVE_MODE_APPROVED=true`.

## Known limitations and TODOs

These are deliberate, honest gaps – nothing below is faked in the UI:

- **Pick-up point delivery** is shown as “coming soon”: choosing lockers/ParcelShops needs a carrier-specific locations API.
- **Shippo carrier selection** currently picks the cheapest GBP rate; restrict to your contracted carriers once linked (`src/lib/carriers/shippo.ts`).
- **Collection booking** depends on carrier support; unsupported carriers show a clear message.
- **UK bank holidays** aren't excluded from “post within 5 working days” yet (`src/lib/time.ts`).
- **Trending searches** aren't shown – they'd need search logging, which isn't implemented.
- **Analytics/marketing cookies**: the consent banner records choices, but no analytics provider is installed.
- **Search** uses Postgres trigram matching; move to Meilisearch/Typesense if the catalogue grows past a few hundred thousand items.
- **Dev dependency advisory**: `npm audit` flags transitive packages of the Prisma CLI (development-only tooling, not shipped to the site).

## Launch decisions

Set for the UK launch and editable in **Admin → Fees & policies**:

| Setting | Value |
| --- | --- |
| Currency / language | GBP, British English |
| Buyer Protection | £0.75 + 5% of item price (shown in the headline price, per the DMCC Act 2024 drip-pricing rules) |
| Seller commission | 0% |
| Postage | Small £2.99 · Medium £4.49 · Large £6.99 |
| Bump / spotlight | £0.99 for 3 days / £5.99 for 7 days (spotlight needs 5+ live items) |
| Offers | Minimum 60% of price; expire after 48 hours |
| Shipping deadline | 5 working days, then auto-cancel and refund |
| Funds release / problem window | 2 days after delivery |
| Seller response to a problem | 2 days, then escalated to support |
| Automatic feedback | 7 days after buyer confirmation |
| Minimum withdrawal | £1 |
| Tax reporting threshold | 30 sales or £1,700 per calendar year |
| Fraud hold | New accounts (< 7 days) listing items ≥ £500 go to review |
