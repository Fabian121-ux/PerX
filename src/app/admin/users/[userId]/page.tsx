import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AdminUserSessionControls } from "@/components/admin/admin-user-session-controls";
import { AdminSection } from "@/components/admin-section";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { initiateUserPasswordResetAction } from "@/features/admin/actions";
import {
  getAdminUserAuditHistory,
  getAdminUserDetail,
  getAdminUserEnforcementHistory,
  getAdminUserSessionSummary,
} from "@/lib/admin/user-detail";
import { isPasswordResetDeliveryConfigured } from "@/lib/auth/password-reset-delivery";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";
import { hasCapability } from "@/lib/permissions/capabilities";
import { AdminUserResetButton } from "@/components/admin/admin-user-reset-button";

export const dynamic = "force-dynamic";

const STATE_TONE: Record<string, string> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-300",
  BANNED: "bg-red-500/15 text-red-300",
  DEACTIVATED: "bg-slate-500/20 text-slate-300",
  INACTIVE: "bg-slate-500/20 text-slate-300",
  SUSPENDED: "bg-amber-500/15 text-amber-300",
};

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  // `users:read` is the floor for opening the record at all. Each control
  // below re-checks its own capability; this gate never implies the others.
  const admin = await requireCapabilityOrNotFound("users:read");
  const { userId } = await params;

  const user = await getAdminUserDetail(userId);
  if (!user) notFound();

  const canManageUsers = hasCapability(admin.roles, "users:manage");
  const canRevokeSessions = hasCapability(admin.roles, "users:sessions:revoke");
  const resetDeliveryConfigured = isPasswordResetDeliveryConfigured();

  return (
    <AdminSection
      description="Account identity, authorization state, and the operational controls this administrator is permitted to use."
      title={user.name}
    >
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm text-slate-300">
              @{user.username} · {user.email}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Joined {user.createdAt.toISOString().slice(0, 10)}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              STATE_TONE[user.accountState] ?? "bg-slate-500/20 text-slate-300"
            }`}
          >
            {user.accountState}
          </span>
        </div>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <Detail label="Verification" value={user.verificationStatus} />
          <Detail label="Classification" value={user.accountClassification} />
          <Detail
            label="Roles"
            value={
              user.roles.map((role) => role.label).join(", ") || "No roles"
            }
          />
          <Detail
            label="Suspended until"
            value={
              user.suspendedUntil
                ? user.suspendedUntil
                    .toISOString()
                    .slice(0, 16)
                    .replace("T", " ")
                : "Not suspended"
            }
          />
        </dl>

        {user.activeRestrictions.length ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {user.activeRestrictions.map((restriction) => (
              <li
                className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200"
                key={restriction.kind}
              >
                {restriction.kind.toLowerCase().replace(/_/g, " ")} until{" "}
                {restriction.until.toISOString().slice(0, 10)}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            className="text-sm font-semibold text-[color:var(--px-primary)] hover:underline"
            href={`/u/${user.username}`}
          >
            View public profile
          </Link>
          <Link
            className="text-sm font-semibold text-slate-300 hover:underline"
            href="/admin/users"
          >
            Back to users
          </Link>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-black text-white">Account actions</h2>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          Suspension, deactivation and permanent bans are applied from a
          moderation case so the reason, user-facing explanation and appeal
          route are recorded with the action.
        </p>

        <div className="mt-4 grid gap-3">
          {canManageUsers ? (
            <form action={initiateUserPasswordResetAction}>
              <input name="userId" type="hidden" value={user.id} />
              <AdminUserResetButton />
              <p className="mt-2 text-xs text-slate-400">
                {resetDeliveryConfigured
                  ? "Sends the account holder a single-use link. No administrator sees or sets the password."
                  : "No email provider is connected, so the link is generated and recorded but not sent. Share a reset another way until delivery is configured."}
              </p>
            </form>
          ) : null}

          {canRevokeSessions ? (
            <AdminUserSessionControls userId={user.id} />
          ) : null}

          {!canManageUsers && !canRevokeSessions ? (
            <p className="text-sm text-slate-400">
              Your role can view this account but cannot perform account
              actions.
            </p>
          ) : null}
        </div>
      </Card>

      {/*
        Optional panels stream independently. A failure or slow query in
        history must never prevent the identity card and the controls above
        from being usable.
      */}
      <Suspense fallback={<PanelSkeleton title="Sessions" />}>
        <SessionPanel userId={user.id} />
      </Suspense>

      <Suspense fallback={<PanelSkeleton title="Enforcement history" />}>
        <EnforcementPanel userId={user.id} />
      </Suspense>

      <Suspense fallback={<PanelSkeleton title="Recent audit history" />}>
        <AuditPanel userId={user.id} />
      </Suspense>
    </AdminSection>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-200">{value}</dd>
    </div>
  );
}

function PanelSkeleton({ title }: { title: string }) {
  return (
    <Card>
      <h2 className="text-sm font-black text-white">{title}</h2>
      <div className="mt-3 grid gap-2" aria-hidden>
        <Skeleton className="h-4 w-2/3 bg-white/15" />
        <Skeleton className="h-4 w-1/2 bg-white/10" />
      </div>
    </Card>
  );
}

async function SessionPanel({ userId }: { userId: string }) {
  const summary = await getAdminUserSessionSummary(userId).catch(() => null);

  return (
    <Card>
      <h2 className="text-sm font-black text-white">Sessions</h2>
      {summary ? (
        <p className="mt-2 text-sm text-slate-300">
          {summary.activeSessions} active{" "}
          {summary.activeSessions === 1 ? "session" : "sessions"}
          {summary.lastSeenAt
            ? ` · last seen ${summary.lastSeenAt.toISOString().slice(0, 16).replace("T", " ")}`
            : ""}
        </p>
      ) : (
        <p className="mt-2 text-sm text-slate-400">
          Session activity is unavailable right now. Account management above is
          unaffected.
        </p>
      )}
    </Card>
  );
}

async function EnforcementPanel({ userId }: { userId: string }) {
  const history = await getAdminUserEnforcementHistory(userId).catch(
    () => null,
  );

  return (
    <Card>
      <h2 className="text-sm font-black text-white">Enforcement history</h2>
      {history === null ? (
        <p className="mt-2 text-sm text-slate-400">
          Enforcement history is unavailable right now.
        </p>
      ) : history.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">
          No enforcement has been applied to this account.
        </p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {history.map((entry) => (
            <li className="text-sm text-slate-300" key={entry.id}>
              <span className="font-semibold text-white">
                {entry.type.toLowerCase().replace(/_/g, " ")}
              </span>{" "}
              · {entry.status.toLowerCase()} ·{" "}
              {entry.createdAt.toISOString().slice(0, 10)}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

async function AuditPanel({ userId }: { userId: string }) {
  const history = await getAdminUserAuditHistory(userId).catch(() => null);

  return (
    <Card>
      <h2 className="text-sm font-black text-white">Recent audit history</h2>
      {history === null ? (
        <p className="mt-2 text-sm text-slate-400">
          Audit history is unavailable right now.
        </p>
      ) : history.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">
          No recorded administrative actions for this account.
        </p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {history.map((entry) => (
            <li className="text-sm text-slate-300" key={entry.id}>
              <span className="font-semibold text-white">{entry.action}</span> ·{" "}
              {entry.actor ? `@${entry.actor.username}` : "system"} ·{" "}
              {entry.createdAt.toISOString().slice(0, 16).replace("T", " ")}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
