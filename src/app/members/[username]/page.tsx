import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Clock, MapPin, Plane } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { searchListings } from "@/lib/listings";
import { ListingGrid } from "@/components/listing-grid";
import { Avatar } from "@/components/avatar";
import { Stars } from "@/components/stars";
import { ReportButton } from "@/components/report-button";
import { responseTimeLabel, timeAgo, formatDate } from "@/lib/time";
import { siteUrl } from "@/lib/env";
import { FollowButton, BlockButton } from "./profile-actions";

async function load(username: string) {
  return db.user.findFirst({
    where: { username: username.toLowerCase(), deletedAt: null },
    select: {
      id: true, name: true, username: true, image: true, bio: true, location: true, createdAt: true, lastActiveAt: true,
      showOnlineStatus: true, avgResponseMinutes: true, ratingAvg: true, ratingCount: true, followerCount: true,
      followingCount: true, holidayMode: true, identityVerifiedAt: true, allowSearchIndexing: true, banned: true,
      bundleDiscountsEnabled: true, bundleTiers: { orderBy: { minItems: "asc" } },
    },
  });
}

export async function generateMetadata({ params }: PageProps<"/members/[username]">): Promise<Metadata> {
  const { username } = await params;
  const u = await load(username);
  if (!u) return { title: "Member not found" };
  return {
    title: `${u.name} (@${u.username})`,
    description: u.bio?.slice(0, 160) || `Shop ${u.name}'s wardrobe on Passalong.`,
    alternates: { canonical: `/members/${u.username}` },
    robots: u.allowSearchIndexing && !u.banned ? undefined : { index: false, follow: false },
  };
}

