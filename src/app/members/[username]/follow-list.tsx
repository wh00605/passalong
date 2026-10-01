import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Avatar } from "@/components/avatar";

export async function FollowList({ username, kind }: { username: string; kind: "followers" | "following" }) {
  const member = await db.user.findFirst({ where: { username: username.toLowerCase(), deletedAt: null }, select: { id: true, name: true, username: true } });
  if (!member) notFound();
  const rows = await db.follow.findMany({
    where: kind === "followers" ? { followingId: member.id } : { followerId: member.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      follower: { select: { name: true, username: true, image: true, deletedAt: true } },
      following: { select: { name: true, username: true, image: true, deletedAt: true } },
    },
  });
  const people = rows.map((r) => (kind === "followers" ? r.follower : r.following)).filter((p) => !p.deletedAt);
  return (
    <div className="container-page max-w-2xl py-8">
      <p className="eyebrow"><Link href={`/members/${member.username}`} className="hover:underline">@{member.username}</Link></p>
      <h1 className="mt-1 text-3xl font-extrabold">{kind === "followers" ? "Followers" : "Following"}</h1>
      {people.length === 0 ? (
        <p className="mt-6 text-muted">{kind === "followers" ? "No followers yet." : "Not following anyone yet."}</p>
      ) : (
        <ul className="mt-6 divide-y-2 divide-line" role="list">
          {people.map((p) => (
            <li key={p.username}>
              <Link href={`/members/${p.username}`} className="flex items-center gap-3 py-3 hover:bg-surface">
                <Avatar name={p.name} image={p.image} size={44} />
                <span>
                  <span className="block font-semibold">{p.name}</span>
                  <span className="font-mono text-xs text-muted">@{p.username}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
