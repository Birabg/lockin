"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { unblockUser, unmuteUser } from "@/app/actions/safety";
import { toast } from "@/components/toaster";
import { Avatar, btnGhost } from "@/components/ui";

type Person = { id: string; username: string; name: string; avatar: string | null };

/** People you blocked or muted, each with a way back. */
export function BlockedPeople({ blocked, muted }: { blocked: Person[]; muted: Person[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function undo(kind: "block" | "mute", p: Person) {
    start(async () => {
      const res = await (kind === "block" ? unblockUser(p.id) : unmuteUser(p.id)).catch(() => ({
        error: "Couldn't reach the server. Try again.",
      }));
      if (res.error) return toast(res.error, "error");
      toast(kind === "block" ? `Unblocked @${p.username}` : `Unmuted @${p.username}`);
      router.refresh();
    });
  }

  const list = (kind: "block" | "mute", people: Person[], empty: string) =>
    people.length === 0 ? (
      <p className="text-sm text-muted">{empty}</p>
    ) : (
      <ul className="divide-y divide-border/60" data-list={kind}>
        {people.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2.5">
            <Avatar name={p.name} src={p.avatar} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{p.name}</span>
              <span className="block truncate text-xs text-muted">@{p.username}</span>
            </span>
            <button disabled={pending} onClick={() => undo(kind, p)} className={`${btnGhost} h-9 px-3.5 text-sm`}>
              {kind === "block" ? "Unblock" : "Unmute"}
            </button>
          </li>
        ))}
      </ul>
    );

  return (
    <section className="panel mb-4 p-4" aria-labelledby="blocked-title">
      <h2 id="blocked-title" className="font-bold">
        Blocked users
      </h2>
      <p className="mb-2 text-sm text-muted">You and they can’t see each other’s posts or interact. They aren’t told.</p>
      {list("block", blocked, "You haven't blocked anyone.")}
      <h3 className="mt-4 font-bold">Muted users</h3>
      <p className="mb-2 text-sm text-muted">Their posts stay out of your feed. They can still see and interact with yours.</p>
      {list("mute", muted, "You haven't muted anyone.")}
    </section>
  );
}
