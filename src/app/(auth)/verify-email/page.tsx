import Link from "next/link";
import { after } from "next/server";
import { btnPrimary } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { consumeVerificationToken, sendSecurityNotice, type VerifyResult } from "@/lib/email-verify";

export const metadata = { title: "Verify email", robots: { index: false } };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  const result: VerifyResult = typeof token === "string" ? await consumeVerificationToken(token) : { kind: "invalid" };
  if (result.kind === "changed") {
    // tell the old address, so a hijacked session can't quietly move the account
    after(() => sendSecurityNotice({ email: result.oldEmail, name: result.name }, "email-changed", result.newEmail));
  }
  const user = await getCurrentUser();
  // clicking an old link after verifying shouldn't look like something went wrong
  const verified = result.kind === "verified" || (result.kind === "invalid" && !!user?.emailVerifiedAt);
  const back = (
    <Link href={user ? "/dashboard" : "/login"} className={`${btnPrimary} h-12 w-full`}>
      {user ? "Back to Lockin" : "Sign in"}
    </Link>
  );

  return (
    <div className="panel space-y-4 p-5 text-center">
      {result.kind === "changed" ? (
        <>
          <h1 className="text-xl font-extrabold">Email updated ✓</h1>
          <p className="text-sm text-muted">
            Your account now uses <span className="font-bold text-foreground">{result.newEmail}</span>. Sign in with it from now on.
          </p>
          {back}
        </>
      ) : result.kind === "taken" ? (
        <>
          <h1 className="text-xl font-extrabold">That email is already in use</h1>
          <p className="text-sm text-muted">Another account signed up with that address first, so your email wasn&apos;t changed.</p>
          {back}
        </>
      ) : verified ? (
        <>
          <h1 className="text-xl font-extrabold">Email verified ✓</h1>
          <p className="text-sm text-muted">You&apos;re all set. Your streak stays public and you can post, comment and create quests.</p>
          {back}
        </>
      ) : (
        <>
          <h1 className="text-xl font-extrabold">That link doesn&apos;t work</h1>
          <p className="text-sm text-muted">
            It may have expired, been used already, or been replaced by a newer email. Links last 24 hours and work once.
          </p>
          <p className="text-sm text-muted">
            {user ? "Send yourself a new one from the banner on your dashboard." : "Sign in to send yourself a new one."}
          </p>
          <Link href={user ? "/dashboard" : "/login?next=/dashboard"} className={`${btnPrimary} h-12 w-full`}>
            {user ? "Back to Lockin" : "Sign in"}
          </Link>
        </>
      )}
    </div>
  );
}
