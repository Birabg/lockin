"use client";

import { btnPrimary } from "@/components/ui";

export default function RootError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-xl font-extrabold">Something went wrong</p>
      <p className="max-w-sm text-sm text-muted">That didn’t work. Check your connection and try again.</p>
      <button onClick={reset} className={`${btnPrimary} h-11 text-sm`}>
        Try again
      </button>
    </div>
  );
}
