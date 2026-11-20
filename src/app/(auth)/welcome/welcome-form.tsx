"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { checkUsername, completeOAuthSignup } from "@/app/actions/auth";
import { btnPrimary, inputCls } from "@/components/ui";

type Check = { ok: boolean; message: string; for: string } | null;

export function WelcomeForm({
  provider,
  email,
  name,
  usernameHint,
}: {
  provider: string;
  email: string;
  name: string;
  usernameHint: string;
}) {
  const [state, action, pending] = useActionState(completeOAuthSignup, undefined);
  const [username, setUsername] = useState(usernameHint);
  const [check, setCheck] = useState<Check>(null);
  const [timeZone, setTimeZone] = useState("");

  useEffect(() => setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone), []);

  // checks a moment after they stop typing; an answer for an older value is ignored
  useEffect(() => {
    const value = username.trim().toLowerCase();
    if (!value) return;
    let live = true;
    const t = setTimeout(async () => {
      const res = await checkUsername(value);
      if (live) setCheck({ ...res, for: value });
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [username]);

  const current = check && check.for === username.trim().toLowerCase() ? check : null;

  return (
    <form action={action} className="panel space-y-3 p-5">
      <h1 className="text-xl font-extrabold">Pick a username</h1>
      <p className="text-sm text-muted">
        Signed in with {provider} as <span className="font-semibold text-foreground">{email}</span>. One last step.
      </p>
      <input type="hidden" name="timeZone" value={timeZone} />
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-muted">Name</span>
        <input name="name" defaultValue={name} autoComplete="name" required maxLength={40} className={inputCls} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-muted">Username</span>
        <input
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={20}
          aria-describedby="username-status"
          className={inputCls}
        />
      </label>
      <p
        id="username-status"
        aria-live="polite"
        className={`min-h-5 text-sm ${current ? (current.ok ? "text-primary-text" : "text-danger") : "text-subtle"}`}
      >
        {current ? current.message : "3–20 letters, numbers or _"}
      </p>
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button disabled={pending || current?.ok === false} className={`${btnPrimary} h-12 w-full`}>
        {pending ? "One sec…" : "Create my account"}
      </button>
      <p className="text-center text-xs text-subtle">
        By joining you agree to our{" "}
        <Link href="/privacy" className="underline">
          privacy policy
        </Link>
        . Your profile and focus stats are public.
      </p>
    </form>
  );
}
