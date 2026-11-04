"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pause, Play, Radio, Square, Trash2 } from "lucide-react";
import { discardFocus, pauseFocus, resumeFocus, startFocus, stopFocus, type ActiveSession } from "@/app/actions/focus";
import { attachTimelapse } from "@/app/actions/media";
import { saveScene } from "@/app/actions/scene";
import { FocusScene } from "@/components/focus-scene";
import { notifyFocusChange } from "@/components/focus-heartbeat";
import { ScenePicker } from "@/components/scene-picker";
import { toast } from "@/components/toaster";
import { GoalRing, btnGhost, btnPrimary, inputCls } from "@/components/ui";
import { isSceneId, resolveScene } from "@/lib/scenes";
import { activeSeconds } from "@/lib/session-math";
import { buildTimelapse, canRecordScreen, discardRecording, hasFrames, isRecording, startRecording, stopRecording } from "@/lib/timelapse";
import { uploadBlob } from "@/lib/upload";
import { formatDuration, formatTimer } from "@/lib/time";
import { brand } from "@/lib/brand";

const PRESETS = [25, 50, 90, 120];
const SCENE_KEY = "lockin-scene";

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

const stateKey = (s: ActiveSession | null) => (s ? `${s.id}:${s.pausedSec}:${s.pausedAt}` : "");

type Props = {
  active: ActiveSession | null;
  todaySec: number;
  dailyGoalMin: number;
  liveCount: number;
  serverNow: number;
  savedSceneId: string | null;
};

