"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Flame, Heart, MessageCircle, Send, Share2, Trash2 } from "lucide-react";
import { toast } from "./toaster";
import { Avatar, GoalRing } from "./ui";
import { addComment, deleteComment, deletePost, toggleLike, type NewComment } from "@/app/actions/social";
import { formatClock, formatDuration, timeAgo } from "@/lib/time";
import type { FeedPost } from "@/lib/queries";

export type Viewer = { username: string; name: string; avatar: string | null };

export function PostCard({ post, viewer, timeZone }: { post: FeedPost; viewer: Viewer | null; timeZone: string }) {
  const signedIn = !!viewer;
  const mine = viewer?.username === post.user.username;
  const [removed, setRemoved] = useState(false);
  const [goneComments, setGoneComments] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const [like, setLike] = useState({ liked: post.liked, count: post.likeCount });
  const [added, setAdded] = useState<NewComment[]>([]);

  // Pages loaded by scrolling never get new props, so this state is what keeps their likes correct.
  useEffect(() => setLike({ liked: post.liked, count: post.likeCount }), [post.liked, post.likeCount]);
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState("");
  const s = post.session;
  const pct = s ? s.durationSec / (s.goalMin * 60) : 0;
  const createdAt = new Date(post.createdAt);
  const newComments = added.filter((c) => !post.comments.some((x) => x.id === c.id));
  const allComments = [...post.comments, ...newComments];
  const comments = allComments.filter((c) => !goneComments.includes(c.id));
  const commentCount = post.commentCount + newComments.length - (allComments.length - comments.length);

  function onLike() {
    if (!signedIn) return (window.location.href = "/signup");
    const before = like;
    setLike({ liked: !before.liked, count: before.count + (before.liked ? -1 : 1) });
    start(async () => {
      const res = await toggleLike(post.id);
      if (res.error) {
        setLike(before);
        toast(res.error, "error");
      }
    });
  }

  function onComment(e: React.FormEvent) {
    e.preventDefault();
    const body = draft;
    setDraft("");
    if (!viewer) return;
    const temp: NewComment = { id: `temp-${Date.now()}`, body, createdAt: new Date(), user: viewer };
    setAdded((list) => [...list, temp]);
    start(async () => {
      const res = await addComment(post.id, body);
      setAdded((list) => list.flatMap((c) => (c.id !== temp.id ? [c] : res.comment ? [res.comment] : [])));
      if (res.error) {
        setDraft(body);
        toast(res.error, "error");
      }
    });
  }

  function onDelete() {
    if (!window.confirm("Delete this post? Your focus time stays in your stats.")) return;
    setRemoved(true);
    start(async () => {
      const res = await deletePost(post.id);
      if (res.error) {
        setRemoved(false);
        toast(res.error, "error");
      } else toast("Post deleted");
    });
  }

  function onDeleteComment(id: string) {
    setGoneComments((list) => [...list, id]);
    start(async () => {
      const res = await deleteComment(id);
      if (res.error) {
        setGoneComments((list) => list.filter((c) => c !== id));
        toast(res.error, "error");
      }
    });
  }

  async function onShare() {
    const url = `${window.location.origin}/dashboard/u/${post.user.username}`;
    if (navigator.share) await navigator.share({ title: post.body, url }).catch(() => {});
    else await navigator.clipboard?.writeText(url);
  }

  if (removed) return null;

  return (
    <article className="panel overflow-hidden">
      <header className="flex items-center gap-3 p-4 pb-3">
        <Link href={`/dashboard/u/${post.user.username}`} aria-label={`${post.user.name}’s profile`}>
          <Avatar name={post.user.name} src={post.user.avatar} size={40} />
        </Link>
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[15px] font-bold">
            <Link href={`/dashboard/u/${post.user.username}`} className="truncate hover:underline">
              {post.user.name}
            </Link>
            <span className="truncate text-xs font-medium text-subtle">@{post.user.username}</span>
          </p>
          <p className="flex items-center gap-2 text-xs text-muted">
            <time dateTime={createdAt.toISOString()} suppressHydrationWarning>
              {timeAgo(createdAt)}
            </time>
            {post.streak > 0 && (
              <span className="flex items-center gap-0.5 font-bold text-streak">
                <Flame className="size-3" fill="currentColor" />
                {post.streak}d
              </span>
            )}
          </p>
        </div>
        {mine && (
          <button
            onClick={onDelete}
            aria-label="Delete post"
            className="grid size-9 shrink-0 place-items-center rounded-full text-subtle hover:bg-inset hover:text-danger"
          >
            <Trash2 className="size-4" />
          </button>
        )}
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
              <span>{formatClock(new Date(s.startedAt), timeZone)}</span>
              <span>{s.endedAt ? formatClock(new Date(s.endedAt), timeZone) : "now"}</span>
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
      {post.timelapseUrl && (
        <video
          src={post.timelapseUrl}
          controls
          muted
          loop
          playsInline
          preload="metadata"
          aria-label="Session timelapse"
          className="mt-3 w-full bg-black"
        />
      )}

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
          <MessageCircle className="size-4" /> {commentCount || "Comment"}
        </button>
        <button onClick={onShare} className="ml-auto rounded-full p-2 text-muted hover:bg-inset" aria-label="Copy a link to this profile">
          <Share2 className="size-4" />
        </button>
      </footer>

      {showComments && (
        <div className="border-t border-border/60 px-4 py-3">
          <ul className="flex flex-col gap-2.5">
            {comments.map((c) => (
              <li key={c.id} className="flex gap-2.5 text-sm">
                <Avatar name={c.user.name} src={c.user.avatar} size={26} />
                <p>
                  <Link href={`/dashboard/u/${c.user.username}`} className="font-bold hover:underline">
                    {c.user.name}
                  </Link>{" "}
                  <span className="text-foreground/90">{c.body}</span>
                </p>
                {(mine || c.user.username === viewer?.username) && !c.id.startsWith("temp-") && (
                  <button
                    onClick={() => onDeleteComment(c.id)}
                    aria-label="Delete comment"
                    className="ml-auto grid size-6 shrink-0 place-items-center rounded-full text-subtle hover:text-danger"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
            {comments.length === 0 && <li className="text-sm text-muted">No comments yet.</li>}
          </ul>
          {signedIn ? (
            <form onSubmit={onComment} className="mt-3 flex items-center gap-2">
              <input
                aria-label="Add a comment"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Add a comment…"
                maxLength={280}
                className="flex-1 rounded-full border border-border bg-inset px-4 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                disabled={!draft.trim()}
                className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
                aria-label="Send"
              >
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
