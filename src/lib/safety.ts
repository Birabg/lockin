/**
 * Blocking, muting and reporting rules, kept free of the database so they can be tested.
 */

export const REPORT_TARGETS = ["post", "comment", "quest", "take", "user"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];
export const isReportTarget = (t: unknown): t is ReportTarget => REPORT_TARGETS.includes(t as ReportTarget);

export const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "other", label: "Something else" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["value"];
export const isReportReason = (r: unknown): r is ReportReason => REPORT_REASONS.some((x) => x.value === r);

/** Reports from this many different people hide a piece of content until an admin looks. */
export const HIDE_AFTER_REPORTS = 3;

/**
 * Whether this many reports hide the target for everyone. People are never hidden automatically:
 * three throwaway accounts could otherwise make anyone disappear. Their reports wait for an admin.
 */
export function shouldHide(target: ReportTarget, distinctReporters: number): boolean {
  return target !== "user" && distinctReporters >= HIDE_AFTER_REPORTS;
}

/** What a viewer shouldn't see from others: anyone in a block with them (either way), plus, in feeds, anyone they muted. */
export function hiddenAuthors(p: { blocked: readonly string[]; muted: readonly string[] }, place: "feed" | "elsewhere"): string[] {
  return [...new Set(place === "feed" ? [...p.blocked, ...p.muted] : p.blocked)];
}

/** Everyone a block hides from `viewerId`: people they blocked and people who blocked them. */
export function blockedEither(viewerId: string, rows: readonly { blockerId: string; blockedId: string }[]): string[] {
  const ids = new Set<string>();
  for (const r of rows) {
    if (r.blockerId === viewerId) ids.add(r.blockedId);
    else if (r.blockedId === viewerId) ids.add(r.blockerId);
  }
  return [...ids];
}

export const BLOCKED_MESSAGE = "You can't interact with this account.";
