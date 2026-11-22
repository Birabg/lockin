"use client";

import Link from "next/link";
import { useRef, useTransition } from "react";
import { saveAvatar } from "@/app/actions/media";
import { toast } from "@/components/toaster";
import { Avatar, btnGhost } from "@/components/ui";
import { squareImage, uploadBlob } from "@/lib/upload";

export function AvatarForm({ name, avatar, username }: { name: string; avatar: string | null; username: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    start(async () => {
      try {
        await saveAvatar(await uploadBlob("avatar", await squareImage(file)));
        toast("Photo updated");
      } catch (err) {
        toast(err instanceof Error ? err.message : "Couldn't upload that photo", "error");
      }
    });
  }

  return (
    <div className="set-avatar">
      <span className="relative">
        <Avatar name={name} src={avatar} size={72} />
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
          <button type="button" onClick={() => input.current?.click()} disabled={pending} className={`${btnGhost} h-9 px-3.5 text-[13px]`}>
            {pending ? "Uploading…" : "Change photo"}
          </button>
          {avatar && (
            <button
              type="button"
              onClick={() => start(() => saveAvatar(null))}
              disabled={pending}
              className={`${btnGhost} h-9 px-3.5 text-[13px]`}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
