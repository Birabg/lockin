"use client";

import { useState, useTransition } from "react";
import { createPost } from "@/app/actions/social";
import { toast } from "./toaster";
import { Avatar } from "./ui";

export function Composer({ name, avatar }: { name: string; avatar: string | null }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="panel p-3"
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
      <div className="flex items-start gap-3">
        <Avatar name={name} src={avatar} size={36} />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Write a post"
          placeholder="What are you working on today?"
          rows={1}
          maxLength={280}
          className="min-h-9 flex-1 resize-none bg-transparent py-2 text-[15px] outline-none placeholder:text-subtle"
        />
        <button
          disabled={!text.trim() || pending}
          className="btn-3d mt-0.5 rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground disabled:opacity-40"
        >
          Post
        </button>
      </div>
    </form>
  );
}
