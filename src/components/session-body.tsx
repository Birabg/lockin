"use client";

import { useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { FocusScene } from "./focus-scene";
import { GoalRing, colorFor } from "./ui";
import { resolveScene } from "@/lib/scenes";
import { formatClock, formatDuration, sessionWindow } from "@/lib/time";
import type { FeedPost } from "@/lib/queries";

type Session = NonNullable<FeedPost["session"]>;

/** Under a minute would read as "0m paused". */
const hasPauses = (s: Session) => s.pausedSec >= 60;

const goalShare = (s: Session) => s.durationSec / (s.goalMin * 60);

// The media column stretches to match the stat panels, so the two always line up.
const mediaShell = "relative aspect-[16/10] w-full overflow-hidden rounded-2xl @xl:aspect-auto @xl:min-h-60";
const pill = "absolute rounded-full bg-black/65 px-3 py-1 text-xs font-bold text-white";

function LabelPill({ label }: { label: string | null }) {
  if (!label) return null;
  return <span className={`${pill} bottom-3 left-3 max-w-[calc(100%-1.5rem)] truncate`}>{label}</span>;
}

function Timelapse({ src, label }: { src: string; label: string | null }) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  function toggle() {
    const v = video.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => setPlaying(false));
    else v.pause();
  }

  return (
    <button onClick={toggle} aria-label={playing ? "Pause timelapse" : "Play timelapse"} className={`${mediaShell} block bg-black`}>
      <video
        ref={video}
        src={src}
        muted
        loop
        playsInline
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="absolute inset-0 size-full object-cover"
      />
      <span className={`${pill} top-3 right-3 flex items-center gap-1`}>
        {playing ? <Pause className="size-3 fill-current" /> : <Play className="size-3 fill-current" />} Timelapse
      </span>
      <LabelPill label={label} />
    </button>
  );
}

function SessionMedia({ post, session }: { post: FeedPost; session: Session }) {
  if (post.mediaUrl && post.mediaType === "timelapse") return <Timelapse src={post.mediaUrl} label={session.label} />;
  if (post.mediaUrl) {
    return (
      <div className={`${mediaShell} bg-inset`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- remote hosts vary by deployment, and these are already resized */}
        <img
          src={post.mediaUrl}
          alt={`Photo from ${post.user.name}’s session`}
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
        <LabelPill label={session.label} />
      </div>
    );
  }
  const scene = resolveScene(post.user.sceneId);
  return (
    <FocusScene scene={scene} compact className={mediaShell}>
      <div className="absolute inset-0 grid place-items-center">
        <GoalRing pct={goalShare(session)} size={112} stroke={9} minArc={0.06} color={scene.accent} track="rgb(255 255 255 / 0.2)">
          <span className="text-lg font-extrabold tabular">{formatDuration(session.durationSec)}</span>
        </GoalRing>
      </div>
      <LabelPill label={session.label} />
    </FocusScene>
  );
}

function SessionPanel({ session, timeZone }: { session: Session; timeZone: string }) {
  const start = new Date(session.startedAt);
  const end = session.endedAt ? new Date(session.endedAt) : new Date(start.getTime() + (session.durationSec + session.pausedSec) * 1000);
  const { leftPct, widthPct, ticks } = sessionWindow(start, end, timeZone);
  return (
    <section className="rounded-2xl bg-inset p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-muted">Session</h3>
        <p className="font-extrabold tabular">{formatDuration(session.durationSec)}</p>
      </div>
      <div
        role="img"
        aria-label={`From ${formatClock(start, timeZone)} to ${formatClock(end, timeZone)}`}
        className="relative mt-2 h-2 overflow-hidden rounded-full bg-background"
      >
        <div className="absolute inset-y-0 rounded-full bg-primary" style={{ left: `${leftPct}%`, width: `${widthPct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-subtle tabular">
        {ticks.map((tick, i) => (
          <span key={i}>{tick}</span>
        ))}
      </div>
      {hasPauses(session) && <p className="mt-1 text-xs text-muted">{formatDuration(session.pausedSec)} paused</p>}
    </section>
  );
}

function LegendRow({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm font-bold tabular">
      <span className="size-2.5 rounded-full" style={{ background: color }} aria-hidden />
      {children}
    </p>
  );
}

function GoalPanel({ session }: { session: Session }) {
  const pct = goalShare(session);
  return (
    <section className="rounded-2xl bg-inset p-3">
      <h3 className="text-sm font-semibold text-muted">Goal</h3>
      <div className="mt-2 flex items-center gap-3">
        <GoalRing pct={pct} size={64} stroke={8} minArc={0.06} track="var(--border)">
          <span className="text-[13px] leading-none font-extrabold tabular">{Math.round(Math.min(pct, 9.99) * 100)}%</span>
        </GoalRing>
        {hasPauses(session) ? (
          <div className="min-w-0 space-y-1">
            <LegendRow color="var(--live)">{formatDuration(session.durationSec)} focused</LegendRow>
            <LegendRow color="var(--streak)">{formatDuration(session.pausedSec)} paused</LegendRow>
          </div>
        ) : (
          <div className="min-w-0">
            <p className="text-2xl leading-tight font-extrabold tabular">{formatDuration(session.durationSec)}</p>
            <p className="text-xs text-muted">of {formatDuration(session.goalMin * 60)} target</p>
          </div>
        )}
      </div>
    </section>
  );
}

/** TODO(app-tracking): sessions only know their label today. Return real per-app time here once it's tracked. */
function sessionItems(session: Session) {
  return session.label ? [{ name: session.label, sec: session.durationSec }] : [];
}

function ItemsRow({ session }: { session: Session }) {
  const items = sessionItems(session);
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-inset px-3 py-2">
      {items.map((item) => (
        <li key={item.name} title={item.name} className="flex items-center gap-1.5 text-xs font-bold tabular">
          <span
            className="grid size-5 place-items-center rounded-md text-[11px] font-extrabold text-[#0a0f1a]"
            style={{ background: colorFor(item.name) }}
            aria-hidden
          >
            {item.name.charAt(0).toUpperCase()}
          </span>
          <span className="sr-only">{item.name}</span>
          {formatDuration(item.sec)}
        </li>
      ))}
    </ul>
  );
}

/** Stacks until the card itself is wide enough, so it fits wherever the feed is shown. */
export function SessionBody({ post, session, timeZone }: { post: FeedPost; session: Session; timeZone: string }) {
  return (
    <div className="mt-3 grid gap-2 px-4 @xl:grid-cols-[3fr_2fr]">
      <SessionMedia post={post} session={session} />
      <div className="flex min-w-0 flex-col gap-2">
        <SessionPanel session={session} timeZone={timeZone} />
        <GoalPanel session={session} />
        <ItemsRow session={session} />
      </div>
    </div>
  );
}
