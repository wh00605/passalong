"use client";
import { useTransition } from "react";
import { markAllNotificationsReadAction } from "@/app/actions/notifications";

export function MarkAllRead() {
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn-secondary btn-sm" disabled={pending} onClick={() => start(async () => void (await markAllNotificationsReadAction()))}>
      {pending ? "Marking…" : "Mark all as read"}
    </button>
  );
}