export default async function MemberPage({ params, searchParams }: PageProps<"/members/[username]">) {
  const { username } = await params;
  const sp = await searchParams;
  const tab = sp.tab === "reviews" ? "reviews" : "wardrobe";
  const page = Number(sp.page) || 1;
  const [member, viewer] = await Promise.all([load(username), getCurrentUser()]);
  if (!member) notFound();
  const isMe = viewer?.id === member.id;

  const [following, blocked, listings, reviews, activeCount] = await Promise.all([
    viewer && !isMe ? db.follow.findUnique({ where: { followerId_followingId: { followerId: viewer.id, followingId: member.id } } }) : null,
    viewer && !isMe ? db.block.findUnique({ where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: member.id } } }) : null,
    tab === "wardrobe" && !member.holidayMode && !member.banned ? searchListings({ sellerId: member.id, sort: "newest", page }) : null,
    tab === "reviews"
      ? db.review.findMany({
          where: { subjectId: member.id },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: { id: true, rating: true, text: true, isAutomatic: true, authorRole: true, createdAt: true, author: { select: { name: true, username: true, image: true } } },
        })
      : null,
    db.listing.count({ where: { sellerId: member.id, status: { in: ["ACTIVE", "RESERVED"] }, moderationStatus: "OK" } }),
  ]);

  const respond = responseTimeLabel(member.avgResponseMinutes);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: member.name,
      alternateName: `@${member.username}`,
      url: `${siteUrl}/members/${member.username}`,
      ...(member.image ? { image: member.image } : {}),
    },
  };

  return (
    <div className="container-page py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <section className="grid gap-6 border-b-2 border-ink pb-8 md:grid-cols-[auto_1fr_auto] md:items-start" aria-labelledby="member-name">
        <Avatar name={member.name} image={member.image} size={112} />
        <div>
          <h1 id="member-name" className="flex flex-wrap items-center gap-2 text-3xl font-extrabold sm:text-4xl">
            {member.name}
            {member.identityVerifiedAt && (
              <span className="inline-flex items-center gap-1 rounded-sm border-2 border-ink bg-accent-400 px-1.5 py-0.5 font-mono text-xs font-semibold">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Verified seller
              </span>
            )}
          </h1>
          <p className="font-mono text-sm text-muted">@{member.username}</p>
          <div className="mt-2">
            {member.ratingCount > 0 ? (
              <Link href={`/members/${member.username}?tab=reviews`} className="inline-flex hover:underline">
                <Stars rating={member.ratingAvg} count={member.ratingCount} />
              </Link>
            ) : (
              <span className="text-sm text-muted">No reviews yet</span>
            )}
          </div>
          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <div className="flex gap-1"><dt className="sr-only">Followers</dt><dd><Link href={`/members/${member.username}/followers`} className="hover:underline"><strong>{member.followerCount}</strong> followers</Link></dd></div>
            <div className="flex gap-1"><dt className="sr-only">Following</dt><dd><Link href={`/members/${member.username}/following`} className="hover:underline"><strong>{member.followingCount}</strong> following</Link></dd></div>
            {member.location && <div className="flex items-center gap-1"><dt className="sr-only">Location</dt><MapPin className="h-4 w-4" aria-hidden="true" /><dd>{member.location}</dd></div>}
            {member.showOnlineStatus && member.lastActiveAt && (
              <div className="flex items-center gap-1"><dt className="sr-only">Last active</dt><Clock className="h-4 w-4" aria-hidden="true" /><dd>Active {timeAgo(member.lastActiveAt)}</dd></div>
            )}
            {respond && <div><dt className="sr-only">Response time</dt><dd>{respond}</dd></div>}
            <div><dt className="sr-only">Member since</dt><dd className="text-muted">Joined {formatDate(member.createdAt)}</dd></div>
          </dl>
          {member.bio && <p className="mt-4 max-w-2xl whitespace-pre-line">{member.bio}</p>}
          {member.bundleDiscountsEnabled && member.bundleTiers.length > 0 && (
            <p className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-md border-2 border-ink bg-surface px-3 py-2 text-sm">
              <span className="font-semibold">Bundle & save:</span>
              {member.bundleTiers.map((t) => (
                <span key={t.id} className="tag text-xs">{t.minItems}+ items −{t.percentOff}%</span>
              ))}
              {!isMe && <Link href={`/members/${member.username}/bundle`} className="link">Build a bundle</Link>}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 md:flex-col md:items-stretch">
          {isMe ? (
            <Link href="/settings/profile" className="btn-secondary">Edit profile</Link>
          ) : viewer ? (
            <>
              <FollowButton targetId={member.id} initial={!!following} name={member.name} />
              <ReportButton targetType="USER" targetId={member.id} label="Report member" className="btn-ghost btn-sm" />
              <BlockButton targetId={member.id} initial={!!blocked} name={member.name} />
            </>
          ) : (
            <Link href={`/login?next=/members/${member.username}`} className="btn-primary">Log in to follow</Link>
          )}
        </div>
      </section>

      {member.holidayMode && (
        <p className="mt-6 flex items-center gap-2 rounded-md border-2 border-ink bg-accent-300 px-4 py-3 font-semibold">
          <Plane className="h-5 w-5" aria-hidden="true" /> {member.name} is on holiday – their items are hidden for now.
        </p>
      )}

      <nav aria-label="Profile sections" className="mt-6 flex gap-2">
        <Link href={`/members/${member.username}`} aria-current={tab === "wardrobe" ? "page" : undefined} className={`btn-sm btn ${tab === "wardrobe" ? "bg-ink text-surface" : "bg-surface"}`}>
          Wardrobe <span className="font-mono text-xs opacity-70">{activeCount}</span>
        </Link>
        <Link href={`/members/${member.username}?tab=reviews`} aria-current={tab === "reviews" ? "page" : undefined} className={`btn-sm btn ${tab === "reviews" ? "bg-ink text-surface" : "bg-surface"}`}>
          Reviews <span className="font-mono text-xs opacity-70">{member.ratingCount}</span>
        </Link>
      </nav>

      <div className="mt-6">
        {tab === "wardrobe" && listings && (
          <>
            <ListingGrid listings={listings.items} empty={isMe ? <>Your wardrobe is empty. <Link href="/sell" className="link">List your first item</Link></> : "No items for sale right now."} />
            {listings.pageCount > 1 && (
              <nav aria-label="Pages" className="mt-8 flex justify-center gap-2">
                {page > 1 && <Link className="btn-secondary btn-sm" href={`/members/${member.username}?page=${page - 1}`}>Previous</Link>}
                <span className="inline-flex items-center px-3 font-mono text-sm">Page {page} of {listings.pageCount}</span>
                {page < listings.pageCount && <Link className="btn-secondary btn-sm" href={`/members/${member.username}?page=${page + 1}`}>Next</Link>}
              </nav>
            )}
          </>
        )}
        {tab === "reviews" && reviews && (
          reviews.length === 0 ? (
            <p className="rounded-md border-2 border-dashed border-ink/40 p-8 text-center text-muted">No reviews yet.</p>
          ) : (
            <ul className="max-w-3xl divide-y-2 divide-line" role="list">
              {reviews.map((r) => (
                <li key={r.id} className="flex gap-3 py-4">
                  <Avatar name={r.author.name} image={r.author.image} size={40} />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <Link href={`/members/${r.author.username}`} className="font-semibold hover:underline">{r.author.name}</Link>
                      <span className="font-mono text-xs text-muted">{r.authorRole === "BUYER" ? "Bought from" : "Sold to"} {member.name.split(" ")[0]} · {timeAgo(r.createdAt)}</span>
                    </p>
                    <Stars rating={r.rating} size={14} />
                    {r.isAutomatic ? <p className="mt-1 text-sm text-muted italic">Automatic feedback: sale completed successfully.</p> : r.text && <p className="mt-1">{r.text}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </div>
  );
}
