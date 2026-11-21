/**
 * Email verification rules, kept free of the database so they can be tested.
 *
 * Nobody is restricted until EMAIL_VERIFICATION_ENFORCED=true. Once it is:
 * - verified people can do everything,
 * - accounts from before verification existed ("legacy") get GRACE_DAYS from the first time they're seen,
 * - everyone else can sign in and focus, but can't post, comment, create quests or appear on the leaderboard.
 */

export const VERIFY_LINK_TTL_MS = 24 * 60 * 60_000;
export const GRACE_DAYS = 14;

export type VerifyFields = {
  emailVerifiedAt: Date | null;
  legacyUnverified: boolean;
  verifyGraceEndsAt: Date | null;
};

export type VerifyState =
  /** Verified, or nothing is enforced and there's nothing to nag about. */
  | { kind: "verified" }
  /** Not verified, but nothing is enforced yet. */
  | { kind: "unverified" }
  /** Legacy account inside its grace period. `endsAt` is null until the grace clock starts. */
  | { kind: "grace"; endsAt: Date | null }
  /** Can't post, comment, create quests or rank. */
  | { kind: "restricted" };

export function verificationEnforced(env: Record<string, string | undefined> = process.env): boolean {
  return env.EMAIL_VERIFICATION_ENFORCED?.trim().toLowerCase() === "true";
}

export function graceEndFrom(now: Date): Date {
  return new Date(now.getTime() + GRACE_DAYS * 86_400_000);
}

/** Whether a legacy account's grace clock should start now. */
export function shouldStartGrace(user: VerifyFields, enforced: boolean): boolean {
  return enforced && !user.emailVerifiedAt && user.legacyUnverified && !user.verifyGraceEndsAt;
}

export function verifyState(user: VerifyFields, now: Date, enforced: boolean): VerifyState {
  if (user.emailVerifiedAt) return { kind: "verified" };
  if (!enforced) return { kind: "unverified" };
  if (user.legacyUnverified && (!user.verifyGraceEndsAt || user.verifyGraceEndsAt > now)) {
    return { kind: "grace", endsAt: user.verifyGraceEndsAt };
  }
  return { kind: "restricted" };
}

export const isRestricted = (user: VerifyFields, now: Date, enforced: boolean) => verifyState(user, now, enforced).kind === "restricted";

export const VERIFY_FIRST = "Verify your email to do that. Check your inbox, or resend the link from the banner.";

/**
 * A Prisma `User` filter for people allowed on the leaderboard. Suspended accounts never are. Once verification is
 * enforced it mirrors verifyState too: verified, or legacy and still inside (or not yet started) grace.
 */
export function leaderboardUserFilter(now: Date, enforced: boolean) {
  if (!enforced) return { bannedAt: null };
  return {
    bannedAt: null,
    OR: [
      { emailVerifiedAt: { not: null } },
      { legacyUnverified: true, verifyGraceEndsAt: null },
      { legacyUnverified: true, verifyGraceEndsAt: { gt: now } },
    ],
  };
}
