import "server-only";
import { db } from "@/lib/db";

/**
 * Everything we hold about a member, for UK GDPR Art. 15 (access) and Art. 20 (portability).
 * Secrets (password hashes, OAuth tokens, encrypted tax IDs) are deliberately excluded.
 */
export async function buildDataExport(userId: string) {
  const [
    user, addresses, listings, favourites, savedSearches, follows, followers, blocks, ordersBought, ordersSold,
    messages, reviewsWritten, reviewsReceived, offers, notifications, prefs, consents, reports, ledger, payouts, taxProfile, accounts, sessions,
  ] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, emailVerified: true, username: true, bio: true, location: true, image: true,
        createdAt: true, lastActiveAt: true, holidayMode: true, showOnlineStatus: true, allowPersonalisation: true,
        allowSearchIndexing: true, preferredBrandIds: true, preferredSizeIds: true, ratingAvg: true, ratingCount: true,
        identityVerifiedAt: true, bundleDiscountsEnabled: true,
      },
    }),
    db.address.findMany({ where: { userId } }),
    db.listing.findMany({ where: { sellerId: userId }, include: { photos: { select: { storageKey: true, position: true } }, priceHistory: true } }),
    db.favourite.findMany({ where: { userId } }),
    db.savedSearch.findMany({ where: { userId } }),
    db.follow.findMany({ where: { followerId: userId }, select: { following: { select: { username: true } }, createdAt: true } }),
    db.follow.count({ where: { followingId: userId } }),
    db.block.findMany({ where: { blockerId: userId }, select: { blocked: { select: { username: true } }, createdAt: true } }),
    db.order.findMany({ where: { buyerId: userId }, include: { items: true, shipments: { include: { events: true } }, refunds: true } }),
    db.order.findMany({ where: { sellerId: userId }, include: { items: true, shipments: true, refunds: true } }),
    db.message.findMany({ where: { senderId: userId }, select: { id: true, conversationId: true, type: true, body: true, createdAt: true } }),
    db.review.findMany({ where: { authorId: userId } }),
    db.review.findMany({ where: { subjectId: userId } }),
    db.offer.findMany({ where: { createdById: userId } }),
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 1000 }),
    db.notificationPreference.findMany({ where: { userId } }),
    db.consentRecord.findMany({ where: { userId } }),
    db.report.findMany({ where: { reporterId: userId }, select: { targetType: true, reason: true, details: true, status: true, createdAt: true } }),
    db.ledgerEntry.findMany({ where: { userId } }),
    db.payout.findMany({ where: { userId } }),
    db.sellerTaxProfile.findUnique({ where: { userId }, select: { sellerType: true, legalName: true, dateOfBirth: true, companyNumber: true, addressLine1: true, addressLine2: true, city: true, postcode: true, country: true } }),
    db.account.findMany({ where: { userId }, select: { providerId: true, createdAt: true } }),
    db.session.findMany({ where: { userId }, select: { createdAt: true, expiresAt: true, ipAddress: true, userAgent: true } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    notice: "This file contains the personal data Passalong holds about you. Passwords and security tokens are not included.",
    profile: user,
    signInMethods: accounts,
    activeSessions: sessions,
    addresses,
    listings,
    favourites,
    savedSearches,
    following: follows,
    followerCount: followers,
    blocked: blocks,
    purchases: ordersBought,
    sales: ordersSold,
    messagesSent: messages,
    reviewsWritten,
    reviewsReceived,
    offersMade: offers,
    notifications,
    notificationPreferences: prefs,
    consentRecords: consents,
    reportsMade: reports,
    wallet: { ledger, payouts },
    taxProfile,
  };
}
