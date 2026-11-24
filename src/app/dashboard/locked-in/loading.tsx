/** Shaped like Locked In: the live headline, then session cards. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[760px] animate-pulse" role="status" aria-label="Loading">
      <div className="panel mb-4 h-[170px]" />
      <div className="grid gap-2.5 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="panel h-[86px]" />
        ))}
      </div>
    </div>
  );
}
