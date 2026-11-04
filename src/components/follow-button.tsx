"use client";

import { useOptimistic, useTransition } from "react";
import { toggleFollow } from "@/app/actions/social";

export function FollowButton({ userId, following, signedIn }: { userId: string; following: boolean; signedIn: boolean }) {
  const [pending, start] = useTransition();
  const [on, setOn] = useOptimistic(following, (v) => !v);
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!signedIn) return void (window.location.href = "/signup");
        start(async () => {
          setOn(null);
          await toggleFollow(userId);
        });
      }}
      className={`rounded-full px-4 py-1.5 text-sm font-bold ${
        on ? "border-2 border-border bg-card text-muted" : "btn-3d bg-primary text-primary-foreground"
      }`}
    >
      {on ? "Following" : "Follow"}
    </button>
  );
}
