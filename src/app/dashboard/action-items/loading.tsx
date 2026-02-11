export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 h-8 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="space-y-4">
        <div className="flex gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 w-24 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
          ))}
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-20 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
          ))}
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
          <div className="h-12 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 border-b border-zinc-200 last:border-b-0 dark:border-zinc-800" />
          ))}
        </div>
      </div>
    </div>
  );
}
