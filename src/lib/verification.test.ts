import { describe, expect, it } from "vitest";
import {
  GRACE_DAYS,
  graceEndFrom,
  isRestricted,
  leaderboardUserFilter,
  shouldStartGrace,
  verificationEnforced,
  verifyState,
} from "./verification";

const now = new Date("2026-11-20T12:00:00Z");
const day = 86_400_000;
const fresh = { emailVerifiedAt: null, legacyUnverified: false, verifyGraceEndsAt: null };
const legacy = { ...fresh, legacyUnverified: true };
const verified = { ...fresh, emailVerifiedAt: new Date("2026-11-01") };

describe("verificationEnforced", () => {
  it("is off unless the flag is exactly true", () => {
    expect(verificationEnforced({})).toBe(false);
    expect(verificationEnforced({ EMAIL_VERIFICATION_ENFORCED: "false" })).toBe(false);
    expect(verificationEnforced({ EMAIL_VERIFICATION_ENFORCED: "1" })).toBe(false);
    expect(verificationEnforced({ EMAIL_VERIFICATION_ENFORCED: "true" })).toBe(true);
    expect(verificationEnforced({ EMAIL_VERIFICATION_ENFORCED: " TRUE " })).toBe(true);
  });
});

describe("verifyState", () => {
  it("restricts nobody while enforcement is off", () => {
    expect(verifyState(fresh, now, false)).toEqual({ kind: "unverified" });
    expect(verifyState(legacy, now, false)).toEqual({ kind: "unverified" });
    expect(isRestricted(fresh, now, false)).toBe(false);
  });

  it("lets verified people do everything", () => {
    expect(verifyState(verified, now, true)).toEqual({ kind: "verified" });
    expect(verifyState(verified, now, false)).toEqual({ kind: "verified" });
  });

  it("restricts new unverified signups straight away, with no grace", () => {
    expect(verifyState(fresh, now, true)).toEqual({ kind: "restricted" });
  });

  it("gives legacy accounts grace, before and during the clock", () => {
    expect(verifyState(legacy, now, true)).toEqual({ kind: "grace", endsAt: null });
    const endsAt = new Date(now.getTime() + day);
    expect(verifyState({ ...legacy, verifyGraceEndsAt: endsAt }, now, true)).toEqual({ kind: "grace", endsAt });
  });

  it("restricts legacy accounts once grace is over", () => {
    expect(verifyState({ ...legacy, verifyGraceEndsAt: now }, now, true)).toEqual({ kind: "restricted" });
    expect(verifyState({ ...legacy, verifyGraceEndsAt: new Date(now.getTime() - 1) }, now, true).kind).toBe("restricted");
  });
});

describe("grace clock", () => {
  it("lasts 14 days", () => {
    expect(GRACE_DAYS).toBe(14);
    expect(graceEndFrom(now).getTime() - now.getTime()).toBe(14 * day);
  });

  it("starts only for unverified legacy accounts, once, while enforced", () => {
    expect(shouldStartGrace(legacy, true)).toBe(true);
    expect(shouldStartGrace(legacy, false)).toBe(false);
    expect(shouldStartGrace(fresh, true)).toBe(false);
    expect(shouldStartGrace({ ...legacy, emailVerifiedAt: now }, true)).toBe(false);
    expect(shouldStartGrace({ ...legacy, verifyGraceEndsAt: now }, true)).toBe(false);
  });
});

describe("leaderboardUserFilter", () => {
  it("filters nobody while enforcement is off", () => {
    expect(leaderboardUserFilter(now, false)).toBeUndefined();
  });

  it("keeps verified and in-grace accounts", () => {
    expect(leaderboardUserFilter(now, true)).toEqual({
      OR: [
        { emailVerifiedAt: { not: null } },
        { legacyUnverified: true, verifyGraceEndsAt: null },
        { legacyUnverified: true, verifyGraceEndsAt: { gt: now } },
      ],
    });
  });
});
