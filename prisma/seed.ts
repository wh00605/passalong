/* eslint-disable no-console */
// Seeds reference data (always) and sample members/listings (development only).
//   npx prisma db seed            → catalogue + settings + sample data if the DB has no members
//   SEED_SAMPLE=false npx prisma db seed → catalogue only (safe for production)
import "dotenv/config";
import sharp from "sharp";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { slugify } from "../src/lib/slug";
import { buildSearchText } from "../src/lib/search-text";
import { processAndStoreImage } from "../src/lib/images";
import { DEFAULT_SETTINGS } from "../src/lib/settings-defaults";
import {
  BRANDS, CATEGORY_TREE, COLOURS, MATERIALS, PARCEL_SIZES, PROHIBITED_TERMS, SIZE_GROUPS, type CategorySeed,
} from "./seed-data/catalogue";
import { DEMO_PASSWORD, SAMPLE_LISTINGS, SAMPLE_USERS } from "./seed-data/sample";
import { HELP_ARTICLES } from "./seed-data/help";
import { NotificationType } from "../src/generated/prisma/enums";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function seedCatalogue() {
  const groupIds = new Map<string, string>();
  for (const [name, labels] of Object.entries(SIZE_GROUPS)) {
    const group = await db.sizeGroup.upsert({ where: { name }, create: { name }, update: {} });
    groupIds.set(name, group.id);
    for (const [position, label] of labels.entries()) {
      await db.size.upsert({
        where: { groupId_label: { groupId: group.id, label } },
        create: { groupId: group.id, label, position },
        update: { position },
      });
    }
  }

  async function walk(nodes: CategorySeed[], parent: { id: string; path: string } | null, inheritedGroup?: string) {
    for (const [position, node] of nodes.entries()) {
      const slug = slugify(node.name);
      const path = parent ? `${parent.path}/${slug}` : slug;
      const groupName = node.sizeGroup ?? inheritedGroup;
      const sizeGroupId = groupName ? groupIds.get(groupName) : undefined;
      const cat = await db.category.upsert({
        where: { path },
        create: { name: node.name, slug, path, position, parentId: parent?.id, sizeGroupId, isProhibited: !!node.prohibited },
        update: { name: node.name, position, sizeGroupId: sizeGroupId ?? null, isProhibited: !!node.prohibited },
      });
      if (node.children) await walk(node.children, { id: cat.id, path }, groupName);
    }
  }
  await walk(CATEGORY_TREE, null);

  for (const name of BRANDS) {
    await db.brand.upsert({ where: { name }, create: { name, slug: slugify(name) }, update: {} });
  }
  for (const [name, hex] of COLOURS) {
    await db.colour.upsert({ where: { name }, create: { name, slug: slugify(name), hex }, update: { hex } });
  }
  for (const name of MATERIALS) {
    await db.material.upsert({ where: { name }, create: { name, slug: slugify(name) }, update: {} });
  }
  for (const p of PARCEL_SIZES) {
    await db.parcelSize.upsert({ where: { code: p.code }, create: p, update: p });
  }
  for (const t of PROHIBITED_TERMS) {
    await db.prohibitedTerm.upsert({ where: { term: t.term }, create: t, update: { severity: t.severity, note: t.note } });
  }
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.platformSetting.upsert({ where: { key }, create: { key, value }, update: {} });
  }
  for (const a of HELP_ARTICLES) {
    await db.helpArticle.upsert({ where: { slug: a.slug }, create: a, update: { title: a.title, body: a.body, category: a.category } });
  }
  console.log("✓ Catalogue, settings and help articles");
}

function sampleImageSvg(title: string, hex: string, index: number) {
  const words = title.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > 18) {
      lines.push(line.trim());
      line = w;
    } else line += " " + w;
  }
  lines.push(line.trim());
  const text = lines
    .slice(0, 4)
    .map((l, i) => `<text x="400" y="${470 + i * 64}" font-size="52" font-family="Arial, sans-serif" font-weight="700" text-anchor="middle" fill="#1c1a24">${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`)
    .join("");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hex}" stop-opacity="0.55"/><stop offset="1" stop-color="#faf8f5"/></linearGradient></defs>
  <rect width="800" height="1000" fill="url(#g)"/>
  <rect x="80" y="160" width="640" height="680" rx="40" fill="#ffffff" fill-opacity="0.75"/>
  <circle cx="400" cy="320" r="70" fill="${hex}" stroke="#1c1a24" stroke-width="4"/>
  ${text}
  <text x="400" y="790" font-size="30" font-family="Arial, sans-serif" text-anchor="middle" fill="#55515f">Sample photo ${index + 1}</text>
