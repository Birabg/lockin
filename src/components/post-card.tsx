"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { usePopover } from "./app-shell";
import { Icon } from "./icon";
import { SessionPlayer } from "./session-card";
import { ReportDialog } from "./report-dialog";
import { toast } from "./toaster";
import { Avatar } from "./ui";
import { blockUser, muteUser } from "@/app/actions/safety";
import { addComment, deleteComment, deletePost, getReactors, toggleLike, type NewComment, type Reactor } from "@/app/actions/social";
import { formatCount, timeAgo } from "@/lib/time";
import { trackView } from "@/lib/view-tracker";
import type { FeedPost } from "@/lib/queries";

export type Viewer = { username: string; name: string; avatar: string | null };

/** Sent with a user id when the viewer mutes or blocks them, so every list drops their posts at once. */
export const HIDE_AUTHOR_EVENT = "lockin:hide-author";
const hideAuthor = (userId: string) => window.dispatchEvent(new CustomEvent(HIDE_AUTHOR_EVENT, { detail: userId }));

/** A like shows as this. Other reactions would need the database to store which one. */
const REACTION = "🔥";
const LONG_PRESS_MS = 450;
const HOVER_MS = 350;

/** `timeZone` is accepted for callers that still pass it; the card no longer shows clock times. */
export function PostCard({ post, viewer }: { post: FeedPost; viewer: Viewer | null; timeZone?: string }) {
  const router = useRouter();
  const signedIn = !!viewer;
  const mine = viewer?.username === post.user.username;
  const [removed, setRemoved] = useState(false);
  const [goneComments, setGoneComments] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const [like, setLike] = useState({ liked: post.liked, count: post.likeCount });
  const [added, setAdded] = useState<NewComment[]>([]);
  const [reporting, setReporting] = useState<{ type: "post" | "comment"; id: string } | null>(null);

  // Pages loaded by scrolling never get new props, so this state is what keeps their likes correct.
  useEffect(() => setLike({ liked: post.liked, count: post.likeCount }), [post.liked, post.likeCount]);
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState("");
  const card = useRef<HTMLElement>(null);
  const s = post.session;
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

  function onMute() {
    const who = post.user;
    start(async () => {
      const res = await muteUser(who.id).catch(() => ({ error: "Couldn't reach the server. Try again." }));
      if (res.error) return toast(res.error, "error");
      hideAuthor(who.id);
      toast(`Muted @${who.username}. Their posts won't show in your feed.`);
    });
  }

  function onBlock() {
    const who = post.user;
    if (
      !window.confirm(
        `Block @${who.username}? You won't see each other's posts, and they can't follow, comment, react or message you. Unblock any time in Settings.`,
      )
    )
      return;
    start(async () => {
      const res = await blockUser(who.id).catch(() => ({ error: "Couldn't reach the server. Try again." }));
      if (res.error) return toast(res.error, "error");
      hideAuthor(who.id);
      toast(`Blocked @${who.username}`);
      router.refresh();
    });
  }

  async function onShare() {
    const url = `${window.location.origin}/dashboard/u/${post.user.username}`;
    if (navigator.share) await navigator.share({ title: post.body, url }).catch(() => {});
    else {
      await navigator.clipboard?.writeText(url);
      toast("Link copied");
    }
  }

  if (removed) return null;

  const others = signedIn && !mine;
  const menu = (
    <PostMenu
      views={post.views}
      overlay={!!s}
      username={post.user.username}
      onDelete={mine ? onDelete : undefined}
      onReport={others ? () => setReporting({ type: "post", id: post.id }) : undefined}
      onMute={others ? onMute : undefined}
      onBlock={others ? onBlock : undefined}
    />
  );

  return (
    <article ref={card} className={`panel overflow-hidden ${s ? "p-2" : ""}`}>
      {s ? <SessionPlayer post={post} session={s} streak={post.streak} menu={menu} /> : <TextHeader post={post} menu={menu} />}

      <div className={s ? "flex items-start gap-3 px-2 pt-2.5 pb-0.5" : "px-4 pb-3"}>
        {s ? (
          <div className="min-w-0 flex-1 pt-2 text-muted">
            <Caption text={post.body} big={false} />
          </div>
        ) : (
          <Caption text={post.body} big />
        )}
        <div className={`flex shrink-0 items-center gap-2 ${s ? "" : "mt-2 justify-end"}`}>
          <ReactButton postId={post.id} liked={like.liked} count={like.count} disabled={pending} onToggle={onLike} />
          <button
            onClick={() => setShowComments((v) => !v)}
            aria-expanded={showComments}
            aria-label={`Comments, ${commentCount}`}
            className="post-action"
          >
            <Icon name="comment" size={19} />
            {commentCount > 0 && <span className="tabular">{commentCount}</span>}
          </button>
          <button onClick={onShare} className="post-action" aria-label="Share a link to this profile">
            <Icon name="share" size={19} />
          </button>
        </div>
      </div>

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
                {signedIn && c.user.username !== viewer?.username && !c.id.startsWith("temp-") && (
                  <button
                    onClick={() => setReporting({ type: "comment", id: c.id })}
                    aria-label={`Report comment by ${c.user.name}`}
                    className="ml-auto grid size-6 shrink-0 place-items-center rounded-full text-subtle hover:text-danger"
                  >
                    <Icon name="report" size={14} />
                  </button>
                )}
                {(mine || c.user.username === viewer?.username) && !c.id.startsWith("temp-") && (
                  <button
                    onClick={() => onDeleteComment(c.id)}
                    aria-label="Delete comment"
                    className={`${signedIn && c.user.username !== viewer?.username ? "" : "ml-auto"} grid size-6 shrink-0 place-items-center rounded-full text-subtle hover:text-danger`}
                  >
                    <Icon name="delete" size={15} />
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
                <Icon name="send" size={18} />
              </button>
            </form>
          ) : (
            <Link href="/signup" className="mt-3 inline-block text-sm font-semibold text-primary">
              Join to comment
            </Link>
          )}
        </div>
      )}
      {reporting && (
        <ReportDialog
          type={reporting.type}
          id={reporting.id}
          onClose={() => setReporting(null)}
          onReported={() => (reporting.type === "post" ? setRemoved(true) : setGoneComments((list) => [...list, reporting.id]))}
          onFailed={() =>
            reporting.type === "post" ? setRemoved(false) : setGoneComments((list) => list.filter((c) => c !== reporting.id))
          }
        />
      )}
    </article>
  );
}

