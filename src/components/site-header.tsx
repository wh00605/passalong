import Link from "next/link";
import { Suspense } from "react";
import { Bell, Heart, MessageCircle, Plus } from "lucide-react";
import { Logo } from "@/components/logo";
import { SearchBox } from "@/components/search-box";
import { UserMenu } from "@/components/user-menu";
import { getCurrentUser, isStaff } from "@/lib/session";
import { getTopCategories } from "@/lib/catalogue";
import { getUnreadCounts } from "@/lib/inbox";

function Badge({ count, label }: { count: number; label: string }) {
  if (!count) return <span className="sr-only">{label}</span>;
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute -top-0.5 -right-0.5 min-w-5 rounded-sm border-2 border-ink bg-accent-400 px-0.5 text-center font-mono text-[11px] leading-4 font-bold text-ink"
      >
        {count > 99 ? "99+" : count}
      </span>
      <span className="sr-only">
        {label}, {count} unread
      </span>
    </>
  );
}

const iconLink = "relative inline-flex h-11 w-11 items-center justify-center rounded-md border-2 border-transparent hover:border-ink hover:bg-surface";

export async function SiteHeader() {
  const [user, categories] = await Promise.all([getCurrentUser(), getTopCategories()]);
  const counts = user ? await getUnreadCounts(user.id) : { messages: 0, notifications: 0 };

  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink bg-canvas/95 backdrop-blur supports-[backdrop-filter]:bg-canvas/85">
      <a href="#main" className="sr-only-focusable absolute top-2 left-2 z-50 rounded-md bg-accent-400 px-4 py-2 font-semibold text-ink">
        Skip to main content
      </a>
      <div className="container-page flex items-center gap-3 py-3">
        <Link href="/" aria-label="Passalong home" className="shrink-0">
          <Logo />
        </Link>
        <Suspense fallback={<div className="hidden flex-1 md:block" />}>
          <SearchBox className="mx-2 hidden max-w-2xl flex-1 md:block" />
        </Suspense>
        <nav aria-label="Account" className="ml-auto flex items-center gap-1">
          {user ? (
            <>
              <Link href="/inbox" className={iconLink}>
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
                <Badge count={counts.messages} label="Inbox" />
              </Link>
              <Link href="/notifications" className={iconLink}>
                <Bell className="h-5 w-5" aria-hidden="true" />
                <Badge count={counts.notifications} label="Notifications" />
              </Link>
              <Link href="/favourites" className={`${iconLink} max-sm:hidden`}>
                <Heart className="h-5 w-5" aria-hidden="true" />
                <span className="sr-only">Favourites</span>
              </Link>
              <UserMenu user={{ name: user.name, username: user.username, image: user.image, isStaff: isStaff(user) }} />
            </>
          ) : (
            <>
              <Link href="/signup" className="btn-ghost btn-sm max-sm:hidden">
                Sign up
              </Link>
              <Link href="/login" className="btn-secondary btn-sm">
                Log in
              </Link>
            </>
          )}
          <Link href="/sell" className="btn-accent btn-sm ml-1">
            <Plus className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
            Sell
          </Link>
        </nav>
      </div>
      <div className="container-page pb-3 md:hidden">
        <Suspense fallback={<div className="h-11" />}>
          <SearchBox />
        </Suspense>
      </div>
      <nav aria-label="Categories" className="border-t border-line">
        <ul className="container-page flex gap-1 overflow-x-auto py-1 font-mono text-xs font-medium tracking-[0.12em] whitespace-nowrap uppercase [scrollbar-width:none]">
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={`/c/${c.path}`} className="inline-flex min-h-10 items-center rounded-sm px-3 hover:bg-ink hover:text-surface">
                {c.name}
              </Link>
            </li>
          ))}
          <li className="ml-auto">
            <Link href="/help" className="inline-flex min-h-10 items-center rounded-sm px-3 text-muted hover:bg-ink hover:text-surface">
              Help
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
