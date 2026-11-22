"use client";

import { Icon } from "@/components/icon";
import { usePopover } from "@/components/app-shell";

/** A small menu for the room's less common actions. Leaving asks first, since you'd need the code to get back. */
export function RoomMenu({ leave, name }: { leave: () => Promise<void>; name: string }) {
  const pop = usePopover<"menu">();
  return (
    <div ref={pop.box} className="relative">
      <button
        type="button"
        onClick={() => pop.toggle("menu")}
        aria-expanded={pop.open === "menu"}
        aria-haspopup="menu"
        aria-label="Room options"
        className="room-icon-btn"
      >
        <Icon name="more" size={18} />
      </button>
      {pop.open && (
        <div role="menu" data-menu className="app-pop absolute top-[calc(100%+6px)] right-0 z-10">
          <form
            action={leave}
            onSubmit={(e) => {
              if (!window.confirm(`Leave “${name}”? You can rejoin any time with the room code.`)) e.preventDefault();
            }}
          >
            <button role="menuitem" className="app-menu-row w-full text-danger">
              <Icon name="logout" size={18} /> Leave room
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
