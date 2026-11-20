import "server-only";
import { GitHub, Google, decodeIdToken, generateCodeVerifier, generateState } from "arctic";
import { siteUrl } from "./site";
import { usernameFrom, type OAuthProfile, type Provider } from "./oauth-flow";

/**
 * Google and GitHub sign-in through arctic, which only builds the URLs and swaps the code for tokens.
 * Sessions stay Lockin's own (the lk_session cookie).
 *
 * Test mode (OAUTH_TEST_MODE=1, set by the Playwright config) skips the real providers: the "code" carries the
 * profile itself. It is refused on Vercel, so it can't be switched on in a deployment by mistake.
 */

export const testMode = () => process.env.OAUTH_TEST_MODE === "1" && !process.env.VERCEL;

const creds = (p: Provider) =>
  p === "google"
    ? { id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET }
    : { id: process.env.GITHUB_CLIENT_ID, secret: process.env.GITHUB_CLIENT_SECRET };

export function providerEnabled(p: Provider): boolean {
  const c = creds(p);
  return testMode() || (!!c.id && !!c.secret);
}

export const enabledProviders = (): Provider[] => (["google", "github"] as const).filter(providerEnabled);

export const callbackUrl = (p: Provider) => `${siteUrl()}/api/auth/${p}/callback`;

function client(p: Provider) {
  const { id, secret } = creds(p);
  if (!id || !secret) throw new Error(`${p} sign-in isn't configured`);
  return p === "google" ? new Google(id, secret, callbackUrl(p)) : new GitHub(id, secret, callbackUrl(p));
}

/**
 * Where to send the browser, plus what to remember in the state cookie.
 * In test mode the fake provider sends people back to the server the test is talking to (`origin`), since a
 * production build would otherwise point at the configured public address. Real providers always use siteUrl().
 */
export function authorizationUrl(p: Provider, test?: { profile: string; origin: string }): { url: URL; state: string; verifier: string } {
  const state = generateState();
  const verifier = generateCodeVerifier();
  if (testMode()) {
    if (!test) throw new Error("test mode needs a test profile");
    const url = new URL(`/api/auth/${p}/callback`, test.origin);
    url.searchParams.set("state", state);
    url.searchParams.set("code", test.profile);
    return { url, state, verifier };
  }
  const url =
    p === "google"
      ? (client(p) as Google).createAuthorizationURL(state, verifier, ["openid", "email", "profile"])
      : (client(p) as GitHub).createAuthorizationURL(state, ["read:user", "user:email"]);
  if (p === "google") url.searchParams.set("prompt", "select_account");
  return { url, state, verifier };
}

/** Swaps the code for the person's profile. Throws if the provider says no. */
export async function fetchProfile(p: Provider, code: string, verifier: string): Promise<OAuthProfile> {
  if (testMode()) return testProfile(p, code);
  if (p === "google") {
    const tokens = await (client(p) as Google).validateAuthorizationCode(code, verifier);
    // straight from Google's token endpoint over TLS, so the ID token needs no separate signature check
    const claims = decodeIdToken(tokens.idToken()) as { sub: string; email?: string; email_verified?: boolean; name?: string };
    const email = claims.email && claims.email_verified ? claims.email.toLowerCase() : null;
    return {
      provider: p,
      providerUserId: claims.sub,
      email,
      name: (claims.name ?? "").trim().slice(0, 40) || (email?.split("@")[0] ?? "Lockin friend"),
      usernameHint: usernameFrom(claims.name || email?.split("@")[0] || ""),
    };
  }

  const tokens = await (client(p) as GitHub).validateAuthorizationCode(code);
  const headers = { Authorization: `Bearer ${tokens.accessToken()}`, Accept: "application/vnd.github+json", "User-Agent": "lockin-app" };
  const [userRes, emailsRes] = await Promise.all([
    fetch("https://api.github.com/user", { headers, signal: AbortSignal.timeout(8000) }),
    fetch("https://api.github.com/user/emails", { headers, signal: AbortSignal.timeout(8000) }),
  ]);
  if (!userRes.ok) throw new Error(`GitHub user lookup failed: ${userRes.status}`);
  const user = (await userRes.json()) as { id: number; login: string; name: string | null };
  const emails = emailsRes.ok ? ((await emailsRes.json()) as { email: string; primary: boolean; verified: boolean }[]) : [];
  // only the primary address, and only if GitHub has verified it
  const primary = emails.find((e) => e.primary && e.verified);
  return {
    provider: p,
    providerUserId: String(user.id),
    email: primary ? primary.email.toLowerCase() : null,
    name: (user.name ?? user.login).trim().slice(0, 40),
    usernameHint: usernameFrom(user.login),
  };
}

function testProfile(p: Provider, code: string): OAuthProfile {
  const raw = JSON.parse(Buffer.from(code, "base64url").toString("utf8")) as { id: string; email?: string | null; name?: string };
  if (!raw.id) throw new Error("test profile needs an id");
  const email = raw.email ? raw.email.toLowerCase() : null;
  const name = raw.name ?? "Test Person";
  return { provider: p, providerUserId: raw.id, email, name, usernameHint: usernameFrom(name) };
}
