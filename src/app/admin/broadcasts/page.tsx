import { AdminSection } from "@/components/admin-section";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { sendAdminBroadcastAction } from "@/features/admin/actions";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";

const audiences = [
  { label: "All active users", value: "ALL_ACTIVE_USERS" },
  { label: "Public beta users", value: "PUBLIC_BETA_USERS" },
  { label: "Internal testers", value: "INTERNAL_TEST_USERS" },
  { label: "Administrators", value: "ADMINISTRATORS" },
] as const;

export default async function AdminBroadcastsPage() {
  await requireCapabilityOrNotFound("broadcasts:create");
  const broadcasts = await getPrisma().adminBroadcast.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <AdminSection
      description="Send user-scoped platform notifications. Broadcasts are not private chat messages."
      title="Broadcasts"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <form action={sendAdminBroadcastAction} className="grid gap-4">
            <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
              Title
              <input
                className="rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)] outline-none focus:ring-2 focus:ring-[color:var(--px-focus)]"
                maxLength={120}
                minLength={4}
                name="title"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
              Message
              <textarea
                className="min-h-32 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)] outline-none focus:ring-2 focus:ring-[color:var(--px-focus)]"
                maxLength={1000}
                minLength={10}
                name="body"
                required
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
                Audience
                <select
                  className="rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)] outline-none focus:ring-2 focus:ring-[color:var(--px-focus)]"
                  name="audience"
                  required
                >
                  {audiences.map((audience) => (
                    <option key={audience.value} value={audience.value}>
                      {audience.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
                Priority
                <select
                  className="rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)] outline-none focus:ring-2 focus:ring-[color:var(--px-focus)]"
                  name="priority"
                >
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                </select>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
                Safe action URL
                <input
                  className="rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)] outline-none focus:ring-2 focus:ring-[color:var(--px-focus)]"
                  name="actionUrl"
                  placeholder="/app/notifications"
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
                Expiry
                <input
                  className="rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)] outline-none focus:ring-2 focus:ring-[color:var(--px-focus)]"
                  name="expiresAt"
                  type="datetime-local"
                />
              </label>
            </div>
            <Button type="submit">Send now</Button>
          </form>
        </Card>

        <Card>
          <h2 className="text-lg font-black text-[color:var(--px-text)]">Rules</h2>
          <div className="mt-3 grid gap-3 text-sm leading-6 text-[color:var(--px-text-muted)]">
            <p>Broadcasts create user-scoped notification records.</p>
            <p>Action URLs must be safe internal paths.</p>
            <p>Retries skip duplicate user/broadcast deliveries.</p>
            <p>Every send is recorded in the audit log.</p>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        {broadcasts.length ? (
          <div className="grid gap-3">
            {broadcasts.map((broadcast) => (
              <Card key={broadcast.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-black text-[color:var(--px-text)]">{broadcast.title}</h2>
                    <p className="mt-1 text-sm text-[color:var(--px-text-muted)]">
                      {broadcast.audience} · {broadcast.priority} · {broadcast.createdAt.toLocaleString()}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-[color:var(--px-text)]">
                    Delivered {broadcast.deliveryCount} · Failed {broadcast.failedCount}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            body="Sent admin broadcasts will appear here with delivery counts."
            title="No broadcasts"
          />
        )}
      </div>
    </AdminSection>
  );
}
