import { AdminList, AdminSection } from "@/components/admin-section";
import { CursorPagination } from "@/components/cursor-pagination";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";
import { getAdminUsersPage } from "@/lib/data/admin";
import type { AdminUserSummary } from "@/lib/data/providers/interfaces";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  await requireCapabilityOrNotFound("users:read");
  const params = await searchParams;
  const page = await getAdminUsersPage({
    cursor: params.cursor,
    pageSize: 20,
  });

  return (
    <AdminSection
      description="Review current account availability, authorization roles, verification, and bounded persisted activity. Enforcement history and role administration are outside this view."
      title="Users"
    >
      <AdminList
        empty="No users"
        items={page.items}
        render={(item) => <AdminRecord item={item} />}
      />
      <CursorPagination
        basePath="/admin/users"
        cursor={page.cursor}
        label="Admin users pagination"
        nextCursor={page.nextCursor}
      />
    </AdminSection>
  );
}

function AdminRecord({ item }: { item: AdminUserSummary }) {
  return (
    <article className="grid gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-bold text-[color:var(--px-text)]">{item.name}</h2>
          <p className="mt-1 break-all text-sm text-[color:var(--px-text-muted)]">
            @{item.username} · {item.email}
          </p>
        </div>
        <span className={accountStateClass(item.accountState)}>
          {humanize(item.accountState)}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wide">
        <span className="rounded-full bg-[color:var(--px-primary-soft)] px-2.5 py-1 text-[color:var(--px-primary)]">
          {humanize(item.verificationStatus)}
        </span>
        <span className="rounded-full bg-[color:var(--px-muted)] px-2.5 py-1 text-[color:var(--px-text-muted)]">
          {humanize(item.accountClassification)}
        </span>
        {item.roles.map((role) => (
          <span
            className="rounded-full border border-[color:var(--px-border)] px-2.5 py-1 text-[color:var(--px-text-muted)]"
            key={role.name}
          >
            {role.label}
          </span>
        ))}
      </div>

      {item.activeRestrictions.length ? (
        <div className="flex flex-wrap gap-2 text-xs font-semibold text-amber-800 dark:text-amber-200">
          {item.activeRestrictions.map((restriction) => (
            <span
              className="rounded-full bg-amber-500/10 px-2.5 py-1"
              key={restriction.kind}
            >
              {humanize(restriction.kind)} restricted until {restriction.until.toLocaleString()}
            </span>
          ))}
        </div>
      ) : null}

      <p className="text-sm text-[color:var(--px-text-muted)]">
        {item.activity.ownedOpportunities} opportunities · {item.activity.completedAgreements}{" "}
        completed agreements · {item.activity.publicReviewsReceived} public reviews
      </p>
      <p className="text-xs text-[color:var(--px-text-muted)]">
        Joined {item.createdAt.toLocaleDateString()}
        {item.accountState === "SUSPENDED" && item.suspendedUntil
          ? ` · Suspension ends ${item.suspendedUntil.toLocaleString()}`
          : ""}
      </p>
    </article>
  );
}

function humanize(value: string) {
  return value.toLocaleLowerCase().replaceAll("_", " ");
}

function accountStateClass(state: AdminUserSummary["accountState"]) {
  const base =
    "w-fit rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide";
  return state === "ACTIVE"
    ? `${base} bg-emerald-500/10 text-emerald-700 dark:text-emerald-200`
    : `${base} bg-red-500/10 text-red-700 dark:text-red-200`;
}
