import Link from "next/link";
import { Suspense } from "react";
import { Bell, Heart, MessageCircle } from "lucide-react";
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
      <span aria-hidden="true" className="absolute top-1 right-1 min-w-[1.1rem] rounded-full bg-brand-600 px-1 text-center text-[10px] leading-[1.1rem] font-semibold text-white ring-2 ring-surface">
        {count > 99 ? "99+" : count}
      </span>
      <span className="sr-only">
        {label}, {count} unread
      </span>
    </>
  );
}

const iconLink = "relative inline-flex h-11 w-11 items-center justify-center rounded-full text-ink/80 transition-colors hover:bg-brand-50 hover:text-ink";

export async function SiteHeader() {
  const [user, categories] = await Promise.all([getCurrentUser(), getTopCategories()]);
  const counts = user ? await getUnreadCounts(user.id) : { messages: 0, notifications: 0 };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-md">
      <a href="#main" className="sr-only-focusable absolute top-2 left-2 z-50 rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white">
        Skip to main content
      </a>
      <div className="container-page flex items-center gap-4 py-3.5">
        <Link href="/" aria-label="Passalong home" className="shrink-0">
          <Logo compactOnSmall={!!user} />
        </Link>
        <Suspense fallback={<div className="hidden flex-1 md:block" />}>
          <SearchBox className="mx-4 hidden max-w-xl flex-1 md:block" />
        </Suspense>
        <nav aria-label="Account" className="ml-auto flex items-center gap-1">
          {user ? (
            <>
              <Link href="/inbox" className={iconLink}>
                <MessageCircle className="h-[1.3rem] w-[1.3rem]" strokeWidth={1.6} aria-hidden="true" />
                <Badge count={counts.messages} label="Inbox" />
              </Link>
              <Link href="/notifications" className={iconLink}>
                <Bell className="h-[1.3rem] w-[1.3rem]" strokeWidth={1.6} aria-hidden="true" />
                <Badge count={counts.notifications} label="Notifications" />
              </Link>
              <Link href="/favourites" className={`${iconLink} max-sm:hidden`}>
                <Heart className="h-[1.3rem] w-[1.3rem]" strokeWidth={1.6} aria-hidden="true" />
                <span className="sr-only">Favourites</span>
              </Link>
              <UserMenu user={{ name: user.name, username: user.username, image: user.image, isStaff: isStaff(user) }} />
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost btn-sm max-sm:px-3">Log in</Link>
              <Link href="/signup" className="btn-secondary btn-sm max-sm:hidden">Sign up</Link>
            </>
          )}
          <Link href="/sell" className="btn-primary btn-sm ml-2">Sell now</Link>
        </nav>
      </div>
      <div className="container-page pb-3 md:hidden">
        <Suspense fallback={<div className="h-12" />}>
          <SearchBox />
        </Suspense>
      </div>
      <nav aria-label="Categories">
        <ul className="container-page flex gap-6 overflow-x-auto text-sm whitespace-nowrap [scrollbar-width:none]">
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={`/c/${c.path}`} className="inline-flex min-h-11 items-center border-b-2 border-transparent text-ink/75 transition-colors hover:border-brand-600 hover:text-ink">
                {c.name}
              </Link>
            </li>
          ))}
          <li className="ml-auto">
            <Link href="/help" className="inline-flex min-h-11 items-center text-muted hover:text-ink">Help</Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
