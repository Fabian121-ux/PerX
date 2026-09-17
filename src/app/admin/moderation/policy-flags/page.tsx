import Link from "next/link";
import { unstable_rethrow } from "next/navigation";

import { AdminSection } from "@/components/admin-section";
import { Badge } from "@/components/ui/badge";
import { Card, EmptyState } from "@/components/ui/card";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { classifyError } from "@/lib/errors/taxonomy";
import type { SafeUserSummary } from "@/lib/admin/moderation-records";
import { formatAdminValue, safeUserLabel } from "@/lib/admin/moderation-records";

export const dynamic = "force-dynamic";

/** Bounded: this is a work queue, not an archive to browse. */
const PAGE_SIZE = 50;

type PolicyFlagCase = {
  category: string;
  createdAt: Date;
  id: string;
  reportedUserId: string | null;
  status: string;
  summary: string;
  targetId: string;
  title: string;
};

function ageInDays(createdAt: Date) {
  return Math.max(
    0,
    Math.floor((Date.now() - createdAt.getTime()) / 86_400_000),
  );
}

/**
 * Open policy-flag cases.
 *
 * These listings are withheld from every public feed and their authors have
 * been told a review is coming. Until this page existed nothing listed them:
 * the case detail route worked but nothing linked to it, so "under review" was
 * a promise the product could not keep.
 *
 * Oldest first, deliberately - the author who has waited longest is served
 * first, which is the opposite of what a newest-first feed would do.
 *
 * Admins see the matched rule here. That is the admin side of the boundary
 * P0-4 established: the detail is what makes the case decidable, and it is
 * exactly what the author must never be shown.
 */
export default async function AdminPolicyFlagsPage() {
  await requireCapabilityOrNotFound("admin:moderate");

  let cases: PolicyFlagCase[] = [];
  let authors = new Map<string, SafeUserSummary>();
  let casesUnavailable = false;
  try {
    cases = await getPrisma().moderationCase.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        category: true,
        createdAt: true,
        id: true,
        reportedUserId: true,
        status: true,
        summary: true,
        targetId: true,
        title: true,
      },
      take: PAGE_SIZE,
      where: {
        source: "POLICY_FLAG",
        status: { notIn: ["RESOLVED", "DISMISSED", "CLOSED"] },
      },
    });

    /*
     * `ModerationCase.reportedUserId` carries no Prisma relation, so authors
     * are hydrated separately - the same shape `getAdminModerationCase` uses.
     * Inside the same guard: a failure here degrades the page rather than
     * throwing a 500 over a queue that is otherwise readable.
     */
    const authorIds = [
      ...new Set(
        cases
          .map((moderationCase) => moderationCase.reportedUserId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (authorIds.length) {
      const users = await getPrisma().user.findMany({
        select: { id: true, isActive: true, name: true, username: true },
        where: { id: { in: authorIds } },
      });
      authors = new Map(
        users.map((user) => [
          user.id,
          {
            id: user.id,
            isActive: user.isActive,
            label: user.username ? `@${user.username}` : user.name,
            name: user.name,
            username: user.username,
          },
        ]),
      );
    }
  } catch (error) {
    // `notFound()` and `redirect()` are thrown control flow and must reach the
    // framework rather than being rendered as a degraded queue.
    unstable_rethrow(error);
    casesUnavailable = true;
    console.error("[ptahx:admin-policy-flags]", {
      digest:
        typeof error === "object" && error !== null && "digest" in error
          ? String((error as { digest?: unknown }).digest ?? "")
          : undefined,
      kind: classifyError(error),
      route: "/admin/moderation/policy-flags",
      timestamp: new Date().toISOString(),
    });
  }

  return (
    <AdminSection
      description="Listings withheld from public feeds by an automatic policy rule. Nobody reported these, and each author has been told a review is coming."
      title="Policy-flagged listings"
    >
      {casesUnavailable ? (
        <Card className="grid gap-2">
          <h2 className="font-bold text-white">
            Policy flags could not be loaded
          </h2>
          <p className="text-sm leading-6 text-slate-300">
            The queue is unavailable right now. No case has changed, and no
            listing has been released or withheld. Other admin tools are
            unaffected.
          </p>
        </Card>
      ) : cases.length === 0 ? (
        <EmptyState
          body="Listings withheld by an automatic policy rule will appear here for review."
          title="No policy flags waiting"
        />
      ) : (
        cases.map((moderationCase) => (
          <Card key={moderationCase.id}>
            <article className="grid gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-bold text-white">
                    <Link
                      className="hover:underline"
                      href={`/admin/moderation/cases/${moderationCase.id}`}
                    >
                      {moderationCase.title}
                    </Link>
                  </h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Author:{" "}
                    {safeUserLabel(
                      moderationCase.reportedUserId
                        ? (authors.get(moderationCase.reportedUserId) ?? null)
                        : null,
                      moderationCase.reportedUserId,
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge>{formatAdminValue(moderationCase.category)}</Badge>
                  <Badge>{formatAdminValue(moderationCase.status)}</Badge>
                </div>
              </div>

              {/* Admin-only: the matched rule is what makes this decidable. */}
              <p className="text-sm leading-6 text-slate-200">
                {moderationCase.summary}
              </p>

              <p className="text-xs text-slate-400">
                Waiting {ageInDays(moderationCase.createdAt)} day(s) · Listing{" "}
                {moderationCase.targetId}
              </p>
            </article>
          </Card>
        ))
      )}
    </AdminSection>
  );
}
