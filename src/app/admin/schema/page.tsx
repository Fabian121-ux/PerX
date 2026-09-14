import { AdminSection } from "@/components/admin-section";
import { Card } from "@/components/ui/card";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";
import { getMigrationDrift } from "@/lib/db/migration-drift";

export const dynamic = "force-dynamic";

/**
 * Schema drift detail.
 *
 * `/api/health` is public, so it can only say THAT the schema has drifted.
 * This is the authorized counterpart that says WHICH migrations, so an operator
 * can act on the alert without needing Production database access - the lack of
 * which is part of why September's drift went unexamined for 15 days.
 *
 * `settings:manage` matches `/admin/settings`, the existing home for
 * production-facing configuration that is safe to show an administrator.
 */
export default async function AdminSchemaPage() {
  // Runs first: an unauthorized visitor gets notFound() and never learns that
  // this diagnostic route exists, let alone what the deployment is running.
  await requireCapabilityOrNotFound("settings:manage");

  const drift = await getMigrationDrift();

  return (
    <AdminSection
      description="Compares the migrations this deployment was built with against the migrations its database reports as applied."
      title="Schema status"
    >
      <Card className="grid gap-2">
        <h2 className="font-bold text-white">
          {drift.state === "current"
            ? "Schema is up to date"
            : drift.state === "pending"
              ? "Migrations are pending"
              : drift.state === "unknown-applied"
                ? "Database is ahead of this build"
                : "Schema status could not be determined"}
        </h2>
        <p className="text-sm leading-6 text-slate-300">
          {drift.state === "current"
            ? "Every migration this build expects has been applied to the database."
            : drift.state === "pending"
              ? "This deployment is running code against a database that has not applied every migration the build expects. Apply them with the documented deploy procedure."
              : drift.state === "unknown-applied"
                ? "The database has applied migrations this build does not know about. That usually means a newer deployment or a rollback."
                : "The check could not run, so nothing is claimed either way. This is expected in mock mode or without a configured database."}
        </p>
      </Card>

      {drift.pending.length > 0 ? (
        <Card className="grid gap-2">
          <h2 className="font-bold text-white">
            Pending migrations ({drift.pending.length})
          </h2>
          <ul className="grid gap-1 text-sm text-slate-200">
            {drift.pending.map((name) => (
              <li className="font-mono text-xs" key={name}>
                {name}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {drift.unknownApplied.length > 0 ? (
        <Card className="grid gap-2">
          <h2 className="font-bold text-white">
            Applied but not in this build ({drift.unknownApplied.length})
          </h2>
          <ul className="grid gap-1 text-sm text-slate-200">
            {drift.unknownApplied.map((name) => (
              <li className="font-mono text-xs" key={name}>
                {name}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </AdminSection>
  );
}
