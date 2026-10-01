import { db } from "@/lib/db";
import { NotificationType } from "@/generated/prisma/enums";

let n = 0;
const uid = () => `${Date.now().toString(36)}${(n++).toString(36)}`;

/** Truncates every application table (keeps the schema and migrations table). */
export async function resetDatabase() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  }
}

export async function createUser(overrides: Partial<{ name: string; username: string; email: string; role: string; createdAt: Date; holidayMode: boolean }> = {}) {
  const id = crypto.randomUUID();
  const u = uid();
  return db.user.create({
    data: {
      id,
      name: overrides.name ?? `Test ${u}`,
      username: overrides.username ?? `user_${u}`.slice(0, 20),
      email: overrides.email ?? `${u}@example.test`,
      emailVerified: true,
      role: overrides.role ?? "user",
      createdAt: overrides.createdAt,
      holidayMode: overrides.holidayMode ?? false,
      notificationPrefs: { create: Object.values(NotificationType).map((type) => ({ type, inApp: true, email: false, push: false })) },
    },
  });
}

export async function createCatalogue() {
  const parcel = await db.parcelSize.upsert({
    where: { code: "SMALL" },
    create: { code: "SMALL", name: "Small", description: "", maxWeightGrams: 2000, lengthCm: 45, widthCm: 35, heightCm: 16, pricePence: 299 },
    update: {},
  });
  const root = await db.category.upsert({ where: { path: "women" }, create: { name: "Women", slug: "women", path: "women" }, update: {} });
  const leaf = await db.category.upsert({
    where: { path: "women/dresses" },
    create: { name: "Dresses", slug: "dresses", path: "women/dresses", parentId: root.id },
    update: {},
  });
  return { parcel, category: leaf };
}

export async function createListing(sellerId: string, overrides: Partial<{ title: string; pricePence: number; status: "ACTIVE" | "DRAFT" | "SOLD" | "RESERVED" }> = {}) {
  const { parcel, category } = await createCatalogue();
  const title = overrides.title ?? `Item ${uid()}`;
  return db.listing.create({
    data: {
      sellerId,
      title,
      description: "A test item in good condition.",
      categoryId: category.id,
      condition: "GOOD",
      pricePence: overrides.pricePence ?? 2000,
      parcelSizeId: parcel.id,
      status: overrides.status ?? "ACTIVE",
      publishedAt: new Date(),
      searchText: title.toLowerCase(),
    },
  });
}
