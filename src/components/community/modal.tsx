"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Icon } from "@/components/icon";
import { btnGhost, btnPrimary } from "@/components/ui";
import { closeSignIn, useGuestAsk } from "./community-provider";

/**
 * A native modal dialog: it traps focus, closes on Escape, and sits above the top bar and dock.
 * Clicking the dimmed area outside the box also closes it. On phones it rises from the bottom.
 */
export function Modal({
  label,
  onClose,
  children,
  wide = false,
}: {
  label: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const opener = document.activeElement as HTMLElement | null;
    d.showModal();
    const onCancel = (e: Event) => {
      e.preventDefault();
      close.current();
    };
    d.addEventListener("cancel", onCancel);
    return () => {
      d.removeEventListener("cancel", onCancel);
      opener?.focus?.();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={label}
      className={`community-modal ${wide ? "community-modal-wide" : ""}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="community-modal-body">
        <button onClick={onClose} aria-label="Close" className="community-modal-close">
          <Icon name="close" size={18} />
        </button>
        {children}
      </div>
    </dialog>
  );
}

/** "Sign in to vote", shown when a guest tries to do something on the board or the wall. */
export function SignInPrompt() {
  const what = useGuestAsk();
  const path = usePathname();
  if (!what) return null;
  const next = encodeURIComponent(path || "/dashboard");
  return (
    <Modal label="Sign in" onClose={closeSignIn}>
      <div className="flex flex-col items-center px-2 pt-2 pb-1 text-center">
        <span className="community-guest-badge" aria-hidden>
          🔒
        </span>
        <h2 className="mt-3 text-lg font-extrabold tracking-tight">Sign in to {what}</h2>
        <p className="mt-1 max-w-xs text-sm text-muted">
          Quests, polls and hot takes are for members. It&apos;s free and takes a few seconds.
        </p>
        <div className="mt-5 flex w-full gap-2">
          <Link href={`/login?next=${next}`} onClick={closeSignIn} className={`${btnGhost} h-11 flex-1 text-sm`}>
            Sign in
          </Link>
          <Link href={`/signup?next=${next}`} onClick={closeSignIn} className={`${btnPrimary} h-11 flex-1 text-sm`}>
            Join free
          </Link>
        </div>
      </div>
    </Modal>
  );
}
