"use client";

import { Icon } from "./icon";
import { LONG_BREAK_EVERY, POMODORO_LIMITS, type Pomodoro } from "@/lib/session-math";
import { FOCUS_MODES, type FocusMode } from "@/lib/focus-mode";
import { formatDuration } from "@/lib/time";

/** The two ways to lock in, side by side at the top of the setup card. */
export function ModeSwitch({ mode, onMode, locked }: { mode: FocusMode; onMode: (m: FocusMode) => void; locked: boolean }) {
  return (
    <div role="radiogroup" aria-label="Focus mode" className="stage-mode">
      {FOCUS_MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={mode === m.id}
          title={m.hint}
          disabled={locked}
          onClick={() => onMode(m.id)}
          className="stage-mode-option"
        >
          <Icon name={m.id === "pomodoro" ? "pomodoro" : "startFocus"} size={15} solid />
          {m.label}
        </button>
      ))}
    </div>
  );
}

const SETTINGS: { key: keyof Pomodoro; label: string; unit: "min" | "rounds" }[] = [
  { key: "workMin", label: "Focus", unit: "min" },
  { key: "breakMin", label: "Break", unit: "min" },
  { key: "longBreakMin", label: "Long break", unit: "min" },
  { key: "rounds", label: "Rounds", unit: "rounds" },
];

/** Focus, break, long break and rounds, each a number with a minus and a plus. */
export function PomodoroSettings({
  value,
  onChange,
  locked,
}: {
  value: Pomodoro;
  onChange: (p: Pomodoro) => void;
  locked: boolean;
}) {
  function step(key: keyof Pomodoro, dir: 1 | -1) {
    const { min, max, step } = POMODORO_LIMITS[key];
    // snap to the step first, so 7 goes to 10 or 5 rather than 12 or 2
    const snapped = dir > 0 ? Math.floor(value[key] / step) * step + step : Math.ceil(value[key] / step) * step - step;
    onChange({ ...value, [key]: Math.min(Math.max(snapped, min), max) });
  }

  return (
    <div className="stage-pomo" data-locked={locked || undefined}>
      <div className="stage-pomo-grid">
        {SETTINGS.map(({ key, label, unit }) => {
          const n = value[key];
          const { min, max } = POMODORO_LIMITS[key];
          const shown = unit === "min" ? `${n}m` : String(n);
          const spoken = unit === "min" ? formatDuration(n * 60) : `${n} ${n === 1 ? "round" : "rounds"}`;
          return (
            <div key={key} role="group" aria-label={label} className="stage-pomo-cell">
              <span className="stage-pomo-label">{label}</span>
              <span className="stage-pomo-row">
                <button
                  type="button"
                  aria-label={`Less ${label.toLowerCase()}`}
                  disabled={locked || n <= min}
                  onClick={() => step(key, -1)}
                  className="stage-pomo-step"
                >
                  <Icon name="minus" size={14} />
                </button>
                <output aria-live="polite" aria-label={`${label}: ${spoken}`} className="stage-pomo-value tabular">
                  {shown}
                </output>
                <button
                  type="button"
                  aria-label={`More ${label.toLowerCase()}`}
                  disabled={locked || n >= max}
                  onClick={() => step(key, 1)}
                  className="stage-pomo-step"
                >
                  <Icon name="add" size={14} />
                </button>
              </span>
            </div>
          );
        })}
      </div>
      <p className="stage-pomo-note">
        {value.rounds} × {formatDuration(value.workMin * 60)} of focus
        {value.rounds > 1 ? `, ${formatDuration(value.breakMin * 60)} breaks` : ""}
        {value.rounds > LONG_BREAK_EVERY ? `, a long one after every ${LONG_BREAK_EVERY}` : ""}
      </p>
    </div>
  );
}