function TextHeader({ post, menu }: { post: FeedPost; menu: React.ReactNode }) {
  const createdAt = new Date(post.createdAt);
  return (
    <header className="flex items-center gap-3 px-4 pt-4 pb-2">
      <Link href={`/dashboard/u/${post.user.username}`} aria-label={`${post.user.name}’s profile`}>
        <Avatar name={post.user.name} src={post.user.avatar} size={38} />
      </Link>
      <p className="flex min-w-0 flex-1 items-baseline gap-1.5 text-[14.5px] font-semibold tracking-[-0.01em]">
        <Link href={`/dashboard/u/${post.user.username}`} className="truncate hover:underline">
          {post.user.name}
        </Link>
        <span className="truncate text-[12px] font-normal tracking-normal text-muted">@{post.user.username}</span>
        <span className="text-[12px] font-normal text-muted" aria-hidden>
          ·
        </span>
        <time dateTime={createdAt.toISOString()} suppressHydrationWarning className="shrink-0 text-[12px] font-normal text-muted tabular">
          {timeAgo(createdAt).replace(" ago", "")}
        </time>
      </p>
      {menu}
    </header>
  );
}

/** Two lines, with a toggle for the rest when there is more. */
function Caption({ text, big }: { text: string; big: boolean }) {
  const el = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);

  useLayoutEffect(() => {
    const p = el.current;
    if (p && !open) setLong(p.scrollHeight > p.clientHeight + 1);
  }, [text, open]);

  return (
    <div>
      <p
        ref={el}
        className={`${big ? "text-[15px]" : "text-[14px]"} leading-[1.5] break-words whitespace-pre-wrap ${open ? "" : "line-clamp-2"}`}
      >
        {text}
      </p>
      {(long || open) && (
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="text-[13px] font-semibold text-muted hover:text-foreground"
        >
          {open ? "less" : "more"}
        </button>
      )}
    </div>
  );
}

