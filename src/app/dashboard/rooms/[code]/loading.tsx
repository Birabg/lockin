/** Shaped like a room: the header, then timer cards. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[880px] animate-pulse" role="status" aria-label="Loading room">
      <div className="mb-2.5 h-6 w-20 rounded-full bg-inset" />
      <div className="panel mb-3.5 h-[84px]" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] gap-2.5">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="panel h-[236px]" />
        ))}
      </div>
    </div>
  );
}
