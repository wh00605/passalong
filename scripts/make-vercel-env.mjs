// Writes .env.vercel (git-ignored) with everything Vercel needs, ready to paste into
// Vercel → Settings → Environment Variables. Generates fresh secrets. Never prints them.
//   node scripts/make-vercel-env.mjs
import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

if (existsSync(".env.vercel")) {
  console.error(".env.vercel already exists – delete it first if you really want new secrets.");
  process.exit(1);
}

const db = config({ path: ".env.deploy", processEnv: {} }).parsed ?? {};
const pooled = db.DATABASE_URL;
const direct = db.DIRECT_URL || db.DIRECT_DATABASE_URL;
if (!pooled || !direct) {
  console.error("Fill in .env.deploy first.");
  process.exit(1);
}
const ref = new URL(direct).username.split(".")[1];

const lines = [
  "# PRIVATE – paste everything below into Vercel → Settings → Environment Variables.",
  "# Then replace the two PASTE_ME values with the keys from Supabase → Project Settings → API Keys.",
  `DATABASE_URL="${pooled}"`,
  `DIRECT_DATABASE_URL="${direct}"`,
  `BETTER_AUTH_SECRET="${randomBytes(32).toString("base64url")}"`,
  `DATA_ENCRYPTION_KEY="${randomBytes(32).toString("base64")}"`,
  `CRON_SECRET="${randomBytes(24).toString("base64url")}"`,
  ref ? `NEXT_PUBLIC_SUPABASE_URL="https://${ref}.supabase.co"` : `NEXT_PUBLIC_SUPABASE_URL="PASTE_ME"`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY="PASTE_ME"`,
  `SUPABASE_SERVICE_ROLE_KEY="PASTE_ME"`,
  `SUPABASE_PUBLIC_BUCKET="listing-photos"`,
  `SUPABASE_PRIVATE_BUCKET="private-uploads"`,
  `LOCAL_UPLOADS="false"`,
  `STRIPE_LIVE_MODE_APPROVED="false"`,
  `EMAIL_FROM="Passalong <hello@passalong.co.uk>"`,
  `SUPPORT_EMAIL="support@passalong.co.uk"`,
  "",
];
writeFileSync(".env.vercel", lines.join("\n"));
console.log("Wrote .env.vercel (git-ignored). Secrets were not printed.");
