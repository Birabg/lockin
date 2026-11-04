"use client";

import { useState, useTransition } from "react";
import { createPost } from "@/app/actions/social";
import { Avatar } from "./ui";

export function Composer({ name }: { name: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="panel p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const body = text;
        setText("");
        setError(null);
        start(async () => {
          const res = await createPost(body);
          if (res.error) {
            setText(body);
            setError(res.error);
          }
        });
      }}
    >
      <div className="flex items-start gap-3">
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
      </div>
      {error && <p className="mt-2 pl-12 text-sm text-danger">{error}</p>}
    </form>
  );
}
