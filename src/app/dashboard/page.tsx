import Link from "next/link";
import { Clapperboard, Globe, RotateCw, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getFeed, getFocusingNow, getLeaderboard, getStreak, getTodaySeconds, getWeekStrip, type FeedPost, type FeedTab } from "@/lib/queries";
import { brand } from "@/lib/brand";
import { dayKey, formatDayHeading } from "@/lib/time";
import { PostCard } from "@/components/post-card";
import { Composer } from "@/components/composer";
import { FocusingNowCard, GuestBanner, LeaderboardCard, StreakCard } from "@/components/rail";
import { EmptyState, SectionTitle, btnPrimary } from "@/components/ui";

const TABS = [
  { id: "global", label: "Global", icon: Globe },
  { id: "following", label: "Following", icon: Users },
  { id: "timelapses", label: "Timelapses", icon: Clapperboard },
] as const;

export default async function Home({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabParam } = await searchParams;
  const tab = (TABS.find((t) => t.id === tabParam)?.id ?? "global") as (typeof TABS)[number]["id"];
  const user = await getCurrentUser();
  const goalMin = user?.dailyGoalMin ?? brand.defaultDailyGoalMin;

  const [feed, live, board, streak, todaySec, week] = await Promise.all([
    tab === "timelapses" ? Promise.resolve([] as FeedPost[]) : getFeed(user?.id ?? null, tab as FeedTab),
    getFocusingNow(),
    getLeaderboard("today", 3),
    user ? getStreak(user.id) : Promise.resolve({ current: 0, best: 0 }),
    user ? getTodaySeconds(user.id) : Promise.resolve(0),
    getWeekStrip(user?.id ?? null, goalMin),
  ]);

  // group posts under day headings
  const groups: { heading: string; posts: typeof feed }[] = [];
  for (const p of feed) {
    const heading = formatDayHeading(p.createdAt);
    const last = groups.at(-1);
    if (last && dayKey(last.posts[0].createdAt) === dayKey(p.createdAt)) last.posts.push(p);
    else groups.push({ heading, posts: [p] });
  }

  return (
    <div className="mx-auto flex max-w-[1080px] gap-6 lg:pt-6">
      <main className="min-w-0 flex-1 space-y-4">
        {user ? <Composer name={user.name} /> : <GuestBanner />}

        <div className="flex items-center gap-2">
          <div className="flex flex-1 rounded-full border border-border bg-card p-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <Link
                key={id}
                href={id === "global" ? "/dashboard" : `/dashboard?tab=${id}`}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-bold transition-colors ${
                  tab === id ? "bg-background text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                <Icon className="hidden size-4 sm:block" /> {label}
              </Link>
            ))}
          </div>
          <Link
            href={tab === "global" ? "/dashboard" : `/dashboard?tab=${tab}`}
            className="grid size-10 place-items-center rounded-full border border-border bg-card text-muted hover:text-foreground"
            aria-label="Refresh"
          >
            <RotateCw className="size-4" />
          </Link>
        </div>

        {/* rail cards inline on small screens */}
        <div className="grid gap-3 sm:grid-cols-2 xl:hidden">
          {user && <StreakCard streak={streak.current} todaySec={todaySec} goalMin={goalMin} week={week} />}
          <FocusingNowCard count={live.count} sessions={live.sessions} />
        </div>

        {tab === "timelapses" ? (
          <EmptyState
            title="Timelapses are coming"
            body="Screen-recorded session timelapses need media storage. The data model is ready — this tab lights up once uploads are wired in."
          />
        ) : tab === "following" && !user ? (
          <EmptyState title="Follow people to fill this feed" body="Sign in, then follow friends from the leaderboard." action={<Link href="/signup" className={`${btnPrimary} h-10 text-sm`}>Join free</Link>} />
        ) : feed.length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            body={tab === "following" ? "Follow people from the leaderboard or People page." : "Finish a focus session and share it to start the feed."}
            action={<Link href="/dashboard/timer" className={`${btnPrimary} h-10 text-sm`}>Start focus</Link>}
          />
        ) : (
          groups.map((g) => (
            <section key={g.heading} className="space-y-3">
              <SectionTitle>{g.heading}</SectionTitle>
              {g.posts.map((p) => (
                <PostCard key={p.id} post={p} signedIn={!!user} />
              ))}
            </section>
          ))
        )}
      </main>

      <aside className="sticky top-6 hidden h-fit w-[288px] shrink-0 space-y-3 xl:block">
        <StreakCard streak={streak.current} todaySec={todaySec} goalMin={goalMin} week={week} />
        <FocusingNowCard count={live.count} sessions={live.sessions} />
        <LeaderboardCard rows={board} />
      </aside>
    </div>
  );
}
