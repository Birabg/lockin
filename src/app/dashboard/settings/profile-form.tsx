"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/actions/social";
import { btnPrimary, inputCls } from "@/components/ui";

type Props = { user: { name: string; bio: string; dailyGoalMin: number; timeZone: string }; timeZones: string[] };

export function ProfileForm({ user, timeZones }: Props) {
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
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-muted">Time zone</span>
        <select name="timeZone" defaultValue={user.timeZone} className={inputCls}>
          {timeZones.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-subtle">Your day and streak follow this. Past days stay as they were.</span>
      </label>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.ok && <p className="text-sm text-live">Saved.</p>}
      <button disabled={pending} className={`${btnPrimary} h-11 w-full text-sm`}>
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
