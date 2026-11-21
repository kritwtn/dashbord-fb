export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-5 px-4 py-6 sm:px-6" aria-busy="true" aria-label="กำลังโหลด">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-7 w-64" />
        </div>
        <div className="skeleton h-9 w-[420px] max-w-full rounded-[10px]" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`card space-y-3 p-4 ${i === 0 ? "col-span-2 lg:col-span-1" : ""}`}>
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-7 w-28" />
            <div className="skeleton h-8 w-full" />
          </div>
        ))}
      </div>
      <div className="card p-5"><div className="skeleton h-[280px] w-full" /></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5"><div className="skeleton h-56 w-full" /></div>
        <div className="card p-5"><div className="skeleton h-56 w-full" /></div>
      </div>
    </div>
  );
}
