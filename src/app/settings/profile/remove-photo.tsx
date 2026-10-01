"use client";
import { useTransition } from "react";
import { removeProfilePhotoAction } from "../actions";

export function RemovePhotoButton() {
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => void (await removeProfilePhotoAction()))}>
      {pending ? "Removing…" : "Remove photo"}
    </button>
  );
}