/** Views, delete for the author, and report, mute and block for everyone else. Sits over a session's picture, or at the end of a text post's header. */
function PostMenu({
  views,
  overlay,
  username,
  onDelete,
  onReport,
  onMute,
  onBlock,
}: {
  views: number;
  overlay: boolean;
  username: string;
  onDelete?: () => void;
  onReport?: () => void;
  onMute?: () => void;
  onBlock?: () => void;
}) {
  const pop = usePopover<"menu">();
  const item = (label: React.ReactNode, icon: "report" | "hide" | "block", run: () => void, danger = false) => (
    <button
      role="menuitem"
      onClick={() => {
        pop.setOpen(null);
        run();
      }}
      className={`app-menu-row ${danger ? "text-danger" : ""}`}
    >
      <Icon name={icon} size={18} /> {label}
    </button>
  );
  return (
    <div ref={pop.box} className="relative shrink-0">
      <button
        onClick={() => pop.toggle("menu")}
        aria-expanded={pop.open === "menu"}
        aria-haspopup="menu"
        aria-label="Post options"
        className={
          overlay
            ? "session-glass grid size-[30px] place-items-center"
            : "grid size-9 place-items-center rounded-full text-muted hover:bg-inset hover:text-foreground"
        }
      >
        <Icon name="more" size={18} />
      </button>
      {pop.open && (
        <div role="menu" data-menu className="app-pop absolute top-[calc(100%+6px)] right-0">
          <p className="app-menu-row text-muted" role="none">
            <Icon name="views" size={18} /> <span className="tabular">{formatCount(views)}</span> {views === 1 ? "view" : "views"}
          </p>
          {onDelete && (
            <button
              role="menuitem"
              onClick={() => {
                pop.setOpen(null);
                onDelete();
              }}
              className="app-menu-row text-danger"
            >
              <Icon name="delete" size={18} /> Delete post
            </button>
          )}
          {onReport && item("Report post", "report", onReport)}
          {onMute && item(`Mute @${username}`, "hide", onMute)}
          {onBlock && item(`Block @${username}`, "block", onBlock, true)}
        </div>
      )}
    </div>
  );
}

/**
 * The like, shown as a 🔥 reaction. A tap toggles it; hovering or a long press shows who reacted,
 * fetched only then.
 */
function ReactButton({
  postId,
  liked,
  count,
  disabled,
  onToggle,
}: {
  postId: string;
  liked: boolean;
  count: number;
  disabled: boolean;
  onToggle: () => void;
}) {
  const pop = usePopover<"who">();
  const [who, setWho] = useState<{ people: Reactor[]; more: number } | null>(null);
  const [popping, setPopping] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pressed = useRef(false);
  const loaded = useRef<number | null>(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  function showWho() {
    pop.setOpen("who");
    if (loaded.current === count) return;
    loaded.current = count;
    setWho(null);
    getReactors(postId).then(setWho, () => setWho({ people: [], more: 0 }));
  }

  return (
    <div
      ref={pop.box}
      className="relative"
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse" || count === 0) return;
        timer.current = setTimeout(showWho, HOVER_MS);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse") return;
        clearTimeout(timer.current);
        pop.setOpen(null);
      }}
    >
      <button
        onClick={() => {
          if (pressed.current) {
            pressed.current = false;
            return;
          }
          setPopping(!liked);
          onToggle();
        }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse") return;
          pressed.current = false;
          timer.current = setTimeout(() => {
            pressed.current = true;
            showWho();
          }, LONG_PRESS_MS);
        }}
        onPointerUp={(e) => e.pointerType !== "mouse" && clearTimeout(timer.current)}
        onContextMenu={(e) => pop.open && e.preventDefault()}
        disabled={disabled}
        aria-pressed={liked}
        aria-label={`React ${REACTION}, ${count} so far`}
        className={`post-action select-none ${liked ? "!bg-streak-bg text-streak" : ""}`}
      >
        <span
          aria-hidden
          className={`text-[16px] leading-none ${liked ? "" : "opacity-60 grayscale"} ${popping ? "animate-like-pop" : ""}`}
          onAnimationEnd={() => setPopping(false)}
        >
          {REACTION}
        </span>
        <span className="tabular">{count}</span>
      </button>
      {pop.open && (
        <div role="dialog" aria-label="Reacted" className="app-pop react-pop absolute right-0 bottom-[calc(100%+6px)] w-56 p-2">
          {!who ? (
            <p className="px-2 py-1.5 text-[13px] text-muted">Loading…</p>
          ) : who.people.length === 0 ? (
            <p className="px-2 py-1.5 text-[13px] text-muted">No reactions yet.</p>
          ) : (
            <ul className="max-h-60 overflow-y-auto">
              {who.people.map((p) => (
                <li key={p.username}>
                  <Link href={`/dashboard/u/${p.username}`} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-inset">
                    <Avatar name={p.name} src={p.avatar} size={24} />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{p.name}</span>
                    <span aria-hidden>{REACTION}</span>
                  </Link>
                </li>
              ))}
              {who.more > 0 && <li className="px-2 py-1 text-[12px] text-muted">and {who.more} more</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
