"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { discardFocus, pauseFocus, resumeFocus, startFocus, stopFocus, type ActiveSession } from "@/app/actions/focus";
import { attachPhoto, attachTimelapse } from "@/app/actions/media";
import { saveScene } from "@/app/actions/scene";
import { prefersReducedMotion } from "@/components/focus-dial";
import { FocusScene } from "@/components/focus-scene";
import { FocusSetup } from "@/components/focus-setup";
import { ImmersiveTimer } from "@/components/immersive-timer";
import { notifyFocusChange } from "@/components/focus-heartbeat";
import { ScenePicker } from "@/components/scene-picker";
import { toast } from "@/components/toaster";
import { Icon } from "@/components/icon";
import { ClockDigits, GoalRing, btnGhost, btnPrimary, inputCls } from "@/components/ui";
import { snapMinutes } from "@/lib/dial";
import { isSceneId, resolveScene } from "@/lib/scenes";
import { activeSeconds } from "@/lib/session-math";
import { buildTimelapse, canRecordScreen, discardRecording, hasFrames, isRecording, startRecording, stopRecording } from "@/lib/timelapse";
import { uploadBlob } from "@/lib/upload";
import { useWakeLock } from "@/lib/use-wake-lock";
import { formatDuration, formatTimer } from "@/lib/time";
import { brand } from "@/lib/brand";

const SCENE_KEY = "lockin-scene";
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const FADE_MS = 400;
/** Long enough for the lock to click shut and its pulse to play before the session takes over. */
const LOCK_MS = 600;

const elapsedSeconds = (s: ActiveSession, now: number) =>
  activeSeconds(
    { startedAt: new Date(s.startedAt), pausedSec: s.pausedSec, pausedAt: s.pausedAt ? new Date(s.pausedAt) : null },
    new Date(now),
  );

async function publishTimelapse(postId: string) {
  try {
    toast("Building your timelapse…");
    const video = await buildTimelapse();
    if (!video) return toast("Not enough footage for a timelapse", "error");
    await attachTimelapse(postId, await uploadBlob("timelapse", video));
    toast("Timelapse added to your post");
  } catch (e) {
    toast(e instanceof Error ? e.message : "Couldn't save the timelapse", "error");
  }
}

async function publishPhoto(postId: string, file: File) {
  try {
    const res = await attachPhoto(postId, await uploadBlob("photo", file));
    if (res.error) toast(res.error, "error");
    else toast("Photo added to your post");
  } catch (e) {
    toast(e instanceof Error ? e.message : "Couldn't save the photo", "error");
  }
}

const stateKey = (s: ActiveSession | null) => (s ? `${s.id}:${s.pausedSec}:${s.pausedAt}` : "");

type Props = {
  active: ActiveSession | null;
  todaySec: number;
  dailyGoalMin: number;
  liveCount: number;
  liveUsers: { id: string; name: string; avatar: string | null }[];
  labels: string[];
  serverNow: number;
  savedSceneId: string | null;
  streak: number;
  user: { name: string; username: string; avatar: string | null };
  timeZone: string;
};

