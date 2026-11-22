/** Shaped like the rooms page: the start card, then room cards. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[760px] animate-pulse" role="status" aria-label="Loading rooms">
      <div className="panel h-[150px]" />
      <div className="mt-6 mb-3 h-5 w-32 rounded-md bg-inset" />
      <div className="grid gap-2.5 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="panel h-[118px]" />
        ))}
      </div>
    </div>
  );
}
