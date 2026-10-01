import { FollowList } from "../follow-list";

export const metadata = { robots: { index: false } };

export default async function FollowersPage({ params }: PageProps<"/members/[username]/followers">) {
  const { username } = await params;
  return <FollowList username={username} kind="followers" />;
}
