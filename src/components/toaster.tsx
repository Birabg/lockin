"use client";

import { useSyncExternalStore } from "react";

type Toast = { id: number; message: string; kind: "info" | "error" };

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function toast(message: string, kind: Toast["kind"] = "info") {
  const id = nextId++;
  toasts = [...toasts.slice(-2), { id, message, kind }];
  emit();
  setTimeout(() => dismiss(id), 4500);
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const none: Toast[] = [];

export function Toaster() {
  const list = useSyncExternalStore(
    subscribe,
    () => toasts,
    () => none,
  );
  return (
    <div role="status" aria-live="polite" className="fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6">
      {list.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`panel max-w-sm px-4 py-2.5 text-sm font-semibold shadow-lg ${t.kind === "error" ? "border-danger/60 text-danger" : ""}`}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
