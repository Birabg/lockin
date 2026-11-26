/** The two ways to lock in. Timelapse is one stretch of focus; Pomodoro is focus rounds with breaks between. */
export type FocusMode = "timelapse" | "pomodoro";

export const FOCUS_MODES: { id: FocusMode; label: string; hint: string }[] = [
  { id: "timelapse", label: "Timelapse", hint: "One stretch of focus, as long as you pick" },
  { id: "pomodoro", label: "Pomodoro", hint: "Focus rounds with short breaks between" },
];

export const isFocusMode = (v: unknown): v is FocusMode => v === "timelapse" || v === "pomodoro";

/** Where the Lock in menu sends each mode. */
export const focusHref = (mode: FocusMode) => `/dashboard/timer?mode=${mode}`;
