"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { listingOpAction } from "@/app/actions/listings";

export function OwnerControls({ id, status, reservedFor }: { id: string; status: string; reservedFor: string | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [reserveName, setReserveName] = useState("");
  const router = useRouter();

  function run(op: "hide" | "unhide" | "reserve" | "unreserve" | "markSold" | "delete", username?: string) {
    setError("");
    start(async () => {
      const res = await listingOpAction({ id, op, username });
      if (!res.ok) return setError(res.error);
      if (op === "delete") router.push("/drafts?status=ACTIVE");
      else router.refresh();
    });
  }

  const editable = !["SOLD", "DELETED", "REMOVED"].includes(status);
  return (
    <div className="space-y-3 rounded-none border border-dashed border-line-strong p-4">
      <p className="eyebrow">Your item · {status.toLowerCase()}</p>
      <div className="flex flex-wrap gap-2">
        {editable && <Link href={`/items/${id}/edit`} className="btn-primary btn-sm">Edit</Link>}
        {status === "ACTIVE" && <Link href={`/promote?listing=${id}`} className="btn-accent btn-sm">Bump</Link>}
        {(status === "ACTIVE" || status === "RESERVED") && <button type="button" className="btn-secondary btn-sm" disabled={pending} onClick={() => run("hide")}>Hide</button>}
        {status === "HIDDEN" && <button type="button" className="btn-secondary btn-sm" disabled={pending} onClick={() => run("unhide")}>Unhide</button>}
        {status === "RESERVED" && <button type="button" className="btn-secondary btn-sm" disabled={pending} onClick={() => run("unreserve")}>Unreserve</button>}
        {(status === "ACTIVE" || status === "RESERVED" || status === "HIDDEN") && (
          <button type="button" className="btn-secondary btn-sm" disabled={pending} onClick={() => confirm("Mark as sold? Use this only if it sold somewhere else.") && run("markSold")}>Mark as sold</button>
        )}
        <button type="button" className="btn-ghost btn-sm text-danger" disabled={pending} onClick={() => confirm("Delete this item? This can't be undone.") && run("delete")}>Delete</button>
      </div>
      {status === "ACTIVE" && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run("reserve", reserveName);
          }}
        >
          <div>
            <label htmlFor="reserve-for" className="label">Reserve for a buyer</label>
            <input id="reserve-for" className="input" placeholder="username" value={reserveName} onChange={(e) => setReserveName(e.target.value)} autoCapitalize="none" />
          </div>
          <button type="submit" className="btn-secondary btn-sm" disabled={pending || !reserveName}>Reserve</button>
        </form>
      )}
      {status === "RESERVED" && reservedFor && <p className="text-sm">Reserved for <strong>@{reservedFor}</strong> – only they can buy it.</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
