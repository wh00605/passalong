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
      <span aria-hidden="true" className="absolute top-0.5 right-0.5 min-w-[1.15rem] rounded-full bg-hot px-1 text-center text-[10px] leading-[1.15rem] font-bold text-white ring-2 ring-surface">
        {count > 99 ? "99+" : count}
      </span>
      <span className="sr-only">
        {label}, {count} unread
      </span>
    </>
  );
}

const iconLink = "relative inline-flex h-10 w-10 items-center justify-center rounded-full text-ink/75 transition-colors hover:bg-shade hover:text-ink";

export async function SiteHeader() {
  const [user, categories] = await Promise.all([getCurrentUser(), getTopCategories()]);
  const counts = user ? await getUnreadCounts(user.id) : { messages: 0, notifications: 0 };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface">
      <a href="#main" className="sr-only-focusable absolute top-2 left-2 z-50 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
        Skip to main content
      </a>
      <div className="container-page flex items-center gap-4 py-2.5">
        <Link href="/" aria-label="Passalong home" className="shrink-0">
          <Logo compactOnSmall={!!user} />
        </Link>
        <Suspense fallback={<div className="hidden flex-1 md:block" />}>
          <SearchBox className="hidden flex-1 md:block" />
        </Suspense>
        <nav aria-label="Account" className="ml-auto flex items-center gap-1">
          {user ? (
            <>
              <Link href="/inbox" className={iconLink}>
                <MessageCircle className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                <Badge count={counts.messages} label="Inbox" />
              </Link>
              <Link href="/notifications" className={iconLink}>
                <Bell className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                <Badge count={counts.notifications} label="Notifications" />
              </Link>
              <Link href="/favourites" className={`${iconLink} max-sm:hidden`}>
                <Heart className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                <span className="sr-only">Favourites</span>
              </Link>
              <UserMenu user={{ name: user.name, username: user.username, image: user.image, isStaff: isStaff(user) }} />
            </>
          ) : (
            <>
              <Link href="/login" className="inline-flex min-h-10 items-center rounded-full px-3 text-sm font-semibold hover:bg-shade">Log in</Link>
              <Link href="/signup" className="btn-secondary btn-sm max-sm:hidden">Join</Link>
            </>
          )}
          <Link href="/sell" className="btn-primary btn-sm ml-1.5 gap-1 pl-3">
            <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
            <span className="max-[380px]:sr-only">List an item</span>
          </Link>
        </nav>
      </div>
      <div className="container-page pb-2.5 md:hidden">
        <Suspense fallback={<div className="h-11" />}>
          <SearchBox />
        </Suspense>
      </div>
      <nav aria-label="Categories" className="max-md:border-t max-md:border-line">
        <ul className="container-page flex gap-5 overflow-x-auto text-sm whitespace-nowrap [scrollbar-width:none]">
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={`/c/${c.path}`} className="inline-flex min-h-10 items-center border-b-2 border-transparent px-1 text-ink/80 transition-colors hover:border-coral hover:text-ink">
                {c.name}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/search?sort=newest" className="inline-flex min-h-10 items-center border-b-2 border-transparent px-1 font-semibold text-coral-700 hover:border-coral">Just listed</Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
