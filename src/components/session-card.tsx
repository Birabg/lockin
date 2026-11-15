"use client";

import "./session-card.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { SceneBackdrop } from "./scene-art";
import { Icon } from "./icon";
import { Avatar } from "./ui";
import { CHAPTER_NAMES, chapterAt, chapterRange, estimateTimelapseSec, sessionChapters, type ChapterKind } from "@/lib/chapters";
import { claimPlayback, releasePlayback, timelapseFrames } from "@/lib/feed-player";
import { prefersReducedMotion } from "@/lib/motion";
import { resolveScene, type Scene } from "@/lib/scenes";
import { formatCountdown, formatDuration, timeAgo } from "@/lib/time";
import type { FeedPost } from "@/lib/queries";

type Session = NonNullable<FeedPost["session"]>;
type Mode = "idle" | "playing" | "paused" | "ended";

/** How long a session without a timelapse takes to replay. */
const REPLAY_MS = 8000;
const FRAMES = 8;
/** Phones show this many frames. */
const FRAMES_SMALL = 5;
const KEY_STEP = 0.05;

/** The wall-clock length of a session, pauses included: what a timelapse covers. */
const wallSec = (s: Session) =>
  s.endedAt ? Math.max(1, (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 1000) : s.durationSec + s.pausedSec;

/**
 * The top of a session post: the timelapse, or a replay of the session over its scene, with a
 * filmstrip of its chapters to scrub through.
 */
export function SessionPlayer({
  post,
  session,
  timeZone,
  menu,
}: {
  post: FeedPost;
  session: Session;
  timeZone: string;
  /** The "…" menu, in the player's top-right corner. */
  menu: ReactNode;
}) {
  const video = post.mediaType === "timelapse" && post.mediaUrl ? post.mediaUrl : null;
  const photo = post.mediaType === "image" && post.mediaUrl ? post.mediaUrl : null;
  const scene = resolveScene(post.user.sceneId);
  const { total, chapters } = useMemo(() => sessionChapters(session), [session]);
  const estimate = estimateTimelapseSec(wallSec(session));

  const [mode, setMode] = useState<Mode>("idle");
  const [progress, setProgressState] = useState(0);
  const prog = useRef(0);
  const setProgress = (p: number) => {
    prog.current = p;
    setProgressState(p);
  };
  const [videoSec, setVideoSec] = useState<number | null>(null);
  const [frames, setFrames] = useState<string[] | null>(null);
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

  // keeps the playhead and clock moving while it plays: from the video when there is one, or from the clock for a replay
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

  /** Jumps to a point on the strip, 0 to 1. Keeps playing if it was. */
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

  // stills for the filmstrip, only once someone has started the video
  useEffect(() => {
    if (!video || mode === "idle" || frames) return;
    let live = true;
    timelapseFrames(post.id, video, FRAMES, estimate).then((f) => live && f && setFrames(f));
    return () => {
      live = false;
    };
  }, [video, mode, frames, post.id, estimate]);

  const focusedNow = progress * total;
  const clock = mode === "idle" ? formatCountdown(total) : formatCountdown(focusedNow);
  const shown = mode !== "idle";
  const badge = video ? `${formatDuration(session.durationSec)} in ${Math.max(1, Math.round(videoSec ?? estimate))}s` : session.label;
  const createdAt = new Date(post.createdAt);
  const playLabel = mode === "playing" ? "Pause" : mode === "ended" ? "Replay" : "Play";
  const what = video ? "timelapse" : "session replay";

  return (
    <div>
      <div ref={box} className="session-player relative aspect-video w-full overflow-hidden rounded-t-[inherit] bg-black text-white">
        <Cover scene={scene} photo={photo} hidden={!!video && shown} />
        {video && (
          <video
            ref={player}
            src={video}
            muted
            playsInline
            preload="none"
            aria-hidden
            onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setVideoSec(e.currentTarget.duration)}
            onEnded={() => {
              setProgress(1);
              setMode("ended");
              releasePlayback(post.id);
            }}
            onPause={() => modeRef.current === "playing" && setMode("paused")}
            className={`absolute inset-0 size-full object-cover transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"}`}
          />
        )}
        <div className="session-player-scrim" aria-hidden />

        <button
          type="button"
          onClick={toggle}
          aria-label={`${playLabel} ${what}`}
          className="absolute inset-0 grid place-items-center outline-none"
          data-mode={mode}
        >
          <span className="session-play">
            <Icon name={mode === "playing" ? "pause" : mode === "ended" ? "refresh" : "startFocus"} size={22} solid />
          </span>
        </button>

        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <Link
            href={`/dashboard/u/${post.user.username}`}
            className="session-glass pointer-events-auto flex min-w-0 items-center gap-2 py-1 pr-3 pl-1"
          >
            <Avatar name={post.user.name} src={post.user.avatar} size={26} />
            <span className="truncate text-[13px] font-bold">{post.user.name}</span>
            <time dateTime={createdAt.toISOString()} suppressHydrationWarning className="shrink-0 text-[12px] text-white/70 tabular">
              {timeAgo(createdAt).replace(" ago", "")}
            </time>
          </Link>
          <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
            {badge && <span className="session-glass session-badge max-w-[150px] truncate px-2.5 py-1 text-[12px] font-bold">{badge}</span>}
            {menu}
          </div>
        </div>

        <span
          className="session-glass session-clock pointer-events-none absolute right-3 bottom-3 px-2.5 py-1 text-[13px] font-bold tabular"
          aria-hidden
        >
          {clock}
        </span>
      </div>

      <Filmstrip
        scene={scene}
        photo={photo}
        frames={frames}
        chapters={chapters}
        total={total}
        progress={progress}
        playing={mode === "playing"}
        session={session}
        timeZone={timeZone}
        onSeek={seek}
      />
    </div>
  );
}

