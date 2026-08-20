import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Loading admin tools" className="grid gap-5">
      <div className="grid gap-2">
        <Skeleton className="h-8 w-56 bg-white/15" />
        <Skeleton className="h-4 w-96 max-w-full bg-white/10" />
      </div>
      <div className="grid gap-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            className="rounded-[var(--px-radius-sm)] border border-white/10 bg-white/5 p-4"
            key={index}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-4 w-2/3 bg-white/15" />
                <Skeleton className="h-3 w-1/3 bg-white/10" />
              </div>
              <Skeleton className="h-9 w-24 bg-white/15" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
