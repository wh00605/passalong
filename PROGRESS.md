# Passalong – build progress

## Decisions (UK launch, all editable at /admin/fees once built)
GBP, en-GB. Buyer Protection £0.75 + 5%. Seller commission 0%. Shipping S/M/L £2.99/£4.49/£6.99.
Bump £0.99 for 3 days; wardrobe spotlight £5.99 for 7 days. Min offer 60%, offers expire after 48h.
Ship within 5 working days or auto-cancel. Funds released / problem window: 2 days after delivery. Auto-feedback after 7 days.
Min withdrawal £1. HMRC/DAC7 flag: 30 sales or £1,700 a year. Prices shown include Buyer Protection (DMCC Act 2024).
Stack changes: Better Auth instead of Auth.js (better email/password, verification, reset and ban support); Postgres trigram search; local Postgres via embedded-postgres (no Docker on this PC).

## Local setup on this PC
Node 22 and Git are portable installs in `%USERPROFILE%\tools` (not on PATH). In PowerShell:
`$env:PATH="$env:USERPROFILE\tools\node-v22.23.3-win-x64;$env:USERPROFILE\tools\mingit\cmd;$env:PATH"`
then `npm run db:local` (separate terminal), `npx prisma migrate deploy`, `npm run db:seed`, `npm run dev`.
Seeded accounts: `*@passalong.test`, password `passalong-demo-pass` (admin: admin@passalong.test).

## Phase 1 – auth and profiles (in progress)
Done: full database schema for all phases, seed data (catalogue, 12 members, 50 listings, help articles),
security headers/CSP, design system, header/footer/search box, cookie banner with consent records,
sign-up, login, email verification, password reset, Google/Apple (shown only when keys are set),
rate limiting, email (dev mode writes to ./.emails), file storage + image processing,
notifications library, follow/block/report actions, fraud signal helpers, home feed, listing cards, favourites.
Not yet built: /welcome, /members/[username], /settings/*, data export and account deletion, /api/search/suggest.
No tests written yet.

## Next phases
2 listings and search, 3 messaging, 4 checkout/payments/wallet, 5 shipping, 6 reviews/disputes,
7 trust and safety, 8 admin, 9 legal/help, 10 deployment + CI + README.
