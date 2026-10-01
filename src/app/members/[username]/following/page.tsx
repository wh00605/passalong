import { FollowList } from "../follow-list";

export const metadata = { robots: { index: false } };

export default async function FollowingPage({ params }: PageProps<"/members/[username]/following">) {
  const { username } = await params;
  return <FollowList username={username} kind="following" />;
}
