"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import { LockMark } from "@/components/ui";
import { imageScenes } from "@/lib/scenes";

/** The sharpest of the focus backgrounds, so the big panel never looks soft. */
const SLIDE_IDS = ["misty-trees", "snow-castle", "starry-trees", "windmill-farm", "golden-coast", "night-meadow", "misty-pines"];
const SLIDES = SLIDE_IDS.flatMap((id) => imageScenes.filter((s) => s.id === id));
const INTERVAL_MS = 4000;

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  { icon: "time", title: "Time your focus", body: "Study and work sessions, on any device." },
  { icon: "streak", title: "Keep a daily streak", body: "Any focus counts. Watch the hours add up." },
  { icon: "buddies", title: "Focus with friends", body: "Rooms, buddies and a weekly leaderboard." },
];

const COPY: Record<string, { title: string; body: string }> = {
  "/login": { title: "Welcome back.", body: "Your sessions, streak and friends are waiting." },
  "/signup": { title: "Start your streak.", body: "Pick a scene, press start, and lock in with friends." },
  "/welcome": { title: "Almost there.", body: "Pick a username and you're in." },
};
const FALLBACK = { title: "Back in a moment.", body: "Sort out your account, then get back to focusing." };

/** The left half of the sign-in pages: the focus scenes slide past every four seconds behind a short pitch. */
export function AuthShowcase() {
  const copy = COPY[usePathname()] ?? FALLBACK;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), INTERVAL_MS);
    return () => clearInterval(timer);
  }, [paused]);

  const prev = (index - 1 + SLIDES.length) % SLIDES.length;
  const current = SLIDES[index];

  return (
    <aside
      className="auth-showcase"
      aria-label="About Lockin"
      style={{ "--scene-accent": current.accent } as React.CSSProperties}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="auth-slides" aria-hidden>
        {SLIDES.map((s, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- plain images: they're already sized webp files
          <img
            key={s.id}
            src={s.image}
            alt=""
            decoding="async"
            fetchPriority={i === 0 ? "high" : "low"}
            className="auth-slide"
            data-state={i === index ? "active" : i === prev ? "prev" : "next"}
          />
        ))}
      </div>
      <div className="auth-showcase-shade" aria-hidden />

      <div className="auth-showcase-body">
        <span className="auth-showcase-mark" aria-hidden>
          <LockMark className="size-8" />
        </span>
        <h2 className="mt-5 text-[40px] leading-[1.05] font-extrabold tracking-tight text-white">{copy.title}</h2>
        <p className="mt-2 text-[15px] text-white/75">{copy.body}</p>

        <ul className="mt-8 space-y-5">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex items-start gap-3.5">
              <span className="auth-feature-icon" aria-hidden>
                <Icon name={f.icon} size={19} />
              </span>
              <span>
                <span className="block text-[15px] font-bold text-white">{f.title}</span>
                <span className="block text-[13.5px] text-white/65">{f.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="auth-showcase-foot">
        <span className="text-[12.5px] font-semibold text-white/70" aria-live="polite">
          {current.title}
        </span>
        <div className="flex items-center gap-1.5" role="group" aria-label="Background">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className="auth-dot"
              aria-label={`Show ${s.title}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