/** The scene, or the session's photo, under everything. Stays as the timelapse's cover until it plays. */
function Cover({ scene, photo, hidden }: { scene: Scene; photo: string | null; hidden: boolean }) {
  return (
    <div className={`absolute inset-0 transition-opacity duration-300 ${hidden ? "opacity-0" : "opacity-100"}`} aria-hidden>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote hosts vary by deployment, and these are already resized
        <img src={photo} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <SceneBackdrop scene={scene} sizes="(min-width: 700px) 640px, 100vw" />
      )}
    </div>
  );
}

/** A slice of the cover for each frame, so the strip reads as the session even without real stills. */
function sliceStyle(scene: Scene, photo: string | null, i: number): CSSProperties {
  const image = photo ?? (scene.kind === "image" ? scene.image : null);
  if (image) {
    return {
      backgroundImage: `url(${image})`,
      backgroundSize: `${FRAMES * 100}% auto`,
      backgroundPosition: `${(i / (FRAMES - 1)) * 100}% 50%`,
    };
  }
  if (scene.kind === "art") return { background: `linear-gradient(to bottom, ${scene.sky[0]}, ${scene.sky[1]})` };
  const s = scene.kind === "drawn" ? scene : null;
  return s
    ? { background: `linear-gradient(to bottom, ${s.sky[0]}, ${s.sky[1]} 55%, ${s.ridges[0]} 55%, ${s.ridges[1]} 75%, ${s.ridges[2]})` }
    : {};
}

const CHAPTER_COLOR: Record<ChapterKind, string> = {
  focus: "var(--chapter-focus)",
  break: "var(--chapter-break)",
  goal: "var(--chapter-goal)",
};

type StripProps = {
  scene: Scene;
  photo: string | null;
  frames: string[] | null;
  chapters: ReturnType<typeof sessionChapters>["chapters"];
  total: number;
  progress: number;
  playing: boolean;
  session: Session;
  timeZone: string;
  onSeek: (fraction: number) => void;
};

function Filmstrip({ scene, photo, frames, chapters, total, progress, playing, session, timeZone, onSeek }: StripProps) {
  const strip = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [tip, setTip] = useState<{ x: number; text: string } | null>(null);

  const fractionAt = (clientX: number) => {
    const r = strip.current?.getBoundingClientRect();
    return r ? Math.min(Math.max((clientX - r.left) / r.width, 0), 1) : 0;
  };

  function showTip(clientX: number) {
    const r = strip.current?.getBoundingClientRect();
    if (!r) return;
    const f = fractionAt(clientX);
    const c = chapterAt(chapters, total, f);
    // kept clear of the edges, since the label is centred on the pointer
    const half = Math.min(110, r.width / 2);
    setTip({
      x: Math.min(Math.max(f * r.width, half), r.width - half),
      text: `${CHAPTER_NAMES[c.kind]} · ${chapterRange(session, c, timeZone)}`,
    });
  }

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

  const now = Math.round(progress * total);
  const current = chapterAt(chapters, total, progress);
  const kinds = [...new Set(chapters.map((c) => c.kind))];

  return (
    <div className="px-3 pt-2">
      <div className="relative">
        {tip && (
          <span className="session-tip" style={{ left: tip.x }} role="presentation">
            {tip.text}
          </span>
        )}
        <div
          ref={strip}
          role="slider"
          tabIndex={0}
          aria-label="Session timeline"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={now}
          aria-valuetext={`${formatCountdown(now)} of ${formatCountdown(total)}, ${CHAPTER_NAMES[current.kind]}`}
          onKeyDown={onKeyDown}
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            onSeek(fractionAt(e.clientX));
          }}
          onPointerMove={(e) => {
            if (dragging.current) onSeek(fractionAt(e.clientX));
            if (e.pointerType === "mouse" || dragging.current) showTip(e.clientX);
          }}
          onPointerUp={() => {
            dragging.current = false;
          }}
          onPointerCancel={() => {
            dragging.current = false;
          }}
          onPointerLeave={() => !dragging.current && setTip(null)}
          onBlur={() => setTip(null)}
          className="session-strip"
        >
          {Array.from({ length: FRAMES }, (_, i) => (
            <span
              key={i}
              className={`session-frame ${i >= FRAMES_SMALL ? "max-sm:hidden" : ""}`}
              data-tint={i % 2 ? "light" : "dark"}
              style={frames?.[i] ? { backgroundImage: `url(${frames[i]})`, backgroundSize: "cover" } : sliceStyle(scene, photo, i)}
            />
          ))}
          {chapters.map((c) => (
            <span
              key={c.kind + c.from}
              className="session-chapter"
              data-kind={c.kind}
              style={{ left: `${(c.from / total) * 100}%`, width: `${((c.to - c.from) / total) * 100}%` }}
            />
          ))}
          <span
            className="session-playhead"
            data-playing={playing || undefined}
            style={{ left: `${progress * 100}%`, opacity: progress > 0 || playing ? 1 : 0 }}
          />
        </div>
      </div>
      <ul className="mt-1.5 flex gap-3.5 text-[11.5px] leading-4 font-semibold text-muted" aria-label="Chapters">
        {kinds.map((k) => (
          <li key={k} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: CHAPTER_COLOR[k] }} aria-hidden />
            {CHAPTER_NAMES[k]}
          </li>
        ))}
      </ul>
    </div>
  );
}
