import { MessageCircle } from "lucide-react";

export default async function InboxIndex({ searchParams }: PageProps<"/inbox">) {
  const sp = await searchParams;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      {typeof sp.error === "string" && (
        <p role="alert" className="rounded-md border-2 border-danger bg-danger-bg px-4 py-2 text-sm text-danger">{sp.error.slice(0, 200)}</p>
      )}
      <MessageCircle className="h-10 w-10" aria-hidden="true" />
      <p className="font-display text-2xl font-extrabold">Pick a conversation</p>
      <p className="max-w-xs text-sm text-muted">Chats are per item. Offers, order updates and tracking all show up here too.</p>
    </div>
  );
}
