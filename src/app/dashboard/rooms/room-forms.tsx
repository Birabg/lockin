"use client";

import { useActionState, useRef, useState } from "react";
import { createRoom, joinRoom } from "@/app/actions/together";
import { Icon } from "@/components/icon";

const CODE_LEN = 6;

/** Start a room or join one by code, in one card: creating is the main action, joining sits under it. */
export function RoomForms({ compact = false }: { compact?: boolean }) {
  const [created, create, creating] = useActionState(createRoom, undefined);
  const [joined, join, joining] = useActionState(joinRoom, undefined);
  const [code, setCode] = useState("");
  const joinForm = useRef<HTMLFormElement>(null);

  return (
    <div className={`rooms-start ${compact ? "rooms-start-compact" : ""}`}>
      <form action={create} className="rooms-start-row">
        <label htmlFor="room-name" className="sr-only">
          Room name
        </label>
        <input
          id="room-name"
          name="name"
          placeholder="Name a room, e.g. Late night study"
          maxLength={40}
          required
          autoComplete="off"
          className="rooms-input"
          aria-invalid={!!created?.error || undefined}
          aria-describedby={created?.error ? "room-name-error" : undefined}
        />
        <button disabled={creating} className="rooms-btn rooms-btn-primary">
          <Icon name="add" size={18} /> {creating ? "Creating…" : "Create room"}
        </button>
      </form>
      {created?.error && (
        <p id="room-name-error" role="alert" className="rooms-error">
          {created.error}
        </p>
      )}

      <div className="rooms-or" aria-hidden>
        <span>or join with a code</span>
      </div>

      <form ref={joinForm} action={join} className="rooms-start-row">
        <label htmlFor="room-code" className="sr-only">
          Room code
        </label>
        <input
          id="room-code"
          name="code"
          value={code}
          onChange={(e) => {
            const next = e.target.value
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "")
              .slice(0, CODE_LEN);
            setCode(next);
            // a full code joins straight away, no need to reach for the button
            if (next.length === CODE_LEN && !joining) requestAnimationFrame(() => joinForm.current?.requestSubmit());
          }}
          placeholder="ABC123"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          required
          minLength={CODE_LEN}
          maxLength={CODE_LEN}
          className="rooms-input rooms-code-input"
          aria-invalid={!!joined?.error || undefined}
          aria-describedby={joined?.error ? "room-code-error" : undefined}
        />
        <button disabled={joining || code.length < CODE_LEN} className="rooms-btn rooms-btn-ghost">
          {joining ? "Joining…" : "Join"}
        </button>
      </form>
      {joined?.error && (
        <p id="room-code-error" role="alert" className="rooms-error">
          {joined.error}
        </p>
      )}
    </div>
  );
}
