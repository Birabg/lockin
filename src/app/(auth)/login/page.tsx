import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canSendEmail } from "@/lib/email";
import { safeNext } from "@/lib/safe-next";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[]; reset?: string }> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await getCurrentUser()) redirect(next);
  return (
    <AuthForm
      mode="login"
      next={next}
      canReset={canSendEmail()}
      notice={params.reset ? "Password updated. Sign in with your new one." : undefined}
    />
  );
}
