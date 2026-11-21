"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { blockUser, muteUser, unmuteUser } from "@/app/actions/safety";
import { usePopover } from "./app-shell";
import { Icon } from "./icon";
import { ReportDialog } from "./report-dialog";
import { toast } from "./toaster";

const OFFLINE = { error: "Couldn't reach the server. Try again." };

/** Mute, block and report, from someone's profile. */
export function ProfileMenu({ userId, username, muting }: { userId: string; username: string; muting: boolean }) {
  const router = useRouter();
  const pop = usePopover<"menu">();
  const [reporting, setReporting] = useState(false);
  const [, start] = useTransition();

  const run = (fn: () => void) => () => {
    pop.setOpen(null);
    fn();
  };

  const toggleMute = run(() =>
    start(async () => {
      const res = await (muting ? unmuteUser(userId) : muteUser(userId)).catch(() => OFFLINE);
      if (res.error) return toast(res.error, "error");
      toast(muting ? `Unmuted @${username}` : `Muted @${username}. Their posts won't show in your feed.`);
      router.refresh();
    }),
  );

  const block = run(() => {
    if (
      !window.confirm(
        `Block @${username}? You won't see each other's posts, and they can't follow, comment, react or message you. Unblock any time in Settings.`,
      )
    )
      return;
    start(async () => {
      const res = await blockUser(userId).catch(() => OFFLINE);
      if (res.error) return toast(res.error, "error");
      toast(`Blocked @${username}`);
      router.replace("/dashboard");
    });
  });

  return (
    <div ref={pop.box} className="relative">
      <button
        onClick={() => pop.toggle("menu")}
        aria-expanded={pop.open === "menu"}
        aria-haspopup="menu"
        aria-label="More options"
        className="grid size-9 place-items-center rounded-full text-muted hover:bg-inset hover:text-foreground"
      >
        <Icon name="more" size={18} />
      </button>
      {pop.open && (
        <div role="menu" data-menu className="app-pop absolute top-[calc(100%+6px)] right-0 z-10">
          <button role="menuitem" onClick={toggleMute} className="app-menu-row">
            <Icon name="hide" size={18} /> {muting ? `Unmute @${username}` : `Mute @${username}`}
          </button>
          <button role="menuitem" onClick={run(() => setReporting(true))} className="app-menu-row">
            <Icon name="report" size={18} /> Report @{username}
          </button>
          <button role="menuitem" onClick={block} className="app-menu-row text-danger">
            <Icon name="block" size={18} /> Block @{username}
          </button>
        </div>
      )}
      {reporting && <ReportDialog type="user" id={userId} onClose={() => setReporting(false)} />}
    </div>
  );
}
