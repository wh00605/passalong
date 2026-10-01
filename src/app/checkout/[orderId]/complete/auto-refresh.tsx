"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Refreshes every 2 seconds (up to a minute) while we wait for Stripe's webhook. */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => {
      if (++n > 30) return clearInterval(t);
      router.refresh();
    }, 2000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
