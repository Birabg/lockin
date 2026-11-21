"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { DockButton } from "./focus-stage";
import { Icon } from "./icon";
import {
  AMBIENCES,
  getAmbience,
  getServerAmbience,
  loadAmbience,
  playAmbience,
  playYouTube,
  resumeAmbience,
  setAmbienceVolume,
  stopAmbience,
  subscribeAmbience,
} from "@/lib/ambience";
import { parseYouTube, youTubeEmbedUrl, youTubeWatchUrl } from "@/lib/youtube";

export const useAmbience = () => useSyncExternalStore(subscribeAmbience, getAmbience, getServerAmbience);

/**
 * For the timer page: the sound picked last time comes back on the first press (browsers won't
 * play before one), and it fades out when you leave the page.
 */
export function useAmbienceOnPage() {
  useEffect(() => {
    loadAmbience();
    const wake = () => resumeAmbience();
    window.addEventListener("pointerdown", wake, { once: true, capture: true });
    window.addEventListener("keydown", wake, { once: true, capture: true });
    return () => {
      window.removeEventListener("pointerdown", wake, { capture: true });
      window.removeEventListener("keydown", wake, { capture: true });
      stopAmbience();
    };
  }, []);
}

type TriggerProps = { "aria-expanded": boolean; "aria-haspopup": "dialog"; onClick: () => void };

/** The dock button. Lit in the scene's colour while something is playing. */
export function MusicButton(props: TriggerProps) {
  const { playing } = useAmbience();
  return <DockButton icon="music" label="Music" data-on={playing || undefined} {...props} />;
}

function Choice({ on, title, hint, onPick }: { on: boolean; title: string; hint: string; onPick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onPick}
      className={`rounded-xl px-3 py-2 text-left ring-1 transition-shadow ${
        on ? "ring-2 ring-[var(--stage-accent)]" : "ring-[var(--stage-line)] hover:ring-[var(--stage-muted)]"
      }`}
    >
      <span className="block text-[13px] font-semibold">{title}</span>
      <span className="block truncate text-[11.5px] text-[var(--stage-muted)]">{hint}</span>
    </button>
  );
}

const heading = "text-[11.5px] font-bold tracking-wide text-[var(--stage-faint)] uppercase";

/** Goes in a dock popover: instruments, nature sounds, a YouTube link, and the volume. */
export function MusicPanel() {
  const { sound, volume, youtube } = useAmbience();
  const [link, setLink] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  function playLink(e: FormEvent) {
    e.preventDefault();
    const parsed = parseYouTube(link);
    if (!parsed) return setProblem("That doesn’t look like a YouTube video or playlist link.");
    setProblem(null);
    setLink("");
    playYouTube(parsed);
  }

  const group = (kind: "music" | "nature", label: string) => (
    <section className="flex flex-col gap-2">
      <h3 className={heading}>{label}</h3>
      <div role="group" aria-label={label} className="grid grid-cols-2 gap-2">
        {AMBIENCES.filter((a) => a.kind === kind).map((a) => (
          <Choice key={a.id} on={sound === a.id} title={a.title} hint={a.hint} onPick={() => playAmbience(a.id)} />
        ))}
        {kind === "nature" && <Choice on={sound === null} title="Off" hint="Just the quiet" onPick={() => playAmbience(null)} />}
      </div>
    </section>
  );

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2 rounded-2xl bg-[#0f0f0f] p-3 text-[#f1f1f1] ring-1 ring-[#303030]">
        <h3 className="flex items-center gap-1.5 text-[13px] font-bold">
          <YouTubeMark size={20} />
          YouTube
        </h3>
        {youtube && (
          <button
            type="button"
            aria-pressed={sound === "youtube"}
            onClick={() => playAmbience("youtube")}
            className={`flex min-w-0 flex-col rounded-xl bg-[#212121] px-3 py-2 text-left ring-1 transition-shadow ${
              sound === "youtube" ? "ring-2 ring-[#FF0033]" : "ring-[#303030] hover:ring-[#aaaaaa]"
            }`}
          >
            <span className="block text-[13px] font-semibold">Your YouTube link</span>
            <span className="block truncate text-[11.5px] text-[#aaaaaa]">
              {youTubeWatchUrl(youtube).replace(/^https:\/\/(www\.)?/, "")}
            </span>
          </button>
        )}
        <form onSubmit={playLink} className="flex gap-2">
          <input
            type="text"
            inputMode="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Paste a YouTube link"
            aria-label="YouTube link"
            aria-invalid={!!problem || undefined}
            aria-describedby={problem ? "youtube-problem" : undefined}
            className="h-9 min-w-0 flex-1 rounded-full border border-[#303030] bg-[#121212] px-4 text-[13px] text-[#f1f1f1] outline-none placeholder:text-[#888888] focus:border-[#1c62b9]"
          />
          <button
            type="submit"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[#FF0033] px-4 text-[13px] font-semibold text-white hover:bg-[#e0002d]"
          >
            <YouTubeMark size={16} white />
            Play
          </button>
        </form>
        {problem ? (
          <p id="youtube-problem" role="alert" className="text-[11.5px] text-[#ff4e45]">
            {problem}
          </p>
        ) : (
          <p className="text-[11.5px] text-[#aaaaaa]">
            A video or a playlist. Just the sound plays, with a now-playing pill above the dock. YouTube’s ads may play too.
          </p>
        )}
      </section>

      {group("music", "Instruments")}
      {group("nature", "Nature & noise")}

      <label className="flex items-center gap-3 text-[13px] font-semibold">
        <span>Volume</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(e) => setAmbienceVolume(Number(e.target.value) / 100)}
          className="min-w-0 flex-1 accent-[var(--stage-accent)]"
        />
      </label>
      <p className="text-[11.5px] text-[var(--stage-faint)]">
        The instruments and nature sounds are made in your browser, so they work offline. Whatever you pick keeps playing through your
        session.
      </p>
    </div>
  );
}

