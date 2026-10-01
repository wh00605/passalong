import { afterAll, beforeAll, vi } from "vitest";

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/passalong_test";
process.env.DISABLE_RATE_LIMIT = "true";
process.env.LOCAL_UPLOADS = "true";
process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret";
process.env.CRON_SECRET = "test-cron-secret";

// Next.js request-scoped APIs aren't available in plain Node tests.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), updateTag: vi.fn(), refresh: vi.fn(), unstable_cache: <T>(fn: T) => fn }));

beforeAll(async () => {
  const { resetDatabase } = await import("./factories");
  await resetDatabase();
});

afterAll(async () => {
  const { db } = await import("@/lib/db");
  await db.$disconnect();
});
