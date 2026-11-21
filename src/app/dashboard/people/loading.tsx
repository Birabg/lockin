/** Shaped like the page: the search bar and tabs, then rows of people. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[680px] animate-pulse" role="status" aria-label="Loading people">
      <div className="mb-5 h-5 w-48 rounded-md bg-inset" />
      <div className="mb-4 grid gap-2.5 sm:grid-cols-[1fr_300px]">
        <div className="h-[46px] rounded-[14px] bg-card" />
        <div className="h-[46px] rounded-[14px] bg-card" />
      </div>
      <div className="panel">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-border px-4 py-3 not-first:border-t">
            <div className="size-[46px] shrink-0 rounded-full bg-inset" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-36 rounded bg-inset" />
              <div className="h-3 w-52 max-w-full rounded bg-inset" />
            </div>
            <div className="h-8 w-[92px] rounded-full bg-inset" />
          </div>
        ))}
      </div>
    </div>
  );
}
