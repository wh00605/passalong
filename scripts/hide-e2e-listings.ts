// Hides listings created by end-to-end test runs (development only).
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

db.listing
  .updateMany({ where: { title: { startsWith: "E2E " }, seller: { email: { endsWith: "@passalong.test" } } }, data: { status: "DELETED" } })
  .then((r) => console.log(`Hid ${r.count} e2e listings`))
  .finally(() => db.$disconnect());