export function TimerClient({ active, todaySec, dailyGoalMin, liveCount, serverNow, savedSceneId }: Props) {
  const router = useRouter();
  const [session, setSession] = useState<ActiveSession | null>(active);
  const [goal, setGoal] = useState(active?.goalMin ?? 25);
  const [label, setLabel] = useState(active?.label ?? "");
  const [now, setNow] = useState(serverNow); // same value on server and client, so hydration matches
  const [finishing, setFinishing] = useState(false);
  const [note, setNote] = useState("");
  const [share, setShare] = useState(true);
  const [record, setRecord] = useState(false);
  const [recordable, setRecordable] = useState(false);
  const [recording, setRecording] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [sceneId, setSceneId] = useState(savedSceneId);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const notified = useRef(false);

  const scene = resolveScene(sceneId);
  const elapsed = session ? elapsedSeconds(session, now) : 0;
  const paused = !!session?.pausedAt;
  const goalSec = (session?.goalMin ?? goal) * 60;
  const pct = elapsed / goalSec;

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

  // space starts and finishes, escape backs out of wrapping up
  const keys = useRef({ onStart, onConfirmFinish, setFinishing, session, finishing, pending });
  keys.current = { onStart, onConfirmFinish, setFinishing, session, finishing, pending };
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const k = keys.current;
      if (e.key === "Escape" && k.finishing) return k.setFinishing(false);
      if (e.code !== "Space" || e.repeat || k.pending) return;
      if ((e.target as HTMLElement).closest("input, textarea, select, button, a")) return;
      e.preventDefault();
      if (!k.session) k.onStart();
      else if (!k.finishing) k.setFinishing(true);
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
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
    start(async () => {
      try {
        if (record) {
          await startRecording().catch(() => toast("No screen shared, so this session won't have a timelapse"));
          setRecording(isRecording());
        }
        const s = await startFocus(goal, label);
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

  function onConfirmFinish() {
    if (!session) return;
    setError(null);
    start(async () => {
      try {
        const res = await stopFocus(session.id, { share, note });
        setSession(null);
        setFinishing(false);
        setNote("");
        setDone(res.ok ? res.durationSec : null);
        if (!res.ok) setError("That session was already discarded.");
        stopRecording();
        setRecording(false);
        if (res.ok && res.postId && hasFrames()) void publishTimelapse(res.postId);
        else discardRecording();
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

  return (
    <div className="flex flex-col items-center">
      <div className="mb-2 flex w-full justify-end">
        <ScenePicker current={scene} onPick={onPickScene} />
      </div>

      <FocusScene scene={scene}>
        <div className="flex flex-col items-center px-4 py-5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Radio className="size-4 animate-live" style={{ color: scene.accent }} /> {liveCount} focusing right now
          </p>

          <div className="mt-4">
            <GoalRing pct={session ? pct : 0} size={280} stroke={14} color={scene.accent} track="rgb(255 255 255 / 0.2)">
              <div className="text-center">
                <p className="text-[44px] leading-none font-extrabold tracking-tight tabular">
                  {session ? formatTimer(elapsed) : formatTimer(goal * 60)}
                </p>
                <p className="mt-2 flex items-center justify-center gap-1.5 text-sm font-semibold">
                  <span className="size-2 rounded-full" style={{ background: scene.accent }} aria-hidden />
                  {!session ? "Ready" : paused ? "Paused" : pct >= 1 ? "Goal reached — keep going" : `Goal ${formatDuration(goalSec)}`}
                </p>
                {session?.label && <p className="mt-1 text-xs font-bold">{session.label}</p>}
                {recording && <p className="mt-1 text-xs font-bold">● Recording screen</p>}
              </div>
            </GoalRing>
          </div>
        </div>
      </FocusScene>

      {done !== null && !session && (
        <div className="mt-6 flex items-center gap-2 rounded-full bg-primary-light px-4 py-2 text-sm font-bold text-primary-text">
          <Check className="size-4" /> Logged {formatDuration(done)} · today {formatDuration(todaySec)}
        </div>
      )}

      {!session && (
        <div className="mt-8 w-full space-y-4">
          <div>
            <p className="mb-2 text-xs font-bold tracking-wide text-subtle uppercase">Goal</p>
            <div className="grid grid-cols-5 gap-2">
              {PRESETS.map((m) => (
                <button
                  key={m}
                  onClick={() => setGoal(m)}
                  className={`rounded-xl border-2 py-2.5 text-sm font-bold ${goal === m ? "border-primary bg-primary-light text-primary-text" : "border-border bg-card text-muted"}`}
                >
                  {formatDuration(m * 60)}
                </button>
              ))}
              <input
                type="number"
                min={5}
                max={720}
                value={goal}
                onChange={(e) => setGoal(Number(e.target.value))}
                aria-label="Custom goal in minutes"
                className="rounded-xl border-2 border-border bg-card text-center text-sm font-bold outline-none focus:border-primary"
              />
            </div>
          </div>
          {recordable && (
            <label className="flex items-center gap-2 text-sm font-semibold text-muted">
              <input
                type="checkbox"
                checked={record}
                onChange={(e) => setRecord(e.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              Record a timelapse of my screen
            </label>
          )}
          <input
            aria-label="What are you working on?"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="What are you working on? (optional)"
            maxLength={40}
            className={inputCls}
          />
          <button onClick={onStart} disabled={pending} className={`${btnPrimary} h-14 w-full text-base`}>
            <Play className="size-5 fill-current" /> Start focus
          </button>
          <p className="text-center text-xs text-subtle">
            Press space to start. Today {formatDuration(todaySec)} of {formatDuration(dailyGoalMin * 60)} daily goal
          </p>
        </div>
      )}

      {session && !finishing && (
        <div className="mt-10 flex w-full gap-3">
          <button onClick={onDiscard} disabled={pending} className={`${btnGhost} h-14 px-5`} aria-label="Discard session">
            <Trash2 className="size-5 text-muted" />
          </button>
          <button
            onClick={onTogglePause}
            disabled={pending}
            className={`${btnGhost} h-14 px-5`}
            aria-label={paused ? "Resume session" : "Pause session"}
          >
            {paused ? <Play className="size-5 fill-current" /> : <Pause className="size-5 fill-current" />}
          </button>
          <button onClick={() => setFinishing(true)} disabled={pending} className={`${btnPrimary} h-14 flex-1 text-base`}>
            <Square className="size-4 fill-current" /> Finish session
          </button>
        </div>
      )}

      {session && finishing && (
        <div className="panel mt-8 w-full space-y-3 p-4">
          <p className="font-bold">Wrap up · {formatDuration(elapsed)}</p>
          <textarea
            aria-label="Note for your post"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={session.label ?? "How did it go?"}
            rows={2}
            maxLength={280}
            className={`${inputCls} resize-none`}
          />
          <label className="flex items-center gap-2 text-sm font-semibold text-muted">
            <input
              type="checkbox"
              checked={share}
              onChange={(e) => setShare(e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            Share to the feed {elapsed < 60 && <span className="text-subtle">(sessions under 1 min aren’t posted)</span>}
          </label>
          <div className="flex gap-2">
            <button onClick={() => setFinishing(false)} className={`${btnGhost} h-11 flex-1 text-sm`}>
              Keep going
            </button>
            <button onClick={onConfirmFinish} disabled={pending} className={`${btnPrimary} h-11 flex-1 text-sm`}>
              Save session
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-4 text-center text-sm text-danger">{error}</p>}
    </div>
  );
}

function confirmDiscard() {
  return window.confirm("Discard this session? It won't count toward your stats.");
}
