import { AdminSection } from "@/components/admin-section";
import { Card } from "@/components/ui/card";
import { getAdminActivitySummary } from "@/lib/data/admin";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-xs font-medium text-[color:var(--px-text-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[color:var(--px-text)]">{value.toLocaleString()}</p>
    </Card>
  );
}

export default async function AdminActivityPage() {
  await requireCapabilityOrNotFound("admin:access");
  const activity = await getAdminActivitySummary();

  return (
    <AdminSection
      description="Recent platform events and operational activity aggregated from the existing audit trail."
      title="Platform activity"
    >
      <section aria-label="Activity summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Events · last 24 hours" value={activity.eventsLast24Hours} />
        <Metric label="Events · last 7 days" value={activity.eventsLast7Days} />
        <Metric label="Events · last 30 days" value={activity.eventsLast30Days} />
        <Metric label="Active actors · last 7 days" value={activity.activeActorsLast7Days} />
      </section>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-[color:var(--px-text)]">Recent events</h2>
          <span className="text-xs text-[color:var(--px-text-muted)]">Latest 12 audit records</span>
        </div>
        {activity.recentEvents.length === 0 ? (
          <p className="text-sm text-[color:var(--px-text-muted)]">No recorded platform activity yet.</p>
        ) : (
          <ol className="divide-y divide-[color:var(--px-border)]">
            {activity.recentEvents.map((event) => (
              <li className="grid gap-1 py-3 first:pt-0 last:pb-0" key={event.id}>
                <p className="text-sm font-semibold text-[color:var(--px-text)]">{event.action}</p>
                <p className="text-xs text-[color:var(--px-text-muted)]">
                  {event.actor ? `@${event.actor.username}` : "System"}
                  {event.entityType ? ` · ${event.entityType}` : ""}
                  {event.entityId ? ` · ${event.entityId}` : ""}
                </p>
                <time className="text-xs text-[color:var(--px-text-muted)]" dateTime={event.createdAt.toISOString()}>
                  {event.createdAt.toLocaleString()}
                </time>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </AdminSection>
  );
}
