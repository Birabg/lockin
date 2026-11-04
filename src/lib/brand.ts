// Rebrand here. Colors live in src/app/globals.css (the --primary tokens).
export const brand = {
  name: "Lockin",
  /** The --background token, for places CSS can't reach: the app manifest and the first bytes of a page. */
  background: "#0a0f1a",
  tagline: "Focus with friends.",
  description: "Track focus sessions, build streaks and climb the leaderboard with friends.",
  // For guests, and signups where the browser sends no zone. Accounts use their own timeZone.
  timeZone: "Africa/Addis_Ababa",
  defaultDailyGoalMin: 60,
} as const;

/** The padlock in the logo, on a 24-unit grid. */
export const LOCK_PATH =
  "M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1Zm2 0h6V8a3 3 0 0 0-6 0v2Z";
