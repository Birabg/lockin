"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { toggleFollow } from "@/app/actions/social";
import { toast } from "./toaster";

/**
 * Follow / Following. Says "Follow back" when they already follow you, and "Unfollow" when you hover
 * "Following", so it's clear what a click will do. A fixed minimum width keeps rows from shifting.
 */
export function FollowButton({
  userId,
  following,
  signedIn,
  followsYou = false,
  name,
}: {
  userId: string;
  following: boolean;
  signedIn: boolean;
  followsYou?: boolean;
  /** for the screen-reader label, e.g. "Follow Abel" */
  name?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [on, setOn] = useOptimistic(following, (v) => !v);
  // just clicked: don't flip to "Unfollow" under the pointer until it has left the button once
  const [fresh, setFresh] = useState(false);
  const idle = followsYou ? "Follow back" : "Follow";
  return (
    <button
      disabled={pending}
      aria-pressed={on}
      aria-label={name ? `${on ? "Unfollow" : idle} ${name}` : undefined}
      onMouseLeave={() => setFresh(false)}
      onClick={() => {
        if (!signedIn) return router.push("/signup");
        setFresh(true);
        start(async () => {
          setOn(null);
          const res = await toggleFollow(userId);
          if (res.error) toast(res.error, "error");
        });
      }}
      className={`group/follow min-w-[92px] shrink-0 rounded-full px-4 py-1.5 text-sm font-bold whitespace-nowrap transition-colors ${
        on
          ? "border-2 border-border bg-card text-muted " + (fresh ? "" : " hover:border-danger/50 hover:text-danger")
          : "btn-3d bg-primary text-primary-foreground"
      }`}
    >
      {on ? (
        <>
          <span className={fresh ? "" : "group-hover/follow:hidden"}>Following</span>
          {!fresh && <span className="hidden group-hover/follow:inline">Unfollow</span>}
        </>
      ) : (
        idle
      )}
    </button>
  );
}
