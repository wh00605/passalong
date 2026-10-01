"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Avatar } from "@/components/avatar";

export function UserMenu({
  user,
}: {
  user: { name: string; username: string; image: string | null; isStaff: boolean };
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const links = [
    { href: `/members/${user.username}`, label: "My profile" },
    { href: "/orders", label: "My orders" },
    { href: "/wallet", label: "Wallet" },
    { href: "/favourites", label: "Favourites" },
    { href: "/saved-searches", label: "Saved searches" },
    { href: "/drafts", label: "Drafts" },
    { href: "/settings/profile", label: "Settings" },
    { href: "/help", label: "Help centre" },
    ...(user.isStaff ? [{ href: "/admin", label: "Admin dashboard" }] : []),
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="flex min-h-11 items-center gap-1 rounded-none border border-transparent px-1 hover:border-ink"
        aria-expanded={open}
        aria-controls="user-menu"
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar name={user.name} image={user.image} size={32} />
        <span className="sr-only">Account menu for {user.name}</span>
        <ChevronDown className="h-4 w-4 text-muted" aria-hidden="true" />
      </button>
      <div
        id="user-menu"
        hidden={!open}
        className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-none border border-line bg-surface py-1 shadow-[var(--shadow-tag)]"
      >
        <p className="border-b border-line px-4 py-2 font-mono text-xs">
          Signed in as <strong>@{user.username}</strong>
        </p>
        <ul>
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="block px-4 py-2.5 text-sm hover:bg-brand-50" onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            </li>
          ))}
          <li className="border-t border-line">
            <button
              type="button"
              className="block w-full px-4 py-2.5 text-left text-sm hover:bg-brand-50"
              onClick={async () => {
                await authClient.signOut();
                router.push("/");
                router.refresh();
              }}
            >
              Log out
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
