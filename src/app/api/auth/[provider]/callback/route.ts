import { NextResponse, type NextRequest } from "next/server";
import { createSession, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchProfile } from "@/lib/oauth";
import { decideOAuth, isProvider, type OAuthErrorCode, type OAuthProfile } from "@/lib/oauth-flow";
import { linkAccount, savePending, takeState } from "@/lib/oauth-session";
import { allow, clientIp, limits } from "@/lib/rate-limit";

/** Where Google and GitHub send people back. Checks the state, reads the profile, then signs in, links or asks for more. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const q = req.nextUrl.searchParams;
  const saved = await takeState();
  const intent = saved?.intent ?? "login";
  const go = (path: string) => NextResponse.redirect(new URL(path, req.url));
  const fail = (code: OAuthErrorCode) =>
    go(`${intent === "link" ? "/dashboard/settings" : "/login"}?oauth_error=${code}&provider=${provider}`);

  if (!isProvider(provider)) return fail("disabled");
  if (q.get("error")) return fail("cancelled");
  // the state must match the one this browser was given, so nobody can finish someone else's login
  if (!saved || saved.provider !== provider || !q.get("state") || q.get("state") !== saved.state || !q.get("code")) return fail("failed");
  if (!(await allow(`oauth:${await clientIp()}`, limits.oauth))) return fail("failed");

  let profile: OAuthProfile;
  try {
    profile = await fetchProfile(provider, q.get("code")!, saved.verifier);
  } catch (e) {
    console.error(`${provider} sign-in failed`, e);
    return fail("failed");
  }

  const current = await getCurrentUser();
  const [linked, currentLink, owner] = await Promise.all([
    db.oAuthAccount.findUnique({
      where: { provider_providerUserId: { provider, providerUserId: profile.providerUserId } },
      select: { userId: true },
    }),
    current ? db.oAuthAccount.findUnique({ where: { userId_provider: { userId: current.id, provider } }, select: { id: true } }) : null,
    profile.email
      ? db.user.findUnique({
          where: { email: profile.email },
          select: { id: true, emailVerifiedAt: true, oauthAccounts: { where: { provider }, select: { id: true } } },
        })
      : null,
  ]);

  const decision = decideOAuth({
    profile,
    intent,
    current: current ? { id: current.id, email: current.email, hasProvider: !!currentLink } : null,
    linkedUserId: linked?.userId ?? null,
    emailOwner: owner ? { id: owner.id, verified: !!owner.emailVerifiedAt, hasProvider: owner.oauthAccounts.length > 0 } : null,
  });

  switch (decision.kind) {
    case "signin":
      await createSession(decision.userId);
      return go(saved.next);
    case "link": {
      if (!(await linkAccount(decision.userId, profile, decision.markVerified))) return fail("linked-elsewhere");
      if (!decision.signin) return go(`/dashboard/settings?connected=${provider}`);
      await createSession(decision.userId);
      return go(saved.next);
    }
    case "already-linked":
      return go(`/dashboard/settings?connected=${provider}`);
    case "needs-password":
      await savePending({ ...profile, email: decision.email }, "link", saved.next);
      return go(`/login?link=${provider}&next=${encodeURIComponent(saved.next)}`);
    case "signup":
      await savePending({ ...profile, email: profile.email! }, "signup", saved.next);
      return go("/welcome");
    case "error":
      return fail(decision.code);
  }
}
