export function PageSkeleton() {
  return (
    <div className="min-h-screen animate-pulse p-8">
      <div className="mb-10 flex items-center justify-between">
        <div className="h-7 w-36 rounded bg-zinc-800" />
        <div className="h-8 w-8 rounded-full bg-zinc-800" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-zinc-900" />
        ))}
      </div>
      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 rounded-lg bg-zinc-900" />
        ))}
      </div>
    </div>
  );
}
