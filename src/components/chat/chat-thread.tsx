"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, ImagePlus, Send, ShieldAlert, Tag } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ReportButton } from "@/components/report-button";
import { ListingThumb } from "@/components/chat/listing-thumb";
import { useLive } from "@/components/chat/use-live";
import { BlockButton } from "@/app/members/[username]/profile-actions";
import { makeOfferAction, markReadAction, respondToOfferAction, sendMessageAction } from "@/app/actions/chat";
import { formatPence } from "@/lib/money";

type Msg = {
  id: string;
  senderId: string | null;
  type: "TEXT" | "IMAGE" | "OFFER" | "SYSTEM" | "ORDER_EVENT";
  body: string;
  safetyWarning: boolean;
  hiddenAt: string | null;
  createdAt: string;
  attachments: { id: string; storageKey: string; width: number; height: number }[];
  offer: { id: string; amountPence: number; status: string; createdById: string; expiresAt: string; items: { listingId: string }[] } | null;
  order: { id: string; number: string; status: string } | null;
};

const SAFETY_TEXT =
  "Keep payments on Passalong. Paying by bank transfer, PayPal Friends & Family or similar isn't covered by Buyer Protection and is a common scam.";

function time(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function day(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

export function ChatThread(props: {
  conversationId: string;
  me: { id: string; role: "buyer" | "seller" };
  other: { id: string; name: string; username: string; image: string | null; activeLabel: string | null; deleted: boolean };
  listing: { id: string; title: string; href: string; thumb: string | null; pricePence: number; minOfferPence: number; available: boolean } | null;
  initialMessages: Msg[];
  initialOtherReadAt: string | null;
  openOfferPanel: boolean;
  blocked: boolean;
  minOfferPercent: number;
}) {
  const { conversationId, me, other, listing } = props;
  const [messages, setMessages] = useState<Msg[]>(props.initialMessages);
  const [otherReadAt, setOtherReadAt] = useState(props.initialOtherReadAt);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [announce, setAnnounce] = useState("");
  const [offerOpen, setOfferOpen] = useState(props.openOfferPanel && me.role === "buyer");
  const [offerAmount, setOfferAmount] = useState("");
  const [counterOf, setCounterOf] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastCount = useRef(messages.length);
  const router = useRouter();

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/conversations/${conversationId}/messages`, { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { messages: Msg[]; otherReadAt: string | null };
    setMessages(data.messages);
    setOtherReadAt(data.otherReadAt);
    const incoming = data.messages.slice(lastCount.current).filter((m) => m.senderId !== me.id);
    if (incoming.length) {
      setAnnounce(`New message from ${other.name}: ${incoming.at(-1)!.body.slice(0, 120)}`);
      void markReadAction(conversationId);
    }
    lastCount.current = data.messages.length;
  }, [conversationId, me.id, other.name]);

  useLive(`conv:${conversationId}`, refresh);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const pendingOffer = [...messages].reverse().find((m) => m.offer?.status === "PENDING")?.offer ?? null;
  const acceptedOffer = [...messages].reverse().find((m) => m.offer?.status === "ACCEPTED")?.offer ?? null;
  const disabled = props.blocked || other.deleted;

  function send() {
    const body = text.trim();
    if (!body) return;
    setError("");
    start(async () => {
      const res = await sendMessageAction(conversationId, body);
      if (!res.ok) return setError(res.error);
      setText("");
      await refresh();
      router.refresh();
    });
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError("");
    const fd = new FormData();
    fd.append("conversationId", conversationId);
    fd.append("file", file);
    const res = await fetch("/api/uploads/chat-photo", { method: "POST", body: fd });
    setUploading(false);
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Upload failed.");
    else await refresh();
    if (fileRef.current) fileRef.current.value = "";
  }

  function submitOffer() {
    setError("");
    start(async () => {
      const res = await makeOfferAction({ conversationId, amount: offerAmount, counterOfId: counterOf ?? undefined });
      if (!res.ok) return setError(res.error);
      setOfferOpen(false);
      setOfferAmount("");
      setCounterOf(null);
      await refresh();
    });
  }

  function respond(offerId: string, response: "accept" | "decline" | "withdraw") {
    setError("");
    start(async () => {
      const res = await respondToOfferAction(offerId, response);
      if (!res.ok) return setError(res.error);
      await refresh();
    });
  }

  const myLastSeenIdx = otherReadAt ? messages.findLastIndex((m) => m.senderId === me.id && m.createdAt <= otherReadAt) : -1;

  return (
    <section className="flex h-full flex-col" aria-label={`Conversation with ${other.name}`}>
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-line p-3">
        <Link href="/inbox" className="btn-ghost btn-sm md:hidden" aria-label="Back to all conversations">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Avatar name={other.name} image={other.image} size={40} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-sans text-base font-bold tracking-normal">
            <Link href={`/members/${other.username}`} className="hover:underline">{other.name}</Link>
          </h2>
          <p className="truncate font-mono text-xs text-muted">{other.deleted ? "Account deleted" : other.activeLabel ?? `@${other.username}`}</p>
        </div>
        <details className="relative">
          <summary className="btn-ghost btn-sm list-none" aria-label="More options">•••</summary>
          <div className="absolute right-0 z-20 mt-1 w-48 space-y-1 rounded-lg border border-line bg-surface p-2 shadow-[var(--shadow-tag)]">
            <ReportButton targetType="USER" targetId={other.id} label="Report member" className="btn-ghost btn-sm w-full justify-start" />
            <BlockButton targetId={other.id} initial={props.blocked} name={other.name} />
          </div>
        </details>
      </header>

      {listing && (
        <div className="flex items-center gap-3 border-b border-line bg-canvas p-3">
          <ListingThumb src={listing.thumb} className="h-12 w-10" />
          <div className="min-w-0 flex-1">
            <Link href={listing.href} className="block truncate text-sm font-semibold hover:underline">{listing.title}</Link>
            <p className="font-mono text-xs">{formatPence(listing.pricePence)}</p>
          </div>
          {me.role === "buyer" && listing.available && !disabled && (
            <div className="flex gap-2">
              {acceptedOffer ? (
                <Link href={`/checkout/start?offer=${acceptedOffer.id}`} className="btn-accent btn-sm">Buy for {formatPence(acceptedOffer.amountPence)}</Link>
              ) : (
                <>
                  <Link href={`/checkout/start?listing=${listing.id}`} className="btn-primary btn-sm">Buy</Link>
                  {!pendingOffer && <button type="button" className="btn-secondary btn-sm" onClick={() => setOfferOpen((o) => !o)} aria-expanded={offerOpen}>Offer</button>}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3" aria-label="Messages">
        <li className="mx-auto max-w-md rounded-lg border border-dashed border-line-strong/60 p-3 text-center text-xs text-muted">
          <ShieldAlert className="mx-auto mb-1 h-4 w-4" aria-hidden="true" />
          {SAFETY_TEXT}
        </li>
        {messages.map((m, idx) => {
          const mine = m.senderId === me.id;
          const d = day(m.createdAt);
          const showDay = idx === 0 || day(messages[idx - 1].createdAt) !== d;
          return (
            <li key={m.id}>
              {showDay && <p className="my-3 text-center font-mono text-[11px] tracking-wider text-muted uppercase">{d}</p>}
              {m.type === "SYSTEM" || m.type === "ORDER_EVENT" ? (
                <p className="mx-auto max-w-md rounded-lg bg-brand-50 px-3 py-1.5 text-center text-xs">
                  {m.order ? <Link href={`/orders/${m.order.id}`} className="font-semibold underline">{m.body}</Link> : m.body}
                  <span className="ml-2 font-mono text-muted">{time(m.createdAt)}</span>
                </p>
              ) : m.type === "OFFER" && m.offer ? (
                <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className="w-full max-w-xs rounded-lg border border-line bg-surface p-3">
                    <p className="flex items-center gap-2 font-mono text-xs tracking-wider uppercase">
                      <Tag className="h-3.5 w-3.5" aria-hidden="true" /> {mine ? "Your offer" : "Offer"}
                    </p>
                    <p className="mt-1 font-display text-2xl font-medium">{formatPence(m.offer.amountPence)}</p>
                    {m.offer.items.length > 1 && <p className="text-xs text-muted">For {m.offer.items.length} items</p>}
                    <p className="mt-1 text-xs">
                      Status: <strong>{m.offer.status.toLowerCase()}</strong>
                      {m.offer.status === "PENDING" && <> · expires {new Date(m.offer.expiresAt).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })}</>}
                    </p>
                    {m.offer.status === "PENDING" && !disabled && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {m.offer.createdById === me.id ? (
                          <button type="button" className="btn-ghost btn-sm" disabled={pending} onClick={() => respond(m.offer!.id, "withdraw")}>Withdraw</button>
                        ) : (
                          <>
                            <button type="button" className="btn-accent btn-sm" disabled={pending} onClick={() => respond(m.offer!.id, "accept")}>Accept</button>
                            <button type="button" className="btn-secondary btn-sm" disabled={pending} onClick={() => { setCounterOf(m.offer!.id); setOfferOpen(true); }}>Counter</button>
                            <button type="button" className="btn-ghost btn-sm" disabled={pending} onClick={() => respond(m.offer!.id, "decline")}>Decline</button>
                          </>
                        )}
                      </div>
                    )}
                    {m.offer.status === "ACCEPTED" && me.role === "buyer" && (
                      <Link href={`/checkout/start?offer=${m.offer.id}`} className="btn-accent btn-sm mt-3 w-full">Buy now at this price</Link>
                    )}
                  </div>
                </div>
              ) : (
                <div className={`group flex flex-col ${mine ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[80%] rounded-lg border border-line px-3 py-2 ${mine ? "bg-brand-600 text-white" : "bg-surface"}`}>
                    {m.attachments.map((a) => (
                      <a key={a.id} href={`/api/files/private/${a.storageKey}-1280.webp`} target="_blank" rel="noreferrer" className="mb-1 block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/files/private/${a.storageKey}-640.webp`} alt={`Photo from ${mine ? "you" : other.name}`} width={a.width} height={a.height} className="max-h-72 w-auto rounded-lg" loading="lazy" />
                      </a>
                    ))}
                    {m.body && <p className="text-sm break-words whitespace-pre-wrap">{m.body}</p>}
                  </div>
                  {m.safetyWarning && (
                    <p className="mt-1 flex max-w-[80%] items-start gap-1.5 rounded-lg border border-hot bg-surface px-2 py-1 text-xs" role="note">
                      <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {mine ? "This message mentions paying or talking off Passalong. " : ""}
                      {SAFETY_TEXT}
                    </p>
                  )}
                  <p className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-muted">
                    {time(m.createdAt)}
                    {mine && idx === myLastSeenIdx && <span>· Seen</span>}
                    {!mine && <span className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"><ReportButton targetType="MESSAGE" targetId={m.id} label="Report" className="text-[11px] underline" /></span>}
                  </p>
                </div>
              )}
            </li>
          );
        })}
        <div ref={endRef} />
      </ol>
      <p aria-live="polite" className="sr-only">{announce}</p>

      {/* Offer panel */}
      {offerOpen && listing && !disabled && (
        <form
          className="border-t border-line bg-accent-300 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            submitOffer();
          }}
        >
          <label htmlFor="offer-amount" className="label">{counterOf ? "Your counter-offer" : "Your offer"}</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono font-bold" aria-hidden="true">£</span>
              <input id="offer-amount" inputMode="decimal" className="input pl-7 font-mono" value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)} aria-describedby="offer-hint" autoFocus />
            </div>
            <button type="submit" className="btn-primary" disabled={pending || !offerAmount}>Send</button>
            <button type="button" className="btn-ghost" onClick={() => { setOfferOpen(false); setCounterOf(null); }}>Cancel</button>
          </div>
          <p id="offer-hint" className="mt-1 text-xs">
            Listed at {formatPence(listing.pricePence)}. Offers must be at least {formatPence(listing.minOfferPence)} ({props.minOfferPercent}%).
          </p>
        </form>
      )}

      {/* Composer */}
      {error && <p role="alert" className="border-t border-danger bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}
      {disabled ? (
        <p className="border-t border-line p-3 text-center text-sm text-muted">{other.deleted ? "This member has left Passalong." : "You can't message this member."}</p>
      ) : (
        <form
          className="flex items-end gap-2 border-t border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label className={`btn-ghost btn-sm cursor-pointer ${uploading ? "opacity-50" : ""}`}>
            <ImagePlus className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Attach a photo</span>
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(e) => upload(e.target.files?.[0])} />
          </label>
          <label htmlFor="chat-input" className="sr-only">Message</label>
          <textarea
            id="chat-input"
            rows={1}
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={uploading ? "Uploading photo…" : "Write a message…"}
            className="input max-h-32 min-h-11 flex-1 resize-none"
          />
          <button type="submit" className="btn-primary btn-sm h-11" disabled={pending || !text.trim()} aria-label="Send message">
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      )}
    </section>
  );
}
