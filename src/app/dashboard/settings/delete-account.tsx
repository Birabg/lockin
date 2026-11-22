"use client";

import { useActionState } from "react";
import { deleteAccount } from "@/app/actions/account";
import { btnGhost, inputCls } from "@/components/ui";

/** Password accounts confirm with their password; Google/GitHub-only accounts type their username. */
export function DeleteAccount({ hasPassword, username }: { hasPassword: boolean; username: string }) {
  const [state, action, pending] = useActionState(deleteAccount, undefined);
  return (
    <details className="set-danger">
      <summary>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold text-danger">Delete account</span>
          <span className="block text-[12.5px] font-normal text-muted">Permanently remove your profile and everything you’ve posted.</span>
        </span>
        <span className="set-danger-chev" aria-hidden>
          ›
        </span>
      </summary>
      <form action={action} className="mt-3 space-y-3">
        <p className="text-sm text-muted">
          This permanently deletes your profile, sessions, posts, comments, likes, avatar and timelapses. It can&apos;t be undone.
        </p>
        {hasPassword ? (
          <input
            name="password"
            aria-label="Your password"
            type="password"
            placeholder="Your password"
            autoComplete="current-password"
            required
            className={inputCls}
          />
        ) : (
          <label className="block">
            <span className="mb-1 block text-sm text-muted">
              Type <span className="font-bold text-foreground">{username}</span> to confirm
            </span>
            <input
              name="confirmUsername"
              aria-label="Type your username to confirm"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              required
              className={inputCls}
            />
          </label>
        )}
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        <button disabled={pending} className={`${btnGhost} h-11 w-full text-sm text-danger`}>
          {pending ? "Deleting…" : "Delete my account"}
        </button>
      </form>
    </details>
  );
}