const YT_ORIGIN = "https://www.youtube-nocookie.com";

/** YouTube's play-button logo: a red rounded rectangle with a white triangle. */
function YouTubeMark({ size = 20, white = false }: { size?: number; white?: boolean }) {
  return (
    <svg viewBox="0 0 28 20" width={size} height={(size * 20) / 28} aria-hidden className="shrink-0">
      <rect width="28" height="20" rx="5.5" fill={white ? "#fff" : "#FF0033"} />
      <path d="M11.2 5.8v8.4l7.3-4.2z" fill={white ? "#FF0033" : "#fff"} />
    </svg>
  );
}

const PlayGlyph = () => (
  <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden>
    <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
  </svg>
);
const PauseGlyph = () => (
  <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden>
    <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
  </svg>
);

type PlayerInfo = { title: string | null; state: "playing" | "paused" | "loading"; blocked: boolean };
const FRESH: PlayerInfo = { title: null, state: "loading", blocked: false };

/*
 * The hidden player and the pill above the dock are separate: the player lives on the timer page so
 * it survives switching screens, and each screen's dock shows a pill that reads and drives it.
 * They share what the player last said through this little store, keyed by the link so a new
 * link starts fresh.
 */
let ytFrame: HTMLIFrameElement | null = null;
let ytInfo: { key: string; value: PlayerInfo } = { key: "", value: FRESH };
const ytListeners = new Set<() => void>();

function updateYt(key: string, change: (i: PlayerInfo) => PlayerInfo) {
  const base = ytInfo.key === key ? ytInfo.value : FRESH;
  const next = change(base);
  if (next === base && ytInfo.key === key) return;
  ytInfo = { key, value: next };
  ytListeners.forEach((l) => l());
}

const subscribeYt = (l: () => void) => {
  ytListeners.add(l);
  return () => ytListeners.delete(l);
};
const getYt = () => ytInfo;

// the embed's own player API, spoken over postMessage, so no YouTube script is loaded into the page
function ytSend(message: object) {
  ytFrame?.contentWindow?.postMessage(JSON.stringify(message), YT_ORIGIN);
}
const ytCommand = (func: string, args: unknown[] = []) => ytSend({ event: "command", func, args });

const linkKeyOf = (link: { video: string | null; list: string | null } | null) => (link ? `${link.video}:${link.list}` : "");

/**
 * The pasted YouTube link, as sound only. The embed stays mounted but off-screen and invisible
 * (display:none can stop it playing). Hiding the player goes against YouTube's terms; the site
 * owner chose that knowingly. Rendered once on the timer page and portaled to body, so it keeps
 * playing from setup into a session and back. The pill above the dock is its face.
 */
