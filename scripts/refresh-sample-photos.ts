// Development helper: regenerates the illustrated photos for seeded sample listings and hides
// listings created by end-to-end test runs. Never touches real (non-@passalong.test) members.
//   npx tsx scripts/refresh-sample-photos.ts
import "dotenv/config";
import sharp from "sharp";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { processAndStoreImage } from "../src/lib/images";
import { SAMPLE_LISTINGS } from "../prisma/seed-data/sample";
import { kindFor, stillLifeSvg } from "../prisma/seed-data/art";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Development only");
  const hidden = await db.listing.updateMany({
    where: { title: { startsWith: "E2E " }, seller: { email: { endsWith: "@passalong.test" } } },
    data: { status: "DELETED" },
  });
  console.log(`Hid ${hidden.count} e2e test listings`);

  const colours = new Map((await db.colour.findMany()).map((c) => [c.name, c.hex]));
  for (const [i, s] of SAMPLE_LISTINGS.entries()) {
    const listing = await db.listing.findFirst({ where: { title: s.title, seller: { username: s.seller } }, include: { photos: true } });
    if (!listing) continue;
    const photos = [];
    for (let p = 0; p < Math.max(2, Math.min(listing.photos.length, 4)); p++) {
      const svg = stillLifeSvg({ kind: kindFor(s.category, s.title), hex: colours.get(s.colours[0]) ?? "#8c857c", seed: i, angle: p });
      const jpg = await sharp(svg).jpeg({ quality: 90 }).toBuffer();
      photos.push({ ...(await processAndStoreImage(jpg, { prefix: `listings/${listing.sellerId}`, visibility: "public" })), position: p, uploaderId: listing.sellerId });
    }
    await db.$transaction([
      db.listingPhoto.deleteMany({ where: { listingId: listing.id } }),
      db.listingPhoto.createMany({ data: photos.map((ph) => ({ ...ph, listingId: listing.id })) }),
    ]);
  }
  console.log(`Refreshed photos for ${SAMPLE_LISTINGS.length} sample listings`);
}

main().finally(() => db.$disconnect());
