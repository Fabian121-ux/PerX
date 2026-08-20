import { getPrisma } from "@/lib/db/prisma";

/**
 * Personal activity counts shown on the viewer's own Profile.
 *
 * This is the data that used to live on the unreachable `/app/dashboard`
 * route. It is OPTIONAL data: Profile's critical dependency is identity and
 * authorization, which is already resolved by `requireUser()`. If any of these
 * aggregates fail, Profile must still render the user's identity.
 *
 * Every field is therefore individually degradable - see `getProfileActivity`.
 */
export type ProfileActivity = {
  activeAgreements: number;
  completedAgreements: number;
  drafts: number;
  proposalsReceived: number;
  proposalsSent: number;
  published: number;
  savedItems: number;
  /** True when at least one aggregate failed and is being shown as a dash. */
  degraded: boolean;
};

export type ProfileActivityValue = number | null;

const EMPTY: ProfileActivity = {
  activeAgreements: 0,
  completedAgreements: 0,
  degraded: false,
  drafts: 0,
  proposalsReceived: 0,
  proposalsSent: 0,
  published: 0,
  savedItems: 0,
};

/** Deal states that mean "money/work is in flight". */
const ACTIVE_DEAL_STATUSES = [
  "AWAITING_FUNDING",
  "FUNDED",
  "IN_PROGRESS",
] as const;

/** Deal states that mean the agreement reached a successful end. */
const COMPLETED_DEAL_STATUSES = ["APPROVED", "RELEASED"] as const;

/**
 * Loads the viewer's own activity counts.
 *
 * Uses `Promise.allSettled` rather than `Promise.all` deliberately: these
 * aggregates are independent and partial success is useful. One failing count
 * shows as unavailable while the rest still render, instead of collapsing the
 * whole Profile route.
 *
 * All queries are scoped to `userId`, which is the authenticated viewer. This
 * function must never be called with another user's id - it exposes private
 * counts (drafts, proposals received) that are not public information.
 */
export async function getProfileActivity(
  userId: string,
): Promise<ProfileActivity> {
  if (!userId) return EMPTY;

  const prisma = getPrisma();

  const results = await Promise.allSettled([
    prisma.dealParticipant.count({
      where: { deal: { status: { in: [...ACTIVE_DEAL_STATUSES] } }, userId },
    }),
    prisma.dealParticipant.count({
      where: { deal: { status: { in: [...COMPLETED_DEAL_STATUSES] } }, userId },
    }),
    prisma.proposal.count({ where: { senderId: userId } }),
    prisma.proposal.count({ where: { opportunity: { ownerId: userId } } }),
    prisma.opportunity.count({ where: { ownerId: userId, status: "DRAFT" } }),
    prisma.opportunity.count({
      where: { ownerId: userId, status: "PUBLISHED" },
    }),
    prisma.opportunityBookmark.count({ where: { userId } }),
  ]);

  const [
    activeAgreements,
    completedAgreements,
    proposalsSent,
    proposalsReceived,
    drafts,
    published,
    savedItems,
  ] = results.map((result) =>
    result.status === "fulfilled" ? result.value : 0,
  );

  return {
    activeAgreements,
    completedAgreements,
    degraded: results.some((result) => result.status === "rejected"),
    drafts,
    proposalsReceived,
    proposalsSent,
    published,
    savedItems,
  };
}
