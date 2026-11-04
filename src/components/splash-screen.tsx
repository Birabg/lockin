"use client";

import { useEffect } from "react";
import { logoStyle } from "./ui";
import { LOCK_PATH, brand } from "@/lib/brand";
import { loadSoundMuted, playLock, wakeSound } from "@/lib/dial-sound";
import { SNAP_IMPACT, SPLASH } from "@/lib/splash";

const INTERACTED_KEY = "lockin-interacted";
const TICKS = Array.from({ length: 12 }, (_, i) => i);

const CLOCK_MS = SPLASH.draw + SPLASH.sweep;
const LOCK_MS = SPLASH.form + SPLASH.snap + SPLASH.word + SPLASH.hold;

const times = {
  "--draw": `${SPLASH.draw}ms`,
  "--sweep": `${SPLASH.sweep}ms`,
  "--form": `${SPLASH.form}ms`,
  "--snap": `${SPLASH.snap}ms`,
  "--word": `${SPLASH.word}ms`,
  "--fade": `${SPLASH.fade}ms`,
  "--loop": `${SPLASH.loop}ms`,
  "--impact": `${SPLASH.form + SPLASH.snap * SNAP_IMPACT}ms`,
} as React.CSSProperties;

function hasInteractedBefore() {
  try {
    return localStorage.getItem(INTERACTED_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberInteraction() {
  try {
    localStorage.setItem(INTERACTED_KEY, "1");
  } catch {
    // the click just stays off
  }
}

/** The shackle, in the logo's own 28-unit tile. */
const SHACKLE = "M11.33 12.67V11.33a2.67 2.67 0 0 1 5.34 0v1.34";

/**
 * Sent in the HTML and hidden unless the script in <head> marks this visit, so the clock runs on CSS
 * alone while the page's JavaScript is still loading. This only decides when the lock can start.
 */
export function SplashScreen() {
  useEffect(() => {
    window.addEventListener("pointerdown", rememberInteraction, { once: true });
    window.addEventListener("keydown", rememberInteraction, { once: true });

    const root = document.documentElement;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (run: () => void, wait: number) => timers.add(setTimeout(run, wait));
    const clearTimers = () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };

    function reveal() {
      if (root.dataset.splash !== "play") return;
      root.dataset.splash = "reveal";
      later(() => {
        delete root.dataset.splash;
        delete root.dataset.splashPhase;
      }, SPLASH.fade);
    }

    function toEnd() {
      clearTimers();
      root.dataset.splashPhase = "end";
      reveal();
    }

    function onSkip(e: Event) {
      if (root.dataset.splash !== "play") return;
      if (e instanceof KeyboardEvent && (e.ctrlKey || e.metaKey || e.altKey)) return; // leave shortcuts like reload alone
      // it was meant for the splash, so it shouldn't also press something on the page
      e.stopPropagation();
      e.preventDefault();
      toEnd();
    }

    const elapsed = () => Number(document.querySelector(".splash-ring")?.getAnimations()[0]?.currentTime ?? 0);

    function lock() {
      if (elapsed() + LOCK_MS + SPLASH.fade > SPLASH.cap) return toEnd();
      const sound = hasInteractedBefore();
      if (sound) {
        loadSoundMuted();
        wakeSound();
      }
      root.dataset.splashPhase = "lock";
      later(() => playLock(10, sound), SPLASH.form + SPLASH.snap * SNAP_IMPACT);
      later(reveal, LOCK_MS);
    }

    let cancelled = false;
    if (root.dataset.splash === "play") {
      window.addEventListener("pointerdown", onSkip, true);
      window.addEventListener("keydown", onSkip, true);
      if (root.dataset.splashPhase !== "end") {
        // the wordmark shouldn't arrive in a fallback font
        void document.fonts.ready.then(() => {
          if (!cancelled) later(lock, Math.max(CLOCK_MS - elapsed(), 0));
        });
      }
    }

    return () => {
      cancelled = true;
      clearTimers();
      window.removeEventListener("pointerdown", onSkip, true);
      window.removeEventListener("keydown", onSkip, true);
      window.removeEventListener("pointerdown", rememberInteraction);
      window.removeEventListener("keydown", rememberInteraction);
    };
  }, []);

  return (
    <div className="splash fixed inset-0 z-[100]" style={times} aria-hidden suppressHydrationWarning>
      <div className={`${logoStyle.lockup} splash-lockup`}>
        <span className="relative">
          <svg viewBox="0 0 28 28" className="splash-stage absolute inset-0 size-full overflow-visible">
            <g className="splash-face">
              <g className="splash-ticks">
                {TICKS.map((i) => (
                  <line key={i} x1="14" x2="14" y1="-9.5" y2={i % 3 === 0 ? "-11.5" : "-10.7"} transform={`rotate(${i * 30} 14 14)`} />
                ))}
              </g>
              <circle className="splash-fill" cx="14" cy="14" r="20" pathLength={1} transform="rotate(-90 14 14)" />
              <circle className="splash-ring" cx="14" cy="14" r="20" pathLength={1} transform="rotate(-90 14 14)" />
            </g>
            <g className="splash-hand-turn">
              <g className="splash-hand">
                <circle className="splash-trail" cx="14" cy="14" r="9.5" pathLength={1} transform="rotate(-126 14 14)" />
                <circle className="splash-trail splash-trail-long" cx="14" cy="14" r="9.5" pathLength={1} transform="rotate(-162 14 14)" />
                <line x1="14" x2="14" y1="14" y2="-3" />
                <circle cx="14" cy="14" r="1.3" />
              </g>
            </g>
            <path className="splash-arc" d="M-6 14A20 20 0 0 1 34 14" />
            <path className="splash-shackle splash-shackle-light" d={SHACKLE} />
            <circle className="splash-pulse" cx="14" cy="14" r="14" />
          </svg>

          <span className={`${logoStyle.tile} splash-tile relative overflow-hidden`}>
            <svg viewBox="0 0 24 24" className={`${logoStyle.glyph} splash-glyph`} fill="currentColor">
              <path d={LOCK_PATH} />
            </svg>
            <svg viewBox="0 0 28 28" className="splash-parts absolute inset-0 size-full">
              <path className="splash-shackle" d={SHACKLE} />
              <rect className="splash-keyhole" x="9.33" y="12.67" width="9.34" height="7.33" rx="0.67" />
            </svg>
            <span className="splash-flash absolute inset-0" />
          </span>
        </span>

        <span className="splash-word">
          <span className="min-w-0 overflow-hidden">
            <span className="splash-word-text block pl-2 lowercase">{brand.name}</span>
          </span>
        </span>
      </div>
    </div>
  );
}
