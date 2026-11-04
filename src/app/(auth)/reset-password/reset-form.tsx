"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPassword } from "@/app/actions/account";
import { btnPrimary, inputCls } from "@/components/ui";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, undefined);
  return (
    <form action={action} className="panel space-y-3 p-5">
      <h1 className="mb-2 text-xl font-extrabold">Choose a new password</h1>
      <input type="hidden" name="token" value={token} />
      <input
        name="password"
        aria-label="New password"
        type="password"
        placeholder="New password (8+ characters)"
        autoComplete="new-password"
        required
        minLength={8}
        maxLength={72}
        className={inputCls}
      />
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button disabled={pending} className={`${btnPrimary} h-12 w-full`}>
        {pending ? "One sec…" : "Save new password"}
      </button>
      <p className="pt-1 text-center text-sm text-muted">
        <Link href="/forgot-password" className="font-semibold text-primary">
          Ask for a new link
        </Link>
      </p>
    </form>
  );
}
