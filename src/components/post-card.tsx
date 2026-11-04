"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { Flame, Heart, MessageCircle, Send, Share2 } from "lucide-react";
import { Avatar, GoalRing } from "./ui";
import { addComment, toggleLike } from "@/app/actions/social";
import { formatClock, formatDuration, timeAgo } from "@/lib/time";
import type { FeedPost } from "@/lib/queries";

export function PostCard({ post, signedIn }: { post: FeedPost; signedIn: boolean }) {
  const [pending, start] = useTransition();
  const [like, setLike] = useOptimistic(
    { liked: post.liked, count: post.likeCount },
    (s) => ({ liked: !s.liked, count: s.count + (s.liked ? -1 : 1) }),
  );
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState("");
  const s = post.session;
  const pct = s ? s.durationSec / (s.goalMin * 60) : 0;
  const createdAt = new Date(post.createdAt);

  function onLike() {
    if (!signedIn) return (window.location.href = "/signup");
    start(async () => {
      setLike(null);
      await toggleLike(post.id);
    });
  }

  function onComment(e: React.FormEvent) {
    e.preventDefault();
    const body = draft;
    setDraft("");
    start(() => addComment(post.id, body));
  }

  async function onShare() {
    const url = `${window.location.origin}/dashboard/u/${post.user.username}`;
    if (navigator.share) await navigator.share({ title: post.body, url }).catch(() => {});
    else await navigator.clipboard?.writeText(url);
  }

  return (
    <article className="panel overflow-hidden">
      <header className="flex items-center gap-3 p-4 pb-3">
        <Link href={`/dashboard/u/${post.user.username}`}>
          <Avatar name={post.user.name} size={40} />
        </Link>
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[15px] font-bold">
            <Link href={`/dashboard/u/${post.user.username}`} className="truncate hover:underline">
              {post.user.name}
            </Link>
            <span className="truncate text-xs font-medium text-subtle">@{post.user.username}</span>
          </p>
          <p className="flex items-center gap-2 text-xs text-muted">
            {timeAgo(createdAt)}
            {post.streak > 0 && (
              <span className="flex items-center gap-0.5 font-bold text-streak">
                <Flame className="size-3" fill="currentColor" />
                {post.streak}d
              </span>
            )}
          </p>
        </div>
      </header>

      {s && (
        <div className="mx-4 grid gap-3 rounded-xl border border-border bg-inset p-3 sm:grid-cols-[1fr_auto]">
          <div className="flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-baseline justify-between text-xs font-semibold text-muted">
                <span>Session{s.label ? ` · ${s.label}` : ""}</span>
                <span className="text-sm font-extrabold text-foreground tabular">{formatDuration(s.durationSec)}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-background">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(pct, 1) * 100}%` }} />
              </div>
            </div>
            <div className="flex justify-between text-[11px] text-subtle tabular">
              <span>{formatClock(new Date(s.startedAt))}</span>
              <span>{s.endedAt ? formatClock(new Date(s.endedAt)) : "now"}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:border-l sm:border-border sm:pl-4">
            <GoalRing pct={pct} size={56} stroke={5}>
              <span className="text-[11px] font-extrabold tabular">{Math.round(Math.min(pct, 9.99) * 100)}%</span>
            </GoalRing>
            <div>
              <p className="text-lg leading-tight font-extrabold tabular">{formatDuration(s.durationSec)}</p>
              <p className="text-xs text-muted">
                {pct >= 1 ? "Hit" : "of"} {formatDuration(s.goalMin * 60)} goal
              </p>
            </div>
          </div>
        </div>
      )}

      <p className="px-4 pt-3 text-[15px] whitespace-pre-wrap">{post.body}</p>

      <footer className="mt-2 flex items-center gap-1 border-t border-border/60 px-2 py-1.5">
        <button
          onClick={onLike}
          disabled={pending}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold hover:bg-inset ${like.liked ? "text-danger" : "text-muted"}`}
          aria-pressed={like.liked}
        >
          <Heart className="size-4" fill={like.liked ? "currentColor" : "none"} /> {like.count}
        </button>
        <button
          onClick={() => setShowComments((v) => !v)}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-muted hover:bg-inset"
        >
          <MessageCircle className="size-4" /> {post.commentCount || "Comment"}
        </button>
        <button onClick={onShare} className="ml-auto rounded-full p-2 text-muted hover:bg-inset" aria-label="Share">
          <Share2 className="size-4" />
        </button>
      </footer>

      {showComments && (
        <div className="border-t border-border/60 px-4 py-3">
          <ul className="flex flex-col gap-2.5">
            {post.comments.map((c) => (
              <li key={c.id} className="flex gap-2.5 text-sm">
                <Avatar name={c.user.name} size={26} />
                <p>
                  <Link href={`/dashboard/u/${c.user.username}`} className="font-bold hover:underline">
                    {c.user.name}
                  </Link>{" "}
                  <span className="text-foreground/90">{c.body}</span>
                </p>
              </li>
            ))}
            {post.comments.length === 0 && <li className="text-sm text-muted">No comments yet.</li>}
          </ul>
          {signedIn ? (
            <form onSubmit={onComment} className="mt-3 flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Add a comment…"
                maxLength={280}
                className="flex-1 rounded-full border border-border bg-inset px-4 py-2 text-sm outline-none focus:border-primary"
              />
              <button disabled={!draft.trim() || pending} className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40" aria-label="Send">
                <Send className="size-4" />
              </button>
            </form>
          ) : (
            <Link href="/signup" className="mt-3 inline-block text-sm font-semibold text-primary">
              Join to comment
            </Link>
          )}
        </div>
      )}
    </article>
  );
}
