"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { toggleFollow } from "@/app/actions/social";
import { toast } from "./toaster";

export function FollowButton({ userId, following, signedIn }: { userId: string; following: boolean; signedIn: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [on, setOn] = useOptimistic(following, (v) => !v);
  return (
    <button
      disabled={pending}
      aria-pressed={on}
      onClick={() => {
        if (!signedIn) return router.push("/signup");
        start(async () => {
          setOn(null);
          const res = await toggleFollow(userId);
          if (res.error) toast(res.error, "error");
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
