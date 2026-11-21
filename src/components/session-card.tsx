"use client";

import "./session-card.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { SceneBackdrop } from "./scene-art";
import { Icon } from "./icon";
import { Avatar } from "./ui";
import { estimateTimelapseSec, sessionChapters } from "@/lib/chapters";
import { claimPlayback, releasePlayback } from "@/lib/feed-player";
import { prefersReducedMotion } from "@/lib/motion";
import { resolveScene, type Scene } from "@/lib/scenes";
import { formatCountdown, formatDuration, timeAgo } from "@/lib/time";
import type { FeedPost } from "@/lib/queries";

type Session = NonNullable<FeedPost["session"]>;
type Mode = "idle" | "playing" | "paused" | "ended";

/** How long a session without a timelapse takes to replay. */
const REPLAY_MS = 6000;
const KEY_STEP = 0.05;
/** A photo keeps its own shape, between a tall 4:5 and a wide 16:9. */
const TALLEST = 4 / 5;
const WIDEST = 16 / 9;

/** The wall-clock length of a session, pauses included: what a timelapse covers. */
const wallSec = (s: Session) =>
  s.endedAt ? Math.max(1, (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 1000) : s.durationSec + s.pausedSec;

/**
 * A session post's picture, filling the card: who and when in a glass chip at the top, how long they
 * focused and on what at the bottom, and a thin bar along the bottom edge that fills towards the goal.
 * Pressing the picture replays the session (or plays its timelapse); the bar scrubs it.
 */
export function SessionPlayer({
  post,
  session,
  streak,
  menu,
}: {
  post: FeedPost;
  session: Session;
  streak: number;
  /** The "…" menu, in the top-right corner. */
  menu: ReactNode;
}) {
  const video = post.mediaType === "timelapse" && post.mediaUrl ? post.mediaUrl : null;
  const photo = post.mediaType === "image" && post.mediaUrl ? post.mediaUrl : null;
  const scene = resolveScene(post.user.sceneId);
  const { total, goalHit } = useMemo(() => sessionChapters(session), [session]);
  const estimate = estimateTimelapseSec(wallSec(session));
  const goalSec = session.goalMin * 60;
  // the bar spans the session or the goal, whichever is longer, so the goal always has a place on it
  const span = Math.max(total, goalSec);

  const [mode, setMode] = useState<Mode>("idle");
  const [progress, setProgressState] = useState(0);
  const prog = useRef(0);
  const setProgress = (p: number) => {
    prog.current = p;
    setProgressState(p);
  };
  const [ratio, setRatio] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const player = useRef<HTMLVideoElement>(null);
  const modeRef = useRef<Mode>("idle");
  modeRef.current = mode;

  const length = () => {
    const d = player.current?.duration;
    return d && Number.isFinite(d) ? d : estimate;
  };

  const stop = useCallback(() => {
    player.current?.pause();
    setMode((m) => (m === "playing" ? "paused" : m));
    releasePlayback(post.id);
  }, [post.id]);

  // keeps the bar and clock moving while it plays: from the video when there is one, or from the clock for a replay
  useEffect(() => {
    if (mode !== "playing") return;
    let last = performance.now();
    let id = 0;
    const step = (now: number) => {
      if (video) {
        const v = player.current;
        const d = v?.duration;
        if (v) setProgress(Math.min(v.currentTime / (d && Number.isFinite(d) ? d : estimate), 1));
      } else {
        const next = Math.min(prog.current + (now - last) / REPLAY_MS, 1);
        last = now;
        setProgress(next);
        if (next >= 1) {
          setMode("ended");
          releasePlayback(post.id);
          return;
        }
      }
      id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [mode, video, estimate, post.id]);

  function play() {
    claimPlayback(post.id, stop);
    if (!video) {
      if (prefersReducedMotion()) {
        setProgress(1);
        setMode("ended");
        releasePlayback(post.id);
        return;
      }
      if (mode === "ended") setProgress(0);
      setMode("playing");
      return;
    }
    const v = player.current;
    if (!v) return;
    if (mode === "ended") v.currentTime = 0;
    setMode("playing");
    v.play().catch(() => setMode("paused"));
  }

  function toggle() {
    if (mode === "playing") stop();
    else play();
  }

  /** Jumps to a point in the session, 0 to 1. Keeps playing if it was. */
  function seek(fraction: number) {
    const f = Math.min(Math.max(fraction, 0), 1);
    setProgress(f);
    if (video && player.current) player.current.currentTime = f * length() * 0.999;
    if (f >= 1 && !video) {
      setMode("ended");
      releasePlayback(post.id);
    } else if (mode === "idle" || mode === "ended") setMode("paused");
  }

  // pause once it scrolls out of view
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => !e.isIntersecting && modeRef.current === "playing" && stop(), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [stop]);

  useEffect(() => () => releasePlayback(post.id), [post.id]);

  // before anyone presses play, it shows the finished session
  const idle = mode === "idle";
  const shownSec = idle ? total : progress * total;
  const playing = mode === "playing";
  const playLabel = playing ? "Pause" : mode === "ended" ? "Replay" : "Play";
  const what = video ? "timelapse" : "session replay";
  const videoShown = !!video && !idle;
  const createdAt = new Date(post.createdAt);
  const aspect = photo && ratio ? Math.min(Math.max(ratio, TALLEST), WIDEST) : undefined;

  return (
    <div
      ref={box}
      className="session-hero"
      data-mode={mode}
      data-video={video ? "" : undefined}
      style={aspect ? { aspectRatio: String(aspect) } : undefined}
    >
      <Cover scene={scene} photo={photo} hidden={videoShown} onRatio={setRatio} />
      {video && (
        <video
          ref={player}
          src={video}
          muted
          playsInline
          preload="none"
          aria-hidden
          onEnded={() => {
            setProgress(1);
            setMode("ended");
            releasePlayback(post.id);
          }}
          onPause={() => modeRef.current === "playing" && setMode("paused")}
          className={`absolute inset-0 size-full object-cover transition-opacity duration-300 ${videoShown ? "opacity-100" : "opacity-0"}`}
        />
      )}
      <div className="session-hero-scrim" aria-hidden />

      <button type="button" onClick={toggle} aria-label={`${playLabel} ${what}`} className="session-hero-hit">
        <span className="session-play">
          <Icon name={playing ? "pause" : mode === "ended" ? "refresh" : "startFocus"} size={22} solid />
        </span>
      </button>

      <div className="pointer-events-none absolute inset-x-2.5 top-2.5 flex items-start justify-between gap-2">
        <Link href={`/dashboard/u/${post.user.username}`} className="session-chip pointer-events-auto">
          <Avatar name={post.user.name} src={post.user.avatar} size={34} />
          <span className="min-w-0">
            <span className="block truncate text-[14px] leading-[18px] font-bold">{post.user.name}</span>
            <span className="flex items-center gap-1 text-[12px] leading-4 font-semibold text-white/70 tabular">
              <time dateTime={createdAt.toISOString()} suppressHydrationWarning>
                {timeAgo(createdAt).replace(" ago", "")}
              </time>
              {streak > 0 && (
                <>
                  <span aria-hidden>·</span>
                  <span className="text-streak" aria-label={`${streak} day streak`}>
                    <span aria-hidden>🔥</span>
                    {streak}d
                  </span>
                </>
              )}
            </span>
          </span>
        </Link>
        <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
          {goalHit && (
            <span className="session-glass session-goal-chip">
              <Icon name="check" size={13} /> Goal
            </span>
          )}
          {menu}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-4 bottom-6">
        <p className="session-time tabular">{idle ? formatDuration(total) : formatCountdown(shownSec)}</p>
        {session.label && <p className="session-label truncate">{session.label}</p>}
      </div>

      <GoalBar
        shownSec={shownSec}
        total={total}
        span={span}
        goalSec={goalSec}
        reached={shownSec >= goalSec}
        progress={progress}
        onSeek={seek}
      />
    </div>
  );
}

/** The scene, or the session's photo, under everything. Stays as the timelapse's cover until it plays. */
function Cover({
  scene,
  photo,
  hidden,
  onRatio,
}: {
  scene: Scene;
  photo: string | null;
  hidden: boolean;
  onRatio: (ratio: number) => void;
}) {
  return (
    <div className={`absolute inset-0 transition-opacity duration-300 ${hidden ? "opacity-0" : "opacity-100"}`} aria-hidden>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote hosts vary by deployment, and these are already resized
        <img
          src={photo}
          alt=""
          loading="lazy"
          onLoad={(e) => e.currentTarget.naturalHeight && onRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
          className="size-full object-cover"
        />
      ) : (
        <SceneBackdrop scene={scene} sizes="(min-width: 700px) 620px, 100vw" />
      )}
    </div>
  );
}

/**
 * The thin bar along the bottom: it fills with focused time and has a tick where the goal is.
 * Drag along it, or use the arrow keys, to scrub the replay.
 */
function GoalBar({
  shownSec,
  total,
  span,
  goalSec,
  reached,
  progress,
  onSeek,
}: {
  shownSec: number;
  total: number;
  span: number;
  goalSec: number;
  reached: boolean;
  progress: number;
  onSeek: (fraction: number) => void;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // a point on the bar is a moment in the span; the session itself may end before the bar does
  const fractionAt = (clientX: number) => {
    const r = bar.current?.getBoundingClientRect();
    const f = r ? Math.min(Math.max((clientX - r.left) / r.width, 0), 1) : 0;
    return Math.min((f * span) / total, 1);
  };

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? KEY_STEP * 2 : KEY_STEP;
    const to =
      e.key === "ArrowRight" || e.key === "ArrowUp"
        ? progress + step
        : e.key === "ArrowLeft" || e.key === "ArrowDown"
          ? progress - step
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? 1
              : null;
    if (to === null) return;
    e.preventDefault();
    onSeek(to);
  }

  const pct = Math.round((shownSec / goalSec) * 100);
  return (
    <div
      ref={bar}
      role="slider"
      tabIndex={0}
      aria-label="Focus time against the goal"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={Math.round(shownSec)}
      aria-valuetext={`${formatCountdown(shownSec)} focused, ${pct}% of the ${formatDuration(goalSec)} goal`}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        onSeek(fractionAt(e.clientX));
      }}
      onPointerMove={(e) => dragging.current && onSeek(fractionAt(e.clientX))}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
      className="session-bar"
      data-reached={reached || undefined}
    >
      <span className="session-bar-track">
        <span className="session-bar-fill" style={{ width: `${(shownSec / span) * 100}%` }} />
        {goalSec < span && <span className="session-bar-goal" style={{ left: `${(goalSec / span) * 100}%` }} />}
      </span>
    </div>
  );
}
