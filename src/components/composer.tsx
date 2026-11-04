"use client";

import { useState, useTransition } from "react";
import { createPost } from "@/app/actions/social";
import { Avatar } from "./ui";

export function Composer({ name }: { name: string }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="panel flex items-start gap-3 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const body = text;
        setText("");
        start(() => createPost(body));
      }}
    >
      <Avatar name={name} size={36} />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
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
    </form>
  );
}
