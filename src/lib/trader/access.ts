import { getPrisma } from "@/lib/db/prisma";
import { hasCapability, type RoleName } from "@/lib/permissions/capabilities";

/**
 * Trading access = the capability that actually gates creation.
 *
 * Deliberately derived from `opportunity:create` rather than a separate
 * "is a trader" flag. Navigation and route authorization must resolve from one
 * source; a duplicated notion of trader-ness is exactly how the Create entry
 * point and the Create route drifted apart before.
 */
export function isTrader(roles: readonly RoleName[]) {
  return hasCapability(roles as RoleName[], "opportunity:create");
}

/**
 * Role granted on approval.
 *
 * CLIENT already carries `opportunity:create` (plus the proposal-decision and
 * review capabilities a trader needs). Introducing a parallel TRADER role would
 * duplicate an existing capability set and force every role-mapping test, seed
 * and enum to change for no behavioural gain.
 */
export const TRADER_GRANT_ROLE: RoleName = "CLIENT";

export type TraderApplicationView = {
  decidedAt: Date | null;
  headline: string;
  id: string;
  reviewerNote: string | null;
  status:
    | "APPROVED"
    | "DRAFT"
    | "NEEDS_CHANGES"
    | "PENDING_REVIEW"
    | "REJECTED"
    | "SUSPENDED";
  submittedAt: Date | null;
  tradeCategory: string;
};

/**
 * The viewer's own application, or null.
 *
 * Narrow projection: the status surface renders a headline, a status and a
 * reviewer note. Nothing else needs to reach the browser.
 */
export async function getOwnTraderApplication(
  userId: string,
): Promise<TraderApplicationView | null> {
  return getPrisma().traderApplication.findUnique({
    select: {
      decidedAt: true,
      headline: true,
      id: true,
      reviewerNote: true,
      status: true,
      submittedAt: true,
      tradeCategory: true,
    },
    where: { userId },
  });
}
