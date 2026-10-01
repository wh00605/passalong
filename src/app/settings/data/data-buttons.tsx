"use client";
import { useState, useTransition } from "react";
import { cancelDeletionAction, requestDataExportAction } from "../actions";

export function ExportButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ url?: string; error?: string } | null>(null);
  return (
    <div className="mt-4">
      <button
        type="button"
        className="btn-secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await requestDataExportAction();
            setResult(res.ok ? { url: res.data.url } : { error: res.error });
          })
        }
      >
        {pending ? "Preparing your file…" : "Create my data file"}
      </button>
      <div role="status" className="mt-2 text-sm">
        {result?.url && (
          <a href={result.url} className="link" download>
            Your file is ready – download it
          </a>
        )}
        {result?.error && <span className="text-danger">{result.error}</span>}
      </div>
    </div>
  );
}

export function CancelDeletionButton() {
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn-primary mt-4" disabled={pending} onClick={() => start(async () => void (await cancelDeletionAction()))}>
      {pending ? "Cancelling…" : "Keep my account"}
    </button>
  );
}
