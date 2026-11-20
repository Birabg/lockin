import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canSendEmail } from "@/lib/email";
import { enabledProviders } from "@/lib/oauth";
import { isProvider, oauthErrorMessage, providerName } from "@/lib/oauth-flow";
import { safeNext } from "@/lib/safe-next";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Sign in" };

type Params = { next?: string | string[]; reset?: string; link?: string; oauth_error?: string; provider?: string };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await getCurrentUser()) redirect(next);
  const provider = isProvider(params.provider) ? params.provider : isProvider(params.link) ? params.link : undefined;
  const notice = params.reset
    ? "Password updated. Sign in with your new one."
    : provider && params.link
      ? `An account with your ${providerName(provider)} email already exists. Sign in with its password once to connect ${providerName(provider)}.`
      : (oauthErrorMessage(params.oauth_error, provider) ?? undefined);
  return (
    <AuthForm
      mode="login"
      next={next}
      canReset={canSendEmail()}
      notice={notice}
      noticeTone={params.oauth_error && !params.reset ? "error" : "info"}
      providers={enabledProviders()}
    />
  );
}
