import Link from "next/link";
import { btnPrimary } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { consumeVerificationToken } from "@/lib/email-verify";

export const metadata = { title: "Verify email", robots: { index: false } };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  const result = typeof token === "string" ? await consumeVerificationToken(token) : "invalid";
  const user = await getCurrentUser();
  // clicking an old link after verifying shouldn't look like something went wrong
  const verified = result === "verified" || !!user?.emailVerifiedAt;

  return (
    <div className="panel space-y-4 p-5 text-center">
      {verified ? (
        <>
          <h1 className="text-xl font-extrabold">Email verified ✓</h1>
          <p className="text-sm text-muted">You&apos;re all set. Your streak stays public and you can post, comment and create quests.</p>
          <Link href={user ? "/dashboard" : "/login"} className={`${btnPrimary} h-12 w-full`}>
            {user ? "Back to Lockin" : "Sign in"}
          </Link>
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