export function TimerClient(props: Props) {
  const { active, todaySec, dailyGoalMin, liveCount, liveUsers, labels, serverNow, savedSceneId, streak, user, timeZone } = props;
  const router = useRouter();
  const [session, setSession] = useState<ActiveSession | null>(active);
  const [goal, setGoal] = useState(snapMinutes(active?.goalMin ?? 25)); // the dial has no 37 or 8h, and a running session keeps its own
  const [label, setLabel] = useState(active?.label ?? "");
  const [now, setNow] = useState(serverNow); // same value on server and client, so hydration matches
  const [finishing, setFinishing] = useState(false);
  const [note, setNote] = useState("");
  const [share, setShare] = useState(true);
  const [photo, setPhoto] = useState<File | null>(null);
  const [record, setRecord] = useState(false);
  const [recordable, setRecordable] = useState(false);
  const [recording, setRecording] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [sceneId, setSceneId] = useState(savedSceneId);
  const [error, setError] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [mounted, setMounted] = useState(false);
  // arriving at a running session opens straight into it, with no fade from the page
  const [fadeIn, setFadeIn] = useState(!active);
  const [pending, start] = useTransition();
  const notified = useRef(false);

  const scene = resolveScene(sceneId);
  const elapsed = session ? elapsedSeconds(session, now) : 0;
  const paused = !!session?.pausedAt;
  const goalSec = (session?.goalMin ?? goal) * 60;
  const pct = elapsed / goalSec;
  const immersive = !!session && !minimized;
  const showOverlay = useStaysFor(immersive, FADE_MS);
  // todaySec already holds this session up to when the page was rendered, so only add what's come since
  const todayNow = todaySec + (session ? Math.max(0, elapsed - elapsedSeconds(session, serverNow)) : 0);

  // what the overlay keeps showing while it fades out after the session has gone
  const lastView = useRef({ elapsed, pct, paused, label: session?.label ?? null, todayNow });
  if (session) lastView.current = { elapsed, pct, paused, label: session.label, todayNow };

  useWakeLock(!!session);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!session) setMinimized(false);
  }, [session]);

  // the nav is hidden from CSS, so nothing on the page loses its state
  useEffect(() => {
    if (!immersive) {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      return;
    }
    document.documentElement.dataset.immersive = "";
    return () => {
      delete document.documentElement.dataset.immersive;
    };
  }, [immersive]);

  useEffect(() => {
    setRecordable(canRecordScreen());
    setRecording(isRecording());
  }, []);

  // the account's choice wins, and this browser's copy covers anyone without one yet
  useEffect(() => {
    if (savedSceneId) return;
    try {
      const local = localStorage.getItem(SCENE_KEY);
      if (local && isSceneId(local)) setSceneId(local);
    } catch {
      // storage can be blocked, and the default scene is fine then
    }
  }, [savedSceneId]);

  function onPickScene(id: string) {
    setSceneId(id);
    try {
      localStorage.setItem(SCENE_KEY, id);
    } catch {
      // still saved to the account below
    }
    saveScene(id)
      .then((res) => res.error && toast(res.error, "error"))
      .catch(() => toast("Couldn't save your background", "error"));
  }

  // space finishes, escape backs out of wrapping up. Holding space to start lives with the dial.
  const keys = useRef({ onConfirmFinish, setFinishing, session, finishing, pending, immersive });
  keys.current = { onConfirmFinish, setFinishing, session, finishing, pending, immersive };
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const k = keys.current;
      if (k.immersive) return; // the immersive view has its own keys
      if (e.key === "Escape" && k.finishing) return k.setFinishing(false);
      if (e.code !== "Space" || e.repeat || k.pending || !k.session) return;
      if ((e.target as HTMLElement).closest("input, textarea, select, button, a")) return;
      e.preventDefault();
      if (!k.finishing) k.setFinishing(true);
      else k.onConfirmFinish();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // tick
  useEffect(() => {
    if (!session) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [session]);

  // follow the server when the session changes elsewhere (another tab or device, or it timed out).
  // While wrapping up we keep it, so the note can still be saved.
  const serverState = stateKey(active);
  useEffect(() => {
    if (pending || finishing || serverState === stateKey(session)) return;
    if (session && !active) setError("That session ended in another tab or timed out. Your time up to then is saved.");
    setSession(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverState]);

  // tab title + goal notification
  useEffect(() => {
    document.title = session ? `${formatTimer(elapsed)} · ${brand.name}` : `Focus · ${brand.name}`;
    if (session && pct >= 1 && !notified.current) {
      notified.current = true;
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Goal reached 🎯", { body: `You hit ${formatDuration(goalSec)}. Keep going or wrap up.` });
      }
    }
  }, [session, elapsed, pct, goalSec]);

  function onStart() {
    setError(null);
    setFadeIn(true);
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
    start(async () => {
      try {
        if (record) {
          await startRecording().catch(() => toast("No screen shared, so this session won't have a timelapse"));
          setRecording(isRecording());
        }
        const lockPlayed = new Promise((done) => setTimeout(done, prefersReducedMotion() ? 0 : LOCK_MS));
        const [s] = await Promise.all([startFocus(goal, label), lockPlayed]);
        notified.current = false;
        setNow(Date.now());
        setSession(s);
        setDone(null);
        notifyFocusChange();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't start");
      }
    });
  }

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so picking the same file again still fires
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) return toast("Pick a JPG, PNG or WebP image", "error");
    if (file.size > PHOTO_MAX_BYTES) return toast("That photo is over 5MB", "error");
    setPhoto(file);
  }

  function onConfirmFinish() {
    if (!session) return;
    setError(null);
    start(async () => {
      try {
        const res = await stopFocus(session.id, { share, note });
        setSession(null);
        setFinishing(false);
        setNote("");
        setPhoto(null);
        setDone(res.ok ? res.durationSec : null);
        if (!res.ok) setError("That session was already discarded.");
        stopRecording();
        setRecording(false);
        if (res.ok && res.postId && hasFrames()) void publishTimelapse(res.postId);
        else discardRecording();
        if (res.ok && res.postId && photo) void publishPhoto(res.postId, photo);
        notifyFocusChange();
        router.refresh();
      } catch {
        setError("Couldn't save the session. Check your connection and try again.");
      }
    });
  }

  function onTogglePause() {
    if (!session) return;
    setError(null);
    start(async () => {
      try {
        const next = await (paused ? resumeFocus(session.id) : pauseFocus(session.id));
        setNow(Date.now());
        setSession(next);
        notifyFocusChange();
      } catch {
        setError("Couldn't update the session. Check your connection and try again.");
      }
    });
  }

  function onDiscard() {
    if (!session || !confirmDiscard()) return;
    setError(null);
    start(async () => {
      try {
        await discardFocus(session.id);
        discardRecording();
        setRecording(false);
        setSession(null);
        setFinishing(false);
        notifyFocusChange();
        router.refresh();
      } catch {
        setError("Couldn't discard the session. Check your connection and try again.");
      }
    });
  }

  const wrapUp = (
    <>
      <p className="font-bold">Wrap up · {formatDuration(elapsed)}</p>
      <textarea
        aria-label="Note for your post"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={session?.label ?? "How did it go?"}
        rows={2}
        maxLength={280}
        className={`${inputCls} resize-none`}
      />
      <label className="flex items-center gap-2 text-sm font-semibold text-muted">
        <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="size-4 accent-[var(--primary)]" />
        Share to the feed {elapsed < 60 && <span className="text-subtle">(sessions under 1 min aren’t posted)</span>}
      </label>
      {/* a post has one piece of media, and a recording already fills that */}
      {share && elapsed >= 60 && !recording && (
        <div className="flex items-center gap-2 text-sm font-semibold text-muted">
          <label className="flex min-w-0 cursor-pointer items-center gap-2 hover:text-foreground">
            <Icon name="image" size={18} />
            <span className="truncate">{photo ? photo.name : "Add a photo"}</span>
            <input type="file" accept={PHOTO_TYPES.join(",")} onChange={onPickPhoto} className="sr-only" />
          </label>
          {photo && (
            <button onClick={() => setPhoto(null)} aria-label="Remove photo" className="rounded-full p-1 hover:bg-inset">
              <Icon name="close" size={18} weight="regular" />
            </button>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={() => setFinishing(false)} className={`${btnGhost} h-11 flex-1 text-sm`}>
          Keep going
        </button>
        <button onClick={onConfirmFinish} disabled={pending} className={`${btnPrimary} h-11 flex-1 text-sm`}>
          Save session
        </button>
      </div>
    </>
  );

  return (
    <div className="flex flex-col items-center">
      {showOverlay &&
        (mounted ? (
          <ImmersiveTimer
            scene={scene}
            {...lastView.current}
            recording={recording}
            streak={streak}
            todaySec={lastView.current.todayNow}
            user={user}
            timeZone={timeZone}
            now={now}
            leaving={!immersive}
            fadeIn={fadeIn}
            finishing={finishing}
            wrapUp={wrapUp}
            error={error}
            pending={pending}
            onTogglePause={onTogglePause}
            onFinish={() => setFinishing(true)}
            onCancelFinish={() => setFinishing(false)}
            onDiscard={onDiscard}
            onMinimize={() => {
              setMinimized(true);
              setFinishing(false);
            }}
            onPickScene={onPickScene}
          />
        ) : (
          // holds the screen until the portal can render, so the page never flashes first
          <div className="fixed inset-0 z-50 bg-black" />
        ))}

      <div className="mb-2 flex w-full justify-end">
        <ScenePicker current={scene} onPick={onPickScene} />
      </div>

      {done !== null && !session && (
        <div className="mb-4 flex items-center gap-2 rounded-full bg-primary-light px-4 py-2 text-sm font-bold text-primary-text">
          <Icon name="check" size={18} weight="regular" /> Logged {formatDuration(done)} · today {formatDuration(todaySec)}
        </div>
      )}

      {session ? (
        <FocusScene scene={scene}>
          <div className="flex flex-col items-center px-4 py-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Icon name="focusingNow" size={18} className="animate-live" style={{ color: scene.accent }} /> {liveCount} focusing right now
            </p>

            <div className="mt-4">
              <GoalRing pct={pct} size={280} stroke={14} color={scene.accent} track="rgb(255 255 255 / 0.2)">
                <div className="text-center">
                  <p className="text-[44px] leading-none font-extrabold tabular">
                    <ClockDigits value={formatTimer(elapsed)} />
                  </p>
                  <p className="mt-2 flex items-center justify-center gap-1.5 text-sm font-semibold">
                    <span className="size-2 rounded-full" style={{ background: scene.accent }} aria-hidden />
                    {paused ? "Paused" : pct >= 1 ? "Goal reached — keep going" : `Goal ${formatDuration(goalSec)}`}
                  </p>
                  {session.label && <p className="mt-1 text-xs font-bold">{session.label}</p>}
                  {recording && <p className="mt-1 text-xs font-bold">● Recording screen</p>}
                </div>
              </GoalRing>
            </div>
          </div>
        </FocusScene>
      ) : (
        <FocusSetup
          scene={scene}
          goal={goal}
          onGoal={setGoal}
          label={label}
          onLabel={setLabel}
          labels={labels}
          liveCount={liveCount}
          liveUsers={liveUsers}
          todaySec={todaySec}
          dailyGoalMin={dailyGoalMin}
          serverNow={serverNow}
          timeZone={timeZone}
          starting={pending}
          onStart={onStart}
          footer={
            recordable && (
              <label className="flex items-center gap-2 text-sm font-semibold text-muted">
                <input
                  type="checkbox"
                  checked={record}
                  onChange={(e) => setRecord(e.target.checked)}
                  className="size-4 accent-[var(--primary)]"
                />
                Record a timelapse of my screen
              </label>
            )
          }
        />
      )}

      {session && !finishing && (
        <div className="mt-10 flex w-full gap-3">
          <button onClick={onDiscard} disabled={pending} className={`${btnGhost} h-14 px-5`} aria-label="Discard session">
            <Icon name="delete" className="text-muted" />
          </button>
          <button
            onClick={onTogglePause}
            disabled={pending}
            className={`${btnGhost} h-14 px-5`}
            aria-label={paused ? "Resume session" : "Pause session"}
          >
            <Icon name={paused ? "startFocus" : "pause"} weight="fill" />
          </button>
          <button
            onClick={() => {
              setFadeIn(true);
              setMinimized(false);
            }}
            className={`${btnGhost} h-14 px-5`}
            aria-label="Back to the full screen view"
          >
            <Icon name="fullscreen" />
          </button>
          <button onClick={() => setFinishing(true)} disabled={pending} className={`${btnPrimary} h-14 flex-1 text-base`}>
            <Icon name="stop" size={18} weight="fill" /> Finish session
          </button>
        </div>
      )}

      {session && finishing && !immersive && <div className="panel mt-8 w-full space-y-3 p-4">{wrapUp}</div>}

      {error && <p className="mt-4 text-center text-sm text-danger">{error}</p>}
    </div>
  );
}

/** Stays true for a while after `show` turns off, so what it controls can fade out first. */
function useStaysFor(show: boolean, ms: number) {
  const [stay, setStay] = useState(show);
  useEffect(() => {
    if (show) return setStay(true);
    const id = setTimeout(() => setStay(false), ms);
    return () => clearTimeout(id);
  }, [show, ms]);
  return show || stay;
}

function confirmDiscard() {
  return window.confirm("Discard this session? It won't count toward your stats.");
}
