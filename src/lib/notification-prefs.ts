import "server-only";
import { db } from "@/lib/db";
import { NotificationType } from "@/generated/prisma/enums";

export const NOTIFICATION_LABELS: Record<NotificationType, { label: string; description: string }> = {
  MESSAGE: { label: "Messages", description: "New chat messages from buyers and sellers" },
  OFFER: { label: "Offers", description: "Offers, counter-offers and replies" },
  ORDER_UPDATE: { label: "Orders", description: "Purchases, sales, payments and refunds" },
  SHIPPING_UPDATE: { label: "Shipping", description: "Labels, tracking and delivery updates" },
  PRICE_DROP: { label: "Price drops", description: "When a favourited item gets cheaper" },
  SAVED_SEARCH_MATCH: { label: "Saved searches", description: "New items matching your saved searches" },
  NEW_FOLLOWER: { label: "Followers", description: "When someone follows you" },
  REVIEW: { label: "Reviews", description: "Reviews left for you and reminders to review" },
  DISPUTE: { label: "Problems with orders", description: "Updates on reported problems and returns" },
  PROMOTION: { label: "Promotions", description: "When your bumps and spotlights start and end" },
  ACCOUNT: { label: "Account and security", description: "Important account notices (email always on)" },
  MARKETING: { label: "News and tips", description: "Occasional news from Passalong" },
};

/** Marketing is opt-in (PECR); everything else defaults on. */
export async function createDefaultNotificationPrefs(userId: string) {
  await db.notificationPreference.createMany({
    data: Object.values(NotificationType).map((type) => ({
      userId,
      type,
      inApp: type !== "MARKETING",
      email: type !== "MARKETING",
      push: type !== "MARKETING",
    })),
    skipDuplicates: true,
  });
}
