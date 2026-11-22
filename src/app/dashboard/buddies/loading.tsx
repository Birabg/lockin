/** Shaped like the buddies page: a heading, then buddy cards. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[760px] animate-pulse" role="status" aria-label="Loading buddies">
      <div className="mb-4 px-1">
        <div className="h-6 w-44 rounded-md bg-inset" />
        <div className="mt-2 h-4 w-72 max-w-full rounded-md bg-inset" />
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="panel h-[190px]" />
        ))}
      </div>
    </div>
  );
}
