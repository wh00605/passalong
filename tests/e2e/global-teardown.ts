import { execSync } from "node:child_process";

/** Hides listings created by e2e runs so they don't clutter the local development feed. */
export default function teardown() {
  if (process.env.CI) return;
  execSync("npx tsx scripts/hide-e2e-listings.ts", { stdio: "inherit" });
}
