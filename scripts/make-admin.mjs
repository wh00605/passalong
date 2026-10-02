// Marks an account's email as verified and gives it the admin role on the production database.
// Reads the connection string from .env.deploy (git-ignored). Never prints secrets.
//   node scripts/make-admin.mjs you@example.com
import { config } from "dotenv";
import pg from "pg";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/make-admin.mjs you@example.com");
  process.exit(1);
}

const env = config({ path: ".env.deploy", processEnv: {} }).parsed ?? {};
const url = env.DIRECT_URL || env.DIRECT_DATABASE_URL;
if (!url) {
  console.error("Fill in .env.deploy first.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const { rowCount } = await client.query(
    `UPDATE "user" SET "emailVerified" = true, role = 'admin', "updatedAt" = now() WHERE lower(email) = $1`,
    [email],
  );
  console.log(rowCount ? `${email} is now verified and an admin.` : `No account found for ${email} – sign up on the site first.`);
} finally {
  await client.end();
}
