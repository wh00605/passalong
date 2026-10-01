import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { getConversationFor, markConversationRead, messageSelect } from "@/lib/messaging";
import { getSettings } from "@/lib/settings";
import { minimumOffer } from "@/lib/fees";
import { photoUrl } from "@/lib/storage";
import { listingPath } from "@/lib/slug";
import { timeAgo } from "@/lib/time";
import { ChatThread } from "@/components/chat/chat-thread";

export default async function ConversationPage({ params, searchParams }: PageProps<"/inbox/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/inbox/${id}`);
  const conv = await getConversationFor(id, user.id);
  if (!conv) notFound();
  await markConversationRead(id, user.id);

  const [messages, settings, blocked] = await Promise.all([
    db.message.findMany({ where: { conversationId: id }, orderBy: { createdAt: "asc" }, take: 300, select: messageSelect }),
    getSettings(),
    db.block.findFirst({ where: { OR: [{ blockerId: user.id, blockedId: conv.buyerId === user.id ? conv.sellerId : conv.buyerId }, { blockerId: conv.buyerId === user.id ? conv.sellerId : conv.buyerId, blockedId: user.id }] } }),
  ]);
  const iAmBuyer = conv.buyerId === user.id;
  const other = iAmBuyer ? conv.seller : conv.buyer;
  const l = conv.listing;
  const available = !!l && (l.status === "ACTIVE" || (l.status === "RESERVED" && l.reservedForId === conv.buyerId));

  return (
    <ChatThread
      conversationId={conv.id}
      me={{ id: user.id, role: iAmBuyer ? "buyer" : "seller" }}
      other={{
        id: other.id,
        name: other.name,
        username: other.username,
        image: other.image,
        activeLabel: other.showOnlineStatus && other.lastActiveAt ? `Active ${timeAgo(other.lastActiveAt)}` : null,
        deleted: !!other.deletedAt,
      }}
      listing={
        l
          ? {
              id: l.id,
              title: l.title,
              href: listingPath(l),
              thumb: l.photos[0] ? photoUrl(l.photos[0].storageKey, 320) : null,
              pricePence: l.pricePence,
              minOfferPence: minimumOffer(l.pricePence, settings.minOfferPercent),
              available,
            }
          : null
      }
      initialMessages={JSON.parse(JSON.stringify(messages))}
      initialOtherReadAt={(iAmBuyer ? conv.sellerLastReadAt : conv.buyerLastReadAt)?.toISOString() ?? null}
      openOfferPanel={sp.offer === "1"}
      blocked={!!blocked}
      minOfferPercent={settings.minOfferPercent}
    />
  );
}
