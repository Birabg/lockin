/** Shaped like the leaderboard: tabs, your standing, the podium, then rows. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[720px] animate-pulse" role="status" aria-label="Loading leaderboard">
      <div className="mb-4 h-12 w-52 rounded-md bg-inset" />
      <div className="panel mb-3 h-[46px]" />
      <div className="panel mb-3.5 h-[72px]" />
      <div className="mb-3.5 grid grid-cols-3 items-end gap-2.5">
        {[150, 190, 130].map((h, i) => (
          <div key={i} className="rounded-2xl bg-inset" style={{ height: h }} />
        ))}
      </div>
      <div className="panel h-[300px]" />
    </div>
  );
}
