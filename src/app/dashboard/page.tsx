import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getFeed, type FeedTab } from "@/lib/queries";
import { brand } from "@/lib/brand";
import { FeedList } from "@/components/feed-list";
import { Composer } from "@/components/composer";
import { GuestBanner } from "@/components/rail";
import { EmptyState, btnPrimary } from "@/components/ui";

const TABS = ["global", "following", "timelapses"] as const;

/** The feed. Its tabs live in the top bar, and the streak, live and leaderboard widgets in the dock. */
export default async function Home({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabParam } = await searchParams;
  const tab: FeedTab = TABS.find((t) => t === tabParam) ?? "global";
  const user = await getCurrentUser();
  const timeZone = user?.timeZone ?? brand.timeZone;
  const feed = await getFeed(user?.id ?? null, tab);

  return (
    <div className="mx-auto max-w-(--content-width)">
      <h1 className="sr-only">Home</h1>
      {user ? <Composer name={user.name} avatar={user.avatar} /> : <GuestBanner />}

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
              Lock in
            </Link>
          }
        />
      ) : (
        <div className="mt-5">
          <FeedList key={tab} initial={feed.posts} hasMore={feed.hasMore} tab={tab} viewer={user} timeZone={timeZone} grouped />
        </div>
      )}
    </div>
  );
}
