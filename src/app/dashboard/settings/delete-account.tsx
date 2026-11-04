"use client";

import { useActionState } from "react";
import { deleteAccount } from "@/app/actions/account";
import { btnGhost, inputCls } from "@/components/ui";

export function DeleteAccount() {
  const [state, action, pending] = useActionState(deleteAccount, undefined);
  return (
    <details className="panel mt-4 p-4">
      <summary className="cursor-pointer text-sm font-bold text-danger">Delete account</summary>
      <form action={action} className="mt-3 space-y-3">
        <p className="text-sm text-muted">
          This permanently deletes your profile, sessions, posts, comments, likes, avatar and timelapses. It can&apos;t be undone.
        </p>
        <input
          name="password"
          aria-label="Your password"
          type="password"
          placeholder="Your password"
          autoComplete="current-password"
          required
          className={inputCls}
        />
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        <button disabled={pending} className={`${btnGhost} h-11 w-full text-sm text-danger`}>
          {pending ? "Deleting…" : "Delete my account"}
        </button>
      </form>
    </details>
  );
}
