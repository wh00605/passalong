"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export const CONSENT_COOKIE = "pa_consent";
export const CONSENT_VERSION = "2026-10-01";

export function readConsent(): { analytics: boolean; marketing: boolean; version: string } | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie.split("; ").find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw.split("=")[1]));
  } catch {
    return null;
  }
}

export async function saveConsent(choice: { analytics: boolean; marketing: boolean }) {
  await fetch("/api/consent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...choice, version: CONSENT_VERSION }),
  });
}

/**
 * Cookie notice (UK PECR / UK GDPR). Strictly necessary cookies (sign-in, security, this choice)
 * are always on. Optional categories are off until the visitor opts in; rejecting is as easy as accepting.
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [manage, setManage] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const c = readConsent();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cookie is only readable after hydration
    if (!c || c.version !== CONSENT_VERSION) setVisible(true);
    const open = () => {
      setVisible(true);
      setManage(true);
    };
    window.addEventListener("open-cookie-settings", open);
    return () => window.removeEventListener("open-cookie-settings", open);
  }, []);

  if (!visible) return null;

  async function choose(a: boolean, m: boolean) {
    await saveConsent({ analytics: a, marketing: m });
    setVisible(false);
  }

  return (
    <section
      aria-labelledby="cookie-title"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface p-4 sm:right-auto sm:bottom-4 sm:left-4 sm:max-w-md sm:rounded-none sm:border-2 sm:shadow-[var(--shadow-tag)]"
    >
      <h2 id="cookie-title" className="text-lg font-medium">
        Cookies, briefly.
      </h2>
      <p className="mt-1 text-sm text-muted">
        Essential cookies keep you signed in and secure. With your permission we&apos;d also use optional cookies to see how
        the site is used and make it better. <Link href="/legal/cookies" className="link">Cookie policy</Link>
      </p>
      {manage && (
        <fieldset className="mt-3 space-y-2 text-sm">
          <legend className="sr-only">Optional cookies</legend>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked disabled className="mt-1 h-4 w-4 accent-ink" />
            <span><strong>Essential</strong> – always on. Sign-in, security and remembering this choice.</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} className="mt-1 h-4 w-4 accent-ink" />
            <span><strong>Analytics</strong> – anonymous usage statistics.</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-1 h-4 w-4 accent-ink" />
            <span><strong>Marketing</strong> – measuring our adverts on other sites.</span>
          </label>
        </fieldset>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {manage ? (
          <button type="button" className="btn-primary btn-sm" onClick={() => choose(analytics, marketing)}>
            Save choices
          </button>
        ) : (
          <>
            <button type="button" className="btn-primary btn-sm" onClick={() => choose(true, true)}>
              Accept all
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => choose(false, false)}>
              Reject optional
            </button>
            <button type="button" className="btn-ghost btn-sm underline" onClick={() => setManage(true)}>
              Manage
            </button>
          </>
        )}
      </div>
    </section>
  );
}
