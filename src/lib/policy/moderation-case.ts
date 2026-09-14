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
