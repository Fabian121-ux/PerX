import { Skeleton } from "@/components/ui/skeleton";

export default function SearchLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading search results"
      className="grid gap-6"
    >
      <div className="grid gap-2">
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <div className="grid gap-5 rounded-[var(--px-radius)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton className="h-10 w-full" key={index} />
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton className="h-11 w-full" key={index} />
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton className="h-72 w-full" key={index} />
        ))}
      </div>
    </div>
  );
}
