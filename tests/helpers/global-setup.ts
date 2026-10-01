import { execSync } from "node:child_process";

export const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/passalong_test";

/** Applies migrations to the test database once per run. */
export default function setup() {
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: TEST_DB, DIRECT_DATABASE_URL: "" } });
}
