import Link from "next/link";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/time";

export const metadata = { title: "Users" };

export default async function AdminUsers({ searchParams }: PageProps<"/admin/users">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const users = await db.user.findMany({
    where: q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { username: { contains: q.toLowerCase() } }, { name: { contains: q, mode: "insensitive" } }, { id: q }] } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, name: true, username: true, email: true, role: true, banned: true, banExpires: true, createdAt: true, warningCount: true, ratingAvg: true, ratingCount: true, deletedAt: true, identityVerifiedAt: true },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-medium">Users</h1>
      <form className="flex gap-2" role="search">
        <label htmlFor="q" className="sr-only">Search users</label>
        <input id="q" name="q" defaultValue={q} placeholder="Email, username, name or ID" className="input max-w-md" />
        <button type="submit" className="btn-primary">Search</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Users</caption>
          <thead><tr className="text-left font-mono text-xs uppercase"><th scope="col" className="py-2">Member</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Joined</th></tr></thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="py-2"><Link href={`/admin/users/${u.id}`} className="link">@{u.username}</Link> <span className="text-muted">{u.name}</span></td>
                <td className="break-all">{u.email}</td>
                <td>{u.role}</td>
                <td className="text-xs">
                  {u.deletedAt ? "deleted" : u.banned ? (u.banExpires ? `suspended to ${u.banExpires.toLocaleDateString("en-GB")}` : "banned") : "active"}
                  {u.warningCount ? ` · ${u.warningCount} warn` : ""}
                  {u.identityVerifiedAt ? " · ID ✓" : ""}
                </td>
                <td className="font-mono text-xs">{timeAgo(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
