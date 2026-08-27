import { AdminList, AdminSection } from "@/components/admin-section";
import { CursorPagination } from "@/components/cursor-pagination";
import { getAdminListPage } from "@/lib/data/admin";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";

type AuditEntry = {
  action?: string;
  actor?: { id: string; name: string; username: string } | null;
  createdAt?: Date;
  entityId?: string | null;
  entityType?: string;
  id: string;
};

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  await requireCapabilityOrNotFound("audit:read");
  const params = await searchParams;
  const page = await getAdminListPage("audit", {
    cursor: params.cursor,
    pageSize: 30,
  });

  return (
    <AdminSection
      description="Audit trails for protected operations, admin actions, and state transitions."
      title="Audit logs"
    >
      <AdminList
        empty="No audit logs"
        items={page.items}
        render={(item) => <AuditRecord entry={item as AuditEntry} />}
      />
      <CursorPagination
        basePath="/admin/audit"
        cursor={page.cursor}
        label="Audit logs pagination"
        nextCursor={page.nextCursor}
      />
    </AdminSection>
  );
}

/**
 * An audit row is only useful if it answers who, what, and when. The query
 * already pays for the actor and timestamp, so rendering the action string
 * alone shipped that data to the browser and then discarded it.
 */
function AuditRecord({ entry }: { entry: AuditEntry }) {
  return (
    <article className="grid gap-1">
      <p className="text-sm font-semibold text-[color:var(--px-text)]">
        {entry.action ?? "Audit event"}
      </p>
      <p className="text-xs text-[color:var(--px-text-muted)]">
        {entry.actor ? `@${entry.actor.username}` : "System"}
        {entry.entityType ? ` · ${entry.entityType}` : ""}
        {entry.entityId ? ` · ${entry.entityId}` : ""}
      </p>
      {entry.createdAt ? (
        <time
          className="text-xs text-[color:var(--px-text-muted)]"
          dateTime={entry.createdAt.toISOString()}
        >
          {entry.createdAt.toLocaleString()}
        </time>
      ) : null}
    </article>
  );
}
