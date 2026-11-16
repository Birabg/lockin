import type { Metadata } from "next";
import Link from "next/link";
import { siteOpenGraph } from "@/lib/seo";
import { getCurrentUser } from "@/lib/auth";
import { getFeed, type FeedTab } from "@/lib/queries";
import { brand } from "@/lib/brand";
import { FeedList } from "@/components/feed-list";
import { Composer } from "@/components/composer";
import { GuestBanner } from "@/components/rail";
import { EmptyState, btnPrimary } from "@/components/ui";
import { CommunityProvider } from "@/components/community/community-provider";
import { SignInPrompt } from "@/components/community/modal";
import { QuestBoard, QuestStrip } from "@/components/community/quests";
import { QuestionCard, TheWall } from "@/components/community/wall";

const TABS = ["global", "following", "timelapses"] as const;

// "/" redirects here, so a link to the bare domain gets this page's card; point it back at "/".
// Setting openGraph here drops the inherited image, so it's listed again (app/opengraph-image.tsx).
export const metadata: Metadata = {
  openGraph: {
    ...siteOpenGraph,
    url: "/",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, type: "image/png", alt: `${brand.name}: ${brand.tagline}` }],
  },
};

/**
 * The feed, with the quest board on the left and the wall on the right on wide screens. Narrower, the
 * quests become a row above the feed and the question of the day sits after the second post.
 * The panels load on their own, after the feed, so they never hold it up.
 */
export default async function Home({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabParam } = await searchParams;
  const tab: FeedTab = TABS.find((t) => t === tabParam) ?? "global";
  const user = await getCurrentUser();
  const timeZone = user?.timeZone ?? brand.timeZone;
  const feed = await getFeed(user?.id ?? null, tab);

  const question = (
    <div className="home-inline">
      <QuestionCard inline />
    </div>
  );

  return (
    <CommunityProvider quests wall>
      <div className="home-grid">
        <aside className="home-side" aria-label="Quest board">
          <QuestBoard />
        </aside>
        <div className="mx-auto w-full min-w-0 max-w-(--content-width)">
          <h1 className="sr-only">Home</h1>
          {user ? <Composer name={user.name} avatar={user.avatar} /> : <GuestBanner />}
          <div className="home-inline">
            <QuestStrip />
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
                  Lock in
                </Link>
              }
            />
          ) : (
            <div className="mt-5">
              <FeedList
                key={tab}
                initial={feed.posts}
                hasMore={feed.hasMore}
                tab={tab}
                viewer={user}
                timeZone={timeZone}
                grouped
                afterSecond={question}
              />
            </div>
          )}
          {(feed.posts.length === 0 || (tab === "following" && !user)) && question}
        </div>
        <aside className="home-side" aria-label="The wall">
          <TheWall />
        </aside>
      </div>
      <SignInPrompt />
    </CommunityProvider>
  );
}
