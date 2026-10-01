"use client";

export function CookieSettingsButton() {
  return (
    <button type="button" className="btn-secondary mt-4" onClick={() => window.dispatchEvent(new Event("open-cookie-settings"))}>
      Open cookie settings
    </button>
  );
}
