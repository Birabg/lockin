// Writes src/components/icon-data.ts with only the Solar icons Lockin uses.
// To add or swap an icon, edit ICONS below and run `npm run icons`.
// Solar is by 480 Design, licensed CC BY 4.0: https://creativecommons.org/licenses/by/4.0/
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const solar = JSON.parse(readFileSync(require.resolve("@iconify-json/solar/icons.json"), "utf8"));

// line: the usual look. active: the selected look, used in navigation and tabs. solid: a filled look that keeps its colour.
const ICONS = {
  home: { line: "home-smile-linear", active: "home-smile-bold-duotone" },
  focus: { line: "stopwatch-linear", active: "stopwatch-bold-duotone" },
  focusingNow: { line: "soundwave-linear", active: "soundwave-bold-duotone" },
  stats: { line: "chart-square-linear", active: "chart-square-bold-duotone" },
  leaderboard: { line: "cup-star-linear", active: "cup-star-bold-duotone" },
  people: { line: "users-group-rounded-linear", active: "users-group-rounded-bold-duotone" },
  buddies: { line: "hand-heart-linear", active: "hand-heart-bold-duotone" },
  liveRooms: { line: "exit-linear", active: "exit-bold-duotone" },
  notifications: { line: "bell-bing-linear", active: "bell-bing-bold-duotone" },
  profile: { line: "user-linear", active: "user-bold-duotone" },
  global: { line: "global-linear", active: "global-bold-duotone" },
  following: { line: "user-heart-linear", active: "user-heart-bold-duotone" },
  timelapses: { line: "clapperboard-play-linear", active: "clapperboard-play-bold-duotone" },
  streak: { line: "fire-linear", solid: "fire-bold" },
  like: { line: "heart-linear", solid: "heart-bold" },
  crown: { line: "crown-linear", solid: "crown-bold" },
  startFocus: { line: "play-bold" },
  pause: { line: "pause-bold" },
  stop: { line: "stop-bold" },
  send: { line: "plain-bold" },
  medal: { line: "medal-ribbon-bold" },
  lock: { line: "lock-keyhole-minimalistic-bold" },
  unlock: { line: "lock-keyhole-minimalistic-unlocked-linear" },
  refresh: { line: "refresh-linear" },
  search: { line: "magnifer-linear" },
  comment: { line: "chat-round-linear" },
  views: { line: "chart-2-linear" },
  share: { line: "share-linear" },
  delete: { line: "trash-bin-minimalistic-linear" },
  settings: { line: "settings-linear" },
  logout: { line: "logout-2-linear" },
  chevron: { line: "alt-arrow-right-linear" },
  collapse: { line: "alt-arrow-left-linear" },
  compose: { line: "pen-new-square-linear" },
  image: { line: "gallery-linear" },
  sound: { line: "volume-loud-linear" },
  mute: { line: "volume-cross-linear" },
  fullscreen: { line: "full-screen-linear" },
  exitFullscreen: { line: "quit-full-screen-linear" },
  minimize: { line: "minimize-linear" },
  check: { line: "check-linear" },
  close: { line: "close-linear" },
  add: { line: "add-linear" },
  more: { line: "menu-dots-bold" },
  time: { line: "clock-circle-linear" },
  clockStyle: { line: "clock-square-linear" },
  target: { line: "target-linear" },
};

function body(id) {
  const icon = solar.icons[solar.aliases?.[id]?.parent ?? id];
  if (!icon) throw new Error(`Solar has no icon called ${id}`);
  return icon.body;
}

const entries = Object.entries(ICONS).map(([name, looks]) => {
  const fields = Object.entries(looks).map(([look, id]) => `${look}: ${JSON.stringify(body(id))}`);
  return `  ${name}: { ${fields.join(", ")} },`;
});

writeFileSync(
  new URL("../src/components/icon-data.ts", import.meta.url),
  `// Made by scripts/build-icons.mjs, so edit that and run \`npm run icons\`.
// Solar icons by 480 Design, CC BY 4.0.
type Looks = { line: string; active?: string; solid?: string };

export const ICONS = {
${entries.join("\n")}
} satisfies Record<string, Looks>;
`,
);
