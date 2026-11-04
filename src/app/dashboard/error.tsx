"use client";

import { btnPrimary } from "@/components/ui";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <p className="text-xl font-extrabold">Something went wrong</p>
      <p className="max-w-sm text-sm text-muted">That didn’t work. Check your connection and try again.</p>
      <button onClick={reset} className={`${btnPrimary} h-11 text-sm`}>
        Try again
      </button>
    </div>
  );
}
