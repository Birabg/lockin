// Rebrand here. Colors live in src/app/globals.css (the --primary tokens).
export const brand = {
  name: "Lockin",
  tagline: "Focus with friends.",
  description: "Track focus sessions, build streaks and climb the leaderboard with friends.",
  // Day boundaries (streaks, "today", leaderboards) are computed in this zone.
  timeZone: "Africa/Addis_Ababa",
  defaultDailyGoalMin: 60,
} as const;
