import { notFound } from "next/navigation";
import { Flame } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { brand } from "@/lib/brand";
import { getFeed, getProfile, getStreak } from "@/lib/queries";
import { formatDuration } from "@/lib/time";
import { Avatar, EmptyState } from "@/components/ui";
import { FollowButton } from "@/components/follow-button";
import { FeedList } from "@/components/feed-list";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  return { title: `@${(await params).username}` };
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const viewer = await getCurrentUser();
  const profile = await getProfile(username, viewer?.id ?? null);
  if (!profile) notFound();

  const [streak, total, feed] = await Promise.all([
    getStreak(profile),
    db.focusSession.aggregate({ where: { userId: profile.id, status: "DONE" }, _sum: { durationSec: true } }),
    getFeed(viewer?.id ?? null, "global", { authorId: profile.id }),
  ]);

  const stats = [
    { k: "Streak", v: `${streak.current}d`, flame: true },
    { k: "Focused", v: formatDuration(total._sum.durationSec ?? 0) },
    { k: "Followers", v: String(profile._count.followers) },
    { k: "Following", v: String(profile._count.following) },
  ];

  return (
    <div className="mx-auto max-w-[680px] lg:pt-6">
      <section className="panel p-5">
        <div className="flex items-start gap-4">
          <Avatar name={profile.name} src={profile.avatar} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-extrabold">{profile.name}</h1>
            <p className="text-sm text-muted">@{profile.username}</p>
            {profile.bio && <p className="mt-2 text-sm">{profile.bio}</p>}
          </div>
          {viewer?.id !== profile.id && <FollowButton userId={profile.id} following={profile.isFollowing} signedIn={!!viewer} />}
        </div>
        <dl className="mt-5 grid grid-cols-4 gap-2 text-center">
          {stats.map((x) => (
            <div key={x.k} className="flex flex-col-reverse rounded-xl bg-inset py-3">
              <dt className="text-[11px] font-semibold text-muted">{x.k}</dt>
              <dd className="flex items-center justify-center gap-1 font-extrabold tabular">
                {x.flame && <Flame className="size-4 text-streak" fill="currentColor" />}
                {x.v}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-4 space-y-3">
        {feed.posts.length === 0 ? (
          <EmptyState title="No posts yet" body={`${profile.name} hasn’t shared a session yet.`} />
        ) : (
          <FeedList
            initial={feed.posts}
            hasMore={feed.hasMore}
            tab="global"
            authorId={profile.id}
            viewer={viewer}
            timeZone={viewer?.timeZone ?? brand.timeZone}
          />
        )}
      </div>
    </div>
  );
}
