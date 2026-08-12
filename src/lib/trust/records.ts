import { getPrisma } from "@/lib/db/prisma";

export type TrustRecordEvidence = {
  averageRating: number;
  completedAgreements: number;
  publicReviewCount: number;
};

const emptyEvidence: TrustRecordEvidence = {
  averageRating: 0,
  completedAgreements: 0,
  publicReviewCount: 0,
};

export async function getTrustRecordEvidenceByUserIds(userIds: readonly string[]) {
  const ids = [...new Set(userIds.filter(Boolean))];
  const evidence = new Map<string, TrustRecordEvidence>(
    ids.map((id) => [id, { ...emptyEvidence }]),
  );
  if (!ids.length) return evidence;

  const [agreementGroups, reviewGroups] = await Promise.all([
    getPrisma().dealParticipant.groupBy({
      _count: { _all: true },
      by: ["userId"],
      where: {
        deal: { status: { in: ["APPROVED", "RELEASED"] } },
        userId: { in: ids },
      },
    }),
    getPrisma().review.groupBy({
      _avg: { rating: true },
      _count: { _all: true },
      by: ["subjectId"],
      where: { subjectId: { in: ids }, visibility: "PUBLIC" },
    }),
  ]);

  for (const group of agreementGroups) {
    evidence.set(group.userId, {
      ...(evidence.get(group.userId) ?? emptyEvidence),
      completedAgreements: group._count._all,
    });
  }
  for (const group of reviewGroups) {
    evidence.set(group.subjectId, {
      ...(evidence.get(group.subjectId) ?? emptyEvidence),
      averageRating: group._avg.rating ?? 0,
      publicReviewCount: group._count._all,
    });
  }

  return evidence;
}

export async function getTrustRecordEvidence(userId: string) {
  const evidence = await getTrustRecordEvidenceByUserIds([userId]);
  return evidence.get(userId) ?? { ...emptyEvidence };
}
