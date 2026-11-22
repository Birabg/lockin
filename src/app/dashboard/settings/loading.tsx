/** Shaped like Settings: the section nav beside the first couple of cards. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[900px] animate-pulse" role="status" aria-label="Loading settings">
      <div className="mb-4 h-12 w-48 rounded-md bg-inset" />
      <div className="grid gap-3 min-[56rem]:grid-cols-[180px_minmax(0,1fr)] min-[56rem]:gap-5">
        <div className="flex gap-2 min-[56rem]:flex-col">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-8 w-20 rounded-full bg-inset min-[56rem]:w-full min-[56rem]:rounded-xl" />
          ))}
        </div>
        <div className="space-y-3">
          <div className="panel h-[360px]" />
          <div className="panel h-[240px]" />
        </div>
      </div>
    </div>
  );
}
