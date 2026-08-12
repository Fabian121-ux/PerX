import { Card } from "@/components/ui/card";

export default function NotificationsLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading notifications"
      className="grid gap-5"
      role="status"
    >
      <div aria-hidden className="h-10 w-64 animate-pulse rounded-xl bg-[color:var(--px-muted)]" />
      <div aria-hidden className="grid gap-4">
        {Array.from({ length: 5 }, (_, index) => (
          <Card className="min-h-32 animate-pulse" key={index}>
            <div className="h-4 w-1/3 rounded bg-[color:var(--px-muted)]" />
            <div className="mt-4 h-3 w-2/3 rounded bg-[color:var(--px-muted)]" />
            <div className="mt-3 h-3 w-1/2 rounded bg-[color:var(--px-muted)]" />
          </Card>
        ))}
      </div>
    </div>
  );
}
