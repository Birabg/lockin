"use client";

import { useActionState } from "react";
import { createRoom, joinRoom } from "@/app/actions/together";
import { btnGhost, btnPrimary, inputCls } from "@/components/ui";

export function RoomForms() {
  const [created, create, creating] = useActionState(createRoom, undefined);
  const [joined, join, joining] = useActionState(joinRoom, undefined);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <form action={create} className="panel space-y-3 p-4">
        <input name="name" aria-label="Room name" placeholder="Room name" maxLength={40} required className={inputCls} />
        {created?.error && <p className="text-sm text-danger">{created.error}</p>}
        <button disabled={creating} className={`${btnPrimary} h-11 w-full text-sm`}>
          Create room
        </button>
      </form>
      <form action={join} className="panel space-y-3 p-4">
        <input name="code" aria-label="Room code" placeholder="Room code" maxLength={6} required className={`${inputCls} uppercase`} />
        {joined?.error && <p className="text-sm text-danger">{joined.error}</p>}
        <button disabled={joining} className={`${btnGhost} h-11 w-full text-sm`}>
          Join room
        </button>
      </form>
    </div>
  );
}
