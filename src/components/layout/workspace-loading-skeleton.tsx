import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shared workspace loading skeleton.
 *
 * This used to live at `src/app/app/loading.tsx`, where it created a Suspense
 * boundary above every authenticated route. Next.js flushes the HTTP response
 * as soon as it streams that fallback, so any `notFound()` raised afterwards by
 * a route-level existence/authorization gate could no longer set a 404 status —
 * missing and unauthorized resources answered 200.
 *
 * The boundary is now declared per segment, below those gates, so the skeleton
 * is preserved for routes that stream while gated routes keep correct statuses.
 */
export function WorkspaceLoadingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading workspace" className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-11 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            className="grid gap-4 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-4"
            key={index}
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-24 w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
