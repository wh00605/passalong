# Passalong – build progress

All ten phases are built and tested locally. See README.md for setup, testing and deployment.

| Phase | Status |
| --- | --- |
| 1. Auth & profiles | ✅ Done |
| 2. Listings & search | ✅ Done |
| 3. Messaging | ✅ Done (real-time via Supabase when configured, polling otherwise) |
| 4. Checkout, payments, wallet | ✅ Code complete & tested with a Stripe fake – needs Stripe test keys to take real test payments |
| 5. Shipping | ✅ Code complete – needs Shippo key for real labels; manual tracking works without it |
| 6. Reviews & disputes | ✅ Done |
| 7. Trust & safety | ✅ Done |
| 8. Admin | ✅ Done |
| 9. Legal & help | ✅ Done – legal pages are DRAFTS for a solicitor |
| 10. Deployment | ⏳ CI, README and deploy guide done; actual deployment waits for your accounts |

Tests: 101 unit/integration, 29 e2e + accessibility (desktop and mobile), lint and type check clean, production build passes.

## Waiting on you
1. GitHub repo, Vercel, Supabase (London), Stripe (test mode + Connect) – then follow README → Deploying.
2. Optional: Resend, Shippo, Upstash, Google OAuth, Apple Developer.
3. Solicitor review of /legal pages; ICO and HMRC registrations.
