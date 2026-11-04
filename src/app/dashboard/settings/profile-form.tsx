"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/actions/social";
import { btnPrimary, inputCls } from "@/components/ui";

export function ProfileForm({ user }: { user: { name: string; bio: string; dailyGoalMin: number } }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  return (
    <form action={action} className="panel space-y-4 p-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-muted">Display name</span>
        <input name="name" defaultValue={user.name} maxLength={40} required className={inputCls} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-muted">Bio</span>
        <textarea name="bio" defaultValue={user.bio} maxLength={160} rows={2} className={`${inputCls} resize-none`} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-muted">Daily goal (minutes)</span>
        <input name="dailyGoalMin" type="number" min={10} max={960} defaultValue={user.dailyGoalMin} className={inputCls} />
      </label>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.ok && <p className="text-sm text-live">Saved.</p>}
      <button disabled={pending} className={`${btnPrimary} h-11 w-full text-sm`}>
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
