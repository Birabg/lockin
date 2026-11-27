"use client";

import { useActionState, useEffect, useState, useSyncExternalStore } from "react";
import { changeUsername, checkUsername, type UsernameState } from "@/app/actions/auth";
import { updateProfile } from "@/app/actions/social";
import { toast } from "@/components/toaster";
import { btnPrimary, inputCls } from "@/components/ui";
import { formatDuration } from "@/lib/time";

type Saved = { name: string; bio: string; dailyGoalMin: number; timeZone: string };

/**
 * updateProfile takes all four fields at once, so each form sends its own fields and passes the
 * saved values of the others along unchanged.
 */
function useSave() {
  return useActionState(async (prev: Awaited<ReturnType<typeof updateProfile>>, form: FormData) => {
    const res = await updateProfile(prev, form);
    if (res?.ok) toast("Saved");
    return res;
  }, undefined);
}

function SaveRow({
  dirty,
  pending,
  error,
  disabled,
  onReset,
}: {
  dirty: boolean;
  pending: boolean;
  error?: string;
  disabled?: boolean;
  onReset: () => void;
}) {
  return (
    <div className="set-save">
      <span className="min-w-0 flex-1 text-[12.5px] font-semibold">
        {error ? <span className="text-danger">{error}</span> : dirty ? <span className="text-muted">Unsaved changes</span> : null}
      </span>
      {dirty && !pending && (
        <button type="button" onClick={onReset} className="set-link">
          Undo
        </button>
      )}
      <button disabled={!dirty || pending || disabled} className={`${btnPrimary} h-10 px-5 text-sm`}>
        {pending ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

export function IdentityForm({ saved }: { saved: Saved }) {
  const [state, action, pending] = useSave();
  const [name, setName] = useState(saved.name);
  const [bio, setBio] = useState(saved.bio);
  const dirty = name.trim() !== saved.name || bio.trim() !== saved.bio;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="dailyGoalMin" value={saved.dailyGoalMin} />
      <input type="hidden" name="timeZone" value={saved.timeZone} />
      <label className="block">
        <span className="set-label">Display name</span>
        <input name="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required className={inputCls} />
      </label>
      <label className="block">
        <span className="set-label flex justify-between">
          Bio
          <span className="font-semibold text-subtle tabular" aria-live="polite">
            {bio.length}/160
          </span>
        </span>
        <textarea
          name="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={160}
          rows={3}
          placeholder="What are you working towards?"
          className={`${inputCls} resize-none`}
        />
      </label>
      <SaveRow
        dirty={dirty}
        pending={pending}
        error={state?.error}
        onReset={() => {
          setName(saved.name);
          setBio(saved.bio);
        }}
      />
    </form>
  );
}

type Check = { ok: boolean; message: string; for: string } | null;

/** Renaming, with the same live "is it free?" check as signup. */
export function UsernameForm({ current, admin }: { current: string; admin: boolean }) {
  const [saved, setSaved] = useState(current);
  const [username, setUsername] = useState(current);
  const [state, action, pending] = useActionState(async (prev: UsernameState, form: FormData) => {
    const res = await changeUsername(prev, form);
    if (res?.username) {
      setSaved(res.username);
      setUsername(res.username);
      toast(`You’re @${res.username} now`);
    }
    return res;
  }, undefined);
  const [check, setCheck] = useState<Check>(null);
  const value = username.trim().toLowerCase();
  const dirty = value !== saved;

  // checks a moment after they stop typing; an answer for an older value is ignored
  useEffect(() => {
    if (!value || value === saved) return;
    let live = true;
    const t = setTimeout(async () => {
      const res = await checkUsername(value);
      if (live) setCheck({ ...res, for: value });
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [value, saved]);

  const result = dirty && check?.for === value ? check : null;

  return (
    <form action={action} className="space-y-2">
      <label className="block">
        <span className="set-label">Username</span>
        <span className="flex items-center gap-1 rounded-[inherit]">
          <span aria-hidden className="text-[15px] font-semibold text-subtle">
            @
          </span>
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
        </span>
      </label>
      <p
        id="username-status"
        aria-live="polite"
        className={`min-h-5 text-[12.5px] ${result ? (result.ok ? "text-primary-text" : "text-danger") : "text-subtle"}`}
      >
        {result
          ? result.message
          : `3–20 letters, numbers or _. Your profile link becomes /u/${value || "…"}; links with @${saved} stop working.`}
      </p>
      {admin && dirty && (
        <p role="note" className="text-[12.5px] font-semibold text-danger">
          Admin access goes by username. Renaming takes it away until ADMIN_USERNAMES lists the new name.
        </p>
      )}
      <SaveRow
        dirty={dirty}
        pending={pending}
        error={state?.error}
        disabled={result?.ok === false}
        onReset={() => setUsername(saved)}
      />
    </form>
  );
}

const GOALS = [30, 60, 120, 180, 240];
const noop = () => () => {};
const tick = (cb: () => void) => {
  const id = setInterval(cb, 20_000);
  return () => clearInterval(id);
};

export function FocusForm({ saved, timeZones }: { saved: Saved; timeZones: string[] }) {
  const [state, action, pending] = useSave();
  const [goal, setGoal] = useState(String(saved.dailyGoalMin));
  const [tz, setTz] = useState(saved.timeZone);
  // read on the client only: the server can't know the device's zone or the viewer's clock
  const deviceTz = useSyncExternalStore(
    noop,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );
  const minute = useSyncExternalStore(
    tick,
    () => Math.floor(Date.now() / 60_000),
    () => null,
  );
  const dirty = Number(goal) !== saved.dailyGoalMin || tz !== saved.timeZone;
  const zones = deviceTz && !timeZones.includes(deviceTz) ? [...timeZones, deviceTz].sort() : timeZones;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="name" value={saved.name} />
      <input type="hidden" name="bio" value={saved.bio} />
      <fieldset>
        <legend className="set-label">Daily goal</legend>
        <div className="flex flex-wrap items-center gap-2">
          {GOALS.map((g) => (
            <button key={g} type="button" aria-pressed={Number(goal) === g} onClick={() => setGoal(String(g))} className="set-chip">
              {formatDuration(g * 60)}
            </button>
          ))}
          <label className="set-custom">
            <input
              name="dailyGoalMin"
              type="number"
              inputMode="numeric"
              min={10}
              max={960}
              step={5}
              required
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              aria-label="Daily goal in minutes"
            />
            <span>min</span>
          </label>
        </div>
        <p className="mt-2 text-[12.5px] text-subtle">Fills your ring on the timer and sets which days count as hit. 10 to 960 minutes.</p>
      </fieldset>

      <label className="block">
        <span className="set-label">Time zone</span>
        <select name="timeZone" value={tz} onChange={(e) => setTz(e.target.value)} className={inputCls}>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-subtle">
          {minute !== null && (
            <span>
              It’s{" "}
              <span className="font-bold text-foreground tabular">
                {new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", weekday: "short" }).format(
                  minute * 60_000,
                )}
              </span>{" "}
              there
            </span>
          )}
          {deviceTz && deviceTz !== tz && (
            <button type="button" onClick={() => setTz(deviceTz)} className="set-link">
              Use this device’s ({deviceTz.replaceAll("_", " ")})
            </button>
          )}
        </span>
        <span className="mt-1 block text-[12.5px] text-subtle">Your day and streak follow this. Past days stay as they were.</span>
      </label>

      <SaveRow
        dirty={dirty}
        pending={pending}
        error={state?.error}
        onReset={() => {
          setGoal(String(saved.dailyGoalMin));
          setTz(saved.timeZone);
        }}
      />
    </form>
  );
}
