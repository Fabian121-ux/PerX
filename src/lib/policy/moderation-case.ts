import type { Prisma } from "@/generated/prisma/client";
import type { ModerationCaseStatus } from "@/generated/prisma/enums";
import type { PolicyResult } from "@/lib/policy/enforcement";

/**
 * Moderation case for a non-blocking policy flag.
 *
 * A listing that trips FLAG or LIMIT is created with `moderationStatus`
 * FLAGGED, and the public feed requires APPROVED - so it is invisible
 * everywhere. Until now nothing opened a case for it, which meant the listing
 * was invisible to the author, to every feed, AND to every admin queue at the
 * same time: a silent shadowban that nobody in the system could see.
 *
 * `ModerationCaseSource.POLICY_FLAG` already existed in the schema and was used
 * by nothing. This is what it is for.
 *
 * SECURITY: the returned `summary` and `title` are ADMIN-facing and name the
 * matched rule. They must never be surfaced to the author - a precise rule name
 * is a roadmap for evading moderation. The author-facing copy says only that
 * the listing is under review.
 */
export function buildPolicyFlagCaseData({
  ownerId,
  policy,
  targetId,
  targetType,
}: {
  ownerId: string;
  policy: PolicyResult;
  targetId: string;
  targetType: string;
}) {
  return {
    category: policy.category,
    priority: policy.severity === "high" ? "HIGH" : "NORMAL",
    // No reporter: this case was opened by the policy engine, not a person.
    reportedUserId: ownerId,
    source: "POLICY_FLAG" as const,
    status: "NEW" as const,
    summary: `${policy.internalReason} Outcome ${policy.outcome} from detector ${policy.detectorId} (confidence ${policy.confidence}, severity ${policy.severity}). The listing is withheld from public feeds until reviewed.`,
    targetId,
    targetType,
    title: `Policy flag on ${targetType.replaceAll("_", " ")}`,
    events: {
      create: {
        nextStatus: "NEW" as const,
        note: "Case opened automatically by the content policy engine.",
        type: "CASE_OPENED",
      },
    },
  };
}

/** Case statuses that mean an admin has already decided; not reopened. */
export const decidedPolicyFlagCaseStatuses: ModerationCaseStatus[] = [
  "RESOLVED",
  "DISMISSED",
  "CLOSED",
];

/**
 * The transaction client the caller is already inside.
 *
 * Narrowed to the three delegates this helper touches so callers keep their
 * real Prisma types and the compiler still checks every payload.
 */
type PolicyFlagCaseTx = Pick<
  Prisma.TransactionClient,
  "auditLog" | "moderationCase" | "moderationCaseEvent"
>;

/**
 * Open a policy-flag case for a withheld listing, or record a re-flag against
 * the one that is already open.
 *
 * RE-FLAG POLICY: one open case per withheld listing.
 *
 * A listing edited three times must not become three queue items. The decisive
 * constraint is in `reviewPolicyFlagCaseAction`: it releases the listing with
 * `updateMany ... where: { moderationStatus: "FLAGGED" }` and then requires
 * `count === 1`. The moment an admin decides the first of several duplicate
 * cases the listing leaves FLAGGED, so every remaining duplicate would fail
 * that guard forever - permanently undecidable rows sitting in the queue.
 * Reusing the open case keeps the one-case-per-withheld-listing invariant the
 * review surface was built against.
 *
 * A case that was already DECIDED is never reopened. The admin's decision
 * stands, and a later edit is new content that deserves a fresh case.
 *
 * Must be called inside the same transaction as the listing write: a FLAGGED
 * listing with no case is the silent shadowban this exists to prevent.
 */
export async function recordPolicyFlagCase({
  actorId,
  ownerId,
  policy,
  targetId,
  targetType = "opportunity",
  trigger,
  tx,
}: {
  actorId: string;
  ownerId: string;
  policy: PolicyResult;
  targetId: string;
  targetType?: string;
  trigger: string;
  tx: PolicyFlagCaseTx;
}) {
  const existing = await tx.moderationCase.findFirst({
    select: { id: true, status: true },
    where: {
      source: "POLICY_FLAG",
      status: { notIn: decidedPolicyFlagCaseStatuses },
      targetId,
      targetType,
    },
  });

  if (existing) {
    // Re-flag on an already-open case: record it on the timeline so the
    // reviewing admin sees the listing was changed again while waiting, rather
    // than silently discarding that fact.
    await tx.moderationCaseEvent.create({
      data: {
        actorId,
        caseId: existing.id,
        note: `Content re-flagged by the policy engine after ${trigger}. The listing remains withheld.`,
        type: "CASE_REFLAGGED",
      },
    });
  } else {
    await tx.moderationCase.create({
      data: buildPolicyFlagCaseData({ ownerId, policy, targetId, targetType }),
    });
  }

  // Written on the transaction client rather than via `writeAuditLog`, which
  // uses its own connection and swallows failures - neither is acceptable for
  // the record that a listing was withheld from the public.
  await tx.auditLog.create({
    data: {
      action: "moderation.policy_flag_case_opened",
      actorId,
      entityId: targetId,
      entityType: targetType,
      metadata: {
        ...policyFlagAuditMetadata(policy),
        reflagged: Boolean(existing),
        trigger,
      },
    },
  });
}

/** Audit metadata for the case, admin-side only. */
export function policyFlagAuditMetadata(policy: PolicyResult) {
  return {
    category: policy.category,
    confidence: policy.confidence,
    detectorId: policy.detectorId,
    outcome: policy.outcome,
    severity: policy.severity,
  };
}
