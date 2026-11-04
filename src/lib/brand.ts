// Rebrand here. Colors live in src/app/globals.css (the --primary tokens).
export const brand = {
  name: "Lockin",
  tagline: "Focus with friends.",
  description: "Track focus sessions, build streaks and climb the leaderboard with friends.",
  // For guests, and signups where the browser sends no zone. Accounts use their own timeZone.
  timeZone: "Africa/Addis_Ababa",
  defaultDailyGoalMin: 60,
} as const;
