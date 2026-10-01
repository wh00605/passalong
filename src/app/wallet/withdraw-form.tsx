"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { withdrawAction } from "@/app/actions/aftersale";

export function WithdrawForm({ max, minLabel }: { max: string; minLabel: string }) {
  const [amount, setAmount] = useState(max);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();
  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await withdrawAction(amount);
          setMsg(res.ok ? { ok: true, text: "Withdrawal started – it usually arrives in 1–3 working days." } : { ok: false, text: res.error });
          router.refresh();
        });
      }}
    >
      <div>
        <label htmlFor="withdraw" className="label">Amount (£)</label>
        <input id="withdraw" inputMode="decimal" className="input w-40 font-mono" value={amount} onChange={(e) => setAmount(e.target.value)} aria-describedby="withdraw-hint" />
      </div>
      <button type="submit" className="btn-primary" disabled={pending || Number(amount) <= 0}>Withdraw to bank</button>
      <p id="withdraw-hint" className="w-full text-xs text-muted">Minimum {minLabel}. No withdrawal fee.</p>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`w-full text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
    </form>
  );
}
