import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Join free" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect("/dashboard");
  return <AuthForm mode="signup" next={next} />;
}
