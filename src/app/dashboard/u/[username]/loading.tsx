/** Shaped like a profile: cover, avatar, name, stats, then the heatmap. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[720px] animate-pulse" role="status" aria-label="Loading profile">
      <div className="panel overflow-hidden">
        <div className="h-[104px] bg-inset" />
        <div className="-mt-12 px-5">
          <div className="size-24 rounded-full border-4 border-card bg-inset" />
          <div className="mt-3 h-6 w-48 rounded-md bg-inset" />
          <div className="mt-2 h-4 w-28 rounded-md bg-inset" />
        </div>
        <div className="grid grid-cols-5 gap-2 p-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-[66px] rounded-[14px] bg-inset" />
          ))}
        </div>
      </div>
      <div className="panel mt-3 h-[190px]" />
    </div>
  );
}
