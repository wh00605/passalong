"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS: [string, string, "staff" | "admin"][] = [
  ["/admin", "Dashboard", "staff"],
  ["/admin/moderation", "Moderation queue", "staff"],
  ["/admin/disputes", "Disputes", "staff"],
  ["/admin/notices", "Illegal content notices", "staff"],
  ["/admin/users", "Users", "staff"],
  ["/admin/listings", "Listings", "staff"],
  ["/admin/orders", "Orders", "staff"],
  ["/admin/payouts", "Payouts", "staff"],
  ["/admin/tickets", "Support tickets", "staff"],
  ["/admin/catalogue", "Catalogue", "staff"],
  ["/admin/fees", "Fees & policies", "admin"],
  ["/admin/help", "Help articles", "admin"],
  ["/admin/tax", "Tax reporting", "admin"],
  ["/admin/audit", "Audit log", "admin"],
];

export function AdminNav({ role }: { role: string }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="min-w-0">
      <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible" role="list">
        {ITEMS.filter(([, , need]) => need === "staff" || role === "admin").map(([href, label]) => {
          const active = href === "/admin" ? path === href : path.startsWith(href);
          return (
            <li key={href} className="shrink-0">
              <Link href={href} aria-current={active ? "page" : undefined} className={`flex min-h-9 items-center rounded-xl border px-3 text-sm font-semibold whitespace-nowrap ${active ? "border-ink bg-accent-400" : "border-transparent hover:border-ink"}`}>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
