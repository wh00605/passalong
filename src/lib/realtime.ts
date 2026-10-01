import "server-only";
import { integrations } from "@/lib/env";

/**
 * Sends a content-free "something changed" ping to a conversation channel via Supabase Realtime broadcast.
 * Clients then fetch new messages through our authenticated API, so no message content
 * ever travels over the public realtime channel. Without Supabase configured, clients poll instead.
 */
export async function pingChannel(channel: string, event = "update") {
  if (!integrations.supabaseRealtime() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ messages: [{ topic: channel, event, payload: { at: Date.now() } }] }),
    });
  } catch (err) {
    console.error("[realtime] broadcast failed", err);
  }
}

export const conversationChannel = (id: string) => `conv:${id}`;
export const userChannel = (id: string) => `user:${id}`;
