"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/app/actions/account";
import { btnPrimary, inputCls } from "@/components/ui";

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  return (
    <form action={action} className="panel space-y-3 p-5">
      <h1 className="mb-2 text-xl font-extrabold">Reset your password</h1>
      {state?.sent ? (
        <p className="text-sm text-muted">If that email has an account, a reset link is on its way. It expires in 1 hour.</p>
      ) : (
        <>
          <input name="email" aria-label="Email" type="email" placeholder="Email" autoComplete="email" required className={inputCls} />
          {state?.error && <p className="text-sm text-danger">{state.error}</p>}
          <button disabled={pending} className={`${btnPrimary} h-12 w-full`}>
            {pending ? "One sec…" : "Send reset link"}
          </button>
        </>
      )}
      <p className="pt-1 text-center text-sm text-muted">
        <Link href="/login" className="font-semibold text-primary">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
