export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 h-8 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mb-4 flex gap-2">
        <div className="h-7 w-28 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-7 w-12 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900"
          />
        ))}
      </div>
    </div>
  );
}
