import { NextResponse, type NextRequest } from "next/server";
import { authorizationUrl, providerEnabled, testMode } from "@/lib/oauth";
import { isProvider } from "@/lib/oauth-flow";
import { saveState } from "@/lib/oauth-session";
import { allow, clientIp, limits } from "@/lib/rate-limit";
import { safeNext } from "@/lib/safe-next";

/** "Continue with Google/GitHub": remembers where to go back to, then hands off to the provider. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const q = req.nextUrl.searchParams;
  const intent = q.get("intent") === "link" ? "link" : "login";
  const back = (code: string) =>
    NextResponse.redirect(
      new URL(`${intent === "link" ? "/dashboard/settings" : "/login"}?oauth_error=${code}&provider=${provider}`, req.url),
    );

  if (!isProvider(provider) || !providerEnabled(provider)) return back("disabled");
  if (!(await allow(`oauth:${await clientIp()}`, limits.oauth))) return back("failed");

  const next = safeNext(q.get("next"));
  const test = testMode() ? { profile: q.get("test_profile") ?? "", origin: req.nextUrl.origin } : undefined;
  const { url, state, verifier } = authorizationUrl(provider, test);
  await saveState({ state, verifier, provider, next, intent });
  return NextResponse.redirect(url);
}
