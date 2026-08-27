/**
 * Messages-shaped placeholder.
 *
 * The previous fallback was two flat rectangles, so the real workspace landing
 * moved every row. This mirrors the actual geometry: a conversation list of
 * avatar + two text lines on the left, and an alternating bubble thread on the
 * right, matching the `300px_1fr` grid the workspace uses at desktop widths.
 *
 * `aria-hidden` on the whole tree keeps a screen reader from narrating a dozen
 * meaningless boxes; the single polite live region below announces the state
 * once instead.
 */
const BAR =
  "animate-pulse rounded bg-[color:var(--px-muted)] motion-reduce:animate-none";

function ConversationRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <div className={`h-11 w-11 shrink-0 rounded-full ${BAR}`} />
      <div className="min-w-0 flex-1 space-y-2">
        <div className={`h-3.5 w-1/2 ${BAR}`} />
        <div className={`h-3 w-3/4 ${BAR}`} />
      </div>
    </div>
  );
}

function BubbleSkeleton({ mine }: { mine?: boolean }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`h-14 rounded-[18px] ${BAR} ${mine ? "w-1/2" : "w-2/3"}`}
      />
    </div>
  );
}

export function MessagesSkeleton() {
  return (
    <>
      <div
        aria-hidden
        className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]"
      >
        <div className="hidden min-h-0 flex-col overflow-hidden rounded-[var(--px-radius)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] lg:flex">
          <div className="border-b border-[color:var(--px-border)] p-3">
            <div className={`h-9 w-full ${BAR}`} />
          </div>
          {Array.from({ length: 6 }).map((_, index) => (
            <ConversationRowSkeleton key={index} />
          ))}
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-[var(--px-radius)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)]">
          <div className="flex items-center gap-3 border-b border-[color:var(--px-border)] p-3">
            <div className={`h-10 w-10 shrink-0 rounded-full ${BAR}`} />
            <div className="min-w-0 flex-1 space-y-2">
              <div className={`h-3.5 w-40 max-w-[60%] ${BAR}`} />
              <div className={`h-3 w-24 max-w-[40%] ${BAR}`} />
            </div>
          </div>

          <div className="flex-1 space-y-3 p-3">
            <BubbleSkeleton />
            <BubbleSkeleton mine />
            <BubbleSkeleton />
            <BubbleSkeleton mine />
          </div>

          <div className="border-t border-[color:var(--px-border)] p-3">
            <div className={`h-11 w-full ${BAR}`} />
          </div>
        </div>
      </div>
      <p aria-live="polite" className="sr-only">
        Loading messages
      </p>
    </>
  );
}
