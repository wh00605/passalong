"use client";
import { useEffect, useRef } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client ??= createClient(url, key, { auth: { persistSession: false } });
  return client;
}

/**
 * Calls `onPing` when the channel signals a change (Supabase Realtime broadcast), and also polls
 * as a fallback – frequently when realtime isn't configured, rarely when it is.
 */
export function useLive(channel: string, onPing: () => void, opts: { pollMs?: number } = {}) {
  const pollMs = opts.pollMs ?? 4_000;
  const cb = useRef(onPing);
  useEffect(() => {
    cb.current = onPing;
  });

  useEffect(() => {
    const sb = supabase();
    let sub: ReturnType<SupabaseClient["channel"]> | null = null;
    if (sb) {
      sub = sb.channel(channel).on("broadcast", { event: "update" }, () => cb.current()).subscribe();
    }
    const visibleMs = sb ? Math.max(30_000, pollMs) : pollMs;
    const hiddenMs = visibleMs * 5;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      cb.current();
      timer = setTimeout(tick, document.visibilityState === "visible" ? visibleMs : hiddenMs);
    };
    timer = setTimeout(tick, visibleMs);
    const onVis = () => {
      if (document.visibilityState === "visible") cb.current();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
      if (sub && sb) void sb.removeChannel(sub);
    };
  }, [channel, pollMs]);
}
