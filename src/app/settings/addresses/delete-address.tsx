"use client";
import { useTransition } from "react";
import { deleteAddressAction } from "../actions";

export function DeleteAddressButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn-ghost btn-sm mt-2 text-danger"
      disabled={pending}
      onClick={() => {
        if (confirm("Delete this address?")) start(async () => void (await deleteAddressAction(id)));
      }}
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
