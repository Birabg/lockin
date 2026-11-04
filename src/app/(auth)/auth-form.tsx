"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { login, signup } from "@/app/actions/auth";
import { btnPrimary, inputCls } from "@/components/ui";

export function AuthForm({
  mode,
  next,
  canReset,
  notice,
}: {
  mode: "login" | "signup";
  next: string;
  canReset?: boolean;
  notice?: string;
}) {
  const [state, action, pending] = useActionState(mode === "login" ? login : signup, undefined);
  const isSignup = mode === "signup";
  const [timeZone, setTimeZone] = useState("");

  useEffect(() => setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone), []);

  return (
    <form action={action} className="panel space-y-3 p-5">
      <h1 className="mb-2 text-xl font-extrabold">{isSignup ? "Create your account" : "Welcome back"}</h1>
      <input type="hidden" name="next" value={next} />
      {isSignup && <input type="hidden" name="timeZone" value={timeZone} />}
      {isSignup ? (
        <>
          <input name="name" aria-label="Name" placeholder="Name" autoComplete="name" required className={inputCls} />
          <input name="username" aria-label="Username" placeholder="Username" autoComplete="username" required className={inputCls} />
          <input name="email" aria-label="Email" type="email" placeholder="Email" autoComplete="email" required className={inputCls} />
          <input
            name="password"
            aria-label="Password"
            type="password"
            placeholder="Password (8+ characters)"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            className={inputCls}
          />
        </>
      ) : (
        <>
          <input
            name="identifier"
            aria-label="Email or username"
            placeholder="Email or username"
            autoComplete="username"
            required
            className={inputCls}
          />
          <input
            name="password"
            aria-label="Password"
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            required
            className={inputCls}
          />
        </>
      )}
      {notice && !state?.error && <p className="text-sm text-primary-text">{notice}</p>}
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button disabled={pending} className={`${btnPrimary} h-12 w-full`}>
        {pending ? "One sec…" : isSignup ? "Join free" : "Sign in"}
      </button>
      {canReset && (
        <p className="text-center text-sm">
          <Link href="/forgot-password" className="font-semibold text-primary">
            Forgot your password?
          </Link>
        </p>
      )}
      {isSignup && (
        <p className="text-center text-xs text-subtle">
          By joining you agree to our{" "}
          <Link href="/privacy" className="underline">
            privacy policy
          </Link>
          . Your profile and focus stats are public.
        </p>
      )}
      <p className="pt-1 text-center text-sm text-muted">
        {isSignup ? "Already have an account? " : "New here? "}
        <Link href={`/${isSignup ? "login" : "signup"}?next=${encodeURIComponent(next)}`} className="font-semibold text-primary">
          {isSignup ? "Sign in" : "Join free"}
        </Link>
      </p>
    </form>
  );
}
