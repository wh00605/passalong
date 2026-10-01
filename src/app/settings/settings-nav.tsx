"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  ["profile", "Profile"],
  ["account", "Account & security"],
  ["personalisation", "Sizes & brands"],
  ["notifications", "Notifications"],
  ["privacy", "Privacy & cookies"],
  ["addresses", "Addresses"],
  ["payments", "Payment methods"],
  ["payouts", "Payouts & bank"],
  ["bundles", "Bundle discounts"],
  ["tax", "Tax details"],
  ["holiday", "Holiday mode"],
  ["data", "Your data"],
] as const;

export function SettingsNav() {
  const path = usePathname();
  return (
    <nav aria-label="Settings sections" className="min-w-0">
      <ul className="flex gap-1 overflow-x-auto pb-2 md:flex-col md:overflow-visible md:pb-0" role="list">
        {ITEMS.map(([slug, label]) => {
          const href = `/settings/${slug}`;
          const active = path === href;
          return (
            <li key={slug} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-10 items-center rounded-md border-2 px-3 text-sm font-semibold whitespace-nowrap ${active ? "border-ink bg-accent-400" : "border-transparent hover:border-ink"}`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
