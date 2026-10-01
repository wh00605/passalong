import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { photoUrl } from "@/lib/storage";
import { ConversationList } from "./conversation-list";
import { InboxShell } from "./inbox-shell";

export const metadata: Metadata = { title: "Inbox", robots: { index: false } };

export default async function InboxLayout({ children }: LayoutProps<"/inbox">) {
  const user = await requireUser("/inbox");
  const conversations = await db.conversation.findMany({
    where: { OR: [{ buyerId: user.id }, { sellerId: user.id }], lastMessageAt: { gt: new Date(0) } },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    select: {
      id: true, buyerId: true, lastMessageAt: true, buyerLastReadAt: true, sellerLastReadAt: true,
      listing: { select: { title: true, photos: { orderBy: { position: "asc" }, take: 1, select: { storageKey: true, width: true, height: true, blurData: true } } } },
      buyer: { select: { name: true, image: true } },
      seller: { select: { name: true, image: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, type: true, senderId: true } },
    },
  });
  const items = conversations.map((c) => {
    const iAmBuyer = c.buyerId === user.id;
    const other = iAmBuyer ? c.seller : c.buyer;
    const readAt = iAmBuyer ? c.buyerLastReadAt : c.sellerLastReadAt;
    const last = c.messages[0];
    return {
      id: c.id,
      otherName: other.name,
      otherImage: other.image,
      listingTitle: c.listing?.title ?? "Item removed",
      thumb: c.listing?.photos[0] ? photoUrl(c.listing.photos[0].storageKey, 320) : null,
      lastAt: c.lastMessageAt.toISOString(),
      unread: !readAt || c.lastMessageAt > readAt,
      preview: last ? (last.type === "IMAGE" && !last.body ? "📷 Photo" : last.body) : "",
      mine: last?.senderId === user.id,
    };
  });
  return (
    <div className="container-page py-6">
      <h1 className="sr-only">Inbox</h1>
      <InboxShell list={<ConversationList items={items} userId={user.id} />}>{children}</InboxShell>
    </div>
  );
}
