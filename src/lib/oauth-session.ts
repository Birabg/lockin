import "server-only";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { seal, unseal } from "./auth";
import { db } from "./db";
import { isProvider, type OAuthProfile, type Provider } from "./oauth-flow";

/**
 * Between the provider sending someone back and them finishing on Lockin (picking a username, or proving an
 * unverified account is theirs with its password), the provider's answer waits in a signed, short-lived cookie.
 */

const STATE_COOKIE = "lk_oauth";
const PENDING_COOKIE = "lk_oauth_pending";
export const STATE_TTL_SEC = 10 * 60;
const PENDING_TTL_SEC = 15 * 60;

const cookieOpts = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});

export type OAuthState = { state: string; verifier: string; provider: Provider; next: string; intent: "login" | "link" };

export async function saveState(s: OAuthState) {
  (await cookies()).set(STATE_COOKIE, await seal(s, "oauth-state", STATE_TTL_SEC), cookieOpts(STATE_TTL_SEC));
}

/** Reads and deletes the state cookie, so a callback can only be used once. */
export async function takeState(): Promise<OAuthState | null> {
  const jar = await cookies();
  const raw = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);
  const p = await unseal(raw, "oauth-state");
  if (!p || !isProvider(p.provider) || typeof p.state !== "string" || typeof p.verifier !== "string") return null;
  return {
    state: p.state,
    verifier: p.verifier,
    provider: p.provider,
    next: String(p.next ?? "/dashboard"),
    intent: p.intent === "link" ? "link" : "login",
  };
}

export type Pending = {
  kind: "signup" | "link";
  provider: Provider;
  providerUserId: string;
  email: string;
  name: string;
  usernameHint: string;
  next: string;
};

export async function savePending(profile: OAuthProfile & { email: string }, kind: Pending["kind"], next: string) {
  const p: Pending = {
    kind,
    provider: profile.provider,
    providerUserId: profile.providerUserId,
    email: profile.email,
    name: profile.name,
    usernameHint: profile.usernameHint,
    next,
  };
  (await cookies()).set(PENDING_COOKIE, await seal(p, "oauth-pending", PENDING_TTL_SEC), cookieOpts(PENDING_TTL_SEC));
}

export async function readPending(kind: Pending["kind"]): Promise<Pending | null> {
  const p = await unseal((await cookies()).get(PENDING_COOKIE)?.value, "oauth-pending");
  if (!p || p.kind !== kind || !isProvider(p.provider) || typeof p.providerUserId !== "string" || typeof p.email !== "string") return null;
  return {
    kind,
    provider: p.provider,
    providerUserId: p.providerUserId,
    email: p.email,
    name: String(p.name ?? ""),
    usernameHint: String(p.usernameHint ?? ""),
    next: String(p.next ?? "/dashboard"),
  };
}

export async function clearPending() {
  (await cookies()).delete(PENDING_COOKIE);
}

/** Connects a provider login to an account. Returns false if either side is already taken. */
export async function linkAccount(
  userId: string,
  a: { provider: Provider; providerUserId: string; email: string | null },
  markVerified: boolean,
): Promise<boolean> {
  try {
    await db.$transaction([
      db.oAuthAccount.create({ data: { userId, provider: a.provider, providerUserId: a.providerUserId, email: a.email } }),
      ...(markVerified
        ? [db.user.updateMany({ where: { id: userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } })]
        : []),
    ]);
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
}

/**
 * After a password sign-in: if they came from "sign in with your password to connect Google", connect it now.
 * The provider verified the email, so the account's address counts as verified too.
 */
export async function finishPendingLink(user: { id: string; email: string }): Promise<Provider | null> {
  const pending = await readPending("link");
  if (!pending) return null;
  await clearPending();
  if (pending.email !== user.email) return null;
  return (await linkAccount(user.id, pending, true)) ? pending.provider : null;
}
