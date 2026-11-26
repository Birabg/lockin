"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { changePassword, requestEmailChange, signOutOtherDevices } from "@/app/actions/account";
import { toast } from "@/components/toaster";
import { btnGhost, btnPrimary, inputCls } from "@/components/ui";

function Disclosure({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <details className="set-danger set-plain" data-security={title}>
      <summary>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold">{title}</span>
          <span className="block text-[12.5px] font-normal text-muted">{body}</span>
        </span>
        <span className="set-danger-chev" aria-hidden>
          ›
        </span>
      </summary>
      {children}
    </details>
  );
}

/** Change the password, or add one to a Google/GitHub-only account. */
export function PasswordForm({ hasPassword, username }: { hasPassword: boolean; username: string }) {
  const [state, action, pending] = useActionState(changePassword, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state?.sent) return;
    // the page refreshes with the new password state, so the message follows what the server did
    toast(state.added ? "Password added" : "Password changed. Other devices were signed out.");
    form.current?.reset();
  }, [state]);

  return (
    <Disclosure
      title={hasPassword ? "Change password" : "Add a password"}
      body={
        hasPassword
          ? "Changing it signs you out on every other device."
          : "Sign in with your email or username too, not only Google or GitHub."
      }
    >
      <form ref={form} action={action} className="mt-3 space-y-3">
        {/* lets password managers file the new password under the right account */}
        <input type="text" name="username" value={username} autoComplete="username" hidden readOnly />
        {hasPassword && (
          <input
            name="currentPassword"
            aria-label="Current password"
            type="password"
            placeholder="Current password"
            autoComplete="current-password"
            required
            className={inputCls}
          />
        )}
        <input
          name="newPassword"
          aria-label="New password"
          type="password"
          placeholder="New password (8+ characters)"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          className={inputCls}
        />
        <input
          name="confirmPassword"
          aria-label="Confirm new password"
          type="password"
          placeholder="Confirm new password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          className={inputCls}
        />
        {state?.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        <button disabled={pending} className={`${btnPrimary} h-11 w-full text-sm`}>
          {pending ? "Saving…" : hasPassword ? "Change password" : "Add password"}
        </button>
      </form>
    </Disclosure>
  );
}

/** Change the account's email. It only switches once the new address clicks its link. */
export function EmailForm({ email, hasPassword, canEmail }: { email: string; hasPassword: boolean; canEmail: boolean }) {
  const [state, action, pending] = useActionState(requestEmailChange, undefined);
  // controlled, because React clears a form after each submit and a typo shouldn't cost the whole address
  const [newEmail, setNewEmail] = useState("");

  return (
    <Disclosure title="Email" body={email}>
      {!canEmail ? (
        <p className="mt-3 text-sm text-muted">Changing email isn&apos;t available on this server yet.</p>
      ) : state?.sent ? (
        <p role="status" className="mt-3 text-sm text-primary-text">
          Check your new inbox for a link. Your email changes when you click it. It lasts 24 hours.
        </p>
      ) : (
        <form action={action} className="mt-3 space-y-3">
          <input
            name="email"
            aria-label="New email"
            type="email"
            placeholder="New email"
            autoComplete="email"
            required
            maxLength={254}
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className={inputCls}
          />
          {hasPassword && (
            <input
              name="password"
              aria-label="Password to confirm the change"
              type="password"
              placeholder="Your password"
              autoComplete="current-password"
              required
              className={inputCls}
            />
          )}
          {state?.error && (
            <p role="alert" className="text-sm text-danger">
              {state.error}
            </p>
          )}
          <button disabled={pending} className={`${btnPrimary} h-11 w-full text-sm`}>
            {pending ? "Sending…" : "Send confirmation link"}
          </button>
        </form>
      )}
    </Disclosure>
  );
}

export function SignOutOthers() {
  const [pending, start] = useTransition();
  return (
    <div className="set-row mt-2">
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold">Sign out other devices</span>
        <span className="block text-[12.5px] text-muted">Lost a phone or used a shared computer? You stay signed in here.</span>
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await signOutOtherDevices();
            toast(res.error ?? "Signed out on every other device", res.error ? "error" : "info");
          })
        }
        className={`${btnGhost} h-10 shrink-0 px-4 text-sm`}
      >
        {pending ? "Signing out…" : "Sign out others"}
      </button>
    </div>
  );
}
