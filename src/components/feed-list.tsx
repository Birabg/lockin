"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { loadMoreFeed } from "@/app/actions/social";
import { PostCard, type Viewer } from "./post-card";
import { SectionTitle, btnGhost } from "./ui";
import type { FeedPost, FeedTab } from "@/lib/queries";
import { dayKey, formatDayHeading } from "@/lib/time";

type Props = {
  initial: FeedPost[];
  hasMore: boolean;
  tab: FeedTab;
  authorId?: string;
  viewer: Viewer | null;
  timeZone: string;
  grouped?: boolean;
};

const newestFirst = (a: FeedPost, b: FeedPost) =>
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id.localeCompare(a.id);

export function FeedList({ initial, hasMore, tab, authorId, viewer, timeZone, grouped = false }: Props) {
  const [posts, setPosts] = useState(initial);
  const [more, setMore] = useState(hasMore);
  const [failed, setFailed] = useState(false);
  const [posting, setPosting] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const sentinel = useRef<HTMLDivElement>(null);

  // the composer announces a post right away, and the real one arrives with the next server data
  useEffect(() => {
    const onPosting = (e: Event) => setPosting((e as CustomEvent<string | null>).detail);
    window.addEventListener("lockin:posting", onPosting);
    return () => window.removeEventListener("lockin:posting", onPosting);
  }, []);

  // fresh server data wins, and pages already scrolled in stay put
  useEffect(() => {
    setPosting(null);
    setPosts((current) => {
      const fresh = new Set(initial.map((p) => p.id));
      return [...initial, ...current.filter((p) => !fresh.has(p.id))].sort(newestFirst);
    });
  }, [initial]);

  const lastId = posts.at(-1)?.id;

  const loadMore = useCallback(() => {
    if (pending || !more || !lastId) return;
    setFailed(false);
    start(async () => {
      try {
        const page = await loadMoreFeed({ tab, cursor: lastId, authorId });
        setPosts((current) => {
          const seen = new Set(current.map((p) => p.id));
          return [...current, ...page.posts.filter((p) => !seen.has(p.id))];
        });
        setMore(page.hasMore);
      } catch {
        setFailed(true);
      }
    });
  }, [pending, more, lastId, tab, authorId]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || failed) return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadMore(), { rootMargin: "600px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, failed]);

  const groups: { key: string; heading: string; posts: FeedPost[] }[] = [];
  for (const p of posts) {
    const date = new Date(p.createdAt);
    const key = grouped ? dayKey(date, timeZone) : "all";
    const last = groups.at(-1);
    if (last?.key === key) last.posts.push(p);
    else groups.push({ key, heading: formatDayHeading(date, timeZone), posts: [p] });
  }

  return (
    <>
      {posting && <div className="panel p-4 text-[15px] whitespace-pre-wrap opacity-60">{posting}</div>}
      {groups.map((g) => (
        <section key={g.key} className="space-y-3">
          {grouped && <SectionTitle>{g.heading}</SectionTitle>}
          {g.posts.map((p) => (
            <PostCard key={p.id} post={p} viewer={viewer} timeZone={timeZone} />
          ))}
        </section>
      ))}
      {more && (
        <div ref={sentinel} className="flex justify-center py-4">
          <button onClick={loadMore} disabled={pending} className={`${btnGhost} h-10 text-sm`}>
            {pending ? "Loading…" : failed ? "Couldn’t load. Try again" : "Load more"}
          </button>
        </div>
      )}
    </>
  );
}
