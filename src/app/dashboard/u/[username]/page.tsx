import "./profile.css";
import "../../stats/stats.css";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { siteOpenGraph } from "@/lib/seo";
import { Icon } from "@/components/icon";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { brand } from "@/lib/brand";
import { getFeed, getFocusHistory, getProfile, getStreak, getTopLabels } from "@/lib/queries";
import { LIVE_MS } from "@/lib/session-math";
import { formatDuration } from "@/lib/time";
import { Avatar, btnGhost, btnPrimary, colorFor } from "@/components/ui";
import { FollowButton } from "@/components/follow-button";
import { ProfileMenu } from "@/components/profile-menu";
import { BuddyRequestButton } from "@/components/buddy-actions";
import { CopyButton } from "@/components/copy-button";
import { FeedList } from "@/components/feed-list";
import { getBuddyState } from "@/lib/social-features";
import { HeatLegend, Heatmap } from "../../stats/charts";

// about 9 months: as many weeks as fit across the card at full width
const HISTORY_WEEKS = 40;

// The preview image is ./opengraph-image.tsx. Public fields only: there are no private profiles.
export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const user = await db.user.findUnique({ where: { username }, select: { name: true, username: true } });
  if (!user) return { title: "Profile not found" };
  const title = `${user.name} on ${brand.name}`;
  const description = `Follow @${user.username}'s focus sessions, streaks and progress on ${brand.name}.`;
  return {
    title: { absolute: title },
    description,
    openGraph: { ...siteOpenGraph, type: "profile", username: user.username, url: `/dashboard/u/${user.username}`, title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const viewer = await getCurrentUser();
  const profile = await getProfile(username, viewer?.id ?? null);
  if (!profile) notFound();

  const own = viewer?.id === profile.id;
  const [streak, totals, feed, history, subjects, live, followsYou, buddy] = await Promise.all([
    getStreak(profile),
    db.focusSession.aggregate({ where: { userId: profile.id, status: "DONE" }, _sum: { durationSec: true }, _count: true }),
    getFeed(viewer?.id ?? null, "global", { authorId: profile.id }),
    getFocusHistory(profile, HISTORY_WEEKS),
    getTopLabels(profile.id, 4),
    db.focusSession.findFirst({
      where: { userId: profile.id, status: "ACTIVE", pausedAt: null, lastBeatAt: { gte: new Date(Date.now() - LIVE_MS) } },
      select: { label: true },
    }),
    viewer && !own
      ? db.follow.findUnique({ where: { followerId_followingId: { followerId: profile.id, followingId: viewer.id } } }).then(Boolean)
      : false,
    viewer && !own ? getBuddyState(viewer.id, profile.id) : null,
  ]);

  const first = profile.name.split(" ")[0];
  const joined = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(profile.createdAt);
  const stats = [
    { k: "Streak", v: `${streak.current}d`, sub: `best ${streak.best}d`, tone: streak.current > 0 ? "text-streak" : "", flame: true },
    { k: "Focused", v: formatDuration(totals._sum.durationSec ?? 0), sub: "all time" },
    { k: "Sessions", v: String(totals._count), sub: "finished" },
    { k: "Followers", v: String(profile._count.followers), href: own ? "/dashboard/people?tab=followers" : undefined },
    { k: "Following", v: String(profile._count.following), href: own ? "/dashboard/people?tab=following" : undefined },
  ];

  return (
    <div className="mx-auto max-w-[720px]">
      <section className="panel profile-card">
        <div className="profile-cover" style={{ ["--cover" as string]: colorFor(profile.name) }} aria-hidden />

        <div className="profile-top">
          <span className="profile-avatar" data-live={!!live || undefined}>
            <Avatar name={profile.name} src={profile.avatar} cssSize="var(--profile-avatar)" />
          </span>

          <div className="profile-actions">
            {own ? (
              <>
                <CopyButton
                  text={`/dashboard/u/${profile.username}`}
                  share={{ title: `${profile.name} on ${brand.name}` }}
                  className={`${btnGhost} h-10 text-sm`}
                >
                  Share
                </CopyButton>
                <Link href="/dashboard/settings" className={`${btnPrimary} h-10 text-sm`}>
                  <Icon name="compose" size={16} /> Edit profile
                </Link>
              </>
            ) : (
              <>
                {buddy && <BuddyRequestButton userId={profile.id} state={buddy.state} id={buddy.id} />}
                <FollowButton
                  userId={profile.id}
                  following={profile.isFollowing}
                  followsYou={followsYou}
                  signedIn={!!viewer}
                  name={profile.name}
                />
                {viewer && <ProfileMenu userId={profile.id} username={profile.username} muting={profile.muting} />}
              </>
            )}
          </div>
        </div>

        <div className="profile-body">
          <h1 className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[24px] leading-tight font-extrabold tracking-tight">{profile.name}</span>
            {followsYou && <span className="profile-badge">Follows you</span>}
          </h1>
          <p className="text-[14px] text-muted">@{profile.username}</p>

          {live && (
            <p className="profile-live">
              <span className="profile-live-dot" aria-hidden /> Locked In{live.label ? ` · ${live.label}` : ""}
            </p>
          )}

          {profile.bio ? (
            <p className="mt-3 text-[14.5px] leading-relaxed whitespace-pre-line">{profile.bio}</p>
          ) : (
            own && (
              <Link href="/dashboard/settings" className="profile-add-bio">
                <Icon name="add" size={15} /> Add a short bio so people know what you’re working on
              </Link>
            )
          )}

          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] font-semibold text-subtle">
            <span className="flex items-center gap-1.5">
              <Icon name="time" size={14} /> Joined {joined}
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="target" size={14} /> {formatDuration(profile.dailyGoalMin * 60)} daily goal
            </span>
          </p>

          {subjects.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Works on">
              {subjects.map((s) => (
                <li key={s} className="profile-chip">
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>

        <dl className="profile-stats">
          {stats.map((x) => {
            const inner = (
              <>
                <dt className="text-[11.5px] font-semibold text-muted">{x.k}</dt>
                <dd className={`flex items-center gap-1 text-[18px] leading-tight font-extrabold tabular ${x.tone ?? ""}`}>
                  {x.flame && (
                    <Icon
                      name="streak"
                      size={17}
                      solid={streak.current > 0}
                      className={streak.current > 0 ? "streak-glow" : "text-subtle"}
                    />
                  )}
                  {x.v}
                </dd>
                {x.sub && <dd className="text-[11px] font-semibold text-subtle">{x.sub}</dd>}
              </>
            );
            return x.href ? (
              <Link key={x.k} href={x.href} className="profile-stat profile-stat-link">
                {inner}
              </Link>
            ) : (
              <div key={x.k} className="profile-stat">
                {inner}
              </div>
            );
          })}
        </dl>
      </section>

      <section className="panel profile-section">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold">Consistency</h2>
            <p className="text-[12.5px] font-semibold text-subtle">
              {history.activeDays} active {history.activeDays === 1 ? "day" : "days"} in the last 9 months
              {history.bestDay ? ` · best day ${formatDuration(history.bestDay.sec)}` : ""}
            </p>
          </div>
          <HeatLegend />
        </div>
        <Heatmap days={history.days} goalSec={profile.dailyGoalMin * 60} today={history.today} />
      </section>

      <h2 className="mt-6 mb-3 px-1 text-[15px] font-bold">
        Sessions {feed.posts.length > 0 && <span className="text-subtle">· shared to the feed</span>}
      </h2>
      <div className="space-y-3">
        {feed.posts.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-6 py-10 text-center">
            <span className="mb-1 grid size-12 place-items-center rounded-2xl bg-inset text-subtle">
              <Icon name="timelapses" size={22} />
            </span>
            <p className="text-[15px] font-bold">{own ? "You haven’t shared a session yet" : `${first} hasn’t shared a session yet`}</p>
            <p className="max-w-[320px] text-[13px] text-muted">
              {own ? "When you finish a session, share it to the feed and it shows up here." : "Their shared sessions will show up here."}
            </p>
            {own && (
              <Link href="/dashboard/timer" className={`${btnPrimary} mt-2 h-10 text-sm`}>
                <Icon name="startFocus" size={16} solid /> Start a session
              </Link>
            )}
          </div>
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
