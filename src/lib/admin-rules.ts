/**
 * Admin rules that don't need the database, so they can be tested.
 */
import { REPORT_REASONS, type ReportTarget } from "./safety";

export const CONTENT_TYPES = ["post", "comment", "quest", "take"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];
export const isContentType = (t: unknown): t is ContentType => CONTENT_TYPES.includes(t as ContentType);

/** What an admin can do with a report. Content can be hidden or deleted; a person can be banned. */
export type ReportDecision = "dismiss" | "hide" | "delete" | "ban";

export function decisionsFor(type: ReportTarget): ReportDecision[] {
  return type === "user" ? ["dismiss", "ban"] : ["dismiss", "hide", "delete"];
}

export function isDecisionFor(type: ReportTarget, decision: unknown): decision is ReportDecision {
  return decisionsFor(type).includes(decision as ReportDecision);
}

export type AdminActionKind = "dismiss" | "hide" | "delete" | "restore" | "ban" | "unban" | "question";

/** "spam ×2, harassment" in the order the picker lists them, with old reason-less reports as "no reason". */
export function tallyReasons(reasons: readonly (string | null)[]): string {
  const counts = new Map<string, number>();
  for (const r of reasons) counts.set(r ?? "none", (counts.get(r ?? "none") ?? 0) + 1);
  const order = [...REPORT_REASONS.map((r) => r.value as string), "none"];
  return [...counts]
    .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    .map(([r, n]) => `${r === "none" ? "no reason" : r}${n > 1 ? ` ×${n}` : ""}`)
    .join(", ");
}

/** A one-line preview for lists and the log: whitespace squashed, cut at a word where possible. */
export function snippet(text: string, max = 80): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${space > max * 0.6 ? cut.slice(0, space) : cut}…`;
}

/** Admins can't ban themselves or each other: that would be a way to lock everyone out. */
export function banProblem(
  target: { id: string; username: string },
  admin: { id: string },
  isAdmin: (u: string) => boolean,
): string | null {
  if (target.id === admin.id) return "You can't ban yourself.";
  if (isAdmin(target.username)) return "Admins can't be banned here. Remove them from ADMIN_USERNAMES first.";
  return null;
}
