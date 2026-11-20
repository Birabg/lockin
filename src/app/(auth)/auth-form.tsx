"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { login, signup } from "@/app/actions/auth";
import { OAuthButtons, OrDivider } from "@/components/oauth-buttons";
import { btnPrimary, inputCls } from "@/components/ui";
import { suggestEmail } from "@/lib/email-check";
import type { Provider } from "@/lib/oauth-flow";

export function AuthForm({
  mode,
  next,
  canReset,
  notice,
  noticeTone = "info",
  providers = [],
}: {
  mode: "login" | "signup";
  next: string;
  canReset?: boolean;
  notice?: string;
  noticeTone?: "info" | "error";
  providers?: Provider[];
}) {
  const [state, action, pending] = useActionState(mode === "login" ? login : signup, undefined);
  const isSignup = mode === "signup";
  const [timeZone, setTimeZone] = useState("");
  const [email, setEmail] = useState("");
  // the hint is worked out when they leave the field, so it doesn't flicker while typing
  const [hint, setHint] = useState<string | null>(null);
  // the server can suggest too, when a typo'd domain also has no mail server
  const suggestion = hint ?? (state?.suggestion && state.suggestion !== email ? state.suggestion : null);

  useEffect(() => setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone), []);

  return (
    <div className="panel space-y-3 p-5">
      <h1 className="mb-2 text-xl font-extrabold">{isSignup ? "Create your account" : "Welcome back"}</h1>
      {providers.length > 0 && (
        <>
          <OAuthButtons providers={providers} next={next} />
          <OrDivider />
        </>
      )}
      <form action={action} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        {isSignup && <input type="hidden" name="timeZone" value={timeZone} />}
        {isSignup ? (
          <>
            <input name="name" aria-label="Name" placeholder="Name" autoComplete="name" required className={inputCls} />
            <input name="username" aria-label="Username" placeholder="Username" autoComplete="username" required className={inputCls} />
            <input
              name="email"
              aria-label="Email"
              type="email"
              placeholder="Email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setHint(null);
              }}
              onBlur={() => setHint(suggestEmail(email))}
              aria-describedby={suggestion ? "email-hint" : undefined}
              className={inputCls}
            />
            {suggestion && (
              <p id="email-hint" className="-mt-1 text-sm text-muted">
                Did you mean{" "}
                <button
                  type="button"
                  className="font-semibold text-primary underline"
                  onClick={() => {
                    setEmail(suggestion);
                    setHint(null);
                  }}
                >
                  {suggestion}
                </button>
                ?
              </p>
            )}
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
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-muted">Email or username</span>
              <input name="identifier" placeholder="you@example.com or yourname" autoComplete="username" required className={inputCls} />
            </label>
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
        {notice && !state?.error && <p className={`text-sm ${noticeTone === "error" ? "text-danger" : "text-primary-text"}`}>{notice}</p>}
        {state?.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        <button disabled={pending} className={`${btnPrimary} h-12 w-full`}>
          {pending ? "One sec…" : isSignup ? "Join free" : "Sign in"}
        </button>
      </form>
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
    </div>
  );
}
