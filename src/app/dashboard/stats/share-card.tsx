"use client";

import { Icon } from "@/components/icon";
import { toast } from "@/components/toaster";
import { btnGhost } from "@/components/ui";

/** Shares a link to the user's streak card image, or copies it where sharing isn't available. */
export function ShareCard({ username }: { username: string }) {
  async function share() {
    const url = `${window.location.origin}/card/${username}`;
    if (navigator.share) return void (await navigator.share({ title: "My streak", url }).catch(() => {}));
    await navigator.clipboard?.writeText(url);
    toast("Link copied");
  }
  return (
    <button onClick={share} className={`${btnGhost} h-10 px-4 text-sm`}>
      <Icon name="share" size={16} /> Share card
    </button>
  );
}
