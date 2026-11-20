import { describe, expect, it } from "vitest";
import { decideOAuth, loginMethods, oauthErrorMessage, usernameFrom, type OAuthFacts } from "./oauth-flow";

const profile = { provider: "google" as const, providerUserId: "g-1", email: "abel@gmail.com", name: "Abel", usernameHint: "abel" };
const facts = (over: Partial<OAuthFacts> = {}): OAuthFacts => ({
  profile,
  intent: "login",
  current: null,
  linkedUserId: null,
  emailOwner: null,
  ...over,
});

describe("decideOAuth: signing in", () => {
  it("signs in the account this login is already connected to", () => {
    expect(decideOAuth(facts({ linkedUserId: "u1" }))).toEqual({ kind: "signin", userId: "u1" });
  });

  it("starts a signup when no account matches", () => {
    expect(decideOAuth(facts())).toEqual({ kind: "signup" });
  });

  it("needs a verified email from the provider", () => {
    expect(decideOAuth(facts({ profile: { ...profile, email: null } }))).toEqual({ kind: "error", code: "no-email" });
  });

  it("links to a verified account with the same email, and signs in", () => {
    expect(decideOAuth(facts({ emailOwner: { id: "u2", verified: true, hasProvider: false } }))).toEqual({
      kind: "link",
      userId: "u2",
      markVerified: false,
      signin: true,
    });
  });

  it("asks for the password before linking to an unverified account", () => {
    expect(decideOAuth(facts({ emailOwner: { id: "u2", verified: false, hasProvider: false } }))).toEqual({
      kind: "needs-password",
      email: "abel@gmail.com",
    });
  });

  it("won't link a second Google login to an account that has one", () => {
    expect(decideOAuth(facts({ emailOwner: { id: "u2", verified: true, hasProvider: true } }))).toEqual({
      kind: "error",
      code: "has-other",
    });
  });
});

describe("decideOAuth: connecting from settings", () => {
  const current = { id: "me", email: "abel@gmail.com", hasProvider: false };

  it("needs someone signed in", () => {
    expect(decideOAuth(facts({ intent: "link" }))).toEqual({ kind: "error", code: "not-signed-in" });
  });

  it("links, and verifies the email when it matches", () => {
    expect(decideOAuth(facts({ intent: "link", current }))).toEqual({ kind: "link", userId: "me", markVerified: true, signin: false });
    expect(decideOAuth(facts({ intent: "link", current: { ...current, email: "other@x.com" } }))).toEqual({
      kind: "link",
      userId: "me",
      markVerified: false,
      signin: false,
    });
  });

  it("links even when the provider has no verified email, but doesn't verify anything", () => {
    expect(decideOAuth(facts({ intent: "link", current, profile: { ...profile, email: null } }))).toMatchObject({
      kind: "link",
      markVerified: false,
    });
  });

  it("reports when it's already connected here or elsewhere", () => {
    expect(decideOAuth(facts({ intent: "link", current, linkedUserId: "me" }))).toEqual({ kind: "already-linked" });
    expect(decideOAuth(facts({ intent: "link", current, linkedUserId: "someone" }))).toEqual({ kind: "error", code: "linked-elsewhere" });
  });

  it("won't replace a different login from the same provider", () => {
    expect(decideOAuth(facts({ intent: "link", current: { ...current, hasProvider: true } }))).toEqual({
      kind: "error",
      code: "has-other",
    });
  });
});

describe("usernameFrom", () => {
  it("makes a valid username from names and logins", () => {
    expect(usernameFrom("Abel Tesfaye")).toBe("abel_tesfaye");
    expect(usernameFrom("octo-cat")).toBe("octo_cat");
    expect(usernameFrom("Zoë")).toBe("zoe");
    expect(usernameFrom("a".repeat(30))).toHaveLength(20);
  });
  it("pads names that are too short", () => {
    expect(usernameFrom("Al")).toMatch(/^[a-z0-9_]{3,20}$/);
    expect(usernameFrom("")).toMatch(/^[a-z0-9_]{3,20}$/);
    expect(usernameFrom("李")).toMatch(/^[a-z0-9_]{3,20}$/);
  });
});

describe("loginMethods", () => {
  it("counts a password and each connected provider", () => {
    expect(loginMethods({ hasPassword: true, providers: 0 })).toBe(1);
    expect(loginMethods({ hasPassword: false, providers: 1 })).toBe(1);
    expect(loginMethods({ hasPassword: true, providers: 2 })).toBe(3);
  });
});

describe("oauthErrorMessage", () => {
  it("explains a GitHub account with no verified email", () => {
    expect(oauthErrorMessage("no-email", "github")).toMatch(/verified email/);
  });
  it("is null for unknown codes", () => {
    expect(oauthErrorMessage(undefined)).toBeNull();
    expect(oauthErrorMessage("whatever")).toBeNull();
  });
});
