"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { chooseAvatar, saveAvatar } from "@/app/actions/media";
import { toast } from "@/components/toaster";
import { Avatar, btnGhost } from "@/components/ui";
import { AVATAR_PRESETS, presetUrl, type AvatarPresetId } from "@/lib/avatar-presets";
import { squareImage, uploadBlob } from "@/lib/upload";

export function AvatarForm({ name, avatar, username }: { name: string; avatar: string | null; username: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [picking, setPicking] = useState(false);
  // shows the picked picture at once; the server's answer replaces it
  const [shown, setShown] = useState<{ for: string | null; url: string | null } | null>(null);
  const current = shown && shown.for === avatar ? shown.url : avatar;

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    start(async () => {
      try {
        await saveAvatar(await uploadBlob("avatar", await squareImage(file)));
        setPicking(false);
        toast("Photo updated");
      } catch (err) {
        toast(err instanceof Error ? err.message : "Couldn't upload that photo", "error");
      }
    });
  }

  function onPreset(id: AvatarPresetId) {
    setShown({ for: avatar, url: presetUrl(id) });
    start(async () => {
      try {
        await chooseAvatar(id);
      } catch (err) {
        setShown(null);
        toast(err instanceof Error ? err.message : "Couldn't set that picture", "error");
      }
    });
  }

  return (
    <div className="set-avatar-wrap">
      <div className="set-avatar">
        <span className="relative">
          <Avatar name={name} src={current} size={72} />
          {pending && <span className="set-avatar-busy" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold">{name}</p>
          <Link href={`/dashboard/u/${username}`} className="set-link text-[12.5px]">
            @{username} · view profile
          </Link>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <input
              ref={input}
              type="file"
              accept="image/*"
              onChange={onFile}
              className="sr-only"
              aria-label="Choose a profile photo"
              tabIndex={-1}
            />
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={pending}
              className={`${btnGhost} h-9 px-3.5 text-[13px]`}
            >
              {pending ? "Saving…" : "Upload photo"}
            </button>
            <button
              type="button"
              onClick={() => setPicking((v) => !v)}
              aria-expanded={picking}
              aria-controls="avatar-presets"
              className={`${btnGhost} h-9 px-3.5 text-[13px]`}
            >
              {picking ? "Done" : "Pick an avatar"}
            </button>
            {current && (
              <button
                type="button"
                onClick={() => {
                  setShown({ for: avatar, url: null });
                  start(() => saveAvatar(null));
                }}
                disabled={pending}
                className={`${btnGhost} h-9 px-3.5 text-[13px]`}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {picking && (
        <div id="avatar-presets" role="group" aria-label="Built-in avatars" className="set-presets">
          {AVATAR_PRESETS.map((p) => {
            const on = current === presetUrl(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onPreset(p.id)}
                disabled={pending}
                aria-pressed={on}
                title={p.label}
                className="set-preset"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVGs */}
                <img src={presetUrl(p.id)} alt="" width={56} height={56} />
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