export function YouTubeAudio() {
  const { sound, playing, youtube, volume } = useAmbience();
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const linkKey = linkKeyOf(youtube);

  const sendVolume = useCallback(() => ytCommand("setVolume", [Math.round(volume * 100)]), [volume]);
  useEffect(sendVolume, [sendVolume]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== YT_ORIGIN || !ytFrame || e.source !== ytFrame.contentWindow || typeof e.data !== "string") return;
      let data: { event?: string; info?: unknown };
      try {
        data = JSON.parse(e.data);
      } catch {
        return;
      }
      if (data.event === "onError" && (data.info === 101 || data.info === 150)) {
        updateYt(linkKey, (i) => ({ ...i, blocked: true }));
        return;
      }
      if (!data.info || typeof data.info !== "object") return;
      const said = data.info as { videoData?: { title?: unknown }; playerState?: unknown };
      updateYt(linkKey, (i) => {
        const title = typeof said.videoData?.title === "string" && said.videoData.title ? said.videoData.title : i.title;
        const state = said.playerState === 1 ? "playing" : said.playerState === 2 ? "paused" : i.state;
        return title === i.title && state === i.state ? i : { ...i, title, state };
      });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [linkKey]);

  if (!origin || sound !== "youtube" || !playing || !youtube) return null;
  const hello = () => {
    ytSend({ event: "listening", id: 1, channel: "widget" });
    sendVolume();
  };
  return createPortal(
    <iframe
      key={linkKey}
      ref={(el) => {
        ytFrame = el;
      }}
      title="YouTube audio"
      src={youTubeEmbedUrl(youtube, origin)}
      onLoad={() => {
        hello();
        setTimeout(hello, 1500); // the player can take a moment to listen after the frame loads
      }}
      allow="autoplay; encrypted-media"
      referrerPolicy="strict-origin-when-cross-origin"
      aria-hidden
      tabIndex={-1}
      data-youtube-frame
      style={{ position: "fixed", left: -9999, top: 0, width: 200, height: 113, opacity: 0, pointerEvents: "none", border: 0 }}
    />,
    document.body,
  );
}

/**
 * What's playing from YouTube, as a pill just above the dock: title, play/pause, a link out, and
 * stop. Goes inside each screen's .stage-dock-wrap. `hidden` fades it with the dock.
 */
export function YouTubePill({ hidden = false }: { hidden?: boolean }) {
  const { sound, playing, youtube } = useAmbience();
  const info = useSyncExternalStore(subscribeYt, getYt, getYt);
  if (sound !== "youtube" || !playing || !youtube) return null;
  const linkKey = linkKeyOf(youtube);
  const now = info.key === linkKey ? info.value : FRESH;
  const paused = now.state === "paused";
  return (
    <div data-youtube-player role="region" aria-label="YouTube now playing" className={`stage-yt-pill ${hidden ? "stage-hidden" : ""}`}>
      <YouTubeMark size={22} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold" data-youtube-title>
          {now.blocked ? "This video can’t play here" : (now.title ?? "YouTube")}
        </span>
        <span className="block truncate text-[11px] text-[#aaaaaa]">
          {now.blocked
            ? "Its owner turned off playing on other sites"
            : paused
              ? "Paused"
              : now.state === "playing"
                ? "Playing"
                : "Loading…"}
        </span>
      </span>
      {!now.blocked && (
        <button
          type="button"
          aria-label={paused ? "Play" : "Pause"}
          onClick={() => {
            ytCommand(paused ? "playVideo" : "pauseVideo");
            updateYt(linkKey, (i) => ({ ...i, state: paused ? "playing" : "paused" }));
          }}
          className="grid size-8 shrink-0 place-items-center rounded-full bg-[#f1f1f1] text-[#0f0f0f] hover:bg-white"
        >
          {paused ? <PlayGlyph /> : <PauseGlyph />}
        </button>
      )}
      <a
        href={youTubeWatchUrl(youtube)}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-full px-2.5 py-1.5 text-[12px] font-semibold whitespace-nowrap text-[#f1f1f1] hover:bg-[#3f3f3f]"
      >
        Open on YouTube
      </a>
      <button
        type="button"
        aria-label="Stop YouTube"
        onClick={() => playAmbience(null)}
        className="grid size-8 shrink-0 place-items-center rounded-full text-[#aaaaaa] hover:bg-[#3f3f3f] hover:text-[#f1f1f1]"
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
