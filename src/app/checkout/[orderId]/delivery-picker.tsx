"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDeliveryAction } from "@/app/actions/checkout";

export function DeliveryPicker({
  orderId, current, addresses, selectedAddressId,
}: {
  orderId: string;
  current: "HOME" | "PICKUP_POINT" | "IN_PERSON";
  addresses: { id: string; label: string }[];
  selectedAddressId: string | null;
}) {
  const [type, setType] = useState(current);
  const [addressId, setAddressId] = useState(selectedAddressId ?? addresses[0]?.id ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();

  function save(nextType = type, nextAddress = addressId) {
    setError("");
    start(async () => {
      const res = await setDeliveryAction({ orderId, deliveryType: nextType, addressId: nextType === "HOME" ? nextAddress : undefined });
      if (!res.ok) setError(res.error);
      router.refresh();
    });
  }

  const option = (value: typeof type, title: string, desc: string, disabled = false) => (
    <label className={`relative block ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
      <input
        type="radio"
        name="delivery"
        value={value}
        checked={type === value}
        disabled={disabled || pending}
        onChange={() => {
          setType(value);
          if (value !== "HOME" || addressId) save(value);
        }}
        className="peer sr-only"
      />
      <span className="block rounded-md border-2 border-ink/30 bg-surface p-3 peer-checked:border-ink peer-checked:bg-accent-400 peer-focus-visible:outline-3 peer-focus-visible:outline-ink">
        <span className="block font-semibold">{title}</span>
        <span className="text-sm">{desc}</span>
      </span>
    </label>
  );

  return (
    <section className="card space-y-4 p-5" aria-labelledby="delivery-h">
      <h2 id="delivery-h" className="text-lg font-bold">Delivery</h2>
      <fieldset className="grid gap-2 sm:grid-cols-3">
        <legend className="sr-only">Delivery method</legend>
        {option("HOME", "Home delivery", "Tracked, to your address")}
        {option("PICKUP_POINT", "Pick-up point", "Coming soon", true)}
        {option("IN_PERSON", "Meet in person", "No postage. Give the seller your code at handover.")}
      </fieldset>
      {type === "HOME" && (
        <div>
          {addresses.length ? (
            <>
              <label htmlFor="address" className="label">Deliver to</label>
              <select
                id="address"
                className="input"
                value={addressId}
                disabled={pending}
                onChange={(e) => {
                  setAddressId(e.target.value);
                  save("HOME", e.target.value);
                }}
              >
                {addresses.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
              {!selectedAddressId && (
                <button type="button" className="btn-secondary btn-sm mt-2" onClick={() => save("HOME", addressId)} disabled={pending}>Use this address</button>
              )}
            </>
          ) : (
            <p className="text-sm">You haven&apos;t saved an address yet.</p>
          )}
          <Link href="/settings/addresses" className="link mt-2 inline-block text-sm">Add or edit addresses</Link>
        </div>
      )}
      {type === "IN_PERSON" && (
        <p className="rounded-md bg-brand-50 p-3 text-sm">
          Agree a safe, public meeting place in chat. After paying you&apos;ll get a 6-digit code – only give it to the seller once you&apos;ve checked the item.
        </p>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </section>
  );
}
