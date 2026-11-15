/**
 * Quest rules, kept pure so they can be tested and shared by the server and the board.
 * Progress is stored in seconds and sessions; targets are in minutes and sessions.
 */

export const QUEST_COLORS = {
  butter: { paper: "#fde68a", pin: "#d97706", name: "Butter" },
  peach: { paper: "#fecaca", pin: "#dc2626", name: "Peach" },
  mint: { paper: "#bbf7d0", pin: "#16a34a", name: "Mint" },
  sky: { paper: "#bae6fd", pin: "#0284c7", name: "Sky" },
  lilac: { paper: "#ddd6fe", pin: "#7c3aed", name: "Lilac" },
} as const;

export type QuestColor = keyof typeof QUEST_COLORS;
export const isQuestColor = (v: string): v is QuestColor => v in QUEST_COLORS;
export const questColor = (v: string) => QUEST_COLORS[isQuestColor(v) ? v : "butter"];

export const QUEST_TITLE_MAX = 60;
export const QUEST_DESCRIPTION_MAX = 200;

export type QuestRules = {
  type: string;
  targetMinutes: number | null;
  targetSessions: number | null;
  minSessionMin: number | null;
  tag: string | null;
  startsAt: Date;
  endsAt: Date;
};

export type FinishedSession = { endedAt: Date; durationSec: number; label: string | null };

/**
 * Whether a finished session counts towards a quest someone joined: it ended inside the quest's
 * window and after they joined, is long enough, and has the quest's tag when there is one.
 */
export function sessionCounts(q: QuestRules, joinedAt: Date, s: FinishedSession): boolean {
  const end = s.endedAt.getTime();
  if (end < q.startsAt.getTime() || end > q.endsAt.getTime() || end < joinedAt.getTime()) return false;
  if (s.durationSec <= 0) return false;
  if (q.minSessionMin && s.durationSec < q.minSessionMin * 60) return false;
  if (q.tag && (s.label ?? "").trim().toLowerCase() !== q.tag.trim().toLowerCase()) return false;
  return true;
}

/** How far along, 0 to 1. With both a time and a session target, the one further behind decides. */
export function questShare(q: Pick<QuestRules, "targetMinutes" | "targetSessions">, sec: number, sessions: number): number {
  const parts: number[] = [];
  if (q.targetMinutes) parts.push(sec / (q.targetMinutes * 60));
  if (q.targetSessions) parts.push(sessions / q.targetSessions);
  if (parts.length === 0) return 0;
  return Math.min(1, Math.max(0, Math.min(...parts)));
}

export const questMet = (q: Pick<QuestRules, "targetMinutes" | "targetSessions">, sec: number, sessions: number) =>
  questShare(q, sec, sessions) >= 1;

/** A slight tilt for a sticky note, the same for a quest every time: between -2° and 2°. */
export function noteTilt(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.round(((Math.abs(h) % 401) / 100 - 2) * 10) / 10;
}

/** "3 × 50m", "300m", "5 sessions", for buttons and labels. */
export function questGoalText(q: Pick<QuestRules, "targetMinutes" | "targetSessions" | "minSessionMin">): string {
  const mins = (m: number) => (m >= 60 && m % 60 === 0 ? `${m / 60}h` : `${m}m`);
  if (q.targetSessions && q.minSessionMin) return `${q.targetSessions} × ${mins(q.minSessionMin)}`;
  const bits: string[] = [];
  if (q.targetMinutes) bits.push(mins(q.targetMinutes));
  if (q.targetSessions) bits.push(`${q.targetSessions} session${q.targetSessions === 1 ? "" : "s"}`);
  return bits.join(" + ");
}

/** "ends in 2d", "ends in 5h", "ends in 20m", "ended". */
export function endsIn(endsAt: Date, now = new Date()): string {
  const ms = endsAt.getTime() - now.getTime();
  if (ms <= 0) return "ended";
  const m = Math.ceil(ms / 60000);
  if (m < 60) return `ends in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `ends in ${h}h`;
  return `ends in ${Math.floor(h / 24)}d`;
}

/** The end-date choices in the post form. */
export const QUEST_LENGTHS = {
  today: "Today",
  "3d": "3 days",
  "1w": "1 week",
  custom: "Custom",
} as const;
export type QuestLength = keyof typeof QUEST_LENGTHS;

/** When a quest posted now ends. "Today" runs to midnight in the poster's zone, give or take, so we use the end of the next 24h at most. */
export function questEnd(length: QuestLength, now: Date, custom?: Date): Date {
  const HOUR = 3_600_000;
  if (length === "custom" && custom) return custom;
  // "today" comes with the poster's own midnight; anything more than a day away is ignored
  if (length === "today" && custom && custom.getTime() - now.getTime() <= 24 * HOUR) {
    return custom.getTime() - now.getTime() < HOUR ? new Date(now.getTime() + HOUR) : custom;
  }
  if (length === "3d") return new Date(now.getTime() + 72 * HOUR);
  if (length === "1w") return new Date(now.getTime() + 168 * HOUR);
  const end = new Date(now);
  end.setHours(23, 59, 59, 0);
  return end.getTime() - now.getTime() < HOUR ? new Date(now.getTime() + HOUR) : end;
}
