"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { login, signup } from "@/app/actions/auth";
import { OAuthButtons, OrDivider } from "@/components/oauth-buttons";
import { btnPrimary, inputCls } from "@/components/ui";
import { suggestEmail } from "@/lib/email-check";
import type { Provider } from "@/lib/oauth-flow";

const labelCls = "mb-1.5 block text-[13px] font-bold";

function Field({ label, aside, children }: { label: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3">
        <span className={labelCls}>{label}</span>
        {aside}
      </span>
      {children}
    </label>
  );
}

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      {crossed && <path d="M4 4l16 16" />}
    </svg>
  );
}

/** A password box with an eye to check what you typed. */
function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [shown, setShown] = useState(false);
  return (
    <span className="relative block">
      <input {...props} type={shown ? "text" : "password"} className={`${inputCls} pr-12`} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        className="absolute inset-y-0 right-1.5 my-auto grid size-9 place-items-center rounded-lg text-subtle hover:bg-card hover:text-foreground"
      >
        <EyeIcon crossed={shown} />
      </button>
    </span>
  );
}

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
    <div className="space-y-5">
      <header className="text-center">
        <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">
          {isSignup ? "Create your account" : "Sign in to Lockin"}
        </h1>
        <p className="mt-1.5 text-[14.5px] text-muted">
          {isSignup ? "Free forever. Your first session is a tap away." : "Pick up your streak where you left off."}
        </p>
      </header>

      {providers.length > 0 && (
        <>
          <OAuthButtons providers={providers} next={next} />
          <OrDivider label="or use your email" />
        </>
      )}

      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        {isSignup && <input type="hidden" name="timeZone" value={timeZone} />}
        {isSignup ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <input name="name" aria-label="Name" placeholder="Your name" autoComplete="name" required className={inputCls} />
              </Field>
              <Field label="Username">
                <input
                  name="username"
                  aria-label="Username"
                  placeholder="yourname"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="Email">
              <input
                name="email"
                aria-label="Email"
                type="email"
                placeholder="name@example.com"
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
            </Field>
            {suggestion && (
              <p id="email-hint" className="-mt-2 text-sm text-muted">
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
            <Field label="Password">
              <PasswordInput
                name="password"
                aria-label="Password"
                placeholder="8 characters or more"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Email or username">
              <input
                name="identifier"
                placeholder="name@example.com"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                className={inputCls}
              />
            </Field>
            <Field
              label="Password"
              aside={
                canReset && (
                  <Link href="/forgot-password" className="text-[13px] font-semibold text-primary hover:underline">
                    Forgot password?
                  </Link>
                )
              }
            >
              <PasswordInput name="password" aria-label="Password" placeholder="Your password" autoComplete="current-password" required />
            </Field>
          </>
        )}
        {notice && !state?.error && <p className={`text-sm ${noticeTone === "error" ? "text-danger" : "text-primary-text"}`}>{notice}</p>}
        {state?.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        <button disabled={pending} className={`${btnPrimary} mt-1 h-12 w-full`}>
          {pending ? "One sec…" : isSignup ? "Join free" : "Sign in"}
        </button>
      </form>

      {isSignup && (
        <p className="text-center text-xs text-subtle">
          By joining you agree to our{" "}
          <Link href="/privacy" className="underline">
            privacy policy
          </Link>
          . Your profile and focus stats are public.
        </p>
      )}
    </div>
  );
}
