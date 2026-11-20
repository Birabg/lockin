/**
 * What to do when Google or GitHub sends someone back, kept free of the database so every case can be tested.
 * The callback route gathers the facts, this decides, and the route carries it out.
 */

export const PROVIDERS = ["google", "github"] as const;
export type Provider = (typeof PROVIDERS)[number];
export const isProvider = (p: unknown): p is Provider => PROVIDERS.includes(p as Provider);
export const providerName = (p: Provider) => (p === "google" ? "Google" : "GitHub");

export type OAuthProfile = {
  provider: Provider;
  /** The provider's stable id for the person. */
  providerUserId: string;
  /** Lowercased, and only if the provider says it's verified. */
  email: string | null;
  name: string;
  /** A starting point for the username picker (GitHub login, or the email's local part). */
  usernameHint: string;
};

export type OAuthIntent = "login" | "link";

export type OAuthFacts = {
  profile: OAuthProfile;
  intent: OAuthIntent;
  /** Who is signed in right now, if anyone. */
  current: { id: string; email: string; hasProvider: boolean } | null;
  /** The account this provider login is already connected to, if any. */
  linkedUserId: string | null;
  /** The account whose email matches the provider's verified email, if any. */
  emailOwner: { id: string; verified: boolean; hasProvider: boolean } | null;
};

export type OAuthDecision =
  | { kind: "signin"; userId: string }
  /** Connect the provider to `userId`; sign them in when it came from the login page. */
  | { kind: "link"; userId: string; markVerified: boolean; signin: boolean }
  /** Already connected to the signed-in account; nothing to do. */
  | { kind: "already-linked" }
  /** An unverified account has this email: they must prove it's theirs with their password first. */
  | { kind: "needs-password"; email: string }
  /** No account yet: pick a username, then create it. */
  | { kind: "signup" }
  | { kind: "error"; code: OAuthErrorCode };

export type OAuthErrorCode = "no-email" | "linked-elsewhere" | "has-other" | "not-signed-in" | "failed" | "cancelled" | "disabled";

export function decideOAuth(f: OAuthFacts): OAuthDecision {
  if (f.intent === "link") {
    if (!f.current) return { kind: "error", code: "not-signed-in" };
    if (f.linkedUserId) return f.linkedUserId === f.current.id ? { kind: "already-linked" } : { kind: "error", code: "linked-elsewhere" };
    if (f.current.hasProvider) return { kind: "error", code: "has-other" };
    // the provider vouches for its email, so a match also verifies the account's address
    return { kind: "link", userId: f.current.id, markVerified: !!f.profile.email && f.profile.email === f.current.email, signin: false };
  }

  if (f.linkedUserId) return { kind: "signin", userId: f.linkedUserId };
  if (!f.profile.email) return { kind: "error", code: "no-email" };
  if (f.emailOwner) {
    // An unverified account could have been made by someone who doesn't own the address,
    // so it only gets linked after its password proves who's who.
    if (!f.emailOwner.verified) return { kind: "needs-password", email: f.profile.email };
    // the account already has a different Google (or GitHub) login connected
    if (f.emailOwner.hasProvider) return { kind: "error", code: "has-other" };
    return { kind: "link", userId: f.emailOwner.id, markVerified: false, signin: true };
  }
  return { kind: "signup" };
}

export function oauthErrorMessage(code: string | undefined, provider?: Provider): string | null {
  const name = provider ? providerName(provider) : "That provider";
  switch (code) {
    case "no-email":
      return provider === "github"
        ? "Your GitHub account has no verified email. Verify one on GitHub, or sign up with email."
        : `${name} didn't share a verified email. Try another way to sign in.`;
    case "linked-elsewhere":
      return `That ${name} account is already connected to a different Lockin account.`;
    case "has-other":
      return `This Lockin account is already connected to a different ${name} account.`;
    case "not-signed-in":
      return "Sign in first, then connect it from Settings.";
    case "cancelled":
      return `${name} sign-in was cancelled.`;
    case "disabled":
      return `${name} sign-in isn't available right now.`;
    case "failed":
      return `${name} sign-in didn't work. Try again.`;
    default:
      return null;
  }
}

/** Turns a name or GitHub login into something that fits the username rules (3–20 of a-z, 0-9, _). */
export function usernameFrom(hint: string): string {
  const base = hint
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
  return base.length >= 3 ? base : (base + "_focus").slice(0, 20).replace(/^_+/, "");
}

/** How many ways an account has to sign in. Unlinking can't take this to zero. */
export function loginMethods(u: { hasPassword: boolean; providers: number }): number {
  return (u.hasPassword ? 1 : 0) + u.providers;
}