</svg>`);
}

async function seedSample() {
  const existing = await db.user.count();
  if (existing > 0) {
    console.log("• Members already exist – skipping sample data");
    return;
  }

  const hash = await hashPassword(DEMO_PASSWORD);
  const userIds = new Map<string, string>();
  for (const u of SAMPLE_USERS) {
    const id = crypto.randomUUID();
    await db.user.create({
      data: {
        id,
        name: u.name,
        email: u.email,
        emailVerified: true,
        username: u.username,
        role: "role" in u ? u.role : "user",
        location: u.location,
        bio: "bio" in u ? u.bio : null,
        lastActiveAt: new Date(Date.now() - Math.random() * 3 * 86_400_000),
        avgResponseMinutes: 30 + Math.floor(Math.random() * 300),
        createdAt: new Date(Date.now() - (60 + Math.random() * 600) * 86_400_000),
        accounts: { create: { id: crypto.randomUUID(), accountId: id, providerId: "credential", password: hash } },
        notificationPrefs: {
          create: Object.values(NotificationType).map((type) => ({
            type, inApp: type !== "MARKETING", email: type !== "MARKETING", push: type !== "MARKETING",
          })),
        },
      },
    });
    userIds.set(u.username, id);
  }

  const categories = await db.category.findMany();
  const byPath = new Map(categories.map((c) => [c.path, c]));
  const byId = new Map(categories.map((c) => [c.id, c]));
  const brands = new Map((await db.brand.findMany()).map((b) => [b.name, b.id]));
  const colours = new Map((await db.colour.findMany()).map((c) => [c.name, c]));
  const materials = new Map((await db.material.findMany()).map((m) => [m.name, m.id]));
  const parcels = new Map((await db.parcelSize.findMany()).map((p) => [p.code, p.id]));
  const sizes = await db.size.findMany();

  for (const [i, l] of SAMPLE_LISTINGS.entries()) {
    const category = byPath.get(l.category);
    if (!category) throw new Error(`Unknown category ${l.category}`);
    const names: string[] = [];
    for (let c: typeof category | undefined = category; c; c = c.parentId ? byId.get(c.parentId) : undefined) names.unshift(c.name);
    const size = l.size ? sizes.find((s) => s.label === l.size && s.groupId === category.sizeGroupId) ?? sizes.find((s) => s.label === l.size) : undefined;
    const sellerId = userIds.get(l.seller)!;
    const publishedAt = new Date(Date.now() - i * 3_600_000 * 5);

    const photoCount = 2 + (i % 3);
    const photos = [];
    for (let p = 0; p < photoCount; p++) {
      const png = await sharp(sampleImageSvg(l.title, colours.get(l.colours[0])?.hex ?? "#999999", p)).jpeg().toBuffer();
      photos.push({ ...(await processAndStoreImage(png, { prefix: `listings/${sellerId}`, visibility: "public" })), position: p, uploaderId: sellerId });
    }

    await db.listing.create({
      data: {
        sellerId,
        title: l.title,
        description: l.description,
        categoryId: category.id,
        brandId: l.brand ? brands.get(l.brand) : undefined,
        sizeId: size?.id,
        condition: l.condition,
        materialId: l.material ? materials.get(l.material) : undefined,
        pricePence: l.pricePence,
        parcelSizeId: parcels.get(l.parcel),
        status: "ACTIVE",
        publishedAt,
        createdAt: publishedAt,
        colours: { connect: l.colours.map((c) => ({ id: colours.get(c)!.id })) },
        photos: { create: photos },
        priceHistory: { create: { pricePence: l.pricePence, createdAt: publishedAt } },
        searchText: buildSearchText({
          title: l.title, description: l.description, brand: l.brand, categoryNames: names,
          colours: l.colours, material: l.material, size: l.size,
        }),
      },
    });
  }

  // A few follows so profiles have counts.
  const follows: [string, string][] = [
    ["priya_buys", "amelia_wardrobe"], ["priya_buys", "graceful_closet"], ["priya_buys", "rajsneakers"],
    ["olliebrooks", "rajsneakers"], ["amelia_wardrobe", "shiv_vintage"], ["hannahlew", "shiv_vintage"],
  ];
  for (const [a, b] of follows) {
    await db.follow.create({ data: { followerId: userIds.get(a)!, followingId: userIds.get(b)! } });
  }
  for (const [username, id] of userIds) {
    void username;
    const [followers, following] = await Promise.all([
      db.follow.count({ where: { followingId: id } }),
      db.follow.count({ where: { followerId: id } }),
    ]);
    await db.user.update({ where: { id }, data: { followerCount: followers, followingCount: following } });
  }

  // Bundle discounts for one seller.
  await db.user.update({ where: { id: userIds.get("shiv_vintage")! }, data: { bundleDiscountsEnabled: true } });
  await db.bundleDiscountTier.createMany({
    data: [
      { sellerId: userIds.get("shiv_vintage")!, minItems: 2, percentOff: 10 },
      { sellerId: userIds.get("shiv_vintage")!, minItems: 3, percentOff: 15 },
      { sellerId: userIds.get("shiv_vintage")!, minItems: 5, percentOff: 20 },
    ],
  });

  console.log(`✓ ${SAMPLE_USERS.length} sample members (password: ${DEMO_PASSWORD}) and ${SAMPLE_LISTINGS.length} listings`);
}

async function main() {
  await seedCatalogue();
  if (process.env.SEED_SAMPLE !== "false" && process.env.NODE_ENV !== "production") await seedSample();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
