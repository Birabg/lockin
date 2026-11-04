"use client";

import { toast } from "@/components/toaster";
import { btnGhost } from "@/components/ui";

export function ShareCard({ username }: { username: string }) {
  async function share() {
    const url = `${window.location.origin}/card/${username}`;
    if (navigator.share) return void (await navigator.share({ title: "My streak", url }).catch(() => {}));
    await navigator.clipboard?.writeText(url);
    toast("Link copied");
  }
  return (
    <div className="flex gap-2">
      <a href={`/card/${username}`} target="_blank" rel="noreferrer" className={`${btnGhost} h-10 text-sm`}>
        View streak card
      </a>
      <button onClick={share} className={`${btnGhost} h-10 text-sm`}>
        Share
      </button>
    </div>
  );
}
