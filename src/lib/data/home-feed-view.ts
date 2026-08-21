import type { HomeFeedRow } from "@/lib/data/home-feed";
import { getTemporaryOpportunityImage } from "@/lib/data/temporary-images";
import { calculateTrustSummary } from "@/lib/trust/engine";
import type { TrustRecordEvidence } from "@/lib/trust/records";

/**
 * Serialisable feed card.
 *
 * The initial page is rendered on the server and later pages arrive as JSON
 * from `/api/home-feed`. Both paths run through `toHomeFeedPost` so a post
 * appended by infinite scroll is structurally identical to one that was
 * server-rendered - otherwise the two would drift and the seam would be
 * visible.
 *
 * Every field is JSON-safe: `BigInt` budgets become strings and dates become
 * ISO strings, because `BigInt` cannot cross a JSON boundary.
 */
export type HomeFeedPost = {
  authorAvatarUrl: string | null;
  authorId: string;
  authorName: string;
  authorUsername: string | null;
  budgetMaxMinor: string | null;
  budgetMinMinor: string | null;
  currency: string;
  id: string;
  imageAlt: string;
  imageUrl: string | null;
  location: string | null;
  publishedAt: string | null;
  remote: boolean;
  slug: string;
  summary: string;
  title: string;
  trust: ReturnType<typeof calculateTrustSummary>;
  type: string;
  viewerHasSaved: boolean;
};

type HomeFeedRowWithEvidence = HomeFeedRow & {
  owner: HomeFeedRow["owner"] & { trustRecordEvidence?: TrustRecordEvidence };
};

export function toHomeFeedPost(
  row: HomeFeedRowWithEvidence,
  { savedIds }: { savedIds: ReadonlySet<string> },
): HomeFeedPost {
  const storedImage = row.images.find((image) => image.isCover) ?? row.images[0];
  // Only fall back to a placeholder when the post genuinely has no media, so a
  // real upload is never replaced by decoration.
  const fallbackImage = storedImage ? null : getTemporaryOpportunityImage(row.slug);
  const evidence = row.owner.trustRecordEvidence;

  return {
    authorAvatarUrl:
      row.owner.profile?.profileImageUrl ?? row.owner.imageUrl ?? null,
    authorId: row.owner.id,
    authorName: row.owner.name,
    authorUsername: row.owner.username ?? null,
    budgetMaxMinor: row.budgetMaxMinor?.toString() ?? null,
    budgetMinMinor: row.budgetMinMinor?.toString() ?? null,
    currency: row.currency,
    id: row.id,
    imageAlt:
      storedImage?.altText ?? fallbackImage?.alt ?? `${row.title} preview`,
    imageUrl: storedImage?.url ?? fallbackImage?.src ?? null,
    location: row.location,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    remote: row.remote,
    slug: row.slug,
    summary: row.summary,
    title: row.title,
    trust: calculateTrustSummary({
      averageRating: evidence?.averageRating ?? 0,
      completedDeals: evidence?.completedAgreements ?? 0,
      emailVerifiedAt: row.owner.emailVerifiedAt ?? null,
      profileCompleteness: row.owner.profile?.profileCompleteness ?? 0,
      verificationStatus: row.owner.verificationStatus,
    }),
    type: row.type,
    viewerHasSaved: savedIds.has(row.id),
  };
}

/**
 * Which of these posts the viewer has already bookmarked.
 *
 * Batched into a single query keyed by the page's ids rather than resolved per
 * card, which would be an N+1 against `OpportunityBookmark`.
 */
export async function getSavedOpportunityIds(
  prismaBookmark: {
    findMany: (args: {
      select: { opportunityId: true };
      where: { opportunityId: { in: string[] }; userId: string };
    }) => Promise<{ opportunityId: string }[]>;
  },
  userId: string,
  opportunityIds: readonly string[],
): Promise<Set<string>> {
  const ids = [...new Set(opportunityIds)];
  if (!ids.length) return new Set();

  const rows = await prismaBookmark.findMany({
    select: { opportunityId: true },
    where: { opportunityId: { in: ids }, userId },
  });
  return new Set(rows.map((row) => row.opportunityId));
}
