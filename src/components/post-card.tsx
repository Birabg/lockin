"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChartNoAxesColumn, Flame, Heart, MessageCircle, Send, Share2, Trash2 } from "lucide-react";
import { SessionBody } from "./session-body";
import { toast } from "./toaster";
import { Avatar } from "./ui";
import { addComment, deleteComment, deletePost, toggleLike, type NewComment } from "@/app/actions/social";
import { formatCount, timeAgo } from "@/lib/time";
import { trackView } from "@/lib/view-tracker";
import type { FeedPost } from "@/lib/queries";

export type Viewer = { username: string; name: string; avatar: string | null };

export function PostCard({ post, viewer, timeZone }: { post: FeedPost; viewer: Viewer | null; timeZone: string }) {
  const router = useRouter();
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
  const card = useRef<HTMLElement>(null);
  const s = post.session;
  const createdAt = new Date(post.createdAt);
  const newComments = added.filter((c) => !post.comments.some((x) => x.id === c.id));
  const allComments = [...post.comments, ...newComments];
  const comments = allComments.filter((c) => !goneComments.includes(c.id));
  const commentCount = post.commentCount + newComments.length - (allComments.length - comments.length);

  // a view is a card that's really been on screen, not just one the feed loaded
  useEffect(() => {
    const el = card.current;
    if (!el || !signedIn || mine) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        trackView(post.id);
        observer.disconnect();
      },
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [post.id, signedIn, mine]);

  function onLike() {
    if (!signedIn) return router.push("/signup");
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
    <article ref={card} className="post-panel @container overflow-hidden">
      <header className="flex items-center gap-3 p-4 pb-0">
        <Link href={`/dashboard/u/${post.user.username}`} aria-label={`${post.user.name}’s profile`}>
          <Avatar name={post.user.name} src={post.user.avatar} size={48} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[15px] font-bold">
            <Link href={`/dashboard/u/${post.user.username}`} className="truncate hover:underline">
              {post.user.name}
            </Link>
            {/* a verified badge goes here once accounts can earn one */}
            <span className="truncate text-sm font-medium text-subtle">@{post.user.username}</span>
          </p>
          <p className="flex items-center gap-1.5 text-[13px] text-muted">
            <time dateTime={createdAt.toISOString()} suppressHydrationWarning>
              {timeAgo(createdAt).replace(" ago", "")}
            </time>
            {post.streak > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="flex items-center gap-0.5 font-bold text-streak tabular">
                  <Flame className="size-3.5" fill="currentColor" />
                  {post.streak}d
                </span>
              </>
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

      <p className="px-4 pt-3 text-[15px] whitespace-pre-wrap">{post.body}</p>
      {s && <SessionBody post={post} session={s} timeZone={timeZone} />}

      <footer className="mt-3 flex items-center gap-1 border-t border-border px-2 py-1.5">
        <button
          onClick={onLike}
          disabled={pending}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold hover:bg-inset ${like.liked ? "text-danger" : "text-muted"}`}
          aria-pressed={like.liked}
          aria-label={`Like, ${like.count} so far`}
        >
          <Heart className="size-4" fill={like.liked ? "currentColor" : "none"} /> <span className="tabular">{like.count}</span>
        </button>
        <button
          onClick={() => setShowComments((v) => !v)}
          aria-expanded={showComments}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-muted hover:bg-inset"
        >
          <MessageCircle className="size-4" /> Comment {commentCount > 0 && <span className="tabular">{commentCount}</span>}
        </button>
        <span className="ml-auto flex items-center gap-1.5 px-2 text-sm font-semibold text-muted tabular">
          <ChartNoAxesColumn className="size-4" aria-hidden />
          <span className="sr-only">Views:</span> {formatCount(post.views)}
        </span>
        <button onClick={onShare} className="rounded-full p-2 text-muted hover:bg-inset" aria-label="Copy a link to this profile">
          <Share2 className="size-4" />
        </button>
      </footer>

      {showComments && (
        <div className="border-t border-border px-4 py-3">
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
