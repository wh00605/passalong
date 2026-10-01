"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleBlockAction, toggleFollowAction } from "@/app/actions/social";

export function FollowButton({ targetId, initial, name }: { targetId: string; initial: boolean; name: string }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <>
      <button
        type="button"
        aria-pressed={on}
        className={on ? "btn-secondary" : "btn-primary"}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await toggleFollowAction(targetId);
            if (res.ok) setOn(res.data.following);
            else setError(res.error);
          })
        }
      >
        {on ? "Following" : "Follow"}
        <span className="sr-only"> {name}</span>
      </button>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </>
  );
}

export function BlockButton({ targetId, initial, name }: { targetId: string; initial: boolean; name: string }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn-ghost btn-sm text-danger"
      disabled={pending}
      onClick={() => {
        if (!on && !confirm(`Block ${name}? They won't be able to message you or buy your items, and you won't see theirs.`)) return;
        start(async () => {
          const res = await toggleBlockAction(targetId);
          if (res.ok) {
            setOn(res.data.blocked);
            router.refresh();
          }
        });
      }}
    >
      {on ? `Unblock ${name.split(" ")[0]}` : "Block member"}
    </button>
  );
}
