"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Bookmark } from "lucide-react";
import { saveSearchAction } from "@/app/actions/saved-searches";

export function SaveSearchButton({ query, defaultName }: { query: string; defaultName: string }) {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | string>("idle");
  if (status === "saved") {
    return (
      <p role="status" className="text-sm">
        Saved – we&apos;ll alert you to new matches. <Link href="/saved-searches" className="link">Manage</Link>
      </p>
    );
  }
  return (
    <>
      <button
        type="button"
        className="btn-secondary btn-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await saveSearchAction({ query, name: defaultName });
            setStatus(res.ok ? "saved" : res.error);
          })
        }
      >
        <Bookmark className="h-4 w-4" aria-hidden="true" />
        {pending ? "Saving…" : "Save search"}
      </button>
      {status !== "idle" && <p role="alert" className="text-sm text-danger">{status}</p>}
    </>
  );
}
