"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { createPost } from "@/app/actions/social";
import { toast } from "./toaster";
import { Avatar } from "./ui";

export function Composer({ name, avatar }: { name: string; avatar: string | null }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const firstName = name.trim().split(/\s+/)[0];
  return (
    <form
      className="panel px-3.5 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        const body = text;
        setText("");
        window.dispatchEvent(new CustomEvent("lockin:posting", { detail: body }));
        start(async () => {
          const res = await createPost(body);
          if (res.error) {
            window.dispatchEvent(new CustomEvent("lockin:posting", { detail: null }));
            setText(body);
            toast(res.error, "error");
          }
        });
      }}
    >
      <div className="flex items-center gap-3">
        <Avatar name={name} src={avatar} size={36} />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Write a post"
          placeholder={`What did you lock in today, ${firstName}?`}
          rows={1}
          maxLength={280}
          className="h-10 min-w-0 flex-1 resize-none rounded-2xl border border-border/60 bg-inset/60 px-4 py-2 text-[14.5px] leading-[22px] outline-none placeholder:truncate placeholder:text-subtle focus:border-primary"
        />
        <button
          disabled={!text.trim() || pending}
          aria-label="Post"
          className="btn-3d grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
        >
          <Send className="size-[18px]" aria-hidden />
        </button>
      </div>
    </form>
  );
}
