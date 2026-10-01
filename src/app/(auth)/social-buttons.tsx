"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SocialButtons({ google, apple, next }: { google: boolean; apple: boolean; next?: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  if (!google && !apple) return null;

  async function go(provider: "google" | "apple") {
    setBusy(provider);
    await authClient.signIn.social({ provider, callbackURL: next || "/", newUserCallbackURL: "/welcome" });
  }

  return (
    <div className="space-y-2">
      {google && (
        <button type="button" className="btn-secondary w-full" disabled={!!busy} onClick={() => go("google")}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6a5.1 5.1 0 0 1-2.2 3.4v2.8h3.6c2-1.9 3.2-4.7 3.2-8.2z" />
            <path fill="#34A853" d="M12 23c3 0 5.5-1 7.4-2.7l-3.6-2.8c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.9A11 11 0 0 0 12 23z" />
            <path fill="#FBBC05" d="M5.7 14a6.6 6.6 0 0 1 0-4.2V7H2a11 11 0 0 0 0 9.9l3.7-2.9z" />
            <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2 7l3.7 2.9C6.6 7.3 9.1 5.4 12 5.4z" />
          </svg>
          {busy === "google" ? "Redirecting…" : "Continue with Google"}
        </button>
      )}
      {apple && (
        <button type="button" className="btn w-full bg-black text-white hover:bg-neutral-800" disabled={!!busy} onClick={() => go("apple")}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="currentColor">
            <path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7a4.5 4.5 0 0 0-3.5-1.9c-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8A4.7 4.7 0 0 0 4.2 9.5c-1.7 2.9-.4 7.3 1.2 9.7.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.6-1-2.6-3.8zM14 5.4c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.6 2.8-1.4z" />
          </svg>
          {busy === "apple" ? "Redirecting…" : "Continue with Apple"}
        </button>
      )}
      <div className="flex items-center gap-3 py-2 text-sm text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
