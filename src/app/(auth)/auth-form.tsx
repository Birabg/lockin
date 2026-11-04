"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup } from "@/app/actions/auth";
import { btnPrimary, inputCls } from "@/components/ui";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next: string }) {
  const [state, action, pending] = useActionState(mode === "login" ? login : signup, undefined);
  const isSignup = mode === "signup";

  return (
    <form action={action} className="panel space-y-3 p-5">
      <h1 className="mb-2 text-xl font-extrabold">{isSignup ? "Create your account" : "Welcome back"}</h1>
      <input type="hidden" name="next" value={next} />
      {isSignup ? (
        <>
          <input name="name" placeholder="Name" autoComplete="name" required className={inputCls} />
          <input name="username" placeholder="Username" autoComplete="username" required className={inputCls} />
          <input name="email" type="email" placeholder="Email" autoComplete="email" required className={inputCls} />
          <input name="password" type="password" placeholder="Password (8+ characters)" autoComplete="new-password" required minLength={8} className={inputCls} />
        </>
      ) : (
        <>
          <input name="identifier" placeholder="Email or username" autoComplete="username" required className={inputCls} />
          <input name="password" type="password" placeholder="Password" autoComplete="current-password" required className={inputCls} />
        </>
      )}
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button disabled={pending} className={`${btnPrimary} h-12 w-full`}>
        {pending ? "One sec…" : isSignup ? "Join free" : "Sign in"}
      </button>
      <p className="pt-1 text-center text-sm text-muted">
        {isSignup ? "Already have an account? " : "New here? "}
        <Link href={isSignup ? `/login?next=${encodeURIComponent(next)}` : "/signup"} className="font-semibold text-primary">
          {isSignup ? "Sign in" : "Join free"}
        </Link>
      </p>
    </form>
  );
}
