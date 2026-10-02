// Applies migrations and seeds the catalogue (no sample members) on the production database.
// Reads connection strings from .env.deploy (git-ignored). Never prints secrets.
//   node scripts/setup-production-db.mjs
import { config } from "dotenv";
import { execSync } from "node:child_process";

const env = config({ path: ".env.deploy", override: true }).parsed ?? {};
// Accept either our name or Supabase's "DIRECT_URL". Later lines in the file win.
const direct = env.DIRECT_URL || env.DIRECT_DATABASE_URL;
const pooled = env.DATABASE_URL;

if (!direct || !pooled) {
  console.error("Fill in DATABASE_URL and DIRECT_DATABASE_URL in .env.deploy first.");
  process.exit(1);
}
if (/localhost|127\.0\.0\.1/.test(direct)) {
  console.error("DIRECT_DATABASE_URL points at localhost – expected your Supabase database.");
  process.exit(1);
}
if (/[[\]]/.test(direct) || /[[\]]/.test(pooled)) {
  console.error("Remove the [ and ] around the password in .env.deploy (they're placeholders, not part of the password).");
  process.exit(1);
}
try {
  new URL(direct);
  new URL(pooled);
} catch {
  console.error("One of the database addresses in .env.deploy isn't a valid URL – check for missing quotes or stray characters.");
  process.exit(1);
}

const host = new URL(direct).host.replace(/^[^@]*@/, "");
console.log(`Setting up database at ${host} …`);

const run = (cmd, extra) =>
  execSync(cmd, { stdio: "inherit", env: { ...process.env, DATABASE_URL: direct, DIRECT_DATABASE_URL: direct, ...extra } });

run("npx prisma migrate deploy");
run("npx prisma db seed", { SEED_SAMPLE: "false", NODE_ENV: "production" });
console.log("Done: tables created and catalogue (categories, brands, sizes, fees, help articles) seeded. No sample members were added.");
