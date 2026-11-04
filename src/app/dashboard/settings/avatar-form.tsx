"use client";

import { useRef, useTransition } from "react";
import { saveAvatar } from "@/app/actions/media";
import { toast } from "@/components/toaster";
import { Avatar, btnGhost } from "@/components/ui";
import { squareImage, uploadBlob } from "@/lib/upload";

export function AvatarForm({ name, avatar }: { name: string; avatar: string | null }) {
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
    <div className="panel mb-4 flex items-center gap-4 p-4">
      <Avatar name={name} src={avatar} size={64} />
      <div className="flex flex-wrap gap-2">
        <input
          ref={input}
          type="file"
          accept="image/*"
          onChange={onFile}
          className="sr-only"
          aria-label="Choose a profile photo"
          tabIndex={-1}
        />
        <button type="button" onClick={() => input.current?.click()} disabled={pending} className={`${btnGhost} h-10 text-sm`}>
          {pending ? "Uploading…" : "Change photo"}
        </button>
        {avatar && (
          <button type="button" onClick={() => start(() => saveAvatar(null))} disabled={pending} className={`${btnGhost} h-10 text-sm`}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
