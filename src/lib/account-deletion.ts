import "server-only";
import { db } from "@/lib/db";
import { deleteObjects } from "@/lib/storage";
import { PHOTO_WIDTHS } from "@/lib/images";

/**
 * Erases a member (UK GDPR Art. 17) while keeping records we must retain:
 * orders, payments, refunds and tax records (6 years, HMRC / Companies Act).
 * The user row is anonymised rather than deleted because orders reference it.
 */
export async function eraseAccount(userId: string) {
  const short = userId.slice(0, 8);
  const listings = await db.listing.findMany({
    where: { sellerId: userId },
    select: { id: true, _count: { select: { orderItems: true } }, photos: { select: { storageKey: true } } },
  });
  const photoKeys = listings.flatMap((l) => l.photos.flatMap((p) => PHOTO_WIDTHS.map((w) => `${p.storageKey}-${w}.webp`)));
  const deletable = listings.filter((l) => l._count.orderItems === 0).map((l) => l.id);
  const retained = listings.filter((l) => l._count.orderItems > 0).map((l) => l.id);

  await db.$transaction([
    db.listing.deleteMany({ where: { id: { in: deletable } } }),
    db.listing.updateMany({ where: { id: { in: retained } }, data: { status: "DELETED", description: "", searchText: "" } }),
    db.listingPhoto.deleteMany({ where: { listingId: { in: retained } } }),
    db.favourite.deleteMany({ where: { userId } }),
    db.follow.deleteMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } }),
    db.block.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } }),
    db.savedSearch.deleteMany({ where: { userId } }),
    db.listingView.deleteMany({ where: { userId } }),
    db.notification.deleteMany({ where: { userId } }),
    db.pushSubscription.deleteMany({ where: { userId } }),
    db.address.deleteMany({ where: { userId } }),
    db.session.deleteMany({ where: { userId } }),
    db.account.deleteMany({ where: { userId } }),
    db.bundleDiscountTier.deleteMany({ where: { sellerId: userId } }),
    db.message.updateMany({ where: { senderId: userId, type: { in: ["TEXT", "IMAGE"] } }, data: { body: "This message was deleted." } }),
    db.messageAttachment.deleteMany({ where: { message: { senderId: userId } } }),
    db.user.update({
      where: { id: userId },
      data: {
        name: "Deleted member",
        email: `deleted+${userId}@deleted.passalong.invalid`,
        emailVerified: false,
        username: `deleted_${short}`,
        image: null,
        bio: null,
        location: null,
        preferredBrandIds: [],
        preferredSizeIds: [],
        holidayMode: true,
        deletedAt: new Date(),
        stripeCustomerId: null,
      },
    }),
    db.deletionRequest.updateMany({ where: { userId, status: "PENDING" }, data: { status: "COMPLETED", completedAt: new Date() } }),
  ]);

  // Photos for retained (sold) listings are also removed – order history keeps title and price only.
  await deleteObjects(photoKeys, "public").catch((e) => console.error("[erase] photo cleanup", e));
}

export async function processDueDeletions(now = new Date()) {
  const due = await db.deletionRequest.findMany({ where: { status: "PENDING", scheduledFor: { lte: now } }, select: { userId: true } });
  let done = 0;
  for (const d of due) {
    try {
      await eraseAccount(d.userId);
      done++;
    } catch (e) {
      console.error("[erase] failed for", d.userId, e);
    }
  }
  return { processed: done, due: due.length };
}
