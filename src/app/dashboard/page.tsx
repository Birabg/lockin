import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getFeed, getFocusingNow, getLeaderboard, getStreak, getTodaySeconds, getWeekStrip, type FeedTab } from "@/lib/queries";
import { brand } from "@/lib/brand";
import { FeedList } from "@/components/feed-list";
import { Composer } from "@/components/composer";
import { Icon } from "@/components/icon";
import { FocusingNowCard, GuestBanner, LeaderboardCard, StreakCard } from "@/components/rail";
import { EmptyState, btnPrimary } from "@/components/ui";

const TABS = [
  { id: "global", label: "Global", icon: "global" },
  { id: "following", label: "Following", icon: "following" },
  { id: "timelapses", label: "Timelapses", icon: "timelapses" },
] as const;

export default async function Home({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabParam } = await searchParams;
  const tab = (TABS.find((t) => t.id === tabParam)?.id ?? "global") as (typeof TABS)[number]["id"];
  const user = await getCurrentUser();
  const goalMin = user?.dailyGoalMin ?? brand.defaultDailyGoalMin;
  const timeZone = user?.timeZone ?? brand.timeZone;

  const [feed, live, board, streak, todaySec, week] = await Promise.all([
    getFeed(user?.id ?? null, tab as FeedTab),
    getFocusingNow(),
    getLeaderboard("today", timeZone, { pageSize: 3 }),
    user ? getStreak(user) : Promise.resolve({ current: 0, best: 0 }),
    user ? getTodaySeconds(user) : Promise.resolve(0),
    getWeekStrip(user, timeZone, goalMin),
  ]);

  return (
    <div className="dash-columns mx-auto max-w-(--feed-width) lg:pt-4 xl:max-w-none">
      <main className="min-w-0 xl:w-(--feed-width) xl:shrink-[0.1]">
        {/* TODO(stories): a "Your story" avatar row goes on the left of this row */}
        <div className="mb-2 hidden justify-end lg:flex">
          <Link
            href="/dashboard/people"
            aria-label="Find people"
            className="grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-inset hover:text-foreground"
          >
            <Icon name="search" size={22} />
          </Link>
        </div>

        {user ? <Composer name={user.name} avatar={user.avatar} /> : <GuestBanner />}

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex max-w-[360px] flex-1 rounded-[20px] bg-inset/60 p-1">
            {TABS.map(({ id, label, icon }) => (
              <Link
                key={id}
                href={id === "global" ? "/dashboard" : `/dashboard?tab=${id}`}
                className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-2xl px-2 text-[13px] leading-[19.5px] transition-colors ${
                  tab === id ? "bg-background font-extrabold text-foreground" : "font-semibold text-muted hover:text-foreground"
                }`}
              >
                <Icon name={icon} size={18} active={tab === id} className="hidden sm:block" /> {label}
              </Link>
            ))}
          </div>
          <Link
            href={tab === "global" ? "/dashboard" : `/dashboard?tab=${tab}`}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-card text-muted hover:text-foreground"
            aria-label="Refresh"
          >
            <Icon name="refresh" size={18} />
          </Link>
        </div>

        {/* rail cards inline on small screens */}
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:hidden">
          {user && <StreakCard streak={streak.current} todaySec={todaySec} goalMin={goalMin} week={week} />}
          <FocusingNowCard count={live.count} sessions={live.sessions} />
        </div>

        {tab === "following" && !user ? (
          <EmptyState
            className="mt-5"
            title="Follow people to fill this feed"
            body="Sign in, then follow friends from the leaderboard."
            action={
              <Link href="/signup" className={`${btnPrimary} h-10 text-sm`}>
                Join free
              </Link>
            }
          />
        ) : feed.posts.length === 0 ? (
          <EmptyState
            className="mt-5"
            title="Nothing here yet"
            body={
              tab === "following"
                ? "Follow people from the leaderboard or People page."
                : tab === "timelapses"
                  ? "Tick “Record a timelapse” when you start a session, then share it."
                  : "Finish a focus session and share it to start the feed."
            }
            action={
              <Link href="/dashboard/timer" className={`${btnPrimary} h-10 text-sm`}>
                Start focus
              </Link>
            }
          />
        ) : (
          <FeedList key={tab} initial={feed.posts} hasMore={feed.hasMore} tab={tab as FeedTab} viewer={user} timeZone={timeZone} grouped />
        )}
      </main>

      {/* this box also holds the gap before the rail, so it shares the spare width with the page's side gaps */}
      <aside className="hidden min-w-[calc(var(--rail-width)+24px)] flex-[188_1_calc(var(--rail-width)+60px)] justify-end xl:flex">
        <div className="sticky top-4 h-fit w-(--rail-width) space-y-2.5 pr-1">
          <StreakCard streak={streak.current} todaySec={todaySec} goalMin={goalMin} week={week} />
          <FocusingNowCard count={live.count} sessions={live.sessions} />
          <LeaderboardCard rows={board.rows} />
        </div>
      </aside>
    </div>
  );
}
