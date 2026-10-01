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
      <span aria-hidden="true" className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brand-600 ring-2 ring-surface" />
      <span className="sr-only">
        {label}, {count} unread
      </span>
    </>
  );
}

const iconLink = "relative inline-flex h-11 w-11 items-center justify-center text-ink/80 transition-colors hover:text-ink";

export async function SiteHeader() {
  const [user, categories] = await Promise.all([getCurrentUser(), getTopCategories()]);
  const counts = user ? await getUnreadCounts(user.id) : { messages: 0, notifications: 0 };

  return (
    <header className="relative z-40 bg-surface/95 backdrop-blur-md md:sticky md:-top-8">
      <a href="#main" className="sr-only-focusable absolute top-2 left-2 z-50 bg-brand-600 px-4 py-2 text-sm font-medium text-white">
        Skip to main content
      </a>
      <p className="bg-brand-600 py-2 text-center text-[0.7rem] font-medium tracking-[0.16em] text-white uppercase">
        No selling fees <span aria-hidden="true" className="mx-2 text-[#e2c9a0]">·</span> Buyer Protection on every order
      </p>
      <div className="container-page grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-4">
        <Suspense fallback={<div />}>
          <SearchBox className="hidden max-w-xs md:block" />
        </Suspense>
        <Link href="/" aria-label="Passalong home" className="col-start-1 justify-self-start md:col-start-2 md:justify-self-center">
          <Logo compactOnSmall={!!user} centred />
        </Link>
        <nav aria-label="Account" className="col-start-3 flex items-center justify-self-end gap-0.5">
          {user ? (
            <>
              <Link href="/inbox" className={iconLink}>
                <MessageCircle className="h-[1.25rem] w-[1.25rem]" strokeWidth={1.5} aria-hidden="true" />
                <Badge count={counts.messages} label="Inbox" />
              </Link>
              <Link href="/notifications" className={iconLink}>
                <Bell className="h-[1.25rem] w-[1.25rem]" strokeWidth={1.5} aria-hidden="true" />
                <Badge count={counts.notifications} label="Notifications" />
              </Link>
              <Link href="/favourites" className={`${iconLink} max-sm:hidden`}>
                <Heart className="h-[1.25rem] w-[1.25rem]" strokeWidth={1.5} aria-hidden="true" />
                <span className="sr-only">Favourites</span>
              </Link>
              <UserMenu user={{ name: user.name, username: user.username, image: user.image, isStaff: isStaff(user) }} />
            </>
          ) : (
            <Link href="/login" className="inline-flex min-h-11 items-center px-3 text-[0.72rem] font-medium tracking-[0.14em] uppercase hover:underline hover:underline-offset-4">
              Log in
            </Link>
          )}
          <Link href="/sell" className="btn-primary btn-sm ml-2">Sell</Link>
        </nav>
      </div>
      <div className="container-page pb-3 md:hidden">
        <Suspense fallback={<div className="h-12" />}>
          <SearchBox />
        </Suspense>
      </div>
      <nav aria-label="Categories" className="border-y border-line">
        <ul className="container-page flex gap-8 overflow-x-auto text-[0.72rem] font-medium tracking-[0.14em] whitespace-nowrap uppercase [scrollbar-width:none] md:justify-center">
          <li>
            <Link href="/search?sort=newest" className="inline-flex min-h-11 items-center border-b border-transparent text-ink/80 transition-colors hover:border-ink hover:text-ink">New in</Link>
          </li>
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={`/c/${c.path}`} className="inline-flex min-h-11 items-center border-b border-transparent text-ink/80 transition-colors hover:border-ink hover:text-ink">
                {c.name}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/help" className="inline-flex min-h-11 items-center text-muted hover:text-ink">Help</Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
